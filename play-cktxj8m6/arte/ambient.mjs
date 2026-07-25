// ============================================================================
//  FONDO VIVO DE LA HOME (doc 41 bloque E) — PORT de la web oficial.
//
//  ORIGEN: C:\AI\BallTrials\prototipo-webgl\webmbient.mjs (balltrials.com). Mismo chassis
//  REAL del motor (gfx.mjs: bola gominola glossy + cara kawaii; emotions.mjs: parpadeo y
//  reacciones), asi que las bolas del fondo son IDENTICAS a las de los videos y a las de la web.
//  No es arte nuevo: es el mismo codigo. Por eso pega de serie.
//
//  QUE CAMBIA respecto al original, y por que:
//   1) Es una FUNCION que se arranca y se para (startAmbient), no un modulo que se auto-ejecuta:
//      el shell la enciende en la Home y la APAGA al abrir una partida. Dos contextos WebGL vivos
//      a la vez (fondo + motor) es justo lo que tumba un movil.
//   2) Mide el CANVAS, no la ventana: la app se encaja a un viewport medido y en escritorio va
//      centrada a ~430 px, asi que innerWidth/innerHeight mentian.
//   3) Sin audio: el original suena al rebotar; aqui el sonido lo manda el juego.
// ============================================================================
import { THREE, makeBall, createParticles, sat } from '../motor/chassis/gfx.mjs';
import { EmoBook } from '../motor/chassis/emotions.mjs';
const sfx = () => {};   // el sonido lo manda el juego, no el fondo

// ── presupuesto / configuración ───────────────────────────────────────────────
const MOBILE = matchMedia('(max-width: 760px)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
//+AG doc 41 bloque E: CALIBRADO PARA VERTICAL. La web corre esto en una pantalla ancha; en el
//   movil del juego (430x860) el mismo mundo daba bolas gigantes que tapaban a la protagonista y
//   se comian el texto. Subir WORLD_H encoge TODO a la vez (bolas, pegs, pendulo) porque estan en
//   unidades de mundo, y de paso las hace caer mas despacio: queda de fondo, que es su trabajo.
const PORTRAIT = innerHeight > innerWidth;
const CAP = PORTRAIT ? 5 : (MOBILE ? 7 : 14);   // población máxima
const WORLD_H = PORTRAIT ? 22 : 12;             // alto del mundo en unidades (el ancho sigue al aspect)
const R = MOBILE ? 0.40 : 0.45;        // radio de bola
const GRAV = -15;
const TEAMS = [                        // colores canónicos de competidor (docs/16)
  [0.910, 0.212, 0.184],  // rojo    #E8362F
  [0.118, 0.455, 0.878],  // azul    #1E74E0
  [0.184, 0.722, 0.294],  // verde   #2FB84B
  [1.000, 0.773, 0.145],  // amarillo #FFC525
  [0.878, 0.141, 0.612],  // magenta #E0249C
  [0.094, 0.780, 0.839],  // cian    #18C7D6
];

export function startAmbient(canvas){
  if (!canvas || REDUCED) return { stop(){} };
  const host = canvas.parentElement || canvas;
  const cw = () => host.clientWidth || 1, ch = () => host.clientHeight || 1;
  const off = [];   // limpieza: todo listener registrado aqui se quita en stop()
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };

  // ── escena (réplica de la luz de createStage, sin bloom ni entorno) ─────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.NoToneMapping;          // color VIVO, como el juego
  renderer.setClearColor(0x000000, 0);                 // transparente: el degradado lo pone el CSS
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xb9b6c8, 0.40));
  const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(-5, 7, 10); scene.add(key);
  const fill = new THREE.DirectionalLight(0xaab4c8, 0.35); fill.position.set(6, -4, 6); scene.add(fill);
  const cam = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
  cam.position.set(0, 0, 60); cam.lookAt(0, 0, 0);

  const parts = createParticles(scene);

  let W = 20;                                          // ancho del mundo (se fija en resize)
  function resize(){
    renderer.setSize(cw(), ch(), false);
    W = WORLD_H * cw() / ch();
    cam.left = -W / 2; cam.right = W / 2; cam.top = WORLD_H / 2; cam.bottom = -WORLD_H / 2;
    cam.updateProjectionMatrix();
    layoutObstacles();
  }

  // px de viewport → unidades de mundo
  const toWX = px => ((px - host.getBoundingClientRect().left) / cw() - 0.5) * W;
  const toWY = px => (0.5 - (px - host.getBoundingClientRect().top) / ch()) * WORLD_H;

  // ── trampas suaves (se recolocan con el viewport) ───────────────────────────
  // pegs en los MÁRGENES laterales (el centro es del contenido), un trampolín abajo
  // y un péndulo lento arriba a la derecha. Nada elimina: el sumidero de abajo recicla.
  const pegs = [];        // {x,y,r,mesh}
  const pegMat = new THREE.MeshStandardMaterial({ color: 0x7a4bf0, roughness: 0.38, metalness: 0,
    emissive: 0x5a30c8, emissiveIntensity: 0.5 });
  const pegGeo = new THREE.SphereGeometry(1, 26, 18);
  function peg(fx, fy, r){
    const m = new THREE.Mesh(pegGeo, pegMat);
    scene.add(m);
    pegs.push({ fx, fy, r, m, x: 0, y: 0 });
  }
  // fracciones del viewport (fx: 0=izquierda 1=derecha; fy: 0=arriba 1=abajo)
  peg(0.06, 0.30, 0.26); peg(0.13, 0.52, 0.30); peg(0.05, 0.74, 0.26);
  peg(0.94, 0.34, 0.26); peg(0.87, 0.58, 0.30); peg(0.95, 0.80, 0.26);
  if (!MOBILE){ peg(0.20, 0.16, 0.22); peg(0.80, 0.14, 0.22); }

  // trampolín (segmento horizontal que impulsa hacia arriba)
  const tramp = { fx: 0.5, fy: 0.965, half: MOBILE ? 1.3 : 2.0, x: 0, y: 0 };
  const trampMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xfbb915, roughness: 0.35, metalness: 0,
      emissive: 0xfbb915, emissiveIntensity: 0.35 }));
  scene.add(trampMesh);

  // péndulo lento (bola kinemática colgando; empuja con suavidad)
  const pend = { pfx: 0.86, pfy: 0.05, arm: 2.6, r: 0.55, x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0 };
  const pendMesh = new THREE.Mesh(new THREE.SphereGeometry(pend.r, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a5cf0, roughness: 0.35, metalness: 0,
      emissive: 0x6a3ae0, emissiveIntensity: 0.5 }));
  const pendLine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xcdb9f2, transparent: true, opacity: 0.5 }));
  scene.add(pendMesh); scene.add(pendLine);

  function layoutObstacles(){
    for (const p of pegs){ p.x = (p.fx - 0.5) * W; p.y = (0.5 - p.fy) * WORLD_H; p.m.position.set(p.x, p.y, -0.5); p.m.scale.set(p.r, p.r, p.r); }
    tramp.x = (tramp.fx - 0.5) * W; tramp.y = (0.5 - tramp.fy) * WORLD_H;
    trampMesh.position.set(tramp.x, tramp.y, -0.5); trampMesh.scale.x = tramp.half * 2;
    pend.px = (pend.pfx - 0.5) * W; pend.py = (0.5 - pend.pfy) * WORLD_H;
    pend.x = pend.px; pend.y = pend.py - pend.arm; pend.vx = 0; pend.vy = 0;   // sin salto en el 1er frame
  }

  // ── colliders del DOM: las bolas rebotan en las tarjetas ([data-solid]) ─────
  let rects = [];                                       // AABBs en unidades de mundo
  let rectsDirty = true;
  const solids = MOBILE ? [] : [...host.querySelectorAll('[data-solid]')];
  function refreshRects(){
    rects = [];
    for (const el of solids){
      const r = el.getBoundingClientRect();
      if (r.bottom < -40 || r.top > ch() + 40 || r.width === 0) continue;   // fuera de pantalla
      rects.push({ x0: toWX(r.left), x1: toWX(r.right), y0: toWY(r.bottom), y1: toWY(r.top) });
    }
    rectsDirty = false;
  }
  on(window, 'resize', () => { resize(); rectsDirty = true; });
  const ro = new ResizeObserver(() => { resize(); rectsDirty = true; }); ro.observe(host);   // la app se re-encaja sola: el canvas cambia sin que cambie la ventana

  // ── bolas ───────────────────────────────────────────────────────────────────
  const balls = [];                                     // {x,y,vx,vy,sq,mesh,setExpr,id}
  const book = new EmoBook(CAP, 20260702);
  let nextColor = Math.floor(Math.random() * TEAMS.length);
  let frame = 0;

  function spawn(x, y, vx, vy){
    if (balls.length >= CAP){                           // recicla la más antigua
      const b = balls.shift(); balls.push(b);
      b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.sq = 0;
      pop(x, y, b.col); return b;
    }
    const color = TEAMS[nextColor++ % TEAMS.length];
    const mesh = makeBall(scene, { color }, R);
    const b = { x, y, vx, vy, sq: 0, id: balls.length, col: sat(color), ...mesh };
    balls.push(b); pop(x, y, b.col);
    return b;
  }
  function pop(x, y, col){ parts.burst(x, y, 0.2, col, 10, 2.2); }
  function topSpawn(){
    spawn((Math.random() - 0.5) * W * 0.92, WORLD_H / 2 + 1 + Math.random(),
      (Math.random() - 0.5) * 2.5, 0);
  }

  // población inicial (repartida por la pantalla, cayendo ya) + goteo para reponer
  const N0 = MOBILE ? 4 : 8;
  for (let i = 0; i < N0; i++){
    spawn((Math.random() - 0.5) * 18, 1 + Math.random() * 8, (Math.random() - 0.5) * 2.5, -Math.random() * 2);
  }
  let dripT = 0.8;

  function hit(b, nx, ny, impact, kind = 'tick'){       // reacción común a un golpe
    b.sq = Math.min(1, impact / 9);
    if (impact > 5.2){ book.fire(b.id, 'sorpresa', 4, 16, frame); }
    if (impact > 7) parts.burst(b.x, b.y, 0.2, b.col, 6, 1.6);
    if (impact > 4.6) sfx(kind, 0.18 + Math.min(0.6, (impact - 4.6) / 11));
  }

  // ── física ──────────────────────────────────────────────────────────────────
  const DT_STEP = 1 / 60;
  function step(dt){
    // péndulo kinemático
    const ang = Math.sin(performance.now() * 0.00045) * 0.85;
    const npx = pend.px + Math.sin(ang) * pend.arm, npy = pend.py - Math.cos(ang) * pend.arm;
    pend.vx = (npx - pend.x) / dt; pend.vy = (npy - pend.y) / dt;
    pend.x = npx; pend.y = npy;
    pendMesh.position.set(pend.x, pend.y, -0.4);
    pendLine.position.set((pend.px + pend.x) / 2, (pend.py + pend.y) / 2, -0.6);
    pendLine.scale.y = pend.arm; pendLine.rotation.z = ang;

    for (const b of balls){
      b.vy += GRAV * dt;
      b.vx *= 0.999;
      if (b.vy < -18) b.vy = -18;
      b.x += b.vx * dt; b.y += b.vy * dt;

      // paredes laterales
      if (b.x < -W / 2 + R){ b.x = -W / 2 + R; if (b.vx < 0){ b.vx = -b.vx * 0.7; hit(b, 1, 0, Math.abs(b.vx)); } }
      if (b.x >  W / 2 - R){ b.x =  W / 2 - R; if (b.vx > 0){ b.vx = -b.vx * 0.7; hit(b, -1, 0, Math.abs(b.vx)); } }

      // pegs
      for (const p of pegs){
        const dx = b.x - p.x, dy = b.y - p.y, rr = R + p.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6){
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          b.x = p.x + nx * rr; b.y = p.y + ny * rr;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0){ b.vx -= 1.72 * vn * nx; b.vy -= 1.72 * vn * ny; hit(b, nx, ny, -vn); }
        }
      }

      // péndulo (empuja con su velocidad)
      {
        const dx = b.x - pend.x, dy = b.y - pend.y, rr = R + pend.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6){
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
          b.x = pend.x + nx * rr; b.y = pend.y + ny * rr;
          const rvx = b.vx - pend.vx, rvy = b.vy - pend.vy, vn = rvx * nx + rvy * ny;
          if (vn < 0){ b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; hit(b, nx, ny, -vn + 2, 'thud'); }
        }
      }

      // trampolín: impulso alegre hacia arriba
      if (b.vy < 0 && Math.abs(b.x - tramp.x) < tramp.half + R * 0.5 &&
          b.y - R < tramp.y + 0.14 && b.y - R > tramp.y - 0.55){
        b.y = tramp.y + 0.14 + R;
        b.vy = Math.min(Math.max(-b.vy * 1.12, 8.5), 12.5);
        b.vx += (Math.random() - 0.5) * 1.6;
        book.fire(b.id, 'feliz', 3, 26, frame);
        b.sq = 1; parts.ring(b.x, tramp.y + 0.2, [1, 0.73, 0.08], 0.5);
        sfx('boing', 0.6);
      }

      // tarjetas del contenido (AABB)
      for (const rc of rects){
        const cx = Math.max(rc.x0, Math.min(b.x, rc.x1));
        const cy = Math.max(rc.y0, Math.min(b.y, rc.y1));
        const dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
        if (d2 < R * R){
          let nx, ny, d = Math.sqrt(d2);
          if (d > 1e-4){ nx = dx / d; ny = dy / d; }
          else {                                        // centro dentro del AABB: empuja por el lado más cercano
            const dl = b.x - rc.x0, dr = rc.x1 - b.x, dbm = b.y - rc.y0, dtp = rc.y1 - b.y;
            const m = Math.min(dl, dr, dbm, dtp);
            nx = m === dl ? -1 : m === dr ? 1 : 0; ny = m === dbm ? -1 : m === dtp ? 1 : 0; d = 0;
          }
          b.x = cx + nx * R; b.y = cy + ny * R;
          const vn = b.vx * nx + b.vy * ny;
          if (vn < 0){
            b.vx -= 1.4 * vn * nx; b.vy -= 1.4 * vn * ny;
            hit(b, nx, ny, -vn, 'thud');
          }
          if (ny > 0.7){                                 // encima de una tarjeta: rueda...
            b.vx *= 0.995;
            // ...y la superficie es sutilmente "convexa": deriva hacia el borde más cercano
            // y acaba cayendo → nada se queda aparcado para siempre (movimiento perpetuo).
            const mid = (rc.x0 + rc.x1) / 2;
            b.vx += (b.x >= mid ? 1 : -1) * 1.1 * DT_STEP;
          }
        }
      }

      // sumidero: recicla por abajo
      if (b.y < -WORLD_H / 2 - 2){
        b.x = (Math.random() - 0.5) * W * 0.92; b.y = WORLD_H / 2 + 1.5;
        b.vx = (Math.random() - 0.5) * 2.5; b.vy = 0; b.sq = 0;
      }
    }

    // bola contra bola
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++){
      const a = balls[i], c = balls[j];
      const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy, rr = R * 2;
      if (d2 < rr * rr && d2 > 1e-6){
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (rr - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0){
          const imp = -0.92 * vn;
          a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny;
          if (imp > 2.6){ hit(a, -nx, -ny, imp * 2, 'pop'); hit(c, nx, ny, imp * 2, 'tick'); }
        }
      }
    }
  }

  // ── interacción: clic en vacío = lanzar · clic cerca de bolas = empujón ─────
  on(host, 'pointerdown', ev => {
    if (ev.target.closest('a,button,input,select,textarea,iframe,nav,[data-ui],[data-solid]')) return;
    const wx = toWX(ev.clientX), wy = toWY(ev.clientY);
    let near = 0;
    for (const b of balls){
      const dx = b.x - wx, dy = b.y - wy, d = Math.hypot(dx, dy);
      if (d < 2.4){
        near++;
        const k = (1 - d / 2.4) * 8.5;
        b.vx += (dx / (d || 1)) * k; b.vy += (dy / (d || 1)) * k + 2.2;
        book.fire(b.id, 'sorpresa', 4, 20, frame);
        b.sq = 1;
      }
    }
    if (near === 0){
      spawn(wx, wy, (Math.random() - 0.5) * 3, 4.2);    // nace con un saltito
      sfx('spawn', 0.7);
    } else {
      parts.ring(wx, wy, [1, 0.85, 0.3], 0.4);
      sfx('push', 0.6);
    }
  });

  // ── bucle (pausa con pestaña oculta; dt fijo con acumulador) ────────────────
  let last = performance.now(), acc = 0, running = true;
  const DT = 1 / 60;
  on(document, 'visibilitychange', () => {
    running = !document.hidden;
    if (running){ last = performance.now(); requestAnimationFrame(loop); }
  });

  function loop(){
    if (!running) return;
    const now = performance.now();
    acc += Math.min((now - last) / 1000, 0.1); last = now;

    if (rectsDirty) refreshRects();
    while (acc >= DT){
      step(DT); acc -= DT; frame++;
      dripT -= DT;
      if (dripT <= 0 && balls.length < CAP){ topSpawn(); dripT = 1.6 + Math.random() * 2.2; }
    }
    for (const b of balls){
      b.sq *= Math.exp(-7 * DT);
      b.g.position.set(b.x, b.y, 0);
      b.g.scale.set(1 + 0.30 * b.sq, 1 - 0.26 * b.sq, 1);
      b.setExpr(book.resolve(b.id, frame));
    }
    parts.update(DT);
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  }

  resize();
  refreshRects();
  requestAnimationFrame(loop);

  //+AG parar de verdad: sin esto quedan el rAF, los listeners y el contexto WebGL vivos detras
  //   de la partida. Se libera tambien la GPU (dispose), que es lo que de verdad pesa en movil.
  return { stop(){
    running = false; ro.disconnect(); off.forEach(f => f());
    scene.traverse(o => { o.geometry && o.geometry.dispose(); o.material && (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    renderer.dispose();
  } };
}
