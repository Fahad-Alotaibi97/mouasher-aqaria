// تحقّق من قفل كتابة متوسطات الأحياء بعد تشغيل supabase/lock_neighborhoods_write.sql.
// التشغيل:  node _pricelock_check.mjs                 ⇒ يفحص القراءة العامة + حجب كتابة anon
//           node _pricelock_check.mjs "<admin-pass>"  ⇒ يفحص أيضاً أن كتابة المدير تعمل
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const URL = g('NEXT_PUBLIC_SUPABASE_URL'), KEY = g('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const PASS = process.argv[2] || process.env.ADMIN_PASS;
let allOk = true;
const check = (ok, msg) => { if (!ok) allOk = false; console.log(`${ok ? 'PASS ✓' : 'FAIL ✗'}: ${msg}`); };

const anon = createClient(URL, KEY, { auth: { persistSession: false } });

// 1) القراءة العامة تعمل (المؤشر والحاسبة)
const r = await anon.from('neighborhoods').select('id,name,avg_rent').order('id').limit(3);
check(!r.error && (r.data?.length ?? 0) > 0, `قراءة anon للمتوسطات (${r.data?.length ?? 0} صفوف)` + (r.error ? ' — ' + r.error.message : ''));
const probe = r.data?.[0];

// 2) إدراج anon محجوب (42501)
const ins = await anon.from('neighborhoods').insert({ name: '___pricelock_probe___', avg_rent: 1 }).select('id').single();
check(!!ins.error && ins.error.code === '42501', `إدراج anon محجوب (${ins.error?.code ?? 'نجح!! — الثغرة ما زالت مفتوحة'})`);
if (ins.data?.id) { await anon.from('neighborhoods').delete().eq('id', ins.data.id); console.log('   (حُذف صف الاختبار)'); }

// 3) تعديل anon لا يغيّر شيئاً (RLS يخفي الصفوف عن UPDATE ⇒ 0 صفوف، والقيمة لا تتغير)
if (probe) {
  const up = await anon.from('neighborhoods').update({ avg_rent: probe.avg_rent + 1 }).eq('id', probe.id).select('id');
  const back = await anon.from('neighborhoods').select('avg_rent').eq('id', probe.id).single();
  const unchanged = (up.data?.length ?? 0) === 0 && back.data?.avg_rent === probe.avg_rent;
  check(unchanged, `تعديل anon بلا أثر (صفوف معدّلة: ${up.data?.length ?? 0}، القيمة بعد المحاولة: ${back.data?.avg_rent} مقابل الأصلية ${probe.avg_rent})`);
  if (back.data?.avg_rent !== probe.avg_rent) {
    // الثغرة ما زالت مفتوحة — أعد القيمة الأصلية فوراً حتى لا يفسد الفحص البيانات
    await anon.from('neighborhoods').update({ avg_rent: probe.avg_rent }).eq('id', probe.id);
    console.log('   (أُعيدت القيمة الأصلية)');
  }
}

// 4) (اختياري) كتابة المدير تعمل — تعديل لا يغيّر القيمة فعلياً (يكتب نفس القيمة)
if (PASS) {
  const adm = createClient(URL, KEY, { auth: { persistSession: false } });
  const a = await adm.auth.signInWithPassword({ email: 'faud969@gmail.com', password: PASS });
  if (a.error) { check(false, 'دخول المدير: ' + a.error.message); }
  else if (probe) {
    const up = await adm.from('neighborhoods').update({ avg_rent: probe.avg_rent }).eq('id', probe.id).select('id');
    check(!up.error && (up.data?.length ?? 0) === 1, `كتابة المدير تعمل (صفوف معدّلة: ${up.data?.length ?? 0})` + (up.error ? ' — ' + up.error.message : ''));
  }
} else {
  console.log('(لفحص كتابة المدير أيضاً:  node _pricelock_check.mjs "<admin-password>")');
}

console.log('\n' + (allOk ? 'النتيجة: القفل يعمل ✓' : 'النتيجة: خلل — راجع أعلاه ✗'));
process.exit(allOk ? 0 : 1);
