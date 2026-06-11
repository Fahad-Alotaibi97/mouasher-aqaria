// حارس البناء: يمنع أي بناء (محلي أو على Vercel) إذا عادت ملفات قديمة محذوفة عمداً.
//
// السياق (2026-06-11): src/proxy.ts و src/app/auth حُذفا نهائياً لأنهما يكسران
// جلسة الأدمن والدخول الموحّد (middleware ينافس عميل المتصفح على تدوير الرمز،
// وauth/callback من نظام Magic Link المُزال). رغم ذلك عادا مرة عبر نسخ يدوي من
// نسخة قديمة للمشروع — هذا الحارس يجعل عودتهما تُفشل البناء فوراً بدل أن تكسر
// الإنتاج بصمت. يعمل تلقائياً قبل كل بناء (سكربت prebuild في package.json).
import { existsSync } from 'fs';

const BANNED = ['src/proxy.ts', 'src/app/auth'];
const found = BANNED.filter((p) => existsSync(p));

if (found.length) {
  console.error('');
  console.error('✖ أُوقف البناء: ملفات محظورة عادت للمشروع: ' + found.join(' ، '));
  console.error('  هذه الملفات محذوفة عمداً — وجودها يكسر جلسة الأدمن/الدخول الموحّد.');
  console.error('  احذفها ثم أعد البناء:');
  for (const p of found) console.error('    Remove-Item -Recurse -Force ' + p.replace(/\//g, '\\'));
  console.error('  (التفاصيل: ذاكرة المشروع 2026-06-11 — استرجاع ملفات من نسخة قديمة)');
  console.error('');
  process.exit(1);
}
