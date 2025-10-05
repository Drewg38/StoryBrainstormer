/* Cool Character Brainstormer — 9 reels
   Exposes: window.Brainstormer.init({ els:{buttons:{...}, reels:{...}, concept:'#concept', dataStatus:'#dataStatus'}, touch:{scale,threshold} })
*/
(function(){
  'use strict';

  const RAW = 'https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/3ec0483d81f5aef0922d0b0460ce7e8830fb07dd/';
  const listsManifest = [
    { key:'archetype',         title:'Archetype / Role',                file:'01_archetype_role.json' },
    { key:'positive_trait',    title:'Positive Trait',                  file:'02_positive_trait.json' },
    { key:'motivation',        title:'Motivation / Core Drive',         file:'04_motivation_core_drive.json' },
    { key:'fatal_flaw',        title:'Fatal Flaw + Negatives',          file:'05_fatal_flaw_with_negative_traits.json' },
    { key:'destiny',           title:'Destiny / Outcome',               file:'06_destiny_outcome.json' },
    { key:'occupation',        title:'Occupation + Reputation',         file:'08_occupation_social_role_WITH_reputation.json' },
    { key:'secret',            title:'Secret / Hidden Truth',           file:'10_secret_hidden_truth.json' },
    { key:'external_conflict', title:'External Conflict / Antagonist',  file:'11_external_conflict_antagonist.json' },
    { key:'internal_conflict', title:'Internal Conflict',               file:'12_internal_conflict.json' },
  ];

  function $(s,el=document){ return el.querySelector(s); }
  function $$(s,el=document){ return Array.from(el.querySelectorAll(s)); }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  async function loadJson(path){
    const res = await fetch(RAW+path, {cache:'no-cache'});
    if(!res.ok) throw new Error('Failed to fetch '+path+' '+res.status);
    const data = await res.json();
    return data.map(x => typeof x==='string' ? x : (x.label || x.value || JSON.stringify(x)));
  }

  function buildSeed(picks){
    const a = k=>picks[k]||'';
    const prefixA = s => /^[aeiou]/i.test(s)?`an ${s}`:`a ${s}`;
    const parts = [
      a('positive_trait') && `A ${a('positive_trait').toLowerCase()}`,
      a('archetype') || 'character',
      a('occupation') && `working as ${prefixA(a('occupation').toLowerCase())}`,
      a('motivation') && `driven by ${a('motivation').toLowerCase()}`,
      a('fatal_flaw') && `but haunted by ${prefixA(a('fatal_flaw').toLowerCase())}`,
      a('secret') && `who hides ${prefixA(a('secret').toLowerCase())}`,
      a('external_conflict') && `while facing ${prefixA(a('external_conflict').toLowerCase())}`,
      a('internal_conflict') && `and torn between ${a('internal_conflict').toLowerCase()}`,
      a('destiny') && `on a path toward ${a('destiny').toLowerCase()}`
    ].filter(Boolean).join(', ') + '.';
    return parts.replace(/\s+/g,' ').replace(/ ,/g,',');
  }

  function buildReel(slotEl, items, opts){
    const vp = $('.viewport', slotEl);
    const strip = $('.list.reel', slotEl);
    strip.innerHTML = items.map(t => `<div class="rowitem">${escapeHtml(t)}</div>`).join('');
    const rows = $$('.rowitem', strip);

    let y=0, vy=0, dragging=false, lastY=0, lastTS=0, viewH=0, totalH=0;

    function measure(){
      viewH = vp.clientHeight;
      totalH = rows.reduce((s,n)=>s+n.offsetHeight,0);
      clampY(); apply();
    }
    function clampY(){ const min = Math.min(0, viewH-totalH); y = clamp(y, min, 0); }
    function apply(){ strip.style.transform = `translateY(${y}px)`; markCenter(); }
    function markCenter(){
      const mid = -y + viewH/2;
      let acc=0, best=null, bestD=1e9;
      rows.forEach((n,i)=>{ const m=acc + n.offsetHeight/2; acc+=n.offsetHeight; const d=Math.abs(m-mid); if(d<bestD){bestD=d; best=i;} n.classList.toggle('center', i===best); });
    }
    function posOf(i){ let s=0; for(let k=0;k<i;k++) s+=rows[k].offsetHeight; return s; }
    function snapTo(i, ms=260){
      const target = -posOf(i) + viewH/2 - rows[i].offsetHeight/2;
      tweenTo(target, ms);
      api.value = items[i];
      api.index = i;
      api.onPick && api.onPick(api.value);
    }
    function fling(){
      const speed = clamp(vy*1000, -2000, 2000);
      tweenTo(y + speed*0.25, opts.fast?200:380, () => snapTo(api.index));
    }
    function tweenTo(target, ms=280, onEnd){
      const start = performance.now(), from = y, dur = Math.max(60,ms|0);
      function frame(ts){
        const t = clamp((ts-start)/dur,0,1);
        const k = 1-(1-t)*(1-t);
        y = from + (target-from)*k; clampY(); apply();
        if(t<1) requestAnimationFrame(frame); else onEnd&&onEnd();
      }
      requestAnimationFrame(frame);
    }

    // interactions
    vp.addEventListener('pointerdown', e=>{ dragging=true; vp.setPointerCapture(e.pointerId); lastY=e.clientY; vy=0; lastTS=performance.now(); });
    vp.addEventListener('pointermove', e=>{ if(!dragging) return; const now=performance.now(); const dy=e.clientY-lastY; lastY=e.clientY; y+=dy; clampY(); apply(); vy=dy/Math.max(1,(now-lastTS)); lastTS=now; });
    vp.addEventListener('pointerup',   ()=>{ dragging=false; fling(); });
    vp.addEventListener('pointercancel',()=>{ dragging=false; snapTo(api.index); });

    vp.addEventListener('wheel', e=>{ e.preventDefault(); y -= Math.sign(e.deltaY)*40; clampY(); apply(); debounce(()=>snapTo(api.index), 140); }, {passive:false});

    // init
    const api = {
      value:null, index:0, measure, snapTo,
      random(){ snapTo(Math.floor(Math.random()*items.length), opts.fast?160:260); },
      onPick:null
    };
    measure();
    api.random();
    return api;
  }

  // touch → wheel bridge (keeps iOS/Android flick feel consistent)
  function installTouchWheelBridge(selector,{scale=2.4,threshold=0.8}={}){
    document.querySelectorAll(selector).forEach(el=>{
      let y0=null, acc=0; const slot = el.closest('.slot');
      el.addEventListener('touchstart', e=>{ if(slot?.classList.contains('locked'))return; y0=e.touches[0].clientY; acc=0; }, {passive:true});
      el.addEventListener('touchmove',  e=>{ if(slot?.classList.contains('locked'))return; if(y0==null)return; e.preventDefault(); const y=e.touches[0].clientY; const dy=y-y0; acc+=dy; y0=y; const step=threshold*10; if(Math.abs(acc)>=step){ const delta=-acc*scale; acc=0; el.dispatchEvent(new WheelEvent('wheel',{deltaY:delta,bubbles:true,cancelable:true})); } }, {passive:false});
      el.addEventListener('touchend',   ()=>{ y0=null; acc=0; }, {passive:true});
      el.addEventListener('touchcancel',()=>{ y0=null; acc=0; }, {passive:true});
    });
  }

  // tiny debounce
  let debTO=null; function debounce(fn,ms){ clearTimeout(debTO); debTO=setTimeout(fn,ms); }

  function escapeHtml(s){ return s.replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  window.Brainstormer = {
    async init(cfg){
      const { els, touch } = cfg || {};
      const statusEl = els?.dataStatus ? $(els.dataStatus) : null;
      const say = m => { if(statusEl) statusEl.textContent = m||''; };

      try{
        say('Loading lists…');
        const lists = await Promise.all(listsManifest.map(x=>loadJson(x.file)));
        say('');

        // build 9 reels using selectors passed in cfg.els.reels
        const reels = {};
        const picks = {};
        for (let i=0;i<listsManifest.length;i++){
          const m = listsManifest[i];
          const sel = els?.reels?.[m.key];
          const host = sel ? $(sel) : null;
          if(!host){ console.warn('Missing reel host for', m.key); continue; }
          const api = buildReel(host, lists[i], {fast:false, ...(touch||{})});
          api.onPick = (val)=>{ picks[m.key]=val; updateConcept(picks, els?.concept); };
          reels[m.key] = api;
        }

        // buttons
        const b = els?.buttons||{};
        if (b.slow)   $(b.slow)?.addEventListener('click', ()=>{ Object.values(reels).forEach(r=>r.random()); });
        if (b.spin)   $(b.spin)?.addEventListener('click', ()=>{ Object.values(reels).forEach(r=>r.random()); });
        if (b.fast)   $(b.fast)?.addEventListener('click', ()=>{ Object.values(reels).forEach(r=>r.random()); });
        if (b.manual) $(b.manual)?.addEventListener('click', ()=>{/* manual set is native via flick */});
        if (b.lock)   $(b.lock)?.addEventListener('click', ()=>{/* keeping for UI parity */});

        // touch wheel bridge for all reel viewports
        installTouchWheelBridge(Object.values(els.reels).map(s=>`${s} .viewport`).join(','), touch||{});

        // first render of concept
        updateConcept(picks, els?.concept);

        // resize measure
        window.addEventListener('resize', ()=> Object.values(reels).forEach(r=>r.measure()));
      }catch(err){
        console.error(err);
        say('Error loading lists. Check JSON URLs / CORS.');
      }
    }
  };

  function updateConcept(picks, conceptSel){
    const box = conceptSel ? $(conceptSel) : null;
    if(!box) return;
    const seed = buildSeed(picks);
    box.innerHTML = `
      <div class="meta badges">
        ${val(picks,'archetype')}
        ${val(picks,'positive_trait')}
        ${val(picks,'motivation')}
        ${val(picks,'fatal_flaw')}
        ${val(picks,'destiny')}
        ${val(picks,'occupation')}
        ${val(picks,'secret')}
        ${val(picks,'external_conflict')}
        ${val(picks,'internal_conflict')}
      </div>
      <p class="seed">${escapeHtml(seed)}</p>
    `;
    function val(p,k){ return p[k] ? `<span class="badge">${escapeHtml(p[k])}</span>` : ''; }
  }

})();
