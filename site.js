// پیکربندی مرکزی DailyFitBeat
// هر جا دامنه، نام برند یا آدرس شبکه‌ها لازمه، از این فایل بخون
export const SITE = {
  name: "DailyFitBeat",
  nameFa: "دیلی بیت",
  tagline: "خوب بخور، بهتر زندگی کن",
  // دامنه تولید: وقتی دامنه واقعی وصل شد، فقط همین خط رو عوض کن
  url: (typeof location !== "undefined" && location.hostname)
    ? (location.protocol + "//" + location.hostname)
    : "https://dailyfitbeat.vercel.app",
  locale: "fa_IR",
  defaultLang: "fa",
  social: {
    instagram: "https://instagram.com/dailyfitbeat"
  },
  defaults: {
    ogImage: "/img/og-default.jpg",
    description: "رسپی‌های سالم ایرانی و جهانی، برنامه غذایی هوشمند، فیت مارکت و دستیار AI تغذیه"
  },
  // مسیرهای خصوصی که نباید در sitemap یا ایندکس بیان
  privatePaths: ["/admin", "/user", "/api/", "/checkout"]
};

// تابع کمکی: ساخت متادیتای صفحه
export function setPageMeta({ title, description, path, image, type = "website", noindex = false }) {
  const url = SITE.url + (path || "");
  const desc = description || SITE.defaults.description;
  const img = (image && image.startsWith("http")) ? image : (SITE.url + (image || SITE.defaults.ogImage));
  const fullTitle = title ? `${title} | ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;

  document.title = fullTitle;

  const set = (sel, attr, val) => {
    let el = document.querySelector(sel);
    if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
    el.setAttribute(attr, val);
  };

  set('meta[name="description"]', "name", "description");
  document.querySelector('meta[name="description"]').setAttribute("content", desc);

  set('meta[property="og:title"]', "property", "og:title");
  document.querySelector('meta[property="og:title"]').setAttribute("content", fullTitle);
  set('meta[property="og:description"]', "property", "og:description");
  document.querySelector('meta[property="og:description"]').setAttribute("content", desc);
  set('meta[property="og:image"]', "property", "og:image");
  document.querySelector('meta[property="og:image"]').setAttribute("content", img);
  set('meta[property="og:url"]', "property", "og:url");
  document.querySelector('meta[property="og:url"]').setAttribute("content", url);
  set('meta[property="og:type"]', "property", "og:type");
  document.querySelector('meta[property="og:type"]').setAttribute("content", type);
  set('meta[property="og:locale"]', "property", "og:locale");
  document.querySelector('meta[property="og:locale"]').setAttribute("content", SITE.locale);

  let link = document.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
  link.href = url;

  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
  robots.content = noindex ? "noindex, nofollow" : "index, follow";
}
