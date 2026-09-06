#!/usr/bin/env node
/* ============================================================
   DailyFitBeat — Audit Images (v1)
   عکسهای بی‌استفادهٔ img/ را پیدا (و با CLEAN=1 پاک) می‌کند.
   محافظه‌کار: به‌جای اسکن لفظی، هر دو شکل img/<slug>.jpg و
   img/recipes/<slug>.jpg برای «هر» رسپی دیتابیس جزو استفاده‌شده‌هاست
   (چون gen-images بین این دو مسیر مهاجرت می‌کند) — پس هیچ عکس
   متصل به یک رسپی واقعی حذف نمی‌شود.
   اجرا:      node scripts/audit-images.mjs          (فقط گزارش)
   اجرا:      CLEAN=1 node scripts/audit-images.mjs  (حذف واقعی)
   ============================================================ */
import fs from "fs";
import path from "path";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CLEAN = process.env.CLEAN === "1";
const SKIP_DIRS = new Set([".git", "node_modules", "img", ".vercel"]);
const TEXT_EXT = /\.(html|js|mjs|css|json|webmanifest|xml|txt|md)$/i;

if (!SERVICE) { console.error("❌ SERVICE key missing"); process.exit(1); }
const svcH = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };

/* ---------- ۱) مسیرهای استفاده‌شده از دیتابیس ---------- */
const referenced = new Set();
const slugForms = new Set();

async function dbRefs() {
  // recipes: image فعلی + هر دو شکل مسیر برای همهٔ اسلاگ‌ها
  let off = 0;
  while (true) {
    const r = await fetch(SB_URL + "/rest/v1/recipes?select=slug,image&limit=1000&offset=" + off, { headers: svcH });
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    for (const x of j) {
      if (x.image) referenced.add(x.image.trim());
      slugForms.add("img/" + x.slug + ".jpg");
      slugForms.add("img/recipes/" + x.slug + ".jpg");
    }
    if (j.length < 1000) break;
    off += 1000;
  }
  // products
  try {
    const r = await fetch(SB_URL + "/rest/v1/products?select=image&limit=1000", { headers: svcH });
    const j = await r.json();
    if (Array.isArray(j)) for (const x of j) if (x.image) referenced.add(x.image.trim());
  } catch (e) { console.log("⚠ products خوانده نشد: " + e.message); }
}
await dbRefs();
for (const p of slugForms) referenced.add(p);
console.log("🗄 از دیتابیس: " + referenced.size + " مسیر محافظت‌شده (" + slugForms.size / 2 + " رسپی)");

/* ---------- ۲) ارجاع‌های متنی در سورس ---------- */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (TEXT_EXT.test(e.name)) out.push(p);
  }
  return out;
}
let litRefs = 0;
for (const f of walk(".")) {
  const s = fs.readFileSync(f, "utf8");
  const m = s.match(/img\/[\w\-. ]+\.(?:jpg|jpeg|png|webp|svg|ico)/gi);
  if (m) { for (const x of m) referenced.add(x.replace(/\s+/g, "")); litRefs += m.length; }
}
console.log("📄 از سورس: " + litRefs + " ارجاع لفظی");

/* ---------- ۳) فایل‌های واقعی img/ ---------- */
function walkImg(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkImg(p, out);
    else out.push(p);
  }
  return out;
}
const files = walkImg("img").map((p) => p.replace(/\\/g, "/"));
console.log("🖼 فایل واقعی: " + files.length);

/* ---------- ۴) مقایسه ---------- */
const unused = files.filter((f) => !referenced.has(f));
const missing = [...referenced].filter((r) => !files.includes(r) && !r.includes("http"));
console.log("\n===== گزارش =====");
console.log("بی‌استفاده: " + unused.length + " | گمشده (ارجاع بدون فایل): " + missing.length);
if (unused.length) {
  let sz = 0;
  for (const f of unused) { try { sz += fs.statSync(f).size; } catch (e) {} }
  console.log("حجم قابل آزادسازی: " + (sz / 1048576).toFixed(1) + "MB\n");
  for (const f of unused) console.log("  " + f);
}
if (missing.length) {
  console.log("\n--- گمشده‌ها (۵۰ تای اول) ---");
  for (const f of missing.slice(0, 50)) console.log("  " + f);
}

if (CLEAN && unused.length) {
  for (const f of unused) { try { fs.unlinkSync(f); } catch (e) {} }
  // پوشه‌های خالی بمانند (img/recipes لازم است)
  console.log("\n🧹 " + unused.length + " فایل حذف شد.");
}
