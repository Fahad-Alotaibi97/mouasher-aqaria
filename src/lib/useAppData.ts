'use client';
// خطّاف يجلب الأحياء والإعلانات من Supabase، مع رجوع آمن للبيانات الافتراضية
// إذا لم تُضبط المفاتيح أو فشل الاتصال — فالموقع لا ينكسر أبداً.
import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

// شكل الإعلان الموحّد كما تستخدمه الواجهة
export interface UIListing {
  id: string | number;
  hood: string;
  title: string;
  type: string;
  adv: number;
  rooms?: number | null;
  area?: number | null;
  baths?: number | null;
  furnished?: boolean;
  cond: string;
  condLabel: string;
  description?: string;
  images?: string[];
  fal: string;
  lat?: number | null;
  lng?: number | null;
}

// avg = متوسط الشقة (الأساس) ، villa/studio/floor/duplex متوسطات اختيارية لكل نوع
export type MktAvg = Record<string, { avg: number; villa?: number; studio?: number; floor?: number; duplex?: number }>;

export function useAppData(defaultMktAvg: MktAvg, defaultListings: UIListing[]) {
  const [mktAvg, setMktAvg] = useState<MktAvg>(defaultMktAvg);
  const [listings, setListings] = useState<UIListing[]>(defaultListings);
  const [loadedFromDB, setLoadedFromDB] = useState(false);

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

        // العامة ترى المعتمد فقط (status='approved'). نحاول مع الفلتر؛ وإن لم يكن
        // عمود status موجوداً بعد (قبل تشغيل admin_dashboard.sql) نرجع بلا الفلتر
        // حتى لا تنكسر القائمة العامة.
        const SEL =
          'id, hood, title, type, advertised, rooms, area, baths, furnished, condition, cond_label, description, images, fal_license, lat, lng';
        let res = await sb
          .from('listings')
          .select(SEL)
          .eq('active', true)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });
        if (res.error) {
          res = await sb
            .from('listings')
            .select(SEL)
            .eq('active', true)
            .order('created_at', { ascending: false });
        }
        const rows = res.data;
        if (!cancelled && rows && rows.length) {
          setListings(
            rows.map((r) => ({
              id: r.id,
              hood: r.hood,
              title: r.title,
              type: r.type,
              adv: r.advertised,
              rooms: r.rooms,
              area: r.area,
              baths: r.baths,
              furnished: !!r.furnished,
              cond: r.condition || 'good',
              condLabel: r.cond_label || '',
              description: r.description || '',
              images: Array.isArray(r.images) ? r.images : [],
              fal: r.fal_license || '',
              lat: r.lat,
              lng: r.lng,
            }))
          );
          setLoadedFromDB(true);
        }
      } catch {
        // نتجاهل أي خطأ — تبقى البيانات الافتراضية ظاهرة
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { mktAvg, listings, loadedFromDB };
}
