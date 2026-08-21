/* The glyph set — @ $ % & * in the hero hash's glass.

   One canvas, one context, one draw for the whole row. Five separate raymarchers
   would be five WebGL contexts and five full-screen passes; instead the shader
   splits screen space into cells and each pixel marches only its own cell's glyph.
   Cost is roughly a single pass no matter how many glyphs are in the row.

   The material is the hero's, verbatim — same environment, same two-interface
   refraction, same dispersion, same speculars. Only the tint changes, and the
   absorption is derived from the tint rather than tuned per colour, so a new hue
   is one number and behaves like the same glass in a different batch.

   The forms are built in the hash's construction language, not traced from a
   font: an extruded plate, rounded stroke ends, filleted joins, bevelled depth
   edges, all in the same units (glyph height = 1.0 = 146mm). */
import { bakeField } from './sdf-field.js';

(function () {
  'use strict';
  var nodes = document.querySelectorAll('canvas[data-glyph]');
  if (!nodes.length) return;

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  var FS = [
'precision highp float;',
'uniform vec2 R;uniform float T;uniform vec2 M;uniform float FIT;',
'uniform vec3 C0;uniform float G;',   // this canvas's tint (linear) and glyph
'uniform sampler2D AMP;uniform float AMPBOX;uniform float AMPW;',

'const float S=1.0/146.0;',
'const float HD=10.0*S;',                        // half depth, 20mm plate
'const float BEV=5.0*S;',                        // the R5 depth bevel
'const float IOR=1.52;',
'const float W=9.0*S;',                          // stroke half-width
'const float RT=7.0*S;',                         // rounding at stroke ends

// ---- 2D primitives, same vocabulary the hash is built from ----
'float sdRB2(vec2 p, vec2 b, float r){vec2 q=abs(p)-b+r;',
'  return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}',
'float smin(float a,float b,float k){',
'  float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}',
'float ring(vec2 p,float ra,float th){return abs(length(p)-ra)-th;}',
// iq's arc: sc is (sin,cos) of the half-aperture; mirrored about x, so rotate first
'float arc(vec2 p, vec2 sc, float ra, float th){p.x=abs(p.x);',
'  return ((sc.y*p.x>sc.x*p.y)?length(p-sc*ra):abs(length(p)-ra))-th;}',
'vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*p;}',

// ---- the five profiles ----
// * — three bars through the centre. six spokes, because five reads as a snowflake
// # — the site's own mark, at the exact dimensions hash-gl.js raymarches it:
//     120x146mm plate, 20mm bars, R9 tips, R7 fillets where the bars cross.
'float gHash(vec2 p){',
'  float d=sdRB2(p-vec2( 25.0*S,0.0),vec2(10.0*S,73.0*S),9.0*S);',
'  d=smin(d,sdRB2(p-vec2(-25.0*S,0.0),vec2(10.0*S,73.0*S),9.0*S),7.0*S);',
'  d=smin(d,sdRB2(p-vec2(0.0, 25.0*S),vec2(60.0*S,10.0*S),9.0*S),7.0*S);',
'  d=smin(d,sdRB2(p-vec2(0.0,-25.0*S),vec2(60.0*S,10.0*S),9.0*S),7.0*S);',
'  return d;}',
'float gStar(vec2 p){',
'  float d=sdRB2(p,vec2(W,0.44),RT);',
'  d=smin(d,sdRB2(rot(p,1.0472),vec2(W,0.44),RT),0.03);',
'  d=smin(d,sdRB2(rot(p,2.0944),vec2(W,0.44),RT),0.03);',
'  return d;}',
// % — two counters and the solidus. the bar carries the same tip radius as the hash
'float gPct(vec2 p){',
'  float d=ring(p-vec2(-0.21,0.28),0.155,W*0.92);',
'  d=min(d,ring(p-vec2(0.21,-0.28),0.155,W*0.92));',
'  d=min(d,sdRB2(rot(p,-0.955),vec2(W,0.50),RT));',
'  return d;}',
// $ — spine plus an S of two arcs opened on opposite diagonals.
// arc()'s gap sits at -y, so to put a gap at bearing t (ccw from +x) the shape
// turns by t-270, and turning the shape by f means sampling rot(p,-f).
// upper bowl opens to the lower right (315), lower bowl to the upper left (135).
'float gDollar(vec2 p){',
'  float d=sdRB2(p,vec2(W*0.72,0.50),RT);',
'  vec2 sc=vec2(0.819,-0.574);',                    // 125 deg half-aperture
'  d=smin(d,arc(rot(p-vec2(0.0,0.19),-0.785),sc,0.19,W*0.92),0.02);',
'  d=smin(d,arc(rot(p-vec2(0.0,-0.19),2.356),sc,0.19,W*0.92),0.02);',
'  return d;}',
// & — the only mark here that is NOT constructed. Rings, arcs and bars build
//     @ $ % and * exactly, but an ampersand is one calligraphic stroke that
//     crosses itself and has no honest decomposition — three attempts at one
//     proved that. So its profile is a true distance field baked from the
//     typeface's own outline (see ampField below) and read back here.
//     AMPW dilates it: offsetting a distance field thickens the stroke AND
//     rounds its terminals in one operation, which is precisely what is needed
//     to bring a font's flat-ended & up to the built marks' weight and ends.
'float gAmp(vec2 p){',
'  vec2 uv=p/AMPBOX+0.5;',
'  vec2 q=abs(p)-vec2(AMPBOX*0.5);',                 // distance to the field's own box
'  float dBox=length(max(q,0.0))+min(max(q.x,q.y),0.0);',
'  vec4 t=texture2D(AMP,clamp(uv,0.0,1.0));',
'  float dTex=((t.r*255.0+t.g)/255.0-0.5)*2.0*AMPBOX-AMPW;',
// outside the box the sampled value is the clamped edge, which underestimates —
// never overestimates — the true distance, so sphere tracing stays safe
'  return max(dTex,dBox);}',

'float prof(vec2 p,float g){',
'  if(g<0.5) return gHash(p);',
'  if(g<1.5) return gDollar(p);',
'  if(g<2.5) return gPct(p);',
'  if(g<3.5) return gAmp(p);',
'  return gStar(p);}',

'float map(vec3 p,float g){',
'  float d=prof(p.xy,g)+BEV;',
'  vec2 w=vec2(d, abs(p.z)-(HD-BEV));',
'  return min(max(w.x,w.y),0.0)+length(max(w,0.0))-BEV;}',

'vec3 nrm(vec3 p,float g){vec2 e=vec2(0.0018,0.);return normalize(vec3(',
'  map(p+e.xyy,g)-map(p-e.xyy,g),map(p+e.yxy,g)-map(p-e.yxy,g),map(p+e.yyx,g)-map(p-e.yyx,g)));}',
'float march(vec3 ro,vec3 rd,float g){float t=0.0;for(int i=0;i<64;i++){',
'  float d=map(ro+rd*t,g);if(d<0.0009)return t;t+=d;if(t>6.0)break;}return -1.0;}',
'float marchIn(vec3 ro,vec3 rd,float g){float t=0.004;for(int i=0;i<48;i++){',
'  float d=-map(ro+rd*t,g);if(d<0.0009)return t;t+=max(d,0.002);if(t>2.0)break;}return t;}',

'vec3 env(vec3 d){',
'  float y=clamp(d.y*0.5+0.5,0.,1.);',
'  vec3 c=mix(vec3(0.42,0.46,0.56),vec3(1.02,1.05,1.12),smoothstep(0.30,0.95,y));',
'  float key=smoothstep(0.62,0.995,dot(normalize(d),normalize(vec3(-0.34,0.86,0.38))));',
'  c+=vec3(1.0,0.99,0.97)*pow(key,2.0)*5.2;',
'  float kick=smoothstep(0.80,1.0,dot(normalize(d),normalize(vec3(0.78,0.12,-0.60))));',
'  c+=vec3(0.55,0.86,1.0)*pow(kick,2.0)*2.4;',
'  float fill=smoothstep(0.70,1.0,dot(normalize(d),normalize(vec3(0.30,-0.55,0.75))));',
'  c+=vec3(0.60,0.75,0.95)*fill*0.7;',
'  return c;}',

'mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);}',
'mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,-s,0,s,c);}',


'void main(){',
// one glyph per canvas, centred. The cell-partitioned version drew a row into a
// single canvas; the cards need five separate wells at two aspect ratios, which
// a shared canvas cannot span.
'  vec2 uv=(gl_FragCoord.xy-0.5*R)/R.y;',
'  float gi=G;',
'  vec3 ro=vec3(0.,0.,4.2), rd=normalize(vec3(uv,-FIT));',
// each glyph turns on its own phase so the row never pulses in unison
'  float ph=gi*1.7;',   // each mark turns on its own phase
'  float yaw=0.30+M.x*0.55+sin(T*0.20+ph)*0.13;',
'  float pit=-0.03-M.y*0.26+sin(T*0.155+ph)*0.05;',
'  mat3 inv=rotX(-pit)*rotY(-yaw);',
'  vec3 rol=inv*ro, rdl=inv*rd;',
'  float t=march(rol,rdl,gi);',
'  if(t<0.0){gl_FragColor=vec4(0.);return;}',
'  vec3 pos=rol+rdl*t, Nn=nrm(pos,gi), V=-rdl;',

'  float F0=0.0425;',
'  float F=F0+(1.0-F0)*pow(1.0-clamp(dot(Nn,V),0.,1.),5.0);',

'  vec3 baseC=C0;',
// absorption derived from the tint: dark channels die first, exactly as the
// hero's hand-tuned blue does. one hue in, glass out.
'  vec3 sig=-log(clamp(baseC,0.0016,1.0))*1.70+vec3(0.30);',
'  vec3 rIn=refract(rdl,Nn,1.0/IOR);',
'  float tIn=marchIn(pos,rIn,gi);',
'  vec3 pOut=pos+rIn*tIn;',
'  vec3 NOut=-nrm(pOut,gi);',
'  vec3 absorb=exp(-sig*tIn*4.6)*baseC;',
'  float d0=0.010;',
'  vec3 oR=refract(rIn,NOut,IOR-d0);',
'  vec3 oG=refract(rIn,NOut,IOR);',
'  vec3 oB=refract(rIn,NOut,IOR+d0);',
'  if(dot(oR,oR)<0.001) oR=reflect(rIn,NOut);',
'  if(dot(oG,oG)<0.001) oG=reflect(rIn,NOut);',
'  if(dot(oB,oB)<0.001) oB=reflect(rIn,NOut);',
'  vec3 refr=vec3(env(oR).r,env(oG).g,env(oB).b)*absorb*3.6;',
'  vec3 refl=env(reflect(rdl,Nn))*F*1.15;',
'  vec3 L1=normalize(vec3(-0.34,0.86,0.38)), L2=normalize(vec3(0.78,0.12,-0.60));',
'  vec3 H1=normalize(L1+V), H2=normalize(L2+V);',
'  float s1=pow(max(dot(Nn,H1),0.),420.0), s2=pow(max(dot(Nn,H2),0.),190.0);',
'  vec3 col=refr+refl+vec3(1.0)*s1*3.4+vec3(0.72,0.94,1.0)*s2*1.5;',
'  col+=baseC*pow(1.0-clamp(dot(Nn,V),0.,1.),3.0)*0.55;',
'  col=col/(col+1.0);',
'  col=pow(clamp(col,0.,1.),vec3(0.4545));',
'  gl_FragColor=vec4(col,1.0);}'
].join('\n');


  var AMPBOX = 1.5;          /* the field covers 1.5 glyph heights */
  var AMPW = 0.026;          /* dilation: brings the face up to the built stroke */

  /* Bake a signed distance field for one character from the live typeface.
     Exact Euclidean transform (Felzenszwalb's 1D squared-distance envelope run
     over rows then columns), so the field is true distance, not an approximation
     — a sphere tracer will tunnel straight through anything less. Packed into
     R,G as 16 bits because 8 would quantise coarser than the march threshold. */
  function edt1d(f, n) {
    var d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    var k = 0, q, s; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (q = 1; q < n; q++) {
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
    }
    for (k = 0, q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    return d;
  }
  function edt2d(mask, W, H, inside) {
    var INF = 1e20, f = new Float64Array(Math.max(W, H)), g = new Float64Array(W * H), x, y;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) f[x] = (mask[y * W + x] === inside) ? 0 : INF;
      var r = edt1d(f, W);
      for (x = 0; x < W; x++) g[y * W + x] = r[x];
    }
    for (x = 0; x < W; x++) {
      for (y = 0; y < H; y++) f[y] = g[y * W + x];
      var cc = edt1d(f, H);
      for (y = 0; y < H; y++) g[y * W + x] = cc[y];
    }
    return g;
  }
  /* 1024 rather than 512: the crisp specular (pow 420) needs a normal sampled
     finer than the field's texel spacing, and at 512 the normal step straddled
     more than a texel and averaged the highlight away. One-time cost, measured. */
  function bakeField(ch, font) {
    var S = 1024, c2 = document.createElement('canvas'); c2.width = c2.height = S;
    var x2 = c2.getContext('2d');
    x2.font = font; x2.textAlign = 'center'; x2.textBaseline = 'alphabetic';
    var m = x2.measureText(ch);
    var ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    if (!ink) return null;
    /* the built marks stand 1.0 tall in a 1.5 box; scale the glyph to match and
       centre it on its ink, not on its baseline */
    var want = S * (0.92 / AMPBOX);
    /* parseFloat(font) would read the WEIGHT, not the size — '500 160px ...'
       parses as 500 and rasterises the glyph three times too big, which fills
       the whole field and reads as a solid block. Match the px token instead. */
    var k = want / ink, px = parseFloat(font.match(/([\d.]+)px/)[1]) * k;
    x2.font = font.replace(/[\d.]+px/, px.toFixed(2) + 'px');
    m = x2.measureText(ch);
    x2.fillStyle = '#000';
    x2.fillText(ch, S / 2, S / 2 + (m.actualBoundingBoxAscent - (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 2));
    var px4 = x2.getImageData(0, 0, S, S).data, mask = new Uint8Array(S * S), i;
    for (i = 0; i < S * S; i++) mask[i] = px4[i * 4 + 3] > 127 ? 1 : 0;
    /* seed each transform on the OTHER phase: distance-to-glyph grows outward
       from the ink, distance-to-background grows inward from it, and the signed
       field is their difference — positive outside, negative in. */
    var dToGlyph = edt2d(mask, S, S, 1), dToBack = edt2d(mask, S, S, 0);
    var unit = AMPBOX / S, out = new Uint8Array(S * S * 4), x, y;
    /* rows are written bottom-up: canvas y runs down, glyph space runs up, and
       UNPACK_FLIP_Y_WEBGL is ignored for ArrayBufferView uploads */
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var si = y * S + x, di = (S - 1 - y) * S + x;
      var sd = (Math.sqrt(dToGlyph[si]) - Math.sqrt(dToBack[si])) * unit;
      var n = Math.max(0, Math.min(1, sd / (2 * AMPBOX) + 0.5)) * 65535;
      out[di * 4] = Math.floor(n / 255); out[di * 4 + 1] = Math.round(n % 255);
      out[di * 4 + 2] = 0; out[di * 4 + 3] = 255;
    }
    return { data: out, size: S };
  }

  /* sRGB -> linear: the shader works in linear light, so a hex has to be
     converted or every tint comes out washed */
  function lin(hex) {
    var n = parseInt(hex.slice(1), 16), o = [];
    for (var i = 2; i >= 0; i--) {
      var c = ((n >> (i * 8)) & 255) / 255;
      o.push(c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    return o;
  }

  /* the ampersand's field is identical for every canvas, so bake it once and
     upload the same bytes to each context — the exact 1024x1024 transform costs
     ~150ms and doing it five times would be five times wasted */
  var ampData = null, ampTried = false;

  function mount(cv, glyph, hue) {
    var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true })
          || cv.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) { cv.classList.add('gl-fail'); return; }

    function sh(t, src) {
      var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('glyph-gl:', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { cv.classList.add('gl-fail'); return; }
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.classList.add('gl-fail'); return; }
    gl.useProgram(pr);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var uR = gl.getUniformLocation(pr,'R'), uT = gl.getUniformLocation(pr,'T'),
        uM = gl.getUniformLocation(pr,'M'), uF = gl.getUniformLocation(pr,'FIT');
    var c3 = lin(hue);
    gl.uniform3f(gl.getUniformLocation(pr,'C0'), c3[0], c3[1], c3[2]);
    gl.uniform1f(gl.getUniformLocation(pr,'G'), glyph);
    gl.uniform1f(gl.getUniformLocation(pr,'AMPBOX'), AMPBOX);
    gl.uniform1f(gl.getUniformLocation(pr,'AMPW'), AMPW);

    function loadAmp() {
      if (!ampTried) { ampTried = true; ampData = bakeField('&', '500 160px "Instrument Sans", sans-serif'); }
      if (!ampData) return;
      var tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ampData.size, ampData.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, ampData.data);
      gl.uniform1i(gl.getUniformLocation(pr,'AMP'), 0);
    }

    var mx = 0, my = 0, tx = 0, ty = 0;
    addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    }, { passive: true });

    function size() {
      var dpr = Math.min(devicePixelRatio || 1, 1.6);
      var w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return false;
      if (cv.width !== (w * dpr | 0) || cv.height !== (h * dpr | 0)) {
        cv.width = w * dpr | 0; cv.height = h * dpr | 0;
        gl.viewport(0, 0, cv.width, cv.height);
        return true;
      }
      return false;
    }

    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var running = false, t0 = performance.now(), baked = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        running = e[0].isIntersecting;
        /* bake only once the well is nearly on screen — the transform blocks the
           main thread and must not land inside the hero's arrival */
        if (e[0].isIntersecting && !baked) { baked = true; loadAmp(); }
      }, { rootMargin: '600px' }).observe(cv);
    } else { running = true; loadAmp(); }

    function frame(now) {
      var resized = size();
      if (running || resized) {
        mx += (tx - mx) * 0.045; my += (ty - my) * 0.045;
        gl.uniform2f(uR, cv.width, cv.height);
        gl.uniform1f(uT, reduce ? 0.0 : (now - t0) / 1000);
        gl.uniform2f(uM, mx, my);
        /* the glyph stands 1.0 tall in a space normalised by canvas height, so
           FIT alone sets how much of the well it fills — 2.6 leaves it at ~62% */
        gl.uniform1f(uF, 2.6);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(frame);
    }
    cv.classList.add('gl-on');
    requestAnimationFrame(frame);
  }

  Array.prototype.forEach.call(nodes, function (cv) {
    mount(cv, parseFloat(cv.dataset.glyph) || 0, cv.dataset.hue || '#7A3CF0');
  });
})();
