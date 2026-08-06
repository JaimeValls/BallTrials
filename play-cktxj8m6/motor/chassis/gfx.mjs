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
import { faceTexture, hunterTexture, faceLayers, bareExpr, PRESETS as FACE_PRESETS } from './facegen.mjs?v=f74d8ee';
import { geometriaCuerpo } from './silueta.mjs?v=f74d8ee';   //+AG doc 55 capa 1: cuerpos que no son esferas

//+AG doc 55 capa 1 v2: bolas cuyo cuerpo es una FORMA PINTADA (bola invisible + sprite teñible).
const CUERPO_SPRITE = new Set(['fantasma']);
//+AG la cache guarda una LISTA DE ESPERA, no solo la textura. La primera version avisaba unicamente
//   al primero que pedia la imagen: el segundo llegaba mientras aun estaba descargando, se
//   encontraba la entrada ya en la cache pero sin `image`, y su aviso se perdia para siempre. En
//   partida no se veia (solo TU bola lleva arch, o sea una sola por pantalla), pero en cuanto dos
//   bolas piden el mismo cuerpo —la pagina de previsualizacion pinta la misma bola cuatro veces— la
//   segunda y siguientes se quedaban como esfera. Un fallo que solo aparece con dos.
const cuerpoCache = new Map();
function cuerpoTexture(arch, onOk){
  const e = cuerpoCache.get(arch);
  if (e){ if (e.listo) onOk(); else e.espera.push(onOk); return e.tex; }
  const url = new URL(`../../arte/cuerpos/cuerpo-${arch}.webp`, import.meta.url).href;
  const ent = { tex: null, listo: false, espera: [onOk] };
  const t = new THREE.TextureLoader().load(url,
    () => { ent.listo = true; const q = ent.espera; ent.espera = []; q.forEach(f => f()); },
    undefined, () => { ent.espera = []; });
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  ent.tex = t;
  cuerpoCache.set(arch, ent);
  return t;
}
//+AG el CUERPO PINTADO, sacado a funcion propia por la misma razon que `makeProp`: la pagina de
//   previsualizacion (bolas-vivas.html) tiene que poder montarlo y RE-MONTARLO al cambiar de bola
//   o de color de equipo, y antes vivia enterrado dentro de makeBallVinyl. Un previsualizador que
//   no puede enseñar la pieza no sirve para aprobarla. Devuelve null si esta bola no tiene cuerpo
//   pintado -> quien llama se queda con la esfera de siempre.
//   `onReady` se dispara cuando la textura HA CARGADO, y es quien apaga la esfera: si el arte no
//   existe o no carga, la esfera sigue ahi y no se ve un agujero.
export function makeCuerpo(arch, R, col, onReady){
  if (!CUERPO_SPRITE.has(arch)) return null;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.2, R * 3.2),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
  pl.material.color.setRGB(col[0], col[1], col[2]);   // el TEÑIDO de equipo
  pl.position.set(0, 0, R * 1.02);
  pl.renderOrder = 1;                                 // bajo el prop (2) y la cara (3+)
  pl.visible = false;                                 // se enciende solo si el arte existe
  pl.material.map = cuerpoTexture(arch, () => { pl.visible = true; pl.material.needsUpdate = true; onReady && onReady(); });
  return pl;
}
import { itemTexture } from './itemgen.mjs?v=f74d8ee';
import { ballMaterial, skinTexture } from './ballmat.mjs?v=f74d8ee';   //+AG skinTexture: la piel del cuerpo (encargo 17)
import { makeProp } from './propgen.mjs?v=f74d8ee';   //+AG doc 41 bloque G: prop de la bola-heroe

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

// ── RIG DE CARA ANIMADA (docs/41): la cara en 4 PLANOS apilados (skin/eyes/pups/deco de facegen.faceLayers)
// para animar cada elemento por separado: PUPILAS que miran (setGaze, mueve el plano pups; el gaze del
// preset queda como offset base), y FX por EXPRESION (tabla FACE_FX: pulso/rotacion de ojos, bob/latido
// de simbolos, wiggle/shiver de toda la cara). tick(dt) anima; lo llama chassis/squash.mjs cada frame.
// El grupo EXTERIOR lo mueve/escala el squash (lead/pop/deformacion); el grupo fx anima por dentro.
// Igual que el sprite clasico: unlit + alphaTest, NUNCA bloom ([[no-glow-over-faces]]).
const FACE_FX = {   // amplitudes: *Pulse=escala, *Rot/wiggle=radianes, shiver/bob=fraccion de R, *Hz=ciclos/s
  extasis:  { eyePulse: 0.14, eyeRot: 0.16, eyeHz: 7.0, decoPulse: 0.24, decoBob: 0.10, decoHz: 5.5, wiggle: 0.10, wigHz: 6.0 },
  sorpresa: { eyePulse: 0.10, eyeHz: 9.0, decoBob: 0.16, decoHz: 8.0, wiggle: 0.04, wigHz: 9.0 },
  susto:    { eyePulse: 0.06, eyeHz: 12.0, decoBob: 0.10, decoHz: 10.0, shiver: 0.05, shivHz: 15.0 },
  dolor:    { wiggle: 0.07, wigHz: 10.0, shiver: 0.045, shivHz: 12.0 },
  enfado:   { eyePulse: 0.05, eyeHz: 3.2, decoPulse: 0.30, decoHz: 3.2, shiver: 0.02, shivHz: 8.0 },
  triste:   { decoBob: 0.12, decoHz: 1.3, wiggle: 0.03, wigHz: 1.4 },
  feliz:    { eyePulse: 0.05, eyeHz: 3.2, wiggle: 0.05, wigHz: 3.2 },
  alivio:   { decoBob: 0.12, decoHz: 2.6, wiggle: 0.05, wigHz: 2.6 },
  chuleria: { eyeRot: 0.08, eyeHz: 2.8, decoPulse: 0.25, decoHz: 4.0 },
  ko:       { wiggle: 0.06, wigHz: 1.6 },
};
export function makeFaceRig(R, phase = 0, size = R * 2.05){
  const outer = new THREE.Group(); outer.position.set(0, 0, R * 1.06);   // delante del polo frontal (ver makeFacePlane)
  const fxg = new THREE.Group(); outer.add(fxg);
  const geo = new THREE.PlaneGeometry(size, size);
  const mk = (ro, dz) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthWrite: true, toneMapped: false }));
    m.renderOrder = ro; m.position.z = dz; fxg.add(m); return m;
  };
  const skin = mk(3, 0), eyes = mk(4, R * 0.012), pups = mk(5, R * 0.024), deco = mk(6, R * 0.036);
  const GAZE_MAX = size * 9 / 256;                  // mismo tope que el gaze horneado del atlas clasico
  let cur = null, fx = null, baseG = [0, 0], gtx = 0, gty = 0, gx = 0, gy = 0, t = phase;
  function setExpr(name){
    if (name === cur) return; cur = name;
    const L = faceLayers(name);
    skin.material.map = L.skin; skin.material.needsUpdate = true;
    eyes.material.map = L.eyes; eyes.material.needsUpdate = true;
    pups.visible = !!L.pups; if (L.pups){ pups.material.map = L.pups; pups.material.needsUpdate = true; }
    deco.visible = !!L.deco; if (L.deco){ deco.material.map = L.deco; deco.material.needsUpdate = true; }
    //+AG la clave puede venir compuesta ('cohete/neutral', cara de héroe). El gaze base y los FX
    //  son de la EXPRESIÓN, no del héroe, así que se buscan con el nombre pelado.
    const b = bareExpr(name);
    baseG = (FACE_PRESETS[b] && FACE_PRESETS[b].gaze) || [0, 0];
    fx = FACE_FX[b] || null;
    eyes.rotation.z = 0; eyes.scale.set(1, 1, 1);   // reset de FX al cambiar (que no herede poses)
    deco.rotation.z = 0; deco.scale.set(1, 1, 1); deco.position.x = deco.position.y = 0;
    fxg.rotation.z = 0; fxg.position.x = fxg.position.y = 0;
  }
  // gaze dinamico [-1..1]: los OJOS MIRAN hacia donde va la bola (lo alimenta squash con la velocidad)
  function setGaze(x, y){ gtx = Math.max(-1, Math.min(1, x)); gty = Math.max(-1, Math.min(1, y)); }
  function tick(dt){
    t += dt;
    const k = Math.min(1, 8 * dt); gx += (gtx - gx) * k; gy += (gty - gy) * k;
    pups.position.x = Math.max(-1, Math.min(1, baseG[0] + gx)) * GAZE_MAX;
    pups.position.y = -Math.max(-1, Math.min(1, baseG[1] + gy)) * GAZE_MAX;   // gaze del atlas: +y = mirar ABAJO
    if (!fx) return;
    const TAU = 6.28318;
    if (fx.eyePulse) eyes.scale.setScalar(1 + fx.eyePulse * Math.sin(t * fx.eyeHz * TAU));
    if (fx.eyeRot) eyes.rotation.z = fx.eyeRot * Math.sin(t * (fx.eyeHz || 4) * 0.5 * TAU + 0.6);
    if (fx.decoPulse) deco.scale.setScalar(1 + fx.decoPulse * Math.sin(t * fx.decoHz * TAU + 1.1));
    if (fx.decoBob) deco.position.y = fx.decoBob * R * Math.sin(t * (fx.decoHz || 5) * TAU);
    if (fx.wiggle) fxg.rotation.z = fx.wiggle * Math.sin(t * fx.wigHz * TAU);
    if (fx.shiver) fxg.position.x = fx.shiver * R * Math.sin(t * fx.shivHz * TAU);
  }
  setExpr('neutral');
  // mats = las 4 capas, para tintes de cara completos (p.ej. grisar en stun de Recolecta); .mat = compat (capa skin)
  return { plane: outer, mat: skin.material, mats: [skin.material, eyes.material, pups.material, deco.material],
    setExpr, setGaze, tick, get expr(){ return cur; } };
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

// bola VINILO v2 (docs/41): material mini-shader glossy + cara RIG animada (gaze + FX por expresion).
// MISMO contrato de retorno que makeBall (drop-in). La usan los modos migrados; makeBall (gominola
// MeshStandard + cara sprite) queda para los modos aun sin migrar. Fase de FX por dorsal: caras
// desincronizadas entre bolas y DETERMINISTAS (nada de Math.random aqui).
//+AG doc 41 bloque G: 4o parametro OPCIONAL 'look' = material de la bola-heroe (ballmat.ARCH_LOOK).
//   Sin el, ballMaterial usa LOOK y todo queda byte-identico: el torneo y el video no cambian ni un pixel.
export function makeBallVinyl(scene, b, BALL_R, look, arch){
  const g = new THREE.Group();
  const col = sat(b.color);
  //+AG la PIEL entra por la MISMA puerta que el material y el prop: solo si llega 'arch', o sea
  //   solo tu bola en individual. Sin arch no hay piel y el shader queda byte-identico -> el
  //   torneo y el video del motor no cambian ni un pixel. Si el heroe no tiene piel todavia, la
  //   textura falla al cargar y ballmat la deja en gris neutro (bola lisa, no bola negra).
  const mat = ballMaterial(col, look || undefined, arch ? skinTexture(arch) : null);
  //+AG doc 55 capa 1: hay bolas cuyo CUERPO no es una esfera (el Fantasma). La geometria entra por
  //   la misma puerta que todo lo demas: sin `arch` sale null y se construye la esfera de siempre,
  //   asi que el torneo y los videos no se mueven. El material, el color de equipo y el squash son
  //   exactamente los mismos: lo unico que cambia es la forma.
  const geo = (arch && geometriaCuerpo(arch, BALL_R)) || new THREE.SphereGeometry(BALL_R, 40, 28);
  const body = new THREE.Mesh(geo, mat); g.add(body);
  //+AG doc 55 capa 1 v2 — LA RECETA DE JAIME, literal, despues de que yo la sorteara dos veces:
  //   «mantienes el collider redondo, pero haces la bola invisible y ponemos encima la forma del
  //   fantasma». O sea: el cuerpo NO se deforma — se OCULTA, y encima va la forma PINTADA.
  //   Por que su receta es mejor que la mia (deformar la esfera): la esfera deformada conserva el
  //   material de plastico del motor, y un fantasma de plastico brillante no es un fantasma. Una
  //   forma pintada trae su acabado (translucidez, borde suave) de fabrica.
  //   El sprite viene en GRIS CLARO y se TIÑE del color del equipo (mismo truco que la piel):
  //   blanco toma el color puro, el sombreado gris lo oscurece -> la regla del color se conserva.
  //   La fisica ni se mira: el collider sigue siendo el circulo de la Sim.
  //   Si la textura no existe o no carga, no pasa nada: se queda el cuerpo de siempre (la
  //   geometria de silueta.mjs hace de RESPALDO dibujado, igual que los DRAW de los props).
  let cuerpo = null;
  if (arch){ cuerpo = makeCuerpo(arch, BALL_R, col, () => { body.visible = false; }); if (cuerpo) g.add(cuerpo); }
  //+AG doc 41 bloque G (2a tajada): el PROP cuelga del GRUPO, no del cuerpo. attachSquash escala
  //   body y le gira body.rotation.z con el rumbo; al grupo solo le toca el tilt. Asi el prop se
  //   ladea con la bola como un personaje pero ni se deforma ni RUEDA (un casco rodando canta).
  //+AG doc 55: el handle del prop se GUARDA. Hasta ahora se creaba, se metia en la escena y se
  //   tiraba, asi que no habia forma de animarlo: era un adorno muerto. Con el handle, squash le
  //   hace tick igual que ya se lo hace a la cara. Sigue colgando del `if (arch)`, o sea que sin
  //   arch no existe ni el prop ni su tick y el motor queda byte-identico.
  let prop = null;
  if (arch){ const p = makeProp(arch, BALL_R, col); if (p){ g.add(p); prop = p; } }
  const face = makeFaceRig(BALL_R, (b.id || 0) * 1.7); g.add(face.plane);
  scene.add(g);
  const noop = { set(){} };
  return { g, body, mat, col, squash: 0, excite: 0, fall: 0, fz: 0, frot: 0,
    setExpr: face.setExpr, face, prop, cuerpo,
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

// ── ESTRELLAS DE IMPACTO (docs/41): al rebotar, un pop de estrellitas cartoon RAPIDO en el punto de
// colision, escalado por la fuerza del golpe (power 0..1). Sprites planos con contorno de tinta, unlit,
// FUERA del bloom (deben leerse como dibujo, no como luz). Cosmetico: Math.random permitido (como burst).
function starTexture(fill){
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const draw = (ro, col) => {
    x.beginPath();
    for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? ro : ro * 0.45;
      const px = S / 2 + r * Math.cos(a), py = S / 2 + r * Math.sin(a); i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.closePath(); x.fillStyle = col; x.fill();
  };
  draw(30, 'rgba(14,11,20,0.92)'); draw(24, fill); draw(11, '#ffffff');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createStarBurst(scene){
  const texs = [starTexture('#ffd84d'), starTexture('#fff3c0')];
  const pool = [], active = [];
  function burst(x, y, power, R = 1, nx = 0, ny = 0){
    const p = Math.max(0, Math.min(1, power));
    const n = 3 + Math.min(4, Math.round(p * 4));
    const base = (nx || ny) ? Math.atan2(ny, nx) : Math.random() * 6.283;   // abanico alrededor de la normal del golpe
    for (let i = 0; i < n; i++){
      let m = pool.pop();
      if (!m){ m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
        m.renderOrder = 8; scene.add(m); }
      m.material.map = texs[(Math.random() * 2) | 0]; m.material.needsUpdate = true;
      m.material.opacity = 1; m.visible = true;
      m.position.set(x, y, 1.35); m.rotation.z = Math.random() * 6.283;
      const a = base + (Math.random() - 0.5) * 2.4, sp = R * (5 + Math.random() * 5) * (0.5 + p * 0.9);
      active.push({ m, t: 0, life: 0.26 + Math.random() * 0.14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        spin: (Math.random() - 0.5) * 14, sz: R * (0.30 + Math.random() * 0.25) * (0.7 + 0.7 * p) });
    }
  }
  function update(dt){
    for (let i = active.length - 1; i >= 0; i--){
      const a = active[i]; a.t += dt; const k = a.t / a.life;
      if (k >= 1){ a.m.visible = false; pool.push(a.m); active.splice(i, 1); continue; }
      a.m.position.x += a.vx * dt; a.m.position.y += a.vy * dt; a.vx *= 0.88; a.vy *= 0.88;
      a.m.rotation.z += a.spin * dt;
      const s = a.sz * (k < 0.22 ? k / 0.22 : 1 - (k - 0.22) / 0.78);      // pop-out rapido y encoge
      a.m.scale.setScalar(Math.max(s, 0.001));
      a.m.material.opacity = (1 - k) * (1 - k * 0.3);
    }
  }
  return { burst, update };
}

// ── TRAIL DE VIENTO (docs/41): rafagas blancas cartoon que la bola deja al ir RAPIDO y se desvanecen.
// Ajustable en vivo via .opts: intensity (opacidad/energia) y dur (vida total de cada rafaga, s).
// Distinto de la estela CIAN del buff de velocidad ([[efecto-velocidad]]) y del humo de quemado: esto es
// lenguaje de FISICA (velocidad alta), no de power-up. Va DETRAS de la bola (z bajo) y fuera del bloom.
export function createWindTrail(scene, { intensity = 0.16, dur = 0.10 } = {}){   // defaults = JSON aprobado (viento sutil y corto)
  const opts = { intensity, dur };
  // textura de rafaga con DEGRADADO de desaparicion a lo largo: cabeza opaca (+x, hacia la bola)
  // que se desvanece hacia la cola. La rotacion del plano apunta +x al rumbo -> la cola queda detras.
  const S = 128, H = 32, c = document.createElement('canvas'); c.width = S; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,1)');
  x.fillStyle = g;
  x.filter = 'blur(4px)'; x.beginPath(); x.roundRect(6, 11, S - 14, 10, 5); x.fill();
  x.filter = 'blur(1.2px)'; x.beginPath(); x.roundRect(30, 13.5, S - 40, 5, 2.5); x.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const pool = [], active = [];
  // DUAL: cada llamada crea una PAREJA simetrica de rafagas a los lados de la trayectoria (no una linea
  // central fea). rotVel = giro del rumbo de la bola (rad/s): cada rafaga sigue rotando con el (decae con
  // la vida) -> el viento se CURVA procedualmente siguiendo la trayectoria en vez de quedarse recto.
  function spawn(px, py, ang, speedNorm, R, vx = 0, vy = 0, rotVel = 0){
    const ox = -Math.sin(ang), oy = Math.cos(ang);          // perpendicular al rumbo
    const rv = Math.max(-6, Math.min(6, rotVel));
    for (const side of [-1, 1]){
      let m = pool.pop();
      if (!m){ m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
        scene.add(m); }
      const gap = R * 0.52 * side;
      m.visible = true; m.position.set(px + ox * gap, py + oy * gap, 0.34); m.rotation.z = ang;   // z bajo: SIEMPRE tras la bola/cara
      const len = R * (0.7 + 0.9 * speedNorm) * (0.9 + Math.random() * 0.2), th = R * (0.12 + 0.07 * speedNorm);
      m.scale.set(len, th, 1); m.material.opacity = opts.intensity;
      active.push({ m, t: 0, life: opts.dur * (0.85 + Math.random() * 0.3), len, th,
        vx: vx * 0.12, vy: vy * 0.12, rv, cx: px, cy: py });
    }
  }
  function update(dt){
    for (let i = active.length - 1; i >= 0; i--){
      const a = active[i]; a.t += dt; const k = a.t / a.life;
      if (k >= 1){ a.m.visible = false; pool.push(a.m); active.splice(i, 1); continue; }
      a.m.position.x += a.vx * dt; a.m.position.y += a.vy * dt; a.vx *= 0.92; a.vy *= 0.92;
      const w = a.rv * (1 - k) * dt;                        // rotacion procedural: sigue el giro de la trayectoria
      if (w){ a.m.rotation.z += w;
        const dx = a.m.position.x - a.cx, dy = a.m.position.y - a.cy;   // pivota alrededor de su punto de emision
        const cw = Math.cos(w), sw = Math.sin(w);
        a.m.position.x = a.cx + dx * cw - dy * sw; a.m.position.y = a.cy + dx * sw + dy * cw; }
      a.m.scale.x = a.len * (1 + 0.45 * k); a.m.scale.y = a.th * (1 - 0.5 * k);   // se alarga un poco y afina al morir
      const f = 1 - k;
      a.m.material.opacity = opts.intensity * f * f;        // ademas del degradado horneado, fundido temporal
    }
  }
  return { spawn, update, opts };
}

// TEXTURA de MAGMA cenital (tileable): para lagos/charcos de lava vistos desde arriba. A diferencia
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
  // try/finally: si bloomComposer.render() lanza un frame, la RESTAURACIÓN se ejecuta igual. Si no, el material
  // negro (darkMat) se queda pegado a los meshes NO-bloom (p.ej. el suelo) → medio mapa NEGRO permanente.
  function renderScene(){ scene.traverse(darken); try { bloomComposer.render(); } finally { scene.traverse(restore); } finalComposer.render(); }
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
