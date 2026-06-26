-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — حذف الحساب الذاتي (متطلب Google Play لأي تطبيق فيه حسابات)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  لماذا دالة قاعدة بيانات؟
--   لا يوجد service_role في المشروع، فلا يستطيع العميل (anon key) حذف صف
--   auth.users مباشرة. الحل القياسي والآمن: دالة SECURITY DEFINER يملكها
--   postgres تحذف بيانات المستخدم ثم صفّه في auth.users — مقيّدة داخلياً
--   بـ auth.uid() فلا يقدر أي مستخدم على حذف غير حسابه هو.
--
--  ضمانات الأمان (مهمة — destructive):
--   • الدالة لا تأخذ أي وسيط ⇒ لا سطح حقن (SQL injection).
--   • كل عمليات الحذف مقيّدة بـ v_uid = auth.uid() (هوية المتصل من جلسته) ⇒
--     مكتب لا يحذف مكتباً آخر، وباحث لا يمسّ بيانات أحد غيره.
--   • المدراء (is_admin) محميون: الدالة ترفض حذفهم الذاتي صراحةً.
--   • التنفيذ ممنوح لدور authenticated فقط (لا anon/العام).
--
--  صور الإعلانات (storage):
--   Supabase يمنع الحذف المباشر من storage.objects عبر SQL (خطأ 42501
--   "Direct deletion from storage tables is not allowed. Use the Storage API").
--   لذلك تُحذف صور المكتب من العميل عبر Storage API (سياسة listings_img_delete_own:
--   owner = auth.uid()) قبل استدعاء هذه الدالة — وليس داخلها.
--
--  مُتحقَّق حياً (2026-06-26) بحساب تجريبي: الدالة تحذف
--   leads(الباحث) + leads(المكتب) + listings + offices + profiles + auth.users،
--   ويتعذّر الدخول بعدها (Invalid login credentials). لا إعلانات يتيمة.
-- ════════════════════════════════════════════════════════════

-- ── 0) ربط استفسار الباحث المسجّل بحسابه ─────────────────────
--   جدول leads لا يملك عمود مالك حالياً، فاستفسارات الباحث غير مرتبطة بحسابه.
--   نضيف user_id يُملأ فقط حين يكون الباحث مسجّلاً وقت الإرسال (الزائر يبقى NULL).
--   ON DELETE SET NULL: حذف الحساب لا يكسر بقية صفوف leads — والدالة أدناه
--   تحذف صفوف الباحث صراحةً قبل حذف صفّه في auth.users.
alter table public.leads
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists leads_user_id_idx on public.leads(user_id);

-- ── 1) الدالة: حذف حساب المتصل وكل بياناته الشخصية (ذرّياً) ──
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- لا جلسة صالحة ⇒ لا حذف
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- المدراء لا يحذفون أنفسهم ذاتياً (يُدارون من لوحة الإدارة) — حماية إضافية
  if coalesce((select is_admin from public.profiles where id = v_uid), false) then
    raise exception 'admin accounts cannot self-delete';
  end if;

  -- (أ) استفسارات الباحث نفسه (المرتبطة بحسابه عبر user_id)
  delete from public.leads
   where user_id = v_uid;

  -- (ب) إن كان مكتباً: الاستفسارات التي وصلت لمكتبه أو على إعلاناته.
  --     يجب أن تسبق حذف الإعلانات/المكتب أدناه لأن شرطها يعتمد عليهما.
  delete from public.leads
   where office_id in (select id from public.offices where owner_id = v_uid)
      or listing_id in (
           select l.id
             from public.listings l
             join public.offices o on o.id = l.office_id
            where o.owner_id = v_uid
         );

  -- (ج) صور الإعلانات: تُحذف من العميل عبر Storage API قبل استدعاء هذه الدالة
  --     (Supabase يمنع الحذف المباشر من storage.objects عبر SQL). انظر الترويسة.

  -- (د) إعلاناته — صراحةً. السبب: listings.office_id = ON DELETE SET NULL،
  --     فحذف المكتب وحده يترك الإعلانات يتيمة (office_id = NULL) وظاهرة.
  --     نحذفها قبل المكتب لمنع البيانات اليتيمة.
  delete from public.listings
   where office_id in (select id from public.offices where owner_id = v_uid);

  -- (هـ) مكتبه
  delete from public.offices
   where owner_id = v_uid;

  -- (و) ملفه الشخصي (يُحذف تلقائياً مع auth.users عبر ON DELETE CASCADE،
  --     لكن نُصرّح به ليبقى السلوك واضحاً ومستقلاً عن ترتيب الـ cascade)
  delete from public.profiles
   where id = v_uid;

  -- (ز) صف المصادقة — يُنهي الدخول نهائياً (يُسقّط ما تبقّى عبر cascade)
  delete from auth.users
   where id = v_uid;
end;
$$;

-- ── 2) الصلاحيات: للمسجّلين فقط، ومنع anon/العام ──────────────
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- إعادة تحميل مخطط PostgREST فوراً (حتى تظهر الدالة للـ RPC بلا انتظار)
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- 1) الدالة موجودة و security definer:
--    select proname, prosecdef from pg_proc where proname = 'delete_own_account';
--    -- المتوقع: delete_own_account | t
-- 2) الصلاحيات صحيحة:
--    select has_function_privilege('authenticated','public.delete_own_account()','execute'); -- t
--    select has_function_privilege('anon','public.delete_own_account()','execute');          -- f
-- 3) العمود أُضيف:
--    select column_name from information_schema.columns
--      where table_name='leads' and column_name='user_id';                                   -- user_id
