-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — جدول أحداث التحليلات الداخلية (تتبّع خفيف بلا خصوصية)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الغرض: لوحة التحليلات في /admin — نقرات الإعلانات، استخدام مؤشر السعر
--  العادل (مع الحكم)، وعمليات البحث (فلاتر + المساعد الذكي).
--
--  خصوصية مقصودة: لا IP، لا هوية زائر، لا موقع جغرافي — فقط نوع الحدث
--  ومعرّف الإعلان/الحي/النوع/الحكم/نص البحث.
--
--  الأمان: الزوار (anon) يُدرجون الأحداث فقط ولا يقرؤون شيئاً؛
--  القراءة (والحذف للتنظيف) للمدير الموثّق فقط عبر is_admin_user().
-- ════════════════════════════════════════════════════════════

-- 1) الجدول
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  type        text not null,
  ref_id      text,                              -- معرّف مرجعي (مثل id الإعلان للنقرات)
  meta        jsonb not null default '{}'::jsonb, -- تفاصيل الحدث (حي/نوع/حكم/نص بحث…)
  created_at  timestamptz not null default now()
);

-- قيد الأنواع يُعاد بناؤه دائماً (لا داخل create table) حتى يُحدَّث تلقائياً
-- عند إعادة تشغيل الملف بعد إضافة أنواع جديدة (page_view/feature_use أُضيفا 2026-06-12).
alter table public.analytics_events
  drop constraint if exists analytics_events_type_check;
alter table public.analytics_events
  add constraint analytics_events_type_check
  check (type in ('listing_click', 'indicator_use', 'search', 'page_view', 'feature_use'));

create index if not exists analytics_events_type_time_idx
  on public.analytics_events (type, created_at desc);
create index if not exists analytics_events_ref_idx
  on public.analytics_events (ref_id) where ref_id is not null;

-- 2) دالة فحص المدير (نفس نمط lock_neighborhoods_write.sql — إعادة تعريف آمنة)
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 3) RLS: الإدراج للجميع (بحدود حجم تمنع إساءة الاستخدام)، القراءة للمدير فقط
alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert" on public.analytics_events
  for insert to anon, authenticated
  with check (
    type in ('listing_click', 'indicator_use', 'search', 'page_view', 'feature_use')
    and (ref_id is null or length(ref_id) <= 64)
    and pg_column_size(meta) <= 2048
  );

drop policy if exists "analytics_events_admin_read" on public.analytics_events;
create policy "analytics_events_admin_read" on public.analytics_events
  for select to authenticated
  using (public.is_admin_user());

-- الحذف للمدير فقط (تنظيف أحداث قديمة/تجريبية) — لا سياسة update لأحد.
drop policy if exists "analytics_events_admin_delete" on public.analytics_events;
create policy "analytics_events_admin_delete" on public.analytics_events
  for delete to authenticated
  using (public.is_admin_user());

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename = 'analytics_events' order by policyname;
-- المتوقع: analytics_events_insert (INSERT, anon+authenticated)
--          analytics_events_admin_read (SELECT, authenticated)
--          analytics_events_admin_delete (DELETE, authenticated)
-- ثم: node _analytics_check.mjs   ← فحص حي كامل (إدراج anon + حجب القراءة)
