-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — المرحلة 2: ميزات الباحث (المفضّلة، الرغبات، الأحياء، سجل المؤشر، الملف)
--  انسخه في Supabase → SQL Editor → New query → Run. آمن للتشغيل أكثر من مرة (idempotent).
--  إضافي بالكامل. كل الجداول owner-only RLS، وتُمحى مع الحساب عبر ON DELETE CASCADE
--  على auth.users (delete_own_account القائمة تمحوها تلقائياً بلا تعديل).
--
--  المرحلة A تستخدم: favorites (B-3) + search_wishes.user_id + notify_wish_match (B-4).
--  المرحلة B تستخدم: followed_neighborhoods (B-5) + indicator_history (B-6) + profiles.pref_* (B-7).
--  كلها في هذا الملف — شغّله مرة واحدة الآن (الكود يتدرّج بأمان قبل/بعد كل مرحلة).
-- ════════════════════════════════════════════════════════════

-- دالة فحص المدير (إعادة تأكيد idempotent — نفس تعريف باقي الملفات)
create or replace function public.is_admin_user()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- ── B-3) المفضّلة ──
create table if not exists public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.favorites enable row level security;
drop policy if exists "favorites_owner_all" on public.favorites;
create policy "favorites_owner_all" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── B-4) ربط رغبات البحث بحساب الباحث + إشعار التطابق ──
alter table public.search_wishes
  add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
create index if not exists search_wishes_user_idx on public.search_wishes(user_id) where user_id is not null;
drop policy if exists "search_wishes_owner_read" on public.search_wishes;
create policy "search_wishes_owner_read" on public.search_wishes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "search_wishes_owner_delete" on public.search_wishes;
create policy "search_wishes_owner_delete" on public.search_wishes for delete to authenticated
  using (user_id = auth.uid());

-- إشعار الباحث عند إعلان جديد يطابق رغبته (مرة واحدة عند الاعتماد فقط) — يكتب في notifications (مرحلة 1)
create or replace function public.notify_wish_match()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and new.active and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    insert into public.notifications (user_id, type, listing_id, body)
    select distinct w.user_id, 'wish_match', new.id, 'إعلان جديد يطابق طلبك في ' || coalesce(new.hood, '')
      from public.search_wishes w
     where w.user_id is not null
       and (w.neighborhood is null or w.neighborhood = new.hood)
       and (w.type is null or w.type = new.type)
       and (w.max_price is null or new.advertised <= w.max_price);
  end if;
  return new;
end; $$;
drop trigger if exists trg_notify_wish_match on public.listings;
create trigger trg_notify_wish_match after insert or update of status on public.listings
  for each row execute function public.notify_wish_match();

-- ── B-5) الأحياء المتابَعة ──
create table if not exists public.followed_neighborhoods (
  user_id      uuid not null references auth.users(id) on delete cascade,
  neighborhood text not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, neighborhood)
);
alter table public.followed_neighborhoods enable row level security;
drop policy if exists "followed_owner_all" on public.followed_neighborhoods;
create policy "followed_owner_all" on public.followed_neighborhoods for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── B-6) سجل المؤشرات المحسوبة (خادمي) ──
create table if not exists public.indicator_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sector        text,
  neighborhood  text,
  unit_type     text,
  entered_value integer,
  avg_value     integer,
  verdict       text,
  created_at    timestamptz not null default now()
);
create index if not exists indicator_history_user_idx on public.indicator_history(user_id, created_at desc);
alter table public.indicator_history enable row level security;
drop policy if exists "indicator_history_owner_all" on public.indicator_history;
create policy "indicator_history_owner_all" on public.indicator_history for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── B-7) تفضيلات الباحث (أعمدة على profiles — تُمحى مع الحساب عبر cascade القائم) ──
alter table public.profiles add column if not exists pref_type   text;
alter table public.profiles add column if not exists pref_budget integer;
alter table public.profiles add column if not exists pref_hoods  text[];

-- إعادة تحميل مخطط PostgREST فوراً
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل (انسخ Success ثم شغّل هذه للتأكيد) ──
-- select tablename from pg_tables where schemaname='public'
--   and tablename in ('favorites','followed_neighborhoods','indicator_history') order by 1;   -- 3 صفوف
-- select column_name from information_schema.columns where table_name='search_wishes' and column_name='user_id';
-- select column_name from information_schema.columns where table_name='profiles'
--   and column_name in ('pref_type','pref_budget','pref_hoods') order by 1;                    -- 3 صفوف
-- select tgname from pg_trigger where tgrelid='public.listings'::regclass and tgname='trg_notify_wish_match';
