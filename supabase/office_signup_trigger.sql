-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — إنشاء صف المكتب تلقائياً عند تسجيل حساب «مكتب»
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الفكرة: trigger على auth.users يعمل بصلاحية security definer (يتجاوز RLS
--  والتوقيت)، يقرأ نوع الحساب من بيانات التسجيل (raw_user_meta_data):
--   • يضبط profiles.role = office | seeker  (يفصل المكتب عن الباحث)
--   • إن كان مكتباً: ينشئ صف public.offices مربوط بصاحب الحساب.
-- ════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   text := coalesce(new.raw_user_meta_data->>'role', 'seeker');
  v_name   text := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  v_office text := nullif(trim(new.raw_user_meta_data->>'office_name'), '');
  v_fal    text := nullif(trim(new.raw_user_meta_data->>'fal'), '');
begin
  -- 1) ملف المستخدم مع الدور الصحيح
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(v_name, v_office),
    case when v_role = 'office' then 'office' else 'seeker' end
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role      = excluded.role;

  -- 2) إن كان الحساب مكتباً: أنشئ صف المكتب (مرة واحدة)
  if v_role = 'office'
     and not exists (select 1 from public.offices where owner_id = new.id) then
    insert into public.offices (owner_id, name, fal_license)
    values (new.id, coalesce(v_office, 'مكتب عقاري'), v_fal);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- تحقّق بعد التشغيل (اختياري):
-- select id, full_name, role from public.profiles order by created_at desc limit 5;
-- select id, name, owner_id from public.offices order by created_at desc limit 5;
