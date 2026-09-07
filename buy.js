/* ══════════════════════════════════════════════════════════════════
   buy.js — مودال یکپارچه خرید (PRO / محصولات)
   جریان: مرحله ۱ (مشخصات + کد تخفیف + تیک قوانین) →
          مرحله ۲ «کارت به کارت» (شماره کارت امن از /api/payinfo + کپی) →
          مرحله ۳ (ثبت کد پیگیری) → تأیید
   کاربر واردشده: checkout + submit_payment — مهمان: order (فقط محصول)
   شماره کارت هرگز در کد/HTML نیست؛ از Vercel env می‌آید.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var modal = null, sel = null, payId = null, submitted = false, guest = null, payInfo = null;

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
    if (j && (j.error === 'terms-not-accepted')) return 'برای خرید باید قوانین و مقررات را بپذیری.';
    if (j && j.fa) return esc(j.fa);
    if (j && j.error === 'coupon invalid') return 'کد تخفیف معتبر نیست.';
    if (j && j.error === 'invalid coupon') return 'کد تخفیف معتبر نیست.';
    if (j && j.error === 'coupon expired') return 'کد تخفیف منقضی شده.';
    if (j && j.error) return 'خطا: ' + esc(j.error);
    return 'یک خطای موقت پیش آمد. دوباره امتحان کن.';
  }
  async function getPayInfo() {
    if (payInfo) return payInfo;
    try {
      var r = await fetch('/api/payinfo');
      if (!r.ok) return null;
      payInfo = await parseJSON(r);
      return (payInfo && payInfo.card) ? payInfo : null;
    } catch (e) { return null; }
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
  function closeModal() { if (modal) modal.style.display = 'none'; sel = null; payId = null; submitted = false; guest = null; }
  function openModal() { ensureModal(); modal.style.display = 'flex'; }

  function requireUser() {
    if (window.DFB && DFB.user) return true;
    openModal();
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">ورود لازم است</h3><p style="color:#667066;font-size:12.5px;line-height:2">اشتراک PRO باید به حساب کاربری وصل شود؛ برای ادامه اول با گوگل وارد شو.</p><button id="bmLogin" style="border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:11px 22px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">ورود با گوگل</button> <button id="bmCancel" style="border:1.5px solid #2d6a35;background:#fff;color:#2d6a35;border-radius:14px;padding:11px 22px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">انصراف</button>';
    document.getElementById('bmLogin').onclick = function () {
      if (window.DFB && DFB.sb) DFB.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    };
    document.getElementById('bmCancel').onclick = closeModal;
    return false;
  }

  function termsLabel(id) {
    return '<label for="' + id + '" style="display:flex;align-items:flex-start;gap:8px;margin:12px 0 2px;font-size:12px;line-height:1.9;cursor:pointer;color:#475047"><input type="checkbox" id="' + id + '" style="width:16px;height:16px;accent-color:#2d6a35;flex:0 0 auto;margin-top:3px"><span><a href="terms.html" target="_blank" rel="noopener" style="color:#2d6a35;font-weight:800">قوانین و مقررات</a> را خواندم و می‌پذیرم. با این تیک، خرید من مشمول شرایط بازگشت وجه محصولات دیجیتال هم می‌شود.</span></label>';
  }
  function errP() { return '<p id="bmErr" style="color:#c22;font-size:12px;display:none"></p>'; }
  function cancelBtn() { return '<button id="bmCancel" style="border:1.5px solid #2d6a35;background:#fff;color:#2d6a35;border-radius:14px;padding:12px 18px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">انصراف</button>'; }
  function showErr(msg) {
    var err = document.getElementById('bmErr');
    if (!err) return;
    err.textContent = msg;
    err.style.display = 'block';
  }
  function btnReset(id, txt) { var b = document.getElementById(id); if (b) { b.disabled = false; b.textContent = txt; } }

  /* ─── مرحله ۱: کاربر واردشده (کد تخفیف + تیک قوانین) ─── */
  function step1() {
    openModal();
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">تکمیل خرید</h3>' +
      '<p style="background:#f2f7f2;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:700">' + esc(sel.title) + '</p>' +
      '<p style="color:#667066;font-size:12px;margin:6px 0">کد تخفیف (اختیاری):</p>' +
      '<input id="bmCoupon" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #d8e2d8;font:inherit;font-size:13px" placeholder="مثال: FIT1404">' +
      termsLabel('bmTerms') + errP() +
      '<div style="display:flex;gap:8px;margin-top:10px"><button id="bmNext" style="flex:1;border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">ادامه و دریافت اطلاعات پرداخت</button>' + cancelBtn() + '</div>';
    document.getElementById('bmCancel').onclick = closeModal;
    document.getElementById('bmNext').onclick = doCheckout;
  }

  /* ─── مرحله ۱: مهمان (نام/موبایل/ایمیل + تیک قوانین) — فقط محصولات ─── */
  function guestStep1() {
    openModal();
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">سفارش سریع (بدون ورود)</h3>' +
      '<p style="background:#f2f7f2;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:700">' + esc(sel.title) + '</p>' +
      '<input id="bgName" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #d8e2d8;font:inherit;font-size:13px;margin-bottom:8px" placeholder="نام و نام خانوادگی">' +
      '<input id="bgPhone" dir="ltr" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #d8e2d8;font:inherit;font-size:13px;margin-bottom:8px;text-align:right" placeholder="شماره موبایل — مثال: 09123456789">' +
      '<input id="bgEmail" dir="ltr" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #d8e2d8;font:inherit;font-size:13px" placeholder="ایمیل (اختیاری — برای رسید خرید)">' +
      termsLabel('bmTerms') + errP() +
      '<div style="display:flex;gap:8px;margin-top:10px"><button id="bmNext" style="flex:1;border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">ادامه و دریافت اطلاعات پرداخت</button>' + cancelBtn() + '</div>';
    document.getElementById('bmCancel').onclick = closeModal;
    document.getElementById('bmNext').onclick = doGuestCheck;
  }

  async function doGuestCheck() {
    var name = (document.getElementById('bgName').value || '').trim();
    var phone = (document.getElementById('bgPhone').value || '').trim();
    var email = (document.getElementById('bgEmail').value || '').trim();
    var terms = document.getElementById('bmTerms');
    if (name.length < 2) { showErr('نام و نام خانوادگی را کامل بنویس.'); return; }
    if (!/^[0-9+\-\s]{7,20}$/.test(phone)) { showErr('شماره موبایل معتبر نیست.'); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showErr('ایمیل معتبر نیست.'); return; }
    if (!terms || !terms.checked) { showErr('برای ادامه خرید، اول قوانین و مقررات را بپذیر.'); return; }
    guest = { name: name, phone: phone, email: email, t0: Date.now() };
    var gAmount = null;
    try {
      var ps = await (await fetch('/api/db?t=products')).json();
      if (Array.isArray(ps)) { var p = ps.find(function (x) { return String(x.id) === String(sel.id); }); if (p) gAmount = p.price_rial; }
    } catch (e2) {}
    step2(gAmount, 0);
  }

  async function doCheckout() {
    var terms = document.getElementById('bmTerms');
    if (!terms || !terms.checked) { showErr('برای ادامه خرید، اول قوانین و مقررات را بپذیر.'); return; }
    var btn = document.getElementById('bmNext');
    btn.disabled = true;
    btn.textContent = 'در حال ثبت سفارش…';
    var code = (document.getElementById('bmCoupon').value || '').trim();
    var body = sel.type === 'plan' ? { plan_id: sel.id } : { product_id: sel.id };
    if (code) body.coupon = code;
    body.accept_terms = true;
    try {
      var r = await api('checkout', { method: 'POST', body: JSON.stringify(body) });
      var j = await parseJSON(r);
      if (!r.ok) {
        showErr(errMsg(r.status, j));
        btnReset('bmNext', 'ادامه و دریافت اطلاعات پرداخت');
        return;
      }
      payId = j.payment_id || (j.payment && j.payment.id) || j.id || null;
      var amount = (j.amount != null) ? j.amount : (j.order && j.order.total != null ? j.order.total : j.total);
      var discount = (j.discount != null) ? j.discount : 0;
      step2(amount, discount);
    } catch (e) {
      showErr('اتصال اینترنت برقرار نشد. دوباره امتحان کن.');
      btnReset('bmNext', 'ادامه و دریافت اطلاعات پرداخت');
    }
  }

  /* ─── مرحله ۲: کارت به کارت — شماره کارت از API امن ─── */
  async function step2(amount, discount) {
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">کارت به کارت</h3>' +
      '<p style="font-size:12.5px;line-height:2">مبلغ قابل پرداخت:</p>' +
      '<div style="background:#e8f4e9;color:#2d6a35;border-radius:14px;padding:12px;font-size:16px;font-weight:900;text-align:center">' + (amount != null ? faN(amount) + ' ریال' : '—') + (discount ? ' <small style="font-weight:400">(تخفیف: ' + faN(discount) + ')</small>' : '') + '</div>' +
      '<div id="bmCardBox" style="margin-top:12px"><p style="font-size:12.5px;color:#667066">در حال دریافت اطلاعات کارت…</p></div>' +
      '<p style="font-size:12px;color:#667066;margin:12px 0 4px">پس از واریز، کد پیگیری تراکنش را وارد کن:</p>' +
      '<input id="bmRef" dir="ltr" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid #d8e2d8;font:inherit;font-size:13px;text-align:right" placeholder="مثال: 849201">' +
      errP() +
      '<div style="display:flex;gap:8px;margin-top:10px"><button id="bmSubmit" style="flex:1;border:0;background:#2d6a35;color:#fff;border-radius:14px;padding:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer">ثبت کد پیگیری</button>' + cancelBtn() + '</div>';
    document.getElementById('bmCancel').onclick = closeModal;
    document.getElementById('bmSubmit').onclick = doSubmit;

    var info = await getPayInfo();
    var cb = document.getElementById('bmCardBox');
    if (!cb) return; /* مودال بسته شده */
    if (info) {
      cb.innerHTML =
        '<p style="font-size:12.5px;margin:0 0 4px">واریز به کارت «' + esc(info.holder) + '» به شماره:</p>' +
        '<div style="display:flex;align-items:center;gap:8px;background:#f2f7f2;border-radius:12px;padding:12px">' +
        '<div dir="ltr" style="flex:1;font-size:16px;font-weight:800;letter-spacing:1px;text-align:center">' + esc(info.card) + '</div>' +
        '<button id="bmCopy" title="کپی شماره کارت" style="border:0;background:#2d6a35;color:#fff;border-radius:10px;padding:8px 12px;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer;flex:0 0 auto">کپی</button></div>' +
        '<p style="font-size:11.5px;color:#667066;margin:6px 0 0">مبلغ را دقیقاً با همان عدد بالا واریز کن تا تأیید سریع‌تر شود.</p>';
      var cp = document.getElementById('bmCopy');
      if (cp) cp.onclick = function () {
        var digits = String(info.card).replace(/\D/g, '');
        var done = function () { cp.textContent = 'کپی شد'; setTimeout(function () { cp.textContent = 'کپی'; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(digits).then(done, done);
        else {
          var ta = document.createElement('textarea');
          ta.value = digits; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (e2) {}
          document.body.removeChild(ta); done();
        }
      };
    } else {
      cb.innerHTML = '<p style="font-size:12.5px;color:#c22;line-height:2;background:#fdf2f2;border-radius:12px;padding:10px 12px">شماره کارت موقتاً در دسترس نیست. با پشتیبانی (تیکت در پنل کاربری یا اینستاگرام) تماس بگیر تا سفارشت ثبت شود.</p>';
    }
  }

  /* ─── مرحله ۳: ثبت کد پیگیری ─── */
  async function doSubmit() {
    if (submitted) return;
    var ref = (document.getElementById('bmRef').value || '').trim();
    if (ref.length < 4) { showErr('کد پیگیری را کامل وارد کن (حداقل ۴ کاراکتر).'); return; }
    var btn = document.getElementById('bmSubmit');
    btn.disabled = true;
    btn.textContent = 'در حال ثبت…';
    try {
      if (guest) {
        var r0 = await fetch('/api/db?t=order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: guest.name, phone: guest.phone, email: guest.email, product: sel.title, ref: ref, note: '', user_id: null, website: '', accept_terms: true, form_time: Date.now() - guest.t0 }) });
        var j0 = await parseJSON(r0);
        if (!r0.ok || (!j0.id && j0.error)) {
          btn.disabled = false; btn.textContent = 'ثبت کد پیگیری';
          showErr(errMsg(r0.status, j0));
          return;
        }
        submitted = true;
        step3(true);
        return;
      }
      if (!payId) { btn.disabled = false; btn.textContent = 'ثبت کد پیگیری'; showErr('اطلاعات پرداخت پیدا نشد. از مرحله قبل دوباره شروع کن.'); return; }
      var r = await api('submit_payment', { method: 'POST', body: JSON.stringify({ payment_id: payId, ref: ref }) });
      var j = await parseJSON(r);
      if (!r.ok) {
        btn.disabled = false;
        btn.textContent = 'ثبت کد پیگیری';
        showErr(errMsg(r.status, j));
        return;
      }
      submitted = true;
      step3(false);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'ثبت کد پیگیری';
      showErr('اتصال اینترنت برقرار نشد. دوباره امتحان کن.');
    }
  }

  function step3(g) {
    var box = document.getElementById('buyBox');
    box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px">' + (g ? 'سفارش ثبت شد' : 'پرداخت ثبت شد') + '</h3>' +
      '<p style="font-size:12.5px;line-height:2.2;color:#333">' + (g
        ? 'سفارش تو با کد پیگیری واریز ثبت شد.<br>پس از تأیید ادمین، برای هماهنگی تحویل با تو تماس می‌گیریم.'
        : 'کد پیگیری تو با موفقیت ثبت شد.<br>پس از تأیید ادمین، دسترسی تو به‌صورت خودکار فعال می‌شود و می‌توانی از پنل کاربری دانلود کنی.') + '</p>' +
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
      sel = { type: 'product', id: pc.dataset.id, title: pc.dataset.t || 'محصول دیجیتال' };
      if (window.DFB && DFB.user) step1();
      else guestStep1();
    }
  });
})();
