import sharp from "sharp";
import fs from "fs";
import { execSync } from "child_process";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
const FORCE = (process.env.FORCE || "false") === "true";
const STYLE = "Ultra-realistic cinematic premium food photography, square 1:1, dark moody background, warm natural side light, gentle steam, rich macro texture, shallow depth of field, appetizing, high-end editorial style, consistent series look. No text, no watermark, no people, no logo.";
const DISH = { soup: "a bowl of hot soup", salad: "a fresh colorful salad plate", sandwich: "a filled sandwich on a wooden board", breakfast: "a breakfast plate", iranian: "a Persian rice and stew dish, served on a plate", main: "a grilled main dish on a plate" };

function push() {
  try { execSync("git add img && (git diff --staged --quiet || git commit -m 'food images') && (git pull --rebase origin main || true) && git push", { stdio: "inherit" }); }
  catch (e) { console.log("push err", String(e).slice(0, 200)); }
}
async function gen(prompt) {
  try {
    const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=800&height=800&nologo=true&seed=" + Math.floor(Math.random() * 1000000);
    const r = await fetch(url);
    if (!r.ok) { console.log("status:", r.status); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 2000) return null;
    return buf;
  } catch (e) { console.log("FETCH-ERR", String(e)); return null; }
}

const recipes = await (await fetch(SB_URL + "/rest/v1/recipes?select=slug,name_en,desc_en,category,image", { headers: H })).json();
console.log("recipes:", recipes.length);
let done = 0;
for (const r of recipes) {
  const path = "img/" + r.slug + ".jpg";
  if (!FORCE && r.image === path && fs.existsSync(path)) continue;
  const dish = DISH[r.category] || "a delicious healthy dish";
  const prompt = r.name_en + ": " + dish + ". " + (r.desc_en || "") + ". " + STYLE;
  const buf = await gen(prompt);
  if (!buf) { console.log("skip", r.slug); continue; }
  await sharp(buf).resize(800, 800, { fit: "cover" }).jpeg({ quality: 72 }).toFile(path);
  await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + r.slug, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ image: path }) });
  done++; console.log("ok", r.slug);
  if (done % 10 === 0) push();
  await new Promise(x => setTimeout(x, 3000));
}
push();
console.log("done", done);
