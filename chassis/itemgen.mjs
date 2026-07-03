// YouBall · ATLAS DE ÍTEMS (WebGL) — port de generator/items_atlas.py (docs/16 §3.A).
// Cada ítem tiene SILUETA + ICONO blanco + halo de color, para que se RECONOZCA al instante
// (feedback dueño: "ahora solo es una luz, no se sabe qué es"). Se pega como sprite plano.
//   Cazador: dash (rayo) · swap (flechas). Race: turbo/giant/relay/star. Suelo: grow.
import * as THREE from 'three';

const TEX = 512, BW = 26, WHITE = '#ffffff';
const COLS = {
  turbo: [25, 217, 242], giant: [255, 128, 25], relay: [154, 64, 242], star: [255, 210, 63],
  dash: [38, 210, 245], swap: [45, 221, 106], grow: [255, 196, 60], boost: [255, 38, 204],
  invert: [240, 70, 200],   // Cazador: "Caza Marcada" = redirige el objetivo a un rival (magenta, distinto de dash/swap)
  bumper: [150, 162, 198],   // acero (no es color de equipo ni naranja): OBSTÁCULO que rebota
  gem: [38, 220, 245], mega: [60, 232, 255],   // Recolecta: botín = diamante talla brillante cian
};
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const dark = (c, k = 0.5) => `rgb(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0})`;

function ell(x, box, fill, outline, w){
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, rx = (box[2] - box[0]) / 2, ry = (box[3] - box[1]) / 2;
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  if (fill){ x.fillStyle = fill; x.fill(); } if (outline){ x.strokeStyle = outline; x.lineWidth = w; x.stroke(); }
}
function rr(x, box, r, fill, outline, w){
  x.beginPath(); x.roundRect(box[0], box[1], box[2] - box[0], box[3] - box[1], r);
  if (fill){ x.fillStyle = fill; x.fill(); } if (outline){ x.strokeStyle = outline; x.lineWidth = w; x.stroke(); }
}
function polyf(x, pts, fill){ x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); x.fillStyle = fill; x.fill(); }
function pline(x, pts, color, w){ x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); x.strokeStyle = color; x.lineWidth = w; x.lineJoin = 'round'; x.stroke(); }
function line(x, pts, color, w){ x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.strokeStyle = color; x.lineWidth = w; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); }
function arrow(x, p0, p1, color, w, head){ line(x, [p0, p1], color, w); const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  for (const s of [0.5, -0.5]) line(x, [p1, [p1[0] - head * Math.cos(a + s), p1[1] - head * Math.sin(a + s)]], color, w); }
function hexPts(cx, cy, r){ return [-90, -30, 30, 90, 150, 210].map(a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]); }
function starPts(cx, cy, ro, ri){ const p = []; for (let i = 0; i < 5; i++){ const ao = (-90 + i * 72) * Math.PI / 180, ai = (-90 + i * 72 + 36) * Math.PI / 180;
  p.push([cx + ro * Math.cos(ao), cy + ro * Math.sin(ao)]); p.push([cx + ri * Math.cos(ai), cy + ri * Math.sin(ai)]); } return p; }
function orbBase(x, c, glow){ const box = [96, 96, 416, 416]; if (glow){ ell(x, box, rgb(c)); return false; } ell(x, box, dark(c), rgb(c), BW); return true; }

const DRAW = {
  dash(x, c, glow){ if (!orbBase(x, c, glow)) return;                       // RAYO = velocidad/escape
    polyf(x, [[292, 116], [186, 278], [250, 278], [214, 396], [334, 230], [268, 230]], WHITE); },
  swap(x, c, glow){ if (!orbBase(x, c, glow)) return;                       // FLECHAS opuestas = pasa el objetivo
    line(x, [[178, 214], [330, 214]], WHITE, 24); polyf(x, [[358, 214], [322, 188], [322, 240]], WHITE);
    line(x, [[334, 298], [182, 298]], WHITE, 24); polyf(x, [[154, 298], [190, 272], [190, 324]], WHITE); },
  invert(x, c, glow){ if (!orbBase(x, c, glow)) return;                     // DIANA + flecha = redirige el objetivo a un rival
    ell(x, [188, 188, 324, 324], null, WHITE, 16);                          // anillo de mira
    ell(x, [240, 240, 272, 272], WHITE);                                    // centro
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) line(x, [[256 + dx * 92, 256 + dy * 92], [256 + dx * 116, 256 + dy * 116]], WHITE, 14);   // ticks de mira
    arrow(x, [114, 114], [208, 208], WHITE, 22, 40); },                     // flecha que entra hacia la diana (redirige)
  grow(x, c, glow){ if (!orbBase(x, c, glow)) return;                       // 4 flechas = crecer
    for (const [sx, sy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]){ const u = 0.7071;
      arrow(x, [256 + sx * u * 40, 256 + sy * u * 40], [256 + sx * u * 122, 256 + sy * u * 122], WHITE, 22, 34); } },
  turbo(x, c, glow){ const box = [96, 96, 416, 416]; if (glow){ rr(x, box, 64, rgb(c)); return; }   // doble chevron >>
    rr(x, box, 64, dark(c), rgb(c), BW); for (const dx of [0, 78]) line(x, [[150 + dx, 178], [250 + dx, 256], [150 + dx, 334]], WHITE, 40); },
  giant(x, c, glow){ const pts = hexPts(256, 256, 172); if (glow){ polyf(x, pts, rgb(c)); return; }  // hexágono + expandir
    polyf(x, pts, dark(c)); pline(x, pts, rgb(c), BW);
    for (const [sx, sy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]){ const u = 0.7071;
      arrow(x, [256 + sx * u * 46, 256 + sy * u * 46], [256 + sx * u * 120, 256 + sy * u * 120], WHITE, 20, 34); } },
  relay(x, c, glow){ const pts = [[256, 82], [430, 256], [256, 430], [82, 256]]; if (glow){ polyf(x, pts, rgb(c)); return; }  // rombo + 3 puntos
    polyf(x, pts, dark(c)); pline(x, pts, rgb(c), BW); const mates = [[168, 174], [344, 338]];
    for (const [mx, my] of mates) line(x, [[256, 256], [mx, my]], WHITE, 13);
    ell(x, [238, 238, 274, 274], WHITE); for (const [mx, my] of mates) ell(x, [mx - 17, my - 17, mx + 17, my + 17], dark(c), WHITE, 10); },
  star(x, c, glow){ const pts = starPts(256, 256, 178, 80); if (glow){ polyf(x, pts, rgb(c)); return; }  // estrella = invencible
    polyf(x, pts, rgb(c)); pline(x, pts, 'rgb(255,246,207)', 10); },
  boost(x, c, glow){ const box = [110, 96, 402, 416]; if (glow){ rr(x, box, 54, rgb(c)); return; }  // rampa: 3 chevrones ABAJO = acelera a meta
    rr(x, box, 54, dark(c), rgb(c), BW); for (const y of [150, 236, 322]) line(x, [[168, y], [256, y + 66], [344, y]], WHITE, 34); },
  bumper(x, c, glow){ if (!orbBase(x, c, glow)) return;   // ondas de choque concéntricas = REBOTA (obstáculo de pinball)
    ell(x, [232, 232, 280, 280], WHITE);                  // centro
    for (const box of [[196, 196, 316, 316], [160, 160, 352, 352]]){ x.beginPath();
      x.ellipse((box[0]+box[2])/2, (box[1]+box[3])/2, (box[2]-box[0])/2, (box[3]-box[1])/2, 0, 0, Math.PI*2);
      x.strokeStyle = WHITE; x.lineWidth = 16; x.stroke(); } },
  // DIAMANTE talla brillante (mesa plana + hombros + punta + facetas) — legible a tamaño pequeño (docs/21 §16)
  gem(x, c, glow){ diamond(x, c, glow); },
  mega(x, c, glow){ diamond(x, c, glow, 0.86, 40);        // diamante + 2 pips = vale 2 (los pips = el valor real)
    if (!glow){ for (const px of [222, 290]) ell(x, [px - 19, 84, px + 19, 124], 'rgb(255,255,255)'); } },
};

// diamante centrado, talla brillante. dy = baja la figura para dejar sitio a los pips del mega.
function diamond(x, c, glow, s = 1, dy = 0){
  const mid = (a, b, t) => a + (b - a) * t;
  const base = [[206, 150], [306, 150], [380, 208], [256, 402], [132, 208]];
  const pts = base.map(p => [256 + (p[0] - 256) * s, dy + 256 + (p[1] - 256) * s]);
  if (glow){ polyf(x, pts, rgb(c)); return; }
  polyf(x, pts, dark(c, 0.42)); pline(x, pts, rgb(c), BW);
  const fc = 'rgb(225,250,255)';
  const tl = pts[0], tr = pts[1], gr = pts[2], pt = pts[3], gl = pts[4];
  const tc = [mid(tl[0], tr[0], 0.5), tl[1]], gc = [256, gl[1]];
  line(x, [gl, gr], fc, 9);                       // girdle horizontal
  line(x, [tl, gc, tr], fc, 9);                   // chevron de corona a la mesa-centro
  line(x, [tc, pt], fc, 9);                        // eje vertical a la punta
  line(x, [gl, pt], fc, 6); line(x, [gr, pt], fc, 6);  // facetas del pabellón
  ell(x, [tc[0] - 26, tl[1] - 4, tc[0] + 26, tl[1] + 14], 'rgba(255,255,255,0.85)'); // brillo de mesa
}

const cache = new Map();
function build(name){
  const c = document.createElement('canvas'); c.width = c.height = TEX; const x = c.getContext('2d');
  const gc = document.createElement('canvas'); gc.width = gc.height = TEX; const gx = gc.getContext('2d');
  DRAW[name](gx, COLS[name], true);                                          // halo: silueta sólida desenfocada
  x.save(); x.filter = 'blur(34px)'; x.globalAlpha = 0.55; x.drawImage(gc, 0, 0); x.restore();
  DRAW[name](x, COLS[name], false);                                          // detalle: silueta + icono encima
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
export function itemTexture(name){ let t = cache.get(name); if (!t){ t = build(name); cache.set(name, t); } return t; }
export function itemColor(name){ const c = COLS[name] || [255, 255, 255]; return [c[0] / 255, c[1] / 255, c[2] / 255]; }
export const ITEMS = Object.keys(COLS);
