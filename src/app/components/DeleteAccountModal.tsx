'use client';
// ════════════════════════════════════════════════════════════
//  حذف الحساب الذاتي (متطلب Google Play) — نافذة تأكيد مشتركة.
//
//  تُستخدم في ثلاثة مواضع: بطاقة حساب الباحث (الصفحة الرئيسية)، إعدادات لوحة
//  المكتب، وصفحة /delete-account العامة. مكتفية بذاتها: تستدعي عميل المتصفح
//  المفرد (createClient) مباشرةً فلا تمسّ منطق المصادقة/الجلسة (useAuth) إطلاقاً.
//
//  التدفّق عند التأكيد:
//   1) المستخدم يكتب كلمة التأكيد («حذف» / «DELETE») لتفعيل الزر الأحمر — لا حذف عرضي.
//   2) (مكتب) حذف صور إعلاناته عبر Storage API قبل الـ RPC (Supabase يمنع حذف
//      storage.objects عبر SQL) — أفضل جهد، لا يُفشل الحذف إن تعذّر.
//   3) استدعاء RPC ‹delete_own_account› (SECURITY DEFINER، مقيّدة بـ auth.uid()
//      ⇒ يحذف المستخدم حسابه هو فقط؛ المدراء مرفوضون من القاعدة).
//   4) تسجيل الخروج (الصف محذوف) ثم تحويل صلب إلى «/» بحالة خارج تماماً.
// ════════════════════════════════════════════════════════════
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';

export default function DeleteAccountModal({
  open,
  onClose,
  isOffice,
  officeId,
}: {
  open: boolean;
  onClose: () => void;
  isOffice: boolean;
  officeId: string | null;
}) {
  const { t, dir } = useLang();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const confirmWord = t('del.confirmWord');
  const canDelete = confirmText.trim() === confirmWord && !busy;

  const doDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    setErr(null);
    const sb = createClient();

    // (مكتب) حذف صور الإعلانات عبر Storage API — أفضل جهد (لا يحجب الحذف)
    if (isOffice && officeId) {
      try {
        const { data: files } = await sb.storage.from('listings').list(officeId, { limit: 1000 });
        if (files && files.length) {
          await sb.storage.from('listings').remove(files.map((f) => `${officeId}/${f.name}`));
        }
      } catch {
        /* تجاهل: لا نُفشل حذف الحساب بسبب تعذّر حذف صورة */
      }
    }

    const { error } = await sb.rpc('delete_own_account');
    if (error) {
      setErr(/admin/i.test(error.message) ? t('del.adminErr') : t('del.failErr'));
      setBusy(false);
      return;
    }

    try {
      await sb.auth.signOut();
    } catch {
      /* الصف محذوف — تجاهل خطأ الخروج */
    }
    setDone(true);
    setTimeout(() => {
      if (typeof window !== 'undefined') window.location.href = '/';
    }, 2200);
  };

  return (
    <div
      className="fixed inset-0 z-[7000] bg-black/55 flex items-center justify-center p-4"
      dir={dir}
      onClick={() => { if (!busy && !done) onClose(); }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-2">
            <div className="text-lg font-bold text-gray-900 mb-2">{t('del.doneTitle')}</div>
            <p className="text-sm text-gray-600 leading-relaxed">{t('del.doneBody')}</p>
          </div>
        ) : (
          <>
            <div className="text-lg font-bold text-red-700 mb-2">{t('del.title')}</div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">{t('del.permanent')}</p>
            <ul className={`text-sm text-gray-700 mb-4 space-y-1 ${dir === 'rtl' ? 'pr-5' : 'pl-5'} list-disc`}>
              {(isOffice
                ? ['del.itemOffice1', 'del.itemOffice2', 'del.itemOffice3']
                : ['del.itemSeeker1', 'del.itemSeeker2']
              ).map((k) => (
                <li key={k}>{t(k)}</li>
              ))}
            </ul>
            <label className="text-xs font-semibold text-gray-700 block mb-1">{t('del.typeToConfirm')}</label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmWord}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm mb-3 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-3 leading-relaxed">{err}</div>}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
              >
                {t('del.cancel')}
              </button>
              <button
                onClick={doDelete}
                disabled={!canDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold shadow hover:bg-red-700 disabled:opacity-40"
              >
                {busy ? t('del.processing') : t('del.confirmBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
