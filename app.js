/* Cool Character Brainstormer — app.js (final harden)
   Goals:
   - 3-row, step-based reels, uniform direction
   - Concept card fills ONLY on Stop & Lock
   - 9 lists fetched from pinned StoryBrainstormer commit
   - Fallback inline data so reels always populate (even if JSON fails)
*/
(function(){
  'use strict';

  /* ================== tiny helpers ================== */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const STATUS = $('#dataStatus');
  const setStatus = (msg) => { if (STATUS) STATUS.textContent = msg || ''; };

  // Force one global direction rule: positive delta => NEXT
  const FORCE_DIR = +1; // keep at +1 (down/drag-down -> next). Flip to -1 if you ever want the opposite globally.

  /* ========== Data sources (your commit) + fallback ========== */
  const DATA_COMMIT = 'b739578b5774a58e8e6ef6f11cad019b9fefd6e6';
  const BASES = [
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@${DATA_COMMIT}/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/${DATA_COMMIT}/`,
  ];

  const MAP = [
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

  // Minimal fallback samples so reels show something even if network fails
  const FALLBACK = {
    archetype:['Healer','Rebel','Scholar','Scout'].map(name=>({name})),
    positive_trait:['Resourceful','Loyal','Clever','Brave'].map(name=>({name})),
    motivation:['Redemption','Discovery','Freedom','Belonging'].map(name=>({name})),
    fatal_flaw:['Obsession','Pride','Fear','Impulsiveness'].map(name=>({name})),
    destiny:['Triumph','Tragedy','Transformation','Exile'].map(name=>({name})),
    occupation:['Smuggler-medic','Archivist','Caravan guard','Street preacher'].map(name=>({name})),
    secret:['Forged miracle','Hidden lineage','Double agent','Buried crime'].map(name=>({name})),
    external_conflict:['Inquisition','Gang war','Famine','Occupation'].map(name=>({name})),
    internal_conflict:['Justice vs. Mercy','Duty vs. Desire','Faith vs. Doubt','Self vs. Family'].map(name=>({name})),
  };

  function normalizeList(raw){
    if (Array.isArray(raw)) {
      return raw.map(x=>{
        if (typeof x === 'string') return { name:x };
        if (x && typeof x === 'object') return { name: x.name || x.label || x.value || String(x) };
        return { name:String(x) };
      });
    }
    if (raw && Array.isArray(raw.items)) {
      return raw.items.map(x=>({ name:x.name || x.label || x.value || String(x) }));
    }
    return [];
  }

  function fetchWithTimeout(url, ms){
    return new Promise((resolve, reject)=>{
      const t = setTimeout(()=>reject(new Error('timeout')), ms);
      fetch(url, {mode:'cors', cache:'no-cache'})
        .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
        .then(txt=>{
          clearTimeout(t);
          if (txt.trim().startsWith('<')) throw new Error('HTML not JSON');
          resolve(JSON.parse(txt));
        })
        .catch(err=>{ clearTimeout(t); reject(err); });
    });
  }

  async function getJSON(file){
    for (const b of BASES){
      try{
        const url = b + file;
        const json = await fetchWithTimeout(url, 6000);
        return json;
      }catch(_e){}
    }
    throw new Error('all sources failed for '+file);
  }

  function windowed(list, center, size=3){
    const half = Math.floor(size/2), out=[];
    for (let i=center-half;i<=center+half;i++){
      const idx = ((i%list.length)+list.length)%list.length;
      out.push(list[idx]);
    }
    return out;
  }

  /* ================== Reel (3-row, step) ================== */
  function makeReel(rootEl, items){
    const viewport = rootEl.querySelector('.viewport') || rootEl;
    const listEl   = rootEl.querySelector('.list');
    let idx = Math.floor(Math.random() * (items.length || 1));
    let spinning=false, raf=0, locked=false;

    function render(){
      if (!listEl) return;
      listEl.innerHTML = '';
      const rows = windowed(items, idx, 3);
      rows.forEach((e,i)=>{
        const d = document.createElement('div');
        d.className = 'rowitem' + (i===1?' center':'');
        d.textContent = e?.name ?? String(e ?? '');
        listEl.appendChild(d);
      });
    }
    render();

    function step(dir=+1){
      dir = dir >= 0 ? +1 : -1;
      // Force consistent global mapping:
      dir = dir * FORCE_DIR;
      idx = ((idx + dir) % items.length + items.length) % items.length;
      render();
    }

    function spin(speed=1.0){
      if (locked) return;
      if (spinning) cancelAnimationFrame(raf);
      spinning = true;
      const cadence = 100 / speed;
      let last = performance.now(), acc = 0;
      function tick(t){
        if (!spinning) return;
        const dt = t - last; last = t; acc += dt;
        while (acc >= cadence){ step(+1); acc -= cadence; }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }
    function stop(){ spinning=false; cancelAnimationFrame(raf); }
    function lock(v){ locked = (v==null) ? true : !!v; rootEl.classList.toggle('locked', locked); }

    // Uniform wheel (down => next)
    let accum=0; const STEP=120;
    function onWheel(e){
      if (locked) return;
      e.preventDefault(); e.stopPropagation();
      if (spinning) return;
      accum += e.deltaY;                 // SAME for all reels
      while (accum >=  STEP){ step(+1); accum -= STEP; }
      while (accum <= -STEP){ step(-1); accum += STEP; }
    }
    viewport.addEventListener('wheel', onWheel, {passive:false});

    // Touch → wheel bridge (keeps same mapping)
    (function(){
      let y0=null, acc=0;
      viewport.addEventListener('touchstart', e=>{ if(locked) return; y0=e.touches[0].clientY; acc=0; }, {passive:true});
      viewport.addEventListener('touchmove',  e=>{
        if (locked || y0==null) return;
        e.preventDefault();
        const y=e.touches[0].clientY, dy=y-y0; y0=y; acc+=dy;
        const CHUNK=16;
        while (acc >=  CHUNK){ onWheel({deltaY:+CHUNK, preventDefault:()=>{}, stopPropagation:()=>{}}); acc-=CHUNK; }
        while (acc <= -CHUNK){ onWheel({deltaY:-CHUNK, preventDefault:()=>{}, stopPropagation:()=>{}}); acc+=CHUNK; }
      }, {passive:false});
      viewport.addEventListener('touchend',   ()=>{ y0=null; acc=0; }, {passive:true});
      viewport.addEventListener('touchcancel',()=>{ y0=null; acc=0; }, {passive:true});
    })();

    return {
      get value(){ return items[idx]; },
      setItems(arr){ if(arr && arr.length){ items=arr; idx=Math.min(idx,items.length-1); render(); } },
      render, step, spin, stop, lock
    };
  }

  /* ================== Concept render ================== */
  function splitVs(s){
    const parts = String(s || '').split(/vs\./i);
    if (parts.length >= 2) return [parts[0].trim(), parts.slice(1).join('vs.').trim()];
    return [s || '', ''];
  }
  function oneLinerSeed(p){
    const [A,B] = splitVs(p.internal_conflict);
    const head = (p.positive_trait && p.archetype)
      ? `${p.positive_trait} ${p.archetype}` : (p.archetype || 'Character');
    const back = p.backstory_catalyst ? p.backstory_catalyst : (p.occupation ? `now ${p.occupation}` : '');
    const flawMot = [p.fatal_flaw && p.fatal_flaw.toLowerCase(), p.motivation && p.motivation.toLowerCase()]
                    .filter(Boolean).join(' collides with ');
    const world = p.external_conflict ? p.external_conflict.toLowerCase() : '';
    const choice = (A && B) ? `a choice between ${A.toLowerCase()} and ${B.toLowerCase()}` : 'a reckoning';
    return [
      `${head}${back ? `, ${back}` : ''};`,
      flawMot ? `${flawMot},` : '',
      world ? `while ${world} forces ${choice}.` : ''
    ].filter(Boolean).join(' ').replace(/\s+/g,' ').replace(/ ,/g,',');
  }
  function renderConcept(p){
    const el = $('#concept'); if (!el) return;
    const [A,B] = splitVs(p.internal_conflict);
    el.innerHTML = `
      <div>
        <p><strong>Example (rolled combo)</strong></p>
        <p><strong>Archetype:</strong> ${esc(p.archetype || '—')}</p>
        <p><strong>Positive Trait:</strong> ${esc(p.positive_trait || '—')}</p>
        <p><strong>Fatal Flaw:</strong> ${esc(p.fatal_flaw || '—')}</p>
        <p><strong>Motivation:</strong> ${esc(p.motivation || '—')}</p>
        <p><strong>Backstory Catalyst:</strong> ${esc(p.backstory_catalyst || '—')}</p>
        <p><strong>Occupation:</strong> ${esc(p.occupation || '—')}</p>
        <p><strong>Secret:</strong> ${esc(p.secret || '—')}</p>
        <p><strong>External Conflict:</strong> ${esc(p.external_conflict || '—')}</p>
        <p><strong>Internal Conflict:</strong> ${A ? esc(`${A} vs. ${B}`) : esc(p.internal_conflict || '—')}</p>
        <br/>
        <p><strong>One-liner seed:</strong></p>
        <p>${esc(oneLinerSeed(p) || '—')}</p>
      </div>`;
  }

  /* ================== Bootstrap ================== */
  async function loadAll(){
    const out = {};
    for (const m of MAP){
      try{
        const json = await getJSON(m.file);
        out[m.key] = normalizeList(json);
        if (!out[m.key].length) throw new Error('empty list');
      }catch(_e){
        // fall back to tiny local sample
        out[m.key] = FALLBACK[m.key] || [{name:'—'}];
      }
    }
    return out;
  }

  function wireButtons(reels){
    const speeds = { slow:0.9, spin:1.4, fast:2.2 };
    const btnSlow   = $('#btnSlow');
    const btnSpin   = $('#btnSpin');
    const btnFast   = $('#btnFast');
    const btnManual = $('#btnManual');
    const btnLock   = $('#btnLock');

    const stopAll = ()=> Object.values(reels).forEach(r=>r.stop());
    const unlock = ()=>{
      $$('.slot').forEach(s=>s.classList.remove('locked'));
      Object.values(reels).forEach(r=>r.lock(false));
    };
    const lockAll = ()=>{
      $$('.slot').forEach(s=>s.classList.add('locked'));
      Object.values(reels).forEach(r=>r.lock(true));
    };

    btnSlow  && (btnSlow.onclick  = ()=>{ unlock(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.slow)); });
    btnSpin  && (btnSpin.onclick  = ()=>{ unlock(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.spin)); });
    btnFast  && (btnFast.onclick  = ()=>{ unlock(); stopAll(); Object.values(reels).forEach(r=>r.spin(speeds.fast)); });
    btnManual&& (btnManual.onclick= ()=>{ stopAll(); unlock(); });

    btnLock  && (btnLock.onclick  = ()=>{
      stopAll(); lockAll();
      const picks = {};
      MAP.forEach(m=>{
        const r = reels[m.key];
        picks[m.key] = r?.value?.name || r?.value || '';
      });
      renderConcept(picks);
      setStatus('');
    });
  }

  async function start(){
    try{
      const lists = await loadAll();

      // Build 9 reels
      const reels = {};
      MAP.forEach(m=>{
        const host = $(m.id);
        if (!host) return;
        const arr = lists[m.key] || [];
        reels[m.key] = makeReel(host, arr);
      });

      wireButtons(reels);
      setStatus(''); // stay quiet on success
    }catch(e){
      console.error(e);
      setStatus('⚠️ Could not initialize.');
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
