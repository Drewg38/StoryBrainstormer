/* Cool Character Brainstormer — 9 reels (diagnostic build)
   - Populates 9 reels from JSON in Drewg38/StoryBrainstormer
   - Falls back across jsDelivr + raw.githubusercontent.com, pinned commit + main
   - Self-inits on DOMContentLoaded
   - Writes detailed status to #dataStatus and console
*/

(function () {
  'use strict';

  const DEBUG = true;

  // ===== STATUS UI =====
  function $(s, el=document){ return el.querySelector(s); }
  function $$(s, el=document){ return Array.from(el.querySelectorAll(s)); }
  function say(msg){ const el = $('#dataStatus'); if (el) el.textContent = msg || ''; if (DEBUG) console.log('[CBB]', msg); }
  function warn(msg){ const el = $('#dataStatus'); if (el) el.textContent = '⚠ ' + msg; console.warn('[CBB]', msg); }

  // Show a tiny “JS loaded” banner so we know the file executed
  function markLoaded(){
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;z-index:99999;bottom:6px;right:10px;font:12px/1.3 system-ui;padding:4px 8px;border-radius:6px;background:#0e223f;color:#a9d1ff;opacity:.9';
    el.textContent = 'app.js ✓';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2000);
  }

  // ===== DATA SOURCES =====
  const PINNED = 'b739578b5774a58e8e6ef6f11cad019b9fefd6e6'; // commit with JSON files
  const RAW_BASES = [
    // Prefer jsDelivr (fast, CORS-friendly), then raw GH. Pinned first, then main.
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@${PINNED}/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/${PINNED}/`,
    `https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@main/`,
    `https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/main/`
  ];

  const LISTS = [
    { key: 'archetype',         title: 'Archetype / Role',               file: '01_archetype_role.json' },
    { key: 'positive_trait',    title: 'Positive Trait',                 file: '02_positive_trait.json' },
    { key: 'motivation',        title: 'Motivation / Core Drive',        file: '04_motivation_core_drive.json' },
    { key: 'fatal_flaw',        title: 'Fatal Flaw + Negatives',         file: '05_fatal_flaw_with_negative_traits.json' },
    { key: 'destiny',           title: 'Destiny / Outcome',              file: '06_destiny_outcome.json' },
    { key: 'occupation',        title: 'Occupation + Reputation',        file: '08_occupation_social_role_WITH_reputation.json' },
    { key: 'secret',            title: 'Secret / Hidden Truth',          file: '10_secret_hidden_truth.json' },
    { key: 'external_conflict', title: 'External Conflict / Antagonist', file: '11_external_conflict_antagonist.json' },
    { key: 'internal_conflict', title: 'Internal Conflict',              file: '12_internal_conflict.json' }
  ];

  // ===== UTILS =====
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const escapeHtml = (s)=>s.replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function fetchJsonWithFallback(path){
    let lastErr;
    for (const base of RAW_BASES){
      const url = base + path;
      try{
        if (DEBUG) console.log('[CBB] fetch', url);
        const res = await fetch(url + (base.includes('jsdelivr')? '' : `?nocache=${Date.now()}`), {mode:'cors', cache:'no-cache'});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = (res.headers.get('content-type')||'').toLowerCase();
        if (!ct.includes('json')) {
          // Some CDNs send text/plain — still try to parse JSON
          if (DEBUG) console.log('[CBB] non-JSON content-type:', ct, '— trying JSON.parse anyway');
        }
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch(e){ throw new Error('Invalid JSON at ' + url); }
        if (!Array.isArray(data)) throw new Error('JSON is not an array at ' + url);
        const list = data.map(x => typeof x === 'string' ? x : (x.label || x.value || JSON.stringify(x)));
        if (list.length === 0) throw new Error('JSON array empty at ' + url);
        say(`Loaded: ${path} (${list.length} items)`);
        return list;
      }catch(err){
        lastErr = err;
        console.warn('[CBB] fetch failed', url, err && err.message ? err.message : err);
      }
    }
    throw lastErr || new Error('All sources failed for ' + path);
  }

  function seedLine(p){
    const g=k=>(p[k]||'').toString();
    const a=s=>/^[aeiou]/i.test(s)?`an ${s}`:`a ${s}`;
    const parts=[
      g('positive_trait') && `A ${g('positive_trait').toLowerCase()}`,
      g('archetype')||'character',
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

  // ===== REEL =====
  function buildReel(slotEl, items, opts){
    const vp=$('.viewport',slotEl);
    const strip=$('.list.reel',slotEl);
    if(!vp||!strip){ warn('Slot structure missing inside '+idOf(slotEl)); return null; }
    strip.innerHTML = items.map(t=>`<div class="rowitem">${escapeHtml(t)}</div>`).join('');
    const rows = $$('.rowitem', strip);
    let y=0, vy=0, dragging=false, lastY=0, lastTS=0, viewH=0, totalH=0;

    function measure(){ viewH = vp.clientHeight; totalH = rows.reduce((s,n)=>s+n.offsetHeight,0); clampY(); apply(); }
    function clampY(){ const min=Math.min(0,viewH-totalH); y=clamp(y,min,0); }
    function apply(){ strip.style.transform = `translateY(${y}px)`; markCenter(); }
    function markCenter(){
      const c=-y+viewH/2; let acc=0, best=0, bestD=1e9;
      rows.forEach((n,i)=>{ const mid=acc+n.offsetHeight/2; acc+=n.offsetHeight; const d=Math.abs(mid-c); if(d<bestD){bestD=d; best=i;} n.classList.toggle('center',i===best); });
      api.index=best; api.value=items[best];
    }
    function posOf(i){ let s=0; for(let k=0;k<i;k++) s+=rows[k].offsetHeight; return s; }
    function tweenTo(target,ms=260,onEnd){
      const start=performance.now(), from=y, dur=Math.max(60,ms|0);
      function frame(ts){ const t=clamp((ts-start)/dur,0,1); const k=1-(1-t)*(1-t); y=from+(target-from)*k; clampY(); apply(); if(t<1) requestAnimationFrame(frame); else onEnd&&onEnd(); }
      requestAnimationFrame(frame);
    }
    function snapTo(i,ms=opts.fast?160:280){
      i=clamp(i,0,rows.length-1);
      const target=-posOf(i)+viewH/2-rows[i].offsetHeight/2;
      tweenTo(target,ms,()=>{ api.index=i; api.value=items[i]; api.onPick && api.onPick(api.value); });
    }
    function fling(){ const speed=clamp(vy*1000,-2000,2000); tweenTo(y+speed*0.25,opts.fast?220:380,()=>snapTo(api.index)); }

    vp.addEventListener('pointerdown', e=>{ if(slotEl.classList.contains('locked')) return; dragging=true; vp.setPointerCapture(e.pointerId); lastY=e.clientY; vy=0; lastTS=performance.now(); });
    vp.addEventListener('pointermove', e=>{ if(!dragging) return; const now=performance.now(); const dy=e.clientY-lastY; lastY=e.clientY; y+=dy; clampY(); apply(); vy=dy/Math.max(1,(now-lastTS)); lastTS=now; });
    vp.addEventListener('pointerup',   ()=>{ dragging=false; fling(); });
    vp.addEventListener('pointercancel', ()=>{ dragging=false; snapTo(api.index); });
    vp.addEventListener('wheel', e=>{ if(slotEl.classList.contains('locked')) return; e.preventDefault(); y -= Math.sign(e.deltaY)*40; clampY(); apply(); clearTimeout(api._wheelTO); api._wheelTO=setTimeout(()=>snapTo(api.index),140); }, {passive:false});

    const api = { value:null, index:0, measure, snapTo, random(){ snapTo(Math.floor(Math.random()*items.length)); }, onPick:null };
    measure(); api.random();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ measure(); snapTo(api.index,0); });
    return api;
  }

  function idOf(el){ return el?.id ? '#'+el.id : el?.className ? '.'+el.className : String(el); }

  // ===== PUBLIC API =====
  window.Brainstormer = {
    async init(cfg){
      cfg = cfg || {};
      const reelsCfg = Object.assign({
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

      const conceptSel = (cfg.els && cfg.els.concept) || '#concept';
      const btns = Object.assign({
        slow:'#btnSlow', spin:'#btnSpin', fast:'#btnFast', manual:'#btnManual', lock:'#btnLock'
      }, (cfg.els && cfg.els.buttons) || {});

      // Verify DOM
      const missing = [];
      Object.entries(reelsCfg).forEach(([k,sel])=>{
        if (!$(sel)) missing.push(`${k} → ${sel}`);
      });
      if (missing.length){
        warn('Missing reel containers: ' + missing.join(', '));
      }

      try{
        say('Loading lists…');
        const data = {};
        for (const meta of LISTS){
          try{
            data[meta.key] = await fetchJsonWithFallback(meta.file);
          }catch(e){
            warn(`Failed: ${meta.file} (${e.message})`);
            throw e;
          }
        }

        // Build reels
        const reels = {};
        const picks = {};
        for (const meta of LISTS){
          const host = $(reelsCfg[meta.key]);
          if (!host){ continue; }
          const api = buildReel(host, data[meta.key], {fast:false});
          api.onPick = (val)=>{ picks[meta.key]=val; renderConcept(conceptSel, picks); };
          reels[meta.key] = api;
        }

        // Buttons
        const spinAll = ()=> Object.values(reels).forEach(r=>r && r.random());
        $(btns.slow )?.addEventListener('click', spinAll);
        $(btns.spin )?.addEventListener('click', spinAll);
        $(btns.fast )?.addEventListener('click', spinAll);
        $(btns.manual)?.addEventListener('click', ()=> $$('.slot.locked').forEach(s=>s.classList.remove('locked')));
        $(btns.lock )?.addEventListener('click', ()=> { Object.values(reels).forEach(r=>r && r.snapTo(r.index,0)); $$('.slot').forEach(s=>s.classList.add('locked')); });

        renderConcept(conceptSel, picks);
        window.addEventListener('resize', ()=> Object.values(reels).forEach(r=>r && r.measure()));

        say('Ready ✓');
      }catch(err){
        console.error('[CBB] init error', err);
        warn('Error loading lists. See console for details.');
      }
    }
  };

  // ===== Concept panel =====
  function renderConcept(sel, picks){
    const box = $(sel); if (!box) return;
    const seed = seedLine(picks);
    box.innerHTML = `
      <div class="meta badges">
        ${b(picks.archetype)}
        ${b(picks.positive_trait)}
        ${b(picks.motivation)}
        ${b(picks.fatal_flaw)}
        ${b(picks.destiny)}
        ${b(picks.occupation)}
        ${b(picks.secret)}
        ${b(picks.external_conflict)}
        ${b(picks.internal_conflict)}
      </div>
      <p class="seed">${escapeHtml(seed)}</p>`;
    function b(v){ return v ? `<span class="badge">${escapeHtml(v)}</span>` : ''; }
  }

  // ===== Auto-init =====
  document.addEventListener('DOMContentLoaded', ()=>{
    markLoaded();
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
          },
          concept:'#concept',
          dataStatus:'#dataStatus'
        }
      });
    } else {
      warn('Wrapper #cbb-root not found — not initializing.');
    }
  });

})();
