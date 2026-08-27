(async function () {
  if (document.body.dataset.page !== 'planner') return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const faN = n => (Number(n) || 0).toLocaleString('fa-IR');
  const out = document.getElementById('plOut');
  const shopWrap = document.getElementById('plShopWrap');
  const pdfBtn = document.getElementById('plPdf');
  const MEALS = [
    { key: 'breakfast', fa: 'صبحانه', share: 0.25, cats: ['breakfast'] },
    { key: 'snack_am', fa: 'میان‌وعده صبح', share: 0.10, light: true },
    { key: 'lunch', fa: 'ناهار', share: 0.35, cats: ['main', 'iranian', 'soup'] },
    { key: 'snack_pm', fa: 'میان‌وعده عصر', share: 0.10, light: true },
    { key: 'dinner', fa: 'شام', share: 0.20, cats: ['iranian', 'main', 'soup'] }
  ];
  let ALL = [], last = null;

  (async () => {
    ALL = await (await fetch('/api/db?t=all')).json().catch(() => []);
    if (window.DFB && DFB.user && document.getElementById('plProf').checked) {
      try {
        const s = (await DFB.sb.auth.getSession()).data.session;
        if (s) {
          const r = await fetch('/api/nutrition', { headers: { 'X-Supabase-Auth': s.access_token, Authorization: 'Bearer ' + s.access_token } });
          const p = await r.json();
          if (p && p.calorie_target) document.getElementById('plKcal').value = p.calorie_target;
        }
      } catch (e) {}
    }
  })();

  function pick(pool, seed, daySet) {
    if (!pool.length) return null;
    for (let i = 0; i < pool.length; i++) {
      const r = pool[(seed + i) % pool.length];
      if (!daySet.has(r.slug)) { daySet.add(r.slug); return r; }
    }
    return pool[seed % pool.length];
  }

  function generate() {
    const target = Math.min(6000, Math.max(800, +document.getElementById('plKcal').value || 2000));
    const lightPool = ALL.filter(r => (r.kcal || 0) > 0 && (r.kcal || 0) <= 350);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const daySet = new Set();
      const meals = MEALS.map((m, mi) => {
        const pool = m.light ? (lightPool.length ? lightPool : ALL) : ALL.filter(r => (m.cats || []).includes(r.category));
        const base = pool.length ? pool : ALL;
        const rec = pick(base, d * 7 + mi * 3, daySet);
        return rec ? { type: m.key, type_fa: m.fa, slug: rec.slug, title: rec.name_fa, kcal: rec.kcal || 0, protein: rec.protein != null ? rec.protein : null, ref: rec } : null;
      }).filter(Boolean);
      // تنظیم نزدیک به کالری هدف: اگر مجموع خیلی دور بود، با جابه‌جایی ساده اصلاح کن
      let total = meals.reduce((s, m) => s + m.kcal, 0);
      if (total && Math.abs(total - target) > target * 0.35) {
        const li = meals.findIndex(m => m.type === 'lunch');
        if (li >= 0) {
          const alt = ALL.filter(r => (['main', 'iranian', 'soup'].includes(r.category)) && !daySet.has(r.slug)).sort((a, b) => Math.abs((a.kcal || 0) - (target - (total - meals[li].kcal))) - Math.abs((b.kcal || 0) - (target - (total - meals[li].kcal))))[0];
          if (alt) { meals[li] = { type: 'lunch', type_fa: 'ناهار', slug: alt.slug, title: alt.name_fa, kcal: alt.kcal || 0, protein: alt.protein != null ? alt.protein : null, ref: alt }; total = meals.reduce((s, m) => s + m.kcal, 0); }
        }
      }
      days.push({ day: d + 1, meals, kcal: total });
    }
    // لیست خرید هفتگی از مواد هر ۵ وعده همه روزها
    const shop = {};
    days.forEach(d => d.meals.forEach(m => { (m.ref && m.ref.ingredients || []).forEach(i => { if (i.fa) shop[i.fa] = (shop[i.fa] || 0) + 1; }); }));
    const shopList = Object.entries(shop).sort((a, b) => b[1] - a[1]);
    last = { days, shopList, target };

    out.innerHTML = days.map(d => `<div class="day-card"><h4><span>روز ${faN(d.day)}</span><small>${faN(d.kcal)} کالری</small></h4>
      ${d.meals.map(m => `<div class="meal-line"><b>${esc(m.type_fa)}</b><span>${esc(m.title)}</span><small>${faN(m.kcal)} کالری${m.protein != null ? ' | ' + faN(m.protein) + 'g پروتئین' : ''}</small></div>`).join('')}
    </div>`).join('');
    shopWrap.innerHTML = `<div class="shop-card"><h3 style="font-size:14px;margin-bottom:8px">🛒 لیست خرید هفتگی</h3><ul>${shopList.map(([fa, c]) => `<li>• ${esc(fa)} <small>(${faN(c)} رسپی)</small></li>`).join('')}</ul></div>`;
    pdfBtn.disabled = false;
    out.scrollIntoView({ behavior: 'smooth' });
  }

  document.getElementById('plGo').onclick = generate;
  pdfBtn.onclick = () => last && genPdf(last);

  async function genPdf(plan) {
    await new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    const doc = document.getElementById('pdfDoc');
    const wrap = inner => `<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">${inner}</div>`;
    const secs = [];
    secs.push(wrap(`<div style="background:#2d6a35;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.9;margin-top:6px">برنامه غذایی هفتگی — ۵ وعده در روز</div></div>
      <img src="img/logo.png" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>کالری هدف:</b> ${faN(plan.target)}</div>
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ${new Date().toLocaleDateString('fa-IR')}</div>
      </div>`));
    plan.days.forEach(d => secs.push(wrap(`<div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ${faN(d.day)} — ${faN(d.kcal)} کالری</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
        <tr style="background:#e8f4e9"><th style="padding:8px;text-align:right">وعده</th><th style="padding:8px;text-align:right">رسپی</th><th style="padding:8px;text-align:right">کالری</th></tr>
        ${d.meals.map(m => `<tr style="border-bottom:1px solid #e5efe5"><td style="padding:8px;font-weight:700">${esc(m.type_fa)}</td><td style="padding:8px">${esc(m.title)}</td><td style="padding:8px">${faN(m.kcal)}</td></tr>`).join('')}
      </table>`));
    for (let i = 0; i < plan.shopList.length; i += 40) {
      const chunk = plan.shopList.slice(i, i + 40);
      secs.push(wrap(`<b>🛒 لیست خرید هفتگی${i ? ' (ادامه)' : ''}</b><br>${chunk.map(([fa, c]) => '• ' + esc(fa) + ` (${faN(c)} رسپی)`).join('<br>')}`));
    }
    secs.push(wrap(`<div style="border-top:2px solid #e8f4e9;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#77807a"><span>dailyfitbeat.ir</span><span>اینستاگرام: @dailyfitbeat</span><span>خوب بخور، بهتر زندگی کن 💚</span></div>`));
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
