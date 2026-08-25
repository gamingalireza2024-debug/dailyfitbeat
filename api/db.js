const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const h = { apikey: ANON, Authorization: "Bearer " + ANON };
const svc = { apikey: ANON, Authorization: "Bearer " + SERVICE };
const ALLOWED_STATUSES = ["new","pending","payment_submitted","under_review","paid","processing","delivered","sent","rejected","cancelled","refunded"];
const STATUS_FA = {new:"جدید",pending:"در انتظار پرداخت",payment_submitted:"پرداخت ثبت شده",under_review:"در بررسی",paid:"پرداخت شده",processing:"در حال پردازش",delivered:"تحویل شده",sent:"ارسال شده",rejected:"رد شده",cancelled:"لغو شده",refunded:"مسترد شده"};

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
async function userIsPro(uid) {
  const e = await sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&entitlement_type=eq.PRO&status=eq.ACTIVE&select=expires_at");
  const s = await sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&status=eq.ACTIVE&select=end_date");
  const act = (arr, f) => arr.some(x => !x[f] || new Date(x[f]) > new Date());
  return (Array.isArray(e) && e.length && act(e, 'expires_at')) || (Array.isArray(s) && s.length && act(s, 'end_date'));
}
async function proExpiry(uid) {
  const e = await sbGet("/rest/v1/entitlements?user_id=eq." + uid + "&entitlement_type=eq.PRO&status=eq.ACTIVE&select=expires_at&order=expires_at.desc");
  const s = await sbGet("/rest/v1/subscriptions?user_id=eq." + uid + "&status=eq.ACTIVE&select=end_date&order=end_date.desc");
  const d = [ ...(Array.isArray(e)?e:[]).map(x=>x.expires_at), ...(Array.isArray(s)?s:[]).map(x=>x.end_date) ].filter(Boolean).sort().pop();
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
  if (t === "ping") { res.status(200).json({ v: 15 }); return; }

  // ---------- عمومی ----------
  if (t === "ingredients") { res.status(200).json(await sbGet("/rest/v1/ingredients?select=key,fa,en&key=in.(chicken,beef,egg,tomato,rice,potato,onion,garlic,mushroom,spinach,avocado,bread,greek-yogurt,salmon,chickpea,lentil,fish,shrimp,eggplant,kashk,walnut,pomegranate-molasses)")); return; }
  if (t === "popular") { res.status(200).json(await sbGet("/rest/v1/recipes?select=*&limit=4")); return; }
  if (t === "all") { res.status(200).json(await sbGet("/rest/v1/recipes?select=*&limit=300")); return; }
  if (t === "match") { const have = String(req.query.a || "").split(",").filter(Boolean); res.status(200).json(await (await fetch(SB_URL + "/rest/v1/rpc/match_recipes", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ have }) })).json()); return; }
  if (t === "products") { res.status(200).json(await sbGet("/rest/v1/products?select=*&active=eq.true&published=neq.false&order=id.asc")); return; }
  if (t === "plans") { res.status(200).json(await sbGet("/rest/v1/plans?select=*&active=neq.false&order=id.asc")); return; }
  if (t === "admin_check") { const auth = req.headers.authorization; res.status(200).json(await (await fetch(SB_URL + "/rest/v1/admins?select=email", { headers: auth ? { apikey: ANON, Authorization: auth } : h })).json()); return; }

  // ---------- ثبت سفارش قدیمی (فرم مارکت) ----------
  if (t === "order" && req.method === "POST") {
    const b = req.body || {};
    if (!b.name || !b.phone || !b.product) { res.status(400).json({ error: "fields required" }); return; }
    const arr = await sbWrite("/rest/v1/orders?select=id", "POST", { name: b.name, phone: b.phone, email: b.email, product: b.product, note: b.note, ref: b.ref, user_id: b.user_id || null, status: "new" });
    const id = Array.isArray(arr) && arr[0] ? arr[0].id : null;
    const tg = await sendTelegram("🛒 سفارش #" + id + "\n" + b.name + " | " + b.phone + "\n" + b.product + "\nکد واریز: " + b.ref);
    const mail = await sendMail(b, id);
    res.status(200).json({ id, tg, mail }); return;
  }

  // ---------- چک‌آوت جدید (کاربر واردشده) ----------
  if (t === "checkout" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
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

  // ---------- ثبت کد واریز (کاربر مالک) ----------
  if (t === "submit_payment" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
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

  // ---------- داده‌های خصوصی کاربر ----------
  if (t === "my_orders" || t === "my_favs") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const url = t === "my_orders" ? "/rest/v1/orders?user_id=eq." + user.id + "&select=*&order=created_at.desc" : "/rest/v1/favorites?user_id=eq." + user.id + "&select=recipe_slug";
    res.status(200).json(await sbGet(url)); return;
  }
  if (t === "my_payments") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.status(200).json(await sbGet("/rest/v1/payments?user_id=eq." + user.id + "&select=id,order_id,amount,status,provider,reference,created_at&order=created_at.desc")); return;
  }
  if (t === "my_entitlements") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    const pro = await userIsPro(user.id);
    const exp = pro ? await proExpiry(user.id) : null;
    const ents = await sbGet("/rest/v1/entitlements?user_id=eq." + user.id + "&entitlement_type=eq.PRODUCT&status=eq.ACTIVE&select=id,expires_at,granted_at,products(title_fa,image,file_path)");
    const valid = (Array.isArray(ents) ? ents : []).filter(e => !e.expires_at || new Date(e.expires_at) > new Date());
    res.status(200).json({ pro, pro_expires: exp, products: valid }); return;
  }
  if (t === "my_diet_plans") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.status(200).json(await sbGet("/rest/v1/diet_plans?user_id=eq." + user.id + "&status=eq.published&select=id,title,goal,start_date,end_date,duration_days,kcal_target,protein_target,carbs_target,fat_target,notes,pdf_path,created_at&order=created_at.desc")); return;
  }
  if (t === "my_notifications") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.status(200).json(await sbGet("/rest/v1/notifications?user_id=eq." + user.id + "&select=*&order=created_at.desc&limit=30")); return;
  }

  // ---------- دانلود امن (Signed URL + بررسی Entitlement) ----------
  if (t === "download") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
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

  // ---------- آپلود فایل محصول/PDF (فقط ادمین) ----------
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

  // ---------- لیست خرید (PRO) ----------
  if (t === "my_list") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    res.status(200).json(await sbGet("/rest/v1/shopping_lists?user_id=eq." + user.id + "&select=items,updated_at")); return;
  }
  if (t === "save_list" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await userIsPro(user.id))) { res.status(403).json({ error: "PRO required" }); return; }
    const { items } = req.body || {};
    const cur = await sbGet("/rest/v1/shopping_lists?user_id=eq." + user.id + "&select=id");
    if (Array.isArray(cur) && cur[0]) await sbWrite("/rest/v1/shopping_lists?id=eq." + cur[0].id, "PATCH", { items, updated_at: new Date().toISOString() });
    else await sbWrite("/rest/v1/shopping_lists", "POST", { user_id: user.id, items });
    res.status(200).json({ ok: true }); return;
  }

  // ---------- ادمین: پرداخت‌ها ----------
  if (t === "admin_payments") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const pays = await sbGet("/rest/v1/payments?select=id,order_id,user_id,amount,provider,reference,status,created_at,verified_at,meta,orders(product,phone,email,name)&order=created_at.desc");
    res.status(200).json(pays); return;
  }
  if (t === "approve_payment" && req.method === "POST") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const { payment_id } = req.body || {};
    const p = await sbGet("/rest/v1/payments?id=eq." + payment_id + "&select=*");
    const pay = Array.isArray(p) && p[0];
    if (!pay) { res.status(404).json({ error: "payment not found" }); return; }
    if (pay.status === "approved") { res.status(200).json({ ok: true, already: true }); return; } // idempotent
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
    if (meta.coupon_id) { const c = await sbGet("/rest/v1/coupons?id=eq." + meta.coupon_id + "&select=used_count"); if (Array.isArray(c) && c[0]) await sbWrite("/rest/v1/coupons?id=eq." + meta.coupon_id, "PATCH", { used_count: (c[0].used_count || 0) + 1 }); }
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
    res.status(200).json(await sbGet("/rest/v1/orders?select=*&order=created_at.desc")); return;
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

  // ---------- ادمین: کاربران + آنالیتیکس + audit ----------
  if (t === "admin_users") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const q = String(req.query.q || "").toLowerCase();
    const profs = await sbGet("/rest/v1/profiles?select=id,name,phone&order=id.asc");
    const out = [];
    for (const pr of (Array.isArray(profs) ? profs : [])) {
      if (q && !(pr.name || "").toLowerCase().includes(q) && !(pr.phone || "").includes(q) && !(pr.id || "").includes(q)) continue;
      out.push(pr);
      if (out.length >= 50) break;
    }
    res.status(200).json(out); return;
  }
  if (t === "admin_stats") {
    const user = await authUser(req); if (!user) { res.status(401).json({ error: "unauthorized" }); return; }
    if (!(await isAdminUser(user))) { res.status(403).json({ error: "forbidden" }); return; }
    const [orders, pays, subs, profs, ents] = await Promise.all([
      sbGet("/rest/v1/orders?select=id,status,total&order=id.desc"),
      sbGet("/rest/v1/payments?select=id,status,amount"),
      sbGet("/rest/v1/subscriptions?select=id,status,end_date"),
      sbGet("/rest/v1/profiles?select=id"),
      sbGet("/rest/v1/entitlements?select=id,entitlement_type,status,expires_at")
    ]);
    const O = Array.isArray(orders) ? orders : [], P = Array.isArray(pays) ? pays : [], S = Array.isArray(subs) ? subs : [], U = Array.isArray(profs) ? profs : [], E = Array.isArray(ents) ? ents : [];
    const revenue = P.filter(x => x.status === "approved").reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const activePro = E.filter(x => x.entitlement_type === "PRO" && x.status === "ACTIVE" && (!x.expires_at || new Date(x.expires_at) > new Date())).length;
    res.status(200).json({
      users: U.length,
      orders: O.length,
      paid_orders: O.filter(x => ["paid","delivered","sent"].includes(x.status)).length,
      pending_orders: O.filter(x => ["pending","payment_submitted","under_review"].includes(x.status)).length,
      revenue,
      active_pro: activePro,
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
