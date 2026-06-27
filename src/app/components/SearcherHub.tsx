'use client';
// ════════════════════════════════════════════════════════════
//  لوحة حساب الباحث (المرحلة 1) — تبويبان:
//   • استفساراتي + ردود المكاتب (B-1) — يقرأ استفسارات الباحث (leads.user_id)
//     وخيوط الردود (lead_replies)، ويسمح بالرد داخل المنصة (محادثة ثنائية).
//   • الإشعارات (B-2) — إشعارات داخل التطبيق (رد مكتب / تطابق رغبة)، تعليم مقروء.
//
//  مكتفٍ بذاته: createClient + useLang. كل بيانات الباحث خاصّة به عبر RLS
//  (leads_client_read / lead_replies_client_* / notifications_owner_*).
//  تدرّج آمن: إن غابت الجداول/السياسات (قبل searcher_part1.sql) تُعرَض حالات
//  فارغة صادقة بلا كسر. لا أرقام/إشعارات مُفبركة.
// ════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';
import type { UIListing } from '@/lib/useAppData';
import PlatformReplyComposer from './PlatformReplyComposer';

interface Lead { id: string; message: string | null; created_at: string; office_id: string | null }
interface Reply { id: string; lead_id: string; sender: 'office' | 'client'; body: string; created_at: string }
interface Notif { id: string; type: string; lead_id: string | null; listing_id: string | null; body: string | null; read: boolean; created_at: string }
interface Wish { id: number; neighborhood: string | null; type: string | null; max_price: number | null; raw_query: string | null; created_at: string }

type HubTab = 'inquiries' | 'notifications' | 'favorites' | 'wishes';

export default function SearcherHub({ userId, onUnreadChange, listings, favIds, onToggleFav, onOpenListing }: {
  userId: string;
  onUnreadChange?: (n: number) => void;
  listings?: UIListing[];
  favIds?: Set<string>;
  onToggleFav?: (id: string | number) => void;
  onOpenListing?: (l: UIListing) => void;
}) {
  const { t, lang, dir } = useLang();
  const [tab, setTab] = useState<HubTab>('inquiries');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const nf = (n: number) => n.toLocaleString('en-US');

  const fmtDate = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    // استفسارات الباحث (تتطلب leads_client_read؛ قبلها تُرجع [] بلا خطأ)
    let lds: Lead[] = [];
    try {
      const { data } = await sb.from('leads').select('id,message,created_at,office_id').eq('user_id', userId).order('created_at', { ascending: false });
      lds = (data ?? []) as Lead[];
    } catch { /* تجاهل */ }
    // خيوط الردود (تُتجاهل بأمان إن غاب الجدول)
    const repMap: Record<string, Reply[]> = {};
    if (lds.length) {
      try {
        const ids = lds.map((l) => l.id);
        const { data } = await sb.from('lead_replies').select('id,lead_id,sender,body,created_at').in('lead_id', ids).order('created_at', { ascending: true });
        for (const r of (data ?? []) as Reply[]) (repMap[r.lead_id] ||= []).push(r);
      } catch { /* تجاهل */ }
    }
    // الإشعارات
    let nfs: Notif[] = [];
    try {
      const { data } = await sb.from('notifications').select('id,type,lead_id,listing_id,body,read,created_at').order('created_at', { ascending: false }).limit(50);
      nfs = (data ?? []) as Notif[];
    } catch { /* تجاهل */ }
    // الرغبات/التنبيهات (owner-only RLS — تُرجع رغبات هذا الباحث فقط؛ [] إن غاب العمود قبل searcher_part2.sql)
    let wshs: Wish[] = [];
    try {
      const { data } = await sb.from('search_wishes').select('id,neighborhood,type,max_price,raw_query,created_at').order('created_at', { ascending: false }).limit(50);
      wshs = (data ?? []) as Wish[];
    } catch { /* تجاهل */ }
    setLeads(lds);
    setReplies(repMap);
    setNotifs(nfs);
    setWishes(wshs);
    setLoading(false);
    onUnreadChange?.(nfs.filter((n) => !n.read).length);
  }, [userId, onUnreadChange]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    const sb = createClient();
    try { await sb.from('notifications').update({ read: true }).eq('id', id); } catch { /* تجاهل */ }
    setNotifs((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      onUnreadChange?.(next.filter((n) => !n.read).length);
      return next;
    });
  };
  const markAllRead = async () => {
    const sb = createClient();
    try { await sb.from('notifications').update({ read: true }).eq('read', false); } catch { /* تجاهل */ }
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    onUnreadChange?.(0);
  };

  const deleteWish = async (id: number) => {
    const sb = createClient();
    try { await sb.from('search_wishes').delete().eq('id', id); } catch { /* تجاهل */ }
    setWishes((prev) => prev.filter((w) => w.id !== id));
  };

  const unread = notifs.filter((n) => !n.read).length;
  // الإعلانات المحفوظة الظاهرة الآن = المتاحة للعامة من قائمة الإعلانات مطابقةً للمعرّفات المحفوظة.
  const savedListings = (listings ?? []).filter((l) => favIds?.has(String(l.id)));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" dir={dir}>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{t('hub.title')}</h1>
      <p className="text-sm text-gray-500 mb-4">{t('hub.subtitle')}</p>

      {/* تبويبات — شريط قابل للتمرير أفقياً (يتّسع لمزيد من الأقسام في المرحلة B) */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 overflow-x-auto">
        {([
          ['inquiries', t('hub.tabInquiries')],
          ['notifications', t('hub.tabNotifications')],
          ['favorites', t('hub.tabFavorites')],
          ['wishes', t('hub.tabWishes')],
        ] as [HubTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap relative ${tab === id ? 'bg-white text-[#0A3D62] shadow' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
            {id === 'notifications' && unread > 0 && <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 ml-1 align-middle bg-red-500 text-white text-[10px] rounded-full">{unread}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">{t('hub.loading')}</div>
      ) : tab === 'inquiries' ? (
        leads.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">{t('hub.inqEmpty')}</div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => {
              const thread = replies[lead.id] ?? [];
              const replied = thread.some((r) => r.sender === 'office');
              return (
                <div key={lead.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border ${replied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {replied ? t('hub.statusReplied') : t('hub.statusAwaiting')}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(lead.created_at)}</span>
                  </div>
                  {lead.message && <div className="text-sm text-gray-700 whitespace-pre-line">{lead.message}</div>}

                  {thread.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {thread.map((r) => (
                        <div key={r.id} className={`flex ${r.sender === 'client' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${r.sender === 'office' ? 'bg-[#e6f1fb] text-[#0A3D62]' : 'bg-gray-100 text-gray-800'}`}>
                            <div className="text-[10px] font-bold opacity-70 mb-0.5">{r.sender === 'office' ? t('hub.officeLabel') : t('hub.youLabel')}</div>
                            <div className="whitespace-pre-line">{r.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <PlatformReplyComposer leadId={lead.id} sender="client" onSent={load} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'notifications' ? (
        notifs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">{t('hub.notifEmpty')}</div>
        ) : (
          <div>
            {unread > 0 && (
              <div className="flex justify-end mb-2">
                <button onClick={markAllRead} className="text-xs text-[#0A3D62] font-bold hover:underline">{t('hub.markAllRead')}</button>
              </div>
            )}
            <div className="space-y-2">
              {notifs.map((n) => (
                <button key={n.id} onClick={() => { if (!n.read) markRead(n.id); if (n.type === 'reply') setTab('inquiries'); }}
                  className={`w-full text-start rounded-xl border p-3 transition-colors ${n.read ? 'bg-white border-gray-200' : 'bg-[#f0f6fb] border-[#cfe0f0]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {n.type === 'reply' ? t('hub.notifReply') : t('hub.notifWishMatch')}
                      {!n.read && <span className="inline-block w-2 h-2 rounded-full bg-red-500 ml-1.5 align-middle" />}
                    </span>
                    <span className="text-[11px] text-gray-400">{fmtDate(n.created_at)}</span>
                  </div>
                  {n.body && <div className="text-xs text-gray-500 mt-1 whitespace-pre-line">{n.body}</div>}
                </button>
              ))}
            </div>
          </div>
        )
      ) : tab === 'favorites' ? (
        // ── المفضّلة ──
        savedListings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">{t('hub.favEmpty')}</div>
        ) : (
          <div className="space-y-3">
            {savedListings.map((l) => (
              <div key={String(l.id)} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                <button onClick={() => onOpenListing?.(l)} className="min-w-0 text-start flex-1">
                  <div className="font-bold text-sm text-gray-900 truncate">{l.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{l.type} · {l.hood}</div>
                  <div className="text-sm font-extrabold text-[#0A3D62] mt-1">{nf(l.adv)} <span className="text-[11px] font-medium text-gray-500">{t('card.perYearShort')}</span></div>
                </button>
                <button onClick={() => onToggleFav?.(l.id)} aria-label={t('hub.unsave')}
                  className="flex-shrink-0 text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                  {t('hub.unsave')}
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        // ── تنبيهات الطلبات (الرغبات) ──
        wishes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">{t('hub.wishEmpty')}</div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-1">{t('hub.wishHint')}</p>
            {wishes.map((w) => (
              <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm text-gray-700">
                  <div className="font-semibold text-gray-900">
                    {[w.type, w.neighborhood].filter(Boolean).join(' · ') || t('hub.wishAny')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {w.max_price ? `${t('hub.wishBudget')}: ${nf(w.max_price)} ${t('card.sar')}` : null}
                    {w.max_price ? ' · ' : ''}{fmtDate(w.created_at)}
                  </div>
                </div>
                <button onClick={() => deleteWish(w.id)} aria-label={t('hub.wishDelete')}
                  className="flex-shrink-0 text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                  {t('hub.wishDelete')}
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
