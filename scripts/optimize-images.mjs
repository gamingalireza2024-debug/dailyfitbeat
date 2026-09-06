#!/usr/bin/env node
/* ============================================================
   DailyFitBeat — Optimize Images
   فشرده‌سازی همهٔ عکس‌های jpg داخل img/ (بازگشتی) — درجا
   کاری ندارد به png (لوگو/فاوآیکون شفاف می‌مانند)
   اجرا:  node scripts/optimize-images.mjs
   یا از GitHub: تب Actions → Optimize Images → Run workflow
   ============================================================ */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOTS = ["img"];
const MAXW = 1600;      // عرض بیشینه (هیرو هم کیفیت خوب می‌ماند)
const MIN_KB = parseInt(process.env.MIN_KB || "120", 10); // زیر این حجم دست نمی‌زنیم
const QUALITY = 78;     // mozjpeg — عکس غذا هنوز عالی دیده می‌شود

async function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(jpe?g)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const files = (await Promise.all(ROOTS.map((r) => (fs.existsSync(r) ? walk(r) : [])))).flat();
if (!files.length) { console.log("هیچ jpg پیدا نشد."); process.exit(0); }

let before = 0, after = 0, touched = 0, skipped = 0;
console.log(`بررسی ${files.length} فایل...\n`);

for (const f of files.sort()) {
  const st = fs.statSync(f);
  const kb0 = st.size / 1024;
  before += st.size;
  if (kb0 < MIN_KB) { skipped++; after += st.size; continue; }
  try {
    const buf = await sharp(f)
      .rotate()                                  // طبق EXIF
      .resize({ width: MAXW, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true })
      .toBuffer();
    if (buf.length >= st.size) { skipped++; after += st.size; continue; }
    fs.writeFileSync(f, buf);
    after += buf.length;
    touched++;
    console.log(`  ${(kb0 | 0)}KB → ${(buf.length / 1024) | 0}KB  ${f}`);
  } catch (e) {
    console.log(`  ⚠ رد شد ${f}: ${e.message}`);
    after += st.size;
  }
}

const mb0 = (before / 1048576).toFixed(1), mb1 = (after / 1048576).toFixed(1);
const pct = before ? Math.round((1 - after / before) * 100) : 0;
console.log(`\n🏁 تمام: ${touched} فشرده شد، ${skipped} رد شد (کم‌حجم)`);
console.log(`   ${mb0}MB → ${mb1}MB  (صرفه‌جویی ${pct}٪)`);
