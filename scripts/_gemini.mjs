/* ============================================================
   DailyFitBeat — دروازهٔ مشترک Gemini (v1)
   همهٔ اسکریپت‌های auto-pilot از این ماژول استفاده می‌کنند.

   کارهای که این ماژول انجام می‌دهد:
   ۱) خواندن کلید از هر نام متغیر محتمل + حذف فاصله/نیو‌لاین
   ۲) تشخیص داینامیک مدل از ListModels (هر مدلی که کلید واقعاً
      پشتیبانی می‌کند — سری ۳، ۲.۵، ۲ یا هرچه باشد)
   ۳) پیام تشخیصی فارسی دقیق برای 401 / 403 / 400 با راهنمای گام‌به‌گام
   ۴) ارسال کلید با هدر x-goog-api-key (بدون تداخل با Authorization)
   ۵) فاصلهٔ ۶ ثانیه‌ای بین درخواست‌ها + بک‌آف ۶۰ ثانیه برای 429
   اجرا: import { geminiInit, geminiText } from './_gemini.mjs'
   ============================================================ */

const API = "https://generativelanguage.googleapis.com/v1beta";

/* ---------- ۱) کلید ---------- */
export function getKey() {
  const cands = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
    process.env.GEMINI_KEY,
  ];
  for (const c of cands) {
    if (c && String(c).trim()) return String(c).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

export const PREF_TEXT = [
  "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash",
  "gemini-2.5-flash", "gemini-2.5-flash-lite",
  "gemini-2.0-flash", "gemini-2.0-flash-lite",
  "gemini-flash-latest", "gemini-1.5-flash",
];
const PREF_IMAGE = [
  "gemini-3-pro-image-preview", "gemini-3.6-flash-image", "gemini-3-flash-image",
  "gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation",
];

const st = { key: "", textModels: [], imageModel: "", ready: false };

/* ---------- ۲) پیام تشخیصی ---------- */
function diagnose(status, body) {
  let reason = "";
  try { reason = JSON.parse(body).error?.status || JSON.parse(body).error?.message || ""; } catch (e) {
    reason = String(body || "").slice(0, 160);
  }
  console.log("\n══════════════════════════════════════════════════════");
  console.log("🚨 اتصال به Gemini برقرار نشد — HTTP " + status + (reason ? " (" + reason + ")" : ""));
  if (status === 401) {
    console.log("علت: کلید «احراز هویت» را رد کرد (UNAUTHENTICATED).");
    console.log("یعنی مقدار Secret یا سرویسِ دیگری است یا باطل شده.");
  } else if (status === 403) {
    console.log("علت: کلید خالی است یا دسترسی به Generative Language API ندارد (PERMISSION_DENIED).");
    console.log("اگر Secret را ست کرده‌ای، در Google Cloud پروژه، API مربوط به Gemini را فعال کن.");
  } else if (status === 400) {
    console.log("علت: کلید نامعتبر است (API_KEY_INVALID).");
  } else {
    console.log("علت نامشخص — متن پاسخ بالا.");
  }
  console.log("راه‌حل ۳ مرحله‌ای:");
  console.log("  ۱) برو به https://aistudio.google.com/app/apikey و «Get API key» بزن (رایگان).");
  console.log("  ۲) در گیت‌هاب: Settings ← Secrets and variables ← Actions ← متن GEMINI_API_KEY را Update کن.");
  console.log("  ۳) ورک‌فلوی auto-pilot را دوباره Run کن — این اسکریپت خودش بهترین مدلِ موجود را پیدا می‌کند.");
  console.log("نکته: مقدار Secret باید «فقط خود کلید» باشد؛ بدون Bearer، بدون کوتیشن، بدون توضیح.");
  console.log("══════════════════════════════════════════════════════\n");
}

/* ---------- ۳) ListModels + انتخاب مدل ---------- */
export async function geminiInit(opts = {}) {
  st.key = getKey();
  if (!st.key) {
    console.log("\n🚨 هیچ کلید Gemini پیدا نشد (env: GEMINI_API_KEY).");
    console.log("در گیت‌هاب: Settings ← Secrets and variables ← Actions ← New repository secret");
    console.log("Name: GEMINI_API_KEY | Value: کلید رایگان از https://aistudio.google.com/app/apikey\n");
    return st;
  }
  const q = opts.quiet ? 0 : 1;
  let models = [];
  try {
    const r = await fetch(API + "/models?pageSize=200", {
      headers: { "x-goog-api-key": st.key },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) {
      const b = await r.text().catch(() => "");
      diagnose(r.status, b);
      return st;
    }
    const j = await r.json();
    models = (j.models || []).map((m) => ({
      name: String(m.name || "").replace(/^models\//, ""),
      ok: (m.supportedGenerationMethods || []).includes("generateContent"),
    }));
    console.log("🔑 کلید Gemini سالم است — " + models.length + " مدل در دسترس.");
  } catch (e) {
    console.log("🚨 خطای شبکه در اتصال به Gemini: " + e.message);
    return st;
  }

  const avail = new Set(models.filter((m) => m.ok).map((m) => m.name));
  /* مدل دستی از env اولویت دارد */
  if (process.env.GEMINI_MODEL && avail.has(process.env.GEMINI_MODEL)) {
    st.textModels = [process.env.GEMINI_MODEL];
  } else {
    /* لیست گسترده: ترجیحی‌ها + بقیهٔ مدل‌های flash + حداکثر ۵ مدل متنی دیگر
       (اگر مدل اول در لحظهٔ فراخوانی 404 داد، خودکار بعدی‌ها امتحان می‌شوند) */
    const others = models
      .filter((m) => m.ok && !/embed|tts|image|audio|aqa|live|native/i.test(m.name))
      .map((m) => m.name)
      .filter((n) => !PREF_TEXT.includes(n))
      .sort((a, b) => (/flash/i.test(b) ? 1 : 0) - (/flash/i.test(a) ? 1 : 0));
    st.textModels = [...new Set([...PREF_TEXT.filter((m) => avail.has(m)), ...others.slice(0, 8)])];
  }
  st.imageModel =
    PREF_IMAGE.find((m) => avail.has(m)) ||
    (models.find((m) => m.ok && /image/i.test(m.name) && !/exp|deprecated/i.test(m.name)) || {}).name ||
    "";
  st.ready = st.textModels.length > 0;
  if (q) console.log("🧠 مدل متن: " + (st.textModels.join(" ← ") || "یافت نشد") + (st.imageModel ? " | مدل تصویر: " + st.imageModel : ""));
  if (!st.ready) console.log("🚨 هیچ مدل متنی قابل استفاده یافت نشد — احتمالاً کلید به سرویس دیگری تعلق دارد.");
  return st;
}

/* ---------- ۴) درخواست متن ---------- */
let lastAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callModel(model, body, timeoutMs = 60000) {
  const gap = Date.now() - lastAt;
  if (gap < 6000) await sleep(6000 - gap);
  lastAt = Date.now();
  return fetch(API + "/models/" + model + ":generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": st.key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/* خروجی: متن یا '' — 404 مدل را رد می‌کند به بعدی، 401/403 دیگر تکرار نمی‌شود */
export async function geminiText(prompt, opts = {}) {
  if (!st.ready) return "";
  let authDead = false;
  for (const model of st.textModels.slice()) {
    for (let back = 0; back < 2; back++) {
      let r;
      try {
        r = await callModel(model, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: Object.assign({ temperature: 0.7, responseMimeType: "application/json" }, opts.generationConfig || {}),
        }, opts.timeoutMs || 60000);
      } catch (e) { break; }
      if (r.status === 429) { console.log("   ⏳ 429 — صبر ۶۰ث…"); await sleep(60000); continue; }
      if (r.status === 401 || r.status === 403) {
        if (!authDead) { diagnose(r.status, await r.text().catch(() => "")); authDead = true; }
        st.ready = false;
        return "";
      }
      if (r.status === 404 || r.status === 400) {
        /* این مدل برای این کلید نیست/منقضی شده → از لیست حذف و برو بعدی */
        const bb = await r.text().catch(() => "");
        let why = ""; try { why = JSON.parse(bb).error?.message || ""; } catch (e) {}
        console.log("   ⚠ " + model + " → " + r.status + " — مدل رد شد" + (why ? " | " + String(why).slice(0, 140) : ""));
        st.textModels = st.textModels.filter((m) => m !== model);
        break;
      }
      if (!r.ok) {
        const bb = await r.text().catch(() => "");
        let why = ""; try { why = JSON.parse(bb).error?.status || JSON.parse(bb).error?.message || ""; } catch (e) {}
        console.log("   ⚠ " + model + " → HTTP " + r.status + (why ? " | " + String(why).slice(0, 140) : ""));
        if (r.status === 429) { console.log("   ⏳ سهمیهٔ این مدل پر است — مدل بعدی…"); st.textModels = st.textModels.filter((m) => m !== model); }
        break;
      }
      try {
        const j = await r.json();
        const t = (j.candidates?.[0]?.content?.parts?.[0]?.text) || "";
        if (t) { if (!opts.quiet) console.log("   🧠 via " + model); return t; }
      } catch (e) {}
      break;
    }
  }
  return "";
}

/* ---------- ۶) تولید تصویر (مدل image) — خروجی: Buffer یا null ---------- */
export async function geminiImage(styleDesc) {
  if (!st.imageModel) return null;
  let r;
  try {
    r = await callModel(st.imageModel, {
      contents: [{ parts: [{ text: styleDesc }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }, 90000);
  } catch (e) { return null; }
  if (!r.ok) { console.log("   ⚠ image " + st.imageModel + " → " + r.status); return null; }
  try {
    const j = await r.json();
    const parts = (j.candidates?.[0]?.content?.parts) || [];
    for (const p of parts) if (p.inline_data?.data) return Buffer.from(p.inline_data.data, "base64");
  } catch (e) {}
  return null;
}

export const geminiState = st;

/* ---------- ۵) بینایی (تصویر + متن) — برای کنترل کیفیت عکس ---------- */
export async function geminiVision(jpegBase64, question) {
  if (!st.ready) return "";
  for (const model of st.textModels.slice()) {
    let r;
    try {
      r = await callModel(model, {
        contents: [{ parts: [
          { inline_data: { mime_type: "image/jpeg", data: jpegBase64 } },
          { text: question },
        ] }],
        generationConfig: { temperature: 0.2 },
      }, 60000);
    } catch (e) { continue; }
    if (r.status === 404 || r.status === 400) {
      st.textModels = st.textModels.filter((m) => m !== model);
      if (!st.textModels.length) st.ready = false;
      continue;
    }
    if (!r.ok) continue;
    try {
      const j = await r.json();
      const t = (j.candidates?.[0]?.content?.parts?.[0]?.text) || "";
      if (t) return t;
    } catch (e) {}
  }
  return "";
}
