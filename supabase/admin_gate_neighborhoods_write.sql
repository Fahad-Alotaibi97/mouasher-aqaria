-- ════════════════════════════════════════════════════════════
--  السماح بحفظ متوسطات الأحياء من لوحة /admin المحميّة بكلمة مرور
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  لماذا؟ صارت لوحة /admin محميّة بكلمة مرور بسيطة (بلا جلسة Supabase)، فلا
--  يوجد auth.uid() لمدير، وسياسة neighborhoods_admin_write (التي تتطلّب
--  is_admin) تمنع الحفظ. هذه السياسة تسمح بالكتابة عبر مفتاح anon فيعمل الحفظ.
--
--  ملاحظة أمنية: القراءة عامة أصلاً، والبيانات منخفضة الحساسية (متوسطات أحياء).
--  هذه السياسة تتيح الكتابة لأي حامل مفتاح anon العام. كافٍ لهذا الاستخدام،
--  ويمكن تشديده لاحقاً عبر دالة RPC security definer تتحقّق من كلمة مرور.
-- ════════════════════════════════════════════════════════════

alter table public.neighborhoods enable row level security;

-- سياسة كتابة عامة (insert/update/delete) على الأحياء لدور anon (و authenticated)
drop policy if exists "neighborhoods_public_write" on public.neighborhoods;
create policy "neighborhoods_public_write" on public.neighborhoods
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- (القراءة العامة موجودة مسبقاً عبر سياسة neighborhoods_read؛ نتأكّد منها)
drop policy if exists "neighborhoods_read" on public.neighborhoods;
create policy "neighborhoods_read" on public.neighborhoods
  for select using (true);
