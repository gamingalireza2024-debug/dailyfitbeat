/* DailyFitBeat — AI Recipe Importer v3.1
   ورودی: import/dishes.txt  |  گزارش: import/done.txt
   متن: Gemini (چند مدل پشتیبان)  |  تصویر: Gemini Image  |  چک: Gemini Vision */
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import sharp from 'sharp';

const SB_URL = 'https://hvqchqqlfcjxsohxywbd.supabase.co';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI = process.env.GEMINI_API_KEY || '';
const FILE_IN = 'import/dishes.txt';
const FILE_DONE = 'import/done.txt';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').replace(/\s+/g, ' ').trim();

if (!SERVICE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1); }
if (!GEMINI) { console.error('❌ GEMINI_API_KEY missing'); process.exit(1); }
mkdirSync('img/recipes', { recursive: true });

const svcH = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };

const dishes = existsSync(FILE_IN)
  ? readFileSync(FILE_IN, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : [];
if (!dishes.length) { console.log('📭 import/dishes.txt خالی است.'); process.exit(0); }

/* ---------- ۱) ضدتکرار ---------- */
async function loadExisting() {
  const slugs = new Set(), names = new Set();
  let offset = 0;
  while (true) {
    const r = await fetch(SB_URL + '/rest/v1/recipes?select=slug,name_fa,name_en&limit=1000&offset=' + offset, { headers: svcH });
    if (!r.ok) break;
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    j.forEach(x => {
      slugs.add(x.slug);
      names.add(norm(x.name_fa));
      if (x.name_en) names.add(norm(x.name_en));
    });
    if (j.length < 1000) break;
    offset += 1000;
  }
  return { slugs, names };
}

/* ---------- ۲) Gemini متن (چند مدل + لاگ خطا) ---------- */
const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const SCHEMA_PROMPT = (name) => `تو سرآشپز حرفه‌ای و متخصص تغذیه هستی. برای غذای «${name}» یک رسپی کامل و واقعی بساز.
فقط JSON معتبر برگردان، بدون هیچ متن اضافه، با این ساختار دقیق:
{
  "name_fa":"نام فارسی",
  "name_en":"English Name",
  "slug":"english-kebab-case-unique",
  "category":"iranian|main|salad|sandwich|breakfast|soup",
  "region":"ایران یا نام کشور به فارسی",
  "time_min":45,
  "kcal":520,"protein":32,"carbs":40,"fat":22,"fiber":5,"sugar":3,
  "desc_fa":"توصیف یک‌جمله‌ای جذاب فارسی برای کاربر",
  "desc_en":"One-sentence English description for image prompt",
  "ingredients":[{"fa":"نام ماده","q":"مقدار واقعی"}],
  "steps":["مرحله ۱ با جزئیات","..."],
  "tips":["نکته پخت ۱","نکته پخت ۲"],
  "tags":["کم‌کالری","پرپروتئین"],
  "keys":["rhubarb","stew"],
  "image_style":"short English description of the dish appearance for the image prompt"
}
الزامات: حداقل ۶ ماده با مقدار واقعی، حداقل ۵ مرحله، ۲ تا  نکته، اعداد منطقی، slug یکتا. فقط JSON.`;

async function geminiText(prompt) {
  for (const model of TEXT_MODELS) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + GEMINI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
        })
      });
      const j = await r.json();
      if (!r.ok) {
        console.log('   ⚠ model ' + model + ' → HTTP ' + r.status + ' | ' + String(j.error && j.error.message).slice(0, 140));
        continue;
      }
      const t = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text) || '';
      if (t) { console.log('   🧠 model: ' + model); return t; }
      console.log('   ⚠ model ' + model + ' → جواب خالی');
    } catch (e) {
      console.log('   ⚠ model ' + model + ' → ' + String(e.message).slice(0, 100));
    }
  }
  return '';
}
function parseJSON(txt) {
  try { return JSON.parse(txt); } catch (e) {}
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

/* ---------- ۳) Gemini Image + Vision ---------- */
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

async function generateImage(styleDesc) {
  const prompt = 'Ultra-realistic cinematic premium food photography of: ' + styleDesc + '. Square 1:1, dark moody background, warm natural side light, gentle steam, rich macro texture, shallow depth of field, appetizing, high-end editorial style. No text, no watermark, no people, no logo.';
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + IMAGE_MODEL + ':generateContent?key=' + GEMINI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    })
  });
  const j = await r.json();
  if (!r.ok) { console.log('   ⚠ image API → HTTP ' + r.status + ' | ' + String(j.error && j.error.message).slice(0, 140)); return null; }
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  for (const p of parts) {
    if (p.inline_data && p.inline_data.data) return Buffer.from(p.inline_data.data, 'base64');
  }
  return null;
}

async function visionCheck(imageBuf, dishName) {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + TEXT_MODELS[0] + ':generateContent?key=' + GEMINI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: imageBuf.toString('base64') } },
          { text: 'آیا تصویر دقیقاً غذای «' + dishName + '» را نشان می‌دهد؟ فقط با فرمت YES یا NO به همراه یک جمله توضیح جواب بده.' }
        ]}]
      })
    });
    const j = await r.json();
    const txt = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text) || '';
    if (!txt) return { ok: true, reason: 'vision unavailable — accepted' };
    return { ok: /^\s*YES/i.test(txt), reason: txt.trim().split('\n').pop() };
  } catch (e) {
    return { ok: true, reason: 'vision error — accepted' };
  }
}

async function produceImage(dishName, styleDesc) {
  let lastBuf = null, lastReason = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const refined = attempt === 0 ? styleDesc : styleDesc + '. Previous issue: ' + lastReason + '. Fix it, more authentic and detailed.';
    const buf = await generateImage(refined);
    if (!buf) { lastReason = 'no image'; await sleep(2000); continue; }
    const check = await visionCheck(buf, dishName);
    if (check.ok) { console.log('   🎨 vision: ✓ ' + check.reason); return buf; }
    lastBuf = buf; lastReason = check.reason;
    console.log('   🎨 vision: ✗ ' + check.reason + ' — retry ' + (attempt + 1));
    await sleep(1500);
  }
  console.log('   🎨 استفاده از آخرین تلاش');
  return lastBuf;
}

/* ---------- ۴) Supabase ---------- */
async function insertRow(row) {
  const r = await fetch(SB_URL + '/rest/v1/recipes', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, svcH),
    body: JSON.stringify(row)
  });
  return r.ok || r.status === 201;
}

/* ---------- main ---------- */
(async () => {
  console.log('📖 خواندن رسپی‌های موجود…');
  const existing = await loadExisting();
  console.log('   ' + existing.slugs.size + ' رسپی موجود یافت شد.\n');

  const seenInRun = new Set();
  let ok = 0, skip = 0, fail = 0;
  const doneLines = [];
  let imgCount = 0;

  for (const dish of dishes) {
    const nd = norm(dish);
    console.log('• ' + dish);

    if (existing.names.has(nd) || seenInRun.has(nd)) {
      console.log('   ⏭ نام تکراری — skip');
      skip++; doneLines.push(dish + '  →  SKIP(duplicate-name)');
      continue;
    }

    try {
      const raw = await geminiText(SCHEMA_PROMPT(dish));
      const r = parseJSON(raw);
      if (!r || !r.slug || !r.name_fa) {
        console.log('   ❌ JSON نامعتبر ← raw: ' + String(raw).slice(0, 200));
        fail++; doneLines.push(dish + '  →  FAIL(bad-json)');
        continue;
      }
      if (existing.slugs.has(r.slug)) {
        console.log('   ⏭ slug تکراری — skip');
        skip++; doneLines.push(dish + '  →  SKIP(duplicate-slug)');
        continue;
      }

      console.log('   🎨 تولید تصویر…');
      const imgBuf = await produceImage(r.name_fa, r.image_style || r.name_en);
      let imagePath = 'img/recipes/' + r.slug + '.jpg';
      if (imgBuf) {
        await sharp(imgBuf).resize(800, 800, { fit: 'cover' }).jpeg({ quality: 72 }).toFile(imagePath);
        imgCount++;
      } else {
        imagePath = 'img/cat-main.jpg';
      }

      const row = {
        slug: r.slug, name_fa: r.name_fa, name_en: r.name_en || '',
        desc_fa: r.desc_fa || '', desc_en: r.desc_en || r.name_en || '',
        category: r.category || 'main', region: r.region || 'ایران',
        time_min: Number(r.time_min) || 30,
        kcal: Number(r.kcal) || 0, protein: Number(r.protein) || 0,
        carbs: Number(r.carbs) || 0, fat: Number(r.fat) || 0,
        fiber: Number(r.fiber) || 0, sugar: Number(r.sugar) || 0,
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        steps: Array.isArray(r.steps) ? r.steps : [],
        tips: Array.isArray(r.tips) ? r.tips : [],
        tags: Array.isArray(r.tags) ? r.tags : [],
        keys: Array.isArray(r.keys) ? r.keys : [],
        image: imagePath, video_url: ''
      };

      if (await insertRow(row)) {
        console.log('   ✅ → ' + r.slug);
        ok++;
        existing.slugs.add(r.slug);
        existing.names.add(norm(r.name_fa));
        seenInRun.add(nd);
        doneLines.push(dish + '  →  OK(' + r.slug + ')');
      } else {
        console.log('   ❌ insert ناموفق'); fail++;
        doneLines.push(dish + '  →  FAIL(insert)');
      }

      if (imgCount > 0 && imgCount % 5 === 0) {
        try {
          const { execSync } = await import('node:child_process');
          execSync('git add img/recipes && (git diff --staged --quiet || git commit -m "chore: recipe images batch [skip ci]" && git push)', { stdio: 'inherit' });
        } catch (e) { console.log('   push warn:', String(e).slice(0, 120)); }
      }

      await sleep(2000);
    } catch (e) {
      console.log('   ❌ ' + e.message); fail++;
      doneLines.push(dish + '  →  FAIL(' + e.message + ')');
    }
  }

  appendFileSync(FILE_DONE, new Date().toISOString() + ' — ' + ok + '/' + dishes.length + '\n' + doneLines.join('\n') + '\n\n');
  writeFileSync(FILE_IN, '');

  console.log(`\n🏁 Done: ${ok} added, ${skip} skipped, ${fail} failed`);
})();
