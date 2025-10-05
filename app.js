(() => {
'use strict';
// ====== CONFIG: 9 categories -> JSON URLs (raw GitHub at fixed commit)
// If you update your repo later, you can switch the hash to `main` or a new commit.
const RAW = 'https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/b739578b5774a58e8e6ef6f11cad019b9fefd6e6/';
const manifest = [
{key:'archetype', title:'Archetype / Role', file:'01_archetype_role.json', field:'archetype'},
{key:'positive_trait', title:'Positive Trait', file:'02_positive_trait.json', field:'positive_trait'},
{key:'motivation', title:'Motivation / Core Drive', file:'04_motivation_core_drive.json', field:'motivation'},
{key:'fatal_flaw', title:'Fatal Flaw + Negatives', file:'05_fatal_flaw_with_negative_traits.json', field:'fatal_flaw'},
{key:'destiny', title:'Destiny / Outcome', file:'06_destiny_outcome.json', field:'destiny'},
{key:'occupation', title:'Occupation + Reputation', file:'08_occupation_social_role_WITH_reputation.json', field:'occupation'},
{key:'secret', title:'Secret / Hidden Truth', file:'10_secret_hidden_truth.json', field:'secret'},
{key:'external_conflict',title:'External Conflict / Antagonist', file:'11_external_conflict_antagonist.json', field:'external_conflict'},
{key:'internal_conflict',title:'Internal Conflict', file:'12_internal_conflict.json', field:'internal_conflict'},
];


// ====== State containers
const state = { lists:{}, picks:{}, locked:new Set(), fast:false };


// ====== Helpers
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));


// Fetch JSON (each file expected to be either an array of strings OR array of {label:..., value:...})
async function fetchList(file){
const res = await fetch(RAW + file, { cache:'no-cache' });
if(!res.ok) throw new Error('Failed to load '+file);
const json = await res.json();
// Normalize to array of strings
return json.map(entry => typeof entry === 'string' ? entry : (entry.label || entry.value || JSON.stringify(entry)));
}


// ====== Build grid
const grid = $('#grid');
const kv = $('#kv');
const seedEl = $('#seed');
const quickSpin = $('#quickSpin');


quickSpin.addEventListener('change', () => state.fast = quickSpin.checked);


function reelTemplate({key, title}){
const el = document.createElement('section');
el.className = 'reel'; el.dataset.key = key;
el.innerHTML = `
<header>
<div class="title">${title}</div>
<label class="lock"><input type="checkbox" aria-label="Lock reel"> Lock</label>
</header>
<div class="viewport"><div class="strip"></div></div>
<footer>
<button class="btn mini" data-act="nudge-up">▲</button>
<button class="btn mini" data-act="spin">Spin</button>
<button class="btn mini" data-act="nudge-down">▼</button>
</footer>`;
return el;
}


function renderKV(){
kv.innerHTML = '';
for (const m of manifest){
const row = document.createElement('div');
row.className = 'row';
const val = state.picks[m.key] ?? '—';
row.innerHTML = `<div class="key">${m.title}</div><div class="val" id="kv-${m.key}">${val}</div>`;
kv.appendChild(row);
}
seedEl.textContent = buildSeed();
}


function buildSeed(){
const g = (k)=> state.picks[k] || '';
// Simple templated sentence; you can refine later.
const parts = [
})();
