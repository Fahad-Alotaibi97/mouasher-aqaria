// الأنواع المشتركة — تُستخدم في الموقع والتطبيق مستقبلاً (إطار-مستقل)

export type ListingCondition = 'new' | 'good' | 'old';
export type PropertyType = 'شقة' | 'فيلا' | 'دور' | 'استوديو';
export type PriceStatus = 'ok' | 'hi' | 'lo'; // مناسب | مرتفع | فرصة

// القطاع: سكني | تجاري. الأنواع التجارية: محل | مكتب | معرض.
export type Sector = 'residential' | 'commercial';
export type CommercialType = 'shop' | 'office' | 'showroom';

// صف المؤشر التجاري (جدول commercial_prices) — منفصل تماماً عن متوسطات السكني.
// يبدأ فارغاً ويُملأ لاحقاً؛ price_per_m2 = الإيجار السنوي للمتر² بالريال.
export interface CommercialPrice {
  hood: string;
  commercial_type: CommercialType;
  price_per_m2: number | null;
  sample_size?: number | null;
}

export interface Neighborhood {
  name: string;
  avg_rent: number; // متوسط الشقة (الإيجار السنوي الأساس)
  avg_villa?: number | null; // متوسط الفيلا (اختياري — يُشتق من avg_rent إن غاب)
  avg_studio?: number | null; // متوسط الاستوديو (اختياري)
  avg_dor?: number | null; // متوسط الدور (اختياري — يُشتق ×1.4 إن غاب)
  avg_duplex?: number | null; // متوسط الدوبلكس (اختياري — يُشتق ×1.6 إن غاب)
}

export interface Listing {
  id: string | number;
  title: string;
  hood: string;
  type: string;
  advertised: number; // السعر المُعلن (سنوي)
  area?: number | null;
  rooms?: number | null;
  condition?: string;
  cond_label?: string | null;
  tags?: string[];
  fal_license?: string | null;
  lat?: number | null;
  lng?: number | null;
  // القطاع التجاري (إضافة بنيوية — السكني هو الافتراضي):
  sector?: Sector;
  commercial_type?: CommercialType | null;
  frontage_count?: number | null;   // عدد الواجهات
  frontage_width?: number | null;    // عرض الواجهة (م)
  allowed_activity?: string | null;  // النشاط المسموح
  has_bathroom?: boolean | null;     // دورة مياه
  floor_info?: string | null;        // الدور/الوحدة
}
