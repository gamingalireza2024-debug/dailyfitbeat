#!/usr/bin/env node
/* ============================================================
   DailyFitBeat — Check Keys (تشخیص سلامت)
   این استپ «فقط گزارش» است؛ exit همیشه 0 تا اجرای بقیه متوقف نشود.
   خروجی دقیقاً می‌گوید کدام کلید سالم است و کدام نه + راه‌حل فارسی.
   ============================================================ */
const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";

console.log("🔎 بررسی سلامت کلیدها…");
console.log("──────────────────────────────────────────────");

/* ---------- Supabase ---------- */
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SERVICE) {
  console.log("❌ SUPABASE_SERVICE_ROLE_KEY: خالی! → Settings ← Secrets and variables ← Actions");
} else {
  try {
    const r = await fetch(SB_URL + "/rest/v1/recipes?select=slug&limit=1", {
      headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE },
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) {
      const j = await r.json();
      console.log("✅ SUPABASE_SERVICE_ROLE_KEY: سالم است (نمونه: " + (j[0]?.slug || "?") + ")");
    } else {
      console.log("❌ SUPABASE_SERVICE_ROLE_KEY: رد شد (HTTP " + r.status + ") — مقدار Secret را با service_role کامل از Supabase ← Settings ← API عوض کن.");
    }
  } catch (e) {
    console.log("❌ SUPABASE: خطای شبکه — " + e.message);
  }
}

/* ---------- Gemini ---------- */
const cands = [
  ["GEMINI_API_KEY", process.env.GEMINI_API_KEY],
  ["GOOGLE_API_KEY", process.env.GOOGLE_API_KEY],
  ["GOOGLE_GENERATIVE_AI_API_KEY", process.env.GOOGLE_GENERATIVE_AI_API_KEY],
];
const found = cands.find(([, v]) => v && String(v).trim());
if (!found) {
  console.log("❌ GEMINI_API_KEY: خالی! → Settings ← Secrets and variables ← Actions ← New repository secret");
  console.log("   Name: GEMINI_API_KEY | Secret: کلید رایگان از https://aistudio.google.com/app/apikey");
} else {
  const key = String(found[1]).trim();
  const shape = /^AIza[0-9A-Za-z_-]{30,}$/.test(key);
  console.log("ℹ کلید از متغیر «" + found[0] + "» خوانده شد | طول: " + key.length + " | فرمت AIza: " + (shape ? "بله" : "خیر ← کلید واقعی Gemini با AIza شروع می‌شود؛ اگر Secret چیز دیگری است عوضش کن"));
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) {
      const j = await r.json();
      const models = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""));
      console.log("✅ GEMINI_API_KEY: سالم است — " + models.length + " مدل قابل استفاده.");
      const flashes = models.filter((m) => /flash/i.test(m.name || m)).slice(0, 12);
      console.log("   نمونهٔ مدل‌های flash: " + (flashes.join(" , ") || "—"));
    } else {
      const b = await r.text().catch(() => "");
      let reason = "";
      try { reason = JSON.parse(b).error?.status || ""; } catch (e) {}
      if (r.status === 401) console.log("❌ GEMINI_API_KEY: رد شد (401 UNAUTHENTICATED" + (reason ? " / " + reason : "") + ") ← کلید مربوط به گوگل نیست یا باطل شده. کلید تازه از aistudio.google.com/app/apikey بگیر.");
      else if (r.status === 403) console.log("❌ GEMINI_API_KEY: دسترسی رد شد (403" + (reason ? " / " + reason : "") + ") ← کلید خالی رفته یا API در پروژهٔ گوگل فعال نیست.");
      else if (r.status === 400) console.log("❌ GEMINI_API_KEY: نامعتبر (400 API_KEY_INVALID" + (reason ? " / " + reason : "") + ") ← مقدار Secret را دوباره با دقت کپی کن (بدون فاصله/کوتیشن).");
      else console.log("❌ GEMINI_API_KEY: HTTP " + r.status + " — " + b.slice(0, 160));
    }
  } catch (e) {
    console.log("❌ GEMINI: خطای شبکه — " + e.message);
  }
}
console.log("──────────────────────────────────────────────");
process.exit(0);
