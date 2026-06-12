// فحص حي لسياسة قراءة «العملاء» (node _clients_check.mjs [بريد-المدير] [كلمة-المرور]):
//  1) زائر anon يقرأ profiles ⇒ صفر صفوف (لا سياسة للزوار).
//  2) مستخدم عادي (حساب فحص مؤقت) يقرأ profiles ⇒ صفّه فقط، وبلا خطأ recursion
//     (42P17 الذي كانت تسبّبه السياسة القديمة ذات الاستعلام الذاتي).
//  3) (اختياري ببيانات المدير) المدير يقرأ profiles ⇒ كل الملفات (أكثر من صفّه).
import { createBrowserClient } from '@supabase/ssr';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
let jar = '';
const fakeDoc = { get cookie() { return jar; }, set cookie(v) { const [pair] = v.split(';'); const [n] = pair.split('='); jar = jar.split('; ').filter((c) => c && !c.startsWith(n + '=')).concat(pair).join('; '); } };
Object.defineProperty(globalThis, 'document', { value: fakeDoc, configurable: true });
globalThis.window = { location: { href: 'http://localhost:3000' }, document: fakeDoc };
const sb = createBrowserClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

const recursionHint = (e) =>
  e && (e.code === '42P17' || /infinite recursion/i.test(e.message || ''))
    ? ' ⇒ ⚠ recursion! السياسة القديمة المتكرّرة مطبَّقة — شغّل supabase/admin_clients.sql الآمن فوراً.'
    : '';

// (1) زائر anon
{
  const { data, error } = await sb.from('profiles').select('id').limit(5);
  if (error) console.log('SELECT anon:', 'ERR ' + (error.code ?? '') + ' ' + error.message + recursionHint(error));
  else console.log(`SELECT anon: ${data.length} صف ⇒ ${data.length === 0 ? 'محجوب عن الزوار كما يجب ✓' : '⚠ مكشوف للزوار!'}`);
}

// (2) مستخدم عادي — حساب فحص مؤقت (يُحذف لاحقاً من Authentication → Users)
{
  const stamp = Date.now().toString(36);
  const email = `clientscheck.${stamp}@example.com`;
  const { data: su, error: upErr } = await sb.auth.signUp({ email, password: `Tmp_${stamp}!9`, options: { data: { role: 'seeker', full_name: 'فحص العملاء (للحذف)' } } });
  if (upErr) console.log('SIGNUP (حساب فحص):', 'ERR ' + upErr.message);
  else {
    const { data, error } = await sb.from('profiles').select('id,role,is_admin');
    if (error) console.log('SELECT non-admin:', 'ERR ' + (error.code ?? '') + ' ' + error.message + recursionHint(error));
    else {
      const onlySelf = data.length === 1 && data[0].id === su.user?.id;
      console.log(`SELECT non-admin: ${data.length} صف ⇒ ${onlySelf ? 'يرى صفّه فقط، بلا recursion ✓' : data.length === 0 ? '⚠ لا يرى حتى صفّه (راجع fix_profiles_rls.sql)' : '⚠ يرى ملفات غيره — تسريب!'}`);
    }
    await sb.auth.signOut();
    console.log('حساب الفحص:', email, '(احذفه من Authentication → Users متى شئت)');
  }
}

// (3) المدير (اختياري)
const email = process.argv[2], pass = process.argv[3];
if (!email || !pass) {
  console.log('SELECT admin: تخطٍّ — مرّر بريد المدير وكلمة المرور كوسيطين للفحص الكامل.');
} else {
  const { error: le } = await sb.auth.signInWithPassword({ email, password: pass });
  if (le) console.log('LOGIN admin: ERR ' + le.message);
  else {
    const { data, error } = await sb.from('profiles').select('id,role,is_admin,created_at');
    if (error) console.log('SELECT admin:', 'ERR ' + (error.code ?? '') + ' ' + error.message + recursionHint(error));
    else console.log(`SELECT admin: ${data.length} ملفاً ⇒ ${data.length > 1 ? 'المدير يرى كل المسجّلين ✓' : '⚠ يرى صفّه فقط — شغّل supabase/admin_clients.sql ثم أعد الفحص.'}`);
    await sb.auth.signOut();
  }
}
