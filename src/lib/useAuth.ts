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

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // إذا لم تُضبط القاعدة، نعتبر الحالة جاهزة فوراً (دون setState داخل التأثير)
  const [ready, setReady] = useState(() => !isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    let cancelled = false;

    // يجلب صلاحية المدير لمستخدمٍ ما (فارغ ⇒ غير مدير)
    const loadAdmin = async (u: AuthUser | null) => {
      if (!u) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data } = await sb.from('profiles').select('is_admin').eq('id', u.id).maybeSingle();
      if (!cancelled) setIsAdmin(!!data?.is_admin);
    };

    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
      if (cancelled) return;
      setUser(u);
      await loadAdmin(u);
      if (!cancelled) setReady(true);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
      setUser(u);
      loadAdmin(u);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // يقرأ صلاحية المدير لمعرّف مستخدم (للتحويل الفوري للأدمن بعد الدخول)
  const fetchIsAdmin = async (
    sb: ReturnType<typeof createClient>,
    id: string
  ): Promise<boolean> => {
    const { data } = await sb.from('profiles').select('is_admin').eq('id', id).maybeSingle();
    return !!data?.is_admin;
  };

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
    // نقرأ is_admin مباشرةً ليُحوّل الأدمن فوراً للوحة الإدارة
    const admin = data.user ? await fetchIsAdmin(sb, data.user.id) : false;
    // onAuthStateChange سيحدّث user و isAdmin تلقائياً
    return { ok: true, message: 'تم تسجيل الدخول ✓', isAdmin: admin };
  }

  async function signUpWithPassword(
    email: string,
    password: string
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
    // إنشاء الحساب في Supabase Auth — التريغر on_auth_user_created يُنشئ صف profiles تلقائياً.
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) {
      const msg = /already registered|already been registered|user already/i.test(error.message)
        ? 'هذا البريد مسجّل مسبقاً — استخدم "تسجيل دخول".'
        : 'تعذّر إنشاء الحساب: ' + error.message;
      return { ok: false, message: msg };
    }
    // إذا كان تأكيد البريد مُعطّلاً تُنشأ الجلسة فوراً؛ وإلا نحاول الدخول مباشرةً.
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
    // نقرأ is_admin (حساب جديد = false عادةً، فلا يُحوّل) — onAuthStateChange سيحدّث الحالة
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

  return { user, isAdmin, ready, signInWithPassword, signUpWithPassword, signOut };
}
