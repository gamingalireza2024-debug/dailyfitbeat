/* =========================================================
   Google Analytics 4 — DailyFitBeat
   Measurement ID: G-D7BLSNMK0S
   فعال روی همه صفحات؛ page_view خودکار هر بار ثبت می‌شود.
   ========================================================= */
(function () {
  var MID = 'G-D7BLSNMK0S';
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', MID, {
    page_title: document.title,
    page_location: location.href,
    send_page_view: true
  });
  /* رویدادهای سفارشی پیشنهادی (اختیاری): */
  window.dfbTrack = function (name, params) {
    try { gtag('event', name, params || {}); } catch (e) {}
  };
})();
// DailyFitBeat — پیکربندی مرکزی و متادیتا
(function () {
  var SITE = {
    name: "DailyFitBeat",
    nameFa: "دیلی بیت",
    tagline: "خوب بخور، بهتر زندگی کن",
    url: "https://dailyfitbeat.ir",
    locale: "fa_IR",
    social: { instagram: "https://instagram.com/dailyfitbeat" },
    defaultImage: "/img/og-default.jpg",
    defaultDesc: "رسپی‌های سالم ایرانی و جهانی، برنامه غذایی هوشمند، فیت مارکت و دستیار AI تغذیه"
  };
  window.SITE = SITE;

  var PAGES = {
    home:    { path: "/",             title: "",           desc: SITE.defaultDesc },
    recipes: { path: "/recipes.html", title: "رسپی‌ها",     desc: "رسپی‌های سالم ایرانی و جهانی با ارزش غذایی دقیق، فیلتر بر اساس هدف و دسته" },
    recipe:  { path: null,            title: null,         desc: SITE.defaultDesc },
    planner: { path: "/planner.html", title: "برنامه غذایی", desc: "محاسبه‌گر هوشمند کالری و ریزمغذی‌ها + برنامه غذایی هفتگی شخصی‌سازی‌شده" },
    market:  { path: "/market.html",  title: "فیت مارکت",   desc: "فروشگاه محصولات دیجیتال DailyFitBeat — برنامه‌ها و پک‌های رسپی" },
    pro:     { path: "/pro.html",     title: "PRO",         desc: "اشتراک PRO دیلی‌بیت: برنامه شخصی نامحدود، دستیار AI و لیست خرید هوشمند" },
    user:    { path: "/user.html",    title: "پنل کاربری",  desc: "", noindex: true },
    admin:   { path: "/admin.html",   title: "پنل مدیریت", desc: "", noindex: true }
  };

  function upsertName(n, c) {
    var el = document.querySelector('meta[name="' + n + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', n); document.head.appendChild(el); }
    el.setAttribute('content', c);
  }
  function upsertProp(p, c) {
    var el = document.querySelector('meta[property="' + p + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute('property', p); document.head.appendChild(el); }
    el.setAttribute('content', c);
  }
  function canonical(url) {
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
    el.href = url;
  }
  function setMeta(m) {
    var title = m.title ? (m.title + " | " + SITE.name) : (SITE.name + " — " + SITE.tagline);
    document.title = title;
    var desc = m.desc || SITE.defaultDesc;
    var url = m.path ? (SITE.url + m.path) : (SITE.url + location.pathname);
    var img = SITE.url + (m.image || SITE.defaultImage);
    upsertName('description', desc);
    upsertProp('og:title', title);
    upsertProp('og:description', desc);
    upsertProp('og:image', img);
    upsertProp('og:url', url);
    upsertProp('og:type', m.type || 'website');
    upsertProp('og:locale', SITE.locale);
    canonical(url);
    upsertName('robots', m.noindex ? 'noindex, nofollow' : 'index, follow');
  }
  function jsonld(page) {
    var arr = [{
      "@context": "https://schema.org", "@type": "Organization",
      "name": SITE.name, "url": SITE.url, "logo": SITE.url + "/img/logo.png",
      "sameAs": [SITE.social.instagram]
    }];
    if (page === 'home') arr.push({ "@context": "https://schema.org", "@type": "WebSite", "name": SITE.name, "url": SITE.url });
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(arr);
    document.head.appendChild(s);
  }

  window.DFB_setRecipeMeta = function (r) {
    setMeta({ title: r.name_fa, desc: r.desc_fa || (r.name_fa + " — رسپی سالم با ارزش غذایی دقیق"), path: "/recipes/" + r.slug, image: r.image || SITE.defaultImage, type: "article" });
  };

  var page = document.body.getAttribute('data-page') || 'home';
  setMeta(PAGES[page] || PAGES.home);
  jsonld(page);
})();
/* ---------- PWA: manifest + theme-color روی همه صفحات ---------- */
(function () {
  if (!document.querySelector('link[rel="manifest"]')) {
    var l = document.createElement('link');
    l.rel = 'manifest';
    l.href = 'manifest.webmanifest';
    document.head.appendChild(l);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    var m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = '#f97316';
    document.head.appendChild(m);
  }
})();
/* =========================================================
   MOBILE POLISH v3 — تزریق مطمئن بعد از همه CSSها
   ========================================================= */
(function () {
  if (document.getElementById('dfb-mobile-fix')) return;
  var st = document.createElement('style');
  st.id = 'dfb-mobile-fix';
  st.textContent = [
    '#authBox{display:flex;gap:6px;align-items:center}',
    '@media(max-width:520px){',
    ' #hdr{gap:10px;padding:8px 12px}',
    ' #hdr .logo img{height:34px}',
    ' #hdr .hactions{gap:6px}',
    ' #hdr .auth-chip{padding:7px 12px;font-size:11px}',
    ' #hdr .lang{padding:7px 10px;font-size:11px}',
    ' #hdr .btn.small{display:none}',
    '}',
    '@media(max-width:768px){',
    ' body[data-page="home"] .hm-hero-img{height:auto}',
    ' body[data-page="home"] .hm-hero-img img{position:relative;inset:auto;height:260px;object-position:left 60%}',
    ' body[data-page="home"] .hm-hero-txt{padding:28px 18px 20px}',
    ' body[data-page="home"] .hm-quick{position:static;transform:none;width:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 14px 14px;background:transparent;border:0;box-shadow:none;padding:0;backdrop-filter:none;overflow:visible}',
    ' body[data-page="home"] .hm-quick a{background:rgba(255,255,255,.6);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.7);border-radius:14px;box-shadow:0 8px 22px rgba(17,24,39,.08);min-height:48px;flex:none}',
    ' body[data-page="home"] .hm-car{margin:28px 0 0}',
    ' body[data-page="home"] .hm-serv{gap:26px;margin:32px 0}',
    ' body[data-page="home"] .hm-serv-card .im img{height:180px}',
    ' body[data-page="home"] .hm-find{padding:20px 14px}',
    '}',
    '@media(max-width:600px){',
    ' #ftr .f-cols{grid-template-columns:1fr 1fr;gap:18px;padding:30px 16px 18px}',
    ' #ftr .f-cols > div:first-child{grid-column:1/-1}',
    ' #ftr a{font-size:12px;line-height:2.1}',
    ' #ftr b{font-size:12.5px;margin-bottom:8px}',
    ' #ftr .f-bottom{padding:12px;font-size:10.5px}',
    '}'
  ].join('');
  document.head.appendChild(st);
})();
/* ---------- فرم درست تصویر صفحه رسپی ---------- */
(function () {
  if (document.getElementById('dfb-recipe-img-fix')) return;
  var st = document.createElement('style');
  st.id = 'dfb-recipe-img-fix';
  st.textContent = 'body[data-page="recipe"] .rd-img{height:520px;border-radius:22px;overflow:hidden;position:sticky;top:92px}' +
    'body[data-page="recipe"] .rd-img img{width:100%;height:100%;object-fit:cover;display:block}' +
    '@media(max-width:900px){body[data-page="recipe"] .rd-img{height:280px;position:static}}';
  document.head.appendChild(st);
})();
