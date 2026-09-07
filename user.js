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
    return Promise.resolve().then(fn).catch(function (e) { console.error('user section error (' + name + '):', e); return null; }
    );
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
    var wel = $('uWelcome'); if (wel) wel.textContent = 'سلام ' + name + '، خوش آمدی.';

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
        if (proCard) proCard.innerHTML = '<div class="big">PRO فعال است</div><p style="font-size:12px;color:#667;margin-top:8px">' + (days != null ? faN(days) + ' روز تا پایان اشتراک' : 'بدون انقضا') + '</p><a class="btn ghost small" href="pro.html">مدیریت اشتراک</a>';
      } else {
        if (badge) badge.innerHTML = '<span class="u-pro-badge" style="background:#e8f4e9;color:#2d6a35">پلان رایگان</span>';
        if (proCard) proCard.innerHTML = '<div class="big">FREE</div><p style="font-size:12px;color:#667;margin-top:8px">با PRO، برنامه شخصی، ذخیره نامحدود و لیست خرید هوشمند باز می‌شود.</p><a class="btn small" href="pro.html">ارتقا به PRO</a>';
      }
    });

    await safe('vs', function () {
      var vs = $('uVs');
      if (vs) vs.innerHTML = '<div class="vs-free"><h4>پلان رایگان</h4><ul><li>مشاهده همه رسپی‌ها</li><li>برنامه غذایی پایه (پلنر)</li><li>یخچال‌یاب (Ingredient Finder)</li><li>ذخیره تا ۱۰ رسپی</li><li>۵ پاسخ دستیار AI در ماه</li></ul></div><div class="vs-pro"><h4>PRO</h4><ul><li>ذخیره نامحدود رسپی</li><li>لیست خرید هوشمند</li><li>برنامه غذایی اختصاصی از ادمین</li><li>PDF حرفه‌ای رژیم</li><li>۱۰۰ پاسخ دستیار AI در ماه</li></ul>' + (ent.pro ? '' : '<a class="btn" href="pro.html">ارتقا به PRO</a>') + '</div>';
    });

    await safe('ai usage', async function () {
      var el = $('uAi');
      if (!el) return;
      var t = await tok();
      if (!t) { el.innerHTML = '<div class="u-empty">نیاز به ورود</div>'; return; }
      var r = await fetch('/api/ai', { headers: { 'X-Supabase-Auth': t, Authorization: 'Bearer ' + t } });
      if (!r.ok) { el.innerHTML = '<div class="u-empty">—</div>'; return; }
      var j = await r.json();
      el.innerHTML = '<div class="big">' + faN(j.used) + ' از ' + faN(j.limit) + '</div><p style="font-size:12px;color:#667;margin-top:6px">پاسخ ' + (j.pro ? 'PRO' : 'رایگان') + ' این ماه استفاده شده</p>';
    });

    await safe('products', function () {
      var el = $('uProducts');
      if (!el) return;
      var prods = ent.products || [];
      el.innerHTML = prods.length ? prods.map(function (p) {
        var fp = (p.products && p.products.file_path) || p.file_path || '';
        return '<div class="u-item"><b>' + esc(p.products ? p.products.title_fa : (p.title_fa || 'محصول')) + '</b><br><small>خرید: ' + faDate(p.granted_at) + (p.expires_at ? ' — تا ' + faDate(p.expires_at) : '') + '</small><br><a class="dl-btn" data-e="' + esc(p.id) + '" data-path="' + esc(fp) + '" href="#">دانلود</a></div>';
      }).join('') : '<div class="u-photo"><img src="img/market-hero.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\'"><span><b>هنوز محصولی نخریدی</b><small>پک‌ها و برنامه‌های دیجیتال — دانلود آنی بعد از خرید</small><a href="market.html">رفتن به فیت مارکت</a></span></div>';
      el.querySelectorAll('.dl-btn').forEach(function (a) {
        if (a.dataset.boundDl) return;
        a.dataset.boundDl = '1';
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
        return '<div class="u-item"><b>' + esc(d.title || 'برنامه غذایی') + '</b> — ' + esc(d.status === 'published' ? 'منتشر شده' : 'پیش‌نویس') + '<br><small>هدف: ' + esc(d.goal || '—') + ' | کالری: ' + faN(d.kcal_target || 0) + '</small><br>' + (d.pdf_path ? '<a class="dl-btn dl-pdf" data-d="' + esc(d.id) + '" data-path="' + esc(d.pdf_path) + '" href="#">دانلود PDF</a>' : '<small>در انتظار PDF</small>') + '</div>';
      }).join('') : '<div class="u-photo"><img src="img/u-empty-plan.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\'"><span><b>هنوز برنامه غذایی نداری</b><small>با استودیو تغذیه خودت بساز، یا با PRO اختصاصی بگیر</small><a href="planner.html">ساخت برنامه</a></span></div>';
      el.querySelectorAll('.dl-pdf').forEach(function (a) {
        if (a.dataset.boundPdf) return;
        a.dataset.boundPdf = '1';
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
        return '<div class="u-item">#' + esc(x.id) + ' — ' + esc(x.product || 'سفارش') + ' <small>(' + esc(x.status || '') + ')</small> <small>' + faDate(x.created_at) + '</small></div>';
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
          return rec ? '<div class="u-item"><a href="recipe.html?slug=' + esc(rec.slug) + '">' + esc(rec.name_fa) + '</a></div>' : '';
        }).join('') || '<div class="u-photo"><img src="img/u-empty-recipes.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\'"><span><b>هنوز رسپی ذخیره نکردی</b><small>روی هر رسپی قلب بزن تا اینجا ذخیره شود</small><a href="recipes.html">دیدن رسپی‌ها</a></span></div>';
      } else el.innerHTML = '<div class="u-photo"><img src="img/u-empty-recipes.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\'"><span><b>هنوز رسپی ذخیره نکردی</b><small>روی هر رسپی قلب بزن تا اینجا ذخیره شود</small><a href="recipes.html">دیدن رسپی‌ها</a></span></div>';
    });

    await safe('notifs', async function () {
      var el = $('uNotifs');
      if (!el) return;
      var r = await api('my_notifications');
      var n = r.ok ? await r.json() : [];
      if (!Array.isArray(n)) n = [];
      el.innerHTML = n.length ? n.map(function (x) {
        return '<div class="u-item' + (x.read ? '' : ' unread') + '"><b>' + esc(x.title || 'اعلان') + '</b><br><small>' + esc(x.body || '') + '</small><br><small style="color:#98a298">' + faDate(x.created_at) + '</small></div>';
      }).join('') : '<div class="u-empty">اعلانی نداری</div>';
      var nb = $('notifReadAll');
      if (nb && !nb.dataset.b) {
        nb.dataset.b = '1';
        nb.onclick = async function () { await api('notif_read', { method: 'POST', body: '{}' }); main(USER); };
      }
    });

    /* ───────── فاز ۴: استریک و نشان‌ها ───────── */
    await safe('streak', async function () {
      var el = $('uStreak');
      if (!el) return;
      var r = await api('streak');
      if (!r.ok) { el.innerHTML = '<div class="u-empty">برای استریک وارد شو</div>'; return; }
      var s = await r.json();
      var ch = s.current >= 7 ? 'چالش ۷ روزه را بردی! حالا برو سراغ ۱۴ روز' : 'چالش ۷ روزه: ' + Math.min(s.current, 7) + ' از ۷ روز';
      el.innerHTML = '<div class="streak-box"><span class="flame"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 23c-4.4 0-8-3.6-8-8 0-3.5 2-6.5 4-8.5.3 1.5 1 2.9 2.2 3.7C10.5 7 11.5 3.7 14 1c-.3 2.7.7 4.6 2 6.4 1.6 2.1 4 4.1 4 7.6 0 4.4-3.6 8-8 8z"/></svg></span><div><b>' + faN(s.current) + ' روز پیوسته</b><br><small>رکورد تو: ' + faN(s.best) + ' روز</small></div></div><small class="cm-hint">' + esc(ch) + '</small>';
      if (s.new_badges && s.new_badges.length) alert('نشان جدید گرفتی: ' + s.new_badges.join('، '));
    });

    await safe('badges', async function () {
      var el = $('uBadges');
      if (!el) return;
      var r = await api('badges');
      var arr = r.ok ? await r.json() : [];
      if (!Array.isArray(arr)) arr = [];
      var have = {};
      arr.forEach(function (b) { have[b.badge_key] = true; });
      var CATALOG = [
        { k: 'streak_3', t: '۳ روز پیوسته', i: 'M12 23c-4.4 0-8-3.6-8-8 0-3.5 2-6.5 4-8.5.3 1.5 1 2.9 2.2 3.7C10.5 7 11.5 3.7 14 1c-.3 2.7.7 4.6 2 6.4 1.6 2.1 4 4.1 4 7.6 0 4.4-3.6 8-8 8z' },
        { k: 'streak_7', t: '۷ روز پیوسته', i: 'M12 23c-4.4 0-8-3.6-8-8 0-3.5 2-6.5 4-8.5.3 1.5 1 2.9 2.2 3.7C10.5 7 11.5 3.7 14 1c-.3 2.7.7 4.6 2 6.4 1.6 2.1 4 4.1 4 7.6 0 4.4-3.6 8-8 8z' },
        { k: 'streak_14', t: '۱۴ روز پیوسته', i: 'M11 21h-1l1-7H7.5c-.6 0-.6-.4-.4-.7L13 3h1l-1 7h3.5c.5 0 .7.3.4.8L11 21z' },
        { k: 'streak_30', t: '۳۰ روز پیوسته', i: 'M2 19h20v-2H2v2zm2-4l-2-9 5.5 3L12 3l4.5 6L22 6l-2 9H4z' },
        { k: 'first_comment', t: 'اولین نظر', i: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z' },
        { k: 'fav_10', t: '۱۰ ذخیره', i: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
        { k: 'referred', t: 'با دعوت آمدم', i: 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.7 0-1 .1a4.2 4.2 0 0 1 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z' },
        { k: 'referral_5', t: 'دعوت‌گر طلایی', i: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17l-6.1 3.6 1.4-6.8L2.2 9.1l6.9-.8L12 2z' },
        { k: 'referral_10', t: 'سفیر دیلی‌بیت', i: 'M18 5V2H6v3H2v3a5 5 0 0 0 4.6 5A6 6 0 0 0 11 16.9V19H8v3h8v-3h-3v-2.1A6 6 0 0 0 17.4 13 5 5 0 0 0 22 8V5h-4zM4 8V7h2v3.8A3 3 0 0 1 4 8zm16 0a3 3 0 0 1-2 2.8V7h2v1z' }
      ];
      el.innerHTML = CATALOG.map(function (b) {
        var on = !!have[b.k];
        return '<div class="badge' + (on ? ' on' : '') + '" title="' + esc(b.t) + (on ? '' : ' — هنوز قفل') + '"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + b.i + '"/></svg></span><small>' + esc(b.t) + '</small></div>';
      }).join('');
    });

    /* ───────── فاز ۴: تاریخچه بازدید ───────── */
    await safe('history', async function () {
      var el = $('uHistory');
      if (!el) return;
      var r = await api('my_history');
      var h = r.ok ? await r.json() : [];
      if (!Array.isArray(h)) h = [];
      if (!h.length) { el.innerHTML = '<div class="u-empty">هنوز رسپی‌ای ندیده‌ای</div>'; return; }
      var all = await (await fetch('/api/db?t=all')).json();
      var made = false, out = '';
      h.forEach(function (x) {
        var rec = (Array.isArray(all) ? all : []).find(function (a) { return a.slug === x.slug; });
        if (rec) { made = true; out += '<div class="u-item"><a href="recipe.html?slug=' + esc(rec.slug) + '">' + esc(rec.name_fa) + '</a> <small>' + faN(x.views) + ' بار</small></div>'; }
      });
      el.innerHTML = made ? out : '<div class="u-empty">هنوز رسپی‌ای ندیده‌ای</div>';
    });

    /* ───────── فاز ۴: نظرات من ───────── */
    await safe('comments', async function () {
      var el = $('uComments');
      if (!el) return;
      var r = await api('my_comments');
      var c = r.ok ? await r.json() : [];
      if (!Array.isArray(c)) c = [];
      var ST = { pending: 'در انتظار تأیید', approved: 'منتشر شد', rejected: 'رد شد' };
      el.innerHTML = c.length ? c.map(function (x) {
        return '<div class="u-item"><a href="recipe.html?slug=' + esc(x.recipe_slug) + '">' + esc(x.recipe_slug) + '</a> <small class="u-st u-st-' + esc(x.status) + '">' + (ST[x.status] || esc(x.status)) + '</small><br><small>' + esc(String(x.body || '').slice(0, 90)) + '</small></div>';
      }).join('') : '<div class="u-empty">هنوز نظری ثبت نکردی</div>';
    });

    /* ───────── فاز ۴: دعوت دوستان (رفرال) ───────── */
    await safe('referral', async function () {
      var el = $('uReferral');
      if (!el) return;
      var r = await api('referral_get');
      var j = r.ok ? await r.json() : null;
      if (!j || !j.code) { el.innerHTML = '<div class="u-empty">کد دعوت آماده نیست — بعداً دوباره بیا</div>'; return; }
      var url = location.origin + '/?ref=' + encodeURIComponent(j.code) + ' — یا کد ' + j.code;
      var prefill = '';
      try { prefill = localStorage.getItem('dfb-ref') || new URLSearchParams(location.search).get('ref') || ''; } catch (e) {}
      el.innerHTML = '<p style="font-size:12px;color:var(--ink-soft);margin:0 0 8px">این لینک/کد را برای دوستات بفرست؛ با اولین ورودشان شمارش بالا می‌رود:</p>' +
        '<div class="ref-box"><code>' + esc(url) + '</code><button class="dl-btn" id="refCopy">کپی</button></div>' +
        '<small class="cm-hint">' + faN(j.count) + ' دعوت موفق — در ۵ و ۱۰ دعوت نشان ویژه بگیر</small>' +
        '<div class="ref-apply"><input id="refApplyIn" placeholder="کد دعوت دوستت را بزن" maxlength="20" value="' + esc(prefill) + '"><button class="dl-btn" id="refApplyBtn">اعمال</button></div>';
      var cp = $('refCopy');
      cp.onclick = function () {
        try { navigator.clipboard.writeText(url); cp.textContent = 'کپی شد'; setTimeout(function () { cp.textContent = 'کپی'; }, 2000); } catch (e) { prompt('این را کپی کن:', url); }
      };
      var ab = $('refApplyBtn');
      if (ab) ab.onclick = async function () {
        var code = $('refApplyIn').value.trim();
        if (!code) { alert('کد را وارد کن'); return; }
        var res = await api('referral_apply', { method: 'POST', body: JSON.stringify({ code: code }) });
        var jj = await res.json().catch(function () { return {}; });
        alert(res.ok ? 'اعمال شد!' : (jj.error || 'خطا'));
        if (res.ok) { try { localStorage.removeItem('dfb-ref'); } catch (e) {} main(USER); }
      };
    });

    /* ───────── فاز ۴: تیکت پشتیبانی ───────── */
    await safe('tickets', async function () {
      var el = $('uTickets');
      if (!el) return;
      var r = await api('my_tickets');
      var arr = r.ok ? await r.json() : [];
      if (!Array.isArray(arr)) arr = [];
      var ST = { open: 'باز', answered: 'پاسخ داده شد', closed: 'بسته شد' };
      var html = '<div class="tk-new"><input id="tkSubject" placeholder="موضوع تیکت" maxlength="120"><textarea id="tkBody" placeholder="توضیح کامل سؤال یا مشکل…" maxlength="2000"></textarea><button class="btn small" id="tkSend">ارسال تیکت</button></div>';
      html += arr.length ? arr.map(function (x) {
        var reps = (x.replies || []).map(function (rp) {
          return '<div class="tk-reply' + (rp.is_admin ? ' admin' : '') + '"><b>' + esc(rp.author_name || '') + '</b><p>' + esc(rp.body) + '</p><small>' + faDate(rp.created_at) + '</small></div>';
        }).join('');
        return '<div class="u-item tk-item"><b>#' + esc(x.id) + ' — ' + esc(x.subject) + '</b> <small class="u-st u-st-tk">' + (ST[x.status] || esc(x.status)) + '</small><br><small>' + esc(x.body) + '</small><div class="tk-reps">' + reps + '</div>' + (x.status !== 'closed' ? '<div class="tk-ans"><input placeholder="پاسخ بنویس…" data-tid="' + esc(x.id) + '"><button class="dl-btn tk-send">ارسال</button></div>' : '') + '</div>';
      }).join('') : '<div class="u-empty">تیکتی نداری</div>';
      el.innerHTML = html;
      var snd = $('tkSend');
      if (snd && !snd.dataset.b) {
        snd.dataset.b = '1';
        snd.onclick = async function () {
          var s = $('tkSubject').value.trim(), b = $('tkBody').value.trim();
          if (s.length < 3 || b.length < 10) { alert('موضوع و متن را کامل کن (متن حداقل ۱۰ حرف)'); return; }
          snd.disabled = true;
          var res = await api('ticket_new', { method: 'POST', body: JSON.stringify({ subject: s, body: b }) });
          var j = await res.json().catch(function () { return {}; });
          if (res.ok) { alert('تیکت ثبت شد #' + (j.id || '')); main(USER); } else alert(j.error || 'خطا');
          snd.disabled = false;
        };
      }
      el.querySelectorAll('.tk-send').forEach(function (btn) {
        if (btn.dataset.b) return;
        btn.dataset.b = '1';
        btn.onclick = async function () {
          var inp = btn.parentElement.querySelector('input');
          var tid = Number(inp.getAttribute('data-tid')), body = inp.value.trim();
          if (body.length < 2) return;
          var res = await api('ticket_reply', { method: 'POST', body: JSON.stringify({ ticket_id: tid, body: body }) });
          var j = await res.json().catch(function () { return {}; });
          if (res.ok) main(USER); else alert(j.error || 'خطا');
        };
      });
    });

    await safe('shopping', async function () {
      var el = $('uList');
      if (!el) return;
      if (ent.pro) {
        var r = await api('my_list');
        var cur = r.ok ? await r.json() : [];
        var items = Array.isArray(cur) && cur[0] && cur[0].items ? cur[0].items : [];
        el.innerHTML = '<textarea id="slItems" style="width:100%;height:110px;border-radius:12px;border:1px solid #ccc;padding:10px;font:inherit;font-size:13px" placeholder="هر خط یک قلم خرید...">' + esc((items || []).join('\n')) + '</textarea><button class="btn small" id="slSave">ذخیره لیست</button>';
        var sv2 = $('slSave');
        if (sv2 && !sv2.dataset.bound) {
          sv2.dataset.bound = '1';
          sv2.onclick = async function () {
            var arr = $('slItems').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
            await api('save_list', { method: 'POST', body: JSON.stringify({ items: arr }) });
            alert('ذخیره شد');
          };
        }
      } else {
        el.innerHTML = '<div class="u-empty">لیست خرید هوشمند مخصوص PRO است.<br><a class="btn small" href="pro.html">ارتقا به PRO</a></div>';
      }
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
