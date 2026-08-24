(function(){
  const $ = s => document.querySelector(s);
  if(!$('#bmrV')) return;
  let ALL = [];
  fetch('/api/db?t=all').then(r => r.json()).then(d => ALL = Array.isArray(d) ? d : []);
  const st = { sex: 'f', unit: 'm' };
  const fmt = n => Math.round(n).toLocaleString('en-US');

  function read(){
    let h = +$('#iH').value || 170, w = +$('#iW').value || 75;
    if(st.unit === 'i'){ h *= 2.54; w *= 0.4536; }
    return { age: +$('#iAge').value || 29, h, w, act: +$('#iAct').value, goal: $('#iGoal').value, rate: +$('#iRate').value };
  }
  function calc(){
    const v = read();
    const bmr = 10*v.w + 6.25*v.h - 5*v.age + (st.sex === 'm' ? 5 : -161);
    const tdee = bmr * v.act;
    let target = tdee;
    if(v.goal === 'loss') target -= v.rate * 1000;
    if(v.goal === 'gain') target += 300;
    target = Math.max(1200, target);
    $('#bmrV').textContent = fmt(bmr);
    $('#tdeeV').textContent = fmt(tdee);
    $('#tgtV').textContent = fmt(target);
    const pg = Math.round(target*0.29/4), cg = Math.round(target*0.40/4), fg = Math.round(target*0.30/9);
    $('#mPro').textContent = pg + 'g';
    $('#mCarb').textContent = cg + 'g';
    $('#mFat').textContent = fg + 'g';
    const d = $('#donut');
    d.dataset.c = fmt(target);
    d.style.background = 'conic-gradient(#2d6a35 0 29%, #e9b949 29% 69%, #4a90d9 69% 100%)';
    $('#wV').textContent = (v.w*0.036).toFixed(1) + ' L';
    $('#fibV').textContent = Math.round(target/1000*14) + ' گرم';
    $('#caV').textContent = '1000 mg';
    $('#vitCV').textContent = (st.sex === 'f' ? 75 : 90) + ' mg';
    $('#vitDV').textContent = '600 IU';
    $('#feV').textContent = (st.sex === 'f' ? 18 : 8) + ' mg';
    return { target, pg };
  }
  document.querySelectorAll('#sexTog button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#sexTog button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); st.sex = b.dataset.v; calc();
  });
  document.querySelectorAll('#unitTog button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#unitTog button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); st.unit = b.dataset.v; calc();
  });
  ['iAge','iH','iW','iAct','iGoal','iRate'].forEach(id => { const el = document.getElementById(id); if(el) el.oninput = calc; el.onchange = calc; });
  calc();

  const go = $('#goPlan');
  if(go) go.onclick = () => {
    const { target } = calc();
    if(!ALL.length){ alert('رسپی‌ها هنوز بارگذاری نشدن؛ چند ثانیه صبر کن'); return; }
    const B = ALL.filter(x => x.category === 'breakfast');
    const L = ALL.filter(x => x.category === 'iranian' || x.category === 'main');
    const D = ALL.filter(x => ['salad','soup','sandwich'].includes(x.category));
    if(!B.length || !L.length || !D.length){ alert('رسپی کافی نیست'); return; }
    const days = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
    let html = `<div class="plan-target">🎯 برنامه هفتگی تو بر اساس ${fmt(target)} کالری روزانه آماده شد</div>`;
    const picked = [];
    days.forEach((dname, i) => {
      const b = B[i % B.length], l = L[(i*3) % L.length], dn = D[(i*2) % D.length];
      picked.push(b, l, dn);
      const tot = (b.kcal||0) + (l.kcal||0) + (dn.kcal||0);
      html += `<div class="day-card"><h4>📅 ${dname} — مجموع تقریبی ${tot.toLocaleString('fa-IR')} کالری</h4>
      <div class="meal-row"><span>🌅 صبحانه: <b>${b.name_fa}</b></span><span>${(b.kcal||0).toLocaleString('fa-IR')} کالری</span></div>
      <div class="meal-row"><span>☀️ ناهار: <b>${l.name_fa}</b></span><span>${(l.kcal||0).toLocaleString('fa-IR')} کالری</span></div>
      <div class="meal-row"><span>🌙 شام: <b>${dn.name_fa}</b></span><span>${(dn.kcal||0).toLocaleString('fa-IR')} کالری</span></div></div>`;
    });
    const shop = {};
    picked.forEach(rc => (Array.isArray(rc.ingredients) ? rc.ingredients : []).forEach(g => { shop[g.fa] = 1; }));
    html += `<div class="shop-list"><h3>🛒 لیست خرید هفته</h3><ul>` + Object.keys(shop).map(k => `<li>${k}</li>`).join('') + `</ul></div>`;
    $('#planOut').innerHTML = html;
    $('#planOut').scrollIntoView({ behavior: 'smooth' });
  };
})();
