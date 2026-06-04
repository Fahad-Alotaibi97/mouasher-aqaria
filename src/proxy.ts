// تحديث جلسة Supabase على الخادم في كل طلب (بديل middleware في هذه النسخة من Next).
// بدون هذا الملف، لا تُحدَّث/تُكتب كوكيز الجلسة من جهة الخادم، فلا تراها /admin
// (Server/Client Components) ⇒ ارتداد للرئيسية رغم وجود جلسة في المتصفح.
//
// المرجع: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// ونمط @supabase/ssr: getAll من request.cookies، وsetAll يكتب على request وعلى response معاً.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // إذا لم تُضبط المفاتيح، مرّر الطلب كما هو دون أي تأثير.
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 1) اكتب على request حتى تراها بقية السلسلة في نفس الطلب
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // 2) أنشئ response جديداً واكتب الكوكيز عليه ليُرسل للمتصفح
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // مهم: getUser() يحدّث الرمز عند الحاجة، وعندها يُستدعى setAll فتُكتب الكوكيز.
    await supabase.auth.getUser();
  } catch {
    // لا نوقف الموقع بسبب خطأ مصادقة عابر.
  }

  return response;
}

export const config = {
  // نشغّل على كل المسارات عدا الملفات الثابتة والصور (موصى به للمصادقة).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
