/* The hash keeps turning as the page leaves it.

   Three things happen at once over the hero's height, which is what makes it
   read as one continuous shot rather than three effects:

     glide  it leaves the hero's composition and settles at the exact centre of
            the viewport, then holds. The canvas is fixed and 100vh tall with the
            hash drawn centre, so centre-of-viewport is simply offset 0; the hero
            pose is the offset it starts from.
     turn   a slow quarter-ish rotation, 0.62 rad. Slow enough that you never
            catch it moving, only notice it has moved — a spin would read as a
            trick and this object already spun once, during the arrival.
     shrink 1.00 -> 0.70. It recedes rather than exits, so it is still there,
            smaller and re-posed, behind the glass on the second section.

   The turn and the shrink are eased, not linear: linear is what makes
   scroll-linked motion feel mechanical. The lag stays linear because it is
   parallax — a constant rate IS the effect, and easing it would read as drag. */
(function () {
  'use strict';

  var cv = document.getElementById('hashgl');
  var img = document.querySelector('.hash-fallback');
  if (!cv && !img) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* NEGATIVE on purpose. The hash rests at yaw 0.886 rad (50.8deg) and edge-on
     is 90deg, so turning +0.62 landed it at 86.3deg — a 20mm plate seen edge-on,
     which rendered as a smear. Turning the other way opens it toward the viewer:
     50.8 - 35.5 = 15.3deg, near frontal but still angled enough to keep the
     depth and the refraction reading. It settles by facing you. */
  var TURN = -0.62;          /* radians by the end — a turn, not a spin */
  /* Finish exactly when the glass finishes arriving. This is stepped.js's SPAN,
     deliberately the same number: one anchor for both, so the hash lands centred
     on the frame the staircase closes. Normalising over a whole viewport instead
     left the pose 15% short — the page only has 0.85vh of scroll to give. */
  var SPAN = 0.85;
  var SHRINK = 0.30;         /* 1.00 → 0.70 */
  var pending = false;

  function draw() {
    pending = false;
    var vh = window.innerHeight;
    var y = window.scrollY || document.documentElement.scrollTop || 0;

    /* progress to the glass's arrival: past that the pose holds, not drifts */
    var P = y / (vh * SPAN);
    if (P < 0) P = 0; else if (P > 1) P = 1;
    var e = 1 - (1 - P) * (1 - P);          /* ease-out: settles rather than stops */

    /* The hero pose: 32vh − 150px, the offset the composition was built around,
       eased to 0 — which is dead centre of the viewport.

       The mark OVERLAPS the headline from here, and that is the composition
       rather than a collision: #hashgl is z-index 3 against the type's 2, and
       the two sharing one space is what this hero has always been. A measured
       offset that parked the mark BELOW the type lived here for one build and
       is gone — it bought legibility by taking the overlap apart, and the
       solid fill buys the same legibility without touching it. */
    var rest = vh * 0.32 - 150;
    var px = (rest * (1 - e)).toFixed(1) + 'px';
    if (cv) cv.style.setProperty('--par', px);
    if (img) img.style.setProperty('--par', px);

    /* P clamps at 1, so past the hero this keeps re-asserting the same rest pose
       every frame — harmless until hash-journey.js started writing a different one
       on those same frames. Whichever landed last would win, and that came down to
       import order in Base.astro. The journey raises this flag the moment its first
       act begins and owns the pose from there; the hero keeps everything up to it. */
    if (!window.__hashJourney) {
      if (window.HashGL) window.HashGL.set(1 - SHRINK * e, TURN * e);
      if (img) img.style.setProperty('--scale', (1 - SHRINK * e).toFixed(4));
    }
  }
  function request() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  if (window.lenis && window.lenis.on) window.lenis.on('scroll', request);
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  draw();
})();
