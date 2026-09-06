/* DailyFitBeat — Redirect Manager
   GET /api/redirect?from=/recipes/old-slug
   اگر در جدول redirects مسیر فعال باشد → 301/302 به مقصد، وگرنه 404 */
const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";

export default async function handler(req, res) {
  const from = String(req.query.from || "").slice(0, 300);
  if (!from) { res.status(400).json({ error: "from required" }); return; }

  try {
    const r = await fetch(SB_URL + "/rest/v1/redirects?from_path=eq." + encodeURIComponent(from) + "&active=eq.true&select=to_url,code&limit=1", {
      headers: { apikey: ANON, Authorization: "Bearer " + ANON }
    });
    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0] && rows[0].to_url) {
        const code = Number(rows[0].code) === 302 ? 302 : 301;
        res.setHeader("Location", rows[0].to_url);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.status(code).end();
        return;
      }
    }
  } catch (e) { /* جدول/دسترسی در دسترس نیست — مثل نبودن ریدایرکت رفتار کن */ }

  res.setHeader("Cache-Control", "no-store");
  res.status(404).json({ error: "no redirect" });
}
