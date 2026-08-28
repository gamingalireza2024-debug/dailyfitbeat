(function () {
  if (document.body.dataset.page !== 'user') return;

  var sb = null;
  var booted = false;
  var authReady = false;
  var mainStarted = false;
  var currentUser = null;
  var lastDietPlans = [];
  var lastDietDetails = {};
  var allRecipes = [];

  function $(id) { return document.getElementById(id); }
  function qsa(sel) { return [].slice.call(document.querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function faN(n) { return (Number(n) || 0).toLocaleString('fa-IR'); }
  function rialFa(n) { return (Number(n) || 0).toLocaleString('fa-IR') + ' ریال'; }
  function faDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('fa-IR'); } catch (e) { return '—'; }
  }
  function setHTML(ids, html) {
    ids.forEach(function (id) { var el = $(id); if (el) el.innerHTML = html; });
  }
  function setText(ids, text) {
    ids.forEach(function (id) { var el = $(id); if (el) el.textContent = text; });
  }
  function safe(name, fn) {
    return Promise.resolve().then(fn).catch(function (e) {
      console.error('user dashboard section error (' + name + '):', e);
      return null;
    });
  }

  async function waitForSB() {
    for (var i = 0; i < 40; i++) {
      if (window.DFB && DFB.sb) { sb = DFB.sb; return true; }
      await new Promise(function (r) { setTimeout(r, 150); });
    }
    return false;
  }
  async function getSessionSafe() {
    try {
      if (!sb) return null;
      var r = await sb.auth.getSession();
      return r && r.data && r.data.session ? r.data.session : null;
    } catch (e) { return null; }
  }
  async function tok() {
    var s = await getSessionSafe();
    return s && s.access_token ? s.access_token : null;
  }
  async function headers() {
    var t = await tok();
    if (!t) return null;
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t, 'X-Supabase-Auth': t };
  }
  async function apiDb(t, opts) {
    var h = await headers();
    var base = { 'Content-Type': 'application/json' };
    if (h) base = h;
    return fetch('/api/db?t=' + t, Object.assign({ headers: base }, opts || {}));
  }
  async function apiPlain(url, opts) {
    var h = await headers();
    var base = { 'Content-Type': 'application/json' };
    if (h) base = h;
    return fetch(url, Object.assign({ headers: base }, opts || {}));
  }

  function bindAuthWatcher() {
    if (!sb || sb.__dfbUserWatcher) return;
    sb.__dfbUserWatcher = true;
    try {
      sb.auth.onAuthStateChange(function (ev, sess) {
        if (ev === 'INITIAL_SESSION') authReady = true;
        if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED') {
          authReady = true;
          if (sess && sess.user) {
            currentUser = sess.user;
            if (!mainStarted) main(sess.user);
          }
        }
        if (ev === 'SIGNED_OUT') {
          authReady = true;
          currentUser = null;
          mainStarted = false;
          renderLoggedOut();
        }
      });
    } catch (e) { authReady = true; }
    window.addEventListener('dfb:logout', function () {
      currentUser = null;
      mainStarted = false;
      authReady = true;
      renderLoggedOut();
    });
  }

  function bindLogoutButtons() {
    var ids = ['uLogout', 'userLogout', 'dashLogout', 'logoutBtn2'];
    ids.forEach(function (id) {
      var el = $(id);
      if (el && !el.dataset.boundLogout) {
        el.dataset.boundLogout = '1';
        el.onclick = function () { if (window.DFB && DFB.logout) DFB.logout(); };
      }
    });
    qsa('[data-logout]').forEach(function (el) {
      if (el.dataset.boundLogout) return;
      el.dataset.boundLogout = '1';
      el.onclick = function () { if (window.DFB && DFB.logout) DFB.logout(); };
    });
  }

  async function waitAuthReady() {
    for (var i = 0; i < 35; i++) {
      var sess = await getSessionSafe();
      if (sess && sess.user) return sess;
      if (authReady) return null;
      await new Promise(function (r) { setTimeout(r, 150); });
    }
    return await getSessionSafe();
  }

  function renderLoggedOut() {
    setText(['userEmail', 'uEmail', 'dashEmail'], '');
    setText(['userName', 'uName', 'dashName'], '');
    setHTML(['userStat', 'dashStat', 'dashboardStat'], '<div class="empty">برای مشاهده داشبورد، ابتدا وارد حساب کاربری شوید.</div>');
    setHTML(['aiUsage', 'aiUsageCard', 'aiStat'], '<div class="empty">مصرف هوش مصنوعی: نیاز به ورود</div>');
    setHTML(['dietPlans', 'dietList', 'mealPlans', 'mealPlanList'], '<div class="empty">برای مشاهده برنامه‌های غذایی وارد شوید.</div>');
    setHTML(['dietDetail', 'mealPlanDetail', 'planDetail'], '');
    setHTML(['ordersBody', 'myOrdersBody'], '<tr><td colspan="8">برای مشاهده سفارش‌ها وارد شوید.</td></tr>');
    setHTML(['ordersList', 'myOrders'], '<div class="empty">برای مشاهده سفارش‌ها وارد شوید.</div>');
    setHTML(['productsBody', 'myProductsBody'], '<tr><td colspan="6">برای مشاهده محصولات وارد شوید.</td></tr>');
    setHTML(['productsList', 'myProducts'], '<div class="empty">برای مشاهده محصولات وارد شوید.</div>');
    setHTML(['favBody', 'favoritesBody'], '<tr><td colspan="5">برای مشاهده علاقه‌مندی‌ها وارد شوید.</td></tr>');
    setHTML(['favoritesList', 'favsList'], '<div class="empty">برای مشاهده علاقه‌مندی‌ها وارد شوید.</div>');
    setHTML(['notifBody', 'notificationsBody'], '<tr><td colspan="4">برای مشاهده اعلان‌ها وارد شوید.</td></tr>');
    setHTML(['notificationsList', 'notifList'], '<div class="empty">برای مشاهده اعلان‌ها وارد شوید.</div>');
    setHTML(['shoppingList', 'shopList', 'shoppingBox'], '<div class="empty">برای مشاهده لیست خرید وارد شوید.</div>');
    setHTML(['proStatus', 'proBadge', 'subStatus'], '<span class="pbadge" style="background:#777">نیاز به ورود</span>');
  }

  function bindTabs() {
    qsa('[data-ut], .uaside button, .user-aside button, .dash-tabs button').forEach(function (b) {
      if (b.dataset.boundUserTab) return;
      b.dataset.boundUserTab = '1';
      b.onclick = function () {
        var t = b.dataset.ut || b.dataset.t || b.getAttribute('data-tab');
        if (!t) return;
        qsa('[data-ut], .uaside button, .user-aside button, .dash-tabs button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        qsa('.upane, .user-pane, .dash-pane').forEach(function (p) {
          p.style.display = (p.id === 'pane-' + t || p.dataset.pane === t) ? 'block' : 'none';
        });
      };
    });
  }

  async function loadProfileAndPro(user) {
    var email = user && user.email ? user.email : '';
    var name = (user && user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
    var profile = null;
    var activePro = false;
    var proUntil = null;

    await safe('profile direct', async function () {
      if (!sb || !user || !user.id) return;
      var pr = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!pr.error && pr.data) profile = pr.data;
    });
    if (profile) {
      name = profile.name || profile.full_name || profile.display_name || name;
      if (profile.email) email = profile.email;
    }
    await safe('pro status', async function () {
      if (!sb || !user || !user.id) return;
      var now = new Date();
      var sub = await sb.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'ACTIVE').order('end_date', { ascending: false }).limit(5);
      if (!sub.error && Array.isArray(sub.data)) {
        sub.data.forEach(function (s) {
          if (!s.end_date || new Date(s.end_date) > now) { activePro = true; if (s.end_date) proUntil = s.end_date; }
        });
      }
      var ent = await sb.from('entitlements').select('*').eq('user_id', user.id).eq('entitlement_type', 'PRO').eq('status', 'ACTIVE').order('expires_at', { ascending: false }).limit(5);
      if (!ent.error && Array.isArray(ent.data)) {
        ent.data.forEach(function (e) {
          if (!e.expires_at || new Date(e.expires_at) > now) { activePro = true; if (e.expires_at) proUntil = e.expires_at; }
        });
      }
    });

    setText(['userEmail', 'uEmail', 'dashEmail'], email || '—');
    setText(['userName', 'uName', 'dashName'], name || email || 'کاربر');
    setHTML(['proStatus', 'proBadge', 'subStatus'], '<span class="pbadge" style="background:' + (activePro ? '#2d6a35' : '#777') + '">' + (activePro ? 'PRO فعال' : 'رایگان') + '</span>' + (proUntil ? ' <small>تا ' + faDate(proUntil) + '</small>' : ''));
    setHTML(['userStat', 'dashStat', 'dashboardStat'], '<div class="sc"><b>' + esc(name || email || 'کاربر') + '</b><span>حساب کاربری</span></div><div class="sc"><b>' + (activePro ? 'PRO' : 'Free') + '</b><span>وضعیت اشتراک</span></div>');
  }

  async function loadAIUsage() {
    var html = '<div class="empty">مصرف هوش مصنوعی: —</div>';
    await safe('ai usage', async function () {
      var r = await apiPlain('/api/ai');
      if (!r.ok) r = await apiPlain('/api/mealplan');
      if (!r.ok) return;
      var j = await r.json();
      var used = Number(j.used || 0);
      var limit = Number(j.limit || 0);
      var pro = !!j.pro;
      html = '<div class="sc"><b>' + faN(used) + ' / ' + faN(limit) + '</b><span>مصرف برنامه هوشمند ' + (pro ? 'PRO' : 'رایگان') + '</span></div>';
    });
    setHTML(['aiUsage', 'aiUsageCard', 'aiStat'], html);
  }

  async function loadOrders(user) {
    var rows = [];
    await safe('orders api', async function () {
      var r = await apiDb('my_orders');
      if (r.ok) { var j = await r.json(); rows = Array.isArray(j) ? j : (j.rows || []); }
    });
    if (!rows.length) {
      await safe('orders direct', async function () {
        if (!sb || !user || !user.id) return;
        var r = await sb.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
        if (!r.error && Array.isArray(r.data)) rows = r.data;
      });
    }
    var body = rows.map(function (o) {
      return '<tr><td>#' + esc(o.id) + '</td><td>' + faDate(o.created_at) + '</td><td>' + esc(o.product || o.product_title || o.title || '—') + '</td><td>' + (o.total ? rialFa(o.total) : '—') + '</td><td>' + esc(o.status || '—') + '</td><td>' + esc(o.payment_method || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="8">هنوز سفارشی ثبت نشده است.</td></tr>';
    setHTML(['ordersBody', 'myOrdersBody'], body);
    setHTML(['ordersList', 'myOrders'], rows.length ? '<div class="ubox">' + rows.slice(0, 5).map(function (o) {
      return '<p>#' + esc(o.id) + ' — ' + esc(o.product || o.product_title || o.title || 'سفارش') + ' — ' + faDate(o.created_at) + '</p>';
    }).join('') + '</div>' : '<div class="empty">هنوز سفارشی ثبت نشده است.</div>');
  }

  async function loadProducts(user) {
    var rows = [];
    await safe('products api', async function () {
      var r = await apiDb('my_products');
      if (r.ok) { var j = await r.json(); rows = Array.isArray(j) ? j : (j.rows || []); }
    });
    if (!rows.length) {
      await safe('products direct', async function () {
        if (!sb || !user || !user.id) return;
        var r = await sb.from('entitlements').select('*,products(*)').eq('user_id', user.id).eq('entitlement_type', 'PRODUCT').eq('status', 'ACTIVE').order('created_at', { ascending: false });
        if (!r.error && Array.isArray(r.data)) rows = r.data;
      });
    }
    var body = rows.map(function (e) {
      var p = e.products || e.product || e;
      var title = p.title_fa || p.title || e.title || 'محصول';
      var file = p.file_path || e.file_path || '';
      var dl = file ? '<a class="btn small" href="/api/db?t=file_url&path=' + encodeURIComponent(file) + '" target="_blank" rel="noopener">دانلود</a>' : '—';
      return '<tr><td>' + esc(title) + '</td><td>' + faDate(e.created_at) + '</td><td>' + faDate(e.expires_at) + '</td><td>' + esc(e.status || 'ACTIVE') + '</td><td>' + dl + '</td></tr>';
    }).join('') || '<tr><td colspan="6">محصول فعالی نداری.</td></tr>';
    setHTML(['productsBody', 'myProductsBody'], body);
    setHTML(['productsList', 'myProducts'], rows.length ? '<div class="ubox">' + rows.map(function (e) {
      var p = e.products || e.product || e;
      return '<p>' + esc(p.title_fa || p.title || e.title || 'محصول') + ' — تا ' + faDate(e.expires_at) + '</p>';
    }).join('') + '</div>' : '<div class="empty">محصول فعالی نداری.</div>');
  }

  function mealFa(t) {
    var m = { breakfast: 'صبحانه', snack_am: 'میان‌وعده صبح', lunch: 'ناهار', snack_pm: 'میان‌وعده عصر', dinner: 'شام', snack: 'میان‌وعده' };
    return m[t] || t || 'وعده';
  }

  async function loadDietPlans(user) {
    var rows = [];
    await safe('diet plans api', async function () {
      var r = await apiDb('my_diet_plans');
      if (r.ok) { var j = await r.json(); rows = Array.isArray(j) ? j : (j.rows || []); }
    });
    if (!rows.length) {
      await safe('diet plans direct', async function () {
        if (!sb || !user || !user.id) return;
        var r = await sb.from('diet_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (!r.error && Array.isArray(r.data)) rows = r.data;
      });
    }
    lastDietPlans = rows || [];
    var html = (rows || []).map(function (p) {
      var pdf = p.pdf_path ? '<a class="btn small" href="/api/db?t=file_url&path=' + encodeURIComponent(p.pdf_path) + '" target="_blank" rel="noopener">دانلود PDF</a>' : '';
      var view = '<button class="btn small viewDiet" data-id="' + esc(p.id) + '">مشاهده</button>';
      return '<div class="ubox" style="margin:8px 0;padding:12px"><b>' + esc(p.title || 'برنامه غذایی') + '</b> <small>— ' + faDate(p.created_at) + '</small><br><span>' + esc(p.goal || '') + '</span><br>' + view + ' ' + pdf + '</div>';
    }).join('') || '<div class="empty">هنوز برنامه غذایی برای تو ثبت نشده است.</div>';
    setHTML(['dietPlans', 'dietList', 'mealPlans', 'mealPlanList'], html);
    qsa('.viewDiet').forEach(function (b) {
      b.onclick = function () { loadDietDetail(b.dataset.id); };
    });
  }

  async function loadDietDetail(id) {
    if (!id) return;
    var det = lastDietDetails[id] || null;
    await safe('diet detail', async function () {
      if (det) return;
      var r = await apiDb('my_diet_detail&id=' + encodeURIComponent(id));
      if (r.ok) det = await r.json();
    });
    if (!det) {
      await safe('diet detail direct', async function () {
        if (!sb) return;
        var p = await sb.from('diet_plans').select('*').eq('id', id).maybeSingle();
        var d = await sb.from('diet_plan_days').select('*,diet_plan_meals(*)').eq('plan_id', id).order('day_number', { ascending: true });
        if (!p.error && p.data) det = { plan: p.data, days: d && !d.error ? d.data : [] };
      });
    }
    if (!det) return;
    lastDietDetails[id] = det;
    renderDietDetail(det);
    buildShoppingFromDiet(det);
  }

  function renderDietDetail(det) {
    var plan = det.plan || {};
    var days = det.days || [];
    var html = '<div class="ubox"><h3>' + esc(plan.title || 'برنامه غذایی') + '</h3>';
    if (plan.pdf_path) html += '<p><a class="btn small" href="/api/db?t=file_url&path=' + encodeURIComponent(plan.pdf_path) + '" target="_blank" rel="noopener">دانلود PDF</a></p>';
    if (plan.restrictions_text) html += '<p><b>محدودیت‌ها:</b><br>' + esc(plan.restrictions_text).replace(/\n/g, '<br>') + '</p>';
    if (plan.tips_text) html += '<p><b>نکات:</b><br>' + esc(plan.tips_text).replace(/\n/g, '<br>') + '</p>';
    if (plan.activity_text) html += '<p><b>فعالیت:</b><br>' + esc(plan.activity_text).replace(/\n/g, '<br>') + '</p>';
    days.forEach(function (d) {
      html += '<div class="day-card"><div class="day-head"><b>روز ' + faN(d.day_number) + '</b></div>';
      (d.diet_plan_meals || d.meals || []).forEach(function (m) {
        html += '<div class="meal-line"><b>' + esc(mealFa(m.meal_type)) + '</b><span>' + esc(m.title || '—') + '</span><small>' + esc(m.portion || '') + '</small></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    setHTML(['dietDetail', 'mealPlanDetail', 'planDetail'], html);
  }

  async function loadAllRecipes() {
    await safe('all recipes', async function () {
      var r = await fetch('/api/db?t=all');
      if (r.ok) { var j = await r.json(); allRecipes = Array.isArray(j) ? j : []; }
    });
  }

  async function buildShoppingFromDiet(det) {
    if (!allRecipes.length) await loadAllRecipes();
    var recipeById = {};
    allRecipes.forEach(function (r) { if (r.id != null) recipeById[r.id] = r; });
    var shop = {};
    var days = det && det.days ? det.days : [];
    days.forEach(function (d) {
      (d.diet_plan_meals || d.meals || []).forEach(function (m) {
        var r = m.recipe_id != null ? recipeById[m.recipe_id] : null;
        (r && r.ingredients ? r.ingredients : []).forEach(function (i) {
          if (!i.fa) return;
          var k = String(i.fa).trim().toLowerCase();
          if (!shop[k]) shop[k] = { fa: i.fa, count: 0, qs: [] };
          shop[k].count++;
          var q = (i.q || '').trim();
          if (q && q !== 'به‌اندازه' && shop[k].qs.indexOf(q) === -1) shop[k].qs.push(q);
        });
      });
    });
    renderShopping(Object.values(shop).sort(function (a, b) { return b.count - a.count; }));
  }

  async function loadShopping() {
    var latest = lastDietPlans && lastDietPlans.length ? lastDietPlans[0] : null;
    if (latest && latest.id) { await loadDietDetail(latest.id); return; }
    renderShopping([]);
  }

  function renderShopping(items) {
    var html = items && items.length ? '<div class="shop-card"><h3>لیست خرید</h3><ul>' + items.map(function (s) {
      return '<li>• ' + esc(s.fa) + ' <small>(' + faN(s.count) + ' رسپی)' + (s.qs && s.qs.length ? ' — ' + esc(s.qs.join('، ')) : '') + '</small></li>';
    }).join('') + '</ul></div>' : '<div class="empty">برای ساخت لیست خرید، یک برنامه غذایی دارای رسپی لازم است.</div>';
    setHTML(['shoppingList', 'shopList', 'shoppingBox'], html);
  }

  async function loadFavorites(user) {
    var rows = [];
    await safe('favorites api', async function () {
      var r = await apiDb('favorites');
      if (r.ok) { var j = await r.json(); rows = Array.isArray(j) ? j : (j.rows || []); }
    });
    if (!rows.length) {
      await safe('favorites direct', async function () {
        if (!sb || !user || !user.id) return;
        var r = await sb.from('favorites').select('*,recipes(*)').eq('user_id', user.id).order('created_at', { ascending: false });
        if (!r.error && Array.isArray(r.data)) rows = r.data;
      });
    }
    var body = rows.map(function (f) {
      var r = f.recipes || f.recipe || f;
      var title = r.name_fa || r.title || f.title || 'رسپی';
      var slug = r.slug || f.slug || '';
      return '<tr><td>' + esc(title) + '</td><td>' + faDate(f.created_at) + '</td><td>' + (slug ? '<a class="btn small" href="recipe.html?slug=' + esc(slug) + '">مشاهده</a>' : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="5">هنوز علاقه‌مندی ثبت نشده است.</td></tr>';
    setHTML(['favBody', 'favoritesBody'], body);
    setHTML(['favoritesList', 'favsList'], rows.length ? '<div class="ubox">' + rows.slice(0, 10).map(function (f) {
      var r = f.recipes || f.recipe || f;
      return '<p>' + esc(r.name_fa || r.title || f.title || 'رسپی') + '</p>';
    }).join('') + '</div>' : '<div class="empty">هنوز علاقه‌مندی ثبت نشده است.</div>');
  }

  async function loadNotifications(user) {
    var rows = [];
    await safe('notifications api', async function () {
      var r = await apiDb('notifications');
      if (r.ok) { var j = await r.json(); rows = Array.isArray(j) ? j : (j.rows || []); }
    });
    if (!rows.length) {
      await safe('notifications direct', async function () {
        if (!sb || !user || !user.id) return;
        var r = await sb.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
        if (!r.error && Array.isArray(r.data)) rows = r.data;
      });
    }
    var body = rows.map(function (n) {
      return '<tr><td>' + esc(n.title || 'اعلان') + '</td><td>' + esc(n.body || n.message || '') + '</td><td>' + faDate(n.created_at) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">اعلانی نداری.</td></tr>';
    setHTML(['notifBody', 'notificationsBody'], body);
    setHTML(['notificationsList', 'notifList'], rows.length ? '<div class="ubox">' + rows.slice(0, 8).map(function (n) {
      return '<p><b>' + esc(n.title || 'اعلان') + '</b><br><small>' + esc(n.body || n.message || '') + '</small></p>';
    }).join('') + '</div>' : '<div class="empty">اعلانی نداری.</div>');
  }

  async function main(user) {
    if (!user || !user.id) { renderLoggedOut(); return; }
    if (mainStarted && currentUser && currentUser.id === user.id) return;
    mainStarted = true;
    currentUser = user;
    bindTabs();
    bindLogoutButtons();

    await safe('profile/pro', function () { return loadProfileAndPro(user); });
    await Promise.all([
      safe('ai', loadAIUsage),
      safe('orders', function () { return loadOrders(user); }),
      safe('products', function () { return loadProducts(user); }),
      safe('diet plans', function () { return loadDietPlans(user); }),
      safe('favorites', function () { return loadFavorites(user); }),
      safe('notifications', function () { return loadNotifications(user); }),
      safe('recipes preload', loadAllRecipes)
    ]);
    await safe('shopping', loadShopping);
  }

  async function boot() {
    if (booted) return;
    booted = true;
    var ok = await waitForSB();
    if (!ok) { renderLoggedOut(); return; }
    bindAuthWatcher();
    bindLogoutButtons();
    var sess = await waitAuthReady();
    if (sess && sess.user) {
      authReady = true;
      await main(sess.user);
    } else {
      renderLoggedOut();
    }
  }

  boot();
})();
