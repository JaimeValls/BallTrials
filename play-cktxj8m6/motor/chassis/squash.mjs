// YouBall · SQUASH & STRETCH + "fisica de bola 3D en 2D" compartido (docs/41). SOLO VISUAL: no toca
// sim, ni seeds, ni QA, ni audio. Todo lo que hace, por frame y por bola:
//   1) ESTIRADO por velocidad: la bola se alarga hacia donde se mueve, conservando volumen.
//   2) APLASTADO por impacto (EXAGERADO, x3 v2): muelle amortiguado en el eje real del golpe.
//   3) INCLINACION (tilt): la bola se ladea unos grados hacia donde va (ajustable, opts.tilt).
//   4) CARA VIVA: nunca rota sola (legibilidad) pero se deforma (faceK), se DESPLAZA hacia el punto
//      del golpe (faceMove), lidera el movimiento (lead), hace POP al cambiar de expresion, y si la
//      cara es un makeFaceRig: los OJOS MIRAN hacia la direccion del movimiento/rebote (setGaze)
//      y se animan los FX por expresion (tick).
//   5) VFX enchufables: opts.wind (createWindTrail) emite rafagas al ir rapido; opts.stars
//      (createStarBurst) dispara estrellitas en el ORIGEN de la colision, escaladas por la fuerza.
// Se alimenta de las posiciones que el modo ya pinta (deriva velocidad por diferencias) MAS los kicks
// o.squash que los modos ya disparan en sus eventos afinados: no se pierde tuning.
// Capa de RENDER: aqui SI se permite Math.sin/cos/atan2 (la regla anti-Math es solo de la sim).
// Determinista en captura: usar el dt del reloj por frame del modo, nunca performance.now.

const POP_T = 0.14;                     // duracion del pop de cambio de expresion (s)

// o = bola de makeBall (necesita o.g, o.body, o.face.plane, o.face.expr, o.setExpr, o.squash).
// opts.vRef    = velocidad "rapida" tipica del modo (normaliza estirado, gaze, tilt y viento).
// opts.impact  = multiplicador del aplastado por golpe (3 = exagerado x3, v2).
// opts.tilt    = inclinacion maxima hacia el movimiento, en RADIANES (0.17 ~ 10 grados). Ajustable.
// opts.faceK   = cuanta deformacion hereda la cara (0..1.2). opts.faceMove = cuanto se desplaza hacia el golpe.
// opts.wind    = handle de createWindTrail (o null). opts.stars = handle de createStarBurst (o null).
// opts.starK   = escala de la fuerza que llega a las estrellas de impacto.
// Defaults = JSON aprobado por el dueno en el lab (2026-07-04): estirado generoso, impacto x2.
export function attachSquash(o, { R = 0.5, vRef = 20, stretchMax = 0.28, impact = 2.0, tilt = 0.17,
  faceK = 0.8, faceMove = 0.16, lead = 0.10, pop = true, wind = null, stars = null, starK = 1.0 } = {}){
  const st = { init: false, px: 0, py: 0, pvx: 0, pvy: 0, th: 0, tl: 0, s: 0, sv: 0, pop: 0, lx: 0, ly: 0, acc: 0, lastKick: 0 };
  const opts = { R, vRef, stretchMax, impact, tilt, faceK, faceMove, lead, pop, wind, stars, starK };
  o.sqOpts = opts;                       // expuesto para el lab (_look.html) y ajustes por modo

  {                                      // envolver setExpr: pop SOLO en cambios visibles "de verdad"
    const orig = o.setExpr;              // (se consulta opts.pop al disparar -> se puede apagar en vivo)
    o.setExpr = (name) => {
      const prev = o.face.expr;
      if (opts.pop && name !== prev && name !== 'blink' && prev !== 'blink'
          && !(String(name).startsWith('conc') && String(prev).startsWith('conc'))) st.pop = POP_T;
      orig(name);
    };
  }

  // Llamar UNA vez por frame de render con la posicion que se va a pintar y el dt del reloj por frame.
  function update(x, y, dt){
    if (!(dt > 0)) dt = 1 / 60;
    if (!st.init){ st.init = true; st.px = x; st.py = y; return; }
    const vx = (x - st.px) / dt, vy = (y - st.py) / dt;
    st.px = x; st.py = y;
    const sp = Math.sqrt(vx * vx + vy * vy);
    if (sp > opts.vRef * 6){             // teletransporte (respawn/celebracion): reset silencioso, sin deformar
      st.pvx = vx; st.pvy = vy; st.s = 0; st.sv = 0; return;
    }
    // impacto AUTO: pico de cambio de velocidad (cubre rebotes sin evento); los eventos siguen mandando via o.squash
    const dvx = vx - st.pvx, dvy = vy - st.pvy, dv = Math.sqrt(dvx * dvx + dvy * dvy);
    st.pvx = vx; st.pvy = vy;
    let kick = 0;
    if (dv > opts.vRef * 0.45){
      kick = Math.min(1, dv / (opts.vRef * 2.2)) * 0.8;
      // estrellitas cartoon en el ORIGEN de la colision: contacto = borde de la bola contra la superficie
      // (dv apunta ALEJANDOSE de la superficie) y fuerza proporcional a la velocidad del golpe
      if (opts.stars && kick > 0.28){
        const iv = 1 / dv, ux = dvx * iv, uy = dvy * iv;
        opts.stars.burst(x - ux * opts.R, y - uy * opts.R, kick * opts.starK, opts.R, ux, uy);
      }
    }
    if (o.squash > 0){ kick = Math.max(kick, o.squash); o.squash = 0; }   // kick de EVENTO del modo (se consume aqui)
    //+AG doc 55: se APARCA el golpe de este frame para que lo lea el accesorio mas abajo (el
    //   sombrero del Vaquero salta al rebotar). Aqui ya esta resuelto lo dificil —fuerza
    //   normalizada 0..1, contacto y normal— y era informacion que moria en esta closure.
    st.lastKick = kick;
    if (kick > 0){ st.s -= kick * 0.42 * opts.impact; st.sv -= kick * 2.0 * opts.impact; }
    // muelle amortiguado (sub-critico: un sobre-rebote y asienta en ~0.3 s)
    const W = 24, Z = 0.5;
    st.sv += (-W * W * st.s - 2 * Z * W * st.sv) * dt;
    st.s += st.sv * dt;
    if (st.s < -0.62) st.s = -0.62; else if (st.s > 0.5) st.s = 0.5;
    // estirado continuo por velocidad (curva suave, tope stretchMax)
    const k = Math.min(1, sp / opts.vRef);
    const str = opts.stretchMax * Math.pow(k, 1.35);
    // eje de deformacion = direccion de movimiento, suavizada por el camino corto (sin volteos)
    const thPrev = st.th;
    if (sp > opts.vRef * 0.12){
      const tg = Math.atan2(vy, vx);
      const da = Math.atan2(Math.sin(tg - st.th), Math.cos(tg - st.th));
      st.th += da * Math.min(1, 10 * dt);
    }
    const av = Math.atan2(Math.sin(st.th - thPrev), Math.cos(st.th - thPrev)) / dt;   // giro del rumbo (rad/s) -> curva el viento
    // TILT: ladea la bola ENTERA (cara incluida, como un personaje que se inclina) hacia el movimiento
    const tt = -Math.max(-1, Math.min(1, vx / opts.vRef)) * opts.tilt;   // derecha = horario (z negativo)
    st.tl += (tt - st.tl) * Math.min(1, 8 * dt);
    o.g.rotation.z = st.tl;
    const a = Math.max(-0.62, Math.min(0.5, str + st.s));
    const along = 1 + a, perp = 1 / Math.sqrt(along);   // volumen "visual": la panza extra se reparte en pantalla
    o.body.rotation.z = st.th - st.tl;   // eje en MUNDO: compensa el tilt del grupo
    // z SIEMPRE 1: la esfera JAMAS engorda hacia camara, asi NUNCA atraviesa el plano de la cara (z=1.06R).
    // En cenital ortografica la z no cambia la silueta; solo suaviza un pelin el sombreado al aplastar.
    o.body.scale.set(along, perp, 1);
    // cara: derecha SIEMPRE; hereda la deformacion proyectada en pantalla (faceK) y...
    const c = Math.cos(st.th), s = Math.sin(st.th), c2 = c * c, s2 = s * s;
    let fx = 1 + ((along - 1) * c2 + (perp - 1) * s2) * opts.faceK;
    let fy = 1 + ((along - 1) * s2 + (perp - 1) * c2) * opts.faceK;
    if (st.pop > 0){ const p = 1 + 0.09 * Math.sin((1 - st.pop / POP_T) * Math.PI); fx *= p; fy *= p; st.pop -= dt; }
    o.face.plane.scale.set(fx, fy, 1);
    // ...se DESPLAZA: hacia el punto del golpe cuando aplasta (faceMove) + liderando el movimiento (lead)
    const sqOff = st.s < 0 ? -st.s * opts.faceMove * opts.R : 0;
    const tx = Math.max(-1, Math.min(1, vx / opts.vRef)) * opts.R * opts.lead + c * sqOff;
    const ty = Math.max(-1, Math.min(1, vy / opts.vRef)) * opts.R * opts.lead + s * sqOff;
    const lk = Math.min(1, 12 * dt);
    st.lx += (tx - st.lx) * lk; st.ly += (ty - st.ly) * lk;
    o.face.plane.position.x = st.lx; o.face.plane.position.y = st.ly;
    // OJOS que miran a donde va la bola (solo si la cara es un makeFaceRig). Convenio del atlas: +y = ABAJO.
    if (o.face.setGaze) o.face.setGaze(1.4 * vx / opts.vRef, -1.4 * vy / opts.vRef);
    if (o.face.tick) o.face.tick(dt);
    //+AG doc 55: el ACCESORIO tambien respira. Va justo detras de la cara y con la misma forma
    //   (duck-typing con guarda) porque comparte todo lo que importa: el mismo dt del reloj de
    //   render del modo, y el mismo sitio del frame. `o.prop` solo existe si llego `arch`
    //   (gfx.makeBallVinyl), asi que sin arch esta linea no hace nada y el motor no se mueve.
    //   Se le pasa el estado que ya esta calculado aqui y que ninguna capa de fuera conoce:
    //   k = velocidad normalizada 0..1, y el kick del impacto de ESTE frame.
    if (o.prop && o.prop.userData.tick) o.prop.userData.tick(dt, k, st.lastKick);
    st.lastKick = 0;                       // se consume: un impacto dispara UNA vez, no cada frame
    // TRAIL DE VIENTO al ir rapido: PAREJAS de rafagas por detras de la bola, espaciadas por distancia;
    // cada rafaga hereda el giro del rumbo (av) -> el viento se CURVA siguiendo la trayectoria
    if (opts.wind && k > 0.45){
      st.acc += sp * dt;
      const step = opts.R * 1.1;
      const ux = c, uy = s;                                  // direccion de movimiento (eje suavizado)
      while (st.acc > step){
        st.acc -= step;
        opts.wind.spawn(x - ux * opts.R * 1.05, y - uy * opts.R * 1.05, st.th, k, opts.R, vx, vy, av);
      }
    } else st.acc = 0;
  }
  o.sqUpdate = update;
  return o;
}
