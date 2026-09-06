(function () {
  if (document.body.dataset.page !== 'admin') return;
  var sb = null, started = false, REC = [];
  var FA = '۰۱۲۳۴۵۶۷۸۹';
  var AR = '٠١٢٣٤٥٦٧٨٩';
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
  // تبدیل یکجا اعداد فارسی/عربی + حذف جداکننده‌ها؛ بدون هیچ محاسبه اضافه
  function toNum(s) {
    if (s === '' || s == null) return null;
    var t = String(s)
      .replace(/[۰-۹]/g, function (x) { return String(FA.indexOf(x)); })
      .replace(/[٠-٩]/g, function (x) { return String(AR.indexOf(x)); })
      .replace(/[,،٬\s]/g, '');
    if (t === '') return null;
    var n = Number(t);
    return isNaN(n) ? null : n;
  }
  function normNum(s) { return toNum(s); }
  function bindMoney(inp) {
    if (!inp || inp.dataset.money) return;
    inp.dataset.money = '1';
    inp.addEventListener('input', function () {
      var digits = inp.value
        .replace(/[۰-۹]/g, function (x) { return String(FA.indexOf(x)); })
        .replace(/[٠-٩]/g, function (x) { return String(AR.indexOf(x)); })
        .replace(/\D/g, '');
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
        if (b.dataset.t === 'users') safe('users', function () { return loadUsers(gv('uq'), 1); });
        if (b.dataset.t === 'coupons') safe('coupons', loadCoupons);
        if (b.dataset.t === 'audit') safe('audit', loadAudit);
        if (b.dataset.t === 'diet') safe('diet', function () { pickUsers(); loadDietList(); });
        if (b.dataset.t === 'orders') safe('orders', function () { return loadOrders(1); });
        if (b.dataset.t === 'seo') safe('seo', function () { loadRedirects(); loadFaqs(); });
        if (b.dataset.t === 'media') safe('media', loadMedia);
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
  async function refreshREC() {
    var r = await fetch('/api/db?t=all_admin', { headers: { Authorization: 'Bearer ' + (await tok()) } });
    if (!r.ok) { REC = await (await fetch('/api/db?t=all')).json(); return; }
    REC = await r.json();
  }

  /* امتیاز SEO ساده هر رسپی (۰ تا ۱۰۰) */
  function seoScore(r) {
    var pts = 0;
    if ((r.meta_title || r.name_fa || '').length >= 10) pts += 20;
    if ((r.meta_description || r.desc_fa || '').length >= 60) pts += 25;
    if (r.image) pts += 15;
    if (Array.isArray(r.steps) && r.steps.length >= 4) pts += 15;
    if (Array.isArray(r.tips) && r.tips.length) pts += 5;
    if (r.kcal > 0 && r.protein > 0) pts += 10;
    if (r.time_min > 0) pts += 5;
    if (Array.isArray(r.tags) && r.tags.length) pts += 5;
    return pts;
  }

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
      '<div class="sc"><b>' + fmt(s.expired_pro) + '</b><span>PRO منقضی</span></div>' +
      '<div class="sc"><b>' + fmt(s.recipes) + '</b><span>رسپی‌ها</span></div>' +
      '<div class="sc warn"><b>' + fmt(s.drafts) + '</b><span>پیش‌نویس</span></div>' +
      '<div class="sc"><b>' + fmt(s.ai_month) + '</b><span>مصرف AI (ماه)</span></div>';
    /* نمودار SVG سفارش‌های ۱۴ روز */
    var ch = document.getElementById('chartOrders');
    var od = s.orders_14d || [];
    if (ch && od.length) {
      var max = Math.max.apply(null, od.map(function (o) { return o.n; }).concat([1]));
      var W = 560, H = 120, bw = W / od.length;
      var bars = od.map(function (o, i) {
        var h = Math.round((o.n / max) * (H - 24));
        return '<rect x="' + (i * bw + bw * 0.18).toFixed(1) + '" y="' + (H - 18 - h) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + h + '" rx="3" fill="var(--accent)" opacity="0.85"><title>' + o.day + ': ' + o.n + '</title></rect>' +
          (i % 3 === 0 ? '<text x="' + (i * bw + bw / 2) + '" y="' + (H - 4) + '" font-size="9" text-anchor="middle" fill="var(--muted)">' + o.day.slice(5) + '</text>' : '');
      }).join('');
      ch.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto" dir="ltr">' + bars + '</svg>';
    }
    /* پربازدیدترین‌ها */
    var tv = document.getElementById('topViewed');
    if (tv) {
      tv.innerHTML = (s.top_viewed || []).map(function (v) {
        var rec = REC.find(function (x) { return x.slug === v.slug; });
        return '<tr><td><b>' + esc(rec ? rec.name_fa : v.slug) + '</b><br><small dir="ltr">' + esc(v.slug) + '</small></td><td>' + fmt(v.n) + '</td><td><a class="btn small" href="recipe.html?slug=' + esc(v.slug) + '" target="_blank">باز کن</a></td></tr>';
      }).join('') || '<tr><td colspan="3">هنوز بازدیدی ثبت نشده</td></tr>';
    }
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
      var opts = Object.keys(STATUS_FA).map(function (k) { return '<option value="' + k + '">' + STATUS_FA[k] + '</option>'; }).join('');
      return '<tr><td>#' + o.id + '</td><td>' + faDate(o.created_at) + '</td><td>' + (esc(o.name) || '-') + '</td><td dir="ltr">' + (esc(o.phone) || '-') + '</td><td>' + (esc(o.product) || '-') + '</td><td>' + (o.total ? rialFa(o.total) : '-') + '</td><td>' + (o.payment_method === 'GATEWAY' ? 'درگاه' : 'دستی') + '</td><td><span class="pbadge" style="background:' + bg + '">' + (STATUS_FA[o.status] || esc(o.status)) + '</span></td><td><select data-id="' + o.id + '" class="stSel"><option value="">تغییر وضعیت…</option>' + opts + '</select></td><td><button class="del-btn delO" data-id="' + o.id + '">حذف</button></td></tr>';
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
      var sc = seoScore(r);
      var cls = sc >= 80 ? 'ok' : sc >= 50 ? 'mid' : 'low';
      return '<tr><td><b>' + esc(r.name_fa) + '</b><br><small dir="ltr">' + esc(r.slug) + '</small></td><td>' + (r.status === 'draft' ? '<span class="st-badge draft">پیش‌نویس</span>' : '<span class="st-badge pub">منتشر</span>') + '</td><td><span class="score ' + cls + '">' + sc + '</span></td><td>' + esc(r.category) + '</td><td>' + fmt(r.kcal) + '</td><td><button class="btn small edR" data-s="' + esc(r.slug) + '">ویرایش</button></td><td><button class="del-btn dlR" data-s="' + esc(r.slug) + '">حذف</button></td></tr>';
    }).join('');
    document.querySelectorAll('.edR').forEach(function (b) {
      b.onclick = function () {
        fillForm(REC.find(function (x) { return x.slug === b.dataset.s; }));
      };
    });
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
    g('rMetaTitle').value = r ? (r.meta_title || '') : '';
    g('rMetaDesc').value = r ? (r.meta_description || '') : '';
    g('rStatus').value = r ? (r.status || 'published') : 'published';
    g('rNoindex').checked = r ? !!r.noindex : false;
    document.getElementById('recForm').style.display = 'grid';
  }
  async function saveRecipe() {
    function g(id) { return document.getElementById(id).value; }
    var slug = g('rSlug').trim();
    if (!slug || !g('rNameFa').trim()) { alert('slug و نام لازمه'); return; }
    var obj = {
      slug: slug, name_fa: g('rNameFa').trim(), name_en: g('rNameEn').trim() || g('rNameFa').trim(),
      category: g('rCat'), region: g('rRegion').trim() || 'ایران', time_min: toNum(g('rTime')) || 30,
      kcal: toNum(g('rKcal')) || 0, protein: toNum(g('rProtein')) || 0,
      carbs: toNum(g('rCarbs')), fat: toNum(g('rFat')),
      fiber: toNum(g('rFiber')), sugar: toNum(g('rSugar')),
      image: g('rImage').trim() || null, video_url: g('rVideo').trim() || null, desc_fa: g('rDesc').trim(),
      tags: g('rTags').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      keys: g('rKeys').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      ingredients: g('rIngs').split('\n').map(function (l) { var p = l.split(':'); return { fa: (p[0] || '').trim(), q: (p[1] || '').trim() || 'به‌اندازه' }; }).filter(function (i) { return i.fa; }),
      steps: g('rSteps').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      tips: g('rTips').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      meta_title: g('rMetaTitle').trim() || null,
      meta_description: g('rMetaDesc').trim() || null,
      status: g('rStatus') === 'draft' ? 'draft' : 'published',
      noindex: document.getElementById('rNoindex').checked
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
        '<td><input type="text" data-id="' + p.id + '" data-f="price_rial" value="' + (p.price_rial ? fmt(p.price_rial) : '') + '"></td>' +
        '<td><input type="text" data-id="' + p.id + '" data-f="old_price_rial" value="' + (p.old_price_rial ? fmt(p.old_price_rial) : '') + '"></td>' +
        '<td><input type="number" data-id="' + p.id + '" data-f="off_percent" value="' + (p.off_percent || 0) + '"></td>' +
        '<td><select data-id="' + p.id + '" data-f="type">' + Object.keys(TYPE_FA).map(function (k) { return '<option value="' + k + '" ' + (p.type === k ? 'selected' : '') + '>' + TYPE_FA[k] + '</option>'; }).join('') + '</select></td>' +
        '<td><input type="number" data-id="' + p.id + '" data-f="access_days" value="' + (p.access_days || '') + '"></td>' +
        '<td><input type="file" class="pFile" data-id="' + p.id + '" accept=".pdf,.zip,.rar,.jpg,.jpeg,.png,.webp,.mp4,.mp3"><span class="hint">PDF/ZIP/JPG/MP4… تا ۱۵MB</span><br><small dir="ltr">' + (esc(p.file_path) || '—') + '</small></td>' +
        '<td><button class="del-btn dlP" data-id="' + p.id + '">حذف</button></td>' +
        '<td><button class="btn small svP" data-id="' + p.id + '">ذخیره</button></td>' +
        '<td><input type="checkbox" data-id="' + p.id + '" data-f="active" ' + (p.active ? 'checked' : '') + '></td></tr>';
    }).join('');
    document.querySelectorAll('#prodBody2 input[data-f="price_rial"], #prodBody2 input[data-f="old_price_rial"]').forEach(bindMoney);
    document.querySelectorAll('.svP').forEach(function (b) {
      b.onclick = async function () {
        var id = b.dataset.id, upd = {};
        document.querySelectorAll('#prodBody2 [data-id="' + id + '"][data-f]').forEach(function (i) {
          if (i.dataset.f === 'active') upd.active = i.checked;
          else if (i.dataset.f === 'type') upd.type = i.value;
          else if (i.dataset.f === 'price_rial' || i.dataset.f === 'old_price_rial') upd[i.dataset.f] = toNum(i.value);
          else upd[i.dataset.f] = i.value === '' ? null : toNum(i.value);
        });
        var file = document.querySelector('.pFile[data-id="' + id + '"]').files[0];
        if (file) {
          if (!OK_EXT.test(file.name)) { alert('فرمت مجاز: PDF/ZIP/RAR/JPG/PNG/WEBP/MP4/MP3'); return; }
          var base64 = await new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result.split(',')[1]); }; fr.readAsDataURL(file); });
          var path = 'products/p' + id + '-' + file.name;
          var up = await api('upload_file', { method: 'POST', body: JSON.stringify({ path: path, base64: base64, mime: file.type }) });
          if (up.ok) upd.file_path = path; else alert('آپلود فایل ناموفق');
        }
        var r3 = await sb.from('products').update(upd).eq('id', id);
        if (r3.error) { alert('خطا: ' + r3.error.message); return; }
        alert('ذخیره شد');
        loadProds();
      };
    });
    document.querySelectorAll('.dlP').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('محصول حذف بشه؟ (سفارش‌های قبلی حفظ می‌مونن)')) return;
        var r = await api('admin_delete_product', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) });
        if (!r.ok) alert('حذف ناموفق'); else loadProds();
      };
    });
  }
  async function addProd() {
    var t = document.getElementById('aTitle').value.trim();
    var pr = toNum(document.getElementById('aPrice').value);
    if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
    var ins = await sb.from('products').insert({
      title_fa: t, desc_fa: document.getElementById('aDesc').value.trim(), price_rial: pr,
      old_price_rial: toNum(document.getElementById('aOld').value), off_percent: toNum(document.getElementById('aOff').value) || 0,
      rating: 4.8, type: document.getElementById('aType').value, access_days: toNum(document.getElementById('aDays').value),
      image: document.getElementById('aImg').value || null
    }).select().single();
    if (ins.error) { alert(ins.error.message); return; }
    var file = document.getElementById('aFile').files[0];
    if (file && ins.data) {
      if (!OK_EXT.test(file.name)) { alert('فرمت مجاز: PDF/ZIP/RAR/JPG/PNG/WEBP/MP4/MP3'); return; }
      var base64 = await new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result.split(',')[1]); }; fr.readAsDataURL(file); });
      var path = 'products/p' + ins.data.id + '-' + file.name;
      await api('upload_file', { method: 'POST', body: JSON.stringify({ path: path, base64: base64, mime: file.type }) });
      await sb.from('products').update({ file_path: path }).eq('id', ins.data.id);
    }
    alert('اضافه شد');
    loadProds();
  }

  async function loadPlans() {
    var data = await (await fetch('/api/db?t=plans')).json();
    document.getElementById('plansBody2').innerHTML = (Array.isArray(data) ? data : []).map(function (p) {
      return '<tr><td><input data-id="' + p.id + '" data-f="title_fa" value="' + esc(p.title_fa) + '"></td>' +
        '<td><input data-id="' + p.id + '" data-f="period" value="' + esc(p.period) + '"></td>' +
        '<td><input type="number" data-id="' + p.id + '" data-f="days" value="' + (p.days || 30) + '"></td>' +
        '<td><input type="text" data-id="' + p.id + '" data-f="price_rial" value="' + (p.price_rial ? fmt(p.price_rial) : '') + '"></td>' +
        '<td><input type="text" data-id="' + p.id + '" data-f="old_price_rial" value="' + (p.old_price_rial ? fmt(p.old_price_rial) : '') + '"></td>' +
        '<td><textarea data-id="' + p.id + '" data-f="features">' + esc((p.features || []).join('\n')) + '</textarea></td>' +
        '<td><button class="btn small svL" data-id="' + p.id + '">ذخیره</button></td>' +
        '<td><button class="del-btn dlL" data-id="' + p.id + '">حذف</button></td></tr>';
    }).join('');
    document.querySelectorAll('#plansBody2 input[data-f="price_rial"], #plansBody2 input[data-f="old_price_rial"]').forEach(bindMoney);
    document.querySelectorAll('.svL').forEach(function (b) {
      b.onclick = async function () {
        var id = b.dataset.id, upd = {};
        document.querySelectorAll('#plansBody2 [data-id="' + id + '"][data-f]').forEach(function (i) {
          if (i.dataset.f === 'features') upd.features = i.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          else if (i.dataset.f === 'title_fa' || i.dataset.f === 'period') upd[i.dataset.f] = i.value;
          else upd[i.dataset.f] = toNum(i.value);
        });
        await sb.from('plans').update(upd).eq('id', id);
        alert('ذخیره شد');
        loadPlans();
      };
    });
    document.querySelectorAll('.dlL').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('حذف؟')) return;
        await sb.from('plans').delete().eq('id', b.dataset.id);
        loadPlans();
      };
    });
  }

  async function loadUsers(q, page) {
    var r = await api('admin_users&q=' + encodeURIComponent(q || '') + '&page=' + page);
    if (!r.ok) { document.getElementById('usersBody').innerHTML = '<tr><td colspan="6">خطا در دریافت کاربران</td></tr>'; return; }
    var j = await r.json();
    var data = j.rows || [];
    document.getElementById('usersBody').innerHTML = data.map(function (u) {
      return '<tr><td>' + esc(u.email) + '</td><td>' + (esc(u.name) || '-') + '</td><td dir="ltr">' + (esc(u.phone) || '-') + '</td><td>' + faDate(u.created_at) + '</td><td><span class="pbadge" style="background:' + (u.disabled ? '#d33' : '#2d6a35') + '">' + (u.disabled ? 'غیرفعال' : 'فعال') + '</span></td><td><button class="btn small vuD" data-id="' + u.id + '" data-e="' + esc(u.email) + '">جزئیات</button> <button class="' + (u.disabled ? 'ok-btn' : 'del-btn') + ' disU" data-id="' + u.id + '" data-d="' + (u.disabled ? 0 : 1) + '">' + (u.disabled ? 'فعال‌سازی' : 'غیرفعال') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="6">کاربری پیدا نشد</td></tr>';
    pager(document.getElementById('pagerU'), page, j.total || data.length, 20, function (p) { loadUsers(q, p); });
    document.querySelectorAll('.vuD').forEach(function (b) { b.onclick = function () { showUser(b.dataset.id, b.dataset.e); }; });
    document.querySelectorAll('.disU').forEach(function (b) {
      b.onclick = async function () {
        await api('admin_user_disable', { method: 'POST', body: JSON.stringify({ uid: b.dataset.id, disabled: b.dataset.d === '1' }) });
        loadUsers(q, page);
      };
    });
  }
  async function showUser(uid, email) {
    var box = document.getElementById('userDetail');
    box.style.display = 'block';
    var results = await Promise.all([
      (await api('admin_user_ent&uid=' + uid)).json(),
      (await api('all_orders&uid=' + uid + '&limit=100')).json(),
      (await api('admin_payments&page=1')).json(),
      (await fetch('/api/db?t=products')).json()
    ]);
    var ent = results[0], ordersJ = results[1], paysJ = results[2], prods = results[3];
    var myO = ordersJ.rows || [];
    var myP = (paysJ.rows || []).filter(function (p) { return p.user_id === uid; });
    var subs = Array.isArray(ent.subscriptions) ? ent.subscriptions : [];
    var prodEnts = (Array.isArray(ent.entitlements) ? ent.entitlements : []).filter(function (e) { return e.entitlement_type === 'PRODUCT'; });
    var activePro = subs.some(function (s) { return s.status === 'ACTIVE' && (!s.end_date || new Date(s.end_date) > new Date()); });
    box.innerHTML = '<h3>' + esc(email) + '</h3>' +
      '<p>وضعیت PRO: <span class="pbadge" style="background:' + (activePro ? '#2d6a35' : '#777') + '">' + (activePro ? 'فعال' : 'ندارد') + '</span></p>' +
      '<div class="add-form"><button class="ok-btn gP">اعطای PRO (۳۰ روز)</button><button class="warn-btn eP">تمدید ۳۰ روز</button><button class="del-btn rP">لغو PRO</button></div>' +
      '<h4>اعطای دسترسی محصول</h4>' +
      '<div class="add-form"><select id="gpSel">' + (Array.isArray(prods) ? prods : []).map(function (p) { return '<option value="' + p.id + '">' + esc(p.title_fa) + '</option>'; }).join('') + '</select><input id="gpDays" type="number" placeholder="مدت(روز، خالی=همیشگی)"><button class="ok-btn gpB">اعطای محصول</button></div>' +
      '<h4>دسترسی‌های محصول (' + fmt(prodEnts.length) + ')</h4><p>' + (prodEnts.map(function (e) { return esc((e.products && e.products.title_fa) || 'محصول') + ' — ' + esc(e.status) + ' — تا ' + faDate(e.expires_at) + ' <button class="del-btn rvPr" data-id="' + e.id + '">لغو</button>'; }).join('<br>') || '—') + '</p>' +
      '<h4>اشتراک‌ها</h4><p>' + (subs.map(function (s) { return (s.plans ? esc(s.plans.title_fa) : 'PRO') + ' — ' + esc(s.status) + ' — تا ' + faDate(s.end_date); }).join('<br>') || '—') + '</p>' +
      '<h4>سفارش‌ها (' + fmt(myO.length) + ')</h4><p>' + (myO.map(function (o) { return '#' + o.id + ' ' + esc(o.product) + ' — ' + (STATUS_FA[o.status] || esc(o.status)) + ' — ' + faDate(o.created_at); }).join('<br>') || '—') + '</p>' +
      '<h4>پرداخت‌ها (' + fmt(myP.length) + ')</h4><p>' + (myP.map(function (p) { return '#' + p.id + ' — ' + (PAY_FA[p.status] || esc(p.status)) + ' — ' + rialFa(p.amount); }).join('<br>') || '—') + '</p>';
    box.querySelector('.gP').onclick = async function () { await api('admin_grant_pro', { method: 'POST', body: JSON.stringify({ uid: uid, days: 30 }) }); alert('اعطا شد'); showUser(uid, email); };
    box.querySelector('.eP').onclick = async function () { await api('admin_extend_pro', { method: 'POST', body: JSON.stringify({ uid: uid, days: 30 }) }); alert('تمدید شد'); showUser(uid, email); };
    box.querySelector('.rP').onclick = async function () { if (!confirm('لغو PRO؟')) return; await api('admin_revoke_pro', { method: 'POST', body: JSON.stringify({ uid: uid }) }); alert('لغو شد'); showUser(uid, email); };
    box.querySelector('.gpB').onclick = async function () {
      var pid = box.querySelector('#gpSel').value;
      var days = box.querySelector('#gpDays').value;
      await api('admin_grant_product', { method: 'POST', body: JSON.stringify({ uid: uid, product_id: +pid, days: days ? +days : null }) });
      alert('اعطا شد');
      showUser(uid, email);
    };
    box.querySelectorAll('.rvPr').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('لغو دسترسی محصول؟')) return;
        await api('admin_revoke_product', { method: 'POST', body: JSON.stringify({ entitlement_id: +b.dataset.id }) });
        showUser(uid, email);
      };
    });
    box.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadCoupons() {
    var r = await api('admin_coupons');
    if (!r.ok) return;
    var data = await r.json();
    document.getElementById('couponBody').innerHTML = (Array.isArray(data) ? data : []).map(function (c) {
      return '<tr><td><b>' + esc(c.code) + '</b></td><td>' + (c.type === 'PERCENT' ? 'درصدی' : 'ثابت') + '</td><td>' + (c.type === 'PERCENT' ? fmt(c.value) + '٪' : rialFa(c.value)) + '</td><td>' + fmt(c.used_count || 0) + (c.usage_limit ? '/' + fmt(c.usage_limit) : '') + '</td><td><input type="checkbox" class="cAct" data-id="' + c.id + '" ' + (c.active ? 'checked' : '') + '></td><td><button class="del-btn cDel" data-id="' + c.id + '">حذف</button></td></tr>';
    }).join('');
    document.querySelectorAll('.cAct').forEach(function (i) {
      i.onchange = async function () {
        await api('admin_coupons', { method: 'PATCH', body: JSON.stringify({ id: i.dataset.id, upd: { active: i.checked } }) });
      };
    });
    document.querySelectorAll('.cDel').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('کوپن حذف بشه؟')) return;
        var r = await api('admin_coupons&id=' + b.dataset.id, { method: 'DELETE' });
        if (!r.ok) alert('حذف ناموفق'); else loadCoupons();
      };
    });
  }

  var dietPlanId = null, dayCount = 0;
  async function pickUsers() {
    var q = gv('dq').trim();
    var r = await api('admin_users&q=' + encodeURIComponent(q || ''));
    if (!r.ok) { alert('خطا در جستجوی کاربر'); return; }
    var j = await r.json();
    var data = Array.isArray(j.rows) ? j.rows : (Array.isArray(j) ? j : []);
    if (q && !data.length) {
      var r2 = await api('admin_users&q=');
      if (r2.ok) {
        var j2 = await r2.json();
        var all = Array.isArray(j2.rows) ? j2.rows : (Array.isArray(j2) ? j2 : []);
        var lq = q.toLowerCase();
        data = all.filter(function (u) {
          return (u.email || '').toLowerCase().indexOf(lq) !== -1 ||
                 (u.name || '').toLowerCase().indexOf(lq) !== -1 ||
                 (u.phone || '').indexOf(q) !== -1;
        });
      }
    }
    var sel = document.getElementById('duPick');
    sel.innerHTML = data.map(function (u) {
      return '<option value="' + u.id + '">' + esc(u.email || u.name || u.id) + '</option>';
    }).join('');
    if (q && !data.length) alert('کاربری با این مشخصات پیدا نشد. دقیقاً ایمیلی رو بنویس که کاربر باهاش وارد شده.');
    loadDietList();
  }
  function addDayBox() {
    dayCount++;
    var div = document.createElement('div');
    div.className = 'day-box';
    div.innerHTML = '<b>روز ' + fmt(dayCount) + '</b> <button class="del-btn rmDay">حذف روز</button><div class="meals"></div><button class="btn small addMeal">افزودن وعده</button>';
    div.querySelector('.rmDay').onclick = function () { div.remove(); };
    div.querySelector('.addMeal').onclick = function () { addMealRow(div.querySelector('.meals')); };
    document.getElementById('daysBox').appendChild(div);
  }
  function lastDayMeals() {
    var boxes = [].slice.call(document.querySelectorAll('#daysBox .day-box'));
    return boxes.length ? boxes[boxes.length - 1].querySelector('.meals') : null;
  }
  function addMealRow(box, m) {
    if (!box) return;
    var row = document.createElement('div');
    row.className = 'meal-row';
    row.innerHTML = '<select class="mType"><option value="breakfast">صبحانه</option><option value="snack_am">میان‌وعده صبح</option><option value="lunch">ناهار</option><option value="snack_pm">میان‌وعده عصر</option><option value="dinner">شام</option><option value="snack">میان‌وعده (قدیمی)</option></select>' +
      '<select class="mRec"><option value="">— رسپی —</option>' + REC.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name_fa) + '</option>'; }).join('') + '</select>' +
      '<input class="mTitle" placeholder="عنوان/ماده" value="' + esc(m ? m.title : '') + '"><input class="mPortion" placeholder="مقدار/کالری" value="' + esc(m ? m.portion : '') + '"><button class="del-btn rmM">×</button>';
    if (m && m.recipe_id) row.querySelector('.mRec').value = m.recipe_id;
    if (m && m.meal_type) row.querySelector('.mType').value = m.meal_type;
    row.querySelector('.rmM').onclick = function () { row.remove(); };
    box.appendChild(row);
  }
  function collectDays() {
    return [].slice.call(document.querySelectorAll('#daysBox .day-box')).map(function (d, i) {
      return {
        day_number: i + 1,
        meals: [].slice.call(d.querySelectorAll('.meal-row')).map(function (r) {
          return {
            meal_type: r.querySelector('.mType').value,
            recipe_id: r.querySelector('.mRec').value ? +r.querySelector('.mRec').value : null,
            title: r.querySelector('.mTitle').value,
            portion: r.querySelector('.mPortion').value
          };
        })
      };
    });
  }
  async function saveDiet() {
    var dietUid = document.getElementById('duPick').value;
    if (!dietUid) { alert('خطا: کاربر انتخاب نشده است. اول کاربر را پیدا و انتخاب کن.'); return; }
    var title = gv('dTitle').trim();
    if (!title) { alert('خطا: عنوان برنامه خالی است. یک عنوان برای برنامه وارد کن.'); return; }
    var r = await api('admin_diet_save', {
      method: 'POST',
      body: JSON.stringify({
        id: dietPlanId, user_id: dietUid, title: title, goal: gv('dGoal'),
        start_date: gv('dStart') || null, end_date: gv('dEnd') || null, duration_days: toNum(gv('dDur')),
        kcal_target: toNum(gv('dKcal')), protein_target: toNum(gv('dPro')), carbs_target: toNum(gv('dCarb')), fat_target: toNum(gv('dFat')),
        notes: gv('dNotes'),
        restrictions_text: (document.getElementById('dRestr') || { value: '' }).value,
        tips_text: (document.getElementById('dTips') || { value: '' }).value,
        activity_text: (document.getElementById('dAct') || { value: '' }).value,
        days: collectDays()
      })
    });
    var j = await r.json();
    if (!r.ok) { alert(j.error || 'خطا در ذخیره برنامه'); return; }
    dietPlanId = j.id;
    alert('برنامه ذخیره شد');
    loadDietList();
  }

  function initSmartGen() {
    var pane = document.getElementById('pane-diet');
    if (!pane || document.getElementById('sgBox')) return;
    var box = document.createElement('div');
    box.id = 'sgBox';
    box.className = 'ubox';
    box.innerHTML = '<h4>تولید هوشمند برنامه</h4>' +
      '<div class="add-form"><select id="sgDays"><option value="1">۱ روز</option><option value="3">۳ روز</option><option value="7" selected>۷ روز</option></select>' +
      '<label><input type="checkbox" id="sgB" checked> صبحانه</label>' +
      '<label><input type="checkbox" id="sgSA" checked> میان‌وعده صبح</label>' +
      '<label><input type="checkbox" id="sgL" checked> ناهار</label>' +
      '<label><input type="checkbox" id="sgSP" checked> میان‌وعده عصر</label>' +
      '<label><input type="checkbox" id="sgD" checked> شام</label>' +
      '<label><input type="checkbox" id="sgProf" checked> از پروفایل کاربر</label></div>' +
      '<div class="add-form"><input id="sgKcal" type="number" placeholder="کالری هدف (اختیاری)"><input id="sgPro" type="number" placeholder="پروتئین g"><input id="sgCarb" type="number" placeholder="کربوهیدرات g"><input id="sgFat" type="number" placeholder="چربی g">' +
      '<select id="sgAct"><option value="">سطح فعالیت: از پروفایل</option><option value="sedentary">کم‌تحرک</option><option value="light">سبک</option><option value="moderate">متوسط</option><option value="active">فعال</option></select></div>' +
      '<div class="add-form"><input id="sgForbidden" placeholder="غذاهای ممنوع (با ویرگول)" style="flex:1"><input id="sgLikes" placeholder="علاقه‌مندی‌ها (با ویرگول)" style="flex:1"></div>' +
      '<button class="btn" id="sgGo">تولید برنامه</button><p class="hint" id="sgMsg"></p>';
    pane.insertBefore(box, document.getElementById('dietForm'));
    function split(v) { return v.split('،').join(',').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
    document.getElementById('sgGo').onclick = async function () {
      var uid = document.getElementById('duPick').value;
      if (!uid) { alert('اول کاربر را پیدا و انتخاب کن'); return; }
      var meals = [];
      if (document.getElementById('sgB').checked) meals.push('breakfast');
      if (document.getElementById('sgSA').checked) meals.push('snack_am');
      if (document.getElementById('sgL').checked) meals.push('lunch');
      if (document.getElementById('sgSP').checked) meals.push('snack_pm');
      if (document.getElementById('sgD').checked) meals.push('dinner');
      var likes = split(gv('sgLikes'));
      document.getElementById('sgMsg').textContent = 'در حال تولید برنامه…';
      var r = await api('admin_mealgen', {
        method: 'POST',
        body: JSON.stringify({
          uid: uid, days: toNum(gv('sgDays')) || 7, meals: meals,
          use_profile: document.getElementById('sgProf').checked,
          forbidden: split(gv('sgForbidden')),
          overrides: {
            calorie_target: toNum(gv('sgKcal')), protein_target: toNum(gv('sgPro')),
            carbs_target: toNum(gv('sgCarb')), fat_target: toNum(gv('sgFat')),
            activity_level: gv('sgAct') || null, food_preferences: likes.length ? likes : undefined
          }
        })
      });
      var j = await r.json();
      if (!r.ok) {
        document.getElementById('sgMsg').textContent = j.error === 'recipe_catalog_unavailable' ? 'رسپی مطابق محدودیت‌ها پیدا نشد؛ ممنوع‌ها را کمتر کن.' : 'خطا در تولید برنامه';
        return;
      }
      dietPlanId = null;
      dayCount = 0;
      document.getElementById('daysBox').innerHTML = '';
      (j.days || []).forEach(function (d) {
        addDayBox();
        var mb = lastDayMeals();
        (d.meals || []).forEach(function (m) {
          addMealRow(mb, {
            meal_type: m.type, recipe_id: m.recipe_id, title: m.title,
            portion: (m.kcal ? m.kcal + ' کالری' : '') + (m.protein != null ? ' | ' + m.protein + 'g پروتئین' : '') + (m.note ? ' — ' + m.note : '')
          });
        });
      });
      if (!gv('dTitle').trim()) sv('dTitle', 'برنامه هوشمند ' + (toNum(gv('sgDays')) || 7) + ' روزه');
      sv('dRestr', (j.constraints || []).join('\n'));
      sv('dTips', (j.tips || []).join('\n'));
      sv('dAct', j.activity ? [].concat(j.activity.items || [], [j.activity.note, j.activity.disclaimer]).filter(Boolean).join('\n') : '');
      document.getElementById('dietForm').style.display = 'grid';
      document.getElementById('sgMsg').textContent = 'برنامه آماده شد — می‌تونی ویرایش کنی و بعد ذخیره / PDF بگیری.';
    };
  }

  async function genPdf() {
    if (!dietPlanId) { alert('اول ذخیره کن'); return; }
    var det = await (await api('admin_diet_detail&id=' + dietPlanId)).json();
    var plan = det.plan;
    var days = Array.isArray(det.days) ? det.days : [];
    var selOpt = document.getElementById('duPick').selectedOptions[0];
    var uname = selOpt ? selOpt.textContent : '';
    await new Promise(function (r) { var i = new Image(); i.onload = r; i.onerror = r; i.src = 'img/logo.png'; });
    var doc = document.getElementById('pdfDoc');
    function wrap(inner) { return '<div style="padding:24px;font-family:Vazirmatn,sans-serif;direction:rtl;color:#1e2b1c">' + inner + '</div>'; }
    var secs = [];
    secs.push(wrap('<div style="background:#2d6a35;border-radius:22px;padding:24px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px"><div><div style="font-size:24px;font-weight:900">DailyFitBeat | دیلی‌بیت</div><div style="opacity:.9;margin-top:6px">برنامه غذایی اختصاصی — ' + plan.title + '</div></div><img src="img/logo.png" style="height:70px;border-radius:18px;background:#fff;padding:6px"></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>کاربر:</b> ' + uname + '</div><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>هدف:</b> ' + (plan.goal || '—') + '</div><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>مدت:</b> ' + (plan.duration_days || '—') + ' روز</div><div style="background:#f2f7f2;border-radius:14px;padding:10px 16px"><b>تاریخ:</b> ' + new Date().toLocaleDateString('fa-IR') + '</div></div>'));
    secs.push(wrap('<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">' + (fmt(plan.kcal_target) || '0') + '</b><br><small>کالری روزانه</small></div><div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">' + fmt(plan.protein_target) + 'g</b><br><small>پروتئین</small></div><div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">' + fmt(plan.carbs_target) + 'g</b><br><small>کربوهیدرات</small></div><div style="flex:1;min-width:120px;background:#e8f4e9;border-radius:14px;padding:14px;text-align:center"><b style="font-size:20px;color:#2d6a35">' + fmt(plan.fat_target) + 'g</b><br><small>چربی</small></div></div>'));
    if (plan.restrictions_text) secs.push(wrap('<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>محدودیت‌ها و ممنوعات:</b><br>' + plan.restrictions_text.split('\n').map(function (x) { return '• ' + x; }).join('<br>') + '</div>'));
    if (plan.tips_text) secs.push(wrap('<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>نکات مهم:</b><br>' + plan.tips_text.split('\n').map(function (x) { return '• ' + x; }).join('<br>') + '</div>'));
    if (plan.notes) secs.push(wrap('<div style="background:#fff8e6;border-radius:14px;padding:14px"><b>توضیحات:</b><br>' + plan.notes + '</div>'));
    days.forEach(function (d) {
      var rows = (d.diet_plan_meals || []).map(function (m) {
        var title = m.title || (REC.find(function (x) { return x.id === m.recipe_id; }) || {}).name_fa || '—';
        return '<tr style="border-bottom:1px solid #e5efe5"><td style="padding:8px;font-weight:700;width:110px">' + (MFA[m.meal_type] || m.meal_type) + '</td><td style="padding:8px">' + title + '</td><td style="padding:8px;color:#557">' + (m.portion || '') + '</td></tr>';
      }).join('');
      secs.push(wrap('<div style="background:#2d6a35;color:#fff;display:inline-block;border-radius:10px;padding:6px 16px;font-weight:800">روز ' + fmt(d.day_number) + '</div><table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">' + rows + '</table>'));
    });
    if (plan.activity_text) secs.push(wrap('<div style="background:#e8f4e9;border-radius:14px;padding:16px"><b>پیشنهاد فعالیت:</b><br>' + plan.activity_text.split('\n').map(function (x) { return '• ' + x; }).join('<br>') + '</div>'));
    secs.push(wrap('<div style="border-top:2px solid #e8f4e9;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#77807a"><span>dailyfitbeat.ir</span><span>اینستاگرام: @dailyfitbeat</span><span>خوب بخور، بهتر زندگی کن</span></div>'));
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF('p', 'mm', 'a4');
    var y = 10;
    for (var i = 0; i < secs.length; i++) {
      doc.innerHTML = secs[i];
      await document.fonts.ready;
      var canvas = await html2canvas(doc.firstElementChild, { scale: 2, backgroundColor: '#fff' });
      var w = 200, hh = canvas.height * w / canvas.width;
      if (hh > 277) { var sc = 277 / hh; w *= sc; hh *= sc; }
      if (y + hh > 287) { pdf.addPage(); y = 10; }
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w) / 2, y, w, hh);
      y += hh + 6;
    }
    var b64 = pdf.output('datauristring').split(',')[1];
    var path = 'diet/plan-' + dietPlanId + '.pdf';
    var up = await api('upload_file', { method: 'POST', body: JSON.stringify({ path: path, base64: b64, mime: 'application/pdf' }) });
    if (!up.ok) { alert('آپلود PDF ناموفق'); return; }
    var pub = await api('admin_diet_publish', { method: 'POST', body: JSON.stringify({ id: dietPlanId, pdf_path: path }) });
    alert(pub.ok ? 'PDF ساخته و منتشر شد' : 'خطا در انتشار');
    loadDietList();
  }
  async function loadDietList() {
    var uid = document.getElementById('duPick').value || null;
    var r = await api('admin_diet_plans' + (uid ? '&uid=' + uid : ''));
    if (!r.ok) return;
    var data = await r.json();
    document.getElementById('dietList').innerHTML = (Array.isArray(data) ? data : []).map(function (p) {
      return '<div class="ubox" style="margin:8px 0;padding:12px"><b>' + esc(p.title) + '</b> — <span class="pbadge" style="background:' + (p.status === 'published' ? '#2d6a35' : '#b26a00') + '">' + (p.status === 'published' ? 'منتشر شده' : 'پیش‌نویس') + '</span><small> — ' + faDate(p.created_at) + '</small><br><button class="btn small dEdit" data-id="' + p.id + '">ویرایش</button> <button class="warn-btn dPub" data-id="' + p.id + '">انتشار</button> <button class="del-btn dDel" data-id="' + p.id + '">حذف</button></div>';
    }).join('') || '<p>هنوز برنامه‌ای ساخته نشده</p>';
    document.querySelectorAll('.dEdit').forEach(function (b) {
      b.onclick = async function () {
        dietPlanId = +b.dataset.id;
        var det = await (await api('admin_diet_detail&id=' + dietPlanId)).json();
        var pl = det.plan;
        function g(id) { return document.getElementById(id); }
        g('dTitle').value = pl.title;
        g('dGoal').value = pl.goal || '';
        g('dStart').value = pl.start_date ? pl.start_date.slice(0, 10) : '';
        g('dEnd').value = pl.end_date ? pl.end_date.slice(0, 10) : '';
        g('dDur').value = pl.duration_days || '';
        g('dKcal').value = pl.kcal_target || '';
        g('dPro').value = pl.protein_target || '';
        g('dCarb').value = pl.carbs_target || '';
        g('dFat').value = pl.fat_target || '';
        sv('dNotes', pl.notes || '');
        sv('dRestr', pl.restrictions_text || '');
        sv('dTips', pl.tips_text || '');
        sv('dAct', pl.activity_text || '');
        ['dStart', 'dEnd'].forEach(function (i) {
          var el = g(i);
          if (el) el.dispatchEvent(new Event('change'));
        });
        document.getElementById('daysBox').innerHTML = '';
        dayCount = 0;
        (Array.isArray(det.days) ? det.days : []).forEach(function (d) {
          addDayBox();
          var mb = lastDayMeals();
          (d.diet_plan_meals || []).forEach(function (m) { addMealRow(mb, m); });
        });
        document.getElementById('dietForm').style.display = 'grid';
      };
    });
    document.querySelectorAll('.dPub').forEach(function (b) {
      b.onclick = async function () {
        await api('admin_diet_publish', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) });
        loadDietList();
      };
    });
    document.querySelectorAll('.dDel').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('حذف؟')) return;
        await api('admin_diet_delete', { method: 'POST', body: JSON.stringify({ id: +b.dataset.id }) });
        loadDietList();
      };
    });
  }

  /* ---------- SEO: ریدایرکت‌ها ---------- */
  var REDIRS = [];
  async function loadRedirects() {
    REDIRS = await (await api('redirect_list')).json();
    document.getElementById('rdBody').innerHTML = (Array.isArray(REDIRS) ? REDIRS : []).map(function (x) {
      return '<tr><td dir="ltr">' + esc(x.from_path) + '</td><td dir="ltr">' + esc(x.to_url) + '</td><td>' + x.code + '</td><td><input type="checkbox" class="rdOn" data-id="' + x.id + '" ' + (x.active ? 'checked' : '') + '></td><td><button class="del-btn rdDel" data-id="' + x.id + '">حذف</button></td></tr>';
    }).join('') || '<tr><td colspan="5">ریدایرکتی ثبت نشده</td></tr>';
    document.querySelectorAll('.rdDel').forEach(function (b) {
      b.onclick = async function () { if (!confirm('حذف ریدایرکت؟')) return; await api('redirect_del', { method: 'POST', body: JSON.stringify({ id: Number(b.dataset.id) }) }); loadRedirects(); };
    });
    document.querySelectorAll('.rdOn').forEach(function (c) {
      c.onchange = async function () {
        var row = REDIRS.find(function (x) { return String(x.id) === c.dataset.id; });
        if (!row) return;
        await api('redirect_save', { method: 'POST', body: JSON.stringify({ id: row.id, from_path: row.from_path, to_url: row.to_url, code: row.code, active: c.checked }) });
        loadRedirects();
      };
    });
  }

  /* ---------- SEO: FAQها ---------- */
  var FAQS = [];
  async function loadFaqs() {
    FAQS = await (await api('faq_list')).json();
    document.getElementById('fqBody').innerHTML = (Array.isArray(FAQS) ? FAQS : []).map(function (x) {
      return '<tr><td>' + esc(x.page_key) + '</td><td><b>' + esc(x.question) + '</b></td><td>' + esc(x.answer.slice(0, 80)) + (x.answer.length > 80 ? '…' : '') + '</td><td>' + (x.sort || 0) + '</td><td><input type="checkbox" class="fqOn" data-id="' + x.id + '" ' + (x.active ? 'checked' : '') + '></td><td><button class="del-btn fqDel" data-id="' + x.id + '">حذف</button></td></tr>';
    }).join('') || '<tr><td colspan="6">سوالی ثبت نشده — اولین سوال را اضافه کن</td></tr>';
    document.querySelectorAll('.fqDel').forEach(function (b) {
      b.onclick = async function () { if (!confirm('حذف سوال؟')) return; await api('faq_del', { method: 'POST', body: JSON.stringify({ id: Number(b.dataset.id) }) }); loadFaqs(); };
    });
    document.querySelectorAll('.fqOn').forEach(function (c) {
      c.onchange = async function () {
        var row = FAQS.find(function (x) { return String(x.id) === c.dataset.id; });
        if (!row) return;
        await api('faq_save', { method: 'POST', body: JSON.stringify({ id: row.id, page_key: row.page_key, question: row.question, answer: row.answer, sort: row.sort || 0, active: c.checked }) });
        loadFaqs();
      };
    });
  }

  /* ---------- رسانه ---------- */
  var MEDIA = [];
  async function loadMedia() {
    MEDIA = await (await api('media_list')).json();
    renderMedia();
  }
  function renderMedia() {
    var q = (gv('mlFilter') || '').toLowerCase();
    var box = document.getElementById('mediaGrid');
    if (!box) return;
    box.innerHTML = MEDIA.filter(function (m) { return !q || m.path.toLowerCase().indexOf(q) !== -1; }).map(function (m) {
      return '<div class="media-item"><img src="' + esc(m.path) + '" loading="lazy" alt="" onerror="this.classList.add(\'bad\')"><small dir="ltr">' + esc(m.path) + '</small><span>' + esc(m.owner) + '</span><button class="btn small" data-p="' + esc(m.path) + '">کپی مسیر</button></div>';
    }).join('') || '<p class="no-res">تصویری پیدا نشد</p>';
    box.querySelectorAll('button[data-p]').forEach(function (b) {
      b.onclick = function () { try { navigator.clipboard.writeText(b.dataset.p); b.textContent = 'کپی شد ✓'; setTimeout(function () { b.textContent = 'کپی مسیر'; }, 1200); } catch (e) {} };
    });
  }

  function bindAll() {
    document.getElementById('csvBtn').onclick = exportCSV;
    document.getElementById('filterSt').onchange = function () { loadOrders(1); };
    document.getElementById('rNew').onclick = function () { fillForm(null); };
    document.getElementById('rSave').onclick = saveRecipe;
    document.getElementById('aAdd').onclick = addProd;
    document.getElementById('pAdd').onclick = async function () {
      var t = document.getElementById('pTitle').value.trim();
      var pr = toNum(document.getElementById('pPrice').value);
      if (!t || !pr) { alert('نام و قیمت لازمه'); return; }
      await sb.from('plans').insert({ key: 'plan-' + Date.now(), title_fa: t, period: document.getElementById('pPeriod').value || 'ماهانه', days: toNum(document.getElementById('pDays').value) || 30, price_rial: pr, old_price_rial: toNum(document.getElementById('pOld').value), features: [] });
      loadPlans();
    };
    document.getElementById('uqBtn').onclick = function () { loadUsers(gv('uq'), 1); };
    document.getElementById('rdAdd').onclick = async function () {
      var f = gv('rdFrom').trim(), t = gv('rdTo').trim();
      if (!f || !t) { alert('مسیر قدیم و مقصد لازم است'); return; }
      var r = await api('redirect_save', { method: 'POST', body: JSON.stringify({ from_path: f, to_url: t, code: Number(gv('rdCode')) || 301, active: true }) });
      if (r.ok) { sv('rdFrom', ''); sv('rdTo', ''); loadRedirects(); } else alert('خطا در ذخیره');
    };
    document.getElementById('fqAdd').onclick = async function () {
      var q = gv('fqQ').trim(), a = gv('fqA').trim();
      if (!q || !a) { alert('سوال و پاسخ لازم است'); return; }
      var r = await api('faq_save', { method: 'POST', body: JSON.stringify({ page_key: gv('fqPage'), question: q, answer: a, sort: toNum(gv('fqSort')) || 0, active: true }) });
      if (r.ok) { sv('fqQ', ''); sv('fqA', ''); loadFaqs(); } else alert('خطا در ذخیره');
    };
    document.getElementById('mlReload').onclick = loadMedia;
    var mf = document.getElementById('mlFilter');
    if (mf) mf.oninput = renderMedia;
    document.getElementById('rPrev').onclick = function () {
      var sl = gv('rSlug').trim();
      if (sl) window.open('recipe.html?slug=' + encodeURIComponent(sl), '_blank');
    };
    document.getElementById('cAdd').onclick = async function () {
      var r = await api('admin_coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: document.getElementById('cCode').value, type: document.getElementById('cType').value,
          value: toNum(document.getElementById('cValue').value), usage_limit: toNum(document.getElementById('cLimit').value),
          end_date: document.getElementById('cEnd').value || null, pro_only: document.getElementById('cPro').checked
        })
      });
      if (!r.ok) alert('خطا');
      loadCoupons();
    };
    document.getElementById('dqBtn').onclick = pickUsers;
    initSmartGen();
    document.getElementById('dNew').onclick = function () {
      dietPlanId = null;
      dayCount = 0;
      document.getElementById('daysBox').innerHTML = '';
      document.getElementById('dietForm').style.display = 'grid';
      addDayBox();
    };
    document.getElementById('dAddDay').onclick = addDayBox;
    document.getElementById('dSave').onclick = saveDiet;
    document.getElementById('dPdf').onclick = genPdf;
  }
  async function exportCSV() {
    var r = await api('all_orders&limit=100');
    var j = await r.json();
    var data = j.rows || [];
    var rows = [['کد', 'تاریخ', 'نام', 'موبایل', 'ایمیل', 'محصول', 'کد واریز', 'وضعیت', 'مبلغ(ریال)', 'یادداشت']];
    data.forEach(function (o) {
      rows.push([o.id, new Date(o.created_at).toLocaleString('fa-IR'), o.name, o.phone, o.email, o.product, o.ref, STATUS_FA[o.status] || o.status, o.total || '', o.note || '']);
    });
    var csv = '\uFEFF' + rows.map(function (r2) { return r2.map(function (c) { return '"' + String(c || '').replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'dailyfitbeat-orders.csv';
    a.click();
  }
})();
