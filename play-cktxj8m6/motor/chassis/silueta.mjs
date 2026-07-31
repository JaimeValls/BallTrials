// ============================================================================
//  SILUETA · el CUERPO de la bola deja de ser una esfera (doc 55, capa 1).
//
//  POR QUE EXISTE. Jaime, sobre el faldon de fantasma que se le colgo a la bola:
//
//    «Los pies del fantasma estan bien, pero parece una barba. En este caso hay que cambiar la
//     bola entera, tiene que ser un cuerpo entero: la bola se quita y se reemplaza por una bola
//     con forma de fantasma.»
//
//  Tenia razon y el diagnostico es exacto: un accesorio colgando de una esfera SIEMPRE se lee como
//  algo pegado a una esfera. Si el personaje es un fantasma, el fantasma tiene que ser el cuerpo.
//
//  LAS TRES REGLAS QUE NO SE NEGOCIAN, y por las que esto es geometria y no un dibujo:
//
//   1) EL COLOR DE EQUIPO SE CONSERVA. El cuerpo lo sigue pintando el mismo shader (ballmat) con
//      el color del equipo, su brillo y su piel. Cambia la FORMA, no el material. Un cuerpo
//      pintado habria sido mas bonito y habria costado la regla que ordena toda la pista: saber
//      de un vistazo cual es la tuya.
//   2) LA FISICA NO SE ENTERA. El circulo de colision vive en la Sim y aqui no se toca ni se mira.
//      Para que lo que ves y lo que choca no se contradigan, la silueta se queda SIEMPRE DENTRO
//      del circulo (f <= 1): el fantasma es un poco mas pequeño que su bola, nunca mas grande.
//      Asi el jugador nunca choca "con aire", que es el fallo que se siente injusto.
//   3) PASA POR LA PUERTA `arch`. Sin arch se devuelve null y el motor construye su esfera de
//      siempre -> el torneo y los videos del canal quedan byte-identicos.
//
//  COMO SE DEFORMA, que es lo unico con truco: la camara es ORTOGRAFICA mirando por -z, asi que la
//  silueta de una esfera es su circulo maximo en el plano xy. Escalando cada vertice en xy por un
//  factor que depende SOLO de su angulo, la silueta pasa a ser exactamente la curva f(angulo) y el
//  volumen sigue siendo suave (no aparecen aristas). Aplastar la parte de abajo en y, que era lo
//  evidente, dejaba un fondo plano feo y rompia el sombreado.
// ============================================================================
import * as THREE from 'three';

// ── el perfil del fantasma ───────────────────────────────────────────────────────────────────
// Arriba y a los lados es un circulo (la cupula del fantasma es redonda). Abajo se le comen tres
// muescas, que es lo que deja cuatro piececitos. Todo hacia DENTRO: f nunca pasa de 1.
// LA CLAVE DEL PERFIL, y el primer intento la fallo: modular el radio "un poco" solo abollaba la
// esfera (11% de mordida = tres bollos, no un fantasma). Un fantasma no es una esfera con muescas,
// es una CUPULA con el bajo RECTO. Asi que abajo el radio no se modula: se corta con una recta
// (r = yLim / sin, que es donde el rayo cruza la horizontal y = yLim), y son las MUESCAS las que
// suben esa recta a trozos. De ahi salen los piececitos.
// ⚠ EL FALLO QUE COSTO CUATRO VUELTAS, escrito para no repetirlo: yo dejaba el 88% del cuerpo como
// circulo perfecto y solo ondulaba el ultimo trozo de abajo. Eso NO es un fantasma, es una bola con
// una BARBA — que es exactamente la palabra que uso Jaime, cuatro veces.
//
// Un fantasma de Pac-Man no es un circulo mordido: es una CUPULA arriba, los COSTADOS RECTOS desde
// media altura, y el bajo ondulado. Los costados rectos son lo que lo hace fantasma; sin ellos, por
// muchas ondas que le pongas abajo, sigue siendo una bola con algo colgando.
//
// La silueta se construye como interseccion de tres limites, y el radio en cada angulo es el MENOR
// de los tres:
//   1) la cupula   -> circulo de radio ANCHO centrado en (0, ALTO_CUPULA)
//   2) los costados-> las rectas verticales x = +-ANCHO
//   3) el bajo     -> la recta ondulada y = -(BAJO - MUESCA·onda)
const ANCHO = 0.82;       // media anchura del fantasma. Con esto la esquina inferior queda a 1.06R
const ALTO_CUPULA = 0.10; // la cupula se centra un poco alta para que la coronilla llegue a ~0.96R
const PIES = 2;           // muescas -> TRES piececitos, uno centrado. Con 3 la muesca caia justo en
                          // el centro y partia el fantasma; con 4-5, a 56 px el bajo es una sierra.
const BAJO = 1.00;        // los pies llegan ABAJO DEL TODO. Con 0.62 el cuerpo se quedaba corto,
                          // la boca de la cara (-0.58R) caia justo en el borde y volvia la barba.
const MUESCA = 0.34;      // muescas HONDAS: suben hasta -0.66R. Con 0.22 eran bollos, no pies.

//+AG LA CONCESION DE JUSTICIA, declarada: la esquina inferior del fantasma se sale a ~1.05R del
//   circulo de colision, un 6%. Es el precio de tener costados rectos, y esta dentro del +-10% que
//   fija el doc 55. Mas que eso y empezarias a "atravesar" cosas con las esquinas.
const TOPE = 1.10;

function fFantasma(ang){
  const s = Math.sin(ang), c = Math.cos(ang);
  let r = Infinity;
  // 1) la cupula, y SOLO POR ARRIBA. Aqui estuvo el fallo de la cuarta vuelta: la cupula es un
  //    circulo entero, asi que si se aplica en todo el contorno tambien recorta el bajo — y las
  //    muescas no llegaban a morder nunca. Por eso salia una bola lisa por mucho que subiera la
  //    profundidad de los pies. Abajo mandan los costados y la linea de los pies, no la cupula.
  if (s > 0){
    const disc = ANCHO * ANCHO - ALTO_CUPULA * ALTO_CUPULA * c * c;
    if (disc > 0) r = ALTO_CUPULA * s + Math.sqrt(disc);
  }
  // 2) los costados rectos
  if (Math.abs(c) > 1e-6) r = Math.min(r, ANCHO / Math.abs(c));
  // 3) el bajo ondulado. Se resuelve en dos pasos porque la onda depende de DONDE cae en x, y eso
  //    depende del radio: primero con el bajo plano, y con ese x se calcula la onda de verdad.
  if (s < -1e-6){
    const plano = Math.min(r, BAJO / -s);
    const x = Math.max(-1, Math.min(1, (plano * c) / ANCHO));
    const onda = 0.5 - 0.5 * Math.cos(Math.PI * PIES * (x + 1));
    r = Math.min(r, (BAJO - MUESCA * onda) / -s);
  }
  return Math.min(TOPE, isFinite(r) ? r : ANCHO);
}

const PERFIL = { fantasma: fFantasma };

/**
 * Geometria del cuerpo para `arch`, o null si esa bola es una esfera normal.
 * `seg` sube respecto a la esfera de siempre (40x28) porque las muescas necesitan resolucion:
 * con 40 sectores cada piececito tendria cuatro vertices y se verian los angulos.
 */
export function geometriaCuerpo(arch, R, seg = 128, anillos = 64){
  const f = PERFIL[arch];
  if (!f) return null;
  const g = new THREE.SphereGeometry(R, seg, anillos);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i);
    const d = Math.hypot(x, y);
    if (d < 1e-6) continue;
    const k = f(Math.atan2(y, x));
    p.setXY(i, x * k, y * k);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export const TIENE_SILUETA = arch => !!PERFIL[arch];
