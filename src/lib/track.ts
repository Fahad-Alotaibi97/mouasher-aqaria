'use client';
// تتبّع داخلي خفيف للوحة تحليلات /admin — يكتب في جدول analytics_events.
//
//  • fire-and-forget: لا ينتظر الرد، لا يحجب الواجهة، ويبتلع كل الأخطاء بصمت
//    (فشل التتبّع لا يجوز أن يكسر تجربة الزائر أبداً — حتى قبل إنشاء الجدول).
//  • خصوصية مقصودة: لا IP، لا هوية زائر، لا موقع جغرافي — فقط نوع الحدث
//    وبيانات الاستخدام (معرّف إعلان/حي/نوع وحدة/حكم المؤشر/نص بحث).
//  • الأمان في القاعدة: سياسة insert فقط للزوار؛ القراءة للمدير حصراً
//    (supabase/analytics_events.sql).
import { createClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

export type TrackType = 'listing_click' | 'indicator_use' | 'search';

export function track(type: TrackType, refId?: string | null, meta?: Record<string, unknown>) {
  try {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    void sb
      .from('analytics_events')
      .insert({ type, ref_id: refId ?? null, meta: meta ?? {} })
      .then(
        () => undefined,
        () => undefined
      );
  } catch {
    // لا شيء — التتبّع اختياري بطبيعته
  }
}
