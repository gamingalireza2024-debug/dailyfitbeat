(function () {
  if (document.body.dataset.page !== 'admin') return;
  let sb = null, started = false, REC = [];
  const wait = setInterval(() => {
    if (started || !window.DFB || !DFB.sb) return;
    if (DFB.isAdmin()) { started = true; clearInterval(wait); sb = DFB.sb; init(); }
  }, 400);

  async function tok() { const s = (await sb.auth.getSession()).data.session; return s ? s.access_token : null; }
  async function api(t, opts) {
    const token = await tok();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('/api/db?t=' + t, Object.assign({ headers }, opts || {}));
  }
  const STATUS_FA = { new: 'جدید', pending: 'در انتظار پرداخت', payment_submitted: 'واریز ثبت شده', under_review: 'در بررسی', paid: 'پرداخت شده', processing: 'پردازش', delivered: 'تحویل شده', sent: 'ارسال شده', rejected: 'رد شده', cancelled: 'لغو شده', refunded: 'مسترد' };

  async function init() {
    document.querySelectorAll('.aside button').forEach(b => b.onclick = () => {
      document.querySelectorAll('.aside button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      document.querySelectorAll('.apane').forEach(p => p.style.display = (p.id === 'pane-' + b.dataset.t) ? 'block' : 'none');
      if (b.dataset.t === 'dash') loadDash();
      if (b.dataset.t === 'payments') loadPayments();
      if (b.dataset.t === 'users') loadUsers('');
      if (b.dataset.t === 'coupons') loadCoupons();
      if (b.dataset.t === 'audit') loadAudit();
    });
    REC = await (await fetch('/api/db?t=all')).json();
    await loadDash(); await loadOrders(); await loadProds(); await loadPlans(); await loadRecipes();
    bindAll();
  }

  // ---------- داشبورد ----------
  async function loadDash() {
    const r = await api('admin_stats'); if (!r.ok) return;
    const s = await r.json();
    document.getElementById('statsBox').innerHTML = `
      <div class="sc"><b>${s.users}</b><span>کاربران</span></div>
      <div class="sc"><b>${s.orders}</b><span>سفارش‌ها</span></div>
      <div class="sc"><b>${s.paid_orders}</b><span>پرداخت شده</span></div>
      <div class="sc"><b>${s.pending_orders}</b><span>در انتظار</span></div>
      <div class="sc"><b>${(s.revenue / 10).toLocaleString('fa-IR')}</b><span>درآمد (تومان)</span></div>
      <div class="sc"><b>${s.active_pro}</b><span>PRO فعال</span></div>
      <div class="sc"><b>${s.expired_pro}</b><span>PRO منقضی</span></div>`;
    const a = await (await api('admin_audit')).json();
    document.getElementById('dashAudit').innerHTML = (Array.isArray(a) ? a.slice(0, 8) : []).map(x => `<tr><td>${new Date(x.created_at).toLocaleString('fa-IR')}</td><td>${x.admin_email}</td><td>${x.action}</td><td>${x.target_type}#${x.target_id}</td></tr>`).join('');
  }
  async function loadAudit() {
    const a = await (await api('admin_audit')).json();
    document.getElementById('auditBody').innerHTML = (Array.isArray(a) ? a : []).map(x => `<tr><td>${new Date(x.created_at).toLocaleString('fa-IR')}</td><td>${x.admin_email}</td><td>${x.action}</td><td>${x.target_type}#${x.target_id}</td><td>${JSON.stringify(x.meta || {})}</td></tr>`).join('');
  }

  // ---------- سفارش‌ها ----------
  async function loadOrders() {
    const r = await api('all_orders'); if (!r.ok) return;
    const data = await r.json();
    const f = document.getElementById('filterSt').value;
    const list = Array.isArray(data) ? (f === 'all' ? data : data.filter(x => x.status === f)) : [];
    document.getElementById('ordersBody').innerHTML = list.map(o => `<tr>
      <td>#${o.id}</td><td>${new Date(o.created_at).toLocaleDateString('fa-IR')}</td><td>${o.name || '-'}</td><td dir="ltr">${o.phone || '-'}</td><td>${o.product || '-'}</td>
      <td>${o.total ? (o.total / 10).toLocaleString('fa-IR') + ' ت' : '-'}</td><td>${o.payment_method || 'MANUAL'}</td>
      <td><span class="pbadge" style="background:${['paid','delivered','sent'].includes(o.status) ? '#2d6a35' : ['rejected','cancelled'].includes(o.status) ? '#d33' : '#b26a00'}">${STATUS_FA[o.status] || o.status}</span></td>
      <td><select data-id="${o.id}" class="stSel"><option value="">تغییر وضعیت…</option>${Object.entries(STATUS_FA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></td>
    </tr>`).join('');
    document.querySelectorAll('.stSel').forEach(sel => sel.onchange = async () => {
      if (!sel.value) return;
      const r2 = await api('set_status', { method: 'POST', body: JSON.stringify({ id: sel.dataset.id, status: sel.value }) });
      if (!r2.ok) alert('خطا در تغییر وضعیت');
      loadOrders();
    });
  }

  // ---------- پرداخت‌ها ----------
  async function loadPayments() {
    const r = await api('admin_payments'); if (!r.ok) return;
    const data = await r.json();
    document.getElementById('payBody').innerHTML = (Array.isArray(data) ? data : []).map(p => `<tr>
      <td>#${p.id}</td><td>#${p.order_id}</td><td>${(p.orders && p.orders.email) || '-'}</td><td>${(p.amount / 10).toLocaleString('fa-IR')} ت</td><td>${p.provider}</td><td dir="ltr">${p.reference || '-'}</td>
      <td><span class="pbadge" style="background:${p.status === 'approved' ? '#2d6a35' : p.status === 'rejected' ? '#d33' : '#b26a00'}">${p.status}</span></td>
      <td>${p.status === 'submitted' || p.status === 'pending' ? `<button class="ok-btn apP" data-id="${p.id}">تأیید</button> <button class="del-btn rjP" data-id="${p.id}">رد</button>` : '—'}</td>
    </tr>`).join('');
    document.querySelectorAll('.apP').forEach(b => b.onclick = async () => { const r2 = await api('approve_payment', { method: 'POST', body: JSON.stringify({ payment_id: +b.dataset.id }) }); const j = await r2.json(); alert(r2.ok ? (j.already ? 'قبلاً تأیید شده' : 'تأیید شد ✅ Entitlement ساخته شد') : 'خطا'); loadPayments(); loadOrders(); });
    document.querySelectorAll('.rjP').forEach(b => b.onclick = async () => { const reason = prompt('دلیل رد (اختیاری):') || ''; await api('reject_payment', { method: 'POST', body: JSON.stringify({ payment_id: +b.dataset.id, reason }) }); loadPayments(); loadOrders(); });
  }

  // ---------- رسپی‌ها ----------
  let REC_CACHE = [];
  async function loadRecipes() {
    REC_CACHE = REC;
    document.getElementById('recBody').innerHTML = REC_CACHE.map(r => `<tr>
      <td><b>${r.name_fa}</b><br><small dir="ltr">${r.slug}</small></td><td>${r.category}</td><td>${r.region || '-'}</td><td>${r.kcal}</td>
      <td><button class="btn small edR" data-s="${r.slug}">ویرایش</button></td><td><button class="del-btn dlR" data-s="${r.slug}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.edR').forEach(b => b.onclick = () => fillForm(REC_CACHE.find(x => x.slug === b.dataset.s)));
    document.querySelectorAll('.dlR').forEach(b => b.onclick = async () => { if (!confirm('حذف بشه؟')) return; await sb.from('recipes').delete().eq('slug', b.dataset.s); loadRecipes(); });
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
    const exists = REC_CACHE.find(x => x.slug === slug);
    const res = exists ? await sb.from('recipes').update(obj).eq('slug', slug) : await sb.from('recipes').insert(obj);
    if (res.error) { alert('خطا: ' + res.error.message); return; }
    alert('ذخیره شد ✅'); document.getElementById('recForm').style.display = 'none'; loadRecipes();
  }

  // ---------- محصولات ----------
  async function loadProds() {
    const data = await (await fetch('/api/db?t=products')).json();
    document.getElementById('prodBody2').innerHTML = (Array.isArray(data) ? data : []).map(p => `<tr>
      <td><b>${p.title_fa}</b></td>
      <td><input type="number" data-id="${p.id}" data-f="price_rial" value="${p.price_rial}"></td>
      <td><input type="number" data-id="${p.id}" data-f="old_price_rial" value="${p.old_price_rial || ''}"></td>
      <td><input type="number" data-id="${p.id}" data-f="off_percent" value="${p.off_percent || 0}"></td>
      <td><select data-id="${p.id}" data-f="type"><option ${p.type === 'DIGITAL_PRODUCT' ? 'selected' : ''}>DIGITAL_PRODUCT</option><option ${p.type === 'SERVICE' ? 'selected' : ''}>SERVICE</option><option ${p.type === 'SUBSCRIPTION' ? 'selected' : ''}>SUBSCRIPTION</option><option ${p.type === 'BUNDLE' ? 'selected' : ''}>BUNDLE</option></select></td>
      <td><input type="number" data-id="${p.id}" data-f="access_days" value="${p.access_days || ''}"></td>
      <td><input type="file" class="pFile" data-id="${p.id}"><br><small dir="ltr">${p.file_path || '—'}</small></td>
      <td><input type="checkbox" data-id="${p.id}" data-f="active" ${p.active ? 'checked' : ''}></td>
      <td><button class="btn small svP" data-id="${p.id}">ذخیره</button></td>
      <td><button class="del-btn dlP" data-id="${p.id}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.svP').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, upd = {};
      document.querySelectorAll(`#prodBody2 [data-id="${id}"][data-f]`).forEach(i => {
        if (i.dataset.f === 'active') upd.active = i.checked;
        else if (i.dataset.f === 'type') upd.type = i.value;
        else upd[i.dataset.f] = i.value === '' ? null : +i.value;
      });
      const file = document.querySelector(`.pFile[data-id="${id}"]`).files[0];
      if (file) {
        const base64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(file); });
        const path = 'products/p' + id + '-' + file.name;
        const up = await api('upload_file', { method: 'POST', body: JSON.stringify({ path, base64, mime: file.type }) });
        if (up.ok) upd.file_path = path; else alert('آپلود فایل ناموفق');
      }
      const { error } = await sb.from('products').update(upd).eq('id', id);
      if (error) { alert('خطا: ' + error.message); return; }
      alert('ذخیره شد ✅'); loadProds();
    });
    document.querySelectorAll('.dlP').forEach(b => b.onclick = async () => { if (!confirm('حذف؟')) return; await sb.from('products').delete().eq('id', b.dataset.id); loadProds(); });
  }
  async function addProd() {
    const t = document.getElementById('aTitle').value.trim(); const pr = +document.getElementById('aPrice').value;
    if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
    const ins = await sb.from('products').insert({ title_fa: t, desc_fa: document.getElementById('aDesc').value.trim(), price_rial: pr, old_price_rial: +document.getElementById('aOld').value || null, off_percent: +document.getElementById('aOff').value || 0, rating: 4.8, type: document.getElementById('aType').value, access_days: +document.getElementById('aDays').value || null, image: document.getElementById('aImg').value || null }).select().single();
    if (ins.error) { alert(ins.error.message); return; }
    const file = document.getElementById('aFile').files[0];
    if (file && ins.data) {
      const base64 = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(file); });
      const path = 'products/p' + ins.data.id + '-' + file.name;
      await api('upload_file', { method: 'POST', body: JSON.stringify({ path, base64, mime: file.type }) });
      await sb.from('products').update({ file_path: path }).eq('id', ins.data.id);
    }
    alert('اضافه شد ✅'); loadProds();
  }

  // ---------- پلان‌ها ----------
  async function loadPlans() {
    const data = await (await fetch('/api/db?t=plans')).json();
    document.getElementById('plansBody2').innerHTML = (Array.isArray(data) ? data : []).map(p => `<tr>
      <td><input data-id="${p.id}" data-f="title_fa" value="${p.title_fa}"></td><td><input data-id="${p.id}" data-f="period" value="${p.period}"></td>
      <td><input type="number" data-id="${p.id}" data-f="days" value="${p.days || 30}"></td>
      <td><input type="number" data-id="${p.id}" data-f="price_rial" value="${p.price_rial}"></td>
      <td><input type="number" data-id="${p.id}" data-f="old_price_rial" value="${p.old_price_rial || ''}"></td>
      <td><textarea data-id="${p.id}" data-f="features">${(p.features || []).join('\n')}</textarea></td>
      <td><button class="btn small svL" data-id="${p.id}">ذخیره</button></td><td><button class="del-btn dlL" data-id="${p.id}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.svL').forEach(b => b.onclick = async () => {
      const id = b.dataset.id, upd = {};
      document.querySelectorAll(`#plansBody2 [data-id="${id}"][data-f]`).forEach(i => {
        if (i.dataset.f === 'features') upd.features = i.value.split('\n').map(s => s.trim()).filter(Boolean);
        else if (['title_fa', 'period'].includes(i.dataset.f)) upd[i.dataset.f] = i.value;
        else upd[i.dataset.f] = i.value === '' ? null : +i.value;
      });
      await sb.from('plans').update(upd).eq('id', id); alert('ذخیره شد ✅'); loadPlans();
    });
    document.querySelectorAll('.dlL').forEach(b => b.onclick = async () => { if (!confirm('حذف؟')) return; await sb.from('plans').delete().eq('id', b.dataset.id); loadPlans(); });
  }

  // ---------- کاربران ----------
  async function loadUsers(q) {
    const r = await api('admin_users&q=' + encodeURIComponent(q || '')); if (!r.ok) return;
    const data = await r.json();
    document.getElementById('usersBody').innerHTML = (Array.isArray(data) ? data : []).map(u => `<tr>
      <td>${u.email}</td><td>${u.name || '-'}</td><td dir="ltr">${u.phone || '-'}</td><td>${new Date(u.created_at).toLocaleDateString('fa-IR')}</td>
      <td><span class="pbadge" style="background:${u.disabled ? '#d33' : '#2d6a35'}">${u.disabled ? 'غیرفعال' : 'فعال'}</span></td>
      <td><button class="btn small vuD" data-id="${u.id}" data-e="${u.email}">جزئیات</button> <button class="${u.disabled ? 'ok-btn' : 'del-btn'}" id="disU" data-id="${u.id}" data-d="${u.disabled ? 0 : 1}">${u.disabled ? 'فعال‌سازی' : 'غیرفعال'}</button></td>
    </tr>`).join('');
    document.querySelectorAll('.vuD').forEach(b => b.onclick = () => showUser(b.dataset.id, b.dataset.e));
    document.querySelectorAll('#usersBody #disU').forEach(b => b.onclick = async () => { await api('admin_user_disable', { method: 'POST', body: JSON.stringify({ uid: b.dataset.id, disabled: b.dataset.d === '1' }) }); loadUsers(document.getElementById('uq').value); });
  }
  async function showUser(uid, email) {
    const box = document.getElementById('userDetail'); box.style.display = 'block';
    const [ent, orders, pays] = await Promise.all([
      (await api('admin_user_ent&uid=' + uid)).json(),
      (await api('all_orders')).json(),
      (await api('admin_payments')).json()
    ]);
    const myO = (Array.isArray(orders) ? orders : []).filter(o => o.user_id === uid);
    const myP = (Array.isArray(pays) ? pays : []).filter(p => p.user_id === uid);
    const subs = Array.isArray(ent.subscriptions) ? ent.subscriptions : [];
    const activePro = subs.some(s => s.status === 'ACTIVE' && (!s.end_date || new Date(s.end_date) > new Date()));
    box.innerHTML = `<h3>👤 ${email}</h3>
      <p>وضعیت PRO: <span class="pbadge" style="background:${activePro ? '#2d6a35' : '#777'}">${activePro ? 'فعال' : 'ندارد'}</span></p>
      <div class="add-form"><button class="ok-btn gP">🎁 اعطای PRO (۳۰ روز)</button><button class="warn-btn eP">⏳ تمدید +۳۰ روز</button><button class="del-btn rP">🚫 لغو PRO</button></div>
      <h4>اشتراک‌ها</h4><p>${subs.map(s => `${s.plans ? s.plans.title_fa : 'PRO'} — ${s.status} — تا ${s.end_date ? new Date(s.end_date).toLocaleDateString('fa-IR') : '—'}`).join('<br>') || '—'}</p>
      <h4>سفارش‌ها (${myO.length})</h4><p>${myO.map(o => `#${o.id} ${o.product} — ${STATUS_FA[o.status] || o.status}`).join('<br>') || '—'}</p>
      <h4>پرداخت‌ها (${myP.length})</h4><p>${myP.map(p => `#${p.id} — ${p.status} — ${(p.amount / 10).toLocaleString('fa-IR')} ت`).join('<br>') || '—'}</p>`;
    box.querySelector('.gP').onclick = async () => { await api('admin_grant_pro', { method: 'POST', body: JSON.stringify({ uid, days: 30 }) }); alert('اعطا شد ✅'); showUser(uid, email); };
    box.querySelector('.eP').onclick = async () => { await api('admin_extend_pro', { method: 'POST', body: JSON.stringify({ uid, days: 30 }) }); alert('تمدید شد ✅'); showUser(uid, email); };
    box.querySelector('.rP').onclick = async () => { if (!confirm('لغو PRO؟')) return; await api('admin_revoke_pro', { method: 'POST', body: JSON.stringify({ uid }) }); alert('لغو شد'); showUser(uid, email); };
    box.scrollIntoView({ behavior: 'smooth' });
  }

  // ---------- کوپن‌ها ----------
  async function loadCoupons() {
    const r = await api('admin_coupons'); if (!r.ok) return;
    const data = await r.json();
    document.getElementById('couponBody').innerHTML = (Array.isArray(data) ? data : []).map(c => `<tr>
      <td><b>${c.code}</b></td><td>${c.type === 'PERCENT' ? '٪' : 'تومان'}</td><td>${c.value}</td><td>${c.used_count || 0}${c.usage_limit ? '/' + c.usage_limit : ''}</td>
      <td><input type="checkbox" class="cAct" data-id="${c.id}" ${c.active ? 'checked' : ''}></td>
      <td><button class="del-btn cDel" data-id="${c.id}">حذف</button></td>
    </tr>`).join('');
    document.querySelectorAll('.cAct').forEach(i => i.onchange = async () => { await api('admin_coupons', { method: 'PATCH', body: JSON.stringify({ id: i.dataset.id, upd: { active: i.checked } }) }); });
    document.querySelectorAll('.cDel').forEach(b => b.onclick = async () => { if (!confirm('حذف؟')) return; await api('admin_coupons?id=' + b.dataset.id, { method: 'DELETE' }); loadCoupons(); });
  }

  // ---------- Diet Builder ----------
  let dietUid = null, dietPlanId = null, dayCount = 0;
  async function pickUsers() {
    const q = document.getElementById('dq').value;
    const r = await api('admin_users&q=' + encodeURIComponent(q)); const data = await r.json();
    document.getElementById('duPick').innerHTML = (Array.isArray(data) ? data : []).map(u => `<option value="${u.id}">${u.email}</option>`).join('');
  }
  function addDayBox() {
    dayCount++;
    const div = document.createElement('div');
    div.className = 'day-box';
    div.innerHTML = `<b>روز ${dayCount}</b> <button class="del-btn rmDay">حذف روز</button><div class="meals"></div><button class="btn small addMeal">➕ وعده</button>`;
    div.querySelector('.rmDay').onclick = () => div.remove();
    div.querySelector('.addMeal').onclick = () => addMealRow(div.querySelector('.meals'));
    document.getElementById('daysBox').appendChild(div);
  }
  function addMealRow(box, m) {
    const row = document.createElement('div');
    row.className = 'meal-row';
    row.innerHTML = `<select class="mType"><option value="breakfast">صبحانه</option><option value="lunch">ناهار</option><option value="snack">میان‌وعده</option><option value="dinner">شام</option></select>
    <select class="mRec"><option value="">— رسپی —</option>${REC.map(r => `<option value="${r.id}">${r.name_fa}</option>`).join('')}</select>
    <input class="mTitle" placeholder="عنوان/ماده" value="${m ? m.title : ''}"><input class="mPortion" placeholder="مقدار" value="${m ? m.portion : ''}"><button class="del-btn rmM">✕</button>`;
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
    dietUid = document.getElementById('duPick').value;
    if (!dietUid) { alert('کاربر انتخاب کن'); return; }
    const g = id => document.getElementById(id).value;
    const r = await api('admin_diet_save', { method: 'POST', body: JSON.stringify({ id: dietPlanId, user_id: dietUid, title: g('dTitle'), goal: g('dGoal'), start_date: g('dStart') || null, end_date: g('dEnd') || null, duration_days: g('dDur'), kcal_target: g('dKcal'), protein_target: g('dPro'), carbs_target: g('dCarb'), fat_target: g('dFat'), notes: g('dNotes'), days: collectDays() }) });
    const j = await r.json();
    if (!r.ok) { alert(j.error || 'خطا'); return; }
    dietPlanId = j.id; alert('ذخیره شد ✅'); loadDietList();
  }
  async function genPdf() {
    if (!dietPlanId) { alert('اول ذخیره کن'); return; }
    const det = await (await api('admin_diet_detail&id=' + dietPlanId)).json();
    const plan = det.plan; const days = Array.isArray(det.days) ? det.days : [];
    const uname = document.getElementById('duPick').selectedOptions[0] ? document.getElementById('duPick').selectedOptions[0].textContent : '';
    const doc = document.getElementById('pdfDoc');
    doc.innerHTML = `
      <div style="padding:40px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">
        <div style="background:#2d6a35;border-radius:22px;padding:28px;color:#fff;display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-size:26px;font-weight:900">DailyFitBeat | دیلی‌بیت</div>
          <div style="opacity:.9;margin-top:6px">برنامه غذایی اختصاصی — ${plan.title}</div></div>
          <div style="font-size:40px">🥗</div>
        </div>
        <div style="display:flex;gap:14px;margin:22px 0;flex-wrap:wrap">
          <div style="background:#f2f7f2;border-radius:14px;padding:12px 18px"><b>کاربر:</b> ${uname}</div>
          <div style="background:#f2f7f2;border-radius:14px;padding:12px 18px"><b>هدف:</b> ${plan.goal || '—'}</div>
          <div style="background:#f2f7f2;border-radius:14px;padding:12px 18px"><b>مدت:</b> ${plan.duration_days || '—'} روز</div>
          <div style="background:#f2f7f2;border-radius:14px;padding:12px 18px"><b>تاریخ:</b> ${new Date().toLocaleDateString('fa-IR')}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
          <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${plan.kcal_target || 0}</b><br><small>کالری روزانه</small></div>
          <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${plan.protein_target || 0}g</b><br><small>پروتئین</small></div>
          <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${plan.carbs_target || 0}g</b><br><small>کربوهیدرات</small></div>
          <div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">${plan.fat_target || 0}g</b><br><small>چربی</small></div>
        </div>
        ${days.map(d => `<div style="margin-bottom:20px">
          <div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ${d.day_number}</div>
          <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">
            ${(d.diet_plan_meals || []).map(m => `<tr style="border-bottom:1px solid #e5efe5"><td style="padding:9px;font-weight:700;width:90px">${{ breakfast: 'صبحانه', lunch: 'ناهار', snack: 'میان‌وعده', dinner: 'شام' }[m.meal_type] || m.meal_type}</td><td style="padding:9px">${m.title || (REC.find(x => x.id === m.recipe_id) || {}).name_fa || '—'}</td><td style="padding:9px;color:#557">${m.portion || ''}</td></tr>`).join('')}
          </table>
        </div>`).join('')}
        ${plan.notes ? `<div style="background:#fff8e6;border-radius:14px;padding:16px;margin-top:10px"><b>📝 توضیحات و نکات:</b><br>${plan.notes}</div>` : ''}
        <div style="margin-top:30px;border-top:2px solid #e8f4e9;padding-top:14px;display:flex;justify-content:space-between;font-size:11px;color:#77807a">
          <span>dailyfitbeat.ir</span><span>اینستاگرام: @dailyfitbeat</span><span>خوب بخور، بهتر زندگی کن 💚</span>
        </div>
      </div>`;
    await document.fonts.ready;
    const canvas = await html2canvas(doc, { scale: 2, backgroundColor: '#fff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = 210, ph = 297;
    const iw = pw, ih = canvas.height * pw / canvas.width;
    let left = ih, pos = 0;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, pos, iw, ih);
    left -= ph;
    while (left > 0) { pos -= ph; pdf.addPage(); pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, pos, iw, ih); left -= ph; }
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
      <b>${p.title}</b> — <span class="pbadge" style="background:${p.status === 'published' ? '#2d6a35' : '#b26a00'}">${p.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}</span>
      <small> — ${new Date(p.created_at).toLocaleDateString('fa-IR')}</small><br>
      <button class="btn small dEdit" data-id="${p.id}">ویرایش</button>
      <button class="warn-btn dPub" data-id="${p.id}">انتشار</button>
      <button class="del-btn dDel" data-id="${p.id}">حذف</button>
    </div>`).join('') || '<p>هنوز برنامه‌ای نیست</p>';
    document.querySelectorAll('.dEdit').forEach(b => b.onclick = async () => {
      dietPlanId = +b.dataset.id;
      const det = await (await api('admin_diet_detail&id=' + dietPlanId)).json();
      const pl = det.plan;
      const g = id => document.getElementById(id);
      g('dTitle').value = pl.title; g('dGoal').value = pl.goal || ''; g('dStart').value = pl.start_date || ''; g('dEnd').value = pl.end_date || ''; g('dDur').value = pl.duration_days || ''; g('dKcal').value = pl.kcal_target || ''; g('dPro').value = pl.protein_target || ''; g('dCarb').value = pl.carbs_target || ''; g('dFat').value = pl.fat_target || ''; g('dNotes').value = pl.notes || '';
      document.getElementById('daysBox').innerHTML = ''; dayCount = 0;
      (Array.isArray(det.days) ? det.days : []).forEach(d => { addDayBox(); const mb = document.querySelectorAll('#daysBox .day-box').slice(-1)[0].querySelector('.meals'); (d.diet_plan_meals || []).forEach(m => addMealRow(mb, m)); });
      document.getElementById('dietForm').style.display = 'grid';
    });
    document.querySelectorAll('.dPub').forEach(b => b.onclick = async () => { await api('admin_diet_publish', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) }); loadDietList(); });
    document.querySelectorAll('.dDel').forEach(b => b.onclick = async () => { if (!confirm('حذف؟')) return; await api('admin_diet_delete', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) }); loadDietList(); });
  }

  function bindAll() {
    document.getElementById('csvBtn').onclick = exportCSV;
    document.getElementById('filterSt').onchange = loadOrders;
    document.getElementById('rNew').onclick = () => fillForm(null);
    document.getElementById('rSave').onclick = saveRecipe;
    document.getElementById('aAdd').onclick = addProd;
    document.getElementById('pAdd').onclick = async () => {
      const t = document.getElementById('pTitle').value.trim(); const pr = +document.getElementById('pPrice').value;
      if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
      await sb.from('plans').insert({ key: 'plan-' + Date.now(), title_fa: t, period: document.getElementById('pPeriod').value || 'ماهانه', days: +document.getElementById('pDays').value || 30, price_rial: pr, old_price_rial: +document.getElementById('pOld').value || null, features: [] });
      loadPlans();
    };
    document.getElementById('uqBtn').onclick = () => loadUsers(document.getElementById('uq').value);
    document.getElementById('cAdd').onclick = async () => {
      const r = await api('admin_coupons', { method: 'POST', body: JSON.stringify({ code: document.getElementById('cCode').value, type: document.getElementById('cType').value, value: +document.getElementById('cValue').value, usage_limit: +document.getElementById('cLimit').value || null, end_date: document.getElementById('cEnd').value || null, pro_only: document.getElementById('cPro').checked }) });
      if (!r.ok) alert('خطا'); loadCoupons();
    };
    document.getElementById('dqBtn').onclick = async () => { await pickUsers(); loadDietList(); };
    document.getElementById('dNew').onclick = () => { dietPlanId = null; dayCount = 0; document.getElementById('daysBox').innerHTML = ''; document.getElementById('dietForm').style.display = 'grid'; addDayBox(); };
    document.getElementById('dAddDay').onclick = addDayBox;
    document.getElementById('dSave').onclick = saveDiet;
    document.getElementById('dPdf').onclick = genPdf;
  }
  async function exportCSV() {
    const r = await api('all_orders'); const data = await r.json();
    const rows = [['کد', 'تاریخ', 'نام', 'موبایل', 'ایمیل', 'محصول', 'کد واریز', 'وضعیت', 'مبلغ', 'یادداشت']];
    (Array.isArray(data) ? data : []).forEach(o => rows.push([o.id, new Date(o.created_at).toLocaleString('fa-IR'), o.name, o.phone, o.email, o.product, o.ref, o.status, o.total || '', o.note || '']));
    const csv = '\uFEFF' + rows.map(r2 => r2.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'dailyfitbeat-orders.csv'; a.click();
  }
})();
