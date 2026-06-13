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

// رغبة بحث غير مطابقة: تُسجَّل حين لا يجد المساعد الذكي أي إعلان مطابق لمعايير
// الباحث الصريحة (حي/نوع/سقف سعري) — لتظهر للمدير «أين الطلب بلا عرض مطابق».
//
//  • نفس مبدأ track(): fire-and-forget، لا تنتظر الرد، تبتلع كل الأخطاء بصمت،
//    ولا تكسر تجربة الباحث أبداً حتى قبل إنشاء جدول search_wishes.
//  • خصوصية مقصودة: لا اسم، لا جوال، لا هوية — فقط المعايير المبحوث عنها
//    (الحي/النوع/السقف السعري) ونص الطلب مقتطعاً.
//  • الأمان في القاعدة: insert فقط للزوار بحدود حجم؛ القراءة للمدير حصراً عبر
//    is_admin_user() (supabase/search_wishes.sql).
export function trackSearchWish(w: {
  neighborhood?: string | null;
  type?: string | null;
  maxPrice?: number | null;
  rawQuery?: string | null;
}) {
  try {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    void sb
      .from('search_wishes')
      .insert({
        neighborhood: w.neighborhood ?? null,
        type: w.type ?? null,
        max_price: w.maxPrice ?? null,
        raw_query: (w.rawQuery ?? '').slice(0, 200) || null,
      })
      .then(
        () => undefined,
        () => undefined
      );
  } catch {
    // التسجيل اختياري بطبيعته — لا شيء ينكسر إن غاب الجدول أو فشل الاتصال
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
