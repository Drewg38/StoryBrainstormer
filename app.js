// Cool Character Brainstormer — app.js (original step reels; 9 categories)
(function(){
  'use strict';

  /* ================= Helpers ================ */
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
  const esc = s=>String(s||'').replace(/[&<>\"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const statusEl = $('#dataStatus');
  const setStatus = (t,err)=>{ if(statusEl) statusEl.textContent = err ? t : ''; };

  // Use your pinned data commit (falls back to main)
  const DATA_COMMIT = 'b739578b5774a58e8e6ef6f11cad019b9fefd6e6';
  const BASES = [
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@${DATA_COMMIT}/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/${DATA_COMMIT}/`,
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@main/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/main/`
  ];

  const MAP = [
    {id:'#reel_archetype',  key:'archetype',         file:'01_archetype_role.json'},
    {id:'#reel_positive',   key:'positive_trait',    file:'02_positive_trait.json'},
    {id:'#reel_motivation', key:'motivation',        file:'04_motivation_core_drive.json'},
    {id:'#reel_flaw',       key:'fatal_flaw',        file:'05_fatal_flaw_with_negative_traits.json'},
    {id:'#reel_destiny',    key:'destiny',           file:'06_destiny_outcome.json'},
    {id:'#reel_occupation', key:'occupation',        file:'08_occupation_social_role_WITH_reputation.json'},
    {id:'#reel_secret',     key:'secret',            file:'10_secret_hidden_truth.json'},
    {id:'#reel_external',   key:'external_conflict', file:'11_external_conflict_antagonist.json'},
    {id:'#reel_internal',   key:'internal_conflict', file:'12_internal_conflict.json'},
  ];

  function asList(raw){
    // normalize to [{name:""}]
    if (Array.isArray(raw)) return raw.map(x=>({name: typeof x==='string'? x : (x.label||x.value||String(x))}));
    if (raw && Array.isArray(raw.items)) return raw.items.map(x=>({name: typeof x==='string'? x : (x.name||x.label||x.value||String(x))}));
    return [];
  }

  async function getJSON(file){
    let lastErr;
    for(const b of BASES){
      const url = b+file;
      try{
        const res = await fetch(url+(b.includes('jsdelivr')?'':`?t=${Date.now()}`), {mode:'cors',cache:'no-cache'});
        if(!res.ok) throw new Error('HTTP '+res.status);
        const txt = await res.text();
        if (txt.trim().startsWith('<')) throw new Error('HTML not JSON');
        return JSON.parse(txt);
      }catch(e){ lastErr=e; }
    }
    throw lastErr || new Error('All sources failed for '+file);
  }

  function windowed(list, center, size=3){
    const half = Math.floor(size/2), out=[];
    for(let i=center-half;i<=center+half;i++){
      const idx = ((i%list.length)+list.length)%list.length;
      out.push(list[idx]);
    }
    return out;
  }

  /* ============ Reel component (original step-based) ============ */
  function makeReel(rootEl, items){
    const viewport = $('.viewport', rootEl) || rootEl;
    const listEl = $('.list', rootEl);
    let idx = Math.floor(Math.random()*items.length);
    let spinning=false, raf=0, locked=false;

    function render(){
      if(!listEl) return;
      listEl.innerHTML = '';
      const rows = windowed(items, idx, 3);
      rows.forEach((e,i)=>{
        const d=document.createElement('div');
        d.className='rowitem'+(i===1?' center':'');
        d.textContent = e.name || String(e);
        listEl.appendChild(d);
      });
    }
    render();

    function step(dir){ dir=dir||1; idx=((idx+dir)%items.length+items.length)%items.length; render(); }

    function spin(speed){ // speed: 0.8..2.2
      if (locked) return;
      if (spinning) cancelAnimationFrame(raf);
      spinning = true;
      const cadence = 100 / (speed||1.0);
      let last=performance.now(), acc=0;
      function tick(now){
        if (!spinning) return;
        const dt = now-last; last=now; acc+=dt;
        while(acc>=cadence){ step(1); acc-=cadence; }
        raf = requestAnimationFrame(tick);
      }
      raf=requestAnimationFrame(tick);
    }
    function stop(){ spinning=false; cancelAnimationFrame(raf); }
    function lock(v){ locked = v==null ? true : !!v; rootEl.classList.toggle('locked', locked); }

    // Wheel: consistent direction everywhere
    let accum=0; const STEP=120;
    function onWheel(e){
      if (locked) return;
      e.preventDefault(); e.stopPropagation();
      if (spinning) return;
      accum += e.deltaY;
      while (accum >=  STEP){ step( 1); accum -= STEP; }
      while (accum <= -STEP){ step(-1); accum += STEP; }
    }
    viewport.addEventListener('wheel', onWheel, {passive:false});

    // Touch → wheel bridge for phones
    (function(){
      let y0=null, acc=0;
      viewport.addEventListener('touchstart', e=>{ if(locked) return; y0=e.touches[0].clientY; acc=0; }, {passive:true});
      viewport.addEventListener('touchmove',  e=>{
        if(locked||y0==null) return;
        e.preventDefault();
        const y=e.touches[0].clientY, dy=y-y0; y0=y; acc+=dy;
        const chunk=16; // smaller = smoother
        while (acc >=  chunk){ onWheel({deltaY: chunk, preventDefault:()=>{}, stopPropagation:()=>{}}); acc-=chunk; }
        while (acc <= -chunk){ onWheel({deltaY:-chunk, preventDefault:()=>{}, stopPropagation:()=>{}}); acc+=chunk; }
      }, {passive:false});
      viewport.addEventListener('touchend',   ()=>{ y0=null; acc=0; }, {passive:true});
      viewport.addEventListener('touchcancel',()=>{ y0=null; acc=0; }, {passive:true});
    })();

    return {
      get value(){ return items[idx]; },
      setItems(arr){ if(arr&&arr.length){ items=arr; idx=Math.min(idx,items.length-1); render(); } },
      render, spin, stop, lock
    };
  }

  /* ============ Concept rendering (only on Lock) ============ */
  function splitVs(s){
    const m=String(s||'').split(/vs\./i);
    if(m.length>=2){ return [m[0].trim(), m.slice(1).join('vs.').trim()]; }
    return [s||'', ''];
  }
  function oneLiner(p){
    const [A,B]=splitVs(p.internal_conflict);
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
    const [A,B]=splitVs(p.internal_conflict);
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
        <p>${esc(oneLiner(p)||'—')}</p>
      </div>`;
  }

  /* ============ Bootstrap (9 reels) ============ */
  async function loadAll(){
    const out={};
    for(const m of MAP){ out[m.key] = asList(await getJSON(m.file)); }
    return out;
  }

  function initButtons(reels, picks){
    const speeds = { slow:0.9, spin:1.4, fast:2.2 };
    const slow   = $('#btnSlow');
    const spin   = $('#btnSpin');
    const fast   = $('#btnFast');
    const manual = $('#btnManual');
    const lock   = $('#btnLock');

    function stopAll(){ Object.values(reels).forEach(r=>r.stop()); }
    function unlock(){ $$('.slot').forEach(s=>s.classList.remove('locked')); Object.values(reels).forEach(r=>r.lock(false)); }
    function lockAll(){ $$('.slot').forEach(s=>s.classList.add('locked')); Object.values(reels).forEach(r=>r.lock(true)); }

    slow  && (slow.onclick  = ()=>{ unlock(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.slow)); });
    spin  && (spin.onclick  = ()=>{ unlock(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.spin)); });
    fast  && (fast.onclick  = ()=>{ unlock(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.fast)); });
    manual&& (manual.onclick= ()=>{ stopAll(); unlock(); });

    lock  && (lock.onclick  = ()=>{
      stopAll(); lockAll();
      // harvest centered values
      for(const k in reels){ picks[k] = reels[k].value?.name || reels[k].value || ''; }
      renderConcept(picks);
      setStatus('');
    });
  }

  async function bootstrap(){
    try{
      const data = await loadAll();           // fetch 9 JSON lists
      const reels = {};
      const picks = {};
      // mount reels
      MAP.forEach(m=>{
        const host = $(m.id);
        if (!host) return;
        const arr = data[m.key] || [];
        reels[m.key] = makeReel(host, arr);
      });
      initButtons(reels, picks);
      // initial concept blank; will render on lock
    }catch(e){
      console.error(e);
      setStatus('⚠️ Could not load lists (CORS/JSON).', true);
    }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
