/* ============================================================
   DailyFitBeat — دروازهٔ مشترک تولید تصویر (v1)
   همهٔ اسکریپت‌های auto-pilot از این ماژول برای تولید عکس استفاده می‌کنند.

   زنجیرهٔ fallback (به ترتیب اولویت):
     ۱) Cloudflare Workers AI — مدل FLUX-schnell (رایگان ۱۰k Neuron/day)
        ← کیفیت عالی، واقعی‌ترین، به‌شرط داشتن CF_API_TOKEN + CF_ACCOUNT_ID
     ۲) Gemini Image (مدل image از _gemini.mjs) — کیفیت خوب، رایگان با لیمیت
     ۳) Pollinations (مدل sana) — رایگان، بدون کلید، پایدار ولی کم‌کیفیت‌تر

   خروجی هر تابع: Buffer از JPEG، یا null اگه همه شکست خوردند.
   ============================================================ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- ۱) Cloudflare Workers AI: FLUX-schnell ---------- */
// مدل‌های قابل استفاده روی CF Workers AI:
//   @cf/black-forest-labs/flux-1-schnell   ← سریع، رایگان، کیفیت خوب
//   @cf/stabilityai/stable-diffusion-xl-base-1.0  ← پایدار، واقعی‌تر
// ما FLUX-schnell را اولویت می‌دهیم (سریع و رایگان در سهمیه).
const CF_FLUX_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const CF_SD_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

export async function cloudflareImage(prompt) {
  const token = process.env.CF_API_TOKEN || "";
  const accountId = process.env.CF_ACCOUNT_ID || "";
  if (!token || !accountId) return null;

  // اول FLUX-schnell، اگه شکست خورد SD-XL
  for (const model of [CF_FLUX_MODEL, CF_SD_MODEL]) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ prompt: prompt, width: 1024, height: 1024 }),
        signal: AbortSignal.timeout(90000),
      });

      if (!r.ok) {
        const b = await r.text().catch(() => "");
        let why = ""; try { why = JSON.parse(b).errors?.[0]?.message || ""; } catch (e) {}
        console.log(`   ⚠ CF ${model.split("/").pop()} → ${r.status}${why ? " | " + String(why).slice(0, 120) : ""}`);
        continue;
      }

      // CF ممکنه JSON با base64 برگردونه یا خود تصویر باینری
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await r.json();
        // فرمت‌های رایج: { success, result: { image: "data:...base64" } } یا { image: "base64" }
        const b64 = (j.result && j.result.image) || j.image || (j.result && j.result.image_b64);
        if (b64) {
          const clean = b64.replace(/^data:image\/\w+;base64,/, "");
          const buf = Buffer.from(clean, "base64");
          if (buf.length > 2000) {
            console.log(`   🟠 CF ${model.split("/").pop()} → ${buf.length} bytes`);
            return buf;
          }
        }
      } else {
        // باینری مستقیم
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 2000) {
          console.log(`   🟠 CF ${model.split("/").pop()} → ${buf.length} bytes (binary)`);
          return buf;
        }
      }
    } catch (e) {
      console.log(`   ⚠ CF ${model.split("/").pop()} err: ${String(e.message || e).slice(0, 120)}`);
    }
  }
  return null;
}

/* ---------- ۲) Gemini Image (از دروازهٔ _gemini.mjs) ---------- */
// این تابع import میشه از _gemini.mjs — اما برای استقلال ماژول، آن را lazy می‌گیریم.
let _geminiImg = null;
async function geminiImage(prompt) {
  try {
    if (!_geminiImg) {
      const mod = await import("./_gemini.mjs");
      _geminiImg = { geminiInit: mod.geminiInit, geminiImage: mod.geminiImage };
      await _geminiImg.geminiInit({ quiet: true });
    }
    const buf = await _geminiImg.geminiImage(prompt);
    if (buf) console.log("   💎 Gemini image → " + buf.length + " bytes");
    return buf;
  } catch (e) {
    console.log("   ⚠ Gemini image err: " + String(e.message || e).slice(0, 120));
    return null;
  }
}

/* ---------- ۳) Pollinations (مدل sana — همیشه رایگان، بدون کلید) ---------- */
export async function pollinationsImage(prompt) {
  try {
    const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt) +
      "?width=1024&height=1024&nologo=true&seed=" + Math.floor(Math.random() * 1000000);
    const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) { console.log("   ⚠ pollinations → " + r.status); return null; }
    const buf = Buffer.from(await r.arrayBuffer());
    // pollinations گاهی هنگام لیمیت JSON خطا برمی‌گرداند
    if (buf.length < 2000) { console.log("   ⚠ pollinations tiny response"); return null; }
    console.log("   🌸 Pollinations → " + buf.length + " bytes");
    return buf;
  } catch (e) {
    console.log("   ⚠ pollinations err: " + String(e.message || e).slice(0, 120));
    return null;
  }
}

/* ---------- تابع اصلی: تولید عکس با fallback chain ---------- */
export async function generateImage(prompt) {
  // ۱) Cloudflare FLUX (بهترین کیفیت)
  let buf = await cloudflareImage(prompt);
  if (buf) return { buf, provider: "cloudflare" };

  // ۲) Gemini Image
  buf = await geminiImage(prompt);
  if (buf) return { buf, provider: "gemini" };

  // ۳) Pollinations (آخرین fallback)
  buf = await pollinationsImage(prompt);
  if (buf) return { buf, provider: "pollinations" };

  return { buf: null, provider: "none" };
}

/* ---------- اطمینان از init دروازهٔ Gemini ---------- */
export async function ensureGeminiInit() {
  if (!_geminiImg) {
    try {
      const mod = await import("./_gemini.mjs");
      _geminiImg = { geminiInit: mod.geminiInit, geminiImage: mod.geminiImage };
      await _geminiImg.geminiInit();
    } catch (e) {
      console.log("   ⚠ geminiInit err: " + String(e.message || e).slice(0, 120));
    }
  }
}
