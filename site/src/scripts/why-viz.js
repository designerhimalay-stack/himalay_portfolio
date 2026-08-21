/* Section four's four artworks.

   The reference plays these as Rive files (two .riv documents authored in the
   Rive editor, drawn through their WASM runtime). Those are blink's artwork, not
   ours to lift, so each one is rebuilt here in plain 2D canvas from measurements
   taken off their rendered frames — grid pitch, radii, angles, colour and the
   gradient falloff were all read out of the pixels rather than guessed
   (docs/research/components/pinned-wipe.spec.md).

   Every renderer draws into a 1:2 box and works in ARTBOARD UNITS: the bay is
   347 wide at the size everything was measured at, so u = w/347 converts a
   measured pixel straight into a coordinate here and the geometry holds at any
   card size.

   One rAF drives all four, and only the ones on screen tick — four independent
   loops behind a pinned section is four times the work for no visible gain. */
(function () {
  'use strict';

  var HOT = '204,114,69';        /* #cc7245 — sampled off their own dots */
  /* Both accents are quoted as the colour their pixels ACTUALLY land on, at
     alpha 1 over the section's 215 paper — not as the notional swatch behind
     them. Sampling the reference gives an alpha profile directly in these terms,
     so the gradient stops below can be copied across without a second blend. */
  var COOL = '146,158,105';      /* #929e69 */
  var INK = '39,36,36';

  /* ------------------------------------------------------------ renderers */
  var VIZ = {};

  /* 1 — FIBER. A rule field with a measuring bar rising through it, bleeding
     heat downward. Five rules at a pitch of 58, the last one 7 in from the right
     edge, so the field covers the outer two thirds of the bay and leaves the
     inner third open. The open third is what stops the bay reading as a texture:
     the bundle has an edge, and an edge implies the rest of the run off-card. */
  VIZ.fiber = function (c, w, h, t) {
    var u = w / 347;
    var pitch = 58 * u, last = w - 7 * u;
    var i, x;

    c.lineWidth = 1;
    /* .16, not the .27 a single element capture of their canvas suggested — that
       capture was scaled, which doubled the apparent weight. Compared like for
       like, whole page against whole page, their rules land at 183-193 on 215
       paper, and .16 is what puts ours in the same band. */
    c.strokeStyle = 'rgba(' + INK + ',.16)';
    /* laid out from the right edge inward, which is where the bundle is anchored
       — walking in from the left leaves the last rule's offset to rounding */
    for (i = 0; i < 5; i++) {
      x = last - i * pitch;
      /* +.5 so a 1px stroke lands on the pixel rather than across two of them */
      var px = Math.round(x) - 0.5;
      c.beginPath(); c.moveTo(px, 0); c.lineTo(px, h); c.stroke();
    }

    /* 4.4s: ~3.3s of travel, then a beat of empty bay before it runs again.
       The pause is doing work — without it the bar reads as a repeating
       pattern rather than as a single measurement being taken. */
    var CYCLE = 4.4, RUN = 0.75;
    var k = (t % CYCLE) / CYCLE;
    if (k > RUN) return;

    var p = k / RUN;
    var y = Math.round(h * 1.02 - p * h * 1.08) - 0.5;
    /* it fades out into the top rather than clipping off it */
    var a = p > 0.9 ? 1 - (p - 0.9) / 0.1 : 1;

    /* the heat spans the two cells between the second and fourth rule */
    var x2 = last - pitch, x1 = last - 3 * pitch;
    var len = 140 * u;                        /* measured falloff, ~0.2 of the height */

    var g = c.createLinearGradient(0, y, 0, y + len);
    /* not a straight ramp — read off their pixels, it decays like exp(-d/70) */
    [[0, 1], [0.15, 0.76], [0.3, 0.6], [0.45, 0.47], [0.6, 0.33], [0.75, 0.22], [1, 0]]
      .forEach(function (s) { g.addColorStop(s[0], 'rgba(' + HOT + ',' + (s[1] * a).toFixed(3) + ')'); });
    c.fillStyle = g;
    c.fillRect(x1, y, x2 - x1, len);

    c.globalAlpha = a;
    c.strokeStyle = 'rgba(' + INK + ',.62)';
    c.beginPath(); c.moveTo(last - 4 * pitch, y); c.lineTo(w, y); c.stroke();

    c.fillStyle = 'rgb(' + HOT + ')';
    [x1, x2].forEach(function (dx) {
      c.beginPath(); c.arc(dx, y, 5 * u, 0, 6.2832); c.fill();
    });
    c.globalAlpha = 1;
  };

  /* 2 — RADAR. Pivot on the bay's right edge at half height, radius 256 of 347,
     so only the left half of the disc is ever in frame — which is the point: the
     card shows a slice of something larger than the card.

     Two things came out of the reference that guesswork would have got wrong.

     The trail does not follow the head at a fixed lag — it ACCUMULATES. Caught
     a second after the section pins, their wedge is a sliver beside the sweep
     line; several seconds later the disc is full. So the fill runs from where
     the sweep started to wherever the head is now, and the disc paints itself in
     over one turn before clearing and starting again.

     And the two dotted arcs are not concentric. The inner one is the disc's own
     edge (r 256, and it stops ~79° either side of horizontal rather than closing
     at the top and bottom). The outer one is a much larger circle centred far
     off to the right — fitting three of its points puts its centre at 2.06w and
     its radius at 1.78w — so the two curves converge toward the top of the bay
     instead of running parallel. That convergence is the whole reason the pair
     reads as a plan drawing rather than as a target. */
  VIZ.radar = function (c, w, h, t) {
    var u = w / 347;
    var cx = w, cy = h / 2, R = 256 * u;
    var CYCLE = 7.2, TURN = 5.6;              /* one turn, then a beat, then clear */

    /* the disc edge, opened at top and bottom */
    dottedArc(c, cx, cy, R, Math.PI * 101 / 180, Math.PI * 259 / 180, 1.1 * u, 9 * u, 'rgba(' + INK + ',.30)');
    /* the larger arc, swung from a centre off the right of the bay */
    dottedArc(c, cx + 1.058 * w, cy, 1.775 * w, Math.PI * 0.62, Math.PI * 1.38, 0.85 * u, 8 * u, 'rgba(' + INK + ',.22)');

    var k = (t % CYCLE) / CYCLE;
    var p = Math.min(k * CYCLE / TURN, 1);    /* 0..1 through the turn, then held */
    /* it clears by fading, over the last fifth of the cycle */
    var fade = k > 0.93 ? 1 - (k - 0.93) / 0.07 : 1;
    var head = Math.PI / 2 + p * 6.2832;      /* canvas angles run clockwise on screen */

    if (p > 0.004) {
      c.save();
      c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.clip();
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, R * 1.02, Math.PI / 2, head);
      c.closePath();
      c.clip();

      /* Thin toward the pivot, full toward the rim. These eight stops are their
         measured profile read straight off a filled frame along three separate
         rays — .45 at the centre climbing to .83 at the rim. It is the depth in
         this ramp that keeps the disc from reading as a flat green pie. */
      var rg = c.createRadialGradient(cx, cy, 0, cx, cy, R);
      [[0, 0.42], [0.16, 0.53], [0.29, 0.57], [0.41, 0.60],
       [0.54, 0.66], [0.66, 0.69], [0.79, 0.74], [1, 0.77]]
        .forEach(function (st) {
          rg.addColorStop(st[0], 'rgba(' + COOL + ',' + (st[1] * fade).toFixed(3) + ')');
        });
      c.fillStyle = rg;
      c.fillRect(cx - R, cy - R, R * 2, R * 2);
      c.restore();
    }

    var dx = cx + R * Math.cos(head), dy = cy + R * Math.sin(head);
    c.globalAlpha = fade;
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(' + INK + ',.62)';
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(dx, dy); c.stroke();
    c.fillStyle = 'rgb(' + COOL + ')';
    c.beginPath(); c.arc(dx, dy, 4 * u, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
  };

  /* 3 — BOOK. Depth either side of a price: heat bleeding left off the edge,
     cool bleeding right, levels drifting up and recycling at the foot. */
  VIZ.book = function (c, w, h, t) {
    var u = w / 347;
    var mid = 214 * u;                        /* the edge both sides push away from */
    var PITCH = 148 * u, N = 7, SPEED = 26 * u;

    for (var i = 0; i < N; i++) {
      var y = ((i * PITCH - t * SPEED) % (N * PITCH) + N * PITCH) % (N * PITCH) - PITCH;
      var seed = i * 2.399;                   /* golden-ish, so the sizes never march */
      var band = (46 + 26 * (0.5 + 0.5 * Math.sin(seed))) * u;
      var wl = (60 + 46 * (0.5 + 0.5 * Math.sin(seed * 1.7 + t * 0.5))) * u;
      var wr = (14 + 22 * (0.5 + 0.5 * Math.sin(seed * 2.3 + t * 0.4))) * u;
      /* the top and bottom of the bay are a fade-in and fade-out, so levels are
         never seen to pop into existence at a hard edge */
      var a = Math.min(1, Math.min(y + band, h - y) / (90 * u));
      if (a <= 0) continue;

      var gl = c.createLinearGradient(mid - wl, 0, mid, 0);
      gl.addColorStop(0, 'rgba(' + HOT + ',0)');
      gl.addColorStop(1, 'rgba(' + HOT + ',' + (0.78 * a).toFixed(3) + ')');
      c.fillStyle = gl;
      c.fillRect(mid - wl, y, wl, band);

      var gr = c.createLinearGradient(mid, 0, mid + wr, 0);
      gr.addColorStop(0, 'rgba(' + COOL + ',' + (0.6 * a).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(' + COOL + ',0)');
      c.fillStyle = gr;
      c.fillRect(mid, y, wr, band);

      c.fillStyle = 'rgba(' + INK + ',' + (0.5 * a).toFixed(3) + ')';
      c.fillRect(Math.round(mid) - 0.5, y, 1, band);
    }
  };

  /* 4 — CURVE. A cubic climbing out of the bottom-left corner, hot where it is
     flat and cool where it turns up, with a marker running the length of it. */
  VIZ.curve = function (c, w, h, t) {
    var u = w / 347;
    var EXP = 3.2;
    var at = function (p) { return [p * w, h - h * Math.pow(p, EXP)]; };

    var path = new Path2D();
    for (var p = 0; p <= 1.0001; p += 0.02) {
      var q = at(p);
      if (p === 0) path.moveTo(q[0], q[1]); else path.lineTo(q[0], q[1]);
    }

    var g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(' + HOT + ',.85)');
    g.addColorStop(0.45, 'rgba(' + HOT + ',.5)');
    g.addColorStop(0.75, 'rgba(' + COOL + ',.5)');
    g.addColorStop(1, 'rgba(' + COOL + ',.62)');

    /* the glow is three widening strokes, not one blurred one: ctx.filter is
       unevenly supported and costs a full-surface blur every frame for an
       effect three cheap strokes give away */
    c.save();
    c.strokeStyle = g; c.lineCap = 'round';
    [[54, 0.16], [30, 0.26], [13, 0.42]].forEach(function (s) {
      c.lineWidth = s[0] * u; c.globalAlpha = s[1];
      c.stroke(path);
    });
    c.restore();

    c.lineWidth = 1;
    c.strokeStyle = 'rgba(' + INK + ',.4)';
    c.stroke(path);

    /* 5.2s bottom to top, then it starts over from the corner */
    var k = (t % 5.2) / 5.2;
    var m = at(k);
    c.strokeStyle = 'rgba(' + INK + ',.55)';
    c.beginPath(); c.arc(m[0], m[1], 7 * u, 0, 6.2832); c.stroke();
    c.fillStyle = 'rgb(' + HOT + ')';
    c.beginPath(); c.arc(m[0], m[1], 3.4 * u, 0, 6.2832); c.fill();
  };

  /* Dots placed by angle, not a dashed stroke: setLineDash spaces its dashes
     along the path, so the same dash pattern on a 256px arc and a 616px arc
     gives two visibly different textures. Stepping by arc-length keeps one dot
     size and one gap on both. */
  function dottedArc(c, cx, cy, r, a0, a1, dot, pitch, fill) {
    var step = pitch / r;
    c.fillStyle = fill;
    for (var a = a0; a <= a1; a += step) {
      c.beginPath();
      c.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), dot, 0, 6.2832);
      c.fill();
    }
  }

  /* ------------------------------------------------------------- the loop */
  var items = [].slice.call(document.querySelectorAll('.why-viz canvas'))
    .map(function (el) { return { el: el, draw: VIZ[el.getAttribute('data-viz')], on: false, w: 0, h: 0 }; })
    .filter(function (it) { return it.draw; });
  if (!items.length) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    /* one frame, held: the artwork is information, the motion is not */
    items.forEach(function (it) { size(it); it.draw(it.el.getContext('2d'), it.w, it.h, 1.6); it.el.classList.add('on'); });
    return;
  }

  function size(it) {
    var r = it.el.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return false;
    it.w = r.width; it.h = r.height;
    var bw = Math.round(r.width * dpr), bh = Math.round(r.height * dpr);
    if (it.el.width !== bw || it.el.height !== bh) {
      it.el.width = bw; it.el.height = bh;
    }
    var c = it.el.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      items.forEach(function (it) { if (it.el === e.target) it.on = e.isIntersecting; });
    });
  }, { rootMargin: '20%' });
  items.forEach(function (it) { io.observe(it.el); });

  addEventListener('resize', function () { items.forEach(function (it) { it.w = 0; }); }, { passive: true });

  var t0 = performance.now();
  (function frame(now) {
    requestAnimationFrame(frame);
    var t = (now - t0) / 1000;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.on) continue;
      if (!it.w && !size(it)) continue;
      var c = it.el.getContext('2d');
      c.clearRect(0, 0, it.w, it.h);
      it.draw(c, it.w, it.h, t);
    }
  })(t0);
})();
