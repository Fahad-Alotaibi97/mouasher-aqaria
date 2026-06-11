-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — سدّ ثغرة «الاعتماد/التوثيق الذاتي» للمكاتب (موصى به بشدة)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  ★ الثغرة (مُثبَتة بفحص حي 2026-06-11): سياسة offices_owner تسمح لصاحب
--    المكتب بتحديث صفّه كاملاً — بما فيها status/verified/active — فيستطيع
--    أي مكتب اعتماد نفسه بل وتوثيق نفسه (verified=true)، وعندها تُعتمد
--    إعلاناته الجديدة تلقائياً وتظهر للعامة متجاوزاً مراجعة الإدارة كلياً.
--  الحل بنفس نمط enforce_listing_status المثبَت: trigger على مستوى القاعدة
--  يجمّد أعمدة الثقة (status/verified/active/rejection_note) لغير المدير،
--  فلا يتجاوزه أي عميل REST مهما أرسل. صاحب المكتب يظل يعدّل بياناته العادية
--  (name/fal_license) لأن سياسة offices_owner تبقى FOR ALL — الـ trigger وحده
--  يحرس أعمدة الثقة. المدير (is_admin_user) يمرّ دون قيد (اعتماد/توثيق/إيقاف).
-- ════════════════════════════════════════════════════════════

alter table public.offices enable row level security;

-- ضمان وجود أعمدة الثقة (idempotent — أُضيفت في activate_office_listings.sql)
alter table public.offices add column if not exists verified boolean not null default false;
alter table public.offices add column if not exists active   boolean not null default true;
alter table public.offices
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));
alter table public.offices add column if not exists rejection_note text;

-- 0) دالة فحص المدير (نفس تعريف باقي الملفات — إعادة تأكيد idempotent)
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 1) فرض حالة الثقة من القاعدة نفسها (لا يُتجاوز من أي عميل):
--    • المدير: يمرّ كما هو (يعتمد/يوثّق/يوقف كما يريد).
--    • الإدراج (غير المدير): مكتب جديد يبدأ pending وغير موثّق ونشط — مهما
--      أرسل العميل في status/verified/active. (لا اعتماد/توثيق ذاتي عند الإنشاء.)
--    • التعديل (غير المدير): status/verified/active/rejection_note مجمّدة على
--      قيمها القديمة — يسدّ «أُنشئ pending ثم حُدّث إلى approved/verified».
create or replace function public.enforce_office_trust()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_user() then
    return new; -- المدير يضبط الثقة كما يريد
  end if;
  if tg_op = 'INSERT' then
    new.status         := 'pending';
    new.verified       := false;
    new.active         := true;
    new.rejection_note := null;
  else
    new.status         := old.status;
    new.verified       := old.verified;
    new.active         := old.active;
    new.rejection_note := old.rejection_note;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_office_trust on public.offices;
create trigger trg_enforce_office_trust
  before insert or update on public.offices
  for each row execute function public.enforce_office_trust();

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select tgname from pg_trigger
--   where tgrelid = 'public.offices'::regclass and not tgisinternal;
-- المتوقع: trg_enforce_office_trust
--
-- اختبار يدوي (بجلسة مكتب غير مدير): محاولة الترقية الذاتية يجب أن تبقى pending
--   update public.offices set status='approved', verified=true
--     where id = '<office_id_تملكه>';
--   select status, verified from public.offices where id = '<office_id_تملكه>';
--   -- المتوقع: status='pending'، verified=false (الـ trigger جمّدهما)
