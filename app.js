async function initDetail(){
  if(page !== 'recipe') return;
  const slug = new URLSearchParams(location.search).get('slug');
  await loadAll();
  const r = ALL.find(x => x.slug === slug);
  const el = $('#rd');
  if(!r){ el.innerHTML = '<p class="no-res">پیدا نشد</p>'; return; }
  document.title = r.name_fa + ' | DailyFitBeat';
  if (window.DFB_setRecipeMeta) window.DFB_setRecipeMeta(r);
  const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
  let favOn = false;
  if(sb && USER){ const { data } = await sb.from('favorites').select('id').eq('recipe_slug', r.slug).maybeSingle(); favOn = !!data; }
  
  // جدول ارزش غذایی با progress bars
  const nutritionBars = `
    <div class="nutrition-grid">
      <div class="nut-bar"><b>${r.kcal || 0}</b><span>کالری</span><div class="bar"><div style="width:${Math.min(100, (r.kcal/2000)*100)}%"></div></div></div>
      <div class="nut-bar"><b>${r.protein || 0}g</b><span>پروتئین</span><div class="bar"><div style="width:${Math.min(100, (r.protein/50)*100)}%"></div></div></div>
      ${r.carbs != null ? `<div class="nut-bar"><b>${r.carbs}g</b><span>کربوهیدرات</span><div class="bar"><div style="width:${Math.min(100, (r.carbs/100)*100)}%"></div></div></div>` : ''}
      ${r.fat != null ? `<div class="nut-bar"><b>${r.fat}g</b><span>چربی</span><div class="bar"><div style="width:${Math.min(100, (r.fat/70)*100)}%"></div></div></div>` : ''}
      ${r.fiber != null ? `<div class="nut-bar"><b>${r.fiber}g</b><span>فیبر</span><div class="bar"><div style="width:${Math.min(100, (r.fiber/30)*100)}%"></div></div></div>` : ''}
    </div>`;

  // مراحل پخت (اگه باشه)
  const stepsHtml = Array.isArray(r.steps) && r.steps.length ? `
    <div class="steps-section">
      <h3>مراحل پخت</h3>
      <ol class="steps-list">
        ${r.steps.map((s, i) => `<li><span class="step-num">${i+1}</span><p>${s}</p></li>`).join('')}
      </ol>
    </div>` : '';

  // نکات پخت (اگه باشه)
  const tipsHtml = Array.isArray(r.tips) && r.tips.length ? `
    <div class="tips-section">
      <h3>💡 نکات پخت</h3>
      <ul class="tips-list">
        ${r.tips.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>` : '';

  // جایگزین‌ها (اگه باشه)
  const subsHtml = Array.isArray(r.substitutions) && r.substitutions.length ? `
    <div class="subs-section">
      <h3>🔄 جایگزین‌ها</h3>
      <div class="subs-grid">
        ${r.substitutions.map(s => `<div class="sub-card"><b>${s.from}</b><span>→</span><b>${s.to}</b></div>`).join('')}
      </div>
    </div>` : '';

  // ویدیو (اگه باشه)
  const videoHtml = r.video_url ? `
    <div class="video-section">
      <h3>🎬 ویدیوی پخت</h3>
      <a href="${r.video_url}" target="_blank" rel="noopener" class="video-card">
        <div class="video-thumb"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" alt="${r.name_fa}"><span class="play-btn">▶</span></div>
        <p>تماشای ویدیو در اینستاگرام</p>
      </a>
    </div>` : '';

  el.innerHTML = `<div class="container rd-wrap">
  <div class="rd-img"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" alt="${r.name_fa}"><button id="favBtn" class="heart${favOn?' on':''}">♥</button></div>
  <div class="rd-info">
    <span class="rd-region">${countryFa(r.region)}</span>
    <h1>${r.name_fa}</h1><p class="rd-en">${r.name_en}</p>
    <p class="rd-desc">${r.desc_fa || ''}</p>
    
    <div class="rd-stats">
      <div><b>${r.time_min}</b><span>زمان پخت (دقیقه)</span></div>
      <div><b>${diff(r.time_min)}</b><span>سطح دشواری</span></div>
    </div>

    ${nutritionBars}

    <h3>مواد لازم</h3>
    <ul class="ing-list">${ings.map(i => `<li>${i.fa}<span>${i.q}</span></li>`).join('')}</ul>
    
    ${stepsHtml}
    ${tipsHtml}
    ${subsHtml}
    ${videoHtml}

    <div class="f-cta">
      <a class="btn" href="planner.html">افزودن به برنامه</a>
      <a class="btn ghost" href="recipes.html">همه رسپی‌ها</a>
    </div>
  </div></div>`;
  
  document.getElementById('favBtn').onclick = async () => {
    if(!USER){ alert('برای ذخیره علاقه‌مندی، اول با گوگل وارد شو ❤️'); doLogin(); return; }
    if(favOn){ await sb.from('favorites').delete().eq('user_id', USER.id).eq('recipe_slug', r.slug); favOn = false; }
    else { await sb.from('favorites').insert({ user_id: USER.id, recipe_slug: r.slug }); favOn = true; }
    document.getElementById('favBtn').classList.toggle('on', favOn);
  };
}
