/* DailyFitBeat — gen-images v2 (PRO)
   پرامپت اختصاصی هر غذا با Gemini + تولید Pollinations + کنترل بینایی */
import sharp from "sharp";
import fs from "fs";
import { execSync } from "child_process";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GEMINI = process.env.GEMINI_API_KEY || "";
const H = { apikey: SERVICE || ANON, Authorization: "Bearer " + (SERVICE || ANON) };
const FORCE = (process.env.FORCE || "0") === "1";
const API = "https://generativelanguage.googleapis.com/v1beta";
const TEXT_MODELS = ["gemini-3.6-flash", "gemini-3-flash", "gemini-2.5-flash"];

const STYLE = "Ultra-realistic cinematic premium food photography, square 1:1, dark moody background, warm natural side light, gentle steam, rich macro texture, shallow depth of field, appetizing, high-end editorial style, consistent series look. No text, no watermark, no people, no logo.";
const DISH = { soup: "a bowl of hot soup", salad: "a fresh colorful salad plate", sandwich: "a filled sandwich on a wooden board", breakfast: "a breakfast plate", iranian: "a Persian rice and stew dish, served on a plate", main: "a grilled main dish on a plate" };

const sleep = ms => new Promise(r => setTimeout(r, ms));

function push() {
  try { execSync("git add img && (git diff --staged --quiet || git commit -m 'food images pro [skip ci]') && (git pull --rebase origin main || true) && git push", { stdio: "inherit" }); }
  catch (e) { console.log("push err", String(e).slice(0, 200)); }
}

/* ---------- Gemini: توصیف ظاهری اختصاصی هر غذا ---------- */
async function geminiText(prompt) {
  if (!GEMINI) return "";
  for (const model of TEXT_MODELS) {
    try {
      const r = await fetch(API + "/models/" + model + ":generateContent?key=" + GEMINI, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const j = await r.json();
      if (!r.ok) { console.log("⚠ text", model, r.status); continue; }
      const t = (j.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      if (t) return t;
    } catch (e) {}
  }
  return "";
}

async function describeDish(r) {
  const ings = Array.isArray(r.ingredients) ? r.ingredients.slice(0, 6).map(i => i.fa).join("، ") : "";
  const out = await geminiText(`تو یک عکاس حرفه‌ای غذا هستی. برای غذای «${r.name_fa}» (${r.name_en || ""}) از دسته ${r.category} با مواد اصلی: ${ings || "نامشخص"}، فقط یک جمله انگلیسی بنویس که ظاهر دقیق غذای پخته‌شده را توصیف کند (رنگ، بافت، گارنیش، نحوه سرو در بشقاب). فقط همان جمله.`);
  if (out && out.length < 400) { console.log("   🧠 desc:", out.slice(0, 90)); return out; }
  return (r.name_en || r.name_fa) + ": " + (DISH[r.category] || "a delicious healthy dish") + ". " + (r.desc_en || "");
}

/* ---------- تولید تصویر ---------- */
async function genPollinations(prompt) {
  try {
    const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=800&height=800&nologo=true&seed=" + Math.floor(Math.random() * 1000000);
    const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) { console.log("   ⚠ pollinations", r.status); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 2000 ? buf : null;
  } catch (e) { console.log("   ⚠ pollinations err"); return null; }
}

/* ---------- کنترل بینایی ---------- */
async function visionCheck(buf, nameFa) {
  if (!GEMINI) return { ok: true, reason: "no-key — accepted" };
  try {
    const r = await fetch(API + "/models/" + TEXT_MODELS[0] + ":generateContent?key=" + GEMINI, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [
        { inline_data: { mime_type: "image/jpeg", data: buf.toString("base64") } },
        { text: "آیا تصویر دقیقاً غذای «" + nameFa + "» را نشان می‌دهد؟ فقط YES یا NO به همراه یک جمله توضیح." }
      ]}] })
    });
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!txt) return { ok: true, reason: "vision unavailable — accepted" };
    return { ok: /^\s*YES/i.test(txt), reason: txt.trim().split("\n").pop() };
  } catch (e) { return { ok: true, reason: "vision err — accepted" }; }
}

async function produceImage(r, styleDesc) {
  let lastBuf = null, lastReason = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const refined = attempt === 0 ? styleDesc : styleDesc + ". Previous issue: " + lastReason + ". Fix it, more authentic Persian styling.";
    const buf = await genPollinations(refined + ". " + STYLE);
    if (!buf) { lastReason = "no image"; await sleep(3000); continue; }
    const check = await visionCheck(buf, r.name_fa);
    if (check.ok) { console.log("   👁 ✓", check.reason); return buf; }
    lastBuf = buf; lastReason = check.reason;
    console.log("   👁 ✗", check.reason, "— retry", attempt + 1);
    await sleep(1500);
  }
  return lastBuf;
}

/* ---------- main ---------- */
const recipes = await (await fetch(SB_URL + "/rest/v1/recipes?select=slug,name_fa,name_en,desc_en,category,image,ingredients&limit=2000", { headers: H })).json();
console.log("recipes:", recipes.length, "| FORCE:", FORCE);

let done = 0, skip = 0;
for (const r of recipes) {
  const path = "img/" + r.slug + ".jpg";
  if (!FORCE && r.image === path && fs.existsSync(path)) { skip++; continue; }

  console.log("•", r.slug);
  const styleDesc = await describeDish(r);
  const buf = await produceImage(r, styleDesc);
  if (!buf) { console.log("   skip (no image)"); continue; }

  await sharp(buf).resize(800, 800, { fit: "cover" }).jpeg({ quality: 72 }).toFile(path);
  await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + r.slug, {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ image: path })
  });
  done++;
  console.log("   ok →", path);

  if (done % 5 === 0) push();
  await sleep(3000);
}
push();
console.log("🏁 done:", done, "| skipped:", skip);
