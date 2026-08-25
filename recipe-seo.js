(function(){
  if(document.body.dataset.page !== 'recipe') return;
  const slug = new URLSearchParams(location.search).get('slug');
  if(!slug) return;

  // اول از کش app.js می‌خونه؛ اگه آماده نبود، خودش fetch می‌کنه
  const getAll = () => new Promise(res => {
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (window.DFB && DFB.all && DFB.all.length) { clearInterval(t); res(DFB.all); }
      else if (n > 10) { clearInterval(t); fetch('/api/db?t=all').then(r=>r.json()).then(res); }
    }, 200);
  });

  getAll().then(ALL=>{
    const list = Array.isArray(ALL) ? ALL : [];
    const r = list.find(x=>x.slug===slug);
    if(!r) return;
    const base = window.SITE ? SITE.url : '';
    const clean = base + '/recipes/' + r.slug;

    // canonical تمیز
    let c = document.querySelector('link[rel="canonical"]');
    if(!c){ c=document.createElement('link'); c.rel='canonical'; document.head.appendChild(c); }
    c.href = clean;

    // بردکرامب
    const bc = document.createElement('div');
    bc.className = 'crumbs';
    bc.innerHTML = `<a href="/">خانه</a> › <a href="/recipes.html">رسپی‌ها</a> › <span>${r.name_fa}</span>`;
    const rd = document.getElementById('rd');
    if(rd) rd.prepend(bc);

    // Schema: Recipe + BreadcrumbList
    const ld = {
      "@context":"https://schema.org","@type":"Recipe",
      "name":r.name_fa,"alternateName":r.name_en,
      "image":[base + (r.image || '/img/hero-home.jpg')],
      "description":r.desc_fa || r.name_fa,
      "author":{"@type":"Organization","name":"DailyFitBeat"},
      "recipeCategory":r.category,
      "recipeCuisine":r.region || "ایرانی",
      "cookTime":"PT" + (r.time_min||0) + "M",
      "totalTime":"PT" + (r.time_min||0) + "M",
      "recipeYield":"۱ نفر",
      "recipeIngredient":(r.ingredients||[]).map(i=>i.fa + " " + i.q),
      "nutrition":{"@type":"NutritionInformation","calories":(r.kcal||0)+" kcal","proteinContent":(r.protein||0)+" g","carbohydrateContent":(r.carbs||0)+" g","fatContent":(r.fat||0)+" g"}
    };
    if(Array.isArray(r.steps) && r.steps.length){
      ld.recipeInstruction = r.steps.map(s=>({"@type":"HowToStep","text":s}));
    }
    const bl = {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
      {"@type":"ListItem","position":1,"name":"خانه","item":base+"/"},
      {"@type":"ListItem","position":2,"name":"رسپی‌ها","item":base+"/recipes.html"},
      {"@type":"ListItem","position":3,"name":r.name_fa,"item":clean}
    ]};
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify([ld, bl]);
    document.head.appendChild(s);

    // رسپی‌های مرتبط + لینک داخلی + اینستاگرام
    const myKeys = new Set(r.keys || []);
    const score = x => (x.slug === r.slug ? -999 : 0)
      + (x.category === r.category ? 2 : 0)
      + (x.region === r.region ? 2 : 0)
      + (x.keys || []).filter(k => myKeys.has(k)).length * 3;
    const rel = list.slice().sort((a,b) => score(b) - score(a)).slice(0, 4);
    const relHtml = `<div class="rel-sec">
      <div class="rel-head"><h2>رسپی‌های مرتبط</h2>
      <a class="btn ghost" href="${window.SITE ? SITE.social.instagram : '#'}" target="_blank" rel="noopener">📸 ویدیوی این رسپی در اینستاگرام</a></div>
      <div class="cards">${rel.map(x => `<a class="card" href="/recipes/${x.slug}">
        <div class="c-img"><img src="${x.image || '/img/hero-home.jpg'}" loading="lazy" decoding="async" alt="${x.name_fa}"></div>
        <div class="c-body"><h3>${x.name_fa}</h3>
        <div class="c-meta"><span>پخت: ${x.time_min} دقیقه</span><span>${x.kcal} کالری</span><span>پروتئین ${x.protein}g</span></div>
        </div></a>`).join('')}</div>
      <p class="rel-more">دنبال چیز دیگه‌ای؟ <a href="/recipes.html">همه رسپی‌ها</a> رو ببین.</p>
    </div>`;

    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const wrap = document.querySelector('.rd-wrap');
      if (wrap) {
        clearInterval(t);
        wrap.insertAdjacentHTML('afterend', relHtml);
      } else if (tries > 30) clearInterval(t);
    }, 400);
  });
})();
