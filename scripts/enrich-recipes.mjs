/* DailyFitBeat — Enrich Recipes: پرکردن جاهای خالی رسپی‌های ناقص
   فقط فیلدهای خالی را PATCH می‌کند؛ داده سالم دست نمی‌خورد. */
const SB_URL = 'https://hvqchqqlfcjxsohxywbd.supabase.co';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI = process.env.GEMINI_API_KEY || '';
const API = 'https://generativelanguage.googleapis.com/v1beta';
const TEXT_MODELS = ['gemini-3.6-flash', 'gemini-3-flash', 'gemini-2.5-flash'];
const LIMIT = parseInt(process.env.LIMIT || '20', 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!SERVICE) { console.error('❌ SERVICE key missing'); process.exit(1); }
const svcH = { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE };

let geminiDead = false;

async function polliText(prompt) {
  try {
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt), { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return '';
    console.log('   🌐 text via pollinations');
    return await r.text();
  } catch (e) { return ''; }
}

async function aiText(prompt) {
  if (!geminiDead && GEMINI) {
    for (const model of TEXT_MODELS) {
      try {
        const r = await fetch(API + '/models/' + model + ':generateContent?key=' + GEMINI, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, responseMimeType: 'application/json' }
          })
        });
        const j = await r.json();
        if (r.status === 429) { console.log('   ⏳ سهمیه Gemini — fallback به Pollinations'); geminiDead = true; break; }
        if (!r.ok) { console.log('   ⚠ ' + model + ' → ' + r.status); continue; }
        const t = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text) || '';
        if (t) { console.log('   🧠 ' + model); return t; }
      } catch (e) {}
    }
  }
  return await polliText(prompt);
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
  "carbs":40,"fat":22,"fiber":5,"sugar":3,
  "desc_en":"One-sentence English description of the dish",
  "image_style":"short English description of the exact cooked dish appearance (color, texture, garnish, plating)"
}
اعداد ماکرو منطقی و هماهنگ با کالری حدود ${r.kcal || 400}. فقط JSON.`;

(async () => {
  console.log('📖 خواندن همه رسپی‌ها…');
  const all = await (await fetch(SB_URL + '/rest/v1/recipes?select=slug,name_fa,name_en,kcal,desc_en,ingredients,steps,tips,carbs,fat,fiber,sugar&limit=2000', { headers: svcH })).json();
  console.log('   کل: ' + all.length);

  const incomplete = all.filter(r =>
    (!Array.isArray(r.steps) || !r.steps.length) ||
    (!Array.isArray(r.tips) || !r.tips.length) ||
    !r.carbs || !r.fat
  );
  console.log('   ناقص: ' + incomplete.length + ' | این اجرا: ' + Math.min(LIMIT, incomplete.length));

  let ok = 0, fail = 0;
  for (const r of incomplete.slice(0, LIMIT)) {
    console.log('• ' + r.name_fa + ' (' + r.slug + ')');
    const ings = Array.isArray(r.ingredients) ? r.ingredients.map(i => i.fa).join('، ') : '';
    const raw = await aiText(ENRICH_PROMPT(r, ings));
    const p = parseJSON(raw);
    if (!p) { console.log('   ❌ JSON نامعتبر'); fail++; continue; }

    const patch = {};
    if ((!Array.isArray(r.steps) || !r.steps.length) && Array.isArray(p.steps) && p.steps.length) patch.steps = p.steps;
    if ((!Array.isArray(r.tips) || !r.tips.length) && Array.isArray(p.tips) && p.tips.length) patch.tips = p.tips;
    if (!r.carbs && p.carbs) patch.carbs = Number(p.carbs) || 0;
    if (!r.fat && p.fat) patch.fat = Number(p.fat) || 0;
    if (!r.fiber && p.fiber) patch.fiber = Number(p.fiber) || 0;
    if (!r.sugar && p.sugar) patch.sugar = Number(p.sugar) || 0;
    if ((!r.desc_en || r.desc_en === r.name_en) && p.desc_en) patch.desc_en = p.desc_en;

    if (!Object.keys(patch).length) { console.log('   ⏭ چیزی برای پرکردن نبود'); continue; }

    const res = await fetch(SB_URL + '/rest/v1/recipes?slug=eq.' + encodeURIComponent(r.slug), {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, svcH),
      body: JSON.stringify(patch)
    });
    if (res.ok || res.status === 204) { console.log('   ✅ پر شد: ' + Object.keys(patch).join(', ')); ok++; }
    else { console.log('   ❌ PATCH ' + res.status); fail++; }

    await sleep(4000);
  }

  console.log(`\n🏁 Enriched: ${ok} | failed: ${fail} | باقی‌مانده برای اجراهای بعد: ${Math.max(0, incomplete.length - LIMIT)}`);
})();
