'use client';
// ════════════════════════════════════════════════════════════
//  الهوية المشتركة لكل الصفحات العامة (تصميم Stitch الفاتح).
//
//  • SiteHeader: شريط علوي زجاجي لاصق (64px) — العلامة يميناً (RTL)، روابط
//    وسطية على سطح المكتب، زر الحساب/الدخول + مبدّل اللغة (ع/EN)، وزر قائمة
//    (☰) للجوال يفتح درجاً من اليمين يضم كل الروابط + منطقة الحساب.
//  • SiteFooter: تذييل بأعمدة الروابط الحقيقية.
//
//  النصوص تمرّ عبر i18n (useLang/t) — عربي افتراضي، إنجليزي اختياري.
//  المظهر كله من globals.css تحت نطاق `.site`.
// ════════════════════════════════════════════════════════════
import { useState } from 'react';
import { useLang } from '@/lib/i18n';

export interface SiteNavUser {
  email: string | null;
}

interface SiteHeaderProps {
  active?: string;
  onNavigate?: (id: string) => void;
  user?: SiteNavUser | null;
  isAdmin?: boolean;
  isOffice?: boolean;
  isSearcher?: boolean;
  notifCount?: number;
  onSignOut?: () => void;
}

// أيقونة Material Symbols (الخط محمّل في layout.tsx؛ الحجم/اللون عبر CSS تحت .site)
const msi = (name: string) => <span className="material-symbols-outlined">{name}</span>;

// روابط التنقّل — المفتاح للترجمة (t) لا نص ثابت
const PRIMARY: { id: string; key: string; icon: string }[] = [
  { id: 'home', key: 'nav.home', icon: 'home' },
  { id: 'search', key: 'nav.search', icon: 'search' },
  { id: 'indicator', key: 'nav.indicator', icon: 'query_stats' },
  { id: 'finance', key: 'nav.finance', icon: 'account_balance' },
  { id: 'inquiries', key: 'nav.inquiries', icon: 'forum' },
];

const SECONDARY: { id: string; key: string; icon: string }[] = [
  { id: 'pricing', key: 'nav.pricing', icon: 'store' },
  { id: 'about', key: 'nav.about', icon: 'info' },
];

// رابط حقيقي لكل وجهة (SEO + فتح في تبويب جديد + مشاركة). الرئيسية = «/»، والبقية
// hash-route على الصفحة الواحدة («/#search»…) يقرؤها page.tsx عند التحميل.
const hrefFor = (id: string) => (id === 'home' ? '/' : '/#' + id);

export function SiteHeader({ active, onNavigate, user, isAdmin, isOffice, isSearcher, notifCount, onSignOut }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  const { t, lang, dir, setLang } = useLang();

  const go = (id: string) => {
    setOpen(false);
    if (onNavigate) { onNavigate(id); if (typeof window !== 'undefined') window.scrollTo(0, 0); }
    else if (typeof window !== 'undefined') window.location.href = hrefFor(id);
  };

  // مبدّل اللغة (ع / EN) — يظهر على كل الصفحات العامة، سطح المكتب والجوال
  const langToggle = (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')} aria-pressed={lang === 'ar'}>ع</button>
      <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
    </div>
  );

  const accountButtons = (variant: 'bar' | 'drawer') => {
    if (!user) {
      return (
        <button className={variant === 'bar' ? 'login-btn' : 'drawer-cta'} onClick={() => go('pricing')}>
          {msi('login')} {t('nav.login')}
        </button>
      );
    }
    return (
      <>
        {isAdmin ? (
          <a className={variant === 'bar' ? 'login-btn' : 'drawer-cta'} href="/admin">
            {msi('shield_person')} {t('nav.admin')}
          </a>
        ) : isOffice ? (
          <button className={variant === 'bar' ? 'login-btn' : 'drawer-cta'} onClick={() => go('office')}>
            {msi('store')} {t('nav.office')}
          </button>
        ) : isSearcher ? (
          <button className={variant === 'bar' ? 'login-btn' : 'drawer-cta'} onClick={() => go('account')}>
            {msi('person')} {t('nav.account')}
            {!!notifCount && notifCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 4px', marginInlineStart: 6, background: '#ef4444', color: '#fff', fontSize: 10, borderRadius: 9999 }}>{notifCount}</span>
            )}
          </button>
        ) : null}
        {onSignOut && (
          <button className={variant === 'bar' ? 'ghost-btn' : 'drawer-ghost'} onClick={() => { setOpen(false); onSignOut(); }}>
            {msi('logout')} {t('nav.signout')}
          </button>
        )}
      </>
    );
  };

  const drawerItem = (it: { id: string; key: string; icon: string }) => (
    <a key={it.id} href={hrefFor(it.id)} className={`drawer-link${active === it.id ? ' active' : ''}`}
      onClick={(e) => { e.preventDefault(); go(it.id); }}>
      {msi(it.icon)} {t(it.key)}
    </a>
  );

  return (
    <>
      <header className="site-nav">
        <div className="wrap site-nav__inner">
          {/* العلامة (يمين في RTL) */}
          <button className="brand" onClick={() => go('home')}>
            <span>{t('brand')}</span>{msi('real_estate_agent')}
          </button>

          {/* روابط وسطية (سطح المكتب) — روابط حقيقية بـ href (SEO/تبويب جديد) مع تنقّل SPA */}
          <nav className="nav-center">
            {PRIMARY.map((it) => (
              <a key={it.id} href={hrefFor(it.id)} className={active === it.id ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); go(it.id); }}>{t(it.key)}</a>
            ))}
          </nav>

          {/* الإجراءات (يسار) + مبدّل اللغة + زر القائمة للجوال */}
          <div className="nav-actions">
            <div className="nav-account">{accountButtons('bar')}</div>
            {langToggle}
            <button className="nav-burger" aria-label={t('nav.menuTitle')} onClick={() => setOpen(true)}>
              {msi('menu')}
            </button>
          </div>
        </div>
      </header>

      {/* الدرج الجانبي (جوال / كل الروابط) */}
      <div className={`site-drawer__overlay${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`site-drawer${open ? ' open' : ''}`} dir={dir}>
        <div className="site-drawer__head">
          <div className="site-drawer__title">
            <div className="t">{t('nav.menuTitle')}</div>
            <div className="s">{t('brand')}</div>
          </div>
          <button className="site-drawer__close" aria-label={t('nav.menuTitle')} onClick={() => setOpen(false)}>{msi('close')}</button>
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
  const { t } = useLang();
  const go = (id: string) => {
    if (onNavigate) { onNavigate(id); if (typeof window !== 'undefined') window.scrollTo(0, 0); }
    else if (typeof window !== 'undefined') window.location.href = hrefFor(id);
  };
  // رابط تذييل حقيقي بـ href (SEO/تبويب جديد) مع تنقّل SPA عند النقر العادي
  const fl = (id: string, label: string) => (
    <a href={hrefFor(id)} onClick={(e) => { e.preventDefault(); go(id); }}>{label}</a>
  );
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-col">
            <h4>{t('foot.quickLinks')}</h4>
            {fl('home', t('nav.home'))}
            {fl('search', t('nav.search'))}
            {fl('indicator', t('nav.indicator'))}
          </div>
          <div className="foot-col">
            <h4>{t('foot.legal')}</h4>
            {fl('terms', t('foot.terms'))}
            {fl('privacy', t('foot.privacy'))}
          </div>
          <div className="foot-col">
            <h4>{t('foot.company')}</h4>
            {fl('about', t('nav.about'))}
            {fl('inquiries', t('foot.contact'))}
            {fl('pricing', t('nav.pricing'))}
          </div>
          <div className="foot-col foot-brand">
            <div className="b"><span>{t('brand')}</span>{msi('real_estate_agent')}</div>
            <p>{t('foot.tagline')}</p>
          </div>
        </div>
        <div className="foot-bottom">{t('foot.rights')}</div>
      </div>
    </footer>
  );
}
