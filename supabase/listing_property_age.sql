-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — عمر العقار (بالسنوات) على الإعلانات
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent). لا سياسات/مشغّلات جديدة مطلوبة —
--  RLS الصفّية الحالية (listings_owner/listings_read/listings_admin_all)
--  تشمل العمود الجديد تلقائياً.
-- ════════════════════════════════════════════════════════════

-- عمود اختياري: عمر العقار بالسنوات (NULL = غير محدّد، بلا قيمة افتراضية مُفبركة)
alter table public.listings
  add column if not exists property_age smallint;

-- حدّ منطقي على مستوى القاعدة (دفاع بالعمق؛ العميل يقصّ القيمة إلى 0..100 أصلاً)
do $$ begin
  alter table public.listings
    add constraint listings_property_age_chk
    check (property_age is null or (property_age >= 0 and property_age <= 100));
exception when duplicate_object then null; end $$;

-- إعادة تحميل مخطط PostgREST فوراً (حتى يظهر العمود للـ API بلا انتظار)
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--   where table_name='listings' and column_name='property_age';   -- property_age | smallint
-- select conname from pg_constraint where conname='listings_property_age_chk'; -- موجود
