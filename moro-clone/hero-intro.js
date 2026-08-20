/* hero arrival — the composed entrance. Element 2.5.

   One clock owns every beat. The hash's camera move is driven per frame from this
   rAF; the type and nav are CSS transitions fired by class at their exact t. There
   are deliberately no animation-delays in the stylesheet — a second clock is how a
   sequence drifts apart.

   t = 0 is the moment loader.js starts the curtain dissolve, not the moment it
   finishes. The curtain takes 650ms to clear, so the hash is already large and
   already turning by the time anyone sees it: the loader and the hero read as one
   continuous shot rather than two events. Motion §4 caps arrival at ~1800ms, and
   spending the dramatic phase under the curtain is what lets the scale and the cap
   coexist. */
(function () {
  'use strict';

  var root = document.documentElement;
  var d1 = document.querySelector('.hero .d1');
  var bar = document.querySelector('.bar');
  var lines = d1 ? d1.querySelectorAll(':scope > .ln') : [];

  /* the beat sheet. ms from curtain-lift. */
  var HASH_DUR = 1700;      /* settle tier, Motion §2 */
  var BEATS = [
    { at: 240, el: function () { return lines[0]; } },
    { at: 330, el: function () { return lines[1]; } },   /* +90ms line stagger, §3 */
    { at: 900, el: function () { return bar; } }         /* chrome last, §4 */
  ];

  var SPIN = 270 * Math.PI / 180;   /* radians of revolve, unwinding to the rest pose */
  var ZOOM = 2.6;                   /* apparent size at t=0, easing to 1.0 */

  function open(el) { if (el) el.classList.add('is-in'); }
  function settled() {
    root.classList.remove('intro');
    if (window.HashGL) window.HashGL.done();
    /* hero-dots.js measured its letters while the lines were still translated */
    window.dispatchEvent(new CustomEvent('hero:settled'));
  }

  function finish() {
    for (var i = 0; i < BEATS.length; i++) open(BEATS[i].el());
    settled();
  }

  /* the settle curve, cubic-bezier(.22,1,.36,1) — gentler than the house ease, which
     at 1700ms snaps then crawls. The type runs on the house ease at the same time;
     two curves at once is what produces depth (Motion §2). */
  function settleEase(t) {
    /* closed form is not worth it — sample the bezier by Newton on x */
    var x = t, i, cx = 3 * 0.22, bx = 3 * (0.36 - 0.22) - cx, ax = 1 - cx - bx;
    for (i = 0; i < 5; i++) {
      var fx = ((ax * x + bx) * x + cx) * x - t;
      var dx = (3 * ax * x + 2 * bx) * x + cx;
      if (dx < 1e-6) break;
      x -= fx / dx;
    }
    var cy = 3 * 1.0, by = 3 * (1.0 - 1.0) - cy, ay = 1 - cy - by;
    return ((ay * x + by) * x + cy) * x;
  }

  window.heroIntro = function () {
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var gl = window.HashGL;

    if (reduce || !gl) { finish(); return; }

    root.classList.add('intro');
    gl.start();
    gl.set(ZOOM, SPIN);

    var t0 = 0, fired = 0;
    function frame(now) {
      if (!t0) t0 = now;
      var t = now - t0;

      var p = Math.min(t / HASH_DUR, 1);
      var e = settleEase(p);
      gl.set(1 + (ZOOM - 1) * (1 - e), SPIN * (1 - e));

      while (fired < BEATS.length && t >= BEATS[fired].at) open(BEATS[fired++].el());

      if (p < 1) { requestAnimationFrame(frame); return; }
      while (fired < BEATS.length) open(BEATS[fired++].el());
      settled();
    }
    requestAnimationFrame(frame);
  };
})();
