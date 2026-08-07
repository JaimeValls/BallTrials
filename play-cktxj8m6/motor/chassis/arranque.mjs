// ARRANQUE · el ritual de empezar una partida — cartel del modo ("¿LISTO?") + cuenta atrás CON SONIDO.
// Capa compartida por los 3 motores (race, cazador, redlight), igual que coach.mjs: aquí vive TODO lo visual,
// la máquina de estados y los sonidos; cada motor solo aporta su idioma, su nombre de modo y cuándo arrancar.
//
// POR QUÉ EXISTE (feedback Jaime 2026-07-26, sobre la partida ya en producción):
//   1) SIN CLIC NO HAY SONIDO. WebAudio exige un gesto DENTRO del iframe: el tap de JUGAR ocurre en el shell
//      (otro documento) y no cuenta. Hasta hoy el desbloqueo colgaba del primer input DE JUEGO, así que quien
//      no tocaba nada jugaba la partida entera en silencio — y la cuenta atrás era muda SIEMPRE, porque pasa
//      antes de cualquier input posible. El cartel mete un tap en medio: si lo das, suena; si no, se juega igual.
//   2) NADIE DECÍA QUÉ MODO ERA. Cazador y Luz Roja abrían directamente en 3-2-1; la Carrera abría en su portada
//      de standalone (otro botón "Jugar" + selector de idioma) que el shell ya había resuelto — pantalla muerta.
//   3) LA INTRO IBA DEMASIADO RÁPIDA. Patrón Brawl Stars: primero el cartel del modo con el objetivo en UNA frase
//      y tiempo para leerlo, y después la cuenta atrás — que ahora respira más por cifra y suena.
//
// REGLAS QUE NO SE ROMPEN AQUÍ:
//   · NO BLOQUEA: el cartel se auto-arranca (autoSec). Sin gesto no hay audio — límite del navegador, no nuestro —
//     pero la partida empieza igual y el motor sigue teniendo su red de seguridad (desbloqueo al primer input).
//   · NO TOCA LA SIM: el cartel vive en la capa de agencia. La ronda se construye igual y arranca en f=0.
//   · UN SOLO LENGUAJE DE "PÚLSAME": el CTA usa el mismo oro del motor (#bSup.ready / #ovBtn), no inventa brillos.
//   · CABE EN EL MÓVIL SIN DESLIZAR: todo el cartel se mide en vh/vw y el texto se recorta con line-clamp.

import { createSynth, makeRng, peakGain } from './synth.mjs?v=ca14cba';
import { PAUSA } from './pausa.mjs?v=ca14cba';   //+AG "el mundo no se mueve": el cartel tampoco se auto-arranca (ver tick)

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  TEXTOS · en+es con fallback a INGLÉS, igual que el SHELL y que los motores de Cazador/Luz Roja
//  (la Carrera tiene sus 9 idiomas porque ya los tenía: su nombre de modo entra por cfg.title).
//  El OBJETIVO es una frase, en imperativo, sin jerga: es lo único que lee quien no ha hecho el tutorial.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const TXT = {
  //+AG escHint (3-ago-2026): «Esc para salir». Solo se pinta donde hay teclado (lo decide refresh()) y
  //   solo en este cartel, que es el momento en que el jugador esta leyendo y no jugando. Existe porque
  //   docs/71 dio a Escape el papel de atras del ordenador y nadie se lo estaba contando a nadie.
  en: { kicker:'MODE', ready:'READY!', auto:n=>`starts on its own in ${n}`, tapHint:'tap for sound', escHint:'Esc to quit',
    name:{ race:'The Great Race', cazador:'The Hunter', redlight:'Red Light' },
    goal:{ race:'Roll down and reach the FINISH before anyone else.',
           cazador:'Dodge the HUNTER. Last ball standing wins.',
           redlight:'Run on GREEN, freeze on RED. Get caught moving and you are out.' } },
  es: { kicker:'MODO', ready:'¡LISTO!', auto:n=>`empieza sola en ${n}`, tapHint:'toca para tener sonido', escHint:'Esc para salir',
    name:{ race:'La Gran Carrera', cazador:'El Cazador', redlight:'Luz Roja' },
    goal:{ race:'Baja por la pista y llega a la META antes que nadie.',
           cazador:'Esquiva al CAZADOR. Gana la última bola en pie.',
           redlight:'Corre en VERDE, congélate en ROJO. Si te pillan moviéndote, fuera.' } },
};

const CSS = `
  /*+AG Fredoka (biblia de marca docs/27 §3) igual que el shell: el cartel es la CONTINUACIÓN de su pantalla de
     JUGAR, así que comparte tipografía. Ya está en la caché del navegador (el shell la pidió antes), y si no
     carga cae al mismo stack redondo que el resto del motor. */
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');
  /*+AG el velo va teñido de INDIGO (--indigo #241159 de la biblia, docs/27), no a casi-negro: con
     rgba(4,6,14,.88) el cartel se leía como "otro juego móvil oscuro cualquiera" al lado de la portada
     de balltrials.com (auditoría de arte 2026-07-26). El centro es más transparente para que se siga
     viendo la pista viva detrás — el cartel presenta el modo, no lo esconde. */
  #btRdy{ position:fixed; inset:0; z-index:12; display:none; flex-direction:column; align-items:center;
    justify-content:center; gap:0; text-align:center; padding:3vh 5vw; box-sizing:border-box; cursor:pointer;
    background:radial-gradient(120% 80% at 50% 42%, rgba(28,16,72,.55) 0%, rgba(36,17,89,.82) 72%);
    backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px);
    font-family:'Fredoka','Segoe UI Rounded','Nunito',system-ui,sans-serif; -webkit-tap-highlight-color:transparent; }
  #btRdy.show{ display:flex; animation:btRdyIn .22s ease-out both; }
  @keyframes btRdyIn{ from{ opacity:0 } to{ opacity:1 } }
  #btRdy.out{ animation:btRdyOut .16s ease-in both; }
  @keyframes btRdyOut{ from{ opacity:1 } to{ opacity:0 } }
  /* ICONO del modo: el MISMO SVG dorado que la web y el shell (arte/modeicons-vendored.js). Si no está cargado
     no se dibuja nada y el cartel sigue leyéndose igual (nombre + objetivo + CTA). */
  #btRdy .ico{ width:min(21vh,120px); height:min(21vh,120px); margin-bottom:1.4vh;
    filter:drop-shadow(0 4px 14px rgba(0,0,0,.55)); }
  #btRdy .ico:empty{ display:none }
  /*+AG los grises-lavanda son LOS DEL MOTOR, no unos nuevos: #a9a3c2 es el de los rótulos de los controles
     (#ctr .lbl), #c9cff0 el del subtítulo de la portada (#ovSub) y #8a92b8 el de su pista (#hint). Mismo rol,
     mismo color: tres lavandas más habrían sido tres decisiones que nadie recuerda. */
  #btRdy .kick{ font-size:clamp(11px,1.5vh,13px); font-weight:600; letter-spacing:.22em; color:#a9a3c2; }
  /*+AG doc 60 F4: el nombre del modo lleva el TRÍO de marca (blanco + trazo indigo + sombra corta), el
     mismo token que el kit del shell y que los 3 HUD de partida. Y va en MAYÚSCULAS por CSS: docs/60
     regla 10 nombra explícitamente los nombres de modo, y nunca se toca el diccionario de i18n.
     ⚠ el letter-spacing pasa de -.01em a .01em: con tracking NEGATIVO el trazo funde las letras vecinas
       (docs/56 §3bis.1, el caso "INDMDUAL"). Trazo y espaciado se tocan SIEMPRE a la vez. */
  #btRdy .name{ font-size:clamp(26px,5.4vh,50px); font-weight:700; line-height:1.06; color:#fff;
    letter-spacing:.01em; text-transform:uppercase;
    -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill;
    text-shadow:0 2px 0 #241a3f66, 0 3px 18px rgba(0,0,0,.7); margin:.4vh 0 1.2vh; }
  #btRdy .goal{ max-width:min(90vw,430px); font-size:clamp(13px,2.1vh,17px); font-weight:400; line-height:1.42;
    color:#c9cff0; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  #btRdy .goal b{ color:#ffd23f; font-weight:600 }
  /* CTA: el oro del motor (#ovBtn / #bSup.ready) + el SISTEMA "listo para pulsar" del juego, tal cual.
     Este es el CTA primario y solitario de su pantalla, o sea el caso exacto de .playbig.ready del shell:
     breathe (bob de 2 px) + readyGlow (halo dorado que late) + readySweep (barrido diagonal cada 3,2 s).
     Los @keyframes van COPIADOS LITERALES de prototipo/juego.html porque el módulo no comparte hoja de
     estilos con el shell (otro documento: esto vive dentro del iframe de la partida). Mismos nombres a
     propósito: si algún día se toca el sistema, un grep por readyGlow encuentra las dos copias.
     Y NO se inventa nada encima: un brillo nuevo aquí sería un tercer lenguaje de "púlsame" (docs/40). */
  #btRdy .cta{ position:relative; overflow:hidden; margin-top:3vh; border:0; border-radius:18px;
    padding:clamp(12px,2.1vh,17px) clamp(34px,9vw,54px); font-family:inherit; font-weight:700;
    /*+AG doc 60 F4 / docs/56 regla 1: el "¡LISTO!" iba en TINTA OSCURA sobre el oro, que es exactamente lo
       que la regla prohíbe — es el mismo arreglo que se le hizo al JUGAR del shell. Pasa a blanco con el
       trazo del kit. El trazo va en em = 11 % del cuerpo, así escala solo con el clamp.
       ⚠ este CSS vive dentro de un TEMPLATE LITERAL de JS: una comilla invertida aquí, aunque sea dentro
         de un comentario CSS, CIERRA la cadena y revienta el módulo entero (medido: el motor se quedaba
         sin arranque, sin coach y sin cartel de meta a la vez). Nada de comillas invertidas en este bloque. */
    font-size:clamp(18px,3vh,24px); letter-spacing:.04em; color:#fff; cursor:pointer;
    text-transform:uppercase; -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill;
    text-shadow:0 2px 0 #241a3f66;
    background:linear-gradient(#ffe27a,#ff9a3d); box-shadow:0 6px 0 #b45a10, 0 10px 24px rgba(255,154,61,.32);
    animation:breathe 2.6s ease-in-out infinite, readyGlow 1.9s ease-in-out infinite; }
  #btRdy .cta:active{ transform:translateY(3px); box-shadow:0 3px 0 #b45a10; animation:none }
  @keyframes breathe{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-2px); } }
  @keyframes readyGlow{ 0%,100%{ filter:drop-shadow(0 0 0 #ffd23f00); } 50%{ filter:drop-shadow(0 0 10px #ffd23fcc); } }
  /* el barrido se queda DENTRO de la caja (top:0/height:100%): igual que en el shell, si sobresale infla el
     scrollHeight del botón y cualquier guardia de encaje lo lee como "esto se sale de pantalla". */
  #btRdy .cta::after{ content:''; position:absolute; top:0; height:100%; width:32%; left:-45%;
    background:linear-gradient(100deg,#fff0,#ffffff5e 46%,#fff0); transform:skewX(-18deg);
    animation:readySweep 3.2s ease-in-out infinite; pointer-events:none; z-index:2; }
  @keyframes readySweep{ 0%{ left:-45%; } 26%,100%{ left:132%; } }
  #btRdy .cta .w{ position:relative; z-index:1 }
  #btRdy .cta .drain{ position:absolute; inset:0; right:auto; width:100%; background:rgba(255,255,255,.42);
    pointer-events:none; }
  #btRdy .sub{ margin-top:1.6vh; font-size:clamp(11px,1.6vh,13px); font-weight:400; color:#8a92b8; min-height:1.4em }   /*+AG doc 60 regla 9: el suelo son 11 px, no 10 */
  /*+AG el aviso de Esc (docs/71). Mismo tamaño y misma familia que .sub —es su hermano pequeño, no una
     pieza nueva— pero un punto más apagado: es lo MENOS importante del cartel y no puede competir con el
     objetivo del modo ni con el botón. Va en minúsculas a propósito y eso NO contradice la regla de los
     rótulos en mayúsculas (docs/60 regla 9 pide MAYÚSCULAS para el rótulo pequeño, aislado y PRINCIPAL de
     una pieza; esto es un pie de ayuda debajo de otro pie). Nace vacío: sin teclado no se escribe nada y
     la regla de vacío se lleva también su margen, así que en un móvil el cartel queda EXACTAMENTE igual
     que antes — medido, no supuesto.
     ⚠ NI UNA COMILLA INVERTIDA EN ESTE COMENTARIO: todo este CSS vive dentro de una plantilla de texto, así
     que una sola comilla invertida la CIERRA a media hoja de estilos y tumba el módulo entero con un
     "Unexpected token" que apunta a una línea de comentario. Pasado hoy mismo: el cartel dejó de existir y
     el motor arrancó sin él. */
  #btRdy .esc{ margin-top:.7vh; font-size:clamp(11px,1.5vh,12px); font-weight:400; color:#6f7699; }
  #btRdy .esc:empty{ display:none; margin-top:0 }
  /*+AG BANDA DEL MODO durante la cuenta atrás: el nombre sigue en pantalla mientras corre el 3-2-1, así que
     "¿qué estoy jugando?" tiene respuesta hasta el ¡YA!. Vive DENTRO de #count (los 3 motores lo tienen), así
     que aparece y desaparece con la cuenta atrás sin lógica extra.
     VA SOBRE PLACA, no sobre text-shadow: aquí detrás hay PISTA VIVA — el aro de "este eres tú" pasa por
     encima y las bolas de la parrilla caen justo ahí, así que el rótulo suelto se volvía ilegible (auditoría
     de arte 2026-07-26, medido en capturas a 360×540). La placa es el indigo de marca con blur, la misma
     familia que el velo del cartel: se lee sobre cualquier cosa y sigue dejando ver la pista. */
  #btBanner{ position:fixed; left:0; right:0; top:10.5vh; text-align:center; pointer-events:none;
    font-family:'Fredoka','Segoe UI Rounded','Nunito',system-ui,sans-serif; }
  #btBanner .plate{ display:inline-block; padding:.6vh clamp(14px,4vw,26px); border-radius:999px;
    background:rgba(36,17,89,.74); border:1px solid #ffffff1f; box-shadow:0 3px 16px rgba(0,0,0,.45);
    backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
  #btBanner .k{ display:block; font-size:clamp(11px,1.4vh,12px); font-weight:600; letter-spacing:.2em; color:#a9a3c2 }   /*+AG doc 60 regla 9: iba a 9 px */
  /*+AG doc 60 F4: la banda de la cuenta atrás enseña el MISMO nombre de modo que el cartel, así que lleva
     el MISMO trío y las mismas mayúsculas. Si uno de los dos se quedaba sin trazo, el jugador veía el
     nombre cambiar de piel entre el "¡LISTO!" y el 3-2-1. */
  #btBanner .n{ display:block; font-size:clamp(17px,3vh,26px); font-weight:700; color:#fff;
    letter-spacing:.01em; text-transform:uppercase;
    -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill;
    text-shadow:0 2px 0 #241a3f66, 0 2px 10px rgba(0,0,0,.6) }
`;

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  SONIDO DEL ARRANQUE. Misma familia que el resto del audio del motor: se SINTETIZA con chassis/synth.mjs
//  (los mismos add/note del vídeo) en un buffer suelto y se toca por Web Audio. No es música: son SFX, así que
//  van con el interruptor de EFECTOS de Ajustes, no con el de música.
//
//  La cuenta atrás se programa DE UNA VEZ, en un solo buffer con los beeps ya colocados en su segundo exacto.
//  Es lo que hace que suene a máquina y no a "más o menos": los ticks caen clavados aunque el frame se retrase.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const SR = 44100;
let gain = null;

function play(audio, buf){
  if(!audio || !audio.ctx || !buf) return;
  const ctx = audio.ctx;
  if(!gain || gain.context !== ctx){ gain = ctx.createGain(); gain.gain.value = 0.9; gain.connect(ctx.destination); }
  const { gain:g } = peakGain(buf);                          // mismo pico 0.9 que el WAV del render → suena igual
  const ab = ctx.createBuffer(1, buf.length, SR); const ch = ab.getChannelData(0);
  if(g === 1) ch.set(buf); else for(let i=0;i<buf.length;i++) ch[i] = buf[i]*g;
  const src = ctx.createBufferSource(); src.buffer = ab; src.connect(gain); src.start();
}
function mkBuf(dur){ const N = Math.floor(SR*dur); const buf = new Float32Array(N);
  return { buf, S: createSynth({ SR, N, buf, rng: makeRng(1) }) }; }

// CONFIRMACIÓN de "¡LISTO!": dos notas cortas hacia arriba. Su trabajo real no es decorar — es la PRUEBA de que
// el sonido funciona, justo en el instante en que el jugador acaba de dar el gesto que lo desbloquea.
export function blipReady(audio){
  const { buf, S } = mkBuf(0.34);
  S.note(0,    0.10, 880,  0.30, { wave:'pulse', duty:0.42, decay:12 });
  S.note(0.075,0.20, 1319, 0.27, { wave:'pulse', duty:0.42, decay:7 });
  S.note(0.075,0.20, 1760, 0.08, { wave:'sine', decay:6 });
  play(audio, buf);
}

// CUENTA ATRÁS: un tick por cifra (subiendo de tono = anticipación) y en el ¡YA! un golpe grave + tríada brillante.
// digits/digitDur/goAt vienen del motor para que el sonido y los números sean LA MISMA cuenta, no dos parecidas.
export function sfxCountdown(audio, { digits = 3, digitDur = 1.15, goAt = 3.45 } = {}){
  const { buf, S } = mkBuf(goAt + 1.1);
  const tone = [523.25, 587.33, 659.25];                     // C5 · D5 · E5
  for(let i=0;i<digits;i++){
    const t = i*digitDur, f = tone[Math.min(i, tone.length-1)];
    S.note(t, 0.14, f, 0.30, { wave:'pulse', duty:0.32, decay:9 });
    S.add(t, 0.05, 1100, 520, 0.07, 0.55, 16);               // aire del ataque (el "clic" del tick)
  }
  S.add(goAt, 0.30, 210, 65, 0.28, 0.28, 9);                 // golpe: el pistoletazo
  [784, 1047, 1319].forEach((f,i)=> S.note(goAt + i*0.035, 0.32, f, 0.20, { wave:'pulse', duty:0.5, decay:5 }));
  S.note(goAt, 0.55, 2093, 0.06, { wave:'sine', decay:3, vib:0.005 });
  play(audio, buf);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  EL CARTEL
//  cfg:
//    mode      'race' | 'cazador' | 'redlight'
//    lang      ()=>'es'                   idioma vivo del motor
//    title     ()=>string | null          nombre del modo si el motor ya lo tiene traducido (la Carrera: 9 idiomas)
//    goal      ()=>string | null          objetivo si el motor prefiere el suyo; null = el de este módulo
//    audio     el createWebAudio del motor (para desbloquear y para el blip de confirmación)
//    sfxOn     ()=>bool                   interruptor de EFECTOS (Ajustes del shell)
//    autoSec   segundos hasta el auto-arranque; 0 = no se auto-arranca (tutorial: ahí no hay prisa)
//    onStart   (byUser:bool)=>void         arranca la ronda. byUser=false → nadie tocó nada y el audio sigue mudo
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export function createArranque(cfg){
  const { mode, lang, audio, autoSec = 5, onStart } = cfg;
  //+AG doc 49: en+es viven aqui arriba; los otros 18 idiomas llegan en i18n/<l>.js y BTI18N.tabla los
  //   funde sobre el ingles. Si el paquete aun no ha aterrizado devuelve el respaldo, asi que el cartel
  //   siempre tiene texto — un idioma que tarda no puede dejar en blanco la pantalla de arranque.
  const L = () => (window.BTI18N ? BTI18N.tabla(lang(), 'arranque', TXT[lang()] || TXT.en) : (TXT[lang()] || TXT.en));

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const card = document.createElement('div'); card.id = 'btRdy';
  card.innerHTML = `<div class="ico"></div><div class="kick"></div><div class="name"></div><div class="goal"></div>`
    + `<button class="cta" type="button"><span class="drain"></span><span class="w"></span></button><div class="sub"></div><div class="esc"></div>`;
  document.body.appendChild(card);
  const $ = s => card.querySelector(s);
  const drain = $('.drain');

  //+AG el icono del modo es el SVG dorado vendorizado (doc 41 bloque C). El motor lo carga como <script> clásico
  //   antes del módulo; si no está (standalone viejo, o abierto suelto) el cartel se dibuja sin icono y ya.
  const ic = (window.VENDORED_MODE_ICONS || {})[mode];
  if(ic) $('.ico').innerHTML = `<svg viewBox="${ic.vb}" width="100%" height="100%">${ic.markup}</svg>`;

  let visible = false, left = 0, started = false, rafId = 0;

  function refresh(){
    const t = L(); subTxt = '';                                  // el idioma pudo cambiar: fuerza repintar el pie
    $('.kick').textContent = t.kicker;
    $('.name').textContent = (cfg.title && cfg.title()) || t.name[mode] || mode;
    $('.goal').innerHTML  = (cfg.goal && cfg.goal()) || t.goal[mode] || '';
    $('.w').textContent   = t.ready;
    //+AG el aviso de Esc SOLO donde hay teclado. `any-pointer:fine` = "existe algún puntero fino" (ratón o
    //   trackpad), que es lo más cerca que se puede estar de preguntar "¿hay teclado?" desde una página: no
    //   hay media query de teclado. Un móvil no lo cumple y no ve el aviso; un portátil táctil SÍ lo cumple,
    //   y eso es lo que se quiere (tiene teclas). Se lee aquí y no una vez al cargar porque un portátil
    //   convertible puede cambiar de modo, y esto cuesta lo mismo que leerlo de una variable.
    //   ⚠ El respaldo es NO ENSEÑARLO: si el navegador no entiende la consulta, mejor callarse que pedirle
    //   a alguien con un dedo que pulse una tecla que no tiene.
    let teclado = false; try{ teclado = matchMedia('(any-pointer:fine)').matches; }catch(e){}
    $('.esc').textContent = teclado ? (t.escHint || '') : '';
    paintSub();
  }
  //+AG solo se escribe el DOM cuando el texto CAMBIA (una vez por segundo, no 60): esto corre en el bucle de rAF
  //   mientras el cartel está delante, y el motor ya está renderizando WebGL por debajo.
  let subTxt = '';
  function paintSub(){
    const t = L(), s = autoSec > 0 ? t.auto(Math.max(1, Math.ceil(left))) : t.tapHint;
    if(s !== subTxt){ subTxt = s; $('.sub').textContent = s; }
  }

  // GO: un único camino de salida, venga del tap o del reloj. byUser decide si hay sonido (y si hay blip).
  function go(byUser){
    if(started) return; started = true;
    cancelAnimationFrame(rafId);
    if(byUser){
      //+AG EL GESTO. resume() es el camino CORTO (reanuda el AudioContext y marca desbloqueado en el acto, sin
      //   esperar a decodificar la música) y NO se espera su promesa: la ronda arranca igual pase lo que pase con
      //   el audio. El blip suena en este mismo tap — es la prueba de que hay sonido, no un adorno.
      //   La música la trae prefetch() desde la carga y entra en el ¡YA! por startAudio() del motor.
      try{ if(audio && audio.resume) audio.resume();
        if(cfg.sfxOn && cfg.sfxOn()) blipReady(audio);
      }catch(e){}
    }
    card.classList.add('out');
    setTimeout(()=>{ card.classList.remove('show','out'); visible = false; }, 160);
    onStart(!!byUser);
  }

  function tick(prev){
    if(!visible || started) return;
    const now = performance.now(), dt = Math.min(0.1, (now - prev)/1000);
    //+AG ⚠ ESTE RELOJ NO ES EL DEL MOTOR: va por su cuenta con performance.now y su propio rAF, así que la
    //   pausa del shell (chassis/pausa.mjs) no lo tocaba. Y el caso pasa de verdad: tocas JUGAR, sale el
    //   cartel del modo, das atrás en el acto... y a los 5 s la ronda arrancaba SOLA por debajo de la hoja
    //   de "¿Abandonar la partida?". Congelado, la cuenta de auto-arranque se queda donde estaba y sigue al
    //   volver. El tap sí puede arrancar la ronda estando congelado, pero es imposible: los toques van a la
    //   hoja, que vive en el documento del shell y tapa el iframe entero.
    if(PAUSA.on){ rafId = requestAnimationFrame(()=>tick(now)); return; }
    left -= dt;
    if(autoSec > 0){
      drain.style.width = Math.max(0, (left/autoSec)*100).toFixed(2) + '%';
      paintSub();
      if(left <= 0){ go(false); return; }
    }
    rafId = requestAnimationFrame(()=>tick(now));
  }

  function show(){
    visible = true; started = false; left = autoSec;
    drain.style.width = autoSec > 0 ? '100%' : '0%';
    refresh();
    card.classList.add('show');
    rafId = requestAnimationFrame(()=>tick(performance.now()));
  }

  //+AG TODO el cartel es la zona de tap, no solo el botón: en móvil el gesto que desbloquea el audio no puede
  //   depender de acertar un pill de 200 px. El botón sigue ahí porque es lo que DICE que hay que tocar.
  card.addEventListener('click', ()=> go(true));
  const onKey = e => { if(visible && !started && !e.repeat) go(true); };
  addEventListener('keydown', onKey);

  return { show, refresh, get visible(){ return visible; } };
}

// BANDA DEL MODO para la cuenta atrás. Se cuelga de #count (lo tienen los 3 motores) → se muestra y se oculta
// con la propia cuenta atrás, sin estado que mantener.
export function modeBanner({ mode, lang, title }){
  const host = document.getElementById('count'); if(!host) return { refresh(){} };
  let b = document.getElementById('btBanner');
  if(!b){ b = document.createElement('div'); b.id = 'btBanner';
    b.innerHTML = '<span class="plate"><span class="k"></span><span class="n"></span></span>'; host.appendChild(b); }
  const refresh = () => { const t = (window.BTI18N ? BTI18N.tabla(lang(), 'arranque', TXT[lang()] || TXT.en) : (TXT[lang()] || TXT.en));
    b.querySelector('.k').textContent = t.kicker;
    b.querySelector('.n').textContent = (title && title()) || t.name[mode] || mode; };
  refresh();
  return { refresh };
}
