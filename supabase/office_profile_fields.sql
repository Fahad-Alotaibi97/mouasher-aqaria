-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — حقول ملف المكتب القابلة للتعديل (email + bio)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الهدف: تمكين المكتب من تعديل بياناته في صفحة «ملف المكتب» وحفظها فعلاً:
--    • phone — موجود مسبقاً (add_office_phone.sql) — نفس الرقم لردود واتساب.
--    • email — بريد المكتب للعرض/التواصل.
--    • bio   — نبذة مختصرة عن المكتب.
--
--  الأمان (مهم): لا حاجة لسياسة جديدة. سياسة offices_owner أصلاً FOR ALL
--  (USING/WITH CHECK: auth.uid() = owner_id) ⇒ المالك يحدّث صفّه. وtrigger
--  enforce_office_trust يجمّد أعمدة الثقة (status/verified/active/
--  rejection_note) لغير المدير، ولا يمسّ name/phone/email/bio — فحفظ
--  الملف لا يفتح أي ثغرة اعتماد/توثيق ذاتي.
-- ════════════════════════════════════════════════════════════

alter table public.offices add column if not exists email text;
alter table public.offices add column if not exists bio   text;

-- إعادة تحميل مخطط PostgREST فوراً (يُظهر الأعمدة للـ REST بلا انتظار)
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل (اختياري) ───────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='offices'
--     and column_name in ('phone','email','bio')
--   order by column_name;
-- المتوقع: bio, email, phone
