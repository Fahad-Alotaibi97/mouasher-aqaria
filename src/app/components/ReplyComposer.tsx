'use client';
// ════════════════════════════════════════════════════════════
//  منشئ الرد داخل المنصة (المرحلة 1) — اكتب الرد هنا، يُسلَّم عبر واتساب.
//  زر «رد» يفتح محرّراً صغيراً (textarea)؛ عند الإرسال يفتح واتساب للمستلم
//  برقمه المطبّع ونصّ ردّك مُعبّأ مسبقاً: wa.me/<رقم>?text=<النص>.
//  لا صندوق وارد داخل المنصة ولا محادثة مخزّنة ولا إشعارات في هذه المرحلة —
//  مجرّد: إنشاء داخل المنصة ⇒ تسليم عبر واتساب بضغطة واحدة.
//
//  TODO (مرحلة لاحقة): إن كان المُرسِل مستخدماً مسجّلاً، خزّن نسخة من الرد
//  أيضاً في صندوق «رسائلي» داخل المنصة هنا (مثلاً insert into messages ثم
//  إشعار) — مكان الإضافة: داخل send() بعد بناء الرابط وقبل/بعد فتح واتساب.
//  لا تُبنى الآن.
// ════════════════════════════════════════════════════════════
import { useState } from 'react';
import { waLink, waNumber } from './ContactButtons';

// phone = رقم المستلم (الباحث في استفسارات العملاء، أو المكتب إن توفّر رقمه).
// onSent = نداء اختياري بعد فتح واتساب (مثلاً تعليم الرسالة كمعالَجة لمن يملك صلاحية ذلك).
export default function ReplyComposer({ phone, onSent }: { phone?: string | null; onSent?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  // لا رقم واتساب صالح للمستلم ⇒ لا زر رد (تبقى أزرار الاتصال/الإيميل القائمة).
  if (!waNumber(phone)) return null;

  const send = () => {
    const url = waLink(phone, text);
    if (!url) return; // نصّ فارغ أو رقم غير صالح
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
    onSent?.();
    setText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs bg-[#0A3D62] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-[#0c4a78] transition-colors">
        رد
      </button>
    );
  }

  // محرّر بعرض كامل (يلتفّ لسطره داخل صف الأزرار flex-wrap)
  return (
    <div className="w-full mt-1 bg-[#f7fafd] border border-[#dde5ee] rounded-xl p-3">
      <div className="text-xs font-bold text-[#0A3D62] mb-1.5">الرد على المرسل (يُرسَل عبر واتساب)</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        rows={3}
        dir="rtl"
        placeholder="اكتب ردّك هنا بالعربية…"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none placeholder-gray-400"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={send} disabled={!text.trim()}
          className="text-xs bg-green-600 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50">
          إرسال عبر واتساب
        </button>
        <button onClick={() => { setOpen(false); setText(''); }}
          className="text-xs bg-white border border-[#cfd9e4] text-[#33414f] px-4 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] transition-colors">
          إلغاء
        </button>
      </div>
    </div>
  );
}
