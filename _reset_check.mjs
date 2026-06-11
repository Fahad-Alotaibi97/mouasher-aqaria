// فحص حي لمسار «نسيت كلمة المرور» (node _resetcheck.mjs):
//  1) resetPasswordForEmail لبريد غير مسجّل ⇒ يجب أن ينجح بلا خطأ (لا يستهلك حصة
//     الإيميلات ولا يكشف وجود الحساب — سلوك Supabase المقصود).
//  2) دخول حساب حقيقي ثم updateUser بكلمة المرور نفسها ⇒ يثبت أن مسار تحديث
//     كلمة المرور بجلسة يعمل (نتوقّع رفض «نفس الكلمة» أو نجاحاً بلا تغيير فعلي).
import { createBrowserClient } from '@supabase/ssr';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
let jar = '';
const fakeDoc = { get cookie() { return jar; }, set cookie(v) { const [pair] = v.split(';'); const [n] = pair.split('='); jar = jar.split('; ').filter((c) => c && !c.startsWith(n + '=')).concat(pair).join('; '); } };
Object.defineProperty(globalThis, 'document', { value: fakeDoc, configurable: true });
// window.document مطلوب ليجتاز isBrowser() في @supabase/ssr فيستخدم مسار document.cookie
globalThis.window = { location: { href: 'http://localhost:3000' }, document: fakeDoc };
const sb = createBrowserClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

// (1) طلب استرداد لبريد غير مسجّل — يجب ألا يُرجع خطأ
{
  const { error } = await sb.auth.resetPasswordForEmail('nonexistent-reset-check@example.com', {
    redirectTo: 'https://mouasher-aqaria.vercel.app/reset-password',
  });
  console.log('RESET REQUEST (بريد غير مسجّل):', error ? 'ERR ' + error.message : 'OK — بلا خطأ ✓');
}

// (2) إثبات مسار updateUser كاملاً بحساب تجريبي مؤقّت (يُحذف لاحقاً من لوحة Supabase):
//     تسجيل ⇒ تغيير الكلمة بـ updateUser (ما تفعله صفحة /reset-password) ⇒ دخول بالكلمة الجديدة.
{
  const stamp = Date.now().toString(36);
  const email = `resetcheck.${stamp}@example.com`;
  const pass1 = `Tmp1_${stamp}!`;
  const pass2 = `Tmp2_${stamp}!`;
  const { error: upErr } = await sb.auth.signUp({ email, password: pass1, options: { data: { role: 'seeker', full_name: 'فحص إعادة التعيين (للحذف)' } } });
  if (upErr) {
    console.log('SIGNUP (حساب فحص):', 'ERR ' + upErr.message);
  } else {
    const { error: updErr } = await sb.auth.updateUser({ password: pass2 });
    console.log('UPDATE USER (كلمة جديدة):', updErr ? 'ERR ' + updErr.message : 'OK ✓');
    await sb.auth.signOut();
    const { error: reErr } = await sb.auth.signInWithPassword({ email, password: pass2 });
    console.log('LOGIN بالكلمة الجديدة:', reErr ? 'ERR ' + reErr.message : 'OK ✓ — المسار كامل يعمل');
    await sb.auth.signOut();
    console.log('حساب الفحص:', email, '(احذفه من Authentication → Users متى شئت)');
  }
}
