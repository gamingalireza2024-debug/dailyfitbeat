let have = [], lang = 'fa';
const CAT_IMG = { iranian:'img/iranian.jpg', salad:'img/salad.jpg', sandwich:'img/sandwich.jpg', breakfast:'img/breakfast.jpg', soup:'img/soup.jpg', sauce:'img/soup.jpg', main:'img/hero.jpg' };

async function loadChips(){
  const r = await fetch("/api/db?t=ingredients");
  const data = await r.json();
  document.getElementById('chips').innerHTML = data.map(i =>
    `<button class="chip" data-key="${i.key}">${lang==='fa'?i.fa:i.en}</button>`).join('');
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    c.classList.toggle('on');
    have = [...document.querySelectorAll('.chip.on')].map(x => x.dataset.key);
  });
}

document.getElementById('goBtn').onclick = async () => {
  if(!have.length) return alert(lang==='fa' ? 'اول چند تا ماده رو انتخاب کن' : 'Pick some ingredients first');
  const r = await fetch("/api/db?t=match&a=" + have.join(","));
  const data = await r.json();
  document.getElementById('results').innerHTML = data.map(card).join('');
};

async function loadPopular(){
  const r = await fetch("/api/db?t=popular");
  const data = await r.json();
  document.getElementById('popularCards').innerHTML = data.map(card).join('');
}

function card(r){
  return `<div class="card"><div class="card-img"><img src="${CAT_IMG[r.category]||'img/hero.jpg'}" loading="lazy"></div>
  <h3>${r.name_fa}</h3><p class="en">${r.name_en}</p>
  <div class="meta"><span>${r.time_min} دقیقه</span><span>${r.kcal} کالری</span><span>پروتئین ${r.protein}g</span></div></div>`;
}

document.getElementById('langBtn').onclick = () => {
  lang = lang==='fa' ? 'en' : 'fa';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-fa]').forEach(el => el.textContent = el.dataset[lang]);
  document.getElementById('langBtn').textContent = lang==='fa' ? 'EN' : 'فا';
  loadChips();
};

loadChips(); loadPopular();
