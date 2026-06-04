// عميل Supabase للمتصفح (Client Components).
// نسخة واحدة مثبّتة على globalThis حتى يبقى مؤقّت autoRefreshToken واحداً مهما
// تكرّر تقييم الوحدة (Turbopack/HMR)، تفادياً لإغراق /auth/v1/token (429).
//
// مهم: لا نمرّر محوّل كوكيز يدوياً. @supabase/ssr يكتشف المتصفح ويستخدم
// document.cookie المدمج عنده (يتولّى التقطيع chunking وترميز base64url
// وإزالة الأجزاء البائتة) — وهو المسار المُختبَر الذي يكتب sb-<ref>-auth-token
// في الكوكيز فيراها الخادم و/admin. المحوّل اليدوي السابق كان يكسر هذا المسار.
import { createBrowserClient } from '@supabase/ssr';

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const globalForSupabase = globalThis as unknown as {
  __supabaseBrowserClient?: ReturnType<typeof makeClient>;
};

export function createClient() {
  if (!globalForSupabase.__supabaseBrowserClient) {
    globalForSupabase.__supabaseBrowserClient = makeClient();
  }
  return globalForSupabase.__supabaseBrowserClient;
}
