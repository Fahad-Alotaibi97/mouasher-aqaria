'use client';
// خطّاف يجلب الأحياء والإعلانات من Supabase، مع رجوع آمن للبيانات الافتراضية
// إذا لم تُضبط المفاتيح أو فشل الاتصال — فالموقع لا ينكسر أبداً.
import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

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

        // العامة ترى المعتمد فقط (status='approved') + الخصائص المنظّمة (kitchen/ac/parking).
        // نتدرّج عبر عدة محاولات حتى نتوافق مع أي حالة للقاعدة (مع/بدون status، ومع/بدون
        // أعمدة الخصائص) فلا تنكسر القائمة العامة قبل تشغيل SQL.
        const BASE = 'id, office_id, hood, title, type, advertised, rooms, area, baths, furnished, condition, cond_label, description, images, fal_license, lat, lng';
        const FULL = BASE + ', kitchen, ac, parking';
        const attempts: { sel: string; status: boolean }[] = [
          { sel: FULL, status: true },
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
              cond: (r.condition as string) || 'good',
              condLabel: (r.cond_label as string) || '',
              description: (r.description as string) || '',
              images: Array.isArray(r.images) ? (r.images as string[]) : [],
              fal: (r.fal_license as string) || '',
              lat: (r.lat as number) ?? null,
              lng: (r.lng as number) ?? null,
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
