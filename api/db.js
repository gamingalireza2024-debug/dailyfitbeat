const SB_URL = "https://hvqchqqlfjcjxsohxywbd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const h = { apikey: KEY, Authorization: "Bearer " + KEY };

export default async function handler(req, res) {
  const out = {};
  try {
    const r = await fetch(SB_URL + "/rest/v1/ingredients?select=key,fa&limit=3", { headers: h });
    out.status = r.status;
    out.body = await r.json().catch(() => "not-json");
  } catch (e) {
    out.error = String(e);
  }
  res.status(200).json(out);
}
