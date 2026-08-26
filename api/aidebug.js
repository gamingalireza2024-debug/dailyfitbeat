export default async function handler(req, res) {
  const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  
  // Auth check
  const a = req.headers.authorization || "";
  const m = a.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "no token" });
  const ur = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + m[1] } });
  if (!ur.ok) return res.status(401).json({ error: "invalid token" });
  const user = await ur.json();
  
  const admin = await (await fetch(SB_URL + "/rest/v1/admins?select=email&email=eq." + encodeURIComponent(user.email), { headers: { apikey: ANON, Authorization: "Bearer " + SERVICE } })).json();
  if (!Array.isArray(admin) || !admin.length) return res.status(403).json({ error: "admin only" });
  
  // Env check (mask key)
  const key = process.env.GEMINI_API_KEY || "";
  const model = process.env.AI_MODEL || "gemini-2.0-flash";
  const envInfo = {
    hasKey: !!key,
    keyLen: key.length,
    keyStart: key.slice(0, 8) + "...",
    keyEnd: "..." + key.slice(-4),
    model
  };
  
  // Direct test
  let testResult;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
    });
    const txt = await r.text();
    testResult = { status: r.status, body: txt.slice(0, 500) };
  } catch (e) {
    testResult = { error: String(e).slice(0, 200) };
  }
  
  res.status(200).json({ env: envInfo, test: testResult });
}
