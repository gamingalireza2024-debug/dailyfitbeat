import sharp from "sharp";
import fs from "fs";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const H = { apikey: KEY, Authorization: "Bearer " + KEY };
const FORCE = (process.env.FORCE || "false") === "true";
const GKEY = process.env.GEMINI_API_KEY;
const STYLE = "Ultra-realistic cinematic premium food photography, square 1:1, dark moody background, warm natural side light, gentle steam, rich macro texture, shallow depth of field, appetizing, high-end editorial style, consistent series look. No text, no watermark, no people, no logo.";
const MODELS = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview", "gemini-2.0-flash-preview-image-generation"];

async function gen(prompt) {
  for (const m of MODELS) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GKEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const j = await r.json();
      if (!r.ok) { console.log("API-ERR", m, r.status, JSON.stringify(j).slice(0, 400)); continue; }
      const b64 = j?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (b64) return b64;
      console.log("NO-IMG", m, JSON.stringify(j).slice(0, 400));
    } catch (e) { console.log("FETCH-ERR", m, String(e)); }
  }
  return null;
}

console.log("KEY-LOADED:", GKEY ? GKEY.slice(0, 6) + "..." : "MISSING");
const recipes = await (await fetch(SB_URL + "/rest/v1/recipes?select=slug,name_en,desc_en,image", { headers: H })).json();
console.log("recipes:", recipes.length);
let done = 0;
for (const r of recipes) {
  const path = "img/" + r.slug + ".jpg";
  if (!FORCE && r.image === path && fs.existsSync(path)) continue;
  const b64 = await gen((r.desc_en || r.name_en) + ". Persian healthy dish. " + STYLE);
  if (!b64) { console.log("skip", r.slug); continue; }
  await sharp(Buffer.from(b64, "base64")).resize(800, 800, { fit: "cover" }).jpeg({ quality: 72 }).toFile(path);
  await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + r.slug, { method: "PATCH", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ image: path }) });
  done++; console.log("ok", r.slug);
  await new Promise(x => setTimeout(x, 4000));
}
console.log("done", done);
