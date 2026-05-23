'use client';

import { useEffect, useRef, useState } from 'react';

// ═══ البيانات ═══
const mktAvg: Record<string, { avg: number }> = {
  'العليا': { avg: 52000 },
  'النرجس': { avg: 65000 },
  'الملقا': { avg: 60000 },
  'حطين': { avg: 58000 },
  'الياسمين': { avg: 54000 },
  'القيروان': { avg: 58000 },
  'النخيل': { avg: 59000 },
  'إشبيلية': { avg: 38000 },
};

const listings = [
  { id: 1, hood: 'النرجس', title: 'شقة 3 غرف — حي النرجس', type: 'شقة', adv: 90000, cond: 'good', condLabel: 'حالة جيدة', tags: ['3 غرف', 'موقف', 'دخول ذكي'], fal: '1234567' },
  { id: 2, hood: 'النرجس', title: 'شقة 2 غرف — حي النرجس', type: 'شقة', adv: 42000, cond: 'new', condLabel: 'جديد ✨', tags: ['2 غرفة', 'مجلس', 'مطبخ راكب'], fal: '2345678' },
  { id: 3, hood: 'النرجس', title: 'شقة 3 غرف — مشروع الماجدية', type: 'شقة', adv: 68000, cond: 'new', condLabel: 'جديد ✨', tags: ['3 غرف', 'سنتان', 'مكيفات مركزية'], fal: '3456789' },
  { id: 4, hood: 'العليا', title: 'شقة 2 غرف — حي العليا', type: 'شقة', adv: 52000, cond: 'good', condLabel: 'حالة جيدة', tags: ['2 غرفة', 'مطبخ راكب', '3 سنوات'], fal: '4567890' },
  { id: 5, hood: 'الملقا', title: 'شقة 3 غرف — حي الملقا', type: 'شقة', adv: 48000, cond: 'good', condLabel: 'حالة جيدة', tags: ['3 غرف', '120م²', 'سنة'], fal: '5678901' },
  { id: 6, hood: 'حطين', title: 'استوديو فندقي — حي حطين', type: 'استوديو', adv: 50400, cond: 'new', condLabel: 'جديد ✨', tags: ['مؤثث', 'قرب البوليفارد'], fal: '6789012' },
  { id: 7, hood: 'الياسمين', title: 'شقة 2 غرف — الياسمين', type: 'شقة', adv: 48000, cond: 'good', condLabel: 'حالة جيدة', tags: ['2 غرفة', '90م²', '4 سنوات'], fal: '7890123' },
  { id: 8, hood: 'القيروان', title: 'شقة 3 غرف — القيروان', type: 'شقة', adv: 38000, cond: 'old', condLabel: 'يحتاج ترميم', tags: ['3 غرف', '130م²', '7 سنوات'], fal: '8901234' },
  { id: 9, hood: 'النخيل', title: 'فيلا — حي النخيل', type: 'فيلا', adv: 140000, cond: 'new', condLabel: 'جديد ✨', tags: ['5 غرف', '450م²', 'مسبح'], fal: '9012345' },
  { id: 10, hood: 'إشبيلية', title: 'شقة 2 غرف — إشبيلية', type: 'شقة', adv: 36000, cond: 'good', condLabel: 'حالة جيدة', tags: ['2 غرفة', '80م²', '5 سنوات'], fal: '0123456' },
];

function getFair(l: typeof listings[0]) {
  const m = mktAvg[l.hood];
  if (!m) return l.adv;
  return Math.round(m.avg * (l.type === 'فيلا' ? 2.2 : l.type === 'استوديو' ? 0.55 : 1));
}
function getSt(adv: number, fair: number) { return adv / fair > 1.12 ? 'hi' : adv / fair < 0.85 ? 'lo' : 'ok'; }
function isOpp(l: typeof listings[0]) { return getSt(l.adv, getFair(l)) === 'lo'; }
function rl(st: string) { return st === 'ok' ? 'مناسب ✓' : st === 'hi' ? 'مرتفع ↑' : 'فرصة 🎯'; }

export default function Home() {
  const [page, setPage] = useState<'search' | 'map' | 'alerts' | 'pricing'>('search');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [siZone, setSiZone] = useState('65000');
  const [siPrice, setSiPrice] = useState('65000');
  const [filterHood, setFilterHood] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [prefs, setPrefs] = useState<{ hood: string; type: string; maxBudget: number | null } | null>(null);
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
      const tm = msg.match(/(شقة|فيلا|استوديو)/);
      const pm = msg.match(/(\d{4,6})/);
      if (hm) setFilterHood(hm[0]);
      if (tm) setFilterType(tm[0]);
      if (pm) setFilterBudget(pm[0]);
      if (hm || tm || pm) setPrefs({ hood: hm?.[0] || '', type: tm?.[0] || '', maxBudget: pm ? parseInt(pm[0]) : null });
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'تعذّر الاتصال بالمساعد الذكي' }]);
    }
    setLoading(false);
  };

  const checkPrice = () => {
    const avg = parseInt(siZone);
    const price = parseInt(siPrice) || avg;
    const zoneName = { '65000': 'النرجس', '52000': 'العليا', '60000': 'الملقا', '58000': 'حطين', '54000': 'الياسمين', '38000': 'إشبيلية' }[siZone] || '';
    if (price > avg * 1.12) return { type: 'hi', emoji: '⚠️', title: 'السعر مرتفع', detail: `أعلى بـ ${(price - avg).toLocaleString('ar-SA')} ريال من متوسط ${zoneName}` };
    if (price < avg * 0.85) return { type: 'lo', emoji: '🎯', title: 'فرصة ممتازة!', detail: `أقل بـ ${(avg - price).toLocaleString('ar-SA')} ريال من متوسط ${zoneName}` };
    return { type: 'ok', emoji: '✅', title: 'السعر مناسب للسوق', detail: `متوسط ${zoneName} حوالي ${avg.toLocaleString('ar-SA')} ريال سنوياً` };
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
    new: 'bg-green-100 text-green-800',
    good: 'bg-yellow-100 text-yellow-800',
    old: 'bg-red-100 text-red-800',
  };

  const stColor: Record<string, string> = {
    ok: 'bg-blue-100 text-blue-800',
    hi: 'bg-orange-100 text-orange-800',
    lo: 'bg-green-100 text-green-800',
  };

  const navItems = [
    { id: 'search', label: 'البحث' },
    { id: 'map', label: 'الخريطة' },
    { id: 'alerts', label: 'أحدث الإعلانات' },
    { id: 'pricing', label: 'التسجيل' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F8FB]" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>

      {/* NAV */}
      <nav className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-5 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('search')}>
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-sm border border-white/30">م</div>
          <div>
            <div className="text-white font-bold text-base leading-none">مؤشر</div>
            <div className="text-white/70 text-[9px] tracking-wider">العقارية</div>
          </div>
        </div>
        <div className="flex gap-1 bg-white/10 rounded-xl p-1">
          {navItems.map(n => (
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

      {/* ═══ SEARCH PAGE ═══ */}
      {page === 'search' && (
        <div>
          {/* Hero */}
          <div className="bg-gradient-to-br from-[#0A3D62] via-[#1B6CA8] to-[#378ADD] px-5 pt-6 pb-0 relative overflow-hidden">
            <div className="relative z-10 text-center pb-2">
              <h1 className="text-[#F5F8FB] text-xl font-bold mb-3">سوق الإيجار <span className="text-[#9BC8F0]">بكل وضوح</span></h1>
              <div className="flex flex-wrap gap-3 justify-center mb-4">
                {['استشارة عقارية مجانية', 'اعرف السعر العادل قبل توقيع العقد', 'سوق شفاف، قرار واثق'].map(t => (
                  <span key={t} className="text-white/90 text-xs flex items-center gap-1">
                    <span className="text-[#9BC8F0] text-base">•</span>{t}
                  </span>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-7 bg-[#F5F8FB] rounded-t-3xl" />
          </div>

          <div className="px-4 pt-3 pb-6 space-y-4">

            {/* قسم المساعد الذكي */}
            {prefs && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                <span className="text-xl">👋</span>
                <div className="flex-1 text-sm text-blue-800">
                  <strong>أهلاً بعودتك!</strong> آخر عمليات بحثك:
                  {prefs.hood && <span> {prefs.hood}</span>}
                  {prefs.type && <span> · {prefs.type}</span>}
                  {prefs.maxBudget && <span> · {prefs.maxBudget.toLocaleString('ar-SA')} ريال</span>}
                </div>
                <button onClick={() => setPrefs(null)} className="text-gray-400 text-xs">مسح</button>
              </div>
            )}

            <div className="bg-white rounded-2xl overflow-hidden border-2 border-blue-200 shadow-sm" style={{ background: 'linear-gradient(180deg, #F4FAFF 0%, #fff 60px)' }}>
              <div className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg border border-white/30">🤖</div>
                <div className="flex-1">
                  <div className="text-white font-bold text-sm">المساعد الذكي</div>
                  <div className="text-white/80 text-xs">صِف ما تبحث عنه بكلامك الخاص</div>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#9BE5C5] shadow-[0_0_8px_rgba(155,229,197,0.6)] animate-pulse" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {['رب أسرة · 65 ألف', 'أعزب · استوديو', 'عائلة · فيلا'].map(s => (
                    <button key={s} onClick={() => setInputVal(s)}
                      className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all">
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
                      <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed max-w-[85%] ${m.role === 'user' ? 'bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white rounded-tr-sm' : 'bg-blue-50 text-gray-800 rounded-tl-sm'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-800">م</div>
                      <div className="bg-blue-50 px-3 py-2 rounded-xl flex gap-1">
                        {[0, 150, 300].map(d => (
                          <div key={d} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                  <input value={inputVal} onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendAI()}
                    placeholder="اكتب طلبك — مثال: شقة 3 غرف بالنرجس بميزانية 70 ألف..."
                    className="flex-1 bg-transparent text-sm outline-none text-right placeholder-gray-400" dir="rtl" />
                  <button onClick={sendAI} disabled={loading}
                    className="w-8 h-8 bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] text-white rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-50">
                    ←
                  </button>
                </div>
              </div>
            </div>

            {/* قسم البحث */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-lg">🔍</div>
                <div>
                  <div className="font-bold text-sm text-gray-800">ابحث عن إيجارك المناسب</div>
                  <div className="text-xs text-gray-500">حدّد المعايير لتظهر لك العقارات المتاحة</div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                {[
                  { label: 'الحي', id: 'hood', value: filterHood, setter: setFilterHood, options: Object.keys(mktAvg) },
                  { label: 'نوع العقار', id: 'type', value: filterType, setter: setFilterType, options: ['شقة', 'فيلا', 'دور', 'استوديو'] },
                ].map(f => (
                  <div key={f.id}>
                    <label className="text-xs text-gray-500 block mb-1 font-medium">{f.label}</label>
                    <select value={f.value} onChange={e => f.setter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-right outline-none focus:border-blue-400">
                      <option value="">الكل</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">الميزانية السنوية</label>
                  <input type="number" value={filterBudget} onChange={e => setFilterBudget(e.target.value)}
                    placeholder="مثال: 70000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:border-blue-400 text-right" />
                </div>
              </div>
            </div>

            {/* قسم المؤشر */}
            <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-yellow-50 to-white px-4 py-3 border-b border-orange-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-lg">📊</div>
                <div>
                  <div className="font-bold text-sm text-gray-800">جرّب المؤشر</div>
                  <div className="text-xs text-gray-500">أدخل قيمة الإيجار وسنخبرك إن كانت مناسبة</div>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <select value={siZone} onChange={e => setSiZone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm text-right outline-none focus:border-blue-400">
                    {[['65000', 'النرجس'], ['52000', 'العليا'], ['60000', 'الملقا'], ['58000', 'حطين'], ['54000', 'الياسمين'], ['38000', 'إشبيلية']].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <input type="number" value={siPrice} onChange={e => setSiPrice(e.target.value)}
                    placeholder="65000"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:border-blue-400 text-right" />
                </div>
                <div className={`p-3 rounded-xl flex items-center gap-3 border ${indicator.type === 'ok' ? 'bg-blue-50 border-blue-200' : indicator.type === 'hi' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                  <span className="text-3xl">{indicator.emoji}</span>
                  <div>
                    <div className={`font-bold text-sm ${indicator.type === 'ok' ? 'text-blue-800' : indicator.type === 'hi' ? 'text-orange-700' : 'text-green-700'}`}>{indicator.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{indicator.detail}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* قسم التمويل */}
            <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] rounded-2xl p-6 text-center shadow-xl">
              <div className="text-4xl mb-2">🏦</div>
              <div className="text-white font-bold text-lg mb-2">تحتاج تمويلاً عقارياً؟</div>
              <div className="text-white/85 text-sm mb-4 leading-relaxed max-w-sm mx-auto">نربطك مباشرة بشركائنا من الجهات التمويلية المعتمدة لتحصل على أفضل عرض يناسبك</div>
              <button className="bg-white text-[#0A3D62] px-8 py-3 rounded-xl font-bold text-sm shadow-lg hover:-translate-y-0.5 transition-all">
                اطلب التمويل الآن ←
              </button>
              <div className="text-white/70 text-xs mt-3">✓ خدمة مجانية   ·   ✓ ردود سريعة   ·   ✓ مقارنة عروض</div>
            </div>

            {/* نتائج البحث */}
            {filtered.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <div className="font-bold text-gray-800">{filtered.length} نتيجة{filterHood ? ` — ${filterHood}` : ''}</div>
                  <div className="text-xs text-gray-500">📊 بيانات حقيقية</div>
                </div>
                <div className="space-y-3">
                  {filtered.map(l => {
                    const fair = getFair(l);
                    const st = getSt(l.adv, fair);
                    const diff = Math.abs(l.adv - fair).toLocaleString('ar-SA');
                    const dtxt = l.adv > fair ? `أعلى بـ ${diff}` : l.adv < fair ? `وفّر ${diff} ريال!` : 'يطابق المتوسط';
                    return (
                      <div key={l.id} className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all relative overflow-hidden ${isOpp(l) ? 'border-green-400 bg-gradient-to-r from-green-50 to-white' : 'border-gray-200'}`}>
                        {isOpp(l) && <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-3 py-1 rounded-bl-lg font-bold">🎯 فرصة</div>}
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-lg font-bold text-gray-800">{l.adv.toLocaleString('ar-SA')} ريال/سنة</div>
                            <div className="text-xs text-blue-600 mt-0.5">🎯 السعر العادل: {fair.toLocaleString('ar-SA')} · {dtxt}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{l.title}</div>
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-xl font-bold ${stColor[st]}`}>{rl(st)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${condColor[l.cond]}`}>{l.condLabel}</span>
                          {l.tags.map(t => <span key={t} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg">{t}</span>)}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />رخصة فال: {l.fal} ✓</span>
                          <span className="text-xs text-gray-400 bg-blue-50 px-2 py-0.5 rounded">📊 عقار.fm</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MAP PAGE ═══ */}
      {page === 'map' && (
        <div>
          <div className="bg-white px-4 py-3 flex gap-2 flex-wrap border-b border-gray-100">
            <span className="font-bold text-gray-800 ml-2">خريطة الإيجارات</span>
            {['الكل', 'شقق', 'فلل', 'استوديو', 'الفرص 🎯'].map(f => (
              <button key={f} className="bg-blue-50 border border-gray-200 px-3 py-1.5 rounded-2xl text-sm text-gray-500 hover:bg-blue-100 transition-all">{f}</button>
            ))}
          </div>
          <div className="bg-gradient-to-br from-[#E6F1FB] to-[#b5d4f4] flex items-center justify-center" style={{ height: '400px' }}>
            <div className="text-center">
              <div className="text-5xl mb-3">🗺️</div>
              <div className="font-bold text-[#0A3D62] text-lg mb-2">الخريطة التفاعلية</div>
              <div className="text-sm text-gray-500 max-w-xs">سيتم تفعيل الخريطة التفاعلية عند الربط مع قاعدة البيانات</div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="font-bold text-gray-800 mb-2">كل الإعلانات</div>
            {listings.map(l => {
              const fair = getFair(l);
              const st = getSt(l.adv, fair);
              return (
                <div key={l.id} className={`bg-white rounded-xl border p-3 flex justify-between items-center ${isOpp(l) ? 'border-green-400' : 'border-gray-200'}`}>
                  <div>
                    <div className="font-bold text-sm">{l.adv.toLocaleString('ar-SA')} ريال/سنة</div>
                    <div className="text-xs text-gray-500 mt-0.5">{l.title}</div>
                    <div className="text-xs text-blue-600 mt-0.5">السعر العادل: {fair.toLocaleString('ar-SA')}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-xl font-bold ${stColor[st]}`}>{rl(st)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ALERTS PAGE ═══ */}
      {page === 'alerts' && (
        <div className="p-4">
          <div className="bg-gradient-to-l from-green-500 to-green-600 rounded-2xl p-5 text-white mb-4 flex items-center gap-4">
            <span className="text-4xl">📰</span>
            <div>
              <h2 className="font-bold text-lg mb-1">أحدث الإعلانات</h2>
              <p className="text-sm opacity-90">أحدث ما طُرح في السوق العقاري — مرتّبة حسب الأقرب زمنياً</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">2</div>
              <div className="text-xs text-gray-500 mt-1">تنبيهات مفعّلة</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{opportunities.length}</div>
              <div className="text-xs text-gray-500 mt-1">إعلانات جديدة اليوم</div>
            </div>
          </div>
          <div className="font-bold text-gray-800 mb-3">⚡ الإعلانات الجديدة</div>
          <div className="space-y-3">
            {opportunities.map((l, i) => {
              const fair = getFair(l);
              const sav = fair - l.adv;
              return (
                <div key={l.id} className={`bg-white rounded-xl border-r-4 border border-green-500 p-4 cursor-pointer ${i < 2 ? 'bg-green-50' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-sm">{l.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">قبل {i * 3 + 5} دقائق · {l.hood}</div>
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-xl font-bold whitespace-nowrap">وفّر {sav.toLocaleString('ar-SA')}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    سعر المُعلن <strong className="text-gray-700">{l.adv.toLocaleString('ar-SA')} ريال</strong> · السعر العادل <strong className="text-gray-700">{fair.toLocaleString('ar-SA')} ريال</strong> · {l.condLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ PRICING PAGE ═══ */}
      {page === 'pricing' && (
        <div>
          <div className="bg-gradient-to-br from-[#0A3D62] to-[#1B6CA8] px-5 py-8 text-center text-white relative">
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#F5F8FB] rounded-t-3xl" />
            <div className="relative z-10">
              <span className="bg-white/20 text-white text-sm px-4 py-1.5 rounded-2xl border border-white/30 font-medium">🎉 التسجيل مجاناً لفترة محدودة</span>
              <h1 className="text-2xl font-bold mt-4 mb-2">سجّل في مؤشر العقارية</h1>
              <p className="text-white/85 text-sm max-w-sm mx-auto">اختر نوع حسابك للبدء — للباحثين عن إيجار أو للمكاتب العقارية</p>
            </div>
          </div>
          <div className="p-4 space-y-4">
            {[
              { name: 'باحث عن إيجار', desc: 'ابحث وقارن واحصل على تنبيهات', features: ['بحث غير محدود', 'مؤشر السعر العادل', '5 استشارات AI شهرياً', 'تنبيه واحد للإعلانات الجديدة'], popular: false },
              { name: 'مكتب عقاري', desc: 'أضف إعلاناتك وأدر عمليائك', features: ['حتى 10 إعلانات نشطة', 'التحقق التلقائي من فال', 'تقييم تلقائي بالسعر العادل', 'AI لإدارة الردود'], popular: true },
            ].map(plan => (
              <div key={plan.name} className={`bg-white rounded-2xl p-5 border-2 ${plan.popular ? 'border-green-400 shadow-lg' : 'border-gray-200'}`}>
                {plan.popular && <div className="bg-gradient-to-l from-green-500 to-green-400 text-white text-xs px-4 py-1 rounded-xl inline-block mb-3 font-bold">⭐ الأكثر طلباً</div>}
                <div className="font-bold text-lg text-[#0A3D62] mb-1">{plan.name}</div>
                <div className="text-sm text-gray-500 mb-3">{plan.desc}</div>
                <div className="bg-gradient-to-l from-green-500 to-green-400 text-white text-lg font-bold px-5 py-2 rounded-xl inline-block mb-2">مجاناً</div>
                <div className="text-xs text-gray-400 mb-4">لفترة محدودة 🎁</div>
                <ul className="space-y-2 mb-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 text-xs font-bold flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${plan.popular ? 'bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white shadow-md' : 'bg-white border-2 border-blue-500 text-[#0A3D62]'}`}>
                  {plan.popular ? 'اشترك الآن — مجاناً' : 'ابدأ الآن'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 py-4 px-5 text-center text-xs text-gray-400">
        <button onClick={() => {}} className="text-blue-500 font-medium hover:underline">سياسة الخصوصية</button>
        <span className="mx-3">·</span>
        <button onClick={() => {}} className="text-blue-500 font-medium hover:underline">شروط الاستخدام</button>
        <span className="mx-3">·</span>
        <span>© 2025 مؤشر العقارية</span>
      </div>

    </div>
  );
}