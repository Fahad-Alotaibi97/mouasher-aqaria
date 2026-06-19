// صفحة 404 عربية بالاتجاه RTL وبهوية «مؤشر العقارية» (.site) — تستبدل صفحة Next
// الافتراضية الإنجليزية. مكوّن خادمي بسيط (نصوص ثابتة) بألوان العلامة، وزر «العودة
// للرئيسية». تُعرض داخل layout الجذر (html lang=ar dir=rtl) فترث الخط والاتجاه.
import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#f6fafe',
        color: '#171c1f',
        fontFamily: "'IBM Plex Sans Arabic', sans-serif",
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* شعار العلامة */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#171c1f' }}>مؤشر العقارية</span>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#C9A84C' }}>real_estate_agent</span>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #d7e2ee',
            borderRadius: 24,
            boxShadow: '0 8px 30px rgba(19,27,46,.06)',
            padding: '40px 28px',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: '#131b2e', letterSpacing: '-.02em' }}>٤٠٤</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 16, marginBottom: 8, color: '#171c1f' }}>
            الصفحة غير موجودة
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#45464d', marginBottom: 26 }}>
            عذراً، الصفحة التي تبحث عنها غير متاحة أو نُقلت. تأكّد من الرابط، أو عُد إلى الصفحة الرئيسية لمتابعة تصفّح
            عروض الإيجار ومؤشر أسعار الحي.
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#006c49',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 26px',
              borderRadius: 14,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(0,108,73,.25)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home</span>
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
