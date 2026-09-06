const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";

const STATIC = [
  { loc: "https://dailyfitbeat.ir/", pri: "1.0", chg: "weekly" },
  { loc: "https://dailyfitbeat.ir/recipes.html", pri: "0.9", chg: "weekly" },
  { loc: "https://dailyfitbeat.ir/planner.html", pri: "0.8", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/ai.html", pri: "0.8", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/market.html", pri: "0.7", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/pro.html", pri: "0.7", chg: "monthly" },
  { loc: "https://dailyfitbeat.ir/about.html", pri: "0.4", chg: "yearly" }
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export default async function handler(req, res) {
  let recipes = [];
  try {
    const r = await fetch(SB_URL + "/rest/v1/recipes?select=slug&limit=1000", {
      headers: { apikey: ANON, Authorization: "Bearer " + ANON }
    });
    if (r.ok) recipes = await r.json();
  } catch (e) { recipes = []; }

  const today = new Date().toISOString().slice(0, 10);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

  for (const p of STATIC) {
    lines.push("<url><loc>" + esc(p.loc) + "</loc><lastmod>" + today + "</lastmod><changefreq>" + p.chg + "</changefreq><priority>" + p.pri + "</priority></url>");
  }
  /* URL تمیز /recipes/{slug} — هماهنگ با canonical و rewrite در vercel.json */
  for (const r of recipes) {
    if (!r || !r.slug) continue;
    lines.push("<url><loc>https://dailyfitbeat.ir/recipes/" + encodeURIComponent(r.slug) + "</loc><lastmod>" + today + "</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>");
  }
  lines.push("</urlset>");

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(lines.join("\n"));
}
