/* Drives <textPath> along its curve.

   startOffset is an SVG attribute, not a CSS property, so it cannot be
   transitioned — it has to be written per frame. The wrap is the whole trick:
   the phrase is repeated N times and the offset resets after exactly one
   repetition's advance, so the loop is seamless instead of snapping.

   Measured, not guessed: getComputedTextLength() gives the rendered advance of
   the whole run, which divided by N is one repetition — that survives any font,
   any size, any breakpoint. */
(function () {
  'use strict';

  var tp = document.querySelector('.arc-txt textPath');
  if (!tp) return;

  var REPEATS = 6;
  var SPEED = 26;            /* user units per second — slow enough to read */

  function unit() {
    var total = 0;
    try { total = tp.getComputedTextLength(); } catch (e) { total = 0; }
    return total ? total / REPEATS : 0;
  }

  var span = 0, off = 0, last = 0, running = true, raf = 0;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tp.setAttribute('startOffset', '0');
    return;
  }

  var sec = document.querySelector('.arc-sec');
  if (sec && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { running = e[0].isIntersecting; },
      { rootMargin: '200px' }).observe(sec);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!last) { last = now; return; }
    var dt = (now - last) / 1000; last = now;
    if (!running) return;
    if (!span) { span = unit(); if (!span) return; }

    off -= SPEED * dt;
    if (off <= -span) off += span;        /* wrap by one repetition, never reset to 0 */
    tp.setAttribute('startOffset', off.toFixed(2));
  }

  addEventListener('resize', function () { span = 0; }, { passive: true });
  /* the advance is wrong until the webfont lands */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { span = 0; });
  raf = requestAnimationFrame(frame);
})();
