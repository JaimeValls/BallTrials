// VEREDICTO · el ritual de TERMINAR una partida — "en qué puesto has quedado", cantado EN META.
// Capa compartida por los 3 motores (race, cazador, redlight), espejo exacto de arranque.mjs: aquí vive
// todo lo visual y cada motor solo aporta su idioma, su puesto y a quién avisar cuando acabe.
//
// POR QUÉ EXISTE (feedback Jaime 2026-07-27, sobre la partida ya en producción):
//   *"Cuando he jugado el modo carrera y otro gana, cuando yo llego no me sale en qué posición he quedado
//    hasta que luego sale la siguiente pantalla, y eso no mola."*
//
//   Tenía razón y el motivo estaba escrito en el código: dentro del shell (EMBED) los tres motores emitían
//   `bt:matchEnd` y NO pintaban cartel de fin, a propósito, "para evitar el flash antes de que el shell
//   cierre el iframe". El efecto secundario es que el momento con más emoción de la partida —cruzar la
//   meta— se quedaba MUDO: la pista se congelaba y, un instante después, aparecía una pantalla de menú.
//
//   Aquí se recupera ese momento, y el "flash" se evita por el otro lado: el cartel se pinta PRIMERO y el
//   `matchEnd` se emite DESPUÉS (el motor le pasa el aviso a `onDone`), así que el shell no puede cerrar
//   el iframe mientras el cartel está en pantalla. El orden es la solución, no la ausencia de cartel.
//
// REGLAS QUE NO SE ROMPEN AQUÍ:
//   · NO SE PUEDE QUEDAR COLGADO: el temporizador siempre llama a onDone, y si algo falla al pintar se
//     llama igual (try/catch). Un cartel roto nunca puede dejar al jugador atrapado en la partida.
//   · SE PUEDE SALTAR: un toque avanza ya. El tiempo del jugador es suyo; esto informa, no retiene.
//   · NO INVENTA LENGUAJE VISUAL: mismo velo índigo, misma Fredoka y mismo oro que el cartel de arranque
//     (docs/27). El puesto se lee como se lee en Resultados: ordinal + medalla en el podio.
//   · UNA SOLA VEZ: llamarlo dos veces en la misma partida no duplica carteles ni avisos.

const TXT = {
  en: { kicker:'YOUR PLACE', won:'YOU WON!', wonSub:'Champion of the race',
        podium:'On the podium!', again:'Again! Every race counts.' },
  es: { kicker:'TU PUESTO', won:'¡GANASTE!', wonSub:'Campeón de la carrera',
        podium:'¡En el podio!', again:'¡Otra! Cada carrera suma.' },
};
//+AG doc 49: en+es viven aqui arriba; los otros 18 llegan en i18n/<l>.js. El ORDINAL ya no se declara por
//   idioma en esta tabla — lo dice el catalogo, que es el mismo que usan el shell y los 3 motores: tener
//   "3º / 3rd / 第3名" escrito en cuatro sitios ya habia dado dos vocabularios del mismo dato.
const T = l => (window.BTI18N ? BTI18N.tabla(l, 'veredicto', TXT[l] || TXT.en) : (TXT[l] || TXT.en));
const ORD = (n, l) => (window.BTI18N ? BTI18N.ord(n, l) : n + '.');
const MEDAL = { 1:'🏆', 2:'🥈', 3:'🥉' };

const CSS = `
  /*+AG mismo velo ÍNDIGO y misma Fredoka que el cartel de arranque: empezar y terminar son el mismo ritual
     visto por sus dos caras, y la pista se sigue viendo detrás (el cartel remata la partida, no la tapa). */
  @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');
  #btFin{ position:fixed; inset:0; z-index:14; display:none; flex-direction:column; align-items:center;
    justify-content:center; gap:2px; text-align:center; padding:3vh 5vw; box-sizing:border-box; cursor:pointer;
    /*+AG el velo va MÁS CLARO que el del cartel de arranque a propósito: al terminar, el motor ya está
       tocando su celebración (copa + confeti de celebration.mjs) y taparla sería quitarle a la partida su
       único momento de fiesta. Con .34/.62 el confeti se sigue viendo y el numerote se lee igual gracias a
       su sombra. Y el desenfoque baja a 2 px por lo mismo: emborronar el confeti lo mata. */
    background:radial-gradient(120% 80% at 50% 46%, rgba(28,16,72,.34) 0%, rgba(36,17,89,.62) 76%);
    backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px);
    font-family:'Fredoka','Segoe UI Rounded','Nunito',system-ui,sans-serif; -webkit-tap-highlight-color:transparent; }
  #btFin.on{ display:flex; animation:btFinIn .28s cubic-bezier(.2,1.1,.4,1) both; }
  @keyframes btFinIn{ from{ opacity:0; } to{ opacity:1; } }
  /*+AG doc 60 F4: el cartel de meta lleva el TRÍO de marca, igual que los 3 HUD y que el cartel de
     arranque — es la última cosa que el jugador mira de la partida y era la única sin contorno.
     El TRAZO va en em (11 % del cuerpo, docs/56 §3bis.1) y paint-order:stroke fill NO es opcional.
     ⚠ este CSS vive dentro de un TEMPLATE LITERAL de JS: una comilla invertida, aunque sea dentro de un
       comentario CSS, CIERRA la cadena y revienta el módulo. Aquí no se escriben comillas invertidas.
     Los COLORES no se tocan: el lila del rótulo y el oro del "¡GANASTE!" son decisiones vivas; lo que
     se añade es el contorno, que es lo que faltaba (mismo criterio que la cuenta atrás de los motores). */
  #btFin .k{ font-size:clamp(11px,2.6vw,14px); font-weight:800; letter-spacing:.2em; text-transform:uppercase;
    color:#c9b6ff; -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill; text-shadow:0 2px 0 #241a3f66; }
  /*+AG el numerote entra con un golpe de escala (el "pum" de Supercell al rematar): es lo único que se anima,
     porque es lo único que el jugador ha venido a leer. */
  /*+AG ⚠ el letter-spacing pasa de -.03em a .02em: con tracking NEGATIVO el trazo funde las letras
     vecinas, y aquí la palabra más larga es "¡GANASTE!" a 100 px (docs/56 §3bis.1). */
  #btFin .p{ font-size:clamp(56px,17vw,104px); font-weight:900; letter-spacing:.02em; line-height:1.02;
    color:#fff; -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill;
    text-shadow:0 3px 0 #241a3f66, 0 6px 30px #000b; animation:btFinPop .42s cubic-bezier(.2,1.5,.4,1) both; }
  #btFin.win .p{ color:#ffd23f; text-shadow:0 6px 34px #fbb91566, 0 4px 22px #000a; font-size:clamp(40px,12vw,74px); }
  @keyframes btFinPop{ 0%{ transform:scale(.55); opacity:0; } 100%{ transform:scale(1); opacity:1; } }
  /*+AG doc 60 regla 10: son 3-4 palabras de rótulo ("¡En el podio!", "Campeón de la carrera"), no una
     frase de hoja, así que van en MAYÚSCULAS por CSS y nunca editando los 20 diccionarios. */
  #btFin .s{ margin-top:6px; font-size:clamp(14px,3.6vw,19px); font-weight:700; color:#fff;
    text-transform:uppercase; letter-spacing:.02em;
    -webkit-text-stroke:.11em #241a3f; paint-order:stroke fill; text-shadow:0 2px 0 #241a3f66, 0 2px 12px #000a; }
`;

let host = null, timer = 0, pending = null;

function build(){
  if (host) return host;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  host = document.createElement('div'); host.id = 'btFin';
  host.innerHTML = '<div class="k"></div><div class="p"></div><div class="s"></div>';
  //+AG saltar: el toque cierra y avanza YA. Va en el propio cartel (cubre toda la pantalla).
  host.addEventListener('pointerdown', () => cerrar());
  document.body.appendChild(host);
  return host;
}

function cerrar(){
  if (timer) { clearTimeout(timer); timer = 0; }
  if (host) host.classList.remove('on');
  const f = pending; pending = null;
  if (f) { try { f(); } catch (e) { console.warn('[veredicto] onDone', e); } }
}

// place: puesto del jugador (1 = ganó) · total: cuántos corrían · lang: 'es'|'en' · ms: cuánto se queda.
// onDone se llama SIEMPRE: al agotarse el tiempo, al tocar, o inmediatamente si algo falla al pintar.
export function cantarPuesto({ place, total, lang = 'en', ms = 1700 } = {}, onDone) {
  if (pending) return;                      // ya hay uno vivo: ni dos carteles ni dos avisos
  pending = typeof onDone === 'function' ? onDone : null;
  try {
    const t = T(lang), p = Math.max(1, place | 0), won = p === 1;
    const h = build();
    h.classList.toggle('win', won);
    h.querySelector('.k').textContent = won ? '' : t.kicker;
    h.querySelector('.p').textContent = won ? t.won : (ORD(p, lang) + (MEDAL[p] ? ' ' + MEDAL[p] : ''));
    h.querySelector('.s').textContent = won ? t.wonSub : (p <= 3 ? t.podium : t.again);
    h.classList.add('on');
    //+AG reinicia la animación del numerote aunque el nodo se reutilice entre partidas
    const pe = h.querySelector('.p'); pe.style.animation = 'none'; void pe.offsetWidth; pe.style.animation = '';
    timer = setTimeout(cerrar, Math.max(300, ms | 0));
  } catch (e) {
    console.warn('[veredicto] no se pudo pintar, se sigue igual:', e);
    cerrar();                                // pase lo que pase, el jugador NO se queda atrapado
  }
}

//+AG por si el motor tiene que abortar (volver al menú a media partida): cierra sin dejar el aviso pendiente.
export function cancelarVeredicto(){ pending = null; if (timer) { clearTimeout(timer); timer = 0; } if (host) host.classList.remove('on'); }
