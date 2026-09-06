#!/usr/bin/env node
/* ============================================================
   DailyFitBeat — Discover Dishes (v2 — هدف‌گذاری وعده)
   صف import/dishes.txt را خودکار پر می‌کند تا «هر دو سه روز
   چند غذای جدید» همیشه کار کند — بدون دخالت دستی.

   جدید v2:
   ۱) توزیع واقعی دسته‌ها را از DB می‌خواند و «کمبود» هر وعده را
      حساب می‌کند — صبحانه و میان‌وعده (ساندویچ/سالاد) اولویت دارند
   ۲) خط صف سه‌فیلدی می‌شود: «نام | کشور | وعده»
      (importer وعده را به دستهٔ درست تبدیل می‌کند)
   ۳) اتصال به دروازهٔ مشترک _gemini.mjs (تشخیص خودکار مدل + تشخیص خطا)
   اجرا: node scripts/discover-dishes.mjs   (env: NEW_DISHES, MIN_QUEUE)
   ============================================================ */
import { existsSync, readFileSync, appendFileSync } from "fs";
import { geminiInit, geminiText } from "./_gemini.mjs";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FILE_IN = "import/dishes.txt";
const FILE_DONE = "import/done.txt";
const NEW_DISHES = Math.min(Math.max(parseInt(process.env.NEW_DISHES || "8", 10) || 8, 3), 20);
const MIN_QUEUE = Math.min(Math.max(parseInt(process.env.MIN_QUEUE || "12", 10) || 12, 0), 60);

/* سهم هدف هر دسته از کل رسپی‌ها (متناسب با نیاز یک رژیم کامل) */
const TARGET = { breakfast: 0.15, sandwich: 0.12, salad: 0.16, soup: 0.12, iranian: 0.2, main: 0.25 };
const FA = { breakfast: "صبحانه", sandwich: "ساندویچ میان‌وعده‌ای", salad: "سالاد", soup: "سوپ", iranian: "غذای ایرانی اصیل", main: "غذای اصلی بین‌المللی" };

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

/* ---------- نام‌های موجود + شمارش دسته‌ها ---------- */
const known = new Set();
const catCount = { breakfast: 0, sandwich: 0, salad: 0, soup: 0, iranian: 0, main: 0 };
for (const l of queue) known.add(norm(l.split("|")[0]));
try {
  for (const l of readFileSync(FILE_DONE, "utf8").split("\n")) {
    const t = l.trim();
    if (t && !t.includes("→")) known.add(norm(t.split("|")[0]));
  }
} catch (e) {}
try {
  let off = 0;
  while (true) {
    const r = await fetch(SB_URL + "/rest/v1/recipes?select=name_fa,name_en,category&limit=1000&offset=" + off, { headers: svcH });
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    for (const x of j) {
      known.add(norm(x.name_fa));
      if (x.name_en) known.add(norm(x.name_en));
      if (catCount[x.category] !== undefined) catCount[x.category]++;
    }
    if (j.length < 1000) break;
    off += 1000;
  }
} catch (e) { console.log("⚠ خواندن DB ناقص: " + e.message); }
const total = Object.values(catCount).reduce((a, b) => a + b, 0) || 1;
console.log("📚 نام‌های شناخته‌شده: " + known.size + " | رسپی: " + total);

/* ---------- کمبود هر دسته ---------- */
const deficits = Object.keys(TARGET)
  .map((c) => ({ c, need: Math.max(0, Math.round(TARGET[c] * total) - catCount[c]), have: catCount[c] }))
  .sort((a, b) => b.need - a.need);
console.log("📊 کمبود نسبت به هدف: " + deficits.map((d) => d.c + " " + d.have + "/" + Math.round(TARGET[d.c] * total) + " (کمبود " + d.need + ")").join(" | "));

/* تقسیم NEW_DISHES بین دسته‌های کمبوددار (حداقل ۱ برای دو دستهٔ اول) */
const needful = deficits.filter((d) => d.need > 0);
const plan = [];
if (needful.length) {
  const sumNeed = needful.reduce((a, d) => a + d.need, 0);
  let left = NEW_DISHES;
  for (const d of needful) {
    if (left <= 0) break;
    const give = Math.max(d === needful[0] ? 2 : 1, Math.round((d.need / sumNeed) * NEW_DISHES));
    plan.push({ c: d.c, n: Math.min(give, left) });
    left -= plan[plan.length - 1].n;
  }
  if (left > 0 && plan.length) plan[0].n += left;
} else {
  plan.push({ c: "main", n: Math.ceil(NEW_DISHES / 2) }, { c: "iranian", n: NEW_DISHES - Math.ceil(NEW_DISHES / 2) });
}
console.log("🎯 برنامهٔ این اجرا: " + plan.map((p) => p.n + "× " + FA[p.c]).join(" + "));

/* ---------- Gemini (دروازهٔ مشترک) ---------- */
await geminiInit();

const planFa = plan.map((p) => p.n + " غذای «" + FA[p.c] + "» (دستهٔ " + p.c + ")").join(" و ");
const prompt = `تو سرآشپز و متخصص تغذیهٔ سایت فیتنس هستی. دقیقاً ${NEW_DISHES} غذای «واقعی و جدید» پیشنهاد بده که در لیست ممنوع نیستند.
ترکیب دقیق این اجرا: ${planFa}.
قواعد:
- غذاهای ساده و قابل پخت خانگی، مناسب رژیم فیتنس و لاغری
- کالری معقول (صبحانه ۲۰۰ تا ۴۵۰، میان‌وعده زیر ۳۵۰، غذای اصلی ۳۵۰ تا ۶۰۰)
- هر غذا در یک خط با این قالب دقیق: «نام فارسی | کشور یا منطقه | کلید دسته»
  کلید دسته یکی از این‌ها: ${plan.map((p) => p.c).join(" / ")}
- هیچ‌کدام نباید با لیست ممنوع حتی نزدیک باشند
فقط JSON برگردان: {"dishes":["نام فارسی | کشور | دسته","..."]}
لیست ممنوع (این‌ها را نباید تکرار کنی):
${[...known].slice(0, 900).join(" ، ")}`;

console.log("🤖 درخواست پیشنهاد غذا…");
const raw = await geminiText(prompt, { generationConfig: { temperature: 1.0 } });
let dishes = [];
try {
  const j = JSON.parse(raw);
  dishes = Array.isArray(j.dishes) ? j.dishes : [];
} catch (e) {
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (m) { try { dishes = JSON.parse(m[0]).dishes || []; } catch (e2) {} }
}

/* ---------- پاکسازی و افزودن ---------- */
const validCat = new Set(Object.keys(TARGET));
let added = 0;
for (const d of dishes) {
  const parts = String(d).split("|").map((s) => s.trim());
  let name = parts[0] || "";
  const region = parts[1] || "";
  let cat = (parts[2] || "").toLowerCase().replace(/\s+/g, "");
  if (!validCat.has(cat)) {
    /* اگر مدل دسته را نداد، از برنامهٔ این اجرا به‌ترتیب پر کن */
    cat = plan.length ? plan[added % plan.length].c : "main";
  }
  const line = [name, region || "ایران", cat].filter(Boolean).join(" | ");
  if (!name || name.length > 60) continue;
  if (known.has(norm(name))) continue;
  known.add(norm(name));
  appendFileSync(FILE_IN, line + "\n", "utf8");
  console.log("   ➕ " + line);
  added++;
}
console.log(added ? "🏁 " + added + " غذای جدید به صف اضافه شد." : "🤷 پیشنهاد تازه‌ای قبول نشد — اجرای بعدی دوباره تلاش می‌کند.");
