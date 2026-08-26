const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };

async function authUser(req) {
  const a = req.headers.authorization || "";
  const m = a.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + m[1] } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  const user = await authUser(req);
  if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
  const pr = await (await fetch(SB_URL + "/rest/v1/profiles?id=eq." + user.id + "&select=disabled", { headers: svc })).json();
  if (Array.isArray(pr) && pr[0] && pr[0].disabled) { res.status(403).json({ error: "account disabled" }); return; }
  const id = req.query.id;
  if (!id) { res.status(400).json({ error: "id required" }); return; }
  const p = await (await fetch(SB_URL + "/rest/v1/diet_plans?id=eq." + id + "&select=*", { headers: svc })).json();
  const plan = Array.isArray(p) && p[0];
  if (!plan || plan.user_id !== user.id || plan.status !== "published" || !plan.pdf_path) { res.status(403).json({ error: "forbidden" }); return; }
  const sign = await fetch(SB_URL + "/storage/v1/object/sign/dfb-files/" + plan.pdf_path, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }) });
  const sj = await sign.json();
  if (!sj.signedURL) { res.status(500).json({ error: "sign failed" }); return; }
  res.status(200).json({ url: SB_URL + "/storage/v1" + sj.signedURL });
}
