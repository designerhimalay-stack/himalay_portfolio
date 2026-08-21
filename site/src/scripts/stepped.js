/* Stepped reveal — the dark section climbs over the one above it as a staircase.

   Extracted from labs.anyflow.agency's .weare transition and verified against it:
   seven columns driven by scaleY alone, origin bottom, sharing one ease-out curve
   with the centre column 3 steps ahead of the outermost. Inverting their measured
   scale values gave a constant 1/15 progress gap per column, which is what pins
   the model down — see docs/research/components/stepped-reveal.spec.md.

   Reads Lenis when it is running and falls back to the native scroll position, so
   it behaves the same under reduced motion (where smooth.js leaves Lenis off). */
(function () {
  'use strict';

  /* the staircase now reveals the whole glass pane — section two AND the glyph
     set — so it measures .pane, not .set. Measuring .set again would put the
     band's lower edge a full section too low and the climb would finish before
     section two had even entered the viewport. */
  var row = document.querySelector('.glass');
  var sec = document.querySelector('.pane');
  if (!row || !sec) return;

  var N = 7;                 /* columns in the staircase */
  var MID = (N - 1) / 2;
  var STAGGER = 1 / 15;      /* progress the centre leads each outward step by */
  /* The stagger and the ease-out above ARE the effect and are taken from the
     source exactly. The scroll window below is deliberately NOT: their section
     sits deep in the page, ours follows a 100vh hero, so their LEAD of 1.40
     started the climb 34% of the way up before the wheel had moved. LEAD 1.0
     puts U at exactly 0 while the row's bottom is still at the viewport bottom,
     so the hero is untouched until the first scroll. */
  var LEAD = 1.0;
  var SPAN = 0.85;

  /* One pane, clipped to a staircase — not seven scaled boxes. backdrop-filter
     follows a transform, so scaling a blurred box stretches its blur across the
     scale; clipping leaves the blur alone. Same geometry either way. */
  /* The pane is taller than the staircase band, so a step's top has to be
     expressed as a fraction of the WHOLE pane, not of the band. */
  function polygon(tops, frac) {
    var pts = [], i, x, y;
    for (i = 0; i < N; i++) {
      y = (tops[i] * frac).toFixed(3);
      x = (i * 100 / N).toFixed(4);
      pts.push(x + '% ' + y + '%');
      x = ((i + 1) * 100 / N).toFixed(4);
      pts.push(x + '% ' + y + '%');
    }
    pts.push('100% 100%', '0% 100%');
    return 'polygon(' + pts.join(',') + ')';
  }

  function apply(tops) {
    var pane = row.getBoundingClientRect().height;
    var band = pane - sec.getBoundingClientRect().height;
    var p = polygon(tops, pane > 0 ? band / pane : 1);
    row.style.webkitClipPath = p;
    row.style.clipPath = p;
  }

  /* reduced motion gets the finished state — a staircase that never climbs is
     just an odd silhouette, and the section still has to read as arrived */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply([0, 0, 0, 0, 0, 0, 0]);
    return;
  }

  var pending = false;
  function draw() {
    pending = false;
    var vh = window.innerHeight;
    var bottom = sec.getBoundingClientRect().top;   /* the band's lower edge */
    var U = ((vh * LEAD) - bottom) / (vh * SPAN);
    if (U < 0) U = 0; else if (U > 1) U = 1;

    var tops = [];
    for (var i = 0; i < N; i++) {
      var u = U - Math.abs(i - MID) * STAGGER;
      if (u < 0) u = 0; else if (u > 1) u = 1;
      var s = 1 - (1 - u) * (1 - u);            /* ease-out quad */
      tops.push(((1 - s) * 100).toFixed(3));    /* scale -> top edge of the step */
    }
    apply(tops);
  }
  function request() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  if (window.lenis && window.lenis.on) window.lenis.on('scroll', request);
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  draw();
})();
