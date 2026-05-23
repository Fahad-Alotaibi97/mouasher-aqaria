import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const mktAvg: Record<string, number> = {
  'العليا': 52000,
  'النرجس': 65000,
  'الملقا': 60000,
  'حطين': 58000,
  'الياسمين': 54000,
  'القيروان': 58000,
  'النخيل': 59000,
  'إشبيلية': 38000,
};

export async function POST(request: NextRequest) {
  try {
    const { message, preferences } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });
    }
    const avgText = Object.entries(mktAvg)
      .map(([k, v]) => `${k}: ${v.toLocaleString('ar-SA')} ريال`)
      .join('، ');
    const memCtx = preferences
      ? ` (المستخدم بحث سابقاً عن: حي ${preferences.hood || '-'}، نوع ${preferences.type || '-'})`
      : '';
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: `أنت مساعد مؤشر العقارية للإيجار السكني في الرياض فقط.${memCtx}
متوسطات الأحياء: ${avgText}.
رد في 3 أسطر فقط:
١- ترحيب قصير
٢- تحليل موجز للمعايير والسعر المتوقع
٣- "جاري عرض النتائج..."
استخدم اللغة العربية الفصحى. كن موجزاً.`,
      messages: [{ role: 'user', content: message }],
    });
    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');
    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error('خطأ في API:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الاتصال بالمساعد الذكي' },
      { status: 500 }
    );
  }
}