const $ = s => document.querySelector(s);
let lang = localStorage.getItem('dfb-lang') || 'fa';
let have = [], ING = [], ALL = [];
const page = document.body.dataset.page;
const FALL = { iranian:'img/iranian.jpg', salad:'img/salad.jpg', sandwich:'img/sandwich.jpg', breakfast:'img/breakfast.jpg', soup:'img/soup.jpg', sauce:'img/soup.jpg', main:'img/hero.jpg' };
const diff = t => t <= 20 ? 'آسان' : t <= 60 ? 'متوسط' : 'مفصل';
const tagFa = t => ({'iranian':'ایرانی','high-protein':'پروتئین بالا','quick':'سریع','weight-loss':'کاهش وزن','vegetarian':'گیاهی','low-calorie':'کم‌کالری'})[t] || 'سالم';
const NAV = [['home','index.html','خانه','Home'],['recipes','recipes.html','رسپی‌ها','Recipes'],['planner','planner.html','برنامه غذایی','Meal Plan'],['market','market.html','فیت مارکت','Fit Market'],['pro','pro.html','PRO','PRO']];

function injectHeader(){
  const links = NAV.map(([k,h,f,e]) => `<a href="${h}" class="${page===k?'on':''}" data-fa="${f}" data-en="${e}">${lang==='fa'?f:e}</a>`).join('');
  $('#hdr').innerHTML = `<a class="logo" href="index.html"><img src="img/logo.png" alt="DailyFitBeat"></a>
  <nav>${links}</nav>
  <div class="hactions">
    <button id="langBtn" class="lang">${lang==='fa'?'EN':'فا'}</button>
    <a class="btn small" href="pro.html" data-fa="شروع رایگان" data-en="Start Free">${lang==='fa'?'شروع رایگان':'Start Free'}</a>
    <button id="burger" class="burger" aria-label="menu"><span></span><span></span><span></span></button>
  </div>
  <div id="mnav" class="mnav">${links}</div>`;
  $('#burger').onclick = () => $('#mnav').classList.toggle('open');
  $('#langBtn').onclick = toggleLang;
}
function injectFooter(){
  $('#ftr').innerHTML = `<div class="container f-cols">
  <div><img class="f-logo" src="img/logo.png" alt="DailyFitBeat"><p data-fa="غذای سالم که واقعاً خوشمزه به نظر می‌رسه." data-en="Healthy food that actually looks delicious.">${lang==='fa'?'غذای سالم که واقعاً خوشمزه به نظر می‌رسه.':'Healthy food that actually looks delicious.'}</p></div>
  <div><b data-fa="رسپی‌ها" data-en="Recipes">${lang==='fa'?'رسپی‌ها':'Recipes'}</b><a href="recipes.html">ایرانی</a><a href="recipes.html">سالادها</a><a href="recipes.html">ساندویچ‌ها</a></div>
  <div><b data-fa="محصول" data-en="Product">${lang==='fa'?'محصول':'Product'}</b><a href="planner.html">برنامه غذایی</a><a href="index.html#finder">امروز چی داری؟</a><a href="pro.html">PRO</a></div>
  <div><b data-fa="فیت مارکت" data-en="Fit Market">${lang==='fa'?'فیت مارکت':'Fit Market'}</b><a href="market.html">محصولات دیجیتال</a><a href="https://instagram.com/dailyfitbeat">اینستاگرام</a><a href="market.html">ثبت سفارش</a></div>
  </div><div class="f-bottom">© DailyFitBeat</div>`;
}
function toggleLang(){
  lang = lang==='fa' ? 'en' : 'fa';
  localStorage.setItem('dfb-lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-fa]').forEach(el => el.textContent = el.dataset[lang]);
  injectHeader(); bindScroll();
  if(window.onLang) window.onLang();
}
function bindScroll(){ window.onscroll = () => $('#hdr').classList.toggle('scrolled', scrollY > 40); }

const norm = s => (s||'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ').trim();
function hay(r){ return [r.name_fa,r.name_en,r.region,r.desc_fa,r.category,(r.tags||[]).map(tagFa).join(' '),(r.keys||[]).map(k=>{const i=ING.find(x=>x.key===k);return i?i.fa+' '+i.en:''}).join(' ')].map(norm).join(' | '); }
function initSearch(){
  const inp = $('#searchInput'), box = $('#searchRes');
  if(!inp) return;
  inp.oninput = () => {
    const q = norm(inp.value);
    if(q.length < 2){ box.innerHTML=''; return; }
    const res = ALL.filter(r => q.split(' ').every(w => hay(r).includes(w))).slice(0,12);
    box.innerHTML = res.length ? res.map(r => card(r)).join('') : `<p class="no-res">چیزی پیدا نشد؛ مثلاً «بادمجان» یا «گیلان» رو امتحان کن</p>`;
  };
}
function card(r, big){
  return `<a class="card${big?' big':''}" href="recipe.html?slug=${r.slug}">
  <div class="c-img"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" loading="lazy"></div>
  <div class="c-body"><h3>${r.name_fa}</h3>
  <div class="c-meta"><span>${r.time_min} دقیقه</span><span>${r.kcal} کالری</span><span>پروتئین ${r.protein}g</span></div>
  <div class="c-tags"><i>${diff(r.time_min)}</i><i>${tagFa(r.tags && r.tags[0])}</i></div>
  </div></a>`;
}
async function loadChips(){
  const r = await fetch('/api/db?t=ingredients'); ING = await r.json(); renderChips();
}
function renderChips(){
  const c = $('#chips'); if(!c) return;
  c.innerHTML = ING.map(i => `<button class="chip${have.includes(i.key)?' on':''}" data-key="${i.key}">${lang==='fa'?i.fa:i.en}</button>`).join('');
  c.querySelectorAll('.chip').forEach(x => x.onclick = () => { x.classList.toggle('on'); have = [...c.querySelectorAll('.chip.on')].map(y => y.dataset.key); });
}
function initFinder(){
  if(!$('#chips')) return;
  loadChips();
  $('#ingAdd').onclick = () => {
    const v = $('#ingInput').value.trim(); if(!v) return;
    const m = ING.find(i => i.fa.includes(v) || i.en.toLowerCase().includes(v.toLowerCase()));
    if(m && !have.includes(m.key)){ have.push(m.key); renderChips(); $('#ingInput').value=''; }
    else alert(lang==='fa' ? 'این ماده رو هنوز نداریم؛ به‌زودی اضافه می‌شه' : 'Not in our pantry yet');
  };
  $('#goBtn').onclick = async () => {
    if(!have.length) return alert(lang==='fa' ? 'اول چند تا ماده رو انتخاب کن' : 'Pick some ingredients first');
    const r = await fetch('/api/db?t=match&a=' + have.join(','));
    const data = await r.json();
    $('#results').innerHTML = Array.isArray(data) ? data.map(x => card(x)).join('') : '';
  };
}
async function loadPopular(){
  const el = $('#popularCards'); if(!el) return;
  const r = await fetch('/api/db?t=popular');
  const data = await r.json();
  el.innerHTML = card(data[0], true) + data.slice(1).map(x => card(x)).join('');
}
let curCat = 'all', curGoal = 'all';
function renderRecipes(){
  const el = $('#recipeGrid'); if(!el) return;
  const list = ALL.filter(r => (curCat==='all' || r.category===curCat) && (curGoal==='all' || (r.tags||[]).includes(curGoal)));
  el.innerHTML = list.map(r => card(r)).join('') || `<p class="no-res">چیزی در این دسته نیست</p>`;
}
function initRecipes(){
  if(page !== 'recipes') return;
  document.querySelectorAll('.filters .chip').forEach(ch => ch.onclick = () => {
    document.querySelectorAll('.filters .chip').forEach(x => x.classList.remove('on'));
    ch.classList.add('on');
    if(ch.dataset.cat !== undefined) curCat = ch.dataset.cat;
    if(ch.dataset.goal !== undefined) curGoal = ch.dataset.goal;
    renderRecipes();
  });
  window.onLang = renderRecipes;
}
function initDetail(){
  if(page !== 'recipe') return;
  const slug = new URLSearchParams(location.search).get('slug');
  loadAll().then(() => {
    const r = ALL.find(x => x.slug === slug);
    const el = $('#rd');
    if(!r){ el.innerHTML = '<p class="no-res">پیدا نشد</p>'; return; }
    document.title = r.name_fa + ' | DailyFitBeat';
    const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
    el.innerHTML = `<div class="container rd-wrap">
    <div class="rd-img"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" alt="${r.name_fa}"></div>
    <div class="rd-info">
      <span class="rd-region">${r.region || 'ایران'}</span>
      <h1>${r.name_fa}</h1><p class="rd-en">${r.name_en}</p>
      <p class="rd-desc">${r.desc_fa || ''}</p>
      <div class="rd-stats"><div><b>${r.time_min}</b><span>دقیقه</span></div><div><b>${r.kcal}</b><span>کالری</span></div><div><b>${r.protein}</b><span>پروتئین</span></div></div>
      <ul class="ing-list">${ings.map(i => `<li>${i.fa}<span>${i.q}</span></li>`).join('')}</ul>
      <div class="f-cta"><a class="btn" href="planner.html">افزودن به برنامه</a><a class="btn ghost" href="recipes.html">همه رسپی‌ها</a></div>
    </div></div>`;
  });
}
function initOrder(){
  const f = $('#orderForm'); if(!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const o = { name: f.name.value, phone: f.phone.value, product: f.product.value, qty: f.qty.value, note: f.note.value, ref: f.ref.value };
    const r = await fetch('/api/db?t=order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(o) });
    const res = await r.json();
    const ok = $('#orderOk');
    ok.style.display = 'block';
    ok.innerHTML = `سفارش تو با کد <b>${res.id || '—'}</b> ثبت شد ✅<br>ایمیل تأیید برات ارسال شد؛ منتظر اطلاع‌رسانی ما باش.`;
    f.reset();
  };
}
async function loadAll(){ const r = await fetch('/api/db?t=all'); ALL = await r.json(); }
const ob = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting) e.target.classList.add('in'); }), { threshold:.15 });
function watchRev(){ document.querySelectorAll('.rev').forEach(el => ob.observe(el)); }

injectHeader(); injectFooter(); bindScroll();
document.documentElement.lang = lang;
document.documentElement.dir = lang==='fa' ? 'rtl' : 'ltr';
initSearch(); initFinder(); initRecipes(); initDetail(); initOrder(); watchRev();
if(page === 'home'){ loadPopular(); loadAll(); }
if(page === 'recipes'){ loadAll().then(renderRecipes); }
if(page === 'home' || page === 'recipes'){ /* ING for search hay */ if(!ING.length) fetch('/api/db?t=ingredients').then(r=>r.json()).then(d=>ING=d); }
