-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — الرسائل: نوع الرسالة (استفسار/دعم) + سياسات الإدراج والقراءة
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  يفعل ثلاثة أشياء دفعة واحدة:
--   1) عمود kind: يميّز استفسارات العملاء ('inquiry') عن رسائل دعم
--      المكاتب الموجّهة لإدارة المنصة ('support') — تظهر منفصلة في /admin.
--   2) سياسة الإدراج (المفقودة على الإنتاج): الزائر يرسل استفساراً،
--      والمكتب المسجّل يرسل استفساراً أو رسالة دعم. بدونها كل النماذج محجوبة 42501.
--   3) قراءة/تحديث المدير عبر is_admin_user() (الدالة الآمنة الموجودة من
--      lock_neighborhoods_write.sql) — ليرى المدير كل الرسائل في /admin.
--  (سياسة leads_office_read القائمة تبقى كما هي: المكتب يرى استفسارات مكتبه.)
-- ════════════════════════════════════════════════════════════

alter table public.leads enable row level security;

-- 0) أعمدة (idempotent)
alter table public.leads add column if not exists handled boolean not null default false;
alter table public.leads add column if not exists kind text not null default 'inquiry';
do $$ begin
  alter table public.leads add constraint leads_kind_check check (kind in ('inquiry', 'support'));
exception when duplicate_object then null; end $$;

-- 1) الإدراج: زائر (استفسار) + مسجّل (استفسار/دعم)
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon" on public.leads
  for insert to anon, authenticated
  with check (true);

-- 2) قراءة المدير لكل الرسائل
drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
  for select to authenticated
  using (public.is_admin_user());

-- 3) تحديث المدير (تعليم كمعالَجة)
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
-- المتوقع: leads_insert_anon (INSERT) + leads_admin_read (SELECT)
--          + leads_admin_update (UPDATE) + leads_office_read (SELECT، قائمة مسبقاً)
