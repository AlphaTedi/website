/* ottotofive.com — the Worker in front of the static site.
 *
 * Almost every request goes straight to the files in site/. The Worker only runs first for the home
 * page, the download and /stats (see run_worker_first in wrangler.jsonc), to count two things:
 *   - visits to the home page
 *   - downloads of /downloads/Otto.dmg
 *
 * No cookies, nothing in the browser, no third party. To tell people apart within one day, the IP
 * address and browser are mixed with a random secret that changes every day and is then thrown away,
 * together with that day's fingerprints: only the daily totals are kept.
 *
 * The numbers are at /stats, behind a password set as the Worker secret STATS_KEY
 * (Cloudflare dashboard › Workers › otto-site › Settings › Variables and Secrets), and the daily
 * totals are mirrored to the D1 database "otto-site-stats" for the dashboard in Claude.
 */
import { DurableObject } from 'cloudflare:workers';

const TZ = 'Europe/Amsterdam';
const DMG = '/downloads/Otto.dmg';
// The DMG itself lives on GitHub: every Otto release uploads it as Otto.dmg, and this address always
// answers with the newest one. /downloads/Otto.dmg counts the download and sends people there, so the
// site never has to change for a release.
const LATEST = 'https://github.com/AlphaTedi/Otto/releases/latest/download/Otto.dmg';
// link previews, crawlers, monitors and scripts: not people
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|linkedin|skype|curl|wget|python|httpie|axios|node-fetch|undici|go-http|okhttp|java\/|libwww|headless|phantom|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|statuscake|scan|check/i;

const dayOf = (d = new Date()) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
};

/* ---------------- the counter: one Durable Object, a small SQLite table ---------------- */
export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS daily (
      day TEXT PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0, visitors INTEGER NOT NULL DEFAULT 0,
      downloads INTEGER NOT NULL DEFAULT 0, downloaders INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS seen (kind TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (kind, hash))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
  }

  // today's secret; on a new day, forget yesterday's fingerprints and the secret they were made with
  salt(day) {
    const cur = this.sql.exec(`SELECT v FROM meta WHERE k = 'day'`).toArray()[0];
    if (cur && cur.v === day) return this.sql.exec(`SELECT v FROM meta WHERE k = 'salt'`).one().v;
    const salt = crypto.randomUUID() + crypto.randomUUID();
    this.sql.exec(`DELETE FROM seen`);
    this.sql.exec(`INSERT OR REPLACE INTO meta (k, v) VALUES ('day', ?), ('salt', ?)`, day, salt);
    return salt;
  }

  async hit(kind, who) {
    const day = dayOf();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(this.salt(day) + '|' + who));
    const hash = [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
    const fresh = this.sql.exec(`INSERT OR IGNORE INTO seen (kind, hash) VALUES (?, ?)`, kind, hash).rowsWritten > 0 ? 1 : 0;
    this.sql.exec(`INSERT OR IGNORE INTO daily (day) VALUES (?)`, day);
    if (kind === 'view') this.sql.exec(`UPDATE daily SET views = views + 1, visitors = visitors + ? WHERE day = ?`, fresh, day);
    else this.sql.exec(`UPDATE daily SET downloads = downloads + 1, downloaders = downloaders + ? WHERE day = ?`, fresh, day);
    await this.mirror(day);
  }

  // copy the day's totals to the D1 database "otto-site-stats", which the dashboard in Claude reads.
  // Only totals go there; the fingerprints and the day's secret never leave this object.
  // MAX(): two writes landing out of order can't make a number go back.
  async mirror(day) {
    if (!this.env.DB) return;
    const r = this.sql.exec(`SELECT day, visitors, views, downloaders, downloads FROM daily WHERE day = ?`, day).one();
    await this.env.DB.prepare(`INSERT INTO daily (day, visitors, views, downloaders, downloads) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(day) DO UPDATE SET visitors = MAX(visitors, excluded.visitors), views = MAX(views, excluded.views),
      downloaders = MAX(downloaders, excluded.downloaders), downloads = MAX(downloads, excluded.downloads)`)
      .bind(r.day, r.visitors, r.views, r.downloaders, r.downloads).run();
  }

  days() {
    return this.sql.exec(`SELECT day, views, visitors, downloads, downloaders FROM daily ORDER BY day`).toArray();
  }
}

const counter = (env) => env.STATS.get(env.STATS.idFromName('ottotofive.com'));

/* ---------------- what counts ---------------- */
function kindOf(request, url, res) {
  if (request.method !== 'GET') return null;
  const h = request.headers;
  const ua = h.get('user-agent') || '';
  if (!ua || BOT.test(ua)) return null;
  if (/prefetch|prerender/i.test(h.get('sec-purpose') || h.get('purpose') || '')) return null;
  if (url.pathname === '/' || url.pathname === '/index.html') {
    // a page someone opened: a navigation, answered with the page (or "not changed" from their cache)
    if (h.get('sec-fetch-dest') && h.get('sec-fetch-dest') !== 'document') return null;
    return res.status === 200 || res.status === 304 ? 'view' : null;
  }
  if (url.pathname === DMG) {
    // a resumed download asks for the rest of the file: that's the same download
    const range = h.get('range');
    if (range && !/^bytes=0-/.test(range)) return null;
    return res.status === 302 ? 'download' : null;
  }
  return null;
}

/* ---------------- /stats ---------------- */
const enc = new TextEncoder();
function sameSecret(a, b) {
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
function authorised(request, env) {
  const m = /^Basic\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!m) return false;
  let pass = '';
  try { pass = atob(m[1]).split(':').slice(1).join(':'); } catch { return false; }
  return sameSecret(pass, env.STATS_KEY);
}

const fmt = (n) => n.toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function lastDays(rows, n) {
  const by = Object.fromEntries(rows.map((r) => [r.day, r]));
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = dayOf(new Date(now.getTime() - i * 86400000));
    out.push(by[day] || { day, views: 0, visitors: 0, downloads: 0, downloaders: 0 });
  }
  // the same calendar day can come out twice around a clock change; keep the first
  return out.filter((r, i, a) => a.findIndex((x) => x.day === r.day) === i);
}
const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);

function bars(rows, key, label) {
  const W = 720, H = 180, top = 12, bottom = 26, gap = 2, L = 34;   // L: a gutter for the scale, so bars never cover it
  const max = Math.max(1, ...rows.map((r) => r[key]));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p; return max; })();
  const bw = (W - L - gap * (rows.length - 1)) / rows.length;
  const X = (i) => L + i * (bw + gap);
  const y = (v) => top + (H - top - bottom) * (1 - v / nice);
  const grid = [0, nice / 2, nice].map((v) => `<line x1="${L}" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" class="t r">${fmt(Math.round(v * 10) / 10)}</text>`).join('');
  const marks = rows.map((r, i) => {
    const v = r[key], x = X(i), h = Math.max(0, H - bottom - y(v));
    const d = new Date(r.day + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const bar = h > 0
      ? `<path d="M${x.toFixed(1)},${(H - bottom).toFixed(1)}V${(H - bottom - h + Math.min(4, h)).toFixed(1)}q0,-${Math.min(4, h).toFixed(1)} ${Math.min(4, bw / 2).toFixed(1)},-${Math.min(4, h).toFixed(1)}H${(x + bw - Math.min(4, bw / 2)).toFixed(1)}q${Math.min(4, bw / 2).toFixed(1)},0 ${Math.min(4, bw / 2).toFixed(1)},${Math.min(4, h).toFixed(1)}V${(H - bottom).toFixed(1)}Z" class="b"/>`
      : '';
    return `<g class="m" data-tip="${esc(d)} · ${fmt(v)} ${esc(label)}"><rect x="${x.toFixed(1)}" y="0" width="${(bw + gap).toFixed(1)}" height="${H - bottom}" class="hit"/>${bar}</g>`;
  }).join('');
  const ticks = rows.map((r, i) => (i % 7 === (rows.length - 1) % 7)
    ? `<text x="${(X(i) + bw / 2).toFixed(1)}" y="${H - 8}" class="t c">${new Date(r.day + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} per day, last ${rows.length} days">${grid}${marks}${ticks}</svg>`;
}

function statsPage(rows) {
  const today = lastDays(rows, 1), week = lastDays(rows, 7), month = lastDays(rows, 30);
  const total = { visitors: sum(rows, 'visitors'), views: sum(rows, 'views'), downloads: sum(rows, 'downloads'), downloaders: sum(rows, 'downloaders') };
  const rate = (r) => (sum(r, 'visitors') ? Math.round((sum(r, 'downloaders') / sum(r, 'visitors')) * 1000) / 10 + '%' : '–');
  const tile = (title, k, sub) => `<div class="tile"><h3>${title}</h3><div class="row">
      <div><b>${fmt(sum(today, k))}</b><span>today</span></div>
      <div><b>${fmt(sum(week, k))}</b><span>7 days</span></div>
      <div><b>${fmt(sum(month, k))}</b><span>30 days</span></div>
      <div><b>${fmt(total[k])}</b><span>all time</span></div></div><p>${sub}</p></div>`;
  const table = rows.slice().reverse().map((r) => `<tr><td>${r.day}</td><td>${fmt(r.visitors)}</td><td>${fmt(r.views)}</td><td>${fmt(r.downloaders)}</td><td>${fmt(r.downloads)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Otto · Stats</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
@font-face { font-family: "Host Grotesk"; src: url(/assets/fonts/HostGrotesk-VariableFont_wght.ttf) format("truetype"); font-weight: 300 800; }
:root { --bg: #0D0A14; --card: #15111F; --line: rgba(255,255,255,.08); --fg: #F3F0FA; --muted: #9690A8; --faint: #6F6A80; --bar: #B5A5F0; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 400 15px/1.5 "Host Grotesk", -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
main { width: min(960px, 100% - 32px); margin: 0 auto; padding: 56px 0 80px; }
h1 { font-size: 34px; font-weight: 500; letter-spacing: -.03em; margin: 0; }
.lede { color: var(--muted); margin: 8px 0 36px; }
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tile, .chart, .tbl { background: var(--card); border-radius: 18px; box-shadow: inset 0 0 0 1px var(--line); padding: 22px 22px 20px; }
.tile h3, .chart h3 { margin: 0 0 16px; font-size: 15px; font-weight: 500; color: var(--muted); }
.row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.row b { display: block; font-size: 28px; font-weight: 500; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.row span, .tile p { font-size: 13px; color: var(--faint); }
.tile p { margin: 14px 0 0; }
.conv { margin: 16px 0; padding: 16px 22px; border-radius: 14px; box-shadow: inset 0 0 0 1px var(--line); color: var(--muted); }
.conv b { color: var(--fg); font-weight: 500; }
.chart { margin-top: 16px; position: relative; }
.chart svg { width: 100%; height: auto; display: block; overflow: visible; }
.g { stroke: var(--line); stroke-width: 1; }
.t { fill: var(--faint); font-size: 11px; } .t.r { text-anchor: end; } .t.c { text-anchor: middle; }
.b { fill: var(--bar); } .hit { fill: transparent; }
.m:hover .b { fill: #D8CEFA; }
.tip { position: absolute; pointer-events: none; padding: 6px 10px; border-radius: 8px; background: #F3F0FA; color: #17131F; font-size: 12.5px; white-space: nowrap; transform: translate(-50%, -120%); opacity: 0; transition: opacity .15s; }
details.tbl { margin-top: 16px; } details.tbl summary { cursor: pointer; color: var(--muted); }
table { width: 100%; border-collapse: collapse; margin-top: 14px; font-variant-numeric: tabular-nums; }
th, td { text-align: right; padding: 7px 4px; border-top: 1px solid var(--line); font-size: 13.5px; } th:first-child, td:first-child { text-align: left; }
th { color: var(--faint); font-weight: 500; }
.note { margin-top: 28px; font-size: 13px; color: var(--faint); max-width: 44em; }
@media (max-width: 640px) { .tiles { grid-template-columns: 1fr; } .row b { font-size: 22px; } .t { font-size: 24px; } }   /* the chart is drawn at 720 wide and shrinks: keep its labels readable */
</style></head><body><main>
<h1>Otto · Stats</h1>
<p class="lede">ottotofive.com, counted by the site itself. Days in Amsterdam time.</p>
<div class="tiles">
  ${tile('Visitors', 'visitors', `${fmt(sum(month, 'views'))} page views in 30 days, ${fmt(total.views)} in all.`)}
  ${tile('People who downloaded', 'downloaders', `${fmt(sum(month, 'downloads'))} downloads in 30 days, ${fmt(total.downloads)} in all (retries included).`)}
</div>
<div class="conv">Of the visitors, <b>${rate(week)}</b> downloaded Otto in the last 7 days, <b>${rate(month)}</b> in the last 30.</div>
<div class="chart"><h3>Visitors per day, last 30 days</h3>${bars(month, 'visitors', 'visitors')}<div class="tip"></div></div>
<div class="chart"><h3>People who downloaded, per day, last 30 days</h3>${bars(month, 'downloaders', 'downloaded')}<div class="tip"></div></div>
<details class="tbl"><summary>Every day, as a table</summary><table><thead><tr><th>Day</th><th>Visitors</th><th>Page views</th><th>Downloaded</th><th>Downloads</th></tr></thead><tbody>${table || '<tr><td colspan="5">Nothing yet.</td></tr>'}</tbody></table></details>
<p class="note">A visitor is a person on one day: someone who comes back tomorrow counts again, so the totals over several days add up days, not people. Link previews, crawlers and scripts are left out. Nothing is stored about anyone: only these daily numbers.</p>
</main><script>
document.querySelectorAll('.chart').forEach((c) => { const tip = c.querySelector('.tip');
  c.querySelectorAll('.m').forEach((m) => { m.addEventListener('pointerenter', () => { const r = m.getBoundingClientRect(), cr = c.getBoundingClientRect(); tip.textContent = m.dataset.tip; tip.style.left = Math.min(cr.width - tip.offsetWidth / 2 - 8, Math.max(tip.offsetWidth / 2 + 8, r.left - cr.left + r.width / 2)) + 'px'; tip.style.top = (m.querySelector('.b') ? m.querySelector('.b').getBoundingClientRect().top - cr.top : r.bottom - cr.top - 26) + 'px'; tip.style.opacity = 1; }); m.addEventListener('pointerleave', () => { tip.style.opacity = 0; }); }); });
</script></body></html>`;
}

async function stats(request, env) {
  if (!env.STATS_KEY) return new Response('Not found', { status: 404 });
  if (!authorised(request, env)) {
    return new Response('Password needed', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Otto stats", charset="UTF-8"', 'Cache-Control': 'no-store' } });
  }
  const rows = await counter(env).days();
  return new Response(statsPage(rows), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

/* ---------------- the Worker ---------------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/stats' || url.pathname === '/stats/') return stats(request, env);
    // the download: counted here, then handed to GitHub's latest release (never cached, so every click counts)
    const res = url.pathname === DMG
      ? new Response(null, { status: 302, headers: { Location: LATEST, 'Cache-Control': 'no-store' } })
      : await env.ASSETS.fetch(request);
    const kind = kindOf(request, url, res);
    if (kind) {
      const who = (request.headers.get('cf-connecting-ip') || '') + '|' + (request.headers.get('user-agent') || '');
      // counted after the answer has gone out, and never in its way
      ctx.waitUntil(counter(env).hit(kind, who).catch(() => {}));
    }
    return res;
  },
};
