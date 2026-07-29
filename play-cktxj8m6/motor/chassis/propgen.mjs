// ============================================================================
//  PROPS DE BOLA-HEROE (doc 41 bloque G) — v2, DIBUJADOS.
//
//  POR QUE SE REESCRIBIO (VB Jaime 2026-07-26, y tenia razon): la v1 pegaba conos y aros de
//  THREE DETRAS de la bola. En la Tienda ves una bola con un casco militar que mola; en pista
//  te salia "una raya horizontal mal puesta por detras". Comprar por una foto y recibir otra
//  cosa es el peor fallo posible: es el que hace que un jugador no vuelva a pagar.
//  REGLA QUE SALE DE AQUI: la foto de la ficha y lo que se ve en pista tienen que estar
//  BALANCEADOS. Si un prop no se puede representar en pista muy cerca de su ficha, o se mejora
//  el gameplay o se empeora la ficha — pero no se entrega el desnivel.
//
//  QUE CAMBIA respecto a la v1, que es todo lo que importaba:
//   1) DIBUJADO, no geometria primitiva. Sprite de canvas con silueta y contorno de tinta, el
//      mismo patron que ya usan las caras (facegen) y los items (itemgen). Reusar el lenguaje
//      del motor, no inventar: los items ya demuestran que a este tamaño se reconoce un objeto
//      DIBUJADO y no se reconoce un cono.
//   2) DELANTE de la esfera (z = 1.04R), no detras. Un casco tiene que apoyarse ENCIMA de la
//      bola; detras solo asoma su borde, que es exactamente la raya que vio Jaime. Va por
//      detras del plano de la cara (1.06R), asi que los ojos siempre ganan.
//   3) COLORES CANONICOS DEL HEROE, no el color del equipo aclarado: casco verde oliva, aletas
//      rojas, puntas doradas. Es lo que hace que la pista se parezca a la ficha. La IDENTIDAD
//      sigue viviendo en la FORMA (se distingue en silueta pura, sin color); el color canonico
//      es lo que ademas la hace reconocible como "mi Bunker".
//
//  CUIDADO CON LA CARA: al dibujarse ENCIMA de la bola, la franja central del lienzo (donde
//  viven los ojos y la boca) se deja LIBRE. Las piezas que en la ficha cruzan el centro (la
//  banda de Pinball, el aro de Yunque) se dibujan solo en los DOS EXTREMOS, como si pasaran por
//  detras de la cara: es el truco de siempre en 2D y aqui no es opcional.
//
//  ZONA PROHIBIDA 1.35R - 1.55R: ahi vive el anillo blanco de "YOU" que marca tu bola (youRing
//  en race/index.html). Una pieza que ACABE en esa banda sale cortada por la punta y parece un
//  bug. O se queda dentro (<= 1.32R, piezas que abrazan) o sale clara (>= 1.60R, las que pinchan).
//
//  Donde se cuelga: del GRUPO de la bola, no del cuerpo. attachSquash escala body y le gira
//  body.rotation.z con el rumbo; al grupo solo le toca el tilt. Asi el prop se ladea con la
//  bola como un personaje pero NI se deforma NI rueda (un casco rodando canta a pegote).
// ============================================================================
import * as THREE from 'three';

const TEX = 256;                 // lienzo del sprite
const SPAN = 3.2;                // el plano mide 3.2R -> 1R = 40 px de textura
const U = TEX / SPAN;            // px por radio de bola
const C = TEX / 2;               // centro
const INK = '#191a26';           // tinta de contorno (familia de los iconos de modo del canal)

// ── helpers: todo lleva contorno de tinta, como los items del motor ──────────────────────────
const P = (x, y) => [C + x * U, C - y * U];        // coords en RADIOS -> px (y hacia arriba)
function ink(x, w = 7){ x.strokeStyle = INK; x.lineWidth = w; x.lineJoin = 'round'; x.lineCap = 'round'; }
function poly(x, pts, fill, w = 7){
  x.beginPath(); pts.forEach((p, i) => { const [px, py] = P(p[0], p[1]); i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.closePath(); ink(x, w); x.stroke(); x.fillStyle = fill; x.fill();
}
function blob(x, cx, cy, r, fill, w = 7){
  const [px, py] = P(cx, cy); x.beginPath(); x.arc(px, py, r * U, 0, 7);
  if (w){ ink(x, w); x.stroke(); } x.fillStyle = fill; x.fill();
}
function ell(x, cx, cy, rx, ry, fill, w = 7){
  const [px, py] = P(cx, cy); x.beginPath(); x.ellipse(px, py, rx * U, ry * U, 0, 0, 7);
  ink(x, w); x.stroke(); x.fillStyle = fill; x.fill();
}
// arco grueso (cascos, bandas, placas): de a0 a a1 en radianes, radio r, grosor th
function arc(x, r, th, a0, a1, fill, w = 7){
  x.beginPath();
  x.arc(C, C, (r + th / 2) * U, -a1, -a0);
  x.arc(C, C, (r - th / 2) * U, -a0, -a1, true);
  x.closePath(); ink(x, w); x.stroke(); x.fillStyle = fill; x.fill();
}
const D = Math.PI / 180;

// ── los 12. Coordenadas en RADIOS de bola: 1 = el borde de la esfera. ────────────────────────
const DRAW = {
  // CASCO MILITAR: la pieza que Jaime aprobo en la ficha. Cupula sobre la coronilla + visera
  // ancha + barboquejo. Se APOYA encima de la bola y deja los ojos libres.
  bunker(x){
    arc(x, 0.92, 0.46, 18 * D, 162 * D, '#5b6b3c');
    poly(x, [[-1.26, 0.46], [1.26, 0.46], [1.14, 0.20], [-1.14, 0.20]], '#48562f');
    poly(x, [[-1.00, 0.30], [-0.84, -0.34], [-0.60, -0.28], [-0.78, 0.34]], '#3b4726', 5);
    blob(x, -0.78, -0.36, 0.13, '#c9a54a', 5);
  },
  // COHETE: morro delante, dos aletas barridas atras, llama corta. Todo FUERA del circulo.
  cohete(x){
    poly(x, [[1.02, 0.30], [1.72, 0.00], [1.02, -0.30]], '#e8352f');
    poly(x, [[-0.72, 0.52], [-1.64, 1.04], [-1.44, 0.30], [-0.84, 0.24]], '#e8352f');
    poly(x, [[-0.72, -0.52], [-1.64, -1.04], [-1.44, -0.30], [-0.84, -0.24]], '#c8241f');
    poly(x, [[-1.04, 0.20], [-1.70, 0.00], [-1.04, -0.20]], '#ffb43d', 5);
  },
  // TANQUE: dos placas remachadas que la abrazan por los lados, sin cruzar la cara.
  tanque(x){
    for (const [a0, a1, f] of [[42, 138, '#3f8f3a'], [222, 318, '#357a31']]) arc(x, 0.96, 0.40, a0 * D, a1 * D, f);
    for (const a of [55, 90, 125, 235, 270, 305]) blob(x, Math.cos(a * D) * 0.96, Math.sin(a * D) * 0.96, 0.10, '#c9a54a', 4);
  },
  // CHISPA: tres rayos en zigzag hacia arriba-derecha. Direccional y dentado.
  chispa(x){
    const bolt = (bx, by, s) => poly(x, [[bx, by], [bx + 0.34 * s, by + 0.30 * s], [bx + 0.14 * s, by + 0.34 * s],
      [bx + 0.52 * s, by + 0.78 * s], [bx + 0.24 * s, by + 0.44 * s], [bx + 0.44 * s, by + 0.40 * s]], '#ffe038', 5);
    bolt(0.78, 0.52, 1.0); bolt(1.10, 0.02, 0.95); bolt(0.30, 0.94, 0.85);
  },
  // PINBALL: banda blanca de bola de billar, solo en los DOS EXTREMOS: por el centro "pasa por
  // detras" de la cara, que es lo que permite tener banda sin taparle los ojos.
  pinball(x){
    for (const [a0, a1] of [[-42, 42], [138, 222]]) arc(x, 0.88, 0.34, a0 * D, a1 * D, '#f2f0ff', 6);
    blob(x, 1.16, 0, 0.17, '#ffffff', 5);
  },
  // LAPA: faldon de ventosa debajo, con nervios. Lee "pegada al suelo".
  lapa(x){
    ell(x, 0, -0.86, 1.20, 0.40, '#e07a12');
    ell(x, 0, -0.80, 0.86, 0.24, '#ff9d2e', 5);
    for (const dx of [-0.62, -0.21, 0.21, 0.62]) poly(x, [[dx - 0.06, -0.66], [dx + 0.06, -0.66], [dx + 0.05, -1.06], [dx - 0.05, -1.06]], '#b85f0c', 3);
  },
  // BURBUJA: satelites fuera del circulo + brillo. Nada encima de la cara.
  burbuja(x){
    blob(x, -1.30, 1.06, 0.34, '#8ef0ff', 5); blob(x, 1.38, 0.74, 0.24, '#b6f6ff', 5);
    blob(x, 1.00, -1.20, 0.18, '#8ef0ff', 4);
    blob(x, -1.38, 1.16, 0.10, '#ffffff', 0);
  },
  // METEORO: cascotes que suelta por detras + dos crateres en la propia bola (arriba, lejos de
  // los ojos), que es lo que la hace roca y no bola lisa.
  meteoro(x){
    for (const [cx, cy, r, f] of [[-1.34, 0.44, 0.28, '#5a5560'], [-1.70, -0.24, 0.20, '#4a4550'],
      [-1.26, -0.84, 0.15, '#6a6470'], [-0.88, 1.10, 0.18, '#5a5560']])
      poly(x, [[cx - r, cy], [cx - r * 0.4, cy + r], [cx + r * 0.6, cy + r * 0.8], [cx + r, cy - r * 0.3], [cx, cy - r]], f, 5);
    x.globalAlpha = 0.9;
    blob(x, -0.42, 0.64, 0.20, '#3c3844', 4); blob(x, 0.46, 0.72, 0.14, '#3c3844', 4);
    x.globalAlpha = 1;
  },
  // VOLCAN: boca de crater en la coronilla + penacho de humo. Lo unico que crece en columna.
  volcan(x){
    ell(x, 0, 0.80, 0.40, 0.17, '#ff5a14');
    for (const [cx, cy, r] of [[0.06, 1.18, 0.30], [-0.10, 1.60, 0.24], [0.10, 1.96, 0.18]]) blob(x, cx, cy, r, '#6b6470', 5);
    blob(x, -0.30, 1.02, 0.11, '#ffb43d', 4); blob(x, 0.34, 1.10, 0.09, '#ff7a1f', 4);
  },
  // YUNQUE: dos cuernos gordos horizontales + banda de hierro solo en los extremos.
  yunque(x){
    poly(x, [[0.94, 0.34], [1.76, 0.12], [1.76, -0.12], [0.94, -0.34]], '#6c7486');
    poly(x, [[-0.94, 0.34], [-1.76, 0.12], [-1.76, -0.12], [-0.94, -0.34]], '#5a6070');
    for (const [a0, a1] of [[-30, -10], [190, 210]]) arc(x, 0.90, 0.34, a0 * D, a1 * D, '#7d869a');
  },
  // FANTASMA: cola de ectoplasma que se deshace hacia abajo.
  fantasma(x){
    // JIRONES redondeados que se van deshaciendo, no un cono solido (parecia una pantalla de lampara).
    x.globalAlpha = 0.92;
    for (const [cx, cy, r] of [[-0.34, -0.92, 0.42], [0.34, -1.02, 0.34], [-0.06, -1.42, 0.26], [0.30, -1.62, 0.17]])
      blob(x, cx, cy, r, '#cbb9ff', 5);
    x.globalAlpha = 1;
  },
  // ESTRELLA: la estrella EN RELIEVE sobre la bola. NO es una silueta de estrella.
  //
  //+AG 27-jul, arreglo de paridad ficha/pista. La version anterior sacaba las cinco puntas a
  //  1.78R —casi el doble del radio— y eso no decoraba la bola: la SUSTITUIA. En pista dejabas
  //  de tener una bola y pasabas a tener una estrella, mientras la Tienda te habia vendido una
  //  esfera de oro. Y no era una interpretacion discutible: el encargo 06 (arte/codex) cierra
  //  por escrito "Estrella ES una esfera con la estrella en relieve, se descarta el hero de
  //  cinco puntas". El motor se escribio 23 minutos ANTES que esa decision y nadie lo reconcilio.
  //  Ahora la estrella vive DENTRO del circulo (puntas a 0.90R) -> la silueta se lee redonda a
  //  56 px, que es la prueba que importa, y el detalle de estrella se ve al mirar el cuerpo.
  //  Va en oro canonico sobre el color de equipo, como el resto de props.
  estrella(x){
    const pts = [];
    for (let i = 0; i < 10; i++){
      const a = 90 * D + i * 36 * D, r = i % 2 === 0 ? 0.90 : 0.40;   // 5 puntas + 5 valles
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    poly(x, pts, '#ffd23f', 6);
    // destellos FUERA pero CORTOS (<=1.32R): fuera de la banda prohibida 1.35-1.55R del anillo YOU
    blob(x, -1.14, 1.04, 0.11, '#fff2b0', 0); blob(x, 1.08, -1.16, 0.08, '#fff2b0', 0);
  },
};

export const PROP_KEYS = Object.keys(DRAW);

//+AG 27-jul · v3: LOS PROPS YA NO SE DIBUJAN, SE PINTAN (encargos 13/15/16).
//  Por que cambia: los DRAW de arriba son dibujos de canvas hechos a mano, siluetas planas con
//  contorno de tinta. Se defienden solos, pero la FICHA que el jugador compra es render pintado,
//  y puestos uno al lado del otro no son la misma familia. Jaime lo dijo sin rodeos: "lo de la
//  tienda no se corresponde ni de blas con lo que aparece in game". Comprar una foto y recibir
//  otra cosa es el peor fallo que puede tener un juego que cobra.
//  Las 12 piezas nuevas vienen de Codex, validadas con tools/integrar-props.py (alfa, esfera
//  pintada, pupilas, banda del anillo YOU, corte por el borde, peso de tinta, candado de color y
//  separacion de siluetas a 56 px).
//
//  Los DRAW se CONSERVAN a proposito, no son codigo muerto: son el respaldo si una imagen no
//  carga (red caida, fichero que no se copio en un despliegue). Un prop es identidad de la bola;
//  quedarse sin el en silencio es peor que verlo dibujado.
//
//  La ruta se resuelve contra import.meta.url y no contra la pagina: los tres modos viven en
//  motor/<modo>/index.html pero la pagina de previsualizacion cuelga de otro sitio, y con una
//  ruta relativa a la pagina cada una necesitaria la suya.
const ART = k => new URL(`../../arte/props/prop-${k}.webp`, import.meta.url).href;

const cache = new Map();
function dibujada(arch){                 // el respaldo: la version de canvas de siempre
  const c = document.createElement('canvas'); c.width = c.height = TEX;
  DRAW[arch](c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
function texture(arch){
  let t = cache.get(arch);
  if (!t){
    // La textura se devuelve YA, vacia, y se rellena sola cuando llega la imagen (asi el prop no
    // bloquea el arranque de la partida). Si falla la carga, se cae al dibujo de canvas.
    t = new THREE.TextureLoader().load(ART(arch), undefined, undefined, () => {
      console.warn(`[propgen] no cargo el prop pintado de ${arch}; se usa el dibujado`);
      const f = dibujada(arch);
      t.image = f.image; t.needsUpdate = true;
    });
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    cache.set(arch, t);
  }
  return t;
}

// Sprite del prop del arquetipo, o null si no lo conoce.
// El 3er parametro (color de equipo) ya NO se usa: los props llevan los colores canonicos del
// heroe, que es lo que hace que la pista se parezca a su ficha. Se conserva en la firma para no
// tocar las 3 llamadas de los modos.
// ── COLOCACION por bola (doc 51) ─────────────────────────────────────────────────────────────
// POR QUE HACE FALTA: el encuadre esta HORNEADO en el WebP que pinta Codex, asi que si una pieza
// cae mal sobre la cara no hay forma de arreglarlo sin repintarla... salvo mover el plano entero.
// Medido con la formula del guardia de tools/integrar-props.py (mitad baja del ojo, la de la
// pupila): Estrella tapaba el 100% de las pupilas y Cohete el 14% — y el 14% de Cohete era justo
// el trozo que hacia que su morro se leyera como un PICO de pajaro saliendo del ojo derecho.
//
// dx/dy van en RADIOS de bola, k es escala. Lo que no aparece aqui no se mueve.
// ⚠ Esto es un PARCHE de encuadre, no la solucion: las dos piezas estan pedidas a Codex en el
// encargo 19 con la composicion de su ficha (Cohete sin morro delantero — en la ficha la BOLA es
// el morro —, y Estrella como chapa mas pequeña y baja). Cuando lleguen, estas dos filas se van.
const PLACE = {
  cohete:   { dx: 0.34, dy: -0.24, k: 0.94 },
  estrella: { dx: 0.00, dy: -0.54, k: 0.58 },   // barrido de escala/altura: la unica pareja que baja
};
export function makeProp(arch, R, _col){
  if (!DRAW[arch]) return null;
  const mat = new THREE.MeshBasicMaterial({ map: texture(arch), transparent: true, depthWrite: false, toneMapped: false });
  const p = PLACE[arch] || { dx: 0, dy: 0, k: 1 };
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(R * SPAN * p.k, R * SPAN * p.k), mat);
  plane.position.set(R * p.dx, R * p.dy, R * 1.04);   // delante de la esfera, detras del plano de la cara (1.06R)
  plane.renderOrder = 2;                 // la cara va en 3: los ojos siempre ganan
  const g = new THREE.Group(); g.add(plane);
  return g;
}
