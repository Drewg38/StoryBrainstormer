/* Cool Character Brainstormer — app.js (9 reels; 3-rows; lock-to-render) */
(function () {
  'use strict';

  /* ---------------------- SWITCHES ---------------------- */
  const FORCE_INLINE = false;   // set true to skip network and use INLINE_DATA only
  const DEBUG = false;

  /* ---------------------- HELPERS ---------------------- */
  const $  = (s, el=document)=>el.querySelector(s);
  const $$ = (s, el=document)=>Array.from(el.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function log(){ if(DEBUG) console.log.apply(console, arguments); }
  function status(msg, isErr=false){ const el=$('#dataStatus'); if(!el) return; el.textContent = isErr ? msg : ''; if(DEBUG&&msg) console.log('[CBB]', msg); }

  /* ---------------------- DATA ---------------------- */
  const JSON_COMMIT = 'b739578b5774a58e8e6ef6f11cad019b9fefd6e6';
  const JSON_BASES = [
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@${JSON_COMMIT}/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/${JSON_COMMIT}/`,
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

  async function fetchJson(file){
    let lastErr;
    for(const base of JSON_BASES){
      const url = base + file;
      try{
        log('GET', url);
        const res = await fetch(url + (base.includes('jsdelivr')?'':`?t=${Date.now()}`), {mode:'cors', cache:'no-cache'});
        if(!res.ok) throw new Error('HTTP '+res.status);
        const txt = await res.text();
        const arr = JSON.parse(txt);
        if(!Array.isArray(arr)) throw new Error('JSON not array');
        return arr.map(x => typeof x==='string' ? x : (x.label || x.value || JSON.stringify(x)));
      }catch(e){ lastErr=e; }
    }
    throw lastErr || new Error('All sources failed for '+file);
  }

  /* ---------------------- SCROLL & REEL ---------------------- */
  const WHEEL_SCALE = 1.0; // make wheel behavior uniform across devices

  function buildReel(slotEl, items){
    const vp    = slotEl.querySelector('.viewport');
    const strip = slotEl.querySelector('.list.reel');
    if (!vp || !strip) return null;

    strip.innerHTML = items.map(t=>`<div class="rowitem">${esc(t)}</div>`).join('');
    const rows = Array.from(strip.querySelectorAll('.rowitem'));

    let y=0, vy=0, dragging=false, lastY=0, lastTS=0, viewH=0, totalH=0;
    const clampY = ()=>{ const min = Math.min(0, viewH-totalH); y = clamp(y, min, 0); };
    const apply  = ()=>{ strip.style.transform = `translateY(${y}px)`; markCenter(); };

    function measure(){
      viewH = vp.clientHeight;
      totalH = rows.reduce((s,n)=>s+n.offsetHeight,0);
      clampY(); apply();
    }
    function posOf(i){ let s=0; for(let k=0;k<i;k++) s+=rows[k].offsetHeight; return s; }

    function centerIndex(){
      const c = -y + viewH/2; let acc=0, best=0, bestD=1e9;
      rows.forEach((n,i)=>{ const m=acc + n.offsetHeight/2; acc+=n.offsetHeight; const d=Math.abs(m-c); if(d<bestD){bestD=d; best=i;}});
      return best;
    }
    function markCenter(){
      const best = centerIndex();
      rows.forEach((n,i)=> n.classList.toggle('center', i===best));
      api.index = best; api.value = items[best];
    }

    function tweenTo(target, ms=240, onEnd){
      const start=performance.now(), from=y, dur=Math.max(60,ms|0);
      (function frame(ts){
        const t=Math.max(0,Math.min(1,(ts-start)/dur));
        const k=1-(1-t)*(1-t);
        y = from + (target-from)*k; clampY(); apply();
        if (t<1) requestAnimationFrame(frame); else onEnd && onEnd();
      })(performance.now());
    }
    function snapTo(i, ms=240){
      i = clamp(i, 0, rows.length-1);
      const target = -(posOf(i) + rows[i].offsetHeight/2 - viewH/2);
      tweenTo(target, ms);
    }
    function fling(){
      const speed = clamp(vy*1000, -2000, 2000);
      tweenTo(y + speed*0.25, 260, ()=>snapTo(centerIndex(), 200));
    }

    // Pointer drag (consistent: dragging up moves list up)
    vp.addEventListener('pointerdown', e=>{ if(slotEl.classList.contains('locked')) return;
      dragging=true; vp.setPointerCapture(e.pointerId); lastY=e.clientY; vy=0; lastTS=performance.now(); });
    vp.addEventListener('pointermove', e=>{ if(!dragging) return;
      const now=performance.now(); const dy=e.clientY-lastY; lastY=e.clientY; y+=dy; clampY(); apply(); vy=dy/Math.max(1,(now-lastTS)); lastTS=now; });
    vp.addEventListener('pointerup',   ()=>{ dragging=false; fling(); });
    vp.addEventListener('pointercancel',()=>{ dragging=false; snapTo(centerIndex(), 200); });

    // Wheel (uniform mapping across all reels)
    vp.addEventListener('wheel', e=>{
      if(slotEl.classList.contains('locked')) return;
      e.preventDefault();
      y -= e.deltaY * WHEEL_SCALE; // wheel down -> list moves up (next items go down)
      clampY(); apply();
      clearTimeout(api._to); api._to = setTimeout(()=>snapTo(centerIndex(), 200), 120);
    }, {passive:false});

    const api = {
      value:null, index:0,
      measure, snapTo,
      random(){ snapTo(Math.floor(Math.random()*items.length), 220); }
    };
    // Initial layout
    measure(); api.random();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ measure(); snapTo(api.index,0); });

    return api;
  }

  /* ---------------------- CONCEPT (render only on lock) ---------------------- */
  function splitInternalConflict(s){
    const m = String(s||'').split(/vs\./i);
    if (m.length>=2){
      const left  = m[0].trim().replace(/[–—-]$/,'');
      const right = m.slice(1).join('vs.').trim();
      return [left.replace(/[,;.]$/,''), right.replace(/[,;.]$/,'')];
    }
    return [s||'', ''];
  }
  function oneLiner(p){
    const [A,B]=splitInternalConflict(p.internal_conflict);
    const head = (p.positive_trait && p.archetype) ? `${p.positive_trait} ${p.archetype}` : (p.archetype||'Character');
    const back = p.backstory_catalyst ? p.backstory_catalyst : (p.occupation ? `now ${p.occupation}` : '');
    const flawMot = [p.fatal_flaw && p.fatal_flaw.toLowerCase(), p.motivation && p.motivation.toLowerCase()].filter(Boolean).join(' collides with ');
    const world   = p.external_conflict ? p.external_conflict.toLowerCase() : '';
    const choice  = (A && B) ? `a choice between ${A.toLowerCase()} and ${B.toLowerCase()}` : 'a reckoning';
    return [
      `${head}${back ? `, ${back}` : ''};`,
      flawMot ? `${flawMot},` : '',
      world ? `while ${world} forces ${choice}.` : ''
    ].filter(Boolean).join(' ').replace(/\s+/g,' ').replace(/ ,/g,',');
  }
  function renderConcept(p){
    const el = $('#concept'); if(!el) return;
    const [A,B]=splitInternalConflict(p.internal_conflict);
    el.innerHTML = `
      <div>
        <p><strong>Example (rolled combo)</strong></p>
        <p><strong>Archetype:</strong> ${esc(p.archetype||'—')}</p>
        <p><strong>Positive Trait:</strong> ${esc(p.positive_trait||'—')}</p>
        <p><strong>Fatal Flaw:</strong> ${esc(p.fatal_flaw||'—')}</p>
        <p><strong>Motivation:</strong> ${esc(p.motivation||'—')}</p>
        <p><strong>Backstory Catalyst:</strong> ${esc(p.backstory_catalyst||'—')}</p>
        <p><strong>Occupation:</strong> ${esc(p.occupation||'—')}</p>
        <p><strong>Secret:</strong> ${esc(p.secret||'—')}</p>
        <p><strong>External Conflict:</strong> ${esc(p.external_conflict||'—')}</p>
        <p><strong>Internal Conflict:</strong> ${A ? esc(`${A} vs. ${B}`) : esc(p.internal_conflict||'—')}</p>
        <br/>
        <p><strong>One-liner seed:</strong></p>
        <p>${esc(oneLiner(p) || '—')}</p>
      </div>
    `;
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

      // Load data
      let data;
      try{
        if (FORCE_INLINE) throw new Error('FORCE_INLINE');
        const out={};
        for(const m of LISTS){ out[m.key]=await fetchJson(m.file); }
        data=out;
      }catch(_){
        data=INLINE_DATA;
      }

      // Build reels (don’t render concept during scrolling)
      const reels={};
      const picks={};
      for(const m of LISTS){
        const host = $(reelsSel[m.key]); if(!host) continue;
        const api = buildReel(host, (data[m.key]||[]).slice());
        if(!api) continue;
        reels[m.key]=api;
      }

      // Buttons
      const spinAll = ()=> Object.values(reels).forEach(r=>r && r.random());
      $(btns.slow )?.addEventListener('click', spinAll);
      $(btns.spin )?.addEventListener('click', spinAll);
      $(btns.fast )?.addEventListener('click', spinAll);
      $(btns.manual)?.addEventListener('click', ()=> $$('.slot.locked').forEach(s=>s.classList.remove('locked')));

      // LOCK: snap to centers and then populate concept block
      $(btns.lock )?.addEventListener('click', ()=>{
        Object.values(reels).forEach(r=>r && r.snapTo(r.index, 0));
        $$('.slot').forEach(s=>s.classList.add('locked'));
        // collect final picks from centered items only now
        for(const m of LISTS){
          const r=reels[m.key]; if(!r) continue;
          picks[m.key]=r.value;
        }
        renderConcept(picks);
      });

      // Resize
      window.addEventListener('resize', ()=> Object.values(reels).forEach(r=>r && r.measure()));
    }
  };

  /* ---------------------- AUTO-INIT ---------------------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    if (document.querySelector('#cbb-root')){
      window.Brainstormer.init({
        els:{ buttons:{ slow:'#btnSlow', spin:'#btnSpin', fast:'#btnFast', manual:'#btnManual', lock:'#btnLock' } }
      });
    } else {
      status('Wrapper #cbb-root not found', true);
    }
  });

})();
