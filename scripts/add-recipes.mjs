import { R1 } from "../data/r1.mjs";
let R2 = [];
try { R2 = (await import("../data/r2.mjs")).R2; } catch (e) { console.log("r2 not yet"); }
let R3 = [];
try { R3 = (await import("../data/r3.mjs")).R3; } catch (e) { console.log("r3 not yet"); }

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.log("ERR: secret SUPABASE_SERVICE_ROLE_KEY تعریف نشده"); process.exit(1); }
const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

for (const line of [...R1, ...R2, ...R3]) {
  const parts = line.split("|");
  let slug, name_fa, name_en, category, time_min, kcal, protein, region, tag, keys, ings, desc_fa;
  if (parts.length === 12) {
    [slug, name_fa, name_en, category, time_min, kcal, protein, region, tag, keys, ings, desc_fa] = parts;
  } else {
    [slug, name_fa, name_en, category, time_min, kcal, protein, tag, keys, ings, desc_fa] = parts;
    region = "ایران";
  }
  const ex = await (await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + slug + "&select=slug", { headers: H })).json();
  if (Array.isArray(ex) && ex.length) continue;
  const ingredients = ings.split(",").map(p => { const [fa, q] = p.split(":"); return { fa, q: q || "به‌اندازه" }; });
  const res = await fetch(SB_URL + "/rest/v1/recipes", { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ slug, name_fa, name_en, desc_fa, desc_en: name_en, category, region, time_min: +time_min, kcal: +kcal, protein: +protein, tags: [tag], keys: keys ? keys.split(",") : [], ingredients }) });
  if (!res.ok) { console.log("ERR", slug, res.status); continue; }
  console.log("added", slug, region);
}
console.log("recipes done");
