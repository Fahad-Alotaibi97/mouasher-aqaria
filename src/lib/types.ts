// الأنواع المشتركة — تُستخدم في الموقع والتطبيق مستقبلاً (إطار-مستقل)

export type ListingCondition = 'new' | 'good' | 'old';
export type PropertyType = 'شقة' | 'فيلا' | 'دور' | 'استوديو';
export type PriceStatus = 'ok' | 'hi' | 'lo'; // مناسب | مرتفع | فرصة

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
}
