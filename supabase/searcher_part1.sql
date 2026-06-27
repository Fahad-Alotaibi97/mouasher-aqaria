-- ════════════════════════════════════════════════════════════
--  مؤشر العقارية — المرحلة 1: فصل نوع الحساب + المراسلة داخل المنصة + الإشعارات
--  انسخ الملف كاملاً والصقه في: Supabase → SQL Editor → New query → Run
--  آمن للتشغيل أكثر من مرة (idempotent). إضافي بالكامل — لا يكسر أي شيء قائم.
--
--  يشمل:
--   (A) تطبيع نوع الحساب على profiles.role القائم (لا عمود جديد).
--   (C) جدول الردود داخل المنصة lead_replies + RLS (مكتب/باحث/مدير).
--   (B-1) سياسة قراءة الباحث لاستفساراته (leads_client_read).
--   (B-2) جدول الإشعارات notifications + RLS + trigger يُشعر الباحث عند رد المكتب.
--
--  حذف الحساب: كل الجداول الجديدة مرتبطة بـ auth.users عبر ON DELETE CASCADE
--  (أو CASCADE على lead_id) ⇒ delete_own_account() القائمة تمحوها تلقائياً بلا أي تعديل.
-- ════════════════════════════════════════════════════════════

-- ── A) نوع الحساب: نعيد استخدام profiles.role ('seeker'|'office') القائم ──
--   تطبيع موثوق: من يملك مكتباً ⇒ 'office'، والبقية ⇒ 'seeker'. لا يمسّ is_admin.
--   شرط WHERE يجعلها idempotent (لا تكتب إلا الصفوف غير المتطابقة).
update public.profiles p
   set role = case when exists (select 1 from public.offices o where o.owner_id = p.id)
                   then 'office' else 'seeker' end
 where coalesce(p.role, '') is distinct from
       (case when exists (select 1 from public.offices o where o.owner_id = p.id)
             then 'office' else 'seeker' end);

-- لوحة الإدارة (قسم «العملاء») تعرض/تفلتر/تعدّ role أصلاً — لا تغيير مطلوب.

-- ── دالة فحص المدير (إعادة تأكيد idempotent — نفس تعريف باقي الملفات) ──
create or replace function public.is_admin_user()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- ── B-1) سياسة قراءة الباحث لاستفساراته (ليرى خيوطه ويرد) — إضافية، لا تمسّ سياسات المكتب/المدير
drop policy if exists "leads_client_read" on public.leads;
create policy "leads_client_read" on public.leads
  for select to authenticated
  using (user_id = auth.uid());

-- ── C) جدول الردود داخل المنصة (محادثة على كل استفسار) ──
--   CASCADE على lead_id ⇒ حذف الاستفسار/الحساب ينظّف الخيط تلقائياً.
create table if not exists public.lead_replies (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  sender      text not null check (sender in ('office', 'client')),
  sender_id   uuid default auth.uid() references auth.users(id) on delete set null,
  body        text not null check (length(btrim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists lead_replies_lead_idx on public.lead_replies(lead_id, created_at);

alter table public.lead_replies enable row level security;

-- المكتب: قراءة ردود استفسارات مكتبه (يشمل ردود الباحث في نفس الخيط)
drop policy if exists "lead_replies_office_select" on public.lead_replies;
create policy "lead_replies_office_select" on public.lead_replies for select to authenticated
  using (exists (select 1 from public.leads l join public.offices o on o.id = l.office_id
                 where l.id = lead_replies.lead_id and o.owner_id = auth.uid()));

-- المكتب: إدراج رد 'office' على استفسار موجّه لمكتبه فقط (sender_id = نفسه ⇒ لا انتحال)
drop policy if exists "lead_replies_office_insert" on public.lead_replies;
create policy "lead_replies_office_insert" on public.lead_replies for insert to authenticated
  with check (sender = 'office' and sender_id = auth.uid()
    and exists (select 1 from public.leads l join public.offices o on o.id = l.office_id
                where l.id = lead_replies.lead_id and o.owner_id = auth.uid()));

-- الباحث: قراءة ردود استفساراته هو (يشمل ردود المكتب)
drop policy if exists "lead_replies_client_select" on public.lead_replies;
create policy "lead_replies_client_select" on public.lead_replies for select to authenticated
  using (exists (select 1 from public.leads l
                 where l.id = lead_replies.lead_id and l.user_id = auth.uid()));

-- الباحث: إدراج رد 'client' على استفساره هو فقط
drop policy if exists "lead_replies_client_insert" on public.lead_replies;
create policy "lead_replies_client_insert" on public.lead_replies for insert to authenticated
  with check (sender = 'client' and sender_id = auth.uid()
    and exists (select 1 from public.leads l
                where l.id = lead_replies.lead_id and l.user_id = auth.uid()));

-- المدير: كل الصلاحيات
drop policy if exists "lead_replies_admin_all" on public.lead_replies;
create policy "lead_replies_admin_all" on public.lead_replies for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

-- ── B-2) جدول الإشعارات (داخل التطبيق فقط) ──
--   لا إدراج من العميل إطلاقاً — الإدراج عبر trigger أمني (security definer) فقط،
--   فلا يقدر أحد على تلفيق إشعارات لغيره. المالك يقرأ/يعلّم مقروء/يحذف إشعاراته.
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('reply', 'wish_match')),
  lead_id     uuid references public.leads(id)    on delete cascade,
  listing_id  uuid references public.listings(id) on delete set null,
  body        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_owner_select" on public.notifications;
create policy "notifications_owner_select" on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications_owner_update" on public.notifications;
create policy "notifications_owner_update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications_owner_delete" on public.notifications;
create policy "notifications_owner_delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications_admin_all" on public.notifications;
create policy "notifications_admin_all" on public.notifications for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

-- trigger: إشعار الباحث عند رد المكتب داخل المنصة (security definer ⇒ يتجاوز RLS بأمان)
create or replace function public.notify_on_office_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if new.sender = 'office' then
    select user_id into v_uid from public.leads where id = new.lead_id;
    if v_uid is not null then
      insert into public.notifications (user_id, type, lead_id, body)
      values (v_uid, 'reply', new.lead_id, left(new.body, 140));
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_office_reply on public.lead_replies;
create trigger trg_notify_office_reply after insert on public.lead_replies
  for each row execute function public.notify_on_office_reply();

-- إعادة تحميل مخطط PostgREST فوراً
notify pgrst, 'reload schema';

-- ── تحقّق بعد التشغيل ────────────────────────────────────────
-- select role, count(*) from public.profiles group by role;                                  -- توزيع باحث/مكتب
-- select policyname, cmd from pg_policies where tablename='lead_replies' order by policyname;  -- 5 سياسات
-- select policyname from pg_policies where tablename='leads' and policyname='leads_client_read';
-- select tgname from pg_trigger where tgrelid='public.lead_replies'::regclass and not tgisinternal;
