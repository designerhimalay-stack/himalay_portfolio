/* The inline marks in section two, in the hero hash's glass.

   yanxinzhang.com sets photographs and video clips into its display paragraph so
   the eye pauses where the writing does. Video inside a line of type wins every
   time — the sentence stops being read — so ours punctuates with the site's own
   marks instead, and each one does a word's work: & is the conjunction, % is a
   real quantity, * is the beat that opens the statement.

   ONE canvas over the whole paragraph, not one per mark. Three contexts would be
   three full-screen passes and three copies of the same environment; instead the
   canvas spans the paragraph and each pixel tests which slot it falls in and
   marches only that glyph. Pixels outside every slot discard immediately, so the
   cost is the marks' own area and nothing more.

   The slots are MEASURED from the live text rather than positioned by hand: the
   real character sits in the flow, carrying the meaning for a screen reader and
   for anyone without WebGL, and the glass is drawn over its box. Only once this
   is running does the character go transparent (html.mk-on), so a failed context
   leaves a readable sentence rather than a gap.

   The material is glyph-gl.js's, verbatim — same environment, same two-interface
   refraction, same dispersion. The tints are the glyph set's own hue per mark, so
   the small mark in the paragraph and the big one further down the page are
   recognisably the same object. */

import { bakeField } from './sdf-field.js';

(function () {
  'use strict';
  var host = document.querySelector('.ab-lead');
  if (!host) return;
  var slots = [].slice.call(host.querySelectorAll('.mk'));
  if (!slots.length) return;

  var cv = document.createElement('canvas');
  cv.id = 'markgl';
  cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);

  var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true })
        || cv.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) { cv.classList.add('gl-fail'); return; }

  var MAX = 4;                       /* slots the shader can hold */
  var BOX = 1.5;                     /* slot box height, in paragraph font-sizes */
  var AMPBOX = 1.5, AMPW = 0.026;    /* must match glyph-gl.js — same baked field */

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  var FS = [
'precision highp float;',
'uniform vec2 R;uniform float T;uniform float FIT;',
'uniform vec4 SL[4];uniform float NS;',        // x,y centre px (y up) · z half-box px · w glyph
'uniform vec3 C0,C1,C2,C3;',
'uniform sampler2D AMP;uniform float AMPBOX;uniform float AMPW;',

'const float S=1.0/146.0;',
'const float HD=10.0*S;',
'const float BEV=5.0*S;',
'const float IOR=1.52;',
'const float W=9.0*S;',
'const float RT=7.0*S;',

'float sdRB2(vec2 p, vec2 b, float r){vec2 q=abs(p)-b+r;',
'  return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}',
'float smin(float a,float b,float k){',
'  float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}',
'float ring(vec2 p,float ra,float th){return abs(length(p)-ra)-th;}',
'vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c)*p;}',

'float gStar(vec2 p){',
'  float d=sdRB2(p,vec2(W,0.44),RT);',
'  d=smin(d,sdRB2(rot(p,1.0472),vec2(W,0.44),RT),0.03);',
'  d=smin(d,sdRB2(rot(p,2.0944),vec2(W,0.44),RT),0.03);',
'  return d;}',
'float gPct(vec2 p){',
'  float d=ring(p-vec2(-0.21,0.28),0.155,W*0.92);',
'  d=min(d,ring(p-vec2(0.21,-0.28),0.155,W*0.92));',
'  d=min(d,sdRB2(rot(p,-0.955),vec2(W,0.50),RT));',
'  return d;}',
// the ampersand has no honest decomposition into rings and bars, so its profile
// is the typeface's own outline, read back from a baked distance field
'float gAmp(vec2 p){',
'  vec2 uv=p/AMPBOX+0.5;',
'  vec2 q=abs(p)-vec2(AMPBOX*0.5);',
'  float dBox=length(max(q,0.0))+min(max(q.x,q.y),0.0);',
'  vec4 t=texture2D(AMP,clamp(uv,0.0,1.0));',
'  float dTex=((t.r*255.0+t.g)/255.0-0.5)*2.0*AMPBOX-AMPW;',
'  return max(dTex,dBox);}',

'float prof(vec2 p,float g){',
'  if(g<1.5) return gPct(p);',
'  if(g<2.5) return gAmp(p);',
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
'vec3 tintOf(float g){',
'  if(g<0.5) return C0;  if(g<1.5) return C1;',
'  if(g<2.5) return C2;  return C3;}',

'void main(){',
'  vec2 fc=gl_FragCoord.xy;',
'  float gi=-1.0, ph=0.0; vec2 uv=vec2(0.0);',
// which slot does this pixel belong to? everything else leaves immediately, so
// the paragraph-sized canvas only ever costs the marks' own area
'  for(int i=0;i<4;i++){',
'    if(float(i)>=NS) break;',
'    vec4 s=SL[i];',
'    vec2 d=fc-s.xy;',
'    if(abs(d.x)<s.z && abs(d.y)<s.z){ gi=s.w; uv=d/(s.z*2.0); ph=float(i)*1.7; }',
'  }',
'  if(gi<0.0){gl_FragColor=vec4(0.);return;}',

'  vec3 ro=vec3(0.,0.,4.2), rd=normalize(vec3(uv,-FIT));',
// no pointer term: a mark set into a line of type that leans toward the cursor
// reads as a toy. It turns on its own slow phase and nothing else.
'  float yaw=0.30+sin(T*0.20+ph)*0.13;',
'  float pit=-0.03+sin(T*0.155+ph)*0.05;',
'  mat3 inv=rotX(-pit)*rotY(-yaw);',
'  vec3 rol=inv*ro, rdl=inv*rd;',
'  float t=march(rol,rdl,gi);',
'  if(t<0.0){gl_FragColor=vec4(0.);return;}',
'  vec3 pos=rol+rdl*t, Nn=nrm(pos,gi), V=-rdl;',
'  float F0=0.0425;',
'  float F=F0+(1.0-F0)*pow(1.0-clamp(dot(Nn,V),0.,1.),5.0);',
'  vec3 baseC=tintOf(gi);',
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

  function sh(t, src) {
    var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('mark-gl:', gl.getShaderInfoLog(s)); return null; }
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
      uF = gl.getUniformLocation(pr,'FIT'), uSL = gl.getUniformLocation(pr,'SL'),
      uNS = gl.getUniformLocation(pr,'NS');

  /* one hue per mark, and the SAME hue the glyph set gives that mark further down
     the page — the small one in the sentence and the big one in the row read as
     one object seen twice, not as two decorations. */
  var HUES = ['#00A387', '#E0208C', '#F0521E', '#C98A00'];   /* $ % & * */
  function lin(hex) {
    var n = parseInt(hex.slice(1), 16), o = [];
    for (var i = 2; i >= 0; i--) {
      var c = ((n >> (i * 8)) & 255) / 255;
      o.push(c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    }
    return o;
  }
  for (var i = 0; i < 4; i++) {
    var c = lin(HUES[i]);
    gl.uniform3f(gl.getUniformLocation(pr, 'C' + i), c[0], c[1], c[2]);
  }
  gl.uniform1f(gl.getUniformLocation(pr, 'AMPBOX'), AMPBOX);
  gl.uniform1f(gl.getUniformLocation(pr, 'AMPW'), AMPW);

  /* The '&' profile is the only one that is read rather than built, so nothing
     may be drawn until its field is uploaded — an unbound sampler reads (0,0,0,1),
     which decodes to "everywhere inside" and paints the slot as a solid block.
     bakeField caches, so the glyph set further down reuses this one for free. */
  var ready = false;
  function loadAmp() {
    var f = bakeField('&', '500 160px "Instrument Sans", sans-serif', AMPBOX);
    if (!f) return;
    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.size, f.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.data);
    gl.uniform1i(gl.getUniformLocation(pr, 'AMP'), 0);
    ready = true;
    document.documentElement.classList.add('mk-on');
    measure();
  }
  var ampDone = false;
  function ampReady() {
    if (ampDone) return;
    ampDone = true;
    if (document.fonts && document.fonts.load) {
      document.fonts.load('500 160px "Instrument Sans"').then(loadAmp, loadAmp);
    } else { loadAmp(); }
  }

  /* Slots are read off the live text every time it could have reflowed. The <i>
     is measured, not the .mk box: an inline element's rect is the font's own
     content area, so its centre already sits where the character's does — the
     .mk box is a line-height tall and would drift with the leading. */
  var data = new Float32Array(MAX * 4), count = 0, dpr = 1;
  function measure() {
    var hb = host.getBoundingClientRect();
    var cb = cv.getBoundingClientRect();
    if (!cb.height) return;
    var fs = parseFloat(getComputedStyle(host).fontSize);
    var half = fs * BOX * 0.5;
    count = 0;
    for (var i = 0; i < slots.length && count < MAX; i++) {
      var g = parseFloat(slots[i].getAttribute('data-g')) || 0;
      var r = slots[i].querySelector('i').getBoundingClientRect();
      if (!r.width && !r.height) continue;
      var cx = (r.left + r.width / 2) - cb.left;
      var cy = (r.top + r.height / 2) - cb.top;
      data[count * 4]     = cx * dpr;
      data[count * 4 + 1] = (cb.height - cy) * dpr;    /* gl_FragCoord.y runs up */
      data[count * 4 + 2] = half * dpr;
      data[count * 4 + 3] = g;
      count++;
    }
    if (hb) { /* referenced so a reflow of the host is what triggers a re-measure */ }
  }

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 1.6);
    var w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== (w * dpr | 0) || cv.height !== (h * dpr | 0)) {
      cv.width = w * dpr | 0; cv.height = h * dpr | 0;
      gl.viewport(0, 0, cv.width, cv.height);
      measure();
      return true;
    }
    return false;
  }

  addEventListener('resize', function () { size(); measure(); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(function () { size(); measure(); }).observe(host);

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var running = false, t0 = performance.now();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      running = e[0].isIntersecting;
      if (e[0].isIntersecting) ampReady();
    }, { rootMargin: '600px' }).observe(cv);
  } else { running = true; ampReady(); }

  function frame(now) {
    var resized = size();
    if (ready && (running || resized)) {
      gl.uniform2f(uR, cv.width, cv.height);
      gl.uniform1f(uT, reduce ? 0.0 : (now - t0) / 1000);
      gl.uniform1f(uF, 3.4);
      gl.uniform1f(uNS, count);
      gl.uniform4fv(uSL, data);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
