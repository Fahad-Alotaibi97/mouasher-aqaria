// عميل Supabase للمتصفح (Client Components) — نسخة واحدة (singleton).
// مهم جداً: إنشاء عميل جديد في كل نداء يُنشئ عدّة نسخ GoTrueClient، لكلٍّ منها
// مؤقّت تحديث رمز مستقل (autoRefreshToken)، فتنهال طلبات
// /auth/v1/token?grant_type=refresh_token بالتوازي حتى يردّ Supabase بـ 429
// فتنكسر الجلسة ويعود المستخدم لشاشة الدخول. لذا نُعيد دائماً النسخة نفسها.
import { createBrowserClient } from '@supabase/ssr';

// مصنع داخلي — نشتقّ منه نوع النسخة المخزّنة حتى نُبقي نفس استدلال الأنواع تماماً.
function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

let browserClient: ReturnType<typeof makeClient> | undefined;

export function createClient() {
  if (!browserClient) browserClient = makeClient();
  return browserClient;
}
