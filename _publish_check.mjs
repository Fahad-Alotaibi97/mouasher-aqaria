// تحقّق من إصلاحي «إضافة إعلان»: أعمدة الخصائص + الربط التلقائي برخصة المكتب.
// التشغيل:  node _publish_check.mjs                 ⇒ فحص وجود الأعمدة فقط (بعد تشغيل listing_attributes.sql)
//           node _publish_check.mjs "<admin-pass>"  ⇒ نشر فعلي كامل من مكتب موثّق والتحقق من كل شيء
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const URL = g('NEXT_PUBLIC_SUPABASE_URL'), KEY = g('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const PASS = process.argv[2] || process.env.ADMIN_PASS;
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });
let allOk = true;
const check = (ok, msg) => { if (!ok) allOk = false; console.log(`${ok ? 'PASS ✓' : 'FAIL ✗'}: ${msg}`); };

const anon = mk();

// 1) أعمدة الخصائص موجودة
for (const col of ['kitchen', 'ac', 'parking', 'furnished', 'baths', 'description', 'images']) {
  const r = await anon.from('listings').select(col).limit(1);
  check(!r.error, `عمود ${col} موجود` + (r.error ? ` — ${r.error.code}` : ''));
}

if (!PASS) {
  console.log('\n(للنشر الفعلي الكامل من مكتب موثّق:  node _publish_check.mjs "<admin-password>")');
  console.log(allOk ? 'النتيجة: الأعمدة جاهزة ✓' : 'النتيجة: شغّل supabase/listing_attributes.sql أولاً ✗');
  process.exit(allOk ? 0 : 1);
}

// 2) نشر فعلي كامل: مكتب موثّق برخصة، ينشر إعلاناً بكل الخصائص
const adm = mk();
const al = await adm.auth.signInWithPassword({ email: 'faud969@gmail.com', password: PASS });
if (al.error) { console.log('دخول المدير فشل: ' + al.error.message); process.exit(1); }

const owner = mk();
const email = `pubcheck_${Math.floor(Math.random() * 1e9)}@example.com`;
const su = await owner.auth.signUp({ email, password: 'TestPass123!@#' });
const off = await owner.from('offices').insert({ name: '__pubcheck_office__', owner_id: su.data.user.id, fal_license: '1100777888' }).select('id,fal_license').single();
if (off.error) { console.log('إنشاء المكتب فشل: ' + off.error.message); process.exit(1); }
await adm.from('offices').update({ status: 'approved', active: true, verified: true }).eq('id', off.data.id);

// نفس حمولة publishListing في الواجهة (الرخصة من سجل المكتب، لا إدخال يدوي)
const ins = await owner.from('listings').insert({
  office_id: off.data.id, status: 'pending', // الـ trigger سيفرض approved لأن المكتب موثّق
  title: 'شقة 3 غرف — النرجس', hood: 'النرجس', type: 'شقة', advertised: 54321,
  area: 140, rooms: 3, condition: 'good', cond_label: 'حالة جيدة',
  fal_license: off.data.fal_license,
  baths: 2, furnished: false, kitchen: true, ac: true, parking: 2,
  description: 'إعلان فحص النشر', images: [],
}).select('id,status,fal_license,kitchen,ac,parking,furnished,baths').single();
check(!ins.error, 'النشر نجح بلا خطأ أعمدة' + (ins.error ? ` — ${ins.error.code} ${ins.error.message}` : ''));
if (ins.data) {
  const l = ins.data;
  check(l.status === 'approved', `مكتب موثّق ⇒ اعتماد فوري (status=${l.status})`);
  check(l.fal_license === '1100777888', `الرخصة انتقلت تلقائياً من سجل المكتب (${l.fal_license})`);
  check(l.kitchen === true && l.ac === true && l.parking === 2 && l.furnished === false && l.baths === 2,
    `الخصائص حُفظت (kitchen=${l.kitchen} ac=${l.ac} parking=${l.parking} furnished=${l.furnished} baths=${l.baths})`);
  const seen = await anon.from('listings').select('id,kitchen,ac,parking').eq('id', l.id);
  check(!seen.error && seen.data.length === 1, 'الإعلان ظاهر للعامة فوراً بخصائصه');
  // تنظيف
  await adm.from('listings').delete().eq('id', l.id);
}
await adm.from('offices').delete().eq('id', off.data.id);
console.log(`تنظيف: حُذف الإعلان والمكتب. (حساب الاختبار ${email} يبقى في Authentication→Users)`);

console.log('\n' + (allOk ? 'النتيجة: تدفّق النشر سليم كاملاً ✓' : 'النتيجة: خلل — راجع أعلاه ✗'));
process.exit(allOk ? 0 : 1);
