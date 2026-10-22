/* Otto v4 — the landscape, the scroll story, and the light-to-dark theme engine. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const H = window.OttoHills, UI = window.OttoUI;

  /* ================= themes ================= */
  const THEMES = {
    light:  { bg: [245, 243, 250], fg: [23, 19, 31],   muted: [107, 101, 120], line: [23, 19, 31],    lineA: 0.1 },
    lilac:  { bg: [234, 228, 251], fg: [27, 21, 48],   muted: [106, 95, 142],  line: [27, 21, 48],    lineA: 0.1 },
    dark:   { bg: [13, 10, 20],    fg: [243, 240, 250], muted: [140, 134, 153], line: [255, 255, 255], lineA: 0.1 },
    violet: { bg: [27, 16, 54],    fg: [243, 240, 250], muted: [169, 155, 208], line: [255, 255, 255], lineA: 0.12 },
  };
  const root = document.documentElement.style;
  // the background fades the whole way (through a violet, not a grey); the text swaps quickly in the
  // middle, so it is always readable against whatever the background is at that moment
  const TINT = [6, -8, 30];
  const mixT = (a, b, t) => {
    const tf = t <= 0.38 ? 0 : t >= 0.62 ? 1 : (t - 0.38) / 0.24;
    const glow = a === b ? 0 : 4 * t * (1 - t);
    const m = (x, y, k, tint) => x.map((v, i) => Math.round(clamp(v + (y[i] - v) * k + (tint ? TINT[i] * glow : 0), 0, 255))).join(' ');
    return { bg: m(a.bg, b.bg, t, true), fg: m(a.fg, b.fg, tf), muted: m(a.muted, b.muted, tf), line: m(a.line, b.line, tf), lineA: (a.lineA + (b.lineA - a.lineA) * tf).toFixed(3) };
  };
  let lastTheme = '', lastNav = null;
  // the page fades between themes; the nav snaps to the nearer one (and eases there with CSS),
  // so it never sits in a low-contrast grey halfway
  const applyTheme = (a, b, k) => {
    const t = mixT(a, b, k);
    const key = t.bg + t.fg;
    if (key !== lastTheme) {
      lastTheme = key;
      root.setProperty('--bg', t.bg); root.setProperty('--fg', t.fg); root.setProperty('--muted', t.muted);
      root.setProperty('--line', t.line); root.setProperty('--lineA', t.lineA);
    }
    const n = k < 0.5 ? a : b;
    if (n !== lastNav) {
      lastNav = n;
      const j = (c) => c.join(' ');
      root.setProperty('--nbg', j(n.bg)); root.setProperty('--nfg', j(n.fg)); root.setProperty('--nmuted', j(n.muted));
      root.setProperty('--nline', j(n.line)); root.setProperty('--nlineA', n.lineA);
    }
  };

  /* ================= hero ================= */
  const hero = $('.hero'), stage = $('.stage'), copy = $('.hero-copy'), screen = $('.screen');
  const display = $('.display'), vd = $('.vd'), dusk = $('.dusk'), cue = $('.scroll-cue');
  const layers = { clouds: $('#l-clouds'), far: $('#l-far'), mid: $('#l-mid'), near: $('#l-near'), shrubs: $('#l-shrubs') };
  // how far each layer travels up over the whole hero, in viewport heights
  const TRAVEL_D = { clouds: 0.05, far: 0.09, mid: 0.15, near: 0.24, shrubs: 0.34 };
  const TRAVEL_M = Object.assign({}, TRAVEL_D, { shrubs: 0.22 });   // phones: the bushes rise less
  let TRAVEL = TRAVEL_D;
  let G = {};   // geometry, recomputed on resize

  const DAY = {
    clouds: { seed: 7, white: '#FFFFFF', shade: '#DCD2F4', deep: '#C9BCEE', items: [[0.18, 0.6, 0.4, 1.1], [0.7, 0.57, 0.32, 0.8, 0.95], [0.98, 0.63, 0.22, 0.55, 0.9]] },
    far:  { seed: 3, base: 0.72, domes: [[0.12, 0.1, 0.18], [0.55, 0.07, 0.22], [0.92, 0.11, 0.16]], swell: 0.006, lit: '#E2D8FA', mid: '#CCBEF4', dark: '#B6A5EC', haze: '#EFE9FC', hazeA: 0.5, density: 34, grass: 0.7 },
    mid:  { seed: 11, base: 0.8, domes: [[0.2, 0.17, 0.2], [0.82, 0.13, 0.2]], swell: 0.01, lit: '#C3AEF4', mid: '#9C82E6', dark: '#7558D2', sun: '#F6DDF0', sunA: 0.4, density: 26, grass: 0.9, haze: '#E9E0FA', hazeA: 0.18 },
    near: { seed: 21, base: 0.93, domes: [[0.05, 0.18, 0.17], [0.5, 0.15, 0.3], [0.97, 0.2, 0.19]], swell: 0.012, lit: '#A487EE', mid: '#6F50D3', dark: '#432996', sun: '#F9CFE6', sunA: 0.55, sunX: 0.3, density: 16, grass: 1.2 },
    shrubs: { seed: 5, base: 1.0, domes: [[0.16, 0.06, 0.2], [0.84, 0.05, 0.2]], swell: 0.012, lit: '#8763D6', mid: '#2E1B57', dark: '#150B28', tip: '#EBB8E8' },
  };
  const NIGHT = {
    far:  { seed: 4, base: 0.71, domes: [[0.1, 0.09, 0.2], [0.9, 0.11, 0.2], [0.5, 0.03, 0.2]], swell: 0.008, lit: '#4B3A86', mid: '#3B2D6E', dark: '#2C2157', haze: '#3A2A6E', hazeA: 0.4, density: 40, grass: 0.7 },
    mid:  { seed: 12, base: 0.8, domes: [[0.22, 0.1, 0.2], [0.78, 0.12, 0.22]], swell: 0.01, lit: '#3C2A72', mid: '#2A1D55', dark: '#1D1440', sun: '#6E58B8', sunA: 0.25, sunX: 0.6, density: 30, grass: 0.9 },
    near: { seed: 23, base: 0.88, domes: [[0.05, 0.1, 0.2], [0.55, 0.08, 0.26], [0.98, 0.12, 0.18]], swell: 0.012, lit: '#2B1D52', mid: '#1C1238', dark: '#110B22', sun: '#5B47A6', sunA: 0.3, sunX: 0.62, density: 20, grass: 1.1 },
    shrubs: { seed: 8, base: 0.9, domes: [[0.15, 0.05, 0.2], [0.85, 0.06, 0.2]], swell: 0.012, lit: '#4A3486', mid: '#160E2C', dark: '#0C0816', tip: '#9C7FE6' },
  };
  // a layer is drawn on a canvas taller than the view (so it can rise without a gap);
  // its ridge is given in view heights, so convert it to canvas heights
  const scaleL = (L, k) => Object.assign({}, L, { base: L.base / k, domes: L.domes.map(([c, h, s]) => [c, h / k, s]), swell: L.swell / k });

  function drawLandscape(W, Hh, set, cv, travel) {
    for (const name of Object.keys(cv)) {
      const L = set[name]; if (!L || !cv[name]) continue;
      const k = 1 + (travel[name] || 0) * 1.05;
      if (name === 'clouds') H.clouds(cv[name], L, W, Hh);
      else if (name === 'shrubs') H.shrubs(cv[name], scaleL(L, k), W, Hh * k);
      else H.hill(cv[name], scaleL(L, k), W, Hh * k);
    }
  }

  let ottoHero = null, card = null, demoTyped = false, notchState = '';
  function buildScreen() {
    const host = $('#hero-otto');
    ottoHero = new UI.Otto(host, { interactive: true, simple: true, notchW: 185, notchH: 32, presence: true, margin: 0, panelH: 330 });
    host.insertAdjacentHTML('beforeend', UI.Otto.prototype.meetHTML.call({}));
    card = host.querySelector('.ot-mcard');
  }

  function layoutHero() {
    const W = stage.clientWidth, Hh = stage.clientHeight;
    const mobile = W < 760;
    const vdw = mobile ? 500 : 1180, vdh = mobile ? 620 : 740;   // on a phone: the top middle of the screen, around the notch
    TRAVEL = mobile ? TRAVEL_M : TRAVEL_D;
    screen.classList.toggle('is-m', mobile);
    screen.style.setProperty('--vdw', vdw); screen.style.setProperty('--vdh', vdh);
    const sw = mobile ? W - 28 : Math.min(1060, W * 0.84);
    screen.style.setProperty('--sw', sw + 'px');
    const pad = mobile ? 12 : 18;
    const dw = sw - pad;
    vd.style.transform = `scale(${dw / vdw})`;
    const sh = dw * vdh / vdw + pad;
    const copyBottom = copy.offsetTop + copy.offsetHeight;
    const y0 = copyBottom + (mobile ? 36 : 54);
    const y1 = mobile ? Math.max(84, (Hh - sh) / 2 - 50) : Math.max(84, (Hh - sh) / 2 + 10);
    G = { W, Hh, y0, y1, sh, mobile };
    if (card) card.style.width = Math.min(596, vdw - 24) + 'px';
  }

  let lastW = 0, lastH = 0;
  function paintHero(force) {
    const W = stage.clientWidth, Hh = stage.clientHeight;
    if (!force && W === lastW && Math.abs(Hh - lastH) < 140) return;
    lastW = W; lastH = Hh;
    drawLandscape(W, Hh, DAY, layers, TRAVEL);
  }

  function heroFrame() {
    const r = hero.getBoundingClientRect();
    const total = r.height - G.Hh;
    const p = reduce ? 0 : clamp(-r.top / total);
    const rise = ease(clamp(p / 0.5));
    const y = lerp(G.y0, G.y1, rise);
    screen.style.transform = `translate3d(-50%, ${y.toFixed(1)}px, 0) scale(${lerp(0.96, 1, rise).toFixed(4)})`;
    copy.style.transform = `translate3d(0, ${(-(G.y0 - y) * 0.85).toFixed(1)}px, 0)`;
    copy.style.opacity = (1 - clamp(p / 0.32)).toFixed(3);
    for (const [k, el] of Object.entries(layers)) {
      if (!el) continue;
      const q = k === 'shrubs' ? ease(clamp((p - 0.12) / 0.8)) : p;   // the bushes wait, then rise in front of the screen
      el.style.transform = `translate3d(0, ${(-q * TRAVEL[k] * G.Hh).toFixed(1)}px, 0)`;
    }
    // night rises from the bottom of the view into the dark section below
    const d = clamp((p - 0.66) / 0.34);
    dusk.style.transform = `translate3d(0, ${(reduce ? G.Hh * 0.4 : lerp(G.Hh, 0, ease(d))).toFixed(1)}px, 0)`;
    if (cue) cue.style.opacity = p > 0.03 ? 0 : 1;

    // the notch, driven by the scroll
    if (ottoHero) {
      const st = reduce ? 'open' : p < 0.14 ? 'idle' : p < 0.2 ? 'hover' : 'open';
      if (st !== notchState) { notchState = st; ottoHero.setState(st); }
      card.classList.toggle('show', reduce || p >= 0.4);
      if (!reduce && p >= 0.58 && !demoTyped && !ottoHero.touched) { demoTyped = true; ottoHero.demo('Water the plants'); }
    }
    return d;
  }

  /* ================= intro: words light up ================= */
  const introP = $('.intro p');
  let words = [];
  if (introP) {
    introP.innerHTML = introP.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    words = $$('.w', introP);
  }
  function introFrame(vh) {
    if (!words.length || reduce) return;
    const r = introP.getBoundingClientRect();
    const q = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3));
    const n = Math.round(q * words.length * 1.04);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  }

  /* ================= night ================= */
  const night = $('.night');
  const nightLayers = { far: $('#n-far'), mid: $('#n-mid'), near: $('#n-near'), shrubs: $('#n-shrubs') };
  const NTRAVEL = { far: 0.06, mid: 0.12, near: 0.2, shrubs: 0.34 };
  function paintNight() { if (night) drawLandscape(night.clientWidth, night.clientHeight, NIGHT, nightLayers, NTRAVEL); }
  function nightFrame(vh) {
    if (!night || reduce) return;
    const r = night.getBoundingClientRect();
    if (r.top > vh || r.bottom < 0) return;
    const p = clamp((vh - r.top) / (vh + r.height));
    for (const [k, el] of Object.entries(nightLayers)) if (el) el.style.transform = `translate3d(0, ${((0.5 - p) * NTRAVEL[k] * r.height).toFixed(1)}px, 0)`;
  }

  /* ================= theme engine ================= */
  const secs = $$('[data-theme]');
  function themeFrame(vh, duskT) {
    let i = -1;
    secs.forEach((s, k) => { if (s.getBoundingClientRect().top <= vh * 0.85) i = k; });
    if (i <= 0) return applyTheme(THEMES.light, THEMES.dark, duskT);
    const cur = THEMES[secs[i].dataset.theme];
    const prev = THEMES[secs[i].dataset.from || secs[i - 1].dataset.theme];
    const t = clamp((vh * 0.85 - secs[i].getBoundingClientRect().top) / (vh * 0.5));
    applyTheme(prev, cur, t);
  }

  /* ================= demos, scaled to their frames ================= */
  function fitFrames() {
    $$('.frame[data-w]').forEach((f) => {
      const W = +f.dataset.w, Hh = +f.dataset.h, inner = f.querySelector('.fit');
      inner.style.width = W + 'px'; inner.style.height = Hh + 'px';
      const apply = () => {
        const k = Math.min(1, f.clientWidth / W);
        inner.style.transform = `translateX(-50%) scale(${k})`;
        f.style.height = Math.round(Hh * k) + 'px';
      };
      new ResizeObserver(apply).observe(f); apply();
    });
  }

  /* ================= wiring ================= */
  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = innerHeight;
    const d = heroFrame();
    introFrame(vh); nightFrame(vh); themeFrame(vh, d);
  };
  const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function init() {
    buildScreen();
    layoutHero(); paintHero(true); paintNight();
    fitFrames();
    window.Otto3.furniture();
    window.Otto3.demos();
    frame();
    addEventListener('scroll', ask, { passive: true });
    let t;
    addEventListener('resize', () => {
      layoutHero(); ask();
      clearTimeout(t); t = setTimeout(() => { paintHero(false); paintNight(); }, 180);
    });
    document.documentElement.classList.add('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
