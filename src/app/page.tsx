'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import dynamic from 'next/dynamic';
import { useAppData, type UIListing, type MktAvg, type ImagesByCategory } from '@/lib/useAppData';
import { useAuth } from '@/lib/useAuth';
import { useLang } from '@/lib/i18n';
import { track, trackPageView, trackSearchWish } from '@/lib/track';
import { useEffect } from 'react';
import { SiteHeader, SiteFooter } from './components/SiteChrome';
import ContactButtons, { isSaudiMobile, waNumber, telNumber } from './components/ContactButtons';
import ReplyComposer from './components/ReplyComposer';
import { parseMapsUrl, isMapsUrl, mapsHref } from '@/lib/mapsLocation';
const MapComponent = dynamic(() => import('./components/Map'), { ssr: false });
// منتقي موقع الوحدة في نموذج المكتب (Leaflet — عميل فقط مثل الخريطة الرئيسية)
const LocationPicker = dynamic(() => import('./components/Map').then((m) => m.LocationPicker), { ssr: false });

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
  pin: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>),
};

// أيقونات Material Symbols Outlined للصفحة الرئيسية (نفس مجموعة تصميم Stitch).
// الخط يُحمَّل في layout.tsx؛ الحجم/اللون عبر CSS في .stitch-home حسب السياق.
const msi = (name: string) => <span className="material-symbols-outlined">{name}</span>;

// خلفية البطل: صورة ثابتة لحيّ سكني راقٍ (ليست من إعلانات قاعدة البيانات أبداً).
// أصل تصميم خارجي؛ يمكن استبداله بصورة الرياض مستضافة محلياً لاحقاً.
const HERO_IMG = '/hero-riyadh.png';

// رابط فتح موقع الوحدة في خرائط Google (إحداثيات إن وُجدت وإلا الرابط المخزّن)
const listingMapsHref = (l: UIListing): string | null => mapsHref(l.lat, l.lng, l.maps_url);

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

// ★ مصدر واحد لحساب مؤشر أسعار الحي من متوسط الحي (مأخوذ من جدول neighborhoods عبر /admin).
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

// ── تحليل معايير المساعد الذكي من نص الطلب (محلّي بالكامل، بلا أي API) ──
// أنواع الوحدات المعروفة. «بيت/منزل/سكن» كلمات عامة وليست نوعاً محدّداً ⇒ لا تُعدّ فلتراً.
const AI_TYPES = ['شقة', 'فيلا', 'دوبلكس', 'استوديو', 'دور'];

// تحويل الأرقام العربية/الفارسية إلى لاتينية حتى نتعرّف على الميزانية المكتوبة عربياً.
function toAsciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

// النوع: أول نوع معروف يُذكر صراحةً (فلتر صارم).
function parseAiType(q: string): string | null {
  return AI_TYPES.find((t) => q.includes(t)) ?? null;
}

// ── القطاع التجاري: الأنواع + المساعدات (إضافة بنيوية بجانب السكني) ──
const COMMERCIAL_TYPES = [
  { key: 'shop', label: 'محل', icon: 'storefront' },
  { key: 'office', label: 'مكتب', icon: 'business_center' },
  { key: 'showroom', label: 'معرض', icon: 'storefront' },
] as const;
// أنواع البحث السكنية في الفلتر (تبقى كما هي تماماً)
const RESIDENTIAL_FILTER_TYPES = ['شقة', 'فيلا', 'دور', 'استوديو'];
// تسمية عربية للنوع التجاري من مفتاحه (shop→محل …)
const commLabel = (k?: string | null): string => COMMERCIAL_TYPES.find((c) => c.key === k)?.label ?? (k ?? '');

// كشف نيّة تجارية في طلب المساعد الذكي (محلّي بالكامل). يرجع نوعاً تجارياً محدّداً،
// أو 'any' لنيّة تجارية عامة، أو null (سكني افتراضي). «مكتب» وحده مُبهَم فلا يُعدّ تجارياً.
function parseAiCommercial(q: string): string | null {
  if (/مكتب تجاري|مكاتب تجارية/.test(q)) return 'office';
  if (/(محل|محلات)/.test(q)) return 'shop';
  if (/(معرض|معارض|صالة عرض)/.test(q)) return 'showroom';
  if (/(تجاري|تجارية|تجاريّة)/.test(q)) return 'any';
  return null;
}

// الحي: أطول اسم حي مطابق أولاً (حتى يفوز «الملك عبدالله» على أي جزء أقصر) — فلتر صارم.
function parseAiHood(q: string, hoods: string[]): string | null {
  const sorted = [...hoods].sort((a, b) => b.length - a.length);
  return sorted.find((h) => h && q.includes(h)) ?? null;
}

// كل الأحياء المذكورة في الطلب (للمقارنة «قارن X وY») — الأطول أولاً، ونمسح المطابَق من
// نسخة العمل حتى لا يتكرّر اسم قصير كجزء من اسم أطول.
function parseAiHoodsAll(q: string, hoods: string[]): string[] {
  const sorted = [...hoods].sort((a, b) => b.length - a.length);
  let work = q;
  const found: string[] = [];
  for (const h of sorted) {
    if (h && work.includes(h)) { found.push(h); work = work.split(h).join(' '); }
  }
  return found;
}

// السقف السعري: نتعرّف على رقم ميزانية صريح فقط (مع «ألف» أو رقم كبير) فلا نخلط
// «3 غرف» بسعر. «أرخص/رخيص» نيّة ترتيب لا سقفاً (تُعالَج في الترتيب لا كفلتر).
function parseAiMaxPrice(qRaw: string): number | null {
  const q = toAsciiDigits(qRaw);
  const re = /(\d[\d,\.]*)\s*(ألف|الف|آلاف|k)?/g;
  let best: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    let n = parseInt(m[1].replace(/[,\.]/g, ''), 10);
    if (Number.isNaN(n)) continue;
    if (m[2]) n = n < 1000 ? n * 1000 : n; // «50 ألف» ⇒ 50000
    else if (n < 10000) continue; // رقم صغير بلا «ألف» ⇒ غالباً غرف/حمامات لا سعر
    if (best === null || n > best) best = n; // أعلى سقف مذكور = حدّ الميزانية
  }
  return best;
}

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

// خانات صور الإعلان التجاري: الواجهة (إلزامية) + لقطات داخلية عامة + مرافق.
// لا تصنيف غرف (لا غرف نوم/مجلس) — تُحفظ مسطّحة في images والمعرض يعرضها بمسمّيات عامة.
function commercialPhotoSlots(): PhotoSlot[] {
  return [
    { key: 'facade', label: 'الواجهة', req: true },
    { key: 'c1', label: 'من الداخل ١' },
    { key: 'c2', label: 'من الداخل ٢' },
    { key: 'c3', label: 'من الداخل ٣' },
    { key: 'c4', label: 'دورة المياه / المرافق' },
  ];
}

// مقياس نصف دائري لـ«مؤشر الحي»: الإبرة تعكس نسبة السعر المُعلن إلى متوسط الحي الحقيقي.
// ثلاث مناطق: فرصة (أخضر، أقل من المتوسط) ← مناسب (أزرق) ← مرتفع (برتقالي، أعلى من المتوسط).
// لا رقم/نسبة مُفبركة — موضع الإبرة مشتقّ من أرقام حقيقية فقط (adv ÷ fair).
function PriceGauge({ ratio, color }: { ratio: number; color: string }) {
  const t = Math.max(0, Math.min(1, (ratio - 0.7) / 0.6)); // 0.7×المتوسط → يسار، 1.3× → يمين
  const deg = 180 - t * 180;
  const polar = (r: number, d: number): [number, number] => {
    const a = (d * Math.PI) / 180;
    return [100 + r * Math.cos(a), 100 - r * Math.sin(a)];
  };
  const arc = (r: number, s: number, e: number) => {
    const [x1, y1] = polar(r, s);
    const [x2, y2] = polar(r, e);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const [nx, ny] = polar(70, deg);
  return (
    <svg viewBox="0 0 200 118" className="ld-gauge-svg" role="img" aria-hidden="true">
      <path d={arc(80, 180, 136)} stroke="#10B981" strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d={arc(80, 133, 57)} stroke="#3B82F6" strokeWidth="13" fill="none" />
      <path d={arc(80, 54, 0)} stroke="#F59E0B" strokeWidth="13" fill="none" strokeLinecap="round" />
      <line x1="100" y1="100" x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="100" r="8" fill={color} />
      <circle cx="100" cy="100" r="3.5" fill="#fff" />
    </svg>
  );
}

// أيقونة منزل بديلة عند غياب صورة الإعلان
const HousePlaceholder = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-9 h-9">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" />
  </svg>
);

// وجهات الصفحة الواحدة الصالحة كـ hash-route (لعناوين قابلة للمشاركة + حارس قيمة)
const PAGES = ['home', 'search', 'indicator', 'finance', 'inquiries', 'pricing', 'office', 'privacy', 'terms', 'about'] as const;
type PageId = typeof PAGES[number];
const isPageId = (s: string): s is PageId => (PAGES as readonly string[]).includes(s);

export default function Home() {
  const [page, setPage] = useState<PageId>('home');
  // المساعد الذكي — منطق محلّي بالكلمات المفتاحية (بدون أي استدعاء API)
  const [aiQuery, setAiQuery] = useState('');
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiMatchIds, setAiMatchIds] = useState<(string | number)[]>([]);
  // نتيجة المساعد الذكي: إمّا قائمة معرّفات مطابقة مرتّبة، أو «لا تطابق» مع المعايير
  // الصريحة (حي/نوع/سقف) — تُغذّي العرض الصادق وزر تسجيل الطلب وتسجيل الرغبة.
  // صف إجابة سوق: حي + تسمية النوع + القيمة (متوسط) + عدد الصفقات + وحدة القياس
  type MarketRow = { hood: string; typeLabel: string; value: number | null; sampleSize: number | null; unit: 'perYear' | 'perM2' };
  type AiResult =
    | { kind: 'matches'; ids: (string | number)[] }
    | { kind: 'none'; hood: string | null; type: string | null; maxPrice: number | null; raw: string }
    | { kind: 'market'; mode: 'single' | 'compare'; sector: 'residential' | 'commercial'; rows: MarketRow[] }
    | null;
  const [aiResult, setAiResult] = useState<AiResult>(null);
  const [aiShowAlts, setAiShowAlts] = useState(false); // كشف «الخيارات الأخرى المتاحة» في حال لا تطابق
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
  // بيانات المكتب المعلِن للإعلان المفتوح (حقيقية من جدول offices عبر office_id)
  const [selectedOffice, setSelectedOffice] = useState<{ name: string; fal_license: string | null; verified: boolean; phone: string | null } | null>(null);
  // معرض الصور بملء الشاشة (lightbox): قائمة كل صور الوحدة بالترتيب + المؤشر الحالي.
  const [lightbox, setLightbox] = useState<{ shots: { label: string; url: string }[]; idx: number } | null>(null);
  const lbTouch = useRef<number | null>(null); // نقطة بدء اللمس لاكتشاف السحب (swipe)
  // الصورة الرئيسية المعروضة في معرض بطاقة التفاصيل (فهرس داخل shots) — تُصفَّر عند فتح إعلان جديد
  const [detailShot, setDetailShot] = useState(0);
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
  const [siSector, setSiSector] = useState<'residential' | 'commercial'>('residential'); // قطاع المؤشر العام
  const [siCommType, setSiCommType] = useState<'shop' | 'office' | 'showroom'>('shop'); // النوع التجاري في المؤشر العام
  const [siPrice, setSiPrice] = useState('');
  // القطاع المختار في التصفّح/البحث: سكني (افتراضي) | تجاري — التبديل الأساسي
  const [filterSector, setFilterSector] = useState<'residential' | 'commercial'>('residential');
  const [filterHood, setFilterHood] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [searched, setSearched] = useState(false);

  // البيانات الحقيقية من قاعدة البيانات (المتوسطات لها قيم افتراضية؛ الإعلانات لا)
  const { mktAvg, listings, commIndex } = useAppData(DEFAULT_MKT_AVG, NO_LISTINGS);

  // تسجيل الدخول — بالإيميل وكلمة المرور (تبويب: دخول / إنشاء حساب)
  const { user, isAdmin, signInWithPassword, signUpWithPassword, requestPasswordReset, signOut, confirmSession } = useAuth();

  // اللغة/الاتجاه (i18n) — عربي افتراضي (RTL)، إنجليزي اختياري (LTR)
  const { t, dir, lang } = useLang();
  // تنسيق رقمي يتبع اللغة: أرقام عربية-هندية بالعربي، لاتينية بالإنجليزي (تجنّب chrome نصف-عربي)
  const nf = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA');
  // تسمية النوع التجاري حسب اللغة (الإنجليزية من قاموس commType.*)
  const commT = (k?: string | null) => (lang === 'en' ? t(`commType.${k || 'shop'}`) : commLabel(k));
  // حكم مؤشر الحي مُترجَماً (مرتفع/مناسب/فرصة)
  const verdictT = (st: string) => (st === 'hi' ? t('verdict.high') : st === 'lo' ? t('verdict.opp') : t('verdict.fair'));

  // هل الحساب الحالي يملك مكتباً؟ ⇒ زر «لوحة المكتب» الذهبي في الدرج
  const [hasOffice, setHasOffice] = useState(false);
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) { setHasOffice(false); return; }
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb.from('offices').select('id').eq('owner_id', user.id).limit(1);
      if (!cancelled) setHasOffice(!!(data && data.length));
    })();
    return () => { cancelled = true; };
  }, [user]);

  // عند فتح تفاصيل إعلان: جلب بيانات مكتبه المعلِن (اسم/رخصة/توثيق) من offices عبر
  // office_id — قراءة عامة (سياسة offices_read)، وبيانات حقيقية فقط؛ ما لا يوجد يُخفى.
  useEffect(() => {
    const oid = selectedListing?.office_id;
    if (!oid || !isSupabaseConfigured()) { setSelectedOffice(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        // نحاول قراءة رقم الجوال (offices.phone — بعد add_office_phone.sql) لتفعيل أزرار
        // الاتصال/واتساب؛ وإن لم يوجد العمود بعد نرجع للأعمدة الأساسية فلا تنكسر القراءة.
        let res = await sb.from('offices').select('name, fal_license, verified, phone').eq('id', oid).single();
        if (res.error) res = await sb.from('offices').select('name, fal_license, verified').eq('id', oid).single();
        if (cancelled) return;
        const d = res.data as { name?: string; fal_license?: string | null; verified?: boolean; phone?: string | null } | null;
        setSelectedOffice(d ? { name: d.name ?? '', fal_license: d.fal_license ?? null, verified: !!d.verified, phone: d.phone ?? null } : null);
      } catch { if (!cancelled) setSelectedOffice(null); }
    })();
    return () => { cancelled = true; };
  }, [selectedListing?.office_id]);

  // تنقّل المعرض (دائري مع لفّ عند الأطراف) — dir: ‎+1‎ التالي، ‎-1‎ السابق.
  const lbGo = (dir: number) =>
    setLightbox((lb) => (lb ? { ...lb, idx: (lb.idx + dir + lb.shots.length) % lb.shots.length } : lb));

  // مفاتيح المعرض: Esc يغلق، الأسهم تتنقّل (RTL: يسار=التالي، يمين=السابق).
  const lbOpen = !!lightbox;
  useEffect(() => {
    if (!lbOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowLeft') lbGo(1);
      else if (e.key === 'ArrowRight') lbGo(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lbOpen]);
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
  const [authPhone, setAuthPhone] = useState(''); // جوال المكتب (إلزامي عند تسجيل مكتب)
  const [authSeekerName, setAuthSeekerName] = useState('');
  // «نسيت كلمة المرور؟» — نموذج مصغّر يطلب البريد ويرسل رابط الاسترداد (يشارك authEmail/authMsg)
  const [forgotOpen, setForgotOpen] = useState(false);

  const submitForgot = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthMsg(null);
    const r = await requestPasswordReset(authEmail.trim());
    setAuthMsg({ ok: r.ok, text: r.message });
    setAuthBusy(false);
  };

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
      // جوال المكتب إلزامي ومُتحقَّق (سعودي) — تستخدمه الإدارة للرد عبر واتساب.
      if (authRole === 'office' && !isSaudiMobile(authPhone)) {
        setAuthMsg({ ok: false, text: 'أدخل رقم جوال سعودي صحيح للمكتب (مثال: 05XXXXXXXX).' });
        setAuthBusy(false);
        return;
      }
      r = await signUpWithPassword(email, authPass, { role: authRole, officeName: authOfficeName, fal: authFal, phone: authPhone, seekerName: authSeekerName });
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

  // حساب مؤشر أسعار الحي وحالته بناءً على متوسطات /admin الحالية (mktAvg)
  const getFair = (l: UIListing) => {
    const m = mktAvg[l.hood];
    return m ? fairForType(m, l.type) : l.adv; // الرجوع للسعر المُعلن إن لم يوجد متوسط للحي
  };
  // نقاط الخريطة من أي قائمة. مصدر الإحداثيات بالأولوية:
  //  1) عمودا lat/lng الرقميان (من منتقي الخريطة أو من تحليل سابق).
  //  2) اشتقاقها من maps_url إن كان رابطاً كاملاً يحوي إحداثيات (@lat,lng / !3d!4d /
  //     ?q=lat,lng …) — فتُضاء الإعلانات القديمة على الخريطة بلا إعادة إدخال.
  // الروابط المختصرة (maps.app.goo.gl) لا تحوي إحداثيات في نصّها فلا يمكن فكّها من
  // المتصفح ⇒ لا دبوس لها (يبقى زر «الموقع على الخريطة» يعمل عبر الرابط نفسه).
  const toPoints = (list: UIListing[]) => {
    const pts: { id: string | number; lat: number; lng: number; title: string; adv: number; fair: number; st: string }[] = [];
    for (const l of list) {
      let lat = typeof l.lat === 'number' ? l.lat : null;
      let lng = typeof l.lng === 'number' ? l.lng : null;
      if ((lat === null || lng === null) && l.maps_url) {
        const c = parseMapsUrl(l.maps_url);
        if (c) { lat = c.lat; lng = c.lng; }
      }
      if (lat === null || lng === null) continue;
      const fair = getFair(l);
      pts.push({ id: l.id, lat, lng, title: l.title, adv: l.adv, fair, st: getSt(l.adv, fair) });
    }
    return pts;
  };

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
    if (!avg) return { type: 'none', icon: Icons.chart, title: t('ind.noAvg'), detail: '', color: 'bg-gray-50 border-gray-200' };
    if (!price) return { type: 'none', icon: Icons.chart, title: t('ind.prompt'), detail: '', color: 'bg-gray-50 border-gray-200' };
    if (price > avg * 1.12) return { type: 'hi', icon: Icons.warning, title: t('ind.vHiTitle'), detail: `أعلى بـ ${(price - avg).toLocaleString('ar-SA')} ريال من ${ref}`, color: 'bg-orange-50 border-orange-300' };
    if (price < avg * 0.85) return { type: 'lo', icon: Icons.target, title: t('ind.vLoTitle'), detail: `أقل بـ ${(avg - price).toLocaleString('ar-SA')} ريال من ${ref}`, color: 'bg-green-50 border-green-300' };
    return { type: 'ok', icon: Icons.okCircle, title: t('ind.vOkTitle'), detail: `${ref} حوالي ${avg.toLocaleString('ar-SA')} ريال سنوياً`, color: 'bg-blue-50 border-blue-200' };
  };

  const indicator = checkPrice();

  // مصدر الحقيقة الوحيد: قائمة مصفّاة بالمعايير، تُغذّي الخريطة والقائمة معاً.
  // القطاع هو الفلتر الأساسي: سكني/تجاري؛ والنوع يُطابَق حسب القطاع (سكني: type،
  // تجاري: commercialType). الإعلانات بلا قطاع تُعدّ سكنية (الافتراضي).
  const filtered = listings.filter(l => {
    const lSector = l.sector === 'commercial' ? 'commercial' : 'residential';
    if (lSector !== filterSector) return false;
    if (filterHood && l.hood !== filterHood) return false;
    if (filterType) {
      const lType = filterSector === 'commercial' ? l.commercialType : l.type;
      if (lType !== filterType) return false;
    }
    if (filterBudget && l.adv > parseInt(filterBudget)) return false;
    return true;
  });

  // نقاط الخريطة مشتقّة من نفس القائمة المصفّاة ⇒ تتحدّث العلامات فور تغيّر أي فلتر.
  const filteredMapPoints = toPoints(filtered);

  // ── التنقّل الموحّد (يُمرَّر للدرج الجانبي) — كل بند صفحة مستقلّة ──
  // يضبط أيضاً الـ hash في العنوان فتصبح كل وجهة قابلة للمشاركة (search/indicator…)
  // بلا كسر الـ SPA: الرئيسية بلا hash، والبقية «/#id» يضيف سجلّ تصفّح فيعمل زرّا الرجوع/التقدّم.
  const go = (raw: string) => {
    const id: PageId = isPageId(raw) ? raw : 'home';
    setPage(id);
    if (typeof window !== 'undefined') {
      const cur = window.location.hash.replace('#', '');
      if (id === 'home') {
        if (cur) window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else if (cur !== id) {
        window.location.hash = id;
      }
      window.scrollTo(0, 0);
    }
  };

  // قراءة الـ hash عند التحميل (لمشاركة رابط مباشر للوجهة، أو القدوم من /admin عبر '/#search')
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hash.replace('#', '');
    if (h && isPageId(h)) go(h);
    // زيارة واحدة لكل تحميل صفحة (حارس داخل trackPageView ضد التكرار) —
    // بعد التركيب فقط، بنفس عميل singleton، ولا تمسّ المصادقة بشيء.
    trackPageView(h || 'home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // مزامنة الـ hash مع الوجهة عند تغيّره خارجياً (زرّا الرجوع/التقدّم في المتصفح، أو رابط مُشارَك)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      const next: PageId = h && isPageId(h) ? h : 'home';
      setPage((cur) => (cur === next ? cur : next));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // استخدام ميزة «خيارات تقسيط الإيجار»: يُسجَّل عند كل دخول فعلي للصفحة
  useEffect(() => {
    if (page === 'finance') track('feature_use', null, { feature: 'finance' });
  }, [page]);

  // ظهور تدريجي عند التمرير لعناصر .reveal في الصفحة الرئيسية (تصميم Stitch).
  // يُعاد التشغيل عند تغيّر المحتوى ليُراقب البطاقات الجديدة؛ مع رجوع آمن إن غاب الـ API.
  useEffect(() => {
    if (page !== 'home' || typeof window === 'undefined') return;
    const els = Array.from(document.querySelectorAll('.stitch-home .reveal'));
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: 0.1 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [page, listings.length, filterType, aiResult, aiShowAlts]);

  // ── تتبّع داخلي للوحة تحليلات /admin (fire-and-forget، بلا بيانات شخصية) ──
  // بحث الفلاتر: يُسجَّل بعد استقرار الاختيار (debounce) لا مع كل ضغطة/تغيير،
  // وفقط حين يوجد فلتر واحد على الأقل — فلا ضجيج ولا تكرار لكل حرف ميزانية.
  useEffect(() => {
    if (!filterHood && !filterType && !filterBudget) return;
    const t = setTimeout(() => {
      track('search', null, {
        source: 'filters',
        hood: filterHood || null,
        type: filterType || null,
        budget: parseInt(filterBudget) || null,
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [filterHood, filterType, filterBudget]);

  // استخدام مؤشر أسعار الحي: النتيجة تظهر حيّاً أثناء الكتابة، فنسجّل استخداماً
  // واحداً بعد استقرار الإدخال — مع الحكم الفعلي (hi مرتفع / ok مناسب / lo فرصة).
  useEffect(() => {
    if (siSector !== 'residential') return; // المؤشر التجاري لا يُسجَّل بحكم سكني
    const price = parseInt(siPrice) || 0;
    if (!price) return;
    const t = setTimeout(() => {
      const m = mktAvg[siZone];
      const avg = m ? fairForType(m, siType) : 0;
      if (!avg) return;
      track('indicator_use', null, { hood: siZone, type: siType, price, verdict: getSt(price, avg) });
    }, 1500);
    return () => clearTimeout(t);
  }, [siZone, siType, siPrice, mktAvg, siSector]);

  // ── المساعد الذكي: ترتيب/تصفية محلّية بالكلمات المفتاحية (بدون API) ──
  // TODO: لربط ذكاء اصطناعي حقيقي لاحقاً، استبدل منطق النقاط أدناه باستدعاء
  //       واجهة (مثل Anthropic) يُرجع ترتيب المعرّفات؛ تبقى الواجهة كما هي.
  const scrollToListings = () =>
    setTimeout(() => document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

  const runAI = (raw?: string) => {
    const q = (raw ?? aiQuery).trim();
    if (raw !== undefined) setAiQuery(raw);
    if (!q) return;
    setAiShowAlts(false);

    // ── معايير صريحة = فلاتر صارمة: نحترم ما طلبه الباحث ولا نستبدله أبداً ──
    const reqHood = parseAiHood(q, Object.keys(mktAvg));
    const reqType = parseAiType(q);
    const reqMaxPrice = parseAiMaxPrice(q);
    // كشف النيّة التجارية: null=سكني (افتراضي) | 'any' | نوع تجاري محدّد. لا يوجد
    // عقار تجاري بعد ⇒ أي نيّة تجارية تُرجع «لا تطابق» صادقة (لا عرض تجاري مُفبرك).
    const reqComm = parseAiCommercial(q);
    const reqSector: 'residential' | 'commercial' = reqComm ? 'commercial' : 'residential';
    const reqTypeLabel = reqSector === 'commercial'
      ? (reqComm === 'any' ? 'عقار تجاري' : commLabel(reqComm))
      : reqType;
    // نيّة «الأرخص»: ترتيب تصاعدي صريح بالسعر (لا سقف). يُعرَض الأرخص فعلاً أولاً ويُسمّى صراحةً.
    const cheapestIntent = /(رخيص|أرخص|ارخص|أقل سعر|اقل سعر|رخيصة|الأرخص|بسيط|ميزانية)/.test(q);

    // ── مسار بيانات السوق: أسئلة المتوسطات/المقارنات تُجاب من بيانات المؤشر الحقيقية ──
    //   السكني من mktAvg (متوسط الحي للنوع)، التجاري من commIndex (ريال/م² + عدد الصفقات).
    //   لا بحث إعلانات هنا — إجابة معرفية صادقة؛ وإن غاب حي بيانياً نقولها بصراحة (لا فبركة).
    {
      const hoodsAll = parseAiHoodsAll(q, Object.keys(mktAvg));
      const avgIntent = /متوسط|المعدل|(كم|بكم)\s*[^؟?]{0,14}(إيجار|ايجار|سعر|يكلف|تكلف|تكلفة)|كم سعر|كم يكلف|كم الإيجار|كم الايجار/.test(q);
      const compareIntent = /(قارن|قارني|قارنّ|مقارنة|الفرق بين|مقابل|أيهما|ايهما|\bvs\b)/.test(q);
      const wantsMarket = hoodsAll.length >= 1 && (compareIntent || avgIntent);
      if (wantsMarket) {
        const mktSector: 'residential' | 'commercial' = reqComm ? 'commercial' : 'residential';
        const ct = reqComm && reqComm !== 'any' ? reqComm : 'shop';
        const rows: MarketRow[] = hoodsAll.map((h) => {
          if (mktSector === 'commercial') {
            const c = commIndex[`${h}|${ct}`];
            return { hood: h, typeLabel: commT(ct), value: c?.pricePerM2 ?? null, sampleSize: c?.sampleSize ?? null, unit: 'perM2' as const };
          }
          const m = mktAvg[h];
          const v = m ? fairForType(m, reqType ?? 'شقة') : 0;
          return { hood: h, typeLabel: reqType ?? (lang === 'en' ? t('type.apartment') : 'شقة'), value: v > 0 ? v : null, sampleSize: null, unit: 'perYear' as const };
        });
        setAiMatchIds([]);
        setAiReply(null);
        setAiResult({ kind: 'market', mode: hoodsAll.length >= 2 ? 'compare' : 'single', sector: mktSector, rows });
        track('search', null, { source: 'ai', q: q.slice(0, 200), kind: 'market', sector: mktSector, hoods: hoodsAll.join('،'), matches: rows.filter((r) => r.value != null).length });
        setSearched(true);
        scrollToListings();
        return;
      }
    }

    // المطابقون فعلاً = الإعلانات الحقيقية التي تحقّق كل معيار صريح (القطاع/الحي/النوع/السقف).
    const pool = listings.filter((l) => {
      const lSector = l.sector === 'commercial' ? 'commercial' : 'residential';
      if (lSector !== reqSector) return false;
      if (reqHood && l.hood !== reqHood) return false;
      if (reqSector === 'commercial') {
        if (reqComm && reqComm !== 'any' && l.commercialType !== reqComm) return false;
      } else if (reqType && l.type !== reqType) return false;
      if (reqMaxPrice && l.adv > reqMaxPrice) return false;
      return true;
    });

    // تتبّع بحث المساعد الذكي: نص الطلب (مقتطع) + المعايير المستخرجة + عدد المطابقين الفعلي
    track('search', null, {
      source: 'ai',
      q: q.slice(0, 200),
      hood: reqHood,
      type: reqTypeLabel,
      sector: reqSector,
      budget: reqMaxPrice,
      matches: pool.length,
    });

    // ── لا تطابق ──────────────────────────────────────────────
    if (pool.length === 0) {
      setAiMatchIds([]);
      const hasCriteria = !!(reqHood || reqType || reqMaxPrice || reqComm);
      if (hasCriteria) {
        // صدق: لا نستبدل الحي ولا ندّعي تطابقاً — نعرض رسالة صريحة + تسجيل الطلب،
        // ونسجّل الرغبة غير المطابقة للمدير (fire-and-forget، لا تحجب ولا تكسر).
        // النوع المعروض يعكس القطاع (تجاري: محل/مكتب/معرض/عقار تجاري).
        setAiResult({ kind: 'none', hood: reqHood, type: reqTypeLabel, maxPrice: reqMaxPrice, raw: q });
        setAiReply(null); // اللوحة الصريحة أدناه تحمل الرسالة بدل صندوق الرد
        trackSearchWish({ neighborhood: reqHood, type: reqTypeLabel, maxPrice: reqMaxPrice, rawQuery: q });
      } else {
        // بلا أي معيار صريح ولا نتيجة (مثلاً الكتالوج فارغ) — رسالة صادقة عامة
        setAiResult({ kind: 'matches', ids: [] });
        setAiReply(
          listings.length === 0
            ? 'لا توجد إعلانات متاحة حالياً — تُعرض هنا إعلانات المكاتب فور نشرها.'
            : 'اذكر الحي أو النوع أو ميزانيتك لأبحث لك بدقّة بين الإعلانات المتاحة.'
        );
      }
      setSearched(true);
      scrollToListings();
      return;
    }

    // ── يوجد تطابق: نرتّب المطابقين فقط وفق التفضيلات الناعمة (لا نضيف غيرهم) ──
    const scored = pool.map((l) => {
      let score = 0;
      // مؤشر السكني فقط (لا يوجد متوسط تجاري بعد) — تفادي مقارنة تجارية بمتوسط سكني خاطئ
      const fair = reqSector === 'commercial' ? 0 : getFair(l);
      if (cheapestIntent) score += (200000 - l.adv) / 20000; // الرخص (نيّة الأرخص)
      if (reqSector !== 'commercial' && /(فرص|فرصة|أقل من السوق|اقل من السوق|عادل|تحت السوق)/.test(q) && l.adv < fair) score += 6; // الفرص
      if (/(قريب|قريبة|خدمات|وسط|مركز)/.test(q) && NEAR_HOODS.has(l.hood)) score += 4;                        // قريبة من الخدمات
      // ── الخصائص المنظّمة (تُطابَق فقط إن ذكرها الباحث ووفّرها المكتب؛ لا خصم على الغياب) ──
      if (/غير مفروش/.test(q)) { if (l.furnished === false) score += 5; }                                    // غير مفروشة
      else if (/مفروش/.test(q)) { if (l.furnished === true) score += 5; }                                    // مفروشة
      if (/راكب/.test(q) && l.kitchen === true) score += 5;                                                  // مطبخ راكب
      if (/(مكيّف|مكيف|مكيفات|تكييف|مكيّفة|مكيفة)/.test(q) && l.ac === true) score += 5;                       // مكيّفة
      if (/(موقف|مواقف|كراج|باركن)/.test(q) && (l.parking ?? 0) >= 1) score += 5;                            // مواقف
      return { l, score };
    });
    // نيّة «الأرخص» ⇒ الترتيب الأساسي تصاعدي بالسعر (يُعرَض الأرخص فعلاً أولاً، وتُطابقه
    // التسمية أدناه)؛ غير ذلك ⇒ الترتيب بالنقاط ثم الأرخص عند التعادل (قيمة أفضل).
    if (cheapestIntent) scored.sort((a, b) => a.l.adv - b.l.adv || b.score - a.score);
    else scored.sort((a, b) => b.score - a.score || a.l.adv - b.l.adv);
    const orderedIds = scored.map((s) => s.l.id);
    const matchIds = orderedIds.slice(0, Math.min(2, orderedIds.length));
    setAiResult({ kind: 'matches', ids: orderedIds });
    setAiMatchIds(matchIds);
    const best = scored[0].l; // مع نيّة الأرخص = الأقل سعراً فعلاً بين المطابقين
    if (cheapestIntent) {
      // تسمية صريحة تعكس السعر الأدنى الحقيقي لنفس النوع المطلوب (لا التباس بأنواع أخرى).
      const lowest = pool.reduce((a, b) => (b.adv < a.adv ? b : a));
      const typeWord = reqTypeLabel || (lang === 'en' ? 'property' : 'عقار');
      const inHood = reqHood ? (lang === 'en' ? ` in ${reqHood}` : ` في ${reqHood}`) : '';
      setAiReply(
        lang === 'en'
          ? `Cheapest available ${typeWord}${inHood}: ${lowest.title} — ${nf(lowest.adv)} ${t('mkt.perYear')}.`
          : `أرخص ${typeWord}${inHood}: ${lowest.title} — ${nf(lowest.adv)} ريال/سنة.`
      );
    } else {
      const crit = [reqHood, reqTypeLabel, reqMaxPrice ? `حتى ${nf(reqMaxPrice)} ريال` : null].filter(Boolean).join(' · ');
      setAiReply(
        `${pool.length === 1 ? 'إعلان واحد مطابق' : `${nf(pool.length)} إعلانات مطابقة`}${crit ? ` لطلبك (${crit})` : ' لطلبك'}. الأنسب: ${best.title} في ${best.hood} — ${nf(best.adv)} ريال.`
      );
    }
    setSearched(true);
    scrollToListings();
  };

  // تسجيل الطلب عند لا تطابق: ينقل الباحث لنموذج الاستفسار (يصل للمكاتب والمدير
  // فعلياً عبر leads) مع تعبئة الحي/النوع — تسجيل اهتمام صادق بلا وعد بإشعار آلي.
  const registerWish = () => {
    if (aiResult?.kind !== 'none') return;
    if (aiResult.hood) setInqHood(aiResult.hood);
    if (aiResult.type) setInqType(aiResult.type);
    const wish = `أبحث عن ${aiResult.type || 'وحدة'}${aiResult.hood ? ` في ${aiResult.hood}` : ''}${aiResult.maxPrice ? ` بسعر حتى ${aiResult.maxPrice.toLocaleString('ar-SA')} ريال` : ''} ولم أجد إعلاناً مطابقاً حالياً.`;
    setInqMsg((prev) => prev || wish);
    go('inquiries');
  };

  // القائمة المعروضة في الرئيسية:
  //  • تطابق ⇒ المطابقون فقط بالترتيب (لا نضيف أحياءً أخرى أبداً).
  //  • لا تطابق ⇒ فارغة (اللوحة الصريحة تظهر بدلاً منها).
  //  • قبل أي بحث ⇒ كل الإعلانات (filtered؛ فلاتر الرئيسية فارغة فتساوي الكل).
  const displayList: UIListing[] =
    aiResult?.kind === 'matches'
      ? (aiResult.ids.map((id) => listings.find((l) => l.id === id)).filter(Boolean) as UIListing[])
      : aiResult?.kind === 'none' || aiResult?.kind === 'market'
        ? []
        : filtered;

  // بطاقة إعلان أفقية: عمود صورة (يمين) + شارة الحالة فوق الصورة + معلومات (يسار)
  // شارات الخصائص المنظّمة — تظهر كل خاصية عبّأها المكتب (null = غير محدّد ⇒ لا شارة).
  // هذه نفسها الحقول التي يطابق عليها المساعد الذكي (furnished/kitchen/ac/parking).
  const attrChips = (l: UIListing): string[] => {
    const c: string[] = [];
    if (l.furnished != null) c.push(l.furnished ? t('chip.furnished') : t('chip.unfurnished'));
    if (l.kitchen != null) c.push(l.kitchen ? t('chip.kitchen') : t('chip.noKitchen'));
    if (l.ac != null) c.push(l.ac ? t('chip.ac') : t('chip.noAc'));
    if (l.parking != null) c.push(l.parking >= 1 ? `${nf(l.parking)} ${t('card.parkings')}` : t('chip.noParking'));
    return c;
  };

  // فتح بطاقة تفاصيل الإعلان (من بطاقة القائمة أو دبوس الخريطة) — يسجّل النقرة ويصفّر نموذج التواصل.
  const openListing = (l: UIListing) => {
    track('listing_click', String(l.id), { hood: l.hood, type: l.type });
    setSelectedListing(l);
    setDetailShot(0); // ابدأ المعرض من الصورة الأولى لكل إعلان يُفتح
    setCtOpen(false); setCtSent(false); setCtErr(null);
    setCtName(''); setCtPhone(''); setCtMsg('');
  };

  // بطاقة الإعلان بأسلوب Stitch (الصفحة الرئيسية الجديدة) — بيانات حقيقية، نفس
  // النقرة تفتح بطاقة التفاصيل القائمة. الشارة تعكس حكم مؤشر أسعار الحي الحقيقي.
  const renderStitchCard = (l: UIListing, isMatch = false) => {
    const isComm = l.sector === 'commercial';
    const img = l.imagesByCategory?.facade ?? (l.images && l.images.length ? l.images[0] : null);
    // الشارة: السكني = حكم مؤشر أسعار الحي الحقيقي؛ التجاري = نوع تجاري محايد
    // (لا مؤشر تجاري بعد ⇒ لا حكم سعري مُفبرك على التجاري).
    let v: { cls: string; icon: string; label: string };
    if (isComm) {
      v = { cls: 'v-comm', icon: COMMERCIAL_TYPES.find((c) => c.key === l.commercialType)?.icon ?? 'storefront', label: commT(l.commercialType) };
    } else {
      const st = getSt(l.adv, getFair(l)); // hi مرتفع / ok مناسب / lo فرصة
      v = st === 'hi'
        ? { cls: 'v-high', icon: 'trending_up', label: t('verdict.highIndex') }
        : st === 'lo'
          ? { cls: 'v-opp', icon: 'trending_down', label: t('verdict.opp') }
          : { cls: 'v-stable', icon: 'remove', label: t('verdict.fair') };
    }
    return (
      <div key={l.id} className={`card group reveal${isMatch ? ' is-match' : ''}`} onClick={() => openListing(l)}>
        <div className="media">
          <div className="imgwrap">
            {img
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={img} alt={l.title} />
              : <div className="ph">{msi('home_work')}</div>}
          </div>
          {/* شارة الحالة: نقطة ذهبية للإيجار (لو توفّر للبيع مستقبلاً: نقطة خضراء) */}
          <span className="tag"><span className="dot" />{isMatch ? t('card.bestMatch') : t('card.forRent')}</span>
        </div>
        <div className="body">
          <div className="topline">
            <h3>{l.title || `${isComm ? commT(l.commercialType) : l.type} — ${l.hood}`}</h3>
            <span className={`badge-state ${v.cls}`}>{msi(v.icon)} {v.label}</span>
          </div>
          <div className="loc">{msi('location_on')} {l.hood}{lang === 'en' ? ', ' : '، '}{t('card.city')}</div>
          <div className="specs">
            {isComm ? (
              <>
                <span>{msi('square_foot')} {l.area ?? '—'} {t('card.area')}</span>
                {l.frontageCount != null && <span>{msi('storefront')} {nf(l.frontageCount)} {t('card.frontages')}</span>}
                {l.parking != null && <span>{msi('local_parking')} {nf(l.parking)} {t('card.parkings')}</span>}
              </>
            ) : (
              <>
                <span>{msi('bed')} {l.rooms ?? '—'} {t('card.rooms')}</span>
                <span>{msi('bathtub')} {l.baths ?? '—'} {t('card.baths')}</span>
                <span>{msi('square_foot')} {l.area ?? '—'} {t('card.area')}</span>
              </>
            )}
          </div>
          <div className="foot">
            <div className="price">{nf(l.adv)} <span>{t('card.perYearShort')}</span></div>
            <button className="save" aria-label={lang === 'en' ? 'Save' : 'حفظ'} onClick={(e) => e.stopPropagation()}>{msi('bookmark_border')}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderListing = (l: UIListing, isMatch = false) => {
    const isComm = l.sector === 'commercial';
    const fair = isComm ? 0 : getFair(l);
    const st = isComm ? 'ok' : getSt(l.adv, fair);
    // الصورة الأساسية: الواجهة أولاً، ثم أي صورة متاحة
    const img = l.imagesByCategory?.facade ?? (l.images && l.images.length ? l.images[0] : null);
    // التجاري: لا شارات خصائص سكنية — نعرض النشاط المسموح إن وُجد فقط
    const chips = isComm ? (l.activity ? [l.activity] : []) : attrChips(l);
    const vBadge = isComm
      ? 'bg-[#f7f1df] text-[#8a6d18]'
      : st === 'hi' ? 'bg-[#fff3e0] text-[#C2410C]' : st === 'lo' ? 'bg-[#e8f7ee] text-[#1f7a44]' : 'bg-[#e6f1fb] text-[#1B6CA8]';
    return (
      <div key={l.id} onClick={() => openListing(l)}
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
            <span className={`absolute bottom-2 right-2 text-[11px] px-2.5 py-1 rounded-lg font-bold shadow-sm ${vBadge}`}>{isComm ? commT(l.commercialType) : verdictT(st)}</span>
            {isMatch && (
              <span className="absolute top-0 right-0 bg-[#C9A84C] text-[#0A3D62] text-[10px] font-bold px-2.5 py-1 rounded-bl-xl shadow">{t('card.bestMatch')}</span>
            )}
          </div>
          {/* المعلومات (يسار) */}
          <div className="flex-1 min-w-0 p-3.5">
            <div className="font-bold text-[15px] text-[#0f1a28] truncate">{l.title}</div>
            <div className="text-xs text-[#33414f] mt-0.5 font-medium">{(isComm ? commT(l.commercialType) : l.type)} · {l.hood}</div>
            <div className="mt-2 leading-none">
              <span className="text-[19px] font-extrabold text-[#0A3D62]">{nf(l.adv)}</span>
              <span className="text-[11px] text-[#33414f] mr-1">{t('card.perYear')}</span>
            </div>
            {/* مؤشر أسعار الحي السكني فقط — التجاري لا مؤشر له بعد (لا رقم مُفبرك) */}
            {!isComm && (
              <div className="text-[11px] text-[#1B6CA8] font-medium mt-1" title={t('ind.sub')}>{t('card.priceIndex')}: {nf(fair)} {t('card.sar')}</div>
            )}
            {isComm ? (
              <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-[#f0f4f8] text-[11px] text-[#33414f]">
                <span><b className="text-[#0f1a28]">{l.area ?? '—'}</b> {t('card.area')}</span>
                {l.frontageCount != null && <span><b className="text-[#0f1a28]">{nf(l.frontageCount)}</b> {t('card.frontages')}</span>}
                {l.parking != null && <span><b className="text-[#0f1a28]">{nf(l.parking)}</b> {t('card.parkings')}</span>}
              </div>
            ) : (
              <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-[#f0f4f8] text-[11px] text-[#33414f]">
                <span><b className="text-[#0f1a28]">{l.rooms ?? '—'}</b> {t('card.rooms')}</span>
                <span><b className="text-[#0f1a28]">{l.area ?? '—'}</b> {t('card.area')}</span>
                <span><b className="text-[#0f1a28]">{l.baths ?? '—'}</b> {t('card.bath')}</span>
              </div>
            )}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {chips.map((c) => (
                  <span key={c} className="text-[10px] bg-[#E6F1FB] text-[#1B6CA8] px-2 py-0.5 rounded-md font-medium">{c}</span>
                ))}
              </div>
            )}
            {/* موقع الوحدة — يفتح خرائط Google في تبويب جديد (لا يفتح تفاصيل الإعلان) */}
            {listingMapsHref(l) && (
              <a
                href={listingMapsHref(l)!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 mt-2.5 bg-[#0F6E56] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              >
                {Icons.pin}
                {t('card.mapsBtn')}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400";
  const selectCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="min-h-screen site" dir={dir} style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* الشريط العلوي الزجاجي المشترك — على كل الصفحات العامة (هوية موحّدة) */}
      <SiteHeader active={page} onNavigate={go} user={user} isAdmin={isAdmin} isOffice={hasOffice} onSignOut={signOut} />

      {/* ═══ HOME — تصميم Stitch الرسمي (واجهة فاتحة) موصول ببياناتي الحقيقية ═══ */}
      {page === 'home' && (
        <div className="stitch-home">

          {/* ── البطل: صورة سكنية ثابتة (ليست من الإعلانات) + تدرّج + بطاقة زجاجية ── */}
          <section className="hero">
            <div className="hero-bg" style={{ '--hero-img': `url('${HERO_IMG}')` } as React.CSSProperties} />
            <div className="hero-overlay" />
            <div className="wrap hero-inner">
              {/* backdrop-filter مضمّن سطرياً: المُصغِّر (Lightning CSS) كان يُسقط الخاصية
                  القياسية ويُبقي -webkit- فقط، فالنتيجة computed=none. السطري لا يُمسّ. */}
              <div className="glass-panel" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                <h1>{t('hero.h1')}</h1>
                <p className="sub">{t('hero.sub')}</p>
                <div className="search-box">
                  <span className="s-ico">{msi('search')}</span>
                  <input
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runAI()}
                    placeholder={t('hero.placeholder')}
                  />
                  <button onClick={() => runAI()}>{t('hero.searchBtn')}</button>
                </div>
                {/* القطاع — التبديل الأساسي سكني/تجاري (يصفّر النوع عند التبديل) */}
                <div className="sector-toggle">
                  {([['residential', 'sector.residential', 'home_work'], ['commercial', 'sector.commercial', 'storefront']] as const).map(([s, lbl, ic]) => (
                    <button key={s} className={`seg ${filterSector === s ? 'active' : ''}`}
                      onClick={() => {
                        setFilterSector(s); setFilterType('');
                        setAiResult(null); setAiReply(null); setSearched(false); setAiShowAlts(false);
                        setTimeout(() => document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
                      }}>
                      {msi(ic)} {t(lbl)}
                    </button>
                  ))}
                </div>
                {/* أنواع القطاع المختار — سكني: فلل/شقق · تجاري: محل/مكتب/معرض */}
                <div className="type-tabs">
                  {(filterSector === 'commercial'
                    ? COMMERCIAL_TYPES.map((c) => ({ k: c.key as string, label: t(`commType.${c.key}`), icon: c.icon as string }))
                    : [{ k: 'فيلا', label: t('type.villa'), icon: 'home' }, { k: 'شقة', label: t('type.apartment'), icon: 'apartment' }]
                  ).map((tab) => (
                    <button key={tab.k}
                      className={`pill ${filterType === tab.k ? 'active' : ''}`}
                      onClick={() => {
                        // فلتر النوع الحقيقي + إلغاء أي بحث مساعد سابق لعرض النوع بوضوح
                        setAiResult(null); setAiReply(null); setSearched(false); setAiShowAlts(false);
                        setFilterType(filterType === tab.k ? '' : tab.k);
                        setTimeout(() => document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
                      }}>
                      {msi(tab.icon)} {tab.label}
                    </button>
                  ))}
                </div>
                {/* المساعد الذكي — التسمية مترجمة؛ الاستعلام يبقى عربياً للمطابقة المحلّية */}
                <div className="ai-strip">
                  <span className="lbl">{msi('auto_awesome')} {t('hero.aiLabel')}</span>
                  {[
                    { q: 'أرخص شقة متاحة', k: 'ai.cheapest' },
                    { q: 'فيلا في حطين', k: 'ai.villaHittin' },
                    { q: 'فرص بأقل من السوق', k: 'ai.belowMarket' },
                    { q: 'قريب من الخدمات', k: 'ai.nearServices' },
                  ].map((c) => (
                    <button key={c.k} className="pill chip" onClick={() => runAI(c.q)}>{t(c.k)}</button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── عقارات مميزة: إعلاناتي الحقيقية ── */}
          <section className="sec" id="listings-section">
            <div className="wrap">
              <div className="sec-head reveal">
                <div className="ttl">
                  <h2>{searched ? t('listings.resultsTitle') : t('listings.featuredTitle')}</h2>
                  <p>{searched ? t('listings.resultsSub') : t('listings.featuredSub')}</p>
                </div>
                <button className="see-all" onClick={() => go('search')}>{t('listings.seeAll')} {msi('arrow_back')}</button>
              </div>

              {aiReply && aiResult?.kind === 'matches' && (
                <div className="ai-reply reveal">{msi('auto_awesome')}<span>{aiReply}</span></div>
              )}

              {aiResult?.kind === 'market' ? (
                // ── إجابة سوق: متوسط حي أو مقارنة أحياء من بيانات المؤشر الحقيقية ──
                (() => {
                  const r = aiResult;
                  const unitLabel = (u: 'perYear' | 'perM2') => (u === 'perM2' ? t('mkt.perM2') : t('mkt.perYear'));
                  const withData = r.rows.filter((x) => x.value != null);
                  let cmp: { cheaper: string; diff: number; unit: 'perYear' | 'perM2' } | null = null;
                  if (r.mode === 'compare' && withData.length >= 2) {
                    const sorted = [...withData].sort((a, b) => (a.value as number) - (b.value as number));
                    cmp = { cheaper: sorted[0].hood, diff: (sorted[sorted.length - 1].value as number) - (sorted[0].value as number), unit: sorted[0].unit };
                  }
                  return (
                    <div className="reveal in">
                      <div className="bg-white border border-[#cfd9e4] rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 font-bold text-[#0A3D62] mb-3">
                          {msi('insights')}<span>{r.mode === 'compare' ? t('mkt.compareTitle') : t('mkt.title')}</span>
                        </div>
                        <div className="space-y-2.5">
                          {r.rows.map((x) => (
                            <div key={x.hood + x.typeLabel} className="flex items-center justify-between gap-3 border-b border-[#f0f4f8] pb-2.5 last:border-0 last:pb-0">
                              <div className="text-sm font-bold text-[#0f1a28]">{x.hood} <span className="text-xs font-medium text-[#5b6b7a]">· {x.typeLabel}</span></div>
                              {x.value != null ? (
                                <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                                  <div className="text-[15px] font-extrabold text-[#0A3D62]">{nf(x.value)} <span className="text-[11px] font-medium text-[#5b6b7a]">{unitLabel(x.unit)}</span></div>
                                  {x.sampleSize != null && x.sampleSize > 0 && (
                                    <div className="text-[11px] text-[#8a6d18]">{t('mkt.deals')}: {nf(x.sampleSize)}</div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-[#9aa6b2]">{t('mkt.noData')}</div>
                              )}
                            </div>
                          ))}
                        </div>
                        {cmp && (
                          <div className="mt-3 pt-3 border-t border-[#f0f4f8] text-sm font-semibold text-[#1f7a44] flex items-center gap-1.5">
                            {msi('trending_down')}
                            <span>{cmp.cheaper} {t('mkt.cheaperHood')} — {t('mkt.lowerBy')} {nf(cmp.diff)} {unitLabel(cmp.unit)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : aiResult?.kind === 'none' ? (
                // ── لا تطابق: رسالة صادقة + تسجيل الطلب + خيارات أخرى (لا استبدال للحي) ──
                (() => {
                  const crit = [
                    aiResult.hood ? `في ${aiResult.hood}` : null,
                    aiResult.type ? `من نوع ${aiResult.type}` : null,
                    aiResult.maxPrice ? `بسعر حتى ${aiResult.maxPrice.toLocaleString('ar-SA')} ريال` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <div className="reveal in">
                      <div className="nomatch">
                        <div className="nm-head">
                          {msi('search_off')}
                          <div>
                            <div className="t">{t('ai.nmTitle')}{crit ? ` (${crit})` : ''}.</div>
                            <div className="d">{t('ai.nmBody')}</div>
                          </div>
                        </div>
                        <div className="nm-actions">
                          <button className="login-btn" onClick={registerWish}>
                            <span>{t('ai.nmRegister')}</span>{msi('arrow_back')}
                          </button>
                          {listings.length > 0 && (
                            <button className="ghost-btn" onClick={() => setAiShowAlts((v) => !v)}>
                              <span>{aiShowAlts ? t('ai.nmShowAlts') : `${t('ai.nmBrowseAlts')} (${nf(listings.length)})`}</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {aiShowAlts && (
                        <div style={{ marginTop: 20 }}>
                          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
                            {t('ai.nmAltsTitle')}
                          </p>
                          <div className="cards">{listings.map((l) => renderStitchCard(l))}</div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : displayList.length === 0 ? (
                <div className="empty-card reveal">
                  {listings.length === 0
                    ? t('listings.emptyNoListings')
                    : filterSector === 'commercial'
                      ? t('listings.emptyNoCommercial')
                      : t('listings.emptyNoMatch')}
                </div>
              ) : (
                <div className="cards">
                  {displayList.map((l) => renderStitchCard(l, aiMatchIds.includes(l.id)))}
                </div>
              )}
            </div>
          </section>

          {/* ── لماذا تختار مؤشر العقارية؟ (محتوى تعريفي ثابت صادق) ── */}
          <section className="sec why">
            <div className="wrap">
              <div className="sec-head reveal">
                <h2>{t('why.title')}</h2>
                <p className="sub">{t('why.sub')}</p>
              </div>
              <div className="why-grid">
                <div className="why-card reveal"><div className="ic">{msi('analytics')}</div><h3>{t('why.c1t')}</h3><p>{t('why.c1d')}</p></div>
                <div className="why-card reveal"><div className="ic">{msi('verified_user')}</div><h3>{t('why.c2t')}</h3><p>{t('why.c2d')}</p></div>
                <div className="why-card reveal"><div className="ic">{msi('speed')}</div><h3>{t('why.c3t')}</h3><p>{t('why.c3d')}</p></div>
                <div className="why-card reveal"><div className="ic">{msi('support_agent')}</div><h3>{t('why.c4t')}</h3><p>{t('why.c4d')}</p></div>
              </div>
            </div>
          </section>

          {/* ── التذييل ── */}
        </div>
      )}

      {/* ═══ ابحث عن إيجارك — البحث + الخريطة (صفحة واحدة مدمجة) ═══ */}
      {page === 'search' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-6 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-xl font-bold mb-1">{t('search.h1')}</h1>
              <p className="text-white/85 text-sm">{t('search.sub')}</p>
            </div>
          </div>
          <div className="px-4 pt-3 pb-6 space-y-4">
            {/* الفلاتر — مصدر الحقيقة الذي يغذّي الخريطة والقائمة معاً */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[#1B6CA8] flex items-center justify-center text-white">
                  {Icons.search}
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">{t('search.filterTitle')}</div>
                  <div className="text-xs text-gray-500">{t('search.filterSub')}</div>
                </div>
              </div>
              {/* القطاع — التبديل الأساسي سكني/تجاري (يصفّر النوع عند التبديل) */}
              <div className="px-4 pt-3">
                <div className="sector-toggle">
                  {([['residential', 'سكني', 'home_work'], ['commercial', 'تجاري', 'storefront']] as const).map(([s, lbl, ic]) => (
                    <button key={s} className={`seg ${filterSector === s ? 'active' : ''}`}
                      onClick={() => { setFilterSector(s); setFilterType(''); }}>
                      {msi(ic)} {lang === 'en' ? t('sector.' + s) : lbl}
                    </button>
                  ))}
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
                    {(filterSector === 'commercial'
                      ? COMMERCIAL_TYPES.map((c) => ({ v: c.key as string, lbl: c.label as string }))
                      : RESIDENTIAL_FILTER_TYPES.map((rt) => ({ v: rt, lbl: rt }))
                    ).map((o) => <option key={o.v} value={o.v}>{o.lbl}</option>)}
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

            {/* الخريطة — نقاطها مشتقّة من نفس القائمة المصفّاة (تتحدّث العلامات حيّاً).
                relative z-0 isolate: يحصر مكدّس Leaflet (z-index 400–1000) داخل سياق
                تكديس خاص حتى يبقى الدرج الجانبي فوق الخريطة دائماً عند فتحه. */}
            <div className="relative z-0 isolate bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <span className="text-[#1B6CA8]">{Icons.map}</span>
                <span className="font-bold text-sm text-gray-900">{t('search.mapTitle')}</span>
                <span className="text-xs text-[#33414f] mr-auto">{filteredMapPoints.length} عقار على الخريطة</span>
              </div>
              {/* الخريطة تُعرض دائماً وتفاعلية (تحمّل Leaflet دائماً) — الإعلانات بلا
                  إحداثيات لا تضع دبوساً فقط، والخريطة تبقى تعمل (تصفّح/تكبير).
                  نقر الدبوس ⇒ نافذة منبثقة بزر «عرض التفاصيل» يفتح التفاصيل الكاملة. */}
              <MapComponent
                points={filteredMapPoints}
                onSelect={(id) => { const l = listings.find((x) => String(x.id) === String(id)); if (l) openListing(l); }}
              />
              {filteredMapPoints.length === 0 && (
                <div className="px-4 py-3 text-center text-[#33414f] text-xs border-t border-gray-100">
                  {listings.length === 0
                    ? t('search.mapEmptyAll')
                    : t('search.mapEmptyFiltered')}
                </div>
              )}
            </div>

            {/* القائمة المطابقة — نفس مصدر الفلاتر */}
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                <h2 className="font-bold text-[#0f1a28] text-lg sec-underline">{t('search.resultsTitle')}</h2>
                <div className="text-xs text-[#33414f] flex items-center gap-1">{Icons.chart} {filtered.length} نتيجة</div>
              </div>
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#cfd9e4] p-8 text-center text-[#33414f] text-sm">
                  {listings.length === 0
                    ? t('search.emptyNoListings')
                    : filterSector === 'commercial'
                      ? t('search.emptyNoCommercial')
                      : t('search.emptyNoMatch')}
                </div>
              ) : (
                <div className="space-y-3">{filtered.map((l) => renderListing(l))}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ مؤشر أسعار الحي — صفحة مستقلّة ═══ */}
      {page === 'indicator' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-6 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-xl font-bold mb-1">{t('ind.title')}</h1>
              <p className="text-white/85 text-sm">{t('ind.sub')}</p>
            </div>
          </div>
          <div className="px-4 pt-4 pb-6 max-w-xl mx-auto">
            <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-orange-50 to-white px-4 py-3 border-b border-orange-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[#C9A84C] flex items-center justify-center text-[#3A2E0A]">
                  {Icons.chart}
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">{t('ind.cardTitle')}</div>
                  <div className="text-xs text-gray-500">{t('ind.cardSub')}</div>
                </div>
              </div>
              <div className="p-4">
                {/* القطاع — سكني (المؤشر الحقيقي) | تجاري (قريباً، لا بيانات مُفبركة) */}
                <div className="sector-toggle mb-3">
                  {([['residential', 'سكني', 'home_work'], ['commercial', 'تجاري', 'storefront']] as const).map(([s, lbl, ic]) => (
                    <button key={s} className={`seg ${siSector === s ? 'active' : ''}`} onClick={() => setSiSector(s)}>
                      {msi(ic)} {lang === 'en' ? t('sector.' + s) : lbl}
                    </button>
                  ))}
                </div>
                {siSector === 'commercial' ? (() => {
                  // المؤشر التجاري — يقرأ المتوسط المحفوظ (commercial_prices) للحي+النوع.
                  // مُعبّأ ⇒ نعرض المتوسط ونقارن إيجار المتر² المُدخَل؛ فارغ ⇒ حالة صادقة «قريباً».
                  const cAvg = commIndex[`${siZone}|${siCommType}`]?.pricePerM2 ?? null;
                  const cSample = commIndex[`${siZone}|${siCommType}`]?.sampleSize ?? null;
                  const cPrice = parseInt(siPrice) || 0;
                  // عدد الصفقات (sample_size) يُعرَض بجانب المتوسط — مصداقية المؤشر التجاري
                  const dealsTxt = cSample != null && cSample > 0 ? ` · عدد الصفقات: ${cSample.toLocaleString('ar-SA')}` : '';
                  const avgTxt = cAvg != null ? `متوسط ${commLabel(siCommType)} في ${siZone}: ${cAvg.toLocaleString('ar-SA')} ريال/م² سنوياً${dealsTxt}` : '';
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('ind.hood')}</label>
                          <select value={siZone} onChange={e => setSiZone(e.target.value)} className={selectCls}>
                            {Object.keys(mktAvg).map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('ind.commType')}</label>
                          <select value={siCommType} onChange={e => setSiCommType(e.target.value as 'shop' | 'office' | 'showroom')} className={selectCls}>
                            <option value="shop">{commT('shop')}</option><option value="office">{commT('office')}</option><option value="showroom">{commT('showroom')}</option>
                          </select>
                        </div>
                      </div>
                      {cAvg == null ? (
                        <div className="p-5 rounded-xl bg-[#f7f1df] border border-[#e6d9ad] text-center">
                          <div className="text-[#8a6d18] mb-2 flex justify-center">{msi('storefront')}</div>
                          <div className="font-bold text-sm text-[#7a5f12] mb-1">{t('comm.soonShort')}</div>
                          <div className="text-xs text-[#8a6d18] leading-relaxed">{t('comm.indexSoon')}</div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('ind.m2Rent')}</label>
                            <input type="number" value={siPrice} onChange={e => setSiPrice(e.target.value)} placeholder="مثال: 1800" className={inputCls} />
                          </div>
                          {!cPrice ? (
                            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800"><b>{avgTxt}.</b><div className="text-xs mt-0.5 text-gray-600">{t('ind.m2Prompt')}</div></div>
                          ) : (() => {
                            const hi = cPrice > cAvg * 1.12, lo = cPrice < cAvg * 0.85;
                            const cls = hi ? 'bg-orange-50 border-orange-300 text-orange-700' : lo ? 'bg-green-50 border-green-300 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-800';
                            const ttl = hi ? t('ind.commHi') : lo ? t('ind.commLo') : t('ind.commOk');
                            return <div className={`p-3 rounded-xl border ${cls}`}><div className="font-bold text-sm">{ttl}</div><div className="text-xs mt-0.5 text-gray-600">{avgTxt} · الفرق {Math.abs(cPrice - cAvg).toLocaleString('ar-SA')} ريال/م².</div></div>;
                          })()}
                        </>
                      )}
                    </>
                  );
                })() : (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('ind.hood')}</label>
                        <select value={siZone} onChange={e => setSiZone(e.target.value)} className={selectCls}>
                          {Object.keys(mktAvg).map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('ind.unitType')}</label>
                        <select value={siType} onChange={e => setSiType(e.target.value)} className={selectCls}>
                          {['شقة', 'فيلا', 'دور', 'دوبلكس', 'استوديو'].map(ut => (
                            <option key={ut} value={ut}>{ut}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('ind.annualRent')}</label>
                      <input type="number" value={siPrice} onChange={e => setSiPrice(e.target.value)}
                        placeholder={t('ind.rentPlaceholder')} className={inputCls} />
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
                        {t('ind.prompt')}
                      </div>
                    )}
                  </>
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
              <h1 className="text-xl font-bold mb-1">{t('fin.h1')}</h1>
              <p className="text-white/85 text-sm">{t('fin.sub')}</p>
            </div>
          </div>
          <div className="px-4 pt-5 pb-6 space-y-4 max-w-xl mx-auto">
            <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] rounded-2xl p-6 text-center shadow-xl">
              <div className="flex justify-center mb-3 text-white opacity-90">{Icons.bank}</div>
              <div className="text-white font-bold text-lg mb-2">{t('fin.heroTitle')}</div>
              <div className="text-white/85 text-sm mb-4 leading-relaxed max-w-sm mx-auto">{t('fin.heroBody')}</div>
              <button onClick={() => { if (!leadMsg.trim()) setLeadMsg(t('fin.defaultMsg')); document.getElementById('finance-lead-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="bg-white text-[#0A3D62] px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all">
                {t('fin.heroCta')}
              </button>
              <div className="text-white/70 text-xs mt-3">{t('fin.heroNote')}</div>
            </div>

            {/* تواصل — اترك رسالة */}
            <div id="finance-lead-form" className="bg-white rounded-2xl overflow-hidden border border-blue-200 shadow-sm">
              <div className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-4 py-3">
                <div className="text-white font-bold text-sm">{t('fin.leadTitle')}</div>
                <div className="text-white/80 text-xs">{t('fin.leadSub')}</div>
              </div>
              <div className="p-4">
                {leadSent ? (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm text-center font-medium">
                    {t('fin.success')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder={t('form.name')} className={inputCls} />
                      <input value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder={t('form.phone')} className={inputCls} dir="ltr" />
                    </div>
                    <textarea value={leadMsg} onChange={e => setLeadMsg(e.target.value)} placeholder={t('fin.msgPh')} rows={3} className={inputCls + ' resize-none'} />
                    {leadErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{leadErr}</div>}
                    <button onClick={submitLead} disabled={leadSending}
                      className="w-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-2.5 rounded-xl font-bold text-sm shadow-md hover:opacity-95 transition-all disabled:opacity-50">
                      {leadSending ? t('form.sending') : t('form.send')}
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
              <span className="bg-white/20 text-white text-sm px-4 py-1.5 rounded-2xl border border-white/30 font-medium">{t('reg.badge')}</span>
              <h1 className="text-2xl font-bold mt-4 mb-2">{t('reg.title')}</h1>
              <p className="text-white/85 text-sm max-w-sm mx-auto">{t('reg.sub')}</p>
            </div>
          </div>
          <div className="p-4 space-y-4">

            {/* تسجيل الدخول / إنشاء حساب — بالإيميل وكلمة المرور */}
            <div className="bg-white rounded-2xl p-5 border-2 border-blue-200 shadow-sm">
              {user ? (
                <div className="text-center">
                  <div className="font-bold text-[#0A3D62] mb-1">{t('auth.loggedIn')}</div>
                  <div className="text-sm text-gray-600 mb-3">{user.email}</div>
                  <button onClick={() => setPage('office')} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow">
                    {t('auth.enterOfficePanel')}
                  </button>
                </div>
              ) : forgotOpen ? (
                <div>
                  {/* «نسيت كلمة المرور؟» — طلب بريد الحساب لإرسال رابط الاسترداد */}
                  <div className="font-bold text-[#0A3D62] mb-1">{t('auth.resetTitle')}</div>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    {t('auth.resetDesc')}
                  </p>
                  <label className="text-xs text-gray-700 font-semibold block mb-1">{t('auth.email')}</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitForgot()}
                    placeholder="name@example.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                  />
                  <button
                    onClick={submitForgot}
                    disabled={authBusy}
                    className="w-full mt-4 bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50"
                  >
                    {authBusy ? t('form.sending') : t('auth.sendResetLink')}
                  </button>
                  {authMsg && (
                    <div className={`mt-3 text-sm rounded-xl p-3 border ${authMsg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {authMsg.text}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setForgotOpen(false); setAuthMsg(null); }}
                    className="w-full mt-3 text-xs text-gray-500 font-semibold hover:text-[#0A3D62] transition-colors"
                  >
                    {t('auth.backToLogin')}
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
                      {t('auth.tabLogin')}
                    </button>
                    <button
                      onClick={() => { setAuthMode('signup'); setAuthMsg(null); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${authMode === 'signup' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t('auth.tabSignup')}
                    </button>
                  </div>

                  {authMode === 'signup' && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-700 font-semibold block mb-1">{t('auth.accountType')}</label>
                      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        <button type="button" onClick={() => setAuthRole('seeker')}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${authRole === 'seeker' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                          {t('auth.roleSeeker')}
                        </button>
                        <button type="button" onClick={() => setAuthRole('office')}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${authRole === 'office' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                          {t('auth.roleOffice')}
                        </button>
                      </div>
                    </div>
                  )}

                  <label className="text-xs text-gray-700 font-semibold block mb-1">{t('auth.email')}</label>
                  <input
                    type="email"
                    dir="ltr"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full mb-3 px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                  />

                  <label className="text-xs text-gray-700 font-semibold block mb-1">{t('auth.password')}</label>
                  <input
                    type="password"
                    dir="ltr"
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && authMode === 'login' && submitAuth()}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                  />

                  {authMode === 'login' && (
                    <div className="text-left mt-2">
                      <button
                        type="button"
                        onClick={() => { setForgotOpen(true); setAuthMsg(null); }}
                        className="text-xs text-[#1B6CA8] font-bold hover:underline"
                      >
                        {t('auth.forgot')}
                      </button>
                    </div>
                  )}

                  {authMode === 'signup' && (
                    <>
                      <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">{t('auth.confirmPassword')}</label>
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
                          <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">{t('auth.officeName')}</label>
                          <input
                            type="text"
                            value={authOfficeName}
                            onChange={(e) => setAuthOfficeName(e.target.value)}
                            placeholder={t('auth.officeNamePh')}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                          />
                          <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">{t('auth.officePhone')}</label>
                          <input
                            type="tel"
                            dir="ltr"
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value)}
                            placeholder="05XXXXXXXX"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400"
                          />
                          <div className="text-[11px] text-gray-400 mt-1">{t('auth.officePhoneHint')}</div>
                          <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">{t('auth.falOptional')}</label>
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
                          <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">{t('auth.nameOptional')}</label>
                          <input
                            type="text"
                            value={authSeekerName}
                            onChange={(e) => setAuthSeekerName(e.target.value)}
                            placeholder={t('auth.namePh')}
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
                    {authBusy ? t('auth.processing') : authMode === 'login' ? t('auth.tabLogin') : t('auth.tabSignup')}
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
                name: t('reg.searcherName'),
                desc: t('reg.searcherDesc'),
                features: [t('reg.sf1'), t('reg.sf2'), t('reg.sf3'), t('reg.sf4')],
                locked: [t('reg.sl1'), t('reg.sl2')],
                popular: false,
                cta: t('reg.searcherCta')
              },
              {
                name: t('reg.officeNameLabel'),
                desc: t('reg.officeDesc'),
                features: [t('reg.of1'), t('reg.of2'), t('reg.of3'), t('reg.of4'), t('reg.of5')],
                locked: [t('reg.ol1'), t('reg.ol2')],
                popular: true,
                cta: t('reg.officeCta')
              },
            ].map(plan => (
              <div key={plan.name} className={`bg-white rounded-2xl p-5 border-2 shadow-sm ${plan.popular ? 'border-green-400' : 'border-gray-200'}`}>
                {plan.popular && (
                  <div className="bg-gradient-to-l from-green-600 to-green-500 text-white text-xs px-4 py-1 rounded-xl inline-block mb-3 font-bold">
                    {t('reg.popular')}
                  </div>
                )}
                <div className="font-bold text-lg text-[#0A3D62] mb-1">{plan.name}</div>
                <div className="text-sm text-gray-600 mb-4">{plan.desc}</div>
                <div className="bg-green-600 text-white text-lg font-bold px-5 py-2 rounded-xl inline-block mb-1">{t('reg.free')}</div>
                <div className="text-xs text-gray-500 mb-4">{t('reg.limited')}</div>
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
              <div className="text-lg font-bold text-gray-900 mb-2">{t('officeGate.title')}</div>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{t('officeGate.body')}</p>
              <button onClick={() => { setPage('pricing'); setAuthMode('login'); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow">
                {t('officeGate.cta')}
              </button>
            </div>
          </div>
        )
      )}

      {/* تفاصيل الإعلان */}
      {selectedListing && (() => {
        const l = selectedListing;
        const isComm = l.sector === 'commercial';
        // مؤشر الحي الحقيقي (السكني فقط): متوسط الحي للنوع + الحكم. التجاري لا مؤشر له
        // بعد ⇒ يُعرض حال «قريباً/لا توجد بيانات كافية» بدلاً منه (لا رقم مُفبرك إطلاقاً).
        const m = mktAvg[l.hood];
        const fair = (!isComm && m) ? fairForType(m, l.type) : 0;
        const hasFair = !isComm && fair > 0;
        const st = hasFair ? getSt(l.adv, fair) : 'ok';
        const vColor = st === 'hi' ? '#F59E0B' : st === 'lo' ? '#10B981' : '#3B82F6';
        const ratio = hasFair ? l.adv / fair : 1;
        const diff = Math.abs(l.adv - fair);

        // ── المؤشر التجاري: متوسط الحي التجاري المحفوظ (commercial_prices) لنوع هذا الإعلان ──
        // القيمة ريال/م² سنوياً. إن وُجد متوسط محفوظ نعرضه (وحُكماً إن أمكن حساب سعر متر
        // الإعلان من مساحته)؛ وإلا تبقى الحالة الصادقة «قريباً». لا رقم مُفبرك إطلاقاً.
        const commAvg = isComm ? (commIndex[`${l.hood}|${l.commercialType}`]?.pricePerM2 ?? null) : null;
        const commSample = isComm ? (commIndex[`${l.hood}|${l.commercialType}`]?.sampleSize ?? null) : null;
        const listPerM2 = (isComm && l.area && l.area > 0) ? Math.round(l.adv / l.area) : null;
        const commHasIdx = commAvg != null && commAvg > 0;
        const commCmp = commHasIdx && listPerM2 != null;
        const commSt = commCmp ? getSt(listPerM2!, commAvg!) : 'ok';
        const commColor = commSt === 'hi' ? '#F59E0B' : commSt === 'lo' ? '#10B981' : '#3B82F6';
        const commRatio = commCmp ? listPerM2! / commAvg! : 1;
        const commDiff = commCmp ? Math.abs(listPerM2! - commAvg!) : 0;

        // معرض الصور المصنّفة → قائمة لقطات بمسمّيات عربية (نفس مصدر المعرض القديم، يغذّي الـ lightbox)
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
        if (!shots.length && l.images?.length) l.images.forEach((u, i) => shots.push({ label: `صورة ${i + 1}`, url: u }));
        const hasPhotos = shots.length > 0;
        const mainIdx = Math.min(detailShot, Math.max(0, shots.length - 1));
        const main = shots[mainIdx];
        const THUMBS = 5;
        const thumbs = shots.slice(0, THUMBS);
        const overflow = shots.length - THUMBS; // >0 ⇒ صور إضافية تُفتح عبر «+N»/المعرض

        // التفاصيل الرئيسية — الخانة تظهر فقط إن توفّرت قيمتها الحقيقية.
        // التجاري: المساحة/الواجهات/المواقف (لا غرف ولا دورات مياه كعدد).
        const keys: { icon: string; val: number; label: string }[] = [];
        if (l.area != null) keys.push({ icon: 'square_foot', val: l.area, label: 'م²' });
        if (isComm) {
          if (l.frontageCount != null) keys.push({ icon: 'storefront', val: l.frontageCount, label: 'واجهات' });
          if (l.parking != null) keys.push({ icon: 'local_parking', val: l.parking, label: 'مواقف' });
        } else {
          if (l.rooms != null) keys.push({ icon: 'bed', val: l.rooms, label: 'غرف' });
          if (l.baths != null) keys.push({ icon: 'bathtub', val: l.baths, label: 'دورات المياه' });
        }

        // المزايا — حقول منظّمة حقيقية فقط (المتوفّرة = true). لا مزايا مُفبركة.
        // التجاري: دورة مياه + مواقف (الحقول السكنية لا تُعرض للتجاري).
        const amen: string[] = [];
        if (isComm) {
          if (l.hasBathroom) amen.push('دورة مياه');
          if (l.parking && l.parking >= 1) amen.push(l.parking > 1 ? `${l.parking.toLocaleString('ar-SA')} مواقف` : 'موقف سيارة');
        } else {
          if (l.furnished) amen.push('مفروشة');
          if (l.kitchen) amen.push('مطبخ راكب');
          if (l.ac) amen.push('مكيّفة');
          if (l.parking && l.parking >= 1) amen.push(l.parking > 1 ? `${l.parking.toLocaleString('ar-SA')} مواقف` : 'موقف سيارة');
        }
        // تفاصيل تجارية نصّية إضافية (تظهر فقط إن وُجدت قيمتها الحقيقية)
        const commRows: { label: string; val: string }[] = [];
        if (isComm) {
          if (l.activity) commRows.push({ label: 'النشاط المسموح', val: l.activity });
          if (l.frontageWidth != null) commRows.push({ label: 'عرض الواجهة', val: `${l.frontageWidth.toLocaleString('ar-SA')} م` });
          if (l.floorInfo) commRows.push({ label: 'الدور/الوحدة', val: l.floorInfo });
        }

        // تواصل المكتب الحقيقي (offices.phone) — أزرار الاتصال/واتساب تظهر فقط بتوفّر رقم صالح
        const oWa = waNumber(selectedOffice?.phone);
        const oTel = telNumber(selectedOffice?.phone);
        const typeLabel = isComm ? commLabel(l.commercialType) : l.type;
        const waText = `مرحباً، لديّ استفسار عن إعلان: ${l.title || typeLabel} — ${l.hood}، ${l.adv.toLocaleString('en-US')} ريال/سنة.`;
        const maps = listingMapsHref(l);

        // عقارات مشابهة: نفس الحي ونفس القطاع، الأقرب نوعاً أولاً، باستثناء الحالي، حد 3
        // (التجاري فارغ الآن ⇒ القسم يُخفى تلقائياً — لا بطاقات مُفبركة).
        const simSectorOf = (x: UIListing) => (x.sector === 'commercial' ? 'commercial' : 'residential');
        const simMatch = (x: UIListing) => isComm ? x.commercialType === l.commercialType : x.type === l.type;
        const similar = [...listings.filter((x) => x.hood === l.hood && x.id !== l.id && simSectorOf(x) === (isComm ? 'commercial' : 'residential'))]
          .sort((a, b) => Number(simMatch(b)) - Number(simMatch(a)))
          .slice(0, 3);

        return (
          <div onClick={() => setSelectedListing(null)} className="fixed inset-0 bg-black/60 z-[1000] flex items-end sm:items-center justify-center sm:p-4 overflow-auto">
            <div dir="rtl" onClick={(e) => e.stopPropagation()} className="listing-detail relative bg-white w-full sm:max-w-5xl rounded-t-2xl sm:rounded-2xl max-h-[94vh] sm:max-h-[92vh] overflow-auto">
              <button onClick={() => setSelectedListing(null)} className="ld-close" aria-label="إغلاق">{msi('close')}</button>

              <div className="ld-grid">
                {/* ── المعرض (الصورة الكبيرة + الشارات العائمة + شريط المصغّرات + زر التكبير) ── */}
                <div className="ld-gallery">
                  <div className="ld-main" onClick={() => hasPhotos && setLightbox({ shots, idx: mainIdx })}>
                    {main
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={main.url} alt={main.label} />
                      : <div className="ld-main-ph">{msi('home_work')}</div>}
                    <div className="ld-pills">
                      <span className="ld-pill"><span className="dot" />{t('detail.available')}</span>
                      <span className="ld-pill">{msi(isComm ? 'storefront' : 'home_work')}{typeLabel}</span>
                    </div>
                    {hasPhotos && (
                      <button className="ld-zoom" onClick={(e) => { e.stopPropagation(); setLightbox({ shots, idx: mainIdx }); }} aria-label={t('detail.viewPhotos')}>
                        {msi('zoom_in')}<span>{t('detail.viewPhotos')}{shots.length > 1 ? ` (${nf(shots.length)})` : ''}</span>
                      </button>
                    )}
                    {main && <span className="ld-caption">{main.label}</span>}
                  </div>
                  {shots.length > 1 && (
                    <div className="ld-thumbs">
                      {thumbs.map((s, i) => {
                        const isMore = overflow > 0 && i === THUMBS - 1;
                        return (
                          <button key={i} className={`ld-thumb${i === mainIdx && !isMore ? ' is-active' : ''}`}
                            onClick={() => (isMore ? setLightbox({ shots, idx: i }) : setDetailShot(i))} aria-label={s.label}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.url} alt={s.label} />
                            {isMore && <span className="more">+{(overflow + 1).toLocaleString('ar-SA')}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── لوحة المعلومات (قابلة للتمرير) ── */}
                <div className="ld-info">
                  <div className="ld-head">
                    <h2 className="ld-title">{l.title || `${typeLabel} — ${l.hood}`}</h2>
                    <div className="ld-loc">{msi('location_on')}<span>{l.hood}{lang === 'en' ? ', ' : '، '}{t('card.city')}</span></div>
                    <div className="ld-price-row">
                      <div className="ld-price">{nf(l.adv)}<span>{t('card.perYear')}</span></div>
                      <span className={`ld-cond ${l.cond}`}>{l.condLabel || t('detail.condUnknown')}</span>
                    </div>
                  </div>

                  {/* مؤشر الحي — السكني: مقياس نصف دائري بالحكم الحقيقي + متوسط الحي + الفرق.
                      التجاري: حالة صادقة «قريباً / لا توجد بيانات كافية» (لا حكم/رقم مُفبرك). */}
                  {isComm ? (
                    commHasIdx ? (
                      // متوسط تجاري محفوظ لهذا (الحي+النوع) ⇒ نعرضه؛ ومع مساحة الإعلان نحسب الحكم
                      <div className="ld-card ld-gauge">
                        <div className="ld-card-h">{msi('analytics')}<span>المؤشر التجاري</span></div>
                        {commCmp && <PriceGauge ratio={commRatio} color={commColor} />}
                        {commCmp && <div className="ld-verdict" style={{ color: commColor }}>{rl(commSt)}</div>}
                        <div className="ld-gauge-rows">
                          <div className="row"><span>متوسط الحي التجاري ({commLabel(l.commercialType)})</span><b>{commAvg!.toLocaleString('ar-SA')} ريال/م²</b></div>
                          {commSample != null && commSample > 0 && <div className="row"><span>عدد الصفقات</span><b>{commSample.toLocaleString('ar-SA')}</b></div>}
                          {listPerM2 != null && <div className="row"><span>سعر متر هذا الإعلان</span><b>{listPerM2.toLocaleString('ar-SA')} ريال/م²</b></div>}
                          {commCmp && (
                            <div className="row cmp" style={{ color: commColor }}>
                              {listPerM2! > commAvg! ? `أعلى من متوسط الحي بـ ${commDiff.toLocaleString('ar-SA')} ريال/م²`
                                : listPerM2! < commAvg! ? `أقل من متوسط الحي بـ ${commDiff.toLocaleString('ar-SA')} ريال/م²`
                                  : 'مطابق لمتوسط الحي'}
                            </div>
                          )}
                        </div>
                        <p className="ld-gauge-note">{listPerM2 == null
                          ? 'أضف مساحة الإعلان لمقارنة سعر المتر بمتوسط الحي التجاري.'
                          : `بناءً على المتوسط التجاري المحفوظ لـ${commLabel(l.commercialType)} في حي ${l.hood} (ريال/م² سنوياً).`}</p>
                      </div>
                    ) : (
                      // لا متوسط تجاري محفوظ بعد لهذا (الحي+النوع) ⇒ حالة صادقة «قريباً»
                      <div className="ld-card ld-soon-card">
                        <div className="ld-card-h">{msi('analytics')}<span>المؤشر التجاري</span></div>
                        <div className="ld-soon">
                          {msi('hourglass_empty')}
                          <div>
                            <div className="t">{t('comm.soonShort')}</div>
                            <p>{t('comm.indexSoon')}</p>
                          </div>
                        </div>
                      </div>
                    )
                  ) : hasFair ? (
                    <div className="ld-card ld-gauge">
                      <div className="ld-card-h">{msi('analytics')}<span>مؤشر الحي</span></div>
                      <PriceGauge ratio={ratio} color={vColor} />
                      <div className="ld-verdict" style={{ color: vColor }}>{rl(st)}</div>
                      <div className="ld-gauge-rows">
                        <div className="row"><span>متوسط الحي ({l.type})</span><b>{fair.toLocaleString('ar-SA')} ريال</b></div>
                        <div className="row"><span>هذا الإعلان</span><b>{l.adv.toLocaleString('ar-SA')} ريال</b></div>
                        <div className="row cmp" style={{ color: vColor }}>
                          {l.adv > fair ? `أعلى من متوسط الحي بـ ${diff.toLocaleString('ar-SA')} ريال`
                            : l.adv < fair ? `أقل من متوسط الحي بـ ${diff.toLocaleString('ar-SA')} ريال`
                              : 'مطابق لمتوسط الحي'}
                        </div>
                      </div>
                      <p className="ld-gauge-note">بناءً على متوسط إيجار {l.type} في حي {l.hood} (مؤشر أسعار الحي).</p>
                    </div>
                  ) : null}

                  {keys.length > 0 && (
                    <div className="ld-keys">
                      {keys.map((k) => (
                        <div key={k.label} className="ld-key">
                          {msi(k.icon)}
                          <b>{k.val.toLocaleString('ar-SA')}</b>
                          <span>{k.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {commRows.length > 0 && (
                    <div className="ld-card">
                      <div className="ld-card-h">{msi('storefront')}<span>تفاصيل تجارية</span></div>
                      <div className="ld-comm-rows">
                        {commRows.map((r) => (
                          <div key={r.label} className="row"><span>{r.label}</span><b>{r.val}</b></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {amen.length > 0 && (
                    <div className="ld-card">
                      <div className="ld-card-h">{msi('verified')}<span>{t('detail.amenities')}</span></div>
                      <div className="ld-amen">
                        {amen.map((a) => (
                          <div key={a} className="ld-amen-item">{msi('check_circle')}<span>{a}</span></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {l.description && <p className="ld-desc">{l.description}</p>}

                  {/* المكتب المعلِن — بيانات حقيقية من offices عبر office_id (يظهر ما توفّر فقط) */}
                  {(selectedOffice?.name || selectedOffice?.fal_license || l.fal) && (
                    <div className="ld-office">
                      <div className="ld-office-l">{t('detail.advertisingOffice')}</div>
                      {selectedOffice?.name && (
                        <div className="ld-office-name">{msi('apartment')}<span className="nm">{selectedOffice.name}</span>
                          {selectedOffice.verified && <span className="vbadge">{t('detail.verified')}</span>}
                        </div>
                      )}
                      {(selectedOffice?.fal_license || l.fal) && (
                        <div className="ld-office-fal">{t('detail.falLicense')} <span dir="ltr">{selectedOffice?.fal_license || l.fal}</span></div>
                      )}
                    </div>
                  )}

                  {/* أزرار التواصل الحقيقية — اتصال/واتساب من رقم المكتب، خرائط من موقع الوحدة (يظهر المتوفّر فقط) */}
                  {(oTel || oWa || maps) && (
                    <div className="ld-actions">
                      {oTel && <a href={`tel:${oTel}`} className="ld-btn call">{msi('call')}{t('detail.callNow')}</a>}
                      {oWa && <a href={`https://wa.me/${oWa}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer" className="ld-btn wa">{msi('chat')}{t('detail.whatsapp')}</a>}
                      {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="ld-btn maps">{msi('location_on')}{t('detail.googleMaps')}</a>}
                    </div>
                  )}

                  {/* نموذج «تواصل بخصوص هذا الإعلان» — يُحفظ في leads مربوطاً بالمكتب (office_id) */}
                  {ctSent ? (
                    <div className="ld-sent">{t('detail.contactSent')}</div>
                  ) : ctOpen ? (
                    <div className="ld-inq">
                      <div className="ld-inq-row">
                        <input value={ctName} onChange={e => setCtName(e.target.value)} placeholder={t('form.name')} className={inputCls} />
                        <input value={ctPhone} onChange={e => setCtPhone(e.target.value)} placeholder={t('form.phone')} className={inputCls} dir="ltr" />
                      </div>
                      <textarea value={ctMsg} onChange={e => setCtMsg(e.target.value)} placeholder={t('detail.contactMsgPh')} rows={2} className={inputCls + ' resize-none'} />
                      {ctErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{ctErr}</div>}
                      <button onClick={submitListingContact} disabled={ctSending} className="ld-btn primary block">{ctSending ? t('form.sending') : t('detail.sendContact')}</button>
                    </div>
                  ) : (
                    <button onClick={() => { track('feature_use', null, { feature: 'contact' }); setCtOpen(true); }} className="ld-btn primary block">{msi('forum')}{t('detail.contactAbout')}</button>
                  )}
                </div>
              </div>

              {/* ── عقارات مشابهة في نفس الحي (حقيقية فقط — تُخفى إن لم توجد) ── */}
              {similar.length > 0 && (
                <div className="ld-similar">
                  <h3>{t('detail.similarIn')} {l.hood}</h3>
                  <div className="ld-sim-grid">
                    {similar.map((s) => {
                      const simg = s.imagesByCategory?.facade ?? (s.images && s.images.length ? s.images[0] : null);
                      return (
                        <button key={s.id} className="ld-sim-card" onClick={() => openListing(s)}>
                          <div className="ld-sim-img">
                            {simg
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={simg} alt={s.title} />
                              : <div className="ph">{msi('home_work')}</div>}
                            <span className="ld-sim-price">{s.adv.toLocaleString('ar-SA')} ريال</span>
                          </div>
                          <div className="ld-sim-body">
                            <div className="ld-sim-title">{s.title || `${s.type} — ${s.hood}`}</div>
                            <div className="ld-sim-specs">
                              {s.rooms != null && <span>{msi('bed')}{s.rooms.toLocaleString('ar-SA')} غرف</span>}
                              {s.area != null && <span>{msi('square_foot')}{s.area.toLocaleString('ar-SA')} م²</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ═══ معرض الصور بملء الشاشة (lightbox) — فوق بطاقة التفاصيل، بلا مكتبة خارجية ═══ */}
      {lightbox && (() => {
        const { shots, idx } = lightbox;
        const cur = shots[idx];
        const many = shots.length > 1;
        return (
          <div
            dir="rtl"
            onClick={() => setLightbox(null)}
            onTouchStart={(e) => { lbTouch.current = e.touches[0]?.clientX ?? null; }}
            onTouchEnd={(e) => {
              const start = lbTouch.current;
              if (start == null || !many) return;
              const dx = (e.changedTouches[0]?.clientX ?? start) - start;
              if (Math.abs(dx) > 45) lbGo(dx < 0 ? 1 : -1); // سحب لليسار = التالي
              lbTouch.current = null;
            }}
            className="fixed inset-0 z-[2100] bg-black/90 flex items-center justify-center select-none"
          >
            {/* شريط علوي: التسمية + العدّاد + إغلاق */}
            <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
              <div className="text-sm font-bold flex items-center gap-2">
                <span>{cur.label}</span>
                {many && <span className="text-white/70 text-xs">{(idx + 1).toLocaleString('ar-SA')} / {shots.length.toLocaleString('ar-SA')}</span>}
              </div>
              <button onClick={() => setLightbox(null)} aria-label="إغلاق"
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-2xl leading-none flex items-center justify-center transition-colors">×</button>
            </div>

            {/* الصورة — تحجيم contain (بلا قص) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={cur.label} onClick={(e) => e.stopPropagation()}
              className="max-w-[92vw] max-h-[78vh] object-contain rounded-lg shadow-2xl" />

            {/* أسهم التنقّل (RTL: يمين = السابق، يسار = التالي) */}
            {many && (
              <>
                <button onClick={(e) => { e.stopPropagation(); lbGo(-1); }} aria-label="السابق"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); lbGo(1); }} aria-label="التالي"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-colors">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg>
                </button>
              </>
            )}

            {/* شريط مصغّرات سفلي — قفزة مباشرة لأي صورة */}
            {many && (
              <div className="absolute bottom-3 inset-x-0 flex gap-2 justify-center overflow-x-auto px-4" onClick={(e) => e.stopPropagation()}>
                {shots.map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={s.url} alt={s.label} onClick={() => setLightbox({ shots, idx: i })}
                    className={`h-12 w-16 object-cover rounded-md cursor-pointer flex-shrink-0 border-2 transition-all ${i === idx ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`} />
                ))}
              </div>
            )}
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
              <div><h2 className="font-bold text-gray-900 mb-1">٧. التواصل</h2><p>لأي استفسار بخصوص الخصوصية، تواصل معنا عبر نموذج «اترك رسالة» في المنصة.</p></div>            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 text-gray-700 leading-relaxed text-sm space-y-4">
              <h1 className="text-xl font-bold text-gray-900">شروط الاستخدام</h1>
              <p className="text-xs text-gray-400">آخر تحديث: 2026</p>
              <p>باستخدامك منصة «مؤشر العقارية» فإنك توافق على الالتزام بهذه الشروط.</p>
              <div><h2 className="font-bold text-gray-900 mb-1">١. طبيعة الخدمة</h2><p>توفّر المنصة أداة استرشادية لمقارنة أسعار الإيجار بمتوسطات السوق، إضافةً لعرض إعلانات عقارية. «مؤشر أسعار الحي» (السعر المتوسط لعدد الصفقات المماثلة بنفس الحي) تقديري للاسترشاد فقط ولا يُعدّ تقييماً رسمياً مُلزِماً.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٢. مسؤولية المحتوى</h2><p>المكاتب والمعلنون مسؤولون عن دقة بيانات إعلاناتهم وصحّة تراخيصهم. لا تتحمل المنصة مسؤولية أي اتفاق يتم خارجها بين الأطراف.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٣. الاستخدام المقبول</h2><p>يُمنع استخدام المنصة لأي غرض غير نظامي أو لنشر بيانات مضلّلة أو إعلانات وهمية.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٤. حدود المسؤولية</h2><p>تُقدَّم الخدمة «كما هي»، ولا تضمن المنصة خلوّها من الأخطاء أو دقّة كل البيانات المعروضة بشكل مطلق.</p></div>
              <div><h2 className="font-bold text-gray-900 mb-1">٥. التعديلات</h2><p>يحق للمنصة تحديث هذه الشروط، ويسري التحديث فور نشره على هذه الصفحة.</p></div>            </div>
          )}
        </div>
      )}

      {/* ═══ عن المنصة ═══ */}
      {page === 'about' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-8 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#EAF0F6] rounded-t-3xl" />
            <div className="relative z-10">
              <h1 className="text-2xl font-bold mb-2">{t('about.title')}</h1>
              <p className="text-white/85 text-sm max-w-md mx-auto leading-relaxed">{t('about.sub')}</p>
            </div>
          </div>
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
            <div className="bg-white rounded-2xl border border-[#cfd9e4] shadow-sm p-6 text-[#33414f] text-sm leading-relaxed space-y-4">
              <div>
                <h2 className="font-bold text-[#0f1a28] text-base mb-1 sec-underline">{t('about.ideaTitle')}</h2>
                <p>{t('about.ideaBody')}</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { t: t('about.p1t'), d: t('about.p1d') },
                  { t: t('about.p2t'), d: t('about.p2d') },
                  { t: t('about.p3t'), d: t('about.p3d') },
                ].map((f) => (
                  <div key={f.t} className="bg-[#f7fafd] border border-[#dde5ee] rounded-xl p-4">
                    <div className="font-bold text-[#0A3D62] text-sm mb-1">{f.t}</div>
                    <div className="text-xs text-[#33414f] leading-relaxed">{f.d}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={() => go('search')} className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">{t('about.ctaSearch')}</button>
                <button onClick={() => { setPage('privacy'); if (typeof window !== 'undefined') window.scrollTo(0, 0); }} className="bg-white border border-[#cfd9e4] text-[#0A3D62] px-5 py-2.5 rounded-xl font-bold text-sm">{t('foot.privacy')}</button>
                <button onClick={() => { setPage('terms'); if (typeof window !== 'undefined') window.scrollTo(0, 0); }} className="bg-white border border-[#cfd9e4] text-[#0A3D62] px-5 py-2.5 rounded-xl font-bold text-sm">{t('foot.terms')}</button>
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
              <h1 className="text-xl font-bold mb-1">{t('inq.h1')}</h1>
              <p className="text-white/85 text-sm">{t('inq.sub')}</p>
            </div>
          </div>
          <div className="px-4 pt-4 pb-6 max-w-xl mx-auto">
            <div className="bg-white rounded-2xl border border-[#cfd9e4] shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-4 py-3">
                <div className="text-white font-bold text-sm">{t('inq.cardTitle')}</div>
                <div className="text-white/80 text-xs">{t('inq.cardSub')}</div>
              </div>
              <div className="p-4">
                {inqSent ? (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm text-center font-medium">
                    {t('inq.success')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={inqName} onChange={e => setInqName(e.target.value)} placeholder={t('form.name')} className={inputCls} />
                      <input value={inqPhone} onChange={e => setInqPhone(e.target.value)} placeholder={t('form.phone')} className={inputCls} dir="ltr" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('inq.hoodOptional')}</label>
                        <select value={inqHood} onChange={e => setInqHood(e.target.value)} className={selectCls}>
                          <option value="">{t('inq.unspecified')}</option>
                          {Object.keys(mktAvg).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-700 block mb-1 font-semibold">{t('inq.typeOptional')}</label>
                        <select value={inqType} onChange={e => setInqType(e.target.value)} className={selectCls}>
                          <option value="">{t('inq.unspecified')}</option>
                          {['شقة', 'فيلا', 'دور', 'دوبلكس', 'استوديو'].map(ut => <option key={ut} value={ut}>{ut}</option>)}
                        </select>
                      </div>
                    </div>
                    <textarea value={inqMsg} onChange={e => setInqMsg(e.target.value)} placeholder={t('inq.msgPh')} rows={3} className={inputCls + ' resize-none'} />
                    {inqErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{inqErr}</div>}
                    <button onClick={submitInquiry} disabled={inqSending}
                      className="w-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-2.5 rounded-xl font-bold text-sm shadow-md hover:opacity-95 transition-all disabled:opacity-50">
                      {inqSending ? t('form.sending') : t('inq.send')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* التذييل المشترك — على كل الصفحات العامة (هوية موحّدة) */}
      <SiteFooter onNavigate={go} />
    </div>
  );
}

// ═══ لوحة تحكم المكتب الكاملة ═══
function OfficeDashboard({ mktAvg }: { mktAvg: MktAvg }) {
  const [offPage, setOffPage] = useState<'dashboard'|'listings'|'add'|'calc'|'inquiries'|'support'|'profile'|'settings'>('dashboard');
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
  // القطاع + النوع التجاري + الحقول التجارية (تُستخدم عند fSector='commercial')
  const [fSector, setFSector] = useState<'residential' | 'commercial'>('residential');
  const [fCommType, setFCommType] = useState('shop');     // shop | office | showroom
  const [fFrontage, setFFrontage] = useState('');         // عدد الواجهات
  const [fFrontageWidth, setFFrontageWidth] = useState(''); // عرض الواجهة (م)
  const [fActivity, setFActivity] = useState('');         // النشاط المسموح (حر)
  const [fHasBathroom, setFHasBathroom] = useState('');   // '' غير محدّد | yes | no
  const [fFloorInfo, setFFloorInfo] = useState('');       // الدور/الوحدة (حر)
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
  // موقع الوحدة (اختياري): طريقتان — لصق رابط خرائط Google أو تحديد على الخريطة.
  // الإحداثيات تُستخرج من الرابط إن أمكن؛ الرابط المختصر غير القابل للفك يُخزَّن كما هو.
  const [fLocMethod, setFLocMethod] = useState<'link' | 'map'>('link');
  const [fMapsLink, setFMapsLink] = useState('');
  const [fLat, setFLat] = useState<number | null>(null);
  const [fLng, setFLng] = useState<number | null>(null);
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
  // وضع التعديل: معرّف الإعلان قيد التعديل + صوره المصنّفة الحالية (تبقى ما لم تُستبدل)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPhotos, setExistingPhotos] = useState<ImagesByCategory | null>(null);
  const [editLoading, setEditLoading] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listsErr, setListsErr] = useState('');

  // ── بيانات المكتب الحقيقية (مربوطة بالحساب الحالي عبر owner_id) ──
  const [myOffice, setMyOffice] = useState<{ id: string; name: string; fal_license: string | null; phone: string | null; email: string | null; bio: string | null; verified: boolean; status: string | null; active: boolean } | null>(null);
  const [myListings, setMyListings] = useState<{ id: string; title: string; advertised: number; status: string; rejection_note: string | null }[]>([]);
  const [myLeads, setMyLeads] = useState<{ id: string; name: string; phone: string; message: string | null; created_at: string; handled?: boolean | null; kind?: string | null }[]>([]);
  const [offLoaded, setOffLoaded] = useState(false);
  // «تواصل مع المنصة» — رسالة دعم من المكتب لإدارة المنصة (تُحفظ في leads بنوع support)
  const [supSubject, setSupSubject] = useState('');
  const [supMsg, setSupMsg] = useState('');
  const [supPhone, setSupPhone] = useState(''); // جوال المكتب للرد عبر واتساب (يُملأ تلقائياً إن كان محفوظاً)
  const [supSending, setSupSending] = useState(false);
  const [supSent, setSupSent] = useState(false);
  const [supErr, setSupErr] = useState('');

  // «ملف المكتب» — حقول قابلة للتعديل تُحفظ فعلاً في offices (الاسم/الجوال/البريد/النبذة).
  const [pfName, setPfName] = useState('');
  const [pfPhone, setPfPhone] = useState('');
  const [pfEmail, setPfEmail] = useState('');
  const [pfBio, setPfBio] = useState('');
  const [pfSaving, setPfSaving] = useState(false);
  const [pfMsg, setPfMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // نموذج إنشاء المكتب داخل اللوحة (يضمن ربط أي حساب بمكتب بشكل موثوق)
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newFal, setNewFal] = useState('');
  const [newPhone, setNewPhone] = useState(''); // جوال المكتب (إلزامي عند الإنشاء داخل اللوحة)
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
    // نتدرّج: مع phone+email+bio إن وُجدت (بعد office_profile_fields.sql)، ثم مع phone
    // فقط (بعد add_office_phone.sql)، وإلا بالأعمدة الأساسية — فلا تنكسر القراءة قبل SQL.
    type OffRow = { id: string; name: string; fal_license: string | null; phone?: string | null; email?: string | null; bio?: string | null; verified: boolean; status: string | null; active: boolean };
    let offsRes = await sb.from('offices').select('id,name,fal_license,phone,email,bio,verified,status,active').eq('owner_id', uid).order('created_at', { ascending: false }).limit(1);
    if (offsRes.error) {
      offsRes = await sb.from('offices').select('id,name,fal_license,phone,verified,status,active').eq('owner_id', uid).order('created_at', { ascending: false }).limit(1) as typeof offsRes;
    }
    if (offsRes.error) {
      offsRes = await sb.from('offices').select('id,name,fal_license,verified,status,active').eq('owner_id', uid).order('created_at', { ascending: false }).limit(1) as typeof offsRes;
    }
    const off = ((offsRes.data && offsRes.data[0]) || null) as OffRow | null;
    setMyOffice(off ? { ...off, phone: off.phone ?? null, email: off.email ?? null, bio: off.bio ?? null } : null);
    if (off) {
      const { data: ls } = await sb.from('listings').select('id,title,advertised,status,rejection_note').eq('office_id', off.id).order('created_at', { ascending: false });
      setMyListings((ls ?? []) as typeof myListings);
      // الاستفسارات الحقيقية الموجّهة لهذا المكتب (تتطلب سياسة leads_office_read)
      // نحاول مع عمودي handled/kind، وإن غابا (قبل SQL) نرجع للأساسيات.
      let lds: { data: unknown; error: { code?: string } | null } =
        await sb.from('leads').select('id,name,phone,message,created_at,handled,kind').eq('office_id', off.id).order('created_at', { ascending: false });
      if (lds.error) lds = await sb.from('leads').select('id,name,phone,message,created_at').eq('office_id', off.id).order('created_at', { ascending: false });
      // رسائل الدعم الموجّهة للمنصة لا تُعرض ضمن استفسارات العملاء
      setMyLeads(((lds.data ?? []) as typeof myLeads).filter((l) => l.kind !== 'support'));
    } else {
      setMyListings([]);
      setMyLeads([]);
    }
    setOffLoaded(true);
  };

  // تفريغ نموذج الإعلان (يُستدعى عند فتح «إضافة إعلان» حتى لا تبقى قيم تعديل سابق)
  const resetListingForm = () => {
    setFType('شقة'); setFHood('النرجس'); setFRent(''); setFArea('');
    setFRooms('2'); setFBaths('1'); setFCond('حالة جيدة');
    setFFurniture(''); setFKitchen(''); setFAc(''); setFParking(''); setFDesc('');
    setFSector('residential'); setFCommType('shop'); setFFrontage(''); setFFrontageWidth('');
    setFActivity(''); setFHasBathroom(''); setFFloorInfo('');
    setFLocMethod('link'); setFMapsLink(''); setFLat(null); setFLng(null);
    Object.values(fPhotos).forEach((p) => { if (p) URL.revokeObjectURL(p.preview); });
    setFPhotos({});
    setEditingId(null); setExistingPhotos(null); setPublishMsg(null);
  };

  // الصورة المصنّفة الحالية لخانة معيّنة (في وضع التعديل) — تُعرض وتُحفظ ما لم تُستبدل
  const existingUrlFor = (key: string): string | null => {
    const cat = existingPhotos;
    if (!cat) return null;
    if (key === 'facade') return cat.facade ?? null;
    if (key === 'hall') return cat.hall ?? null;
    if (key === 'majlis') return cat.majlis ?? null;
    if (key === 'kitchen') return cat.kitchen ?? null;
    if (key.startsWith('bed')) return cat.bedrooms?.[parseInt(key.slice(3), 10)] ?? null;
    if (key.startsWith('bath')) return cat.bathrooms?.[parseInt(key.slice(4), 10)] ?? null;
    return null;
  };

  // «تعديل» — يجلب الإعلان كاملاً ويملأ نفس نموذج الإضافة، والحفظ يحدّث الصف القائم.
  // RLS (listings_owner) يضمن أن المكتب لا يفتح إلا إعلاناته هو.
  const startEdit = async (id: string) => {
    setEditLoading(id); setListsErr('');
    const sb = createClient();
    // نتدرّج كقراءة useAppData: مع الأعمدة الاختيارية أولاً ثم الأساسية إن غابت
    let r = await sb.from('listings')
      .select('id,type,hood,advertised,area,rooms,baths,condition,cond_label,furnished,kitchen,ac,parking,description,images,images_by_category,lat,lng,maps_url,sector,commercial_type,frontage_count,frontage_width,allowed_activity,has_bathroom,floor_info')
      .eq('id', id).single();
    if (r.error) {
      r = await sb.from('listings')
        .select('id,type,hood,advertised,area,rooms,baths,condition,cond_label,furnished,kitchen,ac,parking,description,images,images_by_category,lat,lng,maps_url')
        .eq('id', id).single();
    }
    if (r.error) {
      r = await sb.from('listings')
        .select('id,type,hood,advertised,area,rooms,baths,condition,cond_label,furnished,kitchen,ac,parking,description,images,images_by_category,lat,lng')
        .eq('id', id).single();
    }
    if (r.error) {
      r = await sb.from('listings')
        .select('id,type,hood,advertised,area,rooms,baths,condition,cond_label,furnished,description,images')
        .eq('id', id).single();
    }
    if (r.error || !r.data) {
      setListsErr('تعذّر فتح الإعلان للتعديل: ' + (r.error?.message ?? 'غير موجود'));
      setEditLoading(null); return;
    }
    const d = r.data as Record<string, unknown>;
    // القطاع + الحقول التجارية (إن وُجدت أعمدتها) — السكني افتراضي
    const dSector: 'residential' | 'commercial' = (d.sector as string) === 'commercial' ? 'commercial' : 'residential';
    setFSector(dSector);
    setFCommType((d.commercial_type as string) || 'shop');
    setFFrontage(d.frontage_count != null ? String(d.frontage_count) : '');
    setFFrontageWidth(d.frontage_width != null ? String(d.frontage_width) : '');
    setFActivity((d.allowed_activity as string) || '');
    setFHasBathroom(d.has_bathroom == null ? '' : d.has_bathroom ? 'yes' : 'no');
    setFFloorInfo((d.floor_info as string) || '');
    setFType(dSector === 'commercial' ? 'شقة' : ((d.type as string) || 'شقة'));
    setFHood((d.hood as string) || 'النرجس');
    setFRent(d.advertised != null ? String(d.advertised) : '');
    setFArea(d.area != null ? String(d.area) : '');
    setFRooms(d.rooms != null ? String(d.rooms) : '2');
    setFBaths(d.baths != null ? String(d.baths) : '1');
    setFCond((d.cond_label as string) || 'حالة جيدة');
    setFFurniture(d.furnished == null ? '' : d.furnished ? 'مفروشة' : 'غير مفروشة');
    setFKitchen(d.kitchen == null ? '' : d.kitchen ? 'راكب' : 'غير راكب');
    setFAc(d.ac == null ? '' : d.ac ? 'مكيّفة' : 'غير مكيّفة');
    setFParking(d.parking == null ? '' : String(d.parking));
    setFDesc((d.description as string) || '');
    // الموقع المحفوظ: إحداثيات ⇒ نعرض الخريطة بدبوسها؛ رابط فقط ⇒ وضع اللصق
    const hasCoords = typeof d.lat === 'number' && typeof d.lng === 'number';
    setFLat(hasCoords ? (d.lat as number) : null);
    setFLng(hasCoords ? (d.lng as number) : null);
    setFMapsLink((d.maps_url as string) || '');
    setFLocMethod(hasCoords && !d.maps_url ? 'map' : 'link');
    Object.values(fPhotos).forEach((p) => { if (p) URL.revokeObjectURL(p.preview); });
    setFPhotos({});
    setExistingPhotos((d.images_by_category as ImagesByCategory) ?? null);
    setPublishMsg(null);
    setEditingId(id);
    setAddStep(1);
    setOffPage('add');
    setEditLoading(null);
  };

  // «حذف» — بتأكيد صريح؛ count يكشف الحجب الصامت بـ RLS (0 صفوف بلا خطأ)
  const deleteListing = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
    setDeletingId(id); setListsErr('');
    const sb = createClient();
    const { error, count } = await sb.from('listings').delete({ count: 'exact' }).eq('id', id);
    if (error) setListsErr('تعذّر الحذف: ' + error.message);
    else if (!count) setListsErr('لم يُحذف الإعلان — لا تملك صلاحية حذفه.');
    else {
      if (editingId === id) resetListingForm();
      await reloadOffice();
    }
    setDeletingId(null);
  };

  // إنشاء المكتب مباشرة وأنت داخل (جلسة فعّالة ⇒ تتجاوز كل مشاكل التسجيل)
  const createOffice = async () => {
    const name = newOfficeName.trim();
    if (!name) { setCreateOfficeErr('أدخل اسم المكتب'); return; }
    // جوال المكتب إلزامي ومُتحقَّق — تستخدمه الإدارة للرد عبر واتساب.
    if (!isSaudiMobile(newPhone)) { setCreateOfficeErr('أدخل رقم جوال سعودي صحيح للمكتب (مثال: 05XXXXXXXX).'); return; }
    setCreatingOffice(true); setCreateOfficeErr('');
    const sb = createClient();
    const uid = await currentUid(sb);
    if (!uid) { setCreateOfficeErr('انتهت جلستك — سجّل خروج ثم دخول من جديد.'); setCreatingOffice(false); return; }
    const phone = newPhone.trim();
    // نتدرّج بأمان: مع phone ثم بدونه إن كان العمود غير موجود بعد (قبل add_office_phone.sql).
    let { error } = await sb.from('offices').insert({ owner_id: uid, name, fal_license: newFal.trim() || null, phone });
    if (error && (error.code === 'PGRST204' || error.code === '42703')) {
      ({ error } = await sb.from('offices').insert({ owner_id: uid, name, fal_license: newFal.trim() || null }));
    }
    if (error) { setCreateOfficeErr('تعذّر الإنشاء: ' + error.message); setCreatingOffice(false); return; }
    await sb.from('profiles').update({ role: 'office', full_name: name }).eq('id', uid);
    setNewOfficeName(''); setNewFal(''); setNewPhone('');
    await reloadOffice();
    setCreatingOffice(false);
  };

  // إرسال رسالة دعم للمنصة — بيانات المكتب (الاسم/الرخصة/الجوال/البريد) تُرفق تلقائياً
  const submitSupport = async () => {
    if (!supSubject.trim() && !supMsg.trim()) { setSupErr('اكتب موضوعاً أو رسالة أولاً.'); return; }
    // الجوال اختياري في الدعم: إن أُدخل وجب أن يكون صحيحاً؛ وإن تُرك فارغاً نرجع للبريد (رد بالإيميل فقط).
    const phoneInput = supPhone.trim();
    if (phoneInput && !isSaudiMobile(phoneInput)) {
      setSupErr('رقم الجوال غير صحيح — أدخل رقماً سعودياً (مثال: 05XXXXXXXX) أو اتركه فارغاً.');
      return;
    }
    setSupSending(true); setSupErr('');
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      const email = session?.user?.email ?? '—';
      // جوال المكتب المعتمد للرد: المُدخل إن وُجد، وإلا المحفوظ على صف المكتب.
      const officePhone = phoneInput || (myOffice?.phone ?? '');
      // احفظ الجوال على صف المكتب إن كان جديداً/مختلفاً (يفيد الرسائل القادمة) — فشل غياب العمود يُتجاهل.
      if (phoneInput && myOffice?.id && phoneInput !== (myOffice?.phone ?? '')) {
        await sb.from('offices').update({ phone: phoneInput }).eq('id', myOffice.id);
      }
      const message = [
        supSubject.trim() && `الموضوع: ${supSubject.trim()}`,
        supMsg.trim(),
        `البريد: ${email}`
          + (myOffice?.fal_license ? ` · رخصة فال: ${myOffice.fal_license}` : '')
          + (officePhone ? ` · جوال: ${officePhone}` : ''),
      ].filter(Boolean).join('\n');
      // phone للصف: جوال المكتب إن توفّر (ليرد الأدمن عبر واتساب) وإلا البريد (احتياط — زر إيميل فقط).
      const row: Record<string, unknown> = { kind: 'support', name: `مكتب: ${myOffice?.name ?? 'بدون مكتب'}`, phone: officePhone || email, message };
      if (myOffice?.id) row.office_id = myOffice.id;
      let { error } = await sb.from('leads').insert(row);
      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        // عمود kind غير موجود بعد (قبل SQL) — تصل الرسالة كرسالة عادية بدل الضياع
        delete row.kind;
        ({ error } = await sb.from('leads').insert(row));
      }
      if (error) {
        setSupErr(error.code === '42501'
          ? 'الإرسال محجوب بسياسة الحماية (RLS) — يلزم تشغيل supabase/leads_support.sql.'
          : 'تعذّر الإرسال: ' + error.message);
        setSupSending(false); return;
      }
      setSupSent(true);
    } catch {
      setSupErr('تعذّر الإرسال حالياً — حاول لاحقاً.');
    }
    setSupSending(false);
  };

  useEffect(() => { reloadOffice(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // تعبئة حقل جوال الدعم تلقائياً من جوال المكتب المحفوظ (auto-use) — وإن لم يكن محفوظاً يبقى فارغاً ليُطلب.
  useEffect(() => { if (myOffice?.phone) setSupPhone(myOffice.phone); }, [myOffice?.phone]);
  // تعبئة نموذج «ملف المكتب» بالقيم المحفوظة عند تحميل المكتب (لا قيم ثابتة — من القاعدة).
  useEffect(() => {
    if (!myOffice) return;
    setPfName(myOffice.name || '');
    setPfPhone(myOffice.phone || '');
    setPfEmail(myOffice.email || '');
    setPfBio(myOffice.bio || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myOffice?.id]);

  // حفظ ملف المكتب — يحدّث الأعمدة غير المتعلّقة بالثقة فقط (name/phone/email/bio).
  // الـ trigger enforce_office_trust يجمّد status/verified/active، فلا يتغيّر التوثيق.
  const saveProfile = async () => {
    if (!myOffice) return;
    const name = pfName.trim();
    if (!name) { setPfMsg({ ok: false, text: 'أدخل اسم المكتب.' }); return; }
    const phone = pfPhone.trim();
    // الجوال = نفس رقم واتساب لردود الإدارة ⇒ يجب أن يبقى سعودياً صحيحاً.
    if (!isSaudiMobile(phone)) { setPfMsg({ ok: false, text: 'أدخل رقم جوال سعودي صحيح (مثال: 05XXXXXXXX) — يُستخدم لردود الإدارة عبر واتساب.' }); return; }
    const email = pfEmail.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setPfMsg({ ok: false, text: 'البريد الإلكتروني غير صحيح.' }); return; }
    const bio = pfBio.trim();
    setPfSaving(true); setPfMsg(null);
    try {
      const sb = createClient();
      const payload: Record<string, unknown> = { name, phone, email: email || null, bio: bio || null };
      let { error } = await sb.from('offices').update(payload).eq('id', myOffice.id);
      // تدرّج آمن: عمود اختياري مفقود (قبل office_profile_fields.sql) ⇒ أسقطه وأعد المحاولة.
      while (error && (error.code === 'PGRST204' || error.code === '42703')) {
        const col = /'([^']+)' column/.exec(error.message || '')?.[1];
        if (col && col in payload) { delete payload[col]; ({ error } = await sb.from('offices').update(payload).eq('id', myOffice.id)); }
        else break;
      }
      if (error) {
        setPfMsg({ ok: false, text: error.code === '42501' ? 'الحفظ محجوب بسياسة الحماية (RLS).' : 'تعذّر الحفظ: ' + error.message });
        setPfSaving(false); return;
      }
      setPfMsg({ ok: true, text: 'تم حفظ بيانات المكتب.' });
      await reloadOffice(); // إعادة قراءة القيم المحفوظة من القاعدة لتظهر بعد التحديث
    } catch {
      setPfMsg({ ok: false, text: 'تعذّر الحفظ حالياً — حاول لاحقاً.' });
    }
    setPfSaving(false);
  };
  const activeCount = myListings.filter((l) => l.status === 'approved').length;
  const pendingCount = myListings.filter((l) => l.status === 'pending').length;

  const condMap: Record<string, string> = { 'جديد': 'new', 'حالة جيدة': 'good', 'يحتاج ترميم': 'old' };

  const publishListing = async () => {
    if (!fRent.trim()) { setPublishMsg({ ok: false, text: 'أدخل قيمة الإيجار السنوي.' }); return; }
    // في وضع التعديل تكفي صورة الواجهة الحالية ما لم تُستبدل
    if (!fPhotos['facade'] && !(editingId && existingUrlFor('facade'))) { setPublishMsg({ ok: false, text: 'صورة الواجهة إلزامية — أضفها قبل النشر. بقية الصور اختيارية.' }); return; }
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
      const isComm = fSector === 'commercial';
      // ── رفع الصور (الواجهة أولاً) — فشل رفع صورة لا يُفشل النشر ──
      // التجاري: خانات عامة (لا تصنيف غرف) ⇒ تُحفظ مسطّحة في images و images_by_category=null.
      const slots = isComm ? commercialPhotoSlots() : photoSlots(parseInt(fRooms) || 1, parseInt(fBaths) || 1);
      const byCat: { facade: string | null; hall: string | null; majlis: string | null; kitchen: string | null; bedrooms: string[]; bathrooms: string[] } =
        { facade: null, hall: null, majlis: null, kitchen: null, bedrooms: [], bathrooms: [] };
      const urls: string[] = []; // مصفوفة مسطّحة متوافقة مع عمود images القديم (الواجهة أولاً)
      const photoFails: string[] = [];
      const hasNewPhotos = slots.some((s) => !!fPhotos[s.key]);
      for (const s of slots) {
        const ph = fPhotos[s.key];
        let u: string | null = null;
        if (ph) {
          const ext = (ph.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
          const path = `${myOffice.id}/${Date.now()}_${s.key}.${ext}`;
          const { error: upErr } = await sb.storage.from('listings').upload(path, ph.file);
          if (upErr) { photoFails.push(s.label); }
          else {
            const { data: pub } = sb.storage.from('listings').getPublicUrl(path);
            u = pub?.publicUrl ?? null;
            if (!u) photoFails.push(s.label);
          }
        }
        // في وضع التعديل: خانة بلا ملف جديد تحتفظ بصورتها المصنّفة الحالية
        if (!u && editingId) u = existingUrlFor(s.key);
        if (!u) continue;
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
      // بيانات الإعلان الأساسية — الرخصة تُسحب تلقائياً من سجل المكتب (لا إعادة إدخال).
      // التجاري: العنوان والنوع من النوع التجاري؛ لا غرف. type يحمل التسمية العربية (غير فارغ).
      const core: Record<string, unknown> = {
        title: isComm
          ? `${commLabel(fCommType)} — ${fHood}`
          : `${fType} ${fRooms} غرف — ${fHood}`.replace('استوديو 1 غرف', 'استوديو'),
        hood: fHood,
        type: isComm ? commLabel(fCommType) : fType,
        advertised: parseInt(fRent) || 0,
        area: fArea ? parseInt(fArea) : null,
        rooms: isComm ? null : (parseInt(fRooms) || null),
        condition: condMap[fCond] || 'good', cond_label: fCond,
      };
      if (!editingId) {
        // إدراج جديد فقط: الربط والحالة والرخصة. عند التعديل لا تُرسل الحالة إطلاقاً —
        // والقاعدة تجمّدها بـ trigger enforce_listing_status مهما أرسل العميل.
        core.office_id = myOffice.id;
        core.status = autoApproved ? 'approved' : 'pending';
        core.fal_license = myOffice.fal_license || null;
      }
      // خصائص اختيارية ('' ⇒ null) — أعمدتها تُضاف عبر ترحيلات (listing_attributes / commercial_sector).
      // كل الأعمدة الجديدة (sector/commercial_*) داخل attrs ليُسقطها مسار التراجع الآمن
      // (PGRST204/42703) إن لم تُنشأ بعد، فلا ينكسر النشر السكني قبل تشغيل commercial_sector.sql.
      const attrs: Record<string, unknown> = {
        parking: fParking === '' ? null : parseInt(fParking),
        description: fDesc.trim() || null,
        // القطاع + النوع التجاري (سكني افتراضي) — قابلة للإسقاط الآمن قبل الترحيل
        sector: fSector,
        commercial_type: isComm ? fCommType : null,
        // موقع الوحدة: الإحداثيات (من الخريطة أو من تحليل الرابط) + الرابط الملصوق كما هو.
        lat: fLat ?? parseMapsUrl(fMapsLink)?.lat ?? null,
        lng: fLng ?? parseMapsUrl(fMapsLink)?.lng ?? null,
        maps_url: isMapsUrl(fMapsLink) ? fMapsLink.trim() : null,
      };
      if (isComm) {
        // حقول تجارية فقط؛ والحقول السكنية تُصفّر (تفادي بقايا عند التحويل سكني→تجاري)
        attrs.frontage_count = fFrontage ? parseInt(fFrontage) : null;
        attrs.frontage_width = fFrontageWidth ? parseFloat(fFrontageWidth) : null;
        attrs.allowed_activity = fActivity.trim() || null;
        attrs.has_bathroom = fHasBathroom === '' ? null : fHasBathroom === 'yes';
        attrs.floor_info = fFloorInfo.trim() || null;
        attrs.baths = null; attrs.furnished = null; attrs.kitchen = null; attrs.ac = null;
      } else {
        attrs.baths = parseInt(fBaths) || null;
        attrs.furnished = fFurniture === '' ? null : fFurniture === 'مفروشة';
        attrs.kitchen = fKitchen === '' ? null : fKitchen === 'راكب';
        attrs.ac = fAc === '' ? null : fAc === 'مكيّفة';
      }
      // أعمدة الصور: تُكتب دائماً عند الإدراج؛ وعند التعديل فقط إن وُجدت صور جديدة
      // أو صور مصنّفة قائمة. التجاري بلا تصنيف غرف ⇒ images_by_category = null.
      if (!editingId || hasNewPhotos || existingPhotos) {
        attrs.images = urls;
        attrs.images_by_category = isComm ? null : byCat;
      }
      const payload: Record<string, unknown> = { ...core, ...attrs };
      const dropped: string[] = [];
      const exec = () => editingId
        ? sb.from('listings').update(payload).eq('id', editingId)
        : sb.from('listings').insert(payload);
      let { error } = await exec();
      // عمود اختياري مفقود في القاعدة (PGRST204/42703) ⇒ أسقط ذلك العمود وحده
      // وأعد المحاولة، بدل إفشال النشر كله — يبقى الإعلان الأساسي محفوظاً.
      while (error && (error.code === 'PGRST204' || error.code === '42703' || /schema cache/i.test(error.message || ''))) {
        const col = /'([^']+)' column/.exec(error.message || '')?.[1];
        if (!col || !(col in attrs) || !(col in payload)) break;
        delete payload[col];
        dropped.push(col);
        ({ error } = await exec());
      }
      if (error) { setPublishMsg({ ok: false, text: (editingId ? 'تعذّر حفظ التعديلات: ' : 'تعذّر النشر: ') + error.message }); setPublishing(false); return; }
      setPublishMsg({
        ok: true,
        text: (editingId
          ? 'تم حفظ التعديلات — حالة الإعلان تبقى كما هي (التعديل لا يغيّر الاعتماد).'
          : autoApproved
          ? 'تم نشر الإعلان — ظاهر الآن للباحثين مباشرة (مكتبك موثّق).'
          : 'تم إرسال الإعلان للمراجعة — يظهر للباحثين فور اعتماد الإدارة له.')
          + (photoFails.length ? ` (تعذّر رفع صور: ${photoFails.join('، ')})` : '')
          + (dropped.length ? ` (لم تُحفظ خصائص: ${dropped.join('، ')} — شغّل supabase/storage_listing_images.sql)` : ''),
      });
      setFRent(''); setFArea(''); setFDesc('');
      Object.values(fPhotos).forEach((p) => { if (p) URL.revokeObjectURL(p.preview); });
      setFPhotos({});
      setEditingId(null); setExistingPhotos(null);
      await reloadOffice(); // تظهر الإضافة/التعديلات في «إعلاناتي» فوراً
      setTimeout(() => { setPublishMsg(null); setAddStep(1); setOffPage('listings'); }, 1200);
    } catch {
      setPublishMsg({ ok: false, text: 'حدث خطأ غير متوقع أثناء النشر.' });
    }
    setPublishing(false);
  };


  const calcFair = () => {
    // مؤشر أسعار الحي = متوسط /admin للحي والنوع (mktAvg) معدّلاً بالمساحة. لا أرقام ثابتة.
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
    { id:'support', label:'تواصل مع المنصة' },
    { id:'profile', label:'ملف المكتب' },
    { id:'settings', label:'الإعدادات' },
  ];

  // حساب مسجّل لكن بلا مكتب مرتبط (باحث أو لم يُكمل تسجيل مكتب) ⇒ لا نعرض لوحة المكتب الوهمية
  if (offLoaded && !myOffice) {
    return (
      <div className="max-w-md mx-auto px-5 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
          <div className="text-lg font-bold text-gray-900 mb-1">أنشئ مكتبك العقاري</div>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">أكمل بيانات مكتبك مرة واحدة، وتُفعّل لوحتك وتبدأ نشر إعلاناتك مباشرة.</p>
          <label className="text-xs text-gray-700 font-semibold block mb-1">اسم المكتب *</label>
          <input value={newOfficeName} onChange={(e) => setNewOfficeName(e.target.value)} placeholder="مثال: مكتب الأفق العقاري"
            className="w-full mb-3 px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <label className="text-xs text-gray-700 font-semibold block mb-1">رقم جوال المكتب *</label>
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} dir="ltr" type="tel" placeholder="05XXXXXXXX"
            className="w-full mb-1 px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          <div className="text-[11px] text-gray-400 mb-3">يُستخدم لتواصل إدارة المنصة معك (واتساب) — رقم سعودي.</div>
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
          <button key={s.id} onClick={() => { setOffPage(s.id as typeof offPage); if(s.id==='add') { resetListingForm(); setAddStep(1); } }}
            className={`w-full text-right px-3 py-2.5 rounded-xl text-sm mb-1 font-medium transition-all ${offPage===s.id ? 'bg-blue-50 text-[#0A3D62] font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
            {s.label}
            {/* شارة العدد الحقيقي لاستفسارات العملاء غير المعالجة — لا أرقام ثابتة */}
            {s.id==='inquiries' && (() => {
              const n = myLeads.filter((l) => !l.handled).length;
              return n > 0 ? <span className="float-left bg-red-500 text-white text-xs min-w-4 h-4 px-1 rounded-full flex items-center justify-center">{n.toLocaleString('ar-SA')}</span> : null;
            })()}
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
                  ? 'مكتبك معتمد ونشط — تقدر تنشر إعلاناتك بلا حدود.'
                  : myOffice.status === 'rejected'
                  ? 'تم رفض حسابك من الإدارة — تواصل معها لمعرفة السبب.'
                  : !myOffice.active
                  ? 'مكتبك موقوف حالياً من الإدارة — لا يمكنك النشر.'
                  : 'حسابك بانتظار موافقة الإدارة — لا يمكنك النشر حتى الاعتماد.'}
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
              <button onClick={() => { resetListingForm(); setOffPage('add'); setAddStep(1); }}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white rounded-xl p-4 text-center shadow-md hover:opacity-95 transition-all">
                <div className="text-lg font-bold mb-1">إعلان جديد</div>
                <div className="text-xs opacity-80">أضف عقار للنشر</div>
              </button>
              <button onClick={() => setOffPage('calc')}
                className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm hover:border-blue-300 transition-all">
                <div className="text-lg font-bold text-gray-900 mb-1">الحاسبة</div>
                <div className="text-xs text-gray-500">احسب مؤشر أسعار الحي</div>
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
              <button onClick={() => { resetListingForm(); setOffPage('add'); setAddStep(1); }}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-4 py-2 rounded-xl font-bold text-sm shadow">
                + إعلان جديد
              </button>
            </div>
            {listsErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-3">{listsErr}</div>}
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
                  {/* تعديل/حذف — على إعلانات المكتب نفسه فقط (تفرضه سياسة listings_owner)؛
                      التعديل لا يغيّر حالة الاعتماد (يجمّدها trigger في القاعدة) */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => startEdit(l.id)} disabled={editLoading === l.id || deletingId === l.id}
                      className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] transition-colors disabled:opacity-50">
                      {editLoading === l.id ? 'جارٍ الفتح…' : 'تعديل'}
                    </button>
                    <button onClick={() => deleteListing(l.id)} disabled={editLoading === l.id || deletingId === l.id}
                      className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 transition-colors disabled:opacity-50">
                      {deletingId === l.id ? 'جارٍ الحذف…' : 'حذف'}
                    </button>
                  </div>
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
            <div className="text-xl font-bold text-gray-900 mb-1">{editingId ? 'تعديل الإعلان' : 'إضافة إعلان جديد'}</div>
            <div className="text-sm text-gray-500 mb-1">{editingId ? 'عدّل بيانات إعلانك ثم احفظ — حالة الاعتماد تبقى كما هي.' : 'أضف بيانات عقارك بدقة لضمان أفضل ظهور'}</div>
            {/* الربط التلقائي: الإعلان يحمل اسم المكتب ورخصته من سجلّه — لا إعادة إدخال */}
            <div className="text-xs text-[#1B6CA8] mb-2">
              يُربط الإعلان تلقائياً بمكتبك: <b>{myOffice?.name}</b>
              {myOffice?.fal_license && <> · رخصة فال <span dir="ltr">{myOffice.fal_license}</span></>}
            </div>
            {editingId && (
              <button onClick={() => { resetListingForm(); setOffPage('listings'); }}
                className="text-xs text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors mb-3">
                إلغاء التعديل والعودة لإعلاناتي
              </button>
            )}
            {!editingId && <div className="mb-3" />}

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
                {/* القطاع: التبديل الأساسي — سكني (الحقول الحالية) | تجاري (حقول تجارية) */}
                <div className="mb-4">
                  <label className="text-xs text-gray-700 font-semibold block mb-1.5">القطاع</label>
                  <div className="sector-toggle">
                    {([['residential', 'سكني', 'home_work'], ['commercial', 'تجاري', 'storefront']] as const).map(([s, lbl, ic]) => (
                      <button type="button" key={s} className={`seg ${fSector === s ? 'active' : ''}`} onClick={() => setFSector(s)}>
                        {msi(ic)} {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">{fSector === 'commercial' ? 'النوع التجاري' : 'نوع العقار'}</label>
                    {fSector === 'commercial' ? (
                      <select className={selectCls} value={fCommType} onChange={e=>setFCommType(e.target.value)}>
                        {COMMERCIAL_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    ) : (
                      <select className={selectCls} value={fType} onChange={e=>setFType(e.target.value)}><option>شقة</option><option>فيلا</option><option>دور</option><option>دوبلكس</option><option>استوديو</option></select>
                    )}</div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحي</label>
                    {/* مصدر واحد للأحياء: نفس قائمة جدول neighborhoods (mktAvg) المعروضة في الأدمن والفلاتر */}
                    <select className={selectCls} value={fHood} onChange={e=>setFHood(e.target.value)}>
                      {Object.keys(mktAvg).map((h) => <option key={h} value={h}>{h}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الإيجار السنوي (ريال)</label>
                    <input type="number" value={fRent} onChange={e=>setFRent(e.target.value)} placeholder="65000" className={inputCls} /></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">المساحة م²</label>
                    <input type="number" value={fArea} onChange={e=>setFArea(e.target.value)} placeholder="120" className={inputCls} /></div>
                </div>
                {fSector === 'commercial' ? (
                  // ── حقول تجارية (لا غرف/دورات مياه كعدد سكني) ──
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">عدد الواجهات</label>
                        <input type="number" value={fFrontage} onChange={e=>setFFrontage(e.target.value)} placeholder="1" className={inputCls} /></div>
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">عرض الواجهة (م)</label>
                        <input type="number" value={fFrontageWidth} onChange={e=>setFFrontageWidth(e.target.value)} placeholder="8" className={inputCls} /></div>
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحالة</label>
                        <select className={selectCls} value={fCond} onChange={e=>setFCond(e.target.value)}><option>جديد</option><option>حالة جيدة</option><option>يحتاج ترميم</option></select></div>
                    </div>
                    <div className="mb-3"><label className="text-xs text-gray-700 font-semibold block mb-1">النشاط المسموح</label>
                      <input type="text" value={fActivity} onChange={e=>setFActivity(e.target.value)} placeholder="مثال: مطعم / صيدلية / مكتب إداري" className={inputCls} /></div>
                    <div className="grid grid-cols-3 gap-3 mb-1">
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">المواقف</label>
                        <select className={selectCls} value={fParking} onChange={e=>setFParking(e.target.value)}><option value="">غير محدّد</option><option value="0">لا يوجد</option><option value="1">موقف واحد</option><option value="2">موقفان</option><option value="3">ثلاثة فأكثر</option></select></div>
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">دورة مياه</label>
                        <select className={selectCls} value={fHasBathroom} onChange={e=>setFHasBathroom(e.target.value)}><option value="">غير محدّد</option><option value="yes">نعم</option><option value="no">لا</option></select></div>
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">الدور/الوحدة</label>
                        <input type="text" value={fFloorInfo} onChange={e=>setFFloorInfo(e.target.value)} placeholder="الدور الأرضي" className={inputCls} /></div>
                    </div>
                  </>
                ) : (
                  // ── حقول سكنية (كما هي تماماً) ──
                  <>
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
                  </>
                )}

                {/* ── موقع الوحدة (اختياري لكنه مهم للباحث) — طريقتان: رابط أو خريطة ── */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-8 h-8 rounded-[10px] bg-[#0F6E56] text-white flex items-center justify-center flex-shrink-0">{Icons.pin}</span>
                    <div>
                      <div className="text-sm font-bold text-gray-900">موقع الوحدة على الخريطة</div>
                      <div className="text-[11px] text-gray-500">اختياري — يضيف للإعلان زراً يفتح موقع الوحدة في خرائط Google للباحث</div>
                    </div>
                  </div>
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-3 max-w-md">
                    <button type="button" onClick={() => setFLocMethod('link')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${fLocMethod === 'link' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                      ألصق رابط خرائط Google
                    </button>
                    <button type="button" onClick={() => setFLocMethod('map')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${fLocMethod === 'map' ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                      حدّد على الخريطة
                    </button>
                  </div>
                  {fLocMethod === 'link' ? (
                    <div>
                      <input
                        dir="ltr"
                        value={fMapsLink}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFMapsLink(v);
                          const c = parseMapsUrl(v);
                          if (c) { setFLat(c.lat); setFLng(c.lng); }
                        }}
                        placeholder="https://maps.app.goo.gl/… أو الرابط من شريط العنوان"
                        className={inputCls + ' text-left'}
                      />
                      <div className={`text-[11px] mt-1.5 leading-relaxed ${!fMapsLink.trim() ? 'text-gray-400' : parseMapsUrl(fMapsLink) ? 'text-green-700' : isMapsUrl(fMapsLink) ? 'text-amber-600' : 'text-orange-600'}`}>
                        {!fMapsLink.trim()
                          ? 'افتح خرائط Google، ضع دبوساً على الوحدة، انسخ الرابط والصقه هنا.'
                          : parseMapsUrl(fMapsLink)
                            ? `تم استخراج الإحداثيات (${fLat?.toFixed(5)}, ${fLng?.toFixed(5)}) — سيظهر دبوس الوحدة على خريطة البحث.`
                            : isMapsUrl(fMapsLink)
                              ? 'رابط مختصر (goo.gl) لا يحوي إحداثيات — زر «الموقع على الخريطة» سيعمل، لكن لن يظهر دبوس على خريطة البحث. لإظهار الدبوس استخدم «حدّد على الخريطة» أعلاه، أو الصق الرابط الكامل من شريط عنوان خرائط Google (يحوي ‎@lat,lng‎).'
                              : 'هذا لا يبدو رابط خرائط Google — انسخه من تطبيق أو موقع الخرائط.'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="rounded-xl overflow-hidden border border-gray-200">
                        <LocationPicker lat={fLat} lng={fLng} onPick={(la, ln) => { setFLat(la); setFLng(ln); }} />
                      </div>
                      <div className={`text-[11px] mt-1.5 ${fLat != null ? 'text-green-700' : 'text-gray-400'}`}>
                        {fLat != null && fLng != null
                          ? `الموقع المحدّد (${fLat.toFixed(5)}, ${fLng.toFixed(5)})`
                          : 'انقر على موقع الوحدة في الخريطة لوضع الدبوس.'}
                      </div>
                    </div>
                  )}
                  {(fLat != null || fMapsLink.trim() !== '') && (
                    <button type="button" onClick={() => { setFLat(null); setFLng(null); setFMapsLink(''); }}
                      className="text-[11px] text-red-600 font-semibold mt-1.5 hover:underline">
                      إزالة الموقع
                    </button>
                  )}
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
                <div className="text-sm text-gray-500 mb-4">احسب مؤشر أسعار الحي والربح المتوقع (اختياري)</div>
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
                        { label:'مؤشر أسعار الحي', val:`${fair.toLocaleString('ar-SA')} ريال`, color:'text-[#0A3D62]', big:true },
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
                      {profit < 0 ? 'تحذير: ربحك سلبي — راجع التكاليف أو ارفع السعر' : profit/fair < 0.1 ? 'هامش الربح ضيق — أنصح بتثبيت مؤشر أسعار الحي' : 'السوق نشط — تقدر تثبت مؤشر أسعار الحي بثقة'}
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
                <div className="font-bold text-gray-900 mb-1">{fSector === 'commercial' ? 'صور العقار التجاري' : 'صور الوحدة حسب الغرفة'}</div>
                <div className="text-sm text-gray-500 mb-4">
                  صورة الواجهة إلزامية، والبقية اختيارية لكنها تزيد تواصل الباحثين معك.
                  {fSector === 'commercial'
                    ? ' أضف لقطات داخلية للعقار والمرافق.'
                    : ` خانات غرف النوم والحمامات تتبع ما اخترته في «بيانات العقار» (${fRooms} غرف · ${fBaths} دورات مياه).`}
                </div>
                {/* تنبيه إرشادي ودّي بجودة الصور (إعلامي فقط — بلا تحقّق أو تغيير على الصور) */}
                <div className="flex items-start gap-2 bg-blue-50/70 border border-blue-200 rounded-xl p-3 mb-4 text-[13px] text-[#0A3D62] leading-relaxed">
                  <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 20 }}>photo_camera</span>
                  <span>صور واضحة وبإضاءة جيدة تبرز إعلانك وتزيد تواصل الباحثين معك.</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {(fSector === 'commercial' ? commercialPhotoSlots() : photoSlots(parseInt(fRooms) || 1, parseInt(fBaths) || 1)).map((s) => {
                    const ph = fPhotos[s.key];
                    // في وضع التعديل: الصورة الحالية تُعرض وتبقى ما لم يُختر ملف جديد يستبدلها
                    const existing = !ph && editingId ? existingUrlFor(s.key) : null;
                    return (
                      <label key={s.key}
                        className={`border-2 border-dashed rounded-xl p-2 text-center cursor-pointer transition-all min-h-[110px] flex flex-col items-center justify-center gap-1 ${ph || existing ? 'border-green-400 bg-green-50/40' : s.req ? 'border-[#1B6CA8]/60 hover:border-[#1B6CA8] bg-blue-50/30' : 'border-gray-300 hover:border-gray-400'}`}>
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => setPhoto(s.key, e.target.files?.[0] ?? null)} />
                        {ph ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ph.preview} alt={s.label} className="w-full h-16 object-cover rounded-lg" />
                        ) : existing ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={existing} alt={s.label} className="w-full h-16 object-cover rounded-lg" />
                        ) : (
                          <span className="text-gray-400 text-2xl leading-none">+</span>
                        )}
                        <span className="text-xs font-semibold text-gray-700">
                          {s.label}{s.req && <span className="text-red-500"> *</span>}
                        </span>
                        {ph && <span className="text-[10px] text-green-700 truncate max-w-full px-1">{ph.file.name}</span>}
                        {!ph && existing && <span className="text-[10px] text-green-700 px-1">الصورة الحالية — اضغط للاستبدال</span>}
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
                  <button onClick={publishListing} disabled={publishing} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50">{publishing ? (editingId ? 'جارٍ الحفظ…' : 'جارٍ النشر…') : (editingId ? 'حفظ التعديلات' : 'نشر الإعلان')}</button>
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
            <div className="text-sm text-gray-500 mb-5">احسب مؤشر أسعار الحي والربح المتوقع لأي عقار</div>
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
                    { label:'مؤشر أسعار الحي', val:`${fair.toLocaleString('ar-SA')} ريال`, color:'text-[#0A3D62]', big:true },
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
                  {profit < 0 ? 'ربحك سلبي — راجع التكاليف أو ارفع السعر' : profit/fair < 0.1 ? 'هامش الربح ضيق — أنصح بتثبيت مؤشر أسعار الحي' : 'السوق نشط — تقدر تثبت مؤشر أسعار الحي بثقة'}
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
                        <div className="w-10 h-10 rounded-[10px] bg-[#13496E] flex items-center justify-center font-bold text-white flex-shrink-0">
                          {(inq.name || '؟').slice(0,1)}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <div className="font-bold text-sm text-gray-900">{inq.name || 'باحث'}</div>
                            <div className="text-xs text-gray-400">{when}</div>
                          </div>
                          <a href={`tel:${inq.phone}`} className="text-xs text-blue-600 font-medium mb-1 inline-block" dir="ltr">{inq.phone}</a>
                          {inq.message && <div className="text-sm text-gray-600 whitespace-pre-line mt-1">{inq.message}</div>}
                          {/* رد مباشر على الباحث بجوّاله المحفوظ — اتصال/إيميل + منشئ رد عبر واتساب.
                              ملاحظة: لا نعلّم الاستفسار «معالَجاً» هنا لأن المكتب لا يملك سياسة UPDATE
                              على leads (الصلاحية للمدير فقط) — يحتاج سياسة leads_office_update لو رُغب لاحقاً. */}
                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                            <ContactButtons contact={inq.phone} />
                            <ReplyComposer phone={inq.phone} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* تواصل مع المنصة — رسالة دعم تصل لإدارة المنصة في /admin */}
        {offPage === 'support' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-1">تواصل مع المنصة</div>
            <div className="text-sm text-gray-500 mb-5">واجهت مشكلة أو تحدياً؟ راسل إدارة المنصة مباشرة — بيانات مكتبك تُرفق تلقائياً.</div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm max-w-xl">
              {supSent ? (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm text-center font-medium">
                  وصلت رسالتك لإدارة المنصة — سنراجعها ونرد عليك قريباً.
                  <button onClick={() => { setSupSent(false); setSupSubject(''); setSupMsg(''); }}
                    className="block mx-auto mt-3 text-xs text-[#0A3D62] underline">إرسال رسالة أخرى</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1">الموضوع</label>
                    <input value={supSubject} onChange={(e) => setSupSubject(e.target.value)}
                      placeholder="مثال: مشكلة في نشر إعلان / استفسار عن التوثيق" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1">الرسالة</label>
                    <textarea value={supMsg} onChange={(e) => setSupMsg(e.target.value)} rows={4}
                      placeholder="اشرح المشكلة أو الطلب بالتفصيل…" className={inputCls + ' resize-none'} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1">رقم جوال المكتب (للرد عبر واتساب)</label>
                    <input value={supPhone} onChange={(e) => setSupPhone(e.target.value)} dir="ltr" type="tel"
                      placeholder="05XXXXXXXX" className={inputCls} />
                    <div className="text-[11px] text-gray-400 mt-1">
                      {myOffice?.phone ? 'مُعبّأ من جوال مكتبك المحفوظ — عدّله إن لزم.' : 'أدخل جوالك ليتمكّن فريق المنصة من الرد عبر واتساب (اختياري — وإلا نرد بالإيميل).'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    يُرفق تلقائياً: {myOffice?.name ?? '—'}{myOffice?.fal_license ? ` · رخصة فال ${myOffice.fal_license}` : ''}{supPhone.trim() ? ` · جوال ${supPhone.trim()}` : ''} · بريد حسابك
                  </div>
                  {supErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{supErr}</div>}
                  <button onClick={submitSupport} disabled={supSending}
                    className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50">
                    {supSending ? 'جارٍ الإرسال…' : 'إرسال للمنصة'}
                  </button>
                </div>
              )}
            </div>
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
                      ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-lg border border-green-200 font-medium">موثّق بفال</span>
                      : <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-lg border border-amber-200 font-medium">غير موثّق بعد</span>}
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-lg border border-gray-200">الرياض</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">اسم المكتب</label>
                  <input value={pfName} onChange={(e) => setPfName(e.target.value)} placeholder="اسم المكتب" className={inputCls} /></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">رقم رخصة فال</label>
                  <input value={myOffice?.fal_license || ''} disabled placeholder="—" className={`${inputCls} bg-gray-50 text-gray-400`} />
                  <div className="text-[11px] text-gray-400 mt-1">الرخصة مرتبطة بالتوثيق ولا تُعدّل من هنا.</div></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">رقم الجوال</label>
                  <input value={pfPhone} onChange={(e) => setPfPhone(e.target.value)} dir="ltr" type="tel" placeholder="05xxxxxxxx" className={`${inputCls} text-left`} />
                  <div className="text-[11px] text-gray-400 mt-1">يُستخدم لردود إدارة المنصة عبر واتساب.</div></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">البريد الإلكتروني</label>
                  <input value={pfEmail} onChange={(e) => setPfEmail(e.target.value)} dir="ltr" type="email" placeholder="name@example.com" className={`${inputCls} text-left`} /></div>
              </div>
              <div className="mb-4"><label className="text-xs text-gray-700 font-semibold block mb-1">نبذة عن المكتب</label>
                <textarea value={pfBio} onChange={(e) => setPfBio(e.target.value)} rows={3} maxLength={400} placeholder="نبذة مختصرة عن مكتبك وخدماته…" className={`${inputCls} resize-none`} />
                <div className="text-[11px] text-gray-400 mt-1">{pfBio.length}/400</div></div>
              {pfMsg && (
                <div className={`mb-3 text-sm rounded-xl p-3 border ${pfMsg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{pfMsg.text}</div>
              )}
              <button onClick={saveProfile} disabled={pfSaving || !myOffice}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50">
                {pfSaving ? 'جارٍ الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {/* Settings */}
        {offPage === 'settings' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-5">الإعدادات</div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
              <div className="font-bold text-gray-900 mb-1">الإشعارات</div>
              {/* لا نظام إشعارات/بريد دوري بعد — لا نعرض مفاتيح وهمية تدّعي الحفظ. */}
              <div className="text-sm text-gray-500 leading-relaxed">
                إشعارات الاستفسارات والتقارير الدورية <span className="font-semibold text-amber-600">— قريباً</span>.
                حالياً تصلك استفسارات الباحثين مباشرةً في صفحة «الاستفسارات»، مع تنبيه بعددها غير المقروء في القائمة الجانبية.
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
