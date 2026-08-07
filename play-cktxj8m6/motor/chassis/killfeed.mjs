// YouBall · KILL FEED compartido (canvas/WebGL => sale en el video), estilo Counter-Strike.
// Sustituye al cartelon central (feedback del dueno 2026-07-18: "el mensaje tapa todo, y si mueren varias a la
// vez se pisan"). Ahora cada muerte anade una FILA PEQUENA en la esquina ABAJO-DERECHA; el feed crece hacia
// arriba, las entradas se desvanecen solas y VARIAS MUERTES SE APILAN (nunca se tapan). Dice QUIeN cae (color +
// nombre + dorsal); el CUANTAS quedan lo lleva la franja de censo (SURVIVORS N), sin duplicar el dato.
//
// REUTILIZABLE por los 4 modos: feed.push(teamIdx, dorsal) en cada muerte + feed.update(dt, cam) cada frame.
// Se ancla a la esquina leyendo el encuadre de la camara, asi vale para 16:9 (torneo) y 9:16 (shorts). El tamano
// va por la dimension MENOR del viewport => fisicamente parecido en las dos orientaciones. Texto en INGLeS.
import * as THREE from 'three';
import { sat } from './gfx.mjs?v=b80e764';

// Traduccion de RESPALDO: los modos ya definen sus paletas en ingles, pero si a alguna se le cuela un nombre en
// espanol el feed lo pintaria tal cual en pantalla (paso en los shorts de 2026-07-19: NARANJA/CIAN/VIOLETA).
// Cubre las 8 del short + las 4 del torneo, para que un descuido nunca llegue al video.
const EN_NAME = { Rojo: 'RED', Verde: 'GREEN', Azul: 'BLUE', Amarillo: 'YELLOW',
                  Naranja: 'ORANGE', Cian: 'CYAN', Violeta: 'VIOLET', Rosa: 'PINK', Blanco: 'WHITE', Negro: 'BLACK' };
function enName(team, ti){ return (team && EN_NAME[team.name]) || (team && team.name ? team.name.toUpperCase() : ('TEAM ' + (ti + 1))); }

const CW = 560, CH = 620;            // lienzo del feed (6 filas de ~96)
const ROWH = 96, LIFE = 3.0;         // alto de fila (px de lienzo) y vida de cada entrada (s)
const DISMISS_T = 0.45;              // fundido de salida al coronar (dismiss()): rapido, la celebracion manda
const FADE_IN = 0.18, FADE_OUT = 0.6;

function roundRect(x, gx, gy, w, h, r){ x.beginPath();
  x.moveTo(gx + r, gy); x.arcTo(gx + w, gy, gx + w, gy + h, r); x.arcTo(gx + w, gy + h, gx, gy + h, r);
  x.arcTo(gx, gy + h, gx, gy, r); x.arcTo(gx, gy, gx + w, gy, r); x.closePath(); }

// scene + TEAMS [+ opts]. Devuelve { push(teamIdx, dorsal), update(dt, cam), reset() }.
//   opts.alpha = opacidad global del feed (default 1). opts.delay = segundos antes de que una entrada APAREZCA
//   (default 0). Para modos donde el beat de muerte vive EN la acción (Carrusel "Tangent Blast", 2026-07-18):
//   el feed atenuado+retrasado queda como HISTORIAL, no compite con el FX en el punto de muerte.
export function createKillfeed(scene, TEAMS, opts = {}){
  const OPT_A = opts.alpha != null ? opts.alpha : 1;
  const DELAY = opts.delay || 0;
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const x = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = 12; mesh.visible = false; scene.add(mesh);

  let entries = [];   // {team, dorsal, age, slot} newest al final
  let dismissT = -1;  // >=0 = desvaneciendo hacia el vaciado (segundos transcurridos); -1 = normal

  function push(ti, dorsal){ if (ti == null || ti < 0) return;
    if (dismissT >= 0) return;                                                 // ya despedido: no admite más entradas
    entries.push({ team: ti, dorsal: dorsal | 0, age: -DELAY, slot: -1 }); }   // age negativa = aún oculta (delay); slot -1 => entra desde abajo

  // DESPEDIDA del feed (2026-07-19): al coronar, las ultimas bajas seguian en pantalla los 3 s de LIFE y el CTA
  // (👍🔔, abajo-centro) se les montaba encima — los dos viven en la franja baja. dismiss() las funde en
  // DISMISS_T y deja la celebracion limpia. Idempotente: se puede llamar cada frame desde decision_frame.
  function dismiss(){ if (dismissT < 0) dismissT = 0; }

  function drawRow(e, alpha, slotY){
    const c = sat(TEAMS[e.team].color, 1.15), hex = `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
    const slide = (1 - Math.min(1, e.age / FADE_IN)) * 90;   // entra deslizando desde la derecha
    const gx = 16 + slide, gy = slotY + 8, w = CW - 32 - slide, h = ROWH - 16;
    x.globalAlpha = alpha;
    x.fillStyle = 'rgba(10,8,16,0.85)'; roundRect(x, gx, gy, w, h, 16); x.fill();
    x.lineWidth = 3; x.strokeStyle = hex; x.stroke();
    x.fillStyle = hex; roundRect(x, gx + 8, gy + 8, 14, h - 16, 6); x.fill();       // barra de acento del color
    // cuadro de color
    x.fillStyle = hex; roundRect(x, gx + 34, gy + h / 2 - 20, 40, 40, 8); x.fill();
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.6)'; x.stroke();
    // nombre del color + dorsal
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.font = '800 46px system-ui, Segoe UI, sans-serif';
    x.fillStyle = hex; x.fillText(enName(TEAMS[e.team], e.team), gx + 90, gy + h / 2 + 2);
    const nameW = x.measureText(enName(TEAMS[e.team], e.team)).width;
    x.font = '700 34px system-ui, Segoe UI, sans-serif'; x.fillStyle = '#e7dff2';
    x.fillText('#' + e.dorsal, gx + 90 + nameW + 14, gy + h / 2 + 3);
    // marca de baja (X roja) a la derecha
    x.strokeStyle = '#ff2d2d'; x.lineWidth = 6; x.lineCap = 'round';
    const ex = gx + w - 40, ey = gy + h / 2, s = 15;
    x.beginPath(); x.moveTo(ex - s, ey - s); x.lineTo(ex + s, ey + s); x.stroke();
    x.beginPath(); x.moveTo(ex + s, ey - s); x.lineTo(ex - s, ey + s); x.stroke();
    x.globalAlpha = 1;
  }

  function update(dt, cam){
    dt = dt || 0;
    for (const e of entries) e.age += dt;
    entries = entries.filter(e => e.age < LIFE);
    let dismissA = 1;
    if (dismissT >= 0){
      dismissT += dt;
      dismissA = Math.max(0, 1 - dismissT / DISMISS_T);
      if (dismissA <= 0) entries = [];
    }
    const vis = entries.filter(e => e.age >= 0);               // las que aún están en delay no se pintan (siguen envejeciendo)
    if (!vis.length){ mesh.visible = false; return; }
    x.clearRect(0, 0, CW, CH);
    // la mas nueva (ultima del array) es el slot 0 abajo; las viejas suben. slot se suaviza (lerp) para deslizar.
    for (let i = 0; i < vis.length; i++){
      const e = vis[vis.length - 1 - i];                       // i=0 => la mas nueva, abajo
      if (e.slot < 0) e.slot = i; else e.slot += (i - e.slot) * Math.min(1, 12 * dt);
      const slotY = CH - ROWH - e.slot * ROWH;                  // desde abajo hacia arriba
      const aIn = Math.min(1, e.age / FADE_IN), aOut = e.age > LIFE - FADE_OUT ? (LIFE - e.age) / FADE_OUT : 1;
      drawRow(e, Math.max(0, Math.min(aIn, aOut)) * OPT_A * dismissA, slotY);
    }
    tex.needsUpdate = true;
    // anclado ABAJO-DERECHA. Tamano por la dimension MENOR del encuadre => parecido en 16:9 y 9:16.
    const cx = cam.position.x, cy = cam.position.y, vw = (cam.right - cam.left), vh = (cam.top - cam.bottom);
    const minDim = Math.min(vw, vh), w = minDim * 0.52, h = w * (CH / CW);
    mesh.scale.set(w, h, 1);
    mesh.position.set(cx + vw / 2 - w / 2 - vw * 0.015, cy - vh / 2 + h / 2 + vh * 0.02, 4);
    mesh.visible = true;
  }

  function reset(){ entries = []; dismissT = -1; mesh.visible = false; }
  return { push, update, reset, dismiss };
}
