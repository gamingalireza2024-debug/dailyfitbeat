document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="glass.css">');
const $ = s => document.querySelector(s);
let lang = localStorage.getItem('dfb-lang') || 'fa';
let have = [], ING = [], ALL = [];
const page = document.body.dataset.page;
const SB_URL = "https://hvqchqqlfcjxsohxywbd.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
let sb = null, USER = null, ADMIN_EMAILS = [];
const rial = n => (Number(n) || 0).toLocaleString('fa-IR') + ' ریال';
const FALL = { iranian:'img/iranian.jpg', salad:'img/salad.jpg', sandwich:'img/sandwich.jpg', breakfast:'img/breakfast.jpg', soup:'img/soup.jpg', sauce:'img/soup.jpg', main:'img/hero.jpg' };
const diff = t => t <= 20 ? 'آسان' : t <= 60 ? 'متوسط' : 'مفصل';
const ADJ = {'ایران':'ایرانی','گیلان':'گیلانی','ژاپن':'ژاپنی','تایلند':'تایلندی','اسپانیا':'اسپانیایی','مراکش':'مراکشی','فرانسه':'فرانسوی','ایتالیا':'ایتالیایی','چین':'چینی','هند':'هندی','ترکیه':'ترکی','مکزیک':'مکزیکی','انگلستان':'انگلیسی','یونان':'یونانی','کره':'کره‌ای','لبنان':'لبنانی'};
const countryFa = reg => 'غذای ' + (ADJ[reg] || reg || 'ایرانی');
const NAV = [['home','index.html','خانه','Home'],['recipes','recipes.html','رسپی‌ها','Recipes'],['planner','planner.html','برنامه غذایی','Meal Plan'],['market','market.html','فیت مارکت','Fit Market'],['pro','pro.html','PRO','PRO']];
window.DFB = { get sb(){ return sb; }, get user(){ return USER; }, isAdmin: () => isAdmin() };

async function loadAdminList(token){
  try {
    const r = await fetch('/api/db?t=admin_check', token ? { headers: { Authorization: 'Bearer ' + token } } : {});
    const d = await r.json();
    ADMIN_EMAILS = Array.isArray(d) ? d.map(x => x.email) : [];
  } catch(e){}
}
function isAdmin(){ return !!USER && ADMIN_EMAILS.includes(USER.email); }
function doLogin(){ if(sb) sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin + location.pathname } }); }

function injectHeader(){
  const links = NAV.map(([k,h,f,e]) => `<a href="${h}" class="${page===k?'on':''}" data-fa="${f}" data-en="${e}">${lang==='fa'?f:e}</a>`).join('');
  $('#hdr').innerHTML = `<a class="logo" href="index.html"><img src="img/logo.png" alt="DailyFitBeat"></a>
  <nav>${links}</nav>
  <div class="hactions">
    <span id="authBox"></span>
    <button id="langBtn" class="lang">${lang==='fa'?'EN':'فا'}</button>
    <a class="btn small" href="pro.html" data-fa="شروع رایگان" data-en="Start Free">${lang==='fa'?'شروع رایگان':'Start Free'}</a>
    <button id="burger" class="burger" aria-label="menu"><span></span><span></span><span></span></button>
  </div>
  <div id="mnav" class="mnav">${links}</div>`;
  $('#burger').onclick = () => $('#mnav').classList.toggle('open');
  $('#langBtn').onclick = toggleLang;
  renderAuth();
}
function renderAuth(){
  const box = document.getElementById('authBox'); if(!box) return;
  if(!USER){
    box.innerHTML = `<button id="loginBtn" class="auth-chip">ورود با گوگل</button>`;
    document.getElementById('loginBtn').onclick = doLogin;
  } else {
    const name = (USER.user_metadata && USER.user_metadata.name ? USER.user_metadata.name.split(' ')[0] : 'پنل من');
    let html = `<a href="user.html" class="auth-chip user-on" title="پنل کاربری">👤 ${name}</a>`;
    if(isAdmin()) html += `<a href="admin.html" class="auth-chip admin-on" title="پنل ادمین">👑 ادمین</a>`;
    html += `<button id="logoutBtn" class="auth-chip">خروج</button>`;
    box.innerHTML = html;
    document.getElementById('logoutBtn').onclick = async () => { await sb.signOut(); location.reload(); };
  }
}
async function ensureProfile(){
  if(!sb || !USER) return;
  const { data } = await sb.from('profiles').select('phone,name').eq('id', USER.id).maybeSingle();
  if(!data){ await sb.from('profiles').insert({ id: USER.id, name: (USER.user_metadata && USER.user_metadata.full_name) || '' }); phoneModal(); }
  else if(!data.phone){ phoneModal(); }
}
function phoneModal(){
  if(document.getElementById('phModal')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="phModal" class="modal"><div class="modal-box"><h3>تکمیل پروفایل</h3><p>برای پیگیری سفارش‌ها، شماره موبایلت رو وارد کن</p><input id="phInput" type="tel" maxlength="11" placeholder="09xxxxxxxxx"><button id="phSave" class="btn">ذخیره</button></div></div>`);
  document.getElementById('phSave').onclick = async () => {
    const v = document.getElementById('phInput').value.trim();
    if(!/^09[0-9]{9}$/.test(v)) { alert('شماره معتبر نیست'); return; }
    await sb.from('profiles').update({ phone: v }).eq('id', USER.id);
    document.getElementById('phModal').remove();
  };
}
async function bootAuth(){
  try {
    const m = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    sb = m.createClient(SB_URL, ANON);
    sb.auth.onAuthStateChange(async (ev, sess) => {
      USER = (sess && sess.user) || null;
      if(USER) await loadAdminList(sess.access_token);
      injectHeader();
      if(USER) ensureProfile();
      initAdmin(); initUser();
    });
    const { data } = await sb.auth.getSession();
    USER = (data.session && data.session.user) || null;
    if(USER) await loadAdminList(data.session.access_token);
    if(USER) ensureProfile();
    injectHeader();
    initAdmin(); initUser();
  } catch(e) { console.log('auth off', e); }
}
function injectFooter(){
  $('#ftr').innerHTML = `<div class="container f-cols">
  <div><img class="f-logo" src="img/logo.png" alt="DailyFitBeat"><p>غذای سالم که واقعاً خوشمزه به نظر می‌رسه.</p></div>
  <div><b>رسپی‌ها</b><a href="recipes.html">ایرانی</a><a href="recipes.html">سالادها</a><a href="recipes.html">ساندویچ‌ها</a></div>
  <div><b>محصول</b><a href="planner.html">برنامه غذایی</a><a href="index.html#finder">امروز چی داری؟</a><a href="pro.html">PRO</a></div>
  <div><b>فیت مارکت</b><a href="market.html">محصولات دیجیتال</a><a href="https://instagram.com/dailyfitbeat">اینستاگرام</a><a href="market.html">ثبت سفارش</a></div>
  </div><div class="f-bottom">© DailyFitBeat</div>`;
}
function toggleLang(){
  lang = lang==='fa' ? 'en' : 'fa';
  localStorage.setItem('dfb-lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-fa]').forEach(el => el.textContent = el.dataset[lang]);
  injectHeader();
}
function bindScroll(){ window.onscroll = () => $('#hdr').classList.toggle('scrolled', scrollY > 40); }

const norm = s => (s||'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ').trim();
function hay(r){ return [r.name_fa,r.name_en,r.region,countryFa(r.region),r.desc_fa,r.category,(r.tags||[]).join(' ')].map(norm).join(' | '); }
function initSearch(){
  const inp = $('#searchInput'), box = $('#searchRes');
  if(!inp) return;
  inp.oninput = () => {
    const q = norm(inp.value);
    if(q.length < 2){ box.innerHTML=''; return; }
    const res = ALL.filter(r => q.split(' ').every(w => hay(r).includes(w))).slice(0,12);
    box.innerHTML = res.length ? res.map(r => card(r)).join('') : `<p class="no-res">چیزی پیدا نشد</p>`;
  };
}
function card(r, big){
  return `<a class="card${big?' big':''}" href="recipe.html?slug=${r.slug}">
  <div class="c-img"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" loading="lazy"></div>
  <div class="c-body"><h3>${r.name_fa}</h3>
  <div class="c-meta"><span>پخت: ${r.time_min} دقیقه</span><span>${r.kcal} کالری</span><span>پروتئین ${r.protein}g</span></div>
  <div class="c-tags"><i>${diff(r.time_min)}</i><i>${countryFa(r.region)}</i></div>
  </div></a>`;
}
async function loadChips(){ const r = await fetch('/api/db?t=ingredients'); ING = await r.json(); renderChips(); }
function renderChips(){
  const c = $('#chips'); if(!c) return;
  c.innerHTML = ING.map(i => `<button class="chip${have.includes(i.key)?' on':''}" data-key="${i.key}">${lang==='fa'?i.fa:i.en}</button>`).join('');
  c.querySelectorAll('.chip').forEach(x => x.onclick = () => { x.classList.toggle('on'); have = [...c.querySelectorAll('.chip.on')].map(y => y.dataset.key); });
}
function initFinder(){
  if(!$('#chips')) return;
  loadChips();
  const add = $('#ingAdd');
  if(add) add.onclick = () => {
    const v = $('#ingInput').value.trim(); if(!v) return;
    const m = ING.find(i => i.fa.includes(v) || i.en.toLowerCase().includes(v.toLowerCase()));
    if(m && !have.includes(m.key)){ have.push(m.key); renderChips(); $('#ingInput').value=''; }
  };
  const go = $('#goBtn');
  if(go) go.onclick = async () => {
    if(!have.length) return alert('اول چند تا ماده رو انتخاب کن');
    const r = await fetch('/api/db?t=match&a=' + have.join(','));
    const data = await r.json();
    $('#results').innerHTML = Array.isArray(data) ? data.map(x => card(x)).join('') : '';
  };
}
async function loadPopular(){
  const el = $('#popularCards'); if(!el) return;
  const r = await fetch('/api/db?t=popular'); const data = await r.json();
  if(!Array.isArray(data)) return;
  el.innerHTML = card(data[0], true) + data.slice(1).map(x => card(x)).join('');
}
let curCat = 'all', curGoal = 'all', curQ = '';
function renderRecipes(){
  const el = $('#recipeGrid'); if(!el) return;
  const list = ALL.filter(r => (curCat==='all' || r.category===curCat) && (curGoal==='all' || (r.tags||[]).includes(curGoal)) && (!curQ || curQ.split(' ').every(w => hay(r).includes(w))));
  el.innerHTML = list.map(r => card(r)).join('') || `<p class="no-res">چیزی در این دسته نیست</p>`;
}
function initRecipes(){
  if(page !== 'recipes') return;
  const sr = $('#recipeSearch');
  if(sr) sr.oninput = () => { curQ = norm(sr.value); renderRecipes(); };
  document.querySelectorAll('.filters .chip').forEach(ch => ch.onclick = () => {
    document.querySelectorAll('.filters .chip').forEach(x => x.classList.remove('on'));
    ch.classList.add('on');
    if(ch.dataset.cat !== undefined) curCat = ch.dataset.cat;
    if(ch.dataset.goal !== undefined) curGoal = ch.dataset.goal;
    renderRecipes();
  });
}
async function initDetail(){
  if(page !== 'recipe') return;
  const slug = new URLSearchParams(location.search).get('slug');
  await loadAll();
  const r = ALL.find(x => x.slug === slug);
  const el = $('#rd');
  if(!r){ el.innerHTML = '<p class="no-res">پیدا نشد</p>'; return; }
  document.title = r.name_fa + ' | DailyFitBeat';
  if (window.DFB_setRecipeMeta) window.DFB_setRecipeMeta(r);
  const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
  let favOn = false;
  if(sb && USER){ const { data } = await sb.from('favorites').select('id').eq('recipe_slug', r.slug).maybeSingle(); favOn = !!data; }
  const nutritionBars = `
    <div class="nutrition-grid">
      <div class="nut-bar"><b>${r.kcal || 0}</b><span>کالری</span><div class="bar"><div style="width:${Math.min(100, (r.kcal/2000)*100)}%"></div></div></div>
      <div class="nut-bar"><b>${r.protein || 0}g</b><span>پروتئین</span><div class="bar"><div style="width:${Math.min(100, (r.protein/50)*100)}%"></div></div></div>
      ${r.carbs != null ? `<div class="nut-bar"><b>${r.carbs}g</b><span>کربوهیدرات</span><div class="bar"><div style="width:${Math.min(100, (r.carbs/100)*100)}%"></div></div></div>` : ''}
      ${r.fat != null ? `<div class="nut-bar"><b>${r.fat}g</b><span>چربی</span><div class="bar"><div style="width:${Math.min(100, (r.fat/70)*100)}%"></div></div></div>` : ''}
      ${r.fiber != null ? `<div class="nut-bar"><b>${r.fiber}g</b><span>فیبر</span><div class="bar"><div style="width:${Math.min(100, (r.fiber/30)*100)}%"></div></div></div>` : ''}
    </div>`;
  const stepsHtml = Array.isArray(r.steps) && r.steps.length ? `
    <div class="steps-section"><h3>مراحل پخت</h3><ol class="steps-list">
      ${r.steps.map(s => `<li><span class="step-num">${''}</span><p>${s}</p></li>`).join('')}
    </ol></div>` : '';
  const tipsHtml = Array.isArray(r.tips) && r.tips.length ? `
    <div class="tips-section"><h3>💡 نکات پخت</h3><ul class="tips-list">
      ${r.tips.map(t => `<li>${t}</li>`).join('')}
    </ul></div>` : '';
  const subsHtml = Array.isArray(r.substitutions) && r.substitutions.length ? `
    <div class="subs-section"><h3>🔄 جایگزین‌ها</h3><div class="subs-grid">
      ${r.substitutions.map(s => `<div class="sub-card"><b>${s.from}</b><span>→</span><b>${s.to}</b></div>`).join('')}
    </div></div>` : '';
  const videoHtml = r.video_url ? `
    <div class="video-section"><h3>🎬 ویدیوی پخت</h3>
    <a href="${r.video_url}" target="_blank" rel="noopener" class="video-card">
      <div class="video-thumb"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" alt="${r.name_fa}"><span class="play-btn">▶</span></div>
      <p>تماشای ویدیو در اینستاگرام</p>
    </a></div>` : '';
  el.innerHTML = `<div class="container rd-wrap">
  <div class="rd-img"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" alt="${r.name_fa}"><button id="favBtn" class="heart${favOn?' on':''}">♥</button></div>
  <div class="rd-info">
    <span class="rd-region">${countryFa(r.region)}</span>
    <h1>${r.name_fa}</h1><p class="rd-en">${r.name_en}</p>
    <p class="rd-desc">${r.desc_fa || ''}</p>
    <div class="rd-stats">
      <div><b>${r.time_min}</b><span>زمان پخت (دقیقه)</span></div>
      <div><b>${diff(r.time_min)}</b><span>سطح دشواری</span></div>
    </div>
    ${nutritionBars}
    <h3>مواد لازم</h3>
    <ul class="ing-list">${ings.map(i => `<li>${i.fa}<span>${i.q}</span></li>`).join('')}</ul>
    ${stepsHtml}
    ${tipsHtml}
    ${subsHtml}
    ${videoHtml}
    <div class="f-cta">
      <a class="btn" href="planner.html">افزودن به برنامه</a>
      <a class="btn ghost" href="recipes.html">همه رسپی‌ها</a>
    </div>
  </div></div>`;
  document.getElementById('favBtn').onclick = async () => {
    if(!USER){ alert('برای ذخیره علاقه‌مندی، اول با گوگل وارد شو ❤️'); doLogin(); return; }
    if(favOn){ await sb.from('favorites').delete().eq('user_id', USER.id).eq('recipe_slug', r.slug); favOn = false; }
    else { await sb.from('favorites').insert({ user_id: USER.id, recipe_slug: r.slug }); favOn = true; }
    document.getElementById('favBtn').classList.toggle('on', favOn);
  };
}
function initOrder(){
  const f = $('#orderForm'); if(!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const o = { name: $('#oName').value, phone: $('#oPhone').value, email: $('#oEmail').value, product: $('#oProduct').value, note: $('#oNote').value, ref: $('#oRef').value, user_id: USER ? USER.id : null };
    const r = await fetch('/api/db?t=order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(o) });
    const res = await r.json();
    const ok = $('#orderOk');
    ok.style.display = 'block';
    ok.innerHTML = `سفارش تو با کد <b>${res.id ?? '—'}</b> ثبت شد ✅<br>تلگرام: ${res.tg ? '✅' : '❌'} — ایمیل: ${res.mail === 'ok' ? '✅' : '❌'}${USER ? '<br>در پنل کاربری قابل پیگیریه 👤' : ''}`;
    f.reset();
  };
}
async function initMarket(){
  const grid = $('#prodGrid'); if(!grid) return;
  const data = await (await fetch('/api/db?t=products')).json();
  if(!Array.isArray(data)) return;
  grid.innerHTML = data.map(p => `<div class="pcard">
    <div class="p-img"><img src="${p.image || 'img/hero-store.jpg'}" alt="${p.title_fa}"><span class="p-rate">★ ${Number(p.rating).toLocaleString('fa-IR')}</span>${p.off_percent ? `<span class="p-badge" style="background:#d33">🔥 ${Number(p.off_percent).toLocaleString('fa-IR')}٪ تخفیف</span>` : (p.badge ? `<span class="p-badge">${p.badge}</span>` : '')}</div>
    <div class="p-body"><h4>${p.title_fa}</h4><p>${p.desc_fa || ''}</p>
    <div class="p-price">${rial(p.price_rial)}${p.old_price_rial ? `<s>${rial(p.old_price_rial)}</s>` : ''}</div>
    <button class="btn p-cart" data-t="${p.title_fa}">🛒 خرید</button></div>
  </div>`).join('');
  const sel = $('#oProduct');
  if(sel) sel.innerHTML = data.map(p => `<option>${p.title_fa}</option>`).join('');
  document.querySelectorAll('.p-cart').forEach(b => b.onclick = () => {
    const s = $('#oProduct'); if(s) s.value = b.dataset.t;
    document.getElementById('order').scrollIntoView({ behavior: 'smooth' });
  });
}
async function initPro(){
  const box = $('#planCards'); if(!box) return;
  const data = await (await fetch('/api/db?t=plans')).json();
  if(!Array.isArray(data)) return;
  box.innerHTML = data.map(pl => `<div class="price-card${pl.key === 'yearly' ? ' hot' : ''}" data-key="${pl.key}">
    ${pl.key === 'yearly' ? '<span class="ribbon">پیشنهاد ویژه</span>' : ''}
    <h3>${pl.title_fa}</h3>
    <div class="p">${rial(pl.price_rial)}<small> / ${pl.period}</small></div>
    ${pl.old_price_rial ? `<s class="oldp">${rial(pl.old_price_rial)}</s>` : ''}
    <ul>${(pl.features || []).map(f => `<li>✔ ${f}</li>`).join('')}</ul>
    <a class="btn" href="market.html#order">انتخاب پلان</a>
  </div>`).join('');
  document.querySelectorAll('.plan-tog button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.plan-tog button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    document.querySelectorAll('#planCards .price-card').forEach(c => c.classList.toggle('hot', c.dataset.key === b.dataset.key));
  });
}
async function initAdmin(){
  if(page !== 'admin') return;
  if(!USER){ $('#adminStat').textContent = 'لطفاً اول وارد شو'; return; }
  if(!isAdmin()){ $('#adminStat').textContent = '❌ دسترسی ادمین ندارید'; return; }
  $('#adminStat').textContent = `خوش آمدی، ${USER.email}`;
  $('#adminBody').style.display = 'block';
  await loadOrders(); await loadProdAdmin(); await loadPlansAdmin();
  $('#csvBtn').onclick = exportCSV;
  $('#filterSt').onchange = loadOrders;
  const np = $('#npAdd');
  if(np) np.onclick = async () => {
    const t = $('#npTitle').value.trim(), d = $('#npDesc').value.trim(), pr = +$('#npPrice').value;
    if(!t || !pr){ alert('نام و قیمت لازمه'); return; }
    await sb.from('products').insert({ title_fa: t, desc_fa: d, price_rial: pr, rating: 4.8 });
    $('#npTitle').value = $('#npDesc').value = $('#npPrice').value = '';
    loadProdAdmin();
  };
}
async function loadProdAdmin(){
  const data = await (await fetch('/api/db?t=products')).json();
  if(!Array.isArray(data)) return;
  const el = $('#prodBody'); if(!el) return;
  el.innerHTML = data.map(p => `<tr>
    <td><b>${p.title_fa}</b></td>
    <td><input class="prIn" data-id="${p.id}" data-f="price_rial" type="number" value="${p.price_rial}" style="width:130px;padding:8px;border-radius:10px;border:1px solid #ccc"></td>
    <td><input class="prIn" data-id="${p.id}" data-f="old_price_rial" type="number" value="${p.old_price_rial || ''}" style="width:130px;padding:8px;border-radius:10px;border:1px solid #ccc"></td>
    <td>${p.rating}</td>
    <td><input type="checkbox" class="prAct" data-id="${p.id}" ${p.active ? 'checked' : ''}></td>
    <td><button class="btn small prSave" data-id="${p.id}">ذخیره</button></td>
  </tr>`).join('');
  document.querySelectorAll('.prSave').forEach(b => b.onclick = async () => {
    const id = b.dataset.id;
    const upd = {};
    document.querySelectorAll(`.prIn[data-id="${id}"]`).forEach(i => { upd[i.dataset.f] = i.value === '' ? null : +i.value; });
    const act = document.querySelector(`.prAct[data-id="${id}"]`);
    upd.active = act.checked;
    await sb.from('products').update(upd).eq('id', id);
    alert('ذخیره شد ✅');
  });
}
async function loadPlansAdmin(){
  const data = await (await fetch('/api/db?t=plans')).json();
  if(!Array.isArray(data)) return;
  const el = $('#plansBody'); if(!el) return;
  el.innerHTML = data.map(p => `<tr>
    <td><b>${p.title_fa}</b> (${p.period})</td>
    <td><input class="plIn" data-id="${p.id}" data-f="price_rial" type="number" value="${p.price_rial}" style="width:130px;padding:8px;border-radius:10px;border:1px solid #ccc"></td>
    <td><input class="plIn" data-id="${p.id}" data-f="old_price_rial" type="number" value="${p.old_price_rial || ''}" style="width:130px;padding:8px;border-radius:10px;border:1px solid #ccc"></td>
    <td><button class="btn small plSave" data-id="${p.id}">ذخیره</button></td>
  </tr>`).join('');
  document.querySelectorAll('.plSave').forEach(b => b.onclick = async () => {
    const id = b.dataset.id, upd = {};
    document.querySelectorAll(`.plIn[data-id="${id}"]`).forEach(i => { upd[i.dataset.f] = i.value === '' ? null : +i.value; });
    await sb.from('plans').update(upd).eq('id', id);
    alert('ذخیره شد ✅');
  });
}
async function loadOrders(){
  const r = await fetch('/api/db?t=all_orders');
  const data = await r.json();
  const filter = $('#filterSt').value;
  const list = Array.isArray(data) ? (filter === 'all' ? data : data.filter(x => x.status === filter)) : [];
  const stats = { new: 0, paid: 0, sent: 0 };
  (Array.isArray(data)?data:[]).forEach(o => { if(stats[o.status] !== undefined) stats[o.status]++; });
  $('#statsBox').innerHTML = `<div class="st"><b>${(Array.isArray(data)?data:[]).length}</b><span>کل سفارش‌ها</span></div>
  <div class="st"><b>${stats.new}</b><span>جدید</span></div>
  <div class="st"><b>${stats.paid}</b><span>پرداخت شده</span></div>
  <div class="st"><b>${stats.sent}</b><span>ارسال شده</span></div>`;
  $('#ordersBody').innerHTML = list.map(o => `<tr>
    <td>#${o.id}</td>
    <td>${new Date(o.created_at).toLocaleDateString('fa-IR')}</td>
    <td>${o.name || '-'}</td>
    <td><b dir="ltr">${o.phone || '-'}</b></td>
    <td>${o.email || '-'}</td>
    <td>${o.product || '-'}</td>
    <td dir="ltr">${o.ref || '-'}</td>
    <td><span class="status-pill status-${o.status}">${{'new':'جدید','paid':'پرداخت شده','sent':'ارسال شده'}[o.status] || o.status}</span></td>
    <td><select data-id="${o.id}" class="stSel">
      <option value="new"${o.status==='new'?' selected':''}>جدید</option>
      <option value="paid"${o.status==='paid'?' selected':''}>پرداخت شده</option>
      <option value="sent"${o.status==='sent'?' selected':''}>ارسال شده</option>
    </select></td>
  </tr>`).join('');
  document.querySelectorAll('.stSel').forEach(sel => sel.onchange = async () => {
    await fetch('/api/db?t=set_status', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: sel.dataset.id, status: sel.value }) });
    loadOrders();
  });
}
function exportCSV(){
  fetch('/api/db?t=all_orders').then(r=>r.json()).then(data => {
    const rows = [['کد','تاریخ','نام','موبایل','ایمیل','محصول','کد واریز','وضعیت','یادداشت']];
    (Array.isArray(data)?data:[]).forEach(o => rows.push([o.id, new Date(o.created_at).toLocaleString('fa-IR'), o.name, o.phone, o.email, o.product, o.ref, o.status, o.note || '']));
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dailyfitbeat-orders.csv';
    a.click();
  });
}
async function initUser(){
  if(page !== 'user') return;
  if(!USER){ $('#userStat').textContent = 'لطفاً اول وارد شو'; return; }
  $('#userStat').textContent = USER.email;
  $('#userBody').style.display = 'block';
  const { data: prof } = await sb.from('profiles').select('*').eq('id', USER.id).maybeSingle();
  $('#uName').textContent = (prof && prof.name) || (USER.user_metadata && USER.user_metadata.full_name) || '—';
  $('#uEmail').textContent = USER.email;
  $('#uPhone').textContent = (prof && prof.phone) || '—';
  const pe = $('#phEdit'); if(pe) pe.onclick = phoneModal;
  const o = await (await fetch('/api/db?t=my_orders&uid=' + USER.id)).json();
  $('#myOrders').innerHTML = (Array.isArray(o) && o.length) ? o.map(x => `<div class="my-order"><div><b>#${x.id}</b> — ${x.product}<br><small>${new Date(x.created_at).toLocaleString('fa-IR')}</small></div><span class="status-pill status-${x.status}">${{'new':'جدید','paid':'پرداخت شده','sent':'ارسال شده'}[x.status] || x.status}</span></div>`).join('') : '<p>هنوز سفارشی نداری</p>';
  const f = await (await fetch('/api/db?t=my_favs&uid=' + USER.id)).json();
  if(Array.isArray(f) && f.length){
    await loadAll();
    $('#myFavs').innerHTML = f.map(x => { const r = ALL.find(a => a.slug === x.recipe_slug); return r ? card(r) : ''; }).join('');
  } else {
    $('#myFavs').innerHTML = '<p>هنوز رسپی موردعلاقه‌ای ثبت نکردی</p>';
  }
}
async function loadAll(){ const r = await fetch('/api/db?t=all'); ALL = await r.json(); }

injectHeader(); injectFooter(); bindScroll(); bootAuth();
document.documentElement.lang = lang;
document.documentElement.dir = lang==='fa' ? 'rtl' : 'ltr';
initSearch(); initFinder(); initRecipes(); initDetail(); initOrder(); initMarket(); initPro();
if(page === 'home'){ loadPopular(); loadAll(); }
if(page === 'recipes'){ loadAll().then(renderRecipes); }
