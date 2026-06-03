-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — مخطط قاعدة البيانات (Supabase / PostgreSQL)
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════

-- 1) الأحياء ومتوسطاتها ----------------------------------------
create table if not exists public.neighborhoods (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  avg_rent    integer not null,          -- متوسط الإيجار السنوي بالريال
  created_at  timestamptz default now()
);

-- 2) ملفات المستخدمين (مرتبطة بحساب المصادقة) -------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'seeker'    -- 'seeker' باحث | 'office' مكتب
              check (role in ('seeker', 'office')),
  created_at  timestamptz default now()
);

-- 3) المكاتب العقارية ------------------------------------------
create table if not exists public.offices (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  fal_license   text,
  verified      boolean default false,
  created_at    timestamptz default now()
);

-- 4) الإعلانات -------------------------------------------------
create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),
  office_id     uuid references public.offices(id) on delete set null,
  title         text not null,
  hood          text not null,            -- اسم الحي (يطابق neighborhoods.name)
  type          text not null,            -- شقة | فيلا | دور | استوديو
  advertised    integer not null,         -- السعر المُعلن (سنوي)
  area          integer,                  -- المساحة م²
  rooms         smallint,
  condition     text default 'good',      -- new | good | old
  cond_label    text,
  tags          text[] default '{}',
  fal_license   text,
  lat           double precision,
  lng           double precision,
  active        boolean default true,
  created_at    timestamptz default now()
);

create index if not exists listings_hood_idx   on public.listings (hood);
create index if not exists listings_office_idx on public.listings (office_id);

-- ════════════════════════════════════════════════════════════
--  Row Level Security  (مهم جداً للأمان)
-- ════════════════════════════════════════════════════════════
alter table public.neighborhoods enable row level security;
alter table public.profiles      enable row level security;
alter table public.offices       enable row level security;
alter table public.listings      enable row level security;

-- الأحياء: قراءة للجميع
drop policy if exists "neighborhoods_read" on public.neighborhoods;
create policy "neighborhoods_read" on public.neighborhoods
  for select using (true);

-- الملفات: كل مستخدم يقرأ/يعدّل ملفه فقط
drop policy if exists "profiles_self_read"   on public.profiles;
create policy "profiles_self_read"   on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_self_write"  on public.profiles;
create policy "profiles_self_write"  on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- المكاتب: قراءة للجميع، التعديل لصاحب المكتب فقط
drop policy if exists "offices_read"  on public.offices;
create policy "offices_read"  on public.offices for select using (true);
drop policy if exists "offices_owner" on public.offices;
create policy "offices_owner" on public.offices
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- الإعلانات: قراءة للجميع (النشطة)، الإضافة/التعديل لصاحب المكتب فقط
drop policy if exists "listings_read"  on public.listings;
create policy "listings_read"  on public.listings
  for select using (active = true);
drop policy if exists "listings_owner" on public.listings;
create policy "listings_owner" on public.listings
  for all using (
    office_id in (select id from public.offices where owner_id = auth.uid())
  ) with check (
    office_id in (select id from public.offices where owner_id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════
--  إنشاء ملف تلقائياً عند تسجيل مستخدم جديد
-- ════════════════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════════════════
--  بيانات أولية: متوسطات الأحياء
-- ════════════════════════════════════════════════════════════
insert into public.neighborhoods (name, avg_rent) values
  ('النرجس', 65000),
  ('العليا', 52000),
  ('الملقا', 60000),
  ('حطين', 58000),
  ('الياسمين', 54000),
  ('القيروان', 58000),
  ('النخيل', 59000),
  ('إشبيلية', 38000)
on conflict (name) do update set avg_rent = excluded.avg_rent;

-- ════════════════════════════════════════════════════════════
--  بيانات أولية: إعلانات تجريبية (تُضاف فقط إذا كان الجدول فارغاً)
-- ════════════════════════════════════════════════════════════
do $$
begin
  if not exists (select 1 from public.listings) then
    insert into public.listings
      (title, hood, type, advertised, area, rooms, condition, cond_label, tags, fal_license, lat, lng) values
      ('شقة 3 غرف — حي النرجس',        'النرجس',   'شقة',     90000, 150, 3, 'good', 'حالة جيدة',   array['3 غرف','موقف','دخول ذكي'],        '1234567', 24.8024, 46.6286),
      ('شقة 2 غرف — حي النرجس',        'النرجس',   'شقة',     42000, 110, 2, 'new',  'جديد',        array['2 غرفة','مجلس','مطبخ راكب'],      '2345678', 24.8060, 46.6340),
      ('شقة 3 غرف — مشروع الماجدية',   'النرجس',   'شقة',     68000, 140, 3, 'new',  'جديد',        array['3 غرف','سنتان','مكيفات مركزية'],  '3456789', 24.8100, 46.6180),
      ('شقة 2 غرف — حي العليا',        'العليا',   'شقة',     52000, 105, 2, 'good', 'حالة جيدة',   array['2 غرفة','مطبخ راكب','3 سنوات'],   '4567890', 24.6877, 46.6853),
      ('شقة 3 غرف — حي الملقا',        'الملقا',   'شقة',     48000, 120, 3, 'good', 'حالة جيدة',   array['3 غرف','120م²','سنة'],            '5678901', 24.7766, 46.6228),
      ('استوديو — حي حطين',            'حطين',     'استوديو', 50400,  55, 1, 'new',  'جديد',        array['مؤثث','قرب البوليفارد'],          '6789012', 24.7611, 46.6511),
      ('شقة 2 غرف — الياسمين',         'الياسمين', 'شقة',     48000,  90, 2, 'good', 'حالة جيدة',   array['2 غرفة','90م²','4 سنوات'],        '7890123', 24.8196, 46.6402),
      ('شقة 3 غرف — القيروان',         'القيروان', 'شقة',     38000, 130, 3, 'old',  'يحتاج ترميم', array['3 غرف','130م²','7 سنوات'],        '8901234', 24.8400, 46.6350),
      ('فيلا — حي النخيل',             'النخيل',   'فيلا',   140000, 450, 5, 'new',  'جديد',        array['5 غرف','450م²','مسبح'],           '9012345', 24.8300, 46.6100),
      ('شقة 2 غرف — إشبيلية',          'إشبيلية',  'شقة',     36000,  80, 2, 'good', 'حالة جيدة',   array['2 غرفة','80م²','5 سنوات'],        '0123456', 24.7200, 46.6550);
  end if;
end $$;
