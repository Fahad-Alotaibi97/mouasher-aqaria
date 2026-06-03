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

// avg = متوسط الشقة (الأساس) ، villa/studio متوسطات اختيارية لكل نوع
export type MktAvg = Record<string, { avg: number; villa?: number; studio?: number }>;

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

        const { data: hoods } = await sb
          .from('neighborhoods')
          .select('name, avg_rent, avg_villa, avg_studio');
        if (!cancelled && hoods && hoods.length) {
          const map: MktAvg = {};
          for (const h of hoods)
            map[h.name] = {
              avg: h.avg_rent,
              villa: h.avg_villa ?? undefined,
              studio: h.avg_studio ?? undefined,
            };
          setMktAvg(map);
        }

        const { data: rows } = await sb
          .from('listings')
          .select('id, hood, title, type, advertised, rooms, area, baths, furnished, condition, cond_label, description, images, fal_license, lat, lng')
          .eq('active', true)
          .order('created_at', { ascending: false });
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
