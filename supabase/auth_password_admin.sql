-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — ضبط الدخول بكلمة المرور + صلاحية الأدمن
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--
--  ملاحظات مهمة (لا يمكن تنفيذها بـ SQL — تُضبط من لوحة Supabase):
--  1) Authentication → Sign In / Providers → Email → عطّل "Confirm email"
--     حتى يدخل المستخدم مباشرة بعد إنشاء الحساب دون انتظار إيميل تأكيد.
--  2) إذا كان حساب الأدمن faud969@gmail.com أُنشئ سابقاً عبر Magic Link
--     فهو بلا كلمة مرور — اضبط كلمة مروره من:
--     Authentication → Users → faud969@gmail.com → (Reset password / Set password).
-- ════════════════════════════════════════════════════════════

-- 1) ضمان وجود عمود is_admin (موجود غالباً — هذا للأمان فقط)
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2) ضمان وجود صف profiles لكل مستخدم في auth.users (يغطّي الحسابات القديمة
--    التي قد لا يكون التريغر شغّل لها)
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- 3) منح صلاحية الأدمن لحساب المالك (يُطبّق فور وجود الحساب في auth.users)
update public.profiles p
set is_admin = true
from auth.users u
where u.id = p.id
  and u.email = 'faud969@gmail.com';
