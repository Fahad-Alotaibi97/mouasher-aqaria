import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مؤشر العقارية — سوق الإيجار السكني في الرياض بكل وضوح",
  description:
    "اعرف مؤشر أسعار الحي لأي إيجار في الرياض قبل توقيع العقد. مؤشر ذكي، خريطة تفاعلية، ومساعد عقاري يفهم طلبك.",
  keywords: [
    "إيجار الرياض",
    "مؤشر أسعار الحي",
    "مؤشر العقارية",
    "عقارات الرياض",
    "إيجار سكني",
  ],
  openGraph: {
    title: "مؤشر العقارية — سوق الإيجار بكل وضوح",
    description:
      "اعرف مؤشر أسعار الحي لأي إيجار في الرياض قبل توقيع العقد.",
    type: "website",
    locale: "ar_SA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Tajawal:wght@400;500;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* أيقونات Material Symbols Outlined — تُستخدم في الصفحة الرئيسية (تصميم Stitch) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', 'Segoe UI', sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
