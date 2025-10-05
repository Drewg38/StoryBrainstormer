/* Cool Character Brainstormer — 9 reels (classic script, no modules)
   Exposes: window.Brainstormer.init({ els:{buttons:{...}, reels:{...}, concept:'#concept', dataStatus:'#dataStatus'}, touch:{scale,threshold} })
   Self-inits on DOMContentLoaded if you don't call it yourself.
*/
(function () {
  'use strict';

  /* ---------- CONFIG: your 9 lists (pinned commit + fallbacks) ---------- */
  const RAW_BASES = [
    // Pinned commit (fast + stable)
    'https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/b739578b5774a58e8e6ef6f11cad019b9fefd6e6/',
    'https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@b739578b5774a58e8e6ef6f11cad019b9fefd6e6/',
    // Main branch fallbacks
    'https://raw.githubusercontent.com/Drewg38/StoryBrainstormer/main/',
    'https://cdn.jsdelivr.net/gh/Drewg38/StoryBrainstormer@main/'
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

  /* ---------- tiny utils ---------- */
  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function fetchJsonWithFallback(path) {
    let lastErr;
    for (const base of RAW_BASES) {
      try {
        const res = await fetch(base + path, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        return data.map(x => typeof x === 'string' ? x : (x.label || x.value || JSON.stringify(x)));
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Failed to fetch ' + path);
  }

  function seedLine(picks) {
    const g = k => (picks[k] || '').toString();
    const a = (s) => /^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`;
    const bits = [
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
    return bits.replace(/\s+/g, ' ').replace(/ ,/g, ',');
  }

  /* ---------- Reel builder (momentum scroll, snap to center) ---------- */
  function buildReel(slotEl, items, opts) {
    const vp    = $('.viewport', slotEl);
    const strip = $('.list.reel', slotEl);
    strip.innerHTML = items.map(t => `<div class="rowitem">${escapeHtml(t)}</div>`).join('');
    const rows  = $$('.rowitem', strip);

    let y = 0, vy = 0, dragging = false, lastY = 0, lastTS = 0, viewH = 0, totalH = 0;

    function measure() {
      viewH  = vp.clientHeight;
      totalH = rows.reduce((s, n) => s + n.offsetHeight, 0);
      clampY(); apply();
    }
    function clampY() { const min = Math.min(0, viewH - totalH); y = clamp(y, min, 0); }
    function apply()  { strip.style.transform = `translateY(${y}px)`; markCenter(); }

    function markCenter() {
      const center = -y + viewH / 2;
      let acc = 0, best = 0, bestD = Infinity;
      rows.forEach((node, i) => {
        const mid = acc + node.offsetHeight / 2; acc += node.offsetHeight;
        const d = Math.abs(mid - center);
        if (d < bestD) { bestD = d; best = i; }
        node.classList.toggle('center', i === best);
      });
      api.index = best;
      api.value = items[best];
    }

    function posOf(i) { let s = 0; for (let k = 0; k < i; k++) s += rows[k].offsetHeight; return s; }

    function snapTo(i, ms = opts.fast ? 160 : 280) {
      i = clamp(i, 0, rows.length - 1);
      const target = -posOf(i) + (viewH / 2) - (rows[i].offsetHeight / 2);
      tweenTo(target, ms, () => {
        api.index = i; api.value = items[i];
        api.onPick && api.onPick(api.value);
      });
    }

    function fling() {
      const speed = clamp(vy * 1000, -2000, 2000);
      tweenTo(y + speed * 0.25, opts.fast ? 220 : 380, () => snapTo(api.index));
    }

    function tweenTo(target, ms = 260, onEnd) {
      const start = performance.now(), from = y, dur = Math.max(60, ms | 0);
      function frame(ts) {
        const t = clamp((ts - start) / dur, 0, 1);
        const k = 1 - (1 - t) * (1 - t);
        y = from + (target - from) * k; clampY(); apply();
        if (t < 1) requestAnimationFrame(frame); else onEnd && onEnd();
      }
      requestAnimationFrame(frame);
    }

    // Pointer interactions
    vp.addEventListener('pointerdown', e => {
      if (slotEl.classList.contains('locked')) return;
      dragging = true; vp.setPointerCapture(e.pointerId);
      lastY = e.clientY; vy = 0; lastTS = performance.now();
    });
    vp.addEventListener('pointermove', e => {
      if (!dragging) return;
      const now = performance.now();
      const dy  = e.clientY - lastY;
      lastY = e.clientY; y += dy; clampY(); apply();
      vy = dy / Math.max(1, (now - lastTS)); lastTS = now;
    });
    vp.addEventListener('pointerup',   () => { dragging = false; fling(); });
    vp.addEventListener('pointercancel', () => { dragging = false; snapTo(api.index); });

    // Mouse wheel
    vp.addEventListener('wheel', e => {
      if (slotEl.classList.contains('locked')) return;
      e.preventDefault();
      y -= Math.sign(e.deltaY) * 40; clampY(); apply();
      clearTimeout(api._wheelTO);
      api._wheelTO = setTimeout(() => snapTo(api.index), 140);
    }, { passive: false });

    const api = {
      value: null,
      index: 0,
      measure,
      snapTo,
      random() { snapTo(Math.floor(Math.random() * items.length)); },
      onPick: null
    };

    measure();
    api.random();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { measure(); snapTo(api.index, 0); });
    }
    return api;
  }

  /* ---------- public initializer ---------- */
  window.Brainstormer = {
    async init(config) {
      const cfg = config || {};
      const els = cfg.els || {};

      const reelSel = Object.assign({
        archetype:         '#reel_archetype',
        positive_trait:    '#reel_positive',
        motivation:        '#reel_motivation',
        fatal_flaw:        '#reel_flaw',
        destiny:           '#reel_destiny',
        occupation:        '#reel_occupation',
        secret:            '#reel_secret',
        external_conflict: '#reel_external',
        internal_conflict: '#reel_internal'
      }, els.reels || {});

      const btns = Object.assign({
        slow:   '#btnSlow',
        spin:   '#btnSpin',
        fast:   '#btnFast',
        manual: '#btnManual',
        lock:   '#btnLock'
      }, (els.buttons || {}));

      const conceptSel = els.concept || '#concept';
      const statusSel  = els.dataStatus || '#dataStatus';
      const statusEl   = statusSel ? $(statusSel) : null;
      const say = (m)=>{ if (statusEl) statusEl.textContent = m || ''; };

      try {
        say('Loading lists…');
        const datasets = await Promise.all(LISTS.map(x => fetchJsonWithFallback(x.file)));

        const reels = {};
        const picks = {};
        LISTS.forEach((meta, i) => {
          const host = $(reelSel[meta.key]);
          if (!host) return;
          const api = buildReel(host, datasets[i], { fast: false });
          api.onPick = (val) => { picks[meta.key] = val; renderConcept(conceptSel, picks); };
          reels[meta.key] = api;
        });

        renderConcept(conceptSel, picks);
        say('');

        const spinAll = (speed='normal') => {
          Object.values(reels).forEach(r => r.random());
        };

        $(btns.slow)?.addEventListener('click',  ()=> spinAll('slow'));
        $(btns.spin)?.addEventListener('click',  ()=> spinAll('normal'));
        $(btns.fast)?.addEventListener('click',  ()=> spinAll('fast'));

        $(btns.manual)?.addEventListener('click', ()=>{ $$('.slot.locked').forEach(s => s.classList.remove('locked')); });
        $(btns.lock)?.addEventListener('click',   ()=>{ Object.values(reels).forEach(r => r.snapTo(r.index, 0)); $$('.slot').forEach(s => s.classList.add('locked')); });

        window.addEventListener('resize', ()=> Object.values(reels).forEach(r => r.measure()));

      } catch (err) {
        console.error(err);
        say('Error loading lists. Check JSON URLs / CORS.');
      }
    }
  };

  /* ---------- Concept rendering ---------- */
  function renderConcept(selector, picks) {
    const el = $(selector);
    if (!el) return;
    const seed = seedLine(picks);
    el.innerHTML = `
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
      <p class="seed">${escapeHtml(seed)}</p>
    `;
    function badge(v){ return v ? `<span class="badge">${escapeHtml(v)}</span>` : ''; }
  }

  /* ---------- AUTO-INIT (so reels populate without extra HTML code) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    // Only auto-run if the wrapper exists; allows you to opt-out by removing the element.
    if (document.querySelector('#cbb-root')) {
      window.Brainstormer.init({
        els:{
          buttons:{slow:'#btnSlow',spin:'#btnSpin',fast:'#btnFast',manual:'#btnManual',lock:'#btnLock'},
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
        },
        touch:{ scale:2.4, threshold:0.8 }
      });
    }
  });

})();
