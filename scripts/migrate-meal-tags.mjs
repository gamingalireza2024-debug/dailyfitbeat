/* DailyFitBeat — Migrate Meal Tags (v1)
   برای هر رسپی، فیلد جدید meal_tags را از روی category/meal_type/macros/time_min
   استنتاج می‌کند. این کار بدون API و فقط با منطق انجام می‌شود.

   مجموعه تگ‌های استاندارد (همان چیپ‌های منوی صفحه رسپی‌ها):

   وعده (meal):
     - breakfast   → category=breakfast یا meal_type ∋ breakfast
     - lunch       → meal_type ∋ lunch یا category ∈ {main, iranian}
     - dinner      → meal_type ∋ dinner یا kcal ≤ 450
     - quick-dinner→ time_min ≤ 20 و (dinner یا main)  ← تگ ویژه: «شام فوری»
     - snack       → category=sandwich یا kcal ≤ 250

   هدف (goal):
     - high-protein → protein ≥ 25
     - vegetarian   → tags ∋ vegetarian (موجود)
     - weight-loss  → kcal ≤ 350
     - quick        → time_min ≤ 20
     - low-carb     → carbs ≤ 15
     - keto         → carbs ≤ 10 و fat ≥ 15

   خروجی: فیلد meal_tags (آرایه‌ای از رشته‌های انگلیسی) برای هر رسپی.
   این فیلد توسط recipes.html و app.js برای فیلتر استفاده می‌شود.
*/
const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };

if (!SERVICE) { console.error("❌ SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- قوانین استنتاج تگ ---------- */
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

  // وعده‌ها
  if (cat === "breakfast" || mt.includes("breakfast")) out.add("breakfast");
  if (mt.includes("lunch") || cat === "main" || cat === "iranian") out.add("lunch");
  // شام: فقط اگه meal_type صریح dinner باشه، یا کالری متوسط‌رو (۳۰۰-۴۵۰) داشته باشه
  if (mt.includes("dinner") || (kcal >= 300 && kcal <= 450 && cat !== "breakfast")) out.add("dinner");
  // شام فوری: <= 20 دقیقه و (شام یا غذای اصلی)
  if (time > 0 && time <= 20 && (out.has("dinner") || cat === "main")) out.add("quick-dinner");
  // میان‌وعده: ساندویچ یا کم‌کالری (زیر ۲۵۰)
  if (cat === "sandwich" || (kcal > 0 && kcal <= 250)) out.add("snack");

  // اهداف
  if (protein >= 25) out.add("high-protein");
  if (tags.includes("vegetarian") || tags.includes("گیاهی")) out.add("vegetarian");
  if (kcal > 0 && kcal <= 350) out.add("weight-loss");
  if (time > 0 && time <= 20) out.add("quick");
  if (carbs > 0 && carbs <= 15) out.add("low-carb");
  if (carbs > 0 && carbs <= 10 && fat >= 15) out.add("keto");

  return Array.from(out);
}

/* ---------- خواندن همهٔ رسپی‌ها ---------- */
async function loadAll() {
  const out = [];
  let offset = 0;
  while (true) {
    const r = await fetch(SB_URL + "/rest/v1/recipes?select=slug,category,meal_type,kcal,protein,carbs,fat,time_min,tags,meal_tags&limit=1000&offset=" + offset, { headers: H });
    if (!r.ok) { console.error("load err:", r.status); break; }
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    out.push(...j);
    if (j.length < 1000) break;
    offset += 1000;
  }
  return out;
}

(async () => {
  console.log("📖 خواندن همه رسپی‌ها…");
  const all = await loadAll();
  console.log("   کل: " + all.length);

  let updated = 0, skipped = 0, failed = 0;
  const tagStats = {};

  for (const r of all) {
    const derived = deriveMealTags(r).sort();
    const existing = Array.isArray(r.meal_tags) ? r.meal_tags.slice().sort() : [];

    // فقط اگه فرق داره (یا meal_tags خالیه) آپدیت کن
    const sameLength = existing.length === derived.length;
    const sameContent = sameLength && derived.every((t, i) => t === existing[i]);
    if (sameContent) { skipped++; continue; }

    // آمار تگ‌ها برای گزارش
    derived.forEach((t) => { tagStats[t] = (tagStats[t] || 0) + 1; });

    const res = await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + encodeURIComponent(r.slug), {
      method: "PATCH",
      headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ meal_tags: derived }),
    });

    if (res.ok || res.status === 204) updated++;
    else { console.log("   ❌ PATCH " + r.slug + " → " + res.status); failed++; }

    // نرخ محدود: ۵۰ PATCH در ثانیه (Supabase راحت تحمل می‌کند)
    await sleep(20);
  }

  console.log("\n🏁 meal_tags آپدیت شد: " + updated + " | skip: " + skipped + " | fail: " + failed);
  console.log("\n=== توزیع تگ‌ها (پس از مهاجرت) ===");
  Object.entries(tagStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([t, n]) => console.log("   " + t + ": " + n));
})();
