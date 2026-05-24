'use client';

import { useEffect, useRef, useState } from 'react';

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

const mktAvg: Record<string, { avg: number }> = {
  'العليا': { avg: 52000 }, 'النرجس': { avg: 65000 }, 'الملقا': { avg: 60000 },
  'حطين': { avg: 58000 }, 'الياسمين': { avg: 54000 }, 'القيروان': { avg: 58000 },
  'النخيل': { avg: 59000 }, 'إشبيلية': { avg: 38000 },
};

const listings = [
  { id: 1, hood: 'النرجس', title: 'شقة 3 غرف — حي النرجس', type: 'شقة', adv: 90000, cond: 'good', condLabel: 'حالة جيدة', tags: ['3 غرف', 'موقف', 'دخول ذكي'], fal: '1234567' },
  { id: 2, hood: 'النرجس', title: 'شقة 2 غرف — حي النرجس', type: 'شقة', adv: 42000, cond: 'new', condLabel: 'جديد', tags: ['2 غرفة', 'مجلس', 'مطبخ راكب'], fal: '2345678' },
  { id: 3, hood: 'النرجس', title: 'شقة 3 غرف — مشروع الماجدية', type: 'شقة', adv: 68000, cond: 'new', condLabel: 'جديد', tags: ['3 غرف', 'سنتان', 'مكيفات مركزية'], fal: '3456789' },
  { id: 4, hood: 'العليا', title: 'شقة 2 غرف — حي العليا', type: 'شقة', adv: 52000, cond: 'good', condLabel: 'حالة جيدة', tags: ['2 غرفة', 'مطبخ راكب', '3 سنوات'], fal: '4567890' },
  { id: 5, hood: 'الملقا', title: 'شقة 3 غرف — حي الملقا', type: 'شقة', adv: 48000, cond: 'good', condLabel: 'حالة جيدة', tags: ['3 غرف', '120م²', 'سنة'], fal: '5678901' },
  { id: 6, hood: 'حطين', title: 'استوديو — حي حطين', type: 'استوديو', adv: 50400, cond: 'new', condLabel: 'جديد', tags: ['مؤثث', 'قرب البوليفارد'], fal: '6789012' },
  { id: 7, hood: 'الياسمين', title: 'شقة 2 غرف — الياسمين', type: 'شقة', adv: 48000, cond: 'good', condLabel: 'حالة جيدة', tags: ['2 غرفة', '90م²', '4 سنوات'], fal: '7890123' },
  { id: 8, hood: 'القيروان', title: 'شقة 3 غرف — القيروان', type: 'شقة', adv: 38000, cond: 'old', condLabel: 'يحتاج ترميم', tags: ['3 غرف', '130م²', '7 سنوات'], fal: '8901234' },
  { id: 9, hood: 'النخيل', title: 'فيلا — حي النخيل', type: 'فيلا', adv: 140000, cond: 'new', condLabel: 'جديد', tags: ['5 غرف', '450م²', 'مسبح'], fal: '9012345' },
  { id: 10, hood: 'إشبيلية', title: 'شقة 2 غرف — إشبيلية', type: 'شقة', adv: 36000, cond: 'good', condLabel: 'حالة جيدة', tags: ['2 غرفة', '80م²', '5 سنوات'], fal: '0123456' },
];

function getFair(l: typeof listings[0]) {
  const m = mktAvg[l.hood];
  if (!m) return l.adv;
  return Math.round(m.avg * (l.type === 'فيلا' ? 2.2 : l.type === 'استوديو' ? 0.55 : 1));
}
function getSt(adv: number, fair: number) { return adv / fair > 1.12 ? 'hi' : adv / fair < 0.85 ? 'lo' : 'ok'; }
function isOpp(l: typeof listings[0]) { return getSt(l.adv, getFair(l)) === 'lo'; }
function rl(st: string) { return st === 'ok' ? 'مناسب' : st === 'hi' ? 'مرتفع' : 'فرصة'; }

export default function Home() {
  const [page, setPage] = useState<'search' | 'map' | 'alerts' | 'pricing' | 'office'>('search');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [siZone, setSiZone] = useState('65000');
  const [siPrice, setSiPrice] = useState('');
  const [filterHood, setFilterHood] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [prefs, setPrefs] = useState<{ hood: string; type: string; maxBudget: number | null } | null>(null);
  const [searched, setSearched] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  const sendAI = async () => {
    const msg = inputVal.trim();
    if (!msg || loading) return;
    setInputVal('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, preferences: prefs }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.reply || 'حدث خطأ' }]);
      const hm = msg.match(/(العليا|النرجس|الملقا|حطين|الياسمين|القيروان|النخيل|إشبيلية)/);
      const tm = msg.match(/(شقة|فيلا|استوديو|دور)/);
      const pm = msg.match(/(\d{4,6})/);
      if (hm) setFilterHood(hm[0]);
      if (tm) setFilterType(tm[0]);
      if (pm) setFilterBudget(pm[0]);
      if (hm || tm || pm) {
        setPrefs({ hood: hm?.[0] || '', type: tm?.[0] || '', maxBudget: pm ? parseInt(pm[0]) : null });
        setSearched(true);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'تعذّر الاتصال بالمساعد الذكي' }]);
    }
    setLoading(false);
  };

  const doSearch = () => { setSearched(true); };

  const checkPrice = () => {
    const avg = parseInt(siZone);
    const price = parseInt(siPrice) || 0;
    if (!price) return { type: 'none', icon: Icons.chart, title: 'أدخل قيمة الإيجار للمقارنة', detail: '', color: 'bg-gray-50 border-gray-200' };
    const zoneName = { '65000': 'النرجس', '52000': 'العليا', '60000': 'الملقا', '58000': 'حطين', '54000': 'الياسمين', '38000': 'إشبيلية' }[siZone] || '';
    if (price > avg * 1.12) return { type: 'hi', icon: Icons.warning, title: 'السعر مرتفع', detail: `أعلى بـ ${(price - avg).toLocaleString('ar-SA')} ريال من متوسط ${zoneName}`, color: 'bg-orange-50 border-orange-300' };
    if (price < avg * 0.85) return { type: 'lo', icon: Icons.target, title: 'فرصة ممتازة', detail: `أقل بـ ${(avg - price).toLocaleString('ar-SA')} ريال من متوسط ${zoneName}`, color: 'bg-green-50 border-green-300' };
    return { type: 'ok', icon: Icons.okCircle, title: 'السعر مناسب للسوق', detail: `متوسط ${zoneName} حوالي ${avg.toLocaleString('ar-SA')} ريال سنوياً`, color: 'bg-blue-50 border-blue-200' };
  };

  const indicator = checkPrice();

  const filtered = listings.filter(l => {
    if (filterHood && l.hood !== filterHood) return false;
    if (filterType && l.type !== filterType) return false;
    if (filterBudget && l.adv > parseInt(filterBudget)) return false;
    return true;
  });

  const opportunities = listings.filter(isOpp);

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
  const stIcon: Record<string, string> = { ok: '↔', hi: '↑', lo: '↓' };

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400";
  const selectCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="min-h-screen bg-[#F5F8FB]" dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }}>

      {/* NAV */}
      <nav className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-5 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('search')}>
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white border border-white/30">
            {Icons.building}
          </div>
          <div>
            <div className="text-white font-bold text-base leading-none">مؤشر</div>
            <div className="text-white/70 text-[9px] tracking-wider">العقارية</div>
          </div>
        </div>
        <div className="flex gap-1 bg-white/10 rounded-xl p-1">
          {[
            { id: 'search', label: 'البحث' },
            { id: 'map', label: 'الخريطة' },
            { id: 'alerts', label: 'أحدث الإعلانات' },
          ].map(n => (
            <button key={n.id} onClick={() => setPage(n.id as typeof page)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${page === n.id ? 'bg-white text-[#0A3D62] font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
              {n.label}
            </button>
          ))}
        </div>
        <button onClick={() => setPage('pricing')} className="bg-white text-[#0A3D62] px-4 py-2 rounded-lg text-sm font-bold shadow">
          التسجيل
        </button>
      </nav>

      {/* ═══ SEARCH ═══ */}
      {page === 'search' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] via-[#1B6CA8] to-[#378ADD] px-5 pt-6 pb-0 relative overflow-hidden">
            <div className="relative z-10 text-center pb-2">
              <h1 className="text-white text-xl font-bold mb-3">سوق الإيجار <span className="text-[#9BC8F0]">بكل وضوح</span></h1>
              <div className="flex flex-wrap gap-3 justify-center mb-4">
                {['استشارة عقارية مجانية', 'اعرف السعر العادل قبل توقيع العقد', 'سوق شفاف، قرار واثق'].map(t => (
                  <span key={t} className="text-white/90 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#9BC8F0] inline-block" />{t}
                  </span>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-7 bg-[#F5F8FB] rounded-t-3xl" />
          </div>

          <div className="px-4 pt-3 pb-6 space-y-4">

            {/* welcome back */}
            {prefs && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                <div className="text-blue-600">{Icons.building}</div>
                <div className="flex-1 text-sm text-blue-800">
                  <strong>أهلاً بعودتك!</strong> آخر عمليات بحثك:
                  {prefs.hood && <span> {prefs.hood}</span>}
                  {prefs.type && <span> · {prefs.type}</span>}
                  {prefs.maxBudget && <span> · {prefs.maxBudget.toLocaleString('ar-SA')} ريال</span>}
                </div>
                <button onClick={() => { setPrefs(null); setSearched(false); }} className="text-gray-500 text-xs border border-gray-300 px-2 py-1 rounded-lg">مسح</button>
              </div>
            )}

            {/* 1. المساعد الذكي */}
            <div className="bg-white rounded-2xl overflow-hidden border border-blue-200 shadow-sm">
              <div className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white border border-white/30">
                  {Icons.ai}
                </div>
                <div className="flex-1">
                  <div className="text-white font-bold text-sm">المساعد الذكي</div>
                  <div className="text-white/80 text-xs">صِف ما تبحث عنه بكلامك الخاص</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#9BE5C5] animate-pulse" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {['رب أسرة · 65 ألف', 'أعزب · استوديو', 'عائلة · فيلا'].map(s => (
                    <button key={s} onClick={() => setInputVal(s)}
                      className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-100 transition-all font-medium">
                      {s}
                    </button>
                  ))}
                </div>
                <div ref={chatRef} className="max-h-40 overflow-y-auto mb-3 space-y-2">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.role === 'user' ? 'bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white' : 'bg-blue-100 text-blue-800'}`}>
                        {m.role === 'user' ? 'أ' : 'م'}
                      </div>
                      <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed max-w-[85%] ${m.role === 'user' ? 'bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white rounded-tr-sm' : 'bg-blue-50 text-gray-900 rounded-tl-sm'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-800">م</div>
                      <div className="bg-blue-50 px-3 py-2 rounded-xl flex gap-1 items-center">
                        {[0, 150, 300].map(d => <div key={d} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                  <input value={inputVal} onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendAI()}
                    placeholder="اكتب طلبك — مثال: شقة 3 غرف بالنرجس بميزانية 70 ألف..."
                    className="flex-1 bg-transparent text-sm outline-none text-right placeholder-gray-400 text-gray-900" dir="rtl" />
                  <button onClick={sendAI} disabled={loading}
                    className="w-8 h-8 bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-50">
                    {Icons.send}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. البحث */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                  {Icons.search}
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">ابحث عن إيجارك المناسب</div>
                  <div className="text-xs text-gray-500">حدّد المعايير لتظهر لك العقارات المتاحة</div>
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
              <div className="px-4 pb-4">
                <button onClick={doSearch}
                  className="w-full bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all">
                  {Icons.search}
                  <span>بحث</span>
                </button>
              </div>
            </div>

            {/* نتائج البحث */}
            {searched && (
              <div>
                <div className="flex justify-between items-center mb-3 px-1">
                  <div className="font-bold text-gray-900">{filtered.length} نتيجة{filterHood ? ` في ${filterHood}` : ''}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">{Icons.chart} بيانات حقيقية</div>
                </div>
                {filtered.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">لا توجد نتائج — جرّب تغيير المعايير</div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map(l => {
                      const fair = getFair(l); const st = getSt(l.adv, fair);
                      const diff = Math.abs(l.adv - fair).toLocaleString('ar-SA');
                      const dtxt = l.adv > fair ? `أعلى بـ ${diff}` : l.adv < fair ? `وفّر ${diff} ريال` : 'يطابق المتوسط';
                      return (
                        <div key={l.id} className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all relative overflow-hidden ${isOpp(l) ? 'border-green-400' : 'border-gray-200'}`}>
                          {isOpp(l) && <div className="absolute top-0 right-0 bg-green-600 text-white text-xs px-3 py-1 rounded-bl-xl font-bold">فرصة</div>}
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="text-lg font-bold text-gray-900">{l.adv.toLocaleString('ar-SA')} ريال/سنة</div>
                              <div className="text-xs text-blue-700 mt-0.5 font-medium">السعر العادل: {fair.toLocaleString('ar-SA')} · {dtxt}</div>
                              <div className="text-xs text-gray-600 mt-0.5">{l.title}</div>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-xl font-bold ${stBadge[st]}`}>{stIcon[st]} {rl(st)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className={`text-xs px-2 py-1 rounded-lg font-medium ${condColor[l.cond]}`}>{l.condLabel}</span>
                            {l.tags.map(t => <span key={t} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-lg border border-gray-200">{t}</span>)}
                          </div>
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                            <span className="text-xs text-green-700 flex items-center gap-1 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />رخصة فال: {l.fal}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">عقار.fm</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. المؤشر */}
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
                      {[['65000', 'النرجس'], ['52000', 'العليا'], ['60000', 'الملقا'], ['58000', 'حطين'], ['54000', 'الياسمين'], ['38000', 'إشبيلية']].map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 block mb-1 font-semibold">الإيجار السنوي (ريال)</label>
                    <input type="number" value={siPrice} onChange={e => setSiPrice(e.target.value)}
                      placeholder="مثال: 65000" className={inputCls} />
                  </div>
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

            {/* 4. التمويل */}
            <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] rounded-2xl p-6 text-center shadow-xl">
              <div className="flex justify-center mb-3 text-white opacity-90">{Icons.bank}</div>
              <div className="text-white font-bold text-lg mb-2">تحتاج تمويلاً عقارياً؟</div>
              <div className="text-white/85 text-sm mb-4 leading-relaxed max-w-sm mx-auto">نربطك مباشرة بشركائنا من الجهات التمويلية المعتمدة لتحصل على أفضل عرض يناسبك</div>
              <button className="bg-white text-[#0A3D62] px-8 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all">
                اطلب التمويل الآن
              </button>
              <div className="text-white/70 text-xs mt-3">خدمة مجانية · ردود سريعة · مقارنة عروض</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAP ═══ */}
      {page === 'map' && (
        <div>
          <div className="bg-white px-4 py-3 flex gap-2 flex-wrap border-b border-gray-200 items-center">
            <div className="text-blue-700 ml-1">{Icons.map}</div>
            <span className="font-bold text-gray-900 ml-2">خريطة الإيجارات</span>
            {['الكل', 'شقق', 'فلل', 'استوديو'].map(f => (
              <button key={f} className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-2xl text-sm text-blue-700 font-medium hover:bg-blue-100 transition-all">{f}</button>
            ))}
          </div>
          {/* الخريطة — سيتم ربطها لاحقاً */}
          <div className="bg-gradient-to-br from-[#E6F1FB] to-[#b5d4f4] flex items-center justify-center" style={{ height: '380px' }}>
            <div className="text-center bg-white/80 rounded-2xl p-8 shadow-md border border-blue-100">
              <div className="flex justify-center mb-3 text-blue-600">{Icons.map}</div>
              <div className="font-bold text-[#0A3D62] text-base mb-2">الخريطة التفاعلية</div>
              <div className="text-sm text-gray-600 max-w-xs">سيتم تفعيل الخريطة التفاعلية في المرحلة القادمة عند الربط مع قاعدة البيانات</div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="font-bold text-gray-900 mb-2">كل الإعلانات ({listings.length})</div>
            {listings.map(l => {
              const fair = getFair(l); const st = getSt(l.adv, fair);
              return (
                <div key={l.id} className={`bg-white rounded-xl border p-3.5 flex justify-between items-center hover:shadow-sm transition-all ${isOpp(l) ? 'border-green-300' : 'border-gray-200'}`}>
                  <div>
                    <div className="font-bold text-sm text-gray-900">{l.adv.toLocaleString('ar-SA')} ريال/سنة</div>
                    <div className="text-xs text-gray-600 mt-0.5">{l.title}</div>
                    <div className="text-xs text-blue-700 mt-0.5 font-medium">السعر العادل: {fair.toLocaleString('ar-SA')}</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-xl font-bold ${stBadge[st]}`}>{stIcon[st]} {rl(st)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ALERTS ═══ */}
      {page === 'alerts' && (
        <div className="p-4">
          <div className="bg-gradient-to-l from-green-600 to-green-700 rounded-2xl p-5 text-white mb-4 flex items-center gap-4 shadow-lg">
            <div className="text-white">{Icons.news}</div>
            <div>
              <h2 className="font-bold text-lg mb-1">أحدث الإعلانات</h2>
              <p className="text-sm opacity-90">أحدث ما طُرح في السوق العقاري — مرتّبة حسب الأقرب زمنياً</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-green-700">2</div>
              <div className="text-xs text-gray-600 mt-1 font-medium">تنبيهات مفعّلة</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
              <div className="text-2xl font-bold text-green-700">{opportunities.length}</div>
              <div className="text-xs text-gray-600 mt-1 font-medium">إعلانات جديدة اليوم</div>
            </div>
          </div>
          <div className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="text-green-600">{Icons.bell}</div>
            الإعلانات الجديدة
          </div>
          <div className="space-y-3">
            {opportunities.map((l, i) => {
              const fair = getFair(l); const sav = fair - l.adv;
              return (
                <div key={l.id} className={`bg-white rounded-xl border-r-4 border border-green-400 p-4 cursor-pointer hover:shadow-md transition-all ${i < 2 ? 'bg-green-50/50' : ''}`}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div>
                      <div className="font-bold text-sm text-gray-900">{l.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">منذ {i * 3 + 5} دقائق · {l.hood}</div>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-xl font-bold border border-green-200 whitespace-nowrap">
                      وفّر {sav.toLocaleString('ar-SA')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    السعر المُعلن <strong className="text-gray-900">{l.adv.toLocaleString('ar-SA')} ريال</strong> · السعر العادل <strong className="text-gray-900">{fair.toLocaleString('ar-SA')} ريال</strong> · {l.condLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                features: ['حتى 10 إعلانات نشطة', 'التحقق التلقائي من رخصة فال', 'تقييم تلقائي بالسعر العادل', 'لوحة تحكم إحصائية', 'الحاسبة الذكية للأسعار'],
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
                <button onClick={() => plan.popular ? setPage('office') : undefined}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${plan.popular ? 'bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white shadow-md hover:opacity-95' : 'bg-white border-2 border-blue-500 text-[#0A3D62] hover:bg-blue-50'}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ OFFICE DASHBOARD ═══ */}
      {page === 'office' && (
        <OfficeDashboard />
      )}

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 py-4 px-5 text-center text-xs text-gray-500 mt-4">
        <button className="text-blue-600 font-medium hover:underline">سياسة الخصوصية</button>
        <span className="mx-3 text-gray-300">·</span>
        <button className="text-blue-600 font-medium hover:underline">شروط الاستخدام</button>
        <span className="mx-3 text-gray-300">·</span>
        <span>© 2026 مؤشر العقارية</span>
      </div>
    </div>
  );
}

// ═══ لوحة تحكم المكتب الكاملة ═══
function OfficeDashboard() {
  const [offPage, setOffPage] = useState<'dashboard'|'listings'|'add'|'calc'|'inquiries'|'profile'|'settings'>('dashboard');
  const [addStep, setAddStep] = useState(1);
  const [falNum, setFalNum] = useState('');
  const [falStatus, setFalStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [cHood, setCHood] = useState('65000');
  const [cType, setCType] = useState('1');
  const [cArea, setCArea] = useState('130');
  const [cCost, setCCost] = useState('600000');
  const [cReno, setCReno] = useState('40000');
  const [cMargin, setCMargin] = useState('10');
  const [cFee, setCFee] = useState('2.5');

  const calcFair = () => {
    const avg = parseInt(cHood);
    const mul = parseFloat(cType);
    const area = parseInt(cArea)||130;
    return Math.round(avg * mul * (area/130));
  };
  const calcMin = () => {
    const cost = parseInt(cCost)||0;
    const reno = parseInt(cReno)||0;
    return Math.round((cost+reno)*((parseFloat(cMargin)+parseFloat(cFee))/100));
  };
  const fair = calcFair();
  const minSafe = calcMin();
  const profit = fair - minSafe;

  const verifyFal = () => {
    if (!falNum) { setFalStatus('error'); return; }
    setFalStatus('loading');
    setTimeout(() => { setFalStatus('success'); setTimeout(() => setAddStep(2), 800); }, 1500);
  };

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const selectCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const officeListings = [
    { id:1, title:'شقة 3 غرف — حي النرجس', price:68000, fair:65000, views:142, inquiries:4, st:'ok' },
    { id:2, title:'فيلا 5 غرف — حي حطين', price:145000, fair:127600, views:89, inquiries:2, st:'hi' },
    { id:3, title:'استوديو — حي العليا', price:28000, fair:28600, views:76, inquiries:3, st:'lo' },
    { id:4, title:'شقة 2 غرف — الياسمين', price:48000, fair:54000, views:54, inquiries:1, st:'ok' },
  ];

  const stBadge: Record<string,string> = {
    ok:'bg-blue-100 text-blue-800 border border-blue-200',
    hi:'bg-orange-100 text-orange-800 border border-orange-200',
    lo:'bg-green-100 text-green-800 border border-green-200',
  };
  const stLabel: Record<string,string> = { ok:'مناسب', hi:'مرتفع', lo:'فرصة' };

  const sideItems = [
    { id:'dashboard', label:'لوحة التحكم' },
    { id:'listings', label:'إعلاناتي' },
    { id:'add', label:'إضافة إعلان' },
    { id:'calc', label:'الحاسبة الذكية' },
    { id:'inquiries', label:'الاستفسارات' },
    { id:'profile', label:'ملف المكتب' },
    { id:'settings', label:'الإعدادات' },
  ];

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
              <div className="text-xl font-bold text-gray-900 mb-1">مرحباً، مكتب الأرض المباركة</div>
              <div className="text-sm text-gray-500">ملخص نشاطك خلال آخر 7 أيام</div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label:'إعلانات نشطة', val:'24', trend:'+3 هذا الأسبوع', color:'text-green-600' },
                { label:'زوار الإعلانات', val:'847', trend:'+18%', color:'text-green-600' },
                { label:'استفسارات جديدة', val:'12', trend:'5 تحتاج رد', color:'text-orange-600' },
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
                <div className="text-xs text-gray-500">5 استفسارات بانتظارك</div>
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
                <div className="text-sm text-gray-500">24 إعلان نشط · 3 موقوفة</div>
              </div>
              <button onClick={() => { setOffPage('add'); setAddStep(1); }}
                className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-4 py-2 rounded-xl font-bold text-sm shadow">
                + إعلان جديد
              </button>
            </div>
            <div className="space-y-3">
              {officeListings.map(l => (
                <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900 mb-1">{l.title}</div>
                      <div className="text-sm text-gray-600">{l.price.toLocaleString('ar-SA')} ريال/سنة</div>
                      <div className="text-xs text-blue-600 mt-0.5">السعر العادل: {l.fair.toLocaleString('ar-SA')}</div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-xl font-bold ${stBadge[l.st]}`}>{stLabel[l.st]}</span>
                  </div>
                  <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <span><strong className="text-gray-900">{l.views}</strong> زائر</span>
                    <span><strong className="text-gray-900">{l.inquiries}</strong> استفسار</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Listing */}
        {offPage === 'add' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-1">إضافة إعلان جديد</div>
            <div className="text-sm text-gray-500 mb-5">أضف بيانات عقارك بدقة لضمان أفضل ظهور</div>

            {/* Steps */}
            <div className="flex items-center gap-2 mb-5 bg-white rounded-xl p-3 border border-gray-200">
              {[
                { n:1, label:'التحقق من فال' },
                { n:2, label:'بيانات العقار' },
                { n:3, label:'الحاسبة (اختياري)' },
                { n:4, label:'الصور والوصف' },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${addStep > s.n ? 'bg-green-500 text-white' : addStep === s.n ? 'bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {addStep > s.n ? '✓' : s.n}
                  </div>
                  <div className={`text-xs font-medium ${addStep === s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</div>
                  {i < 3 && <div className={`flex-1 h-0.5 ${addStep > s.n ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: FAL */}
            {addStep === 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="font-bold text-gray-900 mb-1">التحقق من رخصة فال</div>
                <div className="text-sm text-gray-500 mb-4">التحقق إلزامي لجميع الإعلانات</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1">رقم رخصة فال</label>
                    <input value={falNum} onChange={e => setFalNum(e.target.value)} placeholder="مثال: 1100123456" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-semibold block mb-1">اسم المكتب</label>
                    <input defaultValue="مكتب الأرض المباركة" className={inputCls} />
                  </div>
                </div>
                {falStatus === 'loading' && <div className="text-sm text-blue-600 bg-blue-50 rounded-xl p-3 mb-3 border border-blue-100">جاري التحقق من منصة فال...</div>}
                {falStatus === 'success' && <div className="text-sm text-green-700 bg-green-50 rounded-xl p-3 mb-3 border border-green-200">تم التحقق بنجاح — رخصة فال {falNum} سارية</div>}
                {falStatus === 'error' && <div className="text-sm text-red-700 bg-red-50 rounded-xl p-3 mb-3 border border-red-200">أدخل رقم الرخصة</div>}
                <button onClick={verifyFal} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow">
                  تحقق من الرخصة
                </button>
              </div>
            )}

            {/* Step 2: Property Data */}
            {addStep === 2 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="font-bold text-gray-900 mb-4">بيانات العقار</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">نوع العقار</label>
                    <select className={selectCls}><option>شقة</option><option>فيلا</option><option>دور</option><option>استوديو</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحي</label>
                    <select className={selectCls}><option>النرجس</option><option>العليا</option><option>الملقا</option><option>حطين</option><option>الياسمين</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الإيجار السنوي (ريال)</label>
                    <input type="number" placeholder="65000" className={inputCls} /></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">المساحة م²</label>
                    <input type="number" placeholder="120" className={inputCls} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">الغرف</label>
                    <select className={selectCls}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">حالة العقار</label>
                    <select className={selectCls}><option>جديد</option><option>حالة جيدة</option><option>يحتاج ترميم</option></select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">عمر العقار</label>
                    <select className={selectCls}><option>أقل من سنة</option><option>1-3 سنوات</option><option>3-7 سنوات</option></select></div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setAddStep(3)} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">التالي: الحاسبة</button>
                  <button onClick={() => setAddStep(4)} className="bg-white border border-dashed border-gray-300 text-gray-500 px-5 py-2.5 rounded-xl font-medium text-sm hover:border-gray-400 transition-all">تخطي الحاسبة</button>
                </div>
              </div>
            )}

            {/* Step 3: Calculator */}
            {addStep === 3 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="font-bold text-gray-900 mb-1">الحاسبة الذكية</div>
                <div className="text-sm text-gray-500 mb-4">احسب السعر العادل والربح المتوقع (اختياري)</div>
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-700 font-semibold block mb-1">الحي</label>
                      <select value={cHood} onChange={e => setCHood(e.target.value)} className={selectCls}>
                        <option value="65000">النرجس</option><option value="52000">العليا</option><option value="60000">الملقا</option><option value="58000">حطين</option><option value="54000">الياسمين</option>
                      </select></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-700 font-semibold block mb-1">النوع</label>
                        <select value={cType} onChange={e => setCType(e.target.value)} className={selectCls}>
                          <option value="1">شقة</option><option value="2.2">فيلا</option><option value="0.55">استوديو</option>
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
                  <button onClick={() => setAddStep(2)} className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium text-sm">السابق</button>
                  <button onClick={() => setAddStep(4)} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow">التالي: الصور</button>
                </div>
              </div>
            )}

            {/* Step 4: Images & Description */}
            {addStep === 4 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="font-bold text-gray-900 mb-4">الصور والوصف</div>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-4 hover:border-blue-400 transition-all cursor-pointer">
                  <div className="text-3xl mb-2 text-gray-400">📷</div>
                  <div className="font-medium text-gray-700 mb-1">اضغط لرفع الصور</div>
                  <div className="text-xs text-gray-400">يفضل 5 صور على الأقل</div>
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-700 font-semibold block mb-1">وصف العقار</label>
                  <textarea rows={3} placeholder="صف العقار ومميزاته..." className={`${inputCls} resize-none`} />
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-700 font-semibold block mb-1">رقم التواصل</label>
                  <input type="tel" placeholder="05XXXXXXXX" className={inputCls} />
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-800 border border-blue-100 mb-4">
                  بعد النشر، يقيّم المؤشر سعرك تلقائياً مقارنة بمتوسط حيّك
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAddStep(3)} className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium text-sm">السابق</button>
                  <button onClick={() => {
                    setOffPage('listings');
                    setAddStep(1);
                    setFalStatus('idle');
                    setFalNum('');
                  }} className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow flex-1">
                    نشر الإعلان
                  </button>
                </div>
              </div>
            )}
          </div>
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
                      <option value="65000">النرجس</option><option value="52000">العليا</option><option value="60000">الملقا</option><option value="58000">حطين</option><option value="54000">الياسمين</option>
                    </select></div>
                  <div><label className="text-xs text-gray-700 font-semibold block mb-1">نوع العقار</label>
                    <select value={cType} onChange={e => setCType(e.target.value)} className={selectCls}>
                      <option value="1">شقة</option><option value="2.2">فيلا</option><option value="0.55">استوديو</option>
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
            <div className="text-sm text-gray-500 mb-5">5 استفسارات تحتاج رد</div>
            <div className="space-y-3">
              {[
                { name:'أحمد المطيري', time:'قبل 25 دقيقة', property:'شقة 3 غرف — حي النرجس', msg:'السلام عليكم، الشقة لازالت متاحة؟ ممكن نسوي معاينة بكرة؟', unread:true },
                { name:'سلطان القحطاني', time:'قبل ساعة', property:'فيلا 5 غرف — حي حطين', msg:'هل المسبح فيها مشترك أو خاص؟ وهل يوجد صور إضافية؟', unread:true },
                { name:'نجلاء الحربي', time:'قبل 3 ساعات', property:'استوديو — حي العليا', msg:'السعر قابل للتفاوض؟ وهل يوجد عقد إيجار 6 أشهر؟', unread:false },
              ].map((inq, i) => (
                <div key={i} className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${inq.unread ? 'border-r-4 border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 flex-shrink-0">
                      {inq.name.slice(0,1)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <div className="font-bold text-sm text-gray-900">{inq.name}</div>
                        <div className="text-xs text-gray-400">{inq.time}</div>
                      </div>
                      <div className="text-xs text-blue-600 font-medium mb-1">{inq.property}</div>
                      <div className="text-sm text-gray-600">{inq.msg}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile */}
        {offPage === 'profile' && (
          <div>
            <div className="text-xl font-bold text-gray-900 mb-5">ملف المكتب</div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] flex items-center justify-center text-white text-2xl font-bold">م</div>
                <div>
                  <div className="font-bold text-lg text-gray-900">مكتب الأرض المباركة العقاري</div>
                  <div className="flex gap-2 mt-1">
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-lg border border-green-200 font-medium">موثّق بفال</span>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-lg border border-gray-200">الرياض</span>
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-lg border border-gray-200">منذ 2018</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">اسم المكتب</label>
                  <input defaultValue="مكتب الأرض المباركة العقاري" className={inputCls} /></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">رقم رخصة فال</label>
                  <input defaultValue="1234567" disabled className={`${inputCls} bg-gray-50 text-gray-400`} /></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">رقم الجوال</label>
                  <input defaultValue="0501234567" className={inputCls} /></div>
                <div><label className="text-xs text-gray-700 font-semibold block mb-1">البريد الإلكتروني</label>
                  <input defaultValue="info@mubaraka.sa" className={inputCls} /></div>
              </div>
              <div className="mb-4"><label className="text-xs text-gray-700 font-semibold block mb-1">نبذة عن المكتب</label>
                <textarea rows={3} defaultValue="مكتب عقاري موثوق متخصص في تأجير الشقق والفلل في شمال الرياض منذ 2018." className={`${inputCls} resize-none`} /></div>
              <button className="bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow">حفظ التغييرات</button>
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
