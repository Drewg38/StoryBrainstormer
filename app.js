
// Cool Board Game Brainstormer — External Logic (app.js) v4
// - Auto-derives JSON base from this script's URL (commit-safe; avoids CORS/HTML issues)
// - Falls back to pinned commit and main if needed
// - No framework required; attaches to pre-existing DOM by IDs/classes
// - Exposes: window.Brainstormer.init({ els: {...selectors} })
(function(){
  'use strict';

  // ---- Helpers --------------------------------------------------------------
  function $(sel, root){ return (root||document).querySelector(sel); }
  function $all(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function byKey(k){ return function(a,b){ return (a[k]||'').localeCompare(b[k]||''); }; }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
  function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function toName(x){
    if (typeof x === 'string') return x;
    if (x && typeof x.name === 'string') return x.name;
    return String(x);
  }
  function toDesc(x){
    if (!x) return '';
    if (Array.isArray(x.desc)) return x.desc.join(' ');
    if (typeof x.desc === 'string') return x.desc;
    if (typeof x.description === 'string') return x.description;
    return '';
  }
  function normalizeList(raw, key){
    var arr = [];
    if (Array.isArray(raw)) arr = raw;
    else if (raw && Array.isArray(raw.items)) arr = raw.items;
    else if (raw && key && Array.isArray(raw[key])) arr = raw[key];
    else if (raw && raw.data && key && Array.isArray(raw.data[key])) arr = raw.data[key];
    else arr = [];
    return arr.map(function(x){ return { name: toName(x), desc: toDesc(x), url: (x && x.url) || '' }; });
  }
  function bucketABCD(entries){
    var b = { 'A–E':[], 'F–J':[], 'K–O':[], 'P–T':[], 'U–Z':[], 'ALL':[] };
    entries.forEach(function(e){
      var n = (e.name||'').trim();
      var c = n.charAt(0).toUpperCase();
      var key = (c>='A'&&c<='E')?'A–E':(c>='F'&&c<='J')?'F–J':(c>='K'&&c<='O')?'K–O':(c>='P'&&c<='T')?'P–T':(c>='U'&&c<='Z')?'U–Z':'ALL';
      b[key].push(e); b.ALL.push(e);
    });
    Object.keys(b).forEach(function(k){ b[k].sort(byKey('name')); });
    return b;
  }
  function windowed(list, center, size){
    size = size || 3;
    var half = Math.floor(size/2), out = [];
    for (var i=center-half;i<=center+half;i++){
      var idx = ((i%list.length)+list.length)%list.length;
      out.push(list[idx]);
    }
    return out;
  }

  // ---- RAW base derivation & fallbacks -------------------------------------
  // If this script is loaded from RAW GitHub (or any path ending /app.js),
  // derive the folder as RAW_BASE so JSON resolves next to it.
  var scriptUrl = (document.currentScript && document.currentScript.src) || '';
  var derivedBase = '';
  try {
    var m = scriptUrl.match(/^(https?:\/\/[^?#]+)\/app\.js(?:[?#].*)?$/i);
    if (m) derivedBase = m[1];
  } catch(_){}

  // You can update the pinned commit here if needed for failover:
  var PINNED_COMMIT = '5e202edfc340de95b5afc47f95ca20cd9b652083';

  var FALLBACK_BASES = [
    'https://raw.githubusercontent.com/Drewg38/BoardGameBrainstormer/'+PINNED_COMMIT,
    'https://raw.githubusercontent.com/Drewg38/BoardGameBrainstormer/main'
  ];

  var RAW_BASE = derivedBase || FALLBACK_BASES[0];
  var THEME_URL = RAW_BASE + '/themes_full.json';
  var MECH_URL  = RAW_BASE + '/mechanics_full.json';

  // ---- Data fetching with graceful fallback --------------------------------
  function fetchJsonWithFallback(urls){
    urls = Array.isArray(urls) ? urls : [urls];
    return new Promise(function(resolve,reject){
      (function next(i){
        if (i >= urls.length) return reject(new Error('All JSON sources failed'));
        var url = urls[i];
        fetch(url, { mode:'cors', redirect:'follow' }).then(function(res){
          if (!res.ok) throw new Error('HTTP '+res.status);
          return res.text().then(function(txt){
            if (txt.trim().startsWith('<')) throw new Error('HTML not JSON at '+url);
            try { resolve(JSON.parse(txt)); }
            catch(e){ throw new Error('Invalid JSON at '+url); }
          });
        }).catch(function(){ next(i+1); });
      })(0);
    });
  }

  // ---- Reel (slot) component ------------------------------------------------
  function makeReel(rootEl, items){
    var viewport = $('.viewport', rootEl) || rootEl;
    var listEl = $('.list', rootEl);
    var idx = Math.floor(Math.random()*items.length);
    var spinning = false, raf = 0, locked = false;

    function render(){
      if (!listEl) return;
      listEl.innerHTML = '';
      var rows = windowed(items, idx, 3);
      rows.forEach(function(e,i){
        var d = document.createElement('div');
        d.className = 'rowitem' + (i===1?' center':'');
        d.textContent = e.name || String(e);
        listEl.appendChild(d);
      });
    }
    render();

    function step(dir){ dir = dir||1; idx = ((idx+dir)%items.length+items.length)%items.length; render(); }

    function spin(speed){
      if (locked) return;
      if (spinning) cancelAnimationFrame(raf);
      spinning = true;
      var cadence = 100 / (speed||1.0);
      var last = performance.now(), acc = 0;
      function tick(t){
        if (!spinning) return;
        var dt = t - last; last = t; acc += dt;
        while (acc >= cadence){ step(1); acc -= cadence; }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }
    function stop(){ spinning=false; cancelAnimationFrame(raf); }
    function lock(v){ locked = v==null ? true : !!v; rootEl.classList.toggle('locked', locked); }

    // Manual scroll – slow, precise, and page doesn't scroll while hovered
    var accum = 0, STEP = 120;
    function onWheel(e){
      if (!rootEl.matches(':hover')) return;
      e.preventDefault(); e.stopPropagation();
      if (spinning) return;
      accum += e.deltaY;
      while (accum >= STEP){ step(1); accum -= STEP; }
      while (accum <= -STEP){ step(-1); accum += STEP; }
    }
    viewport.addEventListener('wheel', onWheel, { passive:false });

    return {
      get value(){ return items[idx]; },
      setItems: function(arr){ if (arr && arr.length){ items = arr; idx = Math.min(idx, items.length-1); render(); } },
      render: render, spin: spin, stop: stop, lock: lock
    };
  }

  // ---- Concept rendering ----------------------------------------------------
  var WEIGHTS = [1,2,3,4,5];
  function weightDots(w){ return '●'.repeat(w) + '○'.repeat(5-w); }
  function randomMode(){ return Math.random()<0.5 ? 'Competitive' : 'Cooperative'; }

  function renderConcept(el, theme, m1, m2){
    if (!el) return;
    var players = randInt(1,6);
    var weight  = WEIGHTS[randInt(0,4)];
    var mode    = randomMode();
    el.innerHTML = ''
      + '<article class="idea">'
      + '  <div class="badges">'
      + '    <span class="badge">'+mode+'</span>'
      + '    <span class="badge">Players '+players+'</span>'
      + '    <span class="badge">Weight '+weight+' <span style="letter-spacing:2px;margin-left:6px">'+weightDots(weight)+'</span></span>'
      + '  </div>'
      + '  <div class="sep"></div>'
      + '  <div style="margin-bottom:8px">'
      + '    <div style="font-weight:800;margin-bottom:6px;">Theme</div>'
      + '    <div>'+(theme?theme.name:'')+'</div>'
      + (theme&&theme.desc? '<p style="opacity:.9;margin-top:6px">'+theme.desc+'</p>' : '')
      + '  </div>'
      + '  <div style="margin:10px 0 8px 0">'
      + '    <div style="font-weight:800;margin-bottom:6px;">Mechanic 1</div>'
      + '    <div>'+(m1?m1.name:'')+'</div>'
      + (m1&&m1.desc? '<p style="opacity:.9;margin-top:6px">'+m1.desc+'</p>' : '')
      + '  </div>'
      + '  <div style="margin-top:10px">'
      + '    <div style="font-weight:800;margin-bottom:6px;">Mechanic 2</div>'
      + '    <div>'+(m2?m2.name:'')+'</div>'
      + (m2&&m2.desc? '<p style="opacity:.9;margin-top:6px">'+m2.desc+'</p>' : '')
      + '  </div>'
      + '  <div class="sep"></div>'
      + '  <p><strong>Design prompt:</strong> Combine <em>'+(theme?theme.name:'')+'</em> with <em>'+(m1?m1.name:'')+'</em> and <em>'+(m2?m2.name:'')+'</em>. Outline the core loop, how players interact, and what creates tension or cooperation.</p>'
      + '</article>';
  }

  function renderDir(el, entries, page, size){
    if (!el) return;
    var start = page*size;
    var slice = entries.slice(start, start+size);
    el.innerHTML = '';
    slice.forEach(function(e){
      var card = document.createElement('div');
      card.className = 'dircard';
      card.innerHTML = '<h3>'+e.name+'</h3>' + (e.desc?('<p>'+e.desc+'</p>'):');
      el.appendChild(card);
    });
  }

  // ---- Bootstrap ------------------------------------------------------------
  function bootstrap(opts){
    var sel = (opts && opts.els) || {};
    var status = $(sel.dataStatus || '#dataStatus');
    var setStatus = function(t){ if(status) status.textContent = t||''; };

    setStatus('Fetching data…');

    var themeUrls = [THEME_URL].concat(FALLBACK_BASES.map(function(b){ return b+'/themes_full.json'; }));
    var mechUrls  = [MECH_URL ].concat(FALLBACK_BASES.map(function(b){ return b+'/mechanics_full.json'; }));

    Promise.all([ fetchJsonWithFallback(themeUrls), fetchJsonWithFallback(mechUrls) ])
      .then(function(res){
        var THEMES = normalizeList(res[0], 'themes');
        var MECHS  = normalizeList(res[1], 'mechanics');
        setStatus('Loaded '+THEMES.length+' themes and '+MECHS.length+' mechanics.');

        var themeReel = makeReel($(sel.reels.theme), THEMES);
        var mech1Reel = makeReel($(sel.reels.mech1), MECHS);
        var mech2Reel = makeReel($(sel.reels.mech2), MECHS);

        var speeds = { slow:0.9, spin:1.4, fast:2.2 };

        function stopAll(){ themeReel.stop(); mech1Reel.stop(); mech2Reel.stop(); }
        function unlockAll(){ themeReel.lock(false); mech1Reel.lock(false); mech2Reel.lock(false); }
        function lockAll(){ themeReel.lock(true); mech1Reel.lock(true); mech2Reel.lock(true); }

        var conceptEl = $(sel.concept);

        var btnSlow   = $(sel.buttons.slow);
        var btnSpin   = $(sel.buttons.spin);
        var btnFast   = $(sel.buttons.fast);
        var btnManual = $(sel.buttons.manual);
        var btnLock   = $(sel.buttons.lock);

        if (btnSlow)   btnSlow.onclick   = function(){ unlockAll(); stopAll(); themeReel.spin(speeds.slow); mech1Reel.spin(speeds.slow); mech2Reel.spin(speeds.slow); };
        if (btnSpin)   btnSpin.onclick   = function(){ unlockAll(); stopAll(); themeReel.spin(speeds.spin); mech1Reel.spin(speeds.spin); mech2Reel.spin(speeds.spin); };
        if (btnFast)   btnFast.onclick   = function(){ unlockAll(); stopAll(); themeReel.spin(speeds.fast); mech1Reel.spin(speeds.fast); mech2Reel.spin(speeds.fast); };
        if (btnManual) btnManual.onclick = function(){ stopAll(); unlockAll(); };
        if (btnLock)   btnLock.onclick   = function(){
          stopAll(); lockAll();
          renderConcept(conceptEl, themeReel.value, mech1Reel.value, mech2Reel.value);
          setStatus('');
        };

        // Directories
        var themeBuckets = bucketABCD(THEMES);
        var mechBuckets  = bucketABCD(MECHS);
        var themePage = { bucket:'A–E', page:0, size:6 };
        var mechPage  = { bucket:'A–E', page:0, size:10 };
        var themeDir  = $(sel.themeDir);
        var mechDir   = $(sel.mechDir);
        var themePageLabel = $(sel.themePageLabel);
        var mechPageLabel  = $(sel.mechPageLabel);

        function updateThemeDir(){
          var data = themeBuckets[themePage.bucket] || [];
          var total = Math.max(1, Math.ceil(data.length / themePage.size));
          themePage.page = clamp(themePage.page, 0, total-1);
          renderDir(themeDir, data, themePage.page, themePage.size);
          if (themePageLabel) themePageLabel.textContent = themePage.bucket+' — Page '+(themePage.page+1)+' / '+total;
        }
        function updateMechDir(){
          var data = mechBuckets[mechPage.bucket] || [];
          var total = Math.max(1, Math.ceil(data.length / mechPage.size));
          mechPage.page = clamp(mechPage.page, 0, total-1);
          renderDir(mechDir, data, mechPage.page, mechPage.size);
          if (mechPageLabel) mechPageLabel.textContent = mechPage.bucket+' — Page '+(mechPage.page+1)+' / '+total;
        }

        $all(sel.themeFilters).forEach(function(btn){
          btn.onclick = function(){ themePage.bucket = btn.textContent.trim(); themePage.page=0; updateThemeDir(); };
        });
        $all(sel.mechFilters).forEach(function(btn){
          btn.onclick = function(){ mechPage.bucket = btn.textContent.trim(); mechPage.page=0; updateMechDir(); };
        });

        var tPrev=$(sel.themePagerPrev), tNext=$(sel.themePagerNext);
        var mPrev=$(sel.mechPagerPrev),  mNext=$(sel.mechPagerNext);
        if (tPrev) tPrev.onclick = function(){ themePage.page--; updateThemeDir(); };
        if (tNext) tNext.onclick = function(){ themePage.page++; updateThemeDir(); };
        if (mPrev) mPrev.onclick = function(){ mechPage.page--; updateMechDir(); };
        if (mNext) mNext.onclick = function(){ mechPage.page++; updateMechDir(); };

        updateThemeDir();
        updateMechDir();
      })
      .catch(function(err){
        console.error(err);
        setStatus('⚠️ Data fetch failed. Check JSON RAW URLs or CORS policy.');
      });
  }

  // ---- Public API -----------------------------------------------------------
  window.Brainstormer = window.Brainstormer || {};
  window.Brainstormer.init = function init(opts){
    try { bootstrap(opts||{}); }
    catch(e){
      console.error('Init error:', e);
      var s = document.querySelector('#dataStatus');
      if (s) s.textContent = '⚠️ Init error (see console).';
    }
  };
})();
