// COACH del tutorial "CÓMO JUGAR" — capa de enseñanza compartida por los 3 modos (race, redlight, cazador).
//
// Por qué vive aquí y no en cada index.html: los tres motores necesitan EXACTAMENTE el mismo comportamiento de
// tutorial (v2, feedback de Jaime 2026-07-24) y triplicarlo garantizaba que se desincronizara al primer retoque.
// Cada motor solo aporta su LISTA DE PASOS y cómo pausar su bucle; todo lo visual y la máquina de estados vive aquí.
//
// Lenguaje de tutorial (patrón Clash Royale / Supercell, que es lo que pidió el dueño):
//   1) FOCO: velo oscuro sobre TODO el juego con un agujero exacto en el control que toca pulsar (box-shadow de
//      spread gigante = el clásico spotlight de una sola caja, sin máscaras ni pelearse con los stacking contexts
//      de cada motor: el botón real ni se toca ni cambia de z-index, y el velo no intercepta el tap).
//   2) MANO: un dedo apuntando al botón, que sube y crece en bucle. NO se va hasta que la lección está hecha.
//   3) TEXTO JUNTO AL BOTÓN: el cartel se ancla justo encima del control señalado (antes vivía arriba del todo y
//      obligaba a mirar a un lado y tocar en el otro).
//   4) PAUSA: en los pasos de botón el mundo se CONGELA mientras lees. Se reanuda con tu primera interacción (tap
//      o tecla) para que veas el efecto en movimiento. Los pasos "de mundo" (cruzar la meta, aguantar en rojo,
//      observar al cazador) NO pausan: ahí la lección es justamente ver el juego vivo.
//
// La Sim NO se toca desde aquí: los pasos solo LEEN su estado. El nivel sin peligro lo pone cada sim con su
// opts.tutorial (no-op sin el flag).

const CSS = `
  #coachVeil{ position:fixed; z-index:70; pointer-events:none; border-radius:16px; display:none;
    animation:coachPulse .85s ease-in-out infinite; }
  /* tres capas a propósito: filo BLANCO (recorta el botón del fondo), halo DORADO cercano (el "está encendido")
     y un resplandor ancho y suave (lo saca del juego, que es lo que pedía el dueño: que no parezca del juego). */
  @keyframes coachPulse{
    0%,100%{ box-shadow:0 0 0 4px #fff, 0 0 34px 12px #ffd700d0, 0 0 70px 26px #ffd70055, 0 0 0 9999px rgba(3,7,18,.82); }
    50%    { box-shadow:0 0 0 7px #fff, 0 0 54px 20px #ffd700, 0 0 110px 44px #ffd70077, 0 0 0 9999px rgba(3,7,18,.82); } }
  #coachHand{ position:fixed; z-index:72; pointer-events:none; display:none; font-size:46px; line-height:1;
    transform-origin:50% 0; filter:drop-shadow(0 5px 10px #000b); animation:coachTap .85s ease-in-out infinite; }
  @keyframes coachTap{
    0%,100%{ transform:translate(-50%,4px) scale(1); }
    50%    { transform:translate(-50%,-12px) scale(1.32); } }
  /*+AG doc 60 F4: el bocadillo del coach lleva el TRÍO de marca (blanco + trazo indigo .11em = 11 % del
     cuerpo + sombra corta, con paint-order:stroke fill obligatorio), el mismo token que los HUD y los
     carteles. NO se pone en mayúsculas a propósito: aquí el texto es una FRASE ("Pulsa ◀ IZQUIERDA: tu
     bola deriva hacia ese lado"), y docs/60 regla 10 deja Sentence case justo para las frases largas. */
  #coach{ position:fixed; z-index:73; left:50%; transform:translateX(-50%); max-width:min(92vw,540px);
    background:#0b1526f2; border:2px solid #ffd700; border-radius:16px; padding:11px 16px; text-align:center;
    font-weight:900; font-size:clamp(15px,3.8vw,19px); color:#fff; box-shadow:0 8px 28px #000c; pointer-events:none;
    letter-spacing:.01em; -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill; text-shadow:0 2px 0 #241a3f66;
    display:none; }
  #coach:after{ content:''; position:absolute; left:50%; bottom:-9px; width:14px; height:14px; margin-left:-7px;
    background:#0b1526; border-right:2px solid #ffd700; border-bottom:2px solid #ffd700; transform:rotate(45deg); }
  #coach.nub-off:after{ display:none; }
  /*+AG el ORO del contador de pasos se queda (es el color del sistema del coach): solo gana el contorno. */
  #coach .cnum{ display:block; font-size:11px; font-weight:800; color:#ffd700; letter-spacing:.08em; margin-bottom:3px;
    -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill; text-shadow:0 2px 0 #241a3f66; }
  #coachExit{ position:fixed; top:10px; left:10px; z-index:74; border:1px solid #ffffff3a; border-radius:10px;
    background:#0b1526e6; color:#fff; font-family:inherit; font-weight:800; font-size:13px; padding:7px 12px; cursor:pointer;
    text-transform:uppercase; letter-spacing:.02em;
    -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill; text-shadow:0 2px 0 #241a3f66; }
`;

// cfg:
//   mode        'race' | 'redlight' | 'cazador' — viaja en el bt:tutorialEnd que recibe el shell
//   steps       [{ target:'idDelBoton'|()=>'idDelBoton'|null, pause:true|false, linger?:segundos, enter?:fn, check:(dt)=>bool }]
//               target como función = se reevalúa cada frame (el botón correcto puede depender del estado del nivel)
//               linger = segundos que el mundo sigue CORRIENDO (sin velo ni mano) tras acertar, antes de pasar al
//               siguiente paso. Imprescindible en los pasos de un toque: sin él, pulsas → acierta al instante →
//               el paso siguiente vuelve a congelar, y no llegas a VER lo que hace el nitro/el dash/el frenazo.
//   i18n        { en:{exit,done,steps:[…]}, es:{…} } — fallback a en
//   lang        ()=>'es'  (el idioma vivo del motor)
//   isPlaying   ()=>bool  (la ronda está corriendo: ni menú ni cuenta atrás)
//   setPaused   (bool)=>void  (congela/descongela el paso de sim del motor)
//   beforeCheck (si)=>bool  opcional; true = re-entrar al paso actual (race lo usa para relanzar la bajada)
export function createCoach(cfg){
  const { mode, steps, i18n, lang, isPlaying, setPaused } = cfg;
  const L = () => i18n[lang()] || i18n.en;

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const veil = document.createElement('div'); veil.id = 'coachVeil';
  const hand = document.createElement('div'); hand.id = 'coachHand'; hand.textContent = '👆';
  const bn   = document.createElement('div'); bn.id = 'coach';
  const exit = document.createElement('button'); exit.id = 'coachExit';
  document.body.append(veil, hand, bn, exit);
  const end = completed => { try{ parent.postMessage({ type:'bt:tutorialEnd', mode, completed }, '*'); }catch(e){} };
  exit.onclick = () => { setPaused(false); end(false); };

  let si = -1, finished = false, paused = false, targetSrc = null, target = null, cueHidden = false, lingerT = 0;
  //+AG target puede ser una FUNCIÓN: hay lecciones cuyo botón correcto depende del nivel (en Luz Roja, el hueco del
  //   muro alterna de lado, así que señalar ◀ siempre te mandaba contra el muro). Se reevalúa cada frame y, si el
  //   botón bueno cambia, la mano vuelve a salir (aunque ya hubieras tocado el anterior).
  const resolveTarget = () => { const t = typeof targetSrc === 'function' ? targetSrc() : targetSrc; return t || null; };

  // DOS cosas distintas, a propósito:
  //   · el mundo se descongela con CUALQUIER interacción (tap donde sea o tecla). Es la red de seguridad: nunca
  //     se puede quedar el tutorial atascado esperando un botón que el jugador no encuentra.
  //   · la MANO y el FOCO solo se quitan cuando toca EL BOTÓN SEÑALADO (o pulsa una tecla, que es el camino de
  //     teclado). Si toca en otro sitio, el mundo sigue pero la mano se queda apuntando: sigue guiado.
  function acted(ev){
    if(paused){ paused = false; setPaused(false); }
    const t = target && document.getElementById(target);
    if(t && (ev.type === 'keydown' || t.contains(ev.target))) cueHidden = true;
  }
  addEventListener('pointerdown', acted, true);
  addEventListener('keydown', acted, true);

  function place(){
    const nt = resolveTarget();
    if(nt !== target){ target = nt; cueHidden = false; }
    const t = target && document.getElementById(target);
    const r = t ? t.getBoundingClientRect() : null;
    if(r && r.width > 0){
      const pad = 7;
      //+AG display EXPLÍCITO, nunca '': con '' vuelve a la regla base (display:none) y no se ve nada (ya nos pasó
      //   con el "← Menu" del cartel de fin de la Carrera).
      veil.style.display = hand.style.display = cueHidden ? 'none' : 'block';
      veil.style.left = (r.left - pad) + 'px'; veil.style.top = (r.top - pad) + 'px';
      veil.style.width = (r.width + pad*2) + 'px'; veil.style.height = (r.height + pad*2) + 'px';
      hand.style.left = (r.left + r.width/2) + 'px'; hand.style.top = (r.bottom - 6) + 'px';
      // el cartel se ancla ENCIMA del control señalado (texto y botón en la misma zona de la vista); se queda
      // aunque la mano ya se haya ido, porque la lección sigue viva hasta que la Sim diga que está hecha.
      bn.classList.remove('nub-off');
      bn.style.bottom = Math.max(8, innerHeight - r.top + 20) + 'px'; bn.style.top = 'auto';
    } else {
      veil.style.display = hand.style.display = 'none';
      bn.classList.add('nub-off');
      bn.style.top = '64px'; bn.style.bottom = 'auto';
    }
  }

  function showStep(i){
    si = i; const s = steps[i]; cueHidden = false; lingerT = 0;
    if(s.enter) s.enter();                     // primero enter() (puede fijar el estado que decide el botón), luego el target
    targetSrc = s.target || null; target = resolveTarget();
    bn.style.display = 'block';
    bn.innerHTML = '<span class="cnum">' + (i+1) + '/' + steps.length + '</span>' + L().steps[i];
    paused = !!s.pause && !!target;
    setPaused(paused);
    place();
  }

  function finish(){
    finished = true; target = null; paused = false; setPaused(false);
    veil.style.display = hand.style.display = 'none'; bn.classList.add('nub-off');
    bn.style.top = '64px'; bn.style.bottom = 'auto';
    bn.innerHTML = '<span class="cnum">' + steps.length + '/' + steps.length + '</span>' + L().done;
    setTimeout(() => end(true), 2000);
  }

  let lastT = performance.now();
  function tick(){
    if(finished) return;
    requestAnimationFrame(tick);
    const now = performance.now(), dt = Math.min(0.1, (now - lastT)/1000); lastT = now;
    exit.textContent = L().exit;
    if(cfg.onTick) cfg.onTick();
    if(!isPlaying()){ if(paused){ paused = false; setPaused(false); } return; }
    if(si < 0){ showStep(0); return; }
    place();
    if(cfg.beforeCheck && cfg.beforeCheck(si)){ showStep(si); return; }
    const next = () => si+1 < steps.length ? showStep(si+1) : finish();
    // ventana de "míralo": el mundo corre, sin velo ni mano, para que se vea el efecto de lo que acaba de pulsar
    if(lingerT > 0){ lingerT -= dt; if(lingerT <= 0) next(); return; }
    if(paused) return;                       // congelado: nada progresa hasta que el jugador toca
    if(steps[si].check(dt)){
      const lg = steps[si].linger || 0;
      if(lg > 0){ lingerT = lg; cueHidden = true; if(paused){ paused = false; setPaused(false); } }
      else next();
    }
  }
  requestAnimationFrame(tick);
}
