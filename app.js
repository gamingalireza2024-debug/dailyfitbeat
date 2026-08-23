let have = [], lang = 'fa', ING = [];
const FALL = { iranian:'img/iranian.jpg', salad:'img/salad.jpg', sandwich:'img/sandwich.jpg', breakfast:'img/breakfast.jpg', soup:'img/soup.jpg', sauce:'img/soup.jpg', main:'img/hero.jpg' };
const diff = t => t <= 20 ? 'آسان' : t <= 60 ? 'متوسط' : 'مفصل';
const tagFa = t => ({'iranian':'ایرانی','high-protein':'پروتئین بالا','quick':'سریع','weight-loss':'کاهش وزن','vegetarian':'گیاهی','meal-prep':'مال‌پرپ'})[t] || 'سالم';

async function loadChips(){
  const r = await fetch('/api/db?t=ingredients');
  ING = await r.json();
  renderChips();
}
function renderChips(){
  document.getElementById('chips').innerHTML = ING.map(i =>
    `<button class="chip${have.includes(i.key)?' on':''}" data-key="${i.key}">${lang==='fa'?i.fa:i.en}</button>`).join('');
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    c.classList.toggle('on');
    have = [...document.querySelectorAll('.chip.on')].map(x => x.dataset.key);
  });
}
document.getElementById('ingAdd').onclick = () => {
  const v = document.getElementById('ingInput').value.trim();
  if(!v) return;
  const m = ING.find(i => i.fa.includes(v) || i.en.toLowerCase().includes(v.toLowerCase()));
  if(m && !have.includes(m.key)){ have.push(m.key); renderChips(); document.getElementById('ingInput').value = ''; }
  else alert(lang==='fa' ? 'این ماده رو هنوز نداریم؛ به‌زودی اضافه می‌شه' : 'Not in our pantry yet');
};
document.getElementById('goBtn').onclick = async () => {
  if(!have.length) return alert(lang==='fa' ? 'اول چند تا ماده رو انتخاب کن' : 'Pick some ingredients first');
  const r = await fetch('/api/db?t=match&a=' + have.join(','));
  const data = await r.json();
  document.getElementById('results').innerHTML = data.map(x => card(x)).join('');
};
async function loadPopular(){
  const r = await fetch('/api/db?t=popular');
  const data = await r.json();
  document.getElementById('popularCards').innerHTML =
    card(data[0], true) + data.slice(1).map(x => card(x)).join('');
}
function card(r, big){
  return `<a class="card${big?' big':''}" href="#">
  <div class="c-img"><img src="${r.image || FALL[r.category] || 'img/hero.jpg'}" loading="lazy"></div>
  <div class="c-body"><h3>${r.name_fa}</h3>
  <div class="c-meta"><span>${r.time_min} دقیقه</span><span>${r.kcal} کالری</span><span>پروتئین ${r.protein}g</span></div>
  <div class="c-tags"><i>${diff(r.time_min)}</i><i>${tagFa(r.tags[0])}</i></div>
  </div></a>`;
}
document.getElementById('langBtn').onclick = () => {
  lang = lang==='fa' ? 'en' : 'fa';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='fa' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-fa]').forEach(el => el.textContent = el.dataset[lang]);
  document.getElementById('langBtn').textContent = lang==='fa' ? 'EN' : 'فا';
  renderChips();
};
window.addEventListener('scroll', () => {
  document.getElementById('hdr').classList.toggle('scrolled', window.scrollY > 40);
});
const ob = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting) e.target.classList.add('in'); }), { threshold:.15 });
document.querySelectorAll('.rev').forEach(el => ob.observe(el));
loadChips(); loadPopular();
