/* DailyFitBeat — Enrich Recipes v5
   موتور متن: Gemini (دروازهٔ مشترک _gemini.mjs با تشخیص خودکار مدل) → GitHub Models (رایگان داخلی)
   جدید v5:
   ۱) اتصال به دروازهٔ _gemini.mjs — مدل به‌صورت خودکار از ListModels انتخاب می‌شود (سری ۳/۲.۵/۲/…)
   ۲) پیام تشخیصی فارسی دقیق اگر کلید 401/403/400 داد — دیگر چرخهٔ بی‌فایدهٔ 401 نداریم
   ۳) fallback گیت‌هاب مدلز به endpoint جدید models.github.ai منتقل شد
   از v4:
   ۱) چهار فیلد desc_fa ، region ، substitutions هم پر می‌شوند
   ۲) اولویت‌بندی: رسپی‌هایی که فیلد خالی بیشتری دارند زودتر پردازش می‌شوند
   ۳) صفحه‌بندی کامل خواندن رسپی‌ها + پر کردن protein/kcal خالی (فرمول ۴/۴/۴/۹)
   ۴) اعتبارسنجی LIMIT (بین ۵ تا ۱۰۰) */
import { geminiInit, geminiText } from './_gemini.mjs';
const SB_URL = 'https://hvqchqqlfcjxsohxywbd.supabase.co';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const LIMIT = Math.min(Math.max(parseInt(process.env.LIMIT || '20', 10) || 20, 5), 100);

const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!SERVICE) { console.error('❌ SERVICE key missing'); process.exit(1); }
const svcH = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };

/* ---------- خواندن صفحه‌بندی‌شده همه رسپی‌ها ---------- */
async function loadAll() {
  const out = [];
  let offset = 0;
  while (true) {
    const r = await fetch(SB_URL + '/rest/v1/recipes?select=slug,name_fa,name_en,kcal,protein,carbs,fat,fiber,sugar,desc_fa,desc_en,region,ingredients,steps,tips,substitutions,meal_type,meal_tags,time_min,category,tags&limit=1000&offset=' + offset, { headers: svcH });
    if (!r.ok) break;
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    out.push(...j);
    if (j.length < 1000) break;
    offset += 1000;
  }
  return out;
}

/* ---------- موتور پشتیبان: GitHub Models (بدون کلید اضافه — GITHUB_TOKEN خودِ Actions) ---------- */
const GH_MODELS = ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'openai/gpt-4o'];
async function ghText(prompt) {
  if (!GH_TOKEN) return '';
  const endpoints = [
    { url: 'https://models.github.ai/inference/chat/completions', models: GH_MODELS },
    { url: 'https://models.inference.ai.azure.com/chat/completions', models: ['gpt-4o-mini', 'gpt-4o'] },
  ];
  for (const ep of endpoints) {
    for (const model of ep.models) {
      try {
        const r = await fetch(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GH_TOKEN },
          body: JSON.stringify({
            model: model,
            temperature: 0.6,
            messages: [
              { role: 'system', content: 'You are a chef & nutritionist. Return ONLY valid JSON, no extra text.' },
              { role: 'user', content: prompt }
            ]
          }),
          signal: AbortSignal.timeout(60000)
        });
        if (!r.ok) { console.log('   ⚠ gh-models ' + model + ' → ' + r.status); continue; }
        const j = await r.json();
        const t = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        if (t) { console.log('   🐙 text via GitHub Models (' + model + ')'); return t; }
      } catch (e) {}
    }
  }
  return '';
}

async function aiText(prompt) {
  const t = await geminiText(prompt, { generationConfig: { temperature: 0.6 } });
  if (t) return t;
  return await ghText(prompt);
}

function parseJSON(txt) {
  try { return JSON.parse(txt); } catch (e) {}
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

/* ---------- استنتاج meal_tags از روی category/meal_type/macros/time_min ----------
   مجموعه تگ‌های استاندارد برای منوی صفحهٔ رسپی‌ها:
   وعده: breakfast, lunch, dinner, quick-dinner, snack
   هدف: high-protein, vegetarian, weight-loss, quick, low-carb, keto
   هماهنگ با scripts/migrate-meal-tags.mjs — هر تغییری اینجا و آنجا باید هم‌زمان باشد. */
function deriveMealTags(r) {
  const out = new Set();
  const cat = (r.category || "").toLowerCase();
  const mt = Array.isArray(r.meal_type) ? r.meal_type.map((s) => String(s).toLowerCase()) : [];
  const kcal = Number(r.kcal) || 0;
  const time = Number(r.time_min) || 0;
  const protein = Number(r.protein) || 0;
  const carbs = Number(r.carbs) || 0;
  const fat = Number(r.fat) || 0;
  const tags = Array.isArray(r.tags) ? r.tags.map((s) => String(s).toLowerCase()) : [];

  if (cat === "breakfast" || mt.includes("breakfast")) out.add("breakfast");
  if (mt.includes("lunch") || cat === "main" || cat === "iranian") out.add("lunch");
  if (mt.includes("dinner") || (kcal >= 300 && kcal <= 450 && cat !== "breakfast")) out.add("dinner");
  if (time > 0 && time <= 20 && (out.has("dinner") || cat === "main")) out.add("quick-dinner");
  if (cat === "sandwich" || (kcal > 0 && kcal <= 250)) out.add("snack");

  if (protein >= 25) out.add("high-protein");
  if (tags.includes("vegetarian") || tags.includes("گیاهی")) out.add("vegetarian");
  if (kcal > 0 && kcal <= 350) out.add("weight-loss");
  if (time > 0 && time <= 20) out.add("quick");
  if (carbs > 0 && carbs <= 15) out.add("low-carb");
  if (carbs > 0 && carbs <= 10 && fat >= 15) out.add("keto");

  return Array.from(out).sort();
}

const ENRICH_PROMPT = (r, ings) => `تو سرآشپز و متخصص تغذیه هستی. برای غذای «${r.name_fa}» (${r.name_en || ''}) با مواد: ${ings || 'نامشخص'}، فقط یک JSON معتبر برگردان با این ساختار:
{
  "steps":["حداقل ۵ مرحله پخت با جزئیات واقعی","..."],
  "tips":["۲ تا ۳ نکته پخت یا جایگزین","..."],
  "desc_fa":"توضیح یک تا دو جمله‌ای جذاب فارسی درباره غذا",
  "desc_en":"One-sentence English description of the dish",
  "region":"کشور مبدأ مثل ایران، ایتالیا، ژاپن یا اگر ایرانی است استان مثل گیلان، آذربایجان شرقی، خوزستان",
  "substitutions":[{"from":"نام یک مادهٔ اصلی","to":"جایگزین منطقی"},{"from":"نام مادهٔ دیگر","to":"جایگزین"}],
  "meal_type":["بر اساس ماهیت غذا: breakfast و/یا lunch و/یا dinner و/یا snack"],
  "protein":32,"carbs":40,"fat":22,"fiber":5,"sugar":3
}
region را فقط یکی از این‌ها بگذار (یا استان ایرانی اگر غذا ایرانی است): ایران، ایتالیا، ژاپن، تایلند، اسپانیا، مراکش، فرانسه، چین، هند، ترکیه، مکزیک، انگلستان، یونان، کره، لبنان، آمریکا، آرژانتین، برزیل، بین‌المللی. اعداد ماکرو منطقی و هماهنگ با کالری حدود ${r.kcal || 400}. meal_type آرایه‌ای است از این مقادیر مجاز: breakfast, lunch, dinner, snack (می‌تواند چند وعده باشد). فقط JSON.`;

(async () => {
  await geminiInit();
  console.log('📖 خواندن همه رسپی‌ها…');
  const all = await loadAll();
  console.log('   کل: ' + all.length);

  const missing = r => [
    (!Array.isArray(r.steps) || !r.steps.length),
    (!Array.isArray(r.tips) || !r.tips.length),
    !r.carbs || !r.fat || !r.protein,
    !r.desc_fa,
    !r.desc_en || r.desc_en === r.name_en,
    !r.region,
    (!Array.isArray(r.substitutions) || !r.substitutions.length)
  ].filter(Boolean).length;
  const incomplete = all.filter(r => missing(r) > 0)
    .sort((a, b) => missing(b) - missing(a));
  console.log('   ناقص: ' + incomplete.length + ' | این اجرا: ' + Math.min(LIMIT, incomplete.length));

  let ok = 0, fail = 0, consecutiveFails = 0;
  for (const r of incomplete.slice(0, LIMIT)) {
    console.log('• ' + r.name_fa + ' (' + r.slug + ')');
    const ings = Array.isArray(r.ingredients) ? r.ingredients.map(i => i.fa).join('، ') : '';
    const raw = await aiText(ENRICH_PROMPT(r, ings));
    const p = parseJSON(raw);
    if (!p) {
      console.log('   ❌ JSON نامعتبر');
      fail++;
      if (++consecutiveFails >= 3) { console.log('🛑 سه شکست پشت‌سرهم — احتمالاً سهمیه روزانه تمام است؛ بقیه به اجرای فردا موکول شدند.'); break; }
      continue;
    }
    consecutiveFails = 0;

    const patch = {};
    if ((!Array.isArray(r.steps) || !r.steps.length) && Array.isArray(p.steps) && p.steps.length) patch.steps = p.steps;
    if ((!Array.isArray(r.tips) || !r.tips.length) && Array.isArray(p.tips) && p.tips.length) patch.tips = p.tips;
    if (!r.carbs && p.carbs) patch.carbs = Number(p.carbs) || 0;
    if (!r.fat && p.fat) patch.fat = Number(p.fat) || 0;
    if (!r.fiber && p.fiber) patch.fiber = Number(p.fiber) || 0;
    if (!r.sugar && p.sugar) patch.sugar = Number(p.sugar) || 0;
    if (!r.protein && p.protein) patch.protein = Number(p.protein) || 0;
    if ((!r.desc_en || r.desc_en === r.name_en) && p.desc_en) patch.desc_en = p.desc_en;
    if (!r.desc_fa && p.desc_fa) patch.desc_fa = String(p.desc_fa).trim();
    if (!r.region && p.region) patch.region = String(p.region).trim();
    if ((!Array.isArray(r.substitutions) || !r.substitutions.length) && Array.isArray(p.substitutions) && p.substitutions.length) {
      const subs = p.substitutions
        .filter(s => s && s.from && s.to)
        .slice(0, 4)
        .map(s => ({ from: String(s.from).trim(), to: String(s.to).trim() }));
      if (subs.length) patch.substitutions = subs;
    }

    /* meal_type: اگه AI داده و الان خالیه، ذخیره کن */
    if ((!Array.isArray(r.meal_type) || !r.meal_type.length) && Array.isArray(p.meal_type) && p.meal_type.length) {
      const mt = p.meal_type
        .map(s => String(s).toLowerCase().trim())
        .filter(s => ['breakfast', 'lunch', 'dinner', 'snack'].includes(s));
      if (mt.length) patch.meal_type = [...new Set(mt)];
    }

    /* meal_tags: همیشه از روی داده‌های جدید بازمحاسبه کن (منطق محلی، نه AI) */
    const merged = Object.assign({}, r, patch);
    const mealTags = deriveMealTags(merged);
    if (mealTags.length && JSON.stringify(mealTags) !== JSON.stringify(r.meal_tags || [])) {
      patch.meal_tags = mealTags;
    }

    /* kcal: اول مقدار AI، بعد تخمین از ماکروها (۴/۴/۴/۹) */
    if (!r.kcal) {
      const carbs = patch.carbs ?? Number(r.carbs) ?? 0;
      const prot = patch.protein ?? Number(r.protein) ?? 0;
      const fat = patch.fat ?? Number(r.fat) ?? 0;
      if (p.kcal) patch.kcal = Number(p.kcal) || 0;
      else if (carbs || prot || fat) patch.kcal = Math.round(4 * (Number(carbs) + Number(prot)) + 9 * Number(fat));
    }

    if (!Object.keys(patch).length) { console.log('   ⏭ چیزی برای پرکردن نبود'); continue; }

    const res = await fetch(SB_URL + '/rest/v1/recipes?slug=eq.' + encodeURIComponent(r.slug), {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, svcH),
      body: JSON.stringify(patch)
    });
    if (res.ok || res.status === 204) { console.log('   ✅ پر شد: ' + Object.keys(patch).join(', ')); ok++; }
    else { console.log('   ❌ PATCH ' + res.status); fail++; }

    await sleep(5000);
  }

  console.log(`\n🏁 Enriched: ${ok} | failed: ${fail} | باقی‌مانده: ${Math.max(0, incomplete.length - ok)}`);
  if (ok === 0 && fail > 0) {
    console.log('⚠ هیچ فیلدی پر نشد — علت را از لاگ‌های «⚠ model →» همین استپ بخیر.');
    console.log('  • 404/400 ← مدل برای این کلید فعال نیست (استپ ۰ پینگ واقعی می‌گیرد — خروجی‌اش را ببین)');
    console.log('  • 429 ← سهمیهٔ رایگان تمام شده — فردا خودکار ادامه می‌دهد');
  }
})();
