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
  /*+AG docs/60 F5 (2-ago): la mano era el emoji «dedo hacia arriba» del sistema, o sea que en cada móvil salía una mano
     distinta (y en Windows, gris). Ahora es un dibujo de la casa: mismo idioma que los iconos de sección
     y los premios del Pase (viewBox 24, trazo 2.2, cabos redondos, currentColor). La ALTURA de la caja y la
     animación son las de antes (46 px, coachTap intacto): sube y crece igual y la punta del dedo cae en el
     mismo píxel. Lo único que cambia es el ancho, que antes lo ponía el glifo (63 px) y ahora se fija a 46 —
     la caja era más ancha que alta porque un emoji lo es, no porque hiciera falta.
     Blanca y no dorada a propósito: se apoya justo sobre el halo DORADO del foco, y oro sobre oro no se lee.
     El trazo lleva su propia sombra en el filtro de abajo para que también se lea sobre el botón encendido. */
  #coachHand{ position:fixed; z-index:72; pointer-events:none; display:none; width:46px; height:46px;
    color:#fff; transform-origin:50% 0; filter:drop-shadow(0 5px 10px #000b) drop-shadow(0 0 3px #000c);
    animation:coachTap .85s ease-in-out infinite; }
  #coachHand svg{ display:block; width:100%; height:100%; }
  @keyframes coachTap{
    0%,100%{ transform:translate(-50%,4px) scale(1); }
    50%    { transform:translate(-50%,-12px) scale(1.32); } }
  /*+AG la mano colgada DEBAJO del control no siempre cabe: el caso real es el botón CORRER de Luz Roja, pegado al
     borde inferior de la pantalla, donde a 360x640 la caja de la mano se salía casi entera del viewport y el
     jugador no veía lo que le estaban señalando. Cuando no cabe, la mano se cuelga ENCIMA y se gira 180° para que
     el dedo siga apuntando al botón, igual que el bocadillo ya se despega con .nub-off cuando no cabe. La regla
     es general para los TRES modos: hoy solo la dispara Luz Roja, pero cualquier control pegado al borde de abajo
     (o una pantalla más baja) la necesita en la Carrera y en el Cazador exactamente igual.
     El giro va en el SVG hijo y NO en el contenedor: la propiedad transform del #coachHand es de coachTap
     (translate + scale en cada fotograma) y un transform propio la machacaría. Por eso la variante girada estrena
     su PROPIA animación, espejada en vertical: mismos scale, misma duración y misma curva, con el origen abajo
     para que la punta del dedo —que girada cae en el borde INFERIOR de la caja— se quede clavada donde estaba
     mientras crece, y con los desplazamientos verticales cambiados de signo para que el gesto de tap siga yendo
     HACIA el botón (aquí, hacia abajo). */
  #coachHand.flip{ transform-origin:50% 100%; animation:coachTapFlip .85s ease-in-out infinite; }
  #coachHand.flip svg{ transform:rotate(180deg); }
  @keyframes coachTapFlip{
    0%,100%{ transform:translate(-50%,-4px) scale(1); }
    50%    { transform:translate(-50%,12px) scale(1.32); } }
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

// LA MANO, dibujada aquí y no traída de un fichero: el coach lo monta todo solo (una etiqueta de estilo y
// cuatro nodos) y así sigue siendo UNA importación para los tres motores, sin una imagen que se pueda quedar
// en la caché vieja mientras el módulo ya es nuevo.
// Anatomía, de arriba a abajo: el ÍNDICE apunta al botón —la punta cae en la mitad exacta de la caja, que es
// la vertical del control señalado— y detrás bajan dos nudillos doblados, la palma y el pulgar recogido.
// Cero relleno: solo trazo, como el resto de iconos del juego, para que la mano se lea igual sobre el halo
// dorado del foco que sobre el fondo oscuro del velo.
const HAND = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M9.7 14.9 V4.9 a2.3 2.3 0 0 1 4.6 0 V11.2"/>'
  + '<path d="M14.3 11.4 V10.2 a1.6 1.6 0 0 1 3.2 0 V11.6"/>'
  + '<path d="M17.5 11.8 V11 a1.6 1.6 0 0 1 3.2 0 V15.6 a5.6 5.6 0 0 1-5.6 5.6 H13 a6.2 6.2 0 0 1-4.4-1.8 '
  +   'L4.5 15.1 a1.9 1.9 0 0 1 2.7-2.7 L9.7 14.9"/>'
  + '</g></svg>';

//+AG la altura de la caja de la mano, que es la de #coachHand en el CSS de arriba: la necesita el JS para saber si
//   la mano cabe colgada debajo del control o hay que colgarla encima girada. Si un día cambia el CSS, cambia aquí.
const HAND_H = 46;

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
  const hand = document.createElement('div'); hand.id = 'coachHand'; hand.innerHTML = HAND;
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
      //+AG ¿cabe la mano colgada debajo del botón? Con el CORRER de Luz Roja, pegado al borde inferior, no cabía y
      //   se salía casi entera de la pantalla. Si no cabe, se cuelga ENCIMA (la clase .flip la gira 180° y espeja
      //   su animación, así que el dedo apunta hacia abajo, al botón) y la punta cae 6 px por dentro del borde
      //   superior del control, espejo exacto de los 6 px de siempre por dentro del inferior.
      //   Se decide EN CADA FRAME y con toggle, no con add: place() corre desde tick() y el botón señalado puede
      //   cambiar entre fotogramas (en Luz Roja el target es una función que alterna de lado), así que la mano
      //   tiene que poder volver a su sitio de abajo sin quedarse girada.
      const flip = (r.bottom - 6 + HAND_H) > innerHeight;
      hand.classList.toggle('flip', flip);
      hand.style.left = (r.left + r.width/2) + 'px';
      hand.style.top = (flip ? r.top + 6 - HAND_H : r.bottom - 6) + 'px';
      // el cartel se ancla ENCIMA del control señalado (texto y botón en la misma zona de la vista); se queda
      // aunque la mano ya se haya ido, porque la lección sigue viva hasta que la Sim diga que está hecha.
      //+AG con la mano girada encima, el cartel y la mano se pisaban: ese hueco de 20 px lo ocupa ahora la mano
      //   entera, así que en el caso girado el cartel sube su altura y el orden vertical queda cartel → mano →
      //   botón. Colgada debajo la mano no estorba, y ahí el anclaje no se toca.
      bn.classList.remove('nub-off');
      bn.style.bottom = Math.max(8, innerHeight - r.top + 20 + (flip ? HAND_H : 0)) + 'px'; bn.style.top = 'auto';
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
