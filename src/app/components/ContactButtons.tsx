'use client';
// ════════════════════════════════════════════════════════════
//  أزرار الرد المباشر (واتساب / اتصال / إيميل) — روابط wa.me / tel: / mailto:
//  تفتح تطبيق المستخدم نفسه من بيانات التواصل المحفوظة أصلاً في صف الرسالة.
//  لا مراسلة داخل المنصة ولا إرسال بيانات لأي طرف ثالث.
//  ملاحظة مخطط: رسائل دعم المكاتب تحفظ «بريد الحساب» في حقل phone نفسه،
//  لذا الكاشفان أدناه يميّزان تلقائياً: إيميل ⇒ زر إيميل، رقم ⇒ واتساب/اتصال.
// ════════════════════════════════════════════════════════════

// تحويل الأرقام العربية (٠-٩) إلى لاتينية ثم تجريد كل ما عدا الأرقام و+
function digitsOf(raw: string): string {
  const east = '٠١٢٣٤٥٦٧٨٩';
  let s = '';
  for (const ch of raw) {
    const i = east.indexOf(ch);
    s += i >= 0 ? String(i) : ch;
  }
  return s.replace(/[^\d+]/g, '');
}

// تطبيع رقم سعودي لرابط واتساب: 05XXXXXXXX → 9665XXXXXXXX (مع قبول الصيغ الدولية)
export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = digitsOf(raw);
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) return '966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) return '966' + d;
  if (/^9665\d{8}$/.test(d)) return d;
  if (/^\d{8,15}$/.test(d)) return d; // رقم دولي آخر — يُمرَّر كما هو
  return null;
}

// رقم صالح للاتصال tel: (7 أرقام فأكثر)
export function telNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = digitsOf(raw);
  return d.replace('+', '').length >= 7 ? d : null;
}

// هل النص إيميل كامل؟
export function emailAddr(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? t : null;
}

// استخراج إيميل من نص حر (رسائل الدعم ترفق «البريد: x@y.z» داخل الرسالة)
export function emailInText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/[^\s@·,;()<>]+@[^\s@·,;()<>]+\.[^\s@·,;()<>]{2,}/);
  return m ? m[0] : null;
}

// رابط واتساب مع نصّ ردّ مُعبّأ: wa.me/<رقم مطبّع>?text=<نص مُرمّز URL>.
// النص العربي يُرمّز عبر encodeURIComponent (UTF-8 بنسبة مئوية) ويفكّه واتساب سليماً.
// يُرجع null إن لم يكن للمستلم رقم واتساب صالح (مثلاً حقل التواصل إيميل في رسائل الدعم).
// تُستخدم في ReplyComposer — تبقى هنا لتُختبر كدالة نقية (الكود المُختبَر = الكود المشحون).
export function waLink(phone: string | null | undefined, text?: string | null): string | null {
  const wa = waNumber(phone);
  if (!wa) return null;
  const t = (text ?? '').trim();
  return t ? `https://wa.me/${wa}?text=${encodeURIComponent(t)}` : `https://wa.me/${wa}`;
}

// contact = حقل التواصل في الصف (رقم جوال، أو إيميل في رسائل الدعم).
// email = إيميل إضافي اختياري (مثلاً مستخرج من نص الرسالة) — زر «إيميل» يظهر لأيّهما وُجد.
// كل زر يظهر فقط إن توفّرت بياناته؛ بلا أي بيانات ⇒ لا شيء يُعرض.
export default function ContactButtons({ contact, email }: { contact?: string | null; email?: string | null }) {
  const contactIsEmail = emailAddr(contact);
  const mail = contactIsEmail ?? emailAddr(email) ?? emailInText(email);
  const wa = contactIsEmail ? null : waNumber(contact);
  const tel = contactIsEmail ? null : telNumber(contact);
  if (!wa && !tel && !mail) return null;
  return (
    <>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"
          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 transition-colors">
          واتساب
        </a>
      )}
      {tel && (
        <a href={`tel:${tel}`}
          className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] transition-colors">
          اتصال
        </a>
      )}
      {mail && (
        <a href={`mailto:${mail}`}
          className="text-xs bg-blue-50 border border-blue-200 text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-colors">
          إيميل
        </a>
      )}
    </>
  );
}
