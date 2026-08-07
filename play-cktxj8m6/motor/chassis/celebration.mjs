// YouBall · CELEBRACIÓN compartida (copa + confeti grande). La usan TODOS los modos para que la
// victoria se vea IGUAL. Sin texto (regla de marca): el ganador se lee por el color de sus bolas +
// el confeti. El confeti son piezas GRANDES de papel (pool fijo, poca CPU) CANALIZADAS en dos cascadas
// LATERALES (centro despejado para el ganador → ya no "inunda" como antes). AR3 del plan de feedback.
import * as THREE from 'three';
import { sat } from './gfx.mjs?v=726b446';

// Copa PLATEADA (base clara) para poder TINTARLA con el color del equipo ganador vía material.color
// (blanco × color = color limpio). Contornos oscuros neutros para que se lea la forma sobre cualquier tinte.
function trophyTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.lineJoin = 'round'; x.lineCap = 'round'; const OUT = '#1c1c24';
  for (const sx of [-1, 1]){ x.beginPath(); x.arc(128 + sx * 50, 96, 28, -Math.PI / 2, Math.PI / 2, sx < 0); x.lineWidth = 14; x.strokeStyle = '#d8d8e2'; x.stroke(); x.lineWidth = 6; x.strokeStyle = OUT; x.stroke(); }
  const g = x.createLinearGradient(0, 50, 0, 150); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#dcdce6'); g.addColorStop(1, '#9a9ab0');
  x.beginPath(); x.moveTo(80, 66); x.lineTo(176, 66); x.lineTo(156, 126); x.quadraticCurveTo(128, 156, 100, 126); x.closePath(); x.fillStyle = g; x.lineWidth = 9; x.strokeStyle = OUT; x.fill(); x.stroke();
  x.beginPath(); x.moveTo(74, 64); x.lineTo(182, 64); x.lineWidth = 14; x.strokeStyle = '#ffffff'; x.stroke(); x.lineWidth = 5; x.strokeStyle = OUT; x.stroke();
  x.fillStyle = '#dcdce6'; x.lineWidth = 9; x.strokeStyle = OUT;
  x.beginPath(); x.rect(120, 150, 16, 26); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(100, 196); x.lineTo(156, 196); x.lineTo(148, 176); x.lineTo(108, 176); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(92, 210); x.lineTo(164, 210); x.lineWidth = 15; x.strokeStyle = '#c8c8d4'; x.stroke(); x.lineWidth = 6; x.strokeStyle = OUT; x.stroke();
  x.beginPath(); x.ellipse(108, 96, 7, 22, -0.2, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,0.6)'; x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// scene + TEAMS (para los colores del confeti). Devuelve { update(active, cam, dt) }.
export function createCelebration(scene, TEAMS){
  const trophy = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: trophyTexture(), transparent: true, depthWrite: false, toneMapped: false }));
  trophy.renderOrder = 6; trophy.visible = false; scene.add(trophy);

  // Confeti CANALIZADO: ~34 piezas repartidas en banda izquierda/derecha (alternas). Cada una guarda su lado
  // y su posición NORMALIZADA dentro de la banda → se recalcula el x en mundo cada frame (queda pegada al
  // margen aunque la cámara haga zoom en la celebración). El centro NUNCA recibe confeti.
  const confetti = [];
  const NCONF = 34;
  for (let i = 0; i < NCONF; i++){ const c = sat(TEAMS[i % TEAMS.length].color);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.36),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.DoubleSide, toneMapped: false, transparent: true, depthWrite: false }));
    m.renderOrder = 5; m.visible = false;
    m.userData = { side: (i % 2) ? 1 : -1, bxn: Math.random(), yn: Math.random(),
      vy: -(3.5 + Math.random() * 3.5), swA: 0.3 + Math.random() * 0.45, swF: 1.5 + Math.random() * 2,
      ph: Math.random() * 6.28, sx: (Math.random() - 0.5) * 7, sy: (Math.random() - 0.5) * 7 };
    scene.add(m); confetti.push(m);
  }
  const BAND = 0.24;   // ancho de cada banda lateral (fracción del encuadre) → centro libre = 1 - 2·BAND ≈ 52%

  let frames = 0, init = false, clock = 0;   // clock por dt (NO performance.now): smooth y DETERMINISTA en captura (si no, la copa "tiembla")
  // winnerRGB = [r,g,b] (0..1) del equipo ganador → la copa toma SU color. (Si null, queda plateada.)
  // focusX (opcional) = X del mundo sobre la que centrar la COPA (p.ej. encima de las campeonas); por defecto el centro de cámara.
  function update(active, cam, dt, winnerRGB, focusX){
    if (!active){ if (frames){ trophy.visible = false; for (const m of confetti) m.visible = false; frames = 0; init = false; } return; }
    if (winnerRGB) trophy.material.color.setRGB(winnerRGB[0], winnerRGB[1], winnerRGB[2]);
    frames++;
    const cx = cam.position.x, cy = cam.position.y;                       // bordes del encuadre (mundo) desde el frustum ortográfico
    const vx0 = cx + cam.left, vx1 = cx + cam.right, vy0 = cy + cam.bottom, vy1 = cy + cam.top, vw = vx1 - vx0, vh = vy1 - vy0;
    clock += dt || 0;
    const pop = Math.min(1, frames / 8), t = clock;
    trophy.visible = true;
    trophy.position.set(focusX != null ? focusX : cx, vy1 - vh * 0.20, 3);
    trophy.scale.setScalar(pop * vh * 0.30 * (1 + 0.04 * Math.sin(clock * 5)));
    const bandW = vw * BAND;
    for (const m of confetti){ const u = m.userData;
      if (!init){ m.position.y = vy0 + u.yn * vh; m.visible = true; }
      m.position.y += u.vy * dt;
      if (m.position.y < vy0){ m.position.y = vy1; u.bxn = Math.random(); }   // recicla arriba, nueva x en su banda
      // x = margen del lado + posición normalizada en la banda + balanceo (clamp para no invadir el centro)
      const base = u.side < 0 ? vx0 + u.bxn * bandW : vx1 - u.bxn * bandW;
      let px = base + Math.sin(t * u.swF + u.ph) * u.swA;
      px = u.side < 0 ? Math.min(vx0 + bandW, Math.max(vx0, px)) : Math.max(vx1 - bandW, Math.min(vx1, px));
      m.position.set(px, m.position.y, 1.5);
      m.rotation.set(u.sx * t, u.sy * t, u.ph + t * 2);                   // flutter en 3 ejes (DoubleSide)
    }
    init = true;
  }
  return { trophy, update };
}
