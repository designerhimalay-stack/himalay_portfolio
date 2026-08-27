/* The viewport: a wireframe form, turned by scroll.

   REAL VERTICES, PROJECTED EVERY FRAME. Each form is a list of 3D points and the
   edges between them; scrolling rotates them about Y, tilts the whole thing back,
   and drops z. That is a dozen lines of maths and it is the only way the shape
   foreshortens — a CSS rotate on flat SVG keeps every edge the same length and
   reads as a sticker being spun the moment it turns past a few degrees.

   One clamped progress drives everything: which stage is live, which form is
   drawn, the rail, the right panel and the readout. No per-stage state and no
   direction flag, so scrubbing back up runs it in reverse for free. */
(function () {
  'use strict';

  /* The section, addressed by CLASS as well as attribute.

     [data-lab] alone matched a <g data-lab="0"> inside section two's dial — that
     element comes first in the DOM, so querySelector handed back an SVG group
     from a different section and this file silently returned. Two components
     had quietly agreed on the same attribute name. The dial's has been renamed;
     scoping to .lab here means a future collision cannot resurrect the bug. */
  var sec = document.querySelector('section.lab[data-lab]');
  if (!sec) return;

  var g     = sec.querySelector('[data-lab-wire]');
  var deg   = sec.querySelector('[data-lab-deg]');
  var count = sec.querySelector('[data-lab-count]');
  var pct   = sec.querySelector('[data-lab-pct]');
  var time  = sec.querySelector('.lab-time');
  var keys  = [].slice.call(sec.querySelectorAll('[data-lab-key]'));
  var tools = [].slice.call(sec.querySelectorAll('[data-lab-tool]'));
  var forms = [].slice.call(sec.querySelectorAll('[data-lab-form]'));
  var tiles = [].slice.call(sec.querySelectorAll('[data-lab-tile]'));
  var raw   = sec.getAttribute('data-lab-data');
  var data  = raw ? JSON.parse(raw) : [];
  if (!g || !data.length) return;

  /* The hash canvas is fixed at z-index 3 and this section paints its own ground
     at z-index 4, so the pin covers it — but a straight cover slices a glass
     object along a hard horizontal line as the panel wipes up over it. Fading it
     across the same wipe means it leaves rather than gets guillotined, and since
     both ends read from the section's own rect the scroll-up runs in reverse for
     free. Nothing else on the page writes this property; the pose stays with
     parallax.js and dial.js. */
  var hash  = document.getElementById('hashgl');
  var fall  = document.querySelector('.hash-fallback');
  var VEIL  = 0.45;           /* fraction of a viewport the fade takes */

  var STILL = matchMedia('(prefers-reduced-motion:reduce)');
  var TILT  = -0.42;          /* radians the whole scene leans back */
  /* EXACTLY ONE REVOLUTION. It was 1.35, which left the object parked at 486
     degrees — a quarter turn short of anywhere, and a readout ending on a
     number that means nothing. One turn ends where it started: the last frame
     of the section is the first frame of it, so the whole span reads as one
     complete rotation rather than as a rotation that ran out of scroll. */
  var TURNS = 1;

  /* ---- the forms -------------------------------------------------------

     Every form is sized to roughly the same OPTICAL weight rather than to the
     same number. They were not: the cube's half-edge of 52 put its corners at
     90 from the origin against a sphere of 58, so the object jumped a third
     larger the moment you stepped onto Discovery and shrank again at Design.
     Five shapes that are meant to be five views of one thing have to hold their
     size, or the step reads as a zoom. */

  function ring(n, y, r, out, edges) {
    var base = out.length;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      edges.push([base + i, base + (i + 1) % n]);
    }
    return base;
  }

  /* a great circle on one of the three planes — the sphere is three of these */
  function greatCircle(n, r, plane, v, e) {
    var base = v.length;
    for (var i = 0; i < n; i++) {
      var t = (i / n) * Math.PI * 2, c = Math.cos(t) * r, s = Math.sin(t) * r;
      v.push(plane === 0 ? [c, s, 0] : plane === 1 ? [c, 0, s] : [0, c, s]);
      e.push([base + i, base + (i + 1) % n]);
    }
  }

  function build(kind) {
    var v = [], e = [];
    if (kind === 'cube') {
      var s = 48;
      for (var i = 0; i < 8; i++)
        v.push([(i & 1 ? s : -s), (i & 2 ? s : -s), (i & 4 ? s : -s)]);
      e = [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]];
    } else if (kind === 'pyramid') {
      var b = ring(4, 40, 62, v, e);
      v.push([0, -72, 0]);
      for (var k = 0; k < 4; k++) e.push([b + k, v.length - 1]);
    } else if (kind === 'sphere') {
      /* three rings on the three planes reads as a sphere without the mesh of a
         real one, and stays legible as a wireframe at this size. 32 segments,
         not 28: at 28 the silhouette visibly faceted against the cube's dead
         straight edges sitting one step away. */
      greatCircle(32, 62, 0, v, e);
      greatCircle(32, 62, 1, v, e);
      greatCircle(32, 62, 2, v, e);
    } else if (kind === 'cylinder') {
      var top = ring(16, -50, 48, v, e);
      var bot = ring(16, 50, 48, v, e);
      /* every second point, so eight walls instead of four. With four, two of
         them sat on the silhouette and two ran down the middle of the face, and
         the shape read as a ribbon rather than as a tube. */
      for (var c = 0; c < 16; c += 2) e.push([top + c, bot + c]);
    } else {                                   /* points: a lattice, no edges */
      for (var x = -1; x <= 1; x++)
        for (var y = -1; y <= 1; y++)
          for (var z = -1; z <= 1; z++) v.push([x * 46, y * 46, z * 46]);
    }
    return { v: v, e: e };
  }

  var FORMS = data.map(function (s) { return build(s.form); });

  /* ---- projection ------------------------------------------------------- */

  /* A STANDING OFFSET, so no form is ever seen down an axis.

     The scroll angle starts at 0, and at 0 every one of these is degenerate:
     the cube's eight vertices collapse onto two x values and it draws as a flat
     rectangle with two bars across it, and the sphere's third great circle
     projects to a single vertical line through the middle. Both were visible on
     the first frame of the section — the object you land on was the one that
     did not look three-dimensional. 0.62rad is 35 degrees, the ordinary
     three-quarter view, and it costs nothing because the scene turns anyway. */
  var YAW0 = 0.62;

  function project(p, a) {
    var ca = Math.cos(a), sa = Math.sin(a);
    var x = p[0] * ca + p[2] * sa;             /* rotate about Y */
    var z = -p[0] * sa + p[2] * ca;
    var ct = Math.cos(TILT), st = Math.sin(TILT);
    var y = p[1] * ct - z * st;                /* lean back about X */
    var zz = p[1] * st + z * ct;
    return [x, y, zz];
  }

  /* ONE PATH PER DEPTH BAND, NOT ONE ELEMENT PER EDGE.

     Three rewrites of the same idea, and the numbers are why. It began by
     clearing the group and creating every child on every scroll frame. Then it
     kept the nodes and wrote only their coordinates — better, but the sphere is
     96 edges and each one still took x1, y1, x2, y2, opacity and stroke-width:
     MEASURED AT 552 setAttribute calls per frame, against 0 in the hero and 2
     in the dial. That is the heaviest per-frame work on the page, sitting in
     the section people scroll back out of, and every one of those writes dirties
     style for its element.

     The depth shading is what forced per-element attributes, so the shading is
     what changed: edges are bucketed into five depth bands and each band is ONE
     path, built by concatenating "M x y L x y" subpaths. Five d-attribute
     writes per frame instead of 552, with opacity and stroke-width set once per
     band and never touched again.

     Quantising depth to five steps is not a compromise here — a wireframe drawn
     in a fixed number of line weights is what a technical drawing IS, and the
     banding reads as deliberate where a continuous ramp read as noise. */
  var NS = 'http://www.w3.org/2000/svg';
  var BANDS = 5;
  var bands = [], dots = [], built = -1, buf = [];

  function makeNodes(idx) {
    var f = FORMS[idx];
    while (g.firstChild) g.removeChild(g.firstChild);
    bands = []; dots = [];

    if (!f.e.length) {                        /* a point cloud: 27 nodes, cheap */
      for (var j = 0; j < f.v.length; j++) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'lab-dot');
        g.appendChild(c); dots.push(c);
      }
    } else {
      /* far band first, so nearer lines paint over farther ones — painter's
         algorithm, which is the only hidden-surface handling a wireframe needs */
      for (var i = 0; i < BANDS; i++) {
        var t = (i + 0.5) / BANDS;
        var el = document.createElementNS(NS, 'path');
        el.setAttribute('class', 'lab-edge');
        el.setAttribute('vector-effect', 'non-scaling-stroke');
        el.setAttribute('opacity', (0.20 + t * 0.80).toFixed(3));
        el.setAttribute('stroke-width', (1.0 + t * 0.85).toFixed(2));
        g.appendChild(el); bands.push(el);
      }
    }
    built = idx;
  }

  function draw(idx, ang) {
    if (idx !== built) makeNodes(idx);
    var f = FORMS[idx];
    var pts = f.v.map(function (p) { return project(p, ang + YAW0); });

    /* Depth is normalised to what this form actually occupies, per frame.
       It was (z + 76) / 152 — a constant guessed from one shape, so a form
       whose z only ever reached 58 used two thirds of the available contrast
       and a rotation that changed the depth range did not change the shading
       at all. Measuring both ends means near is always fully near. */
    var lo = Infinity, hi = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i][2] < lo) lo = pts[i][2];
      if (pts[i][2] > hi) hi = pts[i][2];
    }
    var range = hi - lo || 1;

    if (!f.e.length) {                          /* a point cloud */
      for (i = 0; i < pts.length; i++) {
        var p = pts[i], td = (p[2] - lo) / range, c = dots[i];
        c.setAttribute('cx', p[0].toFixed(1));
        c.setAttribute('cy', p[1].toFixed(1));
        /* nearer points sit larger — the only depth cue a dot cloud has */
        c.setAttribute('r', (1.5 + td * 2.1).toFixed(2));
        c.setAttribute('opacity', (0.30 + td * 0.70).toFixed(2));
      }
      return;
    }

    for (i = 0; i < BANDS; i++) buf[i] = '';
    for (i = 0; i < f.e.length; i++) {
      var A = pts[f.e[i][0]], B = pts[f.e[i][1]];
      var t = ((A[2] + B[2]) / 2 - lo) / range;
      var b = (t * BANDS) | 0; if (b > BANDS - 1) b = BANDS - 1; else if (b < 0) b = 0;
      buf[b] += 'M' + A[0].toFixed(1) + ' ' + A[1].toFixed(1) +
                'L' + B[0].toFixed(1) + ' ' + B[1].toFixed(1);
    }
    for (i = 0; i < BANDS; i++) bands[i].setAttribute('d', buf[i]);
  }

  /* ---- drive ------------------------------------------------------------ */

  var pending = false, lastIdx = -1, lastP = -1, lastSeen = '', isNear = false;

  /* write-on-change, because these are the two properties this file touches
     most often and both are usually the same value they already were */
  function setSeen(v) {
    if (v === lastSeen) return;
    lastSeen = v;
    if (hash) hash.style.opacity = v;
    if (fall) fall.style.opacity = v;
  }

  function frame() {
    pending = false;
    var vh = window.innerHeight;
    var r = sec.getBoundingClientRect();

    /* NEAR, OR NOTHING.

       Everything below ran on every scroll frame of the entire page: about 380
       SVG attribute writes for the sphere, five class toggles, the readouts and
       the mark's opacity — while you were in the hero, while you were in the
       dial, all of it. Section two was paying for section three's wireframe on
       the same frames it was driving its own, and the seam between the two is
       exactly where that doubled cost showed up as a stutter.

       The window is the section's own box plus a viewport either side, which is
       wider than anything here reads: the fade needs one viewport above and the
       stepping only exists inside the box. */
    var near = r.bottom > -vh && r.top < vh * 2;
    if (near !== isNear) {
      isNear = near;
      /* the deliverables' ping is an infinite animation; off-screen it is the
         compositor doing arithmetic nobody can see */
      sec.classList.toggle('is-near', near);
    }
    if (!near) { setSeen('1'); return; }

    var span = r.height - vh;
    var p = span > 0 ? -r.top / span : 0;
    if (p < 0) p = 0; else if (p > 1) p = 1;

    /* covered: 0 outside the section, 1 while the pin owns the screen. `a` rises
       as the pin's top edge climbs into view, `b` cancels it as the bottom edge
       follows — subtracting the two gives one number with no state and no
       direction flag. */
    var a = (vh - r.top) / (vh * VEIL);
    var b = (vh - r.bottom) / (vh * VEIL);
    if (a < 0) a = 0; else if (a > 1) a = 1;
    if (b < 0) b = 0; else if (b > 1) b = 1;
    setSeen((1 - (a - b)).toFixed(3));

    /* the fade above runs while p is still pinned at 0, so it cannot be gated on
       p — but everything from here down can, and a frame where the progress has
       not moved has nothing new to draw */
    if (p === lastP) return;
    lastP = p;

    var n = data.length;
    var idx = Math.min(n - 1, Math.floor(p * n));
    var ang = STILL.matches ? 0.6 : p * Math.PI * 2 * TURNS;

    draw(idx, ang);

    /* No modulo. It was there because 1.35 turns overran 360 and the readout had
       to wrap; at one turn the angle never exceeds 360, and wrapping it would
       do the one thing this change was for — print 0 at the finish. */
    if (deg) deg.textContent = Math.round(ang * 180 / Math.PI) + '°';

    /* the timeline. One number on the container; the fill and the playhead are
       both positioned from it in CSS, so there is nothing to keep in step. */
    if (time) time.style.setProperty('--p', p.toFixed(4));
    if (pct) pct.textContent = Math.round(p * 100) + '%';
    for (var kx = 0; kx < keys.length; kx++) {
      /* a key fills once the playhead has actually crossed it, which is why the
         keys sit at stage MIDPOINTS: at i/(n-1) the last one would only fill on
         the final pixel of the section, and the first would be filled before
         the section had started. */
      keys[kx].classList.toggle('is-past', p >= (kx + 0.5) / keys.length);
      keys[kx].classList.toggle('is-on', kx === idx);
    }

    if (idx !== lastIdx) {
      lastIdx = idx;
      var s = data[idx];
      /* just the index — the "/ 05" is set in the markup beside it, so this
         writes a number rather than reformatting a whole label every step */
      if (count) count.textContent = s.n;
      tools.forEach(function (t, i) { t.classList.toggle('is-on', i === idx); });
      forms.forEach(function (t, i) { t.classList.toggle('is-on', i === idx); });
      tiles.forEach(function (t, i) {
        t.querySelector('.lab-tile-t').textContent = s.items[i] || '';
        /* retrigger the swap animation by replaying the class */
        t.classList.remove('is-in'); void t.offsetWidth; t.classList.add('is-in');
      });
    }
  }

  function queue() { if (!pending) { pending = true; requestAnimationFrame(frame); } }

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  frame();
})();
