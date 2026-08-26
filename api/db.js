const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const h = { apikey: ANON, Authorization: "Bearer " + ANON };
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };
const ALLOWED_STATUSES = ["new","pending","payment_submitted","under_review","paid","processing","delivered","sent","rejected","cancelled","refunded"];

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
async function audit(admin, action, type, id, meta) {
  await sbWrite("/rest/v1/audit_logs", "POST", { admin_email: admin, action, target_type: type, target_id: String(id), meta: meta || {} });
}
async function notify(uid, type, title, body) {
  await sbWrite("/rest/v1/notifications", "POST", { user_id: uid, type, title, body });
}

export default async function handler(req, res) {
  const t = req.query.t || "";
  if (t === "ping") { res.status(200).json({ v: 18 }); return; }

  // ---------- عمومی ----------
  if (t === "ingredients") { res.status(200).json(await sbGet("/rest/v1/ingredients?select=key,fa,en&key=in.(chicken,beef,egg,tomato,rice,potato,onion,garlic,mushroom,spinach,avocado,bread,greek-yogurt,salmon,chickpea,lentil,fish,shrimp,eggplant,kashk,walnut,pomegranate-molasses)")); return; }
  if (t === "popular") { res.status(200).json(await sbGet("/rest/v1/recipes?select=*&limit=4")); return; }
  if (t === "all") { res.status(200).json(await sbGet("/rest/v1/recipes?select=*&limit=300")); return; }
  if (t === "match") { const have = String(req.query.a || "").split(",").filter(Boolean); res.status(200).json(await (await fetch(SB_URL + "/rest/v1/rpc/match_recipes", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ have }) })).json()); return; }
  if (t === "products") { res.status(200).json(await sbGet("/rest/v1/products?select=*&active=eq.true&order=id.asc")); return; }
  if (t === "plans") { res.status(200).json(await sbGet("/rest/v1/plans?select=*&order=id.asc")); return; }
  if (t === "admin_check") { const auth = req.headers.authorization; res.status(200).json(await (await fetch(SB_URL + "/rest/v1/admins?select=email", { headers: auth ? { apikey: ANON, Authorization: auth } : h })).json()); return; }

  // ---------- سفارش مهمان ----------
  if (t === "order" && req.method === "POST") {
    const b = req.body || {};
    if (!b.name || !b.phone || !b.product) { res.status(400).json({ error: "fields required" }); return; }
    const arr = await sbWrite("/rest/v1/orders?select=id", "POST", { name: b.name, phone: b.phone, email: b.email, product: b.product, note: b.note, ref: b.ref, user_id: b.user_id || null, status: "new" });
    const id = Array.isArray(arr) && arr[0] ? arr[0].id : null;
    const tg = await sendTelegram("🛒 سفارش #" + id + "\n" + b.name + " | " + b.phone + "\n" + b.product + "\nکد واریز: " + b.ref);
    const mail = await sendMail(b, id);
    res.status(200).json({ id, tg, mail }); return;
  }

  // ---------- چک‌آوت ----------
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

  // ---------- ثبت واریز ----------
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
    await sendTelegram("💳 واریز ثبت شد — سفارش #" + pay.order_id + " کد: " + ref);
    res.status(200).json({ ok: true }); return;
  }

  // ---------- خصوصی کاربر ----------
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
      res.status(200).json({ url: SB_URL + "/storage/v1/object" + sj.signedURL }); return;
    }
  }

  // ---------- آپلود (ادمین) ----------
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

  // ---------- ادمین: پرداخت‌ها ----------
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
      if (Array.isArray(c) && c[0]) {
        const ub = Array.isArray(c[0].used_by) ? c[0].used_by : [];
        if (!ub.includes(pay.user_id)) ub.push(pay.user_id);
        await sbWrite("/rest/v1/coupons?id=eq." + meta.coupon_id, "PATCH", { used_count: (c[0].used_count || 0) + 1, used_by: ub });
      }
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

  // ---------- ادمین: سفارش‌ها ----------
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

  // ---------- ادمین: کاربران (RPC با توکن خود ادمین) ----------
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

  // ---------- ادمین: PRO دستی ----------
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

  // ---------- ادمین: دسترسی محصول ----------
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

  // ---------- ادمین: کوپن‌ها ----------
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

  // ---------- ادمین: Diet Builder ----------
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
    const plan = { user_id: b.user_id, title: b.title, goal: b.goal || "", start_date: b.start_date || null, end_date: b.end_date || null, duration_days: +b.duration_days || 0, kcal_target: +b.kcal_target || 0, protein_target: +b.protein_target || 0, carbs_target: +b.carbs_target || 0, fat_target: +b.fat_target || 0, notes: b.notes || "", created_by: user.email };
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

  // ---------- ادمین: آنالیتیکس + audit ----------
  if (t === "admin_stats") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const [orders, pays, profs, ents] = await Promise.all([
      sbGet("/rest/v1/orders?select=id,status,total"),
      sbGet("/rest/v1/payments?select=id,status,amount"),
      sbGet("/rest/v1/profiles?select=id"),
      sbGet("/rest/v1/entitlements?select=id,entitlement_type,status,expires_at")
    ]);
    const O = Array.isArray(orders) ? orders : [], P = Array.isArray(pays) ? pays : [], U = Array.isArray(profs) ? profs : [], E = Array.isArray(ents) ? ents : [];
    const revenue = P.filter(x => x.status === "approved").reduce((s, x) => s + (Number(x.amount) || 0), 0);
    res.status(200).json({
      users: U.length, orders: O.length,
      paid_orders: O.filter(x => ["paid", "delivered", "sent"].includes(x.status)).length,
      pending_orders: O.filter(x => ["pending", "payment_submitted", "under_review"].includes(x.status)).length,
      revenue,
      active_pro: E.filter(x => x.entitlement_type === "PRO" && x.status === "ACTIVE" && (!x.expires_at || new Date(x.expires_at) > new Date())).length,
      expired_pro: E.filter(x => x.entitlement_type === "PRO" && x.expires_at && new Date(x.expires_at) < new Date()).length
    }); return;
  }
  if (t === "admin_audit") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    res.status(200).json(await sbGet("/rest/v1/audit_logs?select=*&order=created_at.desc&limit=100")); return;
  }

  res.status(404).json({ error: "not found" });
}
