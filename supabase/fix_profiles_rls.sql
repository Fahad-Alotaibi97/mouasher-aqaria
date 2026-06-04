-- ════════════════════════════════════════════════════════════
--  إصلاح RLS لجدول profiles + ضمان صلاحية الأدمن
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  السبب الجذري (مؤكَّد بالاختبار على الإنتاج):
--    جدول profiles مفعّل عليه RLS لكن بدون سياسة SELECT تسمح للمستخدم بقراءة
--    صفّه. لذلك كانت قراءة is_admin تُرجع صفراً من الصفوف دائماً (لا خطأ ظاهر)،
--    فيُحسب المستخدم "غير مدير" ويفشل التحويل التلقائي للوحة /admin بصمت.
--    (اختبار: تسجيل مستخدم جديد ثم قراءة صفّه = 0 صفوف، وإدراج صفّه = خطأ 42501.)
-- ════════════════════════════════════════════════════════════

-- 0) تأكيد العمود والـ RLS
alter table public.profiles enable row level security;
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 1) ★ الإصلاح الأساسي: السماح للمستخدم بقراءة صفّه (auth.uid() = id)
drop policy if exists "profiles_self_read" on public.profiles;  -- إزالة الاسم القديم إن وُجد
drop policy if exists "profiles_read_own"  on public.profiles;
create policy "profiles_read_own" on public.profiles
  for select using (auth.uid() = id);

-- 2) السماح للمستخدم بإنشاء/تحديث صفّه (يلزم للتطبيق وكشبكة أمان للتريغر)
drop policy if exists "profiles_self_write"  on public.profiles;
create policy "profiles_self_write"  on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 3) إعادة تأكيد التريغر الذي يُنشئ صف profiles عند التسجيل
--    (security definer ⇒ يتجاوز RLS عند الإدراج التلقائي)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) تعبئة الصفوف الناقصة لكل المستخدمين الحاليين (يشمل الحسابات القديمة)
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- 5) ★ منح صلاحية الأدمن لحساب المالك (يُطبّق أياً كان uuid الحساب)
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and u.email = 'faud969@gmail.com';

-- 6) (تحقّق اختياري) اعرض حالة حساب الأدمن بعد التشغيل:
-- select u.email, p.is_admin
--   from public.profiles p join auth.users u on u.id = p.id
--   where u.email = 'faud969@gmail.com';
