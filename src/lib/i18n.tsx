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
  // العلامة — الاسم الإنجليزي «Mouasher» (نقحرة مؤشر = Index) كعلامة نظيفة بدل
  // النقحرة الركيكة «Aqaria Index»؛ وصف «Riyadh rental index» يحمله الشعار/العناوين.
  'brand': { ar: 'مؤشر العقارية', en: 'Mouasher' },
  'brand.full': { ar: 'مؤشر العقارية', en: 'Mouasher — Riyadh Rental Index' },

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

  // البطل (Hero) — العنوان يحمل القيمة الأساسية: سعر تثق به قبل التوقيع
  'hero.h1': { ar: 'إيجارك في الرياض، بسعر تطمئن له', en: 'Your next rental in Riyadh — at a price you can trust' },
  'hero.sub': { ar: 'قارن أي إيجار بمتوسط أسعار حيّه قبل التوقيع، وتصفّح عروض المكاتب على الخريطة.', en: 'Compare any rent to its neighborhood average before you sign, and browse office listings on the map.' },
  'hero.placeholder': { ar: 'اكتب طلبك بكلامك — مثال: شقة ٣ غرف في النرجس تحت ٧٠ ألف', en: 'Describe what you want — e.g., a 3-bed apartment in Al-Narjis under 70k' },
  'hero.searchBtn': { ar: 'ابحث الآن', en: 'Search' },
  'hero.aiLabel': { ar: 'المساعد الذكي:', en: 'Smart assistant:' },

  // أنواع العقار (شارات البطل) — التسمية فقط؛ القيمة تبقى عربية للمنطق
  'type.villa': { ar: 'فلل', en: 'Villas' },
  'type.apartment': { ar: 'شقق', en: 'Apartments' },
  'type.commercial': { ar: 'تجاري', en: 'Commercial' },

  // القطاع (سكني/تجاري) + الأنواع التجارية
  'sector.label': { ar: 'القطاع', en: 'Sector' },
  'sector.residential': { ar: 'سكني', en: 'Residential' },
  'sector.commercial': { ar: 'تجاري', en: 'Commercial' },
  'commType.shop': { ar: 'محل', en: 'Shop' },
  'commType.office': { ar: 'مكتب', en: 'Office' },
  'commType.showroom': { ar: 'معرض', en: 'Showroom' },
  'comm.soonShort': { ar: 'قريباً', en: 'Coming soon' },
  'comm.indexSoon': { ar: 'المؤشر التجاري قيد الإعداد — لا توجد بيانات كافية بعد لعرض متوسط تجاري لهذا الحي.', en: 'The commercial index is still being built — not enough data yet to show a commercial average for this neighborhood.' },

  // عبارات المساعد الذكي (التسمية فقط؛ الاستعلام يبقى عربياً للمطابقة المحلّية)
  'ai.avgExample': { ar: 'متوسط أسعار العليا', en: 'Average prices in Al-Olaya' },
  'ai.compareExample': { ar: 'قارن العليا والنرجس', en: 'Compare Al-Olaya & Al-Narjis' },
  'ai.cheapestOlaya': { ar: 'أرخص شقة في العليا', en: 'Cheapest apartment in Al-Olaya' },
  'ai.cheapest': { ar: 'أرخص شقة متاحة الآن', en: 'Cheapest apartment available' },
  'ai.villaHittin': { ar: 'فيلا في حطين', en: 'Villa in Hittin' },
  'ai.belowMarket': { ar: 'فرص بأقل من السوق', en: 'Below-market deals' },
  'ai.nearServices': { ar: 'قريب من الخدمات', en: 'Near amenities' },

  // قسم العقارات (الرئيسية)
  'listings.featuredTitle': { ar: 'عقارات مميزة', en: 'Featured properties' },
  'listings.featuredSub': { ar: 'أحدث العروض المتاحة في الرياض', en: 'The latest listings available in Riyadh' },
  'listings.resultsTitle': { ar: 'نتائج بحثك', en: 'Your search results' },
  'listings.resultsSub': { ar: 'بين العروض المتاحة في الرياض', en: 'From the listings available in Riyadh' },
  'listings.seeAll': { ar: 'عرض الكل', en: 'View all' },
  'listings.emptyNoListings': { ar: 'لا توجد عقارات متاحة الآن — تظهر هنا فور نشر المكاتب لإعلاناتها.', en: 'No properties available yet — they’ll appear here as soon as offices publish their listings.' },
  'listings.emptyNoCommercial': { ar: 'لا توجد عقارات تجارية متاحة الآن.', en: 'No commercial properties available right now.' },
  'listings.emptyNoMatch': { ar: 'لا نتائج مطابقة — جرّب نوعاً آخر أو امسح الفلتر.', en: 'No matching results — try another type or clear the filter.' },

  // تسميات بطاقة الإعلان الثابتة (الترجمة فقط؛ قيم المستخدم تبقى كما أُدخلت)
  'card.forRent': { ar: 'للإيجار', en: 'For rent' },
  'card.forSale': { ar: 'للبيع', en: 'For sale' },
  'card.bestMatch': { ar: 'الأنسب لطلبك', en: 'Best match' },
  'card.rooms': { ar: 'غرف', en: 'rooms' },
  'card.baths': { ar: 'حمامات', en: 'baths' },
  'card.bath': { ar: 'حمام', en: 'bath' },
  'card.area': { ar: 'م²', en: 'm²' },
  'card.frontages': { ar: 'واجهات', en: 'frontages' },
  'card.parkings': { ar: 'مواقف', en: 'parking' },
  'card.perYear': { ar: 'ريال/سنة', en: 'SAR/yr' },
  'card.perYearShort': { ar: 'ر.س/سنوياً', en: 'SAR/yr' },
  'card.priceIndex': { ar: 'مؤشر أسعار الحي', en: 'Neighborhood index' },
  'card.city': { ar: 'الرياض', en: 'Riyadh' },
  'card.sar': { ar: 'ريال', en: 'SAR' },
  // شارات الخصائص على بطاقة البحث (chrome مُترجَم؛ القيمة مشتقّة من حقول حقيقية)
  'chip.furnished': { ar: 'مفروشة', en: 'Furnished' },
  'chip.unfurnished': { ar: 'غير مفروشة', en: 'Unfurnished' },
  'chip.kitchen': { ar: 'مطبخ راكب', en: 'Fitted kitchen' },
  'chip.noKitchen': { ar: 'مطبخ غير راكب', en: 'No fitted kitchen' },
  'chip.ac': { ar: 'مكيّفة', en: 'Air-conditioned' },
  'chip.noAc': { ar: 'غير مكيّفة', en: 'No A/C' },
  'chip.noParking': { ar: 'بدون موقف', en: 'No parking' },
  'card.mapsBtn': { ar: 'الموقع على الخريطة', en: 'View on map' },
  'verdict.high': { ar: 'مرتفع', en: 'Above market' },
  'verdict.highIndex': { ar: 'مؤشر مرتفع', en: 'Above index' },
  'verdict.opp': { ar: 'فرصة', en: 'Good deal' },
  'verdict.fair': { ar: 'مناسب', en: 'Fair price' },

  // إجابات السوق من المساعد الذكي (المتوسطات والمقارنات) — item 3
  'mkt.title': { ar: 'متوسط السوق', en: 'Market average' },
  'mkt.compareTitle': { ar: 'مقارنة متوسطات الأحياء', en: 'Neighborhood comparison' },
  'mkt.perYear': { ar: 'ريال/سنة', en: 'SAR/yr' },
  'mkt.perM2': { ar: 'ريال/م² سنوياً', en: 'SAR/m²/yr' },
  'mkt.deals': { ar: 'عدد الصفقات', en: 'deals' },
  'mkt.noData': { ar: 'لا تتوفّر بيانات كافية لهذا الحي بعد', en: 'Not enough data for this neighborhood yet' },
  'mkt.lowerBy': { ar: 'أقل بـ', en: 'lower by' },
  'mkt.cheaperHood': { ar: 'الأرخص', en: 'cheapest' },
  'mkt.cheaperBy': { ar: 'أرخص بـ', en: 'cheaper by' },

  // قسم «لماذا تختار» — عناوين تقود بالمنفعة، ونصوص محدّدة وصادقة
  'why.title': { ar: 'لماذا تختار مؤشر العقارية؟', en: 'Why choose Mouasher?' },
  'why.sub': { ar: 'نساعدك تقرّر بثقة: أرقام واضحة، مكاتب موثّقة، وبحث يفهم طلبك.', en: 'Helping you decide with confidence: clear numbers, verified offices, and search that understands you.' },
  'why.c1t': { ar: 'اعرف السعر العادل', en: 'Know the fair price' },
  'why.c1d': { ar: 'مؤشر أسعار الحي يقارن أي إيجار بمتوسط صفقات حيّه، فتفاوض وتوقّع وأنت على بيّنة.', en: 'The neighborhood index compares any rent to its area’s average, so you negotiate and sign informed.' },
  'why.c2t': { ar: 'مكاتب موثّقة', en: 'Verified offices' },
  'why.c2d': { ar: 'نوثّق المكاتب عبر رخصة فال، ونحمي بياناتك وفق سياسة خصوصية واضحة.', en: 'We verify offices through their FAL license and protect your data under a clear privacy policy.' },
  'why.c3t': { ar: 'وصول أسرع للعقار المناسب', en: 'Find the right place, faster' },
  'why.c3d': { ar: 'بحث وخريطة تفاعلية ومساعد يفهم طلبك بكلامك — يوصلك للعقار المناسب بخطوات أقل.', en: 'Search, an interactive map, and an assistant that understands plain language get you there in fewer steps.' },
  'why.c4t': { ar: 'نتابع طلبك', en: 'We follow up on your request' },
  'why.c4d': { ar: 'أرسل استفسارك ويصل للمكاتب وفريق المنصة، فيتواصلون معك بخصوص طلبك دون رسوم.', en: 'Send your inquiry — it reaches offices and our team, who follow up with you, free.' },

  // التذييل
  'foot.quickLinks': { ar: 'روابط سريعة', en: 'Quick links' },
  'foot.legal': { ar: 'قانوني', en: 'Legal' },
  'foot.company': { ar: 'الشركة', en: 'Company' },
  'foot.terms': { ar: 'شروط الاستخدام', en: 'Terms of Use' },
  'foot.privacy': { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
  'foot.contact': { ar: 'تواصل معنا', en: 'Contact us' },
  'foot.tagline': { ar: 'سوق الإيجار في الرياض، بوضوح وأرقام تثق بها. © 2026', en: 'Riyadh’s rental market — clear, with numbers you can trust. © 2026' },
  'foot.rights': { ar: 'جميع الحقوق محفوظة — مؤشر العقارية · الرياض', en: 'All rights reserved — Mouasher · Riyadh' },

  // مؤشر أسعار الحي (الصفحة العامة) — التسميات
  'ind.title': { ar: 'مؤشر أسعار الحي', en: 'Neighborhood Price Index' },
  'ind.sub': { ar: 'متوسط إيجار الوحدات المماثلة في الحي نفسه — قارن أي سعر قبل التوقيع واطمئن', en: 'The average rent for similar units in the same neighborhood — compare any price before you sign, with confidence.' },
  'ind.cardTitle': { ar: 'جرّب المؤشر', en: 'Try the index' },
  'ind.cardSub': { ar: 'أدخل قيمة الإيجار ونقارنها بمتوسط الحي فوراً', en: 'Enter the rent and we’ll compare it to the neighborhood average instantly.' },
  'ind.hood': { ar: 'الحي', en: 'Neighborhood' },
  'ind.unitType': { ar: 'نوع الوحدة', en: 'Unit type' },
  'ind.annualRent': { ar: 'الإيجار السنوي (ريال)', en: 'Annual rent (SAR)' },
  'ind.rentPlaceholder': { ar: 'مثال: 65000', en: 'e.g., 65000' },
  'ind.prompt': { ar: 'أدخل قيمة الإيجار للمقارنة بمتوسط السوق', en: 'Enter the rent to compare with the market average.' },
  // أحكام المؤشر (عناوين النتيجة) — السكني، عبارات واضحة ومطمئنة
  'ind.vHiTitle': { ar: 'أعلى من متوسط الحي', en: 'Above the neighborhood average' },
  'ind.vLoTitle': { ar: 'فرصة جيدة', en: 'A good deal' },
  'ind.vOkTitle': { ar: 'السعر مناسب لمتوسط الحي', en: 'In line with the neighborhood' },
  'ind.noAvg': { ar: 'لا يتوفّر متوسط لهذا النوع في هذا الحي بعد', en: 'No average for this type in this neighborhood yet' },
  'ind.commType': { ar: 'النوع التجاري', en: 'Commercial type' },
  'ind.m2Rent': { ar: 'إيجارك السنوي للمتر² (ريال/م²)', en: 'Your annual rent per m² (SAR/m²)' },
  'ind.m2Prompt': { ar: 'أدخل إيجارك للمتر² للمقارنة بمتوسط الحي التجاري.', en: 'Enter your rent per m² to compare with the neighborhood’s commercial average.' },
  'ind.commHi': { ar: 'السعر مرتفع عن متوسط الحي التجاري', en: 'Above the neighborhood’s commercial average' },
  'ind.commLo': { ar: 'فرصة — أقل من متوسط الحي التجاري', en: 'A good deal — below the commercial average' },
  'ind.commOk': { ar: 'السعر مناسب لمتوسط الحي التجاري', en: 'In line with the commercial average' },

  // ── التسجيل / الباقات (القسم العام، صفحة «سجّل مكتبك») ──
  'reg.badge': { ar: 'التسجيل مجاناً لفترة محدودة', en: 'Free to register — for a limited time' },
  'reg.title': { ar: 'سجّل في مؤشر العقارية', en: 'Join Mouasher' },
  'reg.sub': { ar: 'اختر نوع حسابك وابدأ في دقيقة', en: 'Pick your account type and start in a minute' },
  'reg.popular': { ar: 'الأكثر طلباً', en: 'Most popular' },
  'reg.free': { ar: 'مجاناً', en: 'Free' },
  'reg.limited': { ar: 'لفترة محدودة', en: 'for a limited time' },
  'reg.searcherName': { ar: 'باحث عن إيجار', en: 'Renter' },
  'reg.searcherDesc': { ar: 'للأفراد الباحثين عن سكن مناسب بسعر عادل', en: 'For individuals looking for the right home at a fair price' },
  'reg.searcherCta': { ar: 'ابدأ البحث مجاناً', en: 'Start searching — free' },
  'reg.officeNameLabel': { ar: 'مكتب عقاري', en: 'Real-estate office' },
  'reg.officeDesc': { ar: 'اعرض وحداتك أمام باحثين عن سكن في الرياض — مجاناً الآن', en: 'Put your units in front of renters across Riyadh — free for now' },
  'reg.officeCta': { ar: 'سجّل مكتبك مجاناً', en: 'List your office — free' },
  // مزايا الباحث (المتاح فعلاً)
  'reg.sf1': { ar: 'بحث غير محدود في كل الأحياء', en: 'Unlimited search across every neighborhood' },
  'reg.sf2': { ar: 'مؤشر أسعار الحي لكل إعلان', en: 'Neighborhood price index on every listing' },
  'reg.sf3': { ar: 'مساعد ذكي يفهم طلبك بكلامك', en: 'A smart assistant that understands plain language' },
  'reg.sf4': { ar: 'خريطة تفاعلية بمواقع الوحدات', en: 'An interactive map of unit locations' },
  'reg.sl1': { ar: 'تنبيهات الإعلانات الجديدة — قريباً', en: 'New-listing alerts — coming soon' },
  'reg.sl2': { ar: 'حفظ التفضيلات والمقارنة — قريباً', en: 'Saved preferences and comparison — coming soon' },
  // مزايا المكتب (المتاح فعلاً)
  'reg.of1': { ar: 'توثيق رخصة فال عبر مراجعة الإدارة', en: 'FAL-license verification via admin review' },
  'reg.of2': { ar: 'نشر إعلانات وحداتك للباحثين في الرياض', en: 'Publish your units to renters in Riyadh' },
  'reg.of3': { ar: 'تقييم تلقائي بمؤشر أسعار الحي', en: 'Automatic pricing with the neighborhood index' },
  'reg.of4': { ar: 'لوحة تحكم بإحصاءات إعلاناتك واستفساراتها', en: 'A dashboard with your listing and inquiry stats' },
  'reg.of5': { ar: 'الحاسبة الذكية لتسعير وحداتك', en: 'A smart calculator to price your units' },
  'reg.ol1': { ar: 'ردود تلقائية على الاستفسارات — قريباً', en: 'Automated inquiry replies — coming soon' },
  'reg.ol2': { ar: 'تقارير دورية بالبريد — قريباً', en: 'Scheduled email reports — coming soon' },

  // ── تسجيل الدخول / إنشاء حساب (نصوص الواجهة فقط — لا منطق) ──
  'auth.loggedIn': { ar: 'أنت مسجّل الدخول', en: 'You’re signed in' },
  'auth.enterOfficePanel': { ar: 'دخول لوحة المكتب', en: 'Go to office panel' },
  'auth.resetTitle': { ar: 'إعادة تعيين كلمة المرور', en: 'Reset your password' },
  'auth.resetDesc': { ar: 'أدخل بريد حسابك (مكتب، باحث، أو مدير) وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.', en: 'Enter your account email (office, renter, or admin) and we’ll send a link to set a new password.' },
  'auth.email': { ar: 'البريد الإلكتروني', en: 'Email' },
  'auth.sendResetLink': { ar: 'إرسال رابط إعادة التعيين', en: 'Send reset link' },
  'auth.backToLogin': { ar: 'العودة لتسجيل الدخول', en: 'Back to sign in' },
  'auth.tabLogin': { ar: 'تسجيل دخول', en: 'Sign in' },
  'auth.tabSignup': { ar: 'إنشاء حساب', en: 'Create account' },
  'auth.accountType': { ar: 'نوع الحساب', en: 'Account type' },
  'auth.roleSeeker': { ar: 'باحث عن إيجار', en: 'Renter' },
  'auth.roleOffice': { ar: 'مكتب عقاري', en: 'Real-estate office' },
  'auth.password': { ar: 'كلمة المرور', en: 'Password' },
  'auth.confirmPassword': { ar: 'تأكيد كلمة المرور', en: 'Confirm password' },
  'auth.officeName': { ar: 'اسم المكتب', en: 'Office name' },
  'auth.officeNamePh': { ar: 'مثال: مكتب الأفق العقاري', en: 'e.g., Al-Ufuq Real Estate' },
  'auth.officePhone': { ar: 'رقم جوال المكتب', en: 'Office phone number' },
  'auth.officePhoneHint': { ar: 'يُستخدم لتواصل إدارة المنصة معك (واتساب) — رقم سعودي.', en: 'Used by our team to reach you on WhatsApp — a Saudi number.' },
  'auth.falOptional': { ar: 'رقم رخصة فال (اختياري)', en: 'FAL license number (optional)' },
  'auth.nameOptional': { ar: 'الاسم (اختياري)', en: 'Name (optional)' },
  'auth.namePh': { ar: 'اسمك', en: 'Your name' },
  'auth.forgot': { ar: 'نسيت كلمة المرور؟', en: 'Forgot your password?' },
  'auth.processing': { ar: 'جارٍ المعالجة…', en: 'Processing…' },

  // ── بوابة لوحة المكتب (تتطلّب دخولاً) ──
  'officeGate.title': { ar: 'لوحة المكتب تتطلّب تسجيل الدخول', en: 'The office panel requires sign-in' },
  'officeGate.body': { ar: 'سجّل دخولك بحساب مكتب، أو أنشئ حساب مكتب جديد، للوصول إلى لوحتك وإعلاناتك.', en: 'Sign in with an office account, or create one, to reach your panel and listings.' },
  'officeGate.cta': { ar: 'تسجيل الدخول / إنشاء حساب', en: 'Sign in / Create account' },

  // ── المساعد الذكي: لوحة «لا تطابق» الصريحة (الرئيسية) ──
  'ai.nmTitle': { ar: 'لا توجد حالياً عقارات مطابقة', en: 'No matching properties right now' },
  'ai.nmBody': { ar: 'ما نعرض عليك عقارات في أحياء ثانية وندّعي أنها تطابق طلبك. هذه خياراتك:', en: 'We won’t show you properties in other neighborhoods and claim they match. Here are your options:' },
  'ai.nmRegister': { ar: 'سجّل طلبك — يصل للمكاتب فتتواصل معك عند توفّر ما يناسبك', en: 'Register your request — it reaches offices, who contact you when something fits' },
  'ai.nmShowAlts': { ar: 'إخفاء الخيارات الأخرى', en: 'Hide other options' },
  'ai.nmBrowseAlts': { ar: 'تصفّح الخيارات الأخرى المتاحة', en: 'Browse other available options' },
  'ai.nmAltsTitle': { ar: 'خيارات أخرى متاحة — لا تطابق طلبك تماماً (أحياء/أنواع مختلفة):', en: 'Other available options — not an exact match (different neighborhoods or types):' },
  'ai.nmEmpty': { ar: 'لا توجد إعلانات متاحة الآن — تُعرض هنا إعلانات المكاتب فور نشرها.', en: 'No listings available yet — office listings appear here as soon as they’re published.' },
  'ai.nmHint': { ar: 'اذكر الحي أو النوع أو ميزانيتك لأبحث لك بدقّة بين الإعلانات المتاحة.', en: 'Tell me the neighborhood, type, or budget and I’ll search the available listings precisely.' },

  // ── صفحة البحث (العناوين + الحالات الفارغة) ──
  'search.h1': { ar: 'ابحث عن إيجارك', en: 'Find a rental' },
  'search.sub': { ar: 'حدّد معاييرك وشاهد العقارات على الخريطة مباشرة', en: 'Set your criteria and see properties on the map in real time' },
  'search.filterTitle': { ar: 'صفِّ النتائج', en: 'Refine results' },
  'search.filterSub': { ar: 'تتحدّث الخريطة والقائمة فور تغيير أي فلتر', en: 'The map and list update the moment you change a filter' },
  'search.resultsTitle': { ar: 'العقارات المطابقة', en: 'Matching properties' },
  'search.mapTitle': { ar: 'الخريطة التفاعلية', en: 'Interactive map' },
  'search.mapEmptyAll': { ar: 'لا توجد إعلانات متاحة الآن — تصفّح الخريطة، وتظهر الدبابيس فور نشر المكاتب لإعلاناتها بمواقعها.', en: 'No listings available yet — browse the map; pins appear as soon as offices publish listings with locations.' },
  'search.mapEmptyFiltered': { ar: 'لا توجد عقارات بإحداثيات ضمن الفلاتر الحالية — تصفّح الخريطة، وتظهر الدبابيس للإعلانات التي حُدّد موقعها.', en: 'No properties with coordinates match the current filters — browse the map; pins show for listings that have a set location.' },
  'search.emptyNoListings': { ar: 'لا توجد إعلانات متاحة الآن — تُعرض هنا إعلانات المكاتب فور نشرها.', en: 'No listings available yet — office listings appear here as soon as they’re published.' },
  'search.emptyNoCommercial': { ar: 'لا توجد عقارات تجارية مدرجة حتى الآن.', en: 'No commercial properties listed yet.' },
  'search.emptyNoMatch': { ar: 'لا نتائج — جرّب توسيع المعايير.', en: 'No results — try widening your criteria.' },

  // ── صفحة الاستفسارات (العامة) ──
  'inq.h1': { ar: 'الاستفسارات', en: 'Inquiries' },
  'inq.sub': { ar: 'أرسل استفسارك وسيصل فريق المنصة ونتواصل معك', en: 'Send your inquiry — it reaches our team and we’ll get back to you' },
  'inq.cardTitle': { ar: 'نموذج استفسار', en: 'Inquiry form' },
  'inq.cardSub': { ar: 'اذكر الحي والنوع إن أردت استفساراً محدّداً', en: 'Add a neighborhood and type for a more specific inquiry' },
  'inq.success': { ar: 'وصلنا استفسارك، وبنتواصل معك قريباً. شكراً لك.', en: 'We’ve received your inquiry and will be in touch soon. Thank you.' },
  'inq.hoodOptional': { ar: 'الحي (اختياري)', en: 'Neighborhood (optional)' },
  'inq.typeOptional': { ar: 'نوع الوحدة (اختياري)', en: 'Unit type (optional)' },
  'inq.unspecified': { ar: '— غير محدّد —', en: '— Not specified —' },
  'inq.msgPh': { ar: 'نص الاستفسار — مثال: متى يتوفّر دوبلكس في حطين؟', en: 'Your inquiry — e.g., when will a duplex in Hittin be available?' },
  'inq.send': { ar: 'إرسال الاستفسار', en: 'Send inquiry' },

  // ── صفحة خيارات تقسيط الإيجار (العامة) ──
  'fin.h1': { ar: 'خيارات تقسيط الإيجار', en: 'Rent installment options' },
  'fin.sub': { ar: 'حلول تقسيط ميسّرة تناسب ميزانيتك', en: 'Flexible installment options that fit your budget' },
  'fin.heroTitle': { ar: 'تحتاج تمويلاً عقارياً؟', en: 'Need real-estate financing?' },
  'fin.heroBody': { ar: 'نربطك مباشرة بشركائنا من الجهات التمويلية المعتمدة لتحصل على العرض الأنسب لك', en: 'We connect you directly with our approved financing partners to find the offer that fits you best' },
  'fin.heroCta': { ar: 'اطلب التمويل الآن', en: 'Request financing' },
  'fin.heroNote': { ar: 'خدمة مجانية · ردود سريعة · مقارنة عروض', en: 'Free service · Quick responses · Compare offers' },
  'fin.leadTitle': { ar: 'اترك رسالة وسنتواصل معك', en: 'Leave a message and we’ll reach out' },
  'fin.leadSub': { ar: 'اكتب طلبك أو استفسارك ونرجع لك قريباً', en: 'Write your request or question and we’ll get back to you soon' },
  'fin.success': { ar: 'وصلتنا رسالتك، وبنتواصل معك قريباً. شكراً لك.', en: 'We’ve received your message and will be in touch soon. Thank you.' },
  'fin.msgPh': { ar: 'رسالتك (اختياري) — مثال: أبحث عن شقة 3 غرف بالنرجس', en: 'Your message (optional) — e.g., I’m looking for a 3-bed apartment in Al-Narjis' },
  'fin.defaultMsg': { ar: 'أرغب بطلب تمويل عقاري — أرجو التواصل معي.', en: 'I’d like to request real-estate financing — please contact me.' },

  // حقول النماذج العامة (مشتركة)
  'form.name': { ar: 'الاسم', en: 'Name' },
  'form.phone': { ar: 'رقم الجوال', en: 'Phone number' },
  'form.send': { ar: 'إرسال', en: 'Send' },
  'form.sending': { ar: 'جارٍ الإرسال…', en: 'Sending…' },

  // ── عن المنصة ──
  'about.title': { ar: 'عن مؤشر العقارية', en: 'About Mouasher' },
  'about.sub': { ar: 'نوضّح سوق الإيجار السكني في الرياض: اعرف متوسط أسعار الحي قبل أن توقّع.', en: 'We make Riyadh’s residential rental market clear — know the neighborhood average before you sign.' },
  'about.ideaTitle': { ar: 'فكرتنا', en: 'Our idea' },
  'about.ideaBody': { ar: 'نساعد الباحث عن سكن والمكتب العقاري على قرار واثق، عبر مؤشر أسعار الحي الذي يقارن أي إيجار بمتوسط سوق حيّه، وخريطة تفاعلية، ومساعد يفهم طلبك بكلامك.', en: 'We help renters and offices decide with confidence — through a neighborhood index that compares any rent to its area’s average, an interactive map, and an assistant that understands plain language.' },
  'about.p1t': { ar: 'مؤشر أسعار الحي', en: 'Neighborhood price index' },
  'about.p1d': { ar: 'متوسط إيجار الوحدات المماثلة في الحي نفسه.', en: 'The average rent for similar units in the same neighborhood.' },
  'about.p2t': { ar: 'خريطة شفافة', en: 'A clear map' },
  'about.p2d': { ar: 'شاهد الأسعار وحالتها على الخريطة.', en: 'See prices and how they compare, right on the map.' },
  'about.p3t': { ar: 'مساعد ذكي', en: 'Smart assistant' },
  'about.p3d': { ar: 'اكتب رغبتك ونرتّب لك الأنسب.', en: 'Describe what you want and we’ll surface the best matches.' },
  'about.ctaSearch': { ar: 'ابدأ البحث', en: 'Start searching' },

  // ── بطاقة تفاصيل الإعلان (العناصر العامة الأبرز) ──
  'detail.available': { ar: 'متاح', en: 'Available' },
  'detail.viewPhotos': { ar: 'عرض الصور', en: 'View photos' },
  'detail.condUnknown': { ar: 'الحالة غير محددة', en: 'Condition not specified' },
  'detail.amenities': { ar: 'المزايا', en: 'Amenities' },
  'detail.advertisingOffice': { ar: 'المكتب المعلِن', en: 'Listing office' },
  'detail.verified': { ar: 'موثّق', en: 'Verified' },
  'detail.falLicense': { ar: 'رخصة فال:', en: 'FAL license:' },
  'detail.callNow': { ar: 'اتصل الآن', en: 'Call now' },
  'detail.whatsapp': { ar: 'واتساب', en: 'WhatsApp' },
  'detail.googleMaps': { ar: 'خرائط جوجل', en: 'Google Maps' },
  'detail.contactSent': { ar: 'تم إرسال طلبك — سيتواصل معك المكتب قريباً.', en: 'Your request was sent — the office will contact you soon.' },
  'detail.contactMsgPh': { ar: 'رسالتك (اختياري) — مثال: متى أقدر أعاين الوحدة؟', en: 'Your message (optional) — e.g., when can I view the unit?' },
  'detail.sendContact': { ar: 'إرسال طلب التواصل', en: 'Send request' },
  'detail.contactAbout': { ar: 'تواصل بخصوص هذا الإعلان', en: 'Contact about this listing' },
  'detail.similarIn': { ar: 'عقارات مشابهة في', en: 'Similar properties in' },

  // ── صفحة البحث: تسميات الفلاتر والعدّادات (chrome مُترجَم؛ قيم الفلاتر تبقى عربية للمنطق) ──
  'search.hood': { ar: 'الحي', en: 'Neighborhood' },
  'search.allHoods': { ar: 'كل الأحياء', en: 'All neighborhoods' },
  'search.propType': { ar: 'نوع العقار', en: 'Property type' },
  'search.allTypes': { ar: 'كل الأنواع', en: 'All types' },
  'search.budget': { ar: 'الميزانية السنوية', en: 'Annual budget' },
  'search.budgetPh': { ar: 'مثال: 70000', en: 'e.g., 70000' },
  'search.results': { ar: 'نتيجة', en: 'results' },
  'search.onMapCount': { ar: 'على الخريطة', en: 'on map' },
  'search.propOnMap': { ar: 'عقار على الخريطة', en: 'properties on the map' },
  'search.clearFilters': { ar: 'مسح الفلاتر', en: 'Clear filters' },

  // أنواع الوحدات (تسميات خيارات الفلتر — القيمة تبقى عربية؛ التسمية تُترجَم)
  'type.floor': { ar: 'دور', en: 'Floor' },
  'type.studio': { ar: 'استوديو', en: 'Studio' },
  'type.duplex': { ar: 'دوبلكس', en: 'Duplex' },

  // ── حذف الحساب (نافذة التأكيد المشتركة) ──
  'del.title': { ar: 'حذف الحساب', en: 'Delete account' },
  'del.permanent': {
    ar: 'هذا الإجراء نهائي ولا يمكن التراجع عنه. سيُحذف حسابك وكل بياناتك الشخصية من المنصة فوراً.',
    en: 'This is permanent and cannot be undone. Your account and all your personal data will be removed from the platform immediately.',
  },
  'del.itemSeeker1': { ar: 'حسابك وبيانات الدخول (لن تتمكّن من تسجيل الدخول بعدها).', en: 'Your account and sign-in (you won’t be able to sign in afterward).' },
  'del.itemSeeker2': { ar: 'استفساراتك وطلباتك المرتبطة بحسابك.', en: 'Your inquiries and requests linked to your account.' },
  'del.itemOffice1': { ar: 'حساب مكتبك وبيانات الدخول.', en: 'Your office account and sign-in.' },
  'del.itemOffice2': { ar: 'كل إعلاناتك وصورها.', en: 'All your listings and their photos.' },
  'del.itemOffice3': { ar: 'الاستفسارات التي وصلت إلى مكتبك.', en: 'The inquiries your office has received.' },
  'del.typeToConfirm': { ar: 'للتأكيد، اكتب كلمة «حذف» في الحقل أدناه:', en: 'To confirm, type the word “DELETE” below:' },
  'del.confirmWord': { ar: 'حذف', en: 'DELETE' },
  'del.cancel': { ar: 'إلغاء', en: 'Cancel' },
  'del.confirmBtn': { ar: 'حذف حسابي نهائياً', en: 'Permanently delete my account' },
  'del.processing': { ar: 'جارٍ الحذف…', en: 'Deleting…' },
  'del.adminErr': { ar: 'لا يمكن حذف حساب المدير من هنا.', en: 'Admin accounts cannot be deleted here.' },
  'del.failErr': { ar: 'تعذّر حذف الحساب — حاول لاحقاً أو راسل الدعم.', en: 'Couldn’t delete the account — try again later or contact support.' },
  'del.doneTitle': { ar: 'تم حذف حسابك', en: 'Your account was deleted' },
  'del.doneBody': { ar: 'حُذف حسابك وكل بياناتك نهائياً. جارٍ تحويلك إلى الصفحة الرئيسية…', en: 'Your account and all your data were permanently deleted. Redirecting you home…' },
  'del.openBtn': { ar: 'حذف الحساب', en: 'Delete account' },

  // ── صفحة /delete-account العامة ──
  'delpage.title': { ar: 'حذف الحساب', en: 'Delete your account' },
  'delpage.intro': {
    ar: 'يمكنك حذف حسابك في «مؤشر العقارية» وكل بياناتك الشخصية نهائياً. هذا الإجراء لا يمكن التراجع عنه.',
    en: 'You can permanently delete your Mouasher account and all your personal data. This action cannot be undone.',
  },
  'delpage.whatTitle': { ar: 'ماذا يُحذف؟', en: 'What gets deleted?' },
  'delpage.whatBody': {
    ar: 'حسابك وبيانات الدخول، واستفساراتك المرتبطة بحسابك. وإن كنت مكتباً عقارياً: مكتبك وكل إعلاناتك وصورها والاستفسارات التي وصلتك.',
    en: 'Your account and sign-in, and inquiries linked to your account. If you’re a real-estate office: your office, all your listings and their photos, and the inquiries you’ve received.',
  },
  'delpage.checking': { ar: 'جارٍ التحقق…', en: 'Checking…' },
  'delpage.loggedInAs': { ar: 'أنت مسجّل الدخول بـ', en: 'You’re signed in as' },
  'delpage.deleteNow': { ar: 'حذف حسابي نهائياً', en: 'Delete my account permanently' },
  'delpage.signedOutTitle': { ar: 'لست مسجّل الدخول', en: 'You’re not signed in' },
  'delpage.signedOutBody': {
    ar: 'لحذف حسابك بنفسك: سجّل الدخول من الصفحة الرئيسية، ثم احذف الحساب من منطقة حسابك أو من هذه الصفحة. أو أرسل طلب حذف من بريدك المسجّل إلى البريد أدناه وسنحذف حسابك وبياناتك.',
    en: 'To delete your account yourself: sign in from the home page, then delete it from your account area or this page. Or send a deletion request from your registered email to the address below, and we’ll delete your account and data.',
  },
  'delpage.signInCta': { ar: 'تسجيل الدخول', en: 'Sign in' },
  'delpage.emailLabel': { ar: 'البريد لطلبات الحذف:', en: 'Email for deletion requests:' },
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
