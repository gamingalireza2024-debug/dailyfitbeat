(async () => {
  const f = document.getElementById('planForm');
  if(!f) return;
  const r = await fetch('/api/db?t=all');
  const ALL = await r.json();
  f.onsubmit = e => {
    e.preventDefault();
    const sex = document.getElementById('pSex').value;
    const age = +document.getElementById('pAge').value;
    const h = +document.getElementById('pH').value;
    const w = +document.getElementById('pW').value;
    const act = +document.getElementById('pAct').value;
    const goal = document.getElementById('pGoal').value;
    const bmr = 10*w + 6.25*h - 5*age + (sex === 'm' ? 5 : -161);
    let target = Math.round(bmr * act);
    if(goal === 'loss') target -= 400;
    if(goal === 'gain') target += 300;
    const protein = Math.round(w * (goal === 'loss' ? 1.9 : goal === 'gain' ? 1.8 : 1.5));
    const B = ALL.filter(x => x.category === 'breakfast');
    const L = ALL.filter(x => x.category === 'iranian' || x.category === 'main');
    const D = ALL.filter(x => ['salad','soup','sandwich'].includes(x.category));
    if(!B.length || !L.length || !D.length){ document.getElementById('planOut').innerHTML = '<p>رسپی کافی نیست</p>'; return; }
    const days = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
    let html = `<div class="plan-target">🎯 هدف روزانه تو: ${target} کالری و ${protein} گرم پروتئین</div>`;
    const picked = [];
    days.forEach((d, i) => {
      const b = B[i % B.length], l = L[i % L.length], dn = D[(i*2) % D.length];
      picked.push(b, l, dn);
      const tot = (b.kcal||0) + (l.kcal||0) + (dn.kcal||0);
      html += `<div class="day-card"><h4>${d} — مجموع تقریبی ${tot} کالری</h4>
      <div class="meal-row"><span>🌅 صبحانه: <b>${b.name_fa}</b></span><span>${b.kcal} کالری</span></div>
      <div class="meal-row"><span>☀️ ناهار: <b>${l.name_fa}</b></span><span>${l.kcal} کالری</span></div>
      <div class="meal-row"><span>🌙 شام: <b>${dn.name_fa}</b></span><span>${dn.kcal} کالری</span></div></div>`;
    });
    const shop = {};
    picked.forEach(rc => (Array.isArray(rc.ingredients) ? rc.ingredients : []).forEach(g => { shop[g.fa] = (shop[g.fa] || []); shop[g.fa].push(g.q); }));
    html += `<div class="shop-list"><h3>🛒 لیست خرید هفته</h3><ul>` + Object.keys(shop).map(k => `<li>${k}</li>`).join('') + `</ul></div>`;
    document.getElementById('planOut').innerHTML = html;
    try { localStorage.setItem('dfb-plan', JSON.stringify({ target, protein, at: Date.now() })); } catch(e){}
  };
})();
