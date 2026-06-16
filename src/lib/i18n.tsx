'use client';
// ════════════════════════════════════════════════════════════
//  i18n خفيف للموقع العام — عربي (افتراضي) / إنجليزي.
//
//  • قاموس STRINGS: كل مفتاح له { ar, en } — نصوص الواجهة الحقيقية فقط
//    (لا تُترجَم بيانات المستخدم: الإعلانات/الأحياء/الأنواع تبقى كما أُدخلت).
//  • LangProvider: يحفظ اللغة في localStorage ويضبط dir/lang على <html>.
//    الافتراضي «ar» (RTL) — لا يتغيّر السلوك العربي. الإنجليزية تضيف LTR.
//  • لوحة /admin الداكنة محميّة: غلافها يحمل dir="rtl" صراحةً فلا يتأثّر
//    باتجاه <html> العام، وتستخدم SiteNav (لا SiteChrome) فلا يظهر فيها المبدّل.
// ════════════════════════════════════════════════════════════
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Lang = 'ar' | 'en';
const LS_KEY = 'maq_lang';

type Entry = { ar: string; en: string };

export const STRINGS: Record<string, Entry> = {
  // العلامة
  'brand': { ar: 'مؤشر العقارية', en: 'Aqaria Index' },

  // الشريط العلوي
  'nav.home': { ar: 'الرئيسية', en: 'Home' },
  'nav.search': { ar: 'ابحث عن إيجارك', en: 'Find a Rental' },
  'nav.indicator': { ar: 'مؤشر أسعار الحي', en: 'Neighborhood Price Index' },
  'nav.finance': { ar: 'خيارات تقسيط الإيجار', en: 'Rent Installments' },
  'nav.inquiries': { ar: 'الاستفسارات', en: 'Inquiries' },
  'nav.pricing': { ar: 'سجّل مكتبك العقاري', en: 'Register Your Office' },
  'nav.about': { ar: 'عن المنصة', en: 'About' },
  'nav.login': { ar: 'دخول', en: 'Sign in' },
  'nav.admin': { ar: 'لوحة الإدارة', en: 'Admin Panel' },
  'nav.office': { ar: 'لوحة المكتب', en: 'Office Panel' },
  'nav.signout': { ar: 'خروج', en: 'Sign out' },
  'nav.menuTitle': { ar: 'القائمة', en: 'Menu' },

  // البطل (Hero)
  'hero.h1': { ar: 'ابحث عن إيجارك المثالي', en: 'Find your perfect rental' },
  'hero.sub': { ar: 'اكتشف أفضل عروض الإيجار في الرياض مع مؤشر أسعار حي دقيق وموثوق.', en: 'Discover the best rental offers in Riyadh with an accurate, trusted neighborhood price index.' },
  'hero.placeholder': { ar: 'ابحث بالحي، نوع العقار، أو رغبتك…', en: 'Search by neighborhood, property type, or what you need…' },
  'hero.searchBtn': { ar: 'بحث', en: 'Search' },
  'hero.aiLabel': { ar: 'المساعد الذكي:', en: 'Smart assistant:' },

  // أنواع العقار (شارات البطل) — التسمية فقط؛ القيمة تبقى عربية للمنطق
  'type.villa': { ar: 'فلل', en: 'Villas' },
  'type.apartment': { ar: 'شقق', en: 'Apartments' },
  'type.commercial': { ar: 'تجاري', en: 'Commercial' },

  // عبارات المساعد الذكي (التسمية فقط؛ الاستعلام يبقى عربياً للمطابقة المحلّية)
  'ai.cheapest': { ar: 'أرخص شقة متاحة', en: 'Cheapest available apartment' },
  'ai.villaHittin': { ar: 'فيلا في حطين', en: 'Villa in Hittin' },
  'ai.belowMarket': { ar: 'فرص بأقل من السوق', en: 'Below-market deals' },
  'ai.nearServices': { ar: 'قريب من الخدمات', en: 'Near amenities' },

  // قسم العقارات (الرئيسية)
  'listings.featuredTitle': { ar: 'عقارات مميزة', en: 'Featured properties' },
  'listings.featuredSub': { ar: 'أحدث العروض المختارة بعناية في الرياض', en: 'The latest hand-picked offers in Riyadh' },
  'listings.resultsTitle': { ar: 'نتائج بحثك', en: 'Your search results' },
  'listings.resultsSub': { ar: 'بين العروض المتاحة في الرياض', en: 'Among the offers available in Riyadh' },
  'listings.seeAll': { ar: 'عرض الكل', en: 'View all' },
  'listings.emptyNoListings': { ar: 'لا توجد عقارات متاحة حالياً — تظهر هنا فور نشر المكاتب لإعلاناتها.', en: 'No properties available yet — they’ll appear here as soon as offices publish their listings.' },
  'listings.emptyNoCommercial': { ar: 'لا توجد عقارات تجارية متاحة حالياً.', en: 'No commercial properties available right now.' },
  'listings.emptyNoMatch': { ar: 'لا توجد نتائج مطابقة — جرّب نوعاً آخر أو امسح الفلتر.', en: 'No matching results — try another type or clear the filter.' },

  // قسم «لماذا تختار»
  'why.title': { ar: 'لماذا تختار مؤشر العقارية؟', en: 'Why choose Aqaria Index?' },
  'why.sub': { ar: 'نلتزم بتجربة عقارية مبنية على الشفافية والدقة لتسهيل قراراتك.', en: 'We’re committed to a real-estate experience built on transparency and accuracy to make your decisions easier.' },
  'why.c1t': { ar: 'دقة البيانات أولاً', en: 'Data accuracy first' },
  'why.c1d': { ar: 'مؤشر أسعار الحي مبني على متوسطات السوق المُدارة، لتقارن قبل توقيع العقد.', en: 'The neighborhood price index is built on managed market averages, so you can compare before signing.' },
  'why.c2t': { ar: 'آمن وموثوق', en: 'Safe & trusted' },
  'why.c2d': { ar: 'المكاتب موثّقة برخصة فال، وبياناتك محميّة وفق سياسة خصوصية واضحة.', en: 'Offices are verified with a FAL license, and your data is protected under a clear privacy policy.' },
  'why.c3t': { ar: 'سرعة الوصول', en: 'Fast access' },
  'why.c3d': { ar: 'مساعد ذكي وبحث وخريطة تفاعلية توصلك للعقار المناسب بسرعة.', en: 'A smart assistant, search, and interactive map get you to the right property fast.' },
  'why.c4t': { ar: 'استشارات مجانية', en: 'Free consultations' },
  'why.c4d': { ar: 'أرسل استفسارك وسيصل للمكاتب والمنصة للتواصل معك بخصوص طلبك.', en: 'Send your inquiry and it reaches offices and the platform to follow up with you.' },

  // التذييل
  'foot.quickLinks': { ar: 'روابط سريعة', en: 'Quick links' },
  'foot.legal': { ar: 'قانوني', en: 'Legal' },
  'foot.company': { ar: 'الشركة', en: 'Company' },
  'foot.terms': { ar: 'شروط الاستخدام', en: 'Terms of Use' },
  'foot.privacy': { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
  'foot.contact': { ar: 'تواصل معنا', en: 'Contact us' },
  'foot.tagline': { ar: 'دقّة عقارية للرياض — سوق الإيجار بكل وضوح © 2026.', en: 'Real-estate accuracy for Riyadh — the rental market made clear © 2026.' },
  'foot.rights': { ar: 'جميع الحقوق محفوظة — مؤشر العقارية · الرياض', en: 'All rights reserved — Aqaria Index · Riyadh' },

  // مؤشر أسعار الحي (الصفحة العامة) — التسميات
  'ind.title': { ar: 'مؤشر أسعار الحي', en: 'Neighborhood Price Index' },
  'ind.sub': { ar: 'السعر المتوسط لعدد الصفقات المماثلة بنفس الحي — قارنه بأي إيجار قبل التوقيع', en: 'The average price of comparable deals in the same neighborhood — compare any rent before you sign.' },
  'ind.cardTitle': { ar: 'جرّب المؤشر', en: 'Try the index' },
  'ind.cardSub': { ar: 'أدخل قيمة الإيجار وسنخبرك إن كانت مناسبة لسوق الحي', en: 'Enter the rent and we’ll tell you if it fits the neighborhood market.' },
  'ind.hood': { ar: 'الحي', en: 'Neighborhood' },
  'ind.unitType': { ar: 'نوع الوحدة', en: 'Unit type' },
  'ind.annualRent': { ar: 'الإيجار السنوي (ريال)', en: 'Annual rent (SAR)' },
  'ind.rentPlaceholder': { ar: 'مثال: 65000', en: 'e.g., 65000' },
  'ind.prompt': { ar: 'أدخل قيمة الإيجار للمقارنة بمتوسط السوق', en: 'Enter the rent to compare with the market average.' },
};

interface Ctx {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<Ctx>({ lang: 'ar', dir: 'rtl', t: (k) => k, setLang: () => {} });

export function useLang() {
  return useContext(LangContext);
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  // الافتراضي «ar» على الخادم وفي أول رسم للعميل ⇒ لا تعارض ترطيب (hydration).
  const [lang, setLangState] = useState<Lang>('ar');

  // بعد الترطيب: اقرأ اللغة المحفوظة (إن وُجدت) وطبّقها.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved === 'en' || saved === 'ar') setLangState(saved);
    } catch { /* تجاهل */ }
  }, []);

  // اضبط اتجاه/لغة الوثيقة عند كل تغيير لغة.
  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', dir);
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LS_KEY, l); } catch { /* تجاهل */ }
  }, []);

  const t = useCallback((key: string) => {
    const e = STRINGS[key];
    return e ? e[lang] : key;
  }, [lang]);

  const dir: 'rtl' | 'ltr' = lang === 'ar' ? 'rtl' : 'ltr';

  return <LangContext.Provider value={{ lang, dir, t, setLang }}>{children}</LangContext.Provider>;
}
