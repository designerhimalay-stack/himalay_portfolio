/* The stickers get pressed onto the surface.

   Same gate as the tag pile (tags.js): the headline owns the pin's first
   viewport, and everything else arrives after it has gone. Same spring constants
   too, so the two sets of objects share a physics and read as one surface rather
   than two effects that happen to be adjacent.

   The move is deliberately NOT the tags' fly-in. The tags travel a long way and
   overshoot, because they are loose things being tossed onto a desk. A sticker
   is placed: it comes down from very slightly above (scale 1.12 -> 1) and rotates
   the last couple of degrees into its resting angle. Same spring, different
   distance — which is what makes one read as thrown and the other as stuck down.

   No drag here on purpose. The tags are the toy; these four are the content, and
   a visitor who knocks the evidence off the page has been given a worse page. */
(function () {
  'use strict';

  var host = document.querySelector('[data-brands]');
  var sec = document.querySelector('[data-changes]');
  if (!host || !sec) return;

  var items = [].slice.call(host.querySelectorAll('[data-brand]'));
  if (!items.length) return;

  var STILL = matchMedia('(prefers-reduced-motion:reduce)');
  var PINNED = matchMedia('(min-width:1200px)');

  var K = 170, C = 15.5, STAGGER = 0.075;

  /* the layout is authored full-width; below that the scatter has to close up */
  function spread() {
    return innerWidth >= 1200 ? 1 : innerWidth >= 810 ? 0.62 : 0.44;
  }

  var shown = false, raf = 0, last = 0;

  items.forEach(function (el, i) {
    var d = el.dataset;
    el.__b = {
      rx: +d.dx, ry: +d.dy, rot: +d.rot,
      x: +d.dx, y: +d.dy, r: 0, o: 0, s: 1.12,
      vx: 0, vy: 0, vr: 0, vo: 0, vs: 0,
      delay: i * STAGGER
    };
    paint(el);
  });

  function paint(el) {
    var b = el.__b;
    el.style.transform =
      'translate(-50%,-50%) translate3d(' + b.x.toFixed(2) + 'px,' + b.y.toFixed(2) +
      'px,0) rotate(' + b.r.toFixed(2) + 'deg) scale(' + b.s.toFixed(4) + ')';
    el.style.opacity = b.o.toFixed(3);
  }

  function step(cur, vel, target, dt) {
    var v = vel + (-K * (cur - target) - C * vel) * dt;
    return [cur + v * dt, v];
  }

  function frame(now) {
    raf = 0;
    if (!last) last = now;
    var dt = Math.min((now - last) / 1000, 0.032);
    last = now;

    var busy = false, k = spread();
    for (var i = 0; i < items.length; i++) {
      var el = items[i], b = el.__b;
      if (b.delay > 0 && shown) { b.delay -= dt; busy = true; continue; }

      var tx = b.rx * k, ty = b.ry * k;
      var tr = shown ? b.rot : 0;
      var to = shown ? 1 : 0;
      var ts = shown ? 1 : 1.12;

      var a;
      a = step(b.x, b.vx, tx, dt); b.x = a[0]; b.vx = a[1];
      a = step(b.y, b.vy, ty, dt); b.y = a[0]; b.vy = a[1];
      a = step(b.r, b.vr, tr, dt); b.r = a[0]; b.vr = a[1];
      a = step(b.o, b.vo, to, dt); b.o = a[0]; b.vo = a[1];
      a = step(b.s, b.vs, ts, dt); b.s = a[0]; b.vs = a[1];

      var rest = Math.abs(b.x - tx) < .05 && Math.abs(b.y - ty) < .05 &&
                 Math.abs(b.r - tr) < .05 && Math.abs(b.o - to) < .003 &&
                 Math.abs(b.s - ts) < .002 && Math.abs(b.vs) < .02;
      if (rest) { b.x = tx; b.y = ty; b.r = tr; b.o = to; b.s = ts;
                  b.vx = b.vy = b.vr = b.vo = b.vs = 0; }
      else busy = true;
      paint(el);
    }
    if (busy) queue();
  }

  function queue() { if (!raf) raf = requestAnimationFrame(frame); }
  function wake() { last = 0; queue(); }

  function gate() {
    var p = -sec.getBoundingClientRect().top / window.innerHeight;
    /* unpinned layouts have no act one to wait for */
    var want = PINNED.matches ? p > 1.02 : true;
    if (want !== shown) {
      shown = want;
      if (shown) items.forEach(function (el, i) { el.__b.delay = i * STAGGER; });
      wake();
    }
  }

  if (STILL.matches) {
    shown = true;
    items.forEach(function (el) {
      var b = el.__b, k = spread();
      b.x = b.rx * k; b.y = b.ry * k; b.r = b.rot; b.o = 1; b.s = 1; b.delay = 0;
      paint(el);
    });
  } else {
    addEventListener('scroll', gate, { passive: true });
    addEventListener('resize', function () { gate(); wake(); });
    if (PINNED.addEventListener) PINNED.addEventListener('change', function () { gate(); wake(); });
    gate();
  }
})();
