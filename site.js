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
