/* Animated tab: the hash spins, decelerates to a stop, rests, then goes again.
   The title alternates UI / UX on each spin.
   Drawn to a canvas and pushed into <link rel=icon> as a data URL. */
(function () {
  'use strict';

  var WORDS = ['Design', 'Research', 'Typography', 'Colour', 'Motion', 'Figma',
               'Prototyping', 'Wireframes', 'Systems', 'Animation', 'Interfaces',
               'Accessibility', 'AI', 'Claude', 'Craft', 'Layout'];
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#@%&*';
  var SWAP = 620;       // ms for a full handoff
  var OUT_AT = 0.42;    // fraction spent sweeping the old word out
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

  // same geometry as assets/favicon.svg, scaled 32 -> 64.
  // spins about the Y axis: horizontal scale by cos(angle) turns the tile
  // edge-on and back, which is what reads as a 3D flip on a flat canvas.
  function draw(deg) {
    ctx.clearRect(0, 0, 64, 64);
    var k = Math.cos(deg * Math.PI / 180);
    var w = Math.max(Math.abs(k), 0.04);    // never scale to 0 - the path degenerates
    ctx.save();
    ctx.translate(32, 32);
    ctx.scale(w, 1);
    ctx.translate(-32, -32);
    ctx.fillStyle = '#ffffff';              // whole tile flips, like a card
    roundRect(0, 0, 64, 64, 15);
    ctx.fillStyle = '#1E90FF';
    roundRect(20.4, 11.6,  6.8, 40.8, 3.4);
    roundRect(36.8, 11.6,  6.8, 40.8, 3.4);
    roundRect(11.6, 20.8, 40.8,  6.8, 3.4);
    roundRect(11.6, 36.4, 40.8,  6.8, 3.4);
    ctx.restore();
    link.href = cv.toDataURL('image/png');
  }

  // shuffled deck: every word shows once before any repeats
  var deck = [], deckPos = 0;
  function nextWord() {
    if (deckPos >= deck.length) {
      deck = WORDS.slice();
      for (var i = deck.length - 1; i > 0; i--) {   // fisher-yates
        var r = Math.floor(Math.random() * (i + 1));
        var t = deck[i]; deck[i] = deck[r]; deck[r] = t;
      }
      deckPos = 0;
    }
    return deck[deckPos++];
  }

  // mirrors the nav hover, which is a handoff: the old label leaves, then the
  // new one arrives. a title is plain text - no CSS reaches it - so the
  // equivalent is sweeping the old word out character by character, then
  // landing the new one the same way.
  var current = '';
  function rnd() { return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length)); }

  function swapTo(word) {
    var from = current;
    current = word;
    var t0 = Date.now();
    var id = setInterval(function () {
      var t = Math.min((Date.now() - t0) / SWAP, 1);
      var out = '', i;
      if (t < OUT_AT && from) {
        var p = t / OUT_AT;                       // old word sweeps out
        for (i = 0; i < from.length; i++)
          out += (i / from.length) < p ? rnd() : from.charAt(i);
      } else {
        var q = (t - OUT_AT) / (1 - OUT_AT);      // new word lands
        for (i = 0; i < word.length; i++)
          out += (i / word.length) < q ? word.charAt(i) : rnd();
      }
      document.title = out;
      if (t >= 1) { clearInterval(id); document.title = word; }
    }, 45);
  }

  function cycle() {
    swapTo(nextWord());
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
