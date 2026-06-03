// يُكمل تسجيل الدخول بعد ضغط رابط الإيميل — يبادل الرمز بجلسة ثم يعيد للصفحة الرئيسية.
// عند أي خطأ يعيد المستخدم مع رسالة واضحة (?auth_error=) بدل أن "لا يحدث شيء".
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type OtpType = 'email' | 'magiclink' | 'recovery' | 'signup' | 'invite' | 'email_change';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as OtpType | null;
  // وجهة ما بعد الدخول — نقبل المسارات الداخلية فقط حمايةً من open-redirect.
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/';

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(message)}`);

  // إذا أعاد Supabase نفسه خطأً في الرابط (مثل انتهاء صلاحية OTP) نعرضه كما هو.
  const providerError = searchParams.get('error_description') || searchParams.get('error');
  if (providerError) return fail(providerError);

  const supabase = await createClient();

  if (code) {
    // مسار PKCE الافتراضي: نبادل الرمز بجلسة (يحتاج verifier المخزَّن في كوكي نفس المتصفح).
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    // مسار OTP/token_hash: يعمل عبر الأجهزة المختلفة (لا يحتاج verifier).
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(error.message);
    return NextResponse.redirect(`${origin}${next}`);
  }

  // لا يوجد code ولا token_hash → الرابط ناقص (غالباً بسبب ضبط Redirect URL في Supabase).
  return fail('رابط الدخول غير صالح أو ناقص.');
}
