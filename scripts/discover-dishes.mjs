#!/usr/bin/env node
/* ============================================================
   DailyFitBeat — Discover Dishes (v1)
   صف import/dishes.txt را خودکار پر می‌کند تا «هر دو سه روز
   چند غذای جدید» همیشه کار کند — بدون دخالت دستی.
   منطق:
   ۱) اگر صف ≥ MIN_QUEUE باشد → کاری نکن
   ۲) نام رسپی‌های موجود (DB) + done.txt را می‌خواند
   ۳) از Gemini می‌خواهد N غذای «تکراری‌نبوده» پیشنهاد دهد
      (نیمی ایرانی سنتی، نیمی بین‌المللی سالم، پخش در دسته‌ها)
   ۴) دوباره‌ها را حذف و بقیه را به dishes.txt اضافه می‌کند
   اجرا:  node scripts/discover-dishes.mjs   (env: NEW_DISHES, MIN_QUEUE)
   ============================================================ */
import { existsSync, readFileSync, appendFileSync } from "fs";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI = process.env.GEMINI_API_KEY || "";
const API = "https://generativelanguage.googleapis.com/v1beta";
const FILE_IN = "import/dishes.txt";
const FILE_DONE = "import/done.txt";
const NEW_DISHES = Math.min(Math.max(parseInt(process.env.NEW_DISHES || "8", 10) || 8, 3), 20);
const MIN_QUEUE = Math.min(Math.max(parseInt(process.env.MIN_QUEUE || "12", 10) || 12, 0), 60);
const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const norm = (s) =>
  String(s || "").toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SERVICE) { console.error("❌ SERVICE key missing"); process.exit(1); }
const svcH = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };

const queue = existsSync(FILE_IN)
  ? readFileSync(FILE_IN, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
  : [];
console.log("📋 صف فعلی: " + queue.length + " غذا");
if (queue.length >= MIN_QUEUE) {
  console.log("✅ صف به‌اندازهٔ کافی پر است — نیازی به پیشنهاد جدید نیست.");
  process.exit(0);
}

/* ---------- نام‌های موجود ---------- */
const known = new Set();
for (const l of queue) known.add(norm(l.split("|")[0]));
try {
  for (const l of readFileSync(FILE_DONE, "utf8").split("\n")) {
    const t = l.trim();
    if (t) known.add(norm(t.split("|")[0]));
  }
} catch (e) {}
try {
  let off = 0;
  while (true) {
    const r = await fetch(SB_URL + "/rest/v1/recipes?select=name_fa,name_en&limit=1000&offset=" + off, { headers: svcH });
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    for (const x of j) { known.add(norm(x.name_fa)); known.add(norm(x.name_en)); }
    if (j.length < 1000) break;
    off += 1000;
  }
} catch (e) { console.log("⚠ خواندن DB ناقص: " + e.message); }
console.log("📚 نام‌های شناخته‌شده: " + known.size);

/* ---------- Gemini ---------- */
let lastAt = 0;
async function geminiText(prompt) {
  if (!GEMINI) return "";
  for (const model of TEXT_MODELS) {
    for (let back = 0; back < 2; back++) {
      const gap = Date.now() - lastAt;
      if (gap < 6000) await sleep(6000 - gap);
      lastAt = Date.now();
      try {
        const r = await fetch(API + "/models/" + model + ":generateContent?key=" + GEMINI, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 1.0, responseMimeType: "application/json" }
          }),
          signal: AbortSignal.timeout(60000)
        });
        if (r.status === 429) { await sleep(60000); continue; }
        if (!r.ok) { console.log("   ⚠ " + model + " → " + r.status); break; }
        const j = await r.json();
        const t = (j.candidates?.[0]?.content?.parts?.[0]?.text) || "";
        if (t) return t;
      } catch (e) { break; }
    }
  }
  return "";
}

const prompt = `تو سرآشپز و متخصص تغذیهٔ سایت فیتنس هستی. ${NEW_DISHES} غذای «واقعی و جدید» پیشنهاد بده که در لیست ممنوع نیستند.
قواعد:
- نیمی (۴ تا) غذای ایرانی اصیل (مثلاً از گیلان، آذربایجان، خوزستان، شیراز…) و نیمی بین‌المللی سالم (آسیایی، مدیترانه، آمریکای لاتین…)
- غذاهای ساده و قابل پخت خانگی، مناسب رژیم فیتنس
- هر غذا در یک خط با این قالب: «نام فارسی | کشور یا منطقه»
- هیچ‌کدام نباید با لیست ممنوع حتی نزدیک باشند
فقط JSON برگردان: {"dishes":["نام فارسی | کشور","..."]}
لیست ممنوع (این‌ها را نباید تکرار کنی):
${[...known].slice(0, 900).join(" ، ")}`;

console.log("🤖 درخواست پیشنهاد غذا…");
const raw = await geminiText(prompt);
let dishes = [];
try {
  const j = JSON.parse(raw);
  dishes = Array.isArray(j.dishes) ? j.dishes : [];
} catch (e) {
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (m) { try { dishes = JSON.parse(m[0]).dishes || []; } catch (e2) {} }
}

/* ---------- پاکسازی و افزودن ---------- */
let added = 0;
for (const d of dishes) {
  const line = String(d).replace(/\s*\|\s*/, " | ").trim();
  const name = line.split("|")[0].trim();
  if (!name || name.length > 60) continue;
  if (known.has(norm(name))) continue;
  known.add(norm(name));
  appendFileSync(FILE_IN, line + "\n", "utf8");
  console.log("   ➕ " + line);
  added++;
}
console.log(added ? "🏁 " + added + " غذای جدید به صف اضافه شد." : "🤷 پیشنهاد تازه‌ای قبول نشد — اجرای بعدی دوباره تلاش می‌کند.");
