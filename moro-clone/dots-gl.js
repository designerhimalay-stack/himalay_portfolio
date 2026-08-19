/* nav dot-field — the pixel wave that wakes on hover.
   modelled on the framework grid at clerk.com: 1px dots on a 3px pitch, a
   per-cell random opacity that re-rolls every 5s, and an intro whose per-cell
   start time is (distance from centre × speed) + jitter, so the field lights
   outward as a wave with a 25% brightness crest riding the front.
   one shared context, reparented into whichever link is hovered — four
   canvases would be four GL contexts for an effect only ever visible on one. */
(function () {
  'use strict';

  var links = document.querySelectorAll('.navlink');
  if (!links.length) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  /* one hue per link. the reference gives each tile its framework's brand
     colour; ours has no brand to borrow, so: accent first, then three hues
     far enough apart to read as deliberate rather than random. */
  var COLORS = [
    [30, 247, 255],   /* Work.       — the site accent, cyan */
    [182, 255, 61],   /* Playground. — acid lime */
    [192, 139, 255],  /* About.      — violet */
    [255, 194, 75]    /* Resume.     — amber */
  ];

  var TOTAL = 3;      /* grid pitch, css px — the reference runs 3 */
  var DOT = 1;        /* lit square inside each cell, css px */
  var OPACITIES = [.3, .3, .3, .5, .5, .5, .8, .8, .8, 1];
  var FPS = 30;       /* the reference caps here too; the twinkle needs no more */
  var FADE = 220;     /* keep in step with the .dots transition in styles.css */

  var VS = [
    '#version 300 es',
    'precision mediump float;',
    'in vec2 coordinates;',
    'uniform vec2 u_resolution;',
    'out vec2 fragCoord;',
    'void main(){',
    '  gl_Position = vec4(coordinates, 0.0, 1.0);',
    '  fragCoord = (coordinates + 1.0) * 0.5 * u_resolution;',
    '  fragCoord.y = u_resolution.y - fragCoord.y;',
    '}'
  ].join('\n');

  var FS = [
    '#version 300 es',
    'precision mediump float;',
    'in vec2 fragCoord;',
    'uniform float u_time;',
    'uniform float u_opacities[10];',
    'uniform vec3 u_colors[6];',
    'uniform float u_total_size;',
    'uniform float u_dot_size;',
    'uniform vec2 u_resolution;',
    'out vec4 fragColor;',

    'float PHI = 1.61803398874989484820459;',
    'float random(vec2 xy){ return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x); }',

    'void main(){',
    '  vec2 st = fragCoord.xy;',
    // centre the grid in the pill so the dot rows never clip half a dot at an edge
    '  st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));',
    '  st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));',

    '  float opacity = step(0.0, st.x) * step(0.0, st.y);',
    '  vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));',

    // per-cell brightness, re-rolled every 5s and staggered by the cell's own offset
    '  float frequency = 5.0;',
    '  float show_offset = random(st2);',
    '  float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency) + 1.0);',
    '  opacity *= u_opacities[int(rand * 10.0)];',
    // carve the 1px dot out of the 3px cell
    '  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));',
    '  opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));',

    '  vec3 color = u_colors[int(show_offset * 6.0)];',

    // the wave. the reference travels 0.01s per cell across a ~1400px tile; our
    // pill is ~17 cells from centre to corner, so at that rate it would be over
    // in 170ms. 0.022 lands the front on the far edge at ~0.38s — in step with
    // the pill's own .42s swing — and the jitter keeps the edge from reading
    // as a clean ring.
    '  float intro = distance(u_resolution / 2.0 / u_total_size, st2) * 0.022 + random(st2) * 0.15;',
    '  opacity *= step(intro, u_time);',
    '  opacity *= clamp((1.0 - step(intro + 0.1, u_time)) * 1.25, 1.0, 1.25);',

    '  fragColor = vec4(color, opacity);',
    '  fragColor.rgb *= fragColor.a;',
    '}'
  ].join('\n');

  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');

  var gl = cv.getContext('webgl2', { alpha: true, antialias: false });
  if (!gl) return;                     /* no webgl2 → the pill hover stands alone */

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }

  var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'coordinates');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'u_resolution');
  var uTime = gl.getUniformLocation(prog, 'u_time');
  var uColors = gl.getUniformLocation(prog, 'u_colors');
  gl.uniform1fv(gl.getUniformLocation(prog, 'u_opacities'), OPACITIES);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_total_size'), TOTAL);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_dot_size'), DOT);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);  /* additive — the crest is allowed to bloom */
  gl.disable(gl.DEPTH_TEST);

  var dpr = Math.round(Math.max(1, Math.min(window.devicePixelRatio || 1, 2)));
  var host = null, raf = 0, t0 = 0, last = -1e9, offTimer = 0;

  function fit(h) {
    var w = h.clientWidth, ht = h.clientHeight;
    if (!w || !ht) return;
    if (cv.width !== w * dpr || cv.height !== ht * dpr) {
      cv.width = w * dpr;
      cv.height = ht * dpr;
    }
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(uRes, w, ht);         /* the shader thinks in css px, like the grid */
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS) return;
    last = now;
    if (!t0) t0 = now;
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function enter(link, i) {
    var h = link.querySelector('.dots');
    if (!h) return;
    clearTimeout(offTimer);
    if (host !== h) { h.appendChild(cv); host = h; }
    fit(h);

    var c = COLORS[i % COLORS.length], six = [], k;
    for (k = 0; k < 6; k++) six.push(c[0] / 255, c[1] / 255, c[2] / 255);
    gl.uniform3fv(uColors, six);

    t0 = 0; last = -1e9;                /* the wave replays from zero every hover */
    h.classList.add('on');
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function leave(link) {
    var h = link.querySelector('.dots');
    if (h) h.classList.remove('on');
    clearTimeout(offTimer);
    /* keep drawing through the fade, then stop — an idle nav costs no frames */
    offTimer = setTimeout(function () {
      cancelAnimationFrame(raf);
      raf = 0;
    }, FADE + 60);
  }

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* the arms answer to :focus-visible, so the dots must too — a plain mouse
     click focuses the link without matching it, and dots with no pill under
     them would land straight on the light bar. */
  function keyboardFocus(el) {
    try { return el.matches(':focus-visible'); } catch (e) { return true; }
  }

  Array.prototype.forEach.call(links, function (link, i) {
    link.addEventListener('pointerenter', function () { if (fine.matches) enter(link, i); });
    link.addEventListener('pointerleave', function () { leave(link); });
    link.addEventListener('focus', function () { if (keyboardFocus(link)) enter(link, i); });
    link.addEventListener('blur', function () { leave(link); });
  });

  window.addEventListener('resize', function () { if (host && raf) fit(host); }, { passive: true });
})();
