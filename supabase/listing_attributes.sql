-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — خصائص الإعلان المنظّمة (قابلة للبحث بواسطة المساعد الذكي)
--  انسخ هذا الملف كاملاً والصقه في:  Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  أعمدة اختيارية يملؤها المكتب؛ إن تُركت فارغة (null) فالإعلان ببساطة لا
--  يُطابَق على ذلك المعيار (بلا أي خصم). الموجود أصلاً: furnished / baths / rooms / area.
-- ════════════════════════════════════════════════════════════

alter table public.listings add column if not exists kitchen boolean;   -- المطبخ: راكب = true / غير راكب = false
alter table public.listings add column if not exists ac      boolean;   -- المكيفات: مكيّفة = true / غير مكيّفة = false
alter table public.listings add column if not exists parking integer;   -- المواقف: عدد (0 = لا يوجد)

-- إعادة تحميل مخطط PostgREST فوراً — يزيل خطأ النشر
-- "Could not find the 'ac' column of 'listings' in the schema cache" دون انتظار
notify pgrst, 'reload schema';

-- (تحقّق اختياري) أعرض الأعمدة بعد التشغيل:
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='listings'
--     and column_name in ('kitchen','ac','parking','furnished','baths');
