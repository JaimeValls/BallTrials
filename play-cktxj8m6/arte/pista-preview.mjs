// ============================================================================
//  «ASÍ SE VE EN PISTA» — la bola REAL, a su tamaño real, dentro de la ficha (doc 51).
//
//  POR QUE EXISTE: la ficha del Garaje vendia un retrato de 150 px pintado por Codex —bola con
//  estela de fuego, muro agrietado, rayos— y el jugador no veia lo que de verdad iba a jugar
//  hasta que arrancaba la partida. Jaime, textual: «da por culo ver algo que luego no encaja con
//  la realidad». Clash Royale ensena la carta ilustrada Y la unidad; aqui faltaba la unidad.
//
//  LA DECISION QUE LO HACE HONESTO: se pinta a 56 CSS px, que es EXACTAMENTE el tamano al que se
//  ve la bola en carrera, y con el color de EQUIPO puesto. No es una miniatura del retrato: es la
//  condicion real de pista. Si algo no se reconoce aqui, no se reconoce jugando.
//
//  NO ES ARTE NUEVO NI UNA COPIA: monta las piezas del motor (gfx.makeBallVinyl, ballmat.archLook
//  + skinTexture, propgen.makeProp, facegen.archFace). Si manana se recalibra el look, esto lo
//  hereda solo — que es la misma regla que sigue prototipo/bolas-vivas.html.
//
//  UN SOLO CONTEXTO WebGL, y compartido: Chromium tira los contextos viejos pasados ~16, y el
//  fondo vivo de la Home ya gasta uno. El renderer se crea la PRIMERA vez que se abre una ficha y
//  a partir de ahi su lienzo se MUEVE de hueco en hueco (solo hay una ficha abierta a la vez).
//  Cuando se abre una partida el shell llama a stop(): dos contextos vivos tumban un movil.
// ============================================================================
import * as THREE from 'three';
import { makeBallVinyl, sat } from '../motor/chassis/gfx.mjs';
import { archLook } from '../motor/chassis/ballmat.mjs';
import { archFace } from '../motor/chassis/facegen.mjs';
import { attachSquash } from '../motor/chassis/squash.mjs';

// LA CUENTA, que es lo unico delicado de este fichero: lo que tiene que medir 56 px es LA BOLA,
// no el lienzo. El prop asoma por fuera (el cohete llega a 1.69R), asi que el lienzo va mas ancho
// y la camara se abre lo justo para que quepa algo de prop. Con un lienzo de 56 y la camara a
// +-1.35R la bola salia a 41 px: la etiqueta habria estado mintiendo, que es justo el fallo que
// esta pantalla viene a arreglar.
const BOLA = 56;                     // px CSS de la BOLA en carrera (el tamano real de pista)
const H = 1.36;                      // semiancho de la camara, en radios de bola
const LADO = Math.round(BOLA * H);   // px CSS del lienzo -> bola = LADO / H = 56 px exactos
const DPR = Math.min(3, (self.devicePixelRatio || 1));
const R = 1.0;
// El rojo canonico de equipo (#E8362F, docs/16). El cuerpo lleva el color del EQUIPO y no el del
// heroe: es la regla que te deja saber cual eres, y es justo la parte de la sorpresa que hay que
// contar ANTES de comprar, no despues.
const TEAM = [0.910, 0.212, 0.184];

let R3 = null, cam = null, host = null, raf = 0, actual = null;

function renderer(){
  if (R3) return R3;
  R3 = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  R3.setPixelRatio(DPR); R3.setSize(LADO, LADO, false);
  R3.domElement.style.cssText = `width:${LADO}px;height:${LADO}px;display:block`;
  cam = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 40);
  cam.position.z = 12;
  return R3;
}

function escena(arch){
  const sc = new THREE.Scene();
  // El 5o parametro (arch) ya le cuelga el PROP y le pone la PIEL: es la misma llamada que hace
  // race/index.html para tu bola. Montarlos aparte aqui habria puesto dos props encima.
  const o = makeBallVinyl(sc, { id: 0, color: TEAM }, R, archLook(arch) || undefined, arch);
  const c = sat(TEAM); o.mat.color.setRGB(c[0], c[1], c[2]);
  // Sin impacto y con vRef alto: aqui la bola esta QUIETA. El squash se engancha igual porque es
  // quien hace tick() de la cara (parpadeo y mirada); sin el seria un muneco de cera.
  attachSquash(o, { R, vRef: 40, impact: 0, tilt: 0, pop: false });
  o.setExpr(archFace(arch, 'neutral'));
  return { sc, o };
}

let esc = null, t0 = 0;
function bucle(ts){
  raf = requestAnimationFrame(bucle);
  if (!esc || !host) return;
  const dt = t0 ? Math.min(0.05, (ts - t0) / 1000) : 0.016; t0 = ts;
  esc.o.sqUpdate(0, 0, dt);      // quieta en el origen: solo respira la cara
  R3.render(esc.sc, cam);
}

// Engancha la vista previa de `arch` dentro de `el`. Llamarlo otra vez con otra bola la cambia.
export function showPista(el, arch){
  if (!el || !arch) return;
  try { renderer(); } catch (e){ return; }          // sin WebGL no hay vista previa, y no pasa nada mas
  if (actual !== arch){ esc = escena(arch); actual = arch; }
  if (host !== el){ el.appendChild(R3.domElement); host = el; }
  if (!raf){ t0 = 0; raf = requestAnimationFrame(bucle); }
}
// La para el shell al cerrar la ficha y al abrir una partida (un contexto WebGL a la vez).
export function stopPista(){ if (raf) cancelAnimationFrame(raf); raf = 0; host = null; }
