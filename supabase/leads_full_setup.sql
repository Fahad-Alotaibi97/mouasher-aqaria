-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — إعداد جدول leads الكامل (عمود kind + السياسات الأربع)
--  ملف موحّد نظيف — انسخه كاملاً والصقه في: Supabase → SQL Editor → Run
--  آمن للتشغيل أكثر من مرة (idempotent). يعتمد is_admin_user() ويُعيد تأكيدها.
--
--  فحص حيّ (2026-06-11): الأعمدة kind/handled/office_id/listing_id موجودة،
--  لكن إدراج الرسائل محجوب 42501 ⇒ leads_insert_anon مفقودة. هذا الملف يضمن
--  كل شيء معاً فلا يبقى أي انجراف.
-- ════════════════════════════════════════════════════════════

alter table public.leads enable row level security;

-- ── 1) الأعمدة (idempotent — موجودة على الإنتاج، تُبقى للاكتمال الذاتي) ──
alter table public.leads add column if not exists handled    boolean not null default false;
alter table public.leads add column if not exists kind       text    not null default 'inquiry';
alter table public.leads add column if not exists office_id  uuid references public.offices(id)  on delete set null;
alter table public.leads add column if not exists listing_id uuid references public.listings(id) on delete set null;

do $$ begin
  alter table public.leads add constraint leads_kind_check check (kind in ('inquiry', 'support'));
exception when duplicate_object then null; end $$;

create index if not exists leads_office_id_idx on public.leads(office_id);

-- ── 2) دالة فحص المدير (نفس تعريف باقي الملفات — إعادة تأكيد idempotent) ──
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ── 3) السياسات الأربع ──────────────────────────────────────
-- (أ) الإدراج: زائر (استفسار) + مسجّل (استفسار/دعم) — هذه هي المفقودة
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon" on public.leads
  for insert to anon, authenticated
  with check (true);

-- (ب) صاحب المكتب يقرأ استفسارات مكتبه (لوحة المكتب + أزرار الرد)
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

-- (ج) قراءة المدير لكل الرسائل (/admin → الرسائل والطلبات + أزرار الرد)
drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
  for select to authenticated
  using (public.is_admin_user());

-- (د) تحديث المدير (تعليم كمعالَجة)
drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update" on public.leads
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- إعادة تحميل مخطط PostgREST فوراً
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل (في SQL Editor، له صلاحية رؤية pg_policies) ──
-- select policyname, cmd, roles from pg_policies
--   where schemaname='public' and tablename='leads' order by policyname;
-- المتوقع: leads_admin_read (SELECT) + leads_admin_update (UPDATE)
--          + leads_insert_anon (INSERT) + leads_office_read (SELECT)
