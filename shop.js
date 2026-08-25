// DailyFitBeat — جریان خرید (Manual فعال + معماری آماده برای Gateway)
const CARD_NUMBER = "6037-9975-0000-0000"; // ⚠️ شماره کارت واقعی خودت رو اینجا بذار
(function () {
  function modal() {
    let m = document.getElementById('shopModal');
    if (m) return m;
    document.body.insertAdjacentHTML('beforeend', `<div id="shopModal" class="modal" style="display:none"><div class="modal-box" style="max-width:480px">
      <h3 id="smTitle">ثبت سفارش</h3>
      <div id="smBody"></div>
    </div></div>`);
    return document.getElementById('shopModal');
  }
  async function api(t, opts) {
    const s = (await DFB.sb.auth.getSession()).data.session;
    const hd = { 'Content-Type': 'application/json' };
    if (s) hd.Authorization = 'Bearer ' + s.access_token;
    return fetch('/api/db?t=' + t, Object.assign({ headers: hd }, opts || {}));
  }
  window.DFB_buy = async function (payload, title) {
    if (!DFB.user) { alert('اول با گوگل وارد شو 👤'); if (window.doLogin) doLogin(); return; }
    const m = modal();
    m.style.display = 'flex';
    document.getElementById('smTitle').textContent = 'خرید: ' + title;
    document.getElementById('smBody').innerHTML = `<p style="font-size:13px;color:#667">کد تخفیف داری؟ (اختیاری)</p>
      <input id="smCoupon" placeholder="کد تخفیف" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font:inherit">
      <button id="smGo" class="btn" style="margin-top:10px;width:100%">ادامه</button>
      <button id="smX" class="btn ghost" style="margin-top:6px;width:100%">انصراف</button>`;
    document.getElementById('smX').onclick = () => m.style.display = 'none';
    document.getElementById('smGo').onclick = async () => {
      const coupon = document.getElementById('smCoupon').value.trim();
      const r = await api('checkout', { method: 'POST', body: JSON.stringify(Object.assign({}, payload, { coupon: coupon || undefined, method: 'MANUAL' })) });
      const j = await r.json();
      if (!r.ok) { alert(j.error === 'invalid coupon' ? 'کد تخفیف معتبر نیست' : (j.error || 'خطا')); return; }
      document.getElementById('smBody').innerHTML = `
        <div style="background:#e8f4e9;border-radius:14px;padding:14px;text-align:center;margin-bottom:12px"><b style="font-size:20px;color:#2d6a35">${(j.total / 10).toLocaleString('fa-IR')} تومان</b>${j.discount ? `<br><small>تخفیف: ${(j.discount / 10).toLocaleString('fa-IR')} تومان 🎉</small>` : ''}</div>
        <p style="font-size:13px;line-height:2">۱) مبلغ رو به کارت <b dir="ltr">${CARD_NUMBER}</b> واریز کن<br>۲) کد پیگیری رو اینجا بذار:</p>
        <input id="smRef" placeholder="کد پیگیری واریز" style="width:100%;padding:10px;border-radius:10px;border:1px solid #ccc;font:inherit">
        <button id="smSub" class="btn" style="margin-top:10px;width:100%">ثبت پرداخت ✅</button>`;
      document.getElementById('smSub').onclick = async () => {
        const ref = document.getElementById('smRef').value.trim();
        const r2 = await api('submit_payment', { method: 'POST', body: JSON.stringify({ payment_id: j.payment_id, ref }) });
        if (!r2.ok) { alert('خطا در ثبت'); return; }
        document.getElementById('smBody').innerHTML = `<p style="text-align:center;line-height:2">✅ پرداختت ثبت شد و برای تأیید به ادمین رفت.<br>بعد از تأیید، محصول/PRO در <b>پنل کاربری</b> فعال می‌شه و اعلان می‌گیری. 🎉</p>`;
      };
    };
  };
  // delegation — بدون وابستگی به زمان رندر
  document.addEventListener('click', (e) => {
    const cart = e.target.closest('.p-cart');
    if (cart) { e.preventDefault(); DFB_buy({ product_id: +cart.dataset.id }, cart.dataset.t); return; }
    const planBtn = e.target.closest('#planCards .price-card .btn');
    if (planBtn) { e.preventDefault(); const c = planBtn.closest('.price-card'); DFB_buy({ plan_id: +planBtn.dataset.id }, c.querySelector('h3').textContent); }
  });
})();
