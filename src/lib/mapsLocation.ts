// موقع الوحدة على الخريطة — دوال نقية (بلا React/DOM) ليسهل فحصها بسكربت Node:
//  • parseMapsUrl: يستخرج الإحداثيات من رابط خرائط Google الملصوق إن أمكن.
//  • isMapsUrl: هل النص رابط خرائط صالحاً للتخزين كما هو (مثل الروابط المختصرة
//    maps.app.goo.gl التي لا يمكن فكّها من المتصفح)؟
//  • mapsHref: رابط الفتح للباحث — إحداثيات إن وُجدت وإلا الرابط المخزّن.

export interface LatLng {
  lat: number;
  lng: number;
}

const COORD_PATTERNS: RegExp[] = [
  /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, //  …/@24.77,46.65,15z (رابط المتصفح المعتاد)
  /[?&]query=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i, //  ?api=1&query=lat,lng
  /[?&]q=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i, //  ?q=lat,lng
  /[?&]ll=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i, //  ?ll=lat,lng
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, //  …!3d24.77!4d46.65 (روابط place المفصّلة)
];

function valid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function parseMapsUrl(raw: string | null | undefined): LatLng | null {
  const url = (raw || '').trim();
  if (!url) return null;
  for (const p of COORD_PATTERNS) {
    const m = url.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  // إحداثيات خام ملصوقة مباشرة: «24.7136, 46.6753»
  const mm = url.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (mm) {
    const lat = parseFloat(mm[1]);
    const lng = parseFloat(mm[2]);
    if (valid(lat, lng)) return { lat, lng };
  }
  return null;
}

export function isMapsUrl(raw: string | null | undefined): boolean {
  const url = (raw || '').trim();
  return (
    /^https?:\/\/\S+$/i.test(url) &&
    /(google\.[^/\s]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url)
  );
}

export function mapsHref(lat?: number | null, lng?: number | null, mapsUrl?: string | null): string | null {
  if (typeof lat === 'number' && typeof lng === 'number' && valid(lat, lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (mapsUrl && /^https?:\/\//i.test(mapsUrl.trim())) return mapsUrl.trim();
  return null;
}
