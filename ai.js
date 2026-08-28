(async function () {
  if (document.body.dataset.page !== 'ai') return;

  var FA = '۰۱۲۳۴۵۶۷۸۹';
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var sb = null, booted = false, sending = false, ING = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function faN(n) { return (Number(n) || 0).toLocaleString('fa-IR'); }
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

  var chat = $('chat'), msg = $('msg'), sendBtn = $('send'), usageChip = $('usageChip'), useProf = $('useProf'), pm = $('profModal');
  useProf.checked = (function () { try { return localStorage.getItem('dfb-ai-profile') === '1'; } catch (e) { return false; } })();
  useProf.onchange = function () { try { localStorage.setItem('dfb-ai-profile', useProf.checked ? '1' : '0'); } catch (e) {} };
  pm.classList.remove('open');

  async function waitForSB() {
    for (var i = 0; i < 40; i++) {
      if (window.DFB && DFB.sb) { sb = DFB.sb; return true; }
      await new Promise(function (r) { setTimeout(r, 150); });
    }
    return false;
  }
  async function getSessionSafe() {
    try {
      if (!sb) return null;
      var r = await sb.auth.getSession();
      return r && r.data && r.data.session ? r.data.session : null;
    } catch (e) { return null; }
  }
  async function tok() {
    var s = await getSessionSafe();
    return s && s.access_token ? s.access_token : null;
  }
  async function headers() {
    var t = await tok();
    if (!t) return null;
    return { 'X-Supabase-Auth': t, 'Authorization': 'Bearer ' + t };
  }

  function addUser(text) { chat.insertAdjacentHTML('beforeend', '<div class="bub user">' + esc(text) + '</div>'); scroll(); }
  function addBot(text) { chat.insertAdjacentHTML('beforeend', '<div class="bub bot">' + esc(text) + '</div>'); scroll(); }
  function addSys(html) { chat.insertAdjacentHTML('beforeend', html); scroll(); }
  function typing(on) {
    var el = $('tp');
    if (on && !el) { chat.insertAdjacentHTML('beforeend', '<div class="bub bot typing" id="tp"><i></i><i></i><i></i></div>'); scroll(); }
    if (!on && el) el.remove();
  }
  function scroll() { chat.scrollTop = chat.scrollHeight; }
  function doOAuth() {
    if (sb) sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/ai.html' } });
  }
  function showLoginState() {
    usageChip.textContent = 'سهمیه: نیاز به ورود';
    chat.innerHTML = '<div class="bub sys">برای استفاده از دستیار تغذیه، اول با گوگل وارد شو.</div>';
    var b = document.createElement('button');
    b.className = 'btn';
    b.textContent = 'ورود با گوگل';
    b.style.margin = '10px auto';
    b.style.display = 'block';
    b.onclick = doOAuth;
    chat.appendChild(b);
  }

  async function loadUsage() {
    var h = await headers();
    if (!h) { usageChip.textContent = 'سهمیه: نیاز به ورود'; return; }
    try {
      var r = await fetch('/api/ai', { headers: h });
      if (!r.ok) { usageChip.textContent = 'سهمیه: —'; return; }
      var j = await r.json();
      usageChip.textContent = faN(j.used) + ' از ' + faN(j.limit) + ' پاسخ ' + (j.pro ? 'PRO' : 'رایگان') + ' این ماه';
    } catch (e) { usageChip.textContent = 'سهمیه: —'; }
  }

  async function initChat() {
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    if (!Array.isArray(ING)) ING = [];
    await loadUsage();
    if (!chat.children.length) {
      addBot('سلام! من دستیار تغذیه DailyFitBeat هستم.\nاز من درباره رسپی، کالری، ماکروها و برنامه غذایی بپرس. اگه مواد یخچالت رو بگی، از بین رسپی‌های واقعی سایت پیشنهاد می‌دم.');
    }
  }

  async function send() {
    if (sending) return;
    var text = msg.value.trim();
    if (!text) return;
    var h = await headers();
    if (!h) { showLoginState(); return; }
    sending = true;
    sendBtn.disabled = true;
    msg.value = '';
    addUser(text);
    typing(true);
    var have = ING.filter(function (i) { return i.fa && text.indexOf(i.fa) !== -1; }).map(function (i) { return i.key; });
    var body = { message: text };
    if (useProf.checked) body.include_profile = true;
    if (have.length) body.have = have;
    try {
      var r = await fetch('/api/ai', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, h), body: JSON.stringify(body) });
      var j = {};
      try { j = await r.json(); } catch (e) {}
      typing(false);
      if (r.ok && j.reply) {
        addBot(j.reply);
        await loadUsage();
      } else if (r.status === 400) {
        addSys('<div class="bub sys">پیامت قابل پردازش نبود؛ کوتاه‌ترش کن و دوباره بفرست.</div>');
      } else if (r.status === 401) {
        addSys('<div class="bub sys">نشست تو تمام شده.<br><button id="reLogin" style="border:0;background:#2d6a35;color:#fff;border-radius:12px;padding:8px 18px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;margin-top:8px">ورود با گوگل</button></div>');
        var rb = $('reLogin');
        if (rb) rb.onclick = doOAuth;
      } else if (r.status === 403) {
        addSys('<div class="bub sys">حساب تو غیرفعال شده. با پشتیبانی تماس بگیر.</div>');
      } else if (r.status === 429 && j.error === 'quota_exceeded') {
        addSys('<div class="bub sys">سهمیه رایگان این ماهت تمام شده.<br>با PRO دستیار تغذیه را با سقف بالاتر استفاده کن.<br><a href="pro.html" style="display:inline-block;border:0;background:#2d6a35;color:#fff;border-radius:12px;padding:8px 18px;font:inherit;font-size:12px;font-weight:800;text-decoration:none;margin-top:8px">ارتقا به PRO</a></div>');
        await loadUsage();
      } else if (r.status === 429) {
        addSys('<div class="bub sys">یک لحظه صبر کن و دوباره امتحان کن.</div>');
      } else if (r.status === 503) {
        addSys('<div class="bub sys">دستیار تغذیه فعلاً در دسترس نیست. کمی بعد دوباره امتحان کن.</div>');
      } else {
        addSys('<div class="bub sys">یه مشکل موقت پیش اومد؛ دوباره امتحان کن.</div>');
      }
    } catch (e) {
      typing(false);
      addSys('<div class="bub sys">اتصال اینترنتت رو چک کن و دوباره امتحان کن.</div>');
    }
    sending = false;
    sendBtn.disabled = false;
    msg.focus();
  }

  // ---------- پروفایل ----------
  function splitList(v) { return v.split('،').join(',').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function pfShow(type, text) {
    var el = $('pfMsg');
    el.className = 'pf-msg ' + type;
    el.textContent = text;
  }
  async function openProfile() {
    pm.classList.add('open');
    pfShow('', '');
    $('pfMsg').className = 'pf-msg';
    var h = await headers();
    if (!h) { pfShow('err', 'نشست فعال نیست؛ دوباره وارد شو.'); return; }
    try {
      var r = await fetch('/api/nutrition', { headers: h });
      if (!r.ok) { pfShow('err', 'دریافت پروفایل ناموفق بود.'); return; }
      var p = await r.json();
      if (p && !p.empty) {
        $('pfGoal').value = p.goal || '';
        $('pfAct').value = p.activity_level || '';
        $('pfH').value = p.height_cm != null ? p.height_cm : '';
        $('pfW').value = p.weight_kg != null ? p.weight_kg : '';
        $('pfKcal').value = p.calorie_target != null ? p.calorie_target : '';
        $('pfPro').value = p.protein_target != null ? p.protein_target : '';
        $('pfCarb').value = p.carbs_target != null ? p.carbs_target : '';
        $('pfFat').value = p.fat_target != null ? p.fat_target : '';
        $('pfLike').value = (p.food_preferences || []).join('، ');
        $('pfDislike').value = (p.disliked_foods || []).join('، ');
        $('pfAllergy').value = (p.allergies || []).join('، ');
        $('pfRestr').value = (p.dietary_restrictions || []).join('، ');
      }
    } catch (e) { pfShow('err', 'خطا در دریافت پروفایل.'); }
  }
  async function saveProfile() {
    var h = await headers();
    if (!h) { pfShow('err', 'نشست فعال نیست؛ دوباره وارد شو.'); return; }
    var btn = $('pfSave');
    btn.disabled = true;
    try {
      var r = await fetch('/api/nutrition', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, h),
        body: JSON.stringify({
          goal: $('pfGoal').value || null,
          activity_level: $('pfAct').value || null,
          height_cm: toNum($('pfH').value),
          weight_kg: toNum($('pfW').value),
          calorie_target: toNum($('pfKcal').value),
          protein_target: toNum($('pfPro').value),
          carbs_target: toNum($('pfCarb').value),
          fat_target: toNum($('pfFat').value),
          food_preferences: splitList($('pfLike').value),
          disliked_foods: splitList($('pfDislike').value),
          allergies: splitList($('pfAllergy').value),
          dietary_restrictions: splitList($('pfRestr').value)
        })
      });
      var j = {};
      try { j = await r.json(); } catch (e) {}
      if (r.ok) {
        pfShow('ok', 'پروفایل ذخیره شد.');
        setTimeout(function () { pm.classList.remove('open'); }, 900);
      } else {
        pfShow('err', j.error ? 'خطا در ذخیره: ' + j.error : 'خطا در ذخیره پروفایل.');
      }
    } catch (e) {
      pfShow('err', 'اتصال اینترنت برقرار نشد.');
    }
    btn.disabled = false;
  }

  $('profBtn').onclick = openProfile;
  $('pfClose').onclick = function () { pm.classList.remove('open'); };
  pm.addEventListener('click', function (e) { if (e.target === pm) pm.classList.remove('open'); });
  $('pfSave').onclick = saveProfile;

  Array.prototype.forEach.call(document.querySelectorAll('#quick button'), function (b) {
    b.onclick = function () { msg.value = b.textContent; msg.focus(); };
  });
  msg.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  sendBtn.onclick = send;

  // ---------- boot پایدار ----------
  (async function boot() {
    if (booted) return;
    booted = true;
    var ok = await waitForSB();
    if (!ok) { showLoginState(); return; }
    try {
      sb.auth.onAuthStateChange(function (ev, sess) {
        if (ev === 'SIGNED_OUT') { sending = false; sendBtn.disabled = false; typing(false); showLoginState(); }
        if (ev === 'SIGNED_IN' && sess && sess.user) initChat();
      });
    } catch (e) {}
    var s = await getSessionSafe();
    if (s && s.user) await initChat();
    else showLoginState();
  })();
})();
