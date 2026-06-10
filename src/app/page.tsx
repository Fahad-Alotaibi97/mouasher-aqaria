'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import dynamic from 'next/dynamic';
import { useAppData, type UIListing, type MktAvg } from '@/lib/useAppData';
import { useAuth } from '@/lib/useAuth';
import { useEffect } from 'react';
import SiteNav from './components/SiteNav';
const MapComponent = dynamic(() => import('./components/Map'), { ssr: false });

// SVG Icons — بدل الإيموجي
const Icons = {
  ai: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2a4 4 0 014 4v1h1a2 2 0 012 2v6a2 2 0 01-2 2h-1v1a4 4 0 01-8 0v-1H7a2 2 0 01-2-2V9a2 2 0 012-2h1V6a4 4 0 014-4z"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/></svg>),
  search: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>),
  chart: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 16l4-6 4 4 4-8"/></svg>),
  bank: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11"/></svg>),
  map: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>),
  bell: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>),
  send: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>),
  check: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>),
  warning: (<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>),
  target: (<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>),
  okCircle: (<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>),
  building: (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18M9 21V7l6-4v18M9 7H3v14"/><path d="M13 11h2M13 15h2M5 11h2M5 15h2"/></svg>),
  news: (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8M10 10h8"/></svg>),
};

// المتوسطات الافتراضية (تُستبدل بالبيانات الحقيقية من قاعدة البيانات إن توفّرت)
const DEFAULT_MKT_AVG: MktAvg = {
  'العليا': { avg: 52000 }, 'النرجس': { avg: 65000 }, 'الملقا': { avg: 60000 },
  'حطين': { avg: 58000 }, 'الياسمين': { avg: 54000 }, 'القيروان': { avg: 58000 },
  'النخيل': { avg: 59000 }, 'إشبيلية': { avg: 38000 },
};

// لا إعلانات افتراضية/تجريبية: الموقع يعرض إعلانات قاعدة البيانات فقط،
// وإن لم توجد تظهر حالة فارغة صادقة (لا بيانات وهمية أبداً).
const NO_LISTINGS: UIListing[] = [];

// دوال نقية لا تعتمد على المتوسطات
function getSt(adv: number, fair: number) { return adv / fair > 1.12 ? 'hi' : adv / fair < 0.85 ? 'lo' : 'ok'; }
function rl(st: string) { return st === 'ok' ? 'مناسب' : st === 'hi' ? 'مرتفع' : 'فرصة'; }

// ★ مصدر واحد لحساب السعر العادل من متوسط الحي (مأخوذ من جدول neighborhoods عبر /admin).
//   يُستخدم في: شارات الحالة للإعلانات (getFair) + الحاسبة الذكية للمكاتب.
//   يقرأ متوسط النوع المُدار من /admin إن توفّر (villa/studio)، وإلا يشتقّه بالمعامل.
function fairForType(
  m: { avg: number; villa?: number; studio?: number; floor?: number; duplex?: number } | undefined,
  type: string,
): number {
  if (!m) return 0;
  if (type === 'فيلا') return m.villa ?? Math.round(m.avg * 2.2);
  if (type === 'استوديو') return m.studio ?? Math.round(m.avg * 0.55);
  if (type === 'دور') return m.floor ?? Math.round(m.avg * 1.4);
  if (type === 'دوبلكس') return m.duplex ?? Math.round(m.avg * 1.6);
  return m.avg; // شقة
}

// أحياء مركزية قريبة من الخدمات — تُستخدم في منطق المساعد الذكي المحلّي (heuristic).
const NEAR_HOODS = new Set(['العليا', 'الملقا', 'حطين', 'الياسمين']);

// رسالة خطأ تشخيصية لإرسال الرسائل/الاستفسارات (تكشف حجب RLS بوضوح بدل نجاح صوري).
function leadErrText(error: { code?: string; message?: string }): string {
  if (error.code === '42501')
    return 'تعذّر الحفظ: سياسة الحماية (RLS) تمنع الإضافة. يلزم تشغيل supabase/fix_leads.sql في Supabase.';
  return 'تعذّر الإرسال حالياً — حاول لاحقاً.' + (error.message ? ` (${error.message})` : '');
}

// خانات الصور المصنّفة لمعالج إضافة الإعلان — بالترتيب المعتمد:
// الواجهة (إلزامية) ← الصالة ← غرف النوم (بعدد الغرف المختار) ← المجلس ← المطبخ
// ← الحمامات (بعدد دورات المياه المختار). تتحدّث الخانات فور تغيير الغرف/الحمامات.
type PhotoSlot = { key: string; label: string; req?: boolean };
function photoSlots(rooms: number, baths: number): PhotoSlot[] {
  return [
    { key: 'facade', label: 'الواجهة', req: true },
    { key: 'hall', label: 'الصالة' },
    ...Array.from({ length: rooms }, (_, i) => ({ key: `bed${i}`, label: rooms > 1 ? `غرفة نوم ${i + 1}` : 'غرفة النوم' })),
    { key: 'majlis', label: 'المجلس' },
    { key: 'kitchen', label: 'المطبخ' },
    ...Array.from({ length: baths }, (_, i) => ({ key: `bath${i}`, label: baths > 1 ? `حمام ${i + 1}` : 'الحمام' })),
  ];
}

// أيقونة منزل بديلة عند غياب صورة الإعلان
const HousePlaceholder = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-9 h-9">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" />
  </svg>
);

export default function Home() {
  const [page, setPage] = useState<'home' | 'search' | 'indicator' | 'finance' | 'inquiries' | 'pricing' | 'office' | 'privacy' | 'terms' | 'about'>('home');
  // المساعد الذكي — منطق محلّي بالكلمات المفتاحية (بدون أي استدعاء API)
  const [aiQuery, setAiQuery] = useState('');
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiMatchIds, setAiMatchIds] = useState<(string | number)[]>([]);
  const [aiOrder, setAiOrder] = useState<(string | number)[] | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadMsg, setLeadMsg] = useState('');
  const [leadSent, setLeadSent] = useState(false);
  const [leadSending, setLeadSending] = useState(false);
  const [leadErr, setLeadErr] = useState<string | null>(null);
  // نموذج الاستفسارات (صفحة منفصلة) — يُحفظ في نفس جدول leads
  const [inqName, setInqName] = useState('');
  const [inqPhone, setInqPhone] = useState('');
  const [inqHood, setInqHood] = useState('');
  const [inqType, setInqType] = useState('');
  const [inqMsg, setInqMsg] = useState('');
  const [inqSent, setInqSent] = useState(false);
  const [inqSending, setInqSending] = useState(false);
  const [inqErr, setInqErr] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<UIListing | null>(null);
  // نموذج التواصل بخصوص إعلان محدّد — يُحفظ في leads مربوطاً بالمكتب والإعلان
  const [ctOpen, setCtOpen] = useState(false);
  const [ctName, setCtName] = useState('');
  const [ctPhone, setCtPhone] = useState('');
  const [ctMsg, setCtMsg] = useState('');
  const [ctSent, setCtSent] = useState(false);
  const [ctSending, setCtSending] = useState(false);
  const [ctErr, setCtErr] = useState<string | null>(null);
  const [siZone, setSiZone] = useState('النرجس'); // اسم الحي المختار في "جرّب المؤشر"
  const [siType, setSiType] = useState('شقة'); // نوع الوحدة في "جرّب المؤشر"
  const [siPrice, setSiPrice] = useState('');
  const [filterHood, setFilterHood] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [searched, setSearched] = useState(false);

  // البيانات الحقيقية من قاعدة البيانات (المتوسطات لها قيم افتراضية؛ الإعلانات لا)
  const { mktAvg, listings } = useAppData(DEFAULT_MKT_AVG, NO_LISTINGS);

  // تسجيل الدخول — بالإيميل وكلمة المرور (تبويب: دخول / إنشاء حساب)
  const { user, isAdmin, signInWithPassword, signUpWithPassword, signOut, confirmSession } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authPass2, setAuthPass2] = useState('');
  const [authMsg, setAuthMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  // نوع الحساب عند إنشاء حساب جديد: باحث | مكتب (للربط الحقيقي بصف offices)
  const [authRole, setAuthRole] = useState<'seeker' | 'office'>('seeker');
  const [authOfficeName, setAuthOfficeName] = useState('');
  const [authFal, setAuthFal] = useState('');
  const [authSeekerName, setAuthSeekerName] = useState('');

  const submitAuth = async () => {
    setAuthBusy(true);
    setAuthMsg(null);
    const email = authEmail.trim();
    let r: { ok: boolean; message: string; isAdmin?: boolean };
    if (authMode === 'signup') {
      if (authPass !== authPass2) {
        setAuthMsg({ ok: false, text: 'كلمتا المرور غير متطابقتين.' });
        setAuthBusy(false);
        return;
      }
      if (authRole === 'office' && !authOfficeName.trim()) {
        setAuthMsg({ ok: false, text: 'أدخل اسم المكتب لإكمال تسجيل المكتب.' });
        setAuthBusy(false);
        return;
      }
      r = await signUpWithPassword(email, authPass, { role: authRole, officeName: authOfficeName, fal: authFal, seekerName: authSeekerName });
    } else {
      r = await signInWithPassword(email, authPass);
    }
    setAuthMsg({ ok: r.ok, text: r.message });
    if (r.ok) {
      setAuthPass('');
      setAuthPass2('');
      // الأدمن يُحوّل للوحة الإدارة — لكن بعد تأكيد حفظ الجلسة في الكوكيز
      // (تنقّل كامل ليحمل /admin الجلسة)، حتى لا تُفتح /admin بلا جلسة فتطلب دخولاً.
      if (r.isAdmin) {
        setAuthMsg({ ok: true, text: 'تم تسجيل الدخول كمدير — جارٍ التحويل للوحة الإدارة…' });
        await confirmSession(); // انتظار صريح لتأكيد الجلسة بدل التحويل الفوري
        window.location.href = '/admin';
        return; // نُبقي authBusy=true أثناء التحويل
      }
    }
    setAuthBusy(false);
  };

  // حساب السعر العادل وحالته بناءً على متوسطات /admin الحالية (mktAvg)
  const getFair = (l: UIListing) => {
    const m = mktAvg[l.hood];
    return m ? fairForType(m, l.type) : l.adv; // الرجوع للسعر المُعلن إن لم يوجد متوسط للحي
  };
  // نقاط الخريطة من أي قائمة (الإعلانات التي لها إحداثيات فقط)
  const toPoints = (list: UIListing[]) =>
    list
      .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number')
      .map((l) => {
        const fair = getFair(l);
        return { id: l.id, lat: l.lat as number, lng: l.lng as number, title: l.title, adv: l.adv, fair, st: getSt(l.adv, fair) };
      });

  const submitLead = async () => {
    if (!leadName.trim() || !leadPhone.trim() || leadSending) return;
    setLeadSending(true); setLeadErr(null);
    try {
      if (isSupabaseConfigured()) {
        const sb = createClient();
        // نتحقّق من خطأ الإدراج فعلياً (بدل النجاح الصوري) — يكشف حجب RLS إن وُجد.
        const { error } = await sb.from('leads').insert({ name: leadName.trim(), phone: leadPhone.trim(), message: leadMsg.trim() || null });
        if (error) { setLeadErr(leadErrText(error)); setLeadSending(false); return; }
      }
      setLeadSent(true);
      setLeadName(''); setLeadPhone(''); setLeadMsg('');
    } catch {
      setLeadErr('تعذّر إرسال الرسالة حالياً — حاول لاحقاً.');
    }
    setLeadSending(false);
  };

  // استفسار ⇒ يُحفظ في leads ليصل لـ /admin (الرسائل والطلبات)
  const submitInquiry = async () => {
    if (!inqName.trim() || !inqPhone.trim() || inqSending) return;
    setInqSending(true); setInqErr(null);
    // نضمّن الحي/النوع داخل نص الرسالة (جدول leads لا يحوي أعمدة منفصلة لها)
    const ctx = [inqHood && `الحي: ${inqHood}`, inqType && `النوع: ${inqType}`].filter(Boolean).join(' · ');
    const message = [ctx, inqMsg.trim()].filter(Boolean).join('\n') || null;
    try {
      if (isSupabaseConfigured()) {
        const sb = createClient();
        const { error } = await sb.from('leads').insert({ name: inqName.trim(), phone: inqPhone.trim(), message });
        if (error) { setInqErr(leadErrText(error)); setInqSending(false); return; }
      }
      setInqSent(true);
      setInqName(''); setInqPhone(''); setInqHood(''); setInqType(''); setInqMsg('');
    } catch {
      setInqErr('تعذّر إرسال الاستفسار حالياً — حاول لاحقاً.');
    }
    setInqSending(false);
  };

  // تواصل بخصوص إعلان محدّد ⇒ يُحفظ في leads مربوطاً بالمكتب (office_id) والإعلان
  // (listing_id) ليصل للمكتب صاحب الإعلان في لوحته، وللأدمن في /admin.
  const submitListingContact = async () => {
    const l = selectedListing;
    if (!l || !ctName.trim() || !ctPhone.trim() || ctSending) return;
    setCtSending(true); setCtErr(null);
    const head = `بخصوص الإعلان: ${l.title || l.type} · ${l.type} · ${l.hood} · ${l.adv.toLocaleString('ar-SA')} ريال/سنة`;
    const message = [head, ctMsg.trim()].filter(Boolean).join('\n') || null;
    try {
      if (isSupabaseConfigured()) {
        const sb = createClient();
        const row: Record<string, unknown> = { name: ctName.trim(), phone: ctPhone.trim(), message };
        if (l.office_id) row.office_id = l.office_id;
        if (typeof l.id === 'string') row.listing_id = l.id; // uuid فقط (الإعلانات الحقيقية)
        const { error } = await sb.from('leads').insert(row);
        if (error) { setCtErr(leadErrText(error)); setCtSending(false); return; }
      }
      setCtSent(true);
      setCtName(''); setCtPhone(''); setCtMsg('');
    } catch {
      setCtErr('تعذّر إرسال طلب التواصل حالياً — حاول لاحقاً.');
    }
    setCtSending(false);
  };

  const clearFilters = () => { setFilterHood(''); setFilterType(''); setFilterBudget(''); };

  const checkPrice = () => {
    // المتوسط يُقرأ من القاعدة (mktAvg) حسب النوع المختار عبر fairForType —
    // يعكس تعديلات لوحة الأدمن فوراً (شقة/فيلا/دور/دوبلكس/استوديو).
    const zoneName = siZone;
    const m = mktAvg[siZone];
    const avg = m ? fairForType(m, siType) : 0;
    const price = parseInt(siPrice) || 0;
    const ref = `متوسط ${siType} في ${zoneName}`;
    if (!avg) return { type: 'none', icon: Icons.chart, title: 'لا يوجد متوسط لهذا النوع في هذا الحي بعد', detail: '', color: 'bg-gray-50 border-gray-200' };
    if (!price) return { type: 'none', icon: Icons.chart, title: 'أدخل قيمة الإيجار للمقارنة', detail: '', color: 'bg-gray-50 border-gray-200' };
    if (price > avg * 1.12) return { type: 'hi', icon: Icons.warning, title: 'السعر مرتفع', detail: `أعلى بـ ${(price - avg).toLocaleString('ar-SA')} ريال من ${ref}`, color: 'bg-orange-50 border-orange-300' };
    if (price < avg * 0.85) return { type: 'lo', icon: Icons.target, title: 'فرصة ممتازة', detail: `أقل بـ ${(avg - price).toLocaleString('ar-SA')} ريال من ${ref}`, color: 'bg-green-50 border-green-300' };
    return { type: 'ok', icon: Icons.okCircle, title: 'السعر مناسب للسوق', detail: `${ref} حوالي ${avg.toLocaleString('ar-SA')} ريال سنوياً`, color: 'bg-blue-50 border-blue-200' };
  };

  const indicator = checkPrice();

  // مصدر الحقيقة الوحيد: قائمة مصفّاة بالمعايير، تُغذّي الخريطة والقائمة معاً.
  const filtered = listings.filter(l => {
    if (filterHood && l.hood !== filterHood) return false;
    if (filterType && l.type !== filterType) return false;
    if (filterBudget && l.adv > parseInt(filterBudget)) return false;
    return true;
  });

  // نقاط الخريطة مشتقّة من نفس القائمة المصفّاة ⇒ تتحدّث العلامات فور تغيّر أي فلتر.
  const filteredMapPoints = toPoints(filtered);

  // ── التنقّل الموحّد (يُمرَّر للدرج الجانبي) — كل بند صفحة مستقلّة ──
  const go = (id: string) => {
    setPage(id as typeof page);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  // قراءة الـ hash عند التحميل (للقدوم من صفحات أخرى مثل /admin عبر '/#map')
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hash.replace('#', '');
    if (h) go(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── المساعد الذكي: ترتيب/تصفية محلّية بالكلمات المفتاحية (بدون API) ──
  // TODO: لربط ذكاء اصطناعي حقيقي لاحقاً، استبدل منطق النقاط أدناه باستدعاء
  //       واجهة (مثل Anthropic) يُرجع ترتيب المعرّفات؛ تبقى الواجهة كما هي.
  const runAI = (raw?: string) => {
    const q = (raw ?? aiQuery).trim();
    if (raw !== undefined) setAiQuery(raw);
    if (!q) return;
    const scored = listings.map((l) => {
      let score = 0;
      const fair = getFair(l);
      if (q.includes(l.hood)) score += 10;                                   // الحي
      if (q.includes(l.type)) score += 8;                                    // النوع
      if (/(رخيص|أرخص|ارخص|أقل سعر|اقل سعر|رخيصة|ميزانية|بسيط)/.test(q)) score += (200000 - l.adv) / 20000; // الرخص
      if (/(فرص|فرصة|أقل من السوق|اقل من السوق|عادل|تحت السوق)/.test(q) && l.adv < fair) score += 6;          // الفرص
      if (/(قريب|قريبة|خدمات|وسط|مركز)/.test(q) && NEAR_HOODS.has(l.hood)) score += 4;                        // قريبة من الخدمات
      // ── الخصائص المنظّمة (تُطابَق فقط إن ذكرها الباحث ووفّرها المكتب؛ لا خصم على الغياب) ──
      if (/غير مفروش/.test(q)) { if (l.furnished === false) score += 5; }                                    // غير مفروشة
      else if (/مفروش/.test(q)) { if (l.furnished === true) score += 5; }                                    // مفروشة
      if (/راكب/.test(q) && l.kitchen === true) score += 5;                                                  // مطبخ راكب
      if (/(مكيّف|مكيف|مكيفات|تكييف|مكيّفة|مكيفة)/.test(q) && l.ac === true) score += 5;                       // مكيّفة
      if (/(موقف|مواقف|كراج|باركن)/.test(q) && (l.parking ?? 0) >= 1) score += 5;                            // مواقف
      return { id: l.id, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const matches = scored.filter((s) => s.score > 0).slice(0, 2).map((s) => s.id);
    setAiOrder(scored.map((s) => s.id));
    setAiMatchIds(matches);
    if (matches.length) {
      const best = listings.find((l) => l.id === matches[0]);
      setAiReply(best
        ? `رتّبت لك الإعلانات حسب طلبك. الأنسب: ${best.title} في ${best.hood} — ${best.adv.toLocaleString('ar-SA')} ريال. الإعلانات المميّزة بعلامة ذهبية «الأنسب لطلبك».`
        : null);
    } else {
      setAiReply('ما لقيت تطابقاً دقيقاً لطلبك، لكن هذي كل الإعلانات المتاحة. جرّب تذكر الحي أو النوع أو ميزانيتك.');
    }
    setSearched(true);
    setTimeout(() => document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  // القائمة المعروضة = نتائج التصفية مرتّبة وفق المساعد الذكي (إن استُخدم)
  const displayList = aiOrder
    ? [...filtered].sort((a, b) => aiOrder.indexOf(a.id) - aiOrder.indexOf(b.id))
    : filtered;

  const condColor: Record<string, string> = {
    new: 'bg-green-100 text-green-800 border border-green-200',
    good: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    old: 'bg-red-100 text-red-800 border border-red-200',
  };
  const stBadge: Record<string, string> = {
    ok: 'bg-blue-100 text-blue-800 border border-blue-200',
    hi: 'bg-orange-100 text-orange-800 border border-orange-200',
    lo: 'bg-green-100 text-green-800 border border-green-200',
  };

  // بطاقة إعلان أفقية: عمود صورة (يمين) + شارة الحالة فوق الصورة + معلومات (يسار)
  // شارات الخصائص المنظّمة — تظهر كل خاصية عبّأها المكتب (null = غير محدّد ⇒ لا شارة).
  // هذه نفسها الحقول التي يطابق عليها المساعد الذكي (furnished/kitchen/ac/parking).
  const attrChips = (l: UIListing): string[] => {
    const c: string[] = [];
    if (l.furnished != null) c.push(l.furnished ? 'مفروشة' : 'غير مفروشة');
    if (l.kitchen != null) c.push(l.kitchen ? 'مطبخ راكب' : 'مطبخ غير راكب');
    if (l.ac != null) c.push(l.ac ? 'مكيّفة' : 'غير مكيّفة');
    if (l.parking != null) c.push(l.parking >= 1 ? `${l.parking} موقف` : 'بدون موقف');
    return c;
  };

  const renderListing = (l: UIListing, isMatch = false) => {
    const fair = getFair(l);
    const st = getSt(l.adv, fair);
    // الصورة الأساسية: الواجهة أولاً، ثم أي صورة متاحة
    const img = l.imagesByCategory?.facade ?? (l.images && l.images.length ? l.images[0] : null);
    const chips = attrChips(l);
    const vBadge = st === 'hi' ? 'bg-[#fff3e0] text-[#C2410C]' : st === 'lo' ? 'bg-[#e8f7ee] text-[#1f7a44]' : 'bg-[#e6f1fb] text-[#1B6CA8]';
    return (
      <div key={l.id} onClick={() => { setSelectedListing(l); setCtOpen(false); setCtSent(false); setCtErr(null); setCtName(''); setCtPhone(''); setCtMsg(''); }}
        className={`card-fade bg-white rounded-2xl border overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5 ${isMatch ? 'border-[#C9A84C] ring-1 ring-[#C9A84C]/40' : 'border-[#cfd9e4] hover:border-[#1B6CA8]'}`}>
        <div className="flex">
          {/* عمود الصورة (يمين) */}
          <div className="relative w-[140px] sm:w-[150px] flex-shrink-0 bg-gradient-to-br from-[#E6F1FB] to-[#d7e6f4] flex items-center justify-center text-[#1B6CA8]">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={l.title} className="w-full h-full object-cover" />
            ) : (
              HousePlaceholder
            )}
            <span className={`absolute bottom-2 right-2 text-[11px] px-2.5 py-1 rounded-lg font-bold shadow-sm ${vBadge}`}>{rl(st)}</span>
            {isMatch && (
              <span className="absolute top-0 right-0 bg-[#C9A84C] text-[#0A3D62] text-[10px] font-bold px-2.5 py-1 rounded-bl-xl shadow">الأنسب لطلبك</span>
            )}
          </div>
          {/* المعلومات (يسار) */}
          <div className="flex-1 min-w-0 p-3.5">
            <div className="font-bold text-[15px] text-[#0f1a28] truncate">{l.title}</div>
            <div className="text-xs text-[#33414f] mt-0.5 font-medium">{l.type} · {l.hood}</div>
            <div className="mt-2 leading-none">
              <span className="text-[19px] font-extrabold text-[#0A3D62]">{l.adv.toLocaleString('ar-SA')}</span>
              <span className="text-[11px] text-[#33414f] mr-1">ريال/سنة</span>
            </div>
            <div className="text-[11px] text-[#1B6CA8] font-medium mt-1">السعر العادل: {fair.toLocaleString('ar-SA')} ريال</div>
            <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-[#f0f4f8] text-[11px] text-[#33414f]">
              <span><b className="text-[#0f1a28]">{l.rooms ?? '—'}</b> غرف</span>
              <span><b className="text-[#0f1a28]">{l.area ?? '—'}</b> م²</span>
              <span><b className="text-[#0f1a28]">{l.baths ?? '—'}</b> حمام</span>
            </div>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {chips.map((c) => (
                  <span key={c} className="text-[10px] bg-[#E6F1FB] text-[#1B6CA8] px-2 py-0.5 rounded-md font-medium">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400";
  const selectCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="min-h-screen bg-[#F5F8FB]" dir="rtl" style={{ fontFamily: "var(--font-body), 'Tajawal', sans-serif" }}>

      {/* الشريط العلوي + الدرج الجانبي (مكوّن مشترك على كل الصفحات) */}
      <SiteNav active={page} onNavigate={go} user={user} isAdmin={isAdmin} onSignOut={signOut} />

      {/* ═══ HOME — المساعد الذكي + الإعلانات فقط ═══ */}
      {page === 'home' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] via-[#1B6CA8] to-[#378ADD] px-5 pt-12 pb-16 relative overflow-hidden">
            <div className="relative z-10 text-center">
              <h1 className="text-white text-xl font-bold mb-5">سوق الإيجار <span className="text-[#9BC8F0]">بكل وضوح</span></h1>
              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
                {['استشارة عقارية مجانية', 'اعرف السعر العادل قبل توقيع العقد', 'سوق شفاف، قرار واثق'].map(t => (
                  <span key={t} className="text-white/90 text-xs leading-relaxed flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9BC8F0] inline-block flex-shrink-0" />{t}
                  </span>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-7 bg-[#F5F8FB] rounded-t-3xl" />
          </div>

          <div className="px-4 pt-3 pb-6 space-y-4">

            {/* المساعد الذكي — فوق الإعلانات (منطق محلّي بدون API) */}
            <div className="bg-gradient-to-b from-white to-[#f7fafd] border-[1.5px] border-[#c2d2e2] rounded-2xl p-5 shadow-[0_8px_28px_rgba(10,61,98,0.13)]">
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] flex items-center justify-center text-white flex-shrink-0">{Icons.ai}</div>
                <div>
                  <div className="font-bold text-[15px] text-[#0A3D62]">المساعد الذكي</div>
                  <div className="text-xs text-[#33414f]">اكتب رغبتك وسأرتّب لك الإعلانات الأنسب</div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runAI()}
                  placeholder="مثال: أبي شقة بالنرجس بسعر عادل وقريبة من الخدمات"
                  className="flex-1 px-3.5 py-3 border-[1.5px] border-[#dde5ee] rounded-xl bg-[#fafcfe] text-sm text-[#0f1a28] text-right outline-none focus:border-[#1B6CA8] focus:bg-white focus:ring-2 focus:ring-[#1B6CA8]/10 placeholder-[#9aa7b4]"
                />
                <button onClick={() => runAI()} className="px-5 rounded-xl bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white font-bold text-sm whitespace-nowrap hover:opacity-95 transition-all">
                  ابحث
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {['أرخص شقة متاحة', 'فيلا في حطين', 'فرص بأقل من السوق', 'استوديو رخيص', 'قريب من الخدمات'].map((c) => (
                  <button key={c} onClick={() => runAI(c)}
                    className="px-3 py-1.5 rounded-full bg-[#E6F1FB] text-[#1B6CA8] text-xs border border-transparent hover:border-[#1B6CA8] transition-all">
                    {c}
                  </button>
                ))}
              </div>
              {aiReply && (
                <div className="mt-3.5 flex items-start gap-2 px-3.5 py-3 rounded-xl bg-[#E6F1FB] text-[#0A3D62] text-[13px] leading-relaxed">
                  <span className="flex-shrink-0 mt-0.5 text-[#1B6CA8]">{Icons.check}</span>
                  <span>{aiReply}</span>
                </div>
              )}
            </div>

            {/* 2. الإعلانات — تُعرض دائماً، يرتّبها المساعد الذكي ويصفّيها البحث */}
            <div id="listings-section">
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-bold text-[#0f1a28] text-lg sec-underline">{searched ? 'نتائج بحثك' : 'الإعلانات'}</h2>
                <div className="text-xs text-[#33414f] flex items-center gap-1">{Icons.chart} {displayList.length} إعلان</div>
              </div>
              {displayList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#cfd9e4] p-8 text-center text-[#33414f] text-sm">
                  {listings.length === 0 ? 'لا توجد إعلانات متاحة حالياً — تُعرض هنا إعلانات المكاتب فور نشرها.' : 'لا توجد نتائج — جرّب تغيير المعايير من البحث بالأعلى.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayList.map((l) => renderListing(l, aiMatchIds.includes(l.id)))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ═══ ابحث عن إيجارك — البحث + الخريطة (صفحة واحدة مدمجة) ═══ */}
      {page === 'search' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-6 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-xl font-bold mb-1">ابحث عن إيجارك</h1>
              <p className="text-white/85 text-sm">حدّد المعايير وشاهد العقارات على الخريطة مباشرة</p>
            </div>
          </div>
          <div className="px-4 pt-3 pb-6 space-y-4">
            {/* الفلاتر — مصدر الحقيقة الذي يغذّي الخريطة والقائمة معاً */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                  {Icons.search}
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">صفِّ النتائج</div>
                  <div className="text-xs text-gray-500">تتحدّث الخريطة والقائمة فور تغيير أي فلتر</div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-700 block mb-1 font-semibold">الحي</label>
                  <select value={filterHood} onChange={e => setFilterHood(e.target.value)} className={selectCls}>
                    <option value="">كل الأحياء</option>
                    {Object.keys(mktAvg).map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-700 block mb-1 font-semibold">نوع العقار</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectCls}>
                    <option value="">كل الأنواع</option>
                    {['شقة', 'فيلا', 'دور', 'استوديو'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-700 block mb-1 font-semibold">الميزانية السنوية</label>
                  <input type="number" value={filterBudget} onChange={e => setFilterBudget(e.target.value)}
                    placeholder="مثال: 70000" className={inputCls} />
                </div>
              </div>
              <div className="px-4 pb-4 flex items-center justify-between">
                <div className="text-xs text-[#33414f]">{filtered.length} نتيجة · {filteredMapPoints.length} على الخريطة</div>
                {(filterHood || filterType || filterBudget) && (
                  <button onClick={clearFilters} className="text-xs text-[#0A3D62] border border-[#cfd9e4] px-3 py-1.5 rounded-lg hover:bg-[#f0f4f8] transition-colors">مسح الفلاتر</button>
                )}
              </div>
            </div>

            {/* الخريطة — نقاطها مشتقّة من نفس القائمة المصفّاة (تتحدّث العلامات حيّاً) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-[#1B6CA8]">{Icons.map}</span>
                <span className="font-bold text-sm text-gray-900">الخريطة التفاعلية</span>
                <span className="text-xs text-[#33414f] mr-auto">{filteredMapPoints.length} عقار على الخريطة</span>
              </div>
              {filteredMapPoints.length === 0 ? (
                <div className="p-8 text-center text-[#33414f] text-sm">
                  {listings.length === 0 ? 'لا توجد إعلانات متاحة حالياً.' : 'لا توجد عقارات بإحداثيات مطابقة للفلاتر الحالية.'}
                </div>
              ) : (
                <MapComponent points={filteredMapPoints} />
              )}
            </div>

            {/* القائمة المطابقة — نفس مصدر الفلاتر */}
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-bold text-[#0f1a28] text-lg sec-underline">العقارات المطابقة</h2>
                <div className="text-xs text-[#33414f] flex items-center gap-1">{Icons.chart} {filtered.length} نتيجة</div>
              </div>
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#cfd9e4] p-8 text-center text-[#33414f] text-sm">
                  {listings.length === 0 ? 'لا توجد إعلانات متاحة حالياً — تُعرض هنا إعلانات المكاتب فور نشرها.' : 'لا توجد نتائج — جرّب توسيع المعايير.'}
                </div>
              ) : (
                <div className="space-y-3">{filtered.map((l) => renderListing(l))}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ مؤشر السعر العادل — صفحة مستقلّة ═══ */}
      {page === 'indicator' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-6 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-xl font-bold mb-1">مؤشر السعر العادل</h1>
              <p className="text-white/85 text-sm">قارن أي إيجار بمتوسط سوق الحي قبل التوقيع</p>
            </div>
          </div>
          <div className="px-4 pt-4 pb-6 max-w-xl mx-auto">
            <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-orange-50 to-white px-4 py-3 border-b border-orange-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                  {Icons.chart}
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">جرّب المؤشر</div>
                  <div className="text-xs text-gray-500">أدخل قيمة الإيجار وسنخبرك إن كانت مناسبة لسوق الحي</div>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-700 block mb-1 font-semibold">الحي</label>
                    <select value={siZone} onChange={e => setSiZone(e.target.value)} className={selectCls}>
                      {Object.keys(mktAvg).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 block mb-1 font-semibold">نوع الوحدة</label>
                    <select value={siType} onChange={e => setSiType(e.target.value)} className={selectCls}>
                      {['شقة', 'فيلا', 'دور', 'دوبلكس', 'استوديو'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs text-gray-700 block mb-1 font-semibold">الإيجار السنوي (ريال)</label>
                  <input type="number" value={siPrice} onChange={e => setSiPrice(e.target.value)}
                    placeholder="مثال: 65000" className={inputCls} />
                </div>
                {siPrice && (
                  <div className={`p-3 rounded-xl flex items-center gap-3 border ${indicator.color}`}>
                    <div className={indicator.type === 'hi' ? 'text-orange-600' : indicator.type === 'lo' ? 'text-green-600' : 'text-blue-700'}>
                      {indicator.icon}
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${indicator.type === 'hi' ? 'text-orange-700' : indicator.type === 'lo' ? 'text-green-700' : 'text-blue-800'}`}>{indicator.title}</div>
                      {indicator.detail && <div className="text-xs text-gray-600 mt-0.5">{indicator.detail}</div>}
                    </div>
                  </div>
                )}
                {!siPrice && (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center text-sm text-gray-500">
                    أدخل قيمة الإيجار للمقارنة بمتوسط السوق
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ═══ خيارات تقسيط الإيجار — صفحة مستقلّة (تضم نموذج «اترك رسالة») ═══ */}
      {page === 'finance' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-6 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-xl font-bold mb-1">خيارات تقسيط الإيجار</h1>
              <p className="text-white/85 text-sm">حلول تقسيط ميسّرة تناسب ميزانيتك</p>
            </div>
          </div>
          <div className="px-4 pt-5 pb-6 space-y-4 max-w-xl mx-auto">
            <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] rounded-2xl p-6 text-center shadow-xl">
              <div className="flex justify-center mb-3 text-white opacity-90">{Icons.bank}</div>
              <div className="text-white font-bold text-lg mb-2">تحتاج تمويلاً عقارياً؟</div>
              <div className="text-white/85 text-sm mb-4 leading-relaxed max-w-sm mx-auto">نربطك مباشرة بشركائنا من الجهات التمويلية المعتمدة لتحصل على أفضل عرض يناسبك</div>
              <button onClick={() => { if (!leadMsg.trim()) setLeadMsg('أرغب بطلب تمويل عقاري — أرجو التواصل معي.'); document.getElementById('finance-lead-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="bg-white text-[#0A3D62] px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all">
                اطلب التمويل الآن
              </button>
              <div className="text-white/70 text-xs mt-3">خدمة مجانية · ردود سريعة · مقارنة عروض</div>
            </div>

            {/* تواصل — اترك رسالة */}
            <div id="finance-lead-form" className="bg-white rounded-2xl overflow-hidden border border-blue-200 shadow-sm">
              <div className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-4 py-3">
                <div className="text-white font-bold text-sm">اترك رسالة وسنتواصل معك</div>
                <div className="text-white/80 text-xs">اكتب طلبك أو استفسارك ونرجع لك قريباً</div>
              </div>
              <div className="p-4">
                {leadSent ? (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm text-center font-medium">
                    شكراً لك! وصلتنا رسالتك وسنتواصل معك قريباً.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="الاسم" className={inputCls} />
                      <input value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder="رقم الجوال" className={inputCls} dir="ltr" />
                    </div>
                    <textarea value={leadMsg} onChange={e => setLeadMsg(e.target.value)} placeholder="رسالتك (اختياري) — مثال: أبحث عن شقة 3 غرف بالنرجس" rows={3} className={inputCls + ' resize-none'} />
                    {leadErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{leadErr}</div>}
                    <button onClick={submitLead} disabled={leadSending}
                      className="w-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-2.5 rounded-xl font-bold text-sm shadow-md hover:opacity-95 transition-all disabled:opacity-50">
                      {leadSending ? 'جارٍ الإرسال…' : 'إرسال'}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* (دُمجت الخريطة داخل صفحة «ابحث عن إيجارك») */}

      {/* ═══ ALERTS (مُزالة) ═══ */}
      {/* ═══ PRICING / REGISTRATION ═══ */}
      {page === 'pricing' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-8 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <span className="bg-white/20 text-white text-sm px-4 py-1.5 rounded-2xl border border-white/30 font-medium">التسجيل مجاناً لفترة محدودة</span>
              <h1 className="text-2xl font-bold mt-4 mb-2">سجّل في مؤشر العقارية</h1>
              <p className="text-white/85 text-sm max-w-sm mx-auto">اختر نوع حسابك للبدء</p>
            </div>
          </div>
          <div className="p-4 space-y-4">

            {/* تسجيل الدخول / إنشاء حساب — بالإيميل وكلمة المرور */}
            <div className="bg-white rounded-2xl p-5 border-2 border-blue-200 shadow-sm">
              {user ? (
                <div className="text-center">
                  <div className="font-bold text-[#0A3D62] mb-1">أنت مسجّل الدخول ✓</div>
                  <div className="text-sm text-gray-600 mb-3">{user.email}</div>
                  <button onClick={() => setPage('office')} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow">
                    دخول لوحة المكتب
                  </button>
                </div>
              ) : (
                <div>
                  {/* تبويبات: تسجيل دخول / إنشاء حساب */}
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
                    <button
                      onClick={() => { setAuthMode('login'); setAuthMsg(null); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      تسجيل دخول
                    </button>
                    <button
                      onClick={() => { setAuthMode('signup'); setAuthMsg(null); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${authMode === 'signup' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      إنشاء حساب
                    </button>
                  </div>

                  {authMode === 'signup' && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-700 font-semibold block mb-1">نوع الحساب</label>
                      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        <button type="button" onClick={() => setAuthRole('seeker')}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${authRole === 'seeker' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                          باحث عن إيجار
                        </button>
                        <button type="button" onClick={() => setAuthRole('office')}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${authRole === 'office' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                          مكتب عقاري
                        </button>
                      </div>
                    </div>
                  )}

                  <label className="text-xs text-gray-700 font-semibold block mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full mb-3 px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                  />

                  <label className="text-xs text-gray-700 font-semibold block mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    dir="ltr"
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && authMode === 'login' && submitAuth()}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                  />

                  {authMode === 'signup' && (
                    <>
                      <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">تأكيد كلمة المرور</label>
                      <input
                        type="password"
                        dir="ltr"
                        value={authPass2}
                        onChange={(e) => setAuthPass2(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitAuth()}
                        placeholder="••••••••"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                      />
                      {authRole === 'office' && (
                        <>
                          <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">اسم المكتب</label>
                          <input
                            type="text"
                            value={authOfficeName}
                            onChange={(e) => setAuthOfficeName(e.target.value)}
                            placeholder="مثال: مكتب الأفق العقاري"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                          />
                          <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">رقم رخصة فال (اختياري)</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={authFal}
                            onChange={(e) => setAuthFal(e.target.value)}
                            placeholder="1100123456"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                          />
                        </>
                      )}
                      {authRole === 'seeker' && (
                        <>
                          <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">الاسم (اختياري)</label>
                          <input
                            type="text"
                            value={authSeekerName}
                            onChange={(e) => setAuthSeekerName(e.target.value)}
                            placeholder="اسمك"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                          />
                        </>
                      )}
                    </>
                  )}

                  <button
                    onClick={submitAuth}
                    disabled={authBusy}
                    className="w-full mt-4 bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50"
                  >
                    {authBusy ? 'جارٍ المعالجة…' : authMode === 'login' ? 'تسجيل دخول' : 'إنشاء حساب'}
                  </button>

                  {authMsg && (
                    <div className={`mt-3 text-sm rounded-xl p-3 border ${authMsg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {authMsg.text}
                    </div>
                  )}
                </div>
              )}
            </div>

            {[
              {
                name: 'باحث عن إيجار',
                desc: 'للأفراد الباحثين عن سكن مناسب بأسعار عادلة',
                features: ['بحث غير محدود في كل الأحياء', 'مؤشر السعر العادل لكل إعلان', '5 استشارات مع المساعد الذكي شهرياً', 'تنبيه واحد للإعلانات الجديدة'],
                locked: ['تنبيهات غير محدودة', 'حفظ التفضيلات والمقارنة'],
                popular: false,
                cta: 'سجّل كباحث — مجاناً'
              },
              {
                name: 'مكتب عقاري',
                desc: 'للمكاتب العقارية المرخصة بفال',
                features: ['حتى 10 إعلانات نشطة', 'توثيق رخصة فال عبر مراجعة الإدارة', 'تقييم تلقائي بالسعر العادل', 'لوحة تحكم إحصائية', 'الحاسبة الذكية للأسعار'],
                locked: ['شارة المكتب الموثّق', 'AI لإدارة الردود تلقائياً'],
                popular: true,
                cta: 'سجّل مكتبك — مجاناً'
              },
            ].map(plan => (
              <div key={plan.name} className={`bg-white rounded-2xl p-5 border-2 shadow-sm ${plan.popular ? 'border-green-400' : 'border-gray-200'}`}>
                {plan.popular && (
                  <div className="bg-gradient-to-l from-green-600 to-green-500 text-white text-xs px-4 py-1 rounded-xl inline-block mb-3 font-bold">
                    الأكثر طلباً
                  </div>
                )}
                <div className="font-bold text-lg text-[#0A3D62] mb-1">{plan.name}</div>
                <div className="text-sm text-gray-600 mb-4">{plan.desc}</div>
                <div className="bg-green-600 text-white text-lg font-bold px-5 py-2 rounded-xl inline-block mb-1">مجاناً</div>
                <div className="text-xs text-gray-500 mb-4">لفترة محدودة</div>
                <ul className="space-y-2 mb-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-800">
                      <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">{Icons.check}</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <ul className="space-y-2 mb-5">
                  {plan.locked.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0 text-xs">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => { setAuthMode('signup'); setAuthRole(plan.popular ? 'office' : 'seeker'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${plan.popular ? 'bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white shadow-md hover:opacity-95' : 'bg-white border-2 border-blue-500 text-[#0A3D62] hover:bg-blue-50'}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ OFFICE DASHBOARD — يتطلّب تسجيل دخول حقيقي ═══ */}
      {page === 'office' && (
        user ? (
          <OfficeDashboard mktAvg={mktAvg} />
        ) : (
          <div className="max-w-md mx-auto px-5 py-12 text-center">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <div className="text-lg font-bold text-gray-900 mb-2">لوحة المكتب تتطلّب تسجيل الدخول</div>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">سجّل دخولك بحساب مكتب، أو أنشئ حساب مكتب جديد، للوصول إلى لوحتك وإعلاناتك الحقيقية.</p>
              <button onClick={() => { setPage('pricing'); setAuthMode('login'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow">
                تسجيل الدخول / إنشاء حساب
              </button>
            </div>
          </div>
        )
      )}

      {/* تفاصيل الإعلان */}
      {selectedListing && (() => {
        const l = selectedListing; const fair = getFair(l); const st = getSt(l.adv, fair);
        return (
          <div onClick={() => setSelectedListing(null)} className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md max-h-[88vh] overflow-auto">
              <div className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] p-5 text-white flex justify-between items-start">
                <div>
                  <div className="text-2xl font-bold">{l.adv.toLocaleString('ar-SA')} <span className="text-sm font-normal opacity-80">ريال/سنة</span></div>
                  <div className="text-sm opacity-90 mt-1">{l.type} · {l.hood}</div>
                </div>
                <button onClick={() => setSelectedListing(null)} className="text-white text-3xl leading-none px-1">×</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between bg-blue-50 rounded-xl p-3">
                  <span className="text-sm text-gray-700">السعر العادل للسوق</span>
                  <span className="font-bold text-[#0A3D62]">{fair.toLocaleString('ar-SA')} ريال</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">حالة السعر</span>
                  <span className={`text-xs px-2.5 py-1 rounded-xl font-bold ${stBadge[st]}`}>{rl(st)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-xl p-3"><div className="text-lg font-bold text-gray-900">{l.rooms ?? '—'}</div><div className="text-xs text-gray-500">غرف</div></div>
                  <div className="bg-gray-50 rounded-xl p-3"><div className="text-lg font-bold text-gray-900">{l.area ?? '—'}</div><div className="text-xs text-gray-500">م²</div></div>
                  <div className="bg-gray-50 rounded-xl p-3"><div className="text-lg font-bold text-gray-900">{l.baths ?? '—'}</div><div className="text-xs text-gray-500">حمامات</div></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${condColor[l.cond] || ''}`}>{l.condLabel || 'الحالة غير محددة'}</span>
                  {l.furnished != null && <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-purple-100 text-purple-800 border border-purple-200">{l.furnished ? 'مفروشة' : 'غير مفروشة'}</span>}
                  {l.kitchen != null && <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-blue-50 text-blue-800 border border-blue-200">{l.kitchen ? 'مطبخ راكب' : 'مطبخ غير راكب'}</span>}
                  {l.ac != null && <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-cyan-50 text-cyan-800 border border-cyan-200">{l.ac ? 'مكيّفة' : 'غير مكيّفة'}</span>}
                  {l.parking != null && <span className="text-xs px-2.5 py-1 rounded-lg font-medium bg-teal-50 text-teal-800 border border-teal-200">{l.parking >= 1 ? `مواقف: ${l.parking}` : 'لا يوجد مواقف'}</span>}
                </div>
                {/* معرض الصور المصنّفة — بطاقات بمسمّيات عربية حسب الغرفة */}
                {(() => {
                  const cat = l.imagesByCategory;
                  const shots: { label: string; url: string }[] = [];
                  if (cat) {
                    if (cat.facade) shots.push({ label: 'الواجهة', url: cat.facade });
                    if (cat.hall) shots.push({ label: 'الصالة', url: cat.hall });
                    (cat.bedrooms ?? []).forEach((u, i) => shots.push({ label: (cat.bedrooms ?? []).length > 1 ? `غرفة نوم ${i + 1}` : 'غرفة النوم', url: u }));
                    if (cat.majlis) shots.push({ label: 'المجلس', url: cat.majlis });
                    if (cat.kitchen) shots.push({ label: 'المطبخ', url: cat.kitchen });
                    (cat.bathrooms ?? []).forEach((u, i) => shots.push({ label: (cat.bathrooms ?? []).length > 1 ? `حمام ${i + 1}` : 'الحمام', url: u }));
                  }
                  // إعلانات قديمة بلا تصنيف: نعرض مصفوفة الصور المسطّحة بلا مسمّيات
                  if (!shots.length && l.images?.length) l.images.forEach((u, i) => shots.push({ label: `صورة ${i + 1}`, url: u }));
                  if (!shots.length) return null;
                  return (
                    <div>
                      <div className="text-sm font-bold text-gray-800 mb-2">صور الوحدة</div>
                      <div className="grid grid-cols-2 gap-2">
                        {shots.map((s, i) => (
                          <figure key={i} className="relative rounded-xl overflow-hidden border border-gray-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.url} alt={s.label} className="w-full h-28 object-cover" />
                            <figcaption className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[11px] px-2 py-1 text-right">{s.label}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {l.description && <p className="text-sm text-gray-700 leading-relaxed">{l.description}</p>}
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">رخصة فال: {l.fal || '—'}</div>
                {ctSent ? (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm text-center font-medium">تم إرسال طلبك — سيتواصل معك المكتب قريباً.</div>
                ) : ctOpen ? (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={ctName} onChange={e => setCtName(e.target.value)} placeholder="الاسم" className={inputCls} />
                      <input value={ctPhone} onChange={e => setCtPhone(e.target.value)} placeholder="رقم الجوال" className={inputCls} dir="ltr" />
                    </div>
                    <textarea value={ctMsg} onChange={e => setCtMsg(e.target.value)} placeholder="رسالتك (اختياري) — مثال: متى أقدر أعاين الوحدة؟" rows={2} className={inputCls + ' resize-none'} />
                    {ctErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{ctErr}</div>}
                    <button onClick={submitListingContact} disabled={ctSending} className="w-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">{ctSending ? 'جارٍ الإرسال…' : 'إرسال طلب التواصل'}</button>
                  </div>
                ) : (
                  <button onClick={() => setCtOpen(true)} className="w-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-3 rounded-xl font-bold text-sm">تواصل بخصوص هذا الإعلان</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ سياسة الخصوصية ═══ */}
      {(page === 'privacy' || page === 'terms') && (
        <div className="max-w-2xl mx-auto px-5 py-8">
          <button onClick={() => setPage('search')} className="text-blue-600 text-sm font-medium mb-4 hover:underline">→ العودة للرئيسية</button>
          {page === 'privacy' ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-gray-700 leading-relaxed text-sm space-y-4">
              <h1 className="text-xl font-bold text-gray-900">سياسة الخصوصية</h1>
              <p className="text-xs text-gray-400">آخر تحديث: 2026</p>
              <p>تُوضّح هذه السياسة كيفية جمع منصة «مؤشر العقارية» للمعلومات الشخصية واستخدامها وحمايتها عند استخدامك للمنصة. باستخدامك المنصة فإنك توافق على ما ورد في هذه السياسة.</p>
              <div><h2 className="font-bold text-gray-900 mb-1">١. المعلومات التي نجمعها</h2><p>قد نجمع: الاسم، رقم الجوال، البريد الإلكتروني، ومحتوى الرسائل التي ترسلها عبر نموذج التواصل. وبالنسبة للمكاتب العقارية: بيانات المكتب ورقم رخصة فال وبيانات الوحدات المعروضة.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٢. كيف نستخدم معلوماتك</h2><p>نستخدم المعلومات للرد على استفساراتك، عرض الإعلانات، تحسين خدماتنا، والتواصل معك بخصوص طلباتك. لا نستخدم بياناتك لأغراض خارج نطاق الخدمة دون موافقتك.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٣. مشاركة المعلومات</h2><p>لا نبيع بياناتك الشخصية لأي طرف ثالث. قد نشارك بيانات محدودة مع مزوّدي الخدمات التقنية (مثل الاستضافة وقواعد البيانات) بالقدر اللازم لتشغيل المنصة فقط، أو عند طلب الجهات النظامية المختصة.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٤. حماية البيانات</h2><p>نتّخذ تدابير تقنية وتنظيمية معقولة لحماية بياناتك من الوصول غير المصرّح به أو التعديل أو الإفشاء.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٥. حقوقك</h2><p>يحق لك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها، وذلك بالتواصل معنا عبر القنوات الرسمية للمنصة.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٦. التعديلات</h2><p>قد نُحدّث هذه السياسة من وقت لآخر، وسيُنشر أي تحديث على هذه الصفحة مع تاريخ آخر تعديل.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٧. التواصل</h2><p>لأي استفسار بخصوص الخصوصية، تواصل معنا عبر نموذج «اترك رسالة» في المنصة.</p></div>
              <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">ملاحظة: هذه صياغة عامة لأغراض المنصة، ويُنصح بمراجعتها قانونياً قبل الإطلاق الرسمي.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-gray-700 leading-relaxed text-sm space-y-4">
              <h1 className="text-xl font-bold text-gray-900">شروط الاستخدام</h1>
              <p className="text-xs text-gray-400">آخر تحديث: 2026</p>
              <p>باستخدامك منصة «مؤشر العقارية» فإنك توافق على الالتزام بهذه الشروط.</p>
              <div><h2 className="font-bold text-gray-900 mb-1">١. طبيعة الخدمة</h2><p>توفّر المنصة أداة استرشادية لمقارنة أسعار الإيجار بمتوسطات السوق، إضافةً لعرض إعلانات عقارية. مؤشر «السعر العادل» تقديري للاسترشاد فقط ولا يُعدّ تقييماً رسمياً مُلزِماً.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٢. مسؤولية المحتوى</h2><p>المكاتب والمعلنون مسؤولون عن دقة بيانات إعلاناتهم وصحّة تراخيصهم. لا تتحمل المنصة مسؤولية أي اتفاق يتم خارجها بين الأطراف.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٣. الاستخدام المقبول</h2><p>يُمنع استخدام المنصة لأي غرض غير نظامي أو لنشر بيانات مضلّلة أو إعلانات وهمية.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٤. حدود المسؤولية</h2><p>تُقدَّم الخدمة «كما هي»، ولا تضمن المنصة خلوّها من الأخطاء أو دقّة كل البيانات المعروضة بشكل مطلق.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٥. التعديلات</h2><p>يحق للمنصة تحديث هذه الشروط، ويسري التحديث فور نشره على هذه الصفحة.</p></div>
              <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">ملاحظة: هذه صياغة عامة لأغراض المنصة، ويُنصح بمراجعتها قانونياً قبل الإطلاق الرسمي.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ عن المنصة ═══ */}
      {page === 'about' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-8 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#EAF0F6] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-2xl font-bold mb-2">عن مؤشر العقارية</h1>
              <p className="text-white/85 text-sm max-w-md mx-auto leading-relaxed">منصّة تجعل سوق الإيجار السكني في الرياض شفّافاً — تعرف السعر العادل قبل توقيع العقد.</p>
            </div>
          </div>
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
            <div className="bg-white rounded-2xl border border-[#cfd9e4] shadow-sm p-6 text-[#33414f] text-sm leading-relaxed space-y-4">
              <div>
                <h2 className="font-bold text-[#0f1a28] text-base mb-1 sec-underline">فكرتنا</h2>
                <p>نُساعد الباحث عن سكن والمكتب العقاري على اتخاذ قرار واثق، عبر مؤشر «السعر العادل» الذي يقارن أي إيجار بمتوسط سوق الحي، وخريطة تفاعلية، ومساعد ذكي يفهم طلبك بكلامك.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { t: 'السعر العادل', d: 'قارن أي إيجار بمتوسط الحي فوراً.' },
                  { t: 'خريطة شفافة', d: 'شاهد الأسعار وحالتها على الخريطة.' },
                  { t: 'مساعد ذكي', d: 'اكتب رغبتك ونرتّب لك الأنسب.' },
                ].map((f) => (
                  <div key={f.t} className="bg-[#f7fafd] border border-[#dde5ee] rounded-xl p-4">
                    <div className="font-bold text-[#0A3D62] text-sm mb-1">{f.t}</div>
                    <div className="text-xs text-[#33414f] leading-relaxed">{f.d}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={() => go('search')} className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">ابدأ البحث</button>
                <button onClick={() => { setPage('privacy'); if (typeof window !== 'undefined') window.scrollTo(0, 0); }} className="bg-white border border-[#cfd9e4] text-[#0A3D62] px-5 py-2.5 rounded-xl font-bold text-sm">سياسة الخصوصية</button>
                <button onClick={() => { setPage('terms'); if (typeof window !== 'undefined') window.scrollTo(0, 0); }} className="bg-white border border-[#cfd9e4] text-[#0A3D62] px-5 py-2.5 rounded-xl font-bold text-sm">شروط الاستخدام</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ الاستفسارات — نموذج يصل لـ /admin عبر جدول leads ═══ */}
      {page === 'inquiries' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-6 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-xl font-bold mb-1">الاستفسارات</h1>
              <p className="text-white/85 text-sm">أرسل استفسارك وسيصل فريق المنصة ونتواصل معك</p>
            </div>
          </div>
          <div className="px-4 pt-4 pb-6 max-w-xl mx-auto">
            <div className="bg-white rounded-2xl border border-[#cfd9e4] shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-4 py-3">
                <div className="text-white font-bold text-sm">نموذج استفسار</div>
                <div className="text-white/80 text-xs">اذكر الحي والنوع إن أردت استفساراً محدّداً</div>
              </div>
              <div className="p-4">
                {inqSent ? (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm text-center font-medium">
                    شكراً لك! وصلنا استفسارك وسنتواصل معك قريباً.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={inqName} onChange={e => setInqName(e.target.value)} placeholder="الاسم" className={inputCls} />
                      <input value={inqPhone} onChange={e => setInqPhone(e.target.value)} placeholder="رقم الجوال" className={inputCls} dir="ltr" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-700 block mb-1 font-semibold">الحي (اختياري)</label>
                        <select value={inqHood} onChange={e => setInqHood(e.target.value)} className={selectCls}>
                          <option value="">— غير محدّد —</option>
                          {Object.keys(mktAvg).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-700 block mb-1 font-semibold">نوع الوحدة (اختياري)</label>
                        <select value={inqType} onChange={e => setInqType(e.target.value)} className={selectCls}>
                          <option value="">— غير محدّد —</option>
                          {['شقة', 'فيلا', 'دور', 'دوبلكس', 'استوديو'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <textarea value={inqMsg} onChange={e => setInqMsg(e.target.value)} placeholder="نص الاستفسار — مثال: متى يتوفّر دوبلكس في حطين؟" rows={3} className={inputCls + ' resize-none'} />
                    {inqErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{inqErr}</div>}
                    <button onClick={submitInquiry} disabled={inqSending}
                      className="w-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-2.5 rounded-xl font-bold text-sm shadow-md hover:opacity-95 transition-all disabled:opacity-50">
                      {inqSending ? 'جارٍ الإرسال…' : 'إرسال الاستفسار'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 py-4 px-5 text-center text-xs text-gray-500 mt-4">
        <button onClick={() => { setPage('privacy'); if (typeof window !== 'undefined') window.scrollTo(0, 0); }} className="text-blue-600 font-medium hover:underline">سياسة الخصوصية</button>
        <span className="mx-3 text-gray-300">·</span>
        <button onClick={() => { setPage('terms'); if (typeof window !== 'undefined') window.scrollTo(0, 0); }} className="text-blue-600 font-medium hover:underline">شروط الاستخدام</button>
        <span className="mx-3 text-gray-300">·</span>
        <span>© 2026 مؤشر العقارية</span>
      </div>
    </div>
  );
}

// ═══ لوحة تحكم المكتب الكاملة ═══
function OfficeDashboard({ mktAvg }: { mktAvg: MktAvg }) {
  const [offPage, setOffPage] = useState<'dashboard'|'listings'|'add'|'calc'|'inquiries'|'profile'|'settings'>('dashboard');
  const [addStep, setAddStep] = useState(1);
  // الحاسبة الذكية: الحي والنوع بالاسم — يُقرأ متوسطهما من /admin (mktAvg) لا من أرقام ثابتة.
  const [cHood, setCHood] = useState(() => Object.keys(mktAvg)[0] ?? 'النرجس');
  const [cType, setCType] = useState('شقة');
  const [cArea, setCArea] = useState('130');
  const [cCost, setCCost] = useState('600000');
  const [cReno, setCReno] = useState('40000');
  const [cMargin, setCMargin] = useState('10');
  const [cFee, setCFee] = useState('2.5');

  // حقول نموذج إضافة الوحدة (مربوطة بقاعدة البيانات)
  const [fType, setFType] = useState('شقة');
  const [fHood, setFHood] = useState('النرجس');
  const [fRent, setFRent] = useState('');
  const [fArea, setFArea] = useState('');
  const [fRooms, setFRooms] = useState('2');
  const [fBaths, setFBaths] = useState('1');
  const [fCond, setFCond] = useState('حالة جيدة');
  // خصائص منظّمة اختيارية (يملؤها المكتب) — '' = غير محدّد ⇒ لا تُطابَق ولا تُخصم
  const [fFurniture, setFFurniture] = useState(''); // مفروشة | غير مفروشة
  const [fKitchen, setFKitchen] = useState('');     // راكب | غير راكب
  const [fAc, setFAc] = useState('');               // مكيّفة | غير مكيّفة
  const [fParking, setFParking] = useState('');     // 0 | 1 | 2 | 3
  const [fDesc, setFDesc] = useState('');
  // الصور المصنّفة: المفتاح = خانة (facade/hall/majlis/kitchen/bedN/bathN)
  const [fPhotos, setFPhotos] = useState<Record<string, { file: File; preview: string } | null>>({});
  const setPhoto = (key: string, file: File | null) =>
    setFPhotos((prev) => {
      const old = prev[key];
      if (old) URL.revokeObjectURL(old.preview);
      return { ...prev, [key]: file ? { file, preview: URL.createObjectURL(file) } : null };
    });
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── بيانات المكتب الحقيقية (مربوطة بالحساب الحالي عبر owner_id) ──
  const [myOffice, setMyOffice] = useState<{ id: string; name: string; fal_license: string | null; verified: boolean; status: string | null; active: boolean } | null>(null);
  const [myListings, setMyListings] = useState<{ id: string; title: string; advertised: number; status: string; rejection_note: string | null }[]>([]);
  const [myLeads, setMyLeads] = useState<{ id: string; name: string; phone: string; message: string | null; created_at: string }[]>([]);
  const [offLoaded, setOffLoaded] = useState(false);
  // نموذج إنشاء المكتب داخل اللوحة (يضمن ربط أي حساب بمكتب بشكل موثوق)
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newFal, setNewFal] = useState('');
  const [creatingOffice, setCreatingOffice] = useState(false);
  const [createOfficeErr, setCreateOfficeErr] = useState('');

  // نستخدم getSession (يقرأ محلياً ويجدّد التوكن المنتهي) بدل getUser الذي يفشل عند انتهاء الصلاحية
  const currentUid = async (sb: ReturnType<typeof createClient>): Promise<string | null> => {
    const { data: { session } } = await sb.auth.getSession();
    return session?.user?.id ?? null;
  };

  const reloadOffice = async () => {
    if (!isSupabaseConfigured()) { setOffLoaded(true); return; }
    const sb = createClient();
    const uid = await currentUid(sb);
    if (!uid) { setMyOffice(null); setOffLoaded(true); return; }
    const { data: offs } = await sb.from('offices').select('id,name,fal_license,verified,status,active').eq('owner_id', uid).order('created_at', { ascending: false }).limit(1);
    const off = (offs && offs[0]) || null;
    setMyOffice((off as typeof myOffice) ?? null);
    if (off) {
      const { data: ls } = await sb.from('listings').select('id,title,advertised,status,rejection_note').eq('office_id', off.id).order('created_at', { ascending: false });
      setMyListings((ls ?? []) as typeof myListings);
      // الاستفسارات الحقيقية الموجّهة لهذا المكتب (تتطلب سياسة leads_office_read)
      const { data: lds } = await sb.from('leads').select('id,name,phone,message,created_at').eq('office_id', off.id).order('created_at', { ascending: false });
      setMyLeads((lds ?? []) as typeof myLeads);
    } else {
      setMyListings([]);
      setMyLeads([]);
    }
    setOffLoaded(true);
  };

  // إنشاء المكتب مباشرة وأنت داخل (جلسة فعّالة ⇒ تتجاوز كل مشاكل التسجيل)
  const createOffice = async () => {
    const name = newOfficeName.trim();
    if (!name) { setCreateOfficeErr('أدخل اسم المكتب'); return; }
    setCreatingOffice(true); setCreateOfficeErr('');
    const sb = createClient();
    const uid = await currentUid(sb);
    if (!uid) { setCreateOfficeErr('انتهت جلستك — سجّل خروج ثم دخول من جديد.'); setCreatingOffice(false); return; }
    const { error } = await sb.from('offices').insert({ owner_id: uid, name, fal_license: newFal.trim() || null });
    if (error) { setCreateOfficeErr('تعذّر الإنشاء: ' + error.message); setCreatingOffice(false); return; }
    await sb.from('profiles').update({ role: 'office', full_name: name }).eq('id', uid);
    setNewOfficeName(''); setNewFal('');
    await reloadOffice();
    setCreatingOffice(false);
  };

  useEffect(() => { reloadOffice(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const activeCount = myListings.filter((l) => l.status === 'approved').length;
  const pendingCount = myListings.filter((l) => l.status === 'pending').length;

  const condMap: Record<string, string> = { 'جديد': 'new', 'حالة جيدة': 'good', 'يحتاج ترميم': 'old' };

  const publishListing = async () => {
    if (!fRent.trim()) { setPublishMsg({ ok: false, text: 'أدخل قيمة الإيجار السنوي.' }); return; }
    if (!fPhotos['facade']) { setPublishMsg({ ok: false, text: 'صورة الواجهة إلزامية — أضفها قبل النشر. بقية الصور اختيارية.' }); return; }
    setPublishing(true); setPublishMsg(null);
    try {
      if (!isSupabaseConfigured()) {
        setPublishMsg({ ok: false, text: 'الاتصال بقاعدة البيانات غير مُفعّل بعد.' }); setPublishing(false); return;
      }
      const sb = createClient();
      // ── ربط حقيقي + صلاحيات: النشر يتطلب مكتباً معتمداً ونشطاً ──
      if (!myOffice) {
        setPublishMsg({ ok: false, text: 'أنشئ مكتبك أولاً من لوحة المكتب لنشر إعلان.' }); setPublishing(false); return;
      }
      if (myOffice.status !== 'approved') {
        setPublishMsg({ ok: false, text: 'حسابك بانتظار موافقة الإدارة — لا يمكنك نشر إعلانات حتى يُعتمد مكتبك.' }); setPublishing(false); return;
      }
      if (!myOffice.active) {
        setPublishMsg({ ok: false, text: 'مكتبك موقوف حالياً من الإدارة — لا يمكنك النشر. تواصل مع الإدارة.' }); setPublishing(false); return;
      }
      // ── رفع الصور المصنّفة (الواجهة أولاً) — فشل رفع صورة لا يُفشل النشر ──
      const slots = photoSlots(parseInt(fRooms) || 1, parseInt(fBaths) || 1);
      const byCat: { facade: string | null; hall: string | null; majlis: string | null; kitchen: string | null; bedrooms: string[]; bathrooms: string[] } =
        { facade: null, hall: null, majlis: null, kitchen: null, bedrooms: [], bathrooms: [] };
      const urls: string[] = []; // مصفوفة مسطّحة متوافقة مع عمود images القديم (الواجهة أولاً)
      const photoFails: string[] = [];
      for (const s of slots) {
        const ph = fPhotos[s.key];
        if (!ph) continue;
        const ext = (ph.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${myOffice.id}/${Date.now()}_${s.key}.${ext}`;
        const { error: upErr } = await sb.storage.from('listings').upload(path, ph.file);
        if (upErr) { photoFails.push(s.label); continue; }
        const { data: pub } = sb.storage.from('listings').getPublicUrl(path);
        const u = pub?.publicUrl;
        if (!u) { photoFails.push(s.label); continue; }
        urls.push(u);
        if (s.key === 'facade') byCat.facade = u;
        else if (s.key === 'hall') byCat.hall = u;
        else if (s.key === 'majlis') byCat.majlis = u;
        else if (s.key === 'kitchen') byCat.kitchen = u;
        else if (s.key.startsWith('bed')) byCat.bedrooms.push(u);
        else if (s.key.startsWith('bath')) byCat.bathrooms.push(u);
      }
      // ── مستوى الثقة: المكتب الموثّق (verified) يُنشر مباشرة؛ غير الموثّق
      //    يدخل إعلانه «بانتظار الموافقة» ويُعتمد من الإدارة إعلاناً بإعلان.
      //    القاعدة تفرض القاعدة نفسها بـ trigger مهما أرسل العميل.
      const autoApproved = !!myOffice.verified;
      // بيانات الإعلان الأساسية — الرخصة تُسحب تلقائياً من سجل المكتب (لا إعادة إدخال)
      const core: Record<string, unknown> = {
        office_id: myOffice.id, status: autoApproved ? 'approved' : 'pending',
        title: `${fType} ${fRooms} غرف — ${fHood}`.replace('استوديو 1 غرف','استوديو'),
        hood: fHood, type: fType, advertised: parseInt(fRent) || 0,
        area: fArea ? parseInt(fArea) : null, rooms: parseInt(fRooms) || null,
        condition: condMap[fCond] || 'good', cond_label: fCond,
        fal_license: myOffice.fal_license || null,
      };
      // خصائص اختيارية ('' ⇒ null = غير محدّد) — أعمدتها تُضاف بـ supabase/listing_attributes.sql
      const attrs: Record<string, unknown> = {
        baths: parseInt(fBaths) || null,
        furnished: fFurniture === '' ? null : fFurniture === 'مفروشة',
        kitchen: fKitchen === '' ? null : fKitchen === 'راكب',
        ac: fAc === '' ? null : fAc === 'مكيّفة',
        parking: fParking === '' ? null : parseInt(fParking),
        description: fDesc.trim() || null, images: urls,
        images_by_category: byCat,
      };
      const payload: Record<string, unknown> = { ...core, ...attrs };
      const dropped: string[] = [];
      let { error } = await sb.from('listings').insert(payload);
      // عمود اختياري مفقود في القاعدة (PGRST204/42703) ⇒ أسقط ذلك العمود وحده
      // وأعد المحاولة، بدل إفشال النشر كله — يبقى الإعلان الأساسي محفوظاً.
      while (error && (error.code === 'PGRST204' || error.code === '42703' || /schema cache/i.test(error.message || ''))) {
        const col = /'([^']+)' column/.exec(error.message || '')?.[1];
        if (!col || !(col in attrs) || !(col in payload)) break;
        delete payload[col];
        dropped.push(col);
        ({ error } = await sb.from('listings').insert(payload));
      }
      if (error) { setPublishMsg({ ok: false, text: 'تعذّر النشر: ' + error.message }); setPublishing(false); return; }
      setPublishMsg({
        ok: true,
        text: (autoApproved
          ? 'تم نشر الإعلان — ظاهر الآن للباحثين مباشرة (مكتبك موثّق).'
          : 'تم إرسال الإعلان للمراجعة — يظهر للباحثين فور اعتماد الإدارة له.')
          + (photoFails.length ? ` (تعذّر رفع صور: ${photoFails.join('، ')})` : '')
          + (dropped.length ? ` (لم تُحفظ خصائص: ${dropped.join('، ')} — شغّل supabase/storage_listing_images.sql)` : ''),
      });
      setFRent(''); setFArea(''); setFDesc('');
      Object.values(fPhotos).forEach((p) => { if (p) URL.revokeObjectURL(p.preview); });
      setFPhotos({});
      setTimeout(() => { setPublishMsg(null); setAddStep(1); setOffPage('listings'); }, 1200);
    } catch {
      setPublishMsg({ ok: false, text: 'حدث خطأ غير متوقع أثناء النشر.' });
    }
    setPublishing(false);
  };


  const calcFair = () => {
    // السعر العادل = متوسط /admin للحي والنوع (mktAvg) معدّلاً بالمساحة. لا أرقام ثابتة.
    const base = fairForType(mktAvg[cHood], cType);
    const area = parseInt(cArea) || 130;
    return Math.round(base * (area / 130));
  };
  const calcMin = () => {
    const cost = parseInt(cCost)||0;
    const reno = parseInt(cReno)||0;
    return Math.round((cost+reno)*((parseFloat(cMargin)+parseFloat(cFee))/100));
  };
  const fair = calcFair();
  const minSafe = calcMin();
  const profit = fair - minSafe;

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const selectCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  // حالة اعتماد الإعلان (مربوطة بحقل status الحقيقي في القاعدة)
  const lsMeta: Record<string, { cls: string; label: string }> = {
    approved: { cls: 'bg-green-100 text-green-800 border border-green-200', label: 'معتمد' },
    rejected: { cls: 'bg-red-100 text-red-700 border border-red-200', label: 'مرفوض' },
    pending: { cls: 'bg-amber-100 text-amber-800 border border-amber-200', label: 'بانتظار الموافقة' },
  };

  const sideItems = [
    { id:'dashboard', label:'لوحة التحكم' },
    { id:'listings', label:'إعلاناتي' },
    { id:'add', label:'إضافة إعلان' },
    { id:'calc', label:'الحاسبة الذكية' },
    { id:'inquiries', label:'الاستفسارات' },
    { id:'profile', label:'ملف المكتب' },
    { id:'settings', label:'الإعدادات' },
  ];

  // حساب مسجّل لكن بلا مكتب مرتبط (باحث أو لم يُكمل تسجيل مكتب) ⇒ لا نعرض لوحة المكتب الوهمية
  if (offLoaded && !myOffice) {
    return (
      <div className="max-w-md mx-auto px-5 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
          <div className="text-lg font-bold text-gray-900 mb-1">أنشئ مكتبك العقاري</div>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">حسابك جاهز — أكمل بيانات مكتبك مرة واحدة وتُفعّل لوحة المكتب وتقدر تنشر إعلاناتك مباشرة.</p>
          <label className="text-xs text-gray-700 font-semibold block mb-1">اسم المكتب *</label>
          <input value={newOfficeName} onChange={(e) => setNewOfficeName(e.target.value)} placeholder="مثال: مكتب الأفق العقاري"
            className="w-full mb-3 px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <label className="text-xs text-gray-700 font-semibold block mb-1">رقم رخصة فال (اختياري)</label>
          <input value={newFal} onChange={(e) => setNewFal(e.target.value)} dir="ltr" placeholder="1100123456"
            className="w-full mb-4 px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          {createOfficeErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-3">{createOfficeErr}</div>}
          <button onClick={createOffice} disabled={creatingOffice}
            className="w-full bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50">
            {creatingOffice ? 'جارٍ الإنشاء…' : 'إنشاء المكتب'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-48 bg-white border-l border-gray-200 flex-shrink-0 py-4 px-3">
        <div className="text-xs text-gray-400 font-bold px-2 mb-2 tracking-wide">القائمة</div>
        {sideItems.map(s => (
          <button key={s.id} onClick={() => { setOffPage(s.id as typeof offPage); if(s.id==='add') setAddStep(1); }}
            className={`w-full text-right px-3 py-2.5 rounded-xl text-sm mb-1 font-medium transition-all ${offPage===s.id ? 'bg-blue-50 text-[#0A3D62] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
            {s.label}
            {s.id==='inquiries' && <span className="float-left bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">5</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 bg-[#F5F8FB] overflow-auto">

        {/* Dashboard */}
        {offPage === 'dashboard' && (
          <div>
            <div className="mb-5">
              <div className="text-xl font-bold text-gray-900 mb-1">مرحباً، {myOffice?.name || 'مكتبك'}</div>
              <div className="text-sm text-gray-500">{myOffice ? 'ملخص إعلاناتك' : 'لا يوجد مكتب مرتبط بحسابك — سجّل مكتبك من صفحة التسجيل.'}</div>
            </div>
            {myOffice && (
              <div className={`mb-5 rounded-xl p-4 border text-sm font-medium ${
                (myOffice.status === 'approved' && myOffice.active) ? 'bg-green-50 border-green-200 text-green-800'
                : myOffice.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-700'
                : !myOffice.active ? 'bg-gray-100 border-gray-300 text-gray-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                {(myOffice.status === 'approved' && myOffice.active)
                  ? '✅ مكتبك معتمد ونشط — تقدر تنشر إعلانات بلا حدود.'
                  : myOffice.status === 'rejected'
                  ? '⛔ تم رفض حسابك من الإدارة — تواصل معها.'
                  : !myOffice.active
                  ? '⏸️ مكتبك موقوف حالياً من الإدارة — لا يمكنك النشر.'
                  : '⏳ حسابك بانتظار موافقة الإدارة — لا يمكنك نشر إعلانات حتى الاعتماد.'}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label:'إعلانات معتمدة', val:String(activeCount), trend:'ظاهرة للعامة', color:'text-green-600' },
                { label:'بانتظار الموافقة', val:String(pendingCount), trend:pendingCount? 'قيد المراجعة':'لا جديد', color:'text-orange-600' },
                { label:'إجمالي إعلاناتي', val:String(myListings.length), trend:'كل الحالات', color:'text-[#0A3D62]' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="text-xs text-gray-500 mb-2 font-medium">{s.label}</div>
                  <div className="text-2xl font-bold text-[#0A3D62]">{s.val}</div>
                  <div className={`text-xs mt-1 font-medium ${s.color}`}>{s.trend}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => { setOffPage('add'); setAddStep(1); }}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white rounded-xl p-4 text-center shadow-md hover:opacity-95 transition-all">
                <div className="text-lg font-bold mb-1">إعلان جديد</div>
                <div className="text-xs opacity-80">أضف عقار للنشر</div>
              </button>
              <button onClick={() => setOffPage('calc')}
                className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm hover:border-blue-300 transition-all">
                <div className="text-lg font-bold text-gray-900 mb-1">الحاسبة</div>
                <div className="text-xs text-gray-500">احسب السعر العادل</div>
              </button>
              <button onClick={() => setOffPage('inquiries')}
                className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm hover:border-blue-300 transition-all">
                <div className="text-lg font-bold text-gray-900 mb-1">الردود</div>
                <div className="text-xs text-gray-500">{myLeads.length > 0 ? `${myLeads.length.toLocaleString('ar-SA')} استفسار وصلك` : 'لا استفسارات بعد'}</div>
              </button>
            </div>
          </div>
        )}

        {/* Listings */}
        {offPage === 'listings' && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div>
                <div className="text-xl font-bold text-gray-900 mb-1">إعلاناتي</div>
                <div className="text-sm text-gray-500">{activeCount} معتمد · {pendingCount} بانتظار الموافقة · {myListings.length} الإجمالي</div>
              </div>
              <button onClick={() => { setOffPage('add'); setAddStep(1); }}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-4 py-2 rounded-xl font-bold text-sm shadow">
                + إعلان جديد
              </button>
            </div>
            {myListings.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                {myOffice ? 'لا توجد إعلانات بعد — أضف أول إعلان لمكتبك.' : 'سجّل مكتبك أولاً من صفحة «التسجيل» لتتمكن من نشر الإعلانات.'}
              </div>
            ) : (
            <div className="space-y-3">
              {myListings.map(l => {
                const m = lsMeta[l.status] ?? lsMeta.pending;
                return (
                <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 mb-1 truncate">{l.title}</div>
                      <div className="text-sm text-gray-600">{l.advertised.toLocaleString('ar-SA')} ريال/سنة</div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-xl font-bold whitespace-nowrap ${m.cls}`}>{m.label}</span>
                  </div>
                  {l.status === 'rejected' && l.rejection_note && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-red-700 bg-red-50 rounded-lg p-2.5">
                      <strong>ملاحظات الإدارة:</strong> {l.rejection_note}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* Add Listing */}
        {offPage === 'add' && (
          (!myOffice || myOffice.status !== 'approved' || !myOffice.active) ? (
            <div className="max-w-md mx-auto py-12 text-center">
              <div className="bg-white rounded-2xl border border-amber-200 p-7 shadow-sm">
                <div className="text-lg font-bold text-amber-700 mb-2">{myOffice?.status === 'rejected' ? 'تم رفض حسابك' : (myOffice && !myOffice.active) ? 'مكتبك موقوف حالياً' : 'حسابك بانتظار موافقة الإدارة'}</div>
                <p className="text-sm text-gray-500 leading-relaxed">{myOffice?.status === 'rejected' ? 'تواصل مع الإدارة لمعرفة السبب.' : (myOffice && !myOffice.active) ? 'الإدارة أوقفت مكتبك مؤقتاً — تواصل معها لإعادة التفعيل.' : 'لا يمكنك نشر إعلانات حتى تعتمد الإدارة مكتبك. بنراجعك ونعتمدك قريباً، وبعدها تنشر إعلاناتك بلا حدود.'}</p>
              </div>
            </div>
          ) : (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-1">إضافة إعلان جديد</div>
            <div className="text-sm text-gray-500 mb-1">أضف بيانات عقارك بدقة لضمان أفضل ظهور</div>
            {/* الربط التلقائي: الإعلان يحمل اسم المكتب ورخصته من سجلّه — لا إعادة إدخال */}
            <div className="text-xs text-[#1B6CA8] mb-5">
              يُربط الإعلان تلقائياً بمكتبك: <b>{myOffice?.name}</b>
              {myOffice?.fal_license && <> · رخصة فال <span dir="ltr">{myOffice.fal_license}</span></>}
            </div>

            {/* Steps */}
            <div className="flex items-center gap-2 mb-5 bg-white rounded-xl p-3 border border-gray-200">
              {[
                { n:1, label:'بيانات العقار' },
                { n:2, label:'الحاسبة (اختياري)' },
                { n:3, label:'الصور والوصف' },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${addStep > s.n ? 'bg-green-500 text-white' : addStep === s.n ? 'bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {addStep > s.n ? '✓' : s.n}
                  </div>
                  <div className={`text-xs font-medium ${addStep === s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</div>
                  {i < 2 && <div className={`flex-1 h-0.5 ${addStep > s.n ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Property Data */}
            {addStep === 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="font-bold text-gray-900 mb-4">بيانات العقار</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">نوع العقار</label>
                    <select className={selectCls} value={fType} onChange={e=>setFType(e.target.value)}><option>شقة</option><option>فيلا</option><option>دور</option><option>دوبلكس</option><option>استوديو</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحي</label>
                    <select className={selectCls} value={fHood} onChange={e=>setFHood(e.target.value)}><option>النرجس</option><option>العليا</option><option>الملقا</option><option>حطين</option><option>الياسمين</option><option>القيروان</option><option>النخيل</option><option>إشبيلية</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الإيجار السنوي (ريال)</label>
                    <input type="number" value={fRent} onChange={e=>setFRent(e.target.value)} placeholder="65000" className={inputCls} /></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">المساحة م²</label>
                    <input type="number" value={fArea} onChange={e=>setFArea(e.target.value)} placeholder="120" className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الغرف</label>
                    <select className={selectCls} value={fRooms} onChange={e=>setFRooms(e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">دورات المياه</label>
                    <select className={selectCls} value={fBaths} onChange={e=>setFBaths(e.target.value)}><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحالة</label>
                    <select className={selectCls} value={fCond} onChange={e=>setFCond(e.target.value)}><option>جديد</option><option>حالة جيدة</option><option>يحتاج ترميم</option></select></div>
                </div>
                {/* خصائص منظّمة اختيارية — تصبح معايير بحث يستخدمها المساعد الذكي */}
                <div className="text-xs text-gray-500 mb-2">خصائص إضافية (اختيارية) — تساعد المساعد الذكي على مطابقة طلب الباحث بدقّة:</div>
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الأثاث</label>
                    <select className={selectCls} value={fFurniture} onChange={e=>setFFurniture(e.target.value)}><option value="">غير محدّد</option><option value="مفروشة">مفروشة</option><option value="غير مفروشة">غير مفروشة</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">المطبخ</label>
                    <select className={selectCls} value={fKitchen} onChange={e=>setFKitchen(e.target.value)}><option value="">غير محدّد</option><option value="راكب">راكب</option><option value="غير راكب">غير راكب</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">المكيفات</label>
                    <select className={selectCls} value={fAc} onChange={e=>setFAc(e.target.value)}><option value="">غير محدّد</option><option value="مكيّفة">مكيّفة</option><option value="غير مكيّفة">غير مكيّفة</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">المواقف</label>
                    <select className={selectCls} value={fParking} onChange={e=>setFParking(e.target.value)}><option value="">غير محدّد</option><option value="0">لا يوجد</option><option value="1">موقف واحد</option><option value="2">موقفان</option><option value="3">ثلاثة فأكثر</option></select></div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setAddStep(2)} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">التالي: الحاسبة</button>
                  <button onClick={() => setAddStep(3)} className="bg-white border border-dashed border-gray-300 text-gray-500 px-5 py-2.5 rounded-xl font-medium text-sm hover:border-gray-400 transition-all">تخطي الحاسبة</button>
                </div>
              </div>
            )}

            {/* Step 2: Calculator */}
            {addStep === 2 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="font-bold text-gray-900 mb-1">الحاسبة الذكية</div>
                <div className="text-sm text-gray-500 mb-4">احسب السعر العادل والربح المتوقع (اختياري)</div>
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحي</label>
                      <select value={cHood} onChange={e => setCHood(e.target.value)} className={selectCls}>
                        {Object.keys(mktAvg).map((h) => <option key={h} value={h}>{h}</option>)}
                      </select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">النوع</label>
                        <select value={cType} onChange={e => setCType(e.target.value)} className={selectCls}>
                          <option value="شقة">شقة</option><option value="فيلا">فيلا</option><option value="استوديو">استوديو</option><option value="دور">دور</option><option value="دوبلكس">دوبلكس</option>
                        </select></div>
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">المساحة م²</label>
                        <input type="number" value={cArea} onChange={e => setCArea(e.target.value)} className={inputCls} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">تكلفة العقار</label>
                        <input type="number" value={cCost} onChange={e => setCCost(e.target.value)} className={inputCls} /></div>
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">تكاليف التشطيب</label>
                        <input type="number" value={cReno} onChange={e => setCReno(e.target.value)} className={inputCls} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">نسبة الإيراد %</label>
                        <input type="number" value={cMargin} onChange={e => setCMargin(e.target.value)} className={inputCls} /></div>
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">عمولتك %</label>
                        <input type="number" value={cFee} onChange={e => setCFee(e.target.value)} className={inputCls} /></div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-4">
                    <div className="text-sm font-bold text-gray-700 mb-3">النتيجة الذكية</div>
                    <div className="space-y-2">
                      {[
                        { label:'السعر العادل', val:`${fair.toLocaleString('ar-SA')} ريال`, color:'text-[#0A3D62]', big:true },
                        { label:'السعر التنافسي (-5%)', val:`${Math.round(fair*0.95).toLocaleString('ar-SA')} ريال`, color:'text-gray-700' },
                        { label:'الحد الأدنى الآمن', val:`${minSafe.toLocaleString('ar-SA')} ريال`, color:'text-orange-600' },
                        { label:'ربحك المتوقع', val:`${profit > 0 ? '+' : ''}${profit.toLocaleString('ar-SA')} ريال`, color: profit > 0 ? 'text-green-600' : 'text-red-600', big:true },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between items-center py-2 border-b border-blue-100 last:border-0">
                          <span className="text-xs text-gray-500">{r.label}</span>
                          <span className={`font-bold text-sm ${r.color} ${r.big ? 'text-base' : ''}`}>{r.val}</span>
                        </div>
                      ))}
                    </div>
                    <div className={`mt-3 p-3 rounded-xl text-xs leading-relaxed ${profit < 0 ? 'bg-red-50 text-red-700 border border-red-200' : profit/fair < 0.1 ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
                      {profit < 0 ? 'تحذير: ربحك سلبي — راجع التكاليف أو ارفع السعر' : profit/fair < 0.1 ? 'هامش الربح ضيق — أنصح بتثبيت السعر العادل' : 'السوق نشط — تقدر تثبت السعر العادل بثقة'}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setAddStep(1)} className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium text-sm">السابق</button>
                  <button onClick={() => setAddStep(3)} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">التالي: الصور</button>
                </div>
              </div>
            )}

            {/* Step 3: Images & Description */}
            {addStep === 3 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="font-bold text-gray-900 mb-1">صور الوحدة حسب الغرفة</div>
                <div className="text-sm text-gray-500 mb-4">
                  صورة الواجهة إلزامية؛ البقية اختيارية لكنها ترفع فرص تواصل الباحثين.
                  خانات غرف النوم والحمامات تتبع ما اخترته في «بيانات العقار» ({fRooms} غرف · {fBaths} دورات مياه).
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {photoSlots(parseInt(fRooms) || 1, parseInt(fBaths) || 1).map((s) => {
                    const ph = fPhotos[s.key];
                    return (
                      <label key={s.key}
                        className={`border-2 border-dashed rounded-xl p-2 text-center cursor-pointer transition-all min-h-[110px] flex flex-col items-center justify-center gap-1 ${ph ? 'border-green-400 bg-green-50/40' : s.req ? 'border-[#1B6CA8]/60 hover:border-[#1B6CA8] bg-blue-50/30' : 'border-gray-300 hover:border-gray-400'}`}>
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => setPhoto(s.key, e.target.files?.[0] ?? null)} />
                        {ph ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ph.preview} alt={s.label} className="w-full h-16 object-cover rounded-lg" />
                        ) : (
                          <span className="text-gray-400 text-2xl leading-none">+</span>
                        )}
                        <span className="text-xs font-semibold text-gray-700">
                          {s.label}{s.req && <span className="text-red-500"> *</span>}
                        </span>
                        {ph && <span className="text-[10px] text-green-700 truncate max-w-full px-1">{ph.file.name}</span>}
                      </label>
                    );
                  })}
                </div>
                <textarea value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="وصف العقار..." rows={4} className={inputCls + ' resize-none'} />
                {publishMsg && (
                  <div className={`mt-3 text-sm rounded-xl p-3 border ${publishMsg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{publishMsg.text}</div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setAddStep(2)} className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium text-sm">السابق</button>
                  <button onClick={publishListing} disabled={publishing} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50">{publishing ? 'جارٍ النشر…' : 'نشر الإعلان'}</button>
                </div>
              </div>
            )}
          </div>
          )
        )}

        {/* Calculator */}
        {offPage === 'calc' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-1">الحاسبة الذكية</div>
            <div className="text-sm text-gray-500 mb-5">احسب السعر العادل والربح المتوقع لأي عقار</div>
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحي</label>
                    <select value={cHood} onChange={e => setCHood(e.target.value)} className={selectCls}>
                      {Object.keys(mktAvg).map((h) => <option key={h} value={h}>{h}</option>)}
                    </select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">نوع العقار</label>
                    <select value={cType} onChange={e => setCType(e.target.value)} className={selectCls}>
                      <option value="شقة">شقة</option><option value="فيلا">فيلا</option><option value="استوديو">استوديو</option><option value="دور">دور</option><option value="دوبلكس">دوبلكس</option>
                    </select></div>
                </div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">المساحة م²</label>
                  <input type="number" value={cArea} onChange={e => setCArea(e.target.value)} className={inputCls} /></div>
                <div className="pt-2 border-t border-gray-100 text-xs font-bold text-gray-700">التكاليف (للربحية)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">تكلفة العقار</label>
                    <input type="number" value={cCost} onChange={e => setCCost(e.target.value)} className={inputCls} /></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">تكاليف التشطيب</label>
                    <input type="number" value={cReno} onChange={e => setCReno(e.target.value)} className={inputCls} /></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">نسبة الإيراد %</label>
                    <input type="number" value={cMargin} onChange={e => setCMargin(e.target.value)} className={inputCls} /></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">عمولتك %</label>
                    <input type="number" value={cFee} onChange={e => setCFee(e.target.value)} className={inputCls} /></div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-5 shadow-sm">
                <div className="font-bold text-gray-800 mb-4">النتيجة</div>
                <div className="space-y-3">
                  {[
                    { label:'السعر العادل في السوق', val:`${fair.toLocaleString('ar-SA')} ريال`, color:'text-[#0A3D62]', big:true },
                    { label:'السعر التنافسي (-5%)', val:`${Math.round(fair*0.95).toLocaleString('ar-SA')} ريال`, color:'text-gray-700' },
                    { label:'الحد الأدنى الآمن', val:`${minSafe.toLocaleString('ar-SA')} ريال`, color:'text-orange-600' },
                    { label:'الربح المتوقع سنوياً', val:`${profit > 0 ? '+' : ''}${profit.toLocaleString('ar-SA')} ريال`, color: profit > 0 ? 'text-green-600' : 'text-red-600', big:true },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between items-center py-2.5 border-b border-blue-100 last:border-0">
                      <span className="text-sm text-gray-500">{r.label}</span>
                      <span className={`font-bold ${r.color} ${r.big ? 'text-lg' : 'text-sm'}`}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div className={`mt-4 p-3 rounded-xl text-sm leading-relaxed ${profit < 0 ? 'bg-red-50 text-red-700 border border-red-200' : profit/fair < 0.1 ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
                  <strong>نصيحة: </strong>
                  {profit < 0 ? 'ربحك سلبي — راجع التكاليف أو ارفع السعر' : profit/fair < 0.1 ? 'هامش الربح ضيق — أنصح بتثبيت السعر العادل' : 'السوق نشط — تقدر تثبت السعر العادل بثقة'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inquiries */}
        {offPage === 'inquiries' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-1">الاستفسارات</div>
            <div className="text-sm text-gray-500 mb-5">{myLeads.length > 0 ? `${myLeads.length.toLocaleString('ar-SA')} استفسار وصلك` : 'استفسارات الباحثين على إعلاناتك تظهر هنا'}</div>
            {myLeads.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-gray-400 text-sm">لا توجد استفسارات بعد. عندما يتواصل باحث بخصوص أحد إعلاناتك، يظهر طلبه هنا مباشرة.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {myLeads.map((inq) => {
                  const t = new Date(inq.created_at);
                  const when = isNaN(t.getTime()) ? '' : t.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
                  return (
                    <div key={inq.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 flex-shrink-0">
                          {(inq.name || '؟').slice(0,1)}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <div className="font-bold text-sm text-gray-900">{inq.name || 'باحث'}</div>
                            <div className="text-xs text-gray-400">{when}</div>
                          </div>
                          <a href={`tel:${inq.phone}`} className="text-xs text-blue-600 font-medium mb-1 inline-block" dir="ltr">{inq.phone}</a>
                          {inq.message && <div className="text-sm text-gray-600 whitespace-pre-line mt-1">{inq.message}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Profile */}
        {offPage === 'profile' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-5">ملف المكتب</div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] flex items-center justify-center text-white text-2xl font-bold">{(myOffice?.name || 'م').slice(0, 1)}</div>
                <div>
                  <div className="font-bold text-lg text-gray-900">{myOffice?.name || '— لا يوجد مكتب مرتبط —'}</div>
                  <div className="flex gap-2 mt-1">
                    {myOffice?.verified
                      ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-lg border border-green-200 font-medium">موثّق بفال ✓</span>
                      : <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-lg border border-amber-200 font-medium">غير موثّق بعد</span>}
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-lg border border-gray-200">الرياض</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">اسم المكتب</label>
                  <input key={myOffice?.id || 'noffice'} defaultValue={myOffice?.name || ''} placeholder="اسم المكتب" className={inputCls} /></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">رقم رخصة فال</label>
                  <input key={(myOffice?.id || 'noffice') + '-fal'} defaultValue={myOffice?.fal_license || ''} disabled className={`${inputCls} bg-gray-50 text-gray-400`} /></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">رقم الجوال</label>
                  <input placeholder="05xxxxxxxx" className={inputCls} /></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">البريد الإلكتروني</label>
                  <input placeholder="name@example.com" className={inputCls} /></div>
              </div>
              <div className="mb-4"><label className="text-xs text-gray-700 font-semibold block mb-1">نبذة عن المكتب</label>
                <textarea rows={3} placeholder="نبذة مختصرة عن مكتبك وخدماته…" className={`${inputCls} resize-none`} /></div>
              <div className="text-xs text-gray-400">بيانات المكتب الأساسية (الاسم والرخصة) مرتبطة بحسابك في القاعدة.</div>
            </div>
          </div>
        )}

        {/* Settings */}
        {offPage === 'settings' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-5">الإعدادات</div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
              <div className="font-bold text-gray-900 mb-4">الإشعارات</div>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">إشعارات الاستفسارات</label>
                  <select className={selectCls}><option>فورياً</option><option>كل ساعة</option><option>يومياً</option><option>إيقاف</option></select></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">تقارير الإحصائيات</label>
                  <select className={selectCls}><option>أسبوعياً</option><option>شهرياً</option><option>إيقاف</option></select></div>
              </div>
            </div>
            <div className="bg-gradient-to-l from-green-600 to-green-500 rounded-xl p-5 text-white">
              <div className="text-sm opacity-85 mb-1">الباقة الحالية</div>
              <div className="text-2xl font-bold mb-1">الأساسية</div>
              <div className="text-sm opacity-85">مجاناً لفترة محدودة</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
