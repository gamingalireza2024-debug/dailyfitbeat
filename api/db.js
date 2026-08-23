const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const h = { apikey: KEY, Authorization: "Bearer " + KEY };

export default async function handler(req, res) {
  const t = req.query.t || "";
  if (t === "ping") { res.status(200).json({ v: 5 }); return; }
  let out = [];
  try {
    if (t === "ingredients") {
      out = await (await fetch(SB_URL + "/rest/v1/ingredients?select=key,fa,en&key=in.(chicken,beef,egg,tomato,rice,potato,onion,garlic,mushroom,spinach,avocado,bread,greek-yogurt,salmon,chickpea,lentil,fish,shrimp,eggplant,kashk,walnut,pomegranate-molasses)", { headers: h })).json();
    } else if (t === "popular") {
      out = await (await fetch(SB_URL + "/rest/v1/recipes?select=*&limit=4", { headers: h })).json();
    } else if (t === "all") {
      out = await (await fetch(SB_URL + "/rest/v1/recipes?select=*&limit=200", { headers: h })).json();
    } else if (t === "match") {
      const have = String(req.query.a || "").split(",").filter(Boolean);
      out = await (await fetch(SB_URL + "/rest/v1/rpc/match_recipes", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ have }) })).json();
    } else if (t === "order") {
      const b = req.body || {};
      const ins = await fetch(SB_URL + "/rest/v1/orders?select=id", { method: "POST", headers: { ...h, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ name: b.name, phone: b.phone, product: b.product, qty: b.qty, note: b.note, ref: b.ref }) });
      const arr = await ins.json();
      const id = Array.isArray(arr) && arr[0] ? arr[0].id : null;
      const TG = process.env.TG_TOKEN, CH = process.env.TG_CHAT;
      if (TG && CH) {
        try { await fetch("https://api.telegram.org/bot" + TG + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: CH, text: "🛒 سفارش #" + id + "\n" + b.name + " | " + b.phone + "\n" + b.product + " x" + b.qty + "\nکد واریز: " + b.ref + (b.note ? "\nیادداشت: " + b.note : "") }) }); } catch (e) {}
      }
      out = { id };
    }
  } catch (e) { out = { error: String(e) }; }
  res.status(200).json(out);
}
