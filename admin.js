(function () {
  if (document.body.dataset.page !== 'admin') return;
  var sb = null, started = false, REC = [];
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  var wait = setInterval(function () {
    if (started || !window.DFB || !DFB.sb) return;
    if (DFB.isAdmin()) {
      started = true;
      clearInterval(wait);
      sb = DFB.sb;
      init().catch(function (e) {
        console.error('admin init failed:', e);
        var st = document.getElementById('adminStat');
        if (st) st.textContent = 'خطا در بارگذاری بخشی از پنل — Console را ببین';
      });
    }
  }, 400);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function sv(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
  function rialFa(n) { return (Number(n) || 0).toLocaleString('fa-IR') + ' ریال'; }
  function fmt(n) { return (Number(n) || 0).toLocaleString('fa-IR'); }
  function faDate(d) { return d ? new Date(d).toLocaleDateString('fa-IR') : '—'; }
  function safe(name, fn) {
    return Promise.resolve().then(fn).catch(function (e) { console.error('admin section error (' + name + '):', e); });
  }
  function normNum(s) {
    if (s === '' || s == null) return null;
    var t = String(s).replace(/[۰-۹]/g, function (x) { return String(FA.indexOf(x)); }).replace(/[,،٬\s]/g, '');
    if (t === '') return null;
    var n = Number(t);
    return isNaN(n) ? null : n;
  }
  function bindMoney(inp) {
    if (!inp || inp.dataset.money) return;
    inp.dataset.money = '1';
    inp.addEventListener('input', function () {
      var digits = inp.value.replace(/[۰-۹]/g, function (x) { return String(FA.indexOf(x)); }).replace(/\D/g, '');
      inp.value = digits ? Number(digits).toLocaleString('fa-IR') : '';
    });
  }
  var OK_EXT = /\.(pdf|zip|rar|jpe?g|png|webp|mp4|mp3)$/i;
  async function tok() {
    try {
      if (!sb) return null;
      var s = await sb.auth.getSession();
      if (!s || !s.data || !s.data.session) return null;
      return s.data.session.access_token || null;
    } catch (e) { return null; }
  }
  async function api(t, opts) {
    var token = await tok();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('/api/db?t=' + t, Object.assign({ headers: headers }, opts || {}));
  }
  var STATUS_FA = { new: 'جدید', pending: 'در انتظار پرداخت', payment_submitted: 'واریز ثبت شده', under_review: 'در بررسی', paid: 'پرداخت شده', processing: 'در حال پردازش', delivered: 'تحویل شده', sent: 'ارسال شده', rejected: 'رد شده', cancelled: 'لغو شده', refunded: 'مسترد شده' };
  var PAY_FA = { pending: 'در انتظار', submitted: 'واریز ثبت شده', approved: 'تأیید شده', rejected: 'رد شده', refunded: 'مسترد' };
  var TYPE_FA = { DIGITAL_PRODUCT: 'محصول دیجیتال', SERVICE: 'خدمت', SUBSCRIPTION: 'اشتراک', BUNDLE: 'باندل' };
  var MFA = { breakfast: 'صبحانه', snack_am: 'میان‌وعده صبح', lunch: 'ناهار', snack_pm: 'میان‌وعده عصر', dinner: 'شام', snack: 'میان‌وعده' };

  function pager(el, page, total, lim, cb) {
    var pages = Math.max(1, Math.ceil(total / lim));
    el.innerHTML = '<button ' + (page <= 1 ? 'disabled' : '') + ' data-p="' + (page - 1) + '">قبلی</button><span>صفحه ' + page.toLocaleString('fa-IR') + ' از ' + pages.toLocaleString('fa-IR') + ' (' + total.toLocaleString('fa-IR') + ' رکورد)</span><button ' + (page >= pages ? 'disabled' : '') + ' data-p="' + (page + 1) + '">بعدی</button>';
    el.querySelectorAll('button').forEach(function (b) { b.onclick = function () { cb(+b.dataset.p); }; });
  }
  function bindJalali(id) {
    var inp = document.getElementById(id);
    if (!inp || inp.dataset.jal) return;
    inp.dataset.jal = '1';
    var sp = document.createElement('span');
    sp.className = 'jal';
    inp.insertAdjacentElement('afterend', sp);
    var upd = function () { sp.textContent = inp.value ? '= ' + new Date(inp.value).toLocaleDateString('fa-IR') : ''; };
    inp.addEventListener('change', upd);
    upd();
  }

  async function init() {
    document.querySelectorAll('.aside button').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.aside button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        document.querySelectorAll('.apane').forEach(function (p) { p.style.display = (p.id === 'pane-' + b.dataset.t) ? 'block' : 'none'; });
        if (b.dataset.t === 'dash') safe('dash', loadDash);
        if (b.dataset.t === 'payments') safe('payments', function () { return loadPayments(1); });
        if (b.dataset.t === 'users') safe('users', function () { return loadUsers(document.getElementById('uq').value, 1); });
        if (b.dataset.t === 'coupons') safe('coupons', loadCoupons);
        if (b.dataset.t === 'audit') safe('audit', loadAudit);
        if (b.dataset.t === 'diet') safe('diet', function () { pickUsers(); loadDietList(); });
        if (b.dataset.t === 'orders') safe('orders', function () { return loadOrders(1); });
      };
    });
    await refreshREC().catch(function (e) { console.error('recipes load error:', e); });
    await safe('dash', loadDash);
    await safe('orders', function () { return loadOrders(1); });
    await safe('prods', loadProds);
    await safe('plans', loadPlans);
    await safe('recipes', loadRecipes);
    bindJalali('dStart'); bindJalali('dEnd'); bindJalali('cEnd');
    ['aPrice', 'aOld', 'pPrice', 'pOld'].forEach(function (id) { bindMoney(document.getElementById(id)); });
    bindAll();
  }
  async function refreshREC() { REC = await (await fetch('/api/db?t=all')).json(); }

  async function loadDash() {
    var r = await api('admin_stats');
    if (!r.ok) return;
    var s = await r.json();
    document.getElementById('statsBox').innerHTML =
      '<div class="sc"><b>' + fmt(s.users) + '</b><span>کاربران</span></div>' +
      '<div class="sc"><b>' + fmt(s.orders) + '</b><span>سفارش‌ها</span></div>' +
      '<div class="sc"><b>' + fmt(s.paid_orders) + '</b><span>پرداخت شده</span></div>' +
      '<div class="sc"><b>' + fmt(s.pending_orders) + '</b><span>در انتظار</span></div>' +
      '<div class="sc"><b>' + rialFa(s.revenue) + '</b><span>درآمد تأییدشده</span></div>' +
      '<div class="sc"><b>' + fmt(s.active_pro) + '</b><span>PRO فعال</span></div>' +
      '<div class="sc"><b>' + fmt(s.expired_pro) + '</b><span>PRO منقضی</span></div>';
    var a = await (await api('admin_audit')).json();
    document.getElementById('dashAudit').innerHTML = (Array.isArray(a) ? a.slice(0, 8) : []).map(function (x) {
      return '<tr><td>' + faDate(x.created_at) + '</td><td>' + esc(x.admin_email) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.target_type) + '#' + esc(x.target_id) + '</td></tr>';
    }).join('');
  }
  async function loadAudit() {
    var a = await (await api('admin_audit')).json();
    document.getElementById('auditBody').innerHTML = (Array.isArray(a) ? a : []).map(function (x) {
      return '<tr><td>' + faDate(x.created_at) + '</td><td>' + esc(x.admin_email) + '</td><td>' + esc(x.action) + '</td><td>' + esc(x.target_type) + '#' + esc(x.target_id) + '</td><td>' + esc(JSON.stringify(x.meta || {})) + '</td></tr>';
    }).join('');
  }

  async function loadOrders(page) {
    var st = document.getElementById('filterSt').value;
    var r = await api('all_orders&page=' + page + '&status=' + st);
    if (!r.ok) return;
    var j = await r.json();
    var list = j.rows || [];
    document.getElementById('ordersBody').innerHTML = list.map(function (o) {
      var bg = ['paid', 'delivered', 'sent'].indexOf(o.status) !== -1 ? '#2d6a35' : (['rejected', 'cancelled'].indexOf(o.status) !== -1 ? '#d33' : '#b26a00');
      return '<tr><td>#' + o.id + '</td><td>' + faDate(o.created_at) + '</td><td>' + (esc(o.name) || '-') + '</td><td dir="ltr">' + (esc(o.phone) || '-') + '</td><td>' + (esc(o.product) || '-') + '</td><td>' + (o.total ? rialFa(o.total) : '-') + '</td><td>' + (o.payment_method === 'GATEWAY' ? 'درگاه' : 'دستی') + '</td><td><span class="pbadge" style="background:' + bg + '">' + (STATUS_FA[o.status] || esc(o.status)) + '</span></td><td><select data-id="' + o.id + '" class="stSel"><option value="">تغییر وضعیت…</option>' + Object.keys(STATUS_FA).map(function (k) { return '<option value="' + k + '">' + STATUS_FA[k] + '</option>'; }).join('') + '</select></td><td><button class="del-btn delO" data-id="' + o.id + '">حذف</button></td></tr>';
    }).join('') || '<tr><td colspan="10">سفارشی نیست</td></tr>';
    pager(document.getElementById('pagerO'), page, j.total || 0, 20, loadOrders);
    document.querySelectorAll('.stSel').forEach(function (sel) {
      sel.onchange = async function () {
        if (!sel.value) return;
        var r2 = await api('set_status', { method: 'POST', body: JSON.stringify({ id: sel.dataset.id, status: sel.value }) });
        if (!r2.ok) alert('خطا در تغییر وضعیت');
        loadOrders(page);
      };
    });
    document.querySelectorAll('.delO').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('سفارش حذف بشه؟')) return;
        await api('admin_delete_order', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) });
        loadOrders(page);
      };
    });
  }

  async function loadPayments(page) {
    var r = await api('admin_payments&page=' + page);
    if (!r.ok) return;
    var j = await r.json();
    var list = j.rows || [];
    document.getElementById('payBody').innerHTML = list.map(function (p) {
      var bg = p.status === 'approved' ? '#2d6a35' : (p.status === 'rejected' ? '#d33' : '#b26a00');
      var ops = (p.status === 'submitted' || p.status === 'pending') ? '<button class="ok-btn apP" data-id="' + p.id + '">تأیید</button> <button class="del-btn rjP" data-id="' + p.id + '">رد</button>' : '—';
      return '<tr><td>#' + p.id + '</td><td>' + faDate(p.created_at) + '</td><td>#' + p.order_id + '</td><td>' + (esc(p.orders && p.orders.email) || '-') + '</td><td>' + rialFa(p.amount) + '</td><td>' + (p.provider === 'GATEWAY' ? 'درگاه' : 'دستی') + '</td><td dir="ltr">' + (esc(p.reference) || '-') + '</td><td><span class="pbadge" style="background:' + bg + '">' + (PAY_FA[p.status] || esc(p.status)) + '</span></td><td>' + ops + '</td><td><button class="del-btn delPay" data-id="' + p.id + '">حذف</button></td></tr>';
    }).join('') || '<tr><td colspan="10">پرداختی نیست</td></tr>';
    pager(document.getElementById('pagerP'), page, j.total || 0, 20, loadPayments);
    document.querySelectorAll('.apP').forEach(function (b) {
      b.onclick = async function () {
        var r2 = await api('approve_payment', { method: 'POST', body: JSON.stringify({ payment_id: +b.dataset.id }) });
        var j2 = await r2.json();
        alert(r2.ok ? (j2.already ? 'قبلاً تأیید شده' : 'تأیید شد — دسترسی ساخته شد') : 'خطا');
        loadPayments(page);
      };
    });
    document.querySelectorAll('.rjP').forEach(function (b) {
      b.onclick = async function () {
        var reason = prompt('دلیل رد (اختیاری):') || '';
        await api('reject_payment', { method: 'POST', body: JSON.stringify({ payment_id: +b.dataset.id, reason: reason }) });
        loadPayments(page);
      };
    });
    document.querySelectorAll('.delPay').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('پرداخت حذف بشه؟')) return;
        await api('admin_delete_payment', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) });
        loadPayments(page);
      };
    });
  }

  async function loadRecipes() {
    document.getElementById('recBody').innerHTML = REC.map(function (r) {
      return '<tr><td><b>' + esc(r.name_fa) + '</b><br><small dir="ltr">' + esc(r.slug) + '</small></td><td>' + esc(r.category) + '</td><td>' + (esc(r.region) || '-') + '</td><td>' + fmt(r.kcal) + '</td><td><button class="btn small edR" data-s="' + esc(r.slug) + '">ویرایش</button></td><td><button class="del-btn dlR" data-s="' + esc(r.slug) + '">حذف</button></td></tr>';
    }).join('');
    document.querySelectorAll('.edR').forEach(function (b) { b.onclick = function () { fillForm(REC.find(function (x) { return x.slug === b.dataset.s; })); }; });
    document.querySelectorAll('.dlR').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('حذف بشه؟')) return;
        await sb.from('recipes').delete().eq('slug', b.dataset.s);
        await refreshREC();
        loadRecipes();
      };
    });
  }
  function fillForm(r) {
    function g(id) { return document.getElementById(id); }
    g('rSlug').value = r ? r.slug : '';
    g('rSlug').disabled = !!r;
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
    g('rIngs').value = r ? (r.ingredients || []).map(function (i) { return i.fa + ':' + i.q; }).join('\n') : '';
    g('rSteps').value = r ? (r.steps || []).join('\n') : '';
    g('rTips').value = r ? (r.tips || []).join('\n') : '';
    document.getElementById('recForm').style.display = 'grid';
  }
  async function saveRecipe() {
    function g(id) { return document.getElementById(id).value; }
    var slug = g('rSlug').trim();
    if (!slug || !g('rNameFa').trim()) { alert('slug و نام لازمه'); return; }
    var obj = {
      slug: slug, name_fa: g('rNameFa').trim(), name_en: g('rNameEn').trim() || g('rNameFa').trim(),
      category: g('rCat'), region: g('rRegion').trim() || 'ایران', time_min: +g('rTime') || 30,
      kcal: +g('rKcal') || 0, protein: +g('rProtein') || 0,
      carbs: g('rCarbs') === '' ? null : +g('rCarbs'), fat: g('rFat') === '' ? null : +g('rFat'),
      fiber: g('rFiber') === '' ? null : +g('rFiber'), sugar: g('rSugar') === '' ? null : +g('rSugar'),
      image: g('rImage').trim() || null, video_url: g('rVideo').trim() || null, desc_fa: g('rDesc').trim(),
      tags: g('rTags').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      keys: g('rKeys').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      ingredients: g('rIngs').split('\n').map(function (l) { var p = l.split(':'); return { fa: (p[0] || '').trim(), q: (p[1] || '').trim() || 'به‌اندازه' }; }).filter(function (i) { return i.fa; }),
      steps: g('rSteps').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      tips: g('rTips').split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
    };
    var exists = REC.find(function (x) { return x.slug === slug; });
    var res = exists ? await sb.from('recipes').update(obj).eq('slug', slug) : await sb.from('recipes').insert(obj);
    if (res.error) { alert('خطا: ' + res.error.message); return; }
    await refreshREC();
    alert('ذخیره شد');
    document.getElementById('recForm').style.display = 'none';
    loadRecipes();
  }

  async function loadProds() {
    var data = await (await fetch('/api/db?t=products')).json();
    document.getElementById('prodBody2').innerHTML = (Array.isArray(data) ? data : []).map(function (p) {
      return '<tr><td><b>' + esc(p.title_fa) + '</b></td>' +
        '<td><input type="text" data-id="' + p.id + '
