'use client';
// ════════════════════════════════════════════════════════════
//  أقسام لوحة /admin الجديدة (إحصائيات + إدارة الإعلانات/المكاتب/الرسائل).
//  كل قراءة/كتابة حقيقية عبر Supabase — لا بيانات وهمية، لا أزرار صورية.
//  محميّة بسياسات RLS (is_admin) ⇒ تتطلّب جلسة المدير الموحّدة (auth.uid()).
//  الأعمدة الجديدة (status/active/handled) تُضاف عبر supabase/admin_dashboard.sql.
// ════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import ContactButtons, { emailInText } from '../components/ContactButtons';
import ReplyComposer from '../components/ReplyComposer';

// ── أدوات مشتركة ─────────────────────────────────────────────
interface PgErr { code?: string; message?: string }

function errHint(e: PgErr | null | undefined): string {
  if (!e) return '';
  if (e.code === '42703')
    return 'الأعمدة الجديدة غير موجودة بعد — شغّل ملف supabase/admin_dashboard.sql في Supabase ثم أعد المحاولة.';
  if (e.code === '42P17' || /infinite recursion/i.test(e.message || ''))
    return 'سياسة RLS متكرّرة (recursion) على profiles — شغّل supabase/admin_clients.sql بنسخته الآمنة (is_admin_user) لإزالة السياسة القديمة المتكرّرة.';
  if (e.code === '42501' || /permission|policy|rls|denied/i.test(e.message || ''))
    return 'صلاحية مرفوضة — تأكّد من تسجيل الدخول بحساب المدير ومن تطبيق سياسات RLS (admin_dashboard.sql).';
  return e.message || 'حدث خطأ غير متوقع.';
}

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};
const fmtNum = (n: number) => n.toLocaleString('ar-SA');

const card = 'bg-white rounded-2xl border border-[#cfd9e4] shadow-sm';

function SectionHead({ title, subtitle, onRefresh }: { title: string; subtitle?: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div>
        <h2 className="text-xl font-bold text-[#0A3D62] sec-underline">{title}</h2>
        {subtitle && <p className="text-xs text-[#33414f] mt-2">{subtitle}</p>}
      </div>
      {onRefresh && (
        <button onClick={onRefresh} className="text-xs text-[#0A3D62] border border-[#cfd9e4] px-3 py-1.5 rounded-lg hover:bg-[#f0f4f8] transition-colors flex-shrink-0">
          تحديث
        </button>
      )}
    </div>
  );
}

function NeedSession() {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-5 text-sm leading-relaxed">
      <div className="font-bold mb-1">تتطلّب هذه الإدارة جلسة المدير</div>
      القراءة والكتابة هنا محميّتان بسياسات RLS (is_admin)، لذا تحتاج <b>تسجيل الدخول بحساب المدير</b> (الجلسة الموحّدة من
      الرئيسية) — لا تكفي بوّابة كلمة المرور وحدها لأنها لا تنشئ جلسة قاعدة بيانات.
      <div className="mt-3">
        <a href="/" className="text-[#0A3D62] font-bold underline">→ سجّل الدخول من الرئيسية بحساب المدير</a>
      </div>
    </div>
  );
}

function ErrBox({ e }: { e: PgErr }) {
  return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-3">{errHint(e)}</div>;
}
function Empty({ text }: { text: string }) {
  return <div className={`${card} p-8 text-center text-[#33414f] text-sm`}>{text}</div>;
}
function Loading() {
  return <div className={`${card} p-8 text-center text-[#33414f] text-sm`}>جارٍ التحميل…</div>;
}

const statusMeta: Record<string, { cls: string; label: string }> = {
  approved: { cls: 'bg-green-100 text-green-800 border-green-200', label: 'معتمد' },
  rejected: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'مرفوض' },
  pending: { cls: 'bg-amber-100 text-amber-800 border-amber-200', label: 'بانتظار' },
};

// ════════════════════════════════════════════════════════════
//  2) لوحة التحليلات — كل رقم استعلام/تجميع حقيقي على جداول القاعدة
//     + جدول analytics_events (تتبّع داخلي خفيف بلا بيانات شخصية:
//     نقرات الإعلانات، استخدام المؤشر بحكمه، البحث بالفلاتر والمساعد).
//     لا أرقام وهمية أبداً — كل قسم بلا بيانات يقولها بصراحة.
// ════════════════════════════════════════════════════════════
interface AnaListing { id: string; title: string; hood: string; type: string; status: string | null; active: boolean; office_id: string | null }
interface AnaOffice { id: string; name: string; status: string | null; active: boolean; verified: boolean }
interface AnaLead { listing_id: string | null; office_id: string | null; kind: string | null; created_at: string }
interface AnaEvent { type: string; ref_id: string | null; meta: Record<string, unknown> | null; created_at: string }

// التجميعات تُحسب على آخر EVENTS_CAP حدث (الإجماليات تبقى دقيقة لأن الأحدث أولاً)
const EVENTS_CAP = 5000;

// يجمع تكرارات مفتاح من قائمة، ويرجع الأعلى تكراراً
function topCounts<T>(items: T[], keyOf: (i: T) => string | null | undefined, limit = 10): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyOf(it);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

// شريحة ميزانية البحث — تجميع نطاقات الأسعار المطلوبة
function budgetBucket(n: number): string {
  if (n < 30000) return 'أقل من 30 ألف';
  if (n < 50000) return '30 – 50 ألف';
  if (n < 70000) return '50 – 70 ألف';
  if (n < 100000) return '70 – 100 ألف';
  return 'أكثر من 100 ألف';
}

function StatCard({ label, val, warn }: { label: string; val: number; warn?: boolean }) {
  return (
    <div className={`${card} p-4 ${warn && val > 0 ? 'border-amber-300 bg-amber-50/50' : ''}`}>
      <div className="text-xs text-[#33414f] mb-2 font-medium">{label}</div>
      <div className={`text-3xl font-extrabold ${warn && val > 0 ? 'text-amber-700' : 'text-[#0A3D62]'}`}>{fmtNum(val)}</div>
    </div>
  );
}

// بطاقة فرعية موحّدة لأقسام اللوحة
function SubCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={`${card} p-4`}>
      <div className="font-bold text-sm text-[#0A3D62]">{title}</div>
      {hint && <div className="text-[11px] text-[#5b6b7a] mt-0.5 mb-2">{hint}</div>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </div>
  );
}

function MiniEmpty({ text = 'لا توجد بيانات بعد.' }: { text?: string }) {
  return <div className="text-xs text-[#5b6b7a] py-4 text-center">{text}</div>;
}

// قائمة مرتّبة بأشرطة نسبية (الأطول = الأعلى) — بدون مكتبات رسوم
function RankList({ rows, unit }: { rows: { key: string; label: string; sub?: string; count: number }[]; unit: string }) {
  if (!rows.length) return <MiniEmpty />;
  const max = rows[0]?.count || 1;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.key}>
          <div className="flex items-center justify-between text-xs mb-0.5 gap-2">
            <span className="text-[#0f1a28] font-medium truncate">
              <span className="text-[#C9A84C] font-bold ml-1">{fmtNum(i + 1)}.</span>
              {r.label}
              {r.sub && <span className="text-[#5b6b7a] font-normal"> · {r.sub}</span>}
            </span>
            <span className="text-[#0A3D62] font-bold whitespace-nowrap">{fmtNum(r.count)} {unit}</span>
          </div>
          <div className="h-1.5 bg-[#f0f4f8] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] rounded-full" style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ميزات المنصة المرتّبة في «أكثر الميزات استخداماً» — كل بند يُعدّ بـ COUNT دقيق
const FEATURES: { key: string; label: string; type: string; feature?: string }[] = [
  { key: 'listings', label: 'تصفّح الإعلانات (فتح إعلان)', type: 'listing_click' },
  { key: 'indicator', label: 'مؤشر السعر العادل', type: 'indicator_use' },
  { key: 'search', label: 'البحث (فلاتر + المساعد الذكي)', type: 'search' },
  { key: 'finance', label: 'صفحة خيارات تقسيط الإيجار', type: 'feature_use', feature: 'finance' },
  { key: 'contact', label: 'فتح نموذج التواصل بخصوص إعلان', type: 'feature_use', feature: 'contact' },
];

export function StatsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [listings, setListings] = useState<AnaListing[]>([]);
  const [offices, setOffices] = useState<AnaOffice[]>([]);
  const [leads, setLeads] = useState<AnaLead[]>([]);
  const [events, setEvents] = useState<AnaEvent[]>([]);
  const [eventsMissing, setEventsMissing] = useState(false); // الجدول غير منشأ بعد (42P01)
  // زيارات الموقع (تحميلات صفحة) — أعداد COUNT دقيقة، null = تعذّر الجلب
  const [visits, setVisits] = useState<{ total: number; today: number; week: number } | null>(null);
  const [featureRank, setFeatureRank] = useState<{ key: string; label: string; count: number }[]>([]);
  // المستخدمون المسجّلون (profiles) — null = تعذّرت القراءة (يُعرض سبب مفهوم بدل أرقام خاطئة)
  const [profilesRows, setProfilesRows] = useState<{ role: string | null; is_admin: boolean | null; created_at: string }[] | null>(null);
  const [profilesErr, setProfilesErr] = useState<PgErr | null>(null);
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const [lr, or_, ldr, evr, pr0] = await Promise.all([
      sb.from('listings').select('id,title,hood,type,status,active,office_id'),
      sb.from('offices').select('id,name,status,active,verified'),
      sb.from('leads').select('listing_id,office_id,kind,created_at'),
      sb.from('analytics_events').select('type,ref_id,meta,created_at').order('created_at', { ascending: false }).limit(EVENTS_CAP),
      sb.from('profiles').select('role,is_admin,created_at'),
    ]);
    // المستخدمون المسجّلون — قراءة غير قاتلة: فشلها لا يُسقط اللوحة (تظهر رسالة مفهومة)
    let pr = pr0;
    if (pr.error && pr.error.code === '42703') {
      pr = await sb.from('profiles').select('role,created_at') as typeof pr0;
    }
    if (pr.error) { setProfilesRows(null); setProfilesErr(pr.error); }
    else { setProfilesRows((pr.data ?? []) as { role: string | null; is_admin: boolean | null; created_at: string }[]); setProfilesErr(null); }
    // أعمدة leads الموسّعة قد تغيب قبل ترحيلاتها — نتدرّج للأساسي بدل الانكسار
    let leadRows = (ldr.data ?? []) as AnaLead[];
    if (ldr.error && ldr.error.code === '42703') {
      const r2 = await sb.from('leads').select('created_at');
      leadRows = ((r2.data ?? []) as { created_at: string }[]).map((r) => ({ listing_id: null, office_id: null, kind: null, created_at: r.created_at }));
    } else if (ldr.error) { setErr(ldr.error); setLoading(false); return; }
    if (lr.error) { setErr(lr.error); setLoading(false); return; }
    if (or_.error) { setErr(or_.error); setLoading(false); return; }
    // جدول الأحداث غير منشأ بعد ⇒ اللوحة تعمل ويظهر تنبيه تشغيل SQL.
    // ملاحظة مُتحقَّقة حياً: PostgREST يرجع PGRST205 (لا 42P01) للجدول المفقود.
    let missing = false;
    if (evr.error) {
      if (evr.error.code === '42P01' || evr.error.code === 'PGRST205') { missing = true; setEvents([]); }
      else { setErr(evr.error); setLoading(false); return; }
    } else { setEvents((evr.data ?? []) as AnaEvent[]); }
    setEventsMissing(missing);
    // أعداد دقيقة (COUNT على القاعدة، لا تتأثر بسقف جلب الأحداث): الزيارات + ترتيب الميزات
    if (missing) { setVisits(null); setFeatureRank([]); }
    else {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const evCount = (type: string, opts?: { since?: string; feature?: string }) => {
        let q = sb.from('analytics_events').select('id', { count: 'exact', head: true }).eq('type', type);
        if (opts?.since) q = q.gte('created_at', opts.since);
        if (opts?.feature) q = q.eq('meta->>feature', opts.feature);
        return q;
      };
      const [pvT, pvD, pvW, ...featRes] = await Promise.all([
        evCount('page_view'),
        evCount('page_view', { since: todayStart.toISOString() }),
        evCount('page_view', { since: weekAgoIso }),
        ...FEATURES.map((f) => evCount(f.type, { feature: f.feature })),
      ]);
      setVisits(pvT.error || pvD.error || pvW.error ? null : { total: pvT.count ?? 0, today: pvD.count ?? 0, week: pvW.count ?? 0 });
      setFeatureRank(
        FEATURES.map((f, i) => ({ key: f.key, label: f.label, count: featRes[i].error ? 0 : (featRes[i].count ?? 0) }))
          .sort((a, b) => b.count - a.count)
      );
    }
    setListings((lr.data ?? []) as AnaListing[]);
    setOffices((or_.data ?? []) as AnaOffice[]);
    setLeads(leadRows);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  if (!sessionAdmin) return <><SectionHead title="لوحة التحليلات" /><NeedSession /></>;

  // ── تجميعات حقيقية من الصفوف المجلوبة ──────────────────────
  const weekAgo = Date.now() - 7 * 86_400_000;
  const isSupport = (l: AnaLead) => l.kind === 'support';
  const inquiries = leads.filter((l) => !isSupport(l));
  const inquiriesWeek = inquiries.filter((l) => new Date(l.created_at).getTime() >= weekAgo);
  const stOf = (s: string | null) => s || 'pending';
  const pendingListings = listings.filter((l) => stOf(l.status) === 'pending');
  const pendingOffices = offices.filter((o) => stOf(o.status) === 'pending');
  const activeOffices = offices.filter((o) => o.active);
  const officeName = new Map(offices.map((o) => [o.id, o.name]));
  const listingById = new Map(listings.map((l) => [l.id, l]));

  // التفاعل: استفسارات لكل إعلان (من leads.listing_id) + نقرات لكل إعلان (من الأحداث)
  const listingLabel = (id: string) => {
    const l = listingById.get(id);
    return l ? { label: l.title, sub: `${l.type} · ${l.hood}` } : { label: 'إعلان محذوف', sub: undefined };
  };
  const inquiredRank = topCounts(inquiries, (l) => l.listing_id).map((r) => ({ ...listingLabel(r.key), ...r }));
  const clicks = events.filter((e) => e.type === 'listing_click');
  const viewedRank = topCounts(clicks, (e) => e.ref_id).map((r) => ({ ...listingLabel(r.key), ...r }));

  // جلسات تقريبية: معرّفات sid عشوائية من sessionStorage (تبويب متصفح ≈ جلسة) —
  // بلا أي هوية؛ تُحسب من الأحداث المجلوبة (آخر EVENTS_CAP) لا من COUNT.
  const uniqueSessions = new Set(
    events.filter((e) => e.type === 'page_view').map((e) => (e.meta?.sid as string) || null).filter(Boolean)
  ).size;
  const anyFeatureUse = featureRank.some((f) => f.count > 0);

  // المستخدمون المسجّلون: أشخاص بحسابات فعلية (بعكس الزيارات المجهولة).
  // المدير لا يُحسب ضمن «الباحثين» — له شارة خاصة في قسم العملاء.
  const registered = profilesRows === null ? null : {
    total: profilesRows.length,
    seekers: profilesRows.filter((p) => (p.role ?? 'seeker') === 'seeker' && !p.is_admin).length,
    offices: profilesRows.filter((p) => p.role === 'office').length,
    week: profilesRows.filter((p) => new Date(p.created_at).getTime() >= weekAgo).length,
  };
  // كل مكتب له صف profiles حتماً ⇒ ملفات أقل من المكاتب = سياسة قراءة المدير ناقصة
  const profilesIncomplete = registered !== null && registered.total < offices.length;

  // المكاتب الأكثر نشاطاً: عدد إعلانات + استفسارات واردة، مرتّبة بالاستفسارات ثم الإعلانات
  const officeListings = new Map<string, number>();
  listings.forEach((l) => { if (l.office_id) officeListings.set(l.office_id, (officeListings.get(l.office_id) ?? 0) + 1); });
  const officeInquiries = new Map<string, number>();
  inquiries.forEach((l) => { if (l.office_id) officeInquiries.set(l.office_id, (officeInquiries.get(l.office_id) ?? 0) + 1); });
  const activeOfficesRank = [...new Set([...officeListings.keys(), ...officeInquiries.keys()])]
    .map((id) => ({ id, name: officeName.get(id) ?? 'مكتب محذوف', listings: officeListings.get(id) ?? 0, inquiries: officeInquiries.get(id) ?? 0 }))
    .sort((a, b) => b.inquiries - a.inquiries || b.listings - a.listings)
    .slice(0, 10);

  // سلوك الباحثين: من أحداث البحث (فلاتر + مساعد ذكي)
  const searches = events.filter((e) => e.type === 'search');
  const hoodRank = topCounts(searches, (e) => (e.meta?.hood as string) || null, 8).map((r) => ({ ...r, label: r.key }));
  const typeRank = topCounts(searches, (e) => (e.meta?.type as string) || null, 6).map((r) => ({ ...r, label: r.key }));
  const budgetRank = topCounts(searches, (e) => { const b = Number(e.meta?.budget); return b > 0 ? budgetBucket(b) : null; }, 6).map((r) => ({ ...r, label: r.key }));
  const aiQueriesRank = topCounts(searches.filter((e) => e.meta?.source === 'ai'), (e) => ((e.meta?.q as string) || '').trim() || null, 8).map((r) => ({ ...r, label: `«${r.key}»` }));

  // استخدام المؤشر: إجمالي + توزيع الأحكام (يعكس حالة السوق المعروضة للزوار)
  const indicatorUses = events.filter((e) => e.type === 'indicator_use');
  const verdictCount = (v: string) => indicatorUses.filter((e) => e.meta?.verdict === v).length;
  const verdicts = [
    { key: 'hi', label: 'مرتفع', count: verdictCount('hi'), cls: 'from-orange-500 to-orange-600', txt: 'text-orange-700' },
    { key: 'ok', label: 'مناسب', count: verdictCount('ok'), cls: 'from-[#1B6CA8] to-[#0A3D62]', txt: 'text-[#0A3D62]' },
    { key: 'lo', label: 'فرصة', count: verdictCount('lo'), cls: 'from-green-500 to-green-600', txt: 'text-green-700' },
  ];

  // التحويل: نقرات الإعلانات ← استفسارات مرتبطة بإعلان (منذ تفعيل التتبّع)
  const linkedInquiries = inquiries.filter((l) => l.listing_id).length;
  const conversion = clicks.length > 0 ? Math.round((linkedInquiries / clicks.length) * 100) : null;

  const head = (t: string) => <h3 className="font-bold text-[#0A3D62] text-base mt-6 mb-3 sec-underline">{t}</h3>;

  return (
    <>
      <SectionHead title="لوحة التحليلات" subtitle="كل الأرقام استعلامات حقيقية على بيانات المنصة — بلا أي تقدير أو أرقام وهمية" onRefresh={load} />
      {err && <ErrBox e={err} />}
      {eventsMissing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm mb-3 leading-relaxed">
          جدول التتبّع <b>analytics_events</b> غير منشأ بعد — شغّل ملف <b>supabase/analytics_events.sql</b> في Supabase → SQL Editor
          ليبدأ تسجيل نقرات الإعلانات والبحث واستخدام المؤشر. بقية الأرقام أدناه (الإعلانات/المكاتب/الاستفسارات) حقيقية وتعمل الآن.
        </div>
      )}
      {loading ? <Loading /> : !err && (
        <>
          {/* ── المستخدمون المسجّلون (حسابات فعلية معروفة — بعكس الزيارات المجهولة) ── */}
          {registered === null ? (
            profilesErr && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm mb-3 leading-relaxed">
                تعذّرت قراءة المستخدمين المسجّلين: {errHint(profilesErr)}
              </div>
            )
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="المستخدمون المسجّلون" val={registered.total} />
                <StatCard label="باحثون مسجّلون" val={registered.seekers} />
                <StatCard label="مكاتب مسجّلة" val={registered.offices} />
                <StatCard label="مسجّلون جدد هذا الأسبوع" val={registered.week} />
              </div>
              <p className="text-[11px] text-[#5b6b7a] mt-2 mb-1 leading-relaxed">
                «المسجّلون» أشخاص أنشؤوا حسابات فعلية على المنصة (تفاصيلهم في قسم «العملاء») —
                بخلاف «الزيارات» أدناه: تحميلات صفحة تشمل الزوار المجهولين بلا حسابات.
              </p>
              {profilesIncomplete && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm mb-2 leading-relaxed">
                  أرقام المسجّلين ناقصة ({fmtNum(registered.total)} ملفاً مقابل {fmtNum(offices.length)} مكتباً) —
                  شغّل <b>supabase/admin_clients.sql</b> (سياسة profiles_admin_read الآمنة) ثم «تحديث».
                </div>
              )}
            </>
          )}

          {/* ── الزيارات (تحميلات صفحة — ليست أشخاصاً فريدين) ── */}
          {!eventsMissing && (
            <>
              {visits === null ? (
                <Empty text="تعذّر جلب عدادات الزيارات — جرّب «تحديث»." />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="إجمالي الزيارات" val={visits.total} />
                  <StatCard label="زيارات اليوم" val={visits.today} />
                  <StatCard label="زيارات هذا الأسبوع" val={visits.week} />
                  <StatCard label="جلسات تقريبية" val={uniqueSessions} />
                </div>
              )}
              <p className="text-[11px] text-[#5b6b7a] mt-2 mb-1 leading-relaxed">
                «الزيارة» = تحميل لصفحة الموقع (يبدأ العدّ من تفعيل تتبّع الزيارات) — ليست عدد أشخاص فريدين.
                «الجلسات التقريبية» تمييز عشوائي لكل تبويب متصفّح بلا أي هوية أو تخزين دائم.
                الحسابات المسجّلة الفعلية في قسم «العملاء».
              </p>
            </>
          )}

          {/* ── الملخص العلوي ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <StatCard label="إجمالي الإعلانات" val={listings.length} />
            <StatCard label="إجمالي المكاتب" val={offices.length} />
            <StatCard label="إجمالي الاستفسارات" val={inquiries.length} />
            <StatCard label="استفسارات هذا الأسبوع" val={inquiriesWeek.length} />
            <StatCard label="إعلانات بانتظار الاعتماد" val={pendingListings.length} warn />
            <StatCard label="مكاتب بانتظار الاعتماد" val={pendingOffices.length} warn />
          </div>

          {/* ── أكثر الميزات استخداماً ── */}
          {head('أكثر الميزات استخداماً')}
          {eventsMissing ? (
            <Empty text="يتطلّب تفعيل التتبّع — شغّل supabase/analytics_events.sql ثم analytics_page_view.sql." />
          ) : (
            <SubCard title="ترتيب ميزات المنصة بالاستخدام الفعلي" hint="أعداد دقيقة (COUNT) من أحداث التتبّع — كل الأنواع منذ تفعيل تتبّع كلٍّ منها">
              {!anyFeatureUse ? (
                <MiniEmpty text="لا توجد بيانات بعد — يبدأ الترتيب مع أول استخدام من الزوار." />
              ) : (
                <>
                  <RankList rows={featureRank} unit="استخدام" />
                  {visits !== null && (
                    <div className="text-[11px] text-[#5b6b7a] mt-2">للسياق: {fmtNum(visits.total)} زيارة للموقع إجمالاً.</div>
                  )}
                </>
              )}
            </SubCard>
          )}

          {/* ── صحة المنصة ── */}
          {head('صحة المنصة')}
          <div className="grid md:grid-cols-2 gap-3">
            <SubCard title="بانتظار اعتمادك" hint="إعلانات ومكاتب جديدة تحتاج مراجعتك — من قسمي الإدارة">
              {pendingListings.length === 0 && pendingOffices.length === 0 ? (
                <MiniEmpty text="لا شيء بانتظار الاعتماد — كل المراجعات منجزة ✓" />
              ) : (
                <div className="space-y-1.5">
                  {pendingListings.slice(0, 5).map((l) => (
                    <div key={l.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#0f1a28] truncate">{l.title} <span className="text-[#5b6b7a]">· {l.hood}</span></span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded whitespace-nowrap">إعلان بانتظار</span>
                    </div>
                  ))}
                  {pendingListings.length > 5 && <div className="text-[11px] text-[#5b6b7a]">+ {fmtNum(pendingListings.length - 5)} إعلانات أخرى في «إدارة الإعلانات»</div>}
                  {pendingOffices.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#0f1a28] truncate">{o.name}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded whitespace-nowrap">مكتب بانتظار</span>
                    </div>
                  ))}
                </div>
              )}
            </SubCard>
            <SubCard title="حالة المكاتب والتحويل">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#33414f]">مكاتب نشطة / موقوفة</span>
                  <span className="font-bold text-[#0f1a28]">{fmtNum(activeOffices.length)} نشط · {fmtNum(offices.length - activeOffices.length)} موقوف</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#33414f]">مكاتب موثّقة</span>
                  <span className="font-bold text-[#0f1a28]">{fmtNum(offices.filter((o) => o.verified).length)} من {fmtNum(offices.length)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#f0f4f8] pt-2">
                  <span className="text-[#33414f]">التحويل: نقرات إعلانات ← استفسارات</span>
                  <span className="font-bold text-[#0f1a28]">
                    {conversion === null ? '—' : `${fmtNum(conversion)}٪`}
                  </span>
                </div>
                <div className="text-[11px] text-[#5b6b7a] leading-relaxed">
                  {conversion === null
                    ? eventsMissing ? 'تحتاج تفعيل التتبّع (SQL أعلاه) لقياس النقرات.' : 'لا نقرات مسجّلة بعد — يبدأ القياس مع استخدام الزوار.'
                    : `${fmtNum(clicks.length)} نقرة إعلان ← ${fmtNum(linkedInquiries)} استفسار مرتبط بإعلان (منذ تفعيل التتبّع).`}
                </div>
              </div>
            </SubCard>
          </div>

          {/* ── التفاعل مع الإعلانات ── */}
          {head('التفاعل مع الإعلانات')}
          <div className="grid md:grid-cols-2 gap-3">
            <SubCard title="الإعلانات الأكثر استفساراً" hint="من جدول leads — استفسارات مرتبطة بإعلان محدّد">
              <RankList rows={inquiredRank} unit="استفسار" />
            </SubCard>
            <SubCard title="الإعلانات الأكثر مشاهدة" hint="نقرات فتح الإعلان منذ تفعيل التتبّع">
              {eventsMissing ? <MiniEmpty text="يتطلّب تفعيل التتبّع (شغّل SQL أعلاه)." /> : <RankList rows={viewedRank} unit="نقرة" />}
            </SubCard>
          </div>
          <div className="mt-3">
            <SubCard title="المكاتب الأكثر نشاطاً" hint="مرتّبة بالاستفسارات الواردة ثم عدد الإعلانات">
              {activeOfficesRank.length === 0 ? <MiniEmpty /> : (
                <div className="space-y-1.5">
                  {activeOfficesRank.map((o, i) => (
                    <div key={o.id} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-[#0f1a28] font-medium truncate"><span className="text-[#C9A84C] font-bold ml-1">{fmtNum(i + 1)}.</span>{o.name}</span>
                      <span className="text-[#33414f] whitespace-nowrap">{fmtNum(o.listings)} إعلان · <b className="text-[#0A3D62]">{fmtNum(o.inquiries)}</b> استفسار</span>
                    </div>
                  ))}
                </div>
              )}
            </SubCard>
          </div>

          {/* ── سلوك الباحثين ── */}
          {head('سلوك الباحثين')}
          {eventsMissing ? (
            <Empty text="يتطلّب هذا القسم تفعيل التتبّع — شغّل supabase/analytics_events.sql ثم ستتجمّع البيانات مع استخدام الزوار." />
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <SubCard title="الأحياء الأكثر طلباً" hint="من بحث الفلاتر والمساعد الذكي">
                <RankList rows={hoodRank} unit="بحث" />
              </SubCard>
              <SubCard title="أنواع الوحدات الأكثر طلباً">
                <RankList rows={typeRank} unit="بحث" />
              </SubCard>
              <SubCard title="نطاقات الميزانية المطلوبة" hint="ميزانيات بحث الزوار مجمّعة في شرائح">
                <RankList rows={budgetRank} unit="بحث" />
              </SubCard>
              <SubCard title="أكثر عبارات المساعد الذكي" hint="نص ما يكتبه الزوار حرفياً (مقتطع)">
                <RankList rows={aiQueriesRank} unit="مرة" />
              </SubCard>
            </div>
          )}

          {/* ── استخدام مؤشر السعر العادل ── */}
          {head('استخدام مؤشر السعر العادل')}
          {eventsMissing ? (
            <Empty text="يتطلّب تفعيل التتبّع — شغّل supabase/analytics_events.sql." />
          ) : (
            <SubCard title={`إجمالي الاستخدام: ${fmtNum(indicatorUses.length)} مرة`} hint="كل تقييم سعر فعلي أجراه زائر — وتوزيع الأحكام يعكس واقع الأسعار المعروضة">
              {indicatorUses.length === 0 ? <MiniEmpty text="لا استخدام مسجّلاً بعد — يبدأ العد مع استخدام الزوار للمؤشر." /> : (
                <div className="space-y-2">
                  {verdicts.map((v) => (
                    <div key={v.key}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className={`font-bold ${v.txt}`}>{v.label}</span>
                        <span className="text-[#0f1a28] font-bold">{fmtNum(v.count)} ({fmtNum(Math.round((v.count / indicatorUses.length) * 100))}٪)</span>
                      </div>
                      <div className="h-2 bg-[#f0f4f8] rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-l ${v.cls} rounded-full`} style={{ width: `${Math.max(2, (v.count / indicatorUses.length) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SubCard>
          )}

          {events.length >= EVENTS_CAP && (
            <p className="text-[11px] text-[#5b6b7a] mt-3">ملاحظة: التجميعات محسوبة على آخر {fmtNum(EVENTS_CAP)} حدث.</p>
          )}
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  3) إدارة الإعلانات — كل الإعلانات الحقيقية + إجراءات حقيقية
// ════════════════════════════════════════════════════════════
interface ListingRow {
  id: string; title: string; hood: string; type: string; advertised: number;
  status: string; active: boolean; office_id: string | null; created_at: string;
  rejection_note: string | null;
}
export function ListingsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [officeMap, setOfficeMap] = useState<Record<string, string>>({});
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; advertised: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const [lr, or_] = await Promise.all([
      sb.from('listings').select('id,title,hood,type,advertised,status,active,office_id,created_at,rejection_note').order('created_at', { ascending: false }),
      sb.from('offices').select('id,name'),
    ]);
    if (lr.error) { setErr(lr.error); setLoading(false); return; }
    const omap: Record<string, string> = {};
    ((or_.data ?? []) as { id: string; name: string }[]).forEach((o) => { omap[o.id] = o.name; });
    setOfficeMap(omap);
    setRows((lr.data ?? []) as ListingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  const patch = async (id: string, p: Partial<ListingRow>) => {
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('listings').update(p).eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };
  const remove = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('حذف هذا الإعلان نهائياً؟ لا يمكن التراجع.')) return;
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('listings').delete().eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };
  const saveEdit = async () => {
    if (!edit) return;
    const adv = parseInt(edit.advertised, 10);
    await patch(edit.id, { title: edit.title.trim(), advertised: Number.isNaN(adv) ? 0 : adv });
    setEdit(null);
  };
  const reject = (id: string) => {
    const note = typeof window !== 'undefined' ? window.prompt('سبب الرفض / ملاحظات تظهر للمكتب (اختياري):', '') : '';
    if (note === null) return; // ألغى المدير
    patch(id, { status: 'rejected', rejection_note: note.trim() || null });
  };

  if (!sessionAdmin) return <><SectionHead title="إدارة الإعلانات" /><NeedSession /></>;

  return (
    <>
      <SectionHead title="إدارة الإعلانات" subtitle="كل الإعلانات من جدول listings — اعتماد/رفض/تعديل/حذف (يظهر للعامة المعتمد فقط)" onRefresh={load} />
      {err && <ErrBox e={err} />}
      {loading ? <Loading /> : rows.length === 0 && !err ? (
        <Empty text="لا توجد إعلانات بعد — ستظهر هنا عندما تنشر المكاتب إعلاناتها." />
      ) : (
        <div className="space-y-3">
          {rows.map((l) => {
            const sm = statusMeta[l.status] ?? statusMeta.pending;
            const isEditing = edit?.id === l.id;
            return (
              <div key={l.id} className={`${card} p-4`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <input value={edit!.title} onChange={(e) => setEdit({ ...edit!, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#0f1a28] text-right" placeholder="عنوان الإعلان" />
                    <input value={edit!.advertised} onChange={(e) => setEdit({ ...edit!, advertised: e.target.value })} type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#0f1a28] text-right" placeholder="السعر السنوي" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={busy === l.id} className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">حفظ</button>
                      <button onClick={() => setEdit(null)} className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-xs">إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-[#0f1a28] text-sm truncate">{l.title}</div>
                        <div className="text-xs text-[#33414f] mt-0.5">
                          {l.type} · {l.hood} · {fmtNum(l.advertised)} ريال/سنة
                        </div>
                        <div className="text-xs text-[#33414f] mt-0.5">
                          المكتب: {l.office_id ? (officeMap[l.office_id] ?? '—') : '—'} · {fmtDate(l.created_at)}
                        </div>
                      </div>
                      <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border whitespace-nowrap ${sm.cls}`}>{sm.label}</span>
                    </div>
                    {l.status === 'rejected' && l.rejection_note && (
                      <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">
                        <strong>ملاحظات الرفض:</strong> {l.rejection_note}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#f0f4f8]">
                      {l.status !== 'approved' && (
                        <button onClick={() => patch(l.id, { status: 'approved', rejection_note: null })} disabled={busy === l.id}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">اعتماد</button>
                      )}
                      {l.status !== 'rejected' && (
                        <button onClick={() => reject(l.id)} disabled={busy === l.id}
                          className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-200 disabled:opacity-50">رفض بملاحظات</button>
                      )}
                      <button onClick={() => setEdit({ id: l.id, title: l.title, advertised: String(l.advertised) })} disabled={busy === l.id}
                        className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] disabled:opacity-50">تعديل</button>
                      <button onClick={() => remove(l.id)} disabled={busy === l.id}
                        className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50">حذف</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  4) إدارة المكاتب — مكاتب حقيقية + توثيق/إيقاف + عدد الإعلانات
// ════════════════════════════════════════════════════════════
interface OfficeRow { id: string; name: string; fal_license: string | null; verified: boolean; active: boolean; status: string; rejection_note: string | null; created_at: string }
interface MiniListing { id: string; title: string; status: string }
export function OfficesSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<OfficeRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandList, setExpandList] = useState<MiniListing[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const [or_, lr] = await Promise.all([
      sb.from('offices').select('id,name,fal_license,verified,active,status,rejection_note,created_at').order('created_at', { ascending: false }),
      sb.from('listings').select('office_id'),
    ]);
    if (or_.error) { setErr(or_.error); setLoading(false); return; }
    const c: Record<string, number> = {};
    ((lr.data ?? []) as { office_id: string | null }[]).forEach((r) => { if (r.office_id) c[r.office_id] = (c[r.office_id] ?? 0) + 1; });
    setCounts(c);
    setRows((or_.data ?? []) as OfficeRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  const patch = async (id: string, p: Partial<OfficeRow>) => {
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('offices').update(p).eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };
  const rejectOffice = (id: string) => {
    const note = typeof window !== 'undefined' ? window.prompt('سبب رفض المكتب / ملاحظات (اختياري):', '') : '';
    if (note === null) return;
    patch(id, { status: 'rejected', rejection_note: note.trim() || null });
  };
  const toggleListings = async (id: string) => {
    if (expanded === id) { setExpanded(null); setExpandList([]); return; }
    setExpanded(id);
    const sb = createClient();
    const { data } = await sb.from('listings').select('id,title,status').eq('office_id', id).order('created_at', { ascending: false });
    setExpandList((data ?? []) as MiniListing[]);
  };

  if (!sessionAdmin) return <><SectionHead title="إدارة المكاتب" /><NeedSession /></>;

  return (
    <>
      <SectionHead title="إدارة المكاتب" subtitle="المكاتب من جدول offices — توثيق/تفعيل/إيقاف وعرض إعلاناتها" onRefresh={load} />
      {err && <ErrBox e={err} />}
      {loading ? <Loading /> : rows.length === 0 && !err ? (
        <Empty text="لا توجد مكاتب مسجّلة بعد — ستظهر هنا عندما تسجّل المكاتب العقارية." />
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <div key={o.id} className={`${card} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[#0f1a28] text-sm flex items-center gap-2 flex-wrap">
                    {o.name}
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${(statusMeta[o.status] ?? statusMeta.pending).cls}`}>{(statusMeta[o.status] ?? statusMeta.pending).label}</span>
                    {o.verified && <span className="text-[10px] bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded">موثّق ✓</span>}
                    {!o.active && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded">موقوف</span>}
                  </div>
                  <div className="text-xs text-[#33414f] mt-0.5">رخصة فال: {o.fal_license || '—'} · {fmtDate(o.created_at)}</div>
                  <div className="text-xs text-[#33414f] mt-0.5">عدد الإعلانات: <b className="text-[#0f1a28]">{fmtNum(counts[o.id] ?? 0)}</b></div>
                  {o.status === 'rejected' && o.rejection_note && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2 mt-1.5"><strong>ملاحظات الرفض:</strong> {o.rejection_note}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#f0f4f8]">
                {o.status !== 'approved' && (
                  <button onClick={() => patch(o.id, { status: 'approved', rejection_note: null })} disabled={busy === o.id}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">اعتماد</button>
                )}
                {o.status !== 'rejected' && (
                  <button onClick={() => rejectOffice(o.id)} disabled={busy === o.id}
                    className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-200 disabled:opacity-50">رفض بملاحظات</button>
                )}
                <button onClick={() => patch(o.id, { verified: !o.verified })} disabled={busy === o.id}
                  className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] disabled:opacity-50">
                  {o.verified ? 'إلغاء التوثيق' : 'توثيق ✓'}
                </button>
                <button onClick={() => patch(o.id, { active: !o.active })} disabled={busy === o.id}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50 ${o.active ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' : 'bg-blue-50 text-[#0A3D62] border-blue-200 hover:bg-blue-100'}`}>
                  {o.active ? 'إيقاف' : 'تفعيل'}
                </button>
                <button onClick={() => toggleListings(o.id)}
                  className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8]">
                  {expanded === o.id ? 'إخفاء الإعلانات' : 'عرض الإعلانات'}
                </button>
              </div>
              {expanded === o.id && (
                <div className="mt-3 pt-3 border-t border-[#f0f4f8] space-y-1.5">
                  {expandList.length === 0 ? (
                    <div className="text-xs text-[#33414f]">لا إعلانات لهذا المكتب.</div>
                  ) : expandList.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#0f1a28] truncate">{m.title}</span>
                      <span className={`px-2 py-0.5 rounded border ${(statusMeta[m.status] ?? statusMeta.pending).cls}`}>{(statusMeta[m.status] ?? statusMeta.pending).label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  5) الرسائل والطلبات — رسائل «اترك رسالة» الحقيقية + تعليم كمعالَجة
// ════════════════════════════════════════════════════════════
interface LeadRow { id: string; name: string; phone: string; message: string | null; handled: boolean; created_at: string; kind?: string | null; office_id?: string | null }
export function LeadsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  // أسماء المكاتب (id→name) لعرض وجهة الاستفسار في عرض الإشراف
  const [officeMap, setOfficeMap] = useState<Record<string, string>>({});
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // تبويبان منفصلان: استفسارات العملاء / رسائل المكاتب للمنصة (الدعم)
  const [tab, setTab] = useState<'inquiry' | 'support'>('inquiry');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    // مع عمودي kind/office_id إن وُجدا؛ وإلا (قبل تشغيل ترحيلات leads) بالأعمدة الأساسية
    let r: { data: unknown; error: PgErr | null } =
      await sb.from('leads').select('id,name,phone,message,handled,created_at,kind,office_id').order('created_at', { ascending: false });
    if (r.error && r.error.code === '42703') {
      r = await sb.from('leads').select('id,name,phone,message,handled,created_at').order('created_at', { ascending: false });
    }
    if (r.error) { setErr(r.error); setLoading(false); return; }
    setRows((r.data ?? []) as LeadRow[]);
    // أسماء المكاتب لعرض «موجّه إلى مكتب: …» على صفوف الاستفسارات (قراءة عامة offices_read).
    // فشل هذه القراءة لا يكسر القائمة — تظهر الأسماء كـ «—» فقط.
    const or_ = await sb.from('offices').select('id,name');
    const omap: Record<string, string> = {};
    ((or_.data ?? []) as { id: string; name: string }[]).forEach((o) => { omap[o.id] = o.name; });
    setOfficeMap(omap);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  const setHandled = async (id: string, handled: boolean) => {
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('leads').update({ handled }).eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };

  if (!sessionAdmin) return <><SectionHead title="الرسائل والطلبات" /><NeedSession /></>;

  const isSupport = (l: LeadRow) => l.kind === 'support';
  const shown = rows.filter((l) => (tab === 'support' ? isSupport(l) : !isSupport(l)));
  const counts = { inquiry: rows.filter((l) => !isSupport(l)).length, support: rows.filter(isSupport).length };

  return (
    <>
      <SectionHead title="الرسائل والطلبات" subtitle="من جدول leads — استفسارات العملاء ورسائل دعم المكاتب منفصلة" onRefresh={load} />
      {err && <ErrBox e={err} />}
      <div className="flex gap-2 mb-3">
        {(['inquiry', 'support'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border ${tab === t ? 'bg-[#0A3D62] text-white border-[#0A3D62]' : 'bg-white text-[#33414f] border-[#cfd9e4] hover:bg-[#f0f4f8]'}`}>
            {t === 'inquiry' ? 'استفسارات العملاء' : 'رسائل المكاتب — دعم'} ({fmtNum(counts[t])})
          </button>
        ))}
      </div>
      {/* تأطير الدور: في تبويب الاستفسارات الأدمن مُشرف/أرشيف لا المسؤول الأساسي عن الرد */}
      {tab === 'inquiry' ? (
        <div className="text-[11px] text-[#33414f] bg-[#f0f6fb] border border-[#dde9f4] rounded-lg p-2.5 mb-3 leading-relaxed">
          هذه استفسارات الباحثين الموجّهة للمكاتب — دورك هنا <b>إشراف وأرشفة</b> لفهم ما يبحث عنه الناس؛ <b>المكتب</b> هو المسؤول الأساسي عن الرد على عميله.
        </div>
      ) : (
        <div className="text-[11px] text-[#33414f] bg-[#f7f3fb] border border-[#e7ddf2] rounded-lg p-2.5 mb-3 leading-relaxed">
          هذه رسائل دعم من المكاتب موجّهة <b>لإدارة المنصة</b> — أنت المسؤول عن الرد عليها.
        </div>
      )}
      {loading ? <Loading /> : shown.length === 0 && !err ? (
        <Empty text={tab === 'support' ? 'لا توجد رسائل دعم من المكاتب بعد.' : 'لا توجد استفسارات بعد.'} />
      ) : (
        <div className="space-y-3">
          {shown.map((l) => (
            <div key={l.id} className={`${card} p-4 ${l.handled ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[#0f1a28] text-sm flex items-center gap-2 flex-wrap">
                    {l.name}
                    {isSupport(l) ? (
                      <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
                        {/* مكتب ← منصة (دعم) */}
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>
                        دعم مكتب ← المنصة
                      </span>
                    ) : (
                      // استفسار باحث — الأدمن مُشرف/أرشيف لا المسؤول الأساسي.
                      // النص يتكيّف: موجّه لمكتب محدّد ⇒ «من باحث إلى مكتب»، وإلا «من باحث (عام)».
                      <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-bold inline-flex items-center gap-1">
                        {/* سهم: من باحث ← إلى مكتب */}
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
                        {l.office_id ? 'من باحث إلى مكتب' : 'من باحث (عام)'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#1B6CA8] mt-0.5" dir="ltr" style={{ textAlign: 'right' }}>{l.phone}</div>
                  {/* وجهة الاستفسار (إشراف): اسم المكتب المقصود، أو استفسار عام بلا مكتب محدّد */}
                  {!isSupport(l) && (
                    <div className="text-[11px] text-[#33414f] mt-1">
                      {l.office_id
                        ? <>موجّه إلى مكتب: <b className="text-[#0f1a28]">{officeMap[l.office_id] ?? '—'}</b></>
                        : <span className="text-[#5b6b7a]">استفسار عام — غير موجّه لمكتب محدّد</span>}
                    </div>
                  )}
                  {l.message && <div className="text-sm text-[#33414f] mt-1.5 leading-relaxed">{l.message}</div>}
                  <div className="text-[11px] text-[#33414f] mt-1.5">{fmtDate(l.created_at)}</div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border whitespace-nowrap ${l.handled ? 'bg-green-100 text-green-800 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                  {l.handled ? 'معالَجة' : 'جديدة'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#f0f4f8]">
                {/* رد مباشر — موحّد للاستفسارات والدعم: phone يحمل جوال الباحث (استفسار)
                    أو جوال المكتب (دعم، بعد التقاطه عند التسجيل/نموذج الدعم)؛ والإيميل يُستخرج
                    من نص الرسالة. رسائل دعم قديمة بلا جوال (phone=بريد) ⇒ زر الإيميل فقط (تدرّج آمن). */}
                <ContactButtons contact={l.phone} email={emailInText(l.message)} />
                {/* منشئ الرد عبر واتساب — يظهر حين يحمل phone رقماً صالحاً (استفسار عميل أو
                    دعم مكتب له جوال). إرسال الرد يعلّم الرسالة معالَجة (المدير يملك leads_admin_update). */}
                <ReplyComposer phone={l.phone} onSent={() => { if (!l.handled) setHandled(l.id, true); }} />
                <button onClick={() => setHandled(l.id, !l.handled)} disabled={busy === l.id}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50 ${l.handled ? 'bg-white border-[#cfd9e4] text-[#0A3D62] hover:bg-[#f0f4f8]' : 'bg-green-600 text-white border-green-600 hover:bg-green-700'}`}>
                  {l.handled ? 'إرجاع كجديدة' : 'تعليم كمعالَجة'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  6) العملاء — كل الحسابات المسجّلة (مكاتب + باحثين) من جدول profiles
// ════════════════════════════════════════════════════════════
interface ClientRow { id: string; full_name: string | null; phone: string | null; role: string; created_at: string; is_admin?: boolean | null }
export function ClientsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<ClientRow[]>([]);
  // عدد المكاتب (قراءة عامة) — مؤشر صادق على نقص سياسة profiles_admin_read:
  // كل مكتب له صف profiles حتماً، فإن ظهر مكاتب أكثر من الملفات فالسياسة ناقصة.
  const [officesCount, setOfficesCount] = useState(0);
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'office' | 'seeker'>('all');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    // is_admin مع تدرّج آمن إن غاب العمود (قبل تشغيل ترحيلاته)
    let r = await sb.from('profiles').select('id,full_name,phone,role,created_at,is_admin').order('created_at', { ascending: false });
    if (r.error && r.error.code === '42703') {
      r = (await sb.from('profiles').select('id,full_name,phone,role,created_at').order('created_at', { ascending: false })) as unknown as typeof r;
    }
    if (r.error) setErr(r.error); else setRows((r.data ?? []) as ClientRow[]);
    const oc = await sb.from('offices').select('id', { count: 'exact', head: true });
    setOfficesCount(oc.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  if (!sessionAdmin) return <><SectionHead title="العملاء" /><NeedSession /></>;

  const roleMeta: Record<string, { cls: string; label: string }> = {
    office: { cls: 'bg-blue-100 text-blue-800 border-blue-200', label: 'مكتب' },
    seeker: { cls: 'bg-gray-100 text-gray-700 border-gray-200', label: 'باحث' },
  };
  const shown = rows.filter((r) => (filter === 'all' ? true : r.role === filter));
  const counts = { all: rows.length, office: rows.filter((r) => r.role === 'office').length, seeker: rows.filter((r) => r.role === 'seeker').length };

  return (
    <>
      <SectionHead title="العملاء" subtitle="كل الحسابات المسجّلة (مكاتب + باحثين) من جدول profiles — الأحدث أولاً، للعرض فقط" onRefresh={load} />
      {err && <ErrBox e={err} />}
      {!err && !loading && rows.length < officesCount && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-sm mb-3 leading-relaxed">
          القائمة ناقصة: يظهر {fmtNum(rows.length)} ملفاً بينما المكاتب وحدها {fmtNum(officesCount)} — سياسة قراءة المدير غير مفعّلة بعد.
          شغّل <b>supabase/admin_clients.sql</b> (النسخة الآمنة عبر is_admin_user — بلا recursion) ثم اضغط «تحديث».
        </div>
      )}
      <div className="flex gap-2 mb-3">
        {(['all', 'office', 'seeker'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border ${filter === f ? 'bg-[#0A3D62] text-white border-[#0A3D62]' : 'bg-white text-[#33414f] border-[#cfd9e4] hover:bg-[#f0f4f8]'}`}>
            {f === 'all' ? 'الكل' : f === 'office' ? 'المكاتب' : 'الباحثين'} ({fmtNum(counts[f])})
          </button>
        ))}
      </div>
      {loading ? <Loading /> : shown.length === 0 && !err ? (
        <Empty text="لا توجد حسابات بعد — ستظهر هنا عند تسجيل المكاتب والباحثين." />
      ) : (
        <div className="space-y-3">
          {shown.map((c) => {
            const rm = roleMeta[c.role] ?? roleMeta.seeker;
            return (
              <div key={c.id} className={`${card} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-[#0f1a28] text-sm flex items-center gap-2 flex-wrap">
                      {c.full_name || '— بلا اسم —'}
                      {c.is_admin && (
                        <span className="text-[10px] bg-[#C9A84C] text-[#0A3D62] px-2 py-0.5 rounded font-bold">مدير المنصة</span>
                      )}
                    </div>
                    {c.phone && <div className="text-xs text-[#1B6CA8] mt-0.5" dir="ltr" style={{ textAlign: 'right' }}>{c.phone}</div>}
                    <div className="text-[11px] text-[#33414f] mt-1">مسجّل: {fmtDate(c.created_at)}</div>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border whitespace-nowrap ${rm.cls}`}>{rm.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── الشريط الجانبي لأقسام اللوحة ─────────────────────────────
export type AdminSection = 'prices' | 'stats' | 'listings' | 'offices' | 'leads' | 'clients';
const SIDEBAR_ITEMS: { id: AdminSection; label: string }[] = [
  { id: 'prices', label: 'الأسعار والمتوسطات' },
  { id: 'stats', label: 'لوحة التحليلات' },
  { id: 'listings', label: 'إدارة الإعلانات' },
  { id: 'offices', label: 'إدارة المكاتب' },
  { id: 'clients', label: 'العملاء' },
  { id: 'leads', label: 'الرسائل والطلبات' },
];

export function AdminSidebar({ section, setSection, userEmail, onExit, exitLabel }: {
  section: AdminSection; setSection: (s: AdminSection) => void;
  userEmail: string | null; onExit: () => void; exitLabel: string;
}) {
  return (
    <aside className="w-full md:w-56 flex-shrink-0">
      <div className={`${card} p-2`}>
        {SIDEBAR_ITEMS.map((it) => (
          <button key={it.id} onClick={() => setSection(it.id)}
            className={`w-full text-right px-3 py-2.5 rounded-xl text-sm mb-1 font-medium transition-colors ${section === it.id ? 'bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white font-bold shadow' : 'text-[#33414f] hover:bg-[#f0f4f8]'}`}>
            {it.label}
          </button>
        ))}
        <div className="border-t border-[#eef2f7] mt-2 pt-2 px-1">
          {userEmail && <div className="text-[11px] text-[#33414f] truncate mb-2" title={userEmail}>{userEmail}</div>}
          <button onClick={onExit} className="w-full text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            {exitLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}
