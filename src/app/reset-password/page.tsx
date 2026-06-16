'use client';
// ════════════════════════════════════════════════════════════
//  إعادة تعيين كلمة المرور — وجهة رابط الاسترداد من بريد Supabase.
//
//  المسار الكامل: «نسيت كلمة المرور؟» في نموذج الدخول ⇒ resetPasswordForEmail
//  (redirectTo = هذه الصفحة) ⇒ يصل المستخدم من رابط البريد ومعه ?code=…
//  (PKCE) أو #access_token=… ⇒ عميل المتصفح (detectSessionInUrl) يستبدله
//  بجلسة استرداد تلقائياً ⇒ نعرض نموذج كلمة المرور الجديدة ⇒ updateUser
//  ⇒ خروج ثم تحويل لتسجيل الدخول (/#pricing) ليدخل بكلمته الجديدة.
//
//  يخدم كل أنواع الحسابات (مدير/مكتب/باحث) — كلهم مستخدمو Supabase auth.
//  ملاحظة PKCE: رمز الاسترداد يُستبدل بمُحقِّق محفوظ في متصفح الطلب نفسه،
//  لذا يجب فتح الرابط في نفس المتصفح الذي طُلب منه — نشرح ذلك عند الفشل.
// ════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { SiteHeader, SiteFooter } from '../components/SiteChrome';

type Phase = 'checking' | 'ready' | 'done' | 'invalid';

// يلتقط رسالة خطأ Supabase من الرابط (تأتي في الـ query أو الـ hash حسب المسار)
function urlAuthError(): { code: string; desc: string } | null {
  const fromParams = (p: URLSearchParams) => {
    if (!p.get('error') && !p.get('error_code') && !p.get('error_description')) return null;
    return { code: p.get('error_code') || p.get('error') || '', desc: p.get('error_description') || '' };
  };
  return (
    fromParams(new URLSearchParams(window.location.search)) ||
    fromParams(new URLSearchParams(window.location.hash.replace(/^#/, '')))
  );
}

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [invalidMsg, setInvalidMsg] = useState('');
  const [email, setEmail] = useState<string | null>(null); // بريد الحساب الجاري استرداده (للاطمئنان)
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const phaseRef = useRef<Phase>('checking');
  const setPhaseSafe = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  // عند الوصول من رابط البريد: ننتظر جلسة الاسترداد (الاستبدال يتم تلقائياً وبشكل
  // غير متزامن داخل العميل)، ونصغي لأحداث المصادقة دون أي نداء شبكي في الردّ.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setInvalidMsg('لم يتم ضبط الاتصال بقاعدة البيانات بعد.');
      setPhaseSafe('invalid');
      return;
    }
    const urlErr = urlAuthError();
    if (urlErr) {
      setInvalidMsg(
        /expired|otp_expired/i.test(urlErr.code + ' ' + urlErr.desc)
          ? 'انتهت صلاحية الرابط — اطلب رابط إعادة تعيين جديداً من شاشة تسجيل الدخول.'
          : 'الرابط غير صالح — اطلب رابط إعادة تعيين جديداً من شاشة تسجيل الدخول.'
      );
      setPhaseSafe('invalid');
      return;
    }

    const sb = createClient();
    let cancelled = false;

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setEmail(session.user?.email ?? null);
        if (phaseRef.current === 'checking') setPhaseSafe('ready');
      }
    });

    // استبدال الرمز بجلسة يحدث في خلفية العميل ⇒ نعيد فحص getSession لثوانٍ قبل الحكم بالفشل
    const hadCode = /[?&]code=/.test(window.location.search) || /access_token=/.test(window.location.hash);
    (async () => {
      for (let i = 0; i < 12; i++) {
        const { data } = await sb.auth.getSession();
        if (cancelled || phaseRef.current !== 'checking') return;
        if (data.session) {
          setEmail(data.session.user?.email ?? null);
          setPhaseSafe('ready');
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (cancelled || phaseRef.current !== 'checking') return;
      setInvalidMsg(
        hadCode
          ? 'تعذّر التحقق من الرابط. افتح الرابط في نفس المتصفح الذي طلبت منه إعادة التعيين، أو اطلب رابطاً جديداً (الرابط يعمل مرة واحدة ولمدة محدودة).'
          : 'هذه الصفحة تُفتح من رابط «إعادة تعيين كلمة المرور» المُرسَل لبريدك. اطلب الرابط من شاشة تسجيل الدخول.'
      );
      setPhaseSafe('invalid');
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (busy) return;
    setErrMsg(null);
    if (!pass || pass.length < 6) {
      setErrMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    if (pass !== pass2) {
      setErrMsg('كلمتا المرور غير متطابقتين.');
      return;
    }
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.updateUser({ password: pass });
    if (error) {
      const msg = /should be different/i.test(error.message)
        ? 'كلمة المرور الجديدة مطابقة للقديمة — اختر كلمة مختلفة.'
        : /session missing|not authenticated|invalid|expired/i.test(error.message)
          ? 'انتهت صلاحية الجلسة — اطلب رابط إعادة تعيين جديداً من شاشة تسجيل الدخول.'
          : 'تعذّر تحديث كلمة المرور: ' + error.message;
      setErrMsg(msg);
      setBusy(false);
      return;
    }
    // نُنهي جلسة الاسترداد ليدخل المستخدم بكلمته الجديدة من شاشة الدخول
    await sb.auth.signOut();
    setPass('');
    setPass2('');
    setPhaseSafe('done');
    setBusy(false);
    // تحويل تلقائي لشاشة الدخول بعد مهلة قراءة رسالة النجاح
    setTimeout(() => { window.location.href = '/#pricing'; }, 6000);
  };

  const inputCls =
    'w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm text-left outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder-gray-400';

  return (
    <div dir="rtl" className="min-h-screen site flex flex-col">
      <SiteHeader />

      <div className="flex-1 flex items-start justify-center px-5 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl border-2 border-blue-200 shadow-sm p-6">
          <h1 className="font-bold text-lg text-[#0A3D62] mb-1">إعادة تعيين كلمة المرور</h1>

          {phase === 'checking' && (
            <p className="text-sm text-gray-500 py-6 text-center">جارٍ التحقق من رابط الاسترداد…</p>
          )}

          {phase === 'invalid' && (
            <div>
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm leading-relaxed">{invalidMsg}</div>
              <a
                href="/#pricing"
                className="block text-center w-full mt-4 bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white py-2.5 rounded-xl font-bold text-sm shadow"
              >
                الذهاب لتسجيل الدخول
              </a>
            </div>
          )}

          {phase === 'ready' && (
            <div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                {email ? <>تعيين كلمة مرور جديدة للحساب <span dir="ltr" className="font-bold text-gray-700">{email}</span></> : 'أدخل كلمة المرور الجديدة لحسابك.'}
              </p>
              <label className="text-xs text-gray-700 font-semibold block mb-1">كلمة المرور الجديدة</label>
              <input
                type="password"
                dir="ltr"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
              <div className="text-[11px] text-gray-400 mt-1">6 أحرف على الأقل.</div>
              <label className="text-xs text-gray-700 font-semibold block mb-1 mt-3">تأكيد كلمة المرور الجديدة</label>
              <input
                type="password"
                dir="ltr"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="••••••••"
                className={inputCls}
              />
              <button
                onClick={submit}
                disabled={busy}
                className="w-full mt-4 bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-50"
              >
                {busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور الجديدة'}
              </button>
              {errMsg && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm leading-relaxed">{errMsg}</div>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div>
              <div className="mt-3 bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-sm leading-relaxed text-center font-medium">
                تم تغيير كلمة المرور بنجاح ✓
                <br />
                سجّل دخولك الآن بكلمة المرور الجديدة.
              </div>
              <a
                href="/#pricing"
                className="block text-center w-full mt-4 bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white py-2.5 rounded-xl font-bold text-sm shadow"
              >
                الذهاب لتسجيل الدخول
              </a>
              <div className="text-[11px] text-gray-400 text-center mt-2">سيتم تحويلك تلقائياً خلال ثوانٍ…</div>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
