// YouBall · CHASIS gráfico compartido (Three.js + WebGL). Lo reusan todos los modos.
// Contiene lo caro y crítico de marca: escena/cámara/luces, BLOOM SELECTIVO (las caras NUNCA
// entran al bloom → [[no-glow-over-faces]]), partículas additivas, bolas con cara reactiva, HUD,
// encuadre cenital. Cada modo aporta solo su sim + su arena + su sync + su react.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { faceTexture, hunterTexture } from './facegen.mjs';
import { itemTexture } from './itemgen.mjs';

export { THREE };
export const BLOOM = 1; // capa de bloom: SOLO partículas/orbes/ondas/retícula la activan

export function sat(c, k = 1.28){
  const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return [Math.min(1, l + (c[0] - l) * k), Math.min(1, l + (c[1] - l) * k), Math.min(1, l + (c[2] - l) * k)];
}

export function createStage(){
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NoToneMapping;   // = "Standard" de Blender: cartoon vivo; ACES lavaba los colores
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  cam.position.set(0, 0, 60); cam.lookAt(0, 0, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.AmbientLight(0xb9b6c8, 0.40));
  const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(-5, 7, 10); scene.add(key);
  const fill = new THREE.DirectionalLight(0xaab4c8, 0.35); fill.position.set(6, -4, 6); scene.add(fill);
  return { renderer, scene, cam };
}

export function createParticles(scene){
  const MAXP = 6000;
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pBase = new Float32Array(MAXP * 3);
  const pVx = new Float32Array(MAXP), pVy = new Float32Array(MAXP), pVz = new Float32Array(MAXP);
  const pLife = new Float32Array(MAXP), pMax = new Float32Array(MAXP);
  let pHead = 0;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  points.frustumCulled = false; points.layers.enable(BLOOM); scene.add(points);

  const rings = []; const ringGeo = new THREE.RingGeometry(0.95, 1.0, 72);

  function emit(x, y, z, r, g, b, vx, vy, vz, life){
    const i = pHead; pHead = (pHead + 1) % MAXP;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pBase[i * 3] = r; pBase[i * 3 + 1] = g; pBase[i * 3 + 2] = b;
    pVx[i] = vx; pVy[i] = vy; pVz[i] = vz; pLife[i] = life; pMax[i] = life;
  }
  function burst(x, y, z, col, n, power){ // z bajo + vz mínima: los efectos quedan SIEMPRE tras las caras
    for (let k = 0; k < n; k++){ const a = Math.random() * 6.283, s = power * (0.4 + Math.random());
      emit(x, y, z, col[0], col[1], col[2], Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 0.5, 0.45 + Math.random() * 0.5); }
  }
  // ESTELA DE VELOCIDAD (compartida): cometa cian-blanco glaseado que sale POR DETRÁS de la bola en
  // movimiento → lee "voy más rápido" en cualquier modo. Distinta de la estrella (invencibilidad) y del
  // rojo (furia/quemado). Render-only. Llamar cada frame mientras el buff de velocidad esté activo.
  function trail(x, y, vx, vy){
    const sp = Math.sqrt(vx * vx + vy * vy) || 1, ux = vx / sp, uy = vy / sp;
    for (let k = 0; k < 4; k++){                                             // cola DENSA y larga = lee "voy rápido" sin dudas
      const back = 0.12 + k * 0.22 + Math.random() * 0.18, j = 0.16;         // escalonada por k → estela continua
      emit(x - ux * back + (Math.random() - 0.5) * j, y - uy * back + (Math.random() - 0.5) * j, 0.30,
        0.35 + Math.random() * 0.3, 0.9, 1.0,                                 // CIAN eléctrico = velocidad (≠ humo blanco de quemado, ≠ rojo de furia)
        -ux * (2.0 + Math.random() * 1.8), -uy * (2.0 + Math.random() * 1.8), 0,   // sale hacia atrás
        0.28 + Math.random() * 0.18);
    }
  }
  function ring(x, y, col, op = 0.6){
    if (rings.length >= 4){ const old = rings.shift(); scene.remove(old.m); }
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, 0.6); m.layers.enable(BLOOM); scene.add(m); rings.push({ m, t: 0 });
  }
  function update(dt){
    for (let i = 0; i < MAXP; i++){
      if (pLife[i] > 0){
        pLife[i] -= dt;
        pPos[i * 3] += pVx[i] * dt; pPos[i * 3 + 1] += pVy[i] * dt; pPos[i * 3 + 2] += pVz[i] * dt;
        pVx[i] *= 0.95; pVy[i] = pVy[i] * 0.96 - 6.0 * dt; pVz[i] *= 0.92;   // GRAVEDAD en Y (pantalla) → confeti/chispas CAEN (antes en Z=profundidad, no se veía caer)
        const fl = Math.max(pLife[i] / pMax[i], 0), ff = fl * fl;
        pCol[i * 3] = pBase[i * 3] * ff; pCol[i * 3 + 1] = pBase[i * 3 + 1] * ff; pCol[i * 3 + 2] = pBase[i * 3 + 2] * ff;
      } else { pPos[i * 3 + 2] = 9999; pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; }
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    for (let k = rings.length - 1; k >= 0; k--){
      const rg = rings[k]; rg.t += dt; const s = 1 + rg.t * 10;
      rg.m.scale.set(s, s, 1); rg.m.material.opacity = Math.max(0.7 - rg.t * 1.6, 0);
      if (rg.t > 0.6){ scene.remove(rg.m); rings.splice(k, 1); }
    }
  }
  return { emit, burst, ring, trail, update };
}

// SPRITE de cara plano sobre el frente de la bola: textura del atlas (facegen) con TODAS las
// expresiones. unlit + alphaTest = trazo nítido; NO entra al bloom ([[no-glow-over-faces]]).
// kind='ball' usa faceTexture(PRESETS); kind='hunter' usa hunterTexture (depredador).
export function makeFacePlane(R, kind = 'ball', size = R * 2.05){
  const get = kind === 'hunter' ? hunterTexture : faceTexture;
  let cur = kind === 'hunter' ? 'caz_hambriento' : 'neutral';
  const mat = new THREE.MeshBasicMaterial({ map: get(cur), transparent: true, alphaTest: 0.5, depthWrite: true, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  // z > R: el plano va DELANTE del polo frontal de la esfera, si no la esfera asoma entre los ojos = "nariz".
  // Con cámara ortográfica, mover en z NO cambia la proyección 2D → la cara se ve igual, solo encima.
  plane.position.set(0, 0, R * 1.06); plane.renderOrder = 3;
  function setExpr(name){ if (name === cur) return; cur = name; mat.map = get(name); mat.needsUpdate = true; }
  return { plane, mat, setExpr, get expr(){ return cur; } };
}

// bola gominola con cara reactiva por SPRITE (todas las expresiones del atlas). `setExpr(name)` la cambia.
// eyes/pups/mouth se conservan como STUBS no-op para compatibilidad con modos aún no migrados.
export function makeBall(scene, b, BALL_R){
  const g = new THREE.Group();
  const col = sat(b.color);
  // GOMINOLA con PESO: glossy (roughness 0.4) → brillo arriba + degradado = volumen/peso. env 0 = sin
  // manchas de reflejo. La nariz NO venía de aquí (era el plano detrás de la esfera, ya arreglado) → se
  // puede dar brillo sin que vuelva. NoToneMapping mantiene el color VIVO.
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...col), emissive: new THREE.Color(...col), emissiveIntensity: 0.40, roughness: 0.40, metalness: 0.0, envMapIntensity: 0.0 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 40, 28), mat); g.add(body);
  const face = makeFacePlane(BALL_R, 'ball'); g.add(face.plane);
  scene.add(g);
  const noop = { set(){} };
  return { g, body, mat, col, squash: 0, excite: 0, fall: 0, fz: 0, frot: 0,
    setExpr: face.setExpr, face,
    eyes: [], pups: [], mouth: { visible: false, scale: noop } };
}

// Pool de ÍTEMS como SPRITE de icono plano (con halo horneado en la textura). Unlit + sin bloom →
// el ICONO se reconoce (no es "solo una luz"). `get(kind)` lo pinta con el icono de ese tipo.
export function createItemPool(scene, size = 1.6){
  const pool = [];
  function get(kind){
    let m = pool.pop();
    if (!m){ m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      m.renderOrder = 4; m.userData = {}; scene.add(m); }
    if (m.userData.kind !== kind){ m.userData.kind = kind; m.material.map = itemTexture(kind); m.material.needsUpdate = true; }
    m.visible = true; return m;
  }
  function release(m){ m.visible = false; pool.push(m); }
  return { get, release };
}

// POP de CONSUMO de ítem (compartido por todos los modos): al consumirse un consumible, su ICONO
// CRECE y se DESVANECE en el sitio → se VE qué se consumió (antes solo sonaba + partículas y pasaba
// desapercibido). Sprite plano unlit, FUERA del bloom (el icono debe leerse, no brillar). dt-based
// (determinista en captura). Uso: `pop(x,y,kind[,size])` en el evento de pickup + `update(dt)` por frame.
export function createItemPops(scene){
  const pool = [], active = [];
  function pop(x, y, kind, size = 1.5){
    let m = pool.pop();
    if (!m){ m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
      m.userData = {}; m.renderOrder = 8; scene.add(m); }                 // 8 = por delante de ítems/caras
    if (m.userData.kind !== kind){ m.userData.kind = kind; m.material.map = itemTexture(kind); m.material.needsUpdate = true; }
    m.position.set(x, y, 1.4); m.visible = true; m.material.opacity = 1;
    active.push({ m, t: 0, size });
  }
  function update(dt){
    for (let i = active.length - 1; i >= 0; i--){
      const a = active[i]; a.t += dt; const k = a.t / 0.5;                 // 0.5 s de vida
      if (k >= 1){ a.m.visible = false; pool.push(a.m); active.splice(i, 1); continue; }
      const e = 1 - (1 - k) * (1 - k);                                    // ease-out: salta rápido y frena
      a.m.scale.setScalar(a.size * (1 + 1.7 * e));                         // 1x → ~2.7x (se NOTA)
      const fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;                  // OPACO un instante (que se LEA el icono) y luego se va
      a.m.material.opacity = fade * fade;                                 // desvanecido suave (elegante, con gusto)
    }
  }
  return { pop, update };
}

// TEXTURA de MAGMA cenital (tileable) — para lagos/charcos de lava vistos desde arriba. A diferencia
// del frente direccional del Gauntlet, esta es MOTTLED y uniforme (sin gradiente de un lado), pensada
// para repetir y FLUIR (offset de UV). Placas de costra oscura + pozas calientes + grietas incandescentes.
// Es cosmética (no toca la sim) → usar Math.random aquí es seguro (el determinismo vive en sim.js).
export function lavaTexture(){
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#cf3208'; x.fillRect(0, 0, S, S);                                   // base magma medio
  for (let i = 0; i < 60; i++){ const bx = Math.random() * S, by = Math.random() * S, r = 14 + Math.random() * 46;  // pozas calientes
    const g = x.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, 'rgba(255,228,128,' + (0.45 + Math.random() * 0.4) + ')');
    g.addColorStop(0.5, 'rgba(255,120,22,' + (0.22 + Math.random() * 0.3) + ')');
    g.addColorStop(1, 'rgba(255,80,10,0)');
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); }
  for (let i = 0; i < 45; i++){ const bx = Math.random() * S, by = Math.random() * S, r = 7 + Math.random() * 18;   // placas de costra fría (menos/más suaves → lava más brillante, no "campo de manchas")
    x.fillStyle = 'rgba(52,8,2,' + (0.16 + Math.random() * 0.28) + ')'; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); }
  for (let i = 0; i < 22; i++){ x.strokeStyle = 'rgba(255,172,42,' + (0.25 + Math.random() * 0.4) + ')'; x.lineWidth = 1.5 + Math.random() * 2.5;  // grietas incandescentes
    x.beginPath(); let px = Math.random() * S, py = Math.random() * S; x.moveTo(px, py);
    for (let s = 0; s < 5; s++){ px += (Math.random() - .5) * 70; py += (Math.random() - .5) * 70; x.lineTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// LAVA PREMIUM (AR1). Material de SUPERFICIE: lit + emissiveMap = relieve/brillo molten (las pozas calientes
// de la textura GLOW, la costra queda mate) en vez de "naranja plano". El cuerpo NO va al bloom (un plano
// grande brillando lavaría las caras → [[no-glow-over-faces]]); el glow lo da el emissive + las burbujas.
export function lavaSurfaceMat(tex, { emissive = 0xff5a14, ei = 0.95, rough = 0.34, metal = 0.16 } = {}){
  return new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(emissive),
    emissiveIntensity: ei, roughness: rough, metalness: metal });
}

// Pool de BURBUJAS de lava: discos aditivos que laten (crecen/menguan + opacidad) en 2-3 s y, los de la
// franja superior, hacen de FROTH en la superficie. Bloom (acentos pequeños, no lavan caras). Cosmético
// (Math.random/sin permitidos aquí; el determinismo vive en la sim). update(tm) con tm = segundos.
export function createLavaBubbles(scene, { cx = 0, y = 0, width = 40, z = -3.6, n = 13, spanY = 2.6, color = [1.0, 0.62, 0.18] } = {}){
  const bubbles = [];
  for (let i = 0; i < n; i++){
    const froth = i < Math.round(n * 0.4);                       // ~40% pegadas a la superficie = froth
    const r = froth ? 0.12 + Math.random() * 0.22 : 0.20 + Math.random() * 0.5;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), toneMapped: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(cx + (Math.random() - 0.5) * width, y - (froth ? Math.random() * 0.5 : 0.4 + Math.random() * spanY), z);
    m.layers.enable(BLOOM); scene.add(m);
    bubbles.push({ m, ph: Math.random() * 6.283, sp: 0.55 + Math.random() * 0.7, froth });
  }
  function update(tm){
    for (const b of bubbles){
      const e = 0.5 + 0.5 * Math.sin(tm * b.sp + b.ph);          // 0..1 laten
      b.m.scale.setScalar(0.4 + 1.0 * e);
      b.m.material.opacity = (b.froth ? 0.16 : 0.10) + (b.froth ? 0.40 : 0.46) * e * e;
    }
  }
  return { update, bubbles };
}

export function createOrbPool(scene){
  const pool = [];
  function get(){
    let o = pool.pop();
    if (!o){ o = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xffcf3a, emissive: 0xffae00, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.2 }));
      scene.add(o); o.layers.enable(BLOOM); }
    o.visible = true; return o;
  }
  function release(m){ m.visible = false; pool.push(m); }
  return { get, release };
}

export function createBloom(renderer, scene, cam){
  const mask = new THREE.Layers(); mask.set(BLOOM);
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const saved = {};
  const darken = o => { if (o.isMesh && !mask.test(o.layers)){ saved[o.uuid] = o.material; o.material = darkMat; } };
  const restore = o => { if (saved[o.uuid]){ o.material = saved[o.uuid]; delete saved[o.uuid]; } };
  const bloomComposer = new EffectComposer(renderer); bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, cam));
  bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.95, 0.5, 0.0));
  const mixPass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main(){ gl_FragColor = texture2D(baseTexture,vUv) + texture2D(bloomTexture,vUv); }',
  }), 'baseTexture');
  mixPass.needsSwap = true;
  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, cam));
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());
  function renderScene(){ scene.traverse(darken); bloomComposer.render(); scene.traverse(restore); finalComposer.render(); }
  function setSize(w, h){ bloomComposer.setSize(w, h); finalComposer.setSize(w, h); }
  return { renderScene, setSize };
}

// encuadre cenital ortográfico, consciente de retrato/apaisado, centrado en (cx,cy) con shake opcional
export function frameOrtho(cam, scale, cx = 0, cy = 0, shake = 0, fit = 'auto'){
  const aspect = innerWidth / innerHeight, half = scale / 2;
  const byHeight = fit === 'height' || (fit === 'auto' && aspect >= 1); // 'height' = vertical=scale (descenso/Carrera)
  if (byHeight){ cam.left = -half * aspect; cam.right = half * aspect; cam.top = half; cam.bottom = -half; }
  else { cam.left = -half; cam.right = half; cam.top = half / aspect; cam.bottom = -half / aspect; }
  cam.updateProjectionMatrix();
  cam.position.set(cx + (Math.random() - .5) * shake, cy + (Math.random() - .5) * shake, 60);
  cam.lookAt(cx, cy, 0);
}

// HUD de pips por equipo (DOM). Requiere #top y #status en el HTML.
export function buildHud(TEAMS){
  const topEl = document.getElementById('top'); topEl.innerHTML = '';
  TEAMS.forEach((t, ti) => {
    const d = document.createElement('div'); d.className = 'team';
    const c = sat(t.color); const hex = `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
    for (let k = 0; k < 3; k++){ const p = document.createElement('div'); p.className = 'pip'; p.style.background = hex; p.dataset.team = ti; p.dataset.k = k; d.appendChild(p); }
    topEl.appendChild(d);
  });
}
export function updateHud(sim, TEAMS){
  const alive = TEAMS.map((_, ti) => sim.byTeam[ti].filter(b => b.rank === null).length);
  document.getElementById('top').querySelectorAll('.pip').forEach(p => { p.style.opacity = (+p.dataset.k < alive[+p.dataset.team]) ? '1' : '0.18'; });
  // SIN texto "gana X" ([[no-text-symbols]]): el ganador se lee por el color de sus bolas + la copa + las pips del HUD.
}
