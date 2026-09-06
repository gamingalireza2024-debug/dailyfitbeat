/* DailyFitBeat — Enrich Recipes v4
   موتور متن: Gemini (با بک‌آف ۶۰ث) → GitHub Models (رایگان داخلی)
   جدید v4:
   ۱) چهار فیلد تازه هم پر می‌شوند: desc_fa ، region ، substitutions (video_url قابل تولید خودکار نیست)
   ۲) اولویت‌بندی: رسپی‌هایی که فیلد خالی بیشتری دارند زودتر پردازش می‌شوند
   ۳) region از فهرست کشور/استان معتبر انتخاب می‌شود
   ۴) substitutions با ساختار {from,to} هماهنگ با app.js
   اصلاحات v3:
   ۱) صفحه‌بندی کامل خواندن رسپی‌ها (قبلاً سقف ۲۰۰۰ بود و بی‌سروصدا می‌بُرید)
   ۲) فیلد protein و kcal هم اگر خالی بود پر می‌شوند (پروتئین عدد کلیدی کارت‌هاست)
   ۳) اگر kcal خالی بماند اما ماکروها باشند، از فرمول ۴/۴/۴/۹ تخمین زده می‌شود
   ۴) اعتبارسنجی LIMIT (بین ۵ تا ۱۰۰) */
const SB_URL = 'https://hvqchqqlfcjxsohxywbd.supabase.co';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI = process.env.GEMINI_API_KEY || '';
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const API = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];
const GH_MODELS = ['gpt-4o-mini', 'gpt-4o'];
const LIMIT = Math.min(Math.max(parseInt(process.env.LIMIT || '20', 10) || 20, 5), 100);

const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!SERVICE) { console.error('❌ SERVICE key missing'); process.exit(1); }
const svcH = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };

/* ---------- خواندن صفحه‌بندی‌شده همه رسپی‌ها ---------- */
async function loadAll() {
  const out = [];
  let offset = 0;
  while (true) {
    const r = await fetch(SB_URL + '/rest/v1/recipes?select=slug,name_fa,name_en,kcal,protein,carbs,fat,fiber,sugar,desc_fa,desc_en,region,ingredients,steps,tips,substitutions&limit=1000&offset=' + offset, { headers: svcH });
    if (!r.ok) break;
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    out.push(...j);
    if (j.length < 1000) break;
    offset += 1000;
  }
  return out;
}

/* ---------- دروازه Gemini: فاصله ۶ث + بک‌آف ۶۰ث ---------- */
let lastGeminiAt = 0;
async function geminiFetch(model, body) {
  for (let back = 0; back < 2; back++) {
    const gap = Date.now() - lastGeminiAt;
    if (gap < 6000) await sleep(6000 - gap);
    lastGeminiAt = Date.now();
    try {
      const r = await fetch(API + '/models/' + model + ':generateContent?key=' + GEMINI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000)
      });
      if (r.status === 429) { console.log('   ⏳ 429 — صبر ۶۰ث…'); await sleep(60000); continue; }
      return r;
    } catch (e) { return null; }
  }
  return null;
}

async function geminiText(prompt) {
  if (!GEMINI) return '';
  for (const model of TEXT_MODELS) {
    const r = await geminiFetch(model, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, responseMimeType: 'application/json' }
    });
    if (!r) continue;
    if (!r.ok) { console.log('   ⚠ ' + model + ' → ' + r.status); continue; }
    const j = await r.json();
    const t = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text) || '';
    if (t) { console.log('   🧠 ' + model); return t; }
  }
  return '';
}

/* ---------- موتور پشتیبان: GitHub Models (بدون کلید اضافه) ---------- */
async function ghText(prompt) {
  if (!GH_TOKEN) return '';
  for (const model of GH_MODELS) {
    try {
      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
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
  return '';
}

async function aiText(prompt) {
  const t = await geminiText(prompt);
  if (t) return t;
  return await ghText(prompt);
}

function parseJSON(txt) {
  try { return JSON.parse(txt); } catch (e) {}
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

const ENRICH_PROMPT = (r, ings) => `تو سرآشپز و متخصص تغذیه هستی. برای غذای «${r.name_fa}» (${r.name_en || ''}) با مواد: ${ings || 'نامشخص'}، فقط یک JSON معتبر برگردان با این ساختار:
{
  "steps":["حداقل ۵ مرحله پخت با جزئیات واقعی","..."],
  "tips":["۲ تا ۳ نکته پخت یا جایگزین","..."],
  "desc_fa":"توضیح یک تا دو جمله‌ای جذاب فارسی درباره غذا",
  "desc_en":"One-sentence English description of the dish",
  "region":"کشور مبدأ مثل ایران، ایتالیا، ژاپن یا اگر ایرانی است استان مثل گیلان، آذربایجان شرقی، خوزستان",
  "substitutions":[{"from":"نام یک مادهٔ اصلی","to":"جایگزین منطقی"},{"from":"نام مادهٔ دیگر","to":"جایگزین"}],
  "protein":32,"carbs":40,"fat":22,"fiber":5,"sugar":3
}
region را فقط یکی از این‌ها بگذار (یا استان ایرانی اگر غذا ایرانی است): ایران، ایتالیا، ژاپن، تایلند، اسپانیا، مراکش، فرانسه، چین، هند، ترکیه، مکزیک، انگلستان، یونان، کره، لبنان، آمریکا، آرژانتین، برزیل، بین‌المللی. اعداد ماکرو منطقی و هماهنگ با کالری حدود ${r.kcal || 400}. فقط JSON.`;

(async () => {
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
})();
