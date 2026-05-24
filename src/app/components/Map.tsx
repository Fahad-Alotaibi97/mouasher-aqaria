'use client';

import { useEffect, useRef } from 'react';

const listings = [
  { id: 1, lat: 24.8024, lng: 46.6286, title: 'شقة 3 غرف — حي النرجس', adv: 90000, fair: 65000, st: 'hi' },
  { id: 2, lat: 24.8060, lng: 46.6340, title: 'شقة 2 غرف — حي النرجس', adv: 42000, fair: 65000, st: 'lo' },
  { id: 3, lat: 24.8100, lng: 46.6180, title: 'شقة 3 غرف — الماجدية', adv: 68000, fair: 65000, st: 'ok' },
  { id: 4, lat: 24.6877, lng: 46.6853, title: 'شقة 2 غرف — حي العليا', adv: 52000, fair: 52000, st: 'ok' },
  { id: 5, lat: 24.7766, lng: 46.6228, title: 'شقة 3 غرف — حي الملقا', adv: 48000, fair: 60000, st: 'lo' },
  { id: 6, lat: 24.7611, lng: 46.6511, title: 'استوديو — حي حطين', adv: 50400, fair: 31900, st: 'hi' },
  { id: 7, lat: 24.8196, lng: 46.6402, title: 'شقة 2 غرف — الياسمين', adv: 48000, fair: 54000, st: 'ok' },
  { id: 8, lat: 24.8400, lng: 46.6350, title: 'شقة 3 غرف — القيروان', adv: 38000, fair: 58000, st: 'lo' },
  { id: 9, lat: 24.8300, lng: 46.6100, title: 'فيلا — حي النخيل', adv: 140000, fair: 129800, st: 'ok' },
  { id: 10, lat: 24.7200, lng: 46.6550, title: 'شقة 2 غرف — إشبيلية', adv: 36000, fair: 38000, st: 'ok' },
];

const colors: Record<string, string> = { ok: '#1B6CA8', hi: '#E65100', lo: '#43A047' };
const labels: Record<string, string> = { ok: 'مناسب', hi: 'مرتفع', lo: 'فرصة' };

export default function MapComponent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || !mapRef.current) return;
    initRef.current = true;

    // CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as unknown as Record<string, unknown>).L as typeof import('leaflet');
      if (!mapRef.current) return;

      const map = L.map(mapRef.current, { center: [24.77, 46.65], zoom: 12 });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      listings.forEach(l => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${colors[l.st]};color:white;padding:5px 10px;border-radius:20px;font-size:12px;font-weight:700;font-family:'Cocon Next Arabic',Tajawal,sans-serif;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.2);border:2px solid white">${(l.adv/1000).toFixed(0)}K ${l.st==='lo'?'↓':l.st==='hi'?'↑':'✓'}</div>`,
          iconAnchor: [30, 16],
        });

        L.marker([l.lat, l.lng], { icon }).addTo(map).bindPopup(`
          <div dir="rtl" style="font-family:'Cocon Next Arabic',Tajawal,sans-serif;min-width:190px">
            <div style="font-weight:700;font-size:13px;color:#1a2a3e;margin-bottom:6px">${l.title}</div>
            <div style="background:#E6F1FB;border-radius:8px;padding:9px;margin-bottom:7px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:#6b7a8a">سعر المُعلن</span>
                <strong>${l.adv.toLocaleString('ar-SA')} ريال</strong>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;border-top:1px dashed #B5D4F4;padding-top:4px">
                <span style="color:#6b7a8a">السعر العادل</span>
                <strong style="color:#1B6CA8">${l.fair.toLocaleString('ar-SA')} ريال</strong>
              </div>
            </div>
            <div style="text-align:center">
              <span style="background:${colors[l.st]}22;color:${colors[l.st]};font-size:11px;padding:3px 10px;border-radius:8px;font-weight:700">${labels[l.st]}</span>
            </div>
          </div>
        `, { maxWidth: 230 });
      });
    };
    document.head.appendChild(script);
  }, []);

  return <div ref={mapRef} style={{ height: '480px', width: '100%' }} />;
}
