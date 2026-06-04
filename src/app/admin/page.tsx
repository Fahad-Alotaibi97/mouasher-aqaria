'use client';
// ════════════════════════════════════════════════════════════
//  لوحة الأدمن — إدارة متوسطات الأحياء حسب تفصيل خانات الغرف.
//
//  • دخول الأدمن بكلمة المرور (signInWithPassword) — وليس Magic Link.
//  • محمية: غير المسجّل أو غير المدير يُحوّل لشاشة دخول واضحة.
//  • كل حي accordion يُظهر تفصيل الغرف عند التوسعة.
//  • شقة/فيلا: 4 خانات (غرفة/غرفتين/ثلاث/أربع+) ، استوديو: خانة واحدة.
//  • المتوسط المعتمد = متوسط الخانات المعبّأة فقط (الفارغة تُتجاهل).
//  • عند الحفظ: المتوسط المعتمد → avg_rent (شقة) / avg_villa / avg_studio،
//    وتفصيل الخانات → apt_detail / villa_detail (JSONB) حتى لا يضيع.
//  • السعر العادل والمؤشر في باقي الموقع يقرآن القيم الجديدة فوراً.
// ════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { useAuth } from '@/lib/useAuth';

// خانات الغرف للشقة/الفيلا (4 خانات): غرفة / غرفتين / ثلاث / أربع فأكثر
const ROOM_LABELS = ['غرفة', 'غرفتين', 'ثلاث غرف', 'أربع غرف فأكثر'];

interface HoodRow {
  name: string;
  apt: (number | null)[]; // 4 خانات
  villa: (number | null)[]; // 4 خانات
  studio: number | null; // خانة واحدة
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
  const { user, isAdmin, ready, signInWithPassword, signOut } = useAuth();

  // حالة شاشة الدخول بكلمة المرور
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginMsg, setLoginMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // بيانات الأحياء
  const [rows, setRows] = useState<HoodRow[]>([]);
  const [openHood, setOpenHood] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // هل توجد أعمدة التفصيل (apt_detail/villa_detail) في القاعدة؟ (للحفظ المرن)
  const [hasDetailCols, setHasDetailCols] = useState(true);

  // ── جلب الأحياء بعد التأكد أن المستخدم مدير ──────────────────
  useEffect(() => {
    if (!ready) return;
    if (!isSupabaseConfigured() || !user || !isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sb = createClient();
      // نحاول جلب أعمدة التفصيل؛ إن لم تكن موجودة نرجع للأعمدة الأساسية فقط.
      let detailOk = true;
      const withDetail = await sb
        .from('neighborhoods')
        .select('name, avg_rent, avg_villa, avg_studio, apt_detail, villa_detail')
        .order('id', { ascending: true });
      let error = withDetail.error;
      let rawData = withDetail.data as Record<string, unknown>[] | null;
      if (error) {
        detailOk = false;
        const basic = await sb
          .from('neighborhoods')
          .select('name, avg_rent, avg_villa, avg_studio')
          .order('id', { ascending: true });
        error = basic.error;
        rawData = basic.data as Record<string, unknown>[] | null;
      }
      if (cancelled) return;
      if (error) {
        setMsg({ ok: false, text: 'تعذّر جلب الأحياء: ' + error.message });
      } else {
        const data = rawData ?? [];
        setHasDetailCols(detailOk);
        setRows(
          data.map((h) => ({
            name: h.name as string,
            apt: detailToSlots(h.apt_detail),
            villa: detailToSlots(h.villa_detail),
            studio: (h.avg_studio as number) ?? null,
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
  }, [ready, user, isAdmin]);

  // ── دخول بكلمة المرور ────────────────────────────────────────
  const doLogin = async () => {
    setLoggingIn(true);
    setLoginMsg(null);
    const r = await signInWithPassword(loginEmail.trim(), loginPass);
    setLoginMsg({ ok: r.ok, text: r.message });
    setLoggingIn(false);
  };

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

  // ── تحديث خانة الاستوديو (واحدة) ─────────────────────────────
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
      { name, apt: [null, null, null, null], villa: [null, null, null, null], studio: null, baseApt: null, baseVilla: null, isNew: true },
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
      const buildPayload = (withDetail: boolean) =>
        rows.map((r) => {
          const aptAvg = approvedAvg(r.apt);
          const villaAvg = approvedAvg(r.villa);
          const base: Record<string, unknown> = {
            name: r.name,
            // المتوسط المعتمد، وإن لم تُعبّأ خانات نُبقي القيمة المخزّنة (لا نصفّرها)
            avg_rent: aptAvg ?? r.baseApt ?? 0,
            avg_villa: villaAvg ?? r.baseVilla ?? null,
            avg_studio: r.studio,
          };
          if (withDetail) {
            base.apt_detail = slotsToDetail(r.apt);
            base.villa_detail = slotsToDetail(r.villa);
          }
          return base;
        });

      // نحاول الحفظ مع التفصيل؛ إن فشل بسبب غياب الأعمدة نعيد بدون التفصيل.
      let { error } = await sb.from('neighborhoods').upsert(buildPayload(hasDetailCols), { onConflict: 'name' });
      if (error && /apt_detail|villa_detail|column/i.test(error.message)) {
        setHasDetailCols(false);
        ({ error } = await sb.from('neighborhoods').upsert(buildPayload(false), { onConflict: 'name' }));
        if (!error) {
          setMsg({
            ok: true,
            text: 'تم حفظ المتوسطات ✓ (لكن تفصيل الغرف لم يُحفظ — شغّل supabase/admin_neighborhoods_v2.sql مرة واحدة لتفعيل حفظ التفصيل).',
          });
          setSaving(false);
          return;
        }
      }
      if (error) setMsg({ ok: false, text: 'فشل الحفظ: ' + error.message });
      else
        setMsg({
          ok: true,
          text: 'تم الحفظ ✓ — السعر العادل والمؤشر في الموقع سيقرآن القيم الجديدة فوراً.',
        });
    } catch (e) {
      setMsg({ ok: false, text: 'فشل الحفظ: ' + (e instanceof Error ? e.message : 'خطأ غير متوقع') });
    }
    setSaving(false);
  };

  // ── أنماط ────────────────────────────────────────────────────
  const cellCls =
    'w-full px-2 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const fieldCls =
    'w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  const wrap = (children: React.ReactNode) => (
    <div
      className="min-h-screen bg-[#F5F8FB] flex items-center justify-center p-6"
      dir="rtl"
      style={{ fontFamily: "var(--font-body), 'Tajawal', sans-serif" }}
    >
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full shadow-sm">{children}</div>
    </div>
  );

  // ── حالات الوصول ─────────────────────────────────────────────
  if (!ready || loading) return wrap(<div className="text-center text-gray-600">جارٍ التحميل…</div>);

  if (!isSupabaseConfigured())
    return wrap(
      <div className="text-center">
        <div className="text-gray-900 font-bold mb-1">لم يتم ضبط الاتصال بقاعدة البيانات بعد.</div>
        <a href="/" className="inline-block mt-4 text-blue-600 text-sm font-medium hover:underline">→ العودة للرئيسية</a>
      </div>
    );

  // غير مسجّل دخول → شاشة دخول الأدمن بكلمة المرور
  if (!user)
    return wrap(
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#0A3D62] text-white flex items-center justify-center font-bold">م</div>
          <div>
            <div className="font-bold text-gray-900 leading-none">لوحة الأدمن</div>
            <div className="text-xs text-gray-500 mt-0.5">دخول المدير بكلمة المرور</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 mb-4">
          هذه الصفحة للمدراء فقط. أدخل بريد المدير وكلمة المرور.
        </p>
        <label className="text-xs text-gray-700 font-semibold block mb-1">البريد الإلكتروني</label>
        <input
          type="email"
          dir="ltr"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          placeholder="name@example.com"
          className={fieldCls + ' mb-3'}
        />
        <label className="text-xs text-gray-700 font-semibold block mb-1">كلمة المرور</label>
        <input
          type="password"
          dir="ltr"
          value={loginPass}
          onChange={(e) => setLoginPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          placeholder="••••••••"
          className={fieldCls}
        />
        <button
          onClick={doLogin}
          disabled={loggingIn}
          className="w-full mt-4 bg-gradient-to-l from-[#1B6CA8] to-[#0A3D62] text-white py-2.5 rounded-xl font-bold text-sm shadow disabled:opacity-60"
        >
          {loggingIn ? 'جارٍ الدخول…' : 'دخول'}
        </button>
        {loginMsg && (
          <div
            className={`mt-3 text-sm rounded-xl p-3 border ${
              loginMsg.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {loginMsg.text}
          </div>
        )}
        <div className="mt-4 text-center text-xs text-gray-400">
          الدخول بالبريد وكلمة المرور.{' '}
          <a href="/" className="text-blue-600 hover:underline">العودة للصفحة الرئيسية</a>.
        </div>
      </div>
    );

  // مسجّل لكن ليس مديراً
  if (!isAdmin)
    return wrap(
      <div className="text-center">
        <div className="text-gray-900 font-bold mb-1">غير مصرّح</div>
        <div className="text-gray-500 text-sm">
          حسابك ({user.email}) ليس مديراً. فعّل صلاحية المدير من قاعدة البيانات (is_admin = true).
        </div>
        <button onClick={signOut} className="mt-4 text-sm text-gray-600 border border-gray-300 px-4 py-2 rounded-xl hover:bg-gray-50">
          تسجيل الخروج
        </button>
        <a href="/" className="block mt-3 text-blue-600 text-sm font-medium hover:underline">→ العودة للرئيسية</a>
      </div>
    );

  // ── لوحة التحرير (accordion) ─────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#F5F8FB] p-5 sm:p-8"
      dir="rtl"
      style={{ fontFamily: "var(--font-body), 'Tajawal', sans-serif" }}
    >
      <div className="max-w-3xl mx-auto">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-[#0A3D62]">لوحة الأدمن — متوسطات الأحياء</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:inline">{user.email}</span>
            <button onClick={signOut} className="text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
              خروج
            </button>
            <a href="/" className="text-blue-600 text-sm font-medium hover:underline">→ الرئيسية</a>
          </div>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          اضغط على أي حي لإظهار تفصيل الغرف. المتوسط المعتمد لكل نوع = متوسط الخانات المعبّأة فقط (الفارغة تُتجاهل)،
          ويُقرأ منه السعر العادل والمؤشر تلقائياً بعد الحفظ.
        </p>

        {/* قائمة الأحياء (accordion) */}
        <div className="space-y-3">
          {rows.map((r) => {
            const aptApproved = approvedAvg(r.apt) ?? r.baseApt;
            const villaApproved = approvedAvg(r.villa) ?? r.baseVilla;
            const studioApproved = r.studio;
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

                    {/* الفيلا */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold text-gray-800">الفيلا — حسب عدد الغرف</div>
                        <div className="text-xs text-purple-700">المعتمد: <b>{fmt(approvedAvg(r.villa))}</b></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ROOM_LABELS.map((lbl, i) => (
                          <div key={i}>
                            <label className="text-[11px] text-gray-500 block mb-1 text-center">{lbl}</label>
                            <input
                              type="number"
                              min={0}
                              value={r.villa[i] ?? ''}
                              onChange={(e) => setSlot(r.name, 'villa', i, e.target.value)}
                              placeholder="—"
                              className={cellCls}
                            />
                          </div>
                        ))}
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
    </div>
  );
}
