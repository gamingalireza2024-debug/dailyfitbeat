const SUPABASE_URL = "https://hvqchqqlfjcjxsohxywbd.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWNocXFsZmNqeHNvaHh5d2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTI3ODYsImV4cCI6MjEwMjk4ODc4Nn0.yJursP15upa_-nE8P41l4uUssITBK319dzfaa2tbJ1k";
const H = { apikey: SUPABASE_ANON, Authorization: "Bearer " + SUPABASE_ANON };

let have = [], lang = 'fa';

if (SUPABASE_ANON.includes("PASTE")) alert("کلید رو توی خط دوم app.js بذار");

async function loadChips(){
  const r = await fetch(SUPABASE_URL + "/rest/v1/ingredients?select=key,fa,en&key=in.(chicken,beef,egg,tomato,rice,potato,onion,garlic,mushroom,spinach,avocado,bread,greek-yogurt,salmon,chickpea,lentil)", { headers: H });
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
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/match_recipes", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ have })
  });
  const data = await r.json();
  document.getElementById('results').innerHTML = data.map(card).join('');
};

async function loadPopular(){
  const r = await fetch(SUPABASE_URL + "/rest/v1/recipes?select=*&limit=4", { headers: H });
  const data = await r.json();
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
