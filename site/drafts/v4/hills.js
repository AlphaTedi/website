/* Otto v4 — painted rolling hills, drawn once per size on canvas.
   Each layer is its own canvas so the page can move them at different speeds (parallax).
   Everything is seeded, so the landscape is the same on every visit and every resize. */
(() => {
  'use strict';

  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* A ridge made of a few broad domes plus a gentle swell: rolling, never jagged.
     Coordinates are normalised (x 0..1, y 0..1 of the canvas height). */
  function makeRidge(L, r) {
    const domes = L.domes.map(([c, h, s]) => [c + (r() - 0.5) * 0.04, h * (0.85 + r() * 0.3), s]);
    const ph = r() * 6.28, ph2 = r() * 6.28;
    return (u) => {
      let y = L.base;
      for (const [c, h, s] of domes) y -= h * Math.exp(-(((u - c) / s) ** 2));
      y += Math.sin(u * 6.1 + ph) * L.swell + Math.sin(u * 17.3 + ph2) * L.swell * 0.25;
      return y;
    };
  }

  function prepare(cv, W, H) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    return g;
  }

  /* ---------- a grassy hill layer ---------- */
  function hill(cv, L, W, H) {
    const g = prepare(cv, W, H);
    const r = rng(L.seed);
    const R = makeRidge(L, r);
    const y = (x) => R(x / W) * H;
    const lit = hex(L.lit), mid = hex(L.mid), dark = hex(L.dark), sun = hex(L.sun || L.lit);

    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 4; x += 4) g.lineTo(x, y(x));
    g.lineTo(W, H); g.closePath();
    const top = H * (L.base - Math.max(...L.domes.map((d) => d[1])));
    const grad = g.createLinearGradient(0, top, 0, H);
    grad.addColorStop(0, rgba(lit)); grad.addColorStop(0.35, rgba(mid)); grad.addColorStop(1, rgba(dark));
    g.fillStyle = grad; g.fill();

    g.save(); g.clip();
    // the sun comes from the upper left: a broad warm wash over the left slopes
    const sx = W * (L.sunX ?? 0.3), sy = y(sx) - H * 0.1;
    const lg = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.55);
    lg.addColorStop(0, rgba(sun, L.sunA ?? 0.45)); lg.addColorStop(1, rgba(sun, 0));
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // slopes facing away from the light are a little darker
    for (let x = 0; x < W; x += 3) {
      const slope = (y(x + 3) - y(x)) / 3;           // >0 = going down to the right (lit side)
      if (slope < 0) {
        const a = clamp(-slope * 0.9, 0, 0.32) * (L.shade ?? 1);
        const sg = g.createLinearGradient(0, y(x), 0, y(x) + H * 0.35);
        sg.addColorStop(0, rgba(dark, a)); sg.addColorStop(1, rgba(dark, 0));
        g.fillStyle = sg; g.fillRect(x, y(x), 3.2, H * 0.35);
      }
    }
    // grass: short strokes, denser and lighter near the crest
    const area = W * (H - top);
    const n = Math.round(area / (L.density || 26));
    const sc = L.grass || 1;
    for (let i = 0; i < n; i++) {
      const x = r() * W, yy = y(x);
      const d = (r() ** 1.7) * (H - yy);
      const py = yy + d;
      const k = 1 - d / (H - yy + 1);
      const len = (2 + r() * 5) * sc * (0.5 + 0.5 * k);
      const c = mix(dark, lit, clamp(k * 0.75 + (r() - 0.35) * 0.5, 0, 1));
      g.strokeStyle = rgba(c, 0.35 + r() * 0.5);
      g.lineWidth = (0.6 + r() * 0.9) * sc;
      g.beginPath(); g.moveTo(x, py); g.lineTo(x + (r() - 0.45) * len * 0.7, py - len); g.stroke();
    }
    g.restore();
    // a soft fuzzy rim on the crest, so the edge reads as grass and not as a cut
    for (let x = 0; x < W; x += 1.3) {
      const yy = y(x), len = (1 + r() * 3.2) * sc;
      g.strokeStyle = rgba(mix(mid, lit, 0.4 + r() * 0.6), 0.35 + r() * 0.4);
      g.lineWidth = 0.7 * sc;
      g.beginPath(); g.moveTo(x, yy + 1.5); g.lineTo(x + (r() - 0.5) * 1.6, yy - len); g.stroke();
    }
    // aerial perspective: far layers melt into the sky
    if (L.haze) {
      g.globalCompositeOperation = 'source-atop';
      const hg = g.createLinearGradient(0, top, 0, H);
      hg.addColorStop(0, rgba(hex(L.haze), L.hazeA ?? 0.4)); hg.addColorStop(1, rgba(hex(L.haze), (L.hazeA ?? 0.4) * 0.5));
      g.fillStyle = hg; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    return { ridge: y };
  }

  /* ---------- the foreground: a band of round shrubs ---------- */
  function shrubs(cv, L, W, H) {
    const g = prepare(cv, W, H);
    const r = rng(L.seed);
    const base = L.base * H;
    const unit = clamp(W / 1440, 0.45, 1.3);
    const lit = hex(L.lit), mid = hex(L.mid), dark = hex(L.dark), tip = hex(L.tip || L.lit);
    const R = makeRidge(L, r);
    // a solid dark band under the bushes
    g.fillStyle = rgba(dark);
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 4; x += 6) g.lineTo(x, R(x / W) * H + 30 * unit);
    g.lineTo(W, H); g.closePath(); g.fill();

    // rows of bushes all the way down: the lower (closer) ones a little bigger and in shadow
    const bushes = [];
    let off = 0;
    for (let row = 0; row < 40; row++) {
      const grow = 1 + Math.max(0, row - 2) * 0.12;
      for (let x = -40; x < W + 40;) {
        const rad = (16 + r() * 34) * unit * (row < 3 ? 1 - row * 0.1 : grow * 0.85);
        const cy = R(x / W) * H + off + (r() - 0.5) * 16 * unit;
        bushes.push({ x, y: cy, rad, row });
        x += rad * (0.9 + r() * 0.7);
      }
      off += 34 * unit * (row < 3 ? 1 : grow);
      if (base + off - 60 * unit > H) break;
    }
    bushes.sort((a, b) => a.y - b.y);
    const yMin = Math.min(...bushes.map((b) => b.y)), yMax = Math.min(H, yMin + 150 * unit);   // fog: fully dark ~150px below the crest
    for (const b of bushes) {
      // body
      const bg = g.createRadialGradient(b.x - b.rad * 0.35, b.y - b.rad * 0.45, b.rad * 0.1, b.x, b.y, b.rad * 1.1);
      bg.addColorStop(0, rgba(mix(mid, lit, 0.25))); bg.addColorStop(0.5, rgba(mid)); bg.addColorStop(1, rgba(dark));
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(b.x, b.y, b.rad * 0.92, b.rad * 0.74, 0, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 3; k++) { const a = r() * 6.28; g.beginPath(); g.ellipse(b.x + Math.cos(a) * b.rad * 0.5, b.y + Math.sin(a) * b.rad * 0.35, b.rad * 0.55, b.rad * 0.45, 0, 0, Math.PI * 2); g.fill(); }
      // leaves: small dabs, lit on the upper left
      const fogB = clamp((b.y - yMin) / (yMax - yMin + 1), 0, 1);
      const n = Math.round(b.rad * b.rad / (3.2 * unit * unit) * (1 - fogB * 0.7));
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * b.rad * 1.12;
        const lx = b.x + Math.cos(a) * d, ly = b.y + Math.sin(a) * d * 0.82;
        const light = clamp(0.5 - (Math.cos(a) * 0.5 + Math.sin(a) * 0.6) * (d / b.rad) + (r() - 0.5) * 0.5, 0, 1);
        const fog = fogB;
        const c0 = light > 0.86 ? mix(lit, tip, r() * 0.7) : mix(dark, lit, light * light * 0.8);
        const c = mix(c0, dark, fog * 0.55);
        g.fillStyle = rgba(c, 0.55 + r() * 0.45);
        const s = (0.7 + r() * 1.6) * unit;
        g.beginPath(); g.ellipse(lx, ly, s, s * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
      }
    }
    // a little flowering on top, like the reference light catching seed heads
    for (let i = 0; i < 160 * unit; i++) {
      const x = r() * W, yy = R(x / W) * H - r() * 30 * unit;
      g.fillStyle = rgba(tip, 0.25 + r() * 0.4);
      g.beginPath(); g.arc(x, yy, (0.6 + r() * 1.4) * unit, 0, Math.PI * 2); g.fill();
    }
    return { base };
  }

  /* ---------- painted clouds ----------
     Each cloud is one silhouette (puffs merged on an offscreen canvas), shaded top to bottom,
     then softened, so you never see the individual circles. */
  function clouds(cv, L, W, H) {
    const g = prepare(cv, W, H);
    const r = rng(L.seed);
    const unit = clamp(W / 1440, 0.5, 1.4);
    const white = hex(L.white), shade = hex(L.shade), deep = hex(L.deep || L.shade);
    const off = document.createElement('canvas');
    for (const c of L.items) {
      const cx = c[0] * W, cy = c[1] * H, w = c[2] * W, h = c[3] * unit * 150;
      const pad = h * 1.4;
      off.width = Math.ceil(w + pad * 2); off.height = Math.ceil(h * 2.6);
      const o = off.getContext('2d');
      o.clearRect(0, 0, off.width, off.height);
      const ox = cx - w / 2 - pad, oy = cy - h * 1.9;
      const puffs = [];
      for (let x = -w / 2; x < w / 2;) {
        const t = 1 - Math.abs(x) / (w / 2);
        const rad = (0.3 + 0.7 * Math.sqrt(t)) * h * (0.55 + r() * 0.55);
        puffs.push({ x: cx + x - ox, y: cy - rad * 0.5 - oy + (r() - 0.5) * h * 0.1, rad });
        x += rad * (0.35 + r() * 0.3);
      }
      // a flat-ish base, like real cumulus
      o.fillStyle = '#fff';
      for (const p of puffs) { o.beginPath(); o.arc(p.x, p.y, p.rad, 0, Math.PI * 2); o.fill(); }
      o.fillRect(puffs[0].x, cy - oy - h * 0.25, puffs[puffs.length - 1].x - puffs[0].x, h * 0.25);
      o.globalCompositeOperation = 'source-atop';
      const sg = o.createLinearGradient(0, cy - oy - h * 1.3, 0, cy - oy);
      sg.addColorStop(0, rgba(white)); sg.addColorStop(0.55, rgba(white)); sg.addColorStop(0.85, rgba(shade)); sg.addColorStop(1, rgba(deep));
      o.fillStyle = sg; o.fillRect(0, 0, off.width, off.height);
      // each puff gets a soft lit cap on its upper left
      for (const p of puffs) {
        const pg = o.createRadialGradient(p.x - p.rad * 0.3, p.y - p.rad * 0.45, 0, p.x - p.rad * 0.3, p.y - p.rad * 0.45, p.rad * 0.9);
        pg.addColorStop(0, rgba(white, 0.9)); pg.addColorStop(1, rgba(white, 0));
        o.fillStyle = pg; o.fillRect(p.x - p.rad * 1.3, p.y - p.rad * 1.4, p.rad * 2.2, p.rad * 2);
      }
      // the shadowed crease between puffs
      for (const p of puffs) {
        const pg = o.createRadialGradient(p.x + p.rad * 0.55, p.y + p.rad * 0.35, 0, p.x + p.rad * 0.55, p.y + p.rad * 0.35, p.rad * 0.7);
        pg.addColorStop(0, rgba(shade, 0.35)); pg.addColorStop(1, rgba(shade, 0));
        o.fillStyle = pg; o.fillRect(p.x - p.rad, p.y - p.rad, p.rad * 2.4, p.rad * 2.2);
      }
      o.globalCompositeOperation = 'source-over';
      g.filter = `blur(${(3 * unit).toFixed(1)}px)`;
      g.globalAlpha = c[4] ?? 1;
      g.drawImage(off, ox, oy);
      g.filter = 'none';
      // painterly strokes along the lit tops
      for (let i = 0; i < puffs.length * 90; i++) {
        const p = puffs[Math.floor(r() * puffs.length)];
        const a = -Math.PI * (0.1 + r() * 0.8), d = p.rad * (0.7 + r() * 0.3);
        const x = p.x + ox + Math.cos(a) * d, y = p.y + oy + Math.sin(a) * d;
        g.strokeStyle = rgba(white, 0.18 + r() * 0.3); g.lineWidth = (0.6 + r() * 0.8) * unit;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + 1.57) * 5 * unit, y + Math.sin(a + 1.57) * 5 * unit); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  window.OttoHills = { hill, shrubs, clouds };
})();
