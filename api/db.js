const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const h = { apikey: ANON, Authorization: "Bearer " + ANON };
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };
const ALLOWED_STATUSES = ["new","pending","payment_submitted","under_review","paid","processing","delivered","sent","rejected","cancelled","refunded"];

/* ---------- ضداسپم سفارش مهمان: محدودسازی نرخ بر اساس IP (در حافظه هر نمونه Serverless) ---------- */
const ORDER_HITS = new Map(); // ip -> [timestamps]
function orderRateOk(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 8; // حداکثر ۸ سفارش در ۱۰ دقیقه از هر IP
  const arr = (ORDER_HITS.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= max) { ORDER_HITS.set(ip, arr); return false; }
  arr.push(now); ORDER_HITS.set(ip, arr);
  if (ORDER_HITS.size > 5000) { // جلوگیری از رشد بی‌رویه حافظه
    for (const k of ORDER_HITS.keys()) { if (ORDER_HITS.get(k).every(t => now - t >= win)) ORDER_HITS.delete(k); if (ORDER_HITS.size <= 2500) break; }
  }
  return true;
}
function clientIp(req) {
  const f = req.headers["x-forwarded-for"];
  return (Array.isArray(f) ? f[0] : (f || req.headers["x-real-ip"] || "")).split(",")[0].trim() || "unknown";
}
const clean = (v, n) => String(v == null ? "" : v).slice(0, n).trim();
const sbUpsert = async (p, body) => (await fetch(SB_URL + p, { method: "POST", headers: { ...svc, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(body) })).json();

/* ---------- فاز ۴: ضداسپم عمومی + نشان‌های دستاورد ---------- */
const RATE_HITS = new Map(); // key -> [timestamps]
function rateOk(key, max, winMs) {
  const now = Date.now();
  const arr = (RATE_HITS.get(key) || []).filter(t => now - t < winMs);
  if (arr.length >= max) { RATE_HITS.set(key, arr); return false; }
  arr.push(now); RATE_HITS.set(key, arr);
  if (RATE_HITS.size > 5000) {
    for (const k of RATE_HITS.keys()) { if (RATE_HITS.get(k).every(t => now - t >= winMs)) RATE_HITS.delete(k); if (RATE_HITS.size <= 2500) break; }
  }
  return true;
}
async function userBadgeKeys(uid) {
  const r = await sbGet("/rest/v1/user_badges?user_id=eq." + uid + "&select=badge_key");
  return new Set((Array.isArray(r) ? r : []).map(b => b.badge_key));
}
/* نشان‌های جدید را می‌دهد و فقط موارد تازه را برمی‌گرداند */
async function awardBadges(uid, keys) {
  if (!Array.isArray(keys) || !keys.length) return [];
  const have = await userBadgeKeys(uid);
  const fresh = keys.filter(k => !have.has(k));
  for (const k of fresh) await sbUpsert("/rest/v1/user_badges", { user_id: uid, badge_key: k });
  return fresh;
}
const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const CAT_WHITELIST = ["iranian", "main", "salad", "sandwich", "breakfast", "soup"];
const RECIPE_FIELDS = ["name_fa", "name_en", "category", "region", "time_min", "kcal", "protein", "carbs", "fat", "fiber", "sugar", "image", "video_url", "desc_fa", "tags", "keys", "ingredients", "steps", "tips", "substitutions", "meta_title", "meta_description", "status", "noindex"];
import { generatePlan as pbGenerate } from "../lib/planbuilder.js";
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
const sbGet = async (p) => (await fetch(SB_URL + p, { headers: svc })).json();
const sbWrite = async (p, method, body) => (await fetch(SB_URL + p, { method, headers: { ...svc, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(body) })).json();
async function isAdminUser(user) {
  if (!user || !user.email || !SERVICE) return false;
  const arr = await sbGet("/rest/v1/admins?select=email&email=eq." + encodeURIComponent(user.email));
  return Array.isArray(arr) && arr.length > 0;
}
async function isDisabled(uid) {
  const p = await sbGet("/rest/v1/profiles?id=eq." + uid + "&select=disabled");
  return Array.isArray(p) && p[0] && !!p[0].disabled;
}
async function activeUser(req) {
  const user = await authUser(req);
  if (!user) return null;
  if (await isDisabled(user.id)) return "disabled";
  return user;
}
async function userIsPro(uid) {
  const e = await sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&entitlement_type=eq.PRO&status=eq.ACTIVE&select=expires_at");
  const s = await sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&status=eq.ACTIVE&select=end_date");
  const act = (arr, f) => arr.some(x => !x[f] || new Date(x[f]) > new Date());
  return (Array.isArray(e) && e.length && act(e, 'expires_at')) || (Array.isArray(s) && s.length && act(s, 'end_date'));
}
async function proExpiry(uid) {
  const e = await sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&entitlement_type=eq.PRO&status=eq.ACTIVE&select=expires_at&order=expires_at.desc");
  const s = await sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&status=eq.ACTIVE&select=end_date&order=end_date.desc");
  const d = [...(Array.isArray(e) ? e : []).map(x => x.expires_at), ...(Array.isArray(s) ? s : []).map(x => x.end_date)].filter(Boolean).sort().pop();
  return d || null;
}
async function lockCouponFor(couponId, uid) {
  const c = await sbGet("/rest/v1/coupons?id=eq." + couponId + "&select=used_by");
  if (Array.isArray(c) && c[0]) {
    const ub = Array.isArray(c[0].used_by) ? c[0].used_by : [];
    if (!ub.includes(uid)) { ub.push(uid); await sbWrite("/rest/v1/coupons?id=eq." + couponId, "PATCH", { used_by: ub }); }
  }
}
async function audit(admin, action, type, id, meta) {
  await sbWrite("/rest/v1/audit_logs", "POST", { admin_email: admin, action, target_type: type, target_id: String(id), meta: meta || {} });
}
async function notify(uid, type, title, body) {
  await sbWrite("/rest/v1/notifications", "POST", { user_id: uid, type, title, body });
}

export default async function handler(req, res) {
  const t = req.query.t || "";
  if (t === "ping") { res.status(200).json({ v: 20 }); return; }

  if (t === "ingredients") { res.status(200).json(await sbGet("/rest/v1/ingredients?select=key,fa,en&key=in.(chicken,beef,egg,tomato,rice,potato,onion,garlic,mushroom,spinach,avocado,bread,greek-yogurt,salmon,chickpea,lentil,fish,shrimp,eggplant,kashk,walnut,pomegranate-molasses)")); return; }
  if (t === "popular") { res.status(200).json(await sbGet("/rest/v1/recipes?select=*&limit=4")); return; }
  if (t === "all") { res.status(200).json(await sbGet("/rest/v1/recipes?select=*&status=eq.published&limit=300")); return; }
  if (t === "all_admin") {
    const au = await authUser(req); if (!au) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(au))) { res.status(403).json({ error: "forbidden" }); return; }
    res.status(200).json(await sbGet("/rest/v1/recipes?select=*&order=slug.asc&limit=500")); return;
  }
  if (t === "faqs") { res.status(200).json(await sbGet("/rest/v1/faqs?active=eq.true&page_key=eq." + encodeURIComponent(String(req.query.page || "index").slice(0, 40)) + "&select=question,answer&order=sort.asc")); return; }
  if (t === "track_view") {
    const slug = String(req.query.slug || "").slice(0, 120);
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) { res.status(200).json({ ok: false }); return; }
    try { await fetch(SB_URL + "/rest/v1/rpc/increment_view", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ p_slug: slug }) }); } catch (e) {}
    res.status(200).json({ ok: true }); return;
  }
  if (t === "match") { const have = String(req.query.a || "").split(",").filter(Boolean); res.status(200).json(await (await fetch(SB_URL + "/rest/v1/rpc/match_recipes", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ have }) })).json()); return; }
  if (t === "products") { res.status(200).json(await sbGet("/rest/v1/products?select=*&active=eq.true&order=id.asc")); return; }
  if (t === "plans") { res.status(200).json(await sbGet("/rest/v1/plans?select=*&order=id.asc")); return; }
  if (t === "admin_check") {
    /* اول اعتبار توکن بررسی می‌شود؛ خطای خام PostgREST به بیرون نشت نمی‌کند */
    const u = await authUser(req);
    if (!u || !u.email) { res.status(200).json([]); return; }
    const rows = await sbGet("/rest/v1/admins?email=eq." + encodeURIComponent(u.email) + "&select=email");
    res.status(200).json(Array.isArray(rows) ? rows : []); return;
  }

  if (t === "order" && req.method === "POST") {
    const b = req.body || {};
    /* honeypot: فیلد مخفی فرم؛ ربات‌ها پرش می‌کنند — پاسخ موفقیت جعلی تا لیست را ترک نکنند */
    if (clean(b.website, 200)) { res.status(200).json({ id: null, tg: false, mail: "skipped" }); return; }
    if (!orderRateOk(clientIp(req))) { res.status(429).json({ error: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کن" }); return; }
    const name = clean(b.name, 80), phone = clean(b.phone, 20), email = clean(b.email, 120), product = clean(b.product, 120), note = clean(b.note, 500), ref = clean(b.ref, 60);
    if (!name || !phone || !product) { res.status(400).json({ error: "fields required" }); return; }
    if (!/^[0-9+\-\s]{7,20}$/.test(phone)) { res.status(400).json({ error: "invalid phone" }); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: "invalid email" }); return; }
    const arr = await sbWrite("/rest/v1/orders?select=id", "POST", { name, phone, email, product, note, ref, user_id: b.user_id || null, status: "new" });
    const id = Array.isArray(arr) && arr[0] ? arr[0].id : null;
    const tg = await sendTelegram("🛒 سفارش #" + id + "\n" + name + " | " + phone + "\n" + product + "\nکد واریز: " + ref);
    const mail = await sendMail({ email, name, product }, id);
    res.status(200).json({ id, tg, mail }); return;
  }

  if (t === "checkout" && req.method === "POST") {
    const user = await activeUser(req);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (user === "disabled") { res.status(403).json({ error: "account disabled" }); return; }
    const b = req.body || {};
    let amount, title, productId = null, planId = null;
    if (b.product_id) {
      const p = await sbGet("/rest/v1/products?id=eq." + b.product_id);
      if (!Array.isArray(p) || !p[0] || !p[0].active) { res.status(404).json({ error: "product not found" }); return; }
      amount = p[0].price_rial; title = p[0].title_fa; productId = p[0].id;
    } else if (b.plan_id) {
      const p = await sbGet("/rest/v1/plans?id=eq." + b.plan_id);
      if (!Array.isArray(p) || !p[0]) { res.status(404).json({ error: "plan not found" }); return; }
      amount = p[0].price_rial; title = "PRO — " + p[0].title_fa; planId = p[0].id;
    } else { res.status(400).json({ error: "product_id or plan_id required" }); return; }
    let discount = 0, couponId = null;
    if (b.coupon) {
      const c = await sbGet("/rest/v1/coupons?code=eq." + encodeURIComponent(String(b.coupon).toUpperCase()) + "&active=eq.true&select=*");
      const cp = Array.isArray(c) && c[0];
      if (!cp) { res.status(400).json({ error: "invalid coupon" }); return; }
      if (cp.start_date && new Date(cp.start_date) > new Date()) { res.status(400).json({ error: "coupon not started" }); return; }
      if (cp.end_date && new Date(cp.end_date) < new Date()) { res.status(400).json({ error: "coupon expired" }); return; }
      if (cp.usage_limit && cp.used_count >= cp.usage_limit) { res.status(400).json({ error: "coupon limit reached" }); return; }
      if (Array.isArray(cp.used_by) && cp.used_by.includes(user.id)) { res.status(400).json({ error: "coupon already used by you" }); return; }
      if (cp.product_id && cp.product_id !== productId) { res.status(400).json({ error: "coupon not for this product" }); return; }
      if (cp.pro_only && !(await userIsPro(user.id))) { res.status(400).json({ error: "coupon is PRO only" }); return; }
      discount = cp.type === "PERCENT" ? Math.round(amount * Number(cp.value) / 100) : Math.round(Number(cp.value));
      couponId = cp.id;
    }
    const total = Math.max(0, amount - discount);
    const ord = await sbWrite("/rest/v1/orders?select=id", "POST", { name: (user.user_metadata && user.user_metadata.name) || "", phone: b.phone || "", email: user.email, product: title, product_id: productId, subtotal: amount, discount, total, currency: "IRR", payment_method: b.method === "GATEWAY" ? "GATEWAY" : "MANUAL", status: "pending", user_id: user.id, note: b.note || "" });
    const orderId = Array.isArray(ord) && ord[0] ? ord[0].id : null;
    if (!orderId) { res.status(500).json({ error: "order failed" }); return; }
    await sbWrite("/rest/v1/order_items", "POST", { order_id: orderId, product_id: productId, qty: 1, unit_price: amount, discount, total });
    const pay = await sbWrite("/rest/v1/payments?select=id", "POST", { order_id: orderId, user_id: user.id, amount: total, currency: "IRR", provider: b.method === "GATEWAY" ? "GATEWAY" : "MANUAL", status: "pending", meta: { plan_id: planId, coupon_id: couponId } });
    const payId = Array.isArray(pay) && pay[0] ? pay[0].id : null;
    res.status(200).json({ order_id: orderId, payment_id: payId, total, discount }); return;
  }

  if (t === "submit_payment" && req.method === "POST") {
    const user = await activeUser(req);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (user === "disabled") { res.status(403).json({ error: "account disabled" }); return; }
    const { payment_id, ref } = req.body || {};
    if (!ref || !String(ref).trim()) { res.status(400).json({ error: "ref required" }); return; }
    const p = await sbGet("/rest/v1/payments?id=eq." + payment_id + "&select=*,orders!inner(user_id,status)");
    const pay = Array.isArray(p) && p[0];
    if (!pay || pay.orders.user_id !== user.id) { res.status(403).json({ error: "forbidden" }); return; }
    if (pay.status !== "pending") { res.status(400).json({ error: "payment not pending" }); return; }
    await sbWrite("/rest/v1/payments?id=eq." + pay.id, "PATCH", { reference: String(ref).trim(), status: "submitted" });
    await sbWrite("/rest/v1/orders?id=eq." + pay.order_id, "PATCH", { status: "payment_submitted", updated_at: new Date().toISOString() });
    if (pay.meta && pay.meta.coupon_id) await lockCouponFor(pay.meta.coupon_id, user.id);
    await sendTelegram("💳 واریز ثبت شد — سفارش #" + pay.order_id + " کد: " + ref);
    res.status(200).json({ ok: true }); return;
  }

  if (["my_orders","my_favs","my_payments","my_entitlements","my_diet_plans","my_notifications","my_list","save_list","download"].includes(t)) {
    const user = await activeUser(req);
    if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (user === "disabled") { res.status(403).json({ error: "account disabled" }); return; }
    if (t === "my_orders") { res.status(200).json(await sbGet("/rest/v1/orders?user_id=eq." + user.id + "&select=*&order=created_at.desc")); return; }
    if (t === "my_favs") { res.status(200).json(await sbGet("/rest/v1/favorites?user_id=eq." + user.id + "&select=recipe_slug")); return; }
    if (t === "my_payments") { res.status(200).json(await sbGet("/rest/v1/payments?user_id=eq." + user.id + "&select=id,order_id,amount,status,provider,reference,created_at&order=created_at.desc")); return; }
    if (t === "my_entitlements") {
      const pro = await userIsPro(user.id);
      const exp = pro ? await proExpiry(user.id) : null;
      const ents = await sbGet("/rest/v1/entitlements?user_id=eq." + user.id + "&entitlement_type=eq.PRODUCT&status=eq.ACTIVE&select=id,expires_at,granted_at,products(title_fa,image,file_path)");
      const valid = (Array.isArray(ents) ? ents : []).filter(e => !e.expires_at || new Date(e.expires_at) > new Date());
      res.status(200).json({ pro, pro_expires: exp, products: valid }); return;
    }
    if (t === "my_diet_plans") { res.status(200).json(await sbGet("/rest/v1/diet_plans?user_id=eq." + user.id + "&status=eq.published&select=id,title,goal,start_date,end_date,duration_days,kcal_target,protein_target,carbs_target,fat_target,notes,pdf_path,created_at&order=created_at.desc")); return; }
    if (t === "my_notifications") { res.status(200).json(await sbGet("/rest/v1/notifications?user_id=eq." + user.id + "&select=*&order=created_at.desc&limit=30")); return; }
    if (t === "my_list") { res.status(200).json(await sbGet("/rest/v1/shopping_lists?user_id=eq." + user.id + "&select=items,updated_at")); return; }
    if (t === "save_list") {
      if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
      if (!(await userIsPro(user.id))) { res.status(403).json({ error: "PRO required" }); return; }
      const { items } = req.body || {};
      const cur = await sbGet("/rest/v1/shopping_lists?user_id=eq." + user.id + "&select=id");
      if (Array.isArray(cur) && cur[0]) await sbWrite("/rest/v1/shopping_lists?id=eq." + cur[0].id, "PATCH", { items, updated_at: new Date().toISOString() });
      else await sbWrite("/rest/v1/shopping_lists", "POST", { user_id: user.id, items });
      res.status(200).json({ ok: true }); return;
    }
    if (t === "download") {
      const { entitlement_id } = req.body || {};
      const e = await sbGet("/rest/v1/entitlements?id=eq." + entitlement_id + "&select=*");
      const ent = Array.isArray(e) && e[0];
      if (!ent || ent.user_id !== user.id || ent.status !== "ACTIVE") { res.status(403).json({ error: "no entitlement" }); return; }
      if (ent.expires_at && new Date(ent.expires_at) < new Date()) { res.status(403).json({ error: "entitlement expired" }); return; }
      const pr = await sbGet("/rest/v1/products?id=eq." + ent.product_id + "&select=file_path,title_fa");
      const path = Array.isArray(pr) && pr[0] && pr[0].file_path;
      if (!path) { res.status(404).json({ error: "file not found" }); return; }
      const sign = await fetch(SB_URL + "/storage/v1/object/sign/dfb-files/" + path, { method: "POST", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }) });
      const sj = await sign.json();
      if (!sj.signedURL) { res.status(500).json({ error: "sign failed" }); return; }
      res.status(200).json({ url: SB_URL + "/storage/v1" + sj.signedURL }); return;
    }
  }

  if (t === "upload_file" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { path, base64, mime } = req.body || {};
    if (!path || !base64) { res.status(400).json({ error: "path/base64 required" }); return; }
    const buf = Buffer.from(base64, "base64");
    if (buf.length > 15 * 1024 * 1024) { res.status(400).json({ error: "file too large" }); return; }
    const up = await fetch(SB_URL + "/storage/v1/object/dfb-files/" + path, { method: "POST", headers: { ...svc, "Content-Type": mime || "application/octet-stream", "x-upsert": "true" }, body: buf });
    if (!up.ok) { res.status(500).json({ error: "upload failed" }); return; }
    res.status(200).json({ ok: true, path }); return;
  }

  if (t === "admin_payments") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const pageN = Math.max(1, +(req.query.page || 1)); const lim = 20;
    const r = await fetch(SB_URL + "/rest/v1/payments?select=id,order_id,user_id,amount,provider,reference,status,created_at,verified_at,meta,orders(product,phone,email,name)&order=created_at.desc&limit=" + lim + "&offset=" + (pageN - 1) * lim, { headers: { ...svc, Prefer: "count=exact" } });
    const total = parseInt((r.headers.get("content-range") || "0").split("/").pop() || "0", 10);
    res.status(200).json({ rows: await r.json(), total }); return;
  }
  if (t === "approve_payment" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { payment_id } = req.body || {};
    const p = await sbGet("/rest/v1/payments?id=eq." + payment_id + "&select=*");
    const pay = Array.isArray(p) && p[0];
    if (!pay) { res.status(404).json({ error: "payment not found" }); return; }
    if (pay.status === "approved") { res.status(200).json({ ok: true, already: true }); return; }
    if (pay.status !== "submitted" && pay.status !== "pending") { res.status(400).json({ error: "not approvable" }); return; }
    await sbWrite("/rest/v1/payments?id=eq." + pay.id, "PATCH", { status: "approved", verified_at: new Date().toISOString() });
    const ord = await sbGet("/rest/v1/orders?id=eq." + pay.order_id + "&select=*");
    const order = Array.isArray(ord) && ord[0];
    await sbWrite("/rest/v1/orders?id=eq." + pay.order_id, "PATCH", { status: "paid", updated_at: new Date().toISOString() });
    const meta = pay.meta || {};
    if (meta.plan_id) {
      const pl = await sbGet("/rest/v1/plans?id=eq." + meta.plan_id + "&select=*");
      const plan = Array.isArray(pl) && pl[0];
      const days = (plan && plan.days) || 30;
      const start = new Date(); const end = new Date(start.getTime() + days * 86400000);
      const sub = await sbWrite("/rest/v1/subscriptions?select=id", "POST", { user_id: pay.user_id, plan_id: meta.plan_id, status: "ACTIVE", start_date: start.toISOString(), end_date: end.toISOString(), payment_id: pay.id, order_id: pay.order_id });
      const subId = Array.isArray(sub) && sub[0] ? sub[0].id : null;
      await sbWrite("/rest/v1/entitlements", "POST", { user_id: pay.user_id, entitlement_type: "PRO", status: "ACTIVE", expires_at: end.toISOString(), source: "SUBSCRIPTION", order_id: pay.order_id, subscription_id: subId });
      await notify(pay.user_id, "PRO_ACTIVATED", "PRO فعال شد 🎉", "اشتراک " + (plan ? plan.title_fa : "PRO") + " تا " + end.toLocaleDateString("fa-IR") + " فعال است.");
    } else if (order && order.product_id) {
      const pr = await sbGet("/rest/v1/products?id=eq." + order.product_id + "&select=*");
      const prod = Array.isArray(pr) && pr[0];
      const exp = prod && prod.access_days ? new Date(Date.now() + prod.access_days * 86400000).toISOString() : null;
      await sbWrite("/rest/v1/entitlements", "POST", { user_id: pay.user_id, product_id: order.product_id, entitlement_type: "PRODUCT", status: "ACTIVE", expires_at: exp, source: "PURCHASE", order_id: pay.order_id });
      await notify(pay.user_id, "PRODUCT_DELIVERED", "محصولت آماده‌ست 🎁", (prod ? prod.title_fa : "محصول") + " به «محصولات من» اضافه شد.");
    }
    if (meta.coupon_id) {
      const c = await sbGet("/rest/v1/coupons?id=eq." + meta.coupon_id + "&select=used_count,used_by");
      if (Array.isArray(c) && c[0]) await sbWrite("/rest/v1/coupons?id=eq." + meta.coupon_id, "PATCH", { used_count: (c[0].used_count || 0) + 1 });
    }
    await audit(user.email, "APPROVE_PAYMENT", "payment", pay.id, { order: pay.order_id, amount: pay.amount });
    await sendTelegram("✅ پرداخت #" + pay.id + " تأیید شد — سفارش #" + pay.order_id);
    res.status(200).json({ ok: true }); return;
  }
  if (t === "reject_payment" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { payment_id, reason } = req.body || {};
    const p = await sbGet("/rest/v1/payments?id=eq." + payment_id + "&select=*");
    const pay = Array.isArray(p) && p[0];
    if (!pay || pay.status === "approved") { res.status(400).json({ error: "not rejectable" }); return; }
    await sbWrite("/rest/v1/payments?id=eq." + pay.id, "PATCH", { status: "rejected" });
    await sbWrite("/rest/v1/orders?id=eq." + pay.order_id, "PATCH", { status: "rejected", updated_at: new Date().toISOString() });
    await notify(pay.user_id, "PAYMENT_REJECTED", "پرداخت تأیید نشد", reason || "کد واریز مطابقت نداشت؛ با پشتیبانی تماس بگیر.");
    await audit(user.email, "REJECT_PAYMENT", "payment", pay.id, { reason: reason || "" });
    res.status(200).json({ ok: true }); return;
  }

  if (t === "all_orders") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const pageN = Math.max(1, +(req.query.page || 1));
    const lim = Math.min(100, +(req.query.limit || 20));
    let q = "/rest/v1/orders?select=*&order=created_at.desc&limit=" + lim + "&offset=" + (pageN - 1) * lim;
    if (req.query.uid) q += "&user_id=eq." + req.query.uid;
    if (req.query.status && req.query.status !== "all") q += "&status=eq." + req.query.status;
    const r = await fetch(SB_URL + q, { headers: { ...svc, Prefer: "count=exact" } });
    const total = parseInt((r.headers.get("content-range") || "0").split("/").pop() || "0", 10);
    res.status(200).json({ rows: await r.json(), total }); return;
  }
  if (t === "set_status" && req.method === "POST") {
    const { id, status } = req.body || {};
    if (!ALLOWED_STATUSES.includes(status)) { res.status(400).json({ error: "invalid status" }); return; }
    if (!id || isNaN(+id)) { res.status(400).json({ error: "invalid id" }); return; }
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    await sbWrite("/rest/v1/orders?id=eq." + (+id), "PATCH", { status, updated_at: new Date().toISOString() });
    await audit(user.email, "ORDER_STATUS", "order", id, { status });
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_delete_order" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { id } = req.body || {};
    await fetch(SB_URL + "/rest/v1/orders?id=eq." + (+id), { method: "DELETE", headers: svc });
    await audit(user.email, "DELETE_ORDER", "order", id, {});
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_delete_payment" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { id } = req.body || {};
    await fetch(SB_URL + "/rest/v1/payments?id=eq." + (+id), { method: "DELETE", headers: svc });
    await audit(user.email, "DELETE_PAYMENT", "payment", id, {});
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_delete_product" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { id } = req.body || {};
    await sbWrite("/rest/v1/order_items?product_id=eq." + id, "PATCH", { product_id: null });
    await sbWrite("/rest/v1/orders?product_id=eq." + id, "PATCH", { product_id: null });
    const ents = await sbGet("/rest/v1/entitlements?product_id=eq." + id + "&select=id");
    for (const e of (Array.isArray(ents) ? ents : [])) await sbWrite("/rest/v1/entitlements?id=eq." + e.id, "PATCH", { product_id: null, status: "REVOKED" });
    await fetch(SB_URL + "/rest/v1/products?id=eq." + id, { method: "DELETE", headers: svc });
    await audit(user.email, "DELETE_PRODUCT", "product", id, {});
    res.status(200).json({ ok: true }); return;
  }

  if (t === "admin_users") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const q = String(req.query.q || ""); const pageN = Math.max(1, +(req.query.page || 1)); const lim = 20;
    const callerAuth = req.headers.authorization || ("Bearer " + SERVICE);
    const r = await fetch(SB_URL + "/rest/v1/rpc/admin_list_users", { method: "POST", headers: { apikey: ANON, Authorization: callerAuth, "Content-Type": "application/json" }, body: JSON.stringify({ q, lim, off: (pageN - 1) * lim }) });
    if (!r.ok) { console.log("admin_list_users error:", r.status); res.status(502).json({ error: "user list failed", rows: [], total: 0 }); return; }
    const rows = await r.json();
    res.status(200).json({ rows: Array.isArray(rows) ? rows : [], total: (Array.isArray(rows) && rows.length === lim) ? (pageN * lim + 1) : ((pageN - 1) * lim + (Array.isArray(rows) ? rows.length : 0)) }); return;
  }
  if (t === "admin_user_ent") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const uid = req.query.uid;
    if (!uid) { res.status(400).json({ error: "uid required" }); return; }
    const [ents, subs] = await Promise.all([
      sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&select=*&order=granted_at.desc"),
      sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&select=*,plans(title_fa,days)&order=created_at.desc")
    ]);
    res.status(200).json({ entitlements: ents, subscriptions: subs }); return;
  }
  if (t === "admin_user_disable" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { uid, disabled } = req.body || {};
    const cur = await sbGet("/rest/v1/profiles?id=eq." + uid + "&select=id");
    if (Array.isArray(cur) && cur[0]) await sbWrite("/rest/v1/profiles?id=eq." + uid, "PATCH", { disabled: !!disabled });
    else await sbWrite("/rest/v1/profiles", "POST", { id: uid, disabled: !!disabled });
    await audit(user.email, disabled ? "USER_DISABLE" : "USER_ENABLE", "user", uid, {});
    res.status(200).json({ ok: true }); return;
  }

  if (t === "admin_grant_pro" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { uid, days } = req.body || {};
    const d = Math.max(1, +days || 30);
    const start = new Date(); const end = new Date(start.getTime() + d * 86400000);
    const sub = await sbWrite("/rest/v1/subscriptions?select=id", "POST", { user_id: uid, status: "ACTIVE", start_date: start.toISOString(), end_date: end.toISOString() });
    const subId = Array.isArray(sub) && sub[0] ? sub[0].id : null;
    await sbWrite("/rest/v1/entitlements", "POST", { user_id: uid, entitlement_type: "PRO", status: "ACTIVE", expires_at: end.toISOString(), source: "ADMIN_GRANT", subscription_id: subId });
    await notify(uid, "PRO_ACTIVATED", "PRO فعال شد 🎉", "اشتراک PRO تا " + end.toLocaleDateString("fa-IR") + " فعال است.");
    await audit(user.email, "GRANT_PRO", "user", uid, { days: d });
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_revoke_pro" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { uid } = req.body || {};
    const subs = await sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&status=eq.ACTIVE&select=id");
    for (const s of (Array.isArray(subs) ? subs : [])) await sbWrite("/rest/v1/subscriptions?id=eq." + s.id, "PATCH", { status: "CANCELLED", cancelled_at: new Date().toISOString() });
    const ents = await sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&entitlement_type=eq.PRO&status=eq.ACTIVE&select=id");
    for (const e of (Array.isArray(ents) ? ents : [])) await sbWrite("/rest/v1/entitlements?id=eq." + e.id, "PATCH", { status: "REVOKED" });
    await notify(uid, "PRO_REVOKED", "اشتراک PRO غیرفعال شد", "برای اطلاعات بیشتر با پشتیبانی تماس بگیر.");
    await audit(user.email, "REVOKE_PRO", "user", uid, {});
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_extend_pro" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { uid, days } = req.body || {};
    const d = Math.max(1, +days || 30);
    const subs = await sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&status=eq.ACTIVE&select=id,end_date");
    for (const s of (Array.isArray(subs) ? subs : [])) {
      const base = s.end_date && new Date(s.end_date) > new Date() ? new Date(s.end_date) : new Date();
      await sbWrite("/rest/v1/subscriptions?id=eq." + s.id, "PATCH", { end_date: new Date(base.getTime() + d * 86400000).toISOString() });
    }
    const ents = await sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&entitlement_type=eq.PRO&status=eq.ACTIVE&select=id,expires_at");
    for (const e of (Array.isArray(ents) ? ents : [])) {
      const base = e.expires_at && new Date(e.expires_at) > new Date() ? new Date(e.expires_at) : new Date();
      await sbWrite("/rest/v1/entitlements?id=eq." + e.id, "PATCH", { expires_at: new Date(base.getTime() + d * 86400000).toISOString() });
    }
    await audit(user.email, "EXTEND_PRO", "user", uid, { days: d });
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_grant_product" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { uid, product_id, days } = req.body || {};
    if (!uid || !product_id) { res.status(400).json({ error: "uid/product_id required" }); return; }
    const exp = days ? new Date(Date.now() + Math.max(1, +days) * 86400000).toISOString() : null;
    await sbWrite("/rest/v1/entitlements", "POST", { user_id: uid, product_id, entitlement_type: "PRODUCT", status: "ACTIVE", expires_at: exp, source: "ADMIN_GRANT" });
    await notify(uid, "PRODUCT_DELIVERED", "محصول جدید برات فعال شد 🎁", "در «محصولات من» قابل دانلود است.");
    await audit(user.email, "GRANT_PRODUCT", "user", uid, { product_id });
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_revoke_product" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { entitlement_id } = req.body || {};
    await sbWrite("/rest/v1/entitlements?id=eq." + entitlement_id, "PATCH", { status: "REVOKED" });
    await audit(user.email, "REVOKE_PRODUCT", "entitlement", entitlement_id, {});
    res.status(200).json({ ok: true }); return;
  }

  if (t === "admin_coupons") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    if (req.method === "POST") {
      const b = req.body || {};
      if (!b.code || !b.value) { res.status(400).json({ error: "code/value required" }); return; }
      const r = await sbWrite("/rest/v1/coupons", "POST", { code: String(b.code).toUpperCase(), type: b.type === "FIXED" ? "FIXED" : "PERCENT", value: +b.value, usage_limit: b.usage_limit ? +b.usage_limit : null, product_id: b.product_id || null, pro_only: !!b.pro_only, active: b.active !== false, start_date: b.start_date || null, end_date: b.end_date || null });
      await audit(user.email, "COUPON_CREATE", "coupon", b.code, {});
      res.status(200).json(r); return;
    }
    if (req.method === "PATCH") {
      const b = req.body || {};
      await sbWrite("/rest/v1/coupons?id=eq." + b.id, "PATCH", b.upd || {});
      await audit(user.email, "COUPON_UPDATE", "coupon", b.id, {});
      res.status(200).json({ ok: true }); return;
    }
    if (req.method === "DELETE") {
      await fetch(SB_URL + "/rest/v1/coupons?id=eq." + req.query.id, { method: "DELETE", headers: svc });
      await audit(user.email, "COUPON_DELETE", "coupon", req.query.id, {});
      res.status(200).json({ ok: true }); return;
    }
    res.status(200).json(await sbGet("/rest/v1/coupons?select=*&order=id.desc")); return;
  }

  if (t === "admin_diet_plans") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const uid = req.query.uid;
    res.status(200).json(await sbGet("/rest/v1/diet_plans?" + (uid ? "user_id=eq." + uid + "&" : "") + "select=id,user_id,title,goal,status,start_date,end_date,duration_days,created_at,pdf_path&order=created_at.desc")); return;
  }
  if (t === "admin_diet_save" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    if (!b.user_id || !b.title) { res.status(400).json({ error: "user_id/title required" }); return; }
    let planId = b.id;
    const plan = { user_id: b.user_id, title: b.title, goal: b.goal || "", start_date: b.start_date || null, end_date: b.end_date || null, duration_days: +b.duration_days || 0, kcal_target: +b.kcal_target || 0, protein_target: +b.protein_target || 0, carbs_target: +b.carbs_target || 0, fat_target: +b.fat_target || 0, notes: b.notes || "", restrictions_text: b.restrictions_text || null, tips_text: b.tips_text || null, activity_text: b.activity_text || null, created_by: user.email };
    if (planId) await sbWrite("/rest/v1/diet_plans?id=eq." + planId, "PATCH", plan);
    else { const r = await sbWrite("/rest/v1/diet_plans?select=id", "POST", plan); planId = Array.isArray(r) && r[0] ? r[0].id : null; }
    if (!planId) { res.status(500).json({ error: "plan save failed" }); return; }
    await fetch(SB_URL + "/rest/v1/diet_plan_days?plan_id=eq." + planId, { method: "DELETE", headers: svc });
    for (const day of (Array.isArray(b.days) ? b.days : [])) {
      const dr = await sbWrite("/rest/v1/diet_plan_days?select=id", "POST", { plan_id: planId, day_number: +day.day_number });
      const dayId = Array.isArray(dr) && dr[0] ? dr[0].id : null;
      if (!dayId) continue;
      for (const meal of (Array.isArray(day.meals) ? day.meals : [])) {
        await sbWrite("/rest/v1/diet_plan_meals", "POST", { day_id: dayId, meal_type: meal.meal_type || "lunch", recipe_id: meal.recipe_id || null, title: meal.title || "", portion: meal.portion || "", notes: meal.notes || "" });
      }
    }
    await audit(user.email, "DIET_SAVE", "diet_plan", planId, { title: b.title });
    res.status(200).json({ ok: true, id: planId }); return;
  }
  if (t === "admin_diet_detail") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const id = req.query.id;
    const plan = await sbGet("/rest/v1/diet_plans?id=eq." + id + "&select=*");
    const days = await sbGet("/rest/v1/diet_plan_days?plan_id=eq." + id + "&select=id,day_number,diet_plan_meals(*)&order=day_number.asc");
    res.status(200).json({ plan: Array.isArray(plan) && plan[0], days }); return;
  }
  if (t === "admin_diet_publish" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { id, pdf_path } = req.body || {};
    const upd = { status: "published" };
    if (pdf_path) upd.pdf_path = pdf_path;
    await sbWrite("/rest/v1/diet_plans?id=eq." + id, "PATCH", upd);
    const pl = await sbGet("/rest/v1/diet_plans?id=eq." + id + "&select=user_id,title");
    if (Array.isArray(pl) && pl[0]) await notify(pl[0].user_id, "DIET_PLAN_READY", "برنامه غذایی جدیدت آماده‌ست 🥗", "«" + pl[0].title + "» در پنل کاربری قابل مشاهده و دانلود است.");
    await audit(user.email, "DIET_PUBLISH", "diet_plan", id, {});
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_diet_delete" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { id } = req.body || {};
    await fetch(SB_URL + "/rest/v1/diet_plans?id=eq." + id, { method: "DELETE", headers: svc });
    await audit(user.email, "DIET_DELETE", "diet_plan", id, {});
    res.status(200).json({ ok: true }); return;
  }
  if (t === "admin_mealgen" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    if (!b.uid) { res.status(400).json({ error: "uid required" }); return; }
    let profile = null;
    if (b.use_profile) {
      const np = await sbGet("/rest/v1/nutrition_profiles?id=eq." + b.uid + "&select=*");
      profile = (Array.isArray(np) && np[0]) || null;
    }
    profile = Object.assign({}, profile || {}, b.overrides || {});
    const r = await pbGenerate({ days: b.days, meals: b.meals, profile, have: b.have, forbidden: b.forbidden });
    if (r.error) { res.status(r.status || 502).json({ error: r.error }); return; }
    res.status(200).json({ days: r.days, activity: r.activity, constraints: r.constraints, tips: r.tips || [] }); return;
  }
  if (t === "admin_stats") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const d14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const mFirst = new Date(); mFirst.setDate(1); mFirst.setHours(0, 0, 0, 0);
    const [orders, pays, profs, ents, recs, ai, views, cms, tks, strk] = await Promise.all([
      sbGet("/rest/v1/orders?select=id,status,total,created_at"),
      sbGet("/rest/v1/payments?select=id,status,amount"),
      sbGet("/rest/v1/profiles?select=id"),
      sbGet("/rest/v1/entitlements?select=id,entitlement_type,status,expires_at"),
      sbGet("/rest/v1/recipes?select=slug,status,noindex"),
      sbGet("/rest/v1/ai_usage?select=request_count,last_request_at,period_start&period_start=gte." + mFirst.toISOString().slice(0, 10)),
      sbGet("/rest/v1/page_views?select=slug,count&day=gte." + d14),
      sbGet("/rest/v1/comments?status=eq.pending&select=id"),
      sbGet("/rest/v1/tickets?status=eq.open&select=id"),
      sbGet("/rest/v1/user_streaks?current=gte.2&select=user_id")
    ]);
    const O = Array.isArray(orders) ? orders : [], P = Array.isArray(pays) ? pays : [], U = Array.isArray(profs) ? profs : [], E = Array.isArray(ents) ? ents : [];
    const R = Array.isArray(recs) ? recs : [], A = Array.isArray(ai) ? ai : [], V = Array.isArray(views) ? views : [];
    const revenue = P.filter(x => x.status === "approved").reduce((s, x) => s + (Number(x.amount) || 0), 0);
    /* نمودار ۱۴ روز سفارش */
    const byDay = {};
    for (let i = 13; i >= 0; i--) { const k = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); byDay[k] = 0; }
    O.forEach(o => { const k = String(o.created_at || "").slice(0, 10); if (k in byDay) byDay[k]++; });
    const orders_14d = Object.keys(byDay).map(k => ({ day: k, n: byDay[k] }));
    /* پربازدیدترین رسپی‌ها */
    const viewSum = {};
    V.forEach(v => { viewSum[v.slug] = (viewSum[v.slug] || 0) + (Number(v.count) || 0); });
    const top_viewed = Object.keys(viewSum).map(s => ({ slug: s, n: viewSum[s] })).sort((a, b) => b.n - a.n).slice(0, 8);
    res.status(200).json({
      users: U.length, orders: O.length,
      paid_orders: O.filter(x => ["paid", "delivered", "sent"].includes(x.status)).length,
      pending_orders: O.filter(x => ["pending", "payment_submitted", "under_review"].includes(x.status)).length,
      revenue,
      active_pro: E.filter(x => x.entitlement_type === "PRO" && x.status === "ACTIVE" && (!x.expires_at || new Date(x.expires_at) > new Date())).length,
      expired_pro: E.filter(x => x.entitlement_type === "PRO" && x.expires_at && new Date(x.expires_at) < new Date()).length,
      recipes: R.length,
      drafts: R.filter(x => x.status !== "published").length,
      ai_month: A.reduce((s, x) => s + (Number(x.request_count) || 0), 0),
      pending_comments: Array.isArray(cms) ? cms.length : 0,
      open_tickets: Array.isArray(tks) ? tks.length : 0,
      active_streaks: Array.isArray(strk) ? strk.length : 0,
      orders_14d, top_viewed
    }); return;
  }
  if (t === "admin_audit") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    res.status(200).json(await sbGet("/rest/v1/audit_logs?select=*&order=created_at.desc&limit=100")); return;
  }

  /* ---------- مدیریت FAQ ---------- */
  if (t === "faq_list") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    res.status(200).json(await sbGet("/rest/v1/faqs?select=*&order=page_key.asc,sort.asc&limit=500")); return;
  }
  if (t === "faq_save" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    const row = {
      page_key: clean(b.page_key, 40) || "index",
      question: clean(b.question, 300),
      answer: clean(b.answer, 2000),
      sort: Number(b.sort) || 0,
      active: b.active !== false
    };
    if (!row.question || !row.answer) { res.status(400).json({ error: "question/answer required" }); return; }
    if (b.id) await sbWrite("/rest/v1/faqs?id=eq." + b.id, "PATCH", row);
    else await sbWrite("/rest/v1/faqs", "POST", row);
    res.status(200).json({ ok: true }); return;
  }
  if (t === "faq_del" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    await sbWrite("/rest/v1/faqs?id=eq." + (req.body || {}).id, "DELETE", {});
    res.status(200).json({ ok: true }); return;
  }

  /* ---------- مدیریت ریدایرکت ---------- */
  if (t === "redirect_list") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    res.status(200).json(await sbGet("/rest/v1/redirects?select=*&order=created_at.desc&limit=500")); return;
  }
  if (t === "redirect_save" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    const fp = clean(b.from_path, 300);
    const tu = clean(b.to_url, 500);
    if (!fp || !tu || !/^\/[^ ]*$/.test(fp)) { res.status(400).json({ error: "from_path باید با / شروع شود و to_url لازم است" }); return; }
    const row = { from_path: fp, to_url: tu, code: Number(b.code) === 302 ? 302 : 301, active: b.active !== false };
    if (b.id) await sbWrite("/rest/v1/redirects?id=eq." + b.id, "PATCH", row);
    else await sbWrite("/rest/v1/redirects", "POST", row);
    res.status(200).json({ ok: true }); return;
  }
  if (t === "redirect_del" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    await sbWrite("/rest/v1/redirects?id=eq." + (req.body || {}).id, "DELETE", {});
    res.status(200).json({ ok: true }); return;
  }

  /* ---------- Media Library: تصاویر استفاده‌شده در دیتابیس ---------- */
  if (t === "media_list") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const [ri, pi] = await Promise.all([
      sbGet("/rest/v1/recipes?select=slug,image,status&limit=500"),
      sbGet("/rest/v1/products?select=id,title_fa,image&limit=200")
    ]);
    const items = [];
    (Array.isArray(ri) ? ri : []).forEach(r => { if (r.image) items.push({ path: r.image, owner: "رسپی: " + r.slug, status: r.status }); });
    (Array.isArray(pi) ? pi : []).forEach(p => { if (p.image) items.push({ path: p.image, owner: "محصول: " + p.title_fa, status: null }); });
    res.status(200).json(items); return;
  }

  /* ═══════════════ فاز ۴ — نظرات، گیمیفیکیشن، تیکت، رفرال، ابزار ادمین ═══════════════ */

  /* نظرات عمومی یک رسپی (فقط تأییدشده‌ها) — بدون نیاز به ورود */
  if (t === "comments_get") {
    const slug = String(req.query.slug || "").slice(0, 120);
    if (!SLUG_RE.test(slug)) { res.status(200).json([]); return; }
    res.status(200).json(await sbGet("/rest/v1/comments?recipe_slug=eq." + slug + "&status=eq.approved&select=id,author_name,body,created_at&order=created_at.desc&limit=100"));
    return;
  }

  /* ارسال نظر (کاربر واردشده) — اول در صف تأیید */
  if (t === "comment_post" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "برای ثبت نظر اول وارد شو" }); return; }
    if (!rateOk("cm:" + user.id, 5, 10 * 60 * 1000)) { res.status(429).json({ error: "نظرهای زیاد پشت سر هم — چند دقیقه بعد تلاش کن" }); return; }
    const b = req.body || {};
    const slug = String(b.slug || "").slice(0, 120);
    const body = clean(b.body, 600);
    if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "رسپی نامعتبر" }); return; }
    if (body.length < 3) { res.status(400).json({ error: "متن نظر خیلی کوتاه است" }); return; }
    const isAdmin = await isAdminUser(user);
    const name = clean((user.user_metadata && user.user_metadata.name) || user.email.split("@")[0], 60);
    const st = isAdmin ? "approved" : "pending";
    await sbWrite("/rest/v1/comments", "POST", { user_id: user.id, author_name: name, recipe_slug: slug, body, status: st });
    await awardBadges(user.id, ["first_comment"]);
    res.status(200).json({ ok: true, status: st });
    return;
  }

  /* نظرات خود کاربر */
  if (t === "my_comments") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.status(200).json(await sbGet("/rest/v1/comments?user_id=eq." + user.id + "&select=id,recipe_slug,body,status,created_at&order=created_at.desc&limit=30"));
    return;
  }

  /* استریک روزانه — با هر بار بازکردن پنل به‌روز می‌شود */
  if (t === "streak") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const cur = await sbGet("/rest/v1/user_streaks?user_id=eq." + user.id + "&select=current,best,last_day");
    const row = Array.isArray(cur) && cur[0] ? cur[0] : {};
    let c = Number(row.current) || 0;
    if (row.last_day !== today) c = (row.last_day === yest) ? c + 1 : 1;
    const best = Math.max(c, Number(row.best) || 0);
    await sbUpsert("/rest/v1/user_streaks", { user_id: user.id, current: c, best, last_day: today, updated_at: new Date().toISOString() });
    const candidates = [3, 7, 14, 30].filter(n => c >= n).map(n => "streak_" + n);
    const fresh = await awardBadges(user.id, candidates);
    res.status(200).json({ current: c, best, new_badges: fresh });
    return;
  }

  /* نشان‌های کاربر */
  if (t === "badges") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.status(200).json(await sbGet("/rest/v1/user_badges?user_id=eq." + user.id + "&select=badge_key,earned_at&order=earned_at.asc"));
    return;
  }

  /* ثبت تاریخچه بازدید رسپی (کاربر واردشده) */
  if (t === "history_add" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const slug = clean((req.body || {}).slug, 120);
    if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "bad slug" }); return; }
    const ex = await sbGet("/rest/v1/recipe_history?user_id=eq." + user.id + "&slug=eq." + slug + "&select=id,views");
    if (Array.isArray(ex) && ex[0]) await sbWrite("/rest/v1/recipe_history?id=eq." + ex[0].id, "PATCH", { views: (Number(ex[0].views) || 0) + 1, last_at: new Date().toISOString() });
    else await sbUpsert("/rest/v1/recipe_history", { user_id: user.id, slug, views: 1, last_at: new Date().toISOString() });
    res.status(200).json({ ok: true });
    return;
  }

  /* تاریخچه من */
  if (t === "my_history") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.status(200).json(await sbGet("/rest/v1/recipe_history?user_id=eq." + user.id + "&select=slug,views,last_at&order=last_at.desc&limit=20"));
    return;
  }

  /* تیکت جدید */
  if (t === "ticket_new" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "برای ثبت تیکت وارد شو" }); return; }
    if (!rateOk("tk:" + user.id, 3, 60 * 60 * 1000)) { res.status(429).json({ error: "سقف تیکت در یک ساعت پر شد" }); return; }
    const b = req.body || {};
    const subject = clean(b.subject, 120), body = clean(b.body, 2000);
    if (subject.length < 3 || body.length < 10) { res.status(400).json({ error: "موضوع و متن تیکت را کامل کن" }); return; }
    const ins = await sbWrite("/rest/v1/tickets", "POST", { user_id: user.id, email: user.email, subject, body, status: "open" });
    res.status(200).json({ ok: true, id: Array.isArray(ins) && ins[0] ? ins[0].id : null });
    return;
  }

  /* تیکت‌های من + پاسخ‌ها */
  if (t === "my_tickets") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const rows = await sbGet("/rest/v1/tickets?user_id=eq." + user.id + "&select=*&order=created_at.desc&limit=20");
    const list = Array.isArray(rows) ? rows : [];
    if (list.length) {
      const ids = list.map(x => x.id).join(",");
      const reps = await sbGet("/rest/v1/ticket_replies?ticket_id=in.(" + ids + ")&select=ticket_id,is_admin,author_name,body,created_at&order=created_at.asc");
      const byT = {};
      (Array.isArray(reps) ? reps : []).forEach(r => { (byT[r.ticket_id] = byT[r.ticket_id] || []).push(r); });
      list.forEach(x => { x.replies = byT[x.id] || []; });
    }
    res.status(200).json(list);
    return;
  }

  /* پاسخ کاربر به تیکت خودش */
  if (t === "ticket_reply" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const b = req.body || {};
    const tid = Number(b.ticket_id) || 0, body = clean(b.body, 1500);
    if (!tid || body.length < 2) { res.status(400).json({ error: "پاسخ نامعتبر" }); return; }
    const own = await sbGet("/rest/v1/tickets?id=eq." + tid + "&user_id=eq." + user.id + "&select=id");
    if (!Array.isArray(own) || !own[0]) { res.status(403).json({ error: "این تیکت مال تو نیست" }); return; }
    await sbWrite("/rest/v1/ticket_replies", "POST", { ticket_id: tid, is_admin: false, author_name: clean((user.user_metadata && user.user_metadata.name) || user.email.split("@")[0], 60), body });
    await sbWrite("/rest/v1/tickets?id=eq." + tid, "PATCH", { status: "open", updated_at: new Date().toISOString() });
    res.status(200).json({ ok: true });
    return;
  }

  /* رفرال: دریافت کد دعوت */
  if (t === "referral_get") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const p = await sbGet("/rest/v1/profiles?id=eq." + user.id + "&select=referral_code,referral_count");
    let code = Array.isArray(p) && p[0] ? p[0].referral_code : null;
    const count = Array.isArray(p) && p[0] ? (Number(p[0].referral_count) || 0) : 0;
    if (!code) {
      for (let i = 0; i < 6; i++) {
        code = "DFB-" + Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
        const dup = await sbGet("/rest/v1/profiles?referral_code=eq." + code + "&select=id");
        if (!Array.isArray(dup) || !dup.length) break;
        code = null;
      }
      if (code) await sbWrite("/rest/v1/profiles?id=eq." + user.id, "PATCH", { referral_code: code });
      else code = null;
    }
    res.status(200).json({ code, count });
    return;
  }

  /* رفرال: اعمال کد دوست (هر کاربر فقط یک‌بار) */
  if (t === "referral_apply" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const code = clean((req.body || {}).code, 20).toUpperCase();
    if (!code) { res.status(400).json({ error: "کد را وارد کن" }); return; }
    const owner = await sbGet("/rest/v1/profiles?referral_code=eq." + encodeURIComponent(code) + "&select=id,referral_count");
    if (!Array.isArray(owner) || !owner[0]) { res.status(404).json({ error: "کد معتبر نیست" }); return; }
    if (owner[0].id === user.id) { res.status(400).json({ error: "این کد خودته!" }); return; }
    const have = await userBadgeKeys(user.id);
    if (have.has("referred")) { res.status(400).json({ error: "قبلاً از کد دعوت استفاده کرده‌ای" }); return; }
    await awardBadges(user.id, ["referred"]);
    const nc = (Number(owner[0].referral_count) || 0) + 1;
    await sbWrite("/rest/v1/profiles?id=eq." + owner[0].id, "PATCH", { referral_count: nc });
    if (nc === 5) { await awardBadges(owner[0].id, ["referral_5"]); await notify(owner[0].id, "referral", "۵ نفر با کد تو عضو شدند!", "نشان «دعوت‌گر طلایی» به تو رسید."); }
    if (nc === 10) { await awardBadges(owner[0].id, ["referral_10"]); await notify(owner[0].id, "referral", "۱۰ دعوت موفق!", "نشان «سفیر دیلی‌بیت» مال تو شد."); }
    if (nc !== 5 && nc !== 10) await notify(owner[0].id, "referral", "یک دوست با کد تو عضو شد!", "تعداد دعوت‌های موفق تو: " + nc);
    res.status(200).json({ ok: true });
    return;
  }

  /* علامت‌گذاری همه اعلان‌ها به‌عنوان خوانده‌شده */
  if (t === "notif_read" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    await sbWrite("/rest/v1/notifications?user_id=eq." + user.id + "&read=eq.false", "PATCH", { read: true });
    res.status(200).json({ ok: true });
    return;
  }

  /* ─── ادمین: مدیریت نظرات ─── */
  if (t === "admin_comments") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const pageN = Math.max(1, +(req.query.page || 1)); const lim = 30;
    const st = ["pending", "approved", "rejected"].includes(req.query.st) ? "&status=eq." + req.query.st : "";
    const r = await fetch(SB_URL + "/rest/v1/comments?select=*&order=created_at.desc&limit=" + lim + "&offset=" + (pageN - 1) * lim + st, { headers: { ...svc, Prefer: "count=exact" } });
    const total = parseInt((r.headers.get("content-range") || "0").split("/").pop() || "0", 10);
    res.status(200).json({ rows: await r.json(), total });
    return;
  }
  if (t === "comment_status" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    const id = Number(b.id) || 0;
    const st = ["pending", "approved", "rejected"].includes(b.status) ? b.status : null;
    if (!id || !st) { res.status(400).json({ error: "bad input" }); return; }
    const upd = await sbWrite("/rest/v1/comments?id=eq." + id, "PATCH", { status: st });
    if (st === "approved" && Array.isArray(upd) && upd[0]) await notify(upd[0].user_id, "comment", "نظرت منتشر شد!", "نظر تو روی رسپی تأیید و منتشر شد. ممنون که با ما هستی.");
    await audit(user.email, "comment_" + st, "comment", id);
    res.status(200).json({ ok: true });
    return;
  }
  if (t === "comment_delete" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const id = Number((req.body || {}).id) || 0;
    if (!id) { res.status(400).json({ error: "bad input" }); return; }
    await fetch(SB_URL + "/rest/v1/comments?id=eq." + id, { method: "DELETE", headers: svc });
    await audit(user.email, "comment_delete", "comment", id);
    res.status(200).json({ ok: true });
    return;
  }

  /* ─── ادمین: تیکت‌ها ─── */
  if (t === "admin_tickets") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const st = ["open", "answered", "closed"].includes(req.query.st) ? "&status=eq." + req.query.st : "";
    const rows = await sbGet("/rest/v1/tickets?select=*&order=updated_at.desc&limit=50" + st);
    const list = Array.isArray(rows) ? rows : [];
    if (list.length) {
      const ids = list.map(x => x.id).join(",");
      const reps = await sbGet("/rest/v1/ticket_replies?ticket_id=in.(" + ids + ")&select=ticket_id,is_admin,author_name,body,created_at&order=created_at.asc");
      const byT = {};
      (Array.isArray(reps) ? reps : []).forEach(r => { (byT[r.ticket_id] = byT[r.ticket_id] || []).push(r); });
      list.forEach(x => { x.replies = byT[x.id] || []; });
    }
    res.status(200).json(list);
    return;
  }
  if (t === "ticket_admin_reply" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    const tid = Number(b.ticket_id) || 0, body = clean(b.body, 1500);
    if (!tid || body.length < 2) { res.status(400).json({ error: "bad input" }); return; }
    const tk = await sbGet("/rest/v1/tickets?id=eq." + tid + "&select=user_id");
    await sbWrite("/rest/v1/ticket_replies", "POST", { ticket_id: tid, is_admin: true, author_name: "پشتیبانی DailyFitBeat", body });
    await sbWrite("/rest/v1/tickets?id=eq." + tid, "PATCH", { status: "answered", updated_at: new Date().toISOString() });
    if (Array.isArray(tk) && tk[0]) await notify(tk[0].user_id, "ticket", "پاسخ پشتیبانی رسید", "به تیکت #" + tid + " پاسخ داده شد — از پنل کاربری ببین.");
    await audit(user.email, "ticket_reply", "ticket", tid);
    res.status(200).json({ ok: true });
    return;
  }
  if (t === "ticket_admin_status" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    const id = Number(b.id) || 0;
    const st = ["open", "answered", "closed"].includes(b.status) ? b.status : null;
    if (!id || !st) { res.status(400).json({ error: "bad input" }); return; }
    await sbWrite("/rest/v1/tickets?id=eq." + id, "PATCH", { status: st, updated_at: new Date().toISOString() });
    await audit(user.email, "ticket_" + st, "ticket", id);
    res.status(200).json({ ok: true });
    return;
  }

  /* ─── ادمین: Bulk Edit رسپی‌ها ─── */
  if (t === "admin_bulk" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    const slugs = (Array.isArray(b.slugs) ? b.slugs : []).filter(s => SLUG_RE.test(String(s))).slice(0, 300);
    if (!slugs.length) { res.status(400).json({ error: "هیچ رسپی انتخاب نشده" }); return; }
    const patch = {};
    if (b.patch && ["published", "draft"].includes(b.patch.status)) patch.status = b.patch.status;
    if (b.patch && typeof b.patch.noindex === "boolean") patch.noindex = b.patch.noindex;
    if (b.patch && CAT_WHITELIST.includes(b.patch.category)) patch.category = b.patch.category;
    if (!Object.keys(patch).length) { res.status(400).json({ error: "تغییری انتخاب نشده" }); return; }
    const q = "/rest/v1/recipes?slug=in.(" + slugs.join(",") + ")";
    await fetch(SB_URL + q, { method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await audit(user.email, "bulk_edit", "recipes", slugs.length, { patch });
    res.status(200).json({ ok: true, count: slugs.length });
    return;
  }

  /* ─── ادمین: Version History رسپی‌ها ─── */
  if (t === "version_save" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const b = req.body || {};
    const slug = String(b.slug || "").slice(0, 120);
    if (!SLUG_RE.test(slug) || !b.snapshot || typeof b.snapshot !== "object") { res.status(400).json({ error: "bad input" }); return; }
    await sbWrite("/rest/v1/recipe_versions", "POST", { slug, snapshot: b.snapshot, editor: user.email });
    /* نگه‌داشتن حداکثر ۱۰ نسخه آخر برای هر رسپی */
    const all = await sbGet("/rest/v1/recipe_versions?slug=eq." + slug + "&select=id&order=created_at.desc");
    const old = (Array.isArray(all) ? all : []).slice(10).map(x => x.id);
    if (old.length) await fetch(SB_URL + "/rest/v1/recipe_versions?id=in.(" + old.join(",") + ")", { method: "DELETE", headers: svc });
    res.status(200).json({ ok: true });
    return;
  }
  if (t === "versions_list") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const slug = String(req.query.slug || "").slice(0, 120);
    if (!SLUG_RE.test(slug)) { res.status(400).json({ error: "bad slug" }); return; }
    res.status(200).json(await sbGet("/rest/v1/recipe_versions?slug=eq." + slug + "&select=id,editor,created_at&order=created_at.desc&limit=10"));
    return;
  }
  if (t === "version_get") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const id = Number(req.query.id) || 0;
    if (!id) { res.status(400).json({ error: "bad id" }); return; }
    res.status(200).json(await sbGet("/rest/v1/recipe_versions?id=eq." + id + "&select=snapshot"));
    return;
  }
  if (t === "version_restore" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const id = Number((req.body || {}).id) || 0;
    if (!id) { res.status(400).json({ error: "bad id" }); return; }
    const v = await sbGet("/rest/v1/recipe_versions?id=eq." + id + "&select=slug,snapshot");
    if (!Array.isArray(v) || !v[0] || !v[0].snapshot) { res.status(404).json({ error: "نسخه پیدا نشد" }); return; }
    const snap = v[0].snapshot;
    const patch = {};
    for (const f of RECIPE_FIELDS) if (f in snap) patch[f] = snap[f];
    if (!Object.keys(patch).length) { res.status(400).json({ error: "اسنپ‌شات خالی است" }); return; }
    await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + encodeURIComponent(v[0].slug), { method: "PATCH", headers: { ...svc, "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await audit(user.email, "version_restore", "recipe", v[0].slug);
    res.status(200).json({ ok: true, slug: v[0].slug });
    return;
  }

  res.status(404).json({ error: "not found" });
}
