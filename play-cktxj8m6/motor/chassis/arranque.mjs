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

import { createSynth, makeRng, peakGain } from './synth.mjs';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  TEXTOS · en+es con fallback a INGLÉS, igual que el SHELL y que los motores de Cazador/Luz Roja
//  (la Carrera tiene sus 9 idiomas porque ya los tenía: su nombre de modo entra por cfg.title).
//  El OBJETIVO es una frase, en imperativo, sin jerga: es lo único que lee quien no ha hecho el tutorial.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const TXT = {
  en: { kicker:'MODE', ready:'READY!', auto:n=>`starts on its own in ${n}`, tapHint:'tap for sound',
    name:{ race:'The Great Race', cazador:'The Hunter', redlight:'Red Light' },
    goal:{ race:'Roll down and reach the FINISH before anyone else.',
           cazador:'Dodge the HUNTER. Last ball standing wins.',
           redlight:'Run on GREEN, freeze on RED. Get caught moving and you are out.' } },
  es: { kicker:'MODO', ready:'¡LISTO!', auto:n=>`empieza sola en ${n}`, tapHint:'toca para tener sonido',
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
  #btRdy{ position:fixed; inset:0; z-index:12; display:none; flex-direction:column; align-items:center;
    justify-content:center; gap:0; text-align:center; padding:3vh 5vw; box-sizing:border-box; cursor:pointer;
    background:radial-gradient(120% 80% at 50% 42%, rgba(12,16,32,.62) 0%, rgba(4,6,14,.88) 72%);
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
  #btRdy .kick{ font-size:clamp(10px,1.5vh,13px); font-weight:600; letter-spacing:.22em; color:#8f9ac4; }
  #btRdy .name{ font-size:clamp(26px,5.4vh,50px); font-weight:700; line-height:1.06; color:#fff;
    letter-spacing:-.01em; text-shadow:0 3px 18px rgba(0,0,0,.7); margin:.4vh 0 1.2vh; }
  #btRdy .goal{ max-width:min(90vw,430px); font-size:clamp(13px,2.1vh,17px); font-weight:400; line-height:1.42;
    color:#cbd2ee; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  #btRdy .goal b{ color:#ffd23f; font-weight:600 }
  /* CTA: el oro del motor (#ovBtn / #bSup.ready), sin inventar un brillo nuevo. Dentro lleva la BARRA DE TIEMPO
     que se vacía: el auto-arranque tiene que ser VISIBLE, si no parece que el juego se ha lanzado solo. */
  #btRdy .cta{ position:relative; overflow:hidden; margin-top:3vh; border:0; border-radius:18px;
    padding:clamp(12px,2.1vh,17px) clamp(34px,9vw,54px); font-family:inherit; font-weight:700;
    font-size:clamp(18px,3vh,24px); letter-spacing:.02em; color:#3a2400; cursor:pointer;
    background:linear-gradient(#ffe27a,#ff9a3d); box-shadow:0 6px 0 #b45a10, 0 10px 24px rgba(255,154,61,.32);
    animation:btRdyPulse 1.5s ease-in-out infinite; }
  #btRdy .cta:active{ transform:translateY(3px); box-shadow:0 3px 0 #b45a10; animation:none }
  @keyframes btRdyPulse{ 0%,100%{ transform:scale(1) } 50%{ transform:scale(1.045) } }
  #btRdy .cta .w{ position:relative; z-index:1 }
  #btRdy .cta .drain{ position:absolute; inset:0; right:auto; width:100%; background:rgba(255,255,255,.42);
    pointer-events:none; }
  #btRdy .sub{ margin-top:1.6vh; font-size:clamp(10px,1.6vh,13px); font-weight:400; color:#7f89b4; min-height:1.4em }
  /*+AG BANDA DEL MODO durante la cuenta atrás: el nombre sigue en pantalla mientras corre el 3-2-1, así que
     "¿qué estoy jugando?" tiene respuesta hasta el ¡YA!. Vive DENTRO de #count (los 3 motores lo tienen), así
     que aparece y desaparece con la cuenta atrás sin lógica extra. */
  #btBanner{ position:fixed; left:0; right:0; top:12vh; text-align:center; pointer-events:none;
    font-family:'Fredoka','Segoe UI Rounded','Nunito',system-ui,sans-serif; }
  #btBanner .k{ display:block; font-size:clamp(9px,1.4vh,12px); font-weight:600; letter-spacing:.2em; color:#98a2cc }
  #btBanner .n{ display:block; font-size:clamp(17px,3vh,26px); font-weight:700; color:#fff;
    text-shadow:0 2px 12px #000, 0 0 26px rgba(120,80,255,.45) }
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
  const L = () => TXT[lang()] || TXT.en;

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const card = document.createElement('div'); card.id = 'btRdy';
  card.innerHTML = `<div class="ico"></div><div class="kick"></div><div class="name"></div><div class="goal"></div>`
    + `<button class="cta" type="button"><span class="drain"></span><span class="w"></span></button><div class="sub"></div>`;
  document.body.appendChild(card);
  const $ = s => card.querySelector(s);
  const drain = $('.drain');

  //+AG el icono del modo es el SVG dorado vendorizado (doc 41 bloque C). El motor lo carga como <script> clásico
  //   antes del módulo; si no está (standalone viejo, o abierto suelto) el cartel se dibuja sin icono y ya.
  const ic = (window.VENDORED_MODE_ICONS || {})[mode];
  if(ic) $('.ico').innerHTML = `<svg viewBox="${ic.vb}" width="100%" height="100%">${ic.markup}</svg>`;

  let visible = false, left = 0, started = false, rafId = 0;

  function refresh(){
    const t = L();
    $('.kick').textContent = t.kicker;
    $('.name').textContent = (cfg.title && cfg.title()) || t.name[mode] || mode;
    $('.goal').innerHTML  = (cfg.goal && cfg.goal()) || t.goal[mode] || '';
    $('.w').textContent   = t.ready;
    paintSub();
  }
  function paintSub(){
    const t = L();
    $('.sub').textContent = autoSec > 0 ? t.auto(Math.max(1, Math.ceil(left))) : t.tapHint;
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
    b.innerHTML = '<span class="k"></span><span class="n"></span>'; host.appendChild(b); }
  const refresh = () => { const t = TXT[lang()] || TXT.en;
    b.querySelector('.k').textContent = t.kicker;
    b.querySelector('.n').textContent = (title && title()) || t.name[mode] || mode; };
  refresh();
  return { refresh };
}
