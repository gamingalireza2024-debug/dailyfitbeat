(async function () {
  if (document.body.dataset.page !== 'mealplan') return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const faN = n => (Number(n) || 0).toLocaleString('fa-IR');
  const out = document.getElementById('mpOut');
  const chip = document.getElementById('mpUsage');
  let ING = [], last = null;

  const t0 = setInterval(async () => {
    if (!window.DFB || !DFB.sb) return;
    clearInterval(t0);
    if (!DFB.user) { out.innerHTML = '<div class="mp-empty">برای ساخت برنامه هوشمند، اول با گوگل وارد شو 🌿</div>'; return; }
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    loadUsage();
  }, 400);

  async function headers() {
    const t = (await DFB.sb.auth.getSession()).data.session.access_token;
    return { 'X-Supabase-Auth': t, 'Authorization': 'Bearer ' + t };
  }
  async function loadUsage() {
    try {
      const r = await fetch('/api/ai', { headers: await headers() });
      if (!r.ok) { chip.textContent = '—'; return; }
      const j = await r.json();
      chip.textContent = faN(j.used) + ' از ' + faN(j.limit) + ' پاسخ این ماه';
    } catch (e) { chip.textContent = '—'; }
  }

  function macrosLine(d) {
    const parts = [];
    if (d.protein != null) parts.push('پروتئین ' + faN(d.protein) + 'g');
    if (d.carbs != null) parts.push('کربوهیدرات ' + faN(d.carbs) + 'g');
    if (d.fat != null) parts.push('چربی ' + faN(d.fat) + 'g');
    return parts.length ? `<span class="day-macros">${parts.join(' | ')}</span>` : '';
  }
  function renderPlan(plan) {
    last = plan;
    const days = plan.days || [];
    out.innerHTML = `<div style="text-align:center;margin:14px 0"><button id="mpPdf" class="btn">📥 دانلود PDF برنامه</button></div>` +
      days.map(d => `<div class="day-card"><h4><span>روز ${faN(d.day)}</span><small>${faN(d.kcal)} کالری</small></h4>${macrosLine(d)}
      ${d.meals.map(m => `<div class="meal-line"><b>${esc(m.type_fa)}</b><a href="recipe.html?slug=${esc(m.slug)}">${esc(m.title)}</a><small>${faN(m.kcal)} کالری${m.protein != null ? ' | ' + faN(m.protein) + 'g پروتئین' : ''}${m.note ? ' — ' + esc(m.note) : ''}</small></div>`).join('')}
    </div>`).join('') +
      ((plan.constraints && plan.constraints.length) ? `<div class="info-card"><h4>⚙️ محدودیت‌ها و اهداف اعمال‌شده</h4><ul>${plan.constraints.map(c => `<li>• ${esc(c)}</li>`).join('')}</ul></div>` : '') +
      (plan.activity ? `<div class="info-card"><h4>🏃 پیشنهاد فعالیت</h4><ul>${plan.activity.items.map(a => `<li>• ${esc(a)}</li>`).join('')}${plan.activity.note ? `<li>• ${esc(plan.activity.note)}</li>` : ''}</ul><p style="color:#8a6d00;background:#fff8e6;border-radius:12px;padding:10px;margin-top:8px;font-size:11px">${esc(plan.activity.disclaimer)}</p></div>` : '') ||
      '<div class="mp-empty">برنامه‌ای ساخته نشد</div>';
    document.getElementById('mpPdf').onclick = () => genPdf(last);
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function genPdf(plan) {
    const days = plan.days || [];
    if (!days.length) return;
    await new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    const doc = document.getElementById('pdfDoc');
    const total = days.reduce((s, d) => s + (d.kcal || 0), 0);
    const wrap = inner => `<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">${inner}</div>`;
    const secs = [];
    secs.push(wrap(`<div style="background:#2d6a35;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.9;margin-top:6px">برنامه غذایی هوشمند — ${faN(days.length)} روز</div></div>
      <img src="img/logo.png" alt="DailyFitBeat" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ${new Date().toLocaleDateString('fa-IR')}</div>
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>میانگین کالری روزانه:</b> ${faN(Math.round(total / days.length))}</div>
      </div>`));
    if (plan.constraints && plan.constraints.length) secs.push(wrap(`<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>⚙️ محدودیت‌ها و اهداف:</b><br>${plan.constraints.map(c => '• ' + esc(c)).join('<br>')}</div>`));
    days.forEach(d => secs.push(wrap(`<div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ${faN(d.day)} — ${faN(d.kcal)} کالری${d.protein != null ? ' | ' + faN(d.protein) + 'g پروتئین' : ''}${d.carbs != null ? ' | ' + faN(d.carbs) + 'g کربوهیدرات' : ''}${d.fat != null ? ' | ' + faN(d.fat) + 'g چربی' : ''}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
        <tr style="background:#e8f4e9"><th style="padding:8px;text-align:right">وعده</th><th style="padding:8px;text-align:right">رسپی</th><th style="padding:8px;text-align:right">کالری</th><th style="padding:8px;text-align:right">پروتئین</th><th style="padding:8px;text-align:right">یادداشت</th></tr>
        ${d.meals.map(m => `<tr style="border-bottom:1px solid #e5efe5"><td style="padding:8px;font-weight:700">${esc(m.type_fa)}</td><td style="padding:8px">${esc(m.title)}</td><td style="padding:8px">${faN(m.kcal)}</td><td style="padding:8px">${m.protein != null ? faN(m.protein) + 'g' : '—'}</td><td style="padding:8px;color:#557">${esc(m.note || '')}</td></tr>`).join('')}
      </table>`));
    if (plan.activity) secs.push(wrap(`<div style="background:#e8f4e9;border-radius:14px;padding:16px"><b>🏃 پیشنهاد فعالیت:</b><br>${plan.activity.items.map(a => '• ' + esc(a)).join('<br>')}${plan.activity.note ? '<br>• ' + esc(plan.activity.note) : ''}<br><small style="color:#557">${esc(plan.activity.disclaimer)}</small></div>`));
    secs.push(wrap(`<div style="border-top:2px solid #e8f4e9;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#77807a"><span>dailyfitbeat.ir</span><span>اینستاگرام: @dailyfitbeat</span><span>خوب بخور، بهتر زندگی کن 💚</span></div>`));

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 10;
    for (let i = 0; i < secs.length; i++) {
      doc.innerHTML = secs[i];
      await document.fonts.ready;
      const canvas = await html2canvas(doc.firstElementChild, { scale: 2, backgroundColor: '#fff' });
      let w = 200, h = canvas.height * w / canvas.width;
      if (h > 277) { const s2 = 277 / h; w *= s2; h *= s2; }
      if (y + h > 287) { pdf.addPage(); y = 10; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w) / 2, y, w, h);
      y += h + 6;
    }
    pdf.save('DailyFitBeat-MealPlan.pdf');
  }

  document.getElementById('mpGo').onclick = async () => {
    const btn = document.getElementById('mpGo');
    btn.disabled = true; btn.textContent = 'در حال ساخت برنامه…';
    out.innerHTML = '<div class="mp-empty">🍳 در حال چیدن وعده‌ها از رسپی‌های واقعی…</div>';
    const meals = [];
    if (document.getElementById('mB').checked) meals.push('breakfast');
    if (document.getElementById('mSA').checked) meals.push('snack_am');
    if (document.getElementById('mL').checked) meals.push('lunch');
    if (document.getElementById('mSP').checked) meals.push('snack_pm');
    if (document.getElementById('mD').checked) meals.push('dinner');
    const ingText = document.getElementById('mpIng').value;
    const have = (Array.isArray(ING) ? ING : []).filter(i => i.fa && ingText.includes(i.fa)).map(i => i.key);
    try {
      const r = await fetch('/api/mealplan', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, await headers()),
        body: JSON.stringify({ days: +document.getElementById('mpDays').value, meals, have: have.length ? have : undefined, include_profile: document.getElementById('mpProf').checked, save: false })
      });
      const j = await r.json();
      if (r.ok) { renderPlan(j.plan); loadUsage(); }
      else if (r.status === 429 && j.error === 'quota_exceeded') out.innerHTML = '<div class="mp-empty">سهمیه این ماهت تمام شده — <a href="pro.html">ارتقا به PRO</a></div>';
      else if (r.status === 429) out.innerHTML = '<div class="mp-empty">یک لحظه صبر کن و دوباره امتحان کن ⏳</div>';
      else if (r.status === 503) out.innerHTML = '<div class="mp-empty">سرویس هوشمند فعلاً در دسترس نیست.</div>';
      else if (j.error === 'recipe_catalog_unavailable') out.innerHTML = '<div class="mp-empty">رسپی مطابق محدودیت‌هات پیدا نشد؛ موارد ممنوع رو کمتر کن.</div>';
      else out.innerHTML = '<div class="mp-empty">یه مشکل موقت پیش اومد؛ دوباره امتحان کن 🌱</div>';
    } catch (e) { out.innerHTML = '<div class="mp-empty">اتصال اینترنتت رو چک کن.</div>'; }
    btn.disabled = false; btn.textContent = '✨ ساخت برنامه';
  };
})();
