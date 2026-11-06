"""Builds the home page, site/index.html (and its copy at site/drafts/v5/). Run from anywhere: python3 v5/build.py"""
import json, pathlib, re

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = REPO / 'site/index.html'                 # the home page of ottotofive.com
DRAFT = REPO / 'site/drafts/v5/index.html'      # the same page, kept at /drafts/v5/ (noindex)
A = '/assets/home/'                              # its CSS, JS, fonts and the Lion wallpaper
P = json.load(open(REPO / 'site/drafts/v3/shared/parts.json'))
APPLE, LOGO, T = P['APPLE'], P['LOGO'], P['T']
V = '10'
DMG = '/downloads/Otto.dmg'

# ---------- content pulled from the live site, so the facts stay the same ----------
FAQ = dict(re.findall(r'<summary>(.*?)</summary><p>(.*?)</p>', P['FAQ']))
FAQ = {q: a.replace(' style="color:var(--lilac)"', '').replace('href="privacy.html"', 'href="/privacy.html"') for q, a in FAQ.items()}
FAQ['Is Otto really free?'] = 'Yes. Otto is free to download and use, with no account and no paywall.'
FAQ_TABS = [
    ('Basics', ['Is Otto really free?', 'Does my Mac need a notch?', 'Which languages does it speak?']),
    ('Privacy', ['Where is my data?', 'What does the anonymous usage data include?', 'Which calendars does it read?']),
    ('Install', ['Will macOS warn me when I open it?']),
]
FAQ_EXTRA = {
    'Install': [
        ('What do I need to run it?', 'A Mac with macOS 13 or later. A notch is nice, but not required: Otto can open as a floating panel instead.'),
        ('How do I update it?', 'You don’t have to. Otto updates itself from inside the app.'),
    ],
}
LOG = re.findall(r'<time datetime="([^"]+)">([^<]+)</time><div><h3>([^<]+)</h3><p>([^<]+)</p>', P['LOG'])

# ---------- a small set of line icons (24 grid, drawn with currentColor) ----------
def icon(name, size=20):
    d = {
        'calendar': '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
        'video': '<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3"/>',
        'folder': '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
        'file': '<path d="M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M13.5 3.5V8H18M8.5 12.5h7M8.5 16h5"/>',
        'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
        'image': '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-4.5-4.5L7 20"/>',
        'checks': '<path d="M3.5 7l2 2 3.5-3.5M3.5 15l2 2 3.5-3.5M12 7.5h8.5M12 15.5h8.5"/>',
        'keyboard': '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9"/>',
        'lock': '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
        'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
        'left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
        'spark': '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
        'note': '<path d="M5 4.5h10.5L19 8v11.5H5z"/><path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4"/>',
        'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
        'user': '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5M16 11.5l2 2 3.5-3.5"/>',
        'cloud': '<path d="M7.5 18.5a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.4 3.3 3.3 0 0 1-.5 6.6z"/>',
        'globe': '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z"/>',
        'refresh': '<path d="M19.5 12a7.5 7.5 0 0 1-13.4 4.6M4.5 12a7.5 7.5 0 0 1 13.4-4.6"/><path d="M18 3.5v4h-4M6 20.5v-4h4"/>',
        'layers': '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
        'notch': '<rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="M9 4.5v1.2a1.3 1.3 0 0 0 1.3 1.3h3.4A1.3 1.3 0 0 0 15 5.7V4.5"/>',
        'float': '<rect x="2.5" y="4.5" width="19" height="15" rx="3"/><rect x="7" y="9" width="10" height="7" rx="1.6"/>',
        'eye': '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
        'speed': '<path d="M4.5 16.5a8 8 0 1 1 15 0"/><path d="M12 12.5l4-4"/>',
        'shield': '<path d="M12 3.5l7 3v5.5c0 4.2-3 7.4-7 8.5-4-1.1-7-4.3-7-8.5V6.5z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
        'mail': '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    }[name]
    return f'<svg class="i" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>'

EYES_SM = f'<span class="eyes-logo" data-logo aria-hidden="true"></span>'

def btn(label, cls='', href=DMG, apple=True, arrow=False):
    return f'<a class="btn {cls}" href="{href}">{APPLE if apple else ""}<span>{label}</span>{icon("arrow", 16) if arrow else ""}</a>'

# ---------- sections ----------
HERO = f'''
<section class="hero" id="top">
  <div class="hero-bg" aria-hidden="true"><canvas id="liquid"></canvas></div>
  <div class="hero-stage">
  <div class="hero-copy">
    <div class="hero-logo intro-in" style="--d:0s" aria-label="Otto"></div>
    <h1 class="t-xl intro-in" style="--d:.12s">Your day lives<br>in the notch.</h1>
    <p class="lead intro-in" style="--d:.3s">To-dos, notes and meetings, one hover away.</p>
    <div class="cta-row intro-in" style="--d:.45s">{btn('Download for Mac', 'dark big')}</div>
  </div>
  <div class="product-wrap intro-in" style="--d:.5s">
    <div class="product" id="product">
      <div class="mac" role="group" aria-label="Otto open in the notch of a Mac screen">
        <div class="mac-screen"><div class="vd">
          <img class="wall" src="{A}lion.jpg" alt="" width="2560" height="1600">
          <div class="menubar" aria-hidden="true"><div>{APPLE}<b>Otto</b><span>File</span><span>Edit</span><span>View</span></div><div><span>Thu Oct 8</span><span>08:08</span></div></div>
          <div class="vd-otto"><div id="hero-otto"></div></div>
        </div></div>
      </div>
    </div>
  </div>
  </div>
</section>'''

BLOCKS = f'''
<section class="sec blocks" id="how">
  <div class="wrap">
    <div class="sec-head split-head">
      <h2 class="t-l rv">Quiet until you look.<br>Ready when you do.</h2>
      <p class="rv">Otto lives in the notch of your MacBook. Hover it and your to-dos, notes and next meeting are there. Look away, and it gets out of the way.</p>
    </div>
    <div class="cards3 rv">
      <article class="c3">
        <div class="viz" aria-hidden="true"><div class="fit" data-w="420" data-h="340"><div class="demo" data-viz="todos"></div></div></div>
        <h3>{icon('checks', 18)}Lists you’ll want to finish</h3>
        <p>Tick a to-do and it bows out of the list. Steps, links and screenshots stay right in the line.</p>
      </article>
      <article class="c3">
        <div class="viz" aria-hidden="true"><div class="fit" data-w="460" data-h="372"><div class="demo" data-viz="note"></div></div></div>
        <h3>{icon('note', 18)}Notes with room to think</h3>
        <p>Headings, lists, checklists, links, quotes and code. Format as you type, and keep it all as Markdown.</p>
      </article>
      <article class="c3">
        <div class="viz viz-top" aria-hidden="true"><div class="fit" data-w="380" data-h="330"><div class="demo" data-viz="meet"></div></div></div>
        <h3>{icon('clock', 18)}Never late for a meeting</h3>
        <p>A countdown waits in the notch. Five minutes before, Otto opens with Join and Snooze.</p>
      </article>
    </div>
  </div>
</section>'''

STEPS = [
    ('keyboard', 'Catch it from anywhere', 'Press ⌃⇧N in any app. Otto opens with your cursor in a new to-do, and closes when you press return.', 'morning', 'keys'),
    ('note', 'Write it down', 'Notes sit right next to your list. Headings, lists, links and code, saved as you type.', 'dusk', 'notes'),
    ('video', 'Join on time', 'A quiet countdown in the notch. Five minutes before, Join and Snooze are one key away.', 'night', 'meeting'),
]
steps_html = ''.join(f'''
      <button class="step{' on' if i == 0 else ''}" data-step="{i}" aria-pressed="{'true' if i == 0 else 'false'}">
        <span class="ring">{icon(ic, 18)}<svg class="rg" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.75"/><circle class="p" cx="20" cy="20" r="18.75" pathLength="1"/></svg></span>
        <span class="st-t">{t}</span>
        <span class="st-d">{d}</span>
      </button>''' for i, (ic, t, d, _, _) in enumerate(STEPS))
def scene_ui(demo):
    keys = '<div class="keys" aria-hidden="true"><span>⌃</span><span>⇧</span><span>N</span></div>' if demo == 'keys' else ''
    h = {'keys': 200, 'notes': 380, 'meeting': 240}[demo]
    return f'<div class="ui"><div class="fit" data-w="620" data-h="{h}"><div class="demo" data-demo="{demo}"></div></div></div>{keys}'
scenes_html = ''.join(f'''
      <div class="scene{' on' if i == 0 else ''}" data-scene="{i}" data-sky="{sky}">
        {scene_ui(demo)}
      </div>''' for i, (_, _, _, sky, demo) in enumerate(STEPS))

TOUR = f'''
<section class="sec tour-sec">
  <div class="wrap tour">
    <div class="tour-l">
      <h2 class="t-l rv">Your day,<br>one hover away</h2>
      <p class="rv">Everything you’d normally keep in five places sits in the notch. Catch it, write it down, show up on time.</p>
      <div class="steps rv" role="group" aria-label="What Otto does">{steps_html}
      </div>
    </div>
    <div class="tour-r rv">{scenes_html}
    </div>
  </div>
</section>'''

MODES = f'''
<section class="sec modes" id="layouts">
  <div class="wrap">
    <div class="sec-head center-head">
      <h2 class="t-l rv">In the notch, or floating.</h2>
      <p class="rv">No notch, or rather not use it? The same Otto opens as a floating panel, with the same shortcut.</p>
      <div class="seg rv" role="tablist" aria-label="Layout">
        <i class="seg-pill" aria-hidden="true"></i>
        <button role="tab" aria-selected="true" data-mode="notch">{icon('notch', 16)}In the notch</button>
        <button role="tab" aria-selected="false" data-mode="float">{icon('float', 16)}Floating</button>
      </div>
    </div>
    <div class="mode-stage rv" data-mode="notch">
      <div class="mode-screen">
        <img class="wall" src="{A}lion.jpg" alt="" width="2560" height="1600" loading="lazy">
        <div class="menubar" aria-hidden="true"><div>{APPLE}<b>Otto</b></div><div><span>Thu Oct 8</span><span>08:08</span></div></div>
        <i class="hw-notch" aria-hidden="true"></i>
        <div class="m-notch"><div class="fit" data-w="620" data-h="430"><div class="demo" data-demo="mode-notch"></div></div></div>
        <div class="m-float"><div class="fit" data-w="657" data-h="470"><div class="demo" data-demo="mode-float"></div></div></div>
      </div>
    </div>
  </div>
</section>'''

CARDS = [
    ('checks', 'Steps inside a to-do', 'Break a big one down without leaving the line.', 'steps'),
    ('link', 'Links, images and dates', 'Paste a link or a screenshot. It becomes a chip you can open.', 'chips'),
    ('layers', 'A space for each part of your day', 'Work, Personal, a side project. Switch with Tab.', 'spaces'),
    ('file', 'Plain Markdown, in your folder', 'Every list is also a .md file you own. Open it in anything.', 'md'),
    ('keyboard', 'One shortcut, from anywhere', '⌃⇧N opens Otto with the cursor in a new to-do.', 'keys'),
    ('speed', 'Opens at your speed', 'Pick how fast it opens, the layout and the theme in Settings.', 'speed'),
    ('globe', 'English and Italian', 'Otto speaks both, and follows your Mac.', 'lang'),
    ('refresh', 'Updates itself', 'Signed, notarized, and updated from inside the app.', 'update'),
]
def mock(kind):
    if kind == 'steps':
        return '''<div class="mk mk-panel"><div class="row"><i class="cb"></i><b>Prep for Monday’s standup</b><em>2/4</em></div>
          <div class="sub"><div class="row s done"><i class="cb on"></i><span>Collect updates from the team</span></div><div class="row s done"><i class="cb on"></i><span>Write the agenda</span></div><div class="row s"><i class="cb"></i><span>Book the room</span></div><div class="row s"><i class="cb"></i><span>Share the doc in #team</span></div></div></div>'''
    if kind == 'chips':
        return f'''<div class="mk mk-panel"><div class="row"><i class="cb"></i><span>Review the new onboarding</span></div><div class="row ind"><span class="chip link">{icon('link', 12)}figma.com/onboarding</span></div>
          <div class="row"><i class="cb"></i><span class="chip img">{icon('image', 12)}Screenshot</span><span>Fix the pricing table</span></div><div class="row"><i class="cb"></i><span>Book the team offsite</span><span class="chip date">{icon('calendar', 12)}fri</span></div></div>'''
    if kind == 'spaces':
        return '''<div class="mk mk-dock"><div class="dock"><span class="sp on" style="--c:#FFC36E">Work</span><span class="sp" style="--c:#F49AC1">Personal</span><span class="sp" style="--c:#A996FF">Side project</span></div><div class="mini-list"><i></i><i></i><i></i></div></div>'''
    if kind == 'md':
        return '''<div class="mk mk-md"><div class="bar"><i></i><i></i><i></i><span>Documents/Otto/Work.md</span></div><pre><b># Work</b>
<em>- [ ]</em> Send the proposal to Simon
<em>- [ ]</em> Prep for Monday’s standup
    <em>- [x]</em> Write the agenda
<em>- [x]</em> Book the team offsite</pre></div>'''
    if kind == 'keys':
        return '<div class="mk mk-keys"><span>⌃</span><span>⇧</span><span>N</span></div>'
    if kind == 'speed':
        return '''<div class="mk mk-set"><div class="lbl">Opening speed</div><div class="slider"><i style="--v:.62"></i></div><div class="ticks"><span>Calm</span><span>Snappy</span></div>
          <div class="lbl">Layout</div><div class="pills"><span class="on">Notch</span><span>Floating</span></div></div>'''
    if kind == 'lang':
        return '''<div class="mk mk-panel"><div class="row"><i class="cb"></i><span>Water the plants</span><em class="tag">EN</em></div><div class="row"><i class="cb"></i><span>Annaffiare le piante</span><em class="tag">IT</em></div>
          <div class="row"><i class="cb"></i><span>Call the dentist</span><em class="tag">EN</em></div><div class="row"><i class="cb"></i><span>Chiamare il dentista</span><em class="tag">IT</em></div></div>'''
    if kind == 'update':
        return f'''<div class="mk mk-update"><div class="toast"><span class="app">{EYES_SM}</span><div><b>Otto is up to date</b><span>Installed in the background</span></div><span class="ok">{icon('check', 14)}</span></div><div class="ver"><span>Version</span><b>3 October</b></div></div>'''
cards_html = ''.join(f'''
      <article class="fc"><div class="fc-viz">{mock(m)}</div><h3>{icon(ic, 18)}{t}</h3><p>{d}</p></article>''' for ic, t, d, m in CARDS)

CAROUSEL = f'''
<section class="sec small" id="features">
  <div class="wrap">
    <div class="sec-head">
      <h2 class="t-l rv">The small things</h2>
      <p class="rv">Little details that make a list you actually open.</p>
    </div>
  </div>
  <div class="car rv">
    <div class="car-track" tabindex="0" aria-label="Features">{cards_html}
    </div>
  </div>
  <div class="wrap car-ctl">
    <div class="car-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="car-btns"><button class="cbtn prev" aria-label="Previous">{icon('left', 18)}</button><button class="cbtn next" aria-label="Next">{icon('arrow', 18)}</button></div>
  </div>
</section>'''

def faq_items(tab):
    qs = [(q, FAQ[q]) for q in dict(FAQ_TABS)[tab]] + FAQ_EXTRA.get(tab, [])
    return ''.join(f'<details><summary>{q}<i aria-hidden="true"></i></summary><div class="ans"><p>{a}</p></div></details>' for q, a in qs)
faq_tabs = ''.join(f'<button role="tab" aria-selected="{"true" if i == 0 else "false"}" data-tab="{i}">{name}</button>' for i, (name, _) in enumerate(FAQ_TABS))
faq_panels = ''.join(f'<div class="faq-panel{" on" if i == 0 else ""}" role="tabpanel" data-panel="{i}">{faq_items(name)}</div>' for i, (name, _) in enumerate(FAQ_TABS))
FAQS = f'''
<section class="sec faq-sec" id="faq">
  <div class="narrow">
    <div class="sec-head center-head">
      <h2 class="t-l rv">Before you ask</h2>
      <p class="rv">Straight answers to what people ask first.</p>
      <div class="seg small rv" role="tablist" aria-label="Questions"><i class="seg-pill" aria-hidden="true"></i>{faq_tabs}</div>
    </div>
    <div class="faq rv">{faq_panels}</div>
    <div class="ask rv"><span class="ask-av">{EYES_SM}</span><span>Still have questions?</span><a href="mailto:marcello.zanetta1@gmail.com">Write to me</a></div>
  </div>
</section>'''

FINALE = f'''
<section class="sec finale" id="get">
  <div class="fin-bg" aria-hidden="true"><canvas id="liquid-fin"></canvas></div>
  <div class="wrap fin-in">
    <img class="app-icon rv" src="/assets/icons/otto-icon-512.png" alt="" width="76" height="76">
    <h2 class="t-l rv">Your notch is waiting.</h2>
    <p class="rv">Free, no account. Needs macOS 13 or later.</p>
    <div class="rv">{btn('Download for Mac', 'light big')}</div>
  </div>
</section>'''

FOOTER = f'''
<footer class="site-footer" id="footer">
  <div class="wrap foot-top">
    <div class="foot-about">
      <p>Made by Marcello Zanetta</p>
      <p>Mac and macOS are trademarks of Apple Inc.<br>Google Meet is a trademark of Google LLC.</p>
      <p>© 2026 Otto</p>
    </div>
    <nav class="foot-cols" aria-label="Footer">
      <div><h4>Otto</h4><ul><li><a href="#how">How it works</a></li><li><a href="#features">Features</a></li><li><a href="#faq">FAQ</a></li></ul></div>
      <div><h4>More</h4><ul><li><a href="/privacy.html">Privacy policy</a></li><li><a href="mailto:marcello.zanetta1@gmail.com">Contact</a></li></ul></div>
    </nav>
  </div>
  <div class="wrap"><div class="mega" aria-hidden="true">
    <svg id="mega" viewBox="0 0 883 430">
      <defs>
        <linearGradient id="megaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#C9BCF6"/><stop offset="1" stop-color="#7c5cff"/></linearGradient>
        <mask id="eyeMask" maskUnits="userSpaceOnUse" x="0" y="0" width="883" height="430">
          <rect width="883" height="430" fill="#fff"/>
          <circle id="eyeL" r="52.35" fill="#000" transform="translate(167.15 230.9)"/>
          <circle id="eyeR" r="52.35" fill="#000" transform="translate(761.2 230.9)"/>
        </mask>
      </defs>
      <g fill="url(#megaG)" mask="url(#eyeMask)"><path d="{T}"/><circle cx="144.487" cy="249.857" r="144.487"/><circle cx="738.514" cy="249.857" r="144.487"/></g>
    </svg>
  </div></div>
</footer>'''

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Otto · Your day lives in the notch</title>
<meta name="description" content="Otto is a free Mac app that lives in the notch: to-dos, notes and meetings, one hover away. No account, everything stays on your Mac.">
<meta property="og:type" content="website">
<meta property="og:title" content="Otto · Your day lives in the notch">
<meta property="og:description" content="A free Mac app for to-dos, notes and meetings, one hover away.">
<meta property="og:image" content="https://ottotofive.com/assets/img/og-otto.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The Otto logo on a violet gradient">
<meta name="twitter:image" content="https://ottotofive.com/assets/img/og-otto.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FCF6F3">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/HostGrotesk-VariableFont_wght.ttf" as="font" type="font/ttf" crossorigin>
<link rel="preload" href="{A}fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{A}otto-ui.css?v={V}">
<link rel="stylesheet" href="{A}home.css?v={V}">
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="g-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#B5A5F0"/></linearGradient>
</defs></svg>

<header class="nav" id="nav">
  <a class="brand" href="#top" aria-label="Otto, back to top">{LOGO}</a>
  {btn('Download', 'nav-btn')}
</header>

<main id="main">
{HERO}
{BLOCKS}
{TOUR}
{MODES}
{CAROUSEL}
{FAQS}
{FINALE}
</main>
{FOOTER}

<script>window.OTTO_T_PATH = "{T}";</script>
<script src="{A}lenis.min.js?v={V}"></script>
<script src="{A}otto-ui.js?v={V}"></script>
<script src="{A}common.js?v={V}"></script>
<script src="{A}home.js?v={V}"></script>
</body>
</html>
'''
OUT.write_text(html)
DRAFT.write_text(html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">', 1))
print('wrote', OUT.relative_to(REPO), 'and', DRAFT.relative_to(REPO), len(html), 'bytes')
