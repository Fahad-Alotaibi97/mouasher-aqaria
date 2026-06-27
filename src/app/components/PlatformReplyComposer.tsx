'use client';
// ════════════════════════════════════════════════════════════
//  منشئ الرد داخل المنصة (lead_replies) — مشترك بين المكتب والباحث.
//
//  المكتب يرد على استفسار موجّه لمكتبه (sender='office')، والباحث يرد على
//  استفساره هو (sender='client'). sender_id يُضبط افتراضياً auth.uid() في القاعدة،
//  وسياسات RLS تتحقّق من ملكية الخيط ⇒ لا أحد يكتب في خيط غيره.
//
//  تدرّج آمن: إن لم يوجد جدول lead_replies بعد (قبل تشغيل searcher_part1.sql)
//  نُظهر رسالة لطيفة بدل الكسر. واتساب يبقى خياراً مستقلاً (خارج هذا المكوّن).
// ════════════════════════════════════════════════════════════
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';

export default function PlatformReplyComposer({
  leadId,
  sender,
  onSent,
}: {
  leadId: string;
  sender: 'office' | 'client';
  onSent?: () => void;
}) {
  const { t, dir } = useLang();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr(null);
    const sb = createClient();
    // sender_id يأتي من default auth.uid() في القاعدة — لا نرسله من العميل
    const { error } = await sb.from('lead_replies').insert({ lead_id: leadId, sender, body });
    if (error) {
      setErr(
        error.code === 'PGRST205' || error.code === '42P01'
          ? t('reply.notReady')
          : t('reply.failed')
      );
      setBusy(false);
      return;
    }
    setText('');
    setBusy(false);
    setOpen(false);
    onSent?.();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-[#0F6E56] text-white px-3 py-1.5 rounded-lg font-bold hover:opacity-90 transition-opacity"
      >
        {t('reply.platformBtn')}
      </button>
    );
  }

  return (
    <div className="w-full mt-1 bg-[#f7fafd] border border-[#dde5ee] rounded-xl p-3" dir={dir}>
      <div className="text-xs font-bold text-[#0A3D62] mb-1.5">{t('reply.platformTitle')}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        rows={3}
        dir={dir}
        placeholder={t('reply.placeholder')}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none placeholder-gray-400"
      />
      {err && <div className="mt-2 text-xs text-red-600 leading-relaxed">{err}</div>}
      <div className="flex gap-2 mt-2">
        <button
          onClick={send}
          disabled={!text.trim() || busy}
          className="text-xs bg-[#0F6E56] text-white px-4 py-1.5 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy ? t('reply.sending') : t('reply.send')}
        </button>
        <button
          onClick={() => { setOpen(false); setText(''); setErr(null); }}
          className="text-xs bg-white border border-[#cfd9e4] text-[#33414f] px-4 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] transition-colors"
        >
          {t('reply.cancel')}
        </button>
      </div>
    </div>
  );
}
