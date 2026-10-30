/* Otto v5 — smooth scroll, the living hero gradient, the tilting Mac, and panels built from Otto's own UI. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const UI = window.OttoUI, O3 = window.Otto3;

  /* run fn(visible) whenever the element enters or leaves the view */
  const watch = (el, fn, opts = { threshold: 0.2 }) => { if (el) new IntersectionObserver(([e]) => fn(e.isIntersecting), opts).observe(el); };
  const child = (box, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; box.appendChild(d); return d; };
  const staticOtto = (host, o) => new UI.Otto(host, Object.assign({ interactive: false, simple: true, presence: false, notchW: 185, notchH: 32, panelH: 330, openW: 560 }, o));

  /* Lucide glyphs, as in the app */
  const G = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    list: '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
    listOrdered: '<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/>',
    listChecks: '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
    type: '<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
    braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  };
  const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${G[n]}</svg>`;

  /* ================= smooth scroll ================= */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, autoRaf: true, anchors: { offset: -20 }, allowNestedScroll: true });
    window.lenis = lenis;
  }

  /* ================= nav: appears once you scroll ================= */
  const nav = $('#nav');
  const navFrame = () => nav.classList.toggle('show', scrollY > 80);

  /* ================= hero: a living gradient (WebGL), with a CSS gradient underneath as the fallback ================= */
  const heroEl = $('.hero');
  const liquid = (() => {
    const cv = $('#liquid'); if (!cv) return null;
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision highp float;
      uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
      float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }
      float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<4;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
      vec3 C(float r,float g,float b){ return vec3(r,g,b)/255.; }
      void main(){
        vec2 uv = vec2(gl_FragCoord.x/uRes.x, 1.-gl_FragCoord.y/uRes.y);
        float asp = uRes.x/uRes.y;
        vec2 p = vec2(uv.x*asp, uv.y)*2.4;
        float t = uTime*.045;
        vec2 q = vec2(fbm(p+vec2(0.,t)), fbm(p+vec2(5.2,1.3)-t));
        vec2 r = vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*.6), fbm(p+3.*q+vec2(8.3,2.8)-t*.5));
        float n = fbm(p+2.4*r);
        float y = uv.y + (n-.5)*.16;
        vec3 col = C(236.,230.,252.);
        col = mix(col, C(214.,200.,250.), smoothstep(.04,.2,y));
        col = mix(col, C(168.,148.,243.), smoothstep(.18,.36,y));
        col = mix(col, C(106.,82.,226.), smoothstep(.34,.52,y));
        col = mix(col, C(58.,42.,156.), smoothstep(.5,.66,y));
        col = mix(col, C(28.,20.,80.), smoothstep(.64,.8,y));
        col = mix(col, C(13.,10.,20.), smoothstep(.78,.95,y));
        float band = smoothstep(.0,.16,uv.y)*(1.-smoothstep(.42,.62,uv.y));
        col = mix(col, C(246.,166.,212.), band*smoothstep(.46,.78,r.x)*.72);
        col = mix(col, C(255.,206.,184.), band*smoothstep(.5,.82,q.y)*.62);
        col = mix(col, C(140.,172.,255.), band*smoothstep(.54,.84,r.y)*.55);
        float deep = smoothstep(.4,.55,uv.y)*(1.-smoothstep(.72,.86,uv.y));
        col = mix(col, C(214.,120.,200.), deep*smoothstep(.6,.9,n)*.35);
        vec2 m = vec2(uMouse.x*asp, uMouse.y);
        float d = distance(vec2(uv.x*asp, uv.y), m);
        col = mix(col, C(255.,220.,205.), exp(-d*d*16.)*.28*band);
        gl_FragColor = vec4(col, 1.);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(pr, 'uRes'), uTime = gl.getUniformLocation(pr, 'uTime'), uMouse = gl.getUniformLocation(pr, 'uMouse');
    let on = true, raf = 0, t0 = performance.now(), mouse = [0.5, 0.18], mTarget = [0.5, 0.18];
    const size = () => {
      const k = innerWidth < 640 ? 0.5 : 0.4;          // a soft gradient doesn't need full resolution
      cv.width = Math.max(2, Math.round(heroEl.clientWidth * k)); cv.height = Math.max(2, Math.round(heroEl.clientHeight * k));
      gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, cv.width, cv.height);
    };
    const draw = (now) => {
      raf = 0;
      mouse = mouse.map((m, i) => m + (mTarget[i] - m) * 0.05);
      gl.uniform1f(uTime, reduce ? 12 : (now - t0) / 1000 + 12);
      gl.uniform2f(uMouse, mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (on && !reduce) raf = requestAnimationFrame(draw);
    };
    size(); draw(performance.now()); cv.classList.add('on');
    watch(heroEl, (vis) => { on = vis; if (on && !raf && !reduce) raf = requestAnimationFrame(draw); }, { threshold: 0 });
    addEventListener('pointermove', (e) => { if (!on) return; const r = heroEl.getBoundingClientRect(); mTarget = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }, { passive: true });
    return { size: () => { size(); if (!raf) draw(performance.now()); } };
  })();

  /* ================= hero: the Mac straightens up, the notch opens ================= */
  const product = $('#product'), vd = $('.vd'), screenEl = $('.mac-screen');
  let M = { mobile: false };
  let otto = null, notchState = '', heroVisible = true, looping = false;

  function buildHero() {
    otto = new UI.Otto($('#hero-otto'), { interactive: true, simple: true, notchW: 185, notchH: 32, presence: true, margin: 0, panelH: 330 });
    $('#hero-otto').insertAdjacentHTML('beforeend', UI.Otto.prototype.meetHTML.call({}));
    watch(product, (v) => { heroVisible = v; if (v && notchState === 'open') heroLoop(); }, { threshold: 0.05 });
  }
  function layoutHero() {
    const mobile = innerWidth < 640;
    M.mobile = mobile;
    const vdw = mobile ? 520 : 1440, vdh = mobile ? 640 : 900;
    product.style.setProperty('--vdw', vdw); product.style.setProperty('--vdh', vdh);
    product.classList.toggle('is-m', mobile);
    vd.style.transform = `scale(${screenEl.clientWidth / vdw})`;
    const card = $('#hero-otto .ot-mcard'); if (card) card.style.width = Math.min(596, vdw - 24) + 'px';
  }
  function heroFrame() {
    const span = M.mobile ? 340 : 520;
    const q = reduce ? 1 : clamp(scrollY / span);
    if (!reduce) {
      const rot = lerp(M.mobile ? 10 : 16, 0, q), sc = lerp(M.mobile ? 0.96 : 0.93, M.mobile ? 1.02 : 1.04, q), ty = lerp(0, M.mobile ? -50 : -120, q);
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
        if (box.classList.contains('m-notch')) box.parentElement.style.setProperty('--nk', k.toFixed(3));
      };
      new ResizeObserver(apply).observe(box); apply();
    });
  }

  /* ================= 1 · three blocks, made of Otto's own UI ================= */
  // a list that keeps getting done: the checkbox fills, the row bows out, the next one arrives
  function todosViz() {
    const box = $('[data-viz="todos"]'); if (!box) return;
    const chip = (k, v) => `<span class="dk-chip ${k}">${{ date: ic('calendar'), link: ic('link'), img: ic('image') }[k] || '@'}${v}</span>`;
    const ITEMS = [
      ['Send the proposal to Simon', [], [['date', 'today']]],
      ['Review the new onboarding', [], [['link', 'figma.com/onboarding']]],
      ['Fix the pricing table', [['img', 'Screenshot']], []],
      ['Call', [], [['at', 'matt']]],
      ['Book the team offsite', [], [['date', 'fri']]],
      ['Reply to Anna about the brief', [], []],
      ['Water the plants', [], []],
      ['Prep for Monday’s standup', [], []],
    ];
    const week = [3, 5, 2, 6, 4, 5];
    let n = 0, done = 4;
    box.innerHTML = `<div class="ot ot-dock ot-static" style="--dk:143,184,255;--sec:#9CC0FF;width:100%"><div class="pane list"><div class="ot-list"></div>
      <div class="pfoot"><span class="chk">${ic('check')}</span><span>Completed today</span><b>${done}</b><span class="spark">${week.map((v) => `<i style="height:${3 + v * 2}px"></i>`).join('')}<i class="today" style="height:${3 + done * 2}px"></i></span></div></div></div>`;
    const list = $('.ot-list', box), count = $('.pfoot b', box), today = $('.spark .today', box);
    const row = () => {
      const [t, pre, post] = ITEMS[n++ % ITEMS.length];
      const el = document.createElement('div');
      el.className = 'ot-row';
      el.innerHTML = `<div class="line"><button class="ot-cb" tabindex="-1" aria-hidden="true">${ic('check')}</button><span class="title">${pre.map((c) => chip(...c)).join('')}${t}${post.map((c) => chip(...c)).join('')}</span><span class="gutter"></span></div>`;
      return el;
    };
    for (let i = 0; i < 5; i++) list.appendChild(row());
    if (reduce) { list.children[0].classList.add('done'); $('.ot-cb', list.children[0]).classList.add('on'); return; }
    let on = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (on) {
        await sleep(1500); if (!on) break;
        const r = list.children[0];
        $('.ot-cb', r).classList.add('on'); r.classList.add('done');
        await sleep(420);
        r.style.maxHeight = r.offsetHeight + 'px'; void r.offsetHeight; r.classList.add('leave');
        await sleep(140);
        Object.assign(r.style, { maxHeight: '0px', minHeight: '0px', paddingTop: '0px', paddingBottom: '0px' });
        done++; count.textContent = done; today.style.height = Math.min(16, 3 + done * 1.2) + 'px';
        await sleep(420);
        r.remove();
        const nr = row(); nr.classList.add('enter'); list.appendChild(nr);
        if (done > 9) { done = 4; count.textContent = done; }
      }
      running = false;
    };
    watch(box, (v) => { on = v; if (v) run(); });
  }

  // a note that formats itself, with the tool that does it lighting up in the bar
  function noteViz() {
    const box = $('[data-viz="note"]'); if (!box) return;
    box.innerHTML = `<div class="ot ot-dock ot-static" style="width:100%"><div class="pane note">
      <div class="nhead"><b>Monday sync</b><span>Monday, Oct 12</span></div>
      <div class="ot-doc">
        <div class="ln" data-k="h">Agenda</div>
        <div class="ln" data-k="li">Q4 priorities</div>
        <div class="ln" data-k="li">Hiring update from <span class="b">Matt</span></div>
        <div class="ln" data-k="li">Launch date with <span class="lk">Simon</span></div>
        <div class="ln" data-k="q">Keep it to fifteen minutes</div>
        <div class="ln">Draft lives in <span class="cd">launch-plan.md</span></div>
      </div>
      <div class="tools"><b data-t="aa">Aa</b><i></i><span data-t="list">${ic('list')}</span><span data-t="num">${ic('listOrdered')}</span><span data-t="ck">${ic('listChecks')}</span><i></i><span data-t="type">${ic('type')}</span><span data-t="link">${ic('link')}</span><i></i><span data-t="code">${ic('code')}</span><span data-t="quote">${ic('quote')}</span><span data-t="block">${ic('braces')}</span></div>
    </div></div>`;
    const tool = (k) => $(`[data-t="${k}"]`, box);
    const lines = (k) => $$(`.ln[data-k="${k}"]`, box);
    const steps = [
      ['aa', () => lines('h').forEach((l) => l.classList.add('h'))],
      ['list', async () => { for (const l of lines('li')) { l.classList.add('li'); await sleep(140); } }],
      ['type', () => $('.b', box).classList.add('on')],
      ['link', () => $('.lk', box).classList.add('on')],
      ['quote', () => lines('q').forEach((l) => l.classList.add('q'))],
      ['code', () => $('.cd', box).classList.add('on')],
    ];
    const all = () => { $$('.ln', box).forEach((l) => l.classList.remove('h', 'li', 'q')); $$('.b, .lk, .cd', box).forEach((x) => x.classList.remove('on')); };
    if (reduce) { steps.forEach(([, f]) => f()); return; }
    let on = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (on) {
        all(); await sleep(900);
        for (const [k, f] of steps) {
          if (!on) break;
          const t = tool(k); t.classList.add('on'); await sleep(260);
          await f(); await sleep(520); t.classList.remove('on'); await sleep(380);
        }
        await sleep(2600);
      }
      running = false;
    };
    watch(box, (v) => { on = v; if (v) run(); });
  }

  // the countdown in the closed notch, the day's next meetings below it; five minutes before, the card, then Join
  function meetViz() {
    const box = $('[data-viz="meet"]'); if (!box) return;
    const host = child(box);
    const o = staticOtto(host, { presence: true, openW: 400 });
    host.insertAdjacentHTML('beforeend', UI.Otto.prototype.meetHTML.call({}));
    box.insertAdjacentHTML('beforeend', `<div class="upnext"><div class="h">LATER TODAY</div>
      <div class="ev" style="--c:#F4A9C4"><i></i><b>Lunch with Ana</b><time>12:30</time></div>
      <div class="ev" style="--c:#8FB8FF"><i></i><b>1:1 with Matt</b><time>15:00</time></div>
      <div class="ev" style="--c:#C3B1FF"><i></i><b>Launch review</b><time>17:30</time></div></div>
      <span class="joined">${ic('check')}Joined Design sync</span>`);
    const card = $('.ot-mcard', box), count = $('.ot-presence .count', box), join = $('.mb.join', card), joined = $('.joined', box);
    card.style.width = '400px';
    const setCount = (m) => { count.innerHTML = `<i></i>in ${m}′`; };
    setCount(5); card.classList.add('show');
    if (reduce) return;
    let on = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (on) {
        box.classList.remove('joining'); joined.classList.remove('on'); card.classList.remove('show');
        for (const m of [7, 6]) { setCount(m); await sleep(800); if (!on) break; }
        if (!on) break;
        setCount(5); card.classList.add('show'); await sleep(3400); if (!on) break;
        join.classList.add('press'); await sleep(200); join.classList.remove('press');
        box.classList.add('joining'); card.classList.remove('show'); await sleep(250);
        joined.classList.add('on'); await sleep(2000);
      }
      running = false;
    };
    watch(box, (v) => { on = v; if (v) run(); });
  }

  /* ================= 2 · tour: steps with a progress ring, the notch on the top edge ================= */
  function tour() {
    const steps = $$('.step'), scenes = $$('.scene'); if (!steps.length) return;
    const DUR = 7000;
    let cur = 0, p = 0, on = false, last = 0;
    const demos = {};
    const activate = () => Object.entries(demos).forEach(([k, d]) => d && d.active(+k === cur && on));
    const select = (i) => {
      cur = i; p = 0;
      steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.setAttribute('aria-pressed', String(k === i)); s.style.setProperty('--p', 0); });
      scenes.forEach((s, k) => s.classList.toggle('on', k === i));
      activate();
    };
    steps.forEach((s, i) => s.addEventListener('click', () => { select(i); }));
    scenes.forEach((sc, i) => {
      const box = $('.demo', sc), kind = box.dataset.demo;
      demos[i] = kind === 'keys' ? keysDemo(box, sc) : kind === 'notes' ? notesDemo(box) : meetDemo(box);
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
    watch($('.tour'), (v) => { on = v; last = 0; activate(); if (v) requestAnimationFrame(tick); }, { threshold: 0.3 });
    select(0);
  }
  // ⌃⇧N pressed, the notch opens with the cursor in a new to-do
  function keysDemo(box, scene) {
    const ks = $$('.keys span', scene);
    const o = staticOtto(child(box), { panelH: 150, openW: 596 });
    o.fakeFocus = true; o.render();
    if (reduce) { o.setState('open', true); return { active() {} }; }
    let live = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (live) {
        o.setState('idle'); ks.forEach((k) => k.classList.remove('down'));
        await sleep(1100); if (!live) break;
        for (const k of ks) { k.classList.add('down'); await sleep(160); }
        await sleep(120); o.setState('open'); await sleep(450); ks.forEach((k) => k.classList.remove('down'));
        await sleep(2800);
      }
      running = false;
    };
    return { active: (v) => { live = v; if (live) run(); } };
  }
  // the notch opens on a note
  function notesDemo(box) {
    const o = staticOtto(child(box), { panelH: 360, openW: 596 });
    o.s.active = 'notes'; o.s.view = 'page'; o.s.page = o.s.notes[0].id; o.render();
    if (reduce) { o.setState('open', true); return { active() {} }; }
    let was = false;
    return { active: async (v) => { if (v && !was) { o.setState('idle', true); await sleep(450); o.setState('open'); } was = v; } };
  }
  // the closed notch counting down, then the card five minutes before
  function meetDemo(box) {
    const host = child(box);
    staticOtto(host, { presence: true, openW: 560 });
    host.insertAdjacentHTML('beforeend', UI.Otto.prototype.meetHTML.call({}));
    const c = $('.ot-mcard', box); c.style.width = '540px';
    const cnt = $('.ot-presence .count', box); if (cnt) cnt.innerHTML = '<i></i>in 5′';
    if (reduce) { c.classList.add('show'); return { active() {} }; }
    let live = false, running = false;
    const run = async () => {
      if (running) return; running = true;
      while (live) { c.classList.remove('show'); await sleep(1200); if (!live) break; c.classList.add('show'); await sleep(4200); }
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
    if (document.fonts) document.fonts.ready.then(place);
    return { pick, btns };
  }

  /* ================= 3 · notch or floating ================= */
  function modes() {
    const stage = $('.mode-stage'); if (!stage) return;
    staticOtto(child($('[data-demo="mode-notch"]')), { panelH: 330, openW: 596 }).setState('open', true);
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
    const prev = $('.cbtn.prev'), next = $('.cbtn.next'), dots = $$('.car-dots i');
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

  /* ================= 5 · FAQ tabs ================= */
  function faq() {
    const el = $('.faq-sec .seg'); if (!el) return;
    const panels = $$('.faq-panel');
    seg(el, (b) => panels.forEach((p) => p.classList.toggle('on', p.dataset.panel === b.dataset.tab)));
  }

  /* ================= 6 · the gradient under the closing call rises as you arrive ================= */
  const fin = $('.finale'), finBg = $('.fin-bg');
  function finFrame(vh) {
    if (!fin) return;
    const r = fin.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    finBg.style.setProperty('--tv', (reduce ? 1 : ease(clamp((vh - r.top) / (vh * 0.95)))).toFixed(3));
  }

  /* ================= footer: revealed as the page lifts off it, eyes that follow you ================= */
  const footer = $('#footer'), root = document.documentElement.style;
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

  // "Watch it open": scroll just far enough for the screen to straighten and the notch to open
  function peek() {
    const a = $('[data-peek]'); if (!a) return;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const y = M.mobile ? 300 : 380;
      if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ================= wiring ================= */
  let raf = 0;
  const frame = () => { raf = 0; navFrame(); heroFrame(); finFrame(innerHeight); };
  const ask = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function init() {
    $$('.eyes-logo').forEach((el) => O3.OttoLogo(el, { fill: 'currentColor', reach: 0.6 }));
    buildHero(); layoutHero();
    fitAll();
    todosViz(); noteViz(); meetViz();
    tour(); modes(); carousel(); faq();
    megaEyes(); layoutFooter(); reveals(); peek();
    frame();
    addEventListener('scroll', ask, { passive: true });
    let t;
    addEventListener('resize', () => {
      layoutHero(); layoutFooter(); ask();
      clearTimeout(t); t = setTimeout(() => liquid && liquid.size(), 200);
    });
    new ResizeObserver(() => { layoutFooter(); }).observe(footer);
    if (document.fonts) document.fonts.ready.then(() => { layoutFooter(); liquid && liquid.size(); ask(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
