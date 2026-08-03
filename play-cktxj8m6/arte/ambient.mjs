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
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
//+AG doc 41 bloque E: CALIBRADO PARA VERTICAL. La web corre esto en una pantalla ancha; en el
//   movil del juego (430x860) el mismo mundo daba bolas gigantes que tapaban a la protagonista y
//   se comian el texto. El mundo se mide en unidades, asi que cambiar su tamaño encoge TODO a la vez
//   (bolas, pegs, pendulo) y de paso las hace caer mas despacio: queda de fondo, que es su trabajo.
//+AG ⚠ 3-ago-2026 · EL MUNDO SE MIDE CON EL LIENZO, NO CON LA VENTANA. Jaime, mirando su portada:
//   «las bolas se atascan... en PC las bolas son muy grandes y en movil no». Lo segundo salia de aqui:
//   MOBILE y PORTRAIT le preguntaban a la VENTANA (matchMedia + innerHeight>innerWidth) cuando el
//   lienzo es SIEMPRE la columna de movil — MEDIDO: en una ventana de 1440x900 el canvas es 460x900.
//   En escritorio la ventana es apaisada, asi que salia el mundo "de web" (alto 12 en vez de 22) y la
//   bola medía 67,5 px contra los 29,5 del movil: un 129% mas grande. Y encima CAP subia a 14 bolas
//   dentro de esa misma columna, que es lo que se ve amontonado.
//   Ahora hay UNA regla, y de ella sale todo lo demas: la bola ocupa siempre el mismo trozo del lado
//   corto del lienzo. Cualquier aparato, cualquier ventana, el mismo fondo.
const R = 0.40;              // radio de bola en unidades de mundo: la vara de medir de todo lo demas
const DIAM_FRAC = 0.0787;    // el DIAMETRO de la bola = 7,87% del lado corto del lienzo (son los 29,5 px del movil de siempre)
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

  //+AG el mundo entero sale del LIENZO: `u` son las unidades de mundo que mide un pixel para que la
  //   bola caiga siempre en DIAM_FRAC del lado corto. El ancho y el alto del mundo son lo que midan
  //   el ancho y el alto del canvas en esas unidades — nadie mas decide el tamaño de nada.
  let W = 10.16, WORLD_H = 22;                         // valores del movil; resize() pone los de verdad
  function medirMundo(){
    const u = 2 * R / (DIAM_FRAC * Math.min(cw(), ch()));
    W = cw() * u; WORLD_H = ch() * u;
  }
  medirMundo();
  //+AG poblacion por SUPERFICIE del mundo, tomando el movil de referencia (10,16 x 22 → 5 bolas).
  //   Antes eran 14 en escritorio: la misma columna con casi el triple de bolas dentro.
  const CAP = Math.max(4, Math.min(12, Math.round(5 * W * WORLD_H / (10.16 * 22))));   // población máxima

  function resize(){
    renderer.setSize(cw(), ch(), false);
    medirMundo();
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
  //+AG estos dos van ARRIBA, y arriba de una columna de movil esta el heroe: solo en lienzo apaisado
  //   (la web). Antes se montaban por !MOBILE, o sea por el ancho de la VENTANA, y aparecian justo en
  //   la portada de escritorio, que es donde Jaime vio el amontonamiento.
  if (cw() > ch()){ peg(0.20, 0.16, 0.22); peg(0.80, 0.14, 0.22); }

  // trampolín (segmento horizontal que impulsa hacia arriba); su medio ancho se fija con el mundo
  const tramp = { fx: 0.5, fy: 0.965, half: 1.3, x: 0, y: 0 };
  const trampMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xfbb915, roughness: 0.35, metalness: 0,
      emissive: 0xfbb915, emissiveIntensity: 0.35 }));
  scene.add(trampMesh);

  // péndulo lento (bola kinemática colgando; empuja con suavidad)
  const pend = { pfx: 0.86, pfy: 0.05, arm: 2.6, r: 0.55, x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0 };
  let pendOn = true;                     // false = no cabe en este lienzo (ver layoutObstacles)
  const pendMesh = new THREE.Mesh(new THREE.SphereGeometry(pend.r, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a5cf0, roughness: 0.35, metalness: 0,
      emissive: 0x6a3ae0, emissiveIntensity: 0.5 }));
  const pendLine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xcdb9f2, transparent: true, opacity: 0.5 }));
  scene.add(pendMesh); scene.add(pendLine);

  //+AG ⚠⚠ AQUI ESTABA EL ATASCO, Y NO ES UNA SOSPECHA: ESTA MEDIDO (tools/prueba-bolas-fondo.mjs).
  //   Los obstaculos se colocan en FRACCIONES del ancho, asi que en una columna estrecha acaban pegados
  //   a la pared dejando un pasillo de 0,05-0,35 unidades... con una bola de 0,80 de diametro. La bola
  //   NO CABE, pero la fisica la mete igual: el peg la empuja hacia fuera, la pared la clava hacia
  //   dentro, y se queda vibrando ahi para siempre (medido: 5 de 9 bolas clavadas 8 s seguidas en PC,
  //   1 de 5 en movil). La regla nueva no tiene termino medio: o por el pasillo pasa una bola con
  //   holgura, o el peg se hunde hasta la pared y deja de haber pasillo — con el centro en la pared,
  //   toda bola queda por dentro del peg y el unico empujon posible es hacia el centro.
  const PASO = 2 * R * 1.5;              // lo que necesita una bola para pasar de verdad, no de milagro
  function sinPasilloTrampa(x, r){
    if (x < 0 && (x - r) - (-W / 2) < PASO) return -W / 2;
    if (x > 0 && (W / 2) - (x + r) < PASO) return  W / 2;
    return x;
  }

  function layoutObstacles(){
    for (const p of pegs){ p.x = sinPasilloTrampa((p.fx - 0.5) * W, p.r); p.y = (0.5 - p.fy) * WORLD_H; p.m.position.set(p.x, p.y, -0.5); p.m.scale.set(p.r, p.r, p.r); }
    tramp.half = W * 0.128;              // el 1,3 de siempre en el mundo del movil, proporcional en cualquier otro
    tramp.x = (tramp.fx - 0.5) * W; tramp.y = (0.5 - tramp.fy) * WORLD_H;
    trampMesh.position.set(tramp.x, tramp.y, -0.5); trampMesh.scale.x = tramp.half * 2;
    pend.px = (pend.pfx - 0.5) * W; pend.py = (0.5 - pend.pfy) * WORLD_H;
    pend.x = pend.px; pend.y = pend.py - pend.arm; pend.vx = 0; pend.vy = 0;   // sin salto en el 1er frame
    //+AG el pendulo atrapaba igual, y ademas se veia: en la columna de movil su bola se sale 1,08 (movil)
    //   y 1,64 (PC) unidades POR FUERA de la pared derecha, o sea que barre justo el pasillo que le queda
    //   a las bolas y de paso cruza la interfaz. Si no cabe entero con holgura, NO SE MONTA: es adorno.
    pendOn = Math.abs(pend.px) + Math.sin(0.85) * pend.arm + pend.r + PASO <= W / 2;
    pendMesh.visible = pendLine.visible = pendOn;
  }

  // ── colliders del DOM: las bolas rebotan en las tarjetas ([data-solid]) ─────
  let rects = [];                                       // AABBs en unidades de mundo
  let rectsDirty = true;
  //+AG 2026-07-27: los [data-solid] cuentan TAMBIEN en movil. El juego es movil-primero y en Resultados el
  //   numerote del puesto lleva data-solid para que ninguna bola se aparque encima (director-de-arte); son
  //   2-3 rects x <=5 bolas, coste ridiculo. La Home no tiene ningun data-solid, asi que alli no cambia nada.
  const solids = [...host.querySelectorAll('[data-solid]')];
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
  let rescates = 0;                      // bolas devueltas arriba por llevar un segundo sin moverse
  const donde = [];                      // y en que punto de la pantalla se quedaron clavadas

  function spawn(x, y, vx, vy){
    if (balls.length >= CAP){                           // recicla la más antigua
      const b = balls.shift(); balls.push(b);
      b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.sq = 0;
      b.rec = 0; b.qf = frame;                          // el vigilante empieza a contarle de cero
      pop(x, y, b.col); return b;
    }
    const color = TEAMS[nextColor++ % TEAMS.length];
    const mesh = makeBall(scene, { color }, R);
    const b = { x, y, vx, vy, sq: 0, id: balls.length, col: sat(color), rec: 0, qf: frame, ...mesh };
    balls.push(b); pop(x, y, b.col);
    return b;
  }
  function pop(x, y, col){ parts.burst(x, y, 0.2, col, 10, 2.2); }
  function topSpawn(){
    spawn((Math.random() - 0.5) * W * 0.92, WORLD_H / 2 + 1 + Math.random(),
      (Math.random() - 0.5) * 2.5, 0);
  }

  // población inicial (repartida por la pantalla, cayendo ya) + goteo para reponer
  //+AG ⚠ el reparto iba en unidades FIJAS (±9 de ancho, y entre 1 y 9) heredadas del mundo ancho de la
  //   web. En la columna del juego el mundo mide 10,16 de ancho: media poblacion nacia FUERA de las
  //   paredes y el primer frame la clavaba de golpe contra el canto, todas juntas. Va en fracciones del
  //   mundo real, que es lo unico que vale cuando el mundo lo mide el lienzo.
  const N0 = Math.max(3, CAP - 1);
  for (let i = 0; i < N0; i++){
    spawn((Math.random() - 0.5) * W * 0.82, WORLD_H * (0.05 + Math.random() * 0.4),
          (Math.random() - 0.5) * 2.5, -Math.random() * 2);
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
    // péndulo kinemático (solo si cabe en este lienzo)
    if (pendOn){
      const ang = Math.sin(performance.now() * 0.00045) * 0.85;
      const npx = pend.px + Math.sin(ang) * pend.arm, npy = pend.py - Math.cos(ang) * pend.arm;
      pend.vx = (npx - pend.x) / dt; pend.vy = (npy - pend.y) / dt;
      pend.x = npx; pend.y = npy;
      pendMesh.position.set(pend.x, pend.y, -0.4);
      pendLine.position.set((pend.px + pend.x) / 2, (pend.py + pend.y) / 2, -0.6);
      pendLine.scale.y = pend.arm; pendLine.rotation.z = ang;
    }

    for (const b of balls){
      const ox = b.x, oy = b.y;          // para el cuentakilometros del vigilante (ver el bucle)
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
      if (pendOn){
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
            //+AG ⚠ POR ARRIBA NO REBOTA (1.0 = aterrizaje muerto), Y LA RAZON ESTA MEDIDA. Con el 1,4
            //   de los lados, la bola que cae sobre el techo del heroe da botes EN EL SITIO; y como la
            //   deriva que la echa del borde solo actua mientras toca, botando casi no la empuja: 3 s
            //   dando saltitos encima de la cabeza del protagonista. Aterrizando muerta toca todos los
            //   frames, la deriva actua siempre y cruza y cae en poco mas de un segundo. De lado sigue
            //   rebotando como antes: ahi el rebote es lo que la aparta de la tarjeta.
            const reb = ny > 0.7 ? 1.0 : 1.4;
            b.vx -= reb * vn * nx; b.vy -= reb * vn * ny;
            hit(b, nx, ny, -vn, 'thud');
          }
          if (ny > 0.7){                                 // encima de una tarjeta: rueda...
            b.vx *= 0.995;
            // ...y la superficie es sutilmente "convexa": deriva hacia el borde más cercano
            // y acaba cayendo → nada se queda aparcado para siempre (movimiento perpetuo).
            //+AG ⚠ 3-ago-2026: "acaba cayendo" era verdad y aun asi estaba MAL. Con 1,1 la bola sale
            //   rodando a medio metro por segundo y la tarjeta del heroe mide 7,1 de ancha: MEDIDO, se
            //   quedaba hasta 5 s paseandose por encima de la cabeza del protagonista, que es la mitad
            //   de las "cosas raras" que se ven en la portada. Con 4,5 cruza y cae en algo mas de un
            //   segundo. No es una constante mas suelta: la vigila el banco, que mira cuanto aguanta
            //   una bola posada en una tarjeta y se pone rojo pasados 3 s.
            const mid = (rc.x0 + rc.x1) / 2;
            b.vx += (b.x >= mid ? 1 : -1) * 4.5 * DT_STEP;
          }
        }
      }

      b.rec += Math.hypot(b.x - ox, b.y - oy);       // ⚠ ANTES del sumidero: si no, el salto de reciclar
                                                     //   se contaria como camino andado y taparia el atasco
      // sumidero: recicla por abajo
      if (b.y < -WORLD_H / 2 - 2){
        b.x = (Math.random() - 0.5) * W * 0.92; b.y = WORLD_H / 2 + 1.5;
        b.vx = (Math.random() - 0.5) * 2.5; b.vy = 0; b.sq = 0;
        b.rec = 0; b.qf = frame;         // vuelve a nacer: el vigilante le cuenta desde cero
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
    //+AG ⚠ LA RED DE SEGURIDAD, Y POR QUE SE CUENTA. Los pasillos imposibles ya no existen, pero una
    //   bola tambien se puede quedar clavada por cosas que no dependen de esta fisica: una tarjeta
    //   [data-solid] que llegue casi hasta el canto, un apilamiento contra el suelo, una pantalla que
    //   cambia de tamaño. Esto es DECORADO: una bola congelada en la portada se ve fatal, asi que se
    //   mira quien lleva tres segundos sin andar y se le devuelve arriba. Ahora bien, tapar el sintoma sin
    //   que se entere nadie es como se pierden los fallos: cada rescate SE CUENTA y sale en debug(), y
    //   el banco (tools/prueba-bolas-fondo.mjs) se pone ROJO si hay uno. La red salva al jugador, no al
    //   codigo.
    //   Cada bola lleva SU reloj (qf) y no el del mundo: con un reloj global, una bola que acaba de
    //   nacer arriba llegaba al control habiendo caido cuatro dedos y se "rescataba" sola.
    //+AG ⚠ SE MIDE EL CAMINO ANDADO, NO LA DISTANCIA ENTRE DOS FOTOS, Y LAS DOS COSAS ESTAN MEDIDAS.
    //   Primer intento (1 s entre fotos): 11 rescates en 25 s a bolas que iban rodando tan tranquilas
    //   por encima de una tarjeta. Segundo (3 s entre fotos): seguia cazando a una que pasaba a 3,7 de
    //   velocidad y que casualmente volvio cerca de donde estaba. Una foto cada X segundos no distingue
    //   "no se ha movido" de "ha ido y ha vuelto". El cuentakilometros si: una bola clavada no anda
    //   camino ninguno, pase lo que pase alrededor.
    for (const b of balls){
      if (frame - b.qf < 180) continue;             // 3 s: por debajo de eso, no es un atasco, es una pausa
      if (b.rec < 1.2){                             // menos de bola y media de camino en tres segundos
        rescates++;
        //+AG el SITIO del atasco, no solo la cuenta: "hay 2 rescates" no se puede arreglar, "se clavan
        //   en el 0,86 de ancho y el 0,58 de alto" se va y se mira que hay ahi. Se guardan en fraccion
        //   de pantalla, que es como se buscan las cosas mirando la Home.
        donde.push({ fx: +((b.x / W) + 0.5).toFixed(3), fy: +(0.5 - (b.y / WORLD_H)).toFixed(3),
                     vx: +b.vx.toFixed(2), vy: +b.vy.toFixed(2),
                     vecinas: balls.filter(o => o !== b && Math.hypot(o.x - b.x, o.y - b.y) < R * 2.4).length });
        if (donde.length > 12) donde.shift();
        b.x = (Math.random() - 0.5) * W * 0.82; b.y = WORLD_H / 2 + 1.5;
        b.vx = (Math.random() - 0.5) * 2.5; b.vy = 0; b.sq = 0;
        pop(b.x, b.y, b.col);
      }
      b.rec = 0; b.qf = frame;                      // empieza otro tramo
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
  },
  //+AG SONDA DE MEDIDA (la lee tools/prueba-bolas-fondo.mjs). Nace de un fallo que se veia a simple
  //   vista y no se podia medir: "las bolas se atascan y en PC son el doble de grandes". De fuera solo
  //   se ve un canvas pintado; el tamano real de una bola y si lleva 10 s sin moverse viven aqui dentro.
  //   No calcula nada nuevo — asoma el estado tal cual — asi que no puede mentir sobre lo que pasa.
  debug(){ return { W, WORLD_H, R, CAP, cw: cw(), ch: ch(), rescates, donde: donde.slice(),
    rects: rects.map(r => ({ x0: +r.x0.toFixed(2), x1: +r.x1.toFixed(2), y0: +r.y0.toFixed(2), y1: +r.y1.toFixed(2) })),
    pxPorUnidad: ch() / WORLD_H,                        // con esto, diametro en pantalla = 2*R*pxPorUnidad
    balls: balls.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
    pegs: pegs.map(p => ({ x: p.x, y: p.y, r: p.r })),
    pend: { x: pend.x, y: pend.y, r: pend.r, px: pend.px, arm: pend.arm, on: pendOn } }; } };
}
