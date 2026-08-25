const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const h = { apikey: ANON, Authorization: "Bearer " + ANON };
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };
const ALLOWED_STATUSES = ["new", "paid", "sent"];

async function sendTelegram(text) {
  const TG = process.env.TG_TOKEN, CH = process.env.TG_CHAT;
  if (!TG || !CH) return false;
  try { const r = await fetch("https://api.telegram.org/bot" + TG + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: CH, text }) }); return r.ok; } catch (e) { return false; }
}
async function sendMail(o, id) {
  const S = process.env.EJ_SERVICE, T = process.env.EJ_TEMPLATE, U = process.env.EJ_USER, P = process.env.EJ_PRIVATE;
  if (!S || !T || !U || !o.email) return "no-config";
  try {
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_id: S, template_id: T, user_id: U, accessToken: P || U, template_params: { to_email: o.email, to_name: o.name, order_id: String(id), product: o.product } }) });
    if (r.ok) return "ok"; return "err:" + r.status;
  } catch (e) { return "err"; }
}
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
async function isAdminUser(user) {
  if (!user || !user.email || !SERVICE) return false;
  try {
    const r = await fetch(SB_URL + "/rest/v1/admins?select=email&email=eq." + encodeURIComponent(user.email), { headers: svc });
    const arr = await r.json();
    return Array.isArray(arr) && arr.length > 0;
  } catch (e) { return false; }
}

export default async function handler(req, res) {
  const t = req.query.t || "";
  if (t === "ping") { res.status(200).json({ v: 14 }); return; }

  if (t === "ingredients") { res.status(200).json(await (await fetch(SB_URL + "/rest/v1/ingredients?select=key,fa,en&key=in.(chicken,beef,egg,tomato,rice,potato,onion,garlic,mushroom,spinach,avocado,bread,greek-yogurt,salmon,chickpea,lentil,fish,shrimp,eggplant,kashk,walnut,pomegranate-molasses)", { headers: h })).json()); return; }
  if (t === "popular") { res.status(200).json(await (await fetch(SB_URL + "/rest/v1/recipes?select=*&limit=4", { headers: h })).json()); return; }
  if (t === "all") { res.status(200).json(await (await fetch(SB_URL + "/rest/v1/recipes?select=*&limit=300", { headers: h })).json()); return; }
  if (t === "match") {
    const have = String(req.query.a || "").split(",").filter(Boolean);
    res.status(200).json(await (await fetch(SB_URL + "/rest/v1/rpc/match_recipes", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ have }) })).json()); return;
  }
  if (t === "products") { res.status(200).json(await (await fetch(SB_URL + "/rest/v1/products?select=*&active=eq.true&order=id.asc", { headers: h })).json()); return; }
  if (t === "plans") { res.status(200).json(await (await fetch(SB_URL + "/rest/v1/plans?select=*&order=id.asc", { headers: h })).json()); return; }
  if (t === "admin_check") {
    const auth = req.headers.authorization;
    const hh = auth ? { apikey: ANON, Authorization: auth } : h;
    res.status(200).json(await (await fetch(SB_URL + "/rest/v1/admins?select=email", { headers: hh })).json()); return;
  }

  if (t === "order" && req.method === "POST") {
    const b = req.body || {};
    if (!b.name || !b.phone || !b.product) { res.status(400).json({ error: "fields required" }); return; }
    const ins = await fetch(SB_URL + "/rest/v1/orders?select=id", { method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ name: b.name, phone: b.phone, email: b.email, product: b.product, note: b.note, ref: b.ref, user_id: b.user_id || null }) });
    const arr = await ins.json();
    const id = Array.isArray(arr) && arr[0] ? arr[0].id : null;
    const tg = await sendTelegram("🛒 سفارش #" + id + "\n" + b.name + " | " + b.phone + "\n" + b.product + "\nکد واریز: " + b.ref);
    const mail = await sendMail(b, id);
    res.status(200).json({ id, tg, mail }); return;
  }

  if (t === "my_orders" || t === "my_favs") {
    const user = await authUser(req);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const url = t === "my_orders"
      ? "/rest/v1/orders?user_id=eq." + user.id + "&select=*&order=created_at.desc"
      : "/rest/v1/favorites?user_id=eq." + user.id + "&select=recipe_slug";
    res.status(200).json(await (await fetch(SB_URL + url, { headers: svc })).json()); return;
  }

  if (t === "all_orders") {
    const user = await authUser(req);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    res.status(200).json(await (await fetch(SB_URL + "/rest/v1/orders?select=*&order=created_at.desc", { headers: svc })).json()); return;
  }

  if (t === "set_status" && req.method === "POST") {
    const { id, status } = req.body || {};
    if (!ALLOWED_STATUSES.includes(status)) { res.status(400).json({ error: "invalid status" }); return; }
    if (!id || isNaN(+id)) { res.status(400).json({ error: "invalid id" }); return; }
    const user = await authUser(req);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    await fetch(SB_URL + "/rest/v1/orders?id=eq." + (+id), { method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    res.status(200).json({ ok: true }); return;
  }

  res.status(404).json({ error: "not found" });
}
