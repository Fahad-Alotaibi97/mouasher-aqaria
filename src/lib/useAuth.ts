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
// قوي ضد عدم جاهزية الجلسة: لو رجع خطأ أو لم يجد صفاً في المحاولة الأولى،
// يحدّث الجلسة ثم يعيد المحاولة مرة واحدة قبل أن يعتبره غير مدير.
// (الإصلاح الجذري لقراءة الصف هو سياسة RLS «profiles_read_own» — راجع
//  supabase/fix_profiles_rls.sql — وهذا تحصين إضافي في الكود.)
async function fetchIsAdmin(
  sb: ReturnType<typeof createClient>,
  id: string
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await sb.from('profiles').select('is_admin').eq('id', id).maybeSingle();
    if (!error && data) return !!data.is_admin;
    if (attempt === 0) await sb.auth.getSession(); // نضمن أن الجلسة جاهزة ثم نعيد المحاولة
  }
  return false;
}

// يؤكّد أن جلسة الدخول كُتبت فعلياً في الكوكيز التي ستقرأها صفحة /admin بعد التحويل.
// ينشئ عميلاً جديداً (يقرأ الكوكيز من الصفر، تماماً كما تفعل /admin عند تحميلها)
// ويستفسر حتى تظهر الجلسة أو تنتهي المهلة (~2 ثانية). يمنع فتح /admin بلا جلسة.
async function confirmSessionPersisted(): Promise<boolean> {
  for (let i = 0; i < 25; i++) {
    const probe = createClient();
    const { data } = await probe.auth.getSession();
    if (data.session) return true;
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

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
      const admin = await fetchIsAdmin(sb, u.id);
      if (!cancelled) setIsAdmin(admin);
    };

    // نعتمد getSession (قراءة محلية من الكوكيز) بدل getUser (نداء شبكي) لتحديد
    // حالة الدخول عند التحميل — موثوق فور فتح /admin بعد التحويل، ولا ينخدع
    // بفشل شبكي عابر فيُظهر شاشة دخول لمستخدمٍ لديه جلسة فعلاً (سبب الحلقة).
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
      loadAdmin(u);
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
