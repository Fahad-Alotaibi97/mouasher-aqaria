-- ════════════════════════════════════════════════════════════
--  ترقية: متوسطات لكل نوع عقار + صلاحية مدير + سياسة كتابة للأحياء
--  انسخ هذا الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
-- ════════════════════════════════════════════════════════════

-- 1) أعمدة متوسطات منفصلة لكل نوع (متوسط الشقة يبقى في avg_rent) ----
alter table public.neighborhoods add column if not exists avg_villa  integer;
alter table public.neighborhoods add column if not exists avg_studio integer;

-- تعبئة أولية للقيم الفارغة من متوسط الشقة بالمعاملات القديمة
-- (فيلا ≈ ×2.2 ، استوديو ≈ ×0.55) حتى لا يتغيّر السلوك قبل أن يحرّرها المدير.
update public.neighborhoods set avg_villa  = round(avg_rent * 2.2)  where avg_villa  is null;
update public.neighborhoods set avg_studio = round(avg_rent * 0.55) where avg_studio is null;

-- 2) علم المدير على ملف المستخدم -------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 3) سياسة الكتابة: المدراء فقط يضيفون/يعدّلون الأحياء ----------
--    (القراءة تبقى متاحة للجميع عبر سياسة neighborhoods_read الموجودة)
drop policy if exists "neighborhoods_admin_write" on public.neighborhoods;
create policy "neighborhoods_admin_write" on public.neighborhoods
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ════════════════════════════════════════════════════════════
--  اجعل حسابك مديراً — بدّل البريد ببريدك ثم نفّذ هذا السطر:
--  (يجب أن تكون قد سجّلت الدخول مرة واحدة على الأقل ليُنشأ ملفك)
-- ════════════════════════════════════════════════════════════
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'faud969@gmail.com');
