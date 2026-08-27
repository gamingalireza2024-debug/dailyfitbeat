(async function () {
  if (document.body.dataset.page !== 'mealplan') return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const faN = n => (Number(n) || 0).toLocaleString('fa-IR');
  const out = document.getElementById('mpOut');
  const hist = document.getElementById('mpHist');
  const chip = document.getElementById('mpUsage');
  let ING = [];

  const t0 = setInterval(async () => {
    if (!window.DFB || !DFB.sb) return;
    clearInterval(t0);
    if (!DFB.user) {
      out.innerHTML = '<div class="mp-empty">برای ساخت برنامه هوشمند، اول با گوگل وارد شو 🌿</div>';
      return;
    }
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    loadUsage(); loadHist();
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
  async function loadHist() {
    const r = await fetch('/api/mealplan', { headers: await headers() });
    if (!r.ok) { hist.innerHTML = '<div class="mp-empty">—</div>'; return; }
    const list = await r.json();
    hist.innerHTML = (Array.isArray(list) && list.length) ? list.map(p => `<div class="hist-item"><span>${esc(p.title)} — ${new Date(p.created_at).toLocaleDateString('fa-IR')}</span><span><button class="btn small hv" data-id="${p.id}">نمایش</button> <button class="del-btn hd" data-id="${p.id}" style="background:#d33;color:#fff;border:0;border-radius:8px;padding:6px 10px;cursor:pointer">حذف</button></span></div>`).join('') : '<div class="mp-empty">هنوز برنامه‌ای ذخیره نکردی</div>';
    hist.querySelectorAll('.hv').forEach(b => b.onclick = async () => {
      const r2 = await fetch('/api/mealplan', { headers: await headers() });
      const list2 = await r2.json();
      const p = (list2 || []).find(x => x.id === +b.dataset.id);
      if (p) renderPlan(p.days);
    });
    hist.querySelectorAll('.hd').forEach(b => b.onclick = async () => {
      if (!confirm('حذف بشه؟')) return;
      await fetch('/api/mealplan?id=' + b.dataset.id, { method: 'DELETE', headers: await headers() });
      loadHist();
    });
  }
  function renderPlan(days) {
    out.innerHTML = (Array.isArray(days) ? days : []).map(d => `<div class="day-card"><h4><span>روز ${faN(d.day)}</span><small>${faN(d.kcal)} کالری</small></h4>
      ${d.meals.map(m => `<div class="meal-line"><b>${esc(m.type_fa)}</b><a href="recipe.html?slug=${esc(m.slug)}">${esc(m.title)}</a><small>${faN(m.kcal)} کالری${m.note ? ' — ' + esc(m.note) : ''}</small></div>`).join('')}
    </div>`).join('') || '<div class="mp-empty">برنامه‌ای ساخته نشد</div>';
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('mpGo').onclick = async () => {
    const btn = document.getElementById('mpGo');
    btn.disabled = true; btn.textContent = 'در حال ساخت برنامه…';
    out.innerHTML = '<div class="mp-empty">🍳 دستیار در حال چیدن وعده‌ها از رسپی‌های واقعیه…</div>';
    const meals = [];
    if (document.getElementById('mB').checked) meals.push('breakfast');
    if (document.getElementById('mL').checked) meals.push('lunch');
    if (document.getElementById('mS').checked) meals.push('snack');
    if (document.getElementById('mD').checked) meals.push('dinner');
    const ingText = document.getElementById('mpIng').value;
    const have = (Array.isArray(ING) ? ING : []).filter(i => i.fa && ingText.includes(i.fa)).map(i => i.key);
    try {
      const r = await fetch('/api/mealplan', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, await headers()),
        body: JSON.stringify({
          days: +document.getElementById('mpDays').value,
          meals,
          have: have.length ? have : undefined,
          include_profile: document.getElementById('mpProf').checked,
          save: document.getElementById('mpSave').checked
        })
      });
      const j = await r.json();
      if (r.ok) { renderPlan(j.plan.days); loadUsage(); loadHist(); }
      else if (r.status === 429 && j.error === 'quota_exceeded') out.innerHTML = '<div class="mp-empty">سهمیه این ماهت تمام شده — <a href="pro.html">ارتقا به PRO</a></div>';
      else if (r.status === 429) out.innerHTML = '<div class="mp-empty">یک لحظه صبر کن و دوباره امتحان کن ⏳</div>';
      else if (r.status === 503) out.innerHTML = '<div class="mp-empty">سرویس هوشمند فعلاً در دسترس نیست.</div>';
      else out.innerHTML = '<div class="mp-empty">یه مشکل موقت پیش اومد؛ دوباره امتحان کن 🌱</div>';
    } catch (e) {
      out.innerHTML = '<div class="mp-empty">اتصال اینترنتت رو چک کن.</div>';
    }
    btn.disabled = false; btn.textContent = '✨ ساخت برنامه';
  };
})();
