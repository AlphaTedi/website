"""Builds site/drafts/v4/index.html. Run from anywhere: python3 v4/build.py"""
import json, pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = REPO / 'site/drafts/v4/index.html'
P = json.load(open(REPO / 'site/drafts/v3/shared/parts.json'))
APPLE, LOGO, FAQ, LOG, T = P['APPLE'], P['LOGO'], P['FAQ'], P['LOG'], P['T']
V = '3'
DMG = '/downloads/Otto.dmg'

def frame(demo, w, h, cls=''):
    return f'<div class="frame {cls}" data-w="{w}" data-h="{h}"><div class="fit"><div data-demo="{demo}"></div></div></div>'

html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Otto · Your day lives in the notch</title>
<meta name="description" content="Otto is a free Mac app that lives in the notch: to-dos, notes and meetings, one hover away.">
<meta name="theme-color" content="#E8E2FA">
<link rel="icon" href="../v3/shared/otto-icon-512.png">
<link rel="stylesheet" href="../v3/shared/otto-ui.css?v={V}">
<link rel="stylesheet" href="v4.css?v={V}">
</head>
<body>

<header class="nav">
  <a class="brand" href="#top" aria-label="Otto, back to top">{LOGO}</a>
  <nav class="links" aria-label="Sections"><a href="#features">Features</a><a href="#new">What’s new</a><a href="#faq">FAQ</a></nav>
  <a class="btn small" href="{DMG}">{APPLE}Download</a>
</header>

<main id="top">

<!-- ============ HERO: a landscape, a screen, the notch opens as you scroll ============ -->
<section class="hero" data-theme="light" aria-label="Otto">
  <div class="stage">
    <canvas class="layer" id="l-clouds" aria-hidden="true"></canvas>
    <canvas class="layer" id="l-far" aria-hidden="true"></canvas>
    <canvas class="layer" id="l-mid" aria-hidden="true"></canvas>
    <canvas class="layer" id="l-near" aria-hidden="true"></canvas>

    <div class="hero-copy">
      <span class="eyebrow">A free app for the MacBook notch</span>
      <h1>Your day lives<br>in the notch.</h1>
      <p class="sub">To-dos, notes and meetings, one&nbsp;hover&nbsp;away.</p>
      <div class="cta"><a class="btn" href="{DMG}">{APPLE}Download for Mac</a><span class="meta">Free · No account · macOS 13 or later</span></div>
    </div>

    <div class="screen" role="group" aria-label="Otto open in the notch of a Mac screen">
      <div class="device"><div class="display"><div class="vd">
        <img class="wall" src="/assets/img/wallpaper.jpg" alt="" width="2880" height="1800">
        <div class="menubar" aria-hidden="true"><div>{APPLE}<b>Otto</b></div><div><span>Thu Oct 8</span><span>08:08</span></div></div>
        <div class="vd-otto"><div id="hero-otto"></div></div>
      </div></div></div>
    </div>

    <canvas class="layer" id="l-shrubs" aria-hidden="true" style="z-index:5"></canvas>
    <div class="dusk" aria-hidden="true"></div>
  </div>
</section>

<!-- ============ INTRO (dark) ============ -->
<section class="intro" data-theme="dark" data-from="dark"><div class="narrow">
  <span class="eyebrow">Intro</span>
  <p>Otto turns the notch of your MacBook into the one place your day lives. Hover it, and your to-dos are there, with steps, links and images. Your notes sit right next to them. Your next meeting counts down quietly, then opens with a Join button. Nothing to sign up for, nothing to sync. When you look away, Otto gets out of the way.</p>
</div></section>

<!-- ============ CAPTURE (dark) ============ -->
<section class="feat" id="features" data-theme="dark"><div class="wrap split">
  <div class="rv">
    <span class="eyebrow">Capture</span>
    <h2>Catch it before<br>it’s gone.</h2>
    <p class="lead">Press the shortcut from any app, type, press return. Steps, links, images and dates live right in the line.</p>
    <div class="kbd" aria-label="Control Shift N"><span>⌃</span><span>⇧</span><span>N</span></div>
  </div>
  <div class="rv">{frame('capture', 620, 430)}</div>
</div></section>

<!-- ============ NOTES (light lilac) ============ -->
<section class="feat" data-theme="lilac"><div class="wrap center">
  <div class="rv"><span class="eyebrow">Notes</span>
  <h2>Notes, next to the list.</h2>
  <p class="lead">Write without opening another app. Headings, lists, links and code, saved as you type.</p></div>
  <div class="rv">{frame('notes', 640, 420, 'wide')}</div>
</div></section>

<!-- ============ MEETINGS (violet) ============ -->
<section class="feat" data-theme="violet"><div class="wrap split flip">
  <div class="rv">
    <span class="eyebrow">Meetings</span>
    <h2>Know before<br>the meeting.</h2>
    <p class="lead">A quiet countdown sits in the notch. Five minutes before, Otto opens with Join and Snooze. It reads the calendars already on your Mac.</p>
  </div>
  <div class="rv">{frame('meeting', 600, 320)}</div>
</div></section>

<!-- ============ THE SMALL THINGS (light) ============ -->
<section class="feat" data-theme="light"><div class="wrap">
  <div class="rv"><span class="eyebrow">And</span><h2>The small things.</h2></div>
  <div class="small-things">
    <div class="tile rv">{frame('layout', 620, 440)}<h3>In the notch, or floating.</h3><p>No notch, or you’d rather not use it? The same Otto as a floating panel.</p></div>
    <div class="col">
      <div class="tile rv">{frame('keys', 620, 360)}<h3>One shortcut, from anywhere.</h3><p>⌃⇧N opens Otto with your cursor in a new to-do.</p></div>
      <div class="tile rv">{frame('files', 600, 380)}<h3>Plain files, on your Mac.</h3><p>Everything is also saved as Markdown in a folder you choose. No account, no server.</p></div>
    </div>
  </div>
</div></section>

<section class="block" id="new" data-theme="light"><div class="narrow">
  <h2 class="h2 rv">What’s new</h2><p class="muted rv" style="margin:12px 0 0;font-size:18px">Otto ships often, and updates itself.</p>
  <div class="log rv">{LOG}</div>
</div></section>

<section class="block" id="faq" data-theme="light"><div class="narrow">
  <h2 class="h2 rv">Questions, answered.</h2>
  <div class="faq rv">{FAQ}</div>
</div></section>

</main>

<!-- ============ CLOSING: the same hills, at night ============ -->
<div class="finale">
<section class="night" data-theme="dark" aria-label="Download Otto">
  <div class="sky"></div><div class="stars"></div>
  <canvas class="layer" id="n-far" aria-hidden="true"></canvas>
  <canvas class="layer" id="n-mid" aria-hidden="true"></canvas>
  <canvas class="layer" id="n-near" aria-hidden="true"></canvas>
  <div class="content">
    <div class="eyes" data-logo="#EDE7FF" aria-hidden="true"></div>
    <h2>Your notch is waiting.</h2>
    <a class="btn light" href="{DMG}">{APPLE}Download for Mac</a>
    <div class="meta">Free · No account · macOS 13 or later</div>
  </div>
  <canvas class="layer" id="n-shrubs" aria-hidden="true" style="z-index:6"></canvas>
</section>

<footer><div class="wrap">
  <div class="row"><span>A free Mac app for to-dos, notes and meetings. Made by Marcello Zanetta.</span>
  <nav><a href="#features">Features</a><a href="#faq">FAQ</a><a href="/privacy.html">Privacy</a><a href="mailto:marcello.zanetta1@gmail.com">Contact</a></nav></div>
  <div class="legal">© 2026 Otto. Mac and macOS are trademarks of Apple Inc. Google Meet is a trademark of Google LLC.</div>
</div></footer>
</div>

<script>window.OTTO_T_PATH = "{T}";</script>
<script src="../v3/shared/otto-ui.js?v={V}"></script>
<script src="../v3/shared/common.js?v={V}"></script>
<script src="hills.js?v={V}"></script>
<script src="v4.js?v={V}"></script>
</body>
</html>
'''
OUT.write_text(html)
print('wrote', OUT.relative_to(REPO))
