(async function () {
  if (document.body.dataset.page !== 'planner') return;
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  var AR = '٠١٢٣٤٥٦٧٨٩';
  function toNum(s) {
    if (s === '' || s == null) return null;
    var t = String(s)
      .replace(/[۰-۹]/g, function (x) { return String(FA.indexOf(x)); })
      .replace(/[٠-٩]/g, function (x) { return String(AR.indexOf(x)); })
      .replace(/[,،٬\s]/g, '');
    if (t === '') return null;
    var n = Number(t);
    return isNaN(n) ? null : n;
  }
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var faN = function (n) { return (Number(n) || 0).toLocaleString('fa-IR'); };
  var norm = function (s) { return (s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim(); };
  var out = document.getElementById('plOut');
  var shopWrap = document.getElementById('plShopWrap');
  var pdfBtn = document.getElementById('plPdf');
  var ALL = [], ING = [], last = null, booted = false, authReady = false, loaded = false;

  async function tok() {
    try {
      if (!window.DFB || !DFB.sb) return null;
      var s = await DFB.sb.auth.getSession();
      if (!s || !s.data || !s.data.session) return null;
      return s.data.session.access_token || null;
    } catch (e) { return null; }
  }
  async function headers() {
    var t = await tok();
    if (!t) return null;
    return { 'X-Supabase-Auth': t, 'Authorization': 'Bearer ' + t };
  }
  function watchAuth() {
    try {
      DFB.sb.auth.onAuthStateChange(function (ev) {
        if (ev === 'INITIAL_SESSION' || ev === 'SIGNED_OUT') authReady = true;
        if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED') {
          authReady = true;
          if (!loaded) start();
        }
      });
    } catch (e) { authReady = true; }
  }
  async function waitAuth() {
    for (var i = 0; i < 20; i++) {
      var t = await tok();
      if (t) return true;
      if (authReady) return false;
      await new Promise(function (r) { setTimeout(r, 200); });
    }
    return !!(await tok());
  }
  async function start() {
    var ok = await waitAuth();
    var t = await tok();
    if (!ok || !t) {
      loaded = false;
      out.innerHTML = '<div class="pb-empty">برای ساخت برنامه، اول با گوگل وارد شو.</div>';
      return;
    }
    loaded = true;
    try { ALL = await (await fetch('/api/db?t=all')).json(); } catch (e) { ALL = []; }
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    var h = await headers();
    if (h && document.getElementById('plProf').checked) {
      try {
        var r = await fetch('/api/nutrition', { headers: h });
        var p = await r.json();
        if (p && p.calorie_target) document.getElementById('plKcal').value = p.calorie_target;
      } catch (e) { /* ignore */ }
    }
  }
  var t0 = setInterval(async function () {
    if (booted || !window.DFB || !DFB.sb) return;
    booted = true;
    clearInterval(t0);
    watchAuth();
    await start();
  }, 400);

  function render(plan) {
    var days = plan.days || [];
    var html = '';
    days.forEach(function (d) {
      html += '<div class="day-card"><div class="day-head"><b>روز ' + faN(d.day) + '</b><small>' + faN(d.kcal) + ' کالری' + (d.protein != null ? ' | ' + faN(d.protein) + 'g پروتئین' : '') + '</small></div>';
      d.meals.forEach(function (m) {
        html += '<div class="meal-line"><b>' + esc(m.type_fa) + '</b><a href="recipe.html?slug=' + esc(m.slug) + '">' + esc(m.title) + '</a><small>' + faN(m.kcal) + ' کالری' + (m.note ? ' — ' + esc(m.note) : '') + '</small></div>';
      });
      html += '</div>';
    });
    if (plan.constraints && plan.constraints.length) {
      html += '<div class="info-card"><h4>محدودیت‌ها و اهداف</h4><ul>' + plan.constraints.map(function (c) { return '<li>• ' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }
    if (plan.tips && plan.tips.length) {
      html += '<div class="info-card"><h4>نکات مهم</h4><ul>' + plan.tips.map(function (c) { return '<li>• ' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }
    if (plan.activity) {
      html += '<div class="info-card"><h4>پیشنهاد فعالیت</h4><ul>' + plan.activity.items.map(function (a) { return '<li>• ' + esc(a) + '</li>'; }).join('') + (plan.activity.note ? '<li>• ' + esc(plan.activity.note) + '</li>' : '') + '</ul><p class="warn">' + esc(plan.activity.disclaimer) + '</p></div>';
    }
    out.innerHTML = html;
    var bySlug = {};
    (Array.isArray(ALL) ? ALL : []).forEach(function (r) { bySlug[r.slug] = r; });
    var shop = {};
    days.forEach(function (d) {
      d.meals.forEach(function (m) {
        var r = bySlug[m.slug];
        var ings = (r && r.ingredients) ? r.ingredients : [];
        ings.forEach(function (i) {
          if (!i.fa) return;
          var k = norm(i.fa);
          if (!shop[k]) shop[k] = { fa: i.fa, count: 0, qs: [] };
          shop[k].count++;
          var q = (i.q || '').trim();
          if (q && q !== 'به‌اندازه' && shop[k].qs.indexOf(q) === -1) shop[k].qs.push(q);
        });
      });
    });
    var shopList = Object.values(shop).sort(function (a, b) { return b.count - a.count; });
    if (shopList.length) {
      shopWrap.innerHTML = '<div class="shop-card"><h3>لیست خرید هفتگی</h3><ul>' + shopList.map(function (s) {
        return '<li>• ' + esc(s.fa) + ' <small>(' + faN(s.count) + ' رسپی)' + (s.qs.length ? ' — ' + esc(s.qs.join('، ')) : '') + '</small></li>';
      }).join('') + '</ul></div>';
    } else {
      shopWrap.innerHTML = '';
    }
    last = { plan: plan, shopList: shopList };
    pdfBtn.disabled = false;
    out.scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('plGo').onclick = async function () {
    var h = await headers();
    if (!h) { out.innerHTML = '<div class="pb-empty">نشست فعال نیست. لطفاً با گوگل وارد شو.</div>'; return; }
    var btn = document.getElementById('plGo');
    btn.disabled = true;
    btn.textContent = 'در حال ساخت برنامه…';
    out.innerHTML = '<div class="pb-empty">در حال چیدن ۵ وعده از رسپی‌های واقعی…</div>';
    var ingText = document.getElementById('plIng').value;
    var have = (Array.isArray(ING) ? ING : []).filter(function (i) { return i.fa && ingText.indexOf(i.fa) !== -1; }).map(function (i) { return i.key; });
    try {
      var r = await fetch('/api/mealplan', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, h),
        body: JSON.stringify({
          days: 7,
          meals: ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'],
          include_profile: document.getElementById('plProf').checked,
          calorie_target: toNum(document.getElementById('plKcal').value),
          have: have.length ? have : undefined,
          save: false
        })
      });
      var j = await r.json();
      if (r.ok && j.plan) render(j.plan);
      else if (r.status === 401) out.innerHTML = '<div class="pb-empty">نشست تمام شده — دوباره وارد شو.</div>';
      else if (r.status === 429 && j.error === 'quota_exceeded') out.innerHTML = '<div class="pb-empty">سهمیه این ماهت تمام شده — <a href="pro.html">ارتقا به PRO</a></div>';
      else if (r.status === 429) out.innerHTML = '<div class="pb-empty">یک لحظه صبر کن و دوباره امتحان کن.</div>';
      else if (r.status === 503) out.innerHTML = '<div class="pb-empty">سرویس هوشمند فعلاً در دسترس نیست.</div>';
      else if (j.error === 'recipe_catalog_unavailable') out.innerHTML = '<div class="pb-empty">رسپی مطابق محدودیت‌هات پیدا نشد؛ موارد ممنوع رو کمتر کن.</div>';
      else out.innerHTML = '<div class="pb-empty">یه مشکل موقت پیش اومد؛ دوباره امتحان کن.</div>';
    } catch (e) {
      out.innerHTML = '<div class="pb-empty">اتصال اینترنتت رو چک کن.</div>';
    }
    btn.disabled = false;
    btn.textContent = 'ساخت برنامه ۷ روزه';
  };
  pdfBtn.onclick = function () { if (last) genPdf(last); };

  async function genPdf(data) {
    var plan = data.plan;
    var days = plan.days || [];
    if (!days.length) return;
    await new Promise(function (r) { var i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    var doc = document.getElementById('pdfDoc');
    var wrap = function (inner) { return '<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">' + inner + '</div>'; };
    var secs = [];
    secs.push(wrap('<div style="background:#2d6a35;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px"><div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.9;margin-top:6px">برنامه غذایی هفتگی — ۵ وعده در روز</div></div><img src="img/logo.png" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>کالری هدف:</b> ' + faN(toNum(document.getElementById('plKcal').value) || 2000) + '</div><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ' + new Date().toLocaleDateString('fa-IR') + '</div></div>'));
    if (plan.constraints && plan.constraints.length) {
      secs.push(wrap('<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>محدودیت‌ها و اهداف:</b><br>' + plan.constraints.map(function (c) { return '• ' + esc(c); }).join('<br>') + '</div>'));
    }
    if (plan.tips && plan.tips.length) {
      secs.push(wrap('<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>نکات مهم:</b><br>' + plan.tips.map(function (c) { return '• ' + esc(c); }).join('<br>') + '</div>'));
    }
    days.forEach(function (d) {
      var rows = '';
      d.meals.forEach(function (m) {
        rows += '<tr style="border-bottom:1px solid #e5efe5"><td style="padding:8px;font-weight:700">' + esc(m.type_fa) + '</td><td style="padding:8px">' + esc(m.title) + '</td><td style="padding:8px">' + faN(m.kcal) + '</td><td style="padding:8px;color:#557">' + esc(m.note || '') + '</td></tr>';
      });
      secs.push(wrap('<div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ' + faN(d.day) + ' — ' + faN(d.kcal) + ' کالری</div><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px"><tr style="background:#e8f4e9"><th style="padding:8px;text-align:right">وعده</th><th style="padding:8px;text-align:right">رسپی</th><th style="padding:8px;text-align:right">کالری</th><th style="padding:8px;text-align:right">یادداشت</th></tr>' + rows + '</table>'));
    });
    if (plan.activity) {
      secs.push(wrap('<div style="background:#e8f4e9;border-radius:14px;padding:16px"><b>پیشنهاد فعالیت:</b><br>' + plan.activity.items.map(function (a) { return '• ' + esc(a); }).join('<br>') + (plan.activity.note ? '<br>• ' + esc(plan.activity.note) : '') + '<br><small style="color:#557">' + esc(plan.activity.disclaimer) + '</small></div>'));
    }
    var shop = data.shopList || [];
    for (var i = 0; i < shop.length; i += 40) {
      var chunk = shop.slice(i, i + 40);
      secs.push(wrap('<b>لیست خرید هفتگی' + (i ? ' (ادامه)' : '') + '</b><br>' + chunk.map(function (s) {
        return '• ' + esc(s.fa) + ' (' + faN(s.count) + ' رسپی)' + (s.qs && s.qs.length ? ' — ' + esc(s.qs.join('، ')) : '');
      }).join('<br>')));
    }
    secs.push(wrap('<div style="border-top:2px solid #e8f4e9;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#77807a"><span>dailyfitbeat.ir</span><span>اینستاگرام: @dailyfitbeat</span><span>خوب بخور، بهتر زندگی کن</span></div>'));
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF('p', 'mm', 'a4');
    var y = 10;
    for (var s2 = 0; s2 < secs.length; s2++) {
      doc.innerHTML = secs[s2];
      await document.fonts.ready;
      var canvas = await html2canvas(doc.firstElementChild, { scale: 2, backgroundColor: '#fff' });
      var w = 200, hh = canvas.height * w / canvas.width;
      if (hh > 277) { var sc = 277 / hh; w *= sc; hh *= sc; }
      if (y + hh > 287) { pdf.addPage(); y = 10; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w) / 2, y, w, hh);
      y += hh + 6;
    }
    pdf.save('DailyFitBeat-WeeklyPlan.pdf');
  }
})();
