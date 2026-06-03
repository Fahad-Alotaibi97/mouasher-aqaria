-- ════════════════════════════════════════════════════════════
--  ترقية v2: تخزين تفصيل خانات الغرف للوحة /admin الجديدة
--  حتى لا تضيع البيانات التفصيلية عند إعادة فتح اللوحة.
--  انسخ هذا الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  ملاحظة: شغّل أولاً admin_neighborhoods.sql (الذي يضيف avg_villa/avg_studio
--  و is_admin وسياسة الكتابة للمدراء) ثم هذا الملف.
-- ════════════════════════════════════════════════════════════

-- 1) أعمدة تفصيل خانات الغرف (JSONB) --------------------------------
--    apt_detail   : تفصيل الشقة   { "1": n, "2": n, "3": n, "4": n }
--    villa_detail : تفصيل الفيلا  { "1": n, "2": n, "3": n, "4": n }
--    (الاستوديو خانة واحدة فقط = avg_studio مباشرةً، فلا يحتاج عموداً منفصلاً)
--    أي خانة فارغة = غير موجودة في الكائن أو قيمتها null، وتُتجاهل في حساب المتوسط.
alter table public.neighborhoods add column if not exists apt_detail   jsonb;
alter table public.neighborhoods add column if not exists villa_detail jsonb;

-- 2) تأكيد وجود أعمدة المتوسطات لكل نوع (في حال لم يُشغّل ملف v1) ----
alter table public.neighborhoods add column if not exists avg_villa  integer;
alter table public.neighborhoods add column if not exists avg_studio integer;

-- 3) تأكيد علم المدير + سياسة كتابة الأحياء للمدراء فقط -------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

drop policy if exists "neighborhoods_admin_write" on public.neighborhoods;
create policy "neighborhoods_admin_write" on public.neighborhoods
  for all
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ════════════════════════════════════════════════════════════
--  اجعل حسابك مديراً (نفّذه مرة واحدة بعد تسجيل الدخول أول مرة):
-- ════════════════════════════════════════════════════════════
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'faud969@gmail.com');
