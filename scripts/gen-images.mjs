/* DailyFitBeat — gen-images v4 (PRO + Cloudflare)
   اصلاحات v4:
   ۱) دروازهٔ مشترک _image-providers.mjs با زنجیرهٔ fallback:
      CF FLUX-schnell → Gemini Image → Pollinations sana
   ۲) عکس‌ها با کیفیت بالاتر (1024px) تولید می‌شوند و سپس به 800px فشرده
   ۳) گزارش منبع (provider) هر عکس در لاگ
   از v3:
   ۱) یکسان‌سازی مسیر عکس‌ها با importer: img/recipes/<slug>.jpg
   ۲) مهاجرت خودکار عکس‌های قدیمی بدون هزینه AI
   ۳) visionCheck روی نسخه ۵۱۲px (پیشگیری از payload بزرگ)
   ۴) timeout برای درخواست‌ها + بررسی PATCH
   ۵) سقف LIMIT برای کنترل هزینه */
import sharp from "sharp";
import fs from "fs";
import { execSync } from "child_process";
import { geminiInit, geminiText, geminiVision } from "./_gemini.mjs";
import { generateImage, ensureGeminiInit } from "./_image-providers.mjs";

const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FORCE = (process.env.FORCE || "0") === "1";
const LIMIT = Math.min(Math.max(parseInt(process.env.LIMIT || "40", 10) || 40, 1), 100);
const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };
const IMG_DIR = "img/recipes"; // ← همیشه همین مسیر (هماهنگ با import-recipes.mjs)

const STYLE = "Ultra-realistic professional food photography, bright natural daylight from a side window, rustic light oak wooden table, warm white and orange ceramic dishes, gentle steam rising, shallow depth of field, 45-degree angle, vibrant warm appetizing tones, consistent series look, high resolution. No text, no watermark, no people, no logo.";
const DISH = { soup: "a bowl of hot soup", salad: "a fresh colorful salad plate", sandwich: "a filled sandwich on a wooden board", breakfast: "a breakfast plate", iranian: "a Persian rice and stew dish, served on a plate", main: "a grilled main dish on a plate" };

const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!SERVICE) { console.error("❌ SUPABASE_SERVICE_ROLE_KEY missing — بدون آن نمی‌توان DB را به‌روز کرد"); process.exit(1); }
fs.mkdirSync(IMG_DIR, { recursive: true });

function push() {
  try { execSync("git add img && (git diff --staged --quiet || git commit -m 'food images pro [skip ci]') && (git pull --rebase origin main || true) && git push", { stdio: "inherit" }); }
  catch (e) { console.log("push err", String(e).slice(0, 200)); }
}

/* ---------- Gemini: توصیف ظاهری اختصاصی هر غذا ---------- */
async function describeDish(r) {
  const ings = Array.isArray(r.ingredients) ? r.ingredients.slice(0, 6).map(i => i.fa).join("، ") : "";
  const out = await geminiText(`تو یک عکاس حرفه‌ای غذا هستی. برای غذای «${r.name_fa}» (${r.name_en || ""}) از دسته ${r.category} با مواد اصلی: ${ings || "نامشخص"}، فقط یک جمله انگلیسی بنویس که ظاهر دقیق غذای پخته‌شده را توصیف کند (رنگ، بافت، گارنیش، نحوه سرو در بشقاب). فقط همان جمله.`, { quiet: true });
  if (out && out.length < 400) { console.log("   🧠 desc:", out.slice(0, 90)); return out; }
  return (r.name_en || r.name_fa) + ": " + (DISH[r.category] || "a delicious healthy dish") + ". " + (r.desc_en || "");
}

/* ---------- کنترل بینایی (روی نسخه کوچک ۵۱۲px) ---------- */
async function visionCheck(buf, nameFa) {
  const small = await sharp(buf).resize(512, 512, { fit: "cover" }).jpeg({ quality: 60 }).toBuffer();
  const txt = await geminiVision(small.toString("base64"), "آیا تصویر دقیقاً غذای «" + nameFa + "» را نشان می‌دهد؟ فقط YES یا NO به همراه یک جمله توضیح.");
  if (!txt) return { ok: true, reason: "vision unavailable — accepted" };
  return { ok: /^\s*YES/i.test(txt), reason: txt.trim().split("\n").pop() };
}

/* ---------- تولید تصویر با زنجیره fallback ---------- */
// از _image-providers.mjs استفاده می‌کند: CF FLUX → Gemini → Pollinations.
// برای هر تلاش، یک provider متفاوت امتحان می‌شود تا باکیفیت‌ترین در دسترس برگردد.
async function produceImage(r, styleDesc) {
  const fullPrompt = styleDesc + ". " + STYLE;
  let lastBuf = null, lastReason = "";
  const providersTried = new Set();

  for (let attempt = 0; attempt < 3; attempt++) {
    const refined = attempt === 0 ? fullPrompt : fullPrompt + ". Previous issue: " + lastReason + ". Fix it, more authentic Persian styling.";
    const { buf, provider } = await generateImage(refined);
    providersTried.add(provider);

    if (!buf) { lastReason = "no image from any provider"; await sleep(3000); continue; }

    // اگه Pollinations بود، حتماً vision check کن (کیفیت پایین‌تر)
    // اگه CF/Gemini بود، vision check اختیاریه ولی برای اطمینان انجام میشه
    const check = await visionCheck(buf, r.name_fa);
    if (check.ok) {
      console.log(`   👁 ✓ [${provider}]`, check.reason);
      return { buf, provider };
    }
    lastBuf = buf; lastReason = check.reason;
    console.log(`   👁 ✗ [${provider}]`, check.reason, "— retry", attempt + 1);
    await sleep(1500);
  }

  // اگه همه تلاش‌ها reject شد ولی حداقل یه عکس داریم، همان را بپذیر
  if (lastBuf) {
    console.log("   ⚠ accepted without vision pass (last resort)");
    return { buf: lastBuf, provider: "fallback" };
  }
  return { buf: null, provider: "none" };
}

async function patchImage(slug, path) {
  const r = await fetch(SB_URL + "/rest/v1/recipes?slug=eq." + encodeURIComponent(slug), {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ image: path })
  });
  if (!r.ok && r.status !== 204) console.log("   ⚠ PATCH " + slug + " → " + r.status);
  return r.ok || r.status === 204;
}

/* ---------- main ---------- */
await ensureGeminiInit();
await geminiInit();
const recipes = await (await fetch(SB_URL + "/rest/v1/recipes?select=slug,name_fa,name_en,desc_en,category,image,ingredients&limit=2000", { headers: H })).json();
console.log("recipes:", recipes.length, "| FORCE:", FORCE, "| LIMIT:", LIMIT);
console.log("CF configured:", process.env.CF_API_TOKEN ? "yes ✓" : "no (will skip CF, use Gemini→Pollinations)");

let done = 0, migrated = 0, skip = 0;
const providerStats = {};
for (const r of recipes) {
  if (done >= LIMIT) { console.log("سقف LIMIT رسید — بقیه به اجرای بعد موکول شد."); break; }

  const newPath = IMG_DIR + "/" + r.slug + ".jpg";   // img/recipes/<slug>.jpg
  const oldPath = "img/" + r.slug + ".jpg";          // مسیر قدیمی و ناسازگار

  /* حالت ۱: مهاجرت عکس قدیمی از ریشه img/ به img/recipes — بدون هزینه AI */
  if (r.image === oldPath && fs.existsSync(oldPath)) {
    await sharp(oldPath).jpeg({ quality: 72 }).toFile(newPath);
    await patchImage(r.slug, newPath);
    migrated++;
    console.log("↪ migrated:", r.slug);
    if (migrated % 10 === 0) push();
    continue;
  }

  /* حالت ۲: عکس درست از قبل هست — skip */
  if (!FORCE && r.image === newPath && fs.existsSync(newPath)) { skip++; continue; }

  console.log("•", r.slug);
  const styleDesc = await describeDish(r);
  const { buf, provider } = await produceImage(r, styleDesc);
  if (!buf) { console.log("   skip (no image from any provider)"); continue; }

  providerStats[provider] = (providerStats[provider] || 0) + 1;
  await sharp(buf).resize(800, 800, { fit: "cover" }).jpeg({ quality: 72 }).toFile(newPath);
  if (!patchImage(r.slug, newPath)) console.log("   ⚠ DB آپدیت نشد — مسیر فایل: " + newPath);
  done++;
  console.log("   ok →", newPath, "[" + provider + "]");

  if (done % 5 === 0) push();
  await sleep(3000);
}
push();
console.log("🏁 done:", done, "| migrated:", migrated, "| skipped:", skip);
console.log("📊 providers used:", JSON.stringify(providerStats));

