-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — المؤشر التجاري (جدول منفصل تماماً عن السكني) — هيكل فقط، فارغ
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الهدف: بنية مؤشر أسعار تجاري مستقلّة عن متوسطات الأحياء السكنية
--  (جدول neighborhoods). لا يُعاد استخدام أي متوسط سكني للتجاري — منفصلان تماماً.
--
--  المفتاح: (الحي + النوع التجاري) ⇒ سعر المتر² السنوي. الجدول يبدأ **فارغاً**؛
--  واجهة الموقع/اللوحة تعرض حالة صادقة «قريباً / لا توجد بيانات كافية» حتى تُضاف صفوف.
--  ستُملأ لاحقاً عبر Claude Cowork (نفس طريقة مصدر التسعير السكني) — لذا الهيكل
--  نظيف وموثّق: صف واحد لكل (hood, commercial_type) مع price_per_m2 و sample_size.
--
--  يعتمد على دالة public.is_admin_user() (security definer) الموجودة أصلاً على
--  الإنتاج (supabase/lock_neighborhoods_write.sql) — نفس نمط قفل كتابة الأحياء.
-- ════════════════════════════════════════════════════════════

create table if not exists public.commercial_prices (
  id              bigint generated always as identity primary key,
  hood            text    not null,                 -- اسم الحي (يطابق neighborhoods.name)
  commercial_type text    not null
                  check (commercial_type in ('shop', 'office', 'showroom')),
  price_per_m2    integer,                           -- متوسط الإيجار السنوي للمتر² (ريال) — يُملأ لاحقاً
  sample_size     integer default 0,                 -- عدد العينات/الصفقات المعتمدة (للشفافية)
  note            text,                              -- ملاحظة مصدر/منهجية اختيارية
  updated_at      timestamptz default now(),
  unique (hood, commercial_type)                     -- صف واحد لكل حي+نوع
);

create index if not exists commercial_prices_hood_idx on public.commercial_prices (hood);

-- ── RLS: قراءة عامة (الموقع يقرأ المؤشر) + كتابة للمدير الموثّق فقط ──
alter table public.commercial_prices enable row level security;

drop policy if exists "commercial_prices_read" on public.commercial_prices;
create policy "commercial_prices_read" on public.commercial_prices
  for select to anon, authenticated
  using (true);

drop policy if exists "commercial_prices_admin_write" on public.commercial_prices;
create policy "commercial_prices_admin_write" on public.commercial_prices
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ★ لا توجد بيانات أولية إطلاقاً — الجدول يبدأ فارغاً (لا تسعير مُفبرك).
--   Cowork يضيف الصفوف لاحقاً، مثال للتعبئة المستقبلية (لا تشغّله الآن):
--   insert into public.commercial_prices (hood, commercial_type, price_per_m2, sample_size)
--     values ('العليا', 'shop', 1800, 12)
--   on conflict (hood, commercial_type) do update
--     set price_per_m2 = excluded.price_per_m2, sample_size = excluded.sample_size, updated_at = now();

notify pgrst, 'reload schema';

-- ── تحقّق اختياري بعد التشغيل ─────────────────────────────────
-- select count(*) from public.commercial_prices;  -- المتوقع الآن: 0 (فارغ)
-- select policyname, cmd, roles from pg_policies
--   where schemaname='public' and tablename='commercial_prices' order by policyname;
