/* ══════════════════════════════════════════════════════════════
   payinfo — تحویل امن اطلاعات کارت‌به‌کارت
   شماره کارت هرگز در HTML/JS/گیت‌هاب نیست؛ از متغیرهای Vercel
   (PAY_CARD / PAY_CARD_NAME) فقط برای مرورگرِ همین سایت خوانده می‌شود:
   - بررسی Same-Origin (Origin/Referer باید host سایت باشد)
   - محدودسازی نرخ ۲۰ درخواست در دقیقه برای هر IP
   - هدر no-store تا کش نشود + noindex
   ══════════════════════════════════════════════════════════════ */
const HIT = new Map();
function rateOk(ip, max, win) {
  const now = Date.now();
  const arr = (HIT.get(ip) || []).filter(t => now - t < win);
  if (arr.length >= max) { HIT.set(ip, arr); return false; }
  arr.push(now); HIT.set(ip, arr);
  if (HIT.size > 5000) { for (const k of HIT.keys()) { if (HIT.get(k).every(t => now - t >= win)) HIT.delete(k); if (HIT.size <= 2500) break; } }
  return true;
}
function hostOf(v) { try { return new URL(v).host.toLowerCase(); } catch (e) { return ""; } }

export default function handler(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "method" }); return; }

  /* فقط مرورگر خود سایت — curl و اسکرپر بدون Origin/Referer رد می‌شوند */
  const host = String(req.headers.host || "").toLowerCase().split(":")[0];
  const o = req.headers.origin ? hostOf(String(req.headers.origin)) : hostOf(String(req.headers.referer || ""));
  if (!host || !o || o.split(":")[0] !== host) { res.status(403).json({ error: "forbidden" }); return; }

  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "x").split(",")[0].trim() || "x";
  if (!rateOk(ip, 20, 60000)) { res.status(429).json({ error: "slow down" }); return; }

  const card = String(process.env.PAY_CARD || "").trim();
  const holder = String(process.env.PAY_CARD_NAME || "").trim();
  if (!card || !holder) { res.status(503).json({ error: "pay-not-configured" }); return; }

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.status(200).json({ card, holder });
}
