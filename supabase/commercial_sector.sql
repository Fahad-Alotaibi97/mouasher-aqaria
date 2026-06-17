-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — القطاع التجاري: حقول الإعلان (sector + commercial_type + خصائص تجارية)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent) — كل العبارات «add column if not exists».
--
--  الهدف (إضافة بنيوية فقط — لا بيانات): تمكين قطاع تجاري بجانب السكني في
--  نفس جدول listings. الإعلانات الحالية كلها تبقى سكنية تلقائياً (default
--  'residential'). الحقول التجارية كلها nullable وتُستخدم فقط عند sector='commercial'.
--
--  إعادة استخدام أعمدة قائمة (لا تكرار): advertised (الإيجار السنوي) · hood (الحي) ·
--  area (المساحة م²) · parking (عدد المواقف) · lat/lng/maps_url (الموقع) · images /
--  images_by_category (الصور) · office_id (المكتب) · status / fal_license / active (الثقة).
--  لا تُفرض حقول سكنية (rooms / baths / furnished / kitchen / ac) على الإعلان التجاري.
-- ════════════════════════════════════════════════════════════

-- 1) القطاع: سكني (افتراضي لكل الصفوف القائمة والجديدة) | تجاري
alter table public.listings
  add column if not exists sector text not null default 'residential'
  check (sector in ('residential', 'commercial'));

-- 2) النوع التجاري (يُستخدم فقط عند sector='commercial') — محل | مكتب | معرض
alter table public.listings
  add column if not exists commercial_type text
  check (commercial_type is null or commercial_type in ('shop', 'office', 'showroom'));

-- 3) خصائص تجارية اختيارية (كلها nullable — تُملأ للإعلان التجاري فقط)
alter table public.listings add column if not exists frontage_count   integer;   -- عدد الواجهات
alter table public.listings add column if not exists frontage_width   numeric;   -- عرض الواجهة (متر)
alter table public.listings add column if not exists allowed_activity text;      -- النشاط المسموح (حر)
alter table public.listings add column if not exists has_bathroom     boolean;   -- وجود دورة مياه
alter table public.listings add column if not exists floor_info       text;      -- الدور/الوحدة (حر)

-- 4) فهرس على القطاع لتسريع الفلترة العامة (سكني/تجاري)
create index if not exists listings_sector_idx on public.listings (sector);

-- ملاحظة أمان (RLS): سياسات listings الحالية صفّية بالكامل —
--   listings_read  : select using (active = true)
--   listings_owner : all using/ with check (office_id ∈ مكاتب المالك)
-- وهي تنطبق تلقائياً على كل الأعمدة الجديدة بلا أي تعديل (RLS لا يقيّد الأعمدة).
-- trigger تجميد حالة الإعلان (enforce_listing_status) لا يمسّ الأعمدة الجديدة.

-- إعادة تحميل مخطط PostgREST فوراً — يزيل خطأ النشر
-- "Could not find the 'sector' column of 'listings' in the schema cache" دون انتظار
notify pgrst, 'reload schema';

-- ── تحقّق اختياري بعد التشغيل ─────────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='listings'
--     and column_name in ('sector','commercial_type','frontage_count',
--       'frontage_width','allowed_activity','has_bathroom','floor_info')
--   order by column_name;
-- select sector, count(*) from public.listings group by sector;  -- المتوقع: residential = كل الصفوف
