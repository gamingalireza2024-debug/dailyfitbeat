import sharp from "sharp";
import fs from "fs";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
const FORCE = (process.env.FORCE || "false") === "true";
const STYLE = "Ultra-realistic cinematic premium food photography, square 1:1, dark moody background, warm natural side light, gentle steam, rich macro texture, shallow depth of field, appetizing, high-end editorial style, consistent series look. No text, no watermark, no people, no logo.";

async function gen(prompt) {
  try {
    const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) + "?width=800&height=800&nologo=true&seed=" + Math.floor(Math.random() * 1000000);
    const r = await fetch(url);
    console.log("status:", r.status);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 2000) return null;
    return buf;
  } catch (e) { console.log("FETCH-ERR", String(e)); return null; }
}

const recipes = await (await fetch(SB_URL + "/rest/v1/recipes?select=slug,name_en,desc_en,image", { headers: H })).json();
console.log("recipes:", recipes.length);
let done = 0;
for (const r of recipes) {
  const path = "img/" + r.slug + ".jpg";
  if (!FORCE && r.image === path && fs.existsSync(path)) continue;
  const buf = await gen((r.desc_en || r.name_en) + ". Persian healthy dish. " + STYLE);
  if (!buf) { console.log("skip", r.slug); continue; }
  await sharp(buf).resize(800, 800, { fit: "cover" }).jpeg({ quality: 72 }).toFile(path);
  await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + r.slug, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ image: path }) });
  done++; console.log("ok", r.slug);
  await new Promise(x => setTimeout(x, 3000));
}
console.log("done", done);
