// ============================================================================
//  PROPS DE BOLA-HEROE (doc 41 bloque G, 2a tajada).
//
//  El material ya hace que tu bola se vea DISTINTA de las otras (1a tajada). Lo que no hace es
//  que se reconozca COMO Volcan: a 56 px, que es el tamaño real en un movil, quien manda es la
//  SILUETA. Esto le pone a la bola del jugador una pieza que le rompe el contorno.
//
//  DONDE SE CUELGA, y por que importa: del GRUPO de la bola (o.g), no del cuerpo (o.body).
//  attachSquash escala o.body (squash & stretch) y le gira o.body.rotation.z con el rumbo; al
//  grupo solo le toca el TILT. Colgando de o.g, el prop se ladea con la bola como un personaje
//  pero NI se deforma NI rueda — un casco que rodase seria justo lo que delata que es pegote.
//
//  COLOR: el color de la bola ACLARADO. Ni acero (#96a2c6 esta reservado a los bumpers en el
//  lenguaje del motor), ni oscuro (se lo tragan las arenas oscuras). Aclarar el propio color
//  mantiene la pieza cohesionada con la bola y la hace legible sobre cualquier fondo.
//
//  Z: por detras del plano de la cara (que vive en z=1.06R), asi que un prop NUNCA tapa la cara.
//  La camara es cenital ortografica: la silueta se juega en X-Y, por eso todos los props salen
//  hacia fuera EN EL PLANO, no hacia camara (ahi no se verian).
//
//  ZONA PROHIBIDA 1.35R - 1.55R: ahi vive el anillo blanco de "YOU" que marca tu bola (youRing en
//  race/index.html). Un prop que ACABE dentro de esa banda sale cortado justo por la punta y parece
//  un fallo. Regla: o se queda por dentro (<= 1.32R, piezas que abrazan) o sale claramente por fuera
//  (>= 1.60R, piezas que pinchan). Nunca a medias.
// ============================================================================
import * as THREE from 'three';

const flat = (col, k = 1.35) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(Math.min(1, col[0] * k), Math.min(1, col[1] * k), Math.min(1, col[2] * k)),
});
const dark = (col) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(col[0] * 0.42, col[1] * 0.42, col[2] * 0.46),
});

// helpers: piezas planas orientadas al plano X-Y (la camara es cenital)
function tri(mat, w, h){ const g = new THREE.ConeGeometry(w, h, 3); const m = new THREE.Mesh(g, mat); m.rotation.x = Math.PI / 2; return m; }
function disc(mat, r, seg = 24){ const m = new THREE.Mesh(new THREE.CircleGeometry(r, seg), mat); return m; }
function ring(mat, r, tube){ const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28), mat); return m; }
function bar(mat, w, h){ return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); }

// Cada builder recibe (R, colorClaro, colorOscuro) y devuelve las piezas ya colocadas.
// Regla de diseño: la pieza tiene que SALIRSE del circulo (>= R) o no rompe silueta y no sirve.
const BUILD = {
  // ALARGADO EN HORIZONTAL y simetrico: morro delante, dos aletas atras. El eje es lo que lo separa
  // de Chispa, que es un abanico diagonal (medido: eran el unico par de siluetas que se confundia).
  cohete(R, A, D, g){
    for (const s of [-1, 1]){ const f = tri(A, R * 0.52, R * 1.30); f.position.set(-R * 1.06, s * R * 0.70, 0); f.rotation.z = s * -0.35 - Math.PI / 2; g.add(f); }   // llega a ~1.71R: cruza limpio la banda del anillo
    const n = tri(A, R * 0.46, R * 1.05); n.position.set(R * 1.14, 0, 0); n.rotation.z = -Math.PI / 2; g.add(n);
    const t = bar(D, R * 0.55, R * 0.62); t.position.set(-R * 1.18, 0, -0.01); g.add(t);
  },
  // dos placas curvas que la abrazan por los lados, con remaches
  tanque(R, A, D, g){
    for (const s of [-1, 1]){
      const p = new THREE.Mesh(new THREE.RingGeometry(R * 0.92, R * 1.30, 20, 1, s > 0 ? 0.5 : Math.PI + 0.5, 2.15), A);
      g.add(p);
      for (let i = -1; i <= 1; i++){ const r = disc(D, R * 0.11, 10); const a = (s > 0 ? 1.55 : Math.PI + 1.55) + i * 0.62; r.position.set(Math.cos(a) * R * 1.11, Math.sin(a) * R * 1.11, 0.01); g.add(r); }
    }
  },
  // ABANICO DIAGONAL de puntas finas hacia arriba-derecha: direccional y dentado, un eje que no usa
  // nadie mas (Estrella es simetrica de 5, Volcan sube en columna redonda).
  chispa(R, A, D, g){
    for (const a of [0.42, 0.78, 1.14, 1.50]){
      const len = 1.35 - Math.abs(a - 0.96) * 0.5;
      const t = tri(A, R * 0.20, R * len);
      t.position.set(Math.cos(a) * R * (0.55 + len / 2), Math.sin(a) * R * (0.55 + len / 2), 0);
      t.rotation.z = a - Math.PI / 2; g.add(t);
    }
  },
  // banda ecuatorial gorda: un aro es lo mas reconocible a tamaño pequeño
  pinball(R, A, D, g){ const b = ring(A, R * 1.06, R * 0.17); g.add(b); },
  // faldon de ventosa: disco ancho y bajo, "pegada al suelo"
  lapa(R, A, D, g){
    const d = disc(D, R * 1.34, 28); d.scale.set(1, 0.42, 1); d.position.set(0, -R * 0.72, -0.01); g.add(d);
    const d2 = disc(A, R * 1.06, 24); d2.scale.set(1, 0.34, 1); d2.position.set(0, -R * 0.70, 0.01); g.add(d2);
  },
  // burbujitas satelite
  burbuja(R, A, D, g){
    for (const [x, y, r] of [[-1.18, 1.10, 0.30], [1.28, 0.78, 0.22], [0.90, -1.22, 0.17]]){
      const b = disc(A, R * r, 16); b.position.set(x * R, y * R, 0); g.add(b);
    }
  },
  // escombros detras: no es contorno liso, es una roca que va soltando cascotes
  meteoro(R, A, D, g){
    for (const [x, y, r] of [[-1.20, 0.34, 0.26], [-1.52, -0.30, 0.18], [-1.05, -0.72, 0.13]]){
      const b = new THREE.Mesh(new THREE.CircleGeometry(R * r, 6), D); b.position.set(x * R, y * R, 0); g.add(b);
    }
    for (const [x, y, r] of [[-0.86, 0.90, 0.20], [-0.98, -0.95, 0.15]]){
      const b = new THREE.Mesh(new THREE.CircleGeometry(R * r, 6), A); b.position.set(x * R, y * R, 0); g.add(b);
    }
  },
  // casco: cupula que le cubre la coronilla (deja la cara entera libre)
  bunker(R, A, D, g){
    const c = new THREE.Mesh(new THREE.RingGeometry(R * 0.80, R * 1.24, 26, 1, 0.30, Math.PI - 0.60), D); g.add(c);
    const v = bar(A, R * 2.28, R * 0.22); v.position.set(0, R * 0.72, 0.01); g.add(v);
  },
  // penacho de humo: columna de bolas que sube. Es el unico que crece hacia ARRIBA en columna.
  volcan(R, A, D, g){
    for (const [y, r] of [[1.16, 0.36], [1.62, 0.28], [2.02, 0.20]]){
      const b = disc(D, R * r, 14); b.position.set(R * (y - 1.16) * 0.28, y * R, 0); g.add(b);
    }
    const boca = disc(A, R * 0.40, 16); boca.position.set(0, R * 0.86, 0); g.add(boca);
  },
  // cuernos de yunque: dos puntas gordas horizontales (aro = Pinball, cuernos = Yunque)
  yunque(R, A, D, g){
    for (const s of [-1, 1]){ const h = tri(D, R * 0.52, R * 0.90); h.position.set(s * R * 1.16, 0, 0); h.rotation.z = s * -Math.PI / 2; g.add(h); }
    const b = bar(A, R * 2.5, R * 0.20); g.add(b);
  },
  // cola de ectoplasma: jirones que se deshacen hacia abajo
  fantasma(R, A, D, g){
    for (const [x, y, r] of [[-0.42, -1.06, 0.34], [0.30, -1.24, 0.26], [-0.10, -1.56, 0.18]]){
      const b = disc(A, R * r, 14); b.position.set(x * R, y * R, 0); g.add(b);
    }
  },
  // cinco puntas simetricas: la silueta de estrella, que no la tiene nadie mas
  estrella(R, A, D, g){
    for (let i = 0; i < 5; i++){ const a = Math.PI / 2 + i * (Math.PI * 2 / 5);
      const t = tri(A, R * 0.46, R * 1.30); t.position.set(Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12, 0); t.rotation.z = a - Math.PI / 2; g.add(t); }   // ~1.77R: antes moria en 1.54R, justo dentro del anillo
  },
};

export const PROP_KEYS = Object.keys(BUILD);

// Devuelve un THREE.Group con el prop del arquetipo, o null si no lo conoce.
// col = [r,g,b] 0..1 del EQUIPO (el mismo que usa la bola): el prop es su color aclarado.
export function makeProp(arch, R, col){
  const build = BUILD[arch]; if (!build) return null;
  const g = new THREE.Group();
  build(R, flat(col), dark(col), g);
  g.position.z = -R * 0.05;    // justo detras del ecuador: nunca por delante del plano de la cara
  g.renderOrder = -1;
  return g;
}
