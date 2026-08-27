/* Text on a path — every glyph placed by hand, revealed word by word on scroll.

   Ported from annnimate's Text On Path (see the component and
   docs/research/components/text-on-path.spec.md). Two ideas carry the whole
   effect, and both are the reason the naive version looks wrong:

   1. SVG's own <textPath> lets the browser space the run, and the moment the
      line bends the letters fan open over the crests and crush together in the
      dips. So each glyph is measured and placed individually, and its advance is
      divided by the curvature correction (1 - k * offset) — the arc length of the
      parallel curve the glyph actually rides, not of the line underneath it.

   2. The reveal is split across two clocks. Scroll decides WHEN a word is due;
      the bloom itself runs on its own 0.6s timer. Fly through the section and
      every word still gets its full fade instead of snapping in.

   The word gaps flex to fill the curve edge to edge; the letters never do. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* Radial offsets, in fractions of the font size, measured off the original.
     Odd denominators because they were authored against a 44px draft. */
  var OFFSET = { above: -12 / 44, center: 15 / 44, below: 48 / 44 };

  var MEDIA = {
    mobile: '(max-width: 479px)',
    landscape: '(orientation: landscape) and (max-width: 767px)',
    tablet: '(max-width: 991px)',
    desktop: '(min-width: 992px)'
  };

  var BLUR = 5;              /* px the unit blooms in from */
  var DUR = 0.6;             /* seconds, the unit's own clock */
  var DESIGN_W = 1600;       /* the space the curve is authored in */
  var DESIGN_H = 900;

  /* gsap's power3.out */
  function ease(x) { var i = 1 - x; return 1 - i * i * i * i; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function mount(root) {
    var d = root.dataset;
    var text = d.text || '';
    var pathD = d.path || '';
    if (!text || !pathD) return null;

    var position = d.textPosition || 'above';
    var split = d.split === 'chars' ? 'chars' : 'words';
    var scrub = parseFloat(d.scrubDistance) || 300;
    var rtl = d.direction === 'rtl';
    var size = parseFloat(d.fontSize) || 48;
    var tracking = d.letterSpacing || '0em';
    var spread = isNaN(parseFloat(d.curveSpread)) ? 1 : parseFloat(d.curveSpread);
    var disabled = (d.disable || '').split(',');

    var stage, svg, shift, path, group, ruler;
    var units = [], widths = {}, raf = 0, last = 0, near = true, still = false, flat = false;

    /* ---- build ---------------------------------------------------------- */

    function el(name, cls) {
      var n = document.createElementNS(NS, name);
      if (cls) n.setAttribute('class', cls);
      return n;
    }

    stage = document.createElement('div');
    stage.className = 'tpath-stage';
    svg = el('svg', 'tpath-svg');
    /* slice, not meet: the curve is meant to run off both edges rather than
       shrink into the viewport */
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', text);
    shift = el('g', 'tpath-shift');
    path = el('path', 'tpath-path');
    path.setAttribute('d', pathD);
    group = el('g', 'tpath-text');
    group.setAttribute('font-size', String(size));
    group.setAttribute('aria-hidden', 'true');   /* the svg's label is the accessible copy */
    ruler = el('text', 'tpath-measure');
    ruler.setAttribute('font-size', String(size));
    shift.appendChild(path); shift.appendChild(group); shift.appendChild(ruler);
    svg.appendChild(shift); stage.appendChild(svg);
    root.textContent = '';                        /* drops the no-JS paragraph */
    root.appendChild(stage);

    /* ---- measuring the curve -------------------------------------------- */

    function width(ch) {
      if (widths[ch] === undefined) {
        ruler.textContent = ch;
        widths[ch] = ruler.getComputedTextLength();
      }
      return widths[ch];
    }

    /* Where a glyph's INK sits relative to its baseline, at its middle — negative
       above it, in the same y-down sense as everything else here.

       Canvas, not getBBox. getBBox on an SVG <text> reports the LAYOUT box, built
       from the font's ascent and descent, so it returns the identical rectangle
       for 'x' and for '*' and the difference between them comes out as zero. It
       measured 58.5px tall for an asterisk at 48px, which is the em box, not the
       mark. measureText's actualBoundingBox* are true ink extents and are the
       only thing here that can tell the two glyphs apart. */
    var ink = null;
    function inkMid(ch) {
      if (!ink) ink = document.createElement('canvas').getContext('2d');
      var cs = getComputedStyle(ruler);
      ink.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var m = ink.measureText(ch);
      if (typeof m.actualBoundingBoxAscent !== 'number') return 0;   /* unsupported: leave it be */
      /* ascent runs up from the baseline, descent down, so the ink spans
         -ascent .. +descent and its middle is the average of the two */
      return (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
    }

    /* Every glyph is placed on its BASELINE. That is right for letters and wrong
       for an asterisk: the mark is cut high in the em, up at the superscript
       position, so on a shared baseline it floats above the line it is meant to
       punctuate instead of sitting in it.

       The drop is MEASURED, not nudged: the gap between where an 'x' carries its
       ink and where '*' carries its, which is correct for whatever face is
       actually loaded rather than a number tuned to one. Cached per layout and
       cleared on rebuild, so a webfont arriving late cannot strand it on a
       fallback's metrics. */
    var astDrop = null;
    function asteriskDrop() {
      if (astDrop === null) astDrop = inkMid('x') - inkMid('*');
      return astDrop;
    }

    function at(l, total) { return path.getPointAtLength(clamp(l, 0, total)); }

    function tangent(l, total) {
      var a = at(l - 1, total), b = at(l + 1, total);
      return Math.atan2(b.y - a.y, b.x - a.x);
    }

    /* turn per unit length, sampled over 16 units so a single control point
       does not spike it */
    function curvature(l, total) {
      var t = tangent(l + 8, total) - tangent(l - 8, total);
      if (t > Math.PI) t -= 2 * Math.PI;
      if (t < -Math.PI) t += 2 * Math.PI;
      return t / 16;
    }

    /* A glyph sitting `off` away from the line rides a parallel curve, whose
       arc length runs (1 - k*off) per unit of the line's. Dividing the advance
       by that is what keeps the spacing even through the bends. */
    function correction(l, total, off) {
      return clamp(1 - spread * off * curvature(l, total), 0.5, 2);
    }

    /* ---- layout ---------------------------------------------------------- */

    function fit() {
      var box = stage.getBoundingClientRect();
      var w = box.width || 1, h = box.height || 1;
      var vh = Math.round(h / w * DESIGN_W);
      svg.setAttribute('viewBox', '0 0 ' + DESIGN_W + ' ' + vh);
      shift.setAttribute('transform', 'translate(0 ' + Math.round((vh - DESIGN_H) / 2) + ')');
    }

    function layout() {
      while (group.firstChild) group.removeChild(group.firstChild);
      units = [];
      astDrop = null;                 /* re-measure: the face may have changed */

      var total = path.getTotalLength();
      var extra = tracking.indexOf('em') !== -1
        ? parseFloat(tracking) * size
        : parseFloat(tracking) || 0;

      /* the space advance the font actually renders, not an assumed em */
      ruler.textContent = 'n n';
      var spaceW = ruler.getComputedTextLength();
      ruler.textContent = 'nn';
      spaceW = spaceW - ruler.getComputedTextLength() + extra;

      var draw = (OFFSET[position] || OFFSET.above) * size;   /* where the glyph is painted */
      var comp = draw - 0.33 * size;                          /* where the spacing is corrected */

      var chars = text.split(''), adv = [], gaps = [], sum = 0, i;
      for (i = 0; i < chars.length; i++) {
        var w = chars[i] === ' ' ? spaceW : width(chars[i]) + extra;
        adv.push(w); sum += w;
        if (chars[i] === ' ') gaps.push(i);
      }

      /* the sentence is justified by stretching the word gaps only, and only so
         far — past 1.5 spaces it reads as a gap, under 0.4 as a collision */
      var gap = gaps.length
        ? clamp((total - sum) / gaps.length, -0.4 * spaceW, 1.5 * spaceW)
        : 0;
      var pos = Math.max(0, (total - (sum + gap * gaps.length)) / 2);

      var word = [], head = null;
      function flush() {
        if (word.length) { units.push({ els: word, t: head, p: 0, dir: 0, on: false }); }
        word = []; head = null;
      }

      for (i = 0; i < chars.length; i++) {
        var a = adv[i] + (chars[i] === ' ' ? gap : 0);
        if (chars[i] === ' ') {
          if (split === 'words') flush();
          pos += a / correction(pos + a / 2, total, comp);
          continue;
        }
        var step = a / correction(pos + a / 2, total, comp);
        var mid = pos + step / 2;
        var pt = at(mid, total);
        var ang = tangent(mid, total);
        var g = el('text', 'tpath-letter');
        /* the glyph is anchored at its own centre (text-anchor:middle) and
           pushed along the normal, then turned to sit on the tangent.
           off runs along that normal and grows DOWNWARD, so dropping the
           asterisk into the x-height band means adding to it. */
        var off = draw + (chars[i] === '*' ? asteriskDrop() : 0);
        g.setAttribute('transform',
          'translate(' + (pt.x + -Math.sin(ang) * off).toFixed(2) + ' ' +
          (pt.y + Math.cos(ang) * off).toFixed(2) + ') rotate(' +
          (ang * 180 / Math.PI).toFixed(2) + ')');
        g.textContent = chars[i];
        group.appendChild(g);

        var t = mid / total;
        if (split === 'words') { if (head === null) head = t; word.push(g); }
        else units.push({ els: [g], t: t, p: 0, dir: 0, on: false });
        pos += step;
      }
      flush();
    }

    /* ---- the reveal ------------------------------------------------------ */

    function paint(u) {
      var e = ease(u.p);
      var blur = u.p >= 1 ? '' : 'blur(' + ((1 - e) * BLUR).toFixed(2) + 'px)';
      for (var i = 0; i < u.els.length; i++) {
        var s = u.els[i].style;
        s.opacity = u.p <= 0 ? '0' : e.toFixed(3);
        s.visibility = u.p <= 0 ? 'hidden' : 'visible';
        s.filter = blur;
      }
    }

    function show(u) { u.p = 1; u.dir = 0; paint(u); }

    function offscreen() {
      var m = MEDIA;
      for (var i = 0; i < disabled.length; i++) {
        var k = disabled[i].trim();
        if (m[k] && matchMedia(m[k]).matches) return true;
      }
      return false;
    }

    function progress() {
      var r = root.getBoundingClientRect();
      var span = r.height - innerHeight;
      if (span <= 0) return r.top <= 0 ? 1 : 0;
      return clamp(-r.top / span, 0, 1);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!last) { last = now; return; }
      var dt = Math.min((now - last) / 1000, 0.05);   /* a backgrounded tab must not fast-forward */
      last = now;
      if (!near) return;

      var p = progress();
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        var due = clamp(rtl ? 1 - u.t : u.t, 0.001, 0.999);
        var on = p >= due;
        if (on !== u.on) { u.on = on; u.dir = on ? 1 : -1; }
        if (!u.dir) continue;
        u.p += (dt / DUR) * u.dir;
        if (u.p >= 1) { u.p = 1; u.dir = 0; }
        if (u.p <= 0) { u.p = 0; u.dir = 0; }
        paint(u);
      }
    }

    function drive() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      last = 0;

      /* reduced motion, or a viewport the reveal is switched off for: the
         sentence still rides the curve, it just arrives already read */
      flat = still || offscreen();
      if (flat) {
        root.style.height = '100svh';
        fit();
        units.forEach(show);
        return;
      }
      root.style.height = scrub + 'vh';
      fit();
      units.forEach(function (u) { u.p = 0; u.dir = 0; u.on = false; paint(u); });
      raf = requestAnimationFrame(frame);
    }

    /* ---- wiring ---------------------------------------------------------- */

    var rm = matchMedia('(prefers-reduced-motion: reduce)');
    still = rm.matches;

    layout();
    drive();

    /* the loop is only worth running while the track is anywhere near screen */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { near = e[0].isIntersecting; },
        { rootMargin: '200px' }).observe(root);
    }

    /* glyph advances are wrong until the webfont lands — drop the cache and
       lay the sentence out again */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        widths = {}; layout(); drive();
      });
    }

    var t;
    addEventListener('resize', function () {
      clearTimeout(t);
      /* the design space is resolution-independent, so only the viewBox has to
         follow the viewport — the letters keep their places. A resize across the
         disable breakpoint is the one case that needs the whole thing rebuilt. */
      t = setTimeout(function () {
        if (flat !== (still || offscreen())) drive();
        else fit();
      }, 150);
    }, { passive: true });

    (rm.addEventListener ? rm.addEventListener.bind(rm, 'change') : rm.addListener.bind(rm))(
      function (e) { still = e.matches; drive(); }
    );

    return { refresh: function () { widths = {}; layout(); drive(); } };
  }

  var all = [];
  document.querySelectorAll('[data-text-on-path]').forEach(function (root) {
    var api = mount(root);
    if (api) all.push(api);
  });
  window.TextOnPath = { refresh: function () { all.forEach(function (a) { a.refresh(); }); } };
})();
