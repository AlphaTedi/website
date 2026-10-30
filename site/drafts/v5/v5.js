/* Otto v5 — smooth scroll, the light-to-dark theme, the tilting Mac, and the panels that play on their own. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const UI = window.OttoUI, O3 = window.Otto3, H = window.OttoHills;

  /* a tiny helper: run fn(visible) whenever the element enters or leaves the view */
  const watch = (el, fn, opts = { threshold: 0.2 }) => { if (el) new IntersectionObserver(([e]) => fn(e.isIntersecting), opts).observe(el); };

  /* ================= smooth scroll ================= */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, autoRaf: true, anchors: { offset: -20 }, allowNestedScroll: true });
    window.lenis = lenis;
  }

  /* ================= themes ================= */
  const THEMES = {
    light:  { bg: [245, 242, 251], fg: [24, 19, 36],   muted: [104, 97, 122],  line: [24, 19, 36],    lineA: 0.1 },
    dark:   { bg: [13, 10, 20],    fg: [243, 240, 250], muted: [150, 143, 166], line: [255, 255, 255], lineA: 0.09 },
    violet: { bg: [25, 16, 50],    fg: [243, 240, 250], muted: [172, 160, 210], line: [255, 255, 255], lineA: 0.11 },
  };
  const root = document.documentElement.style;
  // the background fades all the way (through a violet, not a grey); the text swaps in the middle,
  // so it always reads against whatever the background is at that moment
  const TINT = [6, -8, 30];
  const mixT = (a, b, t) => {
    const tf = t <= 0.38 ? 0 : t >= 0.62 ? 1 : (t - 0.38) / 0.24;
    const glow = a === b ? 0 : 4 * t * (1 - t);
    const m = (x, y, k, tint) => x.map((v, i) => Math.round(clamp(v + (y[i] - v) * k + (tint ? TINT[i] * glow : 0), 0, 255))).join(' ');
    return { bg: m(a.bg, b.bg, t, true), fg: m(a.fg, b.fg, tf), muted: m(a.muted, b.muted, tf), line: m(a.line, b.line, tf), lineA: (a.lineA + (b.lineA - a.lineA) * tf).toFixed(3) };
  };
  let lastKey = '', lastNav = null;
  const applyTheme = (a, b, k, nav) => {
    const t = mixT(a, b, k);
    const key = t.bg + t.fg + t.muted;
    if (key !== lastKey) {
      lastKey = key;
      root.setProperty('--bg', t.bg); root.setProperty('--fg', t.fg); root.setProperty('--muted', t.muted);
      root.setProperty('--line', t.line); root.setProperty('--lineA', t.lineA);
    }
    setNav(nav || (k < 0.5 ? a : b));
  };
  const setNav = (n) => {
    if (n !== lastNav) {
      lastNav = n;
      const j = (c) => c.join(' ');
      root.setProperty('--nbg', j(n.bg)); root.setProperty('--nfg', j(n.fg)); root.setProperty('--nmuted', j(n.muted));
      root.setProperty('--nline', j(n.line)); root.setProperty('--nlineA', n.lineA);
      const meta = $('meta[name="theme-color"]'); if (meta) meta.content = `rgb(${j(n.bg).replaceAll(' ', ',')})`;
    }
  };
  const secs = $$('main [data-theme]'), mainEl = $('#main');
  function themeFrame(vh) {
    const at = vh * 0.72;
    let i = 0;
    secs.forEach((s, k) => { if (s.getBoundingClientRect().top <= at) i = k; });
    const cur = THEMES[secs[i].dataset.theme];
    if (i === 0) return applyTheme(cur, cur, 1);
    const prev = THEMES[secs[i - 1].dataset.theme];
    const t = clamp((at - secs[i].getBoundingClientRect().top) / (vh * 0.38));
    // once the page has lifted off the footer, the nav sits on the dark footer
    applyTheme(prev, cur, t, mainEl.getBoundingClientRect().bottom < 90 ? THEMES.dark : null);
  }

  /* ================= nav ================= */
  const nav = $('#nav');
  const navFrame = () => nav.classList.toggle('solid', scrollY > 24);

  /* ================= hero: the Mac straightens up, the notch opens ================= */
  const product = $('#product'), vd = $('.vd'), screenEl = $('.mac-screen');
  let G = { mobile: false };
  let otto = null, card = null, notchState = '', heroVisible = true, looping = false;

  function buildHero() {
    otto = new UI.Otto($('#hero-otto'), { interactive: true, simple: true, notchW: 185, notchH: 32, presence: true, margin: 0, panelH: 330 });
    $('#hero-otto').insertAdjacentHTML('beforeend', UI.Otto.prototype.meetHTML.call({}));
    card = $('#hero-otto .ot-mcard');
    watch(product, (v) => { heroVisible = v; if (v && notchState === 'open') heroLoop(); }, { threshold: 0.05 });
  }
  function layoutHero() {
    const mobile = innerWidth < 640;
    G.mobile = mobile;
    const vdw = mobile ? 520 : 1440, vdh = mobile ? 640 : 900;
    product.style.setProperty('--vdw', vdw); product.style.setProperty('--vdh', vdh);
    product.classList.toggle('is-m', mobile);
    vd.style.transform = `scale(${screenEl.clientWidth / vdw})`;
    if (card) card.style.width = Math.min(596, vdw - 24) + 'px';
  }
  function heroFrame() {
    const span = G.mobile ? 340 : 520;
    const q = reduce ? 1 : clamp(scrollY / span);
    if (!reduce) {
      const rot = lerp(G.mobile ? 10 : 16, 0, q), sc = lerp(G.mobile ? 0.96 : 0.93, G.mobile ? 1.02 : 1.04, q), ty = lerp(0, G.mobile ? -50 : -120, q);
      product.style.transform = `perspective(1400px) translateY(${ty.toFixed(1)}px) scale(${sc.toFixed(4)}) rotateX(${rot.toFixed(3)}deg)`;
    }
    if (!otto) return;
    const st = q < 0.3 ? 'idle' : q < 0.46 ? 'hover' : 'open';
    if (st !== notchState) {
      notchState = st;
      if (!otto.touched || st === 'open') otto.setState(st);
      if (st === 'open') heroLoop();
    }
  }
  const resetHero = () => {
    otto.s.view = 'list';
    if (otto.s.active !== 'work') otto.switchTo('work');
    const sp = otto.space('work');
    sp.items = sp.items.filter((t) => t.title !== 'Water the plants');
    otto.render();
  };
  // once open, the notch shows what it can do: a new to-do, the next meeting, the other spaces, a note
  async function heroLoop() {
    if (looping || reduce) return;
    looping = true;
    const ok = () => heroVisible && notchState === 'open' && !otto.touched;
    while (ok()) {
      resetHero();
      await sleep(900); if (!ok()) break;
      await otto.demo('Water the plants'); if (!ok()) break;
      await sleep(2200); if (!ok()) break;
      otto.switchTo('personal'); await sleep(2600); if (!ok()) break;
      otto.switchTo('side'); await sleep(2400); if (!ok()) break;
      otto.switchTo('notes'); await sleep(1800); if (!ok()) break;
      otto.s.view = 'page'; otto.s.page = otto.s.notes[0].id; otto.render(); await sleep(3600); if (!ok()) break;
    }
    looping = false;
  }

  /* ================= fitting the small demos into their boxes ================= */
  function fitAll() {
    $$('.fit[data-w]').forEach((f) => {
      const W = +f.dataset.w, Hh = +f.dataset.h, box = f.parentElement;
      box.classList.add('fitbox');
      f.style.width = W + 'px'; f.style.height = Hh + 'px';
      const apply = () => {
        const k = Math.min(1, box.clientWidth / W);
        f.style.transform = `translateX(-50%) scale(${k})`;
        box.style.height = Math.round(Hh * k) + 'px';
        if (box.classList.contains('m-notch')) box.parentElement.style.setProperty('--nk', k.toFixed(3));   // the closed notch matches the open one
      };
      new ResizeObserver(apply).observe(box); apply();
    });
  }
  const child = (box) => { const d = document.createElement('div'); box.appendChild(d); return d; };
  const staticOtto = (host, o) => new UI.Otto(host, Object.assign({ interactive: false, simple: true, presence: false, notchW: 185, notchH: 32, panelH: 330, openW: 560 }, o));

  /* ================= 1 · the three blocks ================= */
  function gridBlock() {
    const viz = $('.viz-grid'); if (!viz) return;
    const tiles = $$('.tiles span', viz);
    const order = [0, 1, 2, 5, 8, 7, 6, 3];
    const say = ['Reading your calendars', 'Finding the link to join', 'Saving to Documents/Otto', 'Writing Work.md', 'Sorting today’s list', 'Listening for ⌃⇧N', 'Keeping the screenshot', 'Saving the link'];
    const label = $('.status span', viz);
    let k = 0, on = false, timer = 0;
    const step = () => {
      tiles.forEach((t) => t.classList.remove('on'));
      tiles[order[k % 8]].classList.add('on');
      label.style.opacity = 0;
      setTimeout(() => { label.textContent = say[k % 8]; label.style.opacity = 1; k++; }, 200);
    };
    if (reduce) { tiles[0].classList.add('on'); return; }
    watch(viz, (v) => { on = v; clearInterval(timer); if (v) { step(); timer = setInterval(step, 1500); } });
  }
  function typeBlock() {
    const viz = $('.viz-type'); if (!viz) return;
    const txt = $('.txt', viz), TEXT = 'Review the new onboarding';
    if (reduce) { txt.textContent = TEXT; viz.classList.add('s1', 's2'); return; }
    let on = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (on) {
        viz.classList.remove('s1', 's2', 'out'); txt.textContent = '';
        await sleep(500);
        for (const ch of TEXT) { if (!on) break; txt.textContent += ch; await sleep(42 + Math.random() * 46); }
        await sleep(450); viz.classList.add('s1');
        await sleep(650); viz.classList.add('s2');
        await sleep(3600); viz.classList.add('out');
        await sleep(700);
      }
      running = false;
    };
    watch(viz, (v) => { on = v; if (v) run(); });
  }
  function tickBlock() {
    const viz = $('.viz-tick'); if (!viz) return;
    const list = $('.tick-list', viz), count = $('.tick-head .n', viz);
    const ROWS = [
      ['Send the proposal to Simon', '#FFC36E'], ['Call the dentist', '#F49AC1'], ['Review the new onboarding', '#FFC36E'],
      ['MEET'], ['Expense the team dinner', '#F49AC1'], ['Reply to beta testers', '#A996FF'], ['Book the team offsite', '#FFC36E'], ['Water the plants', '#F49AC1'],
    ];
    const check = '<svg class="i" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    let n = 0, done = 5;
    const make = () => {
      const [t, c] = ROWS[n++ % ROWS.length];
      const el = document.createElement('div');
      if (t === 'MEET') {
        el.className = 'tk meet';
        el.innerHTML = `<span class="dot"></span><span class="lb">Design sync · 9:30</span><span class="st">in 5 min</span><div class="acts"><span>Snooze <kbd>S</kbd></span><span class="join">Join <kbd>⌘</kbd><kbd>↩</kbd></span></div>`;
      } else {
        el.className = 'tk';
        el.style.setProperty('--c', c);
        el.innerHTML = `<span class="dot"></span><span class="lb">${t}</span><span class="st">Up next</span>`;
      }
      return el;
    };
    for (let i = 0; i < 6; i++) list.appendChild(make());
    const focus = () => list.children[1];
    const markDone = (el) => {
      el.classList.add('live');
      setTimeout(() => { el.querySelector('.st').innerHTML = `${check}Done`; el.classList.remove('live'); done++; count.textContent = done; }, 700);
    };
    if (reduce) { markDone(list.children[0]); return; }
    let on = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (on) {
        const f = focus();
        if (f.classList.contains('meet')) {
          f.classList.add('live');
          await sleep(1600);
          const j = f.querySelector('.join'); j.classList.add('press'); await sleep(220); j.classList.remove('press');
          f.classList.add('joined'); f.querySelector('.st').innerHTML = `${check}Joined at 9:30`;
          await sleep(1600);
        } else {
          markDone(f);
          await sleep(1700);
        }
        if (!on) break;
        // slide the list up by one row, then recycle the top row at the bottom
        const first = list.children[0];
        const shift = first.offsetHeight + 10;
        list.style.transition = ''; list.style.transform = `translateY(${-shift}px)`;
        await sleep(950);
        list.style.transition = 'none'; list.style.transform = 'none';
        first.remove(); list.appendChild(make());
        void list.offsetHeight; list.style.transition = '';
      }
      running = false;
    };
    watch(viz, (v) => { on = v; if (v) run(); });
  }

  /* ================= painted skies and hills (from the v4 landscape) ================= */
  const P = {
    morning: {
      far: { seed: 3, base: 0.8, domes: [[0.15, 0.08, 0.2], [0.6, 0.06, 0.24], [0.95, 0.09, 0.18]], swell: 0.006, lit: '#E2D8FA', mid: '#CCBEF4', dark: '#B6A5EC', haze: '#EFE9FC', hazeA: 0.5, density: 34, grass: 0.7 },
      mid: { seed: 11, base: 0.88, domes: [[0.25, 0.1, 0.2], [0.85, 0.09, 0.2]], swell: 0.01, lit: '#C3AEF4', mid: '#9C82E6', dark: '#7558D2', sun: '#F6DDF0', sunA: 0.4, density: 26, grass: 0.9, haze: '#E9E0FA', hazeA: 0.18 },
      near: { seed: 21, base: 0.97, domes: [[0.05, 0.1, 0.17], [0.5, 0.07, 0.3], [0.97, 0.12, 0.19]], swell: 0.012, lit: '#A487EE', mid: '#6F50D3', dark: '#432996', sun: '#F9CFE6', sunA: 0.55, sunX: 0.3, density: 16, grass: 1.2 },
    },
    dusk: {
      far: { seed: 6, base: 0.8, domes: [[0.2, 0.08, 0.22], [0.75, 0.1, 0.22]], swell: 0.007, lit: '#C98BB8', mid: '#A9709F', dark: '#8A5A8C', haze: '#F0B2AE', hazeA: 0.45, density: 34, grass: 0.7 },
      mid: { seed: 13, base: 0.88, domes: [[0.08, 0.1, 0.18], [0.55, 0.08, 0.26]], swell: 0.01, lit: '#8E5A9E', mid: '#6A3F86', dark: '#4A2A6C', sun: '#F7B49C', sunA: 0.35, sunX: 0.7, density: 26, grass: 0.9 },
      near: { seed: 24, base: 0.97, domes: [[0.3, 0.1, 0.22], [0.9, 0.12, 0.2]], swell: 0.012, lit: '#5A3580', mid: '#3B2160', dark: '#241340', sun: '#E890A8', sunA: 0.35, sunX: 0.72, density: 16, grass: 1.2 },
    },
    night: {
      far: { seed: 4, base: 0.8, domes: [[0.2, 0.08, 0.2], [0.7, 0.1, 0.22]], swell: 0.008, lit: '#4B3A86', mid: '#3B2D6E', dark: '#2C2157', haze: '#3A2A6E', hazeA: 0.4, density: 40, grass: 0.7 },
      mid: { seed: 12, base: 0.88, domes: [[0.1, 0.1, 0.18], [0.6, 0.12, 0.24]], swell: 0.01, lit: '#3C2A72', mid: '#2A1D55', dark: '#1D1440', sun: '#6E58B8', sunA: 0.25, sunX: 0.6, density: 30, grass: 0.9 },
      near: { seed: 23, base: 0.97, domes: [[0.3, 0.1, 0.22], [0.88, 0.12, 0.2]], swell: 0.012, lit: '#2B1D52', mid: '#1C1238', dark: '#110B22', sun: '#5B47A6', sunA: 0.3, sunX: 0.62, density: 20, grass: 1.1 },
    },
  };
  // shift a layer's ridge down (or up) and squash its domes, for boxes with a different shape
  const fitL = (L, base, k = 1) => Object.assign({}, L, { base, domes: L.domes.map(([c, h, s]) => [c, h * k, s]) });
  function paintSet(cvs, set, W, Hh, bases, k) {
    ['far', 'mid', 'near'].forEach((n, i) => { if (cvs[i]) H.hill(cvs[i], fitL(set[n], bases[i], k), W, Hh); });
  }
  function paintAll() {
    if (!H) return;
    $$('.scene').forEach((sc) => {
      const W = sc.clientWidth, Hh = sc.clientHeight; if (!W) return;
      paintSet($$('canvas', sc), P[sc.dataset.sky], W, Hh, [0.8, 0.88, 0.97], 0.9);
    });
    const tb = $('.trust-bg');
    if (tb) {
      const W = tb.clientWidth, Hh = tb.clientHeight;
      const cv = $$('canvas', tb);
      // the ridges sit around the middle of the section, behind the dial, like a horizon
      paintSet(cv, P.night, W, Hh, [0.66, 0.74, 0.84], 0.55);
    }
    const nb = $('.nb-sky');
    if (nb) { const box = nb.parentElement; H.hill(nb, fitL(P.dusk.mid, 0.86, 0.9), box.clientWidth, box.clientHeight); }
    const pf = $('.pf-sky');
    if (pf) { const box = pf.parentElement; H.hill(pf, fitL(P.morning.mid, 0.92, 0.8), box.clientWidth, box.clientHeight); }
  }

  /* ================= 2 · tour: steps with a progress ring ================= */
  function tour() {
    const steps = $$('.step'), scenes = $$('.scene'); if (!steps.length) return;
    const DUR = 7000;
    let cur = 0, p = 0, on = false, last = 0;
    const demos = {};
    const select = (i) => {
      cur = i; p = 0;
      steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-pressed', String(k === i)); s.style.setProperty('--p', 0); });
      scenes.forEach((s, k) => s.classList.toggle('on', k === i));
      Object.entries(demos).forEach(([k, d]) => d && d.active && d.active(+k === i && on));
    };
    steps.forEach((s, i) => s.addEventListener('click', () => select(i)));
    // the three scenes
    scenes.forEach((sc, i) => {
      const box = $('.demo', sc), kind = box.dataset.demo;
      if (kind === 'keys') demos[i] = keysDemo(box);
      if (kind === 'notes') { const o = staticOtto(child(box), { panelH: 0, notchH: 0, openW: 560 }); o.s.active = 'notes'; o.s.view = 'page'; o.s.page = o.s.notes[0].id; o.render(); o.setState('open', true); }
      if (kind === 'meeting') demos[i] = meetDemo(box);
    });
    const tick = (now) => {
      if (!on) return;
      const dt = Math.min(64, now - (last || now)); last = now;
      p += dt / DUR;
      steps[cur].style.setProperty('--p', Math.min(1, p).toFixed(4));
      if (p >= 1) select((cur + 1) % steps.length);
      requestAnimationFrame(tick);
    };
    if (reduce) { select(0); steps[0].style.setProperty('--p', 1); return; }
    watch($('.tour'), (v) => { on = v; last = 0; Object.entries(demos).forEach(([k, d]) => d && d.active && d.active(+k === cur && v)); if (v) requestAnimationFrame(tick); }, { threshold: 0.3 });
    select(0);
  }
  // ⌃⇧N pressed, the notch opens with the cursor in a new to-do
  function keysDemo(box) {
    const ks = $$('.keys span', box.closest('.ui'));
    const o = staticOtto(child(box), { panelH: 150 });
    o.fakeFocus = true; o.render();
    let live = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (live) {
        o.setState('idle'); ks.forEach((k) => k.classList.remove('down'));
        await sleep(1000);
        for (const k of ks) { k.classList.add('down'); await sleep(160); }
        await sleep(120); o.setState('open'); await sleep(450); ks.forEach((k) => k.classList.remove('down'));
        await sleep(2600);
      }
      running = false;
    };
    if (reduce) o.setState('open', true);
    return { active: (v) => { live = v && !reduce; if (live) run(); } };
  }
  // the closed notch counting down, then the card five minutes before
  function meetDemo(box) {
    const host = child(box);
    staticOtto(host, { presence: true });
    host.insertAdjacentHTML('beforeend', UI.Otto.prototype.meetHTML.call({}));
    const c = $('.ot-mcard', box); c.style.width = '540px';
    if (reduce) { c.classList.add('show'); return null; }
    let live = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (live) { c.classList.add('show'); await sleep(4200); c.classList.remove('show'); await sleep(1500); }
      running = false;
    };
    return { active: (v) => { live = v; if (live) run(); else c.classList.add('show'); } };
  }

  /* ================= segmented controls (layouts, FAQ) ================= */
  function seg(el, onPick) {
    const pill = $('.seg-pill', el), btns = $$('button', el);
    const place = () => { const b = btns.find((x) => x.getAttribute('aria-selected') === 'true') || btns[0]; pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px'; };
    const pick = (b, user) => { btns.forEach((x) => x.setAttribute('aria-selected', String(x === b))); place(); onPick(b, user); };
    btns.forEach((b) => b.addEventListener('click', () => pick(b, true)));
    new ResizeObserver(place).observe(el); place();
    document.fonts && document.fonts.ready.then(place);
    return { pick, btns };
  }

  /* ================= 3 · notch or floating ================= */
  function modes() {
    const stage = $('.mode-stage'); if (!stage) return;
    const n = $('[data-demo="mode-notch"]');
    staticOtto(child(n), { panelH: 330, openW: 596 }).setState('open', true);
    UI.mountFloating(child($('[data-demo="mode-float"]')));
    let user = false, timer = 0;
    const s = seg($('.modes .seg'), (b, byUser) => { stage.dataset.mode = b.dataset.mode; if (byUser) { user = true; clearInterval(timer); } });
    if (reduce) return;
    watch(stage, (v) => {
      clearInterval(timer);
      if (v && !user) timer = setInterval(() => { const next = s.btns.find((b) => b.getAttribute('aria-selected') !== 'true'); s.pick(next, false); }, 4800);
    }, { threshold: 0.4 });
  }

  /* ================= 4 · carousel ================= */
  function carousel() {
    const track = $('.car-track'); if (!track) return;
    const prev = $('.car .prev') || $('.cbtn.prev'), next = $('.cbtn.next'), dots = $$('.car-dots i');
    const stepW = () => { const c = $('.fc', track); return c ? c.offsetWidth + 20 : 400; };
    prev.addEventListener('click', () => track.scrollBy({ left: -stepW(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: stepW(), behavior: 'smooth' }));
    const upd = () => {
      const max = track.scrollWidth - track.clientWidth;
      const q = max > 0 ? track.scrollLeft / max : 0;
      const k = Math.round(q * (dots.length - 1));
      dots.forEach((d, i) => d.classList.toggle('on', i === k));
      prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft > max - 4;
    };
    track.addEventListener('scroll', upd, { passive: true });
    addEventListener('resize', upd); upd();
  }

  /* ================= 5 · numbers ================= */
  function numbers() {
    $$('[data-count]').forEach((el) => {
      const to = +el.dataset.count;
      if (reduce || to === 0) { el.textContent = to; return; }
      let done = false;
      watch(el, (v) => {
        if (!v || done) return; done = true;
        const t0 = performance.now(), D = 1400;
        const step = (now) => { const t = clamp((now - t0) / D); el.textContent = Math.round(ease(t) * to); if (t < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }, { threshold: 0.5 });
    });
  }

  /* ================= 6 · the sky behind “Private by default” ================= */
  const trust = $('.trust'), trustBg = $('.trust-bg'), dial = $('.dial-ticks');
  function trustFrame(vh) {
    if (!trust) return;
    const r = trust.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    const tv = reduce ? 1 : clamp((vh - r.top) / (vh * 0.9));
    trustBg.style.setProperty('--tv', ease(tv).toFixed(3));
    if (dial && !reduce) dial.style.setProperty('--dr', ((vh - r.top) * 0.05).toFixed(2) + 'deg');
  }

  /* ================= 7 · what's new: the meeting alert, joined with ⌘↩ ================= */
  function alertDemo() {
    const box = $('[data-demo="alert"]'); if (!box) return;
    const host = child(box);
    staticOtto(host, { presence: true });
    host.insertAdjacentHTML('beforeend', UI.Otto.prototype.meetHTML.call({}));
    const c = $('.ot-mcard', box); c.style.width = '540px'; c.classList.add('show');
    if (reduce) return;
    const join = $('.mb.join', c);
    let on = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (on) {
        await sleep(2600); if (!on) break;
        join.style.transition = 'transform .15s'; join.style.transform = 'scale(.93)';
        await sleep(180); join.style.transform = '';
      }
      running = false;
    };
    watch(box, (v) => { on = v; if (v) run(); });
  }

  /* ================= 8 · FAQ tabs ================= */
  function faq() {
    const el = $('.faq-sec .seg'); if (!el) return;
    const panels = $$('.faq-panel');
    seg(el, (b) => panels.forEach((p) => p.classList.toggle('on', p.dataset.panel === b.dataset.tab)));
  }

  /* ================= 9 · closing card ================= */
  function cta() {
    const box = $('[data-demo="cta"]'); if (!box) return;
    staticOtto(child(box), { panelH: 330, openW: 596 }).setState('open', true);
  }

  /* ================= footer: revealed as the page lifts off it, eyes that follow you ================= */
  const footer = $('#footer');
  function layoutFooter() {
    // the footer is revealed from behind the page, so it has to fit in the window: shrink the big logo if needed
    const mega = $('.mega', footer), wrapW = mega.parentElement.clientWidth;
    let w = wrapW;
    const set = (x) => { mega.style.setProperty('--mw', x + 'px'); mega.style.setProperty('--mwpx', x + 'px'); };
    set(w);
    const room = innerHeight - 30;
    let fh = footer.offsetHeight;
    if (fh > room) {
      const logoH = w * (430 / 883 - 0.17);
      w = Math.max(wrapW * 0.55, w * (1 - (fh - room) / logoH));
      set(w); fh = footer.offsetHeight;
    }
    const fits = fh <= room;
    footer.classList.toggle('static', !fits);
    root.setProperty('--fh', fits ? fh + 'px' : '0px');
  }
  function megaEyes() {
    const svg = $('#mega'); if (!svg) return;
    const eyes = [{ el: $('#eyeL'), cx: 144.487, cy: 249.857, rest: [167.15, 230.9] }, { el: $('#eyeR'), cx: 738.514, cy: 249.857, rest: [761.2, 230.9] }];
    const TRAVEL = 52;
    let target = null, cur = eyes.map((e) => [(e.rest[0] - e.cx) / TRAVEL, (e.rest[1] - e.cy) / TRAVEL]), lastMove = 0, saccade = [0.25, -0.2], blink = 1, blinking = false, inView = false;
    const apply = () => eyes.forEach((e, i) => e.el.setAttribute('transform', `translate(${(e.cx + cur[i][0] * TRAVEL).toFixed(2)} ${(e.cy + cur[i][1] * TRAVEL).toFixed(2)}) scale(1 ${blink.toFixed(3)})`));
    apply();
    if (reduce) return;
    addEventListener('pointermove', (ev) => {
      if (!inView) return;
      const r = svg.getBoundingClientRect(); lastMove = performance.now();
      target = eyes.map((e) => {
        const sx = r.left + (e.cx / 883) * r.width, sy = r.top + (e.cy / 430) * r.height;
        const dx = ev.clientX - sx, dy = ev.clientY - sy, d = Math.hypot(dx, dy) || 1, m = Math.min(d / (r.width * 0.35), 1);
        return [(dx / d) * m, (dy / d) * m];
      });
    }, { passive: true });
    const doBlink = async () => { if (blinking) return; blinking = true; for (let t = 0; t <= 1; t += 0.2) { blink = 1 - Math.sin(t * Math.PI) * 0.95; await sleep(22); } blink = 1; blinking = false; };
    setInterval(() => { if (inView && Math.random() < 0.8) doBlink(); }, 4300);
    setInterval(() => { saccade = [Math.random() * 1.4 - 0.7, Math.random() * 1.2 - 0.6]; }, 2600);
    watch(svg, (v) => { inView = v; }, { threshold: 0 });
    (function tick(now) {
      if (inView) {
        const idle = now - lastMove > 2500;
        cur = cur.map((c, i) => { const t = idle || !target ? saccade : target[i]; return [c[0] + (t[0] - c[0]) * 0.12, c[1] + (t[1] - c[1]) * 0.12]; });
        apply();
      }
      requestAnimationFrame(tick);
    })(performance.now());
  }

  /* ================= reveals ================= */
  function reveals() {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.sec').forEach((s) => $$('.rv', s).forEach((el, k) => { el.style.setProperty('--rd', Math.min(k * 0.07, 0.35) + 's'); io.observe(el); }));
  }

  /* ================= wiring ================= */
  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = innerHeight;
    navFrame(); heroFrame(); themeFrame(vh); trustFrame(vh);
  };
  const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // "Watch it open": scroll just far enough for the screen to straighten and the notch to open
  function peek() {
    const a = $('[data-peek]'); if (!a) return;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const y = G.mobile ? 300 : 380;
      if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  function init() {
    $$('.eyes-logo').forEach((el) => O3.OttoLogo(el, { fill: 'currentColor', reach: 0.6 }));
    buildHero(); layoutHero();
    fitAll();
    gridBlock(); typeBlock(); tickBlock();
    tour(); modes(); carousel(); numbers(); alertDemo(); faq(); cta();
    megaEyes(); layoutFooter(); reveals(); peek();
    paintAll();
    frame();
    addEventListener('scroll', ask, { passive: true });
    let t;
    addEventListener('resize', () => {
      layoutHero(); layoutFooter(); ask();
      clearTimeout(t); t = setTimeout(paintAll, 200);
    });
    new ResizeObserver(() => layoutFooter()).observe(footer);
    document.fonts && document.fonts.ready.then(() => { layoutFooter(); ask(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
