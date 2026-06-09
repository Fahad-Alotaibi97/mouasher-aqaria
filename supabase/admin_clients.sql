-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — قسم «العملاء» في لوحة الأدمن (مكاتب + باحثين)
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  يتيح للمدير (is_admin) قراءة كل ملفات المستخدمين (profiles) — باحثين ومكاتب —
--  ليظهروا في قسم «العملاء». تبقى سياسة self_read للمستخدم العادي كما هي.
-- ════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- المدير يقرأ كل الملفات
drop policy if exists "profiles_admin_read" on public.profiles;
create policy "profiles_admin_read" on public.profiles
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- (تبقى السياسات الموجودة: profiles_self_read / profiles_self_write / profiles_self_update كما هي)
