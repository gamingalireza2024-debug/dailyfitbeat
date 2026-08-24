(function () {
  if (document.body.dataset.page !== 'admin') return;
  let sb = null, started = false;
  const wait = setInterval(() => {
    if (started || !window.DFB || !DFB.sb) return;
    if (DFB.isAdmin()) {
      started = true;
      clearInterval(wait);
      sb = DFB.sb;
      init();
    }
  }, 400);

  async function init() {
    document.querySelectorAll('.atab').forEach(b => b.onclick = () => {
      document.querySelectorAll('.atab').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.querySelectorAll('.apane').forEach(p => p.style.display = (p.id === 'pane-' + b.dataset.t) ? 'block' : 'none');
    });
    await loadProds(); await loadPlans();
    bindProdAdd(); bindPlanAdd();
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
})();
