-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — إصلاح نهائي لجدول الرسائل (leads)
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  المشكلة المُثبَتة على الإنتاج:
--   • الإضافة كـ anon محجوبة (42501) ⇒ سياسة الإضافة غير مفعّلة للزوّار.
--   • سياسة قراءة المدير (leads_admin_read) غير موجودة ⇒ تُرجع القراءة 0 صفوف
--     بصمت (RLS) فتظهر «لا توجد رسائل بعد» رغم وجود رسائل محفوظة.
--  هذا الملف يضمن الثلاثة معاً: handled + الإضافة (anon+authenticated) + قراءة/تحديث المدير.
-- ════════════════════════════════════════════════════════════

alter table public.leads enable row level security;

-- العمود (idempotent)
alter table public.leads add column if not exists handled boolean not null default false;

-- 1) الإضافة: للزائر (anon) وللمسجَّل (authenticated)
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon" on public.leads
  for insert to anon, authenticated
  with check (true);

-- 2) قراءة المدير (هذه هي السياسة الناقصة التي تُفرِغ قسم الرسائل في /admin)
drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- 3) تحديث المدير (تعليم كمعالَجة)
drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update" on public.leads
  for update to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ── تحقّق سريع بعد التشغيل ────────────────────────────────────
-- select policyname, cmd, roles from pg_policies
--   where schemaname='public' and tablename='leads' order by policyname;
