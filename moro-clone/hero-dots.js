/* headline colour wave — hover a letter, that letter's halftone lights up.
   same idea as the framework grid at clerk.com: nothing at rest, then on hover
   the dot field floods outward from the centre with a denser crest riding the
   front. theirs is a webgl field masked to a tile; ours has to stay inside the
   glyphs, so the field IS the headline's own halftone — an exact copy of the
   h1 laid over it, painted in the letter's colour and revealed through an
   expanding radial mask that is clipped to one letter's column.

   the copy is a clone rather than a re-typeset, so kerning, the tight display
   tracking and the ampersand's own spacing all land where they already do, and
   the two dot grids share an origin — no doubling where they overlap. */
(function () {
  'use strict';

  var h1 = document.querySelector('.hero .d1');
  if (!h1) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  /* one hue per letter, cycled. the reference lights bright colours on near
     black; ours land on #F6F6F9, so these are saturated mid-tones — a neon
     that reads on their background would disappear on ours. */
  var HUES = ['#1E90FF', '#7A3CF0', '#E0208C', '#F0521E', '#C98A00', '#00A387'];

  /* the clip that isolates a letter can only be horizontal: line-height is .9,
     so line one's descenders and line two's ascenders overlap and there is no
     vertical band that holds one line and not the other. instead only the
     hovered letter's line is painted in the overlay at all — the other is
     hidden, which keeps the layout (and so the dot grid) exactly as it was. */
  var SLACK = 260;  /* px of vertical room for ink that overflows the line box */

  /* the reference's front travels at a fixed rate — one 3px cell per 0.01s, so
     300px/s — which is why a wide tile takes longer to fill than a narrow one.
     duration is therefore derived from the letter, never fixed: an easing curve
     here would make every letter finish at the same moment and the whole thing
     would read as a fade rather than a wave. */
  var SPEED = 0.30;   /* px per ms */

  var html = h1.innerHTML;
  function layer(cls) {
    var el = document.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    h1.appendChild(el);
    return el;
  }
  var hot = layer('d1hot');          /* the colour flood */
  var crest = layer('d1hot crest');  /* the denser ring that leads it */
  var rows = [hot, crest].map(function (el) { return el.querySelectorAll('.ln'); });

  var chars = [];

  function measure() {
    chars = [];
    var box = h1.getBoundingClientRect();
    /* originals only — the clones carry .ln too */
    var lines = h1.querySelectorAll(':scope > .ln');
    Array.prototype.forEach.call(lines, function (ln, row) {
      var walk = document.createTreeWalker(ln, NodeFilter.SHOW_TEXT);
      var rg = document.createRange(), node;
      while ((node = walk.nextNode())) {
        for (var i = 0; i < node.data.length; i++) {
          if (!/\S/.test(node.data[i])) continue;      /* spaces have no glyph to light */
          rg.setStart(node, i);
          rg.setEnd(node, i + 1);
          var b = rg.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          chars.push({ row: row, x: b.left - box.left, y: b.top - box.top,
                       w: b.width, h: b.height });
        }
      }
    });
  }

  function hit(px, py) {
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      if (px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h) return i;
    }
    return -1;
  }

  /* restart the wave: kill the transition, snap to zero, then let it run out */
  function wave(r) {
    h1.classList.add('nowave');
    h1.style.setProperty('--r', '0px');
    void h1.offsetWidth;
    h1.classList.remove('nowave');
    h1.style.transitionDuration = Math.round(r / SPEED) + 'ms';
    h1.style.setProperty('--r', r + 'px');
  }

  function light(c, hue) {
    var W = h1.clientWidth;
    var clip = 'inset(' + (-SLACK) + 'px ' + (W - (c.x + c.w)) + 'px ' +
               (-SLACK) + 'px ' + c.x + 'px)';
    var cx = c.x + c.w / 2, cy = c.y + c.h / 2;

    [hot, crest].forEach(function (el, k) {
      el.style.clipPath = clip;
      el.style.setProperty('--hot', hue);
      el.style.setProperty('--cx', cx + 'px');
      el.style.setProperty('--cy', cy + 'px');
      Array.prototype.forEach.call(rows[k], function (ln, r) {
        ln.style.visibility = r === c.row ? '' : 'hidden';
      });
      el.classList.add('on');
    });
    /* far enough to clear the tallest ink in the column, not the whole line box */
    wave(Math.round(Math.sqrt(Math.pow(c.w / 2, 2) + Math.pow(c.h * 0.7, 2))) + 8);
  }

  function off() {
    hot.classList.remove('on');
    crest.classList.remove('on');
  }

  var cur = -1;
  h1.addEventListener('pointermove', function (e) {
    var box = h1.getBoundingClientRect();
    var i = hit(e.clientX - box.left, e.clientY - box.top);
    if (i === cur) return;
    cur = i;
    if (i < 0) { off(); return; }
    light(chars[i], HUES[i % HUES.length]);
  });
  h1.addEventListener('pointerleave', function () { cur = -1; off(); });

  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  /* the arrival holds each line translated behind its mask, so anything measured
     before it settles is measured against the closed position */
  window.addEventListener('hero:settled', measure);
  var t = 0;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { cur = -1; off(); measure(); }, 150);
  }, { passive: true });
})();
