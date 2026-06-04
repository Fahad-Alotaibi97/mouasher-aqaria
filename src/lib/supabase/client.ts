// عميل Supabase للمتصفح (Client Components) — نسخة واحدة مثبّتة على globalThis،
// مع تخزين الجلسة في الكوكيز **صراحةً** عبر document.cookie.
//
// لماذا محوّل كوكيز صريح؟ افتراضياً يكتب createBrowserClient في document.cookie،
// لكن ذلك المسار يُؤخذ فقط عند اكتشاف بيئة المتصفح (isBrowser) واستخدام serialize
// من حزمة cookie. في بيئة Next.js المعدّلة هنا كانت الجلسة لا تُكتب في الكوكيز
// (document.cookie فارغ) فلا يراها الخادم/الصفحات الأخرى ⇒ ارتداد /admin للرئيسية.
// تمرير cookies صراحةً يفرض مسار الكوكيز بلا اعتماد على الاكتشاف، فتُكتب الجلسة
// دائماً في document.cookie باسم sb-<ref>-auth-token (نفس مخطّط @supabase/ssr).
//
// النسخة مثبّتة على globalThis حتى تبقى واحدة (مؤقّت autoRefreshToken واحد) مهما
// تكرّر تقييم الوحدة (Turbopack/HMR)، تفادياً لإغراق /auth/v1/token (429).
import { createBrowserClient } from '@supabase/ssr';

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    path?: string;
    domain?: string;
    maxAge?: number;
    sameSite?: boolean | 'lax' | 'strict' | 'none';
    secure?: boolean;
  };
};

// محوّل يقرأ/يكتب الكوكيز مباشرةً من document.cookie (بناء السلسلة يدوياً).
const cookieAdapter = {
  getAll() {
    if (typeof document === 'undefined') return [];
    return document.cookie
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const eq = c.indexOf('=');
        return eq === -1
          ? { name: c, value: '' }
          : { name: c.slice(0, eq), value: c.slice(eq + 1) };
      });
  },
  setAll(cookiesToSet: CookieToSet[]) {
    if (typeof document === 'undefined') return;
    for (const { name, value, options } of cookiesToSet) {
      const o = options ?? {};
      let str = `${name}=${value}`;
      str += `; Path=${o.path ?? '/'}`;
      str += `; Max-Age=${o.maxAge ?? 400 * 24 * 60 * 60}`;
      const sameSite = o.sameSite === undefined ? 'Lax' : o.sameSite === true ? 'Strict' : o.sameSite;
      if (sameSite) str += `; SameSite=${sameSite}`;
      if (o.domain) str += `; Domain=${o.domain}`;
      if (o.secure) str += `; Secure`;
      document.cookie = str;
    }
  },
};

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter }
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
