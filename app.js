var $ = function (s) { return document.querySelector(s); };
var lang = 'fa';
try { lang = localStorage.getItem('dfb-lang') || 'fa'; } catch (e) {}
var have = [], ING = [], ALL = [];
var page = document.body.dataset.page;
var SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
var sb = null, USER = null, ADMIN_EMAILS = [];
var rial = function (n) { return (Number(n) || 0).toLocaleString('fa-IR') + ' ریال'; };
/* ضد-XSS: هر متن/آدرس دیتابیسی قبل از ورود به innerHTML باید esc شود */
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var FALL = { iranian: 'img/cat-iranian.jpg', salad: 'img/cat-salad.jpg', sandwich: 'img/cat-sandwich.jpg', breakfast: 'img/cat-breakfast.jpg', soup: 'img/cat-soup.jpg', sauce: 'img/cat-soup.jpg', main: 'img/cat-main.jpg' };
var diff = function (t) { return t <= 20 ? 'آسان' : t <= 60 ? 'متوسط' : 'مفصل'; };
var ADJ = { 'ایران': 'ایرانی', 'گیلان': 'گیلانی', 'ژاپن': 'ژاپنی', 'تایلند': 'تایلندی', 'اسپانیا': 'اسپانیایی', 'مراکش': 'مراکشی', 'فرانسه': 'فرانسوی', 'ایتالیا': 'ایتالیایی', 'چین': 'چینی', 'هند': 'هندی', 'ترکیه': 'ترکی', 'مکزیک': 'مکزیکی', 'انگلستان': 'انگلیسی', 'یونان': 'یونانی', 'کره': 'کره‌ای', 'لبنان': 'لبنانی' };
var countryFa = function (reg) { return 'غذای ' + (ADJ[reg] || reg || 'ایرانی'); };
var NAV = [['home', 'index.html', 'خانه', 'Home'], ['recipes', 'recipes.html', 'رسپی‌ها', 'Recipes'], ['planner', 'planner.html', 'استودیو تغذیه', 'Nutrition Studio'], ['market', 'market.html', 'فیت مارکت', 'Fit Market'], ['ai', 'ai.html', 'دستیار AI', 'AI Assistant'], ['pro', 'pro.html', 'PRO', 'PRO']];

async function loadAdminList(token) {
  try {
    var r = await fetch('/api/db?t=admin_check', token ? { headers: { Authorization: 'Bearer ' + token } } : {});
    var d = await r.json();
    ADMIN_EMAILS = Array.isArray(d) ? d.map(function (x) { return x.email; }) : [];
  } catch (e) { ADMIN_EMAILS = []; }
}
function isAdmin() { return !!USER && ADMIN_EMAILS.indexOf(USER.email) !== -1; }
function doLogin() {
  if (sb) sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
}
async function doLogout() {
  try { if (sb) await sb.auth.signOut(); } catch (e) { console.log('logout error:', e); }
  USER = null;
  ADMIN_EMAILS = [];
  try { window.dispatchEvent(new Event('dfb:logout')); } catch (e) {}
  injectHeader();
  setTimeout(function () { location.href = 'index.html'; }, 150);
}
window.DFB = {
  get sb() { return sb; },
  get user() { return USER; },
  get all() { return ALL; },
  isAdmin: function () { return isAdmin(); },
  logout: function () { return doLogout(); }
};

function injectHeader() {
  var hdr = document.getElementById('hdr');
  if (!hdr) return;
  var links = NAV.map(function (n) {
    return '<a href="' + n[1] + '" class="' + (page === n[0] ? 'on' : '') + '" data-fa="' + n[2] + '" data-en="' + n[3] + '">' + (lang === 'fa' ? n[2] : n[3]) + '</a>';
  }).join('');
  hdr.innerHTML = '<a class="logo" href="index.html"><img src="img/logo.png" alt="DailyFitBeat"></a>' +
    '<nav>' + links + '</nav>' +
    '<div class="hactions"><span id="authBox"></span>' +
    '<button id="langBtn" class="lang">' + (lang === 'fa' ? 'EN' : 'فا') + '</button>' +
    '<a class="btn small" href="pro.html" data-fa="شروع رایگان" data-en="Start Free">' + (lang === 'fa' ? 'شروع رایگان' : 'Start Free') + '</a>' +
    '<button id="burger" class="burger" aria-label="menu"><span></span><span></span><span></span></button></div>' +
    '<div id="mnav" class="mnav">' + links + '</div>';
  var bg = document.getElementById('burger');
  if (bg) bg.onclick = function () { var m = document.getElementById('mnav'); if (m) m.classList.toggle('open'); };
  var lb = document.getElementById('langBtn');
  if (lb) lb.onclick = toggleLang;
  renderAuth();
}
function renderAuth() {
  var box = document.getElementById('authBox');
  if (!box) return;
  if (!USER) {
    box.innerHTML = '<button id="loginBtn" class="auth-chip">ورود با گوگل</button>';
    var lb = document.getElementById('loginBtn');
    if (lb) lb.onclick = doLogin;
  } else {
    var name = (USER.user_metadata && USER.user_metadata.name) ? USER.user_metadata.name.split(' ')[0] : 'پنل من';
    var html = '<a href="user.html" class="auth-chip user-on" title="پنل کاربری">' + name + '</a>';
    if (isAdmin()) html += '<a href="admin.html" class="auth-chip admin-on" title="پنل ادمین">ادمین</a>';
    html += '<button id="logoutBtn" class="auth-chip">خروج</button>';
    box.innerHTML = html;
    var ob = document.getElementById('logoutBtn');
    if (ob) ob.onclick = doLogout;
  }
}
async function ensureProfile() {
  if (!sb || !USER) return;
  try {
    var d = await sb.from('profiles').select('phone,name').eq('id', USER.id).maybeSingle();
    if (!d.error && !d.data) {
      await sb.from('profiles').insert({ id: USER.id, name: (USER.user_metadata && USER.user_metadata.full_name) || '' });
      phoneModal();
    } else if (!d.error && d.data && !d.data.phone) {
      phoneModal();
    }
  } catch (e) {}
}
function phoneModal() {
  if (document.getElementById('phModal')) return;
  document.body.insertAdjacentHTML('beforeend', '<div id="phModal" class="modal"><div class="modal-box"><h3>تکمیل پروفایل</h3><p>برای پیگیری سفارش‌ها، شماره موبایلت رو وارد کن</p><input id="phInput" type="tel" maxlength="11" placeholder="09xxxxxxxxx"><button id="phSave" class="btn">ذخیره</button></div></div>');
  document.getElementById('phSave').onclick = async function () {
    var v = document.getElementById('phInput').value.trim();
    if (!/^09[0-9]{9}$/.test(v)) { alert('شماره معتبر نیست'); return; }
    await sb.from('profiles').update({ phone: v }).eq('id', USER.id);
    var m = document.getElementById('phModal');
    if (m) m.remove();
  };
}
async function bootAuth() {
  try {
    var m = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    sb = m.createClient(SB_URL, ANON);
    sb.auth.onAuthStateChange(function (ev, sess) {
      if (ev === 'SIGNED_OUT') {
        USER = null;
        ADMIN_EMAILS = [];
        injectHeader();
        try { window.dispatchEvent(new Event('dfb:logout')); } catch (e) {}
        return;
      }
      USER = (sess && sess.user) || null;
      if (USER && sess && sess.access_token) loadAdminList(sess.access_token);
      injectHeader();
      if (USER) ensureProfile();
      initAdmin();
      initUser();
    });
    var r = await sb.auth.getSession();
    var sess = (r && r.data && r.data.session) ? r.data.session : null;
    USER = (sess && sess.user) || null;
    if (USER && sess && sess.access_token) await loadAdminList(sess.access_token);
    if (USER) ensureProfile();
    injectHeader();
    initAdmin();
    initUser();
  } catch (e) { console.log('auth off', e); }
}
function injectFooter() {
  var f = document.getElementById('ftr');
  if (!f) return;
  f.innerHTML = '<div class="f-cols">' +
    '<div><img class="f-logo" src="img/logo.png" alt="DailyFitBeat"><p>غذای سالم که واقعاً خوشمزه به نظر می‌رسه.</p></div>' +
    '<div><b>رسپی‌ها</b><a href="recipes.html">ایرانی</a><a href="recipes.html">سالادها</a><a href="recipes.html">ساندویچ‌ها</a></div>' +
    '<div><b>محصول</b><a href="planner.html">استودیو تغذیه</a><a href="index.html">امروز چی داری؟</a><a href="pro.html">PRO</a></div>' +
    '<div><b>فیت مارکت</b><a href="market.html">محصولات دیجیتال</a><a href="https://instagram.com/dailyfitbeat">اینستاگرام</a><a href="market.html">ثبت سفارش</a></div>' +
    '<div><b>درباره ما</b><a href="about.html">داستان دیلی‌بیت</a><a href="privacy.html">حریم خصوصی</a><a href="https://instagram.com/dailyfitbeat" target="_blank" rel="noopener">اینستاگرام</a></div>' +
    '</div><div class="f-bottom">© 2026 DailyFitBeat — همه حقوق محفوظ است.</div>';
}
function toggleLang() {
  lang = lang === 'fa' ? 'en' : 'fa';
  try { localStorage.setItem('dfb-lang', lang); } catch (e) {}
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-fa]').forEach(function (el) { el.textContent = el.dataset[lang]; });
  injectHeader();
}
function bindScroll() {
  window.addEventListener('scroll', function () {
    var h = document.getElementById('hdr');
    if (h) h.classList.toggle('scrolled', window.scrollY > 40);
  });
}

var norm = function (s) { return (s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').trim(); };
function hay(r) {
  return [r.name_fa, r.name_en, r.region, countryFa(r.region), r.desc_fa, r.category, (r.tags || []).join(' ')].map(norm).join(' | ');
}
function card(r, big) {
  return '<a class="card' + (big ? ' big' : '') + '" href="recipe.html?slug=' + encodeURIComponent(r.slug) + '"><div class="c-img"><img src="' + esc(r.image || FALL[r.category] || 'img/cat-main.jpg') + '" loading="lazy" decoding="async" alt="' + esc(r.name_fa) + '"></div><div class="c-body"><h3>' + esc(r.name_fa) + '</h3><div class="c-meta"><span>پخت: ' + r.time_min + ' دقیقه</span><span>' + r.kcal + ' کالری</span><span>پروتئین ' + r.protein + 'g</span></div><div class="c-tags"><i>' + diff(r.time_min) + '</i><i>' + esc(countryFa(r.region)) + '</i></div></div></a>';
}
function initSearch() {
  var inp = document.getElementById('searchInput'), box = document.getElementById('searchRes');
  if (!inp) return;
  inp.oninput = function () {
    var q = norm(inp.value);
    if (q.length < 2) { box.innerHTML = ''; return; }
    var res = ALL.filter(function (r) { return q.split(' ').every(function (w) { return hay(r).indexOf(w) !== -1; }); }).slice(0, 12);
    box.innerHTML = res.length ? res.map(function (r) { return card(r); }).join('') : '<p class="no-res">چیزی پیدا نشد</p>';
  };
}
async function loadChips() {
  var r = await fetch('/api/db?t=ingredients');
  ING = await r.json();
  renderChips();
}
function renderChips() {
  var c = document.getElementById('chips');
  if (!c) return;
  c.innerHTML = ING.map(function (i) { return '<button class="chip' + (have.indexOf(i.key) !== -1 ? ' on' : '') + '" data-key="' + esc(i.key) + '">' + esc(lang === 'fa' ? i.fa : i.en) + '</button>'; }).join('');
  c.querySelectorAll('.chip').forEach(function (x) {
    x.onclick = function () {
      x.classList.toggle('on');
      have = [].slice.call(c.querySelectorAll('.chip.on')).map(function (y) { return y.dataset.key; });
    };
  });
}
function initFinder() {
  if (!document.getElementById('chips')) return;
  loadChips();
  var add = document.getElementById('ingAdd');
  if (add) add.onclick = function () {
    var v = document.getElementById('ingInput').value.trim();
    if (!v) return;
    var m = ING.find(function (i) { return i.fa.indexOf(v) !== -1 || i.en.toLowerCase().indexOf(v.toLowerCase()) !== -1; });
    if (m && have.indexOf(m.key) === -1) { have.push(m.key); renderChips(); document.getElementById('ingInput').value = ''; }
  };
  var go = document.getElementById('goBtn');
  if (go) go.onclick = async function () {
    if (!have.length) return alert('اول چند تا ماده رو انتخاب کن');
    var r = await fetch('/api/db?t=match&a=' + have.join(','));
    var data = await r.json();
    document.getElementById('results').innerHTML = Array.isArray(data) ? data.map(function (x) { return card(x); }).join('') : '';
  };
}
async function loadPopular() {
  var el = document.getElementById('popularCards');
  if (!el) return;
  if (!ALL.length) await loadAll();
  var data = ALL.slice(0, 4);
  if (!data.length) return;
  el.innerHTML = card(data[0], true) + data.slice(1).map(function (x) { return card(x); }).join('');
}
var curCat = 'all', curGoal = 'all', curQ = '', curRegion = 'all';
function renderRecipes() {
  var el = document.getElementById('recipeGrid');
  if (!el) return;
  var list = ALL.filter(function (r) {
    return (curCat === 'all' || r.category === curCat) && (curRegion === 'all' || (r.region || '') === curRegion) && (curGoal === 'all' || (r.tags || []).indexOf(curGoal) !== -1) && (!curQ || curQ.split(' ').every(function (w) { return hay(r).indexOf(w) !== -1; }));
  });
  el.innerHTML = list.map(function (r) { return card(r); }).join('') || '<p class="no-res">چیزی در این دسته نیست</p>';
}
function renderTiles() {
  var el = document.getElementById('tiles');
  if (!el || !ALL.length) return;
  var cats = [['iranian', 'خورشتی و ایرانی', 'img/cat-iranian.jpg'], ['salad', 'سالادها', 'img/cat-salad.jpg'], ['sandwich', 'ساندویچ‌ها', 'img/cat-sandwich.jpg'], ['breakfast', 'صبحانه‌ها', 'img/cat-breakfast.jpg'], ['soup', 'سوپ‌ها', 'img/cat-soup.jpg']];
  var regions = {};
  ALL.forEach(function (r) { var g = r.region || 'ایران'; regions[g] = (regions[g] || 0) + 1; });
  var regList = Object.keys(regions).filter(function (k) { return k !== 'ایران' && regions[k] > 0; }).sort(function (a, b) { return regions[b] - regions[a]; }).slice(0, 10);
  var html = '<button class="tile' + (curCat === 'all' && curRegion === 'all' ? ' on' : '') + '" data-cat="all" data-region="all"><img src="img/hero-salmon.jpg" alt=""><b>همه</b><span>' + ALL.length.toLocaleString('fa-IR') + '</span></button>';
  cats.forEach(function (c) {
    var n = ALL.filter(function (r) { return r.category === c[0]; }).length;
    if (!n) return;
    html += '<button class="tile' + (curCat === c[0] ? ' on' : '') + '" data-cat="' + c[0] + '" data-region="all"><img src="' + c[2] + '" alt=""><b>' + c[1] + '</b><span>' + n.toLocaleString('fa-IR') + '</span></button>';
  });
  regList.forEach(function (k) {
    var first = ALL.find(function (r) { return (r.region || '') === k && r.image; });
    html += '<button class="tile' + (curRegion === k ? ' on' : '') + '" data-cat="all" data-region="' + esc(k) + '"><img src="' + esc(first ? first.image : 'img/cat-main.jpg') + '" alt=""><b>' + esc(ADJ[k] ? 'غذای ' + ADJ[k] : k) + '</b><span>' + regions[k].toLocaleString('fa-IR') + '</span></button>';
  });
  el.innerHTML = html;
  el.querySelectorAll('.tile').forEach(function (t) {
    t.onclick = function () {
      curCat = t.dataset.cat; curRegion = t.dataset.region;
      el.querySelectorAll('.tile').forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      renderRecipes();
    };
  });
}
function initRecipes() {
  if (page !== 'recipes') return;
  var sr = document.getElementById('recipeSearch');
  if (sr) sr.oninput = function () { curQ = norm(sr.value); renderRecipes(); };
  document.querySelectorAll('.filters .chip').forEach(function (ch) {
    ch.onclick = function () {
      document.querySelectorAll('.filters .chip').forEach(function (x) { x.classList.remove('on'); });
      ch.classList.add('on');
      if (ch.dataset.cat !== undefined) curCat = ch.dataset.cat;
      if (ch.dataset.goal !== undefined) curGoal = ch.dataset.goal;
      renderTiles(); renderRecipes();
    };
  });
}
async function initDetail() {
  if (page !== 'recipe') return;
  var slug = new URLSearchParams(location.search).get('slug');
  await loadAll();
  var r = ALL.find(function (x) { return x.slug === slug; });
  var el = document.getElementById('rd');
  if (!el) return;
  if (!r) { el.innerHTML = '<p class="no-res">پیدا نشد</p>'; return; }
  document.title = r.name_fa + ' | DailyFitBeat';
  if (window.DFB_setRecipeMeta) window.DFB_setRecipeMeta(r);
  var ings = Array.isArray(r.ingredients) ? r.ingredients : [];
  var favOn = false;
  if (sb && USER) {
    try {
      var d = await sb.from('favorites').select('id').eq('recipe_slug', r.slug).maybeSingle();
      favOn = !d.error && !!d.data;
    } catch (e) {}
  }
  var fatC = (r.fat != null && r.fat > 20) ? '#d33' : 'var(--accent)';
  var sugC = (r.sugar != null && r.sugar > 10) ? '#e9b949' : 'var(--accent)';
  var nut = function (val, label, w, color) { return '<div class="nut"><b>' + val + '</b><span>' + label + '</span><i class="nb" style="--w:' + Math.min(100, w) + '%;--c:' + color + '"></i></div>'; };
  var nutritionBars = '<div class="nut-row">' +
    nut(r.kcal || 0, 'انرژی (کالری)', (r.kcal / 2000) * 100, 'var(--accent)') +
    nut((r.protein || 0) + 'g', 'پروتئین', (r.protein / 50) * 100, 'var(--accent)') +
    (r.carbs != null ? nut(r.carbs + 'g', 'کربوهیدرات', (r.carbs / 100) * 100, 'var(--accent)') : '') +
    (r.fat != null ? nut(r.fat + 'g', 'چربی', (r.fat / 70) * 100, fatC) : '') +
    (r.sugar != null ? nut(r.sugar + 'g', 'قند', (r.sugar / 50) * 100, sugC) : '') +
    (r.fiber != null ? nut(r.fiber + 'g', 'فیبر', (r.fiber / 30) * 100, 'var(--accent)') : '') +
    '</div>';
  var stepsHtml = Array.isArray(r.steps) && r.steps.length ? '<div class="steps-section"><h3>مراحل پخت</h3><ol class="steps-list">' + r.steps.map(function (s, i) { return '<li><span class="step-num">' + (i + 1) + '</span><p>' + esc(s) + '</p></li>'; }).join('') + '</ol></div>' : '';
  var tipsHtml = Array.isArray(r.tips) && r.tips.length ? '<div class="tips-section"><h3>نکات پخت</h3><ul class="tips-list">' + r.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' : '';
  var subsHtml = Array.isArray(r.substitutions) && r.substitutions.length ? '<div class="subs-section"><h3>جایگزین‌ها</h3><div class="subs-grid">' + r.substitutions.map(function (s) { return '<div class="sub-card"><b>' + esc(s.from) + '</b><span>→</span><b>' + esc(s.to) + '</b></div>'; }).join('') + '</div></div>' : '';
  var videoHtml = r.video_url ? '<div class="video-section"><h3>ویدیوی پخت</h3><a href="' + esc(r.video_url) + '" target="_blank" rel="noopener" class="video-card"><div class="video-thumb"><img src="' + esc(r.image || FALL[r.category] || 'img/cat-main.jpg') + '" alt="' + esc(r.name_fa) + '"><span class="play-btn">▶</span></div><p>تماشای ویدیو در اینستاگرام</p></a></div>' : '';
  el.innerHTML = '<div class="container rd-wrap"><div class="rd-img"><img src="' + esc(r.image || FALL[r.category] || 'img/cat-main.jpg') + '" alt="' + esc(r.name_fa) + '" fetchpriority="high" decoding="async"><button id="favBtn" class="heart' + (favOn ? ' on' : '') + '">♥</button></div><div class="rd-info"><span class="rd-region">' + esc(countryFa(r.region)) + '</span><h1>' + esc(r.name_fa) + '</h1><p class="rd-en">' + esc(r.name_en || '') + '</p><p class="rd-desc">' + esc(r.desc_fa || '') + '</p><div class="rd-stats"><div><b>' + r.time_min + '</b><span>زمان پخت (دقیقه)</span></div><div><b>' + diff(r.time_min) + '</b><span>سطح دشواری</span></div></div>' + nutritionBars + '<h3>مواد لازم</h3><ul class="ing-list">' + ings.map(function (i) { return '<li>' + esc(i.fa) + '<span>' + esc(i.q) + '</span></li>'; }).join('') + '</ul>' + stepsHtml + tipsHtml + subsHtml + videoHtml + '<div class="f-cta"><a class="btn" href="planner.html">افزودن به برنامه</a><a class="btn ghost" href="recipes.html">همه رسپی‌ها</a></div></div></div>';
  document.getElementById('favBtn').onclick = async function () {
    if (!USER) { alert('برای ذخیره علاقه‌مندی، اول با گوگل وارد شو'); doLogin(); return; }
    if (favOn) {
      await sb.from('favorites').delete().eq('user_id', USER.id).eq('recipe_slug', r.slug);
      favOn = false;
    } else {
      try {
        var cnt = await sb.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', USER.id);
        var s = await sb.auth.getSession();
        var isPro = await (await fetch('/api/db?t=my_entitlements', { headers: { Authorization: 'Bearer ' + (s.data.session ? s.data.session.access_token : '') } })).json();
        if (!isPro.pro && cnt.count >= 10) { alert('سهمیه ذخیره رایگان (۱۰ رسپی) تمام شد — با PRO نامحدود ذخیره کن'); return; }
      } catch (e) {}
      await sb.from('favorites').insert({ user_id: USER.id, recipe_slug: r.slug });
      favOn = true;
    }
    document.getElementById('favBtn').classList.toggle('on', favOn);
  };
}
function initOrder() {
  var f = document.getElementById('orderForm');
  if (!f) return;
  f.onsubmit = async function (e) {
    e.preventDefault();
    /* honeypot: فیلد مخفی — ربات‌ها آن را پر می‌کنند */
    var hp = f.querySelector('input[name="website"]');
    var o = { name: document.getElementById('oName').value, phone: document.getElementById('oPhone').value, email: document.getElementById('oEmail').value, product: document.getElementById('oProduct').value, note: document.getElementById('oNote').value, ref: document.getElementById('oRef').value, user_id: USER ? USER.id : null, website: hp ? hp.value : '' };
    var r = await fetch('/api/db?t=order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
    var res = await r.json();
    var ok = document.getElementById('orderOk');
    ok.style.display = 'block';
    ok.innerHTML = 'سفارش تو با کد <b>' + (res.id || '—') + '</b> ثبت شد<br>تلگرام: ' + (res.tg ? 'بله' : 'خیر') + ' — ایمیل: ' + (res.mail === 'ok' ? 'بله' : 'خیر') + (USER ? '<br>در پنل کاربری قابل پیگیریه' : '');
    f.reset();
  };
}
async function initMarket() {
  var grid = document.getElementById('prodGrid');
  if (!grid) return;
  var data = await (await fetch('/api/db?t=products')).json();
  if (!Array.isArray(data)) return;
  grid.innerHTML = data.map(function (p) {
    return '<div class="pcard"><div class="p-img"><img src="' + esc(p.image || 'img/prod-fallback.jpg') + '" alt="' + esc(p.title_fa) + '"><span class="p-rate">★ ' + Number(p.rating).toLocaleString('fa-IR') + '</span>' + (p.off_percent ? '<span class="p-badge" style="background:#d33">' + Number(p.off_percent).toLocaleString('fa-IR') + '٪ تخفیف</span>' : (p.badge ? '<span class="p-badge">' + esc(p.badge) + '</span>' : '')) + '</div><div class="p-body"><h4>' + esc(p.title_fa) + '</h4><p>' + esc(p.desc_fa || '') + '</p><div class="p-price">' + rial(p.price_rial) + (p.old_price_rial ? '<s>' + rial(p.old_price_rial) + '</s>' : '') + '</div><button class="btn p-cart" data-id="' + esc(p.id) + '" data-t="' + esc(p.title_fa) + '">خرید</button></div></div>';
  }).join('');
  var sel = document.getElementById('oProduct');
  if (sel) sel.innerHTML = data.map(function (p) { return '<option>' + esc(p.title_fa) + '</option>'; }).join('');
}
async function initPro() {
  var box = document.getElementById('planCards');
  if (!box) return;
  var data = await (await fetch('/api/db?t=plans')).json();
  if (!Array.isArray(data)) return;
  box.innerHTML = data.map(function (pl) {
    return '<div class="price-card' + (pl.key === 'yearly' ? ' hot' : '') + '" data-key="' + esc(pl.key) + '" data-id="' + esc(pl.id) + '">' + (pl.key === 'yearly' ? '<span class="ribbon">پیشنهاد ویژه</span>' : '') + '<h3>' + esc(pl.title_fa) + '</h3><div class="p">' + rial(pl.price_rial) + '<small> / ' + esc(pl.period) + '</small></div>' + (pl.old_price_rial ? '<s class="oldp">' + rial(pl.old_price_rial) + '</s>' : '') + '<ul>' + (pl.features || []).map(function (f) { return '<li>✔ ' + esc(f) + '</li>'; }).join('') + '</ul><a class="btn" data-id="' + esc(pl.id) + '" href="pro.html#buy">انتخاب پلان</a></div>';
  }).join('');
  document.querySelectorAll('.plan-tog button').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('.plan-tog button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.querySelectorAll('#planCards .price-card').forEach(function (c) { c.classList.toggle('hot', c.dataset.key === b.dataset.key); });
    };
  });
}
function initAdmin() {
  if (page !== 'admin') return;
  var st = document.getElementById('adminStat');
  var body = document.getElementById('adminBody');
  if (!USER) { if (st) st.textContent = 'لطفاً اول وارد شو'; return; }
  if (!isAdmin()) { if (st) st.textContent = 'دسترسی ادمین ندارید'; return; }
  if (st) st.textContent = 'خوش آمدی، ' + USER.email;
  if (body) body.style.display = 'block';
}
function initUser() {
  if (page !== 'user') return;
  var st = document.getElementById('userStat');
  var body = document.getElementById('userBody');
  if (!USER) { if (st) st.textContent = 'لطفاً اول وارد شو'; return; }
  if (st) st.textContent = USER.email;
  if (body) body.style.display = 'block';
}
async function loadAll() {
  var r = await fetch('/api/db?t=all');
  ALL = await r.json();
}

injectHeader();
injectFooter();
bindScroll();
bootAuth();
document.documentElement.lang = lang;
document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
initSearch(); initFinder(); initRecipes(); initDetail(); initOrder(); initMarket(); initPro();
if (page === 'home') loadPopular();
if (page === 'recipes') loadAll().then(function () { renderTiles(); renderRecipes(); });
