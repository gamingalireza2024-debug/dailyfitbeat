# DailyFitBeat — Phase 3

## هدف
تبدیل DailyFitBeat از یک پلتفرم محتوای غذایی و فروش دیجیتال به یک پلتفرم تغذیه هوشمند و شخصی‌سازی‌شده، بدون شکستن معماری فعلی.

## Baseline
- Phase 1: Security + Recipe Workflow — complete
- Phase 2: Commerce + PRO + User Dashboard + Diet Builder + PDF — complete
- Phase 2.5: Production Hardening — user-tested complete
- Current branch: `phase3-foundation`

## اصول غیرقابل تغییر
1. Auth، RLS، Entitlement، Payment و Storage فعلی بدون دلیل بازنویسی نشوند.
2. هیچ AI secret در Frontend قرار نگیرد.
3. همه درخواست‌های AI از Backend عبور کنند.
4. Provider و Model به UI وابسته نباشند.
5. محدودیت مصرف Free/PRO فقط Server-side enforce شود.
6. داده شخصی کاربر فقط به اندازه لازم برای درخواست AI ارسال شود.
7. AI جایگزین متخصص یا تشخیص پزشکی نیست و پاسخ‌های پرریسک باید guardrail داشته باشند.
8. Recipeهای DailyFitBeat منبع اصلی پیشنهاد غذا هستند؛ AI نباید صرفاً یک چت عمومی باشد.

## معماری هدف
```text
Frontend
  ↓
AI API Layer
  ↓
AI Orchestrator
  ├── Usage / Quota
  ├── User Context
  ├── Recipe Retrieval
  ├── Safety / Guardrails
  └── Provider Adapter
        ↓
      AI Model
```

## Phase 3.1 — AI Infrastructure
- ساخت لایه provider-agnostic برای AI
- متغیرهای محیطی برای provider/model فقط در Server
- endpoint امن برای AI request
- ثبت usage به تفکیک user و plan
- quota برای Free/PRO
- مدیریت خطا و timeout
- جلوگیری از ارسال داده غیرضروری
- آماده‌سازی retrieval از recipes/ingredients
- لاگ‌گذاری بدون secret و بدون محتوای حساس غیرضروری

### مدل پیشنهادی مفهومی Usage
```text
user_id
plan_type
request_count
period_start
period_end
last_request_at
```

پیاده‌سازی واقعی باید ابتدا با schema موجود Supabase تطبیق داده شود و migration غیرضروری انجام نشود.

## Phase 3.2 — AI Nutrition Assistant
کاربر بتواند درباره غذا و تغذیه سؤال کند، اما پاسخ تا حد امکان با داده واقعی DailyFitBeat غنی شود.

نمونه‌ها:
- «با مرغ و قارچ چی درست کنم؟»
- «برای شام سبک چی پیشنهاد می‌دی؟»
- «از رسپی‌های DailyFitBeat سه گزینه مناسب من پیدا کن.»

## Phase 3.3 — Personalization
در پروفایل، فقط فیلدهای لازم برای تجربه شخصی ذخیره شوند:
- هدف
- اطلاعات پایه موردنیاز محصول
- ترجیحات غذایی
- غذاهای نامطلوب
- محدودیت‌ها/آلرژی‌های اعلام‌شده
- ترجیحات Recipe
- context برنامه‌های غذایی

اطلاعات حساس بدون نیاز محصول ذخیره یا به مدل ارسال نشود.

## Phase 3.4 — Smart Meal Planning
```text
User Context
↓
Goal / Calories / Macros
↓
DailyFitBeat Recipe Retrieval
↓
Meal Selection
↓
Validation
↓
Meal Plan Draft
```

برنامه تولیدشده ابتدا Draft است و قواعد تغذیه‌ای و محدودیت‌های سیستم باید قبل از انتشار بررسی شوند.

## Phase 3.5 — AI + Diet Builder
```text
AI Draft
↓
Admin Review
↓
Diet Builder
↓
PDF
↓
Publish
↓
User Dashboard
```

AI نباید مستقیماً بدون کنترل Admin یک برنامه نهایی حرفه‌ای را منتشر کند.

## Phase 3.6 — PRO AI
- quota بالاتر
- personalization بیشتر
- Smart Meal Planning
- پیشنهادهای مبتنی بر Recipeهای کاربر
- Smart Shopping List
- AI-assisted Diet Builder

اعداد quota بعد از برآورد هزینه مدل تعیین شوند.

## Phase 3.7 — User Dashboard Upgrade
Dashboard از صفحه نمایش اطلاعات به مرکز کنترل تغذیه کاربر تبدیل شود:
- هدف فعلی
- وضعیت برنامه
- خلاصه روز
- پیشنهاد AI
- برنامه غذایی
- خریدها
- Recipeهای ذخیره‌شده
- وضعیت PRO

## Phase 3.8 — Visual Product Upgrade
هویت فعلی DailyFitBeat حفظ شود: سبز/کرم/سفید، تصاویر غذایی، Vazirmatn و کارت‌های نرم.

هدف، Evolution است نه بازطراحی کامل.

اولویت‌های UI:
- hierarchy واضح‌تر در Homepage
- AI به‌عنوان بخشی از تجربه اصلی، نه Chatbot چسبیده
- Dashboard حرفه‌ای‌تر
- کاهش استفاده غیرضروری از Emoji
- micro-interaction و motion ظریف
- mobile-first polish
- نمایش بهتر کالری و Macro

## ترتیب اجرا
1. Audit نهایی schema و API موجود
2. AI Infrastructure
3. AI Assistant
4. Personalization
5. Smart Meal Planning
6. AI + Diet Builder
7. PRO AI
8. Dashboard/UI upgrade همزمان با featureها

## وضعیت
این سند فقط نقشه Phase 3 است. در این مرحله هیچ AI provider یا model خاصی به‌عنوان تصمیم نهایی انتخاب نشده است.
