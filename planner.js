(async function () {
  if (document.body.dataset.page !== 'planner') return;
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  var AR = '٠١٢٣٤٥٦٧٨٩';
  function toNum(s) {
    if (s === '' || s == null) return null;
    var t = String(s).replace(/[۰-۹]/g, function (x) { return String(FA.indexOf(x)); }).replace(/[٠-٩]/g, function (x) { return String(AR.indexOf(x)); }).replace(/[,،٬\s]/g, '');
    if (t === '') return null;
    var n = Number(t);
    return isNaN(n) ? null : n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function faN(n) { return (Number(n) || 0).toLocaleString('fa-IR'); }
  function norm(s) { return (s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim(); }
  var out = document.getElementById('plOut');
  var macro = document.getElementById('plMacro');
  var shopWrap = document.getElementById('plShopWrap');
  var pdfBtn = document.getElementById('plPdf');
  var usageEl = document.getElementById('plUsage');
  var ALL = [], ING = [], last = null, booted = false;

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
  function selectedMeals() {
    var m = [];
    if (document.getElementById('plB').checked) m.push('breakfast');
    if (document.getElementById('plSA').checked) m.push('snack_am');
    if (document.getElementById('plL').checked) m.push('lunch');
    if (document.getElementById('plSP').checked) m.push('snack_pm');
    if (document.getElementById('plD').checked) m.push('dinner');
    return m;
  }
  async function loadUsage() {
    var h = await headers();
    if (!h) { usageEl.textContent = 'سهمیه: نیاز به ورود'; return; }
    try {
      var r = await fetch('/api/mealplan', { headers: h });
      if (!r.ok) { usageEl.textContent = 'سهمیه: —'; return; }
      var j = await r.json();
      usageEl.textContent = faN(j.used) + ' از ' + faN(j.limit) + ' پاسخ ' + (j.pro ? 'PRO' : 'رایگان') + ' این ماه';
    } catch (e) { usageEl.textContent = 'سهمیه: —'; }
  }

  var t0 = setInterval(async function () {
    if (booted || !window.DFB || !DFB.sb) return;
    booted = true;
    clearInterval(t0);
    var t = await tok();
    if (!t) { out.innerHTML = '<div class="pl-empty">برای ساخت برنامه، اول با گوگل وارد شو.</div>'; usageEl.textContent = 'سهمیه: نیاز به ورود'; return; }
    try { ALL = await (await fetch('/api/db?t=all')).json(); } catch (e) { ALL = []; }
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    loadUsage();
    var h = await headers();
    if (h && document.getElementById('plProf').checked) {
      try {
        var r = await fetch('/api/nutrition', { headers: h });
        var p = await r.json();
        if (p) {
          if (p.calorie_target) document.getElementById('plKcal').value = p.calorie_target;
          if (p.height_cm) document.getElementById('plHeight').value = p.height_cm;
          if (p.weight_kg) document.getElementById('plWeight').value = p.weight_kg;
          if (p.activity_level) document.getElementById('plAct').value = p.activity_level;
          if (p.goal === 'کاهش وزن') document.getElementById('plGoal').value = 'lose';
          if (p.goal === 'افزایش وزن') document.getElementById('plGoal').value = 'gain';
          if (p.goal === 'حفظ وزن') document.getElementById('plGoal').value = 'keep';
        }
      } catch (e) {}
    }
  }, 400);

  function calcCalories() {
    var g = document.getElementById('plGender').value;
    var age = toNum(document.getElementById('plAge').value) || 30;
    var h = toNum(document.getElementById('plHeight').value) || 170;
    var w = toNum(document.getElementById('plWeight').value) || 70;
    var act = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[document.getElementById('plAct').value] || 1.375;
    var bmr = 10 * w + 6.25 * h - 5 * age + (g === 'male' ? 5 : -161);
    var tdee = bmr * act;
    var goal = document.getElementById('plGoal').value;
    if (goal === 'lose') tdee -= 300;
    if (goal === 'gain') tdee += 300;
    tdee = Math.round(tdee / 50) * 50;
    document.getElementById('plKcal').value = tdee;
  }
  document.getElementById('plCalc').onclick = calcCalories;

  function render(plan) {
    var days = plan.days || [];
    out.innerHTML = days.map(function (d) {
      return '<div class="day-card"><div class="day-head"><b>روز ' + faN(d.day) + '</b><small>' + faN(d.kcal) + ' کالری' + (d.protein != null ? ' | ' + faN(d.protein) + 'g پروتئین' : '') + '</small></div>' +
        d.meals.map(function (m) {
          return '<div class="meal-line"><b>' + esc(m.type_fa) + '</b><a href="recipe.html?slug=' + esc(m.slug) + '">' + esc(m.title) + '</a><small>' + faN(m.kcal) + ' کالری' + (m.note ? ' — ' + esc(m.note) : '') + '</small></div>';
        }).join('') + '</div>';
    }).join('') +
      ((plan.constraints || []).length ? '<div class="info-card"><h4>محدودیت‌ها و اهداف</h4><ul>' + plan.constraints.map(function (c) { return '<li>• ' + esc(c) + '</li>'; }).join('') + '</ul></div>' : '') +
      ((plan.tips || []).length ? '<div class="info-card"><h4>نکات مهم</h4><ul>' + plan.tips.map(function (c) { return '<li>• ' + esc(c) + '</li>'; }).join('') + '</ul></div>' : '') +
      (plan.activity ? '<div class="info-card"><h4>پیشنهاد فعالیت</h4><ul>' + plan.activity.items.map(function (a) { return '<li>• ' + esc(a) + '</li>'; }).join('') + (plan.activity.note ? '<li>• ' + esc(plan.activity.note) + '</li>' : '') + '</ul><p style="color:#8a6d00;background:#fff8e6;border-radius:12px;padding:10px;margin-top:8px;font-size:11px">' + esc(plan.activity.disclaimer) + '</p></div>' : '');

    if (days.length) {
      var sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      var rows = days.map(function (d) {
        sum.kcal += d.kcal || 0; sum.protein += d.protein || 0; sum.carbs += d.carbs || 0; sum.fat += d.fat || 0;
        return '<tr><td>روز ' + faN(d.day) + '</td><td>' + faN(d.kcal) + '</td><td>' + (d.protein != null ? faN(d.protein) + 'g' : '—') + '</td><td>' + (d.carbs != null ? faN(d.carbs) + 'g' : '—') + '</td><td>' + (d.fat != null ? faN(d.fat) + 'g' : '—') + '</td></tr>';
      }).join('');
      var n = days.length;
      rows += '<tr class="avg"><td>میانگین روزانه</td><td>' + faN(Math.round(sum.kcal / n)) + '</td><td>' + faN(Math.round(sum.protein / n)) + 'g</td><td>' + faN(Math.round(sum.carbs / n)) + 'g</td><td>' + faN(Math.round(sum.fat / n)) + 'g</td></tr>';
      macro.innerHTML = '<div class="info-card"><h4>ارزش غذایی روزانه رژیم شما</h4><table class="pl-table"><thead><tr><th>روز</th><th>کالری</th><th>پروتئین</th><th>کربوهیدرات</th><th>چربی</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    } else macro.innerHTML = '';

    var bySlug = {}; (Array.isArray(ALL) ? ALL : []).forEach(function (r) { bySlug[r.slug] = r; });
    var shop = {};
    days.forEach(function (d) {
      d.meals.forEach(function (m) {
        var r = bySlug[m.slug];
        (r && r.ingredients || []).forEach(function (i) {
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
    shopWrap.innerHTML = shopList.length ? '<div class="shop-card"><h3>لیست خرید هفتگی</h3><ul>' + shopList.map(function (s) {
      return '<li>• ' + esc(s.fa) + ' <small>(' + faN(s.count) + ' رسپی)' + (s.qs.length ? ' — ' + esc(s.qs.join('، ')) : '') + '</small></li>';
    }).join('') + '</ul></div>' : '';

    last = { plan: plan, shopList: shopList };
    pdfBtn.disabled = false;
    out.scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('plGo').onclick = async function () {
    var h = await headers();
    if (!h) { out.innerHTML = '<div class="pl-empty">نشست فعال نیست. لطفاً با گوگل وارد شو.</div>'; return; }
    var meals = selectedMeals();
    if (!meals.length) { alert('حداقل یک وعده را انتخاب کن.'); return; }
    var btn = document.getElementById('plGo');
    btn.disabled = true; btn.textContent = 'در حال ساخت برنامه…';
    out.innerHTML = '<div class="pl-empty">در حال چیدن وعده‌ها از رسپی‌های واقعی…</div>';
    macro.innerHTML = '';
    var ingText = document.getElementById('plIng').value;
    var have = (Array.isArray(ING) ? ING : []).filter(function (i) { return i.fa && ingText.indexOf(i.fa) !== -1; }).map(function (i) { return i.key; });
    try {
      var r = await fetch('/api/mealplan', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, h),
        body: JSON.stringify({
          days: +document.getElementById('plDays').value,
          meals: meals,
          include_profile: document.getElementById('plProf').checked,
          calorie_target: toNum(document.getElementById('plKcal').value),
          have: have.length ? have : undefined,
          save: false
        })
      });
      var j = await r.json();
      if (r.ok && j.plan) { render(j.plan); loadUsage(); }
      else if (r.status === 401) out.innerHTML = '<div class="pl-empty">نشست تمام شده — دوباره وارد شو.</div>';
      else if (r.status === 429 && j.error === 'quota_exceeded') out.innerHTML = '<div class="pl-empty">سهمیه این ماهت تمام شده — <a href="pro.html">ارتقا به PRO</a></div>';
      else if (r.status === 429) out.innerHTML = '<div class="pl-empty">یک لحظه صبر کن و دوباره امتحان کن.</div>';
      else if (r.status === 503) out.innerHTML = '<div class="pl-empty">سرویس هوشمند فعلاً در دسترس نیست.</div>';
      else if (j.error === 'recipe_catalog_unavailable') out.innerHTML = '<div class="pl-empty">رسپی مطابق محدودیت‌هات پیدا نشد؛ موارد ممنوع رو کمتر کن.</div>';
      else out.innerHTML = '<div class="pl-empty">یه مشکل موقت پیش اومد؛ دوباره امتحان کن.</div>';
    } catch (e) {
      out.innerHTML = '<div class="pl-empty">اتصال اینترنتت رو چک کن.</div>';
    }
    btn.disabled = false; btn.textContent = 'ساخت برنامه';
  };
  pdfBtn.onclick = function () { if (last) genPdf(last); };

  async function genPdf(data) {
    var plan = data.plan; var days = plan.days || [];
    if (!days.length) return;
    await new Promise(function (r) { var i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    var doc = document.getElementById('pdfDoc');
    var wrap = function (inner) { return '<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">' + inner + '</div>'; };
    var secs = [];
    secs.push(wrap('<div style="background:#f97316;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px"><div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.92;margin-top:6px">استودیو تغذیه دیلی فیت— برنامه ' + faN(days.length) + ' روزه</div></div><img src="img/logo.png" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><div style="background:#fff5ec;border-radius:14px;padding:10px 16px"><b>کالری هدف:</b> ' + faN(toNum(document.getElementById('plKcal').value) || 2000) + '</div><div style="background:#fff5ec;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ' + new Date().toLocaleDateString('fa-IR') + '</div></div>'));
    if ((plan.constraints || []).length) secs.push(wrap('<div style="background:#fff5ec;border-radius:14px;padding:14px"><b>محدودیت‌ها و اهداف:</b><br>' + plan.constraints.map(function (c) { return '• ' + esc(c); }).join('<br>') + '</div>'));
    if ((plan.tips || []).length) secs.push(wrap('<div style="background:#fff5ec;border-radius:14px;padding:14px"><b>نکات مهم:</b><br>' + plan.tips.map(function (c) { return '• ' + esc(c); }).join('<br>') + '</div>'));
    days.forEach(function (d) {
      var rows = d.meals.map(function (m) {
        return '<tr style="border-bottom:1px solid #f0e5da"><td style="padding:8px;font-weight:700">' + esc(m.type_fa) + '</td><td style="padding:8px">' + esc(m.title) + '</td><td style="padding:8px">' + faN(m.kcal) + '</td><td style="padding:8px;color:#557">' + esc(m.note || '') + '</td></tr>';
      }).join('');
      secs.push(wrap('<div style="background:#f97316;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ' + faN(d.day) + ' — ' + faN(d.kcal) + ' کالری</div><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px"><tr style="background:#fff5ec"><th style="padding:8px;text-align:right">وعده</th><th style="padding:8px;text-align:right">رسپی</th><th style="padding:8px;text-align:right">کالری</th><th style="padding:8px;text-align:right">یادداشت</th></tr>' + rows + '</table>'));
    });
    var sum = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    var mrows = days.map(function (d) {
      sum.kcal += d.kcal || 0; sum.protein += d.protein || 0; sum.carbs += d.carbs || 0; sum.fat += d.fat || 0;
      return '<tr style="border-bottom:1px solid #f0e5da"><td style="padding:7px">روز ' + faN(d.day) + '</td><td style="padding:7px">' + faN(d.kcal) + '</td><td style="padding:7px">' + (d.protein != null ? faN(d.protein) + 'g' : '—') + '</td><td style="padding:7px">' + (d.carbs != null ? faN(d.carbs) + 'g' : '—') + '</td><td style="padding:7px">' + (d.fat != null ? faN(d.fat) + 'g' : '—') + '</td></tr>';
    }).join('');
    var n = days.length || 1;
    mrows += '<tr style="background:#fff5ec;font-weight:800"><td style="padding:7px">میانگین روزانه</td><td style="padding:7px">' + faN(Math.round(sum.kcal / n)) + '</td><td style="padding:7px">' + faN(Math.round(sum.protein / n)) + 'g</td><td style="padding:7px">' + faN(Math.round(sum.carbs / n)) + 'g</td><td style="padding:7px">' + faN(Math.round(sum.fat / n)) + 'g</td></tr>';
    secs.push(wrap('<b>ارزش غذایی روزانه رژیم شما</b><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:12.5px"><tr style="background:#fff5ec"><th style="padding:7px">روز</th><th style="padding:7px">کالری</th><th style="padding:7px">پروتئین</th><th style="padding:7px">کربوهیدرات</th><th style="padding:7px">چربی</th></tr>' + mrows + '</table>'));
    if (plan.activity) secs.push(wrap('<div style="background:#fff5ec;border-radius:14px;padding:16px"><b>پیشنهاد فعالیت:</b><br>' + plan.activity.items.map(function (a) { return '• ' + esc(a); }).join('<br>') + (plan.activity.note ? '<br>• ' + esc(plan.activity.note) : '') + '<br><small style="color:#557">' + esc(plan.activity.disclaimer) + '</small></div>'));
    var shop = data.shopList || [];
    for (var i = 0; i < shop.length; i += 40) {
      var chunk = shop.slice(i, i + 40);
      secs.push(wrap('<b>لیست خرید هفتگی' + (i ? ' (ادامه)' : '') + '</b><br>' + chunk.map(function (s) {
        return '• ' + esc(s.fa) + ' (' + faN(s.count) + ' رسپی)' + (s.qs && s.qs.length ? ' — ' + esc(s.qs.join('، ')) : '');
      }).join('<br>')));
    }
    secs.push(wrap('<div style="border-top:2px solid #f0e5da;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#77807a"><span>dailyfitbeat.ir</span><span>اینستاگرام: @dailyfitbeat</span><span>خوب بخور، بهتر زندگی کن</span></div>'));
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
    pdf.save('DailyFitBeat-SmartDiet.pdf');
  }
})();
