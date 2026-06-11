-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — توسيع أنواع أحداث التحليلات:
--    + page_view   (زيارات الموقع — تحميلات صفحة، بلا هوية ولا IP ولا موقع)
--    + feature_use (استخدام ميزة: meta.feature = 'finance' صفحة التقسيط /
--                   'contact' فتح نموذج التواصل بخصوص إعلان)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent). يتطلب تشغيل analytics_events.sql قبله.
-- ════════════════════════════════════════════════════════════

-- 1) تحديث قيد CHECK على عمود type ليشمل النوعين الجديدين
--    (اسم القيد التلقائي لقيد العمود المضمّن: <table>_<column>_check)
alter table public.analytics_events
  drop constraint if exists analytics_events_type_check;
alter table public.analytics_events
  add constraint analytics_events_type_check
  check (type in ('listing_click', 'indicator_use', 'search', 'page_view', 'feature_use'));

-- 2) إعادة إنشاء سياسة الإدراج بنفس الحدود مع القائمة الموسّعة
drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert" on public.analytics_events
  for insert to anon, authenticated
  with check (
    type in ('listing_click', 'indicator_use', 'search', 'page_view', 'feature_use')
    and (ref_id is null or length(ref_id) <= 64)
    and pg_column_size(meta) <= 2048
  );

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.analytics_events'::regclass and conname = 'analytics_events_type_check';
-- المتوقع: القائمة تشمل page_view و feature_use.
-- ثم: node _analytics_check.mjs   ← يدرج الأنواع الخمسة كزائر ويتأكد من حجب القراءة
