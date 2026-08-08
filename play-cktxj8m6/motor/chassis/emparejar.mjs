// EMPAREJAMIENTO · los ocho que van a jugar, con cara y nombre, antes de la cuenta atrás.
// Capa compartida por los 3 motores (race, cazador, redlight), como arranque.mjs y salida.mjs.
//
// POR QUÉ EXISTE (docs/99 §6, D3 de Jaime). El juego ya tenía rivales-persona —pericia, carácter, liga y
// copas que suben y bajan— y el jugador NO SE ENTERABA DE NADA: entraba, veía siete bolas de colores y al
// final Resultados le enseñaba unos nombres que aparecían de la nada. Aquí se presentan ANTES, que es donde
// un emparejamiento significa algo.
//
// SUSTITUYE AL CARTEL DE "¡LISTO!" (arranque.mjs), no se le suma:
//   · Lo que decía el cartel SE SIGUE DICIENDO. El icono dorado del modo, la palabra MODO, el nombre y el
//     objetivo en una frase van arriba de esta pantalla. Era lo único que le contaba el juego a quien no ha
//     hecho el tutorial (doc 44 §2) y perderlo habría sido cambiar una cosa por otra, no mejorar.
//   · Y SE ENTRA A JUGAR ANTES QUE HOY: el cartel se auto-arrancaba a los 5 s y detrás venían 3,45 s de
//     cuenta atrás, o sea hasta 8,45 s mirando. Esto dura 2,5 s: ~6 s en total, y con teatro.
//
// ⚠ EL BOTÓN QUE DESAPARECE ERA EL QUE DESBLOQUEABA EL SONIDO, y eso se midió antes de quitarlo (docs/99 §7).
//   El navegador no deja sonar nada hasta que hay un gesto DENTRO del documento de la partida, y el tap de
//   JUGAR ocurre en el shell, que es otro documento. La solución ya estaba en casa desde el 1-ago:
//   webaudio.mjs tiene tryAutoplay(), los tres motores lo llaman al cargar y el iframe se abre con
//   allow="autoplay", así que el permiso del menú está delegado dentro. Medido con
//   tools/sonda-audio-sin-listo.mjs y sus dos controles: sin tocar el "¡LISTO!" el AudioContext entra
//   'running'. Lo que NO se pudo medir es iOS, y por eso esta pantalla acepta un toque opcional que
//   adelanta el llenado: si allí el autoplay delegado falla, ese toque lo desbloquea igual.
//
// ⚠ EL ORDEN DE LOS HUECOS ES EL ORDEN DE LAS BOLAS, y no es un detalle de pintura. El hueco i enseña al
//   dueño de balls[i] y su color es PAL[i], el MISMO que va a llevar en pista y el mismo que Resultados
//   recibe del motor en bt:matchEnd. Si esta lista y la de la partida se desincronizaran, el juego
//   presentaría a unos y jugarías contra otros — y eso no da ningún error: se lee como que el juego miente.
//
// ⚠ NO TOCA LA SIM. Igual que el cartel al que sustituye, vive en la capa de agencia: la ronda se construye
//   igual y arranca en f=0. Sin &brival= (tutorial, torneo, motor abierto suelto) este módulo no se
//   instancia siquiera y el cartel de siempre sigue en su sitio.

import { TXT as TXT_ARR, blipSlot, blipFound } from './arranque.mjs?v=68577ac';
import { PAUSA } from './pausa.mjs?v=68577ac';   //+AG "el mundo no se mueve": esta pantalla tampoco se auto-arranca (ver tick)

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  EL TRANSPORTE · qué le llega del shell y cómo se lee
//
//  El shell manda tres parámetros (juego.html, junto a &bskill= y &bchar=):
//    &brival=<nombre>~<t>~<d>,<nombre>~<t>~<d>,…   los rivales, EN EL MISMO ORDEN que su pericia
//    &byo=<nombre>~<t>~<d>                          el hueco del jugador
//    &bligas=<liga0>~<liga1>~…                      las cinco palabras de liga, YA TRADUCIDAS
//
//  ⚠ LA LIGA VIAJA COMO NÚMERO (escalón + división) Y NO COMO TEXTO, y las cinco palabras van una sola vez.
//    El diccionario de las ligas vive en el shell (ligaNombre) y llevarle los 20 idiomas al motor sería
//    duplicarlo; el número romano, en cambio, es el mismo en todos y se compone aquí.
//
//  ⚠ ESTA FUNCIÓN VIVE AQUÍ Y NO COPIADA EN LOS TRES MOTORES a propósito: es un formato, y un formato
//    copiado tres veces se desincroniza en el primer arreglo que alguien haga en uno solo.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];   // el mismo LIGA_ROMAN de juego.html

function unFicha(s, tiers){
  if(!s) return null;
  const p = String(s).split('~');
  const nombre = decodeURIComponent(p[0] || '').trim();
  if(!nombre) return null;
  const t = Math.max(0, Math.min(tiers.length - 1, parseInt(p[1], 10) || 0));
  const d = Math.max(0, parseInt(p[2], 10) || 0);
  //   la misma composición que ligaNombre() en el shell, con el mismo respaldo para Élite pasada la X
  const liga = ((tiers[t] || '') + ' ' + (ROMAN[d] || String(d + 1))).trim();
  return { nombre, liga };
}

// Devuelve null si el shell no ha mandado emparejamiento: entonces el motor se queda con el cartel de
// siempre. Nunca lanza y nunca devuelve a medias — o hay lista completa, o no hay pantalla.
export function leerEmparejamiento(params){
  try{
    const raw = params.get('brival'); if(!raw) return null;
    const tiers = (params.get('bligas') || '').split('~').map(decodeURIComponent).filter(Boolean);
    if(tiers.length !== 5) return null;                       // sin las palabras de liga no se pinta media ficha
    const rivales = raw.split(',').map(s => unFicha(s, tiers)).filter(Boolean);
    if(!rivales.length) return null;
    const yo = unFicha(params.get('byo'), tiers);
    if(!yo) return null;
    return { yo, rivales };
  }catch(e){ console.error('[emparejar] no se pudo leer el emparejamiento:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  LOS TIEMPOS · docs/99 §6, y son la pantalla entera
//  0,00 s  ocho huecos vacíos + el encabezado del modo
//  0,20 s  empiezan a llenarse, uno cada 250 ms — el tuyo el primero
//  1,95 s  entra el octavo
//  2,05 s  ¡PARTIDA ENCONTRADA!
//  2,50 s  fuera, y la cuenta atrás de siempre
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const T_IN = 0.20, T_STEP = 0.25, T_GAP = 0.10, T_HOLD = 0.45;

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  EL LOOK · el del cartel al que sustituye, no uno nuevo
//  Velo indigo de marca, Fredoka, y el TRÍO de docs/60 F4 (blanco + trazo indigo + sombra corta) en el
//  nombre del modo. Los grises-lavanda son los mismos tres del motor (#a9a3c2, #c9cff0, #8a92b8): tres
//  lavandas más habrían sido tres decisiones que nadie recuerda.
//  ⚠ NI UNA COMILLA INVERTIDA EN ESTE BLOQUE, tampoco dentro de un comentario CSS: todo esto vive en una
//    plantilla de texto de JS y una sola comilla la CIERRA a media hoja de estilos y tumba el módulo entero
//    con un "Unexpected token" que apunta a una línea de comentario. Ya pasó una vez en arranque.mjs y se
//    llevó por delante el cartel, el coach y el cartel de meta a la vez.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');
  #btMM{ position:fixed; inset:0; z-index:12; display:none; flex-direction:column; align-items:center;
    justify-content:center; gap:0; padding:2.4vh 4vw; box-sizing:border-box; cursor:pointer;
    background:radial-gradient(120% 80% at 50% 42%, rgba(28,16,72,.55) 0%, rgba(36,17,89,.86) 72%);
    backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px);
    font-family:'Fredoka','Segoe UI Rounded','Nunito',system-ui,sans-serif; -webkit-tap-highlight-color:transparent; }
  #btMM.show{ display:flex; animation:btMMIn .2s ease-out both; }
  @keyframes btMMIn{ from{ opacity:0 } to{ opacity:1 } }
  #btMM.out{ animation:btMMOut .16s ease-in both; }
  @keyframes btMMOut{ from{ opacity:1 } to{ opacity:0 } }

  /* ENCABEZADO: lo que decía el cartel de "¡LISTO!". Más bajo que allí porque debajo hay ocho filas, pero
     con la misma jerarquia y los mismos colores: si esto se encoge hasta no leerse, el cambio habria sido
     cambiar una cosa por otra. */
  #btMM .hd{ text-align:center; flex:0 0 auto; }
  #btMM .ico{ width:min(11vh,64px); height:min(11vh,64px); margin:0 auto .4vh;
    filter:drop-shadow(0 4px 14px rgba(0,0,0,.55)); }
  #btMM .ico:empty{ display:none }
  #btMM .kick{ font-size:clamp(11px,1.4vh,13px); font-weight:600; letter-spacing:.22em; color:#a9a3c2 }
  #btMM .name{ font-size:clamp(21px,3.9vh,34px); font-weight:700; line-height:1.06; color:#fff;
    letter-spacing:.01em; text-transform:uppercase;
    -webkit-text-stroke:.10em #241a3f; paint-order:stroke fill;
    text-shadow:0 2px 0 #241a3f66, 0 3px 18px rgba(0,0,0,.7); margin:.2vh 0 .7vh; }
  #btMM .goal{ max-width:min(92vw,430px); margin:0 auto; font-size:clamp(12px,1.75vh,15px); font-weight:400;
    line-height:1.36; color:#c9cff0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    overflow:hidden; }
  #btMM .goal b{ color:#ffd23f; font-weight:600 }

  /* LOS OCHO HUECOS. Una columna en movil (que es donde se juega) y dos cuando hay ancho de sobra: con dos
     columnas en 360 px el nombre y la liga se cortarian, y el nombre es la mitad del punto de esta pantalla. */
  #btMM .slots{ width:min(94vw,440px); margin:1.6vh auto 0; display:grid; grid-template-columns:1fr;
    gap:clamp(4px,.75vh,8px); flex:0 1 auto; }
  @media (min-width:560px){ #btMM .slots{ width:min(94vw,760px); grid-template-columns:1fr 1fr; } }

  /* HUECO VACIO: una placa apagada que RESPIRA. Sin la respiracion, ocho cajas quietas se leen como una
     lista que no ha cargado; con ella se leen como sitios que se estan buscando. */
  #btMM .slot{ display:flex; align-items:center; gap:clamp(8px,2.4vw,12px);
    padding:clamp(5px,.85vh,9px) clamp(9px,2.6vw,13px); border-radius:14px;
    background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.07);
    min-height:clamp(38px,5.6vh,50px); box-sizing:border-box; overflow:hidden;
    animation:btMMWait 1.5s ease-in-out infinite; }
  @keyframes btMMWait{ 0%,100%{ opacity:.42 } 50%{ opacity:.72 } }

  /* HUECO LLENO: entra de golpe y con un empujon, que es lo que hace que se sienta que ALGUIEN ha entrado. */
  #btMM .slot.on{ animation:btMMPop .26s cubic-bezier(.2,1.5,.45,1) both;
    background:rgba(255,255,255,.10); border-color:rgba(255,255,255,.16); }
  @keyframes btMMPop{ from{ opacity:0; transform:translateY(6px) scale(.94) } to{ opacity:1; transform:none } }
  /* EL TUYO va con el oro del juego, el mismo de #ovBtn y del CTA del cartel: en una lista de ocho, saber
     cual eres tu no puede depender de leerse el nombre. */
  #btMM .slot.me.on{ background:linear-gradient(90deg, rgba(255,210,63,.20), rgba(255,210,63,.07));
    border-color:#ffd23f7a; box-shadow:0 0 0 1px #ffd23f2e, 0 4px 16px rgba(255,154,61,.18); }

  /* EL AVATAR. Para los rivales es el disco de su color de pista con las DOS capas de luz que ya usan los
     discos de Resultados (juego.html discBg): misma clase de objeto, mismo acabado, y asi el color con el
     que se presentan es el mismo con el que corren. Para el jugador es su BOLA DE VERDAD, porque su bola si
     se renderiza con su material en pista (?arch) y ensenarle un disco seria ensenarle menos de lo que hay. */
  #btMM .av{ flex:0 0 auto; width:clamp(26px,3.9vh,34px); height:clamp(26px,3.9vh,34px); border-radius:50%;
    background:rgba(255,255,255,.06); box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); }
  #btMM .slot.on .av{ box-shadow:0 2px 6px rgba(0,0,0,.45) }
  #btMM .av img{ width:100%; height:100%; display:block; object-fit:contain;
    filter:drop-shadow(0 2px 5px rgba(0,0,0,.5)) }

  /* NOMBRE Y LIGA. text-align:start y no left: en arabe la pantalla se espeja y el nombre tiene que quedar
     pegado a su bola, no al otro lado de la fila. */
  /* ⚠ display:block en los dos, y no es cosmetica: son <span> dentro de un <span>, o sea inline, y en
     linea el nombre y la liga salian PEGADOS ("MegaZiaBronce I") — una sola palabra ilegible. */
  #btMM .txt{ min-width:0; flex:1 1 auto; text-align:start; }
  #btMM .nm, #btMM .lg{ display:block }
  #btMM .nm{ font-size:clamp(13px,1.95vh,16px); font-weight:600; color:#fff; line-height:1.16;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    text-shadow:0 1px 2px rgba(0,0,0,.55); }
  #btMM .slot.me .nm{ color:#ffe27a }
  #btMM .lg{ font-size:clamp(10px,1.35vh,12px); font-weight:500; color:#a9a3c2; line-height:1.2;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #btMM .slot:not(.on) .nm, #btMM .slot:not(.on) .lg, #btMM .slot:not(.on) .av img{ visibility:hidden }

  /* EL PIE: "BUSCANDO RIVALES..." y, al final, "PARTIDA ENCONTRADA". Reserva su alto desde el principio
     (min-height) para que el cambio de texto no empuje la lista hacia arriba a 2 s de empezar a jugar. */
  #btMM .sub{ margin-top:1.5vh; min-height:2.4em; display:flex; align-items:center; justify-content:center;
    text-align:center; flex:0 0 auto; }
  #btMM .sub .find{ font-size:clamp(12px,1.7vh,14px); font-weight:600; letter-spacing:.14em; color:#8a92b8;
    text-transform:uppercase; animation:btMMWait 1.5s ease-in-out infinite; }
  /* La confirmacion SI grita: es el unico momento de celebracion de esta pantalla, y llega justo cuando el
     jugador ya ha visto contra quien juega. Mismo oro y mismo trio que el nombre del modo. */
  #btMM .sub .found{ font-size:clamp(17px,2.9vh,25px); font-weight:700; letter-spacing:.02em; color:#ffe27a;
    text-transform:uppercase; -webkit-text-stroke:.09em #241a3f; paint-order:stroke fill;
    text-shadow:0 2px 0 #241a3f66, 0 0 18px rgba(255,210,63,.45);
    animation:btMMFound .34s cubic-bezier(.2,1.6,.4,1) both; }
  @keyframes btMMFound{ from{ opacity:0; transform:scale(.7) } to{ opacity:1; transform:scale(1) } }
`;

// ─────────────────────────────────────────────────────────────────────────────────────────────────
//  LA PANTALLA
//  cfg:
//    mode      'race' | 'cazador' | 'redlight'
//    lang      ()=>'es'                     idioma vivo del motor
//    title     ()=>string | null            nombre del modo si el motor ya lo tiene traducido (la Carrera)
//    goal      ()=>string | null            objetivo si el motor prefiere el suyo
//    audio     el createWebAudio del motor
//    sfxOn     ()=>bool                     interruptor de EFECTOS (Ajustes del shell)
//    datos     lo que devolvio leerEmparejamiento()
//    colors    la PALETA ACTIVA del motor ([{name,color:[r,g,b]}]), que es la de las bolas en pista
//    arch      la clave de la bola-heroe del jugador (?arch) o null
//    n         cuantas bolas juegan (8, o 6 en el perfil corto)
//    onStart   (byUser:bool)=>void          arranca lo de siempre (cuenta atras)
//  Devuelve la MISMA interfaz que createArranque ({show, refresh, visible}) para que el motor no tenga que
//  saber cual de las dos tiene delante.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
const hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
//   las dos capas de luz de los discos de Resultados (juego.html discBg), literales: mismo objeto, mismo acabado
const disco = col => 'radial-gradient(circle at 35% 28%, #ffffff70, #ffffff00 55%),'
                   + 'radial-gradient(circle at 50% 105%, #00000066, #00000000 62%),' + col;

export function createEmparejamiento(cfg){
  const { mode, lang, audio, datos, onStart } = cfg;
  const n = Math.max(2, Math.min(8, cfg.n || 8));
  const L = () => (window.BTI18N ? BTI18N.tabla(lang(), 'arranque', TXT_ARR[lang()] || TXT_ARR.en)
                                 : (TXT_ARR[lang()] || TXT_ARR.en));

  //+AG LAS FILAS SE ARMAN UNA VEZ Y EN EL ORDEN DE LAS BOLAS: la 0 es el jugador (balls[0]) y la i el dueño
  //   de balls[i], que es de donde sale su color. Si sobran rivales (el shell manda 11 por si acaso) se
  //   quedan fuera; si faltan, la fila se queda sin nombre en vez de inventarse uno — un nombre inventado
  //   aquí sería presentar a alguien que no va a correr.
  const pal = Array.isArray(cfg.colors) ? cfg.colors : [];
  const filas = [];
  for(let i=0; i<n; i++){
    const f = i === 0 ? datos.yo : datos.rivales[i-1];
    const c = pal[i] && pal[i].color ? hex(pal[i].color) : '#8a92b8';
    filas.push({ me:i===0, nombre:(f && f.nombre) || '', liga:(f && f.liga) || '', color:c });
  }

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const card = document.createElement('div'); card.id = 'btMM';
  card.innerHTML = '<div class="hd"><div class="ico"></div><div class="kick"></div><div class="name"></div>'
    + '<div class="goal"></div></div><div class="slots"></div><div class="sub"></div>';
  document.body.appendChild(card);
  const $ = s => card.querySelector(s);

  //+AG el icono del modo es el MISMO SVG dorado vendorizado que el cartel y que el shell (doc 41 bloque C).
  //   Si no está cargado no se dibuja nada y la pantalla se lee igual — no es lo que la sostiene.
  const ic = (window.VENDORED_MODE_ICONS || {})[mode];
  if(ic) $('.ico').innerHTML = '<svg viewBox="' + ic.vb + '" width="100%" height="100%">' + ic.markup + '</svg>';

  const slotsEl = $('.slots');
  const slotEls = filas.map(f => {
    const d = document.createElement('div');
    d.className = 'slot' + (f.me ? ' me' : '');
    //   el avatar del jugador es su bola de verdad; el de un rival, su disco de pista
    const av = (f.me && cfg.arch)
      ? '<span class="av"><img src="../../arte/bolas/bola-' + encodeURIComponent(cfg.arch) + '-icon.webp" alt=""></span>'
      : '<span class="av" style="background:' + disco(f.color) + '"></span>';
    d.innerHTML = av + '<span class="txt"><span class="nm"></span><span class="lg"></span></span>';
    d.querySelector('.nm').textContent = f.nombre;
    d.querySelector('.lg').textContent = f.liga;
    slotsEl.appendChild(d);
    return d;
  });

  let visible = false, started = false, rafId = 0, t = 0, llenos = 0, cantado = false;

  function refresh(){
    const x = L();
    $('.kick').textContent = x.kicker;
    $('.name').textContent = (cfg.title && cfg.title()) || x.name[mode] || mode;
    $('.goal').innerHTML  = (cfg.goal && cfg.goal()) || x.goal[mode] || '';
    //+AG el árabe espeja ESTA pantalla (es interfaz, no pista): la bola tiene que quedar del lado del que se
    //   lee. El HUD de partida sigue sin espejarse, y eso es a propósito — allí el carril de la izquierda es
    //   el de la izquierda (i18n/idiomas.js applyDoc).
    try{ card.dir = (window.BTI18N && BTI18N.LANGS[lang()] && BTI18N.LANGS[lang()].rtl) ? 'rtl' : 'ltr'; }catch(e){}
    pintaSub();
  }
  //   solo se escribe el DOM cuando el texto CAMBIA: esto vive en un bucle de rAF con WebGL por debajo.
  let subQue = '';
  function pintaSub(){
    const x = L(), q = cantado ? 'found' : 'find';
    if(q === subQue) return; subQue = q;
    $('.sub').innerHTML = cantado ? '<span class="found"></span>' : '<span class="find"></span>';
    $('.sub').firstChild.textContent = cantado ? (x.mmFound || 'MATCH FOUND!') : (x.mmFind || 'FINDING PLAYERS…');
  }

  function llena(i){
    if(i >= slotEls.length || slotEls[i].classList.contains('on')) return;
    slotEls[i].classList.add('on');
    if(cfg.sfxOn && cfg.sfxOn()) { try{ blipSlot(audio, i, slotEls.length); }catch(e){} }
  }
  function canta(){
    if(cantado) return; cantado = true; pintaSub();
    if(cfg.sfxOn && cfg.sfxOn()) { try{ blipFound(audio); }catch(e){} }
  }

  // GO: un único camino de salida, venga del reloj o del toque.
  function go(byUser){
    if(started) return; started = true;
    cancelAnimationFrame(rafId);
    card.classList.add('out');
    setTimeout(()=>{ card.classList.remove('show','out'); visible = false; }, 160);
    onStart(!!byUser);
  }

  //+AG EL TOQUE NO ES OBLIGATORIO, ES UN ATAJO — y es el plan B de iOS (docs/99 §7). Rellena los huecos que
  //   falten de golpe, canta, y sale en cuanto se ha visto la confirmación. De paso da el gesto que
  //   desbloquea el audio allí donde el autoplay delegado no valga; aquí no se puede medir Safari.
  function salta(){
    if(started || !visible) return;
    try{ if(audio && audio.resume) audio.resume(); }catch(e){}
    while(llenos < slotEls.length) llena(llenos++);
    canta();
    t = Math.max(t, T_IN + (slotEls.length - 1) * T_STEP + T_GAP + T_HOLD * 0.45);
  }

  function tick(prev){
    if(!visible || started) return;
    const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000);
    //+AG ⚠ ESTE RELOJ NO ES EL DEL MOTOR: va por su cuenta, así que la pausa del shell (chassis/pausa.mjs)
    //   no lo tocaría. Y el caso pasa de verdad: tocas JUGAR, sale el emparejamiento, das atrás en el acto...
    //   y la ronda arrancaba SOLA por debajo de la hoja de "¿Abandonar la partida?". Es el mismo fallo que
    //   ya se arregló en arranque.mjs; copiar la pantalla sin copiar el arreglo lo habría reabierto.
    if(PAUSA.on){ rafId = requestAnimationFrame(()=>tick(now)); return; }
    t += dt;
    while(llenos < slotEls.length && t >= T_IN + llenos * T_STEP) llena(llenos++);
    const tCanta = T_IN + (slotEls.length - 1) * T_STEP + T_GAP;
    if(t >= tCanta) canta();
    if(t >= tCanta + T_HOLD){ go(false); return; }
    rafId = requestAnimationFrame(()=>tick(now));
  }

  function show(){
    visible = true; started = false; t = 0; llenos = 0; cantado = false; subQue = '';
    slotEls.forEach(d => d.classList.remove('on'));
    refresh();
    card.classList.add('show');
    //+AG se INTENTA despertar el audio al abrir, sin esperar la promesa: si el permiso delegado vale, los
    //   ticks de los huecos ya suenan; si no, no pasa nada y la pantalla va igual.
    try{ if(audio && audio.resume) audio.resume(); }catch(e){}
    rafId = requestAnimationFrame(()=>tick(performance.now()));
  }

  //+AG TODA la pantalla es zona de toque, no un botón: aquí no se pide un gesto, se acepta. En móvil, hacer
  //   que el atajo dependa de acertar una pastilla de 200 px sería pedirle puntería a quien solo quiere ir más rápido.
  card.addEventListener('click', salta);
  addEventListener('keydown', e => { if(visible && !started && !e.repeat) salta(); });

  return { show, refresh, get visible(){ return visible; } };
}
