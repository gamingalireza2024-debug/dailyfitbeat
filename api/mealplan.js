const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };
import { generatePlan } from "../lib/planbuilder.js";
const FREE_MONTHLY = 5, PRO_MONTHLY = 100, MIN_GAP_MS = 2000;

async function authUser(req) {
  const x = req.headers["x-supabase-auth"];
  const a = req.headers.authorization || "";
  const m = a.match(/^Bearer\s+(.+)$/i);
  const token = (typeof x === "string" && x.trim()) ? x.trim() : (m ? m[1] : null);
  if (!token) return null;
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + token } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}
const sbGet = async (p) => (await fetch(SB_URL + p, { headers: svc })).json();
async function isDisabled(uid) { const p = await sbGet("/rest/v1/profiles?id=eq." + uid + "&select=disabled"); return Array.isArray(p) && p[0] && !!p[0].disabled; }
async function userIsPro(uid) {
  const e = await sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&entitlement_type=eq.PRO&status=eq.ACTIVE&select=expires_at");
  const s = await sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&status=eq.ACTIVE&select=end_date");
  const act = (arr, f) => arr.some(x => !x[f] || new Date(x[f]) > new Date());
  return (Array.isArray(e) && e.length && act(e, 'expires_at')) || (Array.isArray(s) && s.length && act(s, 'end_date'));
}
function monthStart() { const d = new Date(); return d.toISOString().slice(0, 8) + "01"; }

export default async function handler(req, res) {
  const user = await authUser(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
  if (await isDisabled(user.id)) { res.status(403).json({ error: "account disabled" }); return; }

  if (req.method === "GET") { res.status(200).json(await sbGet("/rest/v1/meal_plans?user_id=eq." + user.id + "&select=id,title,days,kcal_target,created_at&order=created_at.desc&limit=20")); return; }
  if (req.method === "DELETE") {
    const id = +req.query.id;
    if (!id) { res.status(400).json({ error: "id required" }); return; }
    const cur = await sbGet("/rest/v1/meal_plans?id=eq." + id + "&select=user_id");
    if (!Array.isArray(cur) || !cur[0] || cur[0].user_id !== user.id) { res.status(403).json({ error: "forbidden" }); return; }
    await fetch(SB_URL + "/rest/v1/meal_plans?id=eq." + id, { method: "DELETE", headers: svc });
    res.status(200).json({ ok: true }); return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }

  const b = req.body || {};
  const pro = await userIsPro(user.id);
  const limit = pro ? PRO_MONTHLY : FREE_MONTHLY;
  const ps = monthStart();
  const cur = await sbGet("/rest/v1/ai_usage?user_id=eq." + user.id + "&period_start=eq." + ps + "&select=id,request_count,last_request_at");
  const row = Array.isArray(cur) && cur[0];
  if (row && row.last_request_at && (Date.now() - new Date(row.last_request_at).getTime()) < MIN_GAP_MS) { res.status(429).json({ error: "too fast" }); return; }
  if (row && (row.request_count || 0) >= limit) { res.status(429).json({ error: "quota_exceeded", usage: { used: row.request_count, limit, reset_at: ps } }); return; }
  if (!process.env.GEMINI_API_KEY) { res.status(503).json({ error: "ai_not_configured" }); return; }

  let profile = null;
  if (b.include_profile) {
    const np = await sbGet("/rest/v1/nutrition_profiles?id=eq." + user.id + "&select=*");
    profile = Array.isArray(np) && np[0] || null;
  }
  const r = await generatePlan({ days: b.days, meals: b.meals, profile, have: b.have, forbidden: b.forbidden });
  if (r.error) { res.status(r.status || 502).json({ error: r.error }); return; }

  const used = (row ? row.request_count || 0 : 0) + 1;
  if (row) await fetch(SB_URL + "/rest/v1/ai_usage?id=eq." + row.id, { method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ request_count: used, last_request_at: new Date().toISOString() }) });
  else await fetch(SB_URL + "/rest/v1/ai_usage", { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.id, period_start: ps, request_count: 1, last_request_at: new Date().toISOString() }) });

  res.status(200).json({ plan: { days: r.days, activity: r.activity, constraints: r.constraints }, usage: { used, limit, reset_at: ps } });
}
