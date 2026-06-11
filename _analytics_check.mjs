// فحص حي لنظام التحليلات (node _analytics_check.mjs [بريد-المدير] [كلمة-المرور]):
//  1) إدراج الأحداث الثلاثة كزائر anon ⇒ يجب أن ينجح (سياسة analytics_events_insert).
//  2) قراءة الأحداث كزائر anon ⇒ يجب أن تُرجع صفر صفوف (القراءة للمدير فقط).
//  3) (اختياري مع بيانات المدير) قراءة كمدير ⇒ يجب أن تُرجع الأحداث.
//  لو لم يُنشأ الجدول بعد (42P01) يطبع تنبيهاً واضحاً بتشغيل SQL أولاً.
//  أحداث الفحص تُعلَّم meta.test=true ليمكن حذفها: delete from analytics_events where meta->>'test'='true';
import { createBrowserClient } from '@supabase/ssr';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
let jar = '';
const fakeDoc = { get cookie() { return jar; }, set cookie(v) { const [pair] = v.split(';'); const [n] = pair.split('='); jar = jar.split('; ').filter((c) => c && !c.startsWith(n + '=')).concat(pair).join('; '); } };
Object.defineProperty(globalThis, 'document', { value: fakeDoc, configurable: true });
globalThis.window = { location: { href: 'http://localhost:3000' }, document: fakeDoc };
const sb = createBrowserClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

const TEST_EVENTS = [
  { type: 'listing_click', ref_id: 'check-script', meta: { test: true, hood: 'النرجس', type: 'شقة' } },
  { type: 'indicator_use', ref_id: null, meta: { test: true, hood: 'النرجس', type: 'شقة', price: 65000, verdict: 'ok' } },
  { type: 'search', ref_id: null, meta: { test: true, source: 'ai', q: 'فحص — شقة بالنرجس', hood: 'النرجس' } },
  { type: 'page_view', ref_id: null, meta: { test: true, page: 'home', sid: 'check-session' } },
  { type: 'feature_use', ref_id: null, meta: { test: true, feature: 'finance' } },
];

// (1) إدراج كزائر anon
let inserted = 0;
for (const ev of TEST_EVENTS) {
  const { error } = await sb.from('analytics_events').insert(ev);
  if (error) {
    // PGRST205 = الجدول غير موجود في PostgREST (المقابل الفعلي لـ 42P01 عبر REST)
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.log('✗ جدول analytics_events غير موجود بعد — شغّل supabase/analytics_events.sql في SQL Editor ثم أعد الفحص.');
      process.exit(1);
    }
    // 23514 = قيد CHECK يرفض النوع / 42501 = سياسة الإدراج ترفضه ⇒ القائمة لم تُوسَّع بعد
    if ((ev.type === 'page_view' || ev.type === 'feature_use') && (error.code === '23514' || error.code === '42501')) {
      console.log(`INSERT ${ev.type}: مرفوض (${error.code}) ⇒ شغّل supabase/analytics_page_view.sql لتوسيع الأنواع ثم أعد الفحص.`);
      continue;
    }
    console.log(`INSERT ${ev.type}: ERR ${error.code ?? ''} ${error.message}`);
  } else { inserted++; console.log(`INSERT ${ev.type} (anon): OK ✓`); }
}

// (2) قراءة كزائر anon — المتوقع صفر صفوف (لا خطأ، لكن RLS يحجب)
{
  const { data, error } = await sb.from('analytics_events').select('id,type').limit(10);
  if (error) console.log('SELECT anon: ERR ' + error.message);
  else console.log(`SELECT anon: ${data.length} صف ⇒ ${data.length === 0 ? 'محجوب كما يجب ✓' : '⚠ مكشوف للزوار — راجع سياسة القراءة!'}`);
}

// (3) قراءة كمدير (اختياري)
const email = process.argv[2], pass = process.argv[3];
if (!email || !pass) {
  console.log('SELECT admin: تخطٍّ — مرّر بريد المدير وكلمة المرور كوسيطين للفحص الكامل.');
} else {
  const { error: le } = await sb.auth.signInWithPassword({ email, password: pass });
  if (le) console.log('LOGIN admin: ERR ' + le.message);
  else {
    const { data, error } = await sb.from('analytics_events').select('id,type,meta').order('created_at', { ascending: false }).limit(10);
    if (error) console.log('SELECT admin: ERR ' + error.message);
    else console.log(`SELECT admin: ${data.length} صف (آخرها: ${data.slice(0, 3).map((r) => r.type).join('، ')}) ⇒ القراءة تعمل للمدير ✓`);
    await sb.auth.signOut();
  }
}
console.log(`الخلاصة: أُدرج ${inserted}/${TEST_EVENTS.length} أحداث فحص (معلَّمة meta.test=true).`);
