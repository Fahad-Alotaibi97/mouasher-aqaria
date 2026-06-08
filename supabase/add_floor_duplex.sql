-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — نوعان مفردان: الدور (avg_dor) والدوبلكس (avg_duplex)
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  ملاحظة: على قاعدة الإنتاج الحالية العمودان موجودان أصلاً (avg_dor و
--  avg_duplex، قيمتهما null)، لذا هذه العبارات لا تفعل شيئاً عندك الآن —
--  أبقيناها لضمان وجود العمودين في أي بيئة أخرى.
--
--  كل نوع متوسط واحد فقط (مثل الاستوديو) — بلا تفصيل خانات غرف.
--  يقرؤهما الموقع تلقائياً (mktAvg) ويحسب منهما السعر العادل:
--    دور    → avg_dor    (وإن كان null: avg_rent × 1.4)
--    دوبلكس → avg_duplex (وإن كان null: avg_rent × 1.6)
-- ════════════════════════════════════════════════════════════

alter table public.neighborhoods add column if not exists avg_dor    integer;  -- متوسط الدور (سنوي بالريال)
alter table public.neighborhoods add column if not exists avg_duplex integer;  -- متوسط الدوبلكس (سنوي بالريال)

-- (تحقّق اختياري) أعرض الأعمدة بعد التشغيل:
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='neighborhoods'
--     and column_name in ('avg_dor','avg_duplex');
