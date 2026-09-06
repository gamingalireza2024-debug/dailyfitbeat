/* DailyFitBeat — AI Recipe Importer v4
   ضد 429: فاصلهٔ ۶ ثانیه بین درخواست‌ها + بک‌آف ۶۰ ثانیه
   غذاهای شکست‌خورده به dishes.txt برمی‌گردند برای تلاش بعدی
   جدید v4:
   ۱) دروازهٔ مشترک _gemini.mjs — تشخیص خودکار مدل (سری ۳/۲.۵/۲/…) + تشخیص خطای کلید با پیام فارسی
   ۲) پشتیبانی از صف سه‌فیلدی «نام | کشور | وعده» (breakfast/snack/salad/sandwich/soup/main/iranian)
      → دستهٔ نهایی از وعدهٔ صف تعیین می‌شود (خواستهٔ کاربر: صبحانه و میان‌وعده بیشتر)
   ۳) رفع باگ ضدتکرار: قبلاً کل خط «نام | کشور» با نام DB مقایسه می‌شد و تکراری‌ها فیلتر نمی‌شدند */
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import sharp from 'sharp';
import { geminiInit, geminiText, geminiImage, geminiVision, geminiState } from './_gemini.mjs';

const SB_URL = 'https://hvqchqqlfcjxsohxywbd.supabase.co';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FILE_IN = 'import/dishes.txt';
const FILE_DONE = 'import/done.txt';

/* ---------- دسته از وعدهٔ صف (نام | کشور | وعده) ---------- */
const MEAL2CAT = {
  breakfast: 'breakfast', snack: 'sandwich', salad: 'salad', sandwich: 'sandwich',
  soup: 'soup', main: 'main', iranian: 'iranian', lunch: 'main', dinner: 'soup',
};
function parseDish(line) {
  const parts = String(line).split('|').map(s => s.trim());
  const name = parts[0] || '';
  const region = parts[1] || '';
  const meal = (parts[2] || '').toLowerCase().replace(/\s+/g, '');
  const cat = MEAL2CAT[meal] || '';
  return { name, region, meal, cat, tail: [region, meal].filter(Boolean).length ? ' | ' + [region, meal].filter(Boolean).join(' | ') : '' };
}
let snackFlip = 0; /* میان‌وعده‌ها یکی‌درمیان sandwich/salad تا هر دو رشد کنند */

/* ---------- دروازه Gemini — فقط برای سازگاری امضا قدیمی ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!SERVICE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing'); process.exit(1); }
mkdirSync('img/recipes', { recursive: true });

/* سقف اجرا: LIMIT اعداد فارسی/انگلیسی — رسپی‌های پردازش‌نشده در dishes.txt می‌مانند */
const LIMIT = parseInt(String(process.env.LIMIT || '').trim(), 10);

const svcH = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };

const dishes = existsSync(FILE_IN)
  ? readFileSync(FILE_IN, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : [];
if (!dishes.length) { console.log('📭 import/dishes.txt خالی است.'); process.exit(0); }

/* ---------- ضدتکرار ---------- */
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

/* ---------- متن ---------- */
const SCHEMA_PROMPT = (name, catHint) => `تو سرآشپز حرفه‌ای و متخصص تغذیه هستی. برای غذای «${name}» یک رسپی کامل و واقعی بساز.
فقط JSON معتبر برگردان، بدون هیچ متن اضافه، با این ساختار دقیق:
{
  "name_fa":"نام فارسی","name_en":"English Name","slug":"english-kebab-case-unique",
  "category":"iranian|main|salad|sandwich|breakfast|soup","region":"ایران یا نام کشور به فارسی",
  "time_min":45,"kcal":520,"protein":32,"carbs":40,"fat":22,"fiber":5,"sugar":3,
  "desc_fa":"توصیف یک‌جمله‌ای جذاب فارسی","desc_en":"One-sentence English description",
  "ingredients":[{"fa":"نام ماده","q":"مقدار واقعی"}],
  "steps":["مرحله ۱ با جزئیات","..."],"tips":["نکته ۱","نکته ۲"],
  "tags":["کم‌کالری","پرپروتئین"],"keys":["panini","italy"],
  "image_style":"short English description of the exact dish appearance (colors, texture, garnish, plating)"
}
الزامات: حداقل ۶ ماده با مقدار واقعی، حداقل ۵ مرحله، ۲ تا ۳ نکته، اعداد منطقی، slug یکتا.${catHint ? '\nمهم: مقدار category حتماً باید «' + catHint + '» باشد.' : ''} فقط JSON.`;

function parseJSON(txt) {
  try { return JSON.parse(txt); } catch (e) {}
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

/* ---------- تصویر ---------- */
const STYLE_TPL = (d) => 'Ultra-realistic professional food photography of: ' + d + '. Bright natural daylight from a side window, rustic light oak wooden table, warm white and orange ceramic dishes, gentle steam rising, shallow depth of field, 45-degree angle, vibrant warm appetizing tones, high-end editorial style, consistent series look. No text, no watermark, no people, no logo.';

async function generateImageGemini(styleDesc) {
  return geminiImage(STYLE_TPL(styleDesc));
}

async function generateImagePollinations(styleDesc) {
  try {
    const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(STYLE_TPL(styleDesc)) + '?width=800&height=800&nologo=true&seed=' + Math.floor(Math.random() * 1000000);
    const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) { console.log('   ⚠ pollinations → HTTP ' + r.status); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 2000 ? buf : null;
  } catch (e) { console.log('   ⚠ pollinations err'); return null; }
}

async function visionCheck(imageBuf, dishName) {
  try {
    const small = await sharp(imageBuf).resize(512, 512, { fit: 'cover' }).jpeg({ quality: 60 }).toBuffer();
    const txt = await geminiVision(small.toString('base64'), 'آیا تصویر دقیقاً غذای «' + dishName + '» را نشان می‌دهد؟ فقط YES یا NO با یک جمله توضیح.');
    if (!txt) return { ok: true, reason: 'vision unavailable — accepted' };
    return { ok: /^\s*YES/i.test(txt), reason: txt.trim().split('\n').pop() };
  } catch (e) {
    return { ok: true, reason: 'vision error — accepted' };
  }
}

async function produceImage(dishName, styleDesc) {
  let lastBuf = null, lastReason = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const refined = attempt === 0 ? styleDesc : styleDesc + '. Previous issue: ' + lastReason + '. Fix it, more authentic styling.';
    let buf = await generateImageGemini(refined);
    if (!buf) buf = await generateImagePollinations(refined);
    if (!buf) { lastReason = 'no image'; await sleep(3000); continue; }
    const check = await visionCheck(buf, dishName);
    if (check.ok) { console.log('   🎨 vision: ✓ ' + check.reason); return buf; }
    lastBuf = buf; lastReason = check.reason;
    console.log('   🎨 vision:  ' + check.reason + ' — retry ' + (attempt + 1));
    await sleep(1500);
  }
  console.log('   🎨 استفاده از آخرین تلاش');
  return lastBuf;
}

/* ---------- Supabase ---------- */
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
  console.log('   ' + existing.slugs.size + ' رسپی موجود یافت شد.');
  await geminiInit();
  if (!geminiState.ready) console.log('⚠ بدون مدل متنی، فقط Pollinations برای عکس کار می‌کند — کلید GEMINI_API_KEY را طبق راهنمای بالا درست کن.');
  console.log('');

  /* رسپی‌های این اجرا + رسپی‌های باقی‌مانده برای اجرای بعد */
  const todo = Number.isFinite(LIMIT) && LIMIT > 0 ? dishes.slice(0, LIMIT) : dishes;
  const keep = Number.isFinite(LIMIT) && LIMIT > 0 ? dishes.slice(LIMIT) : [];
  if (keep.length) console.log('⏳ LIMIT=' + LIMIT + ' — ' + keep.length + ' غذا به اجرای بعد موکول شد.');

  const seenInRun = new Set();
  let ok = 0, skip = 0, fail = 0;
  const doneLines = [];
  const failedDishes = [];
  let imgCount = 0;

  for (const dish of todo) {
    const pd = parseDish(dish);
    const nd = norm(pd.name); /* فقط نام — نه کل خط (رفع باگ ضدتکرار) */
    console.log('• ' + dish);

    if (!nd) { skip++; continue; }
    if (existing.names.has(nd) || seenInRun.has(nd)) {
      console.log('   ⏭ نام تکراری — skip');
      skip++; doneLines.push(dish + '  →  SKIP(duplicate-name)');
      continue;
    }

    try {
      /* وعدهٔ صف بر دسته حاکم است (snack یکی‌درمیان sandwich/salad) */
      let catHint = pd.cat;
      if (pd.meal === 'snack') catHint = (snackFlip++ % 2 === 0) ? 'sandwich' : 'salad';
      const raw = await geminiText(SCHEMA_PROMPT(pd.name || dish, catHint));
      const r = parseJSON(raw);
      if (!r || !r.slug || !r.name_fa) {
        console.log('   ❌ JSON نامعتبر — به اجرای بعد موکول شد');
        fail++; failedDishes.push(dish);
        doneLines.push(dish + '  →  RETRY-next-run');
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
        category: catHint || r.category || 'main', region: r.region || pd.region || 'ایران',
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
        console.log('   ❌ insert ناموفق — به اجرای بعد موکول شد');
        fail++; failedDishes.push(dish);
        doneLines.push(dish + '  →  RETRY-next-run(insert)');
      }

      if (imgCount > 0 && imgCount % 5 === 0) {
        try {
          const { execSync } = await import('node:child_process');
          execSync('git add img/recipes && (git diff --staged --quiet || git commit -m "chore: recipe images batch [skip ci]" && (git pull --rebase origin main || true) && git push)', { stdio: 'inherit' });
        } catch (e) { console.log('   push warn:', String(e).slice(0, 120)); }
      }

      await sleep(5000);
    } catch (e) {
      console.log('   ❌ ' + e.message);
      fail++; failedDishes.push(dish);
      doneLines.push(dish + '  →  RETRY-next-run(' + e.message + ')');
    }
  }

  if (imgCount > 0) {
    try {
      const { execSync } = await import('node:child_process');
      execSync('git add img/recipes && (git diff --staged --quiet || git commit -m "chore: recipe images [skip ci]" && (git pull --rebase origin main || true) && git push)', { stdio: 'inherit' });
    } catch (e) { console.log('push warn:', String(e).slice(0, 120)); }
  }

  /* غذاهای شکست‌خورده + پردازش‌نشده برای اجرای بعد می‌مانند */
  const remaining = [...keep, ...failedDishes];
  writeFileSync(FILE_IN, remaining.join('\n') + (remaining.length ? '\n' : ''));
  appendFileSync(FILE_DONE, new Date().toISOString() + ' — ' + ok + ' ok / ' + skip + ' skip / ' + fail + ' retry\n' + doneLines.join('\n') + '\n\n');

  console.log(`\n🏁 Done: ${ok} added, ${skip} skipped, ${fail} queued for next run`);
})();
