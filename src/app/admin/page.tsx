'use client';
// ════════════════════════════════════════════════════════════
//  لوحة الأدمن — إدارة متوسطات الأحياء حسب تفصيل خانات الغرف.
//
//  • الدخول بجلسة المدير الموحّدة فقط (تسجيل دخول من الرئيسية بحساب is_admin).
//    أُزيلت بوّابة كلمة المرور نهائياً: بعد قفل كتابة neighborhoods على المدير
//    (supabase/lock_neighborhoods_write.sql) لا يمكن الحفظ إلا بجلسة قاعدة
//    حقيقية (auth.uid())، فبوّابة بلا جلسة صارت بلا فائدة وكلمتها مكشوفة في
//    الـ bundle. الحفظ يمرّ عبر عميل المتصفح الموحّد فيحمل جلسة المدير تلقائياً.
//  • كل حي accordion يُظهر تفصيل الغرف عند التوسعة.
//  • شقة/فيلا: 4 خانات (غرفة/غرفتين/ثلاث/أربع+) ، استوديو: خانة واحدة.
//  • المتوسط المعتمد = متوسط الخانات المعبّأة فقط (الفارغة تُتجاهل).
//  • عند الحفظ: المتوسط المعتمد → avg_rent (شقة) / avg_villa / avg_studio،
//    وتفصيل الخانات → apt_detail / villa_detail (JSONB) حتى لا يضيع.
//  • مؤشر أسعار الحي في باقي الموقع يقرأ القيم الجديدة فوراً.
// ════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { useAuth } from '@/lib/useAuth';
import SiteNav from '../components/SiteNav';
import { AdminSidebar, StatsSection, ListingsSection, OfficesSection, LeadsSection, ClientsSection, type AdminSection } from './sections';

// خانات الغرف للشقة/الفيلا (4 خانات): غرفة / غرفتين / ثلاث / أربع فأكثر
const ROOM_LABELS = ['غرفة', 'غرفتين', 'ثلاث غرف', 'أربع غرف فأكثر'];

interface HoodRow {
  name: string;
  apt: (number | null)[]; // 4 خانات (الشقة فقط تبقى بخانات الغرف)
  villa: (number | null)[]; // (مُهمل في الواجهة — يُقرأ من villa_detail القديم فقط)
  villaSingle: number | null; // ★ الفيلا صارت قيمة واحدة (avg_villa)
  studio: number | null; // خانة واحدة
  floor: number | null; // الدور — قيمة واحدة (avg_dor)
  duplex: number | null; // الدوبلكس — قيمة واحدة (avg_duplex)
  baseApt: number | null; // avg_rent المُخزّن (للرجوع إن لم تُعبّأ خانات)
  baseVilla: number | null; // avg_villa المُخزّن
  isNew?: boolean;
}

// تحويل كائن JSONB {"1":n,...} إلى مصفوفة 4 خانات
function detailToSlots(detail: unknown): (number | null)[] {
  const slots: (number | null)[] = [null, null, null, null];
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>;
    for (let i = 0; i < 4; i++) {
      const v = d[String(i + 1)];
      slots[i] = typeof v === 'number' && !Number.isNaN(v) ? v : null;
    }
  }
  return slots;
}

// تحويل المصفوفة إلى كائن JSONB يحفظ الخانات المعبّأة فقط
function slotsToDetail(slots: (number | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  slots.forEach((v, i) => {
    if (v != null && !Number.isNaN(v) && v > 0) out[String(i + 1)] = v;
  });
  return out;
}

// ★ المنطق الذكي: المتوسط المعتمد = متوسط الخانات المعبّأة فقط (الفارغة تُتجاهل).
//   لو خانة واحدة معبّأة تُعتمد مباشرةً. لو الكل فارغ ⇒ null.
function approvedAvg(slots: (number | null)[]): number | null {
  const filled = slots.filter((v): v is number => v != null && !Number.isNaN(v) && v > 0);
  if (filled.length === 0) return null;
  return Math.round(filled.reduce((a, b) => a + b, 0) / filled.length);
}

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : `${n.toLocaleString('ar-SA')} ريال`;

export default function AdminPage() {
  // ── الدخول الموحّد (المسار الوحيد): جلسة Supabase من الرئيسية + is_admin=true ──
  //   useAuth يقرأ الجلسة عبر getSession() (كوكي محلّي) ولا يستدعي is_admin داخل
  //   onAuthStateChange (تفادي قفل المصادقة)، ويستخدم عميلاً واحداً (singleton).
  const { user, isAdmin, ready, signOut } = useAuth();
  const sessionAdmin = !!user && isAdmin;

  // اللوحة مفتوحة بجلسة مدير موحّدة فقط — الكتابة في القاعدة تتطلب auth.uid().
  const open = sessionAdmin;

  // القسم المعروض في الشريط الجانبي (الإحصائيات هي صفحة الهبوط بعد الدخول).
  const [section, setSection] = useState<AdminSection>('stats');

  // الخروج من جلسة المدير الموحّدة ثم العودة للرئيسية.
  const exitSession = async () => {
    await signOut();
    if (typeof window !== 'undefined') window.location.href = '/';
  };

  // بيانات الأحياء
  const [rows, setRows] = useState<HoodRow[]>([]);
  const [openHood, setOpenHood] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // هل توجد أعمدة التفصيل (apt_detail/villa_detail) في القاعدة؟ (للحفظ المرن)
  const [hasDetailCols, setHasDetailCols] = useState(true);
  // هل توجد أعمدة الدور/الدوبلكس (avg_dor/avg_duplex)؟ (قبل تشغيل add_floor_duplex.sql)
  const [hasNewTypeCols, setHasNewTypeCols] = useState(true);

  // ── جلب الأحياء بعد فتح اللوحة (بجلسة موحّدة أو بكلمة المرور) ──
  useEffect(() => {
    if (!open) return;
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sb = createClient();
      // نتدرّج من أكثر الأعمدة شمولاً إلى الأساسية حتى نتوافق مع أي حالة للقاعدة
      // (مع/بدون أعمدة التفصيل، ومع/بدون أعمدة الدور/الدوبلكس).
      const variants: { cols: string; detail: boolean; newTypes: boolean }[] = [
        { cols: 'name, avg_rent, avg_villa, avg_studio, avg_dor, avg_duplex, apt_detail, villa_detail', detail: true, newTypes: true },
        { cols: 'name, avg_rent, avg_villa, avg_studio, avg_dor, avg_duplex', detail: false, newTypes: true },
        { cols: 'name, avg_rent, avg_villa, avg_studio, apt_detail, villa_detail', detail: true, newTypes: false },
        { cols: 'name, avg_rent, avg_villa, avg_studio', detail: false, newTypes: false },
      ];
      let error: { message: string } | null = null;
      let rawData: Record<string, unknown>[] | null = null;
      let detailOk = false;
      let newTypesOk = false;
      for (const v of variants) {
        const res = await sb.from('neighborhoods').select(v.cols).order('id', { ascending: true });
        if (!res.error) {
          rawData = res.data as unknown as Record<string, unknown>[] | null;
          detailOk = v.detail; newTypesOk = v.newTypes; error = null;
          break;
        }
        error = res.error;
      }
      if (cancelled) return;
      if (error && !rawData) {
        setMsg({ ok: false, text: 'تعذّر جلب الأحياء: ' + error.message });
      } else {
        const data = rawData ?? [];
        setHasDetailCols(detailOk);
        setHasNewTypeCols(newTypesOk);
        setRows(
          data.map((h) => ({
            name: h.name as string,
            apt: detailToSlots(h.apt_detail),
            villa: detailToSlots(h.villa_detail),
            villaSingle: (h.avg_villa as number) ?? null,
            studio: (h.avg_studio as number) ?? null,
            floor: (h.avg_dor as number) ?? null,
            duplex: (h.avg_duplex as number) ?? null,
            baseApt: (h.avg_rent as number) ?? null,
            baseVilla: (h.avg_villa as number) ?? null,
          }))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ── تحديث خانة غرفة (شقة/فيلا) ───────────────────────────────
  const setSlot = (name: string, kind: 'apt' | 'villa', idx: number, value: string) => {
    const num = value === '' ? null : parseInt(value, 10);
    setRows((prev) =>
      prev.map((r) => {
        if (r.name !== name) return r;
        const slots = [...r[kind]];
        slots[idx] = Number.isNaN(num as number) ? null : num;
        return { ...r, [kind]: slots };
      })
    );
  };

  // ── تحديث قيمة مفردة (استوديو/دور/دوبلكس) ────────────────────
  const setSingle = (name: string, key: 'studio' | 'floor' | 'duplex' | 'villaSingle', value: string) => {
    const num = value === '' ? null : parseInt(value, 10);
    setRows((prev) =>
      prev.map((r) => (r.name === name ? { ...r, [key]: Number.isNaN(num as number) ? null : num } : r))
    );
  };
  const setStudio = (name: string, value: string) => {
    const num = value === '' ? null : parseInt(value, 10);
    setRows((prev) =>
      prev.map((r) => (r.name === name ? { ...r, studio: Number.isNaN(num as number) ? null : num } : r))
    );
  };

  // ── إضافة حي جديد ────────────────────────────────────────────
  const addHood = () => {
    const name = (typeof window !== 'undefined' ? window.prompt('اسم الحي الجديد:') : '')?.trim();
    if (!name) return;
    if (rows.some((r) => r.name === name)) {
      setMsg({ ok: false, text: `الحي «${name}» موجود مسبقاً.` });
      return;
    }
    setRows((prev) => [
      ...prev,
      { name, apt: [null, null, null, null], villa: [null, null, null, null], villaSingle: null, studio: null, floor: null, duplex: null, baseApt: null, baseVilla: null, isNew: true },
    ]);
    setOpenHood(name);
    setMsg(null);
  };

  // ── حفظ كل الصفوف ────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const sb = createClient();
      const buildPayload = (withDetail: boolean, withNewTypes: boolean) =>
        rows.map((r) => {
          const aptAvg = approvedAvg(r.apt);
          const base: Record<string, unknown> = {
            name: r.name,
            // الشقة: المتوسط المعتمد من الخانات، وإن لم تُعبّأ نُبقي القيمة المخزّنة.
            avg_rent: aptAvg ?? r.baseApt ?? 0,
            // الفيلا: صارت قيمة واحدة مباشرة (لا خانات غرف).
            avg_villa: r.villaSingle,
            avg_studio: r.studio,
          };
          if (withNewTypes) {
            base.avg_dor = r.floor;
            base.avg_duplex = r.duplex;
          }
          // نكتب تفصيل الشقة فقط؛ villa_detail يبقى في القاعدة دون تعديل (مُهمل).
          if (withDetail) {
            base.apt_detail = slotsToDetail(r.apt);
          }
          return base;
        });

      // نحاول الحفظ بكل الأعمدة؛ إن فشل بسبب غياب أعمدة (التفصيل أو الدور/الدوبلكس)
      // نعيد المحاولة بالأعمدة الأساسية فقط حتى لا يضيع الحفظ.
      let { error } = await sb.from('neighborhoods').upsert(buildPayload(hasDetailCols, hasNewTypeCols), { onConflict: 'name' });
      if (error && /apt_detail|villa_detail|avg_dor|avg_duplex|column/i.test(error.message)) {
        setHasDetailCols(false);
        setHasNewTypeCols(false);
        ({ error } = await sb.from('neighborhoods').upsert(buildPayload(false, false), { onConflict: 'name' }));
        if (!error) {
          setMsg({
            ok: true,
            text: 'تم حفظ المتوسطات الأساسية ✓ (لكن تفصيل الغرف و/أو الدور/الدوبلكس لم تُحفظ — شغّل supabase/admin_neighborhoods_v2.sql و supabase/add_floor_duplex.sql مرة واحدة).',
          });
          setSaving(false);
          return;
        }
      }
      if (error) setMsg({ ok: false, text: 'فشل الحفظ: ' + error.message });
      else
        setMsg({
          ok: true,
          text: 'تم الحفظ ✓ — مؤشر أسعار الحي في الموقع سيقرأ القيم الجديدة فوراً.',
        });
    } catch (e) {
      setMsg({ ok: false, text: 'فشل الحفظ: ' + (e instanceof Error ? e.message : 'خطأ غير متوقع') });
    }
    setSaving(false);
  };

  // ── أنماط ────────────────────────────────────────────────────
  const cellCls =
    'w-full px-2 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  const wrap = (children: React.ReactNode) => (
    <div
      className="min-h-screen bg-[#EAF0F6]"
      dir="rtl"
      style={{ fontFamily: "var(--font-body), 'Tajawal', sans-serif" }}
    >
      <SiteNav active="admin" />
      <div className="flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#cfd9e4] p-8 max-w-md w-full shadow-sm">{children}</div>
      </div>
    </div>
  );

  // أثناء التحقّق من الجلسة الموحّدة — لا نُظهر البوّابة فجأة لمدير مسجّل دخوله.
  if (!open && isSupabaseConfigured() && !ready)
    return wrap(<div className="text-center text-gray-600">جارٍ التحقّق من جلستك…</div>);

  // ── غير مفتوحة ⇒ تتطلّب جلسة المدير الموحّدة (لا بوّابة كلمة مرور بعد الآن) ──
  if (!open)
    return wrap(
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#0A3D62] text-white flex items-center justify-center font-bold">م</div>
          <div className="font-bold text-gray-900">لوحة الأدمن</div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed mb-5">
          هذه اللوحة تتطلّب <b>تسجيل الدخول بحساب المدير</b> من الصفحة الرئيسية —
          الحفظ في القاعدة محمي بسياسات تتحقّق من هويتك (is_admin)، فلا تكفي أي كلمة مرور بلا جلسة.
        </p>
        <a href="/#pricing" className="inline-block bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow">
          الذهاب لتسجيل الدخول
        </a>
        <a href="/" className="block mt-4 text-center text-blue-600 text-sm font-medium hover:underline">→ العودة للصفحة الرئيسية</a>
      </div>
    );

  // مفتوحة لكن البيانات قيد التحميل
  if (loading) return wrap(<div className="text-center text-gray-600">جارٍ التحميل…</div>);

  // مفتوحة لكن القاعدة غير مضبوطة
  if (!isSupabaseConfigured())
    return wrap(
      <div className="text-center">
        <div className="text-gray-900 font-bold mb-1">لم يتم ضبط الاتصال بقاعدة البيانات بعد.</div>
        <a href="/" className="inline-block mt-4 text-blue-600 text-sm font-medium hover:underline">→ العودة للرئيسية</a>
      </div>
    );

  // ── لوحة التحرير (accordion) ─────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#EAF0F6]"
      dir="rtl"
      style={{ fontFamily: "var(--font-body), 'Tajawal', sans-serif" }}
    >
      <SiteNav active="admin" />
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-5 items-start">
        <AdminSidebar
          section={section}
          setSection={setSection}
          userEmail={user?.email ?? null}
          onExit={exitSession}
          exitLabel="تسجيل الخروج"
        />
        <main className="flex-1 w-full min-w-0">

        {/* ═══ 1) الأسعار والمتوسطات (كما هي تماماً) ═══ */}
        {section === 'prices' && (
        <div>
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-[#0A3D62] sec-underline">الأسعار والمتوسطات</h1>
          <a href="/" className="text-blue-600 text-sm font-medium hover:underline">→ الرئيسية</a>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          اضغط على أي حي لإظهار تفصيل الغرف. المتوسط المعتمد لكل نوع = متوسط الخانات المعبّأة فقط (الفارغة تُتجاهل)،
          ويُقرأ منه مؤشر أسعار الحي تلقائياً بعد الحفظ.
        </p>

        {/* قائمة الأحياء (accordion) */}
        <div className="space-y-3">
          {rows.map((r) => {
            const aptApproved = approvedAvg(r.apt) ?? r.baseApt;
            const villaApproved = r.villaSingle;
            const studioApproved = r.studio;
            const floorApproved = r.floor;
            const duplexApproved = r.duplex;
            const isOpen = openHood === r.name;
            return (
              <div key={r.name} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* رأس الحي (ملخص لحظي) */}
                <button
                  onClick={() => setOpenHood(isOpen ? null : r.name)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                    <span className="font-bold text-gray-900 truncate">{r.name}</span>
                    {r.isNew && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-lg border border-green-200">جديد</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end text-xs">
                    <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded-lg whitespace-nowrap">
                      شقة: <b>{fmt(aptApproved)}</b>
                    </span>
                    <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-1 rounded-lg whitespace-nowrap">
                      فيلا: <b>{fmt(villaApproved)}</b>
                    </span>
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg whitespace-nowrap">
                      استوديو: <b>{fmt(studioApproved)}</b>
                    </span>
                    <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-1 rounded-lg whitespace-nowrap">
                      دور: <b>{fmt(floorApproved)}</b>
                    </span>
                    <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg whitespace-nowrap">
                      دوبلكس: <b>{fmt(duplexApproved)}</b>
                    </span>
                  </div>
                </button>

                {/* تفصيل الغرف */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-5">
                    {/* الشقة */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-800">الشقة — حسب عدد الغرف</div>
                        <div className="text-xs text-blue-700">المعتمد: <b>{fmt(approvedAvg(r.apt))}</b></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ROOM_LABELS.map((lbl, i) => (
                          <div key={i}>
                            <label className="text-[11px] text-gray-500 block mb-1 text-center">{lbl}</label>
                            <input
                              type="number"
                              min={0}
                              value={r.apt[i] ?? ''}
                              onChange={(e) => setSlot(r.name, 'apt', i, e.target.value)}
                              placeholder="—"
                              className={cellCls}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* الفيلا (قيمة واحدة) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-800">الفيلا</div>
                        <div className="text-xs text-purple-700">المعتمد: <b>{fmt(r.villaSingle)}</b></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1 text-center">المتوسط</label>
                          <input
                            type="number"
                            min={0}
                            value={r.villaSingle ?? ''}
                            onChange={(e) => setSingle(r.name, 'villaSingle', e.target.value)}
                            placeholder="—"
                            className={cellCls}
                          />
                        </div>
                      </div>
                    </div>

                    {/* الاستوديو */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-800">الاستوديو</div>
                        <div className="text-xs text-amber-700">المعتمد: <b>{fmt(studioApproved)}</b></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1 text-center">المتوسط</label>
                          <input
                            type="number"
                            min={0}
                            value={r.studio ?? ''}
                            onChange={(e) => setStudio(r.name, e.target.value)}
                            placeholder="—"
                            className={cellCls}
                          />
                        </div>
                      </div>
                    </div>

                    {/* الدور (قيمة واحدة) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-800">الدور</div>
                        <div className="text-xs text-teal-700">المعتمد: <b>{fmt(floorApproved)}</b></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1 text-center">المتوسط</label>
                          <input
                            type="number"
                            min={0}
                            value={r.floor ?? ''}
                            onChange={(e) => setSingle(r.name, 'floor', e.target.value)}
                            placeholder="—"
                            className={cellCls}
                          />
                        </div>
                      </div>
                    </div>

                    {/* الدوبلكس (قيمة واحدة) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-800">الدوبلكس</div>
                        <div className="text-xs text-indigo-700">المعتمد: <b>{fmt(duplexApproved)}</b></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1 text-center">المتوسط</label>
                          <input
                            type="number"
                            min={0}
                            value={r.duplex ?? ''}
                            onChange={(e) => setSingle(r.name, 'duplex', e.target.value)}
                            placeholder="—"
                            className={cellCls}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-8 text-center text-gray-500">
              لا توجد أحياء بعد. أضف حياً جديداً للبدء.
            </div>
          )}
        </div>

        {msg && (
          <div
            className={`mt-4 text-sm rounded-xl p-3 border ${
              msg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* أزرار الإجراءات */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={addHood}
            className="bg-white border border-blue-300 text-[#0A3D62] px-5 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors"
          >
            + إضافة حي
          </button>
          <button
            onClick={save}
            disabled={saving || rows.length === 0}
            className="bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white px-8 py-3 rounded-xl font-bold text-sm shadow disabled:opacity-60"
          >
            {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
          </button>
        </div>
        </div>
        )}

        {section === 'stats' && <StatsSection sessionAdmin={sessionAdmin} />}
        {section === 'listings' && <ListingsSection sessionAdmin={sessionAdmin} />}
        {section === 'offices' && <OfficesSection sessionAdmin={sessionAdmin} />}
        {section === 'clients' && <ClientsSection sessionAdmin={sessionAdmin} />}
        {section === 'leads' && <LeadsSection sessionAdmin={sessionAdmin} />}
        </main>
      </div>
    </div>
  );
}
