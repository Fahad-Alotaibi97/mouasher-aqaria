-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — قسم «العملاء» في لوحة الأدمن (مكاتب + باحثين)
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  يتيح للمدير (is_admin) قراءة كل ملفات المستخدمين (profiles) ليظهروا في
--  قسم «العملاء» وعدادات «المستخدمون المسجّلون». المستخدم العادي يبقى يقرأ
--  صفّه فقط (profiles_read_own من fix_profiles_rls.sql).
--
--  ⚠ تحذير أمني مهم — سبب إعادة كتابة هذا الملف (2026-06-12):
--  النسخة القديمة كانت تستخدم استعلاماً فرعياً ذاتياً على profiles داخل
--  سياسة profiles نفسها:
--      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
--  وهذا يسبّب recursion لا نهائياً (خطأ 42P17) لأن تقييم السياسة يتطلب قراءة
--  الجدول الذي تحميه السياسة. الحل: دالة security definer (تتجاوز RLS عند
--  القراءة الداخلية) — نفس نمط lock_neighborhoods_write.sql المطبَّق فعلاً.
-- ════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 1) دالة فحص المدير الآمنة (security definer ⇒ لا recursion) — إعادة تعريف آمنة
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 2) المدير يقرأ كل الملفات — عبر الدالة الآمنة حصراً
drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read" on public.profiles
  for select to authenticated
  using (public.is_admin_user());

-- (تبقى سياسات المستخدم العادي كما هي: profiles_read_own / profiles_self_write /
--  profiles_self_update — لا نضعفها ولا نلمسها هنا.)

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select policyname, cmd, qual from pg_policies
--   where schemaname = 'public' and tablename = 'profiles' order by policyname;
-- المتوقع: profiles_admin_read (SELECT) بشرط is_admin_user() — وليس استعلاماً
--          فرعياً على profiles. ثم: node _clients_check.mjs [بريد-المدير] [كلمة-المرور]
--          ← يتأكد أن غير المدير يرى صفّه فقط (بلا recursion) والمدير يرى الكل.
