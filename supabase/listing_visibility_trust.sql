-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — ظهور الإعلانات حسب مستوى ثقة المكتب
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  القاعدة:
--   • مكتب موثّق (verified=true): إعلانه يُنشر مباشرة (status='approved' تلقائياً)
--     — الإدارة وثّقت المكتب نفسه فلا مراجعة لكل إعلان.
--   • مكتب معتمد غير موثّق: كل إعلان يدخل 'pending' وتعتمده الإدارة إعلاناً بإعلان.
--   • مكتب موقوف/بانتظار الاعتماد: لا ينشر، وإعلاناته القائمة تختفي من العام.
--  التطبيق على مستوى القاعدة (trigger + RLS) فلا يتجاوزه أي عميل REST.
-- ════════════════════════════════════════════════════════════

alter table public.listings enable row level security;

-- 0) دالة فحص المدير (نفس تعريف lock_neighborhoods_write.sql — إعادة تأكيد idempotent)
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 1) القراءة العامة: إعلان معتمد ونشط + مكتبه معتمد ونشط
--    (تعليق مكتب لاحقاً يُخفي إعلاناته القائمة فوراً دون لمس صفوفها)
drop policy if exists "listings_read" on public.listings;
create policy "listings_read" on public.listings
  for select using (
    active = true
    and status = 'approved'
    and office_id is not null
    and exists (
      select 1 from public.offices o
      where o.id = listings.office_id
        and o.status = 'approved'
        and o.active = true
    )
  );

-- 2) صاحب المكتب: يرى ويدير إعلاناته دائماً (using)، لكن لا يكتب/يعدّل
--    إلا ومكتبه معتمد ونشط (with check) — الموقوف مجمّد
drop policy if exists "listings_owner" on public.listings;
create policy "listings_owner" on public.listings
  for all to authenticated
  using (
    office_id in (select id from public.offices where owner_id = auth.uid())
  )
  with check (
    office_id in (
      select id from public.offices
      where owner_id = auth.uid() and status = 'approved' and active = true
    )
  );

-- 3) المدير: إدارة كاملة (إعادة تأكيد — موجودة من activate_office_listings.sql)
drop policy if exists "listings_admin_all" on public.listings;
create policy "listings_admin_all" on public.listings
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- 4) فرض حالة الإعلان من القاعدة نفسها (لا يُتجاوز من أي عميل):
--    • عند الإدراج (غير المدير): المكتب موثّق ⇒ approved، وإلا ⇒ pending —
--      مهما أرسل العميل في status.
--    • عند التعديل (غير المدير): status و rejection_note مجمّدان على قيمتهما —
--      يسدّ ثغرة «أُدرج pending ثم أُحدّث إلى approved».
create or replace function public.enforce_listing_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verified boolean;
begin
  if public.is_admin_user() then
    return new; -- المدير يضبط الحالة كما يريد (اعتماد/رفض/تعديل)
  end if;
  if tg_op = 'INSERT' then
    select verified into v_verified from public.offices where id = new.office_id;
    new.status := case when coalesce(v_verified, false) then 'approved' else 'pending' end;
    new.rejection_note := null;
  else
    new.status := old.status;
    new.rejection_note := old.rejection_note;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_listing_status on public.listings;
create trigger trg_enforce_listing_status
  before insert or update on public.listings
  for each row execute function public.enforce_listing_status();

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select policyname, cmd from pg_policies
--   where schemaname='public' and tablename='listings' order by policyname;
-- select tgname from pg_trigger where tgrelid = 'public.listings'::regclass and not tgisinternal;
-- المتوقع: listings_read / listings_owner / listings_admin_all + trg_enforce_listing_status
