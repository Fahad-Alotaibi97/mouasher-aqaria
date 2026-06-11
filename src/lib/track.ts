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

export type TrackType = 'listing_click' | 'indicator_use' | 'search' | 'page_view' | 'feature_use';

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

// معرّف جلسة عشوائي لتقدير «جلسات تقريبية» في لوحة التحليلات — يعيش في
// sessionStorage فقط (يزول بإغلاق التبويب)، عشوائي بالكامل، ولا يرتبط بأي
// هوية أو حساب — مجرد تمييز أن عدة زيارات جاءت من نفس الجلسة.
function sessionId(): string | null {
  try {
    const KEY = 'mw_sid';
    let sid = sessionStorage.getItem(KEY);
    if (!sid) {
      sid = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    return null; // sessionStorage محجوب ⇒ تُحسب الزيارة بلا جلسة، ولا شيء ينكسر
  }
}

// زيارة واحدة لكل تحميل صفحة: حارس على مستوى الوحدة يمنع التكرار من إعادة
// التركيب (StrictMode/HMR) — الوحدة تُقيَّم مرة واحدة لكل تحميل فعلي في الإنتاج.
let pageViewSent = false;
export function trackPageView(pageName: string) {
  if (pageViewSent) return;
  pageViewSent = true;
  track('page_view', null, { page: pageName, sid: sessionId() });
}
