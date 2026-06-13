'use client';

import { useEffect, useRef, useState } from 'react';

export interface MapPoint {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  adv: number;
  fair: number;
  st: string;
}

const colors: Record<string, string> = { ok: '#1B6CA8', hi: '#E65100', lo: '#43A047' };
const labels: Record<string, string> = { ok: 'مناسب', hi: 'مرتفع', lo: 'فرصة' };

type Leaflet = typeof import('leaflet');
function getL(): Leaflet | null {
  const w = window as unknown as { L?: Leaflet };
  return w.L ?? null;
}

// مُحمّل Leaflet مشترك (CSS + JS مرة واحدة) — يدعم أكثر من خريطة في الجلسة:
// لو السكربت قيد التحميل من مكوّن آخر نصغي لـ load بدل حقن نسخة ثانية.
function ensureLeaflet(onReady: () => void) {
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (getL()) { onReady(); return; }
  const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
  if (existing) { existing.addEventListener('load', onReady); return; }
  const script = document.createElement('script');
  script.id = 'leaflet-js';
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.addEventListener('load', onReady);
  document.head.appendChild(script);
}

export default function MapComponent({ points = [] }: { points?: MapPoint[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<ReturnType<Leaflet['map']> | null>(null);
  const layerRef = useRef<ReturnType<Leaflet['layerGroup']> | null>(null);
  // توقيع مجموعة النقاط آخر مرة كُبّرت إليها الخريطة — لتمييز «تغيّر الفلتر» عن إعادة الرسم العادية
  const fitSigRef = useRef<string>('');
  const [ready, setReady] = useState(false);

  // تحميل Leaflet وتهيئة الخريطة مرة واحدة
  useEffect(() => {
    let active = true;

    ensureLeaflet(() => {
      const L = getL();
      if (!L || !mapRef.current || mapObj.current) return;
      const map = L.map(mapRef.current, { center: [24.77, 46.65], zoom: 11 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      mapObj.current = map;
      if (active) setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  // رسم العلامات عند جاهزية الخريطة أو تغيّر النقاط
  useEffect(() => {
    const L = getL();
    const map = mapObj.current;
    if (!ready || !L || !map) return;

    if (layerRef.current) map.removeLayer(layerRef.current);
    const group = L.layerGroup();

    points.forEach((l) => {
      const color = colors[l.st] || colors.ok;
      const arrow = l.st === 'lo' ? '↓' : l.st === 'hi' ? '↑' : '✓';
      const icon = L.divIcon({
        className: '',
        html:
          '<div style="background:' + color + ';color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:700;font-family:Tajawal,sans-serif;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.2);border:2px solid white">' +
          (l.adv / 1000).toFixed(0) + 'K ' + arrow + '</div>',
        iconAnchor: [30, 16],
      });
      const popup =
        '<div dir="rtl" style="font-family:Tajawal,sans-serif;min-width:190px">' +
          '<div style="font-weight:700;font-size:13px;color:#1a2a3e;margin-bottom:6px">' + l.title + '</div>' +
          '<div style="background:#E6F1FB;border-radius:8px;padding:9px;margin-bottom:7px">' +
            '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
              '<span style="color:#6b7a8a">سعر المُعلن</span>' +
              '<strong>' + l.adv.toLocaleString('ar-SA') + ' ريال</strong>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:12px;border-top:1px dashed #B5D4F4;padding-top:4px">' +
              '<span style="color:#6b7a8a">مؤشر أسعار الحي</span>' +
              '<strong style="color:#1B6CA8">' + l.fair.toLocaleString('ar-SA') + ' ريال</strong>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:center"><span style="background:' + color + '22;color:' + color + ';font-size:11px;padding:3px 10px;border-radius:8px;font-weight:700">' + (labels[l.st] || '') + '</span></div>' +
        '</div>';
      L.marker([l.lat, l.lng], { icon }).addTo(group).bindPopup(popup, { maxWidth: 230 });
    });

    group.addTo(map);
    layerRef.current = group;

    // تكبير الخريطة لتلائم النقاط الظاهرة — فقط عند تغيّر مجموعة النقاط (تطبيق فلتر/بحث):
    // تصفّح حر بكل الدبابيس ⇒ تطبيق فلتر ⇒ تتقرّب الخريطة لنتائج الفلتر (fit bounds).
    // لا نكبّر مع كل إعادة رسم حتى لا نُلغي تحريك/تكبير المستخدم اليدوي بين الفلاتر.
    const sig = points.map((p) => p.id).join('|');
    if (points.length && sig !== fitSigRef.current) {
      try {
        if (points.length === 1) {
          // نقطة واحدة: لا bounds لها مساحة — نضبط المركز بزووم آمن بدل fitBounds.
          map.setView([points[0].lat, points[0].lng], 15);
        } else {
          const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        }
      } catch {
        // تكبير الخريطة كماليّ — أي خطأ هنا لا يجوز أن يكسر عرض الخريطة نفسها.
      }
    }
    fitSigRef.current = sig;
  }, [points, ready]);

  // ارتفاع متجاوب: ~300px جوال / ~350px سطح المكتب — لا يطغى على الصفحة ولا يُحجب بالدرج.
  return <div ref={mapRef} className="w-full h-[300px] md:h-[350px]" />;
}

// ── منتقي موقع الوحدة (لنموذج المكتب): نقرة على الخريطة = دبوس + إحداثيات ──
// يُحدَّث الدبوس أيضاً من الخارج (lat/lng props) عندما يلصق المكتب رابطاً يُحلَّل.
export function LocationPicker({ lat, lng, onPick }: {
  lat?: number | null;
  lng?: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<ReturnType<Leaflet['map']> | null>(null);
  const markerRef = useRef<ReturnType<Leaflet['marker']> | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(false);

  const setPin = (la: number, ln: number, pan: boolean) => {
    const L = getL();
    const map = mapObj.current;
    if (!L || !map) return;
    if (markerRef.current) markerRef.current.setLatLng([la, ln]);
    else markerRef.current = L.marker([la, ln]).addTo(map);
    if (pan) map.setView([la, ln], Math.max(map.getZoom(), 15));
  };

  useEffect(() => {
    let active = true;
    ensureLeaflet(() => {
      const L = getL();
      if (!L || !mapRef.current || mapObj.current) return;
      const hasInit = typeof lat === 'number' && typeof lng === 'number';
      const map = L.map(mapRef.current, {
        center: hasInit ? [lat as number, lng as number] : [24.77, 46.65],
        zoom: hasInit ? 15 : 11,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        setPin(e.latlng.lat, e.latlng.lng, false);
        onPickRef.current(e.latlng.lat, e.latlng.lng);
      });
      mapObj.current = map;
      if (hasInit) setPin(lat as number, lng as number, false);
      if (active) setReady(true);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // مزامنة الدبوس مع الإحداثيات القادمة من الخارج (لصق رابط مُحلَّل / فتح تعديل)
  useEffect(() => {
    if (!ready) return;
    if (typeof lat === 'number' && typeof lng === 'number') setPin(lat, lng, true);
  }, [lat, lng, ready]);

  return <div ref={mapRef} style={{ height: '280px', width: '100%', borderRadius: '12px' }} />;
}
