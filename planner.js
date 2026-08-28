(async function () {
  if (document.body.dataset.page !== 'planner') return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const faN = n => (Number(n) || 0).toLocaleString('fa-IR');
  const norm = s => (s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim();
  const out = document.getElementById('plOut');
  const shopWrap = document.getElementById('plShopWrap');
  const pdfBtn = document.getElementById('plPdf');
  let ALL = [], ING = [], last = null, ready = false;

  async function tok() {
    try {
      if (!window.DFB || !DFB.sb) return null;
      const s = await DFB.sb.auth.getSession();
      return s && s.data && s.data.session ? s.data.session.access_token : null;
    } catch (e) { return null; }
  }
  async function headers() {
    const t = await tok();
    if (!t) return null;
    return { 'X-Supabase-Auth': t, 'Authorization': 'Bearer ' + t };
  }

  const t0 = setInterval(async () => {
    if (!window.DFB || !DFB.sb || ready) return;
    const t = await tok();
    if (t === null && window.DFB.user === undefined) return;
    ready = true; clearInterval(t0);
    if (!t) { out.innerHTML = '<div class="pl-empty">برای ساخت برنامه، اول با گوگل وارد شو.</div>'; return; }
    try { ALL = await (await fetch('/api/db?t=all')).json(); } catch (e) { ALL = []; }
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    const h = await headers();
    if (h && document.getElementById('plProf').checked) {
      try {
        const r = await fetch('/api/nutrition', { headers: h });
        const p = await r.json();
        if (p && p.calorie_target) document.getElementById('plKcal').value = p.calorie_target;
      } catch (e) {}
    }
  }, 400);

  function render(plan) {
    const days = plan.days || [];
    out.innerHTML = days.map(d => `<div class="day-card"><h4><span>روز ${faN(d.day)}</span><small>${faN(d.kcal)} کالری${d.protein != null ? ' | ' + faN(d.protein) + 'g پروتئین' : ''}</small></h4>
      ${d.meals.map(m => `<div class="meal-line"><b>${esc(m.type_fa)}</b><a href="recipe.html?slug=${esc(m.slug)}" style="color:#1e2b1c;font-weight:700;text-decoration:none">${esc(m.title)}</a><small>${faN(m.kcal)} کالری${m.note ? ' — ' + esc(m.note) : ''}</small></div>`).join('')}
    </div>`).join('') +
      ((plan.constraints || []).length ? `<div class="info-card"><h4>محدودیت‌ها و اهداف</h4><ul>${plan.constraints.map(c => `<li>• ${esc(c)}</li>`).join('')}</ul></div>` : '') +
      ((plan.tips || []).length ? `<div class="info-card"><h4>نکات مهم</h4><ul>${plan.tips.map(c => `<li>• ${esc(c)}</li>`).join('')}</ul></div>` : '') +
      (plan.activity ? `<div class="info-card"><h4>پیشنهاد فعالیت</h4><ul>${plan.activity.items.map(a => `<li>• ${esc(a)}</li>`).join('')}${plan.activity.note ? `<li>• ${esc(plan.activity.note)}</li>` : ''}</ul><p style="color:#8a6d00;background:#fff8e6;border-radius:12px;padding:10px;margin-top:8px;font-size:11px">${esc(plan.activity.disclaimer)}</p></div>` : '');
    // لیست خرید: تجمیع بر اساس نام فارسی ماده + نگهداری مقدار q
    const bySlug = {}; (Array.isArray(ALL) ? ALL : []).forEach(r => bySlug[r.slug] = r);
    const shop = {};
    days.forEach(d => d.meals.forEach(m => {
      const r = bySlug[m.slug];
      (r && r.ingredients || []).forEach(i => {
        if (!i.fa) return;
        const k = norm(i.fa);
        if (!shop[k]) shop[k] = { fa: i.fa, count: 0, qs: [] };
        shop[k].count++;
        const q = (i.q || '').trim();
        if (q && q !== 'به‌اندازه' && !shop[k].qs.includes(q)) shop[k].qs.push(q);
      });
    }));
    const shopList = Object.values(shop).sort((a, b) => b.count - a.count);
    shopWrap.innerHTML = shopList.length ? `<div class="shop-card"><h3 style="font-size:14px;margin-bottom:8px">لیست خرید هفتگی</h3><ul>${shopList.map(s => `<li>• ${esc(s.fa)} <small>(${faN(s.count)} رسپی)${s.qs.length ? ' — ' + esc(s.qs.join('، ')) : ''}</small></li>`).join('')}</ul></div>` : '';
    last = { plan, shopList };
    pdfBtn.disabled = false;
    out.scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('plGo').onclick = async () => {
    const h = await headers();
    if (!h) { out.innerHTML = '<div class="pl-empty">نشست فعال نیست. لطفاً با گوگل وارد شو.</div>'; return; }
    const btn = document.getElementById('plGo');
    btn.disabled = true; btn.textContent = 'در حال ساخت برنامه…';
    out.innerHTML = '<div class="pl-empty">در حال چیدن ۵ وعده از رسپی‌های واقعی…</div>';
    const ingText = document.getElementById('plIng').value;
    const have = (Array.isArray(ING) ? ING : []).filter(i => i.fa && ingText.includes(i.fa)).map(i => i.key);
    try {
      const r = await fetch('/api/mealplan', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, h),
        body: JSON.stringify({
          days: 7,
          meals: ['breakfast', 'snack_am', 'lunch', 'snack_pm', 'dinner'],
          include_profile: document.getElementById('plProf').checked,
          calorie_target: +document.getElementById('plKcal').value || null,
          have: have.length ? have : undefined,
          save: false
        })
      });
      const j = await r.json();
      if (r.ok && j.plan) render(j.plan);
      else if (r.status === 401) out.innerHTML = '<div class="pl-empty">نشست تمام شده — دوباره وارد شو.</div>';
      else if (r.status === 429 && j.error === 'quota_exceeded') out.innerHTML = '<div class="pl-empty">سهمیه این ماهت تمام شده — <a href="pro.html">ارتقا به PRO</a></div>';
      else if (r.status === 429) out.innerHTML = '<div class="pl-empty">یک لحظه صبر کن و دوباره امتحان کن.</div>';
      else if (r.status === 503) out.innerHTML = '<div class="pl-empty">سرویس هوشمند فعلاً در دسترس نیست.</div>';
      else if (j.error === 'recipe_catalog_unavailable') out.innerHTML = '<div class="pl-empty">رسپی مطابق محدودیت‌هات پیدا نشد؛ موارد ممنوع رو کمتر کن.</div>';
      else out.innerHTML = '<div class="pl-empty">یه مشکل موقت پیش اومد؛ دوباره امتحان کن.</div>';
    } catch (e) { out.innerHTML = '<div class="pl-empty">اتصال اینترنتت رو چک کن.</div>'; }
    btn.disabled = false; btn.textContent = 'ساخت برنامه ۷ روزه';
  };
  pdfBtn.onclick = () => last && genPdf(last);

  async function genPdf(data) {
    const plan = data.plan; const days = plan.days || [];
    if (!days.length) return;
    await new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    const doc = document.getElementById('pdfDoc');
    const wrap = inner => `<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">${inner}</div>`;
    const secs = [];
    secs.push(wrap(`<div style="background:#2d6a35;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.9;margin-top:6px">برنامه غذایی هفتگی — ۵ وعده در روز</div></div>
      <img src="img/logo.png" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>کالری هدف:</b> ${faN(+document.getElementById('plKcal').value || 2000)}</div>
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ${new Date().toLocaleDateString('fa-IR')}</div>
      </div>`));
    if ((plan.constraints || []).length) secs.push(wrap(`<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>محدودیت‌ها و اهداف:</b><br>${plan.constraints.map(c => '• ' + esc(c)).join('<br>')}</div>`));
    if ((plan.tips || []).length) secs.push(wrap(`<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>نکات مهم:</b><br>${plan.tips.map(c => '• ' + esc(c)).join('<br>')}</div>`));
    days.forEach(d => secs.push(wrap(`<div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ${faN(d.day)} — ${faN(d.kcal)} کالری${d.protein != null ? ' | ' + faN(d.protein) + 'g پروتئین' : ''}${d.carbs != null ? ' | ' + faN(d.carbs) + 'g کربوهیدرات' : ''}${d.fat != null ? ' | ' + faN(d.fat) + 'g چربی' : ''}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
        <tr style="background:#e8f4e9"><th style="padding:8px;text-align:right">وعده</th><th style="padding:8px;text-align:right">رسپی</th><th style="padding:8px;text-align:right">کالری</th><th style="padding:8px;text-align:right">یادداشت</th></tr>
        ${d.meals.map(m => `<tr style="border-bottom:1px solid #e5efe5"><td style="padding:8px;font-weight:700">${esc(m.type_fa)}</td><td style="padding:8px">${esc(m.title)}</td><td style="padding:8px">${faN(m.kcal)}</td><td style="padding:8px;color:#557">${esc(m.note || '')}</td></tr>`).join('')}
      </table>`));
    if (plan.activity) secs.push(wrap(`<div style="background:#e8f4e9;border-radius:14px;padding:16px"><b>پیشنهاد فعالیت:</b><br>${plan.activity.items.map(a => '• ' + esc(a)).join('<br>')}${plan.activity.note ? '<br>• ' + esc(plan.activity.note) : ''}<br><small style="color:#557">${esc(plan.activity.disclaimer)}</small></div>`));
    const shop = data.shopList || [];
    for (let i = 0; i < shop.length; i += 40) {
      const chunk = shop.slice(i, i + 40);
      secs.push(wrap(`<b>لیست خرید هفتگی${i ? ' (ادامه)' : ''}</b><br>${chunk.map(s => '• ' + esc(s.fa) + ` (${faN(s.count)} رسپی)${s.qs && s.qs.length ? ' — ' + esc(s.qs.join('، ')) : ''}`).join('<br>')}`));
    }
    secs.push(wrap(`<div style="border-top:2px solid #e8f4e9;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#77807a"><span>dailyfitbeat.ir</span><span>اینستاگرام: @dailyfitbeat</span><span>خوب بخور، بهتر زندگی کن</span></div>`));
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 10;
    for (const sec of secs) {
      doc.innerHTML = sec;
      await document.fonts.ready;
      const canvas = await html2canvas(doc.firstElementChild, { scale: 2, backgroundColor: '#fff' });
      let w = 200, h = canvas.height * w / canvas.width;
      if (h > 277) { const s2 = 277 / h; w *= s2; h *= s2; }
      if (y + h > 287) { pdf.addPage(); y = 10; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w) / 2, y, w, h);
      y += h + 6;
    }
    pdf.save('DailyFitBeat-WeeklyPlan.pdf');
  }
})();
