/* Intro loader — counter + cycling greeting, then hands off to the hero.
   Progress is time-driven but never exits before window load. */
(function () {
  'use strict';
  var el = document.getElementById('loader');
  if (!el) return;

  var num  = document.getElementById('ldNum');
  var word = document.getElementById('ldWord');
  var body = document.body;

  var GREETINGS = ['Hello', 'Bonjour', 'नमस्ते', 'Ciao', 'Olá', 'こんにちは', 'Hallå', 'Guten Tag'];
  var DURATION  = 2600;                       // ms for the bar to reach 100

  function finish() {
    el.classList.add('done');
    body.classList.remove('loading');
    // t=0 for the hero timeline is the START of the curtain dissolve, not the end:
    // the hash must already be large and turning by the time it is visible.
    // race the webfont rather than wait on it (Motion §4) — the headline mask
    // measures wrong against a fallback face, but a slow font must not hold the
    // curtain up either.
    if (window.heroIntro) {
      var go = window.heroIntro, ran = false;
      var once = function () { if (!ran) { ran = true; go(); } };
      setTimeout(once, 400);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(once);
      else once();
    }
    // drop it from the a11y tree and the paint path once it has faded
    setTimeout(function () { el.setAttribute('hidden', ''); }, 700);
  }

  // reduced motion: no theatre, straight to the page
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }

  var loaded = false;
  addEventListener('load', function () { loaded = true; });

  var t0 = performance.now(), shown = -1;
  function frame(now) {
    var t = Math.min((now - t0) / DURATION, 1);
    var eased = 1 - Math.pow(1 - t, 2.2);      // decelerate, like a real fetch tailing off

    var pct = Math.round(eased * 100);
    if (num.textContent !== String(pct)) num.textContent = pct;

    var i = Math.min(Math.floor(t * GREETINGS.length), GREETINGS.length - 1);
    if (i !== shown) {                          // retrigger the swap animation
      shown = i;
      word.textContent = GREETINGS[i];
      word.classList.remove('swap');
      void word.offsetWidth;
      word.classList.add('swap');
    }

    if (t < 1 || !loaded) { requestAnimationFrame(frame); return; }
    finish();
  }
  requestAnimationFrame(frame);
})();
