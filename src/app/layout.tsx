import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مؤشر العقارية — سوق الإيجار السكني في الرياض بكل وضوح",
  description:
    "اعرف السعر العادل لأي إيجار في الرياض قبل توقيع العقد. مؤشر ذكي، خريطة تفاعلية، ومساعد عقاري يفهم طلبك.",
  keywords: [
    "إيجار الرياض",
    "السعر العادل",
    "مؤشر العقارية",
    "عقارات الرياض",
    "إيجار سكني",
  ],
  openGraph: {
    title: "مؤشر العقارية — سوق الإيجار بكل وضوح",
    description:
      "اعرف السعر العادل لأي إيجار في الرياض قبل توقيع العقد.",
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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@700;800;900&display=swap"
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
