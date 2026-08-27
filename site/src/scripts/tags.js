/* The tag pile: an overshooting spring in, then free drag.

   Cloned behaviour, measured off draggable-tags.framer.website rather than
   guessed — the probe table is in docs/research/components/draggable-tags.spec.md.
   Four things that are easy to get wrong and were checked one at a time:

     1:1        the drag has NO constraints and NO elastic. Moving the pointer
                +220/-130 moved the tag exactly +220/-130.
     no momentum  it stops dead where you let go. Position was identical at
                release, +120ms and +1.4s. A flick does not throw it.
     1.04       it scales while HELD and springs back on release — and it takes
                real movement, not just a mousedown.
     to front, permanently  the dragged tag's z-index goes to the top and STAYS
                there after release. That is what lets you deal the pile out one
                tag at a time instead of fighting a fixed stacking order.

   There is no hover state on the original. Shadow, scale and z are identical on
   and off, so there is none here either.

   The entrance is a real spring, not a scroll scrub. It fires once when the
   headline has left, and rewinds if you scroll back up so it can play again. A
   scrubbed entrance would fight the drag: the moment you grabbed a tag, scroll
   would be writing its transform on the same frames you were. */
(function () {
  'use strict';

  var host = document.querySelector('[data-tags]');
  var sec = document.querySelector('[data-changes]');
  if (!host || !sec) return;

  var tags = [].slice.call(host.querySelectorAll('[data-tag]'));
  if (!tags.length) return;

  var STILL = matchMedia('(prefers-reduced-motion:reduce)');
  /* Above this the section is pinned and the pile is act two of a scroll.
     Below it there is no pin at all (changes.js drops it, matching the original),
     so there is no scroll to gate on and the pile is simply present. */
  var PINNED = matchMedia('(min-width:1200px)');

  /* The fan is authored for the full-width layout. At 390px a ±96px spread plus
     a 230px tag runs off both edges, so the offsets shrink with the viewport.
     Only the REST offsets scale — the drag stays 1:1 at every width, because a
     drag that moved less than the pointer would feel broken, not smaller. */
  function spread() {
    return innerWidth >= 1200 ? 1 : innerWidth >= 810 ? 0.58 : 0.32;
  }

  /* stiffness 170 / damping 15.5 / mass 1 -> damping ratio .59, which is the
     ~10% overshoot the original lands (it travelled to -25 where rest was +17). */
  var K = 170, C = 15.5, STAGGER = 0.055;

  var top = tags.length;          /* highest z handed out so far */
  var shown = false;
  var raf = 0, last = 0;

  tags.forEach(function (el, i) {
    var d = el.dataset;
    el.__t = {
      /* rest pose, from the markup */
      rx: +d.dx, ry: +d.dy, rot: +d.rot,
      /* where it springs in FROM */
      fx: +d.fx, fy: +d.fy,
      /* live pose */
      x: +d.dx + +d.fx, y: +d.dy + +d.fy, r: 0, o: 0,
      vx: 0, vy: 0, vr: 0, vo: 0,
      delay: i * STAGGER,
      /* drag offset, accumulated across gestures and never reset */
      ox: 0, oy: 0,
      held: false, moved: false, sc: 1, vs: 0
    };
    paint(el);
  });

  function paint(el) {
    var t = el.__t;
    el.style.transform =
      'translate(-50%,-50%) translate3d(' + (t.x + t.ox).toFixed(2) + 'px,' +
      (t.y + t.oy).toFixed(2) + 'px,0) rotate(' + t.r.toFixed(2) + 'deg) scale(' +
      t.sc.toFixed(4) + ')';
    el.style.opacity = t.o.toFixed(3);
  }

  /* one integrator step toward a target */
  function step(cur, vel, target, dt) {
    var v = vel + (-K * (cur - target) - C * vel) * dt;
    return [cur + v * dt, v];
  }

  function frame(now) {
    raf = 0;
    if (!last) last = now;
    var dt = Math.min((now - last) / 1000, 0.032);   /* a backgrounded tab must not explode the spring */
    last = now;

    var busy = false;
    for (var i = 0; i < tags.length; i++) {
      var el = tags[i], t = el.__t;

      if (t.delay > 0 && shown) { t.delay -= dt; busy = true; continue; }

      var k = spread();
      var tx = shown ? t.rx * k : t.rx * k + t.fx;
      var ty = shown ? t.ry * k : t.ry * k + t.fy;
      var tr = shown ? t.rot : 0;
      var to = shown ? 1 : 0;
      var ts = t.held && t.moved ? 1.04 : 1;

      var a;
      a = step(t.x, t.vx, tx, dt); t.x = a[0]; t.vx = a[1];
      a = step(t.y, t.vy, ty, dt); t.y = a[0]; t.vy = a[1];
      a = step(t.r, t.vr, tr, dt); t.r = a[0]; t.vr = a[1];
      a = step(t.o, t.vo, to, dt); t.o = a[0]; t.vo = a[1];
      a = step(t.sc, t.vs, ts, dt); t.sc = a[0]; t.vs = a[1];

      var rest = Math.abs(t.x - tx) < .05 && Math.abs(t.vx) < .05 &&
                 Math.abs(t.y - ty) < .05 && Math.abs(t.vy) < .05 &&
                 Math.abs(t.r - tr) < .05 && Math.abs(t.vr) < .05 &&
                 Math.abs(t.o - to) < .003 && Math.abs(t.sc - ts) < .002;
      if (rest) { t.x = tx; t.y = ty; t.r = tr; t.o = to; t.sc = ts;
                  t.vx = t.vy = t.vr = t.vo = t.vs = 0; }
      else busy = true;

      paint(el);
    }
    if (busy) queue();
  }

  function queue() { if (!raf) raf = requestAnimationFrame(frame); }

  function wake() { last = 0; queue(); }

  /* ---- entrance gate ---------------------------------------------------- */

  /* The headline owns the pin's first viewport (changes.js). The pile arrives
     once that is done, so the two never share the frame. */
  function gate() {
    var vh = window.innerHeight;
    var p = -sec.getBoundingClientRect().top / vh;
    /* unpinned layouts have no act one to wait for */
    var want = PINNED.matches ? p > 1.02 : true;
    if (want !== shown) {
      shown = want;
      if (shown) tags.forEach(function (el, i) { el.__t.delay = i * STAGGER; });
      wake();
    }
  }

  /* ---- drag ------------------------------------------------------------- */

  function down(e) {
    if (e.button != null && e.button !== 0) return;
    var el = e.currentTarget, t = el.__t;
    t.held = true; t.moved = false;
    t.px = e.clientX; t.py = e.clientY;
    t.sx = t.ox; t.sy = t.oy;
    el.setPointerCapture(e.pointerId);
    /* NOT here: the cursor, the z-bump and the scale all wait for actual
       movement. On the original, a mousedown that never moves leaves cursor at
       'grab' and z unchanged — measured. It means a plain click does not
       reshuffle the pile, which is the right call and worth keeping. */
    wake();
  }

  function move(e) {
    var el = e.currentTarget, t = el.__t;
    if (!t.held) return;
    var dx = e.clientX - t.px, dy = e.clientY - t.py;
    if (!t.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    if (!t.moved) {
      t.moved = true;
      el.classList.add('is-held');
      /* to the front, and it stays there after release — measured, not assumed */
      el.style.zIndex = ++top;
    }
    /* 1:1. No constraint, no elastic — the original has neither. */
    t.ox = t.sx + dx;
    t.oy = t.sy + dy;
    paint(el);
    wake();
  }

  function up(e) {
    var el = e.currentTarget, t = el.__t;
    if (!t.held) return;
    t.held = false; t.moved = false;
    el.classList.remove('is-held');
    try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    /* no momentum: the offset is left exactly where the pointer left it */
    wake();
  }

  tags.forEach(function (el) {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
  });

  /* reduced motion: no spring, no entrance — the pile is simply there, and it
     still drags, because dragging is a control and not a decoration */
  if (STILL.matches) {
    shown = true;
    tags.forEach(function (el) {
      var t = el.__t, k = spread();
      t.x = t.rx * k; t.y = t.ry * k; t.r = t.rot; t.o = 1; t.delay = 0;
      paint(el);
    });
  } else {
    addEventListener('scroll', gate, { passive: true });
    addEventListener('resize', function () { gate(); wake(); });
    if (PINNED.addEventListener) PINNED.addEventListener('change', function () { gate(); wake(); });
    gate();
  }
})();
