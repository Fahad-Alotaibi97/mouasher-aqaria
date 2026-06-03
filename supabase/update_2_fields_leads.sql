-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — تحديث ٢: حقول منظّمة + جدول الرسائل + التخزين
--  انسخه كاملاً في:  Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════

-- 1) حقول منظّمة للوحدة (لتوحيد البطاقات بدل الوسوم الحرّة) ---------
alter table public.listings add column if not exists baths     smallint;
alter table public.listings add column if not exists furnished boolean default false;
alter table public.listings add column if not exists images    text[] default '{}';   -- روابط الصور
alter table public.listings add column if not exists description text;

-- 2) جدول الرسائل (اترك رسالة ونتواصل معك) ------------------------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  message     text,
  listing_id  uuid references public.listings(id) on delete set null,  -- اختياري: رسالة على إعلان محدد
  created_at  timestamptz default now()
);

alter table public.leads enable row level security;

-- أي زائر يقدر يرسل رسالة (إضافة فقط)
drop policy if exists "leads_insert_anon" on public.leads;
create policy "leads_insert_anon" on public.leads
  for insert with check (true);

-- لا أحد يقرأ الرسائل عبر الواجهة العامة (تُقرأ من لوحة Supabase فقط)
-- (بدون سياسة select = لا قراءة عامة)

-- ════════════════════════════════════════════════════════════
--  3) التخزين: أنشئ Bucket للصور يدوياً (خطوة واجهة لمرة واحدة)
--  Supabase → Storage → New bucket → الاسم: listings → Public ✓
-- ════════════════════════════════════════════════════════════
