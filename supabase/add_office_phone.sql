-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — إضافة رقم جوال المكتب (offices.phone)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الهدف: تخزين رقم جوال المكتب ليتمكّن الأدمن من الرد على رسائل الدعم
--  (kind='support') عبر واتساب ومنشئ الرد داخل المنصة، لا الإيميل فقط.
--  الرقم يُلتقط عند التسجيل ومن نموذج «تواصل مع المنصة»، ويُحفظ من جهة العميل
--  (insert/update على offices) — لا حاجة لتعديل trigger التسجيل.
--
--  ملاحظة أمان: trigger ثقة المكاتب (enforce_office_trust) يجمّد
--  verified/active/status/rejection_note لغير المدير، ولا يمسّ عمود phone —
--  فتحديث المكتب لرقمه مسموح ولا يفتح أي ثغرة ثقة.
-- ════════════════════════════════════════════════════════════

alter table public.offices add column if not exists phone text;

-- إعادة تحميل مخطط PostgREST فوراً (يُظهر العمود للـ REST بلا انتظار)
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل (اختياري) ───────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='offices' and column_name='phone';
