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
//+AG 01-ago · LA CARTA DE CAPAS. Dice que accesorios tienen capa animable (-fx) o emisiva (-em)
//   instalada. La escribe tools/partir-props.py mirando la carpeta del arte, y por eso vive ALLI y
//   no aqui: quien fabrica esas capas es esa herramienta, asi que la lista se actualiza sola en el
//   mismo gesto en el que se instala el arte. Ver arte/props/capas.mjs para el por que largo.
import { CAPAS_PROP } from '../../arte/props/capas.mjs?v=a8591c0';

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
//+AG 2-ago-2026 · EL SELLO `?v=` TAMBIEN AQUI. Sin el, el accesorio nuevo NO LLEGA. Jaime abrio el
//   juego en su movil y su Pinball seguia siendo las dos manchitas blancas del prop viejo, meses
//   despues de que entrara el sombrero. Medido ese dia contra produccion, pidiendo el MISMO fichero
//   de dos maneras desde la propia pagina:
//       fetch('arte/props/prop-pinball.webp')  -> 9494 bytes, last-modified 28-jul, age=352528 (4 dias)
//       new Image().src = (lo mismo)           -> el sombrero, 512x512, marron de y=31 a y=193
//   O sea: la CDN de Hostinger guarda DOS copias del mismo fichero y sirve la vieja segun como se
//   pida. Con `max-age=604800` eso dura una semana, y el navegador que ya la tenga, otra mas.
//   Es el mismo agujero que documentan las monedas en juego.html (busca "EL `?v=N` DE LAS MONEDAS"),
//   solo que alli se tapo y aqui no, porque los props no se piden desde el HTML sino desde aqui.
//   REGLA: si sustituyes el .webp de un prop YA DESPLEGADO, sube este numero. Uno solo vale para las
//   tres capas — se despliegan juntas y no merece la pena llevarles la cuenta por separado.
//   v3 -> v7 el 3-ago: el prop de Pinball cambio tres veces en un dia (sombrero de vaquero ->
//   bumper central -> dos en la coronilla -> cascos laterales -> cascos con el MODELO LISO).
//   Fichero sustituido =
//   numero nuevo, o produccion seguiria sirviendo el anterior una semana.
//   v7 -> v8 el 3-ago: las dos mascaras emisivas (pinball y volcan) pasan a llevar ALFA. Es
//   sustitucion de fichero ya desplegado, asi que sin subir esto la CDN seguiria sirviendo la
//   version sin alfa y el cuadrado negro seguiria ahi una semana mas.
const PROP_V = '?v=8';
//
//  La ruta se resuelve contra import.meta.url y no contra la pagina: los tres modos viven en
//  motor/<modo>/index.html pero la pagina de previsualizacion cuelga de otro sitio, y con una
//  ruta relativa a la pagina cada una necesitaria la suya.
const ART = k => new URL(`../../arte/props/prop-${k}.webp${PROP_V}`, import.meta.url).href;
//+AG doc 55: la capa que se MUEVE, si la hay. La escribe tools/partir-props.py separando las islas
//   del alfa de la pieza entregada; no es arte nuevo, es la misma pieza partida en dos.
const ART_FX = k => new URL(`../../arte/props/prop-${k}-fx.webp${PROP_V}`, import.meta.url).href;
//+AG doc 55 capa 2: lo que se ENCIENDE. Es la misma pieza BLANCA, con lo caliente marcado en el
//   ALFA, y se pinta como un plano ADITIVO encima: donde el alfa es cero no suma nada, donde es
//   opaco ilumina. Se hace con un plano y no con el shader del cuerpo a proposito — lo que brilla
//   es el ACCESORIO (el aro de Pinball, la veta del Mago), no la bola, y el cuerpo lleva el color
//   del equipo, que no se puede tocar.
//   ⚠⚠ LA MASCARA TIENE QUE LLEVAR ALFA, Y ESTO NO ES UNA PREFERENCIA DE FORMATO (3-ago-2026).
//   Nacio en gris SIN alfa —negro lo apagado, blanco lo caliente— y eso pintaba UN CUADRADO NEGRO
//   alrededor de la bola en los menus. Jaime, mirando su portada: «cuando la bola pinball salta,
//   aparece un cuadro oscuro alrededor de ella». El motivo, medido: `AdditiveBlending` en three es
//   (SrcAlpha, One) y eso se aplica TAMBIEN al canal alfa, o sea `A_out = A_src² + A_dst`. Con la
//   mascara sin alfa, el 98% negro del lienzo traia A_src=1: no sumaba NI UNA LUZ, pero SI sumaba
//   alfa. Y el lienzo de las bolas vivas de los menus es transparente (`vivas.mjs`, alpha:true),
//   asi que ese alfa de mas se compone sobre la pagina como NEGRO — un cuadrado del tamaño del
//   plano (3.2R = el 69% de la celda) latiendo al ritmo de `emHz`. En partida no se veia porque
//   alli el fondo de la escena ya es opaco.
//   Con el alfa puesto la LUZ ES LA MISMA (antes rgb=L y A=1 -> suma L·op; ahora rgb=1 y A=L ->
//   suma L·op, identico) y el cuadrado desaparece porque fuera del aro A_src ya es 0.
//   Medido en `#hBall` sobre fondo plano: de 2..10 sobre 128 de oscurecimiento a 0.
const ART_EM = k => new URL(`../../arte/props/prop-${k}-em.webp${PROP_V}`, import.meta.url).href;

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
//+AG 31-jul: ESTOS NUMEROS LOS PUSO JAIME A MANO, uno a uno, con prototipo/ajuste-props.html.
//   Los mios estaban mal por una razon que merece quedar escrita: yo colocaba cada pieza mirando
//   a los OJOS (que no los tapara) en vez de mirar a la CABEZA (donde se apoya), y por eso todos
//   los gorros salian calados hasta las cejas. Su correccion: «tienes que detectar cual es la BASE
//   del gorro y ajustarla con el TOP de la cabeza; en el aviador es mas complicado porque las
//   orejeras no van encima de la cabeza, van en las orejas».
//   Si se repinta una pieza, hay que volver a pasarla por la herramienta: estos numeros son de
//   ESTE dibujo, no del personaje.
const PLACE = {
  cohete:   { dx: 0.00, dy: -0.60, k: 1.49 },   // el casco del Aviador, mucho mas grande
  tanque:   { dx: 0.00, dy:  0.00, k: 1.00 },
  chispa:   { dx: 0.00, dy:  0.04, k: 1.00 },
  //+AG LOS DOS CASCOS (3-ago). Compuestos ya a su tamano final, asi que aqui 1.00 y 0.00.
  //   Van a los LADOS porque es lo que pidio Jaime: «seria como unos cascos, como unos auriculares,
  //   como un Walkman... lo tiene en los laterales y por eso rebota mas, parecido al tanque». Yo
  //   habia suspendido dos rondas de conceptos justo por «parecer auriculares»: ESA ERA LA IDEA.
  //   Y el MODELO es el del concepto D (cupula lisa + aro + tornillo), no el del 37: la falda
  //   acanalada de aquel, puesta de lado, «parece una concha mas que unos auriculares».
  pinball:  { dx: 0.00, dy: 0.00, k: 1.00 },
  lapa:     { dx: 0.00, dy:  0.02, k: 1.00, rot: 180, pivY: 0.896 },   // EL IMAN: girado 180 EN SU SITIO
  burbuja:  { dx: 0.00, dy:  0.00, k: 1.00 },
  meteoro:  { dx: 0.00, dy:  0.20, k: 1.00 },
  bunker:   { dx: 0.00, dy: -0.44, k: 1.57 },
  volcan:   { dx: 0.00, dy:  0.37, k: 1.08 },
  //+AG EL ESPARTANO, reencajado (Jaime, 31-jul: «se ha quedado un poco desencajado, hay que hacerlo
  //   un poquito mas grande y quizas subirlo un pelin»). Medido el porque: su ala es CONCAVA —una
  //   media luna que curva hacia arriba por las puntas— y la coronilla de la bola es CONVEXA, asi
  //   que a k=1.00 el ala era mas estrecha que la bola y las puntas se quedaban flotando en el aire
  //   con el centro mordiendo. No era cuestion de altura: era de ANCHO. A k=1.25 la cuerda del ala
  //   coincide con la de la bola y las puntas aterrizan en los hombros. Ganan 0.29R de altura de
  //   propina, que es el «subirlo un pelin».
  yunque:   { dx: 0.00, dy:  0.22, k: 1.25 },
  fantasma: { dx: 0.00, dy:  0.00, k: 1.00 },   // provisional: el CUERPO pasa a ser el fantasma
  estrella: { dx: 0.00, dy:  0.10, k: 1.12 },
};
//+AG el plano de la capa nace INVISIBLE y solo se enciende cuando la imagen carga de verdad: si no
//   hay capa, no hay hueco y no hay animacion — la pieza entera se mueve en su lugar. Es la misma
//   cautela que ya tiene la base, que se cae al dibujo de canvas si su webp falla.
//
//+AG 01-ago · PERO NO SE PIDE A CIEGAS. Antes se pedian las dos capas de cualquier bola con tabla y
//   se aguantaba el 404 en silencio. Como solo 6 de los 12 accesorios tienen alguna, cada bola viva
//   soltaba hasta 2 peticiones fallidas EN PRODUCCION (verificado con Cohete: -fx y -em, 404 las
//   dos, en cada carga). No rompia nada, y ese es justo el problema: un fallo inofensivo que se
//   repite llena la consola de rojo y ESCONDE los 404 de verdad entre el ruido — al auditar costo
//   separarlos de los del reto de Cloudflare. Ahora se mira la carta primero.
const tieneCapa = (arch, cual) => !!(CAPAS_PROP[arch] && CAPAS_PROP[arch][cual]);
const cacheCapa = new Map();
function textureCapa(arch, cual, onOk){
  const clave = cual + ':' + arch;
  if (cacheCapa.has(clave)){ const t = cacheCapa.get(clave); if (t && t.image) onOk(); return t; }
  const url = cual === 'em' ? ART_EM(arch) : ART_FX(arch);
  // El fallo ya NO es silencioso: con la carta delante, que una capa declarada no cargue significa
  // que la carta miente (arte borrado, despliegue a medias) y eso hay que verlo, no tragarselo.
  const t = new THREE.TextureLoader().load(url, () => onOk(), undefined,
    () => console.warn(`[propgen] ${arch} declara capa "${cual}" en arte/props/capas.mjs pero no carga: ${url}`));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  cacheCapa.set(clave, t);
  return t;
}

// ── PROP_FX · el accesorio SE MUEVE (doc 55, capa 3) ─────────────────────────────────────────
// POR QUE: hasta ahora el prop era UN sprite muerto pegado a la bola. Un accesorio que se mueve se
// entiende el doble — Jaime, sobre las chispas: «esas chispas se animan y entiendes que es el
// chisposo». La identidad no la da solo la forma: la da el GESTO.
//
// ES LA MISMA MECANICA QUE LA CARA, a proposito: tabla declarativa + interprete de ocho lineas,
// calcado de FACE_FX en gfx.mjs. Aqui no se inventa un sistema nuevo, se copia el que ya lleva
// meses funcionando (y que ya sobrevivio al pase de la cara de heroe).
//
// DOS CAPAS COMO MUCHO, y por un motivo medido: la textura entregada es UNA (512 px), y
// tools/partir-props.py la parte en `base` (lo quieto) y `fx` (lo que se mueve) leyendo las islas
// del alfa. Mas capas no es mas bonito: son mas draw calls sobre la unica bola que lleva arch.
//
// Canales (amplitudes en RADIOS de bola, frecuencias en ciclos/s):
//   bob    · sube y baja            · el sombrero que respira
//   sway   · se balancea (rotacion) · el penacho que ondea
//   blink  · parpadeo de opacidad   · las chispas que chispean
//   pulse  · late de tamaño         · la joya
//   kick   · SALTA con el impacto   · el sombrero del Vaquero al rebotar
//   drag   · se retrasa con la velocidad · lo que ondea hacia atras al correr
// `phase` desfasa el canal para que dos bolas iguales no vayan sincronizadas.
const SIN_PROP = new Set(['fantasma']);
const PROP_FX = {
  // Lo que hoy tiene isla aprovechable en el alfa ya puede animarse; el resto entra con el
  // encargo 21b (Codex pinta lo movil como isla suelta con hilo de aire).
  //+AG CHISPA ya no lleva accesorio: su personaje lo cuenta el AURA (ver makeAura). El canal
  //   `chispeo` que se escribio para hacer parpadear sus rayos murio con ellos, y se ha quitado:
  //   un canal que no usa nadie es una promesa de que algo se anima cuando no se anima nada.
  burbuja: { fx: { bob: 0.05, bobHz: 0.9, pulse: 0.06, pulseHz: 1.3, pulseBase: 0.05, pulseBaseHz: 0.8 } },
  meteoro: { fx: { sway: 0.05, swayHz: 0.8, drag: 0.06 } },
  //+AG EL IMAN: las dos chispas entre las puntas PARPADEAN, y pegan un chispazo cuando la partida
  //   dice que ha pasado algo. Su rol es AGA 9 —«se agarra y no se suelta»— asi que el gesto tiene
  //   que leerse como magnetismo, no como decoracion.
  lapa:    { fx: { blink: 0.75, blinkHz: 4.2, pulse: 0.08, pulseHz: 3.0, flash: '*', phase: 0.9 } },
  //+AG volcan es la casilla de EL MAGO (doc 54): su rol es encadenar boosts (BST 9 + rasgo), asi
  //   que su accesorio destella con el boost. El personaje cuenta su rol jugando.
  volcan:  { fx: { bob: 0.04, bobHz: 1.1, pulse: 0.05, pulseHz: 2.2, flash: 'nitro' } },
  //+AG FANTASMA YA NO LLEVA PROP. Su cuerpo ES el fantasma (chassis/silueta.mjs, doc 55 capa 1):
  //   los jirones colgando de una esfera se leian como una barba — «hay que cambiar la bola entera,
  //   tiene que ser un cuerpo entero» (Jaime, 31-jul). Un faldon ADEMAS del cuerpo seria el mismo
  //   error dos veces.
  // Los que necesitan el arte del 21 para tener capa (aqui documentados, sin efecto hasta
  // entonces): pinball -> el sombrero del Vaquero salta al rebotar (kick).
  //+AG PINBALL, ya con su BUMPER (encargo 37, 3-ago). El bumper BOTA en cada golpe —su rol es el
  //   caos y los rebotes (doc 54)— y respira despacio: eso ya estaba y sigue igual, son canales de
  //   pieza entera. Lo nuevo es el `flash: 'bump'`: el ARO SE ENCIENDE cuando la bola rebota de
  //   verdad, no cada dos segundos porque toque. `bump` es el evento que ya emitian las sims de
  //   Carrera y Cazador al chocar contra un bumper de pista, y estaba sin usar; Luz Roja no tiene
  //   bumpers y ahi simplemente no llega ninguno. Es el unico heroe cuyo gesto responde a la
  //   MECANICA que le da nombre: rebotas, se enciende.
  //   `emBase` sube de 0.18 a 0.34 por una razon medida, no por gusto: corrida la sim de Carrera en
  //   ocho semillas, TU bola choca contra un bumper 1,3 veces por partida de media, y en 2 de las 8
  //   ninguna. Si el aro solo viviera del evento, el heroe cuyo nombre es Pinball pasaria partidas
  //   enteras con el accesorio apagado. Asi el aro esta encendido de base —como el de una mesa de
  //   verdad— y el rebote es el PICO, no la unica vez que se ve.
  pinball: { fx: { kick: 0.14, bob: 0.022, bobHz: 0.9, flash: 'bump', emBase: 0.34, emHz: 1.3 } },
  //+AG EL REY: la corona se balancea muy poco — es una corona, no un gorro de fiesta.
  estrella: { fx: { sway: 0.035, swayHz: 0.7, bob: 0.014, bobHz: 1.1, phase: 0.4 } },
  //+AG EL AVIADOR: el casco acusa el golpe. Poco: pesa.
  cohete:  { fx: { kick: 0.07, bob: 0.012, bobHz: 1.3, phase: 1.1 } },
  //+AG las TRES QUE SEGUIAN QUIETAS. Jaime las caza a la primera, y con razon: doce accesorios de
  //   los que nueve se mueven y tres no parece un fallo, no una decision. Cada gesto sale de su ROL
  //   en el codigo (doc 54), no de lo que quedaba bonito.
  //   EL ESPARTANO: «se planta y no se mueve» (PES 10). Lo unico que se mueve en el es EL PENACHO,
  //   que ondea despacio — el doc 54 se lo prometia y era el unico incumplido. El penacho es capa
  //   suelta desde hoy (partir-props lo corta por 0.645R: por islas no salia, venia fundido).
  yunque:  { fx: { sway: 0.055, swayHz: 0.9, phase: 0.3 } },
  //+AG EL SOLDADO: «sobrevive a todo» (RES 9). El casco se le HUNDE con el golpe y vuelve a subir
  //   (kick negativo = hacia abajo), que es el gag de toda la vida del casco tapando los ojos.
  //   Sin capa suelta: son canales de pieza entera, no hace falta repintar nada.
  bunker:  { fx: { kick: -0.10, bob: 0.012, bobHz: 1.0, phase: 1.6 } },
  //+AG EL BLINDADO: «empuja y aguanta» (PES 9). Las placas ACUSAN el impacto y se cimbrean un poco
  //   al andar: chapa remachada, no tela. Amplitudes cortas a proposito — si se moviera mucho
  //   dejaria de parecer acero.
  tanque:  { fx: { kick: 0.075, sway: 0.022, swayHz: 1.4, phase: 2.2 } },
};
const TAU = 6.28318;

//+AG `rot` (grados) en PLACE: girar la pieza sin repintarla. Nace con el Iman, que llego con la
//   herradura boca abajo — «tienes que darle la vuelta 180 grados porque no tiene sentido». Un
//   giro es un numero; pedir un repintado por eso seria una vuelta de arte entera para nada.
function plano(tex, R, p, z, orden){
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R * SPAN * p.k, R * SPAN * p.k), mat);
  m.position.set(R * p.dx, R * p.dy, z);
  //+AG la rotacion es sobre el centro del PLANO, que es el centro de la BOLA — no el de la pieza.
  //   Girar 180 una pieza que vive en la coronilla la manda al menton. `pivY` (en radios) dice
  //   donde esta el centro de la pieza para poder devolverla a su sitio despues de girar.
  if (p.rot){
    m.rotation.z = p.rot * Math.PI / 180;
    if (p.pivY){
      const a = p.rot * Math.PI / 180;
      m.position.y += R * p.pivY * (1 - Math.cos(a));
      m.position.x += R * p.pivY * Math.sin(a);
    }
  }
  m.renderOrder = orden;
  return m;
}

// ── AURA · lo que RODEA a la bola (doc 55, capa 4) ───────────────────────────────────────────
// POR QUE NO ES UN ACCESORIO MAS. Chispa llevaba tres rayos de comic clavados en la coronilla, y el
// mayor ni se movia. Jaime, con una referencia delante: «prefiero que la bola tenga como
// electricidad alrededor de ella... entiende que poner tres pelos ahi arriba y uno estatico no es
// electricidad». No es una pieza que se lleva puesta: es un ANILLO que rodea a la bola entera. Y
// encaja solo con la regla de los 360 grados — un anillo no apunta a ningun sitio.
//
// COMO SE ANIMA, y por que asi. Un atlas de N dibujos que se van turnando, que es lo que hace la
// animacion 2D de toda la vida: cuesta UN plano y UNA textura, sale exacto y solo lo lleva TU bola.
// NO se interpola entre fotogramas a proposito: la electricidad SALTA, no se funde. Y el fotograma
// no va en orden — se elige con el mismo hash determinista que `chispeo`, o al cuarto ciclo el ojo
// caza el bucle. `hz` es a que ritmo cambia; `salto` cuanto se apaga entre chispazo y chispazo.
const ART_AURA = k => new URL(`../../arte/props/aura-${k}.webp${PROP_V}`, import.meta.url).href;
const AURA = {
  chispa: { cols: 3, filas: 2, n: 6, hz: 15, k: 1.0, apagones: 0.22 },
};
const auraCache = new Map();
function auraTexture(arch){
  let t = auraCache.get(arch);
  if (!t){
    t = new THREE.TextureLoader().load(ART_AURA(arch), undefined, undefined,
      () => console.warn(`[propgen] no cargo el aura de ${arch}`));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    auraCache.set(arch, t);
  }
  return t;
}
function makeAura(arch, R){
  const A = AURA[arch];
  if (!A) return null;
  const g = new THREE.Group();
  // cada bola necesita SU clone: el offset del atlas vive en la textura, y con una compartida las
  // doce bolas de la pagina de previsualizacion pintarian todas el mismo fotograma.
  const tex = auraTexture(arch).clone();
  tex.needsUpdate = true;
  tex.repeat.set(1 / A.cols, 1 / A.filas);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
                                            toneMapped: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R * SPAN * A.k, R * SPAN * A.k), mat);
  m.position.set(0, 0, R * 1.03);   // delante del cuerpo, DETRAS de la cara (que va a 1.06R)
  m.renderOrder = 2;
  g.add(m);
  let t = 0, ult = -1;
  const pon = i => {
    const c = i % A.cols, f = Math.floor(i / A.cols);
    tex.offset.set(c / A.cols, 1 - (f + 1) / A.filas);
  };
  pon(0);
  g.userData.tick = dt => {
    t += dt;
    const paso = Math.floor(t * A.hz);
    if (paso === ult) return;
    ult = paso;
    const x = Math.sin(paso * 127.1 + 311.7) * 43758.5453;
    const r = x - Math.floor(x);
    // un respiro de vez en cuando: sin apagones la bola parece envuelta en una bombilla fija
    if (r < A.apagones){ mat.opacity = 0; return; }
    mat.opacity = 1;
    pon(Math.floor((r - A.apagones) / (1 - A.apagones) * A.n) % A.n);
  };
  return g;
}

export function makeProp(arch, R, _col){
  //+AG doc 55 capa 4: si la bola tiene AURA, la electricidad ES su accesorio. No se le pone ademas
  //   una pieza en la cabeza: seria contar el personaje dos veces, que es el error que ya se cometio
  //   con el Fantasma. Entra por esta misma puerta para no tocar squash ni gfx: el que llama sigue
  //   recibiendo un grupo con `userData.tick`, y le da igual lo que lleve dentro.
  const au = makeAura(arch, R);
  if (au) return au;
  //+AG las bolas cuyo CUERPO ya cuenta el personaje (silueta.mjs) no llevan accesorio: seria
  //   contarlo dos veces. Hoy es solo el Fantasma.
  if (SIN_PROP.has(arch)) return null;
  if (!DRAW[arch]) return null;
  const p = PLACE[arch] || { dx: 0, dy: 0, k: 1 };
  const g = new THREE.Group();
  // La BASE: exactamente el mismo plano de siempre, en el mismo sitio. Si esta bola no tiene capa
  // animable, aqui se acaba todo y el resultado es identico al de antes del doc 55.
  const base = plano(texture(arch), R, p, R * 1.04, 2);
  g.add(base);

  const cfg = PROP_FX[arch];
  if (!cfg) return g;                     // sin tabla no hay nada que animar: el prop de siempre

  // La capa FX va un pelo por delante de la base pero SIGUE detras de la cara (1.06R): los ojos
  // ganan siempre. La camara es ortografica, asi que la z no cambia el tamaño; lo que ordena el
  // dibujo es el renderOrder.
  //+AG los planos se construyen ANTES de pedir la textura a proposito: si ya esta en cache,
  //   textureCapa llama al callback en el acto, y una `const` a medio declarar reventaria por zona
  //   muerta temporal. Con el plano ya creado, encenderlo es seguro venga cuando venga.
  //+AG el plano se crea AUNQUE no haya capa: el tick lee `fx.visible`, `fx.position` y `fx.scale` en
  //   media docena de sitios, y quitarlo obligaria a sembrar el bucle de comprobaciones. Lo que se
  //   ahorra es la PETICION, que es lo que costaba un 404. Un plano invisible no se dibuja.
  const fx = plano(null, R, p, R * 1.045, 2);
  fx.visible = false;                     // se enciende sola si la capa existe (ver textureCapa)
  if (tieneCapa(arch, 'fx'))
    fx.material.map = textureCapa(arch, 'fx', () => { fx.visible = true; fx.material.needsUpdate = true; });
  g.add(fx);

  // La capa EMISIVA: aditiva, y arranca apagada. Late suave siempre y PEGA UN DESTELLO con el
  // evento del heroe (el Mago al usar boost). Va delante de la fx y sigue detras de la cara.
  const em = plano(null, R, p, R * 1.05, 2);
  em.visible = false;
  em.material.blending = THREE.AdditiveBlending;
  em.material.depthWrite = false;
  em.material.opacity = 0;
  if (tieneCapa(arch, 'em'))
    em.material.map = textureCapa(arch, 'em', () => { em.visible = true; em.material.needsUpdate = true; });
  g.add(em);

  //+AG QUE SE MUEVE: la pieza ENTERA o solo su capa suelta.
  //   Los canales de pieza entera (bob, kick, sway, drag) se aplican al GRUPO del prop, asi que
  //   funcionan aunque la pieza NO este partida — el sombrero del Vaquero puede botar sin que
  //   nadie tenga que repintarlo con una isla suelta. Los canales de capa (blink, pulse) solo
  //   tienen sentido sobre `fx`, que puede no existir.
  //   El grupo es seguro: squash escribe en el grupo de la BOLA, no en este.
  const F = cfg.fx, ph = F.phase || 0;
  //   Cada nodo recuerda SU sitio de partida: el del grupo es (0,0), pero el de la capa fx lleva
  //   el desplazamiento de PLACE horneado, y perderlo la mandaria al centro de la bola.
  const g0 = { x: g.position.x, y: g.position.y };
  const fx0 = { x: fx.position.x, y: fx.position.y };
  let t = ph, salto = 0;
  //+AG el tick lo llama chassis/squash.mjs una vez por frame, con el dt del reloj de render del
  //   modo. `k` = velocidad normalizada 0..1 · `kick` = golpe de ESTE frame (0 si no hubo).
  //+AG doc 55 capa 5: el accesorio REACCIONA a lo que pasa en la partida. Es lo que convierte un
  //   adorno en identidad: el sombrero del Mago destella JUSTO cuando usas boost, o sea que el
  //   personaje cuenta su rol jugando (su BST 9 es lo que lo define, doc 54). Lo llama el modo
  //   desde donde ya traduce la cola de eventos de la Sim; si nadie llama, no pasa nada.
  let chispazo = 0;
  g.userData.evento = tipo => { if (F.flash && (F.flash === tipo || F.flash === '*')) chispazo = 1; };
  g.userData.tick = (dt, k, kick) => {
    t += dt;
    if (chispazo > 0){ chispazo = Math.max(0, chispazo - dt * 2.2); }   // ~0.45 s de destello
    if (kick > 0) salto = Math.max(salto, kick);
    salto *= Math.max(0, 1 - dt * 6);                    // el salto se deshincha en ~0.17 s
    let dy = 0, dx = 0;
    if (F.bob)   dy += F.bob * R * Math.sin(t * (F.bobHz || 1) * TAU);
    if (F.kick)  dy += F.kick * R * salto;
    if (F.drag)  dx -= F.drag * R * (k || 0);            // se retrasa al correr, como una capa
    const mueveTodo = F.todo || !fx.visible;             // sin capa suelta, se mueve la pieza entera
    const q = mueveTodo ? g : fx, o0 = mueveTodo ? g0 : fx0;
    q.position.x = o0.x + dx;
    q.position.y = o0.y + dy;
    if (F.sway)  q.rotation.z = F.sway * Math.sin(t * (F.swayHz || 1) * TAU + 0.6);
    const brinco = chispazo > 0 ? Math.sin(chispazo * Math.PI) : 0;    // sube y baja, no un corte seco
    if (F.pulse) fx.scale.setScalar(1 + F.pulse * Math.sin(t * (F.pulseHz || 1) * TAU + 1.1));
    //+AG `pulseBase` late la capa BASE, no la suelta. Nace de la Burbuja: el reparto por islas deja
    //   la burbuja MAS GRANDE en la base (es la mancha mayor), asi que era la unica que no respiraba
    //   —«hay una burbuja que no cambia de tamaño, la más grande, está como atachada»—. Va con su
    //   propia frecuencia y desfasada: si latieran a la vez pareceria un zoom, no burbujas sueltas.
    if (F.pulseBase) base.scale.setScalar(1 + F.pulseBase * Math.sin(t * (F.pulseBaseHz || 1) * TAU + 2.4));
    if (F.blink) fx.material.opacity = 1 - F.blink * 0.5 * (1 + Math.sin(t * (F.blinkHz || 1) * TAU));
    //+AG lo que se enciende: un latido flojo de fondo (que la pieza este VIVA aunque no pase nada)
    //   y el destello del evento por encima. `emBase` deja regular cuanto alumbra en reposo.
    if (em.visible){
      const latido = (F.emBase || 0.18) * (0.75 + 0.25 * Math.sin(t * (F.emHz || 1.6) * TAU));
      em.material.opacity = Math.min(1, latido + brinco * 0.95);
      em.scale.setScalar(1 + brinco * 0.10);
    }
  };
  return g;
}
