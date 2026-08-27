(function () {
  if (document.body.dataset.page !== 'admin') return;
  let sb = null, started = false, REC = [];
  const wait = setInterval(() => {
    if (started || !window.DFB || !DFB.sb) return;
    if (DFB.isAdmin()) { started = true; clearInterval(wait); sb = DFB.sb; init(); }
  }, 400);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rialFa = n => (Number(n) || 0).toLocaleString('fa-IR') + ' ریال';
  const fmt = n => (Number(n) || 0).toLocaleString('fa-IR');
  const faDate = d => d ? new Date(d).toLocaleDateString('fa-IR') : '—';
  function normNum(s) {
    if (s === '' || s == null) return null;
    const t = String(s).replace(/[۰-۹]/g, x => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/[,،٬\s]/g, '');
    const n = Number(t);
    return isNaN(n) ? null : n;
  }
  function bindMoney(inp) {
    if (!inp || inp.dataset.money) return;
    inp.dataset.money = '1';
    inp.addEventListener('input', () => {
      const digits = inp.value.replace(/[۰-۹]/g, x => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/\D/g, '');
      inp.value = digits ? Number(digits).toLocaleString('fa-IR') : '';
    });
  }
  const OK_EXT = /\.(pdf|zip|rar|jpe?g|png|webp|mp4|mp3)$/i;
  async function tok() { const s = (await sb.auth.getSession()).data.session; return s ? s.access_token : null; }
  async function api(t, opts) {
    const token = await tok();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('/api/db?t=' + t, Object.assign({ headers }, opts || {}));
  }
  const STATUS_FA = { new: 'جدید', pending: 'در انتظار پرداخت', payment_submitted: 'واریز ثبت شده', under_review: 'در بررسی', paid: 'پرداخت شده', processing: 'در حال پردازش', delivered: 'تحویل شده', sent: 'ارسال شده', rejected: 'رد شده', cancelled: 'لغو شده', refunded: 'مسترد شده' };
  const PAY_FA = { pending: 'در انتظار', submitted: 'واریز ثبت شده', approved: 'تأیید شده', rejected: 'رد شده', refunded: 'مسترد' };
  const TYPE_FA = { DIGITAL_PRODUCT: 'محصول دیجیتال', SERVICE: 'خدمت', SUBSCRIPTION: 'اشتراک', BUNDLE: 'باندل' };
  const MFA = { breakfast: 'صبحانه', snack_am: 'میان‌وعده صبح', lunch: 'ناهار', snack_pm: 'میان‌وعده عصر', dinner: 'شام', snack: 'میان‌وعده' };
  function pager(el, page, total, lim, cb) {
    const pages = Math.max(1, Math.ceil(total / lim));
    el.innerHTML = `<button ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">قبلی</button><span>صفحه ${page.toLocaleString('fa-IR')} از ${pages.toLocaleString('fa-IR')} (${total.toLocaleString('fa-IR')} رکورد)</span><button ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">بعدی</button>`;
    el.querySelectorAll('button').forEach(b => b.onclick = () => cb(+b.dataset.p));
  }
  function bindJalali(id) {
    const inp = document.getElementById(id);
    if (!inp || inp.dataset.jal) return;
    inp.dataset.jal = '1';
    const sp = document.createElement('span'); sp.className = 'jal';
    inp.insertAdjacentElement('afterend', sp);
    const upd = () => sp.textContent = inp.value ? '= ' + new Date(inp.value).toLocaleDateString('fa-IR') : '';
    inp.addEventListener('change', upd); upd();
  }

  async function init() {
    document.querySelectorAll('.aside button').forEach(b => b.onclick = () => {
      document.querySelectorAll('.aside button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.querySelectorAll('.apane').forEach(p => p.style.display = (p.id === 'pane-' + b.dataset.t) ? 'block' : 'none');
      if (b.dataset.t === 'dash') loadDash();
      if (b.dataset.t === 'payments') loadPayments(1);
      if (b.dataset.t === 'users') loadUsers(document.getElementById('uq').value, 1);
      if (b.dataset.t === 'coupons') loadCoupons();
      if (b.dataset.t === 'audit') loadAudit();
      if (b.dataset.t === 'diet') { pickUsers(); loadDietList(); }
      if (b.dataset.t === 'orders') loadOrders(1);
    });
    await refreshREC();
    await loadDash(); await loadOrders(1); await loadProds(); await loadPlans(); await loadRecipes();
    bindJalali('dStart'); bindJalali('dEnd'); bindJalali('cEnd');
    ['aPrice', 'aOld', 'pPrice', 'pOld'].forEach(id => bindMoney(document.getElementById(id)));
    bindAll();
  }
  async function refreshREC() { REC = await (await fetch('/api/db?t=all')).json(); }

  async function loadDash() {
    const r = await api('admin_stats'); if (!r.ok) return;
    const s = await r.json();
    document.getElementById('statsBox').innerHTML = `
      <div class="sc"><b>${fmt(s.users)}</b><span>کاربران</span></div>
      <div class="sc"><b>${fmt(s.orders)}</b><span>سفارش‌ها</span></div>
      <div class="sc"><b>${fmt(s.paid_orders)}</b><span>پرداخت شده</span></div>
      <div class="sc"><b>${fmt(s.pending_orders)}</b><span>در انتظار</span></div>
      <div class="sc"><b>${rialFa(s.revenue)}</b><span>درآمد تأییدشده</span></div>
      <div class="sc"><b>${fmt(s.active_pro)}</b><span>PRO فعال</span></div>
      <div class="sc"><b>${fmt(s.expired_pro)}</b><span>PRO منقضی</span></div>`;
    const a = await (await api('admin_audit')).json();
    document.getElementById('dashAudit').innerHTML = (Array.isArray(a) ? a.slice(0, 8) : []).map(x => `<tr><td>${faDate(x.created_at)}</td><td>${esc(x.admin_email)}</td><td>${esc(x.action)}</td><td>${esc(x.target_type)}#${esc(x.target_id)}</td></tr>`).join('');
  }
  async function loadAudit() {
    const a = await (await api('admin_audit')).json();
    document.getElementById('auditBody').innerHTML = (Array.isArray(a) ? a : []).map(x => `<tr><td>${faDate(x.created_at)}</td><td>${esc(x.admin_email)}</td><td>${esc(x.action)}</td><td>${esc(x.target_type)}#${esc(x.target_id)}</td><td>${esc(JSON.stringify(x.meta || {}))}</td></tr>`).join('');
  }

  async function loadOrders(page) {
    const st = document.getElementById('filterSt').value;
    const r = await api('all_orders&page=' + page + '&status=' + st); if (!r.ok) return;
    const j = await r.json(); const list = j.rows || [];
    document.getElementById('ordersBody').innerHTML = list.map(o => `<tr>
      <td>#${o.id}</td><td>${faDate(o.created_at)}</td><td>${esc(o.name) || '-'}</td><td dir="ltr">${esc(o.phone) || '-'}</td><td>${esc(o.product) || '-'}</td>
      <td>${o.total ? rialFa(o.total) : '-'}</td><td>${o.payment_method === 'GATEWAY' ? 'درگاه' : 'دستی'}</td>
      <td><span class="pbadge" style="background:${['paid','delivered','sent'].includes(o.status) ? '#2d6a35' : ['rejected','cancelled'].includes(o.status) ? '#d33' : '#b26a00'}">${STATUS_FA[o.status] || esc(o.status)}</span></td>
      <td><select data-id="${o.id}" class="stSel"><option value="">تغییر وضعیت…</option>${Object.entries(STATUS_FA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></td>
      <td><button class="del-btn delO" data-id="${o.id}">حذف</button></td>
    </tr>`).join('') || '<tr><td colspan="10">سفارشی نیست</td></tr>';
    pager(document.getElementById('pagerO'), page, j.total || 0, 20, loadOrders);
    document.querySelectorAll('.stSel').forEach(sel => sel.onchange = async () => {
      if (!sel.value) return;
      const r2 = await api('set_status', { method: 'POST', body: JSON.stringify({ id: sel.dataset.id, status: sel.value }) });
      if (!r2.ok) alert('خطا در تغییر وضعیت');
      loadOrders(page);
    });
    document.querySelectorAll('.delO').forEach(b => b.onclick = async () => { if (!confirm('سفارش حذف بشه؟')) return; await api('admin_delete_order', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) }); loadOrders(page); });
  }

  async function loadPayments(page) {
    const r = await api('admin_payments&page=' + page); if (!r.ok) return;
    const j = await r.json(); const list = j.rows || [];
    document.getElementById('payBody').innerHTML = list.map(p => `<tr>
      <td>#${p.id}</td><td>${faDate(p.created_at)}</td><td>#${p.order_id}</td><td>${esc(p.orders && p.orders.email) || '-'}</td><td>${rialFa(p.amount)}</td><td>${p.provider === 'GATEWAY' ? 'درگاه' : 'دستی'}</td><td dir="ltr">${esc(p.reference) || '-'}</td>
      <td><span class="pbadge" style="background:${p.status === 'approved' ? '#2d6a35' : p.status === 'rejected' ? '#d33' : '#b26a00'}">${PAY_FA[p.status] || esc(p.status)}</span></td>
      <td>${p.status === 'submitted' || p.status === 'pending' ? `<button class="ok-btn apP" data-id="${p.id}">تأیید</button> <button class="del-btn rjP" data-id="${p.id}">رد</button>` : '—'}</td>
      <td><button class="del-btn delPay" data-id="${p.id}">حذف</button></td>
    </tr>`).join('') || '<tr><td colspan="10">پرداختی نیست</td></tr>';
    pager(document.getElementById('pagerP'), page, j.total || 0, 20, loadPayments);
    document.querySelectorAll('.apP').forEach(b => b.onclick = async () => { const r2 = await api('approve_payment', { method: 'POST', body: JSON.stringify({ payment_id: +b.dataset.id }) }); const j2 = await r2.json(); alert(r2.ok ? (j2.already ? 'قبلاً تأیید شده' : 'تأیید شد ✅ دسترسی ساخته شد') : 'خطا'); loadPayments(page); });
    document.querySelectorAll('.rjP').forEach(b => b.onclick = async () => { const reason = prompt('دلیل رد (اختیاری):') || ''; await api('reject_payment', { method: 'POST', body: JSON.stringify({ payment_id: +b.dataset.id, reason }) }); loadPayments(page); });
    document.querySelectorAll('.delPay').forEach(b => b.onclick = async () => { if (!confirm('پرداخت حذف بشه؟')) return; await api('admin_delete_payment', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) }); loadPayments(page); });
  }

  async function loadRecipes() {
    document.getElementById('recBody').innerHTML = REC.map(r => `<tr>
      <td><b>${esc(r.name_fa)}</b><br><small dir="ltr">${esc(r.slug)}</small></td><td>${esc(r.category)}</td><td>${esc(r.region) || '-'}</td><td>${fmt(r.kcal)}</td>
      <td><button class="btn small edR" data-s="${esc(r.slug)}">ویرایش</button></td><td><button class="del-btn dlR" data-s="${esc(r.slug)}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.edR').forEach(b => b.onclick = () => fillForm(REC.find(x => x.slug === b.dataset.s)));
    document.querySelectorAll('.dlR').forEach(b => b.onclick = async () => { if (!confirm('حذف بشه؟')) return; await sb.from('recipes').delete().eq('slug', b.dataset.s); await refreshREC(); loadRecipes(); });
  }
  function fillForm(r) {
    const g = id => document.getElementById(id);
    g('rSlug').value = r ? r.slug : ''; g('rSlug').disabled = !!r;
    g('rNameFa').value = r ? r.name_fa : ''; g('rNameEn').value = r ? (r.name_en || '') : '';
    g('rCat').value = r ? r.category : 'main'; g('rRegion').value = r ? (r.region || '') : 'ایران';
    g('rTime').value = r ? r.time_min : ''; g('rKcal').value = r ? r.kcal : ''; g('rProtein').value = r ? r.protein : '';
    g('rCarbs').value = r && r.carbs != null ? r.carbs : ''; g('rFat').value = r && r.fat != null ? r.fat : '';
    g('rFiber').value = r && r.fiber != null ? r.fiber : ''; g('rSugar').value = r && r.sugar != null ? r.sugar : '';
    g('rImage').value = r ? (r.image || '') : ''; g('rVideo').value = r ? (r.video_url || '') : '';
    g('rTags').value = r ? (r.tags || []).join(',') : ''; g('rKeys').value = r ? (r.keys || []).join(',') : '';
    g('rDesc').value = r ? (r.desc_fa || '') : '';
    g('rIngs').value = r ? (r.ingredients || []).map(i => i.fa + ':' + i.q).join('\n') : '';
    g('rSteps').value = r ? (r.steps || []).join('\n') : '';
    g('rTips').value = r ? (r.tips || []).join('\n') : '';
    document.getElementById('recForm').style.display = 'grid';
  }
  async function saveRecipe() {
    const g = id => document.getElementById(id).value;
    const slug = g('rSlug').trim();
    if (!slug || !g('rNameFa').trim()) { alert('slug و نام لازمه'); return; }
    const obj = { slug, name_fa: g('rNameFa').trim(), name_en: g('rNameEn').trim() || g('rNameFa').trim(), category: g('rCat'), region: g('rRegion').trim() || 'ایران', time_min: +g('rTime') || 30, kcal: +g('rKcal') || 0, protein: +g('rProtein') || 0, carbs: g('rCarbs') === '' ? null : +g('rCarbs'), fat: g('rFat') === '' ? null : +g('rFat'), fiber: g('rFiber') === '' ? null : +g('rFiber'), sugar: g('rSugar') === '' ? null : +g('rSugar'), image: g('rImage').trim() || null, video_url: g('rVideo').trim() || null, desc_fa: g('rDesc').trim(), tags: g('rTags').split(',').map(s => s.trim()).filter(Boolean), keys: g('rKeys').split(',').map(s => s.trim()).filter(Boolean), ingredients: g('rIngs').split('\n').map(l => { const [fa, q] = l.split(':'); return { fa: (fa || '').trim(), q: (q || '').trim() || 'به‌اندازه' }; }).filter(i => i.fa), steps: g('rSteps').split('\n').map(s => s.trim()).filter(Boolean), tips: g('rTips').split('\n').map(s => s.trim()).filter(Boolean) };
    const exists = REC.find(x => x.slug === slug);
    const res = exists ? await sb.from('recipes').update(obj).eq('slug', slug) : await sb.from('recipes').insert(obj);
    if (res.error) { alert('خطا: ' + res.error.message); return; }
    await refreshREC();
    alert('ذخیره شد ✅'); document.getElementById('recForm').style.display = 'none'; loadRecipes();
  }

  async function loadProds() {
    const data = await (await fetch('/api/db?t=products')).json();
    document.getElementById('prodBody2').innerHTML = (Array.isArray(data) ? data : []).map(p => `<tr>
      <td><b>${esc(p.title_fa)}</b></td>
      <td><input type="text" data-id="${p.id}" data-f="price_rial" value="${p.price_rial ? fmt(p.price_rial) : ''}"></td>
      <td><input type="text" data-id="${p.id}" data-f="old_price_rial" value="${p.old_price_rial ? fmt(p.old_price_rial) : ''}"></td>
      <td><input type="number" data-id="${p.id}" data-f="off_percent" value="${p.off_percent || 0}"></td>
      <td><select data-id="${p.id}" data-f="type">${Object.entries(TYPE_FA).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><input type="number" data-id="${p.id}" data-f="access_days" value="${p.access_days || ''}"></td>
      <td><input type="file" class="pFile" data-id="${p.id}" accept=".pdf,.zip,.rar,.jpg,.jpeg,.png,.webp,.mp4,.mp3"><span class="hint">PDF/ZIP/JPG/MP4… تا ۱۵MB</span><br><small dir="ltr">${esc(p.file_path) || '—'}</small></td>
      <td><button class="del-btn dlP" data-id="${p.id}">حذف</button></td>
      <td><button class="btn small svP" data-id="${p.id}">ذخیره</button></td>
      <td><input type="checkbox" data-id="${p.id}" data-f="active" ${p.active ? 'checked' : ''}></td>
    </tr>`).join('');
    document.querySelectorAll('#prodBody2 input[data-f="price_rial"], #prodBody2 input[data-f="old_price_rial"]').forEach(bindMoney);
    document.querySelectorAll('.svP').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, upd = {};
      document.querySelectorAll(`#prodBody2 [data-id="${id}"][data-f]`).forEach(i => {
        if (i.dataset.f === 'active') upd.active = i.checked;
        else if (i.dataset.f === 'type') upd.type = i.value;
        else if (['price_rial', 'old_price_rial'].includes(i.dataset.f)) upd[i.dataset.f] = normNum(i.value);
        else upd[i.dataset.f] = i.value === '' ? null : +i.value;
      });
      const file = document.querySelector(`.pFile[data-id="${id}"]`).files[0];
      if (file) {
        if (!OK_EXT.test(file.name)) { alert('فرمت مجاز: PDF/ZIP/RAR/JPG/PNG/WEBP/MP4/MP3'); return; }
        const base64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(file); });
        const path = 'products/p' + id + '-' + file.name;
        const up = await api('upload_file', { method: 'POST', body: JSON.stringify({ path, base64, mime: file.type }) });
        if (up.ok) upd.file_path = path; else alert('آپلود فایل ناموفق');
      }
      const { error } = await sb.from('products').update(upd).eq('id', id);
      if (error) { alert('خطا: ' + error.message); return; }
      alert('ذخیره شد ✅'); loadProds();
    });
    document.querySelectorAll('.dlP').forEach(b => b.onclick = async () => {
      if (!confirm('محصول حذف بشه؟ (سفارش‌های قبلی حفظ می‌مونن)')) return;
      const r = await api('admin_delete_product', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) });
      if (!r.ok) alert('حذف ناموفق'); else loadProds();
    });
  }
  async function addProd() {
    const t = document.getElementById('aTitle').value.trim(); const pr = normNum(document.getElementById('aPrice').value);
    if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
    const ins = await sb.from('products').insert({ title_fa: t, desc_fa: document.getElementById('aDesc').value.trim(), price_rial: pr, old_price_rial: normNum(document.getElementById('aOld').value), off_percent: +document.getElementById('aOff').value || 0, rating: 4.8, type: document.getElementById('aType').value, access_days: +document.getElementById('aDays').value || null, image: document.getElementById('aImg').value || null }).select().single();
    if (ins.error) { alert(ins.error.message); return; }
    const file = document.getElementById('aFile').files[0];
    if (file && ins.data) {
      if (!OK_EXT.test(file.name)) { alert('فرمت مجاز: PDF/ZIP/RAR/JPG/PNG/WEBP/MP4/MP3'); return; }
      const base64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(file); });
      const path = 'products/p' + ins.data.id + '-' + file.name;
      await api('upload_file', { method: 'POST', body: JSON.stringify({ path, base64, mime: file.type }) });
      await sb.from('products').update({ file_path: path }).eq('id', ins.data.id);
    }
    alert('اضافه شد ✅'); loadProds();
  }

  async function loadPlans() {
    const data = await (await fetch('/api/db?t=plans')).json();
    document.getElementById('plansBody2').innerHTML = (Array.isArray(data) ? data : []).map(p => `<tr>
      <td><input data-id="${p.id}" data-f="title_fa" value="${esc(p.title_fa)}"></td><td><input data-id="${p.id}" data-f="period" value="${esc(p.period)}"></td>
      <td><input type="number" data-id="${p.id}" data-f="days" value="${p.days || 30}"></td>
      <td><input type="text" data-id="${p.id}" data-f="price_rial" value="${p.price_rial ? fmt(p.price_rial) : ''}"></td>
      <td><input type="text" data-id="${p.id}" data-f="old_price_rial" value="${p.old_price_rial ? fmt(p.old_price_rial) : ''}"></td>
      <td><textarea data-id="${p.id}" data-f="features">${esc((p.features || []).join('\n'))}</textarea></td>
      <td><button class="btn small svL" data-id="${p.id}">ذخیره</button></td><td><button class="del-btn dlL" data-id="${p.id}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('#plansBody2 input[data-f="price_rial"], #plansBody2 input[data-f="old_price_rial"]').forEach(bindMoney);
    document.querySelectorAll('.svL').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, upd = {};
      document.querySelectorAll(`#plansBody2 [data-id="${id}"][data-f]`).forEach(i => {
        if (i.dataset.f === 'features') upd.features = i.value.split('\n').map(s => s.trim()).filter(Boolean);
        else if (['title_fa', 'period'].includes(i.dataset.f)) upd[i.dataset.f] = i.value;
        else if (['price_rial', 'old_price_rial'].includes(i.dataset.f)) upd[i.dataset.f] = normNum(i.value);
        else upd[i.dataset.f] = i.value === '' ? null : +i.value;
      });
      await sb.from('plans').update(upd).eq('id', id); alert('ذخیره شد ✅'); loadPlans();
    });
    document.querySelectorAll('.dlL').forEach(b => b.onclick = async () => { if (!confirm('حذف؟')) return; await sb.from('plans').delete().eq('id', b.dataset.id); loadPlans(); });
  }

  async function loadUsers(q, page) {
    const r = await api('admin_users&q=' + encodeURIComponent(q || '') + '&page=' + page);
    if (!r.ok) { document.getElementById('usersBody').innerHTML = '<tr><td colspan="6">خطا در دریافت کاربران</td></tr>'; return; }
    const j = await r.json(); const data = j.rows || [];
    document.getElementById('usersBody').innerHTML = data.map(u => `<tr>
      <td>${esc(u.email)}</td><td>${esc(u.name) || '-'}</td><td dir="ltr">${esc(u.phone) || '-'}</td><td>${faDate(u.created_at)}</td>
      <td><span class="pbadge" style="background:${u.disabled ? '#d33' : '#2d6a35'}">${u.disabled ? 'غیرفعال' : 'فعال'}</span></td>
      <td><button class="btn small vuD" data-id="${u.id}" data-e="${esc(u.email)}">جزئیات</button> <button class="${u.disabled ? 'ok-btn' : 'del-btn'} disU" data-id="${u.id}" data-d="${u.disabled ? 0 : 1}">${u.disabled ? 'فعال‌سازی' : 'غیرفعال'}</button></td>
    </tr>`).join('') || '<tr><td colspan="6">کاربری پیدا نشد</td></tr>';
    pager(document.getElementById('pagerU'), page, j.total || data.length, 20, p => loadUsers(q, p));
    document.querySelectorAll('.vuD').forEach(b => b.onclick = () => showUser(b.dataset.id, b.dataset.e));
    document.querySelectorAll('.disU').forEach(b => b.onclick = async () => { await api('admin_user_disable', { method: 'POST', body: JSON.stringify({ uid: b.dataset.id, disabled: b.dataset.d === '1' }) }); loadUsers(q, page); });
  }
  async function showUser(uid, email) {
    const box = document.getElementById('userDetail'); box.style.display = 'block';
    const [ent, ordersJ, paysJ, prods] = await Promise.all([
      (await api('admin_user_ent&uid=' + uid)).json(),
      (await api('all_orders&uid=' + uid + '&limit=100')).json(),
      (await api('admin_payments&page=1')).json(),
      (await fetch('/api/db?t=products')).json()
    ]);
    const myO = ordersJ.rows || [];
    const myP = (paysJ.rows || []).filter(p => p.user_id === uid);
    const subs = Array.isArray(ent.subscriptions) ? ent.subscriptions : [];
    const prodEnts = (Array.isArray(ent.entitlements) ? ent.entitlements : []).filter(e => e.entitlement_type === 'PRODUCT');
    const activePro = subs.some(s => s.status === 'ACTIVE' && (!s.end_date || new Date(s.end_date) > new Date()));
    box.innerHTML = `<h3>👤 ${esc(email)}</h3>
      <p>وضعیت PRO: <span class="pbadge" style="background:${activePro ? '#2d6a35' : '#777'}">${activePro ? 'فعال' : 'ندارد'}</span></p>
      <div class="add-form"><button class="ok-btn gP">🎁 اعطای PRO (۳۰ روز)</button><button class="warn-btn eP">⏳ تمدید +۳۰ روز</button><button class="del-btn rP">🚫 لغو PRO</button></div>
      <h4>🎁 اعطای دسترسی محصول</h4>
      <div class="add-form"><select id="gpSel">${(Array.isArray(prods) ? prods : []).map(p => `<option value="${p.id}">${esc(p.title_fa)}</option>`).join('')}</select><input id="gpDays" type="number" placeholder="مدت(روز، خالی=همیشگی)"><button class="ok-btn gpB">اعطای محصول</button></div>
      <h4>دسترسی‌های محصول (${fmt(prodEnts.length)})</h4><p>${prodEnts.map(e => `${esc((e.products && e.products.title_fa) || 'محصول')} — ${esc(e.status)} — تا ${faDate(e.expires_at)} <button class="del-btn rvPr" data-id="${e.id}">لغو</button>`).join('<br>') || '—'}</p>
      <h4>اشتراک‌ها</h4><p>${subs.map(s => `${s.plans ? esc(s.plans.title_fa) : 'PRO'} — ${esc(s.status)} — تا ${faDate(s.end_date)}`).join('<br>') || '—'}</p>
      <h4>سفارش‌ها (${fmt(myO.length)})</h4><p>${myO.map(o => `#${o.id} ${esc(o.product)} — ${STATUS_FA[o.status] || esc(o.status)} — ${faDate(o.created_at)}`).join('<br>') || '—'}</p>
      <h4>پرداخت‌ها (${fmt(myP.length)})</h4><p>${myP.map(p => `#${p.id} — ${PAY_FA[p.status] || esc(p.status)} — ${rialFa(p.amount)}`).join('<br>') || '—'}</p>`;
    box.querySelector('.gP').onclick = async () => { await api('admin_grant_pro', { method: 'POST', body: JSON.stringify({ uid, days: 30 }) }); alert('اعطا شد ✅'); showUser(uid, email); };
    box.querySelector('.eP').onclick = async () => { await api('admin_extend_pro', { method: 'POST', body: JSON.stringify({ uid, days: 30 }) }); alert('تمدید شد ✅'); showUser(uid, email); };
    box.querySelector('.rP').onclick = async () => { if (!confirm('لغو PRO؟')) return; await api('admin_revoke_pro', { method: 'POST', body: JSON.stringify({ uid }) }); alert('لغو شد'); showUser(uid, email); };
    box.querySelector('.gpB').onclick = async () => { const pid = box.querySelector('#gpSel').value; const days = box.querySelector('#gpDays').value; await api('admin_grant_product', { method: 'POST', body: JSON.stringify({ uid, product_id: +pid, days: days ? +days : null }) }); alert('اعطا شد ✅'); showUser(uid, email); };
    box.querySelectorAll('.rvPr').forEach(b => b.onclick = async () => { if (!confirm('لغو دسترسی محصول؟')) return; await api('admin_revoke_product', { method: 'POST', body: JSON.stringify({ entitlement_id: +b.dataset.id }) }); showUser(uid, email); });
    box.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadCoupons() {
    const r = await api('admin_coupons'); if (!r.ok) return;
    const data = await r.json();
    document.getElementById('couponBody').innerHTML = (Array.isArray(data) ? data : []).map(c => `<tr>
      <td><b>${esc(c.code)}</b></td><td>${c.type === 'PERCENT' ? 'درصدی' : 'ثابت'}</td><td>${c.type === 'PERCENT' ? fmt(c.value) + '٪' : rialFa(c.value)}</td><td>${fmt(c.used_count || 0)}${c.usage_limit ? '/' + fmt(c.usage_limit) : ''}</td>
      <td><input type="checkbox" class="cAct" data-id="${c.id}" ${c.active ? 'checked' : ''}></td>
      <td><button class="del-btn cDel" data-id="${c.id}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.cAct').forEach(i => i.onchange = async () => { await api('admin_coupons', { method: 'PATCH', body: JSON.stringify({ id: i.dataset.id, upd: { active: i.checked } }) }); });
    document.querySelectorAll('.cDel').forEach(b => b.onclick = async () => {
      if (!confirm('کوپن حذف بشه؟')) return;
      const r = await api('admin_coupons&id=' + b.dataset.id, { method: 'DELETE' });
      if (!r.ok) alert('حذف ناموفق'); else loadCoupons();
    });
  }

  // ---------- Diet Builder ----------
  let dietPlanId = null, dayCount = 0;
  async function pickUsers() {
    const q = document.getElementById('dq').value;
    const r = await api('admin_users&q=' + encodeURIComponent(q || ''));
    if (!r.ok) { alert('خطا در جستجوی کاربر'); return; }
    const j = await r.json(); const data = j.rows || [];
    const sel = document.getElementById('duPick');
    sel.innerHTML = data.map(u => `<option value="${u.id}">${esc(u.email)}</option>`).join('');
    if (q && !data.length) alert('کاربری با این مشخصات پیدا نشد. دقیقاً ایمیلی رو بنویس که کاربر باهاش وارد شده.');
    loadDietList();
  }
  function addDayBox() {
    dayCount++;
    const div = document.createElement('div');
    div.className = 'day-box';
    div.innerHTML = `<b>روز ${fmt(dayCount)}</b> <button class="del-btn rmDay">حذف روز</button><div class="meals"></div><button class="btn small addMeal">➕ وعده</button>`;
    div.querySelector('.rmDay').onclick = () => div.remove();
    div.querySelector('.addMeal').onclick = () => addMealRow(div.querySelector('.meals'));
    document.getElementById('daysBox').appendChild(div);
  }
  function lastDayMeals() {
    const boxes = [...document.querySelectorAll('#daysBox .day-box')];
    return boxes.length ? boxes[boxes.length - 1].querySelector('.meals') : null;
  }
  function addMealRow(box, m) {
    const row = document.createElement('div');
    row.className = 'meal-row';
    row.innerHTML = `<select class="mType"><option value="breakfast">صبحانه</option><option value="snack_am">میان‌وعده صبح</option><option value="lunch">ناهار</option><option value="snack_pm">میان‌وعده عصر</option><option value="dinner">شام</option><option value="snack">میان‌وعده (قدیمی)</option></select>
    <select class="mRec"><option value="">— رسپی —</option>${REC.map(r => `<option value="${r.id}">${esc(r.name_fa)}</option>`).join('')}</select>
    <input class="mTitle" placeholder="عنوان/ماده" value="${esc(m ? m.title : '')}"><input class="mPortion" placeholder="مقدار/کالری" value="${esc(m ? m.portion : '')}"><button class="del-btn rmM">✕</button>`;
    if (m && m.recipe_id) row.querySelector('.mRec').value = m.recipe_id;
    if (m && m.meal_type) row.querySelector('.mType').value = m.meal_type;
    row.querySelector('.rmM').onclick = () => row.remove();
    box.appendChild(row);
  }
  function collectDays() {
    return [...document.querySelectorAll('#daysBox .day-box')].map((d, i) => ({
      day_number: i + 1,
      meals: [...d.querySelectorAll('.meal-row')].map(r => ({ meal_type: r.querySelector('.mType').value, recipe_id: r.querySelector('.mRec').value ? +r.querySelector('.mRec').value : null, title: r.querySelector('.mTitle').value, portion: r.querySelector('.mPortion').value }))
    }));
  }
  async function saveDiet() {
    const dietUid = document.getElementById('duPick').value;
    if (!dietUid) { alert('اول کاربر رو پیدا و انتخاب کن'); return; }
    const g = id => document.getElementById(id).value;
    const r = await api('admin_diet_save', { method: 'POST', body: JSON.stringify({
      id: dietPlanId, user_id: dietUid, title: g('dTitle'), goal: g('dGoal'), start_date: g('dStart') || null, end_date: g('dEnd') || null, duration_days: g('dDur'),
      kcal_target: g('dKcal'), protein_target: g('dPro'), carbs_target: g('dCarb'), fat_target: g('dFat'),
      notes: g('dNotes'), restrictions_text: g('dRestr'), tips_text: g('dTips'), activity_text: g('dAct'),
      days: collectDays() }) });
    const j = await r.json();
    if (!r.ok) { alert(j.error || 'خطا'); return; }
    dietPlanId = j.id; alert('ذخیره شد ✅'); loadDietList();
  }

  // ---------- تولید هوشمند (منطق مشترک با دستیار کاربر) ----------
  function initSmartGen() {
    const pane = document.getElementById('pane-diet');
    if (!pane || document.getElementById('sgBox')) return;
    const box = document.createElement('div');
    box.id = 'sgBox'; box.className = 'ubox';
    box.innerHTML = `<h4>🤖 تولید هوشمند برنامه</h4>
    <div class="add-form">
      <select id="sgDays"><option value="1">۱ روز</option><option value="3">۳ روز</option><option value="7" selected>۷ روز</option></select>
      <label><input type="checkbox" id="sgB" checked> صبحانه</label>
      <label><input type="checkbox" id="sgSA" checked> میان‌وعده صبح</label>
      <label><input type="checkbox" id="sgL" checked> ناهار</label>
      <label><input type="checkbox" id="sgSP" checked> میان‌وعده عصر</label>
      <label><input type="checkbox" id="sgD" checked> شام</label>
      <label><input type="checkbox" id="sgProf" checked> از پروفایل کاربر</label>
    </div>
    <div class="add-form">
      <input id="sgKcal" type="number" placeholder="کالری هدف (اختیاری)"><input id="sgPro" type="number" placeholder="پروتئین g"><input id="sgCarb" type="number" placeholder="کربوهیدرات g"><input id="sgFat" type="number" placeholder="چربی g">
      <select id="sgAct"><option value="">سطح فعالیت: از پروفایل</option><option value="sedentary">کم‌تحرک</option><option value="light">سبک</option><option value="moderate">متوسط</option><option value="active">فعال</option></select>
    </div>
    <div class="add-form">
      <input id="sgForbidden" placeholder="غذاهای ممنوع (با ویرگول)" style="flex:1"><input id="sgLikes" placeholder="علاقه‌مندی‌ها (با ویرگول)" style="flex:1">
    </div>
    <button class="btn" id="sgGo">✨ تولید برنامه</button>
    <p class="hint" id="sgMsg"></p>`;
    pane.insertBefore(box, document.getElementById('dietForm'));
    const split = v => v.split('،').join(',').split(',').map(s => s.trim()).filter(Boolean);
    document.getElementById('sgGo').onclick = async () => {
      const uid = document.getElementById('duPick').value;
      if (!uid) { alert('اول کاربر را پیدا و انتخاب کن'); return; }
      const meals = [];
      if (document.getElementById('sgB').checked) meals.push('breakfast');
      if (document.getElementById('sgSA').checked) meals.push('snack_am');
      if (document.getElementById('sgL').checked) meals.push('lunch');
      if (document.getElementById('sgSP').checked) meals.push('snack_pm');
      if (document.getElementById('sgD').checked) meals.push('dinner');
      const likes = split(document.getElementById('sgLikes').value);
      document.getElementById('sgMsg').textContent = 'در حال تولید برنامه…';
      const r = await api('admin_mealgen', { method: 'POST', body: JSON.stringify({
        uid, days: +document.getElementById('sgDays').value, meals,
        use_profile: document.getElementById('sgProf').checked,
        forbidden: split(document.getElementById('sgForbidden').value),
        overrides: {
          calorie_target: +document.getElementById('sgKcal').value || null,
          protein_target: +document.getElementById('sgPro').value || null,
          carbs_target: +document.getElementById('sgCarb').value || null,
          fat_target: +document.getElementById('sgFat').value || null,
          activity_level: document.getElementById('sgAct').value || null,
          food_preferences: likes.length ? likes : undefined
        }
      }) });
      const j = await r.json();
      if (!r.ok) { document.getElementById('sgMsg').textContent = j.error === 'recipe_catalog_unavailable' ? 'رسپی مطابق محدودیت‌ها پیدا نشد؛ ممنوع‌ها را کمتر کن.' : 'خطا در تولید برنامه'; return; }
      dietPlanId = null; dayCount = 0;
      document.getElementById('daysBox').innerHTML = '';
      (j.days || []).forEach(d => {
        addDayBox();
        const mb = lastDayMeals();
        (d.meals || []).forEach(m => addMealRow(mb, { meal_type: m.type, recipe_id: m.recipe_id, title: m.title, portion: (m.kcal ? m.kcal + ' کالری' : '') + (m.protein != null ? ' | ' + m.protein + 'g پروتئین' : '') + (m.note ? ' — ' + m.note : '') }));
      });
      document.getElementById('dRestr').value = (j.constraints || []).join('\n');
      document.getElementById('dTips').value = (j.tips || []).join('\n');
      document.getElementById('dAct').value = j.activity ? [...(j.activity.items || []), j.activity.note, j.activity.disclaimer].filter(Boolean).join('\n') : '';
      document.getElementById('dietForm').style.display = 'grid';
      document.getElementById('sgMsg').textContent = 'برنامه آماده شد — می‌تونی ویرایش کنی و بعد ذخیره / PDF بگیری.';
    };
  }

  // ---------- PDF چندبخشی تمیز ----------
  async function genPdf() {
    if (!dietPlanId) { alert('اول ذخیره کن'); return; }
    const det = await (await api('admin_diet_detail&id=' + dietPlanId)).json();
    const plan = det.plan; const days = Array.isArray(det.days) ? det.days : [];
    const uname = document.getElementById('duPick').selectedOptions[0] ? document.getElementById('duPick').selectedOptions[0].textContent : '';
    await new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    const doc = document.getElementById('pdfDoc');
    const wrap = inner => `<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">${inner}</div>`;
    const secs = [];
    secs.push(wrap(`<div style="background:#2d6a35;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.9;margin-top:6px">برنامه غذایی اختصاصی — ${plan.title}</div></div>
      <img src="img/logo.png" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>کاربر:</b> ${uname}</div>
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>هدف:</b> ${plan.goal || '—'}</div>
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>مدت:</b> ${plan.duration_days || '—'} روز</div>
        <div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ${new Date().toLocaleDateString('fa-IR')}</div>
      </div>`));
    secs.push(wrap(`<div style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${fmt(plan.kcal_target) || '0'}</b><br><small>کالری روزانه</small></div>
      <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${fmt(plan.protein_target)}g</b><br><small>پروتئین</small></div>
      <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${fmt(plan.carbs_target)}g</b><br><small>کربوهیدرات</small></div>
      <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${fmt(plan.fat_target)}g</b><br><small>چربی</small></div>
    </div>`));
    if (plan.restrictions_text) secs.push(wrap(`<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>⚙️ محدودیت‌ها و ممنوعات:</b><br>${plan.restrictions_text.split('\n').map(x => '• ' + x).join('<br>')}</div>`));
    if (plan.tips_text) secs.push(wrap(`<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>💡 نکات مهم:</b><br>${plan.tips_text.split('\n').map(x => '• ' + x).join('<br>')}</div>`));
    if (plan.notes) secs.push(wrap(`<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>📝 توضیحات:</b><br>${plan.notes}</div>`));
    days.forEach(d => secs.push(wrap(`<div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ${fmt(d.day_number)}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
        ${(d.diet_plan_meals || []).map(m => `<tr style="border-bottom:1px solid #e5efe5"><td style="padding:8px;font-weight:700;width:110px">${MFA[m.meal_type] || m.meal_type}</td><td style="padding:8px">${m.title || (REC.find(x => x.id === m.recipe_id) || {}).name_fa || '—'}</td><td style="padding:8px;color:#557">${m.portion || ''}</td></tr>`).join('')}
      </table>`));
    if (plan.activity_text) secs.push(wrap(`<div style="background:#e8f4e9;border-radius:14px;padding:16px"><b>🏃 پیشنهاد فعالیت:</b><br>${plan.activity_text.split('\n').map(x => '• ' + x).join('<br>')}</div>`));
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
    const b64 = pdf.output('datauristring').split(',')[1];
    const path = 'diet/plan-' + dietPlanId + '.pdf';
    const up = await api('upload_file', { method: 'POST', body: JSON.stringify({ path, base64: b64, mime: 'application/pdf' }) });
    if (!up.ok) { alert('آپلود PDF ناموفق'); return; }
    const pub = await api('admin_diet_publish', { method: 'POST', body: JSON.stringify({ id: dietPlanId, pdf_path: path }) });
    alert(pub.ok ? 'PDF ساخته و منتشر شد ✅' : 'خطا در انتشار');
    loadDietList();
  }
  async function loadDietList() {
    const uid = document.getElementById('duPick').value || null;
    const r = await api('admin_diet_plans' + (uid ? '&uid=' + uid : '')); if (!r.ok) return;
    const data = await r.json();
    document.getElementById('dietList').innerHTML = (Array.isArray(data) ? data : []).map(p => `<div class="ubox" style="margin:8px 0;padding:12px">
      <b>${esc(p.title)}</b> — <span class="pbadge" style="background:${p.status === 'published' ? '#2d6a35' : '#b26a00'}">${p.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}</span>
      <small> — ${faDate(p.created_at)}</small><br>
      <button class="btn small dEdit" data-id="${p.id}">ویرایش</button>
      <button class="warn-btn dPub" data-id="${p.id}">انتشار</button>
      <button class="del-btn dDel" data-id="${p.id}">حذف</button>
    </div>`).join('') || '<p>هنوز برنامه‌ای ساخته نشده</p>';
    document.querySelectorAll('.dEdit').forEach(b => b.onclick = async () => {
      dietPlanId = +b.dataset.id;
      const det = await (await api('admin_diet_detail&id=' + dietPlanId)).json();
      const pl = det.plan;
      const g = id => document.getElementById(id);
      g('dTitle').value = pl.title; g('dGoal').value = pl.goal || ''; g('dStart').value = pl.start_date ? pl.start_date.slice(0, 10) : ''; g('dEnd').value = pl.end_date ? pl.end_date.slice(0, 10) : ''; g('dDur').value = pl.duration_days || ''; g('dKcal').value = pl.kcal_target || ''; g('dPro').value = pl.protein_target || ''; g('dCarb').value = pl.carbs_target || ''; g('dFat').value = pl.fat_target || '';
      g('dNotes').value = pl.notes || ''; g('dRestr').value = pl.restrictions_text || ''; g('dTips').value = pl.tips_text || ''; g('dAct').value = pl.activity_text || '';
      ['dStart', 'dEnd'].forEach(i => { const el = g(i); el.dispatchEvent(new Event('change')); });
      document.getElementById('daysBox').innerHTML = ''; dayCount = 0;
      (Array.isArray(det.days) ? det.days : []).forEach(d => { addDayBox(); const mb = lastDayMeals(); (d.diet_plan_meals || []).forEach(m => addMealRow(mb, m)); });
      document.getElementById('dietForm').style.display = 'grid';
    });
    document.querySelectorAll('.dPub').forEach(b => b.onclick = async () => { await api('admin_diet_publish', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) }); loadDietList(); });
    document.querySelectorAll('.dDel').forEach(b => b.onclick = async () => { if (!confirm('حذف؟')) return; await api('admin_diet_delete', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) }); loadDietList(); });
  }

  function bindAll() {
    document.getElementById('csvBtn').onclick = exportCSV;
    document.getElementById('filterSt').onchange = () => loadOrders(1);
    document.getElementById('rNew').onclick = () => fillForm(null);
    document.getElementById('rSave').onclick = saveRecipe;
    document.getElementById('aAdd').onclick = addProd;
    document.getElementById('pAdd').onclick = async () => {
      const t = document.getElementById('pTitle').value.trim(); const pr = normNum(document.getElementById('pPrice').value);
      if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
      await sb.from('plans').insert({ key: 'plan-' + Date.now(), title_fa: t, period: document.getElementById('pPeriod').value || 'ماهانه', days: +document.getElementById('pDays').value || 30, price_rial: pr, old_price_rial: normNum(document.getElementById('pOld').value), features: [] });
      loadPlans();
    };
    document.getElementById('uqBtn').onclick = () => loadUsers(document.getElementById('uq').value, 1);
    document.getElementById('cAdd').onclick = async () => {
      const r = await api('admin_coupons', { method: 'POST', body: JSON.stringify({ code: document.getElementById('cCode').value, type: document.getElementById('cType').value, value: +document.getElementById('cValue').value, usage_limit: +document.getElementById('cLimit').value || null, end_date: document.getElementById('cEnd').value || null, pro_only: document.getElementById('cPro').checked }) });
      if (!r.ok) alert('خطا'); loadCoupons();
    };
    document.getElementById('dqBtn').onclick = pickUsers;
    initSmartGen();
    document.getElementById('dNew').onclick = () => { dietPlanId = null; dayCount = 0; document.getElementById('daysBox').innerHTML = ''; document.getElementById('dietForm').style.display = 'grid'; addDayBox(); };
    document.getElementById('dAddDay').onclick = addDayBox;
    document.getElementById('dSave').onclick = saveDiet;
    document.getElementById('dPdf').onclick = genPdf;
  }
  async function exportCSV() {
    const r = await api('all_orders&limit=100'); const j = await r.json(); const data = j.rows || [];
    const rows = [['کد', 'تاریخ', 'نام', 'موبایل', 'ایمیل', 'محصول', 'کد واریز', 'وضعیت', 'مبلغ(ریال)', 'یادداشت']];
    data.forEach(o => rows.push([o.id, new Date(o.created_at).toLocaleString('fa-IR'), o.name, o.phone, o.email, o.product, o.ref, STATUS_FA[o.status] || o.status, o.total || '', o.note || '']));
    const csv = '\uFEFF' + rows.map(r2 => r2.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'dailyfitbeat-orders.csv'; a.click();
  }
})();
