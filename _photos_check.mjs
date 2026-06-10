// تحقّق من صور الإعلانات: سياسات التخزين + العمود المصنّف — بعد تشغيل supabase/storage_listing_images.sql
// التشغيل:  node _photos_check.mjs                 ⇒ رفع/قراءة/حذف فعلي في storage + فحص العمود (بلا صلاحيات إدارية)
//           node _photos_check.mjs "<admin-pass>"  ⇒ إضافةً لذلك: نشر إعلان كامل بصور مصنّفة من مكتب موثّق
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const URL_ = g('NEXT_PUBLIC_SUPABASE_URL'), KEY = g('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const PASS = process.argv[2] || process.env.ADMIN_PASS;
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false } });
let allOk = true;
const check = (ok, msg) => { if (!ok) allOk = false; console.log(`${ok ? 'PASS ✓' : 'FAIL ✗'}: ${msg}`); };
// PNG 1×1 صالح — لرفع حقيقي
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const anon = mk();

// 1) عمود التصنيف موجود
let r = await anon.from('listings').select('images_by_category').limit(1);
check(!r.error, 'عمود images_by_category موجود' + (r.error ? ` — ${r.error.code}` : ''));

// 2) الرفع كمستخدم مسجّل (مسار المكتب) يعمل فعلاً
const sb = mk();
const email = `photocheck_${Math.floor(Math.random() * 1e9)}@example.com`;
const su = await sb.auth.signUp({ email, password: 'TestPass123!@#' });
const path = `photocheck/${Math.floor(Math.random() * 1e9)}_facade.png`;
const up = await sb.storage.from('listings').upload(path, PNG, { contentType: 'image/png' });
check(!up.error, 'رفع صورة إلى bucket «listings» (authenticated)' + (up.error ? ` — ${up.error.message}` : ''));

// 3) الرابط العام يُفتح فعلاً (HTTP 200) — يثبت أن الـ bucket عام
let publicUrl = null;
if (!up.error) {
  publicUrl = sb.storage.from('listings').getPublicUrl(path).data.publicUrl;
  const resp = await fetch(publicUrl);
  check(resp.ok, `الرابط العام للصورة يعمل (HTTP ${resp.status})`);
}

// 4) صاحب الملف يحذفه (تنظيف + يثبت سياسة الحذف الذاتي)
if (!up.error) {
  const del = await sb.storage.from('listings').remove([path]);
  const gone = publicUrl ? !(await fetch(publicUrl)).ok : true;
  check(!del.error && gone, 'حذف الملف الذاتي يعمل (نُظّف ملف الفحص)');
}

if (!PASS) {
  console.log(`\n(حساب الفحص ${email} يبقى في Authentication→Users)`);
  console.log('(للنشر الكامل بصور مصنّفة من مكتب موثّق:  node _photos_check.mjs "<admin-password>")');
  console.log(allOk ? '\nالنتيجة: التخزين والعمود جاهزان ✓' : '\nالنتيجة: شغّل supabase/storage_listing_images.sql أولاً ✗');
  process.exit(allOk ? 0 : 1);
}

// 5) نشر كامل بصور مصنّفة من مكتب موثّق
const adm = mk();
const al = await adm.auth.signInWithPassword({ email: 'faud969@gmail.com', password: PASS });
if (al.error) { console.log('دخول المدير فشل: ' + al.error.message); process.exit(1); }
const off = await sb.from('offices').insert({ name: '__photocheck_office__', owner_id: su.data.user.id, fal_license: '1100999000' }).select('id,fal_license').single();
await adm.from('offices').update({ status: 'approved', active: true, verified: true }).eq('id', off.data.id);

// رفع 3 صور مصنّفة (واجهة + صالة + غرفة نوم) كما يفعل المعالج
const urls = {};
for (const k of ['facade', 'hall', 'bed0']) {
  const p = `${off.data.id}/${Math.floor(Math.random() * 1e9)}_${k}.png`;
  const u = await sb.storage.from('listings').upload(p, PNG, { contentType: 'image/png' });
  if (!u.error) urls[k] = sb.storage.from('listings').getPublicUrl(p).data.publicUrl;
}
const byCat = { facade: urls.facade ?? null, hall: urls.hall ?? null, majlis: null, kitchen: null, bedrooms: urls.bed0 ? [urls.bed0] : [], bathrooms: [] };
const ins = await sb.from('listings').insert({
  office_id: off.data.id, title: 'شقة 2 غرف — النرجس (فحص صور)', hood: 'النرجس', type: 'شقة',
  advertised: 43210, rooms: 2, baths: 1, condition: 'good', cond_label: 'حالة جيدة',
  fal_license: off.data.fal_license, images: Object.values(urls), images_by_category: byCat,
}).select('id,status,images,images_by_category').single();
check(!ins.error, 'نشر إعلان بصور مصنّفة' + (ins.error ? ` — ${ins.error.message}` : ''));
if (ins.data) {
  const cat = ins.data.images_by_category;
  check(cat?.facade === urls.facade && cat?.bedrooms?.length === 1, 'JSONB حُفظ بفئاته (واجهة + غرفة نوم)');
  const seen = await anon.from('listings').select('id,images,images_by_category').eq('id', ins.data.id).single();
  check(!seen.error && seen.data?.images_by_category?.facade === urls.facade, 'الزائر يرى الإعلان وصوره المصنّفة (الواجهة أساسية)');
  // تنظيف
  await adm.from('listings').delete().eq('id', ins.data.id);
  await sb.storage.from('listings').remove(Object.keys(urls).map((k) => new URL(urls[k]).pathname.split('/object/public/listings/')[1]));
}
await adm.from('offices').delete().eq('id', off.data.id);
console.log(`تنظيف: حُذف الإعلان والمكتب والصور. (حساب الفحص ${email} يبقى في Authentication→Users)`);

console.log('\n' + (allOk ? 'النتيجة: الصور المصنّفة تعمل end-to-end ✓' : 'النتيجة: خلل — راجع أعلاه ✗'));
process.exit(allOk ? 0 : 1);
