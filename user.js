(async function () {
  if (document.body.dataset.page !== 'user') return;

  var sb = null, USER = null, started = false, authReady = false;
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function faN(n) { return (Number(n) || 0).toLocaleString('fa-IR'); }
  function faDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('fa-IR'); } catch (e) { return '—'; } }
  function safe(name, fn) {
    return Promise.resolve().then(fn).catch(function (e) { console.error('user section error (' + name + '):', e); return null; });
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
  async function raw(url, opts) {
    var t = await tok();
    var headers = { 'Content-Type': 'application/json' };
    if (t) { headers.Authorization = 'Bearer ' + t; headers['X-Supabase-Auth'] = t; }
    return fetch(url, Object.assign({ headers: headers }, opts || {}));
  }
  async function api(t, opts) { return raw('/api/db?t=' + t, opts); }

  async function openPdf(urls) {
    for (var i = 0; i < urls.length; i++) {
      if (!urls[i]) continue;
      try {
        var r = await raw(urls[i]);
        var j = {};
        try { j = await r.json(); } catch (e) {}
        if (r.ok && j.url) { window.open(j.url, '_blank'); return true; }
      } catch (e) {}
    }
    alert('خطا در دانلود PDF. اگر مشکل ادامه داشت، پشتیبانی اطلاع بده.');
    return false;
  }

  function showLogin() {
    var ub = $('userBody'); if (ub) ub.style.display = 'none';
    var ul = $('uLogin'); if (ul) ul.style.display = 'block';
    var b = $('uLoginBtn');
    if (b && !b.dataset.bound) {
      b.dataset.bound = '1';
      b.onclick = function () { if (window.DFB && DFB.sb) DFB.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/user.html' } }); };
    }
  }

  async function waitAuth() {
    for (var i = 0; i < 35; i++) {
      var s = await getSessionSafe();
      if (s && s.user) return s.user;
      if (authReady) return null;
      await new Promise(function (r) { setTimeout(r, 150); });
    }
    var s2 = await getSessionSafe();
    return s2 ? s2.user : null;
  }

  async function main(user) {
    USER = user;
    var ub = $('userBody'); if (ub) ub.style.display = 'block';
    var ul = $('uLogin'); if (ul) ul.style.display = 'none';
    var st = $('userStat'); if (st) st.textContent = user.email || '';

    var name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || '').split('@')[0];
    var ava = $('uAva'); if (ava) ava.textContent = String(name || 'D').charAt(0).toUpperCase();
    var wel = $('uWelcome'); if (wel) wel.textContent = 'سلام ' + name + '، امروز هم به قدم به سبک زندگی سالم نزدیک‌تر.';

    await safe('profile', async function () {
      var d = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      var p = (!d.error && d.data) ? d.data : {};
      var un = $('uName'); if (un) un.textContent = p.name || name || '—';
      var ue = $('uEmail'); if (ue) ue.textContent = p.email || user.email || '—';
      var up = $('uPhone'); if (up) up.textContent = p.phone || '—';
      var pe = $('phEdit');
      if (pe && !pe.dataset.bound) {
        pe.dataset.bound = '1';
        pe.onclick = async function () {
          var v = prompt('شماره موبایل (مثل 09123456789):', p.phone || '');
          if (!v) return;
          if (!/^09[0-9]{9}$/.test(v.trim())) { alert('شماره معتبر نیست'); return; }
          await sb.from('profiles').update({ phone: v.trim() }).eq('id', user.id);
          var up2 = $('uPhone'); if (up2) up2.textContent = v.trim();
        };
      }
    });

    var ent = {};
    await safe('entitlements', async function () {
      var r = await api('my_entitlements');
      if (r.ok) ent = await r.json();
    });

    await safe('pro card', function () {
      var badge = $('uProBadge');
      var proCard = $('uProCard');
      if (ent.pro) {
        var days = ent.pro_expires ? Math.max(0, Math.ceil((new Date(ent.pro_expires) - new Date()) / 86400000)) : null;
        if (badge) badge.innerHTML = '<span class="u-pro-badge">PRO فعال</span>';
        if (proCard) proCard.innerHTML = '<div class="big">PRO فعال است</div><p style="font-size:12px;color:#667;margin-top:8px">' + (days != null ? faN(days) + ' روز تا پایان اشتراک' : 'بدون انقضا') + '</p><a class="btn ghost small" href="pro.html" style="margin-top:10px">مدیریت اشتراک</a>';
      } else {
        if (badge) badge.innerHTML = '<span class="u-pro-badge" style="background:#e8f4e9;color:#2d6a35">پلان رایگان</span>';
        if (proCard) proCard.innerHTML = '<div class="big">FREE</div><p style="font-size:12px;color:#667;margin-top:8px">با PRO، برنامه شخصی، ذخیره نامحدود و لیست خرید هوشمند باز می‌شود.</p><a class="btn small" href="pro.html" style="margin-top:10px">ارتقا به PRO</a>';
      }
    });

    await safe('vs', function () {
      var vs = $('uVs');
      if (vs) vs.innerHTML = '<div class="free"><h4>پلان رایگان</h4><ul><li>مشاهده همه رسپی‌ها</li><li>برنامه غذایی پایه (پلنر)</li><li>یخچال‌یاب (Ingredient Finder)</li><li>ذخیره تا ۱۰ رسپی</li><li>۵ پاسخ دستیار AI در ماه</li></ul></div><div class="pro"><h4>PRO</h4><ul><li>ذخیره نامحدود رسپی</li><li>لیست خرید هوشمند</li><li>برنامه غذایی اختصاصی از ادمین</li><li>PDF حرفه‌ای رژیم</li><li>۱۰۰ پاسخ دستیار AI در ماه</li></ul>' + (ent.pro ? '' : '<a class="btn" href="pro.html" style="margin-top:12px">ارتقا به PRO</a>') + '</div>';
    });

    await safe('products', function () {
      var el = $('uProducts');
      if (!el) return;
      var prods = ent.products || [];
      el.innerHTML = prods.length ? prods.map(function (p) {
        var fp = (p.products && p.products.file_path) || p.file_path || '';
        return '<div><b>' + esc(p.products ? p.products.title_fa : (p.title_fa || 'محصول')) + '</b><br><small>خرید: ' + faDate(p.granted_at) + (p.expires_at ? ' — تا ' + faDate(p.expires_at) : '') + '</small><br><a class="dl-btn" data-e="' + esc(p.id) + '" data-path="' + esc(fp) + '" href="#">دانلود</a></div>';
      }).join('') : '<div class="u-empty">هنوز محصولی نخریدی — <a href="market.html">فیت مارکت</a></div>';
      el.querySelectorAll('.dl-btn').forEach(function (a) {
        a.onclick = async function (e) {
          e.preventDefault();
          var ok = false;
          var r = await api('download', { method: 'POST', body: JSON.stringify({ entitlement_id: +a.dataset.e }) });
          var j = {};
          try { j = await r.json(); } catch (err) {}
          if (r.ok && j.url) { window.open(j.url, '_blank'); ok = true; }
          if (!ok && a.dataset.path) ok = await openPdf(['/api/db?t=file_url&path=' + encodeURIComponent(a.dataset.path)]);
          if (!ok) alert(j.error === 'entitlement expired' ? 'دسترسی این محصول منقضی شده.' : 'خطا در دانلود فایل.');
        };
      });
    });

    await safe('diets', async function () {
      var el = $('uDiets');
      if (!el) return;
      var r = await api('my_diet_plans');
      var diets = r.ok ? await r.json() : [];
      if (!Array.isArray(diets)) diets = [];
      el.innerHTML = diets.length ? diets.map(function (d) {
        return '<div><b>' + esc(d.title || 'برنامه غذایی') + '</b> — ' + esc(d.status === 'published' ? 'منتشر شده' : 'پیش‌نویس') + '<br><small>هدف: ' + esc(d.goal || '—') + ' | کالری: ' + faN(d.kcal_target || 0) + '</small><br>' + (d.pdf_path ? '<a class="dl-btn dl-pdf" data-d="' + esc(d.id) + '" data-path="' + esc(d.pdf_path) + '" href="#">دانلود PDF</a>' : '<small>در انتظار PDF</small>') + '</div>';
      }).join('') : '<div class="u-empty">هنوز برنامه غذایی نداری. با PRO، ادمین برات برنامه اختصاصی می‌سازد.</div>';
      el.querySelectorAll('.dl-pdf').forEach(function (a) {
        a.onclick = function (e) {
          e.preventDefault();
          openPdf(['/api/dietpdf?id=' + encodeURIComponent(a.dataset.d), '/api/db?t=file_url&path=' + encodeURIComponent(a.dataset.path)]);
        };
      });
    });

    await safe('orders', async function () {
      var el = $('myOrders');
      if (!el) return;
      var r = await api('my_orders');
      var o = r.ok ? await r.json() : [];
      if (!Array.isArray(o)) o = [];
      el.innerHTML = o.length ? o.map(function (x) {
        return '<div>#' + esc(x.id) + ' — ' + esc(x.product || 'سفارش') + ' <small>(' + esc(x.status || '') + ')</small> <small>' + faDate(x.created_at) + '</small></div>';
      }).join('') : '<div class="u-empty">هنوز سفارشی نداری</div>';
    });

    await safe('favs', async function () {
      var el = $('myFavs');
      if (!el) return;
      var r = await api('my_favs');
      var f = r.ok ? await r.json() : [];
      if (!Array.isArray(f)) f = [];
      if (f.length) {
        var all = await (await fetch('/api/db?t=all')).json();
        el.innerHTML = f.map(function (x) {
          var rec = (Array.isArray(all) ? all : []).find(function (a) { return a.slug === x.recipe_slug; });
          return rec ? '<div><a href="recipe.html?slug=' + esc(rec.slug) + '">' + esc(rec.name_fa) + '</a></div>' : '';
        }).join('') || '<div class="u-empty">هنوز رسپی ذخیره نکردی</div>';
      } else el.innerHTML = '<div class="u-empty">هنوز رسپی ذخیره نکردی</div>';
    });

    await safe('notifs', async function () {
      var el = $('uNotifs');
      if (!el) return;
      var r = await api('my_notifications');
      var n = r.ok ? await r.json() : [];
      if (!Array.isArray(n)) n = [];
      el.innerHTML = n.length ? n.map(function (x) {
        return '<div><b>' + esc(x.title || 'اعلان') + '</b><br><small>' + esc(x.body || '') + '</small><br><small style="color:#98a298">' + faDate(x.created_at) + '</small></div>';
      }).join('') : '<div class="u-empty">اعلانی نداری</div>';
    });

    await safe('shopping', async function () {
      var el = $('uList');
      if (!el) return;
      if (ent.pro) {
        var r = await api('my_list');
        var cur = r.ok ? await r.json() : [];
        var items = Array.isArray(cur) && cur[0] && cur[0].items ? cur[0].items : [];
        el.innerHTML = '<textarea id="slItems" style="width:100%;height:110px;border-radius:12px;border:1px solid #ccc;padding:10px;font:inherit;font-size:13px" placeholder="هر خط یک قلم خرید...">' + esc((items || []).join('\n')) + '</textarea><button class="btn small" id="slSave" style="margin-top:8px">ذخیره لیست</button>';
        var sv2 = $('slSave');
        if (sv2) sv2.onclick = async function () {
          var arr = $('slItems').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          await api('save_list', { method: 'POST', body: JSON.stringify({ items: arr }) });
          alert('ذخیره شد');
        };
      } else {
        el.innerHTML = '<div class="u-empty">لیست خرید هوشمند مخصوص PRO است.<br><a class="btn small" href="pro.html" style="margin-top:8px">ارتقا به PRO</a></div>';
      }
    });

    await safe('ai usage', async function () {
      var el = $('uAi');
      if (!el) return;
      var t = await tok();
      if (!t) { el.textContent = '—'; return; }
      var r = await fetch('/api/ai', { headers: { 'X-Supabase-Auth': t, Authorization: 'Bearer ' + t } });
      if (!r.ok) { el.textContent = '—'; return; }
      var j = await r.json();
      el.innerHTML = '<div class="big" style="font-size:16px">' + faN(j.used) + ' از ' + faN(j.limit) + '</div><p style="font-size:12px;color:#667;margin-top:6px">پاسخ ' + (j.pro ? 'PRO' : 'رایگان') + ' این ماه استفاده شده</p>';
    });
  }

  var t0 = setInterval(async function () {
    if (started || !window.DFB || !DFB.sb) return;
    started = true;
    clearInterval(t0);
    sb = DFB.sb;
    try {
      sb.auth.onAuthStateChange(function (ev, sess) {
        if (ev === 'INITIAL_SESSION') authReady = true;
        if (ev === 'SIGNED_OUT') { authReady = true; USER = null; showLogin(); }
        if (ev === 'SIGNED_IN' && sess && sess.user && !USER) main(sess.user);
      });
    } catch (e) { authReady = true; }
    var user = await waitAuth();
    if (user) await main(user);
    else showLogin();
  }, 400);
})();
