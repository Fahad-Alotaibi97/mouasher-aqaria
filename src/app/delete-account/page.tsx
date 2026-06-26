'use client';
// ════════════════════════════════════════════════════════════
//  صفحة عامة لحذف الحساب — /delete-account
//
//  متطلب Google Play: رابط عام يشرح كيف يحذف المستخدم حسابه وبياناته
//  دون تثبيت التطبيق. تطبيق أندرويد (Capacitor) يحمّل الموقع الحيّ، فهذا
//  الرابط نفسه يصلح كـ«رابط حذف البيانات» في Play Console.
//
//   • مستخدم مسجّل ⇒ يحذف حسابه مباشرة بنفس نافذة التأكيد المشتركة.
//   • زائر غير مسجّل ⇒ تعليمات: سجّل الدخول ثم احذف، أو راسل الدعم بطلب حذف.
// ════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { useLang } from '@/lib/i18n';
import { SiteHeader, SiteFooter } from '../components/SiteChrome';
import DeleteAccountModal from '../components/DeleteAccountModal';

const SUPPORT_EMAIL = 'faud969@gmail.com';

export default function DeleteAccountPage() {
  const { t, dir } = useLang();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [isOffice, setIsOffice] = useState(false);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      if (cancelled) return;
      if (!u) { setChecking(false); return; }
      setEmail(u.email ?? null);
      const { data: offs } = await sb.from('offices').select('id').eq('owner_id', u.id).limit(1);
      if (cancelled) return;
      if (offs && offs.length) { setIsOffice(true); setOfficeId(offs[0].id as string); }
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div dir={dir} className="min-h-screen site flex flex-col">
      <SiteHeader />

      <div className="flex-1 flex items-start justify-center px-5 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h1 className="font-bold text-lg text-[#0A3D62] mb-2">{t('delpage.title')}</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('delpage.intro')}</p>

          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
            <div className="font-bold text-sm text-gray-900 mb-1">{t('delpage.whatTitle')}</div>
            <p className="text-sm text-gray-600 leading-relaxed">{t('delpage.whatBody')}</p>
          </div>

          {checking ? (
            <p className="text-sm text-gray-500 py-4 text-center">{t('delpage.checking')}</p>
          ) : email ? (
            <div>
              <div className="text-sm text-gray-700 mb-3">
                {t('delpage.loggedInAs')} <span dir="ltr" className="font-bold text-gray-900">{email}</span>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold shadow hover:bg-red-700"
              >
                {t('delpage.deleteNow')}
              </button>
            </div>
          ) : (
            <div>
              <div className="font-bold text-sm text-gray-900 mb-1">{t('delpage.signedOutTitle')}</div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{t('delpage.signedOutBody')}</p>
              <a
                href="/#pricing"
                className="block text-center w-full bg-gradient-to-l from-[#0A3D62] to-[#1B6CA8] text-white py-2.5 rounded-xl font-bold text-sm shadow mb-3"
              >
                {t('delpage.signInCta')}
              </a>
              <div className="text-xs text-gray-500">
                {t('delpage.emailLabel')}{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="font-bold text-[#1B6CA8] hover:underline">{SUPPORT_EMAIL}</a>
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteAccountModal open={modalOpen} onClose={() => setModalOpen(false)} isOffice={isOffice} officeId={officeId} />

      <SiteFooter />
    </div>
  );
}
