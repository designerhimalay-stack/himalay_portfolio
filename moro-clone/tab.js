/* Animated tab: the hash spins, decelerates to a stop, rests, then goes again.
   The title alternates UI / UX on each spin.
   Drawn to a canvas and pushed into <link rel=icon> as a data URL. */
(function () {
  'use strict';

  var TITLES = ['himalay. — UI designer', 'himalay. — UX designer'];
  var SPIN = 1500,          // ms of rotation
      REST = 1700,          // ms held still between spins
      FPS  = 20,            // 16px icon; more frames buys nothing
      TURNS = 2;            // whole turns, so it always lands upright

  // reduced motion: leave the static icon and title alone
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  var ctx = cv.getContext('2d');
  if (!ctx) return;

  // take over from the static icons declared in <head>
  var old = document.querySelectorAll('link[rel="icon"]');
  var link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
  document.head.appendChild(link);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    ctx.fill();
  }

  // same geometry as assets/favicon.svg, scaled 32 -> 64
  function draw(deg) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#1E90FF';
    roundRect(0, 0, 64, 64, 15);            // tile stays put; only the hash turns
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(deg * Math.PI / 180);
    ctx.translate(-32, -32);
    ctx.fillStyle = '#fff';
    roundRect(20.4, 11.6,  6.8, 40.8, 3.4);
    roundRect(36.8, 11.6,  6.8, 40.8, 3.4);
    roundRect(11.6, 20.8, 40.8,  6.8, 3.4);
    roundRect(11.6, 36.4, 40.8,  6.8, 3.4);
    ctx.restore();
    link.href = cv.toDataURL('image/png');
  }

  var phase = 0;
  function cycle() {
    document.title = TITLES[phase % TITLES.length];
    phase++;
    var t0 = Date.now();
    var id = setInterval(function () {
      var t = Math.min((Date.now() - t0) / SPIN, 1);
      draw((1 - Math.pow(1 - t, 3)) * 360 * TURNS);   // ease out into a stop
      if (t >= 1) { clearInterval(id); setTimeout(cycle, REST); }
    }, 1000 / FPS);
  }

  draw(0);
  cycle();
})();
