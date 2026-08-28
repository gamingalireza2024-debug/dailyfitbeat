(async function () {
  if (document.body.dataset.page !== 'mealplan') return;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var faN = function (n) { return (Number(n) || 0).toLocaleString('fa-IR'); };
  var out = document.getElementById('mpOut');
  var chip = document.getElementById('mpUsage');
  var ING = [], last = null, booted = false, authReady = false, loaded = false;

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
      out.innerHTML = '<div class="pb-empty">برای ساخت برنامه هوشمند، اول با گوگل وارد شو.</div>';
      chip.textContent = 'سهمیه: نیاز به ورود';
      return;
    }
    loaded = true;
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    loadUsage();
  }
  var t0 = setInterval(async function () {
    if (booted || !window.DFB || !DFB.sb) return;
    booted = true;
    clearInterval(t0);
    watchAuth();
    await start();
  }, 400);

  async function loadUsage() {
    var h = await headers();
    if (!h) { chip.textContent = 'سهمیه: نیاز به ورود'; return; }
    try {
      var r = await fetch('/api/ai', { headers: h });
      if (!r.ok) { chip.textContent = 'سهمیه: —'; return; }
      var j = await r.json();
      chip.textContent = faN(j.used) + ' از ' + faN(j.limit) + ' پاسخ ' + (j.pro ? 'PRO' : 'رایگان') + ' این ماه';
    } catch (e) { chip.textContent = 'سهمیه: —'; }
  }
  function macrosLine(d) {
    var parts = [];
    if (d.protein != null) parts.push('پروتئین ' + faN(d.protein) + 'g');
    if (d.carbs != null) parts.push('کربوهیدرات ' + faN(d.carbs) + 'g');
    if (d.fat != null) parts.push('چربی ' + faN(d.fat) + 'g');
    if (!parts.length) return '';
    return '<span style="font-size:11px;color:#2d6a35;background:#e8f4e9;border-radius:999px;padding:4px 12px;display:inline-block">' + parts.join(' | ') + '</span>';
  }
  function renderPlan(plan) {
    last = plan;
    var days = plan.days || [];
    var html = '<div style="text-align:center;margin:14px 0"><button id="mpPdf" style="border:1.5px solid #2d6a35;color:#2d6a35;background:#fff;border-radius:14px;padding:11px 26px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">دانلود PDF برنامه</button></div>';
    days.forEach(function (d) {
      html += '<div class="day-card"><div class="day-head"><b>روز ' + faN(d.day) + '</b><small>' + faN(d.kcal) + ' کالری</small></div>' + macrosLine(d);
      d.meals.forEach(function (m) {
        html += '<div class="meal-line"><b>' + esc(m.type_fa) + '</b><a href="recipe.html?slug=' + esc(m.slug) + '">' + esc(m.title) + '</a><small>' + faN(m.kcal) + ' کالری' + (m.protein != null ? ' | ' + faN(m.protein) + 'g پروتئین' : '') + (m.note ? ' — ' + esc(m.note) : '') + '</small></div>';
      });
      html += '</div>';
    });
    if (plan.constraints && plan.constraints.length) {
      html += '<div class="info-card"><h4>محدودیت‌ها و اهداف اعمال‌شده</h4><ul>' + plan.constraints.map(function (c) { return '<li>• ' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }
    if (plan.tips && plan.tips.length) {
      html += '<div class="info-card"><h4>نکات مهم شخصی‌سازی‌شده</h4><ul>' + plan.tips.map(function (c) { return '<li>• ' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    }
    if (plan.activity) {
      html += '<div class="info-card"><h4>پیشنهاد فعالیت</h4><ul>' + plan.activity.items.map(function (a) { return '<li>• ' + esc(a) + '</li>'; }).join('') + (plan.activity.note ? '<li>• ' + esc(plan.activity.note) + '</li>' : '') + '</ul><p class="warn">' + esc(plan.activity.disclaimer) + '</p></div>';
    }
    out.innerHTML = html;
    var pb = document.getElementById('mpPdf');
    if (pb) pb.onclick = function () { genPdf(last); };
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function genPdf(plan) {
    var days = plan.days || [];
    if (!days.length) return;
    await new Promise(function (r) { var i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    var doc = document.getElementById('pdfDoc');
    var total = days.reduce(function (s, d) { return s + (d.kcal || 0); }, 0);
    var wrap = function (inner) { return '<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">' + inner + '</div>'; };
    var secs = [];
    secs.push(wrap('<div style="background:#2d6a35;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px"><div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.9;margin-top:6px">برنامه غذایی هوشمند — ' + faN(days.length) + ' روز</div></div><img src="img/logo.png" alt="DailyFitBeat" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ' + new Date().toLocaleDateString('fa-IR') + '</div><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>میانگین کالری روزانه:</b> ' + faN(Math.round(total / days.length)) + '</div></div>'));
    if (plan.constraints && plan.constraints.length) {
      secs.push(wrap('<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>محدودیت‌ها و اهداف:</b><br>' + plan.constraints.map(function (c) { return '• ' + esc(c); }).join('<br>') + '</div>'));
    }
    if (plan.tips && plan.tips.length) {
      secs.push(wrap('<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>نکات مهم:</b><br>' + plan.tips.map(function (c) { return '• ' + esc(c); }).join('<br>') + '</div>'));
    }
    days.forEach(function (d) {
      var rows = '';
      d.meals.forEach(function (m) {
        rows += '<tr style="border-bottom:1px solid #e5efe5"><td style="padding:8px;font-weight:700">' + esc(m.type_fa) + '</td><td style="padding:8px">' + esc(m.title) + '</td><td style="padding:8px">' + faN(m.kcal) + '</td><td style="padding:8px">' + (m.protein != null ? faN(m.protein) + 'g' : '—') + '</td><td style="padding:8px;color:#557">' + esc(m.note || '') + '</td></tr>';
      });
      secs.push(wrap('<div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ' + faN(d.day) + ' — ' + faN(d.kcal) + ' کالری' + (d.protein != null ? ' | ' + faN(d.protein) + 'g پروتئین' : '') + (d.carbs != null ? ' | ' + faN(d.carbs) + 'g کربوهیدرات' : '') + (d.fat != null ? ' | ' + faN(d.fat) + 'g چربی' : '') + '</div><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px"><tr style="background:#e8f4e9"><th style="padding:8px;text-align:right">وعده</th><th style="padding:8px;text-align:right">رسپی</th><th style="padding:8px;text-align:right">کالری</th><th style="padding:8px;text-align:right">پروتئین</th><th style="padding:8px;text-align:right">یادداشت</th></tr>' + rows + '</table>'));
    });
    if (plan.activity) {
      secs.push(wrap('<div style="background:#e8f4e9;border-radius:14px;padding:16px"><b>پیشنهاد فعالیت:</b><br>' + plan.activity.items.map(function (a) { return '• ' + esc(a); }).join('<br>') + (plan.activity.note ? '<br>• ' + esc(plan.activity.note) : '') + '<br><small style="color:#557">' + esc(plan.activity.disclaimer) + '</small></div>'));
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
    pdf.save('DailyFitBeat-MealPlan.pdf');
  }
  document.getElementById('mpGo').onclick = async function () {
    var h = await headers();
    if (!h) { out.innerHTML = '<div class="pb-empty">نشست فعال نیست. لطفاً با گوگل وارد شو.</div>'; return; }
    var btn = document.getElementById('mpGo');
    btn.disabled = true;
    btn.textContent = 'در حال ساخت برنامه…';
    out.innerHTML = '<div class="pb-empty">در حال چیدن وعده‌ها از رسپی‌های واقعی…</div>';
    var meals = [];
    if (document.getElementById('mB').checked) meals.push('breakfast');
    if (document.getElementById('mSA').checked) meals.push('snack_am');
    if (document.getElementById('mL').checked) meals.push('lunch');
    if (document.getElementById('mSP').checked) meals.push('snack_pm');
    if (document.getElementById('mD').checked) meals.push('dinner');
    var ingText = document.getElementById('mpIng').value;
    var have = (Array.isArray(ING) ? ING : []).filter(function (i) { return i.fa && ingText.indexOf(i.fa) !== -1; }).map(function (i) { return i.key; });
    try {
      var r = await fetch('/api/mealplan', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, h),
        body: JSON.stringify({
          days: +document.getElementById('mpDays').value,
          meals: meals,
          have: have.length ? have : undefined,
          include_profile: document.getElementById('mpProf').checked,
          save: false
        })
      });
      var j = await r.json();
      if (r.ok && j.plan) { renderPlan(j.plan); loadUsage(); }
      else if (r.status === 401) out.innerHTML = '<div class="pb-empty">نشست تو تمام شده. لطفاً دوباره وارد شو.</div>';
      else if (r.status === 429 && j.error === 'quota_exceeded') out.innerHTML = '<div class="pb-empty">سهمیه رایگان این ماهت تمام شده. <a href="pro.html">ارتقا به PRO</a></div>';
      else if (r.status === 429) out.innerHTML = '<div class="pb-empty">یک لحظه صبر کن و دوباره امتحان کن.</div>';
      else if (r.status === 503) out.innerHTML = '<div class="pb-empty">دستیار تغذیه فعلاً در دسترس نیست. کمی بعد دوباره امتحان کن.</div>';
      else if (j.error === 'recipe_catalog_unavailable') out.innerHTML = '<div class="pb-empty">رسپی مطابق محدودیت‌هات پیدا نشد؛ موارد ممنوع رو کمتر کن.</div>';
      else out.innerHTML = '<div class="pb-empty">یه مشکل موقت پیش اومد؛ دوباره امتحان کن.</div>';
    } catch (e) {
      out.innerHTML = '<div class="pb-empty">اتصال اینترنتت رو چک کن و دوباره امتحان کن.</div>';
    }
    btn.disabled = false;
    btn.textContent = 'ساخت برنامه';
  };
})();
