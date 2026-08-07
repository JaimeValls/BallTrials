// YouBall · MINI-TAG DE MUERTE compartido (canvas/WebGL => sale en el video).
// Chip "● #dorsal ✕" del color de la bola que NACE EN EL PUNTO donde muere y deriva frenando ~1.2 s.
// Nació en el Carrusel (beat "Tangent Blast", feedback Jaime 2026-07-18: "el cartel distrae, no sabes quién
// murió EN la acción") y se comparte con los 4 modos: el "quién" vive donde está la mirada; el kill feed
// (chassis/killfeed.mjs, atenuado+retrasado) queda de historial. Sin texto de idioma (solo # + dorsal).
//
// USO: const ktags = createKillTags(scene, TEAMS, { width });  // width = ancho del chip en unidades de MUNDO
//      ktags.spawn(team, num, x, y, dx, dy)  // (dx,dy) = dirección de deriva (se normaliza; 0,0 => sube)
//      ktags.update(dt) cada frame · ktags.reset() al (re)empezar ronda.
import * as THREE from 'three';
import { sat } from './gfx.mjs?v=49450b6';

const CW = 256, CH = 112, LIFE = 1.2, FADE_AT = 0.7;

export function createKillTags(scene, TEAMS, opts = {}){
  const W = opts.width || 2.0;                       // ancho en unidades de mundo (cada modo pasa el suyo ~BALL_R*4.6)
  const SPEED = opts.speed != null ? opts.speed : W * 1.5;   // deriva inicial, frena con decel 2.2/s
  const Z = opts.z != null ? opts.z : 1.4;
  const MAX = opts.max || 6;

  const pool = [];
  for (let i = 0; i < MAX; i++){
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    m.renderOrder = 10; m.visible = false; m.userData = { active: false, cv, tex };
    scene.add(m); pool.push(m);
  }
  let head = 0;

  function spawn(team, num, x, y, dx, dy){
    const m = pool[head]; head = (head + 1) % MAX;
    const u = m.userData, g = u.cv.getContext('2d');
    const c = sat(TEAMS[team].color), hex = `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
    g.clearRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(10,8,16,0.82)'; g.beginPath();               // pastilla redondeada oscura
    g.moveTo(26, 6); g.arcTo(250, 6, 250, 106, 26); g.arcTo(250, 106, 6, 106, 26);
    g.arcTo(6, 106, 6, 6, 26); g.arcTo(6, 6, 250, 6, 26); g.closePath(); g.fill();
    g.lineWidth = 5; g.strokeStyle = hex; g.stroke();
    g.fillStyle = hex; g.beginPath(); g.arc(48, 56, 26, 0, 7); g.fill();   // disco del color
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = '900 56px system-ui, Segoe UI, sans-serif';
    g.fillStyle = '#fff'; g.fillText('#' + num, 88, 60);
    g.strokeStyle = '#ff2d2d'; g.lineWidth = 9; g.lineCap = 'round';       // X roja
    g.beginPath(); g.moveTo(200, 36); g.lineTo(238, 76); g.stroke();
    g.beginPath(); g.moveTo(238, 36); g.lineTo(200, 76); g.stroke();
    u.tex.needsUpdate = true;
    const len = Math.hypot(dx || 0, dy || 0);
    const nx = len > 1e-6 ? dx / len : 0, ny = len > 1e-6 ? dy / len : 1;  // sin dirección => sube
    m.userData = { ...u, active: true, life: 0, x, y, vx: nx * SPEED, vy: ny * SPEED };
    m.scale.set(W, W * CH / CW, 1); m.visible = true;
  }

  function update(dt){
    for (const m of pool){ const u = m.userData; if (!u.active) continue;
      u.life += dt; const t = u.life / LIFE;
      if (t >= 1){ u.active = false; m.visible = false; continue; }
      u.x += u.vx * dt; u.y += u.vy * dt;
      u.vx *= (1 - Math.min(1, 2.2 * dt)); u.vy *= (1 - Math.min(1, 2.2 * dt));   // frena al derivar
      m.position.set(u.x, u.y, Z); m.material.opacity = t > FADE_AT ? 1 - (t - FADE_AT) / (1 - FADE_AT) : 1; }
  }

  function reset(){ for (const m of pool){ m.visible = false; m.userData.active = false; } }
  return { spawn, update, reset };
}
