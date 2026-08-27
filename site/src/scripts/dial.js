/* The ring comes alive only once the mark is seated in it.

   Cloned from labs.anyflow.agency — see docs/research/components/anyflow-ring.spec.md.
   The measured ordering, across 13 scroll positions, is the whole idea:

     approach  their mark's centre never leaves viewport centre while the ring
               climbs 882 -> 771 -> 660 -> 549, exactly 1:1 with the page. The
               ring rises to the mark; the mark does not travel to the ring.
     meeting   the two centres coincide, and from there they scroll together.
     spin-up   ONLY NOW does the ring begin to rotate — about +14 degrees per
               111px of scroll — and to pulse, 504 -> 710 -> 574.

   Nothing turns before the meeting. A dial that spins on the way in would read
   as decoration; one that sits inert until the mark lands in it reads as a
   mechanism engaging, and that is worth the extra care.

   The approach needs no code at all — the ring is centred in a 100vh stage in
   normal flow, so scrolling raises it toward the fixed hash on its own. This
   file measures the gap that is left and drives everything downstream of it. */
(function () {
  'use strict';

  var sec = document.querySelector('[data-dial]');
  var ring = document.querySelector('[data-dial-ring]');
  var stage = sec && sec.querySelector('.dial-stage');
  if (!sec || !ring || !stage) return;

  /* Where the mark actually is — ASKED FOR, never assumed.

     The first pass took the meeting point to be viewport centre, which is true
     on desktop because #hashgl is top:-16vh/height:132vh and centres itself
     there. On a phone that box is overridden to top:36vh/height:92vh for the
     hero's sake, putting the mark's centre at 82vh — so the ring rose to the
     middle of an empty screen and passed the hash 300px lower down.

     Measuring the canvas instead of guessing makes the section correct at any
     viewport, and immune to that box being retuned again later. */
  var mark = document.getElementById('hashgl') || document.querySelector('.hash-fallback');

  function markMid(vh) {
    if (mark) {
      var b = mark.getBoundingClientRect();
      if (b.height) return b.top + b.height / 2;
    }
    return vh / 2;
  }

  var STILL = matchMedia('(prefers-reduced-motion:reduce)');

  /* 14deg per 111px, straight off the measurement — restated PER VIEWPORT so it
     survives the screen it was not measured on. A per-pixel rate turns a taller
     window further for the same gesture: across the hold it came to 84deg at
     900vh and 134deg at 1440, and past about 110 the engraved words go over the
     top and read upside down. 113.5 is 14/111 x 900, so the laptop is unchanged
     and every other screen now matches it. */
  var DEG_PER_VH = (14 / 111) * 900;
  /* The dial ARRIVES LARGE AND CLOSES DOWN.

     It used to swell after the meeting, which put the growth in the wrong place
     — the dial got biggest just as the section was leaving. Inverted: it comes
     in at 1.45 while the hash is still tumbling toward it and lands at exactly
     1.0 on the frame the two meet. The ring closing and the hash shrinking now
     resolve on the same beat instead of fighting each other. */
  var SWELL = 0.45;
  /* THE DESCENT, AND THEN THE HAND-OVER.

     The shader already computes yaw as 0.34 + M.x*0.78 + SPIN, where M is the
     smoothed pointer — so the hash follows the cursor at ALL times, additively
     with whatever SPIN we write. Which means "stop rotating and just follow the
     cursor" needs no mode and no flag: it is enough for SPIN to stop changing.
     `seat` clamps at 1 the moment the ring arrives, so both the spin and the
     roll below freeze on their own and the pointer is left as the only thing
     still moving the object.

     The sweep is bounded on purpose. parallax.js hands over at -0.62 (yaw
     -0.28 rad). Landing at +0.10 puts yaw at 0.44, and the cursor can add
     +/-0.78 on top — so the worst case is 1.22 rad, comfortably short of the
     1.571 where a 20mm plate goes edge-on and renders as a smear. Sweeping the
     other way, or further, walks straight into that. */
  var SPIN_REST = -0.62;      /* the pose parallax.js leaves it holding */
  var SPIN_SEAT =  0.10;      /* where the descent lands it */
  /* the tumble: peaks mid-flight and resolves to flat, so it reads as a camera
     move that settles rather than a spin that halts */
  var ROLL_PEAK = -0.34;

  /* The hash SEATS ITSELF as the ring arrives.

     At parallax.js's resting pose (0.70) the hash is about 0.47vh across against
     a 0.60vh ring — it fills the dial and then spills straight out of it the
     moment the ring pulses. Shrinking to 0.46 as the ring closes leaves it
     sitting comfortably inside, roughly the proportion the original holds (a
     432 mark in a 504 ring).

     Both figures are in vh on purpose. #hashgl is height:132vh and --ring is
     min(30vh,23vw), so the ratio between mark and dial is now the same on a
     laptop and on a 27-inch display. It was not while the ring was 264 fixed
     pixels, which is exactly how the seated hash came to overrun the dial on
     large screens.

     It goes back to 0.70 on the way out rather than staying small, because the
     glass section downstream was composed around that pose and would otherwise
     inherit a hash a third too small. Seat, then resume. */
  var REST = 0.70, SEATED = 0.46;

  /* Viewports of scroll the sticky stage absorbs — 200vh section, less 26vh of
     lead, less the one viewport the stage itself occupies. It is stated here
     because every post-meeting beat is a fraction of it; if the section height
     in global.css changes, this is the one number that follows. */
  var DWELL = 0.74;

  var pending = false;
  var track = document.querySelector('[data-dial-seg="track"]');
  var says = [].slice.call(document.querySelectorAll('.dial-say-h'));
  var labWrap = document.querySelector('.dial-face');
  var rings = [].slice.call(document.querySelectorAll('.dial-wave i'));
  var labs = [].slice.call(document.querySelectorAll('.dial-word'));
  /* they arrive one after another rather than together — four things appearing
     at once is a state change, four arriving in sequence is an event, and only
     the second one is worth stopping for. The last finishes at 0.91, just
     before the ring seats, so the set is complete on the frame that matters. */
  var LAB_FROM = 0.22, LAB_STEP = 0.13, LAB_SPAN = 0.30;
  var px = 0, py = 0, havePointer = false, aim = 45;

  /* MEASURED ON RESIZE, NOT PER FRAME.

     Both of these used to be read inside draw(): getComputedStyle(sec) for the
     lead, and a second getBoundingClientRect on the ring for the pointer maths.
     Neither value can change while you scroll — the lead is a padding and the
     ring's LAYOUT size is fixed by --ring — so both were pure cost on every
     scroll frame, and the rect read was the expensive kind (see draw). */
  var lead = 0, ringDia = 0;
  function measure() {
    lead = parseFloat(getComputedStyle(sec).paddingTop) || 0;
    ringDia = ring.offsetWidth;
  }

  addEventListener('pointermove', function (ev) {
    px = ev.clientX; py = ev.clientY; havePointer = true; queue();
  }, { passive: true });

  /* ease-out cubic: the descent settles into the dial rather than stopping in it */
  function outCubic(t) { var u = 1 - t; return 1 - u * u * u; }

  function draw() {
    pending = false;
    if (STILL.matches) return;

    var vh = window.innerHeight;
    var r = ring.getBoundingClientRect();

    /* NOTHING TO DO WHILE THE SECTION IS NOWHERE NEAR THE SCREEN.

       Everything below — four rect reads, a transform, sixteen custom
       properties and a shader uniform — ran on every scroll frame of the whole
       page, including the entire 600vh of section three sitting on top of it.
       Two sections' worth of per-frame work overlapping is what made the seam
       between them the roughest part of the page. One viewport of margin either
       side keeps the approach and the exit fully driven. */
    if (r.bottom < -vh || r.top > vh * 2) return;

    var ringMid = r.top + r.height / 2;

    var seatY = markMid(vh);

    /* positive once the ring has risen past the mark — i.e. past the meeting */
    var d = seatY - ringMid;
    if (d < 0) d = 0;

    /* AND THE SCROLL THE HOLD SWALLOWS.

       ringMid is frozen while the stage is pinned, so `d` above stops counting
       the moment the dwell begins — the dial would sit inert for 74vh and then
       do all its work at once on release. This measures what sticky has
       absorbed: with no pin the stage's box sits exactly the section's padding
       below the section's own top, and every pixel of divergence from that is a
       pixel of scroll the hold has taken. Adding it back makes `d` continuous
       straight through the pin, so the spin-up, the ripple and the wedge run at
       the same rate as before — they simply now run while the dial is still on
       screen.

       The lead is read from computed padding-top, NOT from stage.offsetTop.
       offsetTop on a sticky element tracks the stuck position in Chrome rather
       than the static one, so it moved in lockstep with the rect and the whole
       expression was identically zero — measured at 234 / 360 / 540 / 720 / 900
       across the pin. A property that follows the thing you are trying to
       measure against cannot be the ruler. */
    var pinned = stage.getBoundingClientRect().top -
                 (sec.getBoundingClientRect().top + lead);
    if (pinned > 0) d += pinned;

    /* how close the ring still is to arriving: 0 far below, 1 at the meeting */
    var gap = ringMid - seatY;
    /* 0.35vh, not 0.55: the ring only ever starts about 0.35 of a viewport below
       the mark, so a wider window meant seat was already 0.37 on the first frame
       and the arc came in 28% drawn instead of empty. Measured, not guessed. */
    var seat = 1 - gap / (vh * 0.35);
    if (seat < 0) seat = 0; else if (seat > 1) seat = 1;
    /* THE HOLD, AS ONE NUMBER. Every beat after the meeting is a fraction of the
       dwell rather than of a viewport. They were raw d/vh, tuned back when the
       ring left the screen 44vh after the meeting — which put the wedge's cue at
       1.02vh, a full viewport ABOVE the mark, where nothing could ever see it.
       Stated as a fraction of the hold they land inside it by construction.

       NAMED `hold`, and it matters: this was `q` for one build, which is also
       the counter of the says loop 40 lines down. var is function-scoped, so
       that loop overwrote it with 2 before the ripple, the wedge and the hash's
       own seating ever read it — the wedge sat permanently on, the water never
       moved, and the mark never shrank into the dial. Nothing threw. */
    var hold = (d / vh) / DWELL;

    /* and how far past it has since travelled, so the hash can resume its pose.
       It waits for the hold to finish: growing back to REST while still seated
       would undo the seating in front of you. */
    var leave = (hold - 1.03) / 0.62;
    if (leave < 0) leave = 0; else if (leave > 1) leave = 1;

    var spin = (d / vh) * DEG_PER_VH;
    ring.style.transform =
      'rotate(' + spin.toFixed(2) + 'deg) scale(' +
      (1 + SWELL * (1 - outCubic(seat))).toFixed(4) + ')';

    /* the mark turns with the dial it is sitting in. HashGL.set(zoom, yaw) —
       0.70 is the pose parallax.js leaves it holding at the end of the hero, so
       starting anywhere else would make the hash jump on the first frame. */
    /* The pointer, as an angle about the dial's centre and as a position on it.

       This read the ring's rect a SECOND time, three lines after writing its
       transform — which is a forced synchronous layout, every frame, on the
       element the raymarched canvas sits behind. The style write invalidates
       layout and the read makes the browser flush it there and then, before it
       is ready to.

       `r` is the same box read at the top of the frame, and a rotate/scale about
       the centre does not move the centre, so cx/cy are identical. The hotspot's
       denominators come from the LAYOUT size instead of the transformed one,
       which is what they should always have been: the highlight belongs to the
       face, not to whatever the swell has momentarily scaled it to. */
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dia = ringDia || r.width;
    if (havePointer) {
      var want = Math.atan2(px - cx, -(py - cy)) * 180 / Math.PI;  /* 0 at twelve, clockwise */
      /* shortest way round, so crossing twelve does not unwind the long way */
      var diff = ((want - aim + 540) % 360) - 180;
      aim += diff * 0.12;
      /* KEEP EASING AFTER THE LAST EVENT.

         draw() is event-driven — it runs when something queues it. A pointermove
         therefore bought exactly ONE 12% step, and the marker crawled a twelfth
         of the way and stopped, which is why it sat near its old angle no matter
         where the pointer went. Re-queueing while the gap is still open turns a
         single event into a proper glide that settles on its own. */
      if (Math.abs(diff) > 0.1) queue();
      /* the glass hotspot rides the pointer across the face */
      ring.style.setProperty('--gx', (50 + Math.max(-50, Math.min(50, (px - cx) / dia * 100))).toFixed(1) + '%');
      ring.style.setProperty('--gy', (50 + Math.max(-50, Math.min(50, (py - cy) / dia * 100))).toFixed(1) + '%');
    }
    /* The statement flies in from both edges and resolves.

       This is the earlier reveal's transform run BACKWARDS. That one rested
       centred and scrolling threw it apart; this one starts thrown and settles,
       because here the text arrives to frame the dial rather than clearing out
       of the way. perspective first in the chain, as it was, so the turn reads
       as depth rather than a squash.

       Eased rather than linear, and deliberately: the original was a departure,
       where linear is right because the thing is leaving at a constant rate. An
       arrival wants to decelerate into its resting place. Mobile stacks the two
       above and below the ring, so the horizontal fly-in is halved there to keep
       it from crossing the whole screen. */
    var sayE = outCubic(seat);
    var wide = innerWidth > 900;
    for (var sq = 0; sq < says.length; sq++) {
      var dir = says[sq].dataset.say === 'l' ? -1 : 1;
      var u = 1 - sayE;
      says[sq].style.transform =
        'translateY(-50%) perspective(1200px)' +
        ' translateX(' + (dir * (wide ? 2000 : 900) * u).toFixed(1) + 'px)' +
        ' scale(' + (1 + 0.5 * u).toFixed(4) + ')' +
        ' rotateY(' + (dir * 60 * u).toFixed(2) + 'deg)';
      says[sq].style.opacity = sayE.toFixed(3);
    }

    /* ---- the ripple train ------------------------------------------------

       It starts when the hash BREAKS THE DIAL'S EDGE, not when it parks. The
       phase therefore runs off both halves of the journey: roughly a cycle and
       a half while the hash is still coming down, and another after it has
       seated. Four rings share that one phase a quarter-cycle apart, each
       wrapping back to the centre at the rim, so the surface is never still.

       amp is the energy in the water. It rises as the hash enters — nothing is
       disturbing anything before that — holds through the meeting, and drains
       away once the last ring has run out, which is what leaves the dial calm
       enough for the wedge to arrive into. */
    var phase = seat * 1.6 + hold * 1.4;

    var amp = (seat - 0.26) / 0.34;
    if (amp < 0) amp = 0; else if (amp > 1) amp = 1;
    var fade = (hold - 0.58) / 0.30;
    if (fade < 0) fade = 0; else if (fade > 1) fade = 1;
    amp *= (1 - fade);

    for (var n = 0; n < rings.length; n++) {
      var pr = (phase - n / rings.length) % 1;
      if (pr < 0) pr += 1;
      rings[n].style.setProperty('--p', pr.toFixed(4));
      rings[n].style.setProperty('--a', amp.toFixed(3));
    }

    /* the wedge waits for the water to settle, not merely for one ring to land */
    var wedge = (hold - 0.38) / 0.22;
    if (wedge < 0) wedge = 0; else if (wedge > 1) wedge = 1;
    if (labWrap) labWrap.style.setProperty('--wedge', wedge.toFixed(3));

    /* the labels write themselves in, one after the next */
    for (var i = 0; i < labs.length; i++) {
      var t = (seat - (LAB_FROM + i * LAB_STEP)) / LAB_SPAN;
      labs[i].style.setProperty('--t', (t < 0 ? 0 : t > 1 ? 1 : t).toFixed(3));
    }

    /* and the hash is told where the dial is, so it can recolour where the two
       overlap. r comes off the drawn circle (345 of a 700 box), not the div. */
    if (window.HashGL && window.HashGL.dial) {
      /* offsetWidth, not the rect. getBoundingClientRect returns the AXIS-ALIGNED
         box of a ROTATED element, so once the dial starts turning r.width grows
         toward diameter x sqrt(2) — at 45 degrees the recolour circle was 41%
         too big and the hash turned pale well outside the glass. offsetWidth is
         the layout size and is blind to the transform, which is what this wants. */
      window.HashGL.dial(cx, ringMid, (dia / 2) * (345 / 350), 1);
    }

    /* the black edge swings to face the pointer. Only this group turns — the
       other three hold their angles, which is what makes it read as one live
       marker on a fixed dial rather than the whole face slewing. */
    if (track) track.style.transform = 'rotate(' + (aim - 45).toFixed(2) + 'deg)';
    /* and the rim shine follows the dial's own rotation, so the light looks like
       it belongs to the object rather than to the page */
    ring.style.setProperty('--shine', (spin + aim * 0.35).toFixed(1) + 'deg');

    if (window.HashGL) {
      /* TAKE THE WHEEL, EXPLICITLY.

         parallax.js writes HashGL.set on these same scroll frames, and whichever
         call lands last wins — which is why the hash kept snapping back to full
         size at the meeting even though the shrink was being computed correctly.
         parallax.js already carries a guard for exactly this (__hashJourney);
         it just needed setting.

         It is set from `seat` rather than once at load, so the hero still owns
         the pose on the way down and only hands over when the dial starts
         closing. */
      window.__hashJourney = seat > 0.001;
      if (window.__hashJourney) {
        var e = outCubic(seat);
        window.HashGL.set(
          REST - (REST - SEATED) * seat * (1 - leave),
          SPIN_REST + (SPIN_SEAT - SPIN_REST) * e * (1 - leave),
          ROLL_PEAK * Math.sin(Math.PI * seat) * (1 - leave));
      }
    }
  }

  function queue() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', function () { measure(); queue(); });
  measure();
  draw();
})();
