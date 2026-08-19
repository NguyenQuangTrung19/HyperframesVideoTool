// Seekable WebGL scene-transition curtains. Data-driven by window.__FX_TRANSITIONS
// (emitted per-video by html-composer.ts) — each entry names a preset + a pair of
// preloaded <img> textures (#fx-tex-<i>-a / -b). Driven by a `uP` progress uniform
// from the GSAP timeline (animations.js), so it is frame-accurate under HyperFrames'
// seek-and-screenshot capture. If WebGL is unavailable the scene crossfade shows
// through unchanged (graceful fallback).
(function () {
  const cfg = (typeof window !== "undefined" && window.__FX_TRANSITIONS) || [];
  const canvas = document.getElementById("fx-transition");
  if (!canvas || !cfg.length) { window.__fxTransition = { get ready() { return false; }, draw() {} }; return; }

  let gl = null, quad = null;
  const programs = {};   // preset -> { prog, aPos, uA, uB, uP }
  const entries = [];    // per cfg -> { texA, texB, ready, preset }

  const VERT = `
    attribute vec2 aPos; varying vec2 vUv;
    void main(){ vUv = vec2(aPos.x*0.5+0.5, 1.0-(aPos.y*0.5+0.5)); gl_Position = vec4(aPos,0.0,1.0); }`;

  const COMMON = `
    precision highp float; varying vec2 vUv;
    uniform sampler2D uA; uniform sampler2D uB; uniform float uP;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float hash1(float n){ return fract(sin(n)*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p),f=fract(p);
      float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
      vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
    float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
    vec3 tx(sampler2D s, vec2 uv){ return texture2D(s, clamp(uv,0.001,0.999)).rgb; }
  `;

  const PRESETS = {
    // digital glitch — per-band horizontal jump + RGB split + white spikes + scanlines
    glitch: `void main(){
      vec2 uv=vUv; float p=uP;
      float g=smoothstep(0.0,0.45,p)*smoothstep(1.0,0.55,p);
      float band=floor(uv.y*26.0); float t=hash1(band+floor(p*22.0));
      float shift=(t-0.5)*0.30*g*step(0.55,t); float ca=0.022*g+0.004;
      vec2 uvA=uv+vec2(shift,0.0), uvB=uv+vec2(-shift,0.0);
      vec3 A=vec3(tx(uA,uvA+vec2(ca,0.)).r,tx(uA,uvA).g,tx(uA,uvA-vec2(ca,0.)).b);
      vec3 B=vec3(tx(uB,uvB+vec2(ca,0.)).r,tx(uB,uvB).g,tx(uB,uvB-vec2(ca,0.)).b);
      float thr=hash1(band)*0.7+0.15; float rev=smoothstep(thr-0.05,thr+0.05,p);
      vec3 col=mix(A,B,rev); col+=g*step(0.965,t)*0.7; col*=1.0-0.12*step(0.5,fract(uv.y*220.0));
      gl_FragColor=vec4(col,1.0);
    }`,
    // directional warp + chromatic-aberration wipe
    warp: `void main(){
      vec2 uv=vUv; vec2 dir=normalize(vec2(0.85,0.55)); float band=0.24;
      float wipe=dot(uv,dir); float front=uP*(1.0+band)-band*0.5;
      float edge=pow(1.0-clamp(abs(wipe-front)/band,0.0,1.0),1.3);
      float n=noise(uv*9.0+uP*3.0)-0.5; vec2 disp=dir*edge*(0.09+0.06*n); vec2 ca=dir*edge*0.018;
      vec3 A=vec3(tx(uA,uv+disp+ca).r,tx(uA,uv+disp).g,tx(uA,uv+disp-ca).b);
      vec3 B=vec3(tx(uB,uv-disp+ca).r,tx(uB,uv-disp).g,tx(uB,uv-disp-ca).b);
      float m=smoothstep(front-band*0.5,front+band*0.5,wipe); vec3 col=mix(B,A,m);
      vec3 flash=mix(vec3(0.06,0.90,0.55),vec3(1.0,0.82,0.35),n*0.5+0.5);
      gl_FragColor=vec4(col+flash*edge*0.35,1.0);
    }`,
    // ink / burn dissolve — fbm threshold reveal with glowing ember edge
    ink: `void main(){
      vec2 uv=vUv; float n=fbm(uv*4.0); float thr=uP*1.3-0.15;
      float stillA=smoothstep(thr-0.06,thr+0.06,n);
      float burn=smoothstep(thr-0.03,thr,n)*smoothstep(thr+0.09,thr,n);
      vec3 col=mix(tx(uB,uv),tx(uA,uv),stillA);
      vec3 ember=mix(vec3(1.0,0.55,0.10),vec3(0.10,0.90,0.50),n);
      gl_FragColor=vec4(col+ember*burn*1.5,1.0);
    }`,
    // luma slide — directional push with gold/emerald light-leak seam
    slide: `void main(){
      vec2 uv=vUv; float e=1.0-pow(1.0-uP,3.0);
      vec2 uvA=uv+vec2(e,0.0), uvB=uv+vec2(e-1.0,0.0);
      float m=step(1.0-e,uv.x); float seam=1.0-clamp(abs(uv.x-(1.0-e))/0.06,0.0,1.0);
      vec3 col=mix(tx(uA,uvA),tx(uB,uvB),m);
      col+=mix(vec3(0.10,0.90,0.50),vec3(1.0,0.85,0.35),uv.y)*seam*0.75;
      gl_FragColor=vec4(col,1.0);
    }`,
  };

  function compileShader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error("[fx] compile", gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function compileProgram(preset) {
    const frag = COMMON + "\n" + (PRESETS[preset] || PRESETS.glitch);
    const vs = compileShader(gl.VERTEX_SHADER, VERT), fs = compileShader(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error("[fx] link", gl.getProgramInfoLog(prog)); return null; }
    return { prog, aPos: gl.getAttribLocation(prog, "aPos"), uA: gl.getUniformLocation(prog, "uA"),
             uB: gl.getUniformLocation(prog, "uB"), uP: gl.getUniformLocation(prog, "uP") };
  }
  function texFromImg(img) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    return t;
  }

  function init() {
    // preserveDrawingBuffer so the headless screenshot captures the last draw
    gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: true, premultipliedAlpha: false });
    if (!gl) { console.warn("[fx] no webgl — falling back to CSS crossfade"); gl = null; return; }
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    cfg.forEach((c, i) => {
      const imgA = document.getElementById("fx-tex-" + i + "-a"), imgB = document.getElementById("fx-tex-" + i + "-b");
      const e = { texA: null, texB: null, ready: false, preset: (c && c.preset) || "glitch" };
      entries[i] = e;
      if (!imgA || !imgB) return;
      const build = () => {
        if (e.ready || !imgA.complete || !imgB.complete || !imgA.naturalWidth || !imgB.naturalWidth) return;
        e.texA = texFromImg(imgA); e.texB = texFromImg(imgB); e.ready = true;
      };
      if (imgA.complete && imgB.complete) build();
      else { imgA.addEventListener("load", build); imgB.addEventListener("load", build); }
    });
  }

  window.__fxTransition = {
    get ready() { return entries.some((e) => e && e.ready); },
    draw(idx, p) {
      const e = entries[idx]; if (!gl || !e || !e.ready) return;
      const pr = programs[e.preset] || (programs[e.preset] = compileProgram(e.preset));
      if (!pr) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(pr.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(pr.aPos); gl.vertexAttribPointer(pr.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, e.texA); gl.uniform1i(pr.uA, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, e.texB); gl.uniform1i(pr.uB, 1);
      gl.uniform1f(pr.uP, p); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
