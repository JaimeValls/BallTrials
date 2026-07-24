// YouBall · ATLAS DE CARAS (WebGL) — port 1:1 de generator/eyes_atlas.py (docs/14 §7.1).
// Dibuja cada EXPRESION con Canvas2D (mismos 5 mandos: forma de ojo, pupila, cejas, boca,
// simbolos) sobre fondo TRANSPARENTE y la devuelve como THREE.CanvasTexture cacheada, para
// pegarla como sprite plano en el frente de la bola. NUNCA entra al bloom ([[no-glow-over-faces]]).
//   PRESETS = 13 caras de bola · HUNTER_PRESETS = 4 caras del depredador.
import * as THREE from 'three';

const TEX = 256;              // tamaño de textura
const SS = 2;                 // supersampling (lo baja el filtro de la GPU)

// --- paleta (idéntica a eyes_atlas.py) ---
const WHITE = '#ffffff';
const PUP = 'rgb(10,8,14)';        // pupila casi negra
const INK = 'rgb(12,10,16)';       // trazo casi negro
const BLUE = 'rgb(120,205,255)';
const RED = 'rgb(235,48,48)';
const PINK = 'rgb(255,74,122)';
const CHEEK = 'rgba(255,120,158,0.72)';   // v2 kawaii: más saturado y opaco
const YEL = 'rgb(255,212,44)';
const STARC = 'rgb(255,226,90)';
const IRIS_HI = 'rgb(70,55,90)';   // v2 kawaii: iris vidrioso (morado-tinta claro arriba)
const IRIS_LO = 'rgb(14,11,20)';   // casi negro abajo → la pupila sigue leyéndose oscura sobre cualquier color de equipo

// --- métricas base en espacio 256 (se escalan por f=size/256) ---
// v2 KAWAII (2026-06-27): ojos más grandes y juntos, pupila enorme (~75% del ojo), boca más baja → cara de bebé.
const EX = 41, EYE_CY = 118, RX = 41, RY = 50, PUPR = 33, MCY = 200;

// ── primitivas (equivalentes a ImageDraw) ───────────────────────────────────
function ell(x, cx, cy, rx, ry, fill, stroke, sw){
  x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill){ x.fillStyle = fill; x.fill(); }
  if (stroke){ x.strokeStyle = stroke; x.lineWidth = sw; x.stroke(); }
}
function arc(x, box, a0, a1, color, sw){ // box=[x0,y0,x1,y1], ángulos en grados (Pillow=horario, y abajo)
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, rx = (box[2] - box[0]) / 2, ry = (box[3] - box[1]) / 2;
  x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0 * Math.PI / 180, a1 * Math.PI / 180, false);
  x.strokeStyle = color; x.lineWidth = sw; x.lineCap = 'round'; x.stroke();
}
function pie(x, box, a0, a1, fill){
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, rx = (box[2] - box[0]) / 2, ry = (box[3] - box[1]) / 2;
  x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, a0 * Math.PI / 180, a1 * Math.PI / 180, false);
  x.lineTo(cx, cy); x.closePath(); x.fillStyle = fill; x.fill();
}
function thick(x, pts, w, color){
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = color; x.stroke();
}
function poly(x, pts, fill){
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath(); x.fillStyle = fill; x.fill();
}
function rrect(x, box, r, fill){
  x.beginPath(); x.roundRect(box[0], box[1], box[2] - box[0], box[3] - box[1], r);
  x.fillStyle = fill; x.fill();
}

// ── adornos ──────────────────────────────────────────────────────────────────
function sparkPts(cx, cy, r){
  return [[cx, cy - r], [cx + r * 0.26, cy - r * 0.26], [cx + r, cy], [cx + r * 0.26, cy + r * 0.26],
          [cx, cy + r], [cx - r * 0.26, cy + r * 0.26], [cx - r, cy], [cx - r * 0.26, cy - r * 0.26]];
}
function sparkle(x, cx, cy, r, color){ poly(x, sparkPts(cx, cy, r * 1.32), INK); poly(x, sparkPts(cx, cy, r), color); }
function starPts(cx, cy, ro){
  const p = [];
  for (let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? ro : ro * 0.45;
    p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  return p;
}
function star5(x, cx, cy, ro, color){ poly(x, starPts(cx, cy, ro * 1.18), INK); poly(x, starPts(cx, cy, ro), color); }
function heartBody(x, cx, cy, r, color){
  ell(x, cx - r / 2, cy - r * 0.45, r / 2, r * 0.55, color);
  ell(x, cx + r / 2, cy - r * 0.45, r / 2, r * 0.55, color);
  poly(x, [[cx - r * 0.96, cy - r * 0.15], [cx + r * 0.96, cy - r * 0.15], [cx, cy + r * 1.15]], color);
}
function heart(x, cx, cy, r, color){ heartBody(x, cx, cy, r * 1.18, INK); heartBody(x, cx, cy, r, color); }
function teardrop(x, cx, cy, r, color){
  ell(x, cx, cy + r * 0.45, r * 1.2, r * 1.05, INK);
  poly(x, [[cx - r * 0.9, cy - r * 0.05], [cx + r * 0.9, cy - r * 0.05], [cx, cy - r * 1.75]], INK);
  ell(x, cx, cy + r * 0.45, r, r * 0.85, color);
  poly(x, [[cx - r * 0.7, cy], [cx + r * 0.7, cy], [cx, cy - r * 1.5]], color);
  ell(x, cx - r * 0.25, cy + r * 0.3, r * 0.2, r * 0.2, 'rgba(255,255,255,0.59)');
}
function spiral(x, cx, cy, r, color, w){
  const pts = []; const turns = 2.3, n = 60;
  for (let i = 0; i <= n; i++){ const t = i / n, a = t * turns * 2 * Math.PI, rr = r * t; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]);
  x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = color; x.stroke();
}

// ── ojos / cejas / boca / símbolos (port de draw_*) ───────────────────────────
// part: 'all' = ojo completo (atlas clasico) · 'white' = solo blanco+contorno (capa eyes del rig)
//       'pup' = solo iris+pupila+brillos SIN gaze (capa pups del rig: el gaze lo aplica el rig moviendo el plano)
function drawEye(x, u, ecx, ecy, side, spec, part = 'all'){
  const shape = (side === 'L' && spec.eye_l) ? spec.eye_l : (side === 'R' && spec.eye_r) ? spec.eye_r : (spec.eye || 'round');
  const rxm = spec.rx ?? 1.0, rym = spec.ry ?? 1.0, pupm = spec.pup ?? 1.0;
  const gx = spec.gaze ? spec.gaze[0] : 0, gy = spec.gaze ? spec.gaze[1] : 0;
  if (shape === 'round' || shape === 'wide' || shape === 'narrow'){
    const rx = u(RX * rxm), ry = u(RY * rym);
    if (part !== 'pup') ell(x, ecx, ecy, rx, ry, WHITE, INK, u(5.0));   // contorno un pelín más fino: el ojo "respira"
    if (part === 'white') return;
    const pr = u(PUPR * pupm);
    const ox = part === 'all' ? u(gx * 9) : 0, oy = part === 'all' ? u(gy * 9) : 0;   // gaze 11→9: pupila gigante no debe salirse del blanco
    const ir = pr * 0.92;                                        // IRIS con degradado vertical (efecto vidrioso/gominola)
    const g = x.createRadialGradient(ecx + ox, ecy + oy - ir * 0.3, ir * 0.15, ecx + ox, ecy + oy, ir);
    g.addColorStop(0, IRIS_HI); g.addColorStop(1, IRIS_LO);
    ell(x, ecx + ox, ecy + oy, ir, ir, g);
    ell(x, ecx + ox, ecy + oy + ir * 0.18, pr * 0.5, pr * 0.5, PUP);   // núcleo de pupila casi negro
    const c = u(PUPR * 0.42 * pupm + 2);                         // BRILLO principal GRANDE (catchlight) = factor ternura nº1
    ell(x, ecx + ox - pr * 0.42, ecy + oy - pr * 0.45, c, c, WHITE);
    const c2 = u(PUPR * 0.20 * pupm + 1);                        // brillo secundario
    ell(x, ecx + ox + pr * 0.40, ecy + oy + pr * 0.42, c2, c2, 'rgba(255,255,255,0.90)');
  } else if (part === 'pup'){                                    // formas sin pupila (blink/happy/x/star...) viven en la capa eyes
    return;
  } else if (shape === 'blink'){
    const rx = u(RX * rxm); arc(x, [ecx - rx, ecy - u(14), ecx + rx, ecy + u(14)], 200, 340, INK, u(7));
  } else if (shape === 'happy'){
    const rx = u(RX * 1.05), ry = u(RY * 0.8); arc(x, [ecx - rx, ecy - ry, ecx + rx, ecy + ry], 20, 160, INK, u(8));
  } else if (shape === 'gt'){
    const rx = u(RX), ry = u(RY * 0.7); thick(x, [[ecx - rx, ecy - ry], [ecx + rx * 0.55, ecy], [ecx - rx, ecy + ry]], u(7), INK);
  } else if (shape === 'lt'){
    const rx = u(RX), ry = u(RY * 0.7); thick(x, [[ecx + rx, ecy - ry], [ecx - rx * 0.55, ecy], [ecx + rx, ecy + ry]], u(7), INK);
  } else if (shape === 'x'){
    const rx = u(RX * 0.85), ry = u(RY * 0.7);
    thick(x, [[ecx - rx, ecy - ry], [ecx + rx, ecy + ry]], u(6.5), INK);
    thick(x, [[ecx + rx, ecy - ry], [ecx - rx, ecy + ry]], u(6.5), INK);
  } else if (shape === 'spiral'){
    spiral(x, ecx, ecy, u(RX * 0.95), INK, u(4.5));
  } else if (shape === 'star'){
    star5(x, ecx, ecy, u(RX * 1.15), STARC);
  } else if (shape === 'heart'){
    heart(x, ecx, ecy + u(2), u(RX * 1.05), PINK);
  }
}
function drawBrow(x, u, ecx, ecy, side, kind){
  if (!kind || kind === 'none') return;
  const rx = u(RX), ry = u(RY), top = ecy - ry - u(8);
  const inn = ecx + (side === 'L' ? rx * 0.7 : -rx * 0.7);
  const out = ecx + (side === 'L' ? -rx : rx);
  if (kind === 'angry') thick(x, [[out, top], [inn, top + u(20)]], u(8), INK);
  else if (kind === 'sad') thick(x, [[out, top + u(20)], [inn, top]], u(8), INK);
  else if (kind === 'up') arc(x, [Math.min(out, inn), top - u(10), Math.max(out, inn), top + u(16)], 200, 340, INK, u(7));
  else if (kind === 'flat') thick(x, [[out, top + u(8)], [inn, top + u(8)]], u(7), INK);
}
function drawMouth(x, u, cx, cy, style){
  if (!style || style === 'none') return;
  const w = u(28);   // v2 kawaii: boca notablemente MÁS PEQUEÑA (la cara cute habla por los ojos)
  if (style === 'smile') arc(x, [cx - w, cy - u(14), cx + w, cy + u(16)], 25, 155, INK, u(7));
  else if (style === 'smirk') arc(x, [cx - w, cy - u(16), cx + w * 0.5, cy + u(14)], 25, 150, INK, u(7));
  else if (style === 'big_smile'){
    pie(x, [cx - w, cy - u(18), cx + w, cy + u(22)], 18, 162, INK);
    pie(x, [cx - w * 0.5, cy + u(4), cx + w * 0.5, cy + u(20)], 20, 160, PINK);   // lengüita rosa
  } else if (style === 'open_o'){ const r = u(13); ell(x, cx, cy, r, r * 1.15, INK); }   // óvalo vertical = bostecito tierno
  else if (style === 'open_big') ell(x, cx, cy + u(2), u(16), u(20), INK);
  else if (style === 'frown') arc(x, [cx - w, cy + u(2), cx + w, cy + u(34)], 200, 340, INK, u(7));
  else if (style === 'grimace'){
    const y0 = cy + u(4);
    thick(x, [[cx - w, y0], [cx - w * 0.5, y0 + u(9)], [cx, y0], [cx + w * 0.5, y0 + u(9)], [cx + w, y0]], u(4.5), INK);
  } else if (style === 'gritted'){
    rrect(x, [cx - w * 0.8, cy - u(9), cx + w * 0.8, cy + u(11)], u(7), INK);
    for (const k of [-0.4, 0.0, 0.4]){ const xx = cx + w * 0.8 * k; thick(x, [[xx, cy - u(9)], [xx, cy + u(11)]], u(2.5), WHITE); }
    thick(x, [[cx - w * 0.8, cy + u(1)], [cx + w * 0.8, cy + u(1)]], u(2.5), WHITE);
  } else if (style === 'neutral') thick(x, [[cx - u(8), cy], [cx + u(8), cy]], u(6), INK);   // raya más corta
  else if (style === 'cat') thick(x, [[cx - w * 0.6, cy + u(4)], [cx - w * 0.15, cy - u(3)], [cx, cy + u(4)], [cx + w * 0.15, cy - u(3)], [cx + w * 0.6, cy + u(4)]], u(5), INK);   // boca "ω" de gatito (kawaii)
  else if (style === 'tiny') ell(x, cx, cy, u(7), u(6), INK);   // boquita diminuta (reposo adorable)
}
function drawSymbols(x, u, S, syms){
  for (const s of syms){
    if (s === 'sweat') teardrop(x, S * 0.74, S * 0.30, u(15), BLUE);
    else if (s === 'tears'){ teardrop(x, S / 2 - u(EX), u(EYE_CY) + u(40), u(11), BLUE); teardrop(x, S / 2 + u(EX), u(EYE_CY) + u(40), u(11), BLUE); }
    else if (s === 'anger'){
      const ax = S * 0.72, ay = S * 0.26;
      for (const dx of [-u(7), u(7)]) thick(x, [[ax + dx, ay - u(9)], [ax + dx, ay + u(9)]], u(3), RED);
      for (const dy of [-u(4), u(4)]) thick(x, [[ax - u(11), ay + dy], [ax + u(11), ay + dy]], u(3), RED);
    } else if (s === 'exclaim'){
      const ax = S / 2, ay = S * 0.13; thick(x, [[ax, ay], [ax, ay + u(20)]], u(6), YEL); ell(x, ax, ay + u(31), u(4), u(4), YEL);
    } else if (s === 'stars'){ sparkle(x, S * 0.78, S * 0.30, u(12), STARC); sparkle(x, S * 0.20, S * 0.24, u(9), STARC); sparkle(x, S * 0.82, S * 0.55, u(7), WHITE); }
    else if (s === 'hearts'){ heart(x, S * 0.80, S * 0.26, u(10), PINK); heart(x, S * 0.19, S * 0.30, u(8), PINK); }
    else if (s === 'sparkle'){ sparkle(x, S * 0.80, S * 0.24, u(10), WHITE); sparkle(x, S * 0.20, S * 0.50, u(7), WHITE); }
  }
}

function newCanvas(){ const c = document.createElement('canvas'); c.width = c.height = TEX * SS; const x = c.getContext('2d'); x.scale(SS, SS); return { c, x }; }

function paintSkin(x, u, S, spec){                 // mofletes + cejas + boca (mobiliario estable de la cara)
  const cx0 = S / 2, lx = cx0 - u(EX), rx = cx0 + u(EX), ey = u(EYE_CY);
  if (spec.cheeks){ ell(x, lx - u(20), ey + u(50), u(19), u(15), CHEEK); ell(x, rx + u(20), ey + u(50), u(19), u(15), CHEEK); }   // v2: mofletes más grandes, rosas y bajos
  drawBrow(x, u, lx, ey, 'L', spec.brow); drawBrow(x, u, rx, ey, 'R', spec.brow);
  drawMouth(x, u, cx0, u(MCY), spec.mouth || 'neutral');
}
function paintEyes(x, u, S, spec, part){
  const cx0 = S / 2, lx = cx0 - u(EX), rx = cx0 + u(EX), ey = u(EYE_CY);
  drawEye(x, u, lx, ey, 'L', spec, part); drawEye(x, u, rx, ey, 'R', spec, part);
}
function drawFace(spec){                           // atlas CLASICO de un solo plano (hunter + modos sin migrar)
  const { c, x } = newCanvas();
  const S = TEX, f = S / 256, u = v => v * f;
  paintSkin(x, u, S, spec);
  paintEyes(x, u, S, spec, 'all');
  drawSymbols(x, u, S, spec.symbols || []);
  return c;
}
// CAPAS del rig de cara animada (gfx.makeFaceRig, docs/41): la misma cara separada en 4 planos apilados
// para poder ANIMAR cada elemento por separado (gaze de pupilas, pulso de ojos, bob de simbolos).
function drawLayer(spec, layer){
  const { c, x } = newCanvas();
  const S = TEX, f = S / 256, u = v => v * f;
  if (layer === 'skin') paintSkin(x, u, S, spec);
  else if (layer === 'eyes') paintEyes(x, u, S, spec, 'white');
  else if (layer === 'pups') paintEyes(x, u, S, spec, 'pup');
  else if (layer === 'deco') drawSymbols(x, u, S, spec.symbols || []);
  return c;
}
const ROUNDISH = new Set(['round', 'wide', 'narrow']);
function eyeShape(spec, side){ return (side === 'L' && spec.eye_l) ? spec.eye_l : (side === 'R' && spec.eye_r) ? spec.eye_r : (spec.eye || 'round'); }
function hasPups(spec){ return ROUNDISH.has(eyeShape(spec, 'L')) || ROUNDISH.has(eyeShape(spec, 'R')); }

// ── EXPRESIONES (presets, idénticos a eyes_atlas.PRESETS) ─────────────────────
// PRESETS v2 KAWAII (2026-06-27): estilo móvil "que los niños adoran". Ojos enormes + pupila gigante con brillo
// grande + boca pequeña/baja + mofletes en TODA cara de gameplay. "concentrada" = esfuerzo SIN ira y DESPIERTA
// (ojo redondo NO entornado de más, ceño flat/up nunca angry, boca de gatito; el esfuerzo lo da el sudor/gaze).
// Las negativas (dolor/enfado/ko/triste) NO se "cutean" a propósito (lectura clara). El motor de emociones ROTA
// las variantes de concentrada (chassis/emotions.mjs FIGHT) → cada bola con cara distinta y que cambia sola.
export const PRESETS = {
  neutral:     { eye: 'round', mouth: 'tiny', cheeks: true },
  blink:       { eye: 'blink', mouth: 'tiny', cheeks: true },
  feliz:       { eye: 'happy', mouth: 'smile', cheeks: true },
  extasis:     { eye: 'star', mouth: 'big_smile', cheeks: true, symbols: ['stars', 'hearts'] },
  concentrada: { eye: 'round', ry: 0.82, pup: 1.0, brow: 'flat', mouth: 'cat', cheeks: true },
  conc_b:  { eye: 'round', ry: 0.80, pup: 1.0, gaze: [0.0, 0.12], brow: 'flat', mouth: 'open_o', symbols: ['sweat'], cheeks: true },
  conc_c:  { eye: 'round', ry: 0.82, pup: 1.0, gaze: [0.5, 0.05], brow: 'up', mouth: 'smirk', cheeks: true },
  conc_cL: { eye: 'round', ry: 0.82, pup: 1.0, gaze: [-0.5, 0.05], brow: 'up', mouth: 'smirk', cheeks: true },
  sorpresa:    { eye: 'wide', rx: 1.08, ry: 1.20, pup: 0.85, brow: 'up', mouth: 'open_o', symbols: ['exclaim'], cheeks: true },
  susto:       { eye: 'wide', rx: 1.08, ry: 1.20, pup: 0.65, brow: 'up', mouth: 'open_big', symbols: ['sweat'], cheeks: true },
  dolor:       { eye_l: 'gt', eye_r: 'lt', brow: 'angry', mouth: 'grimace' },
  enfado:      { eye: 'narrow', ry: 0.70, pup: 0.75, brow: 'angry', mouth: 'frown', symbols: ['anger'] },
  triste:      { eye: 'round', ry: 1.05, pup: 1.15, gaze: [0.0, 0.45], brow: 'sad', mouth: 'frown', symbols: ['tears'], cheeks: true },
  ko:          { eye: 'x', mouth: 'grimace' },
  chuleria:    { eye_l: 'happy', eye_r: 'round', pup: 1.0, mouth: 'smirk', symbols: ['sparkle'], cheeks: true },
  alivio:      { eye: 'happy', mouth: 'big_smile', symbols: ['sweat'], cheeks: true },
};

// ── CARA DEL CAZADOR (depredador) — port de draw_hunter_face ───────────────────
const HRED = 'rgb(232,42,42)', HMAW = 'rgb(110,12,14)', HTONGUE = 'rgb(206,64,74)', HFANG = 'rgb(250,248,244)';
function fangs(x, cx, yEdge, halfW, h, n, down){
  if (n < 1) return;
  for (let k = 0; k < n; k++){
    const px = cx - halfW + (2 * halfW) * (n > 1 ? k / (n - 1) : 0.5);
    const tip = yEdge + (down ? h : -h);
    poly(x, [[px - halfW * 0.10, yEdge], [px + halfW * 0.10, yEdge], [px, tip]], HFANG);
  }
}
function drawHunter(spec){
  const { c, x } = newCanvas();
  const S = TEX, f = S / 256, u = v => v * f;
  const cx0 = S / 2, ex = u(50), ey = u(94), lx = cx0 - ex, rx = cx0 + ex;
  const er = u(34) * (spec.eye ?? 1.0), gx = (spec.gaze ?? 0) * u(10);
  for (const cxe of [lx, rx]){
    ell(x, cxe, ey, er, er * 1.05, WHITE, INK, u(4));
    const ix = cxe + gx, ir = u(16);
    ell(x, ix, ey, ir, ir, HRED);
    const pr = u(7); ell(x, ix, ey, pr, pr, PUP);
    const gl = u(5); ell(x, ix - ir * 0.5, ey - ir * 0.5, gl, gl, WHITE);
  }
  for (const side of ['L', 'R']){
    const cxe = side === 'L' ? lx : rx, top = ey - er - u(8);
    const inn = cxe + (side === 'L' ? er * 0.75 : -er * 0.75), out = cxe + (side === 'L' ? -er : er);
    thick(x, [[out, top], [inn, top + u(20)]], u(10), HRED);
  }
  const mcy = u(178), jaw = spec.jaw || 'snarl';
  let mw;
  if (jaw === 'snarl'){
    mw = u(54); const mh = u(24);
    ell(x, cx0, mcy, mw, mh, HMAW);
    fangs(x, cx0, mcy - mh + u(3), mw * 0.82, u(20), 6, true);
    fangs(x, cx0, mcy + mh - u(3), mw * 0.66, u(16), 4, false);
  } else if (jaw === 'snap'){
    mw = u(50);
    rrect(x, [cx0 - mw, mcy - u(11), cx0 + mw, mcy + u(13)], u(6), HMAW);
    for (const k of [-2, -1, 0, 1, 2]){ const xx = cx0 + k * u(18); thick(x, [[xx, mcy - u(11)], [xx, mcy + u(13)]], u(4), HFANG); }
    thick(x, [[cx0 - mw, mcy + u(1)], [cx0 + mw, mcy + u(1)]], u(3), HFANG);
  } else { // maw: fauces abiertas (chomp / rugido)
    mw = u(58); const mh = u(46);
    ell(x, cx0, mcy + u(3), mw, mh + u(3), HMAW);
    ell(x, cx0, mcy + u(10 + 18), u(24), mh * 0.42, HTONGUE);
    fangs(x, cx0, mcy - mh + u(4), mw * 0.86, u(24), 7, true);
    fangs(x, cx0, mcy + mh - u(2), mw * 0.74, u(20), 5, false);
  }
  if (spec.drool) teardrop(x, cx0 + mw * 0.9, mcy + u(6), u(12), BLUE);
  return c;
}

export const HUNTER_PRESETS = {
  caz_hambriento: { eye: 1.0, jaw: 'snarl', drool: true },     // idle/digestión: rabioso, babeando
  caz_chomp:      { eye: 0.95, jaw: 'maw', gaze: -0.5 },        // fauces abiertas + ojos a un lado
  caz_snap:       { eye: 1.0, jaw: 'snap', gaze: 0.5 },         // dientes apretados + ojos al otro lado
  caz_rugido:     { eye: 1.12, jaw: 'maw' },                    // rugido (frenesí)
};

// ── caché de texturas ─────────────────────────────────────────────────────────
const cache = new Map();
function toTex(canvas){
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
export function faceTexture(name){
  let t = cache.get(name); if (t) return t;
  const spec = PRESETS[name] || PRESETS.neutral;
  t = toTex(drawFace(spec)); cache.set(name, t); return t;
}
// Texturas por CAPA de una expresion (para makeFaceRig). pups/deco son null si la expresion no las usa.
export function faceLayers(name){
  const key = 'L:' + name; let L = cache.get(key); if (L) return L;
  const spec = PRESETS[name] || PRESETS.neutral;
  L = {
    skin: toTex(drawLayer(spec, 'skin')),
    eyes: toTex(drawLayer(spec, 'eyes')),
    pups: hasPups(spec) ? toTex(drawLayer(spec, 'pups')) : null,
    deco: (spec.symbols && spec.symbols.length) ? toTex(drawLayer(spec, 'deco')) : null,
  };
  cache.set(key, L); return L;
}
export function hunterTexture(name){
  const key = 'H:' + name; let t = cache.get(key); if (t) return t;
  const spec = HUNTER_PRESETS[name] || HUNTER_PRESETS.caz_hambriento;
  t = toTex(drawHunter(spec)); cache.set(key, t); return t;
}
export const EXPRESSIONS = Object.keys(PRESETS);
export const HUNTER_EXPRESSIONS = Object.keys(HUNTER_PRESETS);
