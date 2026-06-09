'use client';
// حالة تسجيل الدخول — بالإيميل وكلمة المرور فقط (بدون Magic Link).
//  • signInWithPassword: دخول حساب موجود.
//  • signUpWithPassword: إنشاء حساب جديد ثم دخول مباشر دون انتظار تأكيد الإيميل
//    (لتجنّب استهلاك حصة الإيميلات — يتطلب تعطيل "Confirm email" في إعدادات Supabase).
// كما يكشف صلاحية المدير (is_admin) لعرض رابط لوحة /admin.
import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

export interface AuthUser {
  id: string;
  email: string | null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// يقرأ صلاحية المدير (is_admin) لمعرّف مستخدم من جدول profiles.
async function fetchIsAdmin(
  sb: ReturnType<typeof createClient>,
  id: string
): Promise<boolean> {
  const { data } = await sb.from('profiles').select('is_admin').eq('id', id).maybeSingle();
  return !!data?.is_admin;
}

// يتأكّد من حفظ الجلسة في الكوكيز فعلاً قبل التحويل لـ /admin.
// السبب: @supabase/ssr يكتب كوكي الجلسة (sb-<ref>-auth-token) بشكل غير
// متزامن بعد signInWithPassword. لو حوّلنا فوراً قد تُفتح /admin قبل وصول
// الكوكي للخادم ⇒ لا يرى جلسة ⇒ ارتداد للرئيسية. لذا ننتظر ظهور كوكي sb-.
async function confirmSessionPersisted(): Promise<boolean> {
  const sb = createClient();
  const { data } = await sb.auth.getSession();
  if (!data.session) return false;
  if (typeof document === 'undefined') return true;
  for (let i = 0; i < 20; i++) {
    if (/(^|;\s*)sb-[^=]+-auth-token/.test(document.cookie)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return true; // الجلسة موجودة؛ نكمل حتى لو تأخّر ظهور الكوكي
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(() => !isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    let cancelled = false;

    const loadAdmin = async (u: AuthUser | null) => {
      if (!u) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const admin = await fetchIsAdmin(sb, u.id);
      if (!cancelled) setIsAdmin(admin);
    };

    sb.auth.getSession().then(async ({ data }) => {
      const su = data.session?.user;
      const u = su ? { id: su.id, email: su.email ?? null } : null;
      if (cancelled) return;
      setUser(u);
      await loadAdmin(u);
      if (!cancelled) setReady(true);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
      setUser(u);
      if (!u) setIsAdmin(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInWithPassword(
    email: string,
    password: string
  ): Promise<{ ok: boolean; message: string; isAdmin?: boolean }> {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: 'لم يتم ضبط الاتصال بقاعدة البيانات بعد.' };
    }
    if (!email || !EMAIL_RE.test(email)) {
      return { ok: false, message: 'أدخل بريداً إلكترونياً صحيحاً.' };
    }
    if (!password) {
      return { ok: false, message: 'أدخل كلمة المرور.' };
    }
    const sb = createClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = /invalid login credentials/i.test(error.message)
        ? 'البريد أو كلمة المرور غير صحيحة.'
        : /email not confirmed/i.test(error.message)
          ? 'الحساب يتطلب تأكيد البريد. عطّل "Confirm email" في إعدادات Supabase ثم أعد المحاولة.'
          : 'تعذّر الدخول: ' + error.message;
      return { ok: false, message: msg };
    }
    const admin = data.user ? await fetchIsAdmin(sb, data.user.id) : false;
    return { ok: true, message: 'تم تسجيل الدخول ✓', isAdmin: admin };
  }

  async function signUpWithPassword(
    email: string,
    password: string,
    opts?: { role?: 'seeker' | 'office'; officeName?: string; fal?: string; seekerName?: string }
  ): Promise<{ ok: boolean; message: string; isAdmin?: boolean }> {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: 'لم يتم ضبط الاتصال بقاعدة البيانات بعد.' };
    }
    if (!email || !EMAIL_RE.test(email)) {
      return { ok: false, message: 'أدخل بريداً إلكترونياً صحيحاً.' };
    }
    if (!password || password.length < 6) {
      return { ok: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' };
    }
    const sb = createClient();
    // نمرّر نوع الحساب وبيانات المكتب كـ metadata ليُنشئ trigger القاعدة صف المكتب
    // بشكل موثوق (security definer يتجاوز RLS/التوقيت) — هذا يفصل المكتب عن الباحث فعلاً.
    const signupMeta = {
      role: opts?.role || 'seeker',
      full_name: opts?.role === 'office' ? (opts.officeName || '').trim() : (opts?.seekerName || '').trim(),
      office_name: (opts?.officeName || '').trim(),
      fal: (opts?.fal || '').trim(),
    };
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: signupMeta } });
    if (error) {
      const msg = /already registered|already been registered|user already/i.test(error.message)
        ? 'هذا البريد مسجّل مسبقاً — استخدم "تسجيل دخول".'
        : 'تعذّر إنشاء الحساب: ' + error.message;
      return { ok: false, message: msg };
    }
    if (!data.session) {
      const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
      if (signInErr) {
        return {
          ok: false,
          message:
            'تم إنشاء الحساب، لكن الدخول المباشر يتطلب تعطيل "Confirm email" في إعدادات Supabase ثم تسجيل الدخول.',
        };
      }
    }
    // ── ربط حقيقي: تسجيل المكتب ينشئ ملف المكتب (offices) ويضبط الدور ──
    //   يتطلب جلسة فعّالة (auth.uid()) ليُمرّر سياسات RLS — متوفّرة بعد الدخول أعلاه.
    if (data.user) {
      const uid = data.user.id;
      if (opts?.role === 'office') {
        const officeName = (opts.officeName || '').trim() || 'مكتب عقاري';
        await sb.from('profiles').update({ role: 'office', full_name: officeName }).eq('id', uid);
        const { data: existing } = await sb.from('offices').select('id').eq('owner_id', uid).maybeSingle();
        if (!existing) {
          await sb.from('offices').insert({ owner_id: uid, name: officeName, fal_license: (opts.fal || '').trim() || null });
        }
      } else {
        // باحث: نخزّن اسمه في ملفه ليظهر ضمن «العملاء» في لوحة الأدمن
        const seekerName = (opts?.seekerName || '').trim();
        if (seekerName) await sb.from('profiles').update({ role: 'seeker', full_name: seekerName }).eq('id', uid);
      }
    }
    const admin = data.user ? await fetchIsAdmin(sb, data.user.id) : false;
    return { ok: true, message: 'تم إنشاء الحساب وتسجيل الدخول ✓', isAdmin: admin };
  }

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    await sb.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  }

  return {
    user,
    isAdmin,
    ready,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    confirmSession: confirmSessionPersisted,
  };
}
