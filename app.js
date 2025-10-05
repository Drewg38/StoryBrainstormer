/* Cool Character Brainstormer — app.js (full, self-contained)
   - 9 reels (archetype → internal_conflict)
   - Step-based spin with exactly 3 visible rows
   - Uniform scroll/drag direction across all reels
   - Concept block renders ONLY on "Stop & Lock"
   - Robust JSON loading (jsDelivr / raw.githubusercontent fallbacks)
*/
(function () {
  'use strict';

  /* ────────────────────────── helpers ────────────────────────── */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const esc = s=>String(s??'').replace(/[&<>\"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const STATUS = $('#dataStatus');
  const setStatus = (msg, isErr=true)=>{ if(STATUS) STATUS.textContent = isErr ? (msg||'') : ''; };

  // Pinned commit per your link: 812d041… is the app.js you shared earlier.
  // The JSONs you gave live at commit b739578… — we’ll pin to that to avoid “latest” drift.
  const DATA_COMMIT = 'b739578b5774a58e8e6ef6f11cad019b9fefd6e6';
  const DATA_BASES = [
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@${DATA_COMMIT}/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/${DATA_COMMIT}/`,
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@main/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/main/`,
  ];

  // Map reels → JSON files (exact names you provided)
  const LIST_SRC = [
    { id:'#reel_archetype',  key:'archetype',         file:'01_archetype_role.json' },
    { id:'#reel_positive',   key:'positive_trait',    file:'02_positive_trait.json' },
    { id:'#reel_motivation', key:'motivation',        file:'04_motivation_core_drive.json' },
    { id:'#reel_flaw',       key:'fatal_flaw',        file:'05_fatal_flaw_with_negative_traits.json' },
    { id:'#reel_destiny',    key:'destiny',           file:'06_destiny_outcome.json' },
    { id:'#reel_occupation', key:'occupation',        file:'08_occupation_social_role_WITH_reputation.json' },
    { id:'#reel_secret',     key:'secret',            file:'10_secret_hidden_truth.json' },
    { id:'#reel_external',   key:'external_conflict', file:'11_external_conflict_antagonist.json' },
    { id:'#reel_internal',   key:'internal_conflict', file:'12_internal_conflict.json' },
  ];

  function normalizeList(raw){
    // Turn raw JSON (array of strings or objects) into [{name:""}]
    if (Array.isArray(raw)) {
      return raw.map(x=>{
        if (typeof x === 'string') return { name: x };
        if (x && typeof x === 'object') {
          return { name: x.name || x.label || x.value || String(x) };
        }
        return { name: String(x) };
      });
    }
    if (raw && Array.isArray(raw.items)) {
      return raw.items.map(x=>({ name: x.name || x.label || x.value || String(x) }));
    }
    return [];
  }

  async function fetchJson(file){
    let lastErr;
    for (const base of DATA_BASES){
      const url = base + file;
      try{
        const res = await fetch(url + (base.includes('jsdelivr') ? '' : `?t=${Date.now()}`), {mode:'cors', cache:'no-cache'});
        if(!res.ok) throw new Error('HTTP '+res.status);
        const txt = await res.text();
        if (txt.trim().startsWith('<')) throw new Error('HTML instead of JSON at '+url);
        return JSON.parse(txt);
      }catch(e){ lastErr=e; }
    }
    throw lastErr || new Error('All sources failed for '+file);
  }

  // 3-row window around a center index
  function windowed(list, center, size=3){
    const half = Math.floor(size/2);
    const out=[];
    for(let i=center-half;i<=center+half;i++){
      const idx = ((i%list.length)+list.length)%list.length;
      out.push(list[idx]);
    }
    return out;
  }

  /* ────────────────────────── reel (slot) ──────────────────────────
     Original behavior: render ONLY 3 rows (the middle row is “center”)
     - step-based cycling (no long strip, no partial rows)
     - consistent wheel/touch direction across all reels
  */
  function makeReel(rootEl, items){
    const viewport = $('.viewport', rootEl) || rootEl;
    const listEl   = $('.list', rootEl);
    let idx = Math.floor(Math.random()*items.length);
    let spinning=false, raf=0, locked=false;

    function render(){
      if (!listEl) return;
      listEl.innerHTML = '';
      const rows = windowed(items, idx, 3);
      rows.forEach((e,i)=>{
        const d = document.createElement('div');
        d.className = 'rowitem' + (i===1?' center':'');
        d.textContent = e.name || String(e);
        listEl.appendChild(d);
      });
    }
    render();

    function step(dir){
      dir = dir || 1; // +1 next, -1 previous
      idx = ((idx+dir)%items.length + items.length) % items.length;
      render();
    }

    function spin(speed){
      if (locked) return;
      if (spinning) cancelAnimationFrame(raf);
      spinning = true;
      const cadence = 100 / (speed || 1.0); // smaller cadence = faster stepping
      let last = performance.now(), acc = 0;
      function tick(t){
        if (!spinning) return;
        const dt = t - last; last = t; acc += dt;
        while (acc >= cadence){ step(1); acc -= cadence; }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }
    function stop(){ spinning=false; cancelAnimationFrame(raf); }
    function lock(v){ locked = v==null ? true : !!v; rootEl.classList.toggle('locked', locked); }

    // Wheel: normalize for ALL reels: wheel down => go to NEXT item
    let accum=0;
    const STEP=120; // pixel-ish delta to step one item
    function onWheel(e){
      if (locked) return;
      e.preventDefault(); e.stopPropagation();
      if (spinning) return;
      accum += e.deltaY; // SAME SIGN for every reel
      while (accum >=  STEP){ step( 1); accum -= STEP; }
      while (accum <= -STEP){ step(-1); accum += STEP; }
    }
    viewport.addEventListener('wheel', onWheel, {passive:false});

    // Touch → wheel bridge (keeps direction consistent on phones)
    (function(){
      let y0=null, acc=0;
      viewport.addEventListener('touchstart', e=>{ if(locked) return; y0=e.touches[0].clientY; acc=0; }, {passive:true});
      viewport.addEventListener('touchmove',  e=>{
        if (locked || y0==null) return;
        e.preventDefault();
        const y=e.touches[0].clientY, dy=y-y0; y0=y; acc+=dy;
        const chunk=16;
        while (acc >=  chunk){ onWheel({deltaY: chunk, preventDefault:()=>{}, stopPropagation:()=>{}}); acc-=chunk; }
        while (acc <= -chunk){ onWheel({deltaY:-chunk, preventDefault:()=>{}, stopPropagation:()=>{}}); acc+=chunk; }
      }, {passive:false});
      viewport.addEventListener('touchend',   ()=>{ y0=null; acc=0; }, {passive:true});
      viewport.addEventListener('touchcancel',()=>{ y0=null; acc=0; }, {passive:true});
    })();

    return {
      get value(){ return items[idx]; },
      setItems(arr){ if(arr && arr.length){ items=arr; idx=Math.min(idx, items.length-1); render(); } },
      render, step, spin, stop, lock
    };
  }

  /* ───────────────────── concept rendering ───────────────────── */
  function splitVs(s){
    const parts = String(s||'').split(/vs\./i);
    if (parts.length >= 2){
      return [parts[0].trim().replace(/[–—-]$/,''), parts.slice(1).join('vs.').trim()];
    }
    return [s||'', ''];
  }

  function oneLiner(p){
    const [A,B] = splitVs(p.internal_conflict);
    const head = (p.positive_trait && p.archetype)
      ? `${p.positive_trait} ${p.archetype}`
      : (p.archetype || 'Character');
    const back = p.backstory_catalyst
      ? p.backstory_catalyst
      : (p.occupation ? `now ${p.occupation}` : '');
    const flawMot = [p.fatal_flaw && p.fatal_flaw.toLowerCase(),
                     p.motivation && p.motivation.toLowerCase()]
                    .filter(Boolean).join(' collides with ');
    const world = p.external_conflict ? p.external_conflict.toLowerCase() : '';
    const choice = (A && B) ? `a choice between ${A.toLowerCase()} and ${B.toLowerCase()}` : 'a reckoning';
    return [
      `${head}${back ? `, ${back}` : ''};`,
      flawMot ? `${flawMot},` : '',
      world ? `while ${world} forces ${choice}.` : ''
    ].filter(Boolean).join(' ').replace(/\s+/g,' ').replace(/ ,/g,',');
  }

  function renderConcept(picks){
    const el = $('#concept'); if(!el) return;
    const [A,B] = splitVs(picks.internal_conflict);
    el.innerHTML = `
      <div>
        <p><strong>Example (rolled combo)</strong></p>
        <p><strong>Archetype:</strong> ${esc(picks.archetype||'—')}</p>
        <p><strong>Positive Trait:</strong> ${esc(picks.positive_trait||'—')}</p>
        <p><strong>Fatal Flaw:</strong> ${esc(picks.fatal_flaw||'—')}</p>
        <p><strong>Motivation:</strong> ${esc(picks.motivation||'—')}</p>
        <p><strong>Backstory Catalyst:</strong> ${esc(picks.backstory_catalyst||'—')}</p>
        <p><strong>Occupation:</strong> ${esc(picks.occupation||'—')}</p>
        <p><strong>Secret:</strong> ${esc(picks.secret||'—')}</p>
        <p><strong>External Conflict:</strong> ${esc(picks.external_conflict||'—')}</p>
        <p><strong>Internal Conflict:</strong> ${A ? esc(`${A} vs. ${B}`) : esc(picks.internal_conflict||'—')}</p>
        <br/>
        <p><strong>One-liner seed:</strong></p>
        <p>${esc(oneLiner(picks) || '—')}</p>
      </div>
    `;
  }

  /* ───────────────────────── bootstrap ───────────────────────── */
  async function loadAllLists(){
    const data = {};
    for (const m of LIST_SRC){
      const raw = await fetchJson(m.file);
      data[m.key] = normalizeList(raw);
    }
    return data;
  }

  function wireButtons(reels){
    const speeds = { slow:0.9, spin:1.4, fast:2.2 };
    const btnSlow   = $('#btnSlow');
    const btnSpin   = $('#btnSpin');
    const btnFast   = $('#btnFast');
    const btnManual = $('#btnManual');
    const btnLock   = $('#btnLock');

    const stopAll   = ()=> Object.values(reels).forEach(r=>r.stop());
    const unlockAll = ()=>{
      $$('.slot').forEach(s=>s.classList.remove('locked'));
      Object.values(reels).forEach(r=>r.lock(false));
    };
    const lockAll   = ()=>{
      $$('.slot').forEach(s=>s.classList.add('locked'));
      Object.values(reels).forEach(r=>r.lock(true));
    };

    btnSlow  && (btnSlow.onclick  = ()=>{ unlockAll(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.slow)); });
    btnSpin  && (btnSpin.onclick  = ()=>{ unlockAll(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.spin)); });
    btnFast  && (btnFast.onclick  = ()=>{ unlockAll(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.fast)); });
    btnManual&& (btnManual.onclick= ()=>{ stopAll(); unlockAll(); });

    btnLock  && (btnLock.onclick  = ()=>{
      stopAll(); lockAll();
      // Gather centered values and render concept
      const picks = {};
      for (const m of LIST_SRC){
        const r = reels[m.key];
        picks[m.key] = r?.value?.name || r?.value || '';
      }
      // Optional: if you later add a "backstory_catalyst" reel, merge here.
      renderConcept(picks);
      setStatus('', false); // clear any previous error
    });
  }

  async function start(){
    try{
      const lists = await loadAllLists();
      const reels = {};
      LIST_SRC.forEach(m=>{
        const host = $(m.id);
        if (!host) return;
        const arr = lists[m.key] || [];
        reels[m.key] = makeReel(host, arr);
      });
      wireButtons(reels);
      // No “lists loaded” message; we stay quiet on success.
    }catch(e){
      console.error(e);
      setStatus('⚠️ Could not load lists (network/CORS/JSON).');
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
