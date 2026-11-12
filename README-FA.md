# دیلی‌بیت (DailyFitBeat)

> خوب بخور، بهتر زندگی کن.

سایت رسپی‌های سالم ایرانی و جهانی با کالری و ماکروهای دقیق، همراه با استودیوی تغذیه، فیت مارکت و دستیار AI تغذیه. کاملاً رایگان، بدون ثبت‌نام برای خواندن رسپی‌ها.

🌐 **سایت زنده:** https://dailyfitbeat.ir
📦 **ریپو:** https://github.com/gamingalireza2024-debug/dailyfitbeat

---

## معماری در یک نگاه

| لایه | فناوری |
|---|---|
| فرانت | HTML + CSS + JS خالص (بدون build step)، میزبانی استاتیک روی Vercel |
| بک‌اند | Vercel Serverless Functions در `api/` |
| دیتابیس / Auth / Storage | Supabase (Postgres + RLS) |
| تولید محتوا | GitHub Actions با Gemini + Pollinations |
| پنل ادمین | `admin.html` + `admin.js` — احراز هویت با Google OAuth و جدول `admins` |

## ساختار پوشه‌ها

```
dailyfitbeat/
├── *.html            ← صفحات سایت (index, recipes, planner, ai, admin, …)
├── *.js              ← منطق فرانت (app.js, admin.js, planner.js, …)
├── api/              ← endpointهای serverless (db, ai, mealplan, nutrition, sitemap, …)
├── scripts/          ← اسکریپت‌های GitHub Actions (mjs)
├── lib/              ← منطق مشترک (planbuilder.js)
├── img/              ← عکس‌های ثابت سایت (هیرو، دسته‌بندی، لوگو، …)
├── img/recipes/      ← عکس هر رسپی به‌صورت img/recipes/<slug>.jpg
├── fonts/            ← فونت Vazirmatn (woff2)
├── import/           ← صف غذاهای جدید (dishes.txt) + تاریخچه (done.txt)
├── docs/             ← ARCHITECTURE.md (مستندات فنی کامل)
├── .github/workflows/  ← auto-pilot.yml + cleanup-images.yml
├── vercel.json       ← rewriteها، redirectها، headerهای امنیتی
└── robots.txt + manifest.webmanifest
```

## توسعه محلی

نیازی به build نیست. کافیه یک سرور استاتیک روی پوشه اجرا کنی:

```bash
npx serve .
# یا
python3 -m http.server 8000
```

سپس به `http://localhost:3000` (یا 8000) برو. برای کار کردن کاملِ APIها و Supabase، باید روی Vercel دیپلوی بشه.

### وابستگی‌ها

فقط برای اسکریپت‌های `scripts/` (فشرده‌سازی عکس با sharp) لازمه:

```bash
npm install
```

## GitHub Actions

### `auto-pilot.yml`
هفته‌ای **۳ بار** (شنبه، دوشنبه، چهارشنبه ساعت ۰۸:۳۰ ایران) اجرا می‌شود و:
1. سلامت کلیدها را بررسی می‌کند
2. صف غذای جدید را با AI پر می‌کند
3. فیلدهای خالی رسپی‌های قدیمی را تکمیل می‌کند (steps, tips, desc, macros, region, substitutions)
4. برای رسپی‌های بدون عکس، عکس تولید می‌کند (Pollinations + Gemini vision check)
5. غذاهای جدید را اضافه می‌کند
6. عکس‌های سنگین را فشرده می‌کند
7. به تلگرام ادمین گزارش می‌دهد

مدیریت لیمیت Gemini:
- فاصلهٔ ۶ ثانیه‌ای بین درخواست‌ها
- بک‌آف ۶۰ ثانیه‌ای روی 429
- توقف خودکار بعد از ۳ شکست پشت‌سرهم
- fallback به GitHub Models (رایگان با `GITHUB_TOKEN`)
- سقف هر مرحله کم گرفته شده تا ۳ بار در هفته بدون خوردن به سهمیه روزانه اجرا شود

### `cleanup-images.yml`
دستی اجرا می‌شود. عکس‌های بلااستفاده را در `img/` پیدا می‌کند و با تأیید `DELETE` پاک می‌کند.

## متغیرهای محیطی (Vercel + GitHub Secrets)

| نام | کاربرد |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | دسترسی سرور به Supabase (هرگز در فرانت) |
| `GEMINI_API_KEY` | کلید رایگان از https://aistudio.google.com/app/apikey |
| `TG_TOKEN` / `TG_CHAT` | ربات تلگرام ادمین برای گزارش |
| `EJ_SERVICE` / `EJ_TEMPLATE` / `EJ_USER` / `EJ_PRIVATE` | EmailJS برای ایمیل |

## دیپلوی

هر commit روی `main` → دیپلوی خودکار Vercel.

---

© 2026 DailyFitBeat — همه حقوق محفوظ است.
