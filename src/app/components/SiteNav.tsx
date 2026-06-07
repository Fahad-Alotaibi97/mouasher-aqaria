'use client';
// ════════════════════════════════════════════════════════════
//  المكوّن المشترك: الشريط العلوي + الدرج الجانبي المنزلق من اليمين.
//  يُستخدم في كل الصفحات ليكون التنقّل موحّداً تماماً.
//
//  • الشريط العلوي: تدرّج العلامة (كحلي → أزرق)، الشعار يساراً، زر القائمة (☰) يميناً.
//  • الدرج: ينزلق من اليمين، يحوي كل روابط التنقّل + منطقة الحساب.
//
//  التنقّل:
//   - في الصفحة الرئيسية يُمرَّر onNavigate ⇒ تنقّل داخلي (تبديل حالة الصفحة).
//   - في صفحات أخرى (مثل /admin) لا يُمرَّر onNavigate ⇒ ننتقل إلى '/#<id>'
//     والصفحة الرئيسية تقرأ الـ hash عند التحميل وتفتح القسم المطلوب.
// ════════════════════════════════════════════════════════════
import { useState } from 'react';

export interface SiteNavUser {
  email: string | null;
}

interface SiteNavProps {
  active?: string;                       // معرّف الصفحة الحالية (للإبراز)
  onNavigate?: (id: string) => void;     // معالج التنقّل الداخلي (الصفحة الرئيسية)
  user?: SiteNavUser | null;
  isAdmin?: boolean;
  onSignOut?: () => void;
}

// أيقونات الدرج (نفس روح التصميم المعتمد)
const I = {
  logo: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><path d="M3 21h18M9 21V7l6-4v18M9 7H3v14" /><path d="M13 11h2M13 15h2M5 11h2M5 15h2" /></svg>
  ),
  home: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>),
  search: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>),
  chart: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18" /><path d="M7 16l4-6 4 4 4-8" /></svg>),
  map: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>),
  bell: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>),
  bank: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>),
  office: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>),
  info: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>),
  logout: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>),
  shield: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>),
};

// روابط الدرج — كل القائمة القديمة منقولة هنا
const NAV_ITEMS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'search', label: 'الرئيسية', icon: I.home },
  { id: 'search-focus', label: 'البحث عن إيجار', icon: I.search },
  { id: 'indicator', label: 'مؤشر السعر العادل', icon: I.chart },
  { id: 'map', label: 'الخريطة', icon: I.map },
  { id: 'alerts', label: 'أحدث الإعلانات', icon: I.bell },
  { id: 'finance', label: 'التمويل العقاري', icon: I.bank },
];

const NAV_ITEMS_SECONDARY: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'pricing', label: 'سجّل مكتبك العقاري', icon: I.office },
  { id: 'about', label: 'عن المنصة', icon: I.info },
];

export default function SiteNav({ active, onNavigate, user, isAdmin, onSignOut }: SiteNavProps) {
  const [open, setOpen] = useState(false);

  const go = (id: string) => {
    setOpen(false);
    if (onNavigate) onNavigate(id);
    else if (typeof window !== 'undefined') window.location.href = '/#' + id;
  };

  const item = (it: { id: string; label: string; icon: React.ReactNode }) => {
    const isActive = active === it.id;
    return (
      <button
        key={it.id + it.label}
        onClick={() => go(it.id)}
        className={`w-full flex items-center gap-3 px-6 py-3.5 text-white text-[15px] font-medium text-right border-r-[3px] transition-colors ${isActive ? 'bg-white/10 border-[#C9A84C]' : 'border-transparent hover:bg-white/10 hover:border-[#C9A84C]'}`}
      >
        <span className="w-5 h-5 opacity-90 flex-shrink-0">{it.icon}</span>
        {it.label}
      </button>
    );
  };

  return (
    <>
      {/* ===== الشريط العلوي ===== */}
      <nav
        dir="rtl"
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] shadow-lg"
      >
        {/* زر القائمة (يمين) */}
        <button
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
          className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex flex-col items-center justify-center gap-[5px] hover:bg-white/25 transition-colors"
        >
          <span className="block w-[18px] h-[2px] bg-white rounded-full" />
          <span className="block w-[18px] h-[2px] bg-white rounded-full" />
          <span className="block w-[18px] h-[2px] bg-white rounded-full" />
        </button>

        {/* الشعار + اسم العلامة (يسار) */}
        <button onClick={() => go('search')} className="flex items-center gap-2.5">
          <span className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center flex-shrink-0">
            {I.logo}
          </span>
          <span className="text-white font-extrabold text-lg leading-none">مؤشر العقارية</span>
        </button>
      </nav>

      {/* ===== الغطاء ===== */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[60] bg-[#0A3D62]/40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* ===== الدرج الجانبي (من اليمين) ===== */}
      <aside
        dir="rtl"
        className={`fixed top-0 right-0 h-full w-[290px] max-w-[85vw] z-[70] bg-gradient-to-b from-[#0A3D62] to-[#1B6CA8] overflow-y-auto transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* رأس الدرج */}
        <div className="flex items-center justify-between px-5 pb-4 pt-5 mb-3 border-b border-white/15">
          <div className="leading-tight">
            <div className="text-white font-extrabold text-base">القائمة</div>
            <div className="text-white/70 text-[11px]">مؤشر العقارية</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="إغلاق القائمة"
            className="w-9 h-9 rounded-lg bg-white/15 text-white text-xl leading-none hover:bg-white/25 transition-colors"
          >
            ×
          </button>
        </div>

        {/* الروابط الأساسية */}
        {NAV_ITEMS.map(item)}

        <div className="h-px bg-white/12 mx-6 my-3" />

        {/* روابط ثانوية */}
        {NAV_ITEMS_SECONDARY.map(item)}

        {/* منطقة الحساب */}
        <div className="mt-4 px-6">
          {user ? (
            <div className="space-y-2">
              <div className="text-white/70 text-[11px] truncate" title={user.email || ''}>
                {user.email}
              </div>
              {isAdmin && (
                <a
                  href="/admin"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C9A84C] text-[#0A3D62] font-bold text-sm"
                >
                  <span className="w-4 h-4">{I.shield}</span>
                  لوحة الإدارة
                </a>
              )}
              {onSignOut && (
                <button
                  onClick={() => { setOpen(false); onSignOut(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/15 border border-white/25 text-white font-bold text-sm hover:bg-white/25 transition-colors"
                >
                  <span className="w-4 h-4">{I.logout}</span>
                  تسجيل الخروج
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => go('pricing')}
              className="w-full py-3.5 rounded-xl bg-[#C9A84C] text-[#0A3D62] font-bold text-sm"
            >
              تسجيل الدخول
            </button>
          )}
        </div>

        <div className="h-6" />
      </aside>
    </>
  );
}
