/* The fan is placed, not assembled.

   Cloned from horizonx.so — see docs/research/components/horizonx-fan.spec.md.
   The single most important thing measured there: THEIR CARDS NEVER MOVE. Their
   rotations and offsets are identical at every scroll position, and the whole
   animation is one fade+scale on the rig that holds them:

       scale    0.82 -> 1.0
       opacity  0    -> 1

   One transform on one element. It would have been easy to "improve" this into
   four staggered cards flying into formation, and it would have been worse — the
   restraint is what makes it read as a photograph being set down rather than an
   interface building itself. So this drives the rig and nothing else; the cards'
   geometry lives in CSS custom properties written at build time and is never
   touched at runtime.

   The one change from the original: theirs fires on a load timer, because it is
   a hero. Here it is act two of a pinned section, so it is scrubbed on the same
   clamped progress changes.js uses — one value, read from one place. */
(function () {
  'use strict';

  var rig = document.querySelector('[data-fan-rig]');
  var sec = document.querySelector('[data-changes]');
  if (!rig || !sec) return;

  var PINNED = matchMedia('(min-width:1200px)');
  var STILL = matchMedia('(prefers-reduced-motion:reduce)');

  var FROM = 0.82;            /* their measured start scale */
  var IN = 1.02, OUT = 1.62;  /* the window, in viewports of pin progress */

  var pending = false;

  function seg(p, a, b) { var t = (p - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t; }
  /* ease-out cubic: it arrives and settles, which is what "placed" looks like */
  function outCubic(t) { var u = 1 - t; return 1 - u * u * u; }

  function draw() {
    pending = false;

    /* unpinned puts the cards in a grid and the CSS already forces the rig
       visible; reduced motion gets the finished state with no trip */
    if (!PINNED.matches || STILL.matches) {
      rig.style.transform = '';
      rig.style.opacity = '1';
      return;
    }

    var p = -sec.getBoundingClientRect().top / window.innerHeight;
    var t = outCubic(seg(p, IN, OUT));

    rig.style.transform = 'scale(' + (FROM + (1 - FROM) * t).toFixed(4) + ')';
    rig.style.opacity = t.toFixed(3);
  }

  function queue() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  if (PINNED.addEventListener) PINNED.addEventListener('change', queue);
  draw();
})();
