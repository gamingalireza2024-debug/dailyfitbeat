# مستندات فنی DailyFitBeat (فارسی)

## ۱. معماری دیتابیس (Supabase / Postgres)
- **users**: از طریق Supabase Auth (ورود با گوگل). ایمیل = هویت ادمین در جدول `admins`.
- **profiles**: id (=auth.users.id)، name، phone، disabled.
- **recipes / ingredients**: محتوای عمومی + کلیدهای تطبیق (rpc `match_recipes`).
- **products**: محصول دیجیتال/خدمت/اشتراک؛ فیلدهای type، file_path (مسیر داخل باکت خصوصی)، access_days، قیمت/تخفیف.
- **plans**: پلان‌های PRO با days (مدت به روز).
- **orders**: سفارش؛ ستون‌های مالی subtotal/discount/total/currency + payment_method (MANUAL/GATEWAY) + status چرخه کامل.
- **order_items**: اقلام سفارش (فعلاً تک‌محصولی، آماده چندمحصولی).
- **payments**: رکورد پرداخت با provider، reference، status (pending→submitted→approved/rejected)؛ idempotent.
- **entitlements**: لایه دسترسی واقعی (PRODUCT / PRO) با expires_at و source (PURCHASE / SUBSCRIPTION / ADMIN_GRANT).
- **subscriptions**: اشتراک PRO با start/end/status (ACTIVE/CANCELLED).
- **coupons**: کد تخفیف با سقف/تاریخ/محدودیت محصول/فقط-PRO؛ اعتبارسنجی و محاسبه فقط server-side.
- **diet_plans / diet_plan_days / diet_plan_meals**: برنامه غذایی شخصی + PDF.
- **shopping_lists**: لیست خرید PRO.
- **notifications / audit_logs**: اعلان درون‌برنامه‌ای و گزارش رویدادهای حساس.
- **Storage**: باکت خصوصی `dfb-files` (بدون هیچ policy عمومی) — همه دسترسی‌ها با Signed URL پنج‌دقیقه‌ای از API.

## ۲. معماری پرداخت
- Provider-Agnostic: فعلاً `MANUAL` فعال؛ `GATEWAY` در checkout/payments به‌صورت مقدار provider ذخیره می‌شه و آماده اتصال آینده.
- جریان دستی: checkout (محاسبه قیمت+کوپن در سرور) → پرداخت pending → submit_payment (کد واریز) → تأیید/رد ادمین → در تأیید: order=paid + ساخت entitlement/subscription + اعلان + audit.
- امنیت: فقط Verify سروری معتبره؛ callback تکراری بی‌اثره (approve idempotent)؛ مبلغ هرگز از فرانت خوانده نمی‌شه.
- اتصال درگاه آینده: فقط Environment Variables (مثل GATEWAY_MERCHANT_ID) + پیاده‌سازی createPayment/verifyPayment در لایه API؛ هیچ secret در فرانت.

## ۳. چرخه وضعیت سفارش
pending → payment_submitted → (under_review) → paid → processing → delivered | rejected / cancelled / refunded
(مقادیر قدیمی new/sent برای سفارش‌های کهنه حفظ شدن؛ همه server-side با لیست سفید اعتبارسنجی می‌شن.)

## ۴. دسترسی محصول (Entitlement)
خرید تأییدشده → entitlement PRODUCT (با expires اختیاری از access_days) → دانلود فقط با Signed URL پس از بررسی مالکیت+انقضا.

## ۵. اشتراک PRO
تأیید پرداخت پلان → subscription ACTIVE + entitlement PRO تا end_date. انقضا خودکار با مقایسه تاریخ در سرور (userIsPro/proExpiry) + RLS تابع `is_pro()`. اعطا/لغو/تمدید دستی ادمین با audit.

## ۶. داشبورد کاربر (user.html + user.js)
کارت‌های واقعی: اشتراک/انقضا، برنامه غذایی من (+دانلود PDF امن)، محصولات من (+دانلود)، سفارش‌ها، ذخیره‌ها، اعلان‌ها، لیست خرید PRO، پروفایل؛ بخش تبدیل FREE vs PRO؛ empty state حرفه‌ای؛ NOINDEX.

## ۷. برنامه غذایی شخصی (Diet Builder)
ادمین: انتخاب کاربر → عنوان/هدف/تاریخ/اهداف ماکرو → روزها و وعده‌ها (رسپی از دیتابیس یا عنوان آزاد) → ذخیره → تولید PDF (html2canvas+jsPDF در مرورگر ادمین، هویت بصری DailyFitBeat) → آپلود در dfb-files → انتشار → اعلان کاربر. تاریخچه حفظ می‌شه؛ حذف فقط با ادمین + audit.

## ۸. متغیرهای محیطی (Vercel)
- SUPABASE_SERVICE_ROLE_KEY (سرور + GitHub Secret ورک‌فلو)
- TG_TOKEN / TG_CHAT (تلگرام)
- EJ_SERVICE / EJ_TEMPLATE / EJ_USER / EJ_PRIVATE (EmailJS)
- آینده درگاه: GATEWAY_MERCHANT_ID و… فقط در env.

## ۹. سرویس‌های خارجی
Supabase (DB/Auth/Storage) • Vercel (هاست/serverless) • GitHub Actions (تولید رسپی/عکس) • EmailJS • Telegram Bot • Pollinations (تصاویر).

## ۱۰. دیپلوی
هر Commit به main → دیپلوی خودکار Vercel. ورک‌فلوی resipi‌ها فقط دستی (workflow_dispatch) با Secret؛ کلیدها هرگز در لاگ/کد نیستن.

## ۱۱. راهنمای ادمین
تب‌ها: داشبورد (آمار واقعی) • سفارش‌ها (فیلتر/وضعیت/CSV) • پرداخت‌ها (تأیید/رد) • رسپی‌ها • محصولات (آپلود فایل دیجیتال) • پلان‌ها • کاربران (جستجو/جزئیات/اعطا-لغو-تمدید PRO/غیرفعال) • کوپن‌ها • برنامه‌های غذایی (ساخت+PDF+انتشار) • گزارش رویدادها.
## ۱۲. زیرساخت AI (فاز ۳.۱)
- الگو: Frontend → /api/ai → Orchestrator → Provider Adapter → Model. هیچ کلیدی در فرانت نیست.
- Adapter Registry در api/ai.js؛ Provider با env انتخاب می‌شه (AI_PROVIDER، AI_MODEL)؛ بدون کلید → 503 ai_not_configured.
- کووتا: جدول ai_usage (فقط Service Role)؛ Free=۵/ماه، PRO=۱۰۰/ماه؛ فاصله حداقل ۲ ثانیه؛ اجرای کووتا فقط سروری.
- Grounding سبک: لیست کوتاه رسپی‌های واقعی از rpc/match_recipes به عنوان context؛ RAG کامل بعداً.
- پروفایل تغذیه: جدول جدا nutrition_profiles (RLS: کاربر فقط خودش؛ ادمین فقط خواندن)؛ فقط با include_profile به مدل داده می‌شه.
- امنیت: اعتبارسنجی طول پیام، sanitize آرایه‌ها/رشته‌ها، عدم افشای secret در خطاها، ثبت مصرف فقط پس از پاسخ موفق.

