// تحقّق من رسائل الدعم والاستفسارات — بعد تشغيل supabase/leads_support.sql
// التشغيل:  node _support_check.mjs                 ⇒ فحص عمود kind فقط (بلا أي كتابة)
//           node _support_check.mjs "<admin-pass>"  ⇒ السيناريو الكامل: دعم مكتب + استفسار عميل + قراءة المدير
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const URL_ = g('NEXT_PUBLIC_SUPABASE_URL'), KEY = g('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const PASS = process.argv[2] || process.env.ADMIN_PASS;
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false } });
let allOk = true;
const check = (ok, msg) => { if (!ok) allOk = false; console.log(`${ok ? 'PASS ✓' : 'FAIL ✗'}: ${msg}`); };

const anon = mk();

// 1) عمود kind موجود
const kc = await anon.from('leads').select('kind').limit(1);
check(!kc.error, 'عمود kind موجود في leads' + (kc.error ? ` — ${kc.error.code}` : ''));

if (!PASS) {
  console.log('\n(للسيناريو الكامل — دعم + استفسار + قراءة المدير:  node _support_check.mjs "<admin-password>")');
  console.log(allOk ? 'النتيجة: العمود جاهز ✓' : 'النتيجة: شغّل supabase/leads_support.sql أولاً ✗');
  process.exit(allOk ? 0 : 1);
}

// 2) مكتب اختبار يرسل رسالة دعم للمنصة
const owner = mk();
const email = `supcheck_${Math.floor(Math.random() * 1e9)}@example.com`;
const su = await owner.auth.signUp({ email, password: 'TestPass123!@#' });
const off = await owner.from('offices').insert({ name: '__supcheck_office__', owner_id: su.data.user.id, fal_license: '1100555444' }).select('id,name,fal_license').single();
if (off.error) { console.log('إنشاء المكتب فشل: ' + off.error.message); process.exit(1); }

const sup = await owner.from('leads').insert({
  kind: 'support', office_id: off.data.id, name: `مكتب: ${off.data.name}`, phone: email,
  message: `الموضوع: فحص قناة الدعم\nرسالة تجريبية من فحص آلي.\nالبريد: ${email} · رخصة فال: ${off.data.fal_license}`,
}).select('id,kind').single();
check(!sup.error && sup.data?.kind === 'support', 'المكتب أرسل رسالة دعم (kind=support)' + (sup.error ? ` — ${sup.error.code} ${sup.error.message}` : ''));

// 3) زائر يرسل استفساراً عادياً مربوطاً بالمكتب (نموذج «تواصل بخصوص هذا الإعلان»)
const inq = await anon.from('leads').insert({
  name: 'باحث فحص', phone: '0500000777', message: 'استفسار تجريبي من فحص آلي', office_id: off.data.id,
}).select('id,kind').single();
check(!inq.error && inq.data?.kind === 'inquiry', 'الزائر أرسل استفساراً (kind الافتراضي inquiry)' + (inq.error ? ` — ${inq.error.code} ${inq.error.message}` : ''));

// 4) المكتب يرى استفسار عميله (أساس شارة العدد الحقيقي) — والتطبيق يستبعد رسائل الدعم من القائمة
const mine = await owner.from('leads').select('id,kind,handled').eq('office_id', off.data.id);
const customer = (mine.data ?? []).filter((l) => l.kind !== 'support');
const unhandled = customer.filter((l) => !l.handled).length;
check(!mine.error && customer.some((l) => l.id === inq.data?.id), `المكتب يرى استفسار عميله (عدد غير المعالَج = ${unhandled} — هذا ما تعرضه الشارة)`);

// 5) المدير يرى الرسالتين ويميّز الدعم عن الاستفسار
const adm = mk();
const al = await adm.auth.signInWithPassword({ email: 'faud969@gmail.com', password: PASS });
if (al.error) { console.log('دخول المدير فشل: ' + al.error.message); process.exit(1); }
const all = await adm.from('leads').select('id,kind,name').in('id', [sup.data?.id, inq.data?.id].filter(Boolean));
const sawSup = (all.data ?? []).some((l) => l.id === sup.data?.id && l.kind === 'support');
const sawInq = (all.data ?? []).some((l) => l.id === inq.data?.id && l.kind === 'inquiry');
check(!all.error && sawSup, 'المدير يرى رسالة الدعم مميَّزة (kind=support ⇒ تبويب «رسائل المكاتب»)');
check(!all.error && sawInq, 'المدير يرى استفسار العميل (kind=inquiry ⇒ تبويب «استفسارات العملاء»)');

// 6) تنظيف: لا سياسة حذف على leads (مقصود) ⇒ نعلّم رسائل الفحص كمعالَجة
for (const id of [sup.data?.id, inq.data?.id].filter(Boolean)) await adm.from('leads').update({ handled: true }).eq('id', id);
await owner.from('offices').delete().eq('id', off.data.id);
console.log(`تنظيف: حُذف المكتب وعُلّمت رسالتا الفحص كمعالَجتين (تبقيان في الجدول — لا حذف للرسائل عمداً). حساب ${email} يبقى في Authentication→Users.`);

console.log('\n' + (allOk ? 'النتيجة: قناة الدعم والاستفسارات تعمل end-to-end ✓' : 'النتيجة: خلل — راجع أعلاه ✗'));
process.exit(allOk ? 0 : 1);
