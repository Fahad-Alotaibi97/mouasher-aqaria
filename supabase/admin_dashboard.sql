-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — توسعة لوحة /admin (إحصائيات + إدارة الإعلانات/المكاتب/الرسائل)
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  يضيف:
--   • أعمدة: listings.status / offices.active / leads.handled
--   • سياسات RLS تمنح المدير (profiles.is_admin = true) قراءةً وكتابةً كاملة
--     على listings / offices / leads عبر جلسته الموحّدة (auth.uid()).
--   • تقييد القراءة العامة للإعلانات على (active = true AND status = 'approved').
--
--  ⚠️ مهم: أقسام الإدارة الجديدة تقرأ/تكتب عبر سياسات is_admin، فتتطلّب
--     تسجيل دخولك من الرئيسية بحساب المدير (الجلسة الموحّدة) — لا تكفي
--     بوّابة كلمة المرور وحدها (لا توجد auth.uid()). تأكّد أن حسابك مدير:
--     شغّل supabase/fix_profiles_rls.sql (يضبط is_admin=true لـ faud969@gmail.com).
-- ════════════════════════════════════════════════════════════

-- ── 1) الأعمدة الجديدة ───────────────────────────────────────
-- حالة الإعلان: pending (بانتظار الموافقة) | approved (معتمد ويظهر للعامة) | rejected (مرفوض)
-- الافتراضي pending ⇒ الإعلانات الجديدة من المكاتب تنتظر موافقة المدير.
alter table public.listings
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

-- (اختياري — لمرة واحدة فقط) لو كان لديك إعلانات قائمة قبل إضافة العمود
-- واردتَ إظهارها فوراً دون مراجعة، اعتمدها مرة واحدة بإزالة التعليق:
-- update public.listings set status = 'approved';

-- تفعيل/إيقاف المكتب (للتعليق المؤقّت)
alter table public.offices
  add column if not exists active boolean not null default true;

-- هل عولجت الرسالة؟
alter table public.leads
  add column if not exists handled boolean not null default false;

-- ── 2) سياسات RLS للمدير (is_admin) ──────────────────────────
-- الإعلانات: القراءة العامة تقتصر على المعتمدة والنشطة فقط.
drop policy if exists "listings_read" on public.listings;
create policy "listings_read" on public.listings
  for select using (active = true and status = 'approved');

-- المدير: قراءة وكتابة كاملة على كل الإعلانات (بأي حالة).
drop policy if exists "listings_admin_all" on public.listings;
create policy "listings_admin_all" on public.listings
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- المكاتب: القراءة عامة أصلاً (offices_read). نضيف كتابة المدير (توثيق/إيقاف).
drop policy if exists "offices_admin_all" on public.offices;
create policy "offices_admin_all" on public.offices
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- الرسائل: ★ إصلاح مهم — على هذا المشروع كانت إضافة الرسائل محجوبة بـ RLS
-- (الجدول مفعّل RLS بلا سياسة insert)، فكان نموذج «اترك رسالة» يفقد الرسائل بصمت.
-- نعيد إنشاء سياسة الإضافة للزوّار حتى تُحفظ الرسائل فعلاً.
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon" on public.leads
  for insert to anon, authenticated with check (true);

-- ثم نضيف قراءة وتحديث المدير.
drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update" on public.leads
  for update
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ── 3) (تحقّق اختياري) أعرض الأعمدة الجديدة بعد التشغيل ───────
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='listings' and column_name='status';
