-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — موقع الوحدة على الخريطة (يحدّده المكتب عند الإضافة/التعديل)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  • lat/lng: الإحداثيات (موجودة أصلاً في schema.sql — تُضاف هنا احتياطاً
--    للقواعد الأقدم) — تُملأ من النقر على الخريطة أو من تحليل رابط Google.
--  • maps_url: رابط خرائط Google كما لصقه المكتب — يُستخدم مباشرة لزر
--    «الموقع على الخريطة» عندما يكون الرابط مختصراً لا يمكن استخراج
--    الإحداثيات منه في المتصفح (مثل maps.app.goo.gl).
-- ════════════════════════════════════════════════════════════

alter table public.listings add column if not exists lat double precision;
alter table public.listings add column if not exists lng double precision;
alter table public.listings add column if not exists maps_url text;

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'listings'
--     and column_name in ('lat', 'lng', 'maps_url');
-- المتوقع: ثلاثة صفوف. ثم: node _location_check.mjs ← فحص حي كامل.
