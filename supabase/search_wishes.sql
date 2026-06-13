-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — جدول «رغبات الباحثين غير المطابقة» (search_wishes)
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent).
--
--  الغرض: حين يبحث زائر بمعايير صريحة (حي/نوع/سقف سعري) ولا يجد المساعد الذكي
--  أي إعلان مطابق، نسجّل المعايير فقط — ليرى المدير «أين الطلب بلا عرض مطابق»
--  فيعرف أي الأحياء/الأنواع يستقطب لها مكاتب (إشارة طلب بلا معروض).
--
--  خصوصية مقصودة: لا اسم، لا جوال، لا هوية، لا IP، لا موقع — فقط المعايير
--  المبحوث عنها ونص الطلب مقتطعاً. الزائر يسجّل ولا يقرأ.
--
--  الأمان: الإدراج للجميع (anon + authenticated) بحدود حجم تمنع الإساءة؛
--  القراءة (والحذف للتنظيف) للمدير الموثّق فقط عبر is_admin_user().
-- ════════════════════════════════════════════════════════════

-- 1) الجدول
create table if not exists public.search_wishes (
  id            bigint generated always as identity primary key,
  neighborhood  text,                               -- الحي المطلوب (إن ذُكر)
  type          text,                               -- نوع الوحدة المطلوب (إن ذُكر)
  max_price     integer,                            -- السقف السعري المطلوب (إن ذُكر)
  raw_query     text,                               -- نص الطلب كما كتبه الباحث (مقتطع)
  created_at    timestamptz not null default now()
);

create index if not exists search_wishes_time_idx
  on public.search_wishes (created_at desc);
create index if not exists search_wishes_hood_idx
  on public.search_wishes (neighborhood) where neighborhood is not null;

-- 2) دالة فحص المدير (نفس تعريف باقي الملفات — إعادة تأكيد آمنة idempotent)
create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 3) RLS: الإدراج للجميع (بحدود حجم)، القراءة/الحذف للمدير فقط
alter table public.search_wishes enable row level security;

drop policy if exists "search_wishes_insert" on public.search_wishes;
create policy "search_wishes_insert" on public.search_wishes
  for insert to anon, authenticated
  with check (
    (neighborhood is null or length(neighborhood) <= 64)
    and (type is null or length(type) <= 32)
    and (max_price is null or (max_price >= 0 and max_price <= 100000000))
    and (raw_query is null or length(raw_query) <= 200)
  );

drop policy if exists "search_wishes_admin_read" on public.search_wishes;
create policy "search_wishes_admin_read" on public.search_wishes
  for select to authenticated
  using (public.is_admin_user());

-- الحذف للمدير فقط (تنظيف رغبات قديمة/تجريبية) — لا سياسة update لأحد.
drop policy if exists "search_wishes_admin_delete" on public.search_wishes;
create policy "search_wishes_admin_delete" on public.search_wishes
  for delete to authenticated
  using (public.is_admin_user());

-- إعادة تحميل مخطط PostgREST فوراً (حتى يظهر الجدول للـ API بلا انتظار)
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename = 'search_wishes' order by policyname;
-- المتوقع: search_wishes_insert (INSERT, anon+authenticated)
--          search_wishes_admin_read (SELECT, authenticated)
--          search_wishes_admin_delete (DELETE, authenticated)
-- ثم: node _wishes_check.mjs "<admin-password>"   ← فحص حي (إدراج anon + حجب القراءة + قراءة المدير)
