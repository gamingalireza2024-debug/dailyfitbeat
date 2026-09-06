# 📦 پکیج فاز ۲ + ۳ — DailyFitBeat (SEO کامل + ادمین/UX)

۳۱ فایل — ساختار مثل ریپو؛ همه را روی ریشه کپی کن، commit و push کن. **قبل از آپلود، حتماً مرحله ۱ (SQL) را انجام بده.**

---

## ⚡️ مراحل اجرا به ترتیب (۱۰ دقیقه)

### مرحله ۱ — SQL در Supabase (الزامی، قبل از deploy)
Supabase → SQL Editor → New query → محتوای `supabase-phase23.sql` را Paste و Run کن.
این اسکریپت: فیلدهای SEO به رسپی‌ها و محصولات اضافه می‌کند، جدول‌های `redirects`، `faqs` و `page_views` را می‌سازد و تابع شمارش بازدید را ایجاد می‌کند. **هیچ داده‌ای حذف یا تغییر نمی‌کند.**

### مرحله ۲ — آپلود فایل‌ها
```bash
cd dailyfitbeat
cp -r /path/to/dailyfitbeat-phase23/* .
git add -A
git commit -m "feat: phase 2+3 — SEO pages, landing pages, admin dash, FAQ, redirects, self-hosted fonts"
git push
```

### مرحله ۳ — تست سریع بعد از deploy
- `dailyfitbeat.ir/recipes/goal/weight-loss` → باید فیلتر رسپی‌های کم‌کالری با عنوان SEO باز شود
- `dailyfitbeat.ir/recipes/category/salad` و `/recipes/meal/breakfast` و `/recipes/cuisine/italian`
- `dailyfitbeat.ir/weight-loss.html` و `weekly-plan.html` و `ai-assistant.html` (لندینگ‌ها)
- `dailyfitbeat.ir/api/sitemap` → باید صفحات جدید و URLهای تمیز رسپی‌ها را ببینی
- روی یک محصول مارکت کلیک کن → صفحه اختصاصی `/market/p/{id}` با اسکیمای Product

---

## 📋 چه چیزهایی اضافه شد؟

### 🟡 فاز ۲ — SEO (موارد ۱ تا ۲۵ لیست تو)
| قابلیت | فایل‌ها |
|---|---|
| صفحات SEO دسته/هدف/وعده/کشور (کاملاً Crawlable با rewrite) | `vercel.json` + `app.js` (meta داینامیک + H1 + ItemList + BreadcrumbList + آدرس تمیز در URL) |
| لندینگ «برنامه غذایی کاهش وزن» | `weight-loss.html` |
| لندینگ «برنامه غذایی هفتگی» | `weekly-plan.html` |
| لندینگ «دستیار تغذیه AI» | `ai-assistant.html` |
| سیستم مدیریت FAQ با اسکیمای FAQPage | جدول `faqs` + تب «SEO و FAQ» در ادمین + نمایش داینامیک در لندینگ‌ها و planner |
| Product Schema + صفحه اختصاصی محصول | `app.js` (renderProductPage) + rewrite `/market/p/:id` |
| Schema Recipe کامل‌تر (keywords، fiber، sugar، meta_description اختصاصی) | `recipe-seo.js` |
| Meta Title/Description برای هر رسپی از پنل ادمین | فرم رسپی در `admin.html/admin.js` + ستون‌های meta |
| SEO Score هر رسپی در ادمین (۰–۱۰۰) | ستون «SEO» در جدول رسپی‌ها |
| مدیریت Canonical و noindex از ادمین | چک‌باکس noindex + status published/draft (ریدایرکت‌ها هم از تب SEO) |
| Redirect Manager | جدول `redirects` + `api/redirect.js` + مدیریت در ادمین + fallback خودکار در صفحه رسپی |
| Sitemap خودکار: صفحات فیلتردار + لندینگ‌ها + محصولات + رسپی‌های منتشرشده (بدون noindex) | `api/sitemap.js` |
| محتوای متنی SEO در Planner و PRO + جدول مقایسه Free/PRO | `planner.html` + `pro.html` |
| لینک‌سازی داخلی: کارت‌ها به صفحه محصول، لندینگ‌ها به فیلترها، planner به رسپی‌ها | در همه فایل‌های بالا |

### 🟢 فاز ۳ — ادمین و UX (موارد ۱ تا ۲۵ لیست تو)
| قابلیت | فایل‌ها |
|---|---|
| داشبورد بصری: ۱۰ کارت آمار + نمودار سفارش‌های ۱۴ روز (SVG بدون وابستگی) | `admin.js` + `admin.html` |
| آمار بازدید رسپی‌ها + پربازدیدترین‌ها | `page_views` + تابع `increment_view` + `recipe-seo.js` (ثبت یک‌بار در هر نشست) + جدول داشبورد |
| آمار مصرف AI (ماه جاری) | `admin_stats` جدید |
| Media Library | تب «رسانه»: گالری تصاویر رسپی‌ها/محصولات + جستجو + کپی مسیر |
| Draft / Published | select وضعیت در فرم + فیلتر خودکار سایت (`t=all` فقط منتشرشده‌ها) + بج در جدول |
| Preview رسپی قبل از انتشار (حتی Draft برای ادمین) | دکمه «پیش‌نمایش رسپی» + `t=all_admin` |
| Preview PDF برنامه | دکمه «پیش‌نمایش PDF» در planner (باز شدن در تب جدید) |
| نمودار/جدول‌های موبایل‌پسند (اسکرول افقی) | CSS ادمین |
| سیستم طراحی یکپارچه | توکن‌های CSS + کامپوننت‌های جدید (faq، seo-card، progress، badge، skeleton) |
| بهبود CTA صفحه اصلی («شروع رایگان» حالا واقعاً رایگان است → استودیو تغذیه) | `index.html` |
| فونت وزیرمتن خودمیزبان (۲۰۳KB، بدون Google Fonts — پایدار برای کاربران ایران + سرعت بیشتر) | `fonts/` + همه HTMLها |
| نوار پیشرفت هدف کالری در Planner | `planner.js` + `.goal-progress` |

---

## ❓ توضیح همان قسمت دستی که نپرسیدی (www redirect)

قبلاً گفتم «www را به بدون www ریدایرکت کن» و واضح نبود؛ این‌طوری انجامش بده:

1. برو به **vercel.com** → وارد پروژه‌ات شو (dailyfitbeat)
2. بالا روی تب **Settings** کلیک کن → از منوی چپ **Domains**
3. آنجا دو دامنه می‌بینی: `dailyfitbeat.ir` و `www.dailyfitbeat.ir`
4. کنار **www.dailyfitbeat.ir** یک آیکون **Edit** (مداد) هست — بزن
5. گزینه **Redirect to dailyfitbeat.ir** را انتخاب کن (با ۳۰۱) → Save

تمام! از این به بعد هر کسی `www.dailyfitbeat.ir` را باز کند، خودکار به `dailyfitbeat.ir` می‌رود و گوگل فقط یک آدرس را ایندکس می‌کند.
**اگر این گزینه را پیدا نکردی، نگران نباش:** بعد از فاز ۲ همه canonicalها به بدون-www اشاره می‌کنند و گوگل خودش آدرس درست را می‌فهمد — این ریدایرکت فقط «بهینه است»، ضروری نیست.

## 🔒 یادآوری نهایی امنیتی
بعد از تست و تأیید: `GitHub → Settings → Danger Zone → Change visibility → Private` — ریپو را دوباره ببند.

## 📌 باقی‌مانده برای فاز ۴ (بعداً تصمیم بگیریم)
از لیست ارتقاهای ۳۵تایی: سیستم Review/امتیاز، Notification پیشرفته، Challenge/Streak/Badge، تاریخچه برنامه‌ها، مرکز دانلود، تیکت پشتیبانی، Bulk Edit، Version History، زمان‌بندی انتشار، داشبورد Conversion/Retention، Coupon پیشرفته، Referral/Loyalty، AI متصل‌تر به پروفایل. هر وقت گفتی «فاز ۴» شروع می‌کنیم.
