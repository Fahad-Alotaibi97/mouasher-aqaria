-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — ربط الاستفسارات (leads) بالمكتب والإعلان
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الهدف: حين يضغط باحث «تواصل بخصوص هذا الإعلان» يُحفظ استفساره مربوطاً
--  بمعرّف المكتب صاحب الإعلان (office_id) ومعرّف الإعلان (listing_id)، فيظهر
--  للمكتب في لوحته «الاستفسارات» بدل البيانات الوهمية — ويبقى ظاهراً للأدمن.
-- ════════════════════════════════════════════════════════════

-- 1) عمودان جديدان (إن لم يكونا موجودين)
alter table public.leads
  add column if not exists office_id  uuid references public.offices(id)  on delete set null,
  add column if not exists listing_id uuid references public.listings(id) on delete set null;

create index if not exists leads_office_id_idx on public.leads(office_id);

-- 2) سياسة قراءة: صاحب المكتب يرى استفسارات مكتبه فقط
drop policy if exists leads_office_read on public.leads;
create policy leads_office_read on public.leads
  for select to authenticated
  using (
    office_id is not null
    and exists (
      select 1 from public.offices o
      where o.id = leads.office_id and o.owner_id = auth.uid()
    )
  );

-- تحقّق (اختياري):
-- select id, name, office_id, listing_id, created_at from public.leads order by created_at desc limit 10;
