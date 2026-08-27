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

  /* Two panes climb on this model now, so it is written once and driven over a
     list rather than copied. Each entry is the pane that gets clipped, the
     element whose TOP is measured against the viewport, and how much of that
     pane the staircase has to travel:

       .glass  — section two. The staircase now reveals the whole glass pane
                 (section two AND the glyph set), so it measures .pane, not .set.
                 Measuring .set again would put the band's lower edge a full
                 section too low and the climb would finish before section two
                 had even entered the viewport. Its band is a fraction of the
                 pane's height, hence the frac below.
       .why-paper — section three's white sheet. It is exactly its own section's
                 pin, so the staircase runs its full height and frac is 1.

     One list, one stagger, one curve: the two sections cannot drift apart into
     two subtly different staircases, which is the whole reason they read as the
     same move happening twice. */
  /* One entry per pane, and each glass paired with ITS OWN pane.

     This used to be two hand-written entries picking .glass and .pane with a
     singular querySelector. That works while there is exactly one of each; the
     moment a second pane exists the first pane's glass gets driven twice and the
     second gets no staircase at all — and a global .glass lookup could pair a
     sheet with a section it does not live in. Building the list from the panes
     removes both problems.

     The old second entry (.why-paper / .why) is gone with the section it
     belonged to; filtering on row drops anything whose elements are absent. */
  var TARGETS = [].slice.call(document.querySelectorAll('.pane')).map(function (sec) {
    return { row: sec.querySelector('.glass'), sec: sec, band: true, cut: true };
  }).filter(function (t) { return t.row && t.sec; }).filter(function (t) { return t.row && t.sec; });
  if (!TARGETS.length) return;

  /* The LEAD target is section three's sheet: its step edge IS the boundary between
     the two sections, and the CUT targets are given a stepped BOTTOM on that same
     line so section two ends exactly where section three begins. One staircase, two
     sides of it — which is what makes them read as cut pieces rather than as one
     pane sliding over another.

     Measuring .glass's bottom against .why's top at five scroll positions gives
     1000/1000, 700/700, 400/400, 135/135, 0/0 — they already share the boundary, so
     nothing here moves geometry. It only decides which side of the line each pane
     keeps. */
  var lead = TARGETS.filter(function (t) { return t.lead; })[0];

  /* text-on-path.js builds .tpath-stage and loads AFTER this file, so it cannot be
     resolved at module scope — it would be null and section two's sentence would
     hang below its own glass over section three's ground. Resolved on first sight
     and cached. */
  var stage = null, stageLooked = false;
  function tpathStage() {
    if (!stageLooked) {
      stage = document.querySelector('.tpath-stage');
      if (stage) stageLooked = true;
    }
    return stage;
  }

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
  /* Out along the top staircase left to right, then back along the bottom one
     right to left. With bots null the bottom is the flat 100% it always was. */
  function polygon(tops, frac, bots) {
    var pts = [], i, x, y;
    for (i = 0; i < N; i++) {
      y = (tops[i] * frac).toFixed(3);
      x = (i * 100 / N).toFixed(4);
      pts.push(x + '% ' + y + '%');
      x = ((i + 1) * 100 / N).toFixed(4);
      pts.push(x + '% ' + y + '%');
    }
    if (bots) {
      for (i = N - 1; i >= 0; i--) {
        y = bots[i].toFixed(3);
        x = ((i + 1) * 100 / N).toFixed(4);
        pts.push(x + '% ' + y + '%');
        x = (i * 100 / N).toFixed(4);
        pts.push(x + '% ' + y + '%');
      }
    } else {
      pts.push('100% 100%', '0% 100%');
    }
    return 'polygon(' + pts.join(',') + ')';
  }

  /* The boundary in SCREEN px, per column — the lead sheet's own step edge. */
  function boundary(tops) {
    var r = lead.row.getBoundingClientRect();
    var out = [];
    for (var i = 0; i < N; i++) out.push(r.top + (tops[i] / 100) * r.height);
    return out;
  }

  /* Screen px into one element's own percentage space, clamped so the bottom can
     never rise above the top. An inverted polygon self-intersects and renders as
     torn garbage rather than as nothing, so this clamp is the one guard in the
     whole staircase that is load-bearing rather than tidy. */
  function cutAt(el, edge, tops, frac) {
    var r = el.getBoundingClientRect();
    if (r.height <= 0) return null;
    var out = [];
    for (var i = 0; i < N; i++) {
      var b = (edge[i] - r.top) / r.height * 100;
      var floor = tops[i] * frac;
      if (b < floor) b = floor; else if (b > 100) b = 100;
      out.push(b);
    }
    return out;
  }

  function apply(t, tops, edge) {
    var frac = 1;
    if (t.band) {
      /* the pane is taller than the staircase band, so a step's top has to be
         expressed as a fraction of the WHOLE pane, not of the band */
      var pane = t.row.getBoundingClientRect().height;
      frac = pane > 0 ? (pane - t.sec.getBoundingClientRect().height) / pane : 1;
    }
    var bots = (t.cut && edge) ? cutAt(t.row, edge, tops, frac) : null;
    var p = polygon(tops, frac, bots);
    t.row.style.webkitClipPath = p;
    t.row.style.clipPath = p;
  }

  /* the steps for one target, from its own section's top */
  function steps(t, vh) {
    var bottom = t.sec.getBoundingClientRect().top;   /* the band's lower edge */
    var U = ((vh * LEAD) - bottom) / (vh * SPAN);
    if (U < 0) U = 0; else if (U > 1) U = 1;

    var tops = [];
    for (var i = 0; i < N; i++) {
      var u = U - Math.abs(i - MID) * STAGGER;
      if (u < 0) u = 0; else if (u > 1) u = 1;
      var s = 1 - (1 - u) * (1 - u);              /* ease-out quad */
      tops.push((1 - s) * 100);                   /* scale -> top edge of the step */
    }
    return tops;
  }

  /* reduced motion gets the finished state — a staircase that never climbs is
     just an odd silhouette, and the section still has to read as arrived. No cut
     either: with nothing animating there is no handoff to show, and a stepped
     bottom on a static pane is just a chewed edge. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    TARGETS.forEach(function (t) { apply(t, [0, 0, 0, 0, 0, 0, 0], null); });
    return;
  }

  var pending = false;
  function draw() {
    pending = false;
    var vh = window.innerHeight;

    /* the lead's steps are computed first because they ARE the boundary the cut
       targets are measured against — order here is a dependency, not a preference */
    var edge = lead ? boundary(steps(lead, vh)) : null;

    TARGETS.forEach(function (t) { apply(t, steps(t, vh), edge); });

    /* section two's sentence is eaten on the same line as its glass. Without this
       the type outlives the pane it sits on and hangs over section three's ground. */
    var st = tpathStage();
    if (st && edge) {
      var bots = cutAt(st, edge, [0, 0, 0, 0, 0, 0, 0], 1);
      if (bots) {
        var p = polygon([0, 0, 0, 0, 0, 0, 0], 1, bots);
        st.style.webkitClipPath = p;
        st.style.clipPath = p;
      }
    }
  }
  function request() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  if (window.lenis && window.lenis.on) window.lenis.on('scroll', request);
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  draw();
})();
