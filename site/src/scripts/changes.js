/* The headline leaves the room.

   One clamped progress value drives four properties on two elements, and that is
   the whole section. p = 0 is the rest pose; p = 1 is gone. Because p is a pure
   function of scroll offset with no stored state and no direction flag, scrubbing
   back up runs the shot in reverse for free — the same property that makes the
   stepped section survive a flick-scroll.

   THE SCRUB IS LINEAR ON PURPOSE. Measured at 24 scroll positions on the original,
   translateX/scale/rotateY/opacity are all linear in p to within 0.7%, and
   opacity is exactly 1 - p. The smoothness you feel is Lenis interpolating the
   scroll position underneath it, not an ease on the property. parallax.js eases
   its curves for the opposite reason — a pose that SETTLES wants ease-out — but
   here an ease would fight the scroll and read as lag. Do not add one. */
(function () {
  'use strict';

  var sec = document.querySelector('[data-changes]');
  if (!sec) return;

  var L = sec.querySelector('[data-chg-half="l"]');
  var R = sec.querySelector('[data-chg-half="r"]');
  if (!L || !R) return;

  /* The end pose, straight off the original's inline style. */
  var SHIFT = 2000;          /* px, each half, in opposite directions */
  var GROW  = 0.5;           /* scale 1.00 -> 1.50 */
  var TURN  = 60;            /* degrees of rotateY, opening away from the camera */
  var PERSP = 1200;          /* px — first in the chain, so the turn reads as depth */

  /* Below this the original abandons the pin entirely and the headline is simply
     static. Matching that is cheaper AND more faithful than scaling the effect
     down: a 350vh pin on a phone is three empty screens of scrolling. */
  var PINNED = matchMedia('(min-width:1200px)');
  var STILL  = matchMedia('(prefers-reduced-motion:reduce)');

  var pending = false;

  function pose(el, dir, p) {
    el.style.transform =
      'perspective(' + PERSP + 'px)' +
      ' translateX(' + (dir * SHIFT * p).toFixed(1) + 'px)' +
      ' scale(' + (1 + GROW * p).toFixed(4) + ')' +
      ' rotateY(' + (dir * TURN * p).toFixed(2) + 'deg)';
    el.style.opacity = (1 - p).toFixed(3);
  }

  function draw() {
    pending = false;

    /* Not pinned: hold the rest pose. Written every time rather than once on the
       breakpoint change, so a resize across 1200px cannot strand the halves
       mid-flight — the same class of bug as two scripts writing one transform. */
    if (!PINNED.matches || STILL.matches) {
      pose(L, -1, 0);
      pose(R, 1, 0);
      return;
    }

    var vh = window.innerHeight;
    var top = sec.getBoundingClientRect().top;   /* already viewport-relative */

    /* The pin engages when the section's top hits 0, and the move takes exactly
       one viewport from there — measured identical at vh 700/900/1200, which is
       why this is a vh and not a constant. */
    var p = -top / vh;
    if (p < 0) p = 0; else if (p > 1) p = 1;

    pose(L, -1, p);
    pose(R, 1, p);
  }

  function queue() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(draw);
  }

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  if (PINNED.addEventListener) PINNED.addEventListener('change', queue);
  draw();
})();
