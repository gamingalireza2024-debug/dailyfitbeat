import { R1 } from "../data/r1.mjs";
let R2 = [];
try { R2 = (await import("../data/r2.mjs")).R2; } catch (e) { console.log("r2 not yet"); }

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

for (const line of [...R1, ...R2]) {
  const [slug, name_fa, name_en, category, time_min, kcal, protein, tag, keys, ings, desc_fa] = line.split("|");
  const ex = await (await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + slug + "&select=slug", { headers: H })).json();
  if (Array.isArray(ex) && ex.length) continue;
  const ingredients = ings.split(",").map(p => { const [fa, q] = p.split(":"); return { fa, q: q || "به‌اندازه" }; });
  await fetch(SB_URL + "/rest/v1/recipes", { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ slug, name_fa, name_en, desc_fa, desc_en: name_en, category, region: "ایران", time_min: +time_min, kcal: +kcal, protein: +protein, tags: [tag], keys: keys ? keys.split(",") : [], ingredients }) });
  console.log("added", slug);
}
console.log("recipes done");
