const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";

/* صفحه‌های استاتیک + لندینگ‌ها */
const STATIC = [
  { loc: "https://dailyfitbeat.ir/", pri: "1.0", chg: "weekly" },
  { loc: "https://dailyfitbeat.ir/recipes.html", pri: "0.9", chg: "weekly" },
  { loc: "https://dailyfitbeat.ir/weight-loss.html", pri: "0.9", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/weekly-plan.html", pri: "0.9", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/ai-assistant.html", pri: "0.9", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/planner.html", pri: "0.8", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/ai.html", pri: "0.8", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/market.html", pri: "0.7", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/pro.html", pri: "0.7", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/about.html", pri: "0.4", chg: "yearly" }
];

/* صفحات فیلتردار SEO — باید با برچسب‌های app.js هماهنگ بماند */
const CATEGORIES = ["iranian", "main", "salad", "sandwich", "breakfast", "soup"];
const GOALS = ["high-protein", "weight-loss", "quick", "vegetarian"];
const MEALS = ["breakfast", "lunch", "dinner", "snack"];
const CUISINE_FA = { iran: "ایران", gilan: "گیلان", italian: "ایتالیا", japanese: "ژاپن", thai: "تایلند", spanish: "اسپانیا", moroccan: "مراکش", french: "فرانسه", chinese: "چین", indian: "هند", turkish: "ترکیه", mexican: "مکزیک", english: "انگلستان", greek: "یونان", korean: "کره", lebanese: "لبنان", argentinian: "آرژانتین", brazilian: "برزیل", australian: "استرالیا", american: "آمریکا" };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function urlLine(loc, pri, chg) {
  return "<url><loc>" + esc(loc) + "</loc><lastmod>" + today + "</lastmod><changefreq>" + chg + "</changefreq><priority>" + pri + "</priority></url>";
}

export default async function handler(req, res) {
  let recipes = [], products = [];
  try {
    let r1 = await fetch(SB_URL + "/rest/v1/recipes?select=slug,region,status,noindex&status=eq.published&noindex=eq.false&limit=1000", { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
    if (!r1.ok) r1 = await fetch(SB_URL + "/rest/v1/recipes?select=slug,region&limit=1000", { headers: { apikey: ANON, Authorization: "Bearer " + ANON } }); // قبل از اجرای SQL فاز ۲
    const r2 = await fetch(SB_URL + "/rest/v1/products?select=id&active=eq.true&limit=200", { headers: { apikey: ANON, Authorization: "Bearer " + ANON } });
    if (r1.ok) recipes = await r1.json();
    if (r2.ok) products = await r2.json();
  } catch (e) { recipes = []; products = []; }

  const today = new Date().toISOString().slice(0, 10);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

  for (const p of STATIC) lines.push(urlLine(p.loc, p.pri, p.chg));

  /* صفحات دسته / هدف / وعده */
  for (const c of CATEGORIES) lines.push(urlLine("https://dailyfitbeat.ir/recipes/category/" + c, "0.8", "weekly"));
  for (const g of GOALS) lines.push(urlLine("https://dailyfitbeat.ir/recipes/goal/" + g, "0.8", "weekly"));
  for (const m of MEALS) lines.push(urlLine("https://dailyfitbeat.ir/recipes/meal/" + m, "0.7", "weekly"));

  /* صفحات آشپزی کشورها — فقط کشورهایی که واقعاً رسپی دارند */
  const regions = new Set((recipes || []).map(r => (r.region || "").trim()).filter(Boolean));
  for (const slug of Object.keys(CUISINE_FA)) {
    if (regions.has(CUISINE_FA[slug])) lines.push(urlLine("https://dailyfitbeat.ir/recipes/cuisine/" + slug, "0.7", "weekly"));
  }

  /* محصولات دیجیتال */
  for (const p of products || []) {
    if (p && p.id) lines.push(urlLine("https://dailyfitbeat.ir/market/p/" + p.id, "0.6", "monthly"));
  }

  /* رسپی‌ها با URL تمیز */
  for (const r of recipes || []) {
    if (!r || !r.slug) continue;
    lines.push(urlLine("https://dailyfitbeat.ir/recipes/" + encodeURIComponent(r.slug), "0.6", "monthly"));
  }

  lines.push("</urlset>");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(lines.join("\n"));
}
