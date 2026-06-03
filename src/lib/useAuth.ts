'use client';
// حالة تسجيل الدخول + طريقتان للدخول:
//  1) Magic Link (رابط بالإيميل) — للمستخدمين العاديين، بلا كلمة مرور.
//  2) كلمة المرور (signInWithPassword) — لا يستهلك حصة الإيميلات المجانية.
// كما يكشف صلاحية المدير (is_admin) لعرض رابط لوحة /admin.
import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import { isSupabaseConfigured } from './supabase/config';

export interface AuthUser {
  id: string;
  email: string | null;
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

  async function sendMagicLink(email: string): Promise<{ ok: boolean; message: string }> {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: 'لم يتم ضبط الاتصال بقاعدة البيانات بعد.' };
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: 'أدخل بريداً إلكترونياً صحيحاً.' };
    }
    const sb = createClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : undefined,
      },
    });
    if (error) return { ok: false, message: 'تعذّر إرسال الرابط: ' + error.message };
    return { ok: true, message: 'أرسلنا رابط الدخول إلى بريدك — افتحه لإكمال الدخول.' };
  }

  async function signInWithPassword(
    email: string,
    password: string
  ): Promise<{ ok: boolean; message: string }> {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: 'لم يتم ضبط الاتصال بقاعدة البيانات بعد.' };
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, message: 'أدخل بريداً إلكترونياً صحيحاً.' };
    }
    if (!password) {
      return { ok: false, message: 'أدخل كلمة المرور.' };
    }
    const sb = createClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: 'تعذّر الدخول: ' + error.message };
    // onAuthStateChange سيحدّث user و isAdmin تلقائياً
    return { ok: true, message: 'تم تسجيل الدخول ✓' };
  }

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    const sb = createClient();
    await sb.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  }

  return { user, isAdmin, ready, sendMagicLink, signInWithPassword, signOut };
}
