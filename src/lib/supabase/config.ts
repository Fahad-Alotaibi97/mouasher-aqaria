// أداة بسيطة: هل تم ضبط مفاتيح Supabase فعلاً؟
// تحمي الموقع من الانهيار إذا لم يُلصق المفتاح بعد — كل شي يبقى شغّال بالبيانات الاحتياطية.
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      key &&
      url.startsWith('http') &&
      key !== 'PASTE_PUBLISHABLE_KEY_HERE'
  );
}
