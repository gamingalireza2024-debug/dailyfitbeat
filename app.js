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
/* ---------- برچسب‌های SEO برای صفحات فیلتردار ---------- */
var CAT_FA = { iranian: 'ایرانی', main: 'غذای اصلی', salad: 'سالاد', sandwich: 'ساندویچ', breakfast: 'صبحانه', soup: 'سوپ' };
var GOAL_FA = { 'high-protein': 'پروتئین بالا', 'weight-loss': 'کاهش وزن', quick: 'سریع و آسان', vegetarian: 'گیاهی' };
var MEAL_FA = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده' };
var MEAL_CATS = { breakfast: ['breakfast'], lunch: ['main', 'iranian', 'salad'], dinner: ['main', 'iranian', 'soup'], snack: ['salad', 'sandwich'] };
var CUISINES = { iran: 'ایران', gilan: 'گیلان', italian: 'ایتالیا', japanese: 'ژاپن', thai: 'تایلند', spanish: 'اسپانیا', moroccan: 'مراکش', french: 'فرانسه', chinese: 'چین', indian: 'هند', turkish: 'ترکیه', mexican: 'مکزیک', english: 'انگلستان', greek: 'یونان', korean: 'کره', lebanese: 'لبنان', argentinian: 'آرژانتین', brazilian: 'برزیل', australian: 'استرالیا', american: 'آمریکا' };
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
  f.innerHTML = '<div class="f-min">' +
    '<div class="f-brand"><img class="f-logo" src="img/logo.png" alt="DailyFitBeat"><span>خوب بخور، بهتر زندگی کن</span></div>' +
    '<nav class="f-links">' +
    '<a href="recipes.html">رسپی‌ها</a><a href="planner.html">برنامه غذایی</a><a href="ai-assistant.html">دستیار AI</a><a href="market.html">فیت مارکت</a><a href="pro.html">PRO</a><a href="about.html">درباره ما</a>' +
    '</nav>' +
    '<a class="f-ig" href="https://instagram.com/dailyfitbeat" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.8.3-.4.2-.7.3-1 .6-.3.3-.5.6-.6 1-.1.3-.3.7-.3 1.8-.1 1.3-.1 1.7-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.8.2.4.3.7.6 1 .3.3.6.5 1 .6.3.1.7.3 1.8.3 1.3.1 1.7.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.8-.3.4-.2.7-.3 1-.6.3-.3.5-.6.6-1 .1-.3.3-.7.3-1.8.1-1.3.1-1.7.1-4.8s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.8-.2-.4-.3-.7-.6-1-.3-.3-.6-.5-1-.6-.3-.1-.7-.3-1.8-.3-1.3-.1-1.7-.1-4.8-.1zm0 3.1a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.2-2.9a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>اینستاگرام</a>' +
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
  return '<a class="card' + (big ? ' big' : '') + '" href="/recipes/' + encodeURIComponent(r.slug) + '"><div class="c-img"><img src="' + esc(r.image || FALL[r.category] || 'img/cat-main.jpg') + '" data-fb="' + esc(FALL[r.category] || 'img/cat-main.jpg') + '" onerror="this.onerror=null;this.src=this.dataset.fb;" loading="lazy" decoding="async" alt="' + esc(r.name_fa) + '"></div><div class="c-body"><h3>' + esc(r.name_fa) + '</h3><div class="c-meta"><span>پخت: ' + r.time_min + ' دقیقه</span><span>' + r.kcal + ' کالری</span><span>پروتئین ' + r.protein + 'g</span></div><div class="c-tags"><i>' + diff(r.time_min) + '</i><i>' + esc(countryFa(r.region)) + '</i></div></div></a>';
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
/* Home v3: ایموجی هر ماده + شمارنده انتخاب */
var ING_EMOJI = { chicken:'🍗', beef:'🥩', egg:'🥚', tomato:'🍅', rice:'🍚', potato:'🥔', onion:'🧅', garlic:'🧄', mushroom:'🍄', spinach:'🥬', avocado:'🥑', bread:'🍞', 'greek-yogurt':'🥣', salmon:'🐟', chickpea:'🫛', lentil:'🫘', fish:'🐠', shrimp:'🦐', eggplant:'🍆', kashk:'🥛', walnut:'🥜', 'pomegranate-molasses':'🍯' };
function frSync() {
  var n = document.getElementById('frCount');
  if (n) { n.hidden = !have.length; var b = n.querySelector('b'); if (b) b.textContent = have.length.toLocaleString('fa-IR'); }
  var h = document.getElementById('frHint');
  if (h) h.hidden = !!have.length;
}
function renderChips() {
  var c = document.getElementById('chips');
  if (!c) return;
  c.innerHTML = ING.map(function (i, ix) { return '<button class="chip' + (have.indexOf(i.key) !== -1 ? ' on' : '') + '" style="--i:' + ix + '" data-key="' + esc(i.key) + '"><i class="ci" aria-hidden="true">' + (ING_EMOJI[i.key] || '🥄') + '</i>' + esc(lang === 'fa' ? i.fa : i.en) + '</button>'; }).join('');
  c.querySelectorAll('.chip').forEach(function (x) {
    x.onclick = function () {
      x.classList.toggle('on');
      have = [].slice.call(c.querySelectorAll('.chip.on')).map(function (y) { return y.dataset.key; });
      frSync();
    };
  });
  frSync();
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
    var box = document.getElementById('results');
    if (!box) return;
    if (!have.length) {
      var h = document.getElementById('frHint');
      if (h) h.hidden = false;
      var fc = document.getElementById('frCard');
      if (fc) { fc.classList.remove('fr-shake'); void fc.offsetWidth; fc.classList.add('fr-shake'); }
      try { window.dfbTrack('fridge_empty_click', {}); } catch (e) {}
      return;
    }
    try { window.dfbTrack('fridge_search', { items: have.length }); } catch (e) {}
    box.innerHTML = '<div class="fr-sk"></div><div class="fr-sk"></div><div class="fr-sk"></div><div class="fr-sk"></div>';
    try {
      var r = await fetch('/api/db?t=match&a=' + encodeURIComponent(have.join(',')));
      var data = await r.json();
      var list = Array.isArray(data) ? data : [];
      box.innerHTML = '<p class="fr-resn">' + list.length.toLocaleString('fa-IR') + ' رسپی با این مواد پیدا شد:</p>' + list.map(function (x) { return card(x); }).join('');
    } catch (e) {
      box.innerHTML = '';
    }
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
var curCat = 'all', curGoal = 'all', curQ = '', curRegion = 'all', mealCats = null, pendingSeo = false;
/* صفحه‌بندی نرم گرید رسپی‌ها */
var REC_PAGE = 12, recShown = REC_PAGE;
function recFilter(r) {
  if (curCat !== 'all' && r.category !== curCat && !(curCat === 'main' && r.category === 'sauce')) return false;
  if (mealCats && mealCats.indexOf(r.category) === -1) return false;
  if (curRegion !== 'all' && (r.region || '') !== curRegion) return false;
  if (curGoal !== 'all' && (r.tags || []).indexOf(curGoal) === -1) return false;
  if (curQ && !curQ.split(' ').every(function (w) { return hay(r).indexOf(w) !== -1; })) return false;
  return true;
}
function renderRecipes(keepShown) {
  var el = document.getElementById('recipeGrid');
  if (!el) return;
  var list = ALL.filter(recFilter);
  if (!keepShown) recShown = REC_PAGE;
  var shown = list.slice(0, recShown);
  var more = document.getElementById('loadMore');
  if (more) {
    if (list.length > recShown) {
      more.hidden = false;
      more.querySelector('b').textContent = (list.length - recShown).toLocaleString('fa-IR');
    } else more.hidden = true;
  }
  el.innerHTML = shown.map(function (r) { return card(r); }).join('') || '<p class="no-res">چیزی در این دسته نیست — فیلتر دیگری را امتحان کن</p>';
  if (pendingSeo && ALL.length) { pendingSeo = false; applyRecipeSeo(list); }
}
/* ---------- کارت دسته‌بندی‌ها با عکس و تعداد ---------- */
var CAT_IMG = { iranian: 'img/cat-iranian.jpg', main: 'img/cat-main.jpg', salad: 'img/cat-salad.jpg', sandwich: 'img/cat-sandwich.jpg', breakfast: 'img/cat-breakfast.jpg', soup: 'img/cat-soup.jpg' };
function renderCatCards() {
  var el = document.getElementById('catCards');
  if (!el || !ALL.length) return;
  var cats = [['all', 'همه رسپی‌ها', 'img/hero-salmon.jpg'], ['breakfast', 'صبحانه', 'img/cat-breakfast.jpg'], ['iranian', 'ایرانی', 'img/cat-iranian.jpg'], ['main', 'غذای اصلی', 'img/cat-main.jpg'], ['salad', 'سالاد', 'img/cat-salad.jpg'], ['soup', 'سوپ و آش', 'img/cat-soup.jpg'], ['sandwich', 'ساندویچ', 'img/cat-sandwich.jpg']];
  el.innerHTML = cats.map(function (c) {
    var n = c[0] === 'all' ? ALL.length : ALL.filter(function (r) { return r.category === c[0] || (c[0] === 'main' && r.category === 'sauce'); }).length;
    if (c[0] !== 'all' && !n) return '';
    return '<button class="rec-cat' + (curCat === c[0] ? ' on' : '') + '" data-cat="' + c[0] + '"><span class="rc-im"><img src="' + c[2] + '" alt="" width="150" height="150" loading="lazy" onerror="this.parentNode.classList.add(\'off\');"></span><b>' + c[1] + '</b><small>' + n.toLocaleString('fa-IR') + ' رسپی</small></button>';
  }).join('');
  el.querySelectorAll('.rec-cat').forEach(function (b) {
    b.onclick = function () {
      curCat = b.dataset.cat; mealCats = null;
      el.querySelectorAll('.rec-cat').forEach(function (x) { x.classList.toggle('on', x === b); });
      pendingSeo = true; syncUrl(); renderTiles(); renderRecipes();
      try { window.dfbTrack('recipes_cat', { cat: curCat }); } catch (e) {}
    };
  });
}
/* ---------- SEO داینامیک صفحات فیلتردار: meta + H1 + ItemList + Breadcrumb ---------- */
function syncUrl() {
  var sp = new URLSearchParams();
  if (curCat !== 'all') sp.set('cat', curCat);
  if (curGoal !== 'all') sp.set('goal', curGoal);
  if (curRegion !== 'all' && !mealCats) { var cs = Object.keys(CUISINES).find(function (k) { return CUISINES[k] === curRegion; }); if (cs) sp.set('cuisine', cs); }
  if (mealCats) { var mk = Object.keys(MEAL_CATS).find(function (k) { return MEAL_CATS[k] === mealCats; }); if (mk) sp.set('meal', mk); }
  if (curQ) sp.set('q', curQ);
  var qs = sp.toString();
  try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
}
function applyRecipeSeo(list) {
  var sp = new URLSearchParams(location.search);
  var fa = '', path = null, title = '', desc = '', bcName = '';
  /* کلید cuisine از state (تا با آدرس تمیز هم کار کند) */
  var ckey = curRegion !== 'all' ? Object.keys(CUISINES).find(function (k) { return CUISINES[k] === curRegion; }) : null;
  if (mealCats) {
    var mk = Object.keys(MEAL_CATS).find(function (k) { return MEAL_CATS[k] === mealCats; });
    if (!mk) return;
    fa = MEAL_FA[mk]; bcName = fa + 'های سالم'; path = '/recipes/meal/' + mk;
    title = bcName + ' با کالری و ماکرو دقیق';
    desc = 'مجموعه رسپی‌های ' + fa + ' سالم و سیرکننده با کالری، پروتئین و زمان پخت مشخص — مناسب برنامه غذایی هفتگی.';
  } else if (ckey) {
    fa = ADJ[curRegion] ? 'غذاهای ' + ADJ[curRegion] : curRegion; bcName = fa; path = '/recipes/cuisine/' + ckey;
    title = fa + ' اصیل با رسپی گام‌به‌گام';
    desc = 'رسپی‌های واقعی ' + fa + ' با مواد در دسترس، کالری دقیق و مراحل پخت ساده — امتحانش کن.';
  } else if (curGoal !== 'all' && GOAL_FA[curGoal]) {
    fa = 'رسپی‌های ' + GOAL_FA[curGoal]; bcName = fa; path = '/recipes/goal/' + curGoal;
    title = fa + ' با کالری و پروتئین مشخص';
    desc = GOAL_FA[curGoal] === 'کاهش وزن' ? 'رسپی‌های کم‌کالری و سیرکننده برای کاهش وزن — همه با کالری و ماکرو دقیق ثبت شده‌اند.' : 'رسپی‌های مناسب هدف ' + GOAL_FA[curGoal] + ' با ارزش غذایی دقیق و مواد در دسترس.';
  } else if (curCat !== 'all' && CAT_FA[curCat]) {
    fa = 'رسپی‌های ' + CAT_FA[curCat]; bcName = fa; path = '/recipes/category/' + curCat;
    title = fa + ' — کالری، پروتئین و مراحل پخت دقیق';
    desc = 'بهترین ' + CAT_FA[curCat] + 'های سالم با کالری و ماکرو دقیق، مواد لازم و مراحل گام‌به‌گام.';
  } else return;

  if (window.DFB_setMeta) DFB_setMeta({ title: title, desc: desc, path: path });
  var h = document.querySelector('.page-head h1'), pp = document.querySelector('.page-head p');
  if (h) h.textContent = bcName;
  if (pp) pp.textContent = (list ? list.length.toLocaleString('fa-IR') : '') + ' رسپی واقعی با کالری و ماکرو دقیق';
  var base = window.DFB_SITE ? DFB_SITE.url : 'https://dailyfitbeat.ir';
  var items = (list || []).slice(0, 25).map(function (r, i) { return { "@type": "ListItem", "position": i + 1, "name": r.name_fa, "url": base + '/recipes/' + r.slug }; });
  var ld = [{ "@context": "https://schema.org", "@type": "ItemList", "itemListElement": items },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "خانه", "item": base + "/" },
      { "@type": "ListItem", "position": 2, "name": "رسپی‌ها", "item": base + "/recipes.html" },
      { "@type": "ListItem", "position": 3, "name": bcName, "item": base + path }
    ] }];
  var s = document.getElementById('gridLD');
  if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'gridLD'; document.head.appendChild(s); }
  s.textContent = JSON.stringify(ld);
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
  /* خواندن فیلتر از URL صفحات SEO: /recipes/category/:cat و … */
  var sp = new URLSearchParams(location.search);
  var pc = sp.get('cat'), pg = sp.get('goal'), pm = sp.get('meal'), pcu = sp.get('cuisine'), pq = sp.get('q'), pr = sp.get('region');
  /* آدرس تمیز: /recipes/category/:cat و مانند آن — کوئری سمت مرورگر خالی است */
  if (!pc && !pg && !pm && !pcu && !pr) {
    var mx = location.pathname.match(/\/recipes\/(category|goal|meal|cuisine)\/([^\/?#]+)/);
    if (mx) {
      var seg; try { seg = decodeURIComponent(mx[2]); } catch (e) { seg = mx[2]; }
      if (mx[1] === 'category') pc = seg;
      else if (mx[1] === 'goal') pg = seg;
      else if (mx[1] === 'meal') pm = seg;
      else pcu = seg;
    }
  }
  if (pc && (pc === 'all' || CAT_FA[pc])) curCat = pc;
  if (pg && (pg === 'all' || GOAL_FA[pg])) curGoal = pg;
  if (pm && MEAL_CATS[pm]) mealCats = MEAL_CATS[pm];
  if (pcu && CUISINES[pcu]) curRegion = CUISINES[pcu];
  if (pr) curRegion = pr;
  if (pq) { curQ = norm(pq); var si = document.getElementById('recipeSearch'); if (si) si.value = pq; }
  if (pc || pg || pm || pcu || pr || pq) pendingSeo = true;
  document.querySelectorAll('.filters .chip[data-goal]').forEach(function (c) { c.classList.toggle('on', c.dataset.goal === curGoal); });
  var sr = document.getElementById('recipeSearch');
  if (sr) sr.oninput = function () { curQ = norm(sr.value); syncUrl(); renderRecipes(); };
  document.querySelectorAll('.filters .chip[data-goal]').forEach(function (ch) {
    ch.onclick = function () {
      curGoal = ch.dataset.goal;
      document.querySelectorAll('.filters .chip[data-goal]').forEach(function (x) { x.classList.toggle('on', x === ch); });
      pendingSeo = true; syncUrl(); renderRecipes();
    };
  });
  var lm = document.getElementById('loadMore');
  if (lm) lm.onclick = function () { recShown += REC_PAGE; renderRecipes(true); };
}
async function initDetail() {
  if (page !== 'recipe') return;
  /* اسلاگ از ?slug= یا از آدرس تمیز /recipes/<slug> */
  var slug = new URLSearchParams(location.search).get('slug');
  if (!slug) {
    var pm = location.pathname.match(/\/recipes\/([^\/]+)/);
    if (pm) { try { slug = decodeURIComponent(pm[1]); } catch (e) { slug = pm[1]; } }
  }
  await loadAll();
  var r = ALL.find(function (x) { return x.slug === slug; });
  /* پیش‌نمایش پیش‌نویس برای ادمین */
  if (!r && window.DFB && DFB.isAdmin && DFB.isAdmin() && sb) {
    try {
      var s0 = await sb.auth.getSession();
      var aa = await (await fetch('/api/db?t=all_admin', { headers: { Authorization: 'Bearer ' + (s0.data.session ? s0.data.session.access_token : '') } })).json();
      if (Array.isArray(aa)) r = aa.find(function (x) { return x.slug === slug; });
    } catch (e) {}
  }
  var el = document.getElementById('rd');
  if (!el) return;
  if (!r) {
    /* اسلاگ قدیمی؟ ریدایرکت ثبت‌شده را امتحان کن */
    try {
      var resR = await fetch('/api/redirect?from=/recipes/' + encodeURIComponent(slug || ''));
      if (resR.ok && resR.redirected) { location.replace(resR.url); return; }
    } catch (e) {}
    el.innerHTML = '<p class="no-res">رسپی پیدا نشد — <a href="recipes.html">همه رسپی‌ها</a></p>';
    return;
  }
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
  var videoHtml = r.video_url ? '<div class="video-section"><h3>ویدیوی پخت</h3><a href="' + esc(r.video_url) + '" target="_blank" rel="noopener" class="video-card"><div class="video-thumb"><img src="' + esc(r.image || FALL[r.category] || 'img/cat-main.jpg') + '" data-fb="' + esc(FALL[r.category] || 'img/cat-main.jpg') + '" onerror="this.onerror=null;this.src=this.dataset.fb;" alt="' + esc(r.name_fa) + '"><span class="play-btn">▶</span></div><p>تماشای ویدیو در اینستاگرام</p></a></div>' : '';
  el.innerHTML = '<div class="container rd-wrap"><div class="rd-img"><img src="' + esc(r.image || FALL[r.category] || 'img/cat-main.jpg') + '" data-fb="' + esc(FALL[r.category] || 'img/cat-main.jpg') + '" onerror="this.onerror=null;this.src=this.dataset.fb;" alt="' + esc(r.name_fa) + '" fetchpriority="high" decoding="async"><button id="favBtn" class="heart' + (favOn ? ' on' : '') + '">♥</button></div><div class="rd-info"><span class="rd-region">' + esc(countryFa(r.region)) + '</span><h1>' + esc(r.name_fa) + '</h1><p class="rd-en">' + esc(r.name_en || '') + '</p><p class="rd-desc">' + esc(r.desc_fa || '') + '</p><div class="rd-stats"><div><b>' + r.time_min + '</b><span>زمان پخت (دقیقه)</span></div><div><b>' + diff(r.time_min) + '</b><span>سطح دشواری</span></div></div>' + nutritionBars + '<h3>مواد لازم</h3><ul class="ing-list">' + ings.map(function (i) { return '<li>' + esc(i.fa) + '<span>' + esc(i.q) + '</span></li>'; }).join('') + '</ul>' + stepsHtml + tipsHtml + subsHtml + videoHtml + '<div class="f-cta"><a class="btn" href="planner.html">افزودن به برنامه</a><a class="btn ghost" href="recipes.html">همه رسپی‌ها</a></div></div></div><div id="cmBox" class="cm-box"></div>';
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

  /* فاز ۴: ثبت تاریخچه بازدید برای کاربر واردشده */
  var histTok = '';
  if (sb && USER) {
    try {
      var sH = await sb.auth.getSession();
      histTok = sH.data.session ? sH.data.session.access_token : '';
      if (histTok) fetch('/api/db?t=history_add', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + histTok }, body: JSON.stringify({ slug: r.slug }), keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  /* فاز ۴: نظرات کاربران */
  var cmBox = document.getElementById('cmBox');
  if (cmBox) {
    var renderComments = async function () {
      var list = [];
      try { list = await (await fetch('/api/db?t=comments_get&slug=' + encodeURIComponent(r.slug))).json(); } catch (e) {}
      if (!Array.isArray(list)) list = [];
      cmBox.innerHTML = '<h3 class="cm-title">نظر کاربران (' + list.length.toLocaleString('fa-IR') + ')</h3>' +
        '<div id="cmList">' + (list.length ? list.map(function (c) {
          return '<div class="cm-item"><div class="cm-head"><b>' + esc(c.author_name) + '</b><time>' + esc(String(c.created_at || '').slice(0, 10)) + '</time></div><p>' + esc(c.body) + '</p></div>';
        }).join('') : '<p class="cm-empty">هنوز نظری ثبت نشده — اولین نفر باش!</p>') + '</div>' +
        '<div class="cm-form">' + (USER
          ? '<textarea id="cmText" maxlength="600" placeholder="نظرت درباره این رسپی چیه؟"></textarea><button class="btn" id="cmSend">ثبت نظر</button><small class="cm-hint">نظر بعد از تأیید نمایش داده می‌شود</small>'
          : '<p class="cm-empty">برای ثبت نظر <a href="#" id="cmLogin">وارد شو</a> — سریع با گوگل!</p>') + '</div>';
      var lg = document.getElementById('cmLogin');
      if (lg) lg.onclick = function (e) { e.preventDefault(); doLogin(); };
      var snd = document.getElementById('cmSend');
      if (snd && !snd.dataset.bound) {
        snd.dataset.bound = '1';
        snd.onclick = async function () {
          var txt = document.getElementById('cmText').value.trim();
          if (txt.length < 3) { alert('متن نظر خیلی کوتاهه'); return; }
          snd.disabled = true; snd.textContent = 'در حال ثبت…';
          try {
            var res = await fetch('/api/db?t=comment_post', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + histTok }, body: JSON.stringify({ slug: r.slug, body: txt }) });
            var j = await res.json().catch(function () { return {}; });
            if (res.ok) { alert(j.status === 'approved' ? 'نظرت منتشر شد ✓' : 'نظرت ثبت شد و بعد از تأیید نمایش داده می‌شود'); renderComments(); }
            else alert(j.error || 'خطا در ثبت نظر');
          } catch (e) { alert('خطا در ثبت نظر'); }
          snd.disabled = false; snd.textContent = 'ثبت نظر';
        };
      }
    };
    renderComments();
  }
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
  var pid = new URLSearchParams(location.search).get('id');
  if (pid) { renderProductPage(data, pid, grid); }
  else {
    grid.innerHTML = data.map(function (p) {
      var pl = '/market/p/' + encodeURIComponent(p.id);
      return '<div class="pcard"><a class="p-link" href="' + pl + '"><div class="p-img"><img src="' + esc(p.image || 'img/prod-fallback.jpg') + '" alt="' + esc(p.title_fa) + '"><span class="p-rate">★ ' + Number(p.rating).toLocaleString('fa-IR') + '</span>' + (p.off_percent ? '<span class="p-badge" style="background:#d33">' + Number(p.off_percent).toLocaleString('fa-IR') + '٪ تخفیف</span>' : (p.badge ? '<span class="p-badge">' + esc(p.badge) + '</span>' : '')) + '</div><h4>' + esc(p.title_fa) + '</h4></a><div class="p-body"><p>' + esc(p.desc_fa || '') + '</p><div class="p-price">' + rial(p.price_rial) + (p.old_price_rial ? '<s>' + rial(p.old_price_rial) + '</s>' : '') + '</div><button class="btn p-cart" data-id="' + esc(p.id) + '" data-t="' + esc(p.title_fa) + '">خرید</button></div></div>';
    }).join('');
  }
  var sel = document.getElementById('oProduct');
  if (sel) sel.innerHTML = data.map(function (p) { return '<option>' + esc(p.title_fa) + '</option>'; }).join('');
}
/* ---------- صفحه اختصاصی محصول + اسکیمای Product ---------- */
function renderProductPage(data, pid, grid) {
  var p = data.find(function (x) { return String(x.id) === String(pid); });
  if (!p) { grid.innerHTML = '<p class="no-res">محصول پیدا نشد — <a href="market.html">همه محصولات</a></p>'; return; }
  var base = window.DFB_SITE ? DFB_SITE.url : 'https://dailyfitbeat.ir';
  if (window.DFB_setMeta) DFB_setMeta({ title: p.meta_title || p.title_fa, desc: p.meta_description || p.desc_fa || p.title_fa, path: '/market/p/' + p.id, image: p.image || undefined, type: 'article' });
  grid.innerHTML = '<div class="pdp"><div class="pdp-img"><img src="' + esc(p.image || 'img/prod-fallback.jpg') + '" alt="' + esc(p.title_fa) + '"></div><div class="pdp-info"><nav class="crumbs"><a href="/">خانه</a> › <a href="market.html">فیت مارکت</a> › <span>' + esc(p.title_fa) + '</span></nav>' + (p.badge ? '<span class="p-badge">' + esc(p.badge) + '</span>' : '') + '<h1>' + esc(p.title_fa) + '</h1><p class="pdp-desc">' + esc(p.desc_fa || '') + '</p><div class="p-price">' + rial(p.price_rial) + (p.old_price_rial ? '<s>' + rial(p.old_price_rial) + '</s>' : '') + '</div><button class="btn p-cart" data-id="' + esc(p.id) + '" data-t="' + esc(p.title_fa) + '">افزودن به سبد خرید</button><p class="pdp-hint">بعد از تأیید پرداخت، فایل در «پنل کاربری ← محصولات من» فعال می‌شود.</p><a class="btn ghost" href="market.html">همه محصولات</a></div></div>';
  var ld = [{ "@context": "https://schema.org", "@type": "Product", "name": p.title_fa, "description": p.desc_fa || p.title_fa, "image": base + (p.image || '/img/prod-fallback.jpg'), "brand": { "@type": "Brand", "name": "DailyFitBeat" }, "offers": { "@type": "Offer", "priceCurrency": "IRR", "price": Number(p.price_rial) || 0, "availability": "https://schema.org/InStock", "url": base + '/market/p/' + p.id } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "خانه", "item": base + "/" },
      { "@type": "ListItem", "position": 2, "name": "فیت مارکت", "item": base + "/market.html" },
      { "@type": "ListItem", "position": 3, "name": p.title_fa, "item": base + '/market/p/' + p.id }
    ] }];
  var s = document.createElement('script');
  s.type = 'application/ld+json';
  s.textContent = JSON.stringify(ld);
  document.head.appendChild(s);
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
if (page === 'recipes') loadAll().then(function () { renderCatCards(); renderTiles(); renderRecipes(); });
