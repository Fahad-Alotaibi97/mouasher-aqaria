-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — قفل كتابة متوسطات الأحياء (إصلاح أمني قبل الإطلاق)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الثغرة: سياسة neighborhoods_public_write كانت تسمح لأي حامل مفتاح anon
--  العام (أي زائر يستخرجه من DevTools) بتعديل/حذف متوسطات الأسعار —
--  بيانات المنصة الأساسية. فحص المدير كان في الواجهة فقط، لا في القاعدة.
--
--  الإصلاح: القراءة تبقى عامة (المؤشر والحاسبة يقرآنها)، والكتابة تصير
--  للمدير الموثّق فقط (profiles.is_admin) عبر جلسة قاعدة حقيقية (auth.uid()).
-- ════════════════════════════════════════════════════════════

alter table public.neighborhoods enable row level security;

-- 1) إزالة سياسة الكتابة العامة (الثغرة نفسها)
drop policy if exists "neighborhoods_public_write" on public.neighborhoods;
-- تنظيف أسماء قديمة محتملة قبل إعادة الإنشاء
drop policy if exists "neighborhoods_admin_write" on public.neighborhoods;

-- 2) دالة آمنة لفحص صلاحية المدير
--    security definer ⇒ تقرأ profiles متجاوزةً RLS، فلا recursion ولا اعتماد
--    على سياسات قراءة profiles. نفس النمط يصلح لاستخدامات قادمة.
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 3) القراءة تبقى عامة — الموقع كله يقرأ المتوسطات (المؤشر/الحاسبة/الشارات)
drop policy if exists "neighborhoods_read" on public.neighborhoods;
create policy "neighborhoods_read" on public.neighborhoods
  for select to anon, authenticated
  using (true);

-- 4) الكتابة (insert/update/delete) للمدير الموثّق فقط
create policy "neighborhoods_admin_write" on public.neighborhoods
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select policyname, cmd, roles from pg_policies
--   where schemaname='public' and tablename='neighborhoods' order by policyname;
-- المتوقع: neighborhoods_read (SELECT, anon+authenticated)
--          neighborhoods_admin_write (ALL, authenticated)
--          ولا وجود لـ neighborhoods_public_write.
