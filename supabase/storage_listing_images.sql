-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — صور الإعلانات: سياسات التخزين + عمود التصنيف
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  المشكلة المُثبَتة: رفع الصور إلى bucket «listings» محجوب بغياب سياسات
--  storage RLS ⇒ كانت الإعلانات تُنشر بلا صور بصمت.
--  هذا الملف: (1) يضمن وجود الـ bucket وأنه عام للقراءة، (2) يسمح للمكاتب
--  المسجّلة بالرفع وحذف صورها هي فقط، (3) يضيف عمود الصور المصنّفة حسب الغرفة.
-- ════════════════════════════════════════════════════════════

-- 1) الـ bucket: موجود + عام (روابط الصور المباشرة تعمل للزوار)
insert into storage.buckets (id, name, public)
values ('listings', 'listings', true)
on conflict (id) do update set public = true;

-- 2) الرفع: للمستخدمين المسجّلين (المكاتب) داخل bucket «listings» فقط
drop policy if exists "listings_img_upload" on storage.objects;
create policy "listings_img_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listings');

-- 3) القراءة: للجميع (قائمة/تنزيل عبر API — الروابط العامة تعمل أصلاً لأن الـ bucket عام)
drop policy if exists "listings_img_read" on storage.objects;
create policy "listings_img_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'listings');

-- 4) الحذف: كل مستخدم يحذف ملفاته هو فقط (لاستبدال الصور لاحقاً)
drop policy if exists "listings_img_delete_own" on storage.objects;
create policy "listings_img_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listings' and owner = auth.uid());

-- 5) عمود الصور المصنّفة حسب الغرفة:
--    {facade, hall, majlis, kitchen, bedrooms: [...], bathrooms: [...]}
alter table public.listings add column if not exists images_by_category jsonb;

-- إعادة تحميل مخطط PostgREST فوراً
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select policyname, cmd from pg_policies
--   where schemaname='storage' and tablename='objects' and policyname like 'listings_img%';
-- select public from storage.buckets where id='listings';   -- المتوقع: true
-- select column_name from information_schema.columns
--   where table_name='listings' and column_name='images_by_category';
