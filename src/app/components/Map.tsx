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

export default function MapComponent({ points = [] }: { points?: MapPoint[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<ReturnType<Leaflet['map']> | null>(null);
  const layerRef = useRef<ReturnType<Leaflet['layerGroup']> | null>(null);
  const [ready, setReady] = useState(false);

  // تحميل Leaflet وتهيئة الخريطة مرة واحدة
  useEffect(() => {
    let active = true;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const init = () => {
      const L = getL();
      if (!L || !mapRef.current || mapObj.current) return;
      const map = L.map(mapRef.current, { center: [24.77, 46.65], zoom: 11 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);
      mapObj.current = map;
      if (active) setReady(true);
    };

    if (getL()) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = init;
      document.head.appendChild(script);
    }

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
              '<span style="color:#6b7a8a">السعر العادل</span>' +
              '<strong style="color:#1B6CA8">' + l.fair.toLocaleString('ar-SA') + ' ريال</strong>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:center"><span style="background:' + color + '22;color:' + color + ';font-size:11px;padding:3px 10px;border-radius:8px;font-weight:700">' + (labels[l.st] || '') + '</span></div>' +
        '</div>';
      L.marker([l.lat, l.lng], { icon }).addTo(group).bindPopup(popup, { maxWidth: 230 });
    });

    group.addTo(map);
    layerRef.current = group;
  }, [points, ready]);

  return <div ref={mapRef} style={{ height: '480px', width: '100%' }} />;
}
