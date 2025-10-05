/* Cool Character Brainstormer — app.js (9 reels, compact, formatted concept) */
(function () {
  'use strict';

  /* ---------------------- SWITCHES ---------------------- */
  const FORCE_INLINE = false; // set true to skip network and use INLINE_DATA only
  const DEBUG = false;        // set true to see console logs

  /* ---------------------- HELPERS ---------------------- */
  const $  = (s, el=document)=>el.querySelector(s);
  const $$ = (s, el=document)=>Array.from(el.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function status(msg, isErr=false){
    const el = $('#dataStatus');
    if (!el) return;
    // Only show real errors now; suppress noisy "Loaded..." lines
    el.textContent = isErr ? (msg || '') : '';
    if (DEBUG && msg) console.log('[CBB]', msg);
  }

  /* ---------------------- DATA SOURCES ---------------------- */
  // Your JSON commit from earlier; we also fall back to main
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
  async function fetchJson(file){
    let lastErr;
    for(const base of JSON_BASES){
      const url = base + file;
      try{
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

  async function loadAllLists(){
    const out = {};
    for(const m of LISTS){ out[m.key] = await fetchJson(m.file); }
    return out;
  }

  /* ---------------------- TOUCH→WHEEL BRIDGE ---------------------- */
  function installTouchWheelBridge(selector,{scale=2.4,threshold=0.8}={}){
    const els=document.querySelectorAll(selector);
    els.forEach(el=>{
      let y0=null, acc=0; const slot=el.closest('.slot');
      el.addEventListener('touchstart', e=>{ if(slot?.classList.contains('locked')) return; y0=e.touches[0].clientY; acc=0; }, {passive:true});
      el.addEventListener('touchmove',  e=>{
        if(slot?.classList.contains('locked')) return;
        if(y0==null) return; e.preventDefault();
        const y=e.touches[0].clientY, dy=y-y0; acc+=dy; y0=y;
        const step=threshold*10;
        if(Math.abs(acc)>=step){
          const delta=-acc*scale; acc=0;
          const wheel=new WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true});
          el.dispatchEvent(wheel);
        }
      }, {passive:false});
      el.addEventListener('touchend',   ()=>{ y0=null; acc=0; }, {passive:true});
      el.addEventListener('touchcancel',()=>{ y0=null; acc=0; }, {passive:true});
    });
  }

  /* ---------------------- REELS ---------------------- */
  function buildReel(slotEl, items, opts){
    const vp=slotEl.querySelector('.viewport'); const strip=slotEl.querySelector('.list.reel'); if(!vp||!strip) return null;

    strip.innerHTML = items.map(t=>`<div class="rowitem">${esc(t)}</div>`).join('');
    const rows = Array.from(strip.querySelectorAll('.rowitem'));

    let y=0, vy=0, dragging=false, lastY=0, lastTS=0, viewH=0, totalH=0;
    const clampY=()=>{ const min=Math.min(0, viewH-totalH); y=clamp(y,min,0); };
    const apply =()=>{ strip.style.transform=`translateY(${y}px)`; markCenter(); };

    function measure(){ viewH=vp.clientHeight; totalH=rows.reduce((s,n)=>s+n.offsetHeight,0); clampY(); apply(); }
    function posOf(i){ let s=0; for(let k=0;k<i;k++) s+=rows[k].offsetHeight; return s; }

    function markCenter(){
      const c=-y+viewH/2; let acc=0,best=0,bestD=1e9;
      rows.forEach((n,i)=>{ const m=acc+n.offsetHeight/2; acc+=n.offsetHeight; const d=Math.abs(m-c); if(d<bestD){bestD=d;best=i;} n.classList.toggle('center', i===best); });
      api.index=best; api.value=items[best]; api.onPick&&api.onPick(api.value);
    }

    function tweenTo(target,ms=260,onEnd){
      const start=performance.now(), from=y, dur=Math.max(60,ms|0);
      (function frame(ts){
        const t=Math.max(0,Math.min(1,(ts-start)/dur));
        const k=1-(1-t)*(1-t);
        y = from + (target-from)*k; clampY(); apply();
        if (t<1) requestAnimationFrame(frame); else onEnd&&onEnd();
      })(performance.now());
    }

    function snapTo(i,ms=opts.fast?160:280){
      i=clamp(i,0,rows.length-1);
      const target=-(posOf(i)+rows[i].offsetHeight/2 - viewH/2);
      tweenTo(target,ms);
    }

    function fling(){
      const speed=clamp(vy*1000,-2000,2000);
      tweenTo(y + speed*0.25, opts.fast?220:380, ()=>snapTo(api.index));
    }

    // interactions
    vp.addEventListener('pointerdown', e=>{ if(slotEl.classList.contains('locked')) return; dragging=true; vp.setPointerCapture(e.pointerId); lastY=e.clientY; vy=0; lastTS=performance.now(); });
    vp.addEventListener('pointermove', e=>{ if(!dragging) return; const now=performance.now(); const dy=e.clientY-lastY; lastY=e.clientY; y+=dy; clampY(); apply(); vy=dy/Math.max(1,(now-lastTS)); lastTS=now; });
    vp.addEventListener('pointerup',   ()=>{ dragging=false; fling(); });
    vp.addEventListener('pointercancel',()=>{ dragging=false; snapTo(api.index); });

    vp.addEventListener('wheel', e=>{
      if(slotEl.classList.contains('locked')) return;
      e.preventDefault();
      y -= Math.sign(e.deltaY)*40;
      clampY(); apply();
      clearTimeout(api._to);
      api._to=setTimeout(()=>snapTo(api.index),140);
    }, {passive:false});

    const api={value:null,index:0,onPick:null,measure,snapTo,random(){ snapTo(Math.floor(Math.random()*items.length)); }};
    measure(); api.random();
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ measure(); snapTo(api.index,0); });
    return api;
  }

  /* ---------------------- CONCEPT (exact format) ---------------------- */
  function splitInternalConflict(s){
    // try to split "Justice vs. Mercy" into ["Justice","Mercy"]
    const m = String(s||'').split(/vs\./i);
    if (m.length>=2){
      const left  = m[0].trim().replace(/[–—-]$/,'');
      const right = m.slice(1).join('vs.').trim();
      return [left.replace(/[,;.]$/,''), right.replace(/[,;.]$/,'')];
    }
    return [s||'', ''];
  }

  function buildOneLiner(p){
    const [icA, icB] = splitInternalConflict(p.internal_conflict);
    const parts = [];
    if (p.positive_trait && p.archetype){
      parts.push(`${p.positive_trait} ${p.archetype}`); // "Resourceful Healer"
    } else if (p.archetype){
      parts.push(`${p.archetype}`);
    }
    if (p.backstory_catalyst){ // not provided by lists; keep optional hook
      parts.push(p.backstory_catalyst);
    }
    // If no explicit backstory, we lightly infer a clause from occupation
    const backClause = p.backstory_catalyst ? '' :
      (p.occupation ? `now ${p.occupation}` : '');
    const first = parts.join(', ');
    const flawMotiv = (p.fatal_flaw || p.motivation)
      ? `${p.fatal_flaw ? p.fatal_flaw.toLowerCase() : ''}${p.fatal_flaw && p.motivation ? ' collides with ' : ''}${p.motivation ? p.motivation.toLowerCase() : ''}`
      : '';
    const worldPress = p.external_conflict ? p.external_conflict.toLowerCase() : '';
    const choice = (icA && icB) ? `a choice between ${icA.toLowerCase()} and ${icB.toLowerCase()}` : '';

    return [
      first ? `${first}${backClause ? `, ${backClause}` : ''};` : '',
      flawMotiv ? `${flawMotiv},` : '',
      worldPress ? `while ${worldPress} forces ${choice || 'a reckoning'}.` : ''
    ].filter(Boolean).join(' ')
     .replace(/\s+/g,' ')
     .replace(/ ,/g,',');
  }

  function renderConcept(p){
    const el = $('#concept'); if(!el) return;
    const [icA, icB] = splitInternalConflict(p.internal_conflict);
    const line = buildOneLiner(p);
    const safe = k => esc(p[k] || '—');

    el.innerHTML = `
      <div>
        <p><strong>Example (rolled combo)</strong></p>
        <p><strong>Archetype:</strong> ${safe('archetype')}</p>
        <p><strong>Positive Trait:</strong> ${safe('positive_trait')}</p>
        <p><strong>Fatal Flaw:</strong> ${safe('fatal_flaw')}</p>
        <p><strong>Motivation:</strong> ${safe('motivation')}</p>
        <p><strong>Backstory Catalyst:</strong> ${esc(p.backstory_catalyst || '—')}</p>
        <p><strong>Occupation:</strong> ${safe('occupation')}</p>
        <p><strong>Secret:</strong> ${safe('secret')}</p>
        <p><strong>External Conflict:</strong> ${safe('external_conflict')}</p>
        <p><strong>Internal Conflict:</strong> ${icA ? esc(`${icA} vs. ${icB}`) : safe('internal_conflict')}</p>
        <br/>
        <p><strong>One-liner seed:</strong></p>
        <p>${esc(line || '—')}</p>
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
      const picks = {};
      const reels = {};

      // Load data
      let data;
      try{
        if (FORCE_INLINE) throw new Error('FORCE_INLINE');
        data = await loadAllLists();
      }catch(_){
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

      // Touch bridge (all nine viewports)
      installTouchWheelBridge(
        [
          '#reel_archetype .viewport',
          '#reel_positive .viewport',
          '#reel_motivation .viewport',
          '#reel_flaw .viewport',
          '#reel_destiny .viewport',
          '#reel_occupation .viewport',
          '#reel_secret .viewport',
          '#reel_external .viewport',
          '#reel_internal .viewport'
        ].join(','),
        {scale:2.4, threshold:0.8}
      );

      renderConcept(picks);
      window.addEventListener('resize', ()=> Object.values(reels).forEach(r=>r && r.measure()));
    }
  };

  /* ---------------------- AUTO-INIT ---------------------- */
  document.addEventListener('DOMContentLoaded', ()=>{
    if (document.querySelector('#cbb-root')){
      window.Brainstormer.init({
        els:{
          buttons:{ slow:'#btnSlow', spin:'#btnSpin', fast:'#btnFast', manual:'#btnManual', lock:'#btnLock' }
        }
      });
    } else {
      status('Wrapper #cbb-root not found', true);
    }
  });

})();
