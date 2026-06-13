-- ════════════════════════════════════════════════════════════
--  Backfill إحداثيات الإعلانات التي حُفظت برابط goo.gl مختصر
--  انسخ هذا الملف والصقه في: Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════
--
--  السبب: روابط «maps.app.goo.gl» المختصرة لا تحوي إحداثيات في نصّها،
--  ولا يمكن فكّها من المتصفح (CORS)، فبقي lat/lng = null ولم يظهر دبوس.
--  حللنا الرابط من الخادم وتبيّن أنه يشير إلى: 24.9278764, 46.7830159.
--
--  ملاحظة: الإعلانات الجديدة التي يُلصق فيها رابط خرائط *كامل* (يحوي
--  ‎@lat,lng‎ أو ‎?q=lat,lng‎ أو ‎!3d!4d‎) أو تُحدَّد بمنتقي الخريطة تُخزّن
--  إحداثياتها رقمياً تلقائياً من التطبيق — هذا الـ backfill لِما حُفظ سابقاً فقط.

update public.listings
set    lat = 24.9278764,
       lng = 46.7830159
where  maps_url = 'https://maps.app.goo.gl/XJJcuf6ZSQeVFUQt8?g_st=iw'
  and  (lat is null or lng is null);

-- تحقّق بعد التشغيل (يُفترض أن يعود صفّان بإحداثيات):
-- select id, hood, type, lat, lng, maps_url from public.listings
--   where maps_url = 'https://maps.app.goo.gl/XJJcuf6ZSQeVFUQt8?g_st=iw';
