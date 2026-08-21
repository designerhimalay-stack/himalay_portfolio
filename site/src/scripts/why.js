/* Section four — the pinned four-card wipe (see Why.astro, .why in global.css).

   Reverse-engineered from blink.trade by sampling their own transforms at eleven
   scroll positions; the readings and the algebra are in
   docs/research/components/pinned-wipe.spec.md. Two things came out of it:

   1. THE WHOLE MECHANIC IS ONE NUMBER. Let s be how many viewport-heights of the
      pinned range have been scrolled, clamped to [0, panels - 2]:

        rail   translateX = -s * 50%
        panel i translateY = (clamp(s - i, 0, 1) + clamp(i - 1 - s, 0, 1)) * 100%

      The two clamps are the panel's whole life. The first is its exit — it drops
      away over the step that starts at its own index. The second is its entry —
      it rises into place over the step one before that. Everywhere else both are
      zero (parked, on screen) or one (parked, below). No per-panel state, no
      step counter, no direction flag: scrub anywhere and the frame is correct,
      which is exactly why the reference can be dragged backwards at speed
      without a single seam.

   2. IT IS LINEAR. Their sampled values sit on the line to five decimal places —
      no easing on the transform at all. All the softness comes from Lenis
      smoothing the scroll position itself, which is why easing here would double
      up and feel rubbery.

   Panels are stacked z-descending (Why.astro sets it) so the one dropping away
   passes IN FRONT of the one rising behind it.

   The reveal below is the same one the reference uses and is deliberately not a
   tween — see the note on .why [data-split] in global.css. */
(function () {
  'use strict';

  var sec = document.querySelector('.why');
  if (!sec) return;

  var rail = sec.querySelector('.why-rail');
  var panels = [].slice.call(sec.querySelectorAll('.why-panel'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  /* the same breakpoint the stylesheet stacks at — below it there is no rail to
     drive, and writing transforms onto a static stack would only fight the CSS */
  var wide = matchMedia('(min-width: 1024px)');

  /* ---------------------------------------------------------------- mechanic */
  var pending = false;

  function draw() {
    pending = false;
    if (!wide.matches || reduce.matches) return;

    var vh = window.innerHeight;
    var top = sec.getBoundingClientRect().top;      /* track top, relative to viewport */
    var last = panels.length - 2;                   /* one step per gap between panels */

    var s = -top / vh;
    if (s < 0) s = 0; else if (s > last) s = last;

    rail.style.setProperty('--tx', (-s * 50).toFixed(4) + '%');
    for (var i = 0; i < panels.length; i++) {
      var out = s - i;            if (out < 0) out = 0; else if (out > 1) out = 1;
      var into = i - 1 - s;       if (into < 0) into = 0; else if (into > 1) into = 1;
      panels[i].style.setProperty('--ty', ((out + into) * 100).toFixed(4) + '%');
    }
  }

  function request() { if (!pending) { pending = true; requestAnimationFrame(draw); } }

  /* Lenis owns the scroll position on this site (smooth.js), so subscribe to it
     first; the native listener is the reduced-motion and no-Lenis fallback and
     is harmless when both fire — draw() is idempotent and rAF-coalesced. */
  if (window.lenis && window.lenis.on) window.lenis.on('scroll', request);
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', function () {
    /* coming back from the stacked layout, the inline transforms would otherwise
       persist as stale offsets on a stack that no longer translates */
    if (!wide.matches || reduce.matches) {
      rail.style.removeProperty('--tx');
      panels.forEach(function (p) { p.style.removeProperty('--ty'); });
    }
    request();
  }, { passive: true });
  draw();

  /* ------------------------------------------------------------------ reveal */

  /* Split into fragments the reference's three ways: whole words for the
     headings, single characters for the figures, laid-out lines for the body.
     Lines are the only one that needs measuring — a "line" is whatever the
     browser decided, so wrap every word, read the tops, and regroup. */
  function splitWords(el) {
    var out = [];
    el.textContent.split(/(\s+)/).forEach(function (tok) {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { out.push(document.createTextNode(tok)); return; }
      var s = document.createElement('span');
      s.className = 'w'; s.textContent = tok;
      out.push(s);
    });
    return out;
  }

  function splitChars(el) {
    return el.textContent.split('').map(function (ch) {
      var s = document.createElement('span');
      s.className = 'c'; s.textContent = ch;
      return s;
    });
  }

  function splitLines(el) {
    var words = splitWords(el);
    el.textContent = '';
    words.forEach(function (n) { el.appendChild(n); });

    /* group by rendered top — the browser has already broken the paragraph, we
       are only reading back where it put the breaks */
    var rows = [], last = null;
    [].slice.call(el.querySelectorAll('.w')).forEach(function (w) {
      var t = Math.round(w.offsetTop);
      if (last === null || Math.abs(t - last) > 2) { rows.push([]); last = t; }
      rows[rows.length - 1].push(w);
    });

    el.textContent = '';
    return rows.map(function (row) {
      var line = document.createElement('span');
      line.className = 'l';
      /* a trailing space keeps the copy's word spacing honest when a line is
         later read aloud or copied out of the page */
      line.textContent = row.map(function (w) { return w.textContent; }).join(' ') + ' ';
      el.appendChild(line);
      return line;
    });
  }

  function prepare(el) {
    var mode = el.getAttribute('data-split');
    /* the whole string stays available to assistive tech; the fragments are
       decoration and are hidden from it, or a heading reads out word by word */
    var label = el.textContent.trim();
    el.setAttribute('role', 'text');
    el.setAttribute('aria-label', label);

    var parts;
    if (mode === 'line') parts = splitLines(el);
    else if (mode === 'char') parts = splitChars(el);
    else parts = splitWords(el);

    if (mode !== 'line') {
      el.textContent = '';
      parts.forEach(function (n) { el.appendChild(n); });
    }
    parts = parts.filter(function (n) { return n.nodeType === 1; });
    parts.forEach(function (n) { n.setAttribute('aria-hidden', 'true'); });
    return parts;
  }

  var splits = [].slice.call(sec.querySelectorAll('[data-split]'));

  if (reduce.matches) {
    /* the copy still has to arrive; it just arrives already there */
    sec.classList.add('why-split-off');
    return;
  }

  var groups = splits.map(function (el) {
    return { el: el, base: +(el.getAttribute('data-delay') || 0), parts: prepare(el), fired: false };
  });

  /* Each card reveals on its own as it comes into view — the two on screen when
     the section pins go together, the pair behind them wait their turn. Watching
     the card and not the fragments is what keeps a panel's copy in one cadence
     instead of each line racing its neighbour across the boundary. */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      groups.filter(function (g) { return e.target.contains(g.el); }).forEach(run);
      var cvs = e.target.querySelector('canvas');
      if (cvs) cvs.classList.add('on');
    });
  }, { threshold: 0.1 });

  function run(g) {
    if (g.fired) return;
    g.fired = true;
    g.parts.forEach(function (n, i) {
      /* 100ms apart, no transition: it snaps. See global.css. */
      setTimeout(function () { n.classList.add('in'); }, g.base + i * 100);
    });
  }

  /* the eyebrow belongs to the section, not to any one card */
  var head = sec.querySelector('.why-head');
  if (head) io.observe(head);
  panels.forEach(function (p) { io.observe(p); });
})();
