(function () {
  if (document.body.dataset.page !== 'admin') return;
  let sb = null, started = false;
  const wait = setInterval(() => {
    if (started || !window.DFB || !DFB.sb) return;
    if (DFB.isAdmin()) { started = true; clearInterval(wait); sb = DFB.sb; init(); }
  }, 400);

  async function init() {
    document.querySelectorAll('.atab').forEach(b => b.onclick = () => {
      document.querySelectorAll('.atab').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.querySelectorAll('.apane').forEach(p => p.style.display = (p.id === 'pane-' + b.dataset.t) ? 'block' : 'none');
    });
    await loadProds(); await loadPlans(); await loadRecipes();
    bindProdAdd(); bindPlanAdd(); bindRecipeForm();
  }

  // ---------- محصولات ----------
  async function loadProds() {
    const data = await (await fetch('/api/db?t=products')).json();
    if (!Array.isArray(data)) return;
    document.getElementById('prodBody2').innerHTML = data.map(p => `<tr>
      <td><b>${p.title_fa}</b></td>
      <td><input type="number" data-id="${p.id}" data-f="price_rial" value="${p.price_rial}"></td>
      <td><input type="number" data-id="${p.id}" data-f="old_price_rial" value="${p.old_price_rial || ''}"></td>
      <td><input type="number" data-id="${p.id}" data-f="off_percent" value="${p.off_percent || 0}"></td>
      <td><input type="number" step="0.1" data-id="${p.id}" data-f="rating" value="${p.rating}"></td>
      <td><input class="imgin" data-id="${p.id}" data-f="image" value="${p.image || ''}"></td>
      <td><input type="checkbox" data-id="${p.id}" data-f="active" ${p.active ? 'checked' : ''}></td>
      <td><button class="btn small svP" data-id="${p.id}">ذخیره</button></td>
      <td><button class="del-btn dlP" data-id="${p.id}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.svP').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, upd = {};
      document.querySelectorAll(`#prodBody2 [data-id="${id}"][data-f]`).forEach(i => {
        if (i.dataset.f === 'active') upd.active = i.checked;
        else if (i.dataset.f === 'image') upd.image = i.value || null;
        else upd[i.dataset.f] = i.value === '' ? null : +i.value;
      });
      const { error } = await sb.from('products').update(upd).eq('id', id);
      if (error) { alert('خطا: ' + error.message); return; }
      alert('ذخیره شد ✅'); loadProds();
    });
    document.querySelectorAll('.dlP').forEach(b => b.onclick = async () => {
      if (!confirm('این محصول حذف بشه؟')) return;
      await sb.from('products').delete().eq('id', b.dataset.id);
      loadProds();
    });
  }
  function bindProdAdd() {
    document.getElementById('aAdd').onclick = async () => {
      const t = document.getElementById('aTitle').value.trim();
      const pr = +document.getElementById('aPrice').value;
      if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
      await sb.from('products').insert({
        title_fa: t,
        desc_fa: document.getElementById('aDesc').value.trim(),
        price_rial: pr,
        old_price_rial: +document.getElementById('aOld').value || null,
        off_percent: +document.getElementById('aOff').value || 0,
        rating: +document.getElementById('aRate').value || 4.8,
        image: document.getElementById('aImg').value || null
      });
      ['aTitle','aDesc','aPrice','aOld','aOff','aImg'].forEach(id => document.getElementById(id).value = '');
      loadProds();
    };
  }

  // ---------- پلان‌ها ----------
  async function loadPlans() {
    const data = await (await fetch('/api/db?t=plans')).json();
    if (!Array.isArray(data)) return;
    document.getElementById('plansBody2').innerHTML = data.map(p => `<tr>
      <td><input data-id="${p.id}" data-f="title_fa" value="${p.title_fa}"></td>
      <td><input data-id="${p.id}" data-f="period" value="${p.period}"></td>
      <td><input type="number" data-id="${p.id}" data-f="price_rial" value="${p.price_rial}"></td>
      <td><input type="number" data-id="${p.id}" data-f="old_price_rial" value="${p.old_price_rial || ''}"></td>
      <td><textarea data-id="${p.id}" data-f="features">${(p.features || []).join('\n')}</textarea></td>
      <td><button class="btn small svL" data-id="${p.id}">ذخیره</button></td>
      <td><button class="del-btn dlL" data-id="${p.id}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.svL').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, upd = {};
      document.querySelectorAll(`#plansBody2 [data-id="${id}"][data-f]`).forEach(i => {
        if (i.dataset.f === 'features') upd.features = i.value.split('\n').map(s => s.trim()).filter(Boolean);
        else if (i.dataset.f === 'title_fa' || i.dataset.f === 'period') upd[i.dataset.f] = i.value;
        else upd[i.dataset.f] = i.value === '' ? null : +i.value;
      });
      const { error } = await sb.from('plans').update(upd).eq('id', id);
      if (error) { alert('خطا: ' + error.message); return; }
      alert('ذخیره شد ✅'); loadPlans();
    });
    document.querySelectorAll('.dlL').forEach(b => b.onclick = async () => {
      if (!confirm('این پلان حذف بشه؟')) return;
      await sb.from('plans').delete().eq('id', b.dataset.id);
      loadPlans();
    });
  }
  function bindPlanAdd() {
    document.getElementById('pAdd').onclick = async () => {
      const t = document.getElementById('pTitle').value.trim();
      const pr = +document.getElementById('pPrice').value;
      if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
      await sb.from('plans').insert({
        key: 'plan-' + Date.now(),
        title_fa: t,
        period: document.getElementById('pPeriod').value || 'ماهانه',
        price_rial: pr,
        old_price_rial: +document.getElementById('pOld').value || null,
        features: []
      });
      ['pTitle','pPeriod','pPrice','pOld'].forEach(id => document.getElementById(id).value = '');
      loadPlans();
    };
  }

  // ---------- رسپی‌ها ----------
  let REC_CACHE = [];
  async function loadRecipes() {
    const data = await (await fetch('/api/db?t=all')).json();
    REC_CACHE = Array.isArray(data) ? data : [];
    document.getElementById('recBody').innerHTML = REC_CACHE.map(r => `<tr>
      <td><b>${r.name_fa}</b><br><small dir="ltr">${r.slug}</small></td>
      <td>${r.category}</td>
      <td>${r.region || '-'}</td>
      <td>${r.kcal}</td>
      <td><img src="${r.image || ''}" style="width:44px;height:44px;border-radius:10px;object-fit:cover"></td>
      <td><button class="btn small edR" data-s="${r.slug}">ویرایش</button></td>
      <td><button class="del-btn dlR" data-s="${r.slug}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.edR').forEach(b => b.onclick = () => fillForm(REC_CACHE.find(x => x.slug === b.dataset.s)));
    document.querySelectorAll('.dlR').forEach(b => b.onclick = async () => {
      if (!confirm('این رسپی حذف بشه؟')) return;
      await sb.from('recipes').delete().eq('slug', b.dataset.s);
      loadRecipes();
    });
  }
  function fillForm(r) {
    const g = id => document.getElementById(id);
    g('rSlug').value = r ? r.slug : ''; g('rSlug').disabled = !!r;
    g('rNameFa').value = r ? r.name_fa : '';
    g('rNameEn').value = r ? (r.name_en || '') : '';
    g('rCat').value = r ? r.category : 'main';
    g('rRegion').value = r ? (r.region || '') : 'ایران';
    g('rTime').value = r ? r.time_min : '';
    g('rKcal').value = r ? r.kcal : '';
    g('rProtein').value = r ? r.protein : '';
    g('rCarbs').value = r && r.carbs != null ? r.carbs : '';
    g('rFat').value = r && r.fat != null ? r.fat : '';
    g('rFiber').value = r && r.fiber != null ? r.fiber : '';
    g('rSugar').value = r && r.sugar != null ? r.sugar : '';
    g('rImage').value = r ? (r.image || '') : '';
    g('rVideo').value = r ? (r.video_url || '') : '';
    g('rTags').value = r ? (r.tags || []).join(',') : '';
    g('rKeys').value = r ? (r.keys || []).join(',') : '';
    g('rDesc').value = r ? (r.desc_fa || '') : '';
    g('rIngs').value = r ? (r.ingredients || []).map(i => i.fa + ':' + i.q).join('\n') : '';
    g('rSteps').value = r ? (r.steps || []).join('\n') : '';
    g('rTips').value = r ? (r.tips || []).join('\n') : '';
    const f = document.getElementById('recForm');
    f.style.display = 'grid';
    f.scrollIntoView({ behavior: 'smooth' });
  }
  function bindRecipeForm() {
    document.getElementById('rNew').onclick = () => fillForm(null);
    document.getElementById('rSave').onclick = async () => {
      const g = id => document.getElementById(id).value;
      const slug = g('rSlug').trim();
      if (!slug || !g('rNameFa').trim()) { alert('slug و نام فارسی لازمه'); return; }
      const obj = {
        slug,
        name_fa: g('rNameFa').trim(),
        name_en: g('rNameEn').trim() || g('rNameFa').trim(),
        category: g('rCat'),
        region: g('rRegion').trim() || 'ایران',
        time_min: +g('rTime') || 30,
        kcal: +g('rKcal') || 0,
        protein: +g('rProtein') || 0,
        carbs: g('rCarbs') === '' ? null : +g('rCarbs'),
        fat: g('rFat') === '' ? null : +g('rFat'),
        fiber: g('rFiber') === '' ? null : +g('rFiber'),
        sugar: g('rSugar') === '' ? null : +g('rSugar'),
        image: g('rImage').trim() || null,
        video_url: g('rVideo').trim() || null,
        desc_fa: g('rDesc').trim(),
        tags: g('rTags').split(',').map(s => s.trim()).filter(Boolean),
        keys: g('rKeys').split(',').map(s => s.trim()).filter(Boolean),
        ingredients: g('rIngs').split('\n').map(l => { const [fa, q] = l.split(':'); return { fa: (fa || '').trim(), q: (q || '').trim() || 'به‌اندازه' }; }).filter(i => i.fa),
        steps: g('rSteps').split('\n').map(s => s.trim()).filter(Boolean),
        tips: g('rTips').split('\n').map(s => s.trim()).filter(Boolean)
      };
      const exists = REC_CACHE.find(x => x.slug === slug);
            const res = exists
        ? await sb.from('recipes').update(obj).eq('slug', slug)
        : await sb.from('recipes').insert(obj);
      if (res.error) { alert('خطا: ' + res.error.message); return; }
      alert('ذخیره شد ✅');
      document.getElementById('recForm').style.display = 'none';
      loadRecipes();
    };
  }
})();
