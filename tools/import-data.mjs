#!/usr/bin/env node
/**
 * أداة استيراد بيانات مؤشر العقارية
 * تحوّل ملف CSV رسمي (من data.gov.sa أو الهيئة العامة للعقار) إلى كود SQL جاهز
 * للّصق في Supabase → SQL Editor → Run.  لا تحتاج أي مفاتيح سرية.
 *
 * الاستخدام:
 *   node tools/import-data.mjs neighborhoods <ملف.csv>
 *   node tools/import-data.mjs listings <ملف.csv>
 *
 * يدعم رؤوس أعمدة عربية وإنجليزية شائعة (انظر COLUMN_ALIASES بالأسفل).
 */
import fs from 'fs';
import path from 'path';

// ── أسماء الأعمدة المقبولة (مرونة مع الملفات الرسمية) ──────────────
const COLUMN_ALIASES = {
  name:       ['name', 'الحي', 'الحى', 'اسم الحي', 'neighborhood', 'district', 'الحيّ'],
  avg_rent:   ['avg_rent', 'المتوسط', 'متوسط', 'متوسط الإيجار', 'average', 'rent', 'السعر', 'متوسط الايجار'],
  title:      ['title', 'العنوان', 'اسم الإعلان'],
  hood:       ['hood', 'الحي', 'neighborhood', 'district'],
  type:       ['type', 'النوع', 'نوع العقار'],
  advertised: ['advertised', 'price', 'السعر', 'الإيجار', 'الايجار', 'السعر المعلن'],
  area:       ['area', 'المساحة', 'المساحه'],
  rooms:      ['rooms', 'الغرف', 'عدد الغرف'],
  lat:        ['lat', 'latitude', 'خط العرض'],
  lng:        ['lng', 'lon', 'longitude', 'خط الطول'],
  fal_license:['fal_license', 'fal', 'رخصة فال', 'فال'],
  condition:  ['condition', 'الحالة'],
  cond_label: ['cond_label', 'وصف الحالة'],
};

// ── محلّل CSV بسيط يدعم الحقول بين علامات اقتباس والفواصل بداخلها ──
function parseCSV(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function findColumn(headers, key) {
  const aliases = COLUMN_ALIASES[key] || [key];
  const norm = s => s.trim().toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if (aliases.some(a => norm(headers[i]) === norm(a))) return i;
  }
  return -1;
}

const sqlStr = v => `'${String(v).replace(/'/g, "''")}'`;
const sqlNum = v => {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 'null';
};

// ── البرنامج الرئيسي ───────────────────────────────────────────────
const [mode, file] = process.argv.slice(2);
if (!mode || !file || !['neighborhoods', 'listings'].includes(mode)) {
  console.error('الاستخدام: node tools/import-data.mjs <neighborhoods|listings> <ملف.csv>');
  process.exit(1);
}
if (!fs.existsSync(file)) { console.error('الملف غير موجود:', file); process.exit(1); }

const rows = parseCSV(fs.readFileSync(file, 'utf8'));
if (rows.length < 2) { console.error('الملف فارغ أو بدون بيانات.'); process.exit(1); }
const headers = rows[0];
const data = rows.slice(1);

let sql = `-- مُولّد تلقائياً من ${path.basename(file)} — ${new Date().toISOString()}\n`;
let count = 0;

if (mode === 'neighborhoods') {
  const ci = findColumn(headers, 'name');
  const ai = findColumn(headers, 'avg_rent');
  if (ci < 0 || ai < 0) {
    console.error('لم أجد عمودي الحي والمتوسط. الأعمدة الموجودة:', headers.join(' | '));
    process.exit(1);
  }
  const values = [];
  for (const r of data) {
    const name = (r[ci] || '').trim();
    const rent = sqlNum(r[ai]);
    if (!name || rent === 'null') continue;
    values.push(`  (${sqlStr(name)}, ${rent})`);
    count++;
  }
  sql += `insert into public.neighborhoods (name, avg_rent) values\n${values.join(',\n')}\n` +
         `on conflict (name) do update set avg_rent = excluded.avg_rent;\n`;
} else {
  const cols = ['title', 'hood', 'type', 'advertised', 'area', 'rooms', 'fal_license', 'lat', 'lng', 'condition', 'cond_label'];
  const idx = Object.fromEntries(cols.map(c => [c, findColumn(headers, c)]));
  for (const need of ['title', 'hood', 'type', 'advertised']) {
    if (idx[need] < 0) {
      console.error(`عمود إلزامي مفقود: ${need}. الأعمدة الموجودة:`, headers.join(' | '));
      process.exit(1);
    }
  }
  const values = [];
  for (const r of data) {
    const get = c => (idx[c] >= 0 ? (r[idx[c]] || '').trim() : '');
    const title = get('title'), hood = get('hood'), type = get('type');
    if (!title || !hood) continue;
    values.push('  (' + [
      sqlStr(title), sqlStr(hood), sqlStr(type), sqlNum(get('advertised')),
      idx.area >= 0 ? sqlNum(get('area')) : 'null',
      idx.rooms >= 0 ? sqlNum(get('rooms')) : 'null',
      idx.fal_license >= 0 && get('fal_license') ? sqlStr(get('fal_license')) : 'null',
      idx.lat >= 0 ? sqlNum(get('lat')) : 'null',
      idx.lng >= 0 ? sqlNum(get('lng')) : 'null',
      idx.condition >= 0 && get('condition') ? sqlStr(get('condition')) : `'good'`,
      idx.cond_label >= 0 && get('cond_label') ? sqlStr(get('cond_label')) : 'null',
    ].join(', ') + ')');
    count++;
  }
  sql += `insert into public.listings\n  (title, hood, type, advertised, area, rooms, fal_license, lat, lng, condition, cond_label) values\n${values.join(',\n')};\n`;
}

const outDir = path.join(process.cwd(), 'supabase');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `import_${mode}_${Date.now()}.sql`);
fs.writeFileSync(out, sql, 'utf8');
console.log(`✅ تم تجهيز ${count} صف.`);
console.log(`📄 الملف: ${out}`);
console.log(`➡️  افتحه، انسخ محتواه، والصقه في Supabase → SQL Editor → Run.`);
