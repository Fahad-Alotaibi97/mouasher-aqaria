// منطق "السعر العادل" — معزول عن التصميم، قابل لإعادة الاستخدام في الموقع والتطبيق.
import type { Listing, Neighborhood, PriceStatus } from './types';

// معامل النوع نسبةً لمتوسط الحي (شقة = 1)
const TYPE_MULTIPLIER: Record<string, number> = {
  'فيلا': 2.2,
  'استوديو': 0.55,
  'دور': 1.4,
  'شقة': 1,
};

/** حسبة السعر العادل لإعلان بناءً على متوسط حيّه ونوعه. */
export function getFairPrice(
  listing: Pick<Listing, 'hood' | 'type' | 'advertised'>,
  neighborhoods: Neighborhood[]
): number {
  const n = neighborhoods.find((x) => x.name === listing.hood);
  if (!n) return listing.advertised;
  // نُفضّل المتوسط المُدار لكل نوع إن توفّر، وإلا نشتقّه من متوسط الشقة بالمعامل.
  if (listing.type === 'فيلا' && n.avg_villa != null) return Math.round(n.avg_villa);
  if (listing.type === 'استوديو' && n.avg_studio != null) return Math.round(n.avg_studio);
  const mul = TYPE_MULTIPLIER[listing.type] ?? 1;
  return Math.round(n.avg_rent * mul);
}

/** حالة السعر مقارنةً بالعادل: مرتفع / فرصة / مناسب. */
export function getPriceStatus(advertised: number, fair: number): PriceStatus {
  const ratio = advertised / fair;
  if (ratio > 1.12) return 'hi';
  if (ratio < 0.85) return 'lo';
  return 'ok';
}

export function statusLabel(st: PriceStatus): string {
  return st === 'ok' ? 'مناسب' : st === 'hi' ? 'مرتفع' : 'فرصة';
}

/** هل الإعلان "فرصة" (أقل من العادل)؟ */
export function isOpportunity(
  listing: Pick<Listing, 'hood' | 'type' | 'advertised'>,
  neighborhoods: Neighborhood[]
): boolean {
  return getPriceStatus(listing.advertised, getFairPrice(listing, neighborhoods)) === 'lo';
}
