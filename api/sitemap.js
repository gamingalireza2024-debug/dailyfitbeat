const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const h = { apikey: ANON, Authorization: "Bearer " + ANON };

const STATIC = [
  { loc: "https://dailyfitbeat.ir/",              pri: "1.0", chg: "weekly",  mod: new Date().toISOString().slice(0,10) },
  { loc: "https://dailyfitbeat.ir/recipes.html",  pri: "0.9", chg: "weekly",  mod: new Date().toISOString().slice(0,10) },
  { loc: "https://dailyfitbeat.ir/planner.html",  pri: "0.8", chg: "monthly", mod: new Date().toISOString().slice(0,10) },
  { loc: "https://dailyfitbeat.ir/market.html",   pri: "0.7", chg: "monthly", mod: new Date().toISOString().slice(0,10) },
  { loc: "https://dailyfitbeat.ir/pro.html",      pri: "0.7", chg: "monthly", mod: new Date().toISOString().slice(0,10) }
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
  });
}

async function loadRecipes() {
  try {
    var r = await fetch(SB_URL + "/rest/v1/recipes?select=slug,updated_at&order=updated_at.desc&limit=2000", { headers: h });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}

export default {
  async fetch(req) {
    var cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    var recipes = await loadRecipes();
    var lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    STATIC.forEach(function (p) {
      lines.push('<url><loc>' + esc(p.loc) + '</loc>' +
        '<lastmod>' + p.mod + '</lastmod>' +
        '<changefreq>' + p.chg + '</changefreq>' +
        '<priority>' + p.pri + '</priority></url>');
    });
    recipes.forEach(function (r) {
      if (!r.slug) return;
      var mod = (r.updated_at || '').slice(0, 10);
      if (!mod) mod = new Date().toISOString().slice(0, 10);
      lines.push('<url><loc>https://dailyfitbeat.ir/recipe.html?slug=' + encodeURIComponent(r.slug) + '</loc>' +
        '<lastmod>' + esc(mod) + '</lastmod>' +
        '<changefreq>monthly</changefreq>' +
        '<priority>0.6</priority></url>');
    });
    lines.push('</urlset>');

    return new Response(lines.join("\n"), {
      headers: Object.assign({
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }, cors)
    });
  }
};
