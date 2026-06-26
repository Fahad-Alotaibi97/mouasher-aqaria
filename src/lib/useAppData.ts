'use client';
// خطّاف يجلب الأحياء والإعلانات من Supabase، مع رجوع آمن للبيانات الافتراضية
// إذا لم تُضبط المفاتيح أو فشل الاتصال — فالموقع لا ينكسر أبداً.
import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

// الصور المصنّفة حسب الغرفة (عمود images_by_category JSONB)
export interface ImagesByCategory {
  facade?: string | null;    // الواجهة
  hall?: string | null;      // الصالة
  majlis?: string | null;    // المجلس
  kitchen?: string | null;   // المطبخ
  bedrooms?: string[];       // غرف النوم (بعدد الغرف)
  bathrooms?: string[];      // الحمامات (بعدد دورات المياه)
}

// شكل الإعلان الموحّد كما تستخدمه الواجهة
export interface UIListing {
  id: string | number;
  office_id?: string | null;
  hood: string;
  title: string;
  type: string;
  adv: number;
  rooms?: number | null;
  area?: number | null;
  baths?: number | null;
  furnished?: boolean | null;
  kitchen?: boolean | null;   // المطبخ راكب
  ac?: boolean | null;        // مكيّفة
  parking?: number | null;    // عدد المواقف
  propertyAge?: number | null; // عمر العقار بالسنوات (اختياري؛ null = غير محدّد)
  cond: string;
  condLabel: string;
  description?: string;
  images?: string[];
  imagesByCategory?: ImagesByCategory | null;
  fal: string;
  lat?: number | null;
  lng?: number | null;
  maps_url?: string | null; // رابط خرائط Google الملصوق (للروابط المختصرة غير القابلة للتحليل)
  // القطاع التجاري (إضافة بنيوية — السكني هو الافتراضي):
  sector?: string;                 // 'residential' (افتراضي) | 'commercial'
  commercialType?: string | null;  // 'shop' | 'office' | 'showroom'
  frontageCount?: number | null;   // عدد الواجهات
  frontageWidth?: number | null;   // عرض الواجهة (م)
  activity?: string | null;        // النشاط المسموح
  hasBathroom?: boolean | null;    // دورة مياه
  floorInfo?: string | null;       // الدور/الوحدة
}

// مفتاح المؤشر التجاري: `${الحي}|${النوع التجاري}` ⇒ سعر المتر² (يبدأ فارغاً تماماً)
export type CommIndex = Record<string, { pricePerM2: number | null; sampleSize: number | null }>;

// avg = متوسط الشقة (الأساس) ، villa/studio/floor/duplex متوسطات اختيارية لكل نوع
export type MktAvg = Record<string, { avg: number; villa?: number; studio?: number; floor?: number; duplex?: number }>;

export function useAppData(defaultMktAvg: MktAvg, defaultListings: UIListing[]) {
  const [mktAvg, setMktAvg] = useState<MktAvg>(defaultMktAvg);
  const [listings, setListings] = useState<UIListing[]>(defaultListings);
  const [loadedFromDB, setLoadedFromDB] = useState(false);
  // المؤشر التجاري — منفصل تماماً عن السكني، يبدأ فارغاً (جدول commercial_prices)
  const [commIndex, setCommIndex] = useState<CommIndex>({});

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    (async () => {
      try {
        const sb = createClient();

        // نحاول قراءة أعمدة الدور/الدوبلكس؛ وإن لم تكن موجودة بعد (قبل تشغيل
        // add_floor_duplex.sql) نرجع للأعمدة الأساسية حتى لا تنكسر القراءة.
        let hres = await sb
          .from('neighborhoods')
          .select('name, avg_rent, avg_villa, avg_studio, avg_dor, avg_duplex');
        if (hres.error) {
          hres = await sb.from('neighborhoods').select('name, avg_rent, avg_villa, avg_studio');
        }
        const hoods = hres.data as Record<string, number | null>[] | null;
        if (!cancelled && hoods && hoods.length) {
          const map: MktAvg = {};
          for (const h of hoods)
            map[h.name as unknown as string] = {
              avg: h.avg_rent as number,
              villa: (h.avg_villa as number) ?? undefined,
              studio: (h.avg_studio as number) ?? undefined,
              floor: (h.avg_dor as number) ?? undefined,
              duplex: (h.avg_duplex as number) ?? undefined,
            };
          setMktAvg(map);
        }

        // العامة ترى المعتمد فقط (status='approved') + الخصائص المنظّمة (kitchen/ac/parking).
        // نتدرّج عبر عدة محاولات حتى نتوافق مع أي حالة للقاعدة (مع/بدون status، ومع/بدون
        // أعمدة الخصائص) فلا تنكسر القائمة العامة قبل تشغيل SQL.
        const BASE = 'id, office_id, hood, title, type, advertised, rooms, area, baths, furnished, condition, cond_label, description, images, fal_license, lat, lng';
        const FULL = BASE + ', kitchen, ac, parking';
        const FULL2 = FULL + ', images_by_category';
        const FULL3 = FULL2 + ', maps_url'; // مع رابط الموقع (بعد تشغيل listing_location.sql)
        // مع حقول القطاع التجاري (بعد تشغيل commercial_sector.sql) — تُجرَّب أولاً وترجع
        // لـ FULL3 بأمان قبل الترحيل فلا تنكسر القراءة (السكني يبقى افتراضياً).
        const FULL4 = FULL3 + ', sector, commercial_type, frontage_count, frontage_width, allowed_activity, has_bathroom, floor_info';
        // مع عمر العقار (بعد تشغيل listing_property_age.sql) — تُجرَّب أولاً وترجع
        // لـ FULL4 بأمان قبل الترحيل فلا تنكسر القراءة.
        const FULL5 = FULL4 + ', property_age';
        const attempts: { sel: string; status: boolean }[] = [
          { sel: FULL5, status: true },
          { sel: FULL4, status: true },
          { sel: FULL3, status: true },
          { sel: FULL2, status: true },
          { sel: FULL, status: true },
          { sel: FULL5, status: false },
          { sel: FULL4, status: false },
          { sel: FULL3, status: false },
          { sel: FULL2, status: false },
          { sel: FULL, status: false },
          { sel: BASE, status: true },
          { sel: BASE, status: false },
        ];
        let rows: Record<string, unknown>[] | null = null;
        for (const a of attempts) {
          let q = sb.from('listings').select(a.sel).eq('active', true);
          if (a.status) q = q.eq('status', 'approved');
          const res = await q.order('created_at', { ascending: false });
          if (!res.error) { rows = res.data as unknown as Record<string, unknown>[] | null; break; }
        }
        if (!cancelled && rows && rows.length) {
          setListings(
            rows.map((r) => ({
              id: r.id as string | number,
              office_id: (r.office_id as string) ?? null,
              hood: r.hood as string,
              title: r.title as string,
              type: r.type as string,
              adv: r.advertised as number,
              rooms: (r.rooms as number) ?? null,
              area: (r.area as number) ?? null,
              baths: (r.baths as number) ?? null,
              furnished: (r.furnished as boolean) ?? null,
              kitchen: (r.kitchen as boolean) ?? null,
              ac: (r.ac as boolean) ?? null,
              parking: (r.parking as number) ?? null,
              propertyAge: (r.property_age as number) ?? null,
              cond: (r.condition as string) || 'good',
              condLabel: (r.cond_label as string) || '',
              description: (r.description as string) || '',
              images: Array.isArray(r.images) ? (r.images as string[]) : [],
              imagesByCategory: (r.images_by_category as ImagesByCategory) ?? null,
              fal: (r.fal_license as string) || '',
              lat: (r.lat as number) ?? null,
              lng: (r.lng as number) ?? null,
              maps_url: (r.maps_url as string) ?? null,
              // القطاع التجاري — السكني افتراضي عند غياب العمود (قبل الترحيل)
              sector: (r.sector as string) || 'residential',
              commercialType: (r.commercial_type as string) ?? null,
              frontageCount: (r.frontage_count as number) ?? null,
              frontageWidth: (r.frontage_width as number) ?? null,
              activity: (r.allowed_activity as string) ?? null,
              hasBathroom: (r.has_bathroom as boolean) ?? null,
              floorInfo: (r.floor_info as string) ?? null,
            }))
          );
          setLoadedFromDB(true);
        }

        // ── المؤشر التجاري (commercial_prices) — منفصل، يبدأ فارغاً ──
        // قراءة غير قاتلة: إن لم يوجد الجدول بعد (قبل commercial_index.sql) نتركه فارغاً.
        const cpRes = await sb
          .from('commercial_prices')
          .select('hood, commercial_type, price_per_m2, sample_size');
        if (!cancelled && !cpRes.error && Array.isArray(cpRes.data)) {
          const idx: CommIndex = {};
          for (const row of cpRes.data as Record<string, unknown>[]) {
            const key = `${row.hood as string}|${row.commercial_type as string}`;
            idx[key] = {
              pricePerM2: (row.price_per_m2 as number) ?? null,
              sampleSize: (row.sample_size as number) ?? null,
            };
          }
          setCommIndex(idx);
        }
      } catch {
        // نتجاهل أي خطأ — تبقى البيانات الافتراضية ظاهرة
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { mktAvg, listings, loadedFromDB, commIndex };
}
