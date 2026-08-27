/* The hash's journey across section three.

   parallax.js owns the hero: it glides the hash to the centre of the viewport over
   the first 0.85 of a screen and then holds — zoom 0.70, spin -0.62, --par 0. From
   there the object had roughly three viewports of nothing to do while two sections
   went past. This is what it does instead.

   Three acts, and NOT a third clock. Everything reads the same two numbers the rest
   of the page already turns on:

     A  the handoff.  1 - whyTop/vh, clamped. 0 while section three is still a
        screen below, 1 the moment its top reaches the viewport top. This is the
        window stepped.js climbs its staircase over.
     s  the wipe.     -whyTop/vh, clamped to [0, 2] — the exact expression why.js
        drives the four-card rail with, so the hash and the cards are one mechanism
        rather than two things that happen to overlap.

   They hand off at whyTop = 0: past it A is pinned at 1 and s starts moving, so the
   two acts meet exactly once and cannot both be mid-flight.

     ACT I   the reach.    A: 0 -> 1. Centre to -22vw, zoom 0.70 -> 1.40 (double, and
             the reason the canvas box in global.css is as wide as it is), yaw opens
             from -0.62 toward -0.10, roll takes it to -0.22. Ease-out: it arrives
             and settles rather than stopping. By the end the staircase has closed
             over it — Act I is played through the strip the steps have not yet
             covered, and then the sheet takes it.
     ACT II  the traverse. s: 0 -> 2. It waits out the first beat (the room is still
             white and card one is being read), then the dim re-reveals it already
             large and in position, and it runs -22vw -> +26vw, zoom 1.40 -> 0.55,
             yaw -0.10 -> +0.85, roll settling to +0.08. Ease-in-out, because a long
             travel that starts and stops abruptly reads as a slide, not a shot.
     ACT III the hold.     s clamps at 2, so the pose holds by construction. The next
             section inherits a composed frame instead of catching the hash mid-move.

   YAW SAFETY. Rest yaw is 0.34 + M.x*0.78 + breathing + SPIN, about -0.28 rad at
   SPIN -0.62. Edge-on is +-1.571, where a 20mm plate renders as a smear — the exact
   failure parallax.js's TURN comment records. The arc here ends at SPIN +0.85, i.e.
   yaw about +1.19 rad / 68deg: a three-quarter view, never crossing 90, and small
   and leaving frame by the time it gets there. Do not raise SPIN_R past +1.05
   without re-checking that number against a live cursor at M.x = 1. */
(function () {
  'use strict';

  var sec = document.querySelector('.why');
  if (!sec || !window.HashGL) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  /* the same breakpoint the section unpins at. With no pin there is no traverse to
     hang on it, and a hash sliding around behind a plain stack is just noise. */
  var wide = matchMedia('(min-width: 1024px)');

  /* the three poses, in the order they are played */
  var ZOOM_0 = 0.70, SPIN_0 = -0.62, ROLL_0 = 0.00, HX_0 = 0.00;   /* parallax.js's rest */
  var ZOOM_L = 1.40, SPIN_L = -0.10, ROLL_L = -0.22, HX_L = -0.22; /* left, doubled */
  var ZOOM_R = 0.55, SPIN_R = 0.85, ROLL_R = 0.08, HX_R = 0.26;    /* right, receded */

  /* Act II holds the opening pose for its first beat so the reader gets one settled
     white frame before anything moves. It is the same 0.15 why.js starts the dim
     from — the hash begins to travel on the frame the room begins to dim. */
  var HOLD = 0.15;

  var pending = false;
  var lowRes = false;

  function draw() {
    pending = false;

    var lerp = function (a, b, t) { return a + (b - a) * t; };

    if (!wide.matches || reduce.matches) {
      /* hand the rest pose back and get out of parallax.js's way */
      document.documentElement.style.removeProperty('--hx');
      window.__hashJourney = false;
      return;
    }

    var vh = window.innerHeight;
    var top = sec.getBoundingClientRect().top;

    var A = 1 - top / vh;
    if (A < 0) A = 0; else if (A > 1) A = 1;

    var s = -top / vh;
    if (s < 0) s = 0; else if (s > 2) s = 2;

    /* Once the reach has started, this file is the only writer of the pose.
       parallax.js keeps evaluating past the hero and would otherwise re-assert
       zoom 0.70 / spin -0.62 on the same frames, and which of the two landed last
       would come down to script import order. A flag is a plainer contract. */
    window.__hashJourney = A > 0;
    if (A <= 0) return;

    var zoom, spin, roll, hx;

    if (s <= 0) {
      /* ACT I — ease-out, so it settles into the left pose rather than hitting it */
      var e = 1 - (1 - A) * (1 - A);
      zoom = lerp(ZOOM_0, ZOOM_L, e);
      spin = lerp(SPIN_0, SPIN_L, e);
      roll = lerp(ROLL_0, ROLL_L, e);
      hx = lerp(HX_0, HX_L, e);
    } else {
      /* ACT II — ease-in-out over the part of the wipe that is left after the hold */
      var u = (s / 2 - HOLD) / (1 - HOLD);
      if (u < 0) u = 0; else if (u > 1) u = 1;
      var f = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      zoom = lerp(ZOOM_L, ZOOM_R, f);
      spin = lerp(SPIN_L, SPIN_R, f);
      roll = lerp(ROLL_L, ROLL_R, f);
      hx = lerp(HX_L, HX_R, f);
    }

    /* --hx is authored as a fraction of the viewport width so the travel keeps its
       proportion on any screen, and written in px so it composes with --par, which
       parallax.js also writes in px.

       It goes on the ROOT, not on the canvas. Custom properties inherit down the
       tree and do not cross it, and section three's bloom has to track this exact
       value — on the canvas it would be invisible to everything else on the page.
       The canvas inherits it from here, so there is still only one writer and one
       value. */
    var px = (hx * window.innerWidth).toFixed(1) + 'px';
    document.documentElement.style.setProperty('--hx', px);
    window.HashGL.set(zoom, spin, roll);

    /* The box in global.css is wide enough for zoom 1.40, which is 1.91x the
       fragments the hero needs. Full dpr is worth paying for a hash that is sitting
       still and being looked at; it is not worth paying for one mid-traverse, where
       the motion hides the softer edge anyway. So resolution comes down while it is
       actually moving and goes back up the moment it settles — which is Act III,
       the pose it holds for whatever comes next. */
    var moving = s > 0 && s < 2;
    if (moving !== lowRes) { lowRes = moving; window.HashGL.quality(!moving); }
  }

  function request() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  if (window.lenis && window.lenis.on) window.lenis.on('scroll', request);
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  draw();
})();
