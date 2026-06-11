-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — استرجاع سياسات الرسائل (leads) المفقودة على الإنتاج
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  ★ مُثبَت بفحص حي (2026-06-11): كل إدراج في leads محجوب 42501
--    (زائر/مسجّل، مع/بدون office_id) ⇒ سياسة leads_insert_anon غير موجودة
--    على الإنتاج، فكل النماذج العامة («اترك رسالة»، «استفسار»،
--    «تواصل بخصوص الإعلان»، «تواصل مع المنصة») تفشل حالياً.
--  هذا الملف يعيد سياسات leads الأربع كاملة كي لا يبقى أي انجراف.
-- ════════════════════════════════════════════════════════════

alter table public.leads enable row level security;

-- 1) الإدراج: زائر (استفسار) + مسجّل (استفسار/دعم) — هذه هي المفقودة
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon" on public.leads
  for insert to anon, authenticated
  with check (true);

-- 2) صاحب المكتب يقرأ استفسارات مكتبه (لوحة المكتب → الاستفسارات وأزرار الرد)
drop policy if exists "leads_office_read" on public.leads;
create policy "leads_office_read" on public.leads
  for select to authenticated
  using (
    office_id is not null
    and exists (
      select 1 from public.offices o
      where o.id = leads.office_id and o.owner_id = auth.uid()
    )
  );

-- 3) قراءة المدير لكل الرسائل (/admin → الرسائل والطلبات وأزرار الرد)
drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
  for select to authenticated
  using (public.is_admin_user());

-- 4) تحديث المدير (تعليم كمعالَجة)
drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update" on public.leads
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- إعادة تحميل مخطط PostgREST فوراً
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select policyname, cmd, roles from pg_policies
--   where schemaname='public' and tablename='leads' order by policyname;
-- المتوقع: leads_insert_anon (INSERT) + leads_office_read (SELECT)
--          + leads_admin_read (SELECT) + leads_admin_update (UPDATE)
