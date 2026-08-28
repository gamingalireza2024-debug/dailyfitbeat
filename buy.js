(function () {
  var modal = null, sel = null, payId = null, submitted = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function faN(n) { return (Number(n) || 0).toLocaleString('fa-IR'); }
  async function tok() {
    try {
      if (!window.DFB || !DFB.sb) return null;
      var s = await DFB.sb.auth.getSession();
      return s && s.data && s.data.session ? s.data.session.access_token : null;
    } catch (e) { return null; }
  }
  async function api(t, opts) {
    var t0 = await tok();
    var headers = { 'Content-Type': 'application/json' };
    if (t0) { headers.Authorization = 'Bearer ' + t0; headers['X-Supabase-Auth'] = t0; }
    return fetch('/api/db?t=' + t, Object.assign({ headers: headers }, opts || {}));
  }
  function parseJSON(r) {
    return r.json().catch(function () { return {}; });
  }
  function errMsg(status, j) {
    if (status === 401) return 'نشست تو تمام شده. لطفاً دوباره وارد شو.';
    if (status === 404) return 'محصول یا پلن پیدا نشد.';
    if (j && j.error === 'coupon invalid') return 'کد تخفیف معتبر نیست.';
    if (j && j.error === 'coupon expired') return 'کد تخفیف منقضی شده.';
    if (j && j.error) return 'خطا: ' + esc(j.error);
    return 'یک خطای موقت پیش آمد. دوباره امتحان کن.';
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'buyModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(20,30,20,.5);display:none;align-items:center;justify-content:center;z-index:90;padding:14px';
    modal.innerHTML = '<div id="buyBox" style="background:#fff;border-radius:22px;padding:22px;max-width:480px;width:100%;max-height:88dvh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.25)"></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    return modal;
  }
  function closeModal() { if (modal) modal.style.display = 'none'; sel = null; payId = null; submitted = false; }
  function openModal() { ensureModal(); modal.style.display = 'flex'; }

  function requireUser() {
    if (window.DFB && DFB.user) return true;
    openModal();
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">ورود لازم است</h3><p style="color:#667066;font-size:12.5px;line-height:2">برای ادامه خرید، اول با گوگل وارد شو.</p><button id="bmLogin" style="border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:11px 22px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">ورود با گوگل</button> <button id="bmCancel" style="border:1.5px solid #2d6a35;background:#fff;color:#2d6a35;border-radius:14px;padding:11px 22px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">انصراف</button>';
    document.getElementById('bmLogin').onclick = function () {
      if (window.DFB && DFB.sb) DFB.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    };
    document.getElementById('bmCancel').onclick = closeModal;
    return false;
  }

  function step1() {
    openModal();
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">تکمیل خرید</h3>' +
      '<p style="background:#f2f7f2;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:700">' + esc(sel.title) + '</p>' +
      '<p style="color:#667066;font-size:12px;margin:6px 0">کد تخفیف (اختیاری):</p>' +
      '<input id="bmCoupon" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #d8e2d8;font:inherit;font-size:13px" placeholder="مثال: FIT1404">' +
      '<p id="bmErr" style="color:#c22;font-size:12px;display:none"></p>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button id="bmNext" style="flex:1;border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">ادامه و دریافت اطلاعات پرداخت</button><button id="bmCancel" style="border:1.5px solid #2d6a35;background:#fff;color:#2d6a35;border-radius:14px;padding:12px 18px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">انصراف</button></div>';
    document.getElementById('bmCancel').onclick = closeModal;
    document.getElementById('bmNext').onclick = doCheckout;
  }

  async function doCheckout() {
    var err = document.getElementById('bmErr');
    err.style.display = 'none';
    var btn = document.getElementById('bmNext');
    btn.disabled = true;
    btn.textContent = 'در حال ثبت سفارش…';
    var code = (document.getElementById('bmCoupon').value || '').trim();
    var body = sel.type === 'plan' ? { plan_id: sel.id } : { product_id: sel.id };
    if (code) body.coupon = code;
    try {
      var r = await api('checkout', { method: 'POST', body: JSON.stringify(body) });
      var j = parseJSON(r);
      if (!r.ok) {
        err.textContent = errMsg(r.status, j);
        err.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'ادامه و دریافت اطلاعات پرداخت';
        return;
      }
      payId = j.payment_id || (j.payment && j.payment.id) || j.id || null;
      var amount = (j.amount != null) ? j.amount : (j.order && j.order.total != null ? j.order.total : null);
      var card = j.card_number || (j.payment && j.payment.card_number) || '';
      var discount = (j.discount != null) ? j.discount : 0;
      step2(amount, card, discount);
    } catch (e) {
      err.textContent = 'اتصال اینترنت برقرار نشد. دوباره امتحان کن.';
      err.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'ادامه و دریافت اطلاعات پرداخت';
    }
  }

  function step2(amount, card, discount) {
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">پرداخت دستی</h3>' +
      '<p style="font-size:12.5px;line-height:2">مبلغ قابل پرداخت:</p>' +
      '<div style="background:#e8f4e9;color:#2d6a35;border-radius:14px;padding:12px;font-size:16px;font-weight:900">' + faN(amount || 0) + ' ریال' + (discount ? ' <small style="font-weight:400">(تخفیف: ' + faN(discount) + ')</small>' : '') + '</div>' +
      (card ? '<p style="font-size:12.5px;margin:12px 0 4px">شماره کارت:</p><div dir="ltr" style="background:#f2f7f2;border-radius:12px;padding:12px;font-size:16px;font-weight:800;letter-spacing:1px;text-align:center">' + esc(card) + '</div>' : '') +
      '<p style="font-size:12px;color:#667066;margin:12px 0 4px">پس از واریز، کد پیگیری را وارد کن:</p>' +
      '<input id="bmRef" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #d8e2d8;font:inherit;font-size:13px" placeholder="کد پیگیری">' +
      '<p id="bmErr" style="color:#c22;font-size:12px;display:none"></p>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button id="bmSubmit" style="flex:1;border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">ثبت کد پیگیری</button><button id="bmCancel" style="border:1.5px solid #2d6a35;background:#fff;color:#2d6a35;border-radius:14px;padding:12px 18px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">انصراف</button></div>';
    document.getElementById('bmCancel').onclick = closeModal;
    document.getElementById('bmSubmit').onclick = doSubmit;
  }

  async function doSubmit() {
    if (submitted) return;
    var err = document.getElementById('bmErr');
    err.style.display = 'none';
    var ref = (document.getElementById('bmRef').value || '').trim();
    if (!ref) { err.textContent = 'کد پیگیری نمی‌تواند خالی باشد.'; err.style.display = 'block'; return; }
    if (!payId) { err.textContent = 'اطلاعات پرداخت پیدا نشد. از مرحله قبل دوباره شروع کن.'; err.style.display = 'block'; return; }
    var btn = document.getElementById('bmSubmit');
    btn.disabled = true;
    btn.textContent = 'در حال ثبت…';
    try {
      var r = await api('submit_payment', { method: 'POST', body: JSON.stringify({ payment_id: payId, ref: ref }) });
      var j = parseJSON(r);
      if (!r.ok) {
        submitted = false;
        btn.disabled = false;
        btn.textContent = 'ثبت کد پیگیری';
        err.textContent = errMsg(r.status, j);
        err.style.display = 'block';
        return;
      }
      submitted = true;
      step3();
    } catch (e) {
      submitted = false;
      btn.disabled = false;
      btn.textContent = 'ثبت کد پیگیری';
      err.textContent = 'اتصال اینترنت برقرار نشد. دوباره امتحان کن.';
      err.style.display = 'block';
    }
  }

  function step3() {
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">پرداخت ثبت شد</h3>' +
      '<p style="font-size:12.5px;line-height:2.2;color:#333">کد پیگیری تو با موفقیت ثبت شد.<br>پس از تأیید ادمین، دسترسی تو به‌صورت خودکار فعال می‌شود و می‌توانی از پنل کاربری دانلود کنی.</p>' +
      '<button id="bmDone" style="border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:12px 26px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">بستن</button>';
    document.getElementById('bmDone').onclick = closeModal;
  }

  document.addEventListener('click', function (e) {
    var pa = e.target.closest ? e.target.closest('.price-card a[data-id]') : null;
    if (pa) {
      e.preventDefault();
      if (!requireUser()) return;
      var h3 = pa.closest('.price-card').querySelector('h3');
      sel = { type: 'plan', id: pa.dataset.id, title: h3 ? h3.textContent : 'اشتراک PRO' };
      step1();
      return;
    }
    var pc = e.target.closest ? e.target.closest('.p-cart') : null;
    if (pc) {
      e.preventDefault();
      if (!requireUser()) return;
      sel = { type: 'product', id: pc.dataset.id, title: pc.dataset.t || 'محصول دیجیتال' };
      step1();
    }
  });
})();
