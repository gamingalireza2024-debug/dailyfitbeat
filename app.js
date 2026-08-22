const SUPABASE_URL = "https://hvqchqqlfjcjxsohxywbd.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

let have = [], lang = 'fa';

async function loadChips(){
  const {data} = await sb.from('ingredients').select('key,fa,en').limit(18);
  document.getElementById('chips').innerHTML = data.map(i =>
    `<button class="chip" data-key="${i.key}">${lang==='fa'?i.fa:i.en}</button>`).join('');
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    c.classList.toggle('on');
    have = [...document.querySelectorAll('.chip.on')].map(x => x.dataset.key);
  });
}

document.getElementById('goBtn').onclick = async () => {
  if(!have.length) return alert(lang==='fa' ? 'اول چند تا ماده رو انتخاب کن' : 'Pick some ingredients first');
  const {data} = await sb.rpc('match_recipes', { have });
  document.getElementById('results').innerHTML = data.map(card).join('');
};

async function loadPopular(){
  const {data} = await sb.from('recipes').select('*').limit(4);
  document.getElementById('popularCards').innerHTML = data.map(card).join('');
}

function card(r){
  return `<div class="card"><h3>${r.name_fa}</h3><p class="en">${r.name_en}</p>
  <div class="meta"><span>${r.kcal} کالری</span><span>${r.time_min} دقیقه</span><span>پروتئین ${r.protein}g</span></div></div>`;
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
