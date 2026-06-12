// فحص حي لموقع الوحدة (node _location_check.mjs):
//  1) اختبار دوال تحليل روابط Google Maps (نفس الكود المشحون — استيراد مباشر
//     من src/lib/mapsLocation.ts عبر type-stripping في Node 23.6+).
//  2) فحص حي: حساب مكتب مؤقت ⇒ إدراج إعلان بإحداثيات (+ maps_url إن وُجد
//     العمود) ⇒ قراءة ما حُفظ ⇒ حذف الإعلان. لو العمود ناقصاً يطبع إرشاد SQL.
import { createBrowserClient } from '@supabase/ssr';
import { parseMapsUrl, isMapsUrl, mapsHref } from './src/lib/mapsLocation.ts';
import fs from 'fs';

// ── (1) اختبارات التحليل ──
const cases = [
  ['https://www.google.com/maps/@24.7136,46.6753,15z', { lat: 24.7136, lng: 46.6753 }],
  ['https://www.google.com/maps/search/?api=1&query=24.8024,46.6286', { lat: 24.8024, lng: 46.6286 }],
  ['https://maps.google.com/?q=24.77,46.65', { lat: 24.77, lng: 46.65 }],
  ['https://www.google.com/maps/place/X/@24.8,46.6,17z/data=!3m1!4b1!4m6!3m5!8m2!3d24.80241!4d46.62861', { lat: 24.8, lng: 46.6 }],
  ['24.7136, 46.6753', { lat: 24.7136, lng: 46.6753 }],
  ['https://maps.app.goo.gl/AbCdEf123', null], // مختصر — لا إحداثيات، يُحفظ كما هو
  ['نص عشوائي', null],
];
let parseOk = 0;
for (const [url, want] of cases) {
  const got = parseMapsUrl(url);
  const pass = want === null ? got === null : got && Math.abs(got.lat - want.lat) < 1e-9 && Math.abs(got.lng - want.lng) < 1e-9;
  if (pass) parseOk++; else console.log('✗ PARSE FAIL:', url, '⇒', JSON.stringify(got));
}
console.log(`PARSE: ${parseOk}/${cases.length} ✓`);
console.log('IS-MAPS-URL (مختصر):', isMapsUrl('https://maps.app.goo.gl/AbCdEf123') ? 'OK ✓' : '✗ فشل');
console.log('HREF من إحداثيات:', mapsHref(24.77, 46.65, null) === 'https://www.google.com/maps/search/?api=1&query=24.77,46.65' ? 'OK ✓' : '✗ فشل');
console.log('HREF من رابط فقط:', mapsHref(null, null, 'https://maps.app.goo.gl/x') === 'https://maps.app.goo.gl/x' ? 'OK ✓' : '✗ فشل');
console.log('HREF بلا موقع:', mapsHref(null, null, null) === null ? 'OK ✓ (لا زر)' : '✗ فشل');

// ── (2) فحص حي على القاعدة ──
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
let jar = '';
const fakeDoc = { get cookie() { return jar; }, set cookie(v) { const [pair] = v.split(';'); const [n] = pair.split('='); jar = jar.split('; ').filter((c) => c && !c.startsWith(n + '=')).concat(pair).join('; '); } };
Object.defineProperty(globalThis, 'document', { value: fakeDoc, configurable: true });
globalThis.window = { location: { href: 'http://localhost:3000' }, document: fakeDoc };
const sb = createBrowserClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('NEXT_PUBLIC_SUPABASE_ANON_KEY'));

// ملاحظة مُتحقَّقة حياً: سياسة listings_owner تشترط مكتباً معتمداً ونشطاً للإدراج
// (قفل الثقة) ⇒ حساب فحص جديد (pending) يُرفض بـ 42501 — وهذا سلوك صحيح مقصود.
// لذا الفحص الكامل يحتاج بيانات حساب مكتب «معتمد»: node _location_check.mjs بريد كلمة
const email = process.argv[2];
const pass = process.argv[3];
if (!email || !pass) {
  console.log('');
  console.log('LIVE CHECK: تخطٍّ — مرّر بريد/كلمة مرور حساب مكتب معتمد للفحص الكامل');
  console.log('  (إدراج إعلان بإحداثيات + maps_url، قراءته، ثم حذفه).');
  console.log('  حساب جديد غير معتمد يُرفض بـ 42501 — قفل الثقة يعمل كما صُمم.');
  process.exit(0);
}
const { error: liErr } = await sb.auth.signInWithPassword({ email, password: pass });
if (liErr) { console.log('LOGIN مكتب: ERR ' + liErr.message); process.exit(1); }
const { data: { session } } = await sb.auth.getSession();
const { data: offRow } = await sb.from('offices').select('id,status,active').eq('owner_id', session.user.id).limit(1).maybeSingle();
if (!offRow) { console.log('✗ هذا الحساب لا يملك مكتباً — استخدم حساب مكتب معتمد.'); process.exit(1); }
if (offRow.status !== 'approved' || !offRow.active) { console.log(`✗ المكتب ${offRow.status}/${offRow.active ? 'نشط' : 'موقوف'} — يلزم معتمد ونشط (قفل الثقة).`); process.exit(1); }

const base = { office_id: offRow.id, title: 'إعلان فحص الموقع (للحذف)', hood: 'النرجس', type: 'شقة', advertised: 50000 };
let payload = { ...base, lat: 24.7136, lng: 46.6753, maps_url: 'https://maps.app.goo.gl/check123' };
let ins = await sb.from('listings').insert(payload).select('id,lat,lng,maps_url').single();
if (ins.error && (ins.error.code === 'PGRST204' || ins.error.code === '42703') && /maps_url/.test(ins.error.message || '')) {
  console.log('INSERT مع maps_url: العمود غير موجود بعد ⇒ شغّل supabase/listing_location.sql (الإحداثيات وحدها ستعمل الآن).');
  payload = { ...base, lat: 24.7136, lng: 46.6753 };
  ins = await sb.from('listings').insert(payload).select('id,lat,lng').single();
}
if (ins.error) { console.log('INSERT إعلان فحص: ERR ' + (ins.error.code ?? '') + ' ' + ins.error.message); process.exit(1); }
const saved = ins.data;
const latOk = Math.abs((saved.lat ?? 0) - 24.7136) < 1e-9 && Math.abs((saved.lng ?? 0) - 46.6753) < 1e-9;
console.log('SAVE lat/lng:', latOk ? 'OK ✓ (حُفظت الإحداثيات وقُرئت كما هي)' : '✗ القيم المحفوظة لا تطابق');
if ('maps_url' in saved) console.log('SAVE maps_url:', saved.maps_url === 'https://maps.app.goo.gl/check123' ? 'OK ✓' : '✗ لا يطابق');
console.log('زر الباحث سيفتح:', mapsHref(saved.lat, saved.lng, saved.maps_url ?? null));

// تنظيف: حذف إعلان الفحص (سياسة listings_owner تسمح للمالك)
const { error: delErr, count } = await sb.from('listings').delete({ count: 'exact' }).eq('id', saved.id);
console.log('CLEANUP إعلان الفحص:', delErr ? 'ERR ' + delErr.message : count ? 'حُذف ✓' : '✗ لم يُحذف');
await sb.auth.signOut();
console.log('حساب/مكتب الفحص:', email, '(احذفهما من Authentication → Users وجدول offices متى شئت)');
