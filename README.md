# Otto website (ottotofive.com)

Static site, no build dependencies.

- `site/` — the live site. Cloudflare (Worker "otto-site", see wrangler.jsonc) publishes this folder on every push to main.
- `v5/build.py` — builds the home page, `site/index.html` (and its copy at `site/drafts/v5/`). Its CSS, JS, fonts and wallpaper live in `site/assets/home/`.
- `index.src.html` + `build.py` — source of the first site, kept at `site/drafts/v1/`.
- `site2/`, `v2/` — v2 variant (MacBook hero).
- `v3/` — three new directions (a, b, c). Build with `python3 v3/build.py`.
- `avatar/` — exploration: Otto's eyes in the notch.

Preview locally: `python3 -m http.server 8000 --directory site`.
