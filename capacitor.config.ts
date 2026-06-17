import type { CapacitorConfig } from '@capacitor/cli';

// ════════════════════════════════════════════════════════════
//  Capacitor — غلاف تطبيق أصلي (Option A): الـ WebView يحمّل الموقع الحيّ
//  المنشور على Vercel، فأي تحديث للموقع يظهر في التطبيق بلا إعادة بناء.
//  هذا الإعداد إضافي تماماً ولا يمسّ تطبيق الويب أو البناء أو النشر.
//  webDir = www (صفحة احتياطية بسيطة فقط؛ التشغيل الفعلي من server.url).
// ════════════════════════════════════════════════════════════
const config: CapacitorConfig = {
  appId: 'sa.mouasher.app',
  appName: 'مؤشر العقارية',
  webDir: 'www',
  // Option A — تحميل الموقع الحيّ مباشرة (HTTPS، بلا cleartext)
  server: {
    url: 'https://mouasher-aqaria.vercel.app',
    cleartext: false,
  },
  android: {
    // خلفية الواجهة الأصلية تطابق الثيم الفاتح للموقع (تفادي وميض أبيض/أسود)
    backgroundColor: '#F6FAFE',
  },
  plugins: {
    // شاشة بداية فاتحة تختفي تلقائياً بعد تحميل الموقع (بلا منطق JS في الموقع البعيد)
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#F6FAFE',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
    },
  },
};

export default config;
