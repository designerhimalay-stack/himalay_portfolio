/* Glass hash — raymarched SDF with true two-interface refraction. Raw WebGL, no libraries. */
(function () {
  'use strict';
  var cv = document.getElementById('hashgl');
  if (!cv) return;
  var gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true })
        || cv.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) { cv.classList.add('gl-fail'); return; }

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  var FS = [
'precision highp float;',
'uniform vec2 R;uniform float T;uniform vec2 M;uniform float FIT;',
// arrival choreography (hero-intro.js drives these; 1.0 / 0.0 is the rest pose).
// ZOOM is a focal-length change, not a scale: apparent size is exactly linear in
// FIT, so ZOOM 2.6 renders the hash 2.6x with the perspective a longer lens gives.
'uniform float SPIN;uniform float ZOOM;uniform float ROLL;',
// DIAL is the dial's live circle in DEVICE pixels (x, y, radius) and DMIX how
// much of the recolour is enabled. The blue is swapped for the dial's glass only
// where the fragment falls inside that circle, so as the ring rises over the
// hash the recolour spreads across it on its own — the "partial" is geometry,
// not a separate animation. gl_FragCoord.y counts up from the bottom, so the
// caller flips y before sending it.
'uniform vec3 DIAL;uniform float DMIX;uniform vec3 TINT;',

// ---- true dimensions, normalised so height = 1.0 (146 mm) ----
'const float S=1.0/146.0;',
'const float HW=60.0*S, HH=73.0*S, HD=10.0*S;',
'const float BT=10.0*S, OFF=25.0*S;',
'const float RTIP=9.0*S;',                       // in-plane radius at the arm tips
'const float RCON=7.0*S;',                       // fillet where bars meet (concave)
'const float BEV=5.0*S;',                        // depth-edge bevel  (the R5)
'const float IOR=1.52;',

// --- 2D profile of the hash, with the real radii ---
'float sdRB2(vec2 p, vec2 b, float r){vec2 q=abs(p)-b+r;',
'  return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}',
'float smin(float a,float b,float k){',
'  float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}',
'float hash2(vec2 p){',
'  float d =        sdRB2(p-vec2( OFF,0.0),vec2(BT,HH),RTIP);',
'  d = smin(d,      sdRB2(p-vec2(-OFF,0.0),vec2(BT,HH),RTIP), RCON);',
'  d = smin(d,      sdRB2(p-vec2(0.0, OFF),vec2(HW,BT),RTIP), RCON);',
'  d = smin(d,      sdRB2(p-vec2(0.0,-OFF),vec2(HW,BT),RTIP), RCON);',
'  return d;}',
// --- extrude the profile to 20mm depth, rounding the depth edges by BEV ---
'float map(vec3 p){',
'  float d=hash2(p.xy)+BEV;',
'  vec2 w=vec2(d, abs(p.z)-(HD-BEV));',
'  return min(max(w.x,w.y),0.0)+length(max(w,0.0))-BEV;}',

'vec3 nrm(vec3 p){vec2 e=vec2(0.0007,0.);return normalize(vec3(',
'  map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
'float march(vec3 ro,vec3 rd){float t=0.0;for(int i=0;i<90;i++){',
'  float d=map(ro+rd*t);if(d<0.0005)return t;t+=d;if(t>7.0)break;}return -1.0;}',
// distance to the far wall from inside (SDF negated)
'float marchIn(vec3 ro,vec3 rd){float t=0.003;for(int i=0;i<72;i++){',
'  float d=-map(ro+rd*t);if(d<0.0005)return t;t+=max(d,0.0016);if(t>3.0)break;}return t;}',

// ---- studio environment: soft gradient + a big key softbox + a cool kicker ----
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
'mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,-s,0,s,c,0,0,0,1);}',

'void main(){',
'  vec2 uv=(gl_FragCoord.xy-0.5*R)/R.y;',
'  vec3 ro=vec3(0.,0.,4.2), rd=normalize(vec3(uv,-FIT*ZOOM));',
'  float yaw=0.34+M.x*0.78+sin(T*0.20)*0.10+SPIN;',
'  float pit=-0.04-M.y*0.34+sin(T*0.155)*0.045;',   // -M.y: screen-up cursor tips the face up
// ROLL is applied innermost so it turns the object in the image plane rather than
// swinging the camera: yaw on its own is a turntable, and a turntable is what the
// journey across section three would read as without this. Order matters — put
// rotZ outermost and the roll would rotate the yaw axis with it, which tumbles the
// hash out of frame instead of tilting it.
'  mat3 inv=rotZ(-ROLL)*rotX(-pit)*rotY(-yaw);',
'  vec3 rol=inv*ro, rdl=inv*rd;',
'  float t=march(rol,rdl);',
'  if(t<0.0){gl_FragColor=vec4(0.);return;}',
'  vec3 pos=rol+rdl*t, N=nrm(pos), V=-rdl;',

// Schlick fresnel
'  float F0=0.0425;',
'  float F=F0+(1.0-F0)*pow(1.0-clamp(dot(N,V),0.,1.),5.0);',

// ---- refraction: in through the front, across the interior, out the back ----
'  vec3 tint=vec3(0.0);',
'  float ins=1.0-smoothstep(DIAL.z-46.0,DIAL.z,length(gl_FragCoord.xy-DIAL.xy));',
'  vec3 baseC=mix(vec3(0.0130,0.2789,1.0),TINT,ins*DMIX);',   // #1E90FF linear -> dial glass
// Absorption, not baseC, is what makes this blue: 7.4/1.75/0.34 kills red
// fastest and lets blue through, so tinting baseC alone left the hash still
// unmistakably blue. It has to go neutral alongside — but not weak. Colourless
// is not weightless: at ~0.6 the object passed nearly all its light and vanished
// against a near-white dial. Clear glass reads because its THICK paths go dark,
// so ~1.7, level across the channels, keeps the hue out while keeping the deep
// edges and caustics the material gets its definition from.
'  vec3 sig=mix(vec3(7.4,1.75,0.34),vec3(1.72,1.69,1.63),ins*DMIX);',
'  vec3 rIn=refract(rdl,N,1.0/IOR);',
'  float tIn=marchIn(pos,rIn);',
'  vec3 pOut=pos+rIn*tIn;',
'  vec3 NOut=-nrm(pOut);',
'  vec3 absorb=exp(-sig*tIn*4.6)*baseC;',
// Dispersion: each channel leaves at a slightly different IOR, so edges fringe.
// 0.010 is right for the blue hash, where a strong split would just muddy a
// colour the object already has. Inside the dial the glass is colourless, and
// then dispersion is the ONLY thing left to give it colour — so the spread opens
// up nearly fivefold there.
//
// It does NOT go further, and the reason is worth recording: dispersion can only
// show colour that the environment already has. envC() here is a neutral studio
// gradient running grey to near-white, so splitting three channels across it
// yields warm/cool edges and nothing more — pushed to 0.086 the object went
// flatter and chalkier, not more spectral. Vivid rainbow fringing needs an
// environment with real dark/light contrast for the channels to separate
// ACROSS; that is a change to envC, not to this number.
'  float d0=mix(0.010,0.048,ins*DMIX);',
'  vec3 oR=refract(rIn,NOut,IOR-d0);',
'  vec3 oG=refract(rIn,NOut,IOR);',
'  vec3 oB=refract(rIn,NOut,IOR+d0);',
'  if(dot(oR,oR)<0.001) oR=reflect(rIn,NOut);',
'  if(dot(oG,oG)<0.001) oG=reflect(rIn,NOut);',   // total internal reflection
'  if(dot(oB,oB)<0.001) oB=reflect(rIn,NOut);',
'  vec3 refr=vec3(env(oR).r,env(oG).g,env(oB).b)*absorb*3.6;',

// ---- surface reflection ----
'  vec3 refl=env(reflect(rdl,N))*F*1.15;',

// ---- crisp speculars from the two key sources ----
'  vec3 L1=normalize(vec3(-0.34,0.86,0.38)), L2=normalize(vec3(0.78,0.12,-0.60));',
'  vec3 H1=normalize(L1+V), H2=normalize(L2+V);',
'  float s1=pow(max(dot(N,H1),0.),420.0), s2=pow(max(dot(N,H2),0.),190.0);',

'  vec3 col=refr+refl+vec3(1.0)*s1*3.4+vec3(0.72,0.94,1.0)*s2*1.5;',
'  col+=baseC*pow(1.0-clamp(dot(N,V),0.,1.),3.0)*0.55;',   // blue edge bloom

'  col=col/(col+1.0);',                            // filmic-ish rolloff
'  col=pow(clamp(col,0.,1.),vec3(0.4545));',
'  gl_FragColor=vec4(col,1.0);}'
].join('\n');

  function sh(t, src) {
    var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('hash-gl:', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { cv.classList.add('gl-fail'); return; }
  var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.classList.add('gl-fail'); return; }
  gl.useProgram(pr);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  var uR = gl.getUniformLocation(pr,'R'), uT = gl.getUniformLocation(pr,'T'),
      uM = gl.getUniformLocation(pr,'M'), uF = gl.getUniformLocation(pr,'FIT'),
      uS = gl.getUniformLocation(pr,'SPIN'), uZ = gl.getUniformLocation(pr,'ZOOM'),
      uL = gl.getUniformLocation(pr,'ROLL'),
      uD = gl.getUniformLocation(pr,'DIAL'), uDM = gl.getUniformLocation(pr,'DMIX'),
      uTN = gl.getUniformLocation(pr,'TINT');

  // load pose, held until the cursor moves: 70% right, 15% up of the full look range
  var REST_X=0.70, REST_Y=-0.15;
  var mx=REST_X,my=REST_Y,tx=REST_X,ty=REST_Y;
  // the hash holds its load pose until the cursor actually moves
  var active=false, needsDraw=true, t0=0;

  // ---- arrival choreography ----
  // hero-intro.js owns every timing; this file only renders the pose it is handed.
  // during the intro the canvas is full-width, so the pixel count roughly doubles —
  // the dpr cap comes down to pay for it and goes back up once the hash is still.
  var spin=0, zoom=1, roll=0, intro=false, dprCap=1.75;
  /* dial circle in CSS px (x, y from the top, radius) and the recolour amount */
  var dialX=0, dialY=-9999, dialR=0, dialMix=0;
  /* CLEAR GLASS, not grey. Near-white and very faintly cool, so what comes
     through the object is essentially the environment rather than a colour of
     its own — the reference is colourless glass whose darks come from thick
     edges and internal caustics, not from a tint. A mid grey here reads as
     frosted, which is the opposite of what it should be. */
  var TINT=[0.88,0.90,0.95];
  window.HashGL = {
    start: function(){ intro=true; dprCap=1.15; needsDraw=true; },
    set: function(z, s, r){ zoom=z; spin=s; if (r !== undefined) roll=r; needsDraw=true; },
    done: function(){ intro=false; dprCap=1.75; spin=0; zoom=1; roll=0; needsDraw=true; },
    // Section three puts the hash behind 26px of backdrop blur while the canvas is
    // at its widest. Rendering it at full dpr there is paying for detail the blur
    // then throws away — 1.0 while it is behind the glass more than covers the
    // widening (1.91x the fragments, x(1/1.75)^2, is 0.62x of today).
    /* the dial tells the hash where it is, so the hash can recolour where they
       overlap. x/y are CSS px from the top-left; r is the CSS radius. */
    dial: function(x, y, r, mix){
      dialX=x; dialY=y; dialR=r; dialMix=mix; needsDraw=true;
    },
    quality: function(q){ var c = q ? 1.75 : 1.0; if (c !== dprCap) { dprCap = c; needsDraw = true; } }
  };
  function wake(){
    if (active) return;
    active = true;
    t0 = performance.now();      // sway starts at T=0, so it grows out of the load pose
  }
  function aim(e){
    tx = Math.max(-1, Math.min(1, (e.clientX / innerWidth  - 0.5) * 2));
    ty = Math.max(-1, Math.min(1, (e.clientY / innerHeight - 0.5) * 2));
    wake();
  }
  addEventListener('pointermove', aim, { passive: true });
  addEventListener('pointerdown', aim, { passive: true });
  // cursor gone -> settle back to the neutral pose rather than sticking
  document.addEventListener('pointerleave', function(){ tx = 0; ty = 0; });
  addEventListener('blur', function(){ tx = 0; ty = 0; });

  /* THE CANVAS BOX, CACHED.

     draw() read cv.getBoundingClientRect() on every rendered frame. That is a
     layout read inside the render loop, and this loop runs AFTER the scroll
     handlers that write --par, the ring's transform and the wireframe's
     attributes — so it flushed all of their pending layout, every frame, to get
     a box that had not moved.

     Refreshed from a passive scroll listener instead, which fires BEFORE the
     frame's writes, when layout is already clean from the previous one. The
     cost is that the box is one frame stale while --par is actually changing —
     which is the hero, where dialMix is 0 and the box is not consulted at all.
     Everywhere the recolour is live the canvas is parked and the cache exact. */
  var box = null;
  function remeasure(){ box = cv.getBoundingClientRect(); }
  addEventListener('scroll', remeasure, { passive: true });
  addEventListener('resize', remeasure, { passive: true });

  function size(){
    var dpr = Math.min(devicePixelRatio||1, dprCap);     // cap: raymarching is fill-rate bound
    var w=cv.clientWidth, h=cv.clientHeight;
    if (cv.width !== (w*dpr|0) || cv.height !== (h*dpr|0)) {
      cv.width=w*dpr|0; cv.height=h*dpr|0; gl.viewport(0,0,cv.width,cv.height);
      return true;
    }
    return false;
  }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var running = true;
  // pause when off-screen — no wasted GPU
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function(e){ running = e[0].isIntersecting; })
      .observe(cv);
  }
  function draw(now){
    mx += (tx-mx)*0.045; my += (ty-my)*0.045;
    gl.uniform2f(uR, cv.width, cv.height);
    gl.uniform1f(uT, (reduce || !active) ? 0.0 : (now-t0)/1000);
    gl.uniform2f(uM, mx, my);
    // wider canvases need a longer lens so the hash keeps its size
    gl.uniform1f(uF, 2.55);
    gl.uniform1f(uS, spin);
    gl.uniform1f(uZ, zoom);
    gl.uniform1f(uL, roll);
    /* Into CANVAS space, not viewport space.

       gl_FragCoord is relative to this canvas, and #hashgl is not full-screen:
       it is min(72vw,900px) wide, 132vh tall and offset -16vh from the top. The
       first pass converted straight from viewport pixels, so the test circle
       landed in the wrong place and only the part of the hash that happened to
       fall inside it recoloured — the whole object should have. Subtract the
       canvas's own origin first, then flip y, then scale by dpr. */
    if (!box) remeasure();
    var _d = box.width ? (cv.width / box.width) : 1;
    gl.uniform3f(uD,
      (dialX - box.left) * _d,
      (box.height - (dialY - box.top)) * _d,
      dialR * _d);
    gl.uniform1f(uDM, dialMix);
    gl.uniform3f(uTN, TINT[0], TINT[1], TINT[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now){
    if (running) {
      var resized = size();
      // before the first cursor move: one static frame, redrawn only on resize
      if (intro || active || needsDraw || resized) { needsDraw = false; draw(now); }
    }
    requestAnimationFrame(frame);
  }
  cv.classList.add('gl-on');
  requestAnimationFrame(frame);
})();
