/* The tool orbit drifts as section two passes.

   Six objects at one rate is a sticker sheet; the depth has to be readable or the
   sizes look arbitrary. Each tool carries a --d in About.astro and travels that
   multiple of the base range, so the big near ones (Ae, Rive) outrun the small
   far ones (Ps, Blender) and the ring reads as a volume the column sits inside.

   Normalised over the section's WHOLE pass rather than a viewport, and centred on
   0 so the pose at mid-section — the moment the copy is actually being read — is
   the neutral one the layout was composed at. Offsetting from the top instead
   would mean the composition is only correct on the way in.

   Reads Lenis when it is running and falls back to native scroll, matching
   parallax.js, so it behaves the same under reduced motion (where smooth.js
   leaves Lenis off — though this bails there anyway). */
(function () {
  'use strict';

  var orbit = document.querySelector('.ab-orbit');
  var sec = document.querySelector('.ab');
  if (!orbit || !sec) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var tools = [].slice.call(orbit.querySelectorAll('.tool'));
  if (!tools.length) return;

  var RANGE = 74;          /* px of travel at --d:1 across the section's pass */
  var pending = false;

  function draw() {
    pending = false;
    var vh = window.innerHeight;
    var r = sec.getBoundingClientRect();
    /* below 900px the ring has unwrapped into a scatter under the copy; the same
       74px there would visibly shear the rows apart from each other */
    var range = window.innerWidth <= 900 ? 22 : RANGE;

    /* 0 when the section's top is at the viewport bottom, 1 when its bottom is at
       the viewport top — one pass, normalised by how far it actually travels */
    var P = (vh - r.top) / (vh + r.height);
    if (P < 0) P = 0; else if (P > 1) P = 1;
    var o = (P - 0.5) * 2;                     /* -1 .. 1, neutral at mid-section */

    for (var i = 0; i < tools.length; i++) {
      var d = parseFloat(tools[i].style.getPropertyValue('--d')) || 1;
      tools[i].style.setProperty('--py', (-o * range * d).toFixed(1) + 'px');
    }
  }
  function request() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  if (window.lenis && window.lenis.on) window.lenis.on('scroll', request);
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  draw();
})();
