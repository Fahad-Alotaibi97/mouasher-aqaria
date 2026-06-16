'use client';
// ════════════════════════════════════════════════════════════
//  الهوية المشتركة لكل الصفحات العامة (تصميم Stitch الفاتح).
//
//  • SiteHeader: شريط علوي زجاجي لاصق (64px) — العلامة يميناً (RTL)، روابط
//    وسطية على سطح المكتب، زر الحساب/الدخول يساراً، وزر قائمة (☰) للجوال
//    يفتح درجاً من اليمين يضم كل الروابط + منطقة الحساب (دخول/مدير/مكتب/خروج).
//  • SiteFooter: تذييل بأعمدة الروابط الحقيقية (نفس تذييل الرئيسية).
//
//  يُستخدمان في كل الصفحات العامة (بما فيها الرئيسية) لتوحيد التنقّل والهوية.
//  التنقّل: مع onNavigate ⇒ تنقّل داخلي (تبديل حالة الصفحة في «/»)؛ بدونه
//  (صفحات مستقلة مثل /reset-password أو /admin) ⇒ انتقال إلى «/#<id>».
//  المظهر كله من globals.css تحت نطاق `.site` — هذا الملف بنية فقط.
// ════════════════════════════════════════════════════════════
import { useState } from 'react';

export interface SiteNavUser {
  email: string | null;
}

interface SiteHeaderProps {
  active?: string;
  onNavigate?: (id: string) => void;
  user?: SiteNavUser | null;
  isAdmin?: boolean;
  isOffice?: boolean;
  onSignOut?: () => void;
}

// أيقونة Material Symbols (الخط محمّل في layout.tsx؛ الحجم/اللون عبر CSS تحت .site)
const msi = (name: string) => <span className="material-symbols-outlined">{name}</span>;

// روابط التنقّل الأساسية — كل بند صفحته الخاصّة
const PRIMARY: { id: string; label: string; icon: string }[] = [
  { id: 'home', label: 'الرئيسية', icon: 'home' },
  { id: 'search', label: 'ابحث عن إيجارك', icon: 'search' },
  { id: 'indicator', label: 'مؤشر أسعار الحي', icon: 'query_stats' },
  { id: 'finance', label: 'خيارات تقسيط الإيجار', icon: 'account_balance' },
  { id: 'inquiries', label: 'الاستفسارات', icon: 'forum' },
];

// روابط ثانوية (في الدرج) — «سجّل مكتبك» للتسجيل الجديد فقط
const SECONDARY: { id: string; label: string; icon: string }[] = [
  { id: 'pricing', label: 'سجّل مكتبك العقاري', icon: 'store' },
  { id: 'about', label: 'عن المنصة', icon: 'info' },
];

export function SiteHeader({ active, onNavigate, user, isAdmin, isOffice, onSignOut }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);

  const go = (id: string) => {
    setOpen(false);
    if (onNavigate) { onNavigate(id); if (typeof window !== 'undefined') window.scrollTo(0, 0); }
    else if (typeof window !== 'undefined') window.location.href = '/#' + id;
  };

  // عناصر الحساب (تُعرض في شريط سطح المكتب وفي الدرج)
  const accountButtons = (variant: 'bar' | 'drawer') => {
    if (!user) {
      return (
        <button className={variant === 'bar' ? 'login-btn' : 'drawer-cta'} onClick={() => go('pricing')}>
          {msi('login')} دخول
        </button>
      );
    }
    return (
      <>
        {isAdmin ? (
          <a className={variant === 'bar' ? 'login-btn' : 'drawer-cta'} href="/admin">
            {msi('shield_person')} لوحة الإدارة
          </a>
        ) : isOffice ? (
          <button className={variant === 'bar' ? 'login-btn' : 'drawer-cta'} onClick={() => go('office')}>
            {msi('store')} لوحة المكتب
          </button>
        ) : null}
        {onSignOut && (
          <button className={variant === 'bar' ? 'ghost-btn' : 'drawer-ghost'} onClick={() => { setOpen(false); onSignOut(); }}>
            {msi('logout')} خروج
          </button>
        )}
      </>
    );
  };

  const drawerItem = (it: { id: string; label: string; icon: string }) => (
    <button key={it.id} className={`drawer-link${active === it.id ? ' active' : ''}`} onClick={() => go(it.id)}>
      {msi(it.icon)} {it.label}
    </button>
  );

  return (
    <>
      <header className="site-nav">
        <div className="wrap site-nav__inner">
          {/* العلامة (يمين في RTL) */}
          <button className="brand" onClick={() => go('home')}>
            <span>مؤشر العقارية</span>{msi('real_estate_agent')}
          </button>

          {/* روابط وسطية (سطح المكتب) */}
          <nav className="nav-center">
            {PRIMARY.map((it) => (
              <a key={it.id} className={active === it.id ? 'active' : ''} onClick={() => go(it.id)}>{it.label}</a>
            ))}
          </nav>

          {/* الإجراءات (يسار) + زر القائمة للجوال */}
          <div className="nav-actions">
            <div className="nav-account">{accountButtons('bar')}</div>
            <button className="nav-burger" aria-label="فتح القائمة" onClick={() => setOpen(true)}>
              {msi('menu')}
            </button>
          </div>
        </div>
      </header>

      {/* الدرج الجانبي (جوال / كل الروابط) */}
      <div className={`site-drawer__overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`site-drawer${open ? ' open' : ''}`} dir="rtl">
        <div className="site-drawer__head">
          <div className="site-drawer__title">
            <div className="t">القائمة</div>
            <div className="s">مؤشر العقارية</div>
          </div>
          <button className="site-drawer__close" aria-label="إغلاق القائمة" onClick={() => setOpen(false)}>{msi('close')}</button>
        </div>
        <div className="site-drawer__links">
          {PRIMARY.map(drawerItem)}
          <div className="site-drawer__sep" />
          {SECONDARY.filter((it) => !(isOffice && it.id === 'pricing')).map(drawerItem)}
        </div>
        <div className="site-drawer__account">
          {user && <div className="site-drawer__email" title={user.email || ''}>{user.email}</div>}
          {accountButtons('drawer')}
        </div>
      </aside>
    </>
  );
}

interface SiteFooterProps {
  onNavigate?: (id: string) => void;
}

export function SiteFooter({ onNavigate }: SiteFooterProps) {
  const go = (id: string) => {
    if (onNavigate) { onNavigate(id); if (typeof window !== 'undefined') window.scrollTo(0, 0); }
    else if (typeof window !== 'undefined') window.location.href = '/#' + id;
  };
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-col">
            <h4>روابط سريعة</h4>
            <a onClick={() => go('home')}>الرئيسية</a>
            <a onClick={() => go('search')}>ابحث عن إيجارك</a>
            <a onClick={() => go('indicator')}>مؤشر أسعار الحي</a>
          </div>
          <div className="foot-col">
            <h4>قانوني</h4>
            <a onClick={() => go('terms')}>شروط الاستخدام</a>
            <a onClick={() => go('privacy')}>سياسة الخصوصية</a>
          </div>
          <div className="foot-col">
            <h4>الشركة</h4>
            <a onClick={() => go('about')}>عن المنصة</a>
            <a onClick={() => go('inquiries')}>تواصل معنا</a>
            <a onClick={() => go('pricing')}>سجّل مكتبك العقاري</a>
          </div>
          <div className="foot-col foot-brand">
            <div className="b"><span>مؤشر العقارية</span>{msi('real_estate_agent')}</div>
            <p>دقّة عقارية للرياض — سوق الإيجار بكل وضوح © 2026.</p>
          </div>
        </div>
        <div className="foot-bottom">جميع الحقوق محفوظة — مؤشر العقارية · الرياض</div>
      </div>
    </footer>
  );
}
