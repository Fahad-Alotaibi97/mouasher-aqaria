'use client';
// ════════════════════════════════════════════════════════════
//  أقسام لوحة /admin الجديدة (إحصائيات + إدارة الإعلانات/المكاتب/الرسائل).
//  كل قراءة/كتابة حقيقية عبر Supabase — لا بيانات وهمية، لا أزرار صورية.
//  محميّة بسياسات RLS (is_admin) ⇒ تتطلّب جلسة المدير الموحّدة (auth.uid()).
//  الأعمدة الجديدة (status/active/handled) تُضاف عبر supabase/admin_dashboard.sql.
// ════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── أدوات مشتركة ─────────────────────────────────────────────
interface PgErr { code?: string; message?: string }

function errHint(e: PgErr | null | undefined): string {
  if (!e) return '';
  if (e.code === '42703')
    return 'الأعمدة الجديدة غير موجودة بعد — شغّل ملف supabase/admin_dashboard.sql في Supabase ثم أعد المحاولة.';
  if (e.code === '42501' || /permission|policy|rls|denied/i.test(e.message || ''))
    return 'صلاحية مرفوضة — تأكّد من تسجيل الدخول بحساب المدير ومن تطبيق سياسات RLS (admin_dashboard.sql).';
  return e.message || 'حدث خطأ غير متوقع.';
}

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};
const fmtNum = (n: number) => n.toLocaleString('ar-SA');

const card = 'bg-white rounded-2xl border border-[#cfd9e4] shadow-sm';

function SectionHead({ title, subtitle, onRefresh }: { title: string; subtitle?: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div>
        <h2 className="text-xl font-bold text-[#0A3D62] sec-underline">{title}</h2>
        {subtitle && <p className="text-xs text-[#33414f] mt-2">{subtitle}</p>}
      </div>
      {onRefresh && (
        <button onClick={onRefresh} className="text-xs text-[#0A3D62] border border-[#cfd9e4] px-3 py-1.5 rounded-lg hover:bg-[#f0f4f8] transition-colors flex-shrink-0">
          تحديث
        </button>
      )}
    </div>
  );
}

function NeedSession() {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-5 text-sm leading-relaxed">
      <div className="font-bold mb-1">تتطلّب هذه الإدارة جلسة المدير</div>
      القراءة والكتابة هنا محميّتان بسياسات RLS (is_admin)، لذا تحتاج <b>تسجيل الدخول بحساب المدير</b> (الجلسة الموحّدة من
      الرئيسية) — لا تكفي بوّابة كلمة المرور وحدها لأنها لا تنشئ جلسة قاعدة بيانات.
      <div className="mt-3">
        <a href="/" className="text-[#0A3D62] font-bold underline">→ سجّل الدخول من الرئيسية بحساب المدير</a>
      </div>
    </div>
  );
}

function ErrBox({ e }: { e: PgErr }) {
  return <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-3">{errHint(e)}</div>;
}
function Empty({ text }: { text: string }) {
  return <div className={`${card} p-8 text-center text-[#33414f] text-sm`}>{text}</div>;
}
function Loading() {
  return <div className={`${card} p-8 text-center text-[#33414f] text-sm`}>جارٍ التحميل…</div>;
}

const statusMeta: Record<string, { cls: string; label: string }> = {
  approved: { cls: 'bg-green-100 text-green-800 border-green-200', label: 'معتمد' },
  rejected: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'مرفوض' },
  pending: { cls: 'bg-amber-100 text-amber-800 border-amber-200', label: 'بانتظار' },
};

// ════════════════════════════════════════════════════════════
//  2) لوحة الإحصائيات — أعداد حقيقية من COUNT على الجداول الفعلية
// ════════════════════════════════════════════════════════════
export function StatsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [stats, setStats] = useState<{ listings: number; offices: number; leads: number; leadsWeek: number } | null>(null);
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [l, o, ld, lw] = await Promise.all([
      sb.from('listings').select('id', { count: 'exact', head: true }),
      sb.from('offices').select('id', { count: 'exact', head: true }),
      sb.from('leads').select('id', { count: 'exact', head: true }),
      sb.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    ]);
    const firstErr = [l, o, ld, lw].find((r) => r.error)?.error;
    if (firstErr) setErr(firstErr);
    else setStats({ listings: l.count ?? 0, offices: o.count ?? 0, leads: ld.count ?? 0, leadsWeek: lw.count ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  if (!sessionAdmin) return <><SectionHead title="لوحة الإحصائيات" /><NeedSession /></>;

  const cards = stats ? [
    { label: 'إجمالي الإعلانات', val: stats.listings },
    { label: 'إجمالي المكاتب', val: stats.offices },
    { label: 'إجمالي الرسائل', val: stats.leads },
    { label: 'رسائل هذا الأسبوع', val: stats.leadsWeek },
  ] : [];

  return (
    <>
      <SectionHead title="لوحة الإحصائيات" subtitle="أعداد حقيقية محسوبة مباشرة من جداول القاعدة" onRefresh={load} />
      {err && <ErrBox e={err} />}
      {loading ? <Loading /> : !err && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.label} className={`${card} p-4`}>
                <div className="text-xs text-[#33414f] mb-2 font-medium">{c.label}</div>
                <div className="text-3xl font-extrabold text-[#0A3D62]">{fmtNum(c.val)}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#33414f] mt-4 leading-relaxed">
            ملاحظة: لا تُعرض بطاقة «مشاهدات الصفحات» لأنه لا يوجد مصدر تتبّع حقيقي للمشاهدات بعد — إضافتها تتطلّب جدول
            أحداث/زيارات فعلي. كل الأرقام أعلاه استعلامات COUNT حقيقية.
          </p>
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  3) إدارة الإعلانات — كل الإعلانات الحقيقية + إجراءات حقيقية
// ════════════════════════════════════════════════════════════
interface ListingRow {
  id: string; title: string; hood: string; type: string; advertised: number;
  status: string; active: boolean; office_id: string | null; created_at: string;
  rejection_note: string | null;
}
export function ListingsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [officeMap, setOfficeMap] = useState<Record<string, string>>({});
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; advertised: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const [lr, or_] = await Promise.all([
      sb.from('listings').select('id,title,hood,type,advertised,status,active,office_id,created_at,rejection_note').order('created_at', { ascending: false }),
      sb.from('offices').select('id,name'),
    ]);
    if (lr.error) { setErr(lr.error); setLoading(false); return; }
    const omap: Record<string, string> = {};
    ((or_.data ?? []) as { id: string; name: string }[]).forEach((o) => { omap[o.id] = o.name; });
    setOfficeMap(omap);
    setRows((lr.data ?? []) as ListingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  const patch = async (id: string, p: Partial<ListingRow>) => {
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('listings').update(p).eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };
  const remove = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('حذف هذا الإعلان نهائياً؟ لا يمكن التراجع.')) return;
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('listings').delete().eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };
  const saveEdit = async () => {
    if (!edit) return;
    const adv = parseInt(edit.advertised, 10);
    await patch(edit.id, { title: edit.title.trim(), advertised: Number.isNaN(adv) ? 0 : adv });
    setEdit(null);
  };
  const reject = (id: string) => {
    const note = typeof window !== 'undefined' ? window.prompt('سبب الرفض / ملاحظات تظهر للمكتب (اختياري):', '') : '';
    if (note === null) return; // ألغى المدير
    patch(id, { status: 'rejected', rejection_note: note.trim() || null });
  };

  if (!sessionAdmin) return <><SectionHead title="إدارة الإعلانات" /><NeedSession /></>;

  return (
    <>
      <SectionHead title="إدارة الإعلانات" subtitle="كل الإعلانات من جدول listings — اعتماد/رفض/تعديل/حذف (يظهر للعامة المعتمد فقط)" onRefresh={load} />
      {err && <ErrBox e={err} />}
      {loading ? <Loading /> : rows.length === 0 && !err ? (
        <Empty text="لا توجد إعلانات بعد — ستظهر هنا عندما تنشر المكاتب إعلاناتها." />
      ) : (
        <div className="space-y-3">
          {rows.map((l) => {
            const sm = statusMeta[l.status] ?? statusMeta.pending;
            const isEditing = edit?.id === l.id;
            return (
              <div key={l.id} className={`${card} p-4`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <input value={edit!.title} onChange={(e) => setEdit({ ...edit!, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#0f1a28] text-right" placeholder="عنوان الإعلان" />
                    <input value={edit!.advertised} onChange={(e) => setEdit({ ...edit!, advertised: e.target.value })} type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#0f1a28] text-right" placeholder="السعر السنوي" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={busy === l.id} className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">حفظ</button>
                      <button onClick={() => setEdit(null)} className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-xs">إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-[#0f1a28] text-sm truncate">{l.title}</div>
                        <div className="text-xs text-[#33414f] mt-0.5">
                          {l.type} · {l.hood} · {fmtNum(l.advertised)} ريال/سنة
                        </div>
                        <div className="text-xs text-[#33414f] mt-0.5">
                          المكتب: {l.office_id ? (officeMap[l.office_id] ?? '—') : '—'} · {fmtDate(l.created_at)}
                        </div>
                      </div>
                      <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border whitespace-nowrap ${sm.cls}`}>{sm.label}</span>
                    </div>
                    {l.status === 'rejected' && l.rejection_note && (
                      <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">
                        <strong>ملاحظات الرفض:</strong> {l.rejection_note}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#f0f4f8]">
                      {l.status !== 'approved' && (
                        <button onClick={() => patch(l.id, { status: 'approved', rejection_note: null })} disabled={busy === l.id}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">اعتماد</button>
                      )}
                      {l.status !== 'rejected' && (
                        <button onClick={() => reject(l.id)} disabled={busy === l.id}
                          className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-200 disabled:opacity-50">رفض بملاحظات</button>
                      )}
                      <button onClick={() => setEdit({ id: l.id, title: l.title, advertised: String(l.advertised) })} disabled={busy === l.id}
                        className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] disabled:opacity-50">تعديل</button>
                      <button onClick={() => remove(l.id)} disabled={busy === l.id}
                        className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50">حذف</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  4) إدارة المكاتب — مكاتب حقيقية + توثيق/إيقاف + عدد الإعلانات
// ════════════════════════════════════════════════════════════
interface OfficeRow { id: string; name: string; fal_license: string | null; verified: boolean; active: boolean; status: string; rejection_note: string | null; created_at: string }
interface MiniListing { id: string; title: string; status: string }
export function OfficesSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<OfficeRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandList, setExpandList] = useState<MiniListing[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const [or_, lr] = await Promise.all([
      sb.from('offices').select('id,name,fal_license,verified,active,status,rejection_note,created_at').order('created_at', { ascending: false }),
      sb.from('listings').select('office_id'),
    ]);
    if (or_.error) { setErr(or_.error); setLoading(false); return; }
    const c: Record<string, number> = {};
    ((lr.data ?? []) as { office_id: string | null }[]).forEach((r) => { if (r.office_id) c[r.office_id] = (c[r.office_id] ?? 0) + 1; });
    setCounts(c);
    setRows((or_.data ?? []) as OfficeRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  const patch = async (id: string, p: Partial<OfficeRow>) => {
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('offices').update(p).eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };
  const rejectOffice = (id: string) => {
    const note = typeof window !== 'undefined' ? window.prompt('سبب رفض المكتب / ملاحظات (اختياري):', '') : '';
    if (note === null) return;
    patch(id, { status: 'rejected', rejection_note: note.trim() || null });
  };
  const toggleListings = async (id: string) => {
    if (expanded === id) { setExpanded(null); setExpandList([]); return; }
    setExpanded(id);
    const sb = createClient();
    const { data } = await sb.from('listings').select('id,title,status').eq('office_id', id).order('created_at', { ascending: false });
    setExpandList((data ?? []) as MiniListing[]);
  };

  if (!sessionAdmin) return <><SectionHead title="إدارة المكاتب" /><NeedSession /></>;

  return (
    <>
      <SectionHead title="إدارة المكاتب" subtitle="المكاتب من جدول offices — توثيق/تفعيل/إيقاف وعرض إعلاناتها" onRefresh={load} />
      {err && <ErrBox e={err} />}
      {loading ? <Loading /> : rows.length === 0 && !err ? (
        <Empty text="لا توجد مكاتب مسجّلة بعد — ستظهر هنا عندما تسجّل المكاتب العقارية." />
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <div key={o.id} className={`${card} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[#0f1a28] text-sm flex items-center gap-2 flex-wrap">
                    {o.name}
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${(statusMeta[o.status] ?? statusMeta.pending).cls}`}>{(statusMeta[o.status] ?? statusMeta.pending).label}</span>
                    {o.verified && <span className="text-[10px] bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded">موثّق ✓</span>}
                    {!o.active && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded">موقوف</span>}
                  </div>
                  <div className="text-xs text-[#33414f] mt-0.5">رخصة فال: {o.fal_license || '—'} · {fmtDate(o.created_at)}</div>
                  <div className="text-xs text-[#33414f] mt-0.5">عدد الإعلانات: <b className="text-[#0f1a28]">{fmtNum(counts[o.id] ?? 0)}</b></div>
                  {o.status === 'rejected' && o.rejection_note && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg p-2 mt-1.5"><strong>ملاحظات الرفض:</strong> {o.rejection_note}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#f0f4f8]">
                {o.status !== 'approved' && (
                  <button onClick={() => patch(o.id, { status: 'approved', rejection_note: null })} disabled={busy === o.id}
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">اعتماد</button>
                )}
                {o.status !== 'rejected' && (
                  <button onClick={() => rejectOffice(o.id)} disabled={busy === o.id}
                    className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg font-bold hover:bg-orange-200 disabled:opacity-50">رفض بملاحظات</button>
                )}
                <button onClick={() => patch(o.id, { verified: !o.verified })} disabled={busy === o.id}
                  className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8] disabled:opacity-50">
                  {o.verified ? 'إلغاء التوثيق' : 'توثيق ✓'}
                </button>
                <button onClick={() => patch(o.id, { active: !o.active })} disabled={busy === o.id}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50 ${o.active ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' : 'bg-blue-50 text-[#0A3D62] border-blue-200 hover:bg-blue-100'}`}>
                  {o.active ? 'إيقاف' : 'تفعيل'}
                </button>
                <button onClick={() => toggleListings(o.id)}
                  className="text-xs bg-white border border-[#cfd9e4] text-[#0A3D62] px-3 py-1.5 rounded-lg font-bold hover:bg-[#f0f4f8]">
                  {expanded === o.id ? 'إخفاء الإعلانات' : 'عرض الإعلانات'}
                </button>
              </div>
              {expanded === o.id && (
                <div className="mt-3 pt-3 border-t border-[#f0f4f8] space-y-1.5">
                  {expandList.length === 0 ? (
                    <div className="text-xs text-[#33414f]">لا إعلانات لهذا المكتب.</div>
                  ) : expandList.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#0f1a28] truncate">{m.title}</span>
                      <span className={`px-2 py-0.5 rounded border ${(statusMeta[m.status] ?? statusMeta.pending).cls}`}>{(statusMeta[m.status] ?? statusMeta.pending).label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  5) الرسائل والطلبات — رسائل «اترك رسالة» الحقيقية + تعليم كمعالَجة
// ════════════════════════════════════════════════════════════
interface LeadRow { id: string; name: string; phone: string; message: string | null; handled: boolean; created_at: string; kind?: string | null }
export function LeadsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // تبويبان منفصلان: استفسارات العملاء / رسائل المكاتب للمنصة (الدعم)
  const [tab, setTab] = useState<'inquiry' | 'support'>('inquiry');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    // مع عمود kind إن وُجد؛ وإلا (قبل تشغيل leads_support.sql) بالأعمدة الأساسية
    let r: { data: unknown; error: PgErr | null } =
      await sb.from('leads').select('id,name,phone,message,handled,created_at,kind').order('created_at', { ascending: false });
    if (r.error && r.error.code === '42703') {
      r = await sb.from('leads').select('id,name,phone,message,handled,created_at').order('created_at', { ascending: false });
    }
    if (r.error) setErr(r.error); else setRows(((r.data ?? []) as LeadRow[]));
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  const setHandled = async (id: string, handled: boolean) => {
    setBusy(id);
    const sb = createClient();
    const { error } = await sb.from('leads').update({ handled }).eq('id', id);
    if (error) setErr(error); else await load();
    setBusy(null);
  };

  if (!sessionAdmin) return <><SectionHead title="الرسائل والطلبات" /><NeedSession /></>;

  const isSupport = (l: LeadRow) => l.kind === 'support';
  const shown = rows.filter((l) => (tab === 'support' ? isSupport(l) : !isSupport(l)));
  const counts = { inquiry: rows.filter((l) => !isSupport(l)).length, support: rows.filter(isSupport).length };

  return (
    <>
      <SectionHead title="الرسائل والطلبات" subtitle="من جدول leads — استفسارات العملاء ورسائل دعم المكاتب منفصلة" onRefresh={load} />
      {err && <ErrBox e={err} />}
      <div className="flex gap-2 mb-3">
        {(['inquiry', 'support'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border ${tab === t ? 'bg-[#0A3D62] text-white border-[#0A3D62]' : 'bg-white text-[#33414f] border-[#cfd9e4] hover:bg-[#f0f4f8]'}`}>
            {t === 'inquiry' ? 'استفسارات العملاء' : 'رسائل المكاتب — دعم'} ({fmtNum(counts[t])})
          </button>
        ))}
      </div>
      {loading ? <Loading /> : shown.length === 0 && !err ? (
        <Empty text={tab === 'support' ? 'لا توجد رسائل دعم من المكاتب بعد.' : 'لا توجد استفسارات بعد.'} />
      ) : (
        <div className="space-y-3">
          {shown.map((l) => (
            <div key={l.id} className={`${card} p-4 ${l.handled ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[#0f1a28] text-sm flex items-center gap-2 flex-wrap">
                    {l.name}
                    {isSupport(l) && <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-bold">دعم مكتب</span>}
                  </div>
                  <div className="text-xs text-[#1B6CA8] mt-0.5" dir="ltr" style={{ textAlign: 'right' }}>{l.phone}</div>
                  {l.message && <div className="text-sm text-[#33414f] mt-1.5 leading-relaxed">{l.message}</div>}
                  <div className="text-[11px] text-[#33414f] mt-1.5">{fmtDate(l.created_at)}</div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border whitespace-nowrap ${l.handled ? 'bg-green-100 text-green-800 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                  {l.handled ? 'معالَجة' : 'جديدة'}
                </span>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-[#f0f4f8]">
                <button onClick={() => setHandled(l.id, !l.handled)} disabled={busy === l.id}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold border disabled:opacity-50 ${l.handled ? 'bg-white border-[#cfd9e4] text-[#0A3D62] hover:bg-[#f0f4f8]' : 'bg-green-600 text-white border-green-600 hover:bg-green-700'}`}>
                  {l.handled ? 'إرجاع كجديدة' : 'تعليم كمعالَجة'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  6) العملاء — كل الحسابات المسجّلة (مكاتب + باحثين) من جدول profiles
// ════════════════════════════════════════════════════════════
interface ClientRow { id: string; full_name: string | null; phone: string | null; role: string; created_at: string }
export function ClientsSection({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [err, setErr] = useState<PgErr | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'office' | 'seeker'>('all');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const sb = createClient();
    const { data, error } = await sb.from('profiles').select('id,full_name,phone,role,created_at').order('created_at', { ascending: false });
    if (error) setErr(error); else setRows((data ?? []) as ClientRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (!sessionAdmin) { setLoading(false); return; } load(); }, [sessionAdmin, load]);

  if (!sessionAdmin) return <><SectionHead title="العملاء" /><NeedSession /></>;

  const roleMeta: Record<string, { cls: string; label: string }> = {
    office: { cls: 'bg-blue-100 text-blue-800 border-blue-200', label: 'مكتب' },
    seeker: { cls: 'bg-gray-100 text-gray-700 border-gray-200', label: 'باحث' },
  };
  const shown = rows.filter((r) => (filter === 'all' ? true : r.role === filter));
  const counts = { all: rows.length, office: rows.filter((r) => r.role === 'office').length, seeker: rows.filter((r) => r.role === 'seeker').length };

  return (
    <>
      <SectionHead title="العملاء" subtitle="كل الحسابات المسجّلة (مكاتب + باحثين) من جدول profiles — الأحدث أولاً" onRefresh={load} />
      {err && <ErrBox e={err} />}
      <div className="flex gap-2 mb-3">
        {(['all', 'office', 'seeker'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold border ${filter === f ? 'bg-[#0A3D62] text-white border-[#0A3D62]' : 'bg-white text-[#33414f] border-[#cfd9e4] hover:bg-[#f0f4f8]'}`}>
            {f === 'all' ? 'الكل' : f === 'office' ? 'المكاتب' : 'الباحثين'} ({fmtNum(counts[f])})
          </button>
        ))}
      </div>
      {loading ? <Loading /> : shown.length === 0 && !err ? (
        <Empty text="لا توجد حسابات بعد — ستظهر هنا عند تسجيل المكاتب والباحثين." />
      ) : (
        <div className="space-y-3">
          {shown.map((c) => {
            const rm = roleMeta[c.role] ?? roleMeta.seeker;
            return (
              <div key={c.id} className={`${card} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-[#0f1a28] text-sm">{c.full_name || '— بلا اسم —'}</div>
                    {c.phone && <div className="text-xs text-[#1B6CA8] mt-0.5" dir="ltr" style={{ textAlign: 'right' }}>{c.phone}</div>}
                    <div className="text-[11px] text-[#33414f] mt-1">مسجّل: {fmtDate(c.created_at)}</div>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border whitespace-nowrap ${rm.cls}`}>{rm.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── الشريط الجانبي لأقسام اللوحة ─────────────────────────────
export type AdminSection = 'prices' | 'stats' | 'listings' | 'offices' | 'leads' | 'clients';
const SIDEBAR_ITEMS: { id: AdminSection; label: string }[] = [
  { id: 'prices', label: 'الأسعار والمتوسطات' },
  { id: 'stats', label: 'لوحة الإحصائيات' },
  { id: 'listings', label: 'إدارة الإعلانات' },
  { id: 'offices', label: 'إدارة المكاتب' },
  { id: 'clients', label: 'العملاء' },
  { id: 'leads', label: 'الرسائل والطلبات' },
];

export function AdminSidebar({ section, setSection, userEmail, onExit, exitLabel }: {
  section: AdminSection; setSection: (s: AdminSection) => void;
  userEmail: string | null; onExit: () => void; exitLabel: string;
}) {
  return (
    <aside className="w-full md:w-56 flex-shrink-0">
      <div className={`${card} p-2`}>
        {SIDEBAR_ITEMS.map((it) => (
          <button key={it.id} onClick={() => setSection(it.id)}
            className={`w-full text-right px-3 py-2.5 rounded-xl text-sm mb-1 font-medium transition-colors ${section === it.id ? 'bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white font-bold shadow' : 'text-[#33414f] hover:bg-[#f0f4f8]'}`}>
            {it.label}
          </button>
        ))}
        <div className="border-t border-[#eef2f7] mt-2 pt-2 px-1">
          {userEmail && <div className="text-[11px] text-[#33414f] truncate mb-2" title={userEmail}>{userEmail}</div>}
          <button onClick={onExit} className="w-full text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            {exitLabel}
          </button>
        </div>
      </div>
    </aside>
  );
}
