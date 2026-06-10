// تحقّق من منطق ظهور الإعلانات حسب ثقة المكتب — بعد تشغيل supabase/listing_visibility_trust.sql
// التشغيل:  node _visibility_check.mjs                 ⇒ فحوص بلا صلاحيات إدارية
//           node _visibility_check.mjs "<admin-pass>"  ⇒ السيناريو الكامل (موثّق/غير موثّق/موقوف)
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const URL = g('NEXT_PUBLIC_SUPABASE_URL'), KEY = g('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const PASS = process.argv[2] || process.env.ADMIN_PASS;
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });
let allOk = true;
const check = (ok, msg) => { if (!ok) allOk = false; console.log(`${ok ? 'PASS ✓' : 'FAIL ✗'}: ${msg}`); };
const anonSees = async (anon, id) => {
  const r = await anon.from('listings').select('id').eq('id', id);
  return !r.error && r.data.length === 1;
};

const anon = mk();

// 1) القراءة العامة سليمة
const pub = await anon.from('listings').select('id,office_id,status,active');
check(!pub.error, `قراءة anon للإعلانات (${pub.data?.length ?? '؟'} ظاهر للعامة)` + (pub.error ? ' — ' + pub.error.message : ''));

// 2) مكتب جديد (pending) لا يستطيع النشر
const owner = mk();
const email = `vischeck_${Math.floor(Math.random() * 1e9)}@example.com`;
const su = await owner.auth.signUp({ email, password: 'TestPass123!@#' });
if (su.error || !su.data.session) { console.log('تعذّر إنشاء مستخدم اختبار: ' + (su.error?.message || 'no session')); process.exit(1); }
const off = await owner.from('offices').insert({ name: '__vischeck_office__', owner_id: su.data.user.id }).select('id,status,verified').single();
if (off.error) { console.log('تعذّر إنشاء مكتب الاختبار: ' + off.error.message); process.exit(1); }
const newListing = (status) => ({ office_id: off.data.id, title: '__vischeck__', hood: 'النرجس', type: 'شقة', advertised: 12345, ...(status ? { status } : {}) });
let ins = await owner.from('listings').insert(newListing()).select('id').single();
check(!!ins.error && ins.error.code === '42501', `مكتب بانتظار الاعتماد لا ينشر (${ins.error?.code ?? 'نجح!! ثغرة'})`);

if (!PASS) {
  await owner.from('offices').delete().eq('id', off.data.id);
  console.log('\n(للسيناريو الكامل موثّق/غير موثّق/موقوف:  node _visibility_check.mjs "<admin-password>")');
  console.log(allOk ? 'النتيجة حتى الآن: سليم ✓' : 'النتيجة: خلل ✗');
  process.exit(allOk ? 0 : 1);
}

// ── السيناريو الكامل بجلسة المدير ──
const adm = mk();
const al = await adm.auth.signInWithPassword({ email: 'faud969@gmail.com', password: PASS });
if (al.error) { console.log('دخول المدير فشل: ' + al.error.message); process.exit(1); }

// 3) اعتماد المكتب (بدون توثيق) ⇒ إعلانه الجديد يدخل pending مهما أرسل العميل
await adm.from('offices').update({ status: 'approved', active: true, verified: false }).eq('id', off.data.id);
ins = await owner.from('listings').insert(newListing('approved')).select('id,status').single(); // يحاول الغش بـ approved
const l1 = ins.data;
check(!ins.error && l1?.status === 'pending', `مكتب معتمد غير موثّق: الإعلان فُرض pending رغم إرسال approved (status=${l1?.status ?? ins.error?.message})`);
check(!(await anonSees(anon, l1?.id)), 'الإعلان pending غير ظاهر للعامة');

// 4) ثغرة الترقية الذاتية مسدودة: المكتب يحاول تحويل إعلانه إلى approved
const selfUp = await owner.from('listings').update({ status: 'approved' }).eq('id', l1.id).select('status').single();
check(selfUp.data?.status !== 'approved', `المكتب لا يعتمد إعلانه بنفسه (status بعد المحاولة=${selfUp.data?.status ?? selfUp.error?.code})`);

// 5) توثيق المكتب ⇒ النشر مباشر وفوري
await adm.from('offices').update({ verified: true }).eq('id', off.data.id);
ins = await owner.from('listings').insert(newListing()).select('id,status').single();
const l2 = ins.data;
check(!ins.error && l2?.status === 'approved', `مكتب موثّق: الإعلان اعتُمد تلقائياً (status=${l2?.status ?? ins.error?.message})`);
check(await anonSees(anon, l2?.id), 'إعلان المكتب الموثّق ظاهر للعامة فوراً');

// 6) اعتماد الإدارة للإعلان المعلّق ⇒ يظهر
await adm.from('listings').update({ status: 'approved' }).eq('id', l1.id);
check(await anonSees(anon, l1.id), 'إعلان غير الموثّق يظهر بعد اعتماد الإدارة');

// 7) إيقاف المكتب ⇒ كل إعلاناته تختفي من العام ولا يستطيع النشر
await adm.from('offices').update({ active: false }).eq('id', off.data.id);
check(!(await anonSees(anon, l1.id)) && !(await anonSees(anon, l2.id)), 'إيقاف المكتب يخفي إعلاناته القائمة فوراً');
ins = await owner.from('listings').insert(newListing()).select('id').single();
check(!!ins.error && ins.error.code === '42501', `المكتب الموقوف لا ينشر (${ins.error?.code ?? 'نجح!! ثغرة'})`);

// ── تنظيف كامل ──
await adm.from('listings').delete().eq('office_id', off.data.id);
const remain = await adm.from('listings').select('id').eq('office_id', off.data.id);
await adm.from('offices').delete().eq('id', off.data.id);
console.log(`تنظيف: إعلانات متبقية=${remain.data?.length ?? '؟'}، حُذف المكتب. (حساب الاختبار ${email} يبقى — يُحذف من Authentication→Users إن رغبت)`);

console.log('\n' + (allOk ? 'النتيجة: منطق الظهور حسب الثقة يعمل كاملاً ✓' : 'النتيجة: خلل — راجع أعلاه ✗'));
process.exit(allOk ? 0 : 1);
