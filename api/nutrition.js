const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };

// احراز هویت: X-Supabase-Auth اول، Authorization: Bearer فال‌بک — هر دو با Supabase سروری تأیید می‌شن
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
async function isDisabled(uid) {
  const p = await (await fetch(SB_URL + "/rest/v1/profiles?id=eq." + uid + "&select=disabled", { headers: svc })).json();
  return Array.isArray(p) && p[0] && !!p[0].disabled;
}
async function isAdminUser(user) {
  if (!user || !user.email || !SERVICE) return false;
  const arr = await (await fetch(SB_URL + "/rest/v1/admins?select=email&email=eq." + encodeURIComponent(user.email), { headers: svc })).json();
  return Array.isArray(arr) && arr.length > 0;
}
const ACT = ["sedentary", "light", "moderate", "active"];
const clamp = (v, min, max) => (v == null || v === "" || isNaN(+v)) ? null : Math.min(max, Math.max(min, Math.round(+v)));
const cleanArr = (a, max = 20, len = 40) => Array.isArray(a) ? a.map(x => String(x).replace(/[<>]/g, "").trim()).filter(Boolean).map(s => s.slice(0, len)).slice(0, max) : [];
const cleanStr = (s, len = 100) => s == null ? null : String(s).replace(/[<>]/g, "").trim().slice(0, len);

export default async function handler(req, res) {
  const user = await authUser(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
  if (await isDisabled(user.id)) { res.status(403).json({ error: "account disabled" }); return; }

  if (req.method === "GET") {
    let uid = user.id;
    if (req.query.uid && req.query.uid !== user.id) {
      if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
      uid = req.query.uid;
    }
    const rows = await (await fetch(SB_URL + "/rest/v1/nutrition_profiles?id=eq." + uid + "&select=*", { headers: svc })).json();
    res.status(200).json(Array.isArray(rows) && rows[0] ? rows[0] : { id: uid, empty: true }); return;
  }

  if (req.method === "POST") {
    const b = req.body || {};
    const obj = {
      id: user.id,
      goal: cleanStr(b.goal, 60),
      height_cm: clamp(b.height_cm, 80, 250),
      weight_kg: clamp(b.weight_kg, 20, 300),
      activity_level: ACT.includes(b.activity_level) ? b.activity_level : null,
      calorie_target: clamp(b.calorie_target, 800, 6000),
      protein_target: clamp(b.protein_target, 0, 400),
      carbs_target: clamp(b.carbs_target, 0, 1000),
      fat_target: clamp(b.fat_target, 0, 300),
      food_preferences: cleanArr(b.food_preferences),
      disliked_foods: cleanArr(b.disliked_foods),
      allergies: cleanArr(b.allergies),
      dietary_restrictions: cleanArr(b.dietary_restrictions),
      updated_at: new Date().toISOString()
    };
    const up = await fetch(SB_URL + "/rest/v1/nutrition_profiles", {
      method: "POST",
      headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(obj)
    });
    if (!up.ok) { res.status(500).json({ error: "save failed" }); return; }
    res.status(200).json({ ok: true }); return;
  }

  res.status(405).json({ error: "method not allowed" });
}
