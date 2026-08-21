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
'uniform float SPIN;uniform float ZOOM;',

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

'void main(){',
'  vec2 uv=(gl_FragCoord.xy-0.5*R)/R.y;',
'  vec3 ro=vec3(0.,0.,4.2), rd=normalize(vec3(uv,-FIT*ZOOM));',
'  float yaw=0.34+M.x*0.78+sin(T*0.20)*0.10+SPIN;',
'  float pit=-0.04-M.y*0.34+sin(T*0.155)*0.045;',   // -M.y: screen-up cursor tips the face up
'  mat3 inv=rotX(-pit)*rotY(-yaw);',
'  vec3 rol=inv*ro, rdl=inv*rd;',
'  float t=march(rol,rdl);',
'  if(t<0.0){gl_FragColor=vec4(0.);return;}',
'  vec3 pos=rol+rdl*t, N=nrm(pos), V=-rdl;',

// Schlick fresnel
'  float F0=0.0425;',
'  float F=F0+(1.0-F0)*pow(1.0-clamp(dot(N,V),0.,1.),5.0);',

// ---- refraction: in through the front, across the interior, out the back ----
'  vec3 tint=vec3(0.0);',
'  vec3 baseC=vec3(0.0130,0.2789,1.0);',          // #1E90FF linear
'  vec3 sig=vec3(7.4,1.75,0.34);',                // red dies first, blue survives
'  vec3 rIn=refract(rdl,N,1.0/IOR);',
'  float tIn=marchIn(pos,rIn);',
'  vec3 pOut=pos+rIn*tIn;',
'  vec3 NOut=-nrm(pOut);',
'  vec3 absorb=exp(-sig*tIn*4.6)*baseC;',
// dispersion: exit each channel at a slightly different IOR -> coloured fringing
'  float d0=0.010;',
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
      uS = gl.getUniformLocation(pr,'SPIN'), uZ = gl.getUniformLocation(pr,'ZOOM');

  // load pose, held until the cursor moves: 70% right, 15% up of the full look range
  var REST_X=0.70, REST_Y=-0.15;
  var mx=REST_X,my=REST_Y,tx=REST_X,ty=REST_Y;
  // the hash holds its load pose until the cursor actually moves
  var active=false, needsDraw=true, t0=0;

  // ---- arrival choreography ----
  // hero-intro.js owns every timing; this file only renders the pose it is handed.
  // during the intro the canvas is full-width, so the pixel count roughly doubles —
  // the dpr cap comes down to pay for it and goes back up once the hash is still.
  var spin=0, zoom=1, intro=false, dprCap=1.75;
  window.HashGL = {
    start: function(){ intro=true; dprCap=1.15; needsDraw=true; },
    set: function(z, s){ zoom=z; spin=s; needsDraw=true; },
    done: function(){ intro=false; dprCap=1.75; spin=0; zoom=1; needsDraw=true; }
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
