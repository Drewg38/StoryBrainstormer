/* Cool Character Brainstormer — app.js (complete, 9 reels, self-initializing)
   - Classic global (no modules). Exposes window.Brainstormer.init()
   - Loads JSON from your repo (pinned commit + main, jsDelivr + raw GH)
   - Inline fallback arrays if network blocked
*/

(function () {
  'use strict';

  /* ---------------------- SWITCHES ---------------------- */
  const FORCE_INLINE = false; // set true to skip network and use INLINE_DATA only
  const DEBUG = false;

  /* ---------------------- DOM HELPERS ---------------------- */
  const $  = (s, el=document)=>el.querySelector(s);
  const $$ = (s, el=document)=>Array.from(el.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function status(msg){
    const el = $('#dataStatus');
    if (el) el.textContent = msg || '';
    if (DEBUG && msg) console.log('[CBB]', msg);
  }

  /* ---------------------- DATA SOURCES ---------------------- */
  const PINNED = 'b739578b5774a58e8e6ef6f11cad019b9fefd6e6'; // from your links
  const REMOTE_BASES = [
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@${PINNED}/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/${PINNED}/`,
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@main/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/main/`,
  ];

  const LISTS = [
    { key:'archetype',         file:'01_archetype_role.json' },
    { key:'positive_trait',    file:'02_positive_trait.json' },
    { key:'motivation',        file:'04_motivation_core_drive.json' },
    { key:'fatal_flaw',        file:'05_fatal_flaw_with_negative_traits.json' },
    { key:'destiny',           file:'06_destiny_outcome.json' },
    { key:'occupation',        file:'08_occupation_social_role_WITH_reputation.json' },
    { key:'secret',            file:'10_secret_hidden_truth.json' },
    { key:'external_conflict', file:'11_external_conflict_antagonist.json' },
    { key:'internal_conflict', file:'12_internal_conflict.json' },
  ];

  /* ---------------------- INLINE FALLBACK ---------------------- */
  const INLINE_DATA = {
    archetype: ["Healer","Warrior","Trickster","Scholar","Protector","Visionary","Outcast","Leader","Investigator","Mediator"],
    positive_trait: ["Resourceful","Compassionate","Courageous","Clever","Loyal","Disciplined","Patient","Curious","Honest","Resilient"],
    motivation: ["Redemption","Justice","Freedom","Belonging","Legacy","Discovery","Revenge","Love","Duty","Truth"],
    fatal_flaw: ["Obsession","Pride","Fear","Naivety","Stubbornness","Jealousy","Impatience","Distrust","Guilt","Greed"],
    destiny: ["Rise to lead","Fall from grace","Self-sacrifice","Exile","Reconciliation","Revelation","Transformation","Triumph","Tragedy","Legacy secured"],
    occupation: ["Smuggler-medic in a riverport","Archivist in a forbidden library","Wandering magistrate","Night-market broker","Temple scribe","Exorcist","Guild courier","Street chemist","Cartographer","Shipwright"],
    secret: ["Staged miracle that launched a sect","Hidden lineage to the rival house","Owes a blood debt","Illegal research notes","Double agent","Buried evidence","Forbidden romance","Stolen relic","False identity","Pact with a spirit"],
    external_conflict: ["Religious inquisition tightening its net","Rival guild’s crackdown","Civil unrest rising","Border war looming","Plague spreading","Heist gone wrong","Corrupt governor","Corporate takeover","Cursed region","Storm season blockade"],
    internal_conflict: ["Justice vs. Mercy","Faith vs. Doubt","Duty vs. Desire","Honor vs. Survival","Truth vs. Loyalty","Control vs. Trust","Tradition vs. Change","Hope vs. Cynicism","Solitude vs. Connection","Ambition vs. Conscience"],
  };

  /* ---------------------- LOADERS ---------------------- */
  async function fetchJsonWithFallback(file){
    let lastErr;
    for (const base of REMOTE_BASES){
      const url = base + file;
      try{
        if (DEBUG) console.log('[CBB] GET', url);
        const res = await fetch(url + (base.includes('jsdelivr') ? '' : `?t=${Date.now()}`), {mode:'cors', cache:'no-cache'});
        if (!res.ok) throw new Error('HTTP '+res.status);
        const text = await res.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('JSON is not an array');
        return data.map(x => typeof x==='string' ? x : (x.label || x.value || JSON.stringify(x)));
      }catch(e){ lastErr = e; }
    }
    throw lastErr || new Error('All sources failed for ' + file);
  }

  async function loadAllLists(){
    const out = {};
    for (const m of LISTS){
      out[m.key] = await fetchJsonWithFallback(m.file);
      status(`Loaded ${m.file} (${out[m.key].length})`);
    }
    return out;
  }

  /* ---------------------- REELS ---------------------- */
  function buildReel(slotEl, items, opts){
    const vp    = slotEl.querySelector('.viewport');
    const strip = slotEl.querySelector('.list.reel');
    if (!vp || !strip) return null;

    strip.innerHTML = items.map(t => `<div class="rowitem">${esc(t)}</div>`).join('');
    const rows = Array.from(strip.querySelectorAll('.rowitem'));

    let y=0, vy=0, dragging=false, lastY=0, lastTS=0, viewH=0, totalH=0;
    const clampY = ()=>{ const min = Math.min(0, viewH-totalH); y = clamp(y, min, 0); };
    const apply  = ()=>{ strip.style.transform = `translateY(${y}px)`; markCenter(); };

    function measure(){ viewH = vp.clientHeight; totalH = rows.reduce((s,n)=>s+n.offsetHeight,0); clampY(); apply(); }
    function posOf(i){ let s=0; for(let k=0;k<i;k++) s+=rows[k].offsetHeight; return s; }

    function markCenter(){
      const c = -y + viewH/2; let acc=0, best=0, bestD=1e9;
      rows.forEach((n,i)=>{ const m=acc + n.offsetHeight/2; acc+=n.offsetHeight; const d=Math.abs(m-c); if(d<bestD){bestD=d; best=i;} n.classList.toggle('center', i===best); });
      api.index = best; api.value = items[best]; api.onPick && api.onPick(api.value);
    }

    function tweenTo(target, ms=260, onEnd){
      const start=performance.now(), from=y, dur=Math.max(60,ms|0);
      (function frame(ts){
        const t=Math.max(0,Math.min(1,(ts-start)/dur));
        const k=1-(1-t)*(1-t);
        y = from + (target-from)*k; clampY(); apply();
        if (t<1) requestAnimationFrame(frame); else onEnd && onEnd();
      })(performance.now());
    }

    function snapTo(i, ms=opts.fast?160:280){
      i = clamp(i, 0, rows.length-1);
      const target = -(posOf(i) + rows[i].offsetHeight/2 - viewH/2);
      tweenTo(target, ms);
    }

    function fling(){
      const speed = clamp(vy*1000, -2000, 2000);
      tweenTo(y + speed*0.25, opts.fast?220:380, ()=>snapTo(api.index));
    }

    // interactions
    vp.addEventListener('pointerdown', e=>{ if(slotEl.classList.contains('locked')) return; dragging=true; vp.setPointerCapture(e.pointerId); lastY=e.clientY; vy=0; lastTS=performance.now(); });
    vp.addEventListener('pointermove', e=>{ if(!dragging) return; const now=performance.now(); const dy=e.clientY-lastY; lastY=e.clientY; y+=dy; clampY(); apply(); vy = dy/Math.max(1,(now-lastTS)); lastTS=now; });
    vp.addEventListener('pointerup',   ()=>{ dragging=false; fling(); });
    vp.addEventListener('pointercancel',()=>{ dragging=false; snapTo(api.index); });

    vp.addEventListener('wheel', e=>{ if(slotEl.classList.contains('locked')) return; e.preventDefault(); y -= Math.sign(e.deltaY)*40; clampY(); apply(); clearTimeout(api._to); api._to=setTimeout(()=>snapTo(api.index),140); }, {passive:false});

    const api = { value:null, index:0, onPick:null, measure, snapTo, random(){ snapTo(Math.floor(Math.random()*items.length)); } };
    measure(); api.random();

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ measure(); snapTo(api.index,0); });
    return api;
  }

  /* ---------------------- CONCEPT PANEL ---------------------- */
  function seedLine(p){
    const g=k=>p[k]||'';
    const a=s=>/^[aeiou]/i.test(s)?`an ${s}`:`a ${s}`;
    const parts=[
      g('positive_trait') && `A ${g('positive_trait').toLowerCase()}`,
      g('archetype') || 'character',
      g('occupation') && `working as ${a(g('occupation').toLowerCase())}`,
      g('motivation') && `driven by ${g('motivation').toLowerCase()}`,
      g('fatal_flaw') && `but haunted by ${a(g('fatal_flaw').toLowerCase())}`,
      g('secret') && `who hides ${a(g('secret').toLowerCase())}`,
      g('external_conflict') && `while facing ${a(g('external_conflict').toLowerCase())}`,
      g('internal_conflict') && `and torn between ${g('internal_conflict').toLowerCase()}`,
      g('destiny') && `on a path toward ${g('destiny').toLowerCase()}`
    ].filter(Boolean).join(', ') + '.';
    return parts.replace(/\s+/g,' ').replace(/ ,/g,',');
  }

  function renderConcept(picks){
    const box = $('#concept'); if (!box) return;
    const seed = seedLine(picks);
    const badge = v => v ? `<span class="badge">${esc(v)}</span>` : '';
    box.innerHTML = `
      <div class="meta badges">
        ${badge(picks.archetype)}
        ${badge(picks.positive_trait)}
        ${badge(picks.motivation)}
        ${badge(picks.fatal_flaw)}
        ${badge(picks.destiny)}
        ${badge(picks.occupation)}
        ${badge(picks.secret)}
        ${badge(picks.external_conflict)}
        ${badge(picks.internal_conflict)}
      </div>
      <p class="seed">${esc(seed)}</p>`;
  }

  /* ---------------------- PUBLIC API ---------------------- */
  window.Brainstormer = {
    async init(cfg){
      cfg = cfg || {};
      const reelsSel = Object.assign({
        archetype:'#reel_archetype',
        positive_trait:'#reel_positive',
        motivation:'#reel_motivation',
        fatal_flaw:'#reel_flaw',
        destiny:'#reel_destiny',
        occupation:'#reel_occupation',
        secret:'#reel_secret',
        external_conflict:'#reel_external',
        internal_conflict:'#reel_internal'
      }, (cfg.els && cfg.els.reels) || {});
      const btns = Object.assign({
        slow:'#btnSlow', spin:'#btnSpin', fast:'#btnFast', manual:'#btnManual', lock:'#btnLock'
      }, (cfg.els && cfg.els.buttons) || {});
      const picks = {};
      const reels = {};

      // Load data (remote or inline)
      let data;
      try{
        if (FORCE_INLINE) throw new Error('FORCE_INLINE');
        status('Loading lists from GitHub/CDN…');
        const out = {};
        for (const m of LISTS){
          out[m.key] = await fetchJsonWithFallback(m.file);
          status(`Loaded ${m.file} (${out[m.key].length})`);
        }
        data = out;
        status('Lists loaded ✓');
      }catch(_){
        status('Using inline lists ✓');
        data = INLINE_DATA;
      }

      // Build nine reels
      for (const m of LISTS){
        const host = $(reelsSel[m.key]);
        if (!host) continue;
        const items = (data[m.key] || []).slice();
        const api = buildReel(host, items, {fast:false});
        if (!api) continue;
        api.onPick = (val)=>{ picks[m.key]=val; renderConcept(picks); };
        reels[m.key] = api;
      }

      // Buttons
      const spinAll = ()=> Object.values(reels).forEach(r => r && r.random());
      $(btns.slow )?.addEventListener('click', spinAll);
      $(btns.spin )?.addEventListener('click', spinAll);
      $(btns.fast )?.addEventListener('click', spinAll);
      $(btns.manual)?.addEventListener('click', ()=> $$('.slot.locked').forEach(s=>s.classList.remove('locked')));
      $(btns.lock )?.addEventListener('click', ()=> { Object.values(reels).forEach(r=>r && r.snapTo(r.index,0)); $$('.slot').forEach(s=>s.classList.add('locked')); });

      renderConcept(picks);
      window.addEventListener('resize', ()=> Object.values(reels).forEach(r=>r && r.measure()));
    }
  };

  /* ---------------------- AUTO-INIT ---------------------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    if (document.querySelector('#cbb-root')){
      window.Brainstormer.init({
        els:{
          buttons:{ slow:'#btnSlow', spin:'#btnSpin', fast:'#btnFast', manual:'#btnManual', lock:'#btnLock' },
          reels:{
            archetype:'#reel_archetype',
            positive_trait:'#reel_positive',
            motivation:'#reel_motivation',
            fatal_flaw:'#reel_flaw',
            destiny:'#reel_destiny',
            occupation:'#reel_occupation',
            secret:'#reel_secret',
            external_conflict:'#reel_external',
            internal_conflict:'#reel_internal'
          }
        }
      });
    } else {
      status('Wrapper #cbb-root not found (not initializing).');
    }
  });

})();
