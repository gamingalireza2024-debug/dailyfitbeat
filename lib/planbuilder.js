const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };
const h = { apikey: ANON, Authorization: "Bearer " + ANON };

export const MEAL_TYPES = [
  { key: "breakfast", fa: "صبحانه" },
  { key: "snack_am", fa: "میان‌وعده صبح" },
  { key: "lunch", fa: "ناهار" },
  { key: "snack_pm", fa: "میان‌وعده عصر" },
  { key: "dinner", fa: "شام" }
];
const TYPE_FA = { breakfast: "صبحانه", snack_am: "میان‌وعده صبح", lunch: "ناهار", snack_pm: "میان‌وعده عصر", dinner: "شام", snack: "میان‌وعده" };
const PREFS = {
  breakfast: ["breakfast"],
  snack_am: ["salad", "sandwich", "breakfast"],
  snack_pm: ["salad", "sandwich", "breakfast"],
  lunch: ["main", "iranian", "soup"],
  dinner: ["iranian", "main", "soup"]
};
const norm = s => (s || "").toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").trim();

const RESTRICTION_RULES = [
  { match: ["گیاهخواری", "vegetarian"], badKeys: ["chicken", "beef", "fish", "shrimp", "salmon"], badWords: ["مرغ", "گوشت", "ماهی", "میگو"] },
  { match: ["وگان", "vegan"], badKeys: ["chicken", "beef", "fish", "shrimp", "salmon", "egg", "greek-yogurt"], badWords: ["مرغ", "گوشت", "ماهی", "میگو", "تخم مرغ", "ماست", "پنیر", "عسل"] },
  { match: ["گلوتن", "gluten"], badKeys: ["bread"], badWords: ["نان", "گندم", "ماکارونی", "رشته"] }
];

export function activitySuggestion(level, goal) {
  const byLevel = {
    sedentary: ["پیاده‌روی سبک ۲۰ دقیقه‌ای روزانه", "حرکات کششی و نرمشی سبک"],
    light: ["پیاده‌روی سریع ۳۰ دقیقه‌ای", "دوچرخه‌سواری سبک، ۳ روز در هفته"],
    moderate: ["دوچرخه‌سواری یا شنا ۴۵ دقیقه‌ای", "تمرینات سبک قدرتی، ۲ روز در هفته"],
    active: ["تمرین ترکیبی هوازی + قدرتی", "پیاده‌روی طولانی آخر هفته + فعالیت منظم"]
  };
  const byGoal = {
    "کاهش وزن": "برای کاهش وزن: فعالیت هوازی منظم + پروتئین کافی در هر وعده",
    "افزایش وزن": "برای افزایش وزن: تمرین قدرتی سبک + میان‌وعده‌های مقوی",
    "حفظ وزن": "برای حفظ وزن: ترکیب متعادل هوازی و قدرتی",
    "تغذیه سالم": "فعالیت سبک روزانه به حفظ تعادل انرژی کمک می‌کند"
  };
  return {
    items: byLevel[level] || ["پیاده‌روی روزانه", "فعالیت سبک روزانه (کار، خرید، پله)"],
    note: byGoal[goal] || "",
    disclaimer: "این پیشنهادهای عمومی و کم‌خطر هستند و جایگزین توصیه پزشک نیستند. در صورت بارداری، بیماری یا محدودیت جسمی، پیش از شروع با متخصص مشورت کن."
  };
}

async function callGemini({ system, user }) {
  const model = process.env.AI_MODEL || "gemini-2.0-flash";
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 40000);
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, signal: ctrl.signal,
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }] })
    });
    if (!r.ok) throw new Error("provider " + r.status);
    const j = await r.json();
    return ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || "").join("");
  } finally { clearTimeout(to); }
}
function parsePlan(text) {
  try { const s = text.indexOf('{'), e = text.lastIndexOf('}'); if (s < 0 || e <= s) return null; return JSON.parse(text.slice(s, e + 1)); } catch (e) { return null; }
}

export async function generatePlan({ days, meals, profile, have, forbidden }) {
  days = Math.min(7, Math.max(1, +days || 1));
  let mealKeys = MEAL_TYPES.map(m => m.key).filter(k => (meals || []).includes(k));
  if (!mealKeys.length) mealKeys = ["breakfast", "lunch", "dinner"];

  // ---- کاتالوگ واقعی + اعمال محدودیت‌ها
  let catalog = [];
  if (Array.isArray(have) && have.length) {
    catalog = await (await fetch(SB_URL + "/rest/v1/rpc/match_recipes", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ have: have.slice(0, 12) }) })).json();
  }
  if (!Array.isArray(catalog) || catalog.length < 8) {
    catalog = await (await fetch(SB_URL + "/rest/v1/recipes?select=id,slug,name_fa,kcal,protein,carbs,fat,category,keys,ingredients&order=id.asc&limit=200", { headers: svc })).json();
  }
  catalog = (Array.isArray(catalog) ? catalog : []).filter(r => r.slug);

  const badTerms = [...(profile?.allergies || []), ...(profile?.disliked_foods || []), ...(forbidden || [])].map(norm).filter(Boolean);
  const rules = RESTRICTION_RULES.filter(r => (profile?.dietary_restrictions || []).some(t => { const n = norm(t); return r.match.some(m2 => n.includes(m2)); }));
  catalog = catalog.filter(r => {
    const name = norm(r.name_fa);
    const ing = norm(((r.ingredients || []).map(i => i.fa).join(" ") + " " + (r.keys || []).join(" ")));
    if (badTerms.some(t => name.includes(t) || ing.includes(t))) return false;
    for (const rule of rules) {
      if ((r.keys || []).some(k => rule.badKeys.includes(k))) return false;
      if (rule.badWords.some(w => ing.includes(w) || name.includes(w))) return false;
    }
    return true;
  }).slice(0, 100);
  if (!catalog.length) return { error: "recipe_catalog_unavailable", status: 502 };
  const map = {}; catalog.forEach(r => map[r.slug] = r);

  // ---- استخر میان‌وعده سبک از کل کاتالوگ
  const lightPool = catalog.filter(r => (r.kcal || 0) > 0 && (r.kcal || 0) <= 350);
  const mainPool = catalog.filter(r => (r.kcal || 0) >= 250);
  const used = {};
  function pickFor(t, seed) {
    const isSnack = t === "snack_am" || t === "snack_pm";
    const base = isSnack ? (lightPool.length ? lightPool : catalog) : (mainPool.length ? mainPool : catalog);
    const pref = base.filter(r => (PREFS[t] || []).includes(r.category));
    const pools = [
      pref.filter(r => !used[r.slug]),
      base.filter(r => !used[r.slug]),
      pref, base,
      catalog.filter(r => !used[r.slug]),
      catalog
    ];
    const pool = pools.find(p => p.length) || catalog;
    return pool[seed % pool.length];
  }
  function toMeal(t, rec, note) {
    used[rec.slug] = 1;
    return { type: t, type_fa: TYPE_FA[t] || "میان‌وعده", slug: rec.slug, recipe_id: rec.id || null, title: rec.name_fa, kcal: rec.kcal || 0, protein: rec.protein != null ? rec.protein : null, carbs: rec.carbs != null ? rec.carbs : null, fat: rec.fat != null ? rec.fat : null, note: note || "" };
  }

  // ---- کانتکست شخصی‌سازی
  const pc = [];
  if (profile?.goal) pc.push("هدف: " + profile.goal);
  if (profile?.calorie_target) pc.push("کالری روزانه هدف: " + profile.calorie_target);
  if (profile?.protein_target) pc.push("پروتئین هدف: " + profile.protein_target + "g");
  if (profile?.carbs_target) pc.push("کربوهیدرات هدف: " + profile.carbs_target + "g");
  if (profile?.fat_target) pc.push("چربی هدف: " + profile.fat_target + "g");
  if (profile?.food_preferences?.length) pc.push("علاقه‌مندی‌ها: " + profile.food_preferences.join("، "));
  if (profile?.dietary_restrictions?.length) pc.push("محدودیت‌ها: " + profile.dietary_restrictions.join("، "));
  if (profile?.allergies?.length) pc.push("حساسیت‌ها: " + profile.allergies.join("، "));
  if (badTerms.length) pc.push("هرگز پیشنهاد نده: " + badTerms.join("، "));

  const system = `تو برنامه‌ساز تغذیه DailyFitBeat هستی. فقط JSON معتبر برگردان.
قالب: {"days":[{"meals":[{"type":"breakfast","slug":"...","note":"..."}]}]}
الزام: هر روز دقیقاً شامل همه انواع وعده ${mealKeys.join(",")} باشد (میان‌وعده‌ها فراموش نشوند).
قانون‌ها: فقط slugهای لیست مجاز؛ تنوع کامل بدون تکرار؛ کالری روز نزدیک هدف؛ میان‌وعده‌ها سبک (زیر ۳۵۰ کالری)؛ محدودیت‌ها رعایت شود؛ بدون متن اضافه.`;
  const userMsg = `برنامه ${days} روزه با وعده‌های ${mealKeys.map(k => TYPE_FA[k]).join("، ")}.
${pc.join("\n")}
لیست مجاز (slug | نام | کالری | پروتئین | دسته):
${catalog.map(r => `- ${r.slug} | ${r.name_fa} | ${r.kcal || 0} | ${r.protein || 0} | ${r.category}`).join("\n")}`;

  let parsed = null;
  for (let i = 0; i < 2 && !parsed; i++) {
    const txt = await callGemini({ system, user: userMsg + (i ? "\nفقط JSON معتبر." : "") }).catch(e => { console.log("pb error:", String(e).slice(0, 200)); return ""; });
    parsed = parsePlan(txt);
  }
  if (!parsed || !Array.isArray(parsed.days)) return { error: "plan_parse_failed", status: 502 };

  // ---- ساخت روزها با تضمین حضور همه وعده‌ها + الزام میان‌وعده سبک
  const isSnackT = t => t === "snack_am" || t === "snack_pm";
  const outDays = [];
  for (let d = 0; d < days; d++) {
    let src = (parsed.days[d] && Array.isArray(parsed.days[d].meals)) ? parsed.days[d].meals : [];
    let sc = 0;
    src = src.map(m => (m && m.type === "snack") ? Object.assign({}, m, { type: (sc++ % 2 === 0 ? "snack_am" : "snack_pm") }) : m);
    const dayMeals = [];
    mealKeys.forEach((t, ti) => {
      let hit = src.find(m => m && m.type === t && map[m.slug] && !used[m.slug]);
      // ✱ میان‌وعده بالای ۳۵۰ کالریِ برگشتی از Gemini رد می‌شود → جایگزین از استخر سبک
      if (hit && isSnackT(t) && (map[hit.slug].kcal || 0) > 350) hit = null;
      if (hit) { dayMeals.push(toMeal(t, map[hit.slug], String(hit.note || "").slice(0, 80))); return; }
      const rec = pickFor(t, d * 5 + ti);
      if (rec) dayMeals.push(toMeal(t, rec, ""));
    });
    // تضمین نهایی حضور همه وعده‌های درخواستی
    mealKeys.forEach((t, ti) => {
      if (!dayMeals.some(m => m.type === t)) {
        const rec = pickFor(t, 200 + d * 5 + ti);
        if (rec) dayMeals.push(toMeal(t, rec, ""));
      }
    });
    dayMeals.sort((a, b) => mealKeys.indexOf(a.type) - mealKeys.indexOf(b.type));
    const sum = f => dayMeals.reduce((s, m) => s + (m[f] || 0), 0);
    const all = f => dayMeals.length && dayMeals.every(m => m[f] != null);
    outDays.push({ day: d + 1, meals: dayMeals, kcal: sum("kcal"), protein: all("protein") ? sum("protein") : null, carbs: all("carbs") ? sum("carbs") : null, fat: all("fat") ? sum("fat") : null });
  }
  if (!outDays.length || outDays.every(d => !d.meals.length)) return { error: "recipe_catalog_unavailable", status: 502 };

  const constraints = [];
  if (profile?.goal) constraints.push("هدف: " + profile.goal);
  if (profile?.calorie_target) constraints.push("کالری هدف: " + profile.calorie_target);
  (profile?.dietary_restrictions || []).forEach(x => constraints.push("محدودیت: " + x));
  (profile?.allergies || []).forEach(x => constraints.push("حساسیت: " + x));
  badTerms.forEach(x => constraints.push("ممنوع: " + x));

  return { status: 200, days: outDays, activity: activitySuggestion(profile?.activity_level, profile?.goal), constraints };
}
