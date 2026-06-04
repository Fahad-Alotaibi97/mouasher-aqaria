// عميل Supabase للمتصفح (Client Components) — نسخة واحدة مثبّتة على globalThis.
// مهم جداً: كل نسخة GoTrueClient تشغّل مؤقّت تحديث رمز مستقل (autoRefreshToken).
// لو تعدّدت النسخ (إنشاء عميل في كل نداء، أو تكرار تقييم الوحدة مع Turbopack/HMR
// أو عبر عدة chunks) تتوازى طلبات /auth/v1/token?grant_type=refresh_token حتى
// يردّ Supabase بـ 429 فتنكسر الجلسة. لذا نُثبّت النسخة على globalThis لتبقى
// واحدة فعلاً مهما تكرّر تقييم هذا الملف.
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
