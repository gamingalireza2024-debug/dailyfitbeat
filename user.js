(async function () {
  if (document.body.dataset.page !== 'user') return;
  const t0 = setInterval(() => {
    if (!window.DFB || !DFB.sb) return;
    clearInterval(t0);
    if (!DFB.user) {
      document.getElementById('userBody').style.display = 'none';
      document.getElementById('uLogin').style.display = 'block';
      document.getElementById('uLoginBtn').onclick = () => DFB.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/user.html' } });
      return;
    }
    main();
  }, 400);

  async function api(t, opts) {
    const s = (await DFB.sb.auth.getSession()).data.session;
    const hd = { 'Content-Type': 'application/json' };
    if (s) hd.Authorization = 'Bearer ' + s.access_token;
    return fetch('/api/db?t=' + t, Object.assign({ headers: hd }, opts || {}));
  }

  async function main() {
    const U = DFB.user;
    const name = (U.user_metadata && U.user_metadata.name) || (U.email || '').split('@')[0];
    document.getElementById('uAva').textContent = (name[0] || 'D').toUpperCase();
    document.getElementById('uWelcome').textContent = 'سلام ' + name + '، آماده‌ای امروز بهتر بخوری؟';

    const ent = await (await api('my_entitlements')).json();
    const badge = document.getElementById('uProBadge');
    const proCard = document.getElementById('uProCard');
    if (ent.pro) {
      const days = ent.pro_expires ? Math.max(0, Math.ceil((new Date(ent.pro_expires) - new Date()) / 86400000)) : null;
      badge.innerHTML = '<span class="u-pro-badge">💎 PRO فعال</span>';
      proCard.innerHTML = `<div class="big">PRO فعال است ✅</div>
        <p style="font-size:12px;color:#667;margin-top:8px">${days != null ? days + ' روز تا پایان اشتراک' : 'بدون انقضا'}</p>
        <a class="btn ghost small" href="pro.html" style="margin-top:10px">مدیریت اشتراک</a>`;
    } else {
      badge.innerHTML = '<span class="u-pro-badge" style="background:#e8f4e9;color:#2d6a35">پلان رایگان</span>';
      proCard.innerHTML = `<div class="big">FREE</div>
        <p style="font-size:12px;color:#667;margin-top:8px">با PRO، برنامه شخصی، ذخیره نامحدود و لیست خرید هوشمند باز می‌شه.</p>
        <a class="btn small" href="pro.html" style="margin-top:10px">ارتقا به PRO</a>`;
    }

    // مقایسه FREE vs PRO
    document.getElementById('uVs').innerHTML = `
      <div class="free"><h4>پلان رایگان</h4><ul>
        <li>مشاهده همه رسپی‌ها</li><li>برنامه غذایی پایه (پلنر)</li><li>یخچال‌یاب (Ingredient Finder)</li><li>ذخیره تا ۱۰ رسپی</li>
      </ul></div>
      <div class="pro"><h4>💎 PRO</h4><ul>
        <li>ذخیره نامحدود رسپی</li><li>لیست خرید هوشمند</li><li>برنامه غذایی اختصاصی از ادمین</li><li>PDF حرفه‌ای رژیم</li><li>اولویت پشتیبانی</li>
      </ul>${ent.pro ? '' : '<a class="btn" href="pro.html" style="margin-top:12px">ارتقا به PRO</a>'}</div>`;

    // محصولات من
    const prods = ent.products || [];
    document.getElementById('uProducts').innerHTML = prods.length ? prods.map(p => `<div><b>${p.products.title_fa}</b><br><small>خرید: ${new Date(p.granted_at).toLocaleDateString('fa-IR')}${p.expires_at ? ' — تا ' + new Date(p.expires_at).toLocaleDateString('fa-IR') : ''}</small><br><a class="dl-btn" data-e="${p.id}" href="#">⬇ دانلود</a></div>`).join('') : '<div class="u-empty">هنوز محصولی نخریدی — <a href="market.html">فیت مارکت</a></div>';
    document.querySelectorAll('#uProducts .dl-btn').forEach(a => a.onclick = async (e) => {
      e.preventDefault();
      const r = await api('download', { method: 'POST', body: JSON.stringify({ entitlement_id: +a.dataset.e }) });
      const j = await r.json();
      if (r.ok) window.open(j.url, '_blank'); else alert(j.error === 'entitlement expired' ? 'دسترسی منقضی شده' : 'خطا در دانلود');
    });

    // برنامه‌های غذایی
    const diets = await (await api('my_diet_plans')).json();
    document.getElementById('uDiets').innerHTML = (Array.isArray(diets) && diets.length) ? diets.map(d => `<div><b>${d.title}</b> — ${d.duration_days || '—'} روز<br><small>هدف: ${d.goal || '—'} | کالری: ${d.kcal_target || '—'}</small><br>${d.pdf_path ? `<a class="dl-btn" href="/api/dietpdf?id=${d.id}" target="_blank">⬇ دانلود PDF</a>` : ''}</div>`).join('') : '<div class="u-empty">هنوز برنامه غذایی نداری.<br>با PRO، ادمین برات برنامه اختصاصی می‌سازه 💚</div>';

    // اعلان‌ها
    const notifs = await (await api('my_notifications')).json();
    document.getElementById('uNotifs').innerHTML = (Array.isArray(notifs) && notifs.length) ? notifs.map(n => `<div><b>${n.title}</b><br><small>${n.body}</small><br><small style="color:#98a298">${new Date(n.created_at).toLocaleDateString('fa-IR')}</small></div>`).join('') : '<div class="u-empty">اعلانی نداری</div>';

    // لیست خرید PRO
    const listBox = document.getElementById('uList');
    if (ent.pro) {
      const cur = await (await api('my_list')).json();
      const items = Array.isArray(cur) && cur[0] && cur[0].items ? cur[0].items : [];
      listBox.innerHTML = `<textarea id="slItems" style="width:100%;height:110px;border-radius:12px;border:1px solid #ccc;padding:10px;font:inherit;font-size:13px" placeholder="هر خط یک قلم خرید...">${(items || []).join('\n')}</textarea>
        <button class="btn small" id="slSave" style="margin-top:8px">ذخیره لیست</button>`;
      document.getElementById('slSave').onclick = async () => {
        const arr = document.getElementById('slItems').value.split('\n').map(s => s.trim()).filter(Boolean);
        await api('save_list', { method: 'POST', body: JSON.stringify({ items: arr }) });
        alert('ذخیره شد ✅');
      };
    } else {
      listBox.innerHTML = '<div class="u-empty">🔒 لیست خرید هوشمند مخصوص PRO است.<br><a class="btn small" href="pro.html" style="margin-top:8px">ارتقا به PRO</a></div>';
    }
  }
})();
