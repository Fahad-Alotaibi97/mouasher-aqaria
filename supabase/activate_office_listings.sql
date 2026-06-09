-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — تفعيل إدارة المكاتب والإعلانات + الربط الحقيقي
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  يضيف:
--   • listings.status (pending/approved/rejected) + listings.rejection_note
--   • offices.active + offices.status + offices.rejection_note
--   • سياسات RLS: المدير (is_admin) قراءة/كتابة كاملة، القراءة العامة للمعتمد فقط،
--     وصاحب المكتب يدير مكتبه وإعلاناته.
-- ════════════════════════════════════════════════════════════

-- ضمان وجود عمود is_admin (تستخدمه سياسات المدير)
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- ── 1) أعمدة الإعلانات ───────────────────────────────────────
alter table public.listings
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
alter table public.listings add column if not exists rejection_note text;

-- اعتماد الإعلانات القائمة بلا مكتب (البيانات التجريبية) مرة واحدة حتى تبقى ظاهرة
update public.listings set status = 'approved' where office_id is null and status = 'pending';

-- ── 2) أعمدة المكاتب ─────────────────────────────────────────
alter table public.offices add column if not exists active boolean not null default true;
alter table public.offices
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
alter table public.offices add column if not exists rejection_note text;

-- ── 3) سياسات الإعلانات ──────────────────────────────────────
-- القراءة العامة: المعتمد والنشط فقط
drop policy if exists "listings_read" on public.listings;
create policy "listings_read" on public.listings
  for select using (active = true and status = 'approved');

-- صاحب المكتب: إدارة كاملة لإعلانات مكتبه (موجودة في schema لكن نعيدها للتأكيد)
drop policy if exists "listings_owner" on public.listings;
create policy "listings_owner" on public.listings
  for all
  using      (office_id in (select id from public.offices where owner_id = auth.uid()))
  with check (office_id in (select id from public.offices where owner_id = auth.uid()));

-- المدير: قراءة وكتابة كاملة على كل الإعلانات (بأي حالة)
drop policy if exists "listings_admin_all" on public.listings;
create policy "listings_admin_all" on public.listings
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ── 4) سياسات المكاتب ────────────────────────────────────────
-- القراءة العامة للمكاتب
drop policy if exists "offices_read" on public.offices;
create policy "offices_read" on public.offices for select using (true);

-- صاحب المكتب: إدارة مكتبه
drop policy if exists "offices_owner" on public.offices;
create policy "offices_owner" on public.offices
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- المدير: قراءة وكتابة كاملة على كل المكاتب
drop policy if exists "offices_admin_all" on public.offices;
create policy "offices_admin_all" on public.offices
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ── تحقّق اختياري ────────────────────────────────────────────
-- select id, title, status from public.listings order by created_at desc limit 5;
-- select id, name, status, active from public.offices order by created_at desc limit 5;
