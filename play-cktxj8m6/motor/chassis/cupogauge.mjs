// YouBall · MEDIDOR DE CUPO (canvas/WebGL => sale en el video capturado). Para modos de EMBUDO (Marble Games):
// la ronda se cierra cuando `survTarget` bolas se han SALVADO cruzando la meta. Este medidor cuenta hacia ARRIBA
// los ASEGURADOS al cruzar (0/N → N/N) con lenguaje de PROGRESO (barra que se LLENA + fraccion) — a proposito
// DISTINTO de la franja del censo de arriba (censusboard.mjs), que cuenta hacia ABAJO los que siguen vivos con
// fichas por bola. Se leen como cosas distintas y no se enciman (hot-button "doble contador" de Jaime).
//
// PASTILLA COMPACTA ARRIBA-IZQUIERDA, debajo de la franja del censo (feedback Jaime 2026-07-18: la barra ancha
// abajo-centro era demasiado; "compactalo arriba a la izquierda"). Dimensionada por el LADO MENOR + clampada
// (regla del proyecto) para no inflarse en apaisado. Texto en INGLeS.
//
//   const cupo = createCupoGauge(scene);
//   cupo.update(dt, cam, placed, target);   // cada frame; target==null (standalone, sin embudo) => oculto
//   cupo.reset();                            // al (re)empezar ronda
// Al llegar placed>=target dispara SOLO una vez un FLASH de "ROUND FULL" (fin de ronda). Redibuja el lienzo solo
// cuando cambia el estado (cruces/flash), como censusboard.
import * as THREE from 'three';

const CW = 560, CH = 200;       // lienzo ~2.8:1 (pastilla compacta)

export function createCupoGauge(scene, opts = {}){
  const MINORF = opts.minorFrac != null ? opts.minorFrac : 0.24;   // ancho como fraccion del LADO MENOR (pastilla)
  const MAXWF  = opts.maxWFrac  != null ? opts.maxWFrac  : 0.48;    // tope de ancho (arriba-izq no debe cruzar media pantalla)
  const TOPF   = opts.topFrac   != null ? opts.topFrac   : 0.19;    // hueco desde arriba = alto de la franja del censo (~0.11) + margen CLARO
  const LEFTF  = opts.leftFrac  != null ? opts.leftFrac  : 0.03;    // margen desde el borde izquierdo
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const x = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = 12; mesh.visible = false; scene.add(mesh);

  let sig = '';                 // firma del estado dibujado => redibuja solo al cambiar
  let flashT = 0, bumpT = 0;    // temporizadores (s): flash de fin de ronda / bump sutil por cada cruce
  let lastPlaced = 0, fired = false;
  const FLASH_DUR = 0.9, BUMP_DUR = 0.22;

  function rr(x0, y0, w, h, r){ x.beginPath(); x.moveTo(x0 + r, y0);
    x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }

  function draw(placed, target, flash){
    x.clearRect(0, 0, CW, CH);
    const full = placed >= target;
    // fondo pastilla (mas caliente + aro dorado durante el flash de fin de ronda)
    rr(6, 6, CW - 12, CH - 12, 34);
    x.fillStyle = flash > 0 ? `rgba(34,22,10,${0.74 + 0.18 * flash})` : 'rgba(8,6,14,0.72)';   // fondo mas OPACO (se lee sobre el naranja)
    x.fill();
    // borde SIEMPRE visible (dorado en el flash, cian tenue en reposo) → la pastilla se distingue aunque este a 0/16
    x.lineWidth = flash > 0 ? 5 + 9 * flash : 4; x.strokeStyle = flash > 0 ? `rgba(255,214,90,${0.45 + 0.55 * flash})` : 'rgba(159,240,208,0.55)';
    rr(6, 6, CW - 12, CH - 12, 34); x.stroke();
    // fila superior: etiqueta pequena (izq) + fraccion grande (der)
    x.textBaseline = 'alphabetic';
    x.textAlign = 'left'; x.fillStyle = full ? '#ffe27a' : '#9ff0d0';
    x.font = '800 44px system-ui, Segoe UI, sans-serif';
    x.fillText((flash > 0 && full) ? 'ROUND FULL' : 'SAFE', 40, 84);
    if (!(flash > 0 && full)){
      x.textAlign = 'right'; x.fillStyle = '#ffffff'; x.font = '900 78px system-ui, Segoe UI, sans-serif';
      x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.lineJoin = 'round';
      const frac = `${placed}/${target}`;
      x.strokeText(frac, CW - 40, 92); x.fillText(frac, CW - 40, 92);
    }
    // barra de progreso CONTINUA (se LLENA hacia la derecha = "cuanto falta para cerrar la ronda")
    const bx = 40, bw = CW - 80, by = 128, bh = 46, r = 23;
    rr(bx, by, bw, bh, r); x.fillStyle = 'rgba(255,255,255,0.10)'; x.fill();
    rr(bx, by, bw, bh, r); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.22)'; x.stroke();
    const p = Math.max(0, Math.min(1, target ? placed / target : 0));
    if (p > 0){ const fw = Math.max(bh, bw * p);
      x.save(); rr(bx, by, bw, bh, r); x.clip();
      const g = x.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#3ad07a'); g.addColorStop(0.6, '#8fe05a'); g.addColorStop(1, full ? '#ffe27a' : '#ffd34d');
      x.fillStyle = g; x.fillRect(bx, by, fw, bh);
      x.fillStyle = `rgba(255,255,255,${full ? 0.85 : 0.55})`; x.fillRect(bx + fw - 5, by, 5, bh);   // borde de avance brillante
      x.restore(); }
    // marcas sutiles por unidad (refuerza "progreso", NO fichas de bolas)
    x.strokeStyle = 'rgba(0,0,0,0.28)'; x.lineWidth = 2;
    for (let k = 1; k < target; k++){ const tx = bx + bw * (k / target); x.beginPath(); x.moveTo(tx, by + 6); x.lineTo(tx, by + bh - 6); x.stroke(); }
    tex.needsUpdate = true;
  }

  function update(dt, cam, placed, target){
    if (target == null){ mesh.visible = false; lastPlaced = 0; fired = false; return; }   // standalone: sin cupo => oculto
    placed = placed || 0;
    if (placed > lastPlaced) bumpT = BUMP_DUR;                          // pulso sutil por cada cruce
    if (!fired && placed >= target){ fired = true; flashT = FLASH_DUR; } // FIN DE RONDA: un solo flash
    lastPlaced = placed;
    if (flashT > 0) flashT = Math.max(0, flashT - dt);
    if (bumpT > 0) bumpT = Math.max(0, bumpT - dt);
    const flash = flashT > 0 ? flashT / FLASH_DUR : 0;
    const fb = flash > 0 ? Math.round(flash * 6) : 0;                   // "bucket" del flash → redibuja a saltos
    const s = placed + '/' + target + '|' + fb;
    if (s !== sig){ sig = s; draw(placed, target, flash); }
    // tamano por LADO MENOR + clamp; posicion ARRIBA-IZQUIERDA, debajo de la franja del censo
    const vw = (cam.right - cam.left), vh = (cam.top - cam.bottom), minor = Math.min(vw, vh);
    let w = minor * MINORF; if (w > vw * MAXWF) w = vw * MAXWF;
    const h = w * (CH / CW);
    const pulse = 1 + (flash > 0 ? 0.10 * Math.sin(flash * Math.PI) : 0) + (bumpT > 0 ? 0.05 * (bumpT / BUMP_DUR) : 0);
    const wp = w * pulse, hp = h * pulse;
    mesh.scale.set(wp, hp, 1);
    // ANCLAR A cam.position (no a cam.left/cam.top): la cámara SIGUE la carrera subiendo por la pista, así que los
    // bordes del frustum en el origen NO son las esquinas visibles. Como el censo: esquina sup-izq del ENCUADRE =
    // (cam.position.x - vw/2, cam.position.y + vh/2). Sin esto la pastilla se quedaba fija en el mundo → fuera de pantalla.
    mesh.position.set(cam.position.x - vw / 2 + vw * LEFTF + wp / 2, cam.position.y + vh / 2 - vh * TOPF - hp / 2, 5);
    mesh.visible = true;
  }

  function roundOver(){ if (!fired){ fired = true; flashT = FLASH_DUR; } }   // disparo manual del flash (por si se quiere forzar)
  function reset(){ sig = ''; flashT = 0; bumpT = 0; lastPlaced = 0; fired = false; mesh.visible = false; }
  return { update, roundOver, reset };
}
