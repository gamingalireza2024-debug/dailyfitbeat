(async function () {
  if (document.body.dataset.page !== 'ai') return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const faN = n => (Number(n) || 0).toLocaleString('fa-IR');
  const chat = document.getElementById('chat');
  const msg = document.getElementById('msg');
  const sendBtn = document.getElementById('send');
  const usageChip = document.getElementById('usageChip');
  const useProf = document.getElementById('useProf');
  useProf.checked = localStorage.getItem('dfb-ai-profile') === '1';
  useProf.onchange = () => localStorage.setItem('dfb-ai-profile', useProf.checked ? '1' : '0');

  let ING = [];
  const t0 = setInterval(async () => {
    if (!window.DFB || !DFB.sb) return;
    clearInterval(t0);
    if (!DFB.user) {
      chat.innerHTML = '<div class="bub sys">برای استفاده از دستیار تغذیه، اول با گوگل وارد شو 🌿</div>';
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'ورود با گوگل'; b.style.margin = '10px auto'; b.style.display = 'block';
      b.onclick = () => DFB.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/ai.html' } });
      chat.appendChild(b);
      usageChip.textContent = 'ورود لازم است';
      return;
    }
    try { ING = await (await fetch('/api/db?t=ingredients')).json(); } catch (e) { ING = []; }
    await loadUsage();
    addBot('سلام! من دستیار تغذیه DailyFitBeat هستم 🌿\nاز من درباره رسپی، کالری، ماکروها و برنامه غذایی بپرس. اگه مواد یخچالت رو بگی، از بین رسپی‌های واقعی سایت پیشنهاد می‌دم.');
  }, 400);

  async function tok() { const s = (await DFB.sb.auth.getSession()).data.session; return s ? s.access_token : null; }
  async function loadUsage() {
    try {
      const t = await tok();
      const r = await fetch('/api/ai', { headers: { 'X-Supabase-Auth': t } });
      if (!r.ok) { usageChip.textContent = '—'; return; }
      const j = await r.json();
      usageChip.textContent = faN(j.used) + ' از ' + faN(j.limit) + ' پاسخ ' + (j.pro ? 'PRO' : 'رایگان') + ' این ماه';
    } catch (e) { usageChip.textContent = '—'; }
  }
  function addUser(text) { chat.insertAdjacentHTML('beforeend', '<div class="bub user">' + esc(text) + '</div>'); scroll(); }
  function addBot(text) { chat.insertAdjacentHTML('beforeend', '<div class="bub bot">' + esc(text) + '</div>'); scroll(); }
  function addSys(html) { chat.insertAdjacentHTML('beforeend', html); scroll(); }
  function typing(on) {
    const el = document.getElementById('tp');
    if (on && !el) { chat.insertAdjacentHTML('beforeend', '<div class="bub bot typing" id="tp"><i></i><i></i><i></i></div>'); scroll(); }
    if (!on && el) el.remove();
  }
  function scroll() { chat.scrollTop = chat.scrollHeight; }
  function bindLogin(btnId) {
    const b = document.getElementById(btnId);
    if (b) b.onclick = () => DFB.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/ai.html' } });
  }

  document.querySelectorAll('#quick button').forEach(b => b.onclick = () => { msg.value = b.textContent; msg.focus(); });
  msg.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  sendBtn.onclick = send;

  async function send() {
    const text = msg.value.trim();
    if (!text || sendBtn.disabled) return;
    msg.value = ''; sendBtn.disabled = true; addUser(text); typing(true);
    const have = (Array.isArray(ING) ? ING : []).filter(i => i.fa && text.includes(i.fa)).map(i => i.key);
    const body = { message: text };
    if (useProf.checked) body.include_profile = true;
    if (have.length) body.have = have;
    try {
      const t = await tok();
      const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Supabase-Auth': t }, body: JSON.stringify(body) });
      const j = await r.json(); typing(false);
      if (r.ok) { addBot(j.reply || 'پاسخی دریافت نشد؛ دوباره امتحان کن.'); await loadUsage(); }
      else if (r.status === 401) { addSys('<div class="bub sys">نشست تو تمام شده.<br><button id="reLogin" class="btn small" style="margin-top:8px">ورود با گوگل</button></div>'); bindLogin('reLogin'); }
      else if (r.status === 403) addSys('<div class="bub sys">حساب تو غیرفعال شده. با پشتیبانی تماس بگیر.</div>');
      else if (r.status === 429 && j.error === 'too fast') addSys('<div class="bub sys">یک لحظه صبر کن و دوباره امتحان کن ⏳</div>');
      else if (r.status === 429 && j.error === 'quota_exceeded') addSys('<div class="bub sys">سهمیه رایگان این ماهت تمام شده.<br>با PRO دستیار تغذیه را با سقف بالاتر استفاده کن.<br><a class="btn small" href="pro.html" style="margin-top:8px">ارتقا به PRO</a></div>');
      else if (r.status === 503) addSys('<div class="bub sys">دستیار تغذیه فعلاً در دسترس نیست. کمی بعد دوباره امتحان کن.</div>');
      else if (r.status === 400) addSys('<div class="bub sys">پیامت قابل پردازش نبود؛ کوتاه‌ترش کن و دوباره بفرست.</div>');
      else addSys('<div class="bub sys">یه مشکل موقت پیش اومد؛ دوباره امتحان کن 🌱</div>');
    } catch (e) { typing(false); addSys('<div class="bub sys">اتصال اینترنتت رو چک کن و دوباره امتحان کن.</div>'); }
    sendBtn.disabled = false; msg.focus();
  }

  const pm = document.getElementById('profModal');
  const split = v => v.split('،').join(',').split(',').map(s => s.trim()).filter(Boolean);
  document.getElementById('profBtn').onclick = async () => {
    pm.style.display = 'flex';
    try {
      const t = await tok(); const r = await fetch('/api/nutrition', { headers: { 'X-Supabase-Auth': t } }); const p = await r.json();
      if (p && !p.empty) {
        document.getElementById('pfGoal').value = p.goal || ''; document.getElementById('pfAct').value = p.activity_level || '';
        document.getElementById('pfH').value = p.height_cm || ''; document.getElementById('pfW').value = p.weight_kg || '';
        document.getElementById('pfKcal').value = p.calorie_target || ''; document.getElementById('pfPro').value = p.protein_target || '';
        document.getElementById('pfCarb').value = p.carbs_target || ''; document.getElementById('pfFat').value = p.fat_target || '';
        document.getElementById('pfLike').value = (p.food_preferences || []).join('، '); document.getElementById('pfDislike').value = (p.disliked_foods || []).join('، ');
        document.getElementById('pfAllergy').value = (p.allergies || []).join('، '); document.getElementById('pfRestr').value = (p.dietary_restrictions || []).join('، ');
      }
    } catch (e) {}
  };
  document.getElementById('pfClose').onclick = () => pm.style.display = 'none';
  pm.addEventListener('click', e => { if (e.target === pm) pm.style.display = 'none'; });
  document.getElementById('pfSave').onclick = async () => {
    const t = await tok();
    const r = await fetch('/api/nutrition', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Supabase-Auth': t }, body: JSON.stringify({
      goal: document.getElementById('pfGoal').value || null, activity_level: document.getElementById('pfAct').value || null,
      height_cm: document.getElementById('pfH').value || null, weight_kg: document.getElementById('pfW').value || null,
      calorie_target: document.getElementById('pfKcal').value || null, protein_target: document.getElementById('pfPro').value || null,
      carbs_target: document.getElementById('pfCarb').value || null, fat_target: document.getElementById('pfFat').value || null,
      food_preferences: split(document.getElementById('pfLike').value), disliked_foods: split(document.getElementById('pfDislike').value),
      allergies: split(document.getElementById('pfAllergy').value), dietary_restrictions: split(document.getElementById('pfRestr').value)
    }) });
    if (r.ok) { alert('پروفایل ذخیره شد ✅'); pm.style.display = 'none'; } else alert('خطا در ذخیره پروفایل');
  };
})();