// ============================================================================
//  ICONOS DE MODO · COPIA VENDORIZADA (doc 41 bloque C).
//
//  FUENTE UNICA DEL DIBUJO: C:\AI\BallTrials\prototipo-webgl\chassis\modeicons.mjs
//  (spec del brand-designer en el docs/39 del repo del canal). Los mismos SVG que usa
//  balltrials.com en su seccion "The Trials" y la tarjeta de ronda del torneo.
//
//  POR QUE UNA COPIA: juego.html es un unico archivo autocontenido con un <script> clasico
//  (no modulos), igual que el chassis del motor ya va vendorizado dentro de motor/. Para que
//  la copia no derive en silencio, tools/lint-arte.mjs COMPARA este archivo con el del canal
//  y falla si no coinciden. Si hay que cambiar un icono, se cambia ALLI y se vuelve a copiar.
//
//  Familia: SVG plano, TODO ORO (los colores de equipo estan reservados); la diferenciacion la
//  da la SILUETA, no el color. Sin texto ni numeros.
//
//  Incluye 'redlight': se dibuja primero en el chassis del canal y se copia aqui para que el
//  shell clasico pueda usar el mismo SVG sin importar un modulo ES.
// ============================================================================
//  Se carga con un <script src> CLASICO antes del script principal de juego.html: los scripts
//  clasicos se ejecutan en orden, asi que la constante ya existe cuando el juego arranca (un
//  <script type="module"> se ejecuta DESPUES del parseo y llegaria tarde al primer render).
window.VENDORED_MODE_ICONS = {
  race: { vb: '0 0 64 64', markup:
    `<defs><clipPath id="btfcl"><path d="M16 10 C27 6.5 38 12.5 56 8.5 L58.5 21.2 L57 34.5 C38 38.5 27 32.5 16 36.2 Z"/></clipPath></defs> <g stroke="#1c1c24" stroke-width="1.6" stroke-linejoin="round"> <rect fill="#e6b41e" x="12" y="6" width="4" height="52" rx="2"/> <circle fill="#ffe27a" cx="14" cy="7" r="3"/> <path fill="#ffcf3a" d="M16 10 C27 6.5 38 12.5 56 8.5 L58.5 21.2 L57 34.5 C38 38.5 27 32.5 16 36.2 Z"/> <g clip-path="url(#btfcl)" stroke="none"> <path fill="#ffe27a" d="M14 5 L26 5 L26 17.5 L14 18.7 Z"/> <path fill="#1c1c24" d="M26 5 L36 5 L36 18.9 L26 17.5 Z M46 5 L59 5 L59 17.2 L46 18.5 Z M14 18.7 L26 17.5 L26 26.2 L14 27.4 Z M36 18.9 L46 18.5 L46 27.2 L36 27.6 Z M26 26.2 L36 27.6 L36 40 L26 40 Z M46 27.2 L59 25.9 L59 40 L46 40 Z"/> </g> <path fill="none" d="M16 10 C27 6.5 38 12.5 56 8.5 L58.5 21.2 L57 34.5 C38 38.5 27 32.5 16 36.2 Z"/> </g>` },
  cazador: { vb: '0 0 64 64', markup:
    `<g stroke="#1c1c24" stroke-width="1.6" stroke-linejoin="round"> <circle fill="#ffcf3a" cx="40" cy="32" r="19"/> <ellipse fill="#fff0b0" stroke="none" opacity=".75" cx="33" cy="18.5" rx="4.5" ry="2.4" transform="rotate(-24 33 18.5)"/> <ellipse fill="#ffffff" stroke-width="1.4" cx="33" cy="31" rx="3" ry="3.5"/> <ellipse fill="#ffffff" stroke-width="1.4" cx="45" cy="31" rx="3" ry="3.5"/> <circle fill="#1c1c24" stroke="none" cx="31.9" cy="32.4" r="2"/> <circle fill="#1c1c24" stroke="none" cx="43.9" cy="32.4" r="2"/> <path fill="none" stroke-width="3.5" stroke-linecap="round" d="M26 22.5 L34.5 26.5 M52 22.5 L43.5 26.5"/> <path fill="none" stroke-width="2.2" stroke-linecap="round" d="M34 43 Q39 39.5 44 43"/> <path fill="none" stroke-width="2" stroke-linecap="round" d="M18.5 41 H23 M19 46.5 H24.5 M20.5 51.5 H25.5"/> <circle fill="#ffe27a" cx="13" cy="47" r="7.5"/> <circle fill="#1c1c24" stroke="none" cx="15.8" cy="44.4" r="1.4"/> <circle fill="#1c1c24" stroke="none" cx="18.4" cy="45.6" r="1.4"/> </g>` },
  redlight: { vb: '0 0 64 64', markup:
    `<g stroke="#1c1c24" stroke-width="1.6" stroke-linejoin="round"> <rect fill="#ffcf3a" x="13" y="6" width="38" height="52" rx="12"/> <path fill="#fff0b0" stroke="none" opacity=".72" d="M20 11 Q17 15 17 23 L20 23 Q21 16 25 12 Z"/> <circle fill="#ffe27a" cx="32" cy="18" r="8"/> <circle fill="#e6b41e" cx="32" cy="32" r="8"/> <circle fill="#e6b41e" cx="32" cy="46" r="8"/> </g>` },
  suelo: { vb: '0 0 64 64', markup:
    `<g stroke="#1c1c24" stroke-width="1.6" stroke-linejoin="round"> <path fill="#ffcf3a" fill-rule="evenodd" d="M51 29 L40 48.1 L18 48.1 L7 29 L18 9.9 L40 9.9 Z M43 36.5 L39.3 43 L31.8 43 L28 36.5 L31.8 30 L39.3 30 Z"/> <path fill="#e6b41e" d="M7.5 0 L3.8 6.5 L-3.8 6.5 L-7.5 0 L-3.8 -6.5 L3.8 -6.5 Z" transform="translate(51 52) rotate(20)"/> <path fill="none" stroke-width="1.8" stroke-linecap="round" d="M41.5 44 L43.5 46 M45 39.5 L47.5 42"/> <ellipse fill="#fff0b0" stroke="none" opacity=".7" cx="15" cy="21.5" rx="6" ry="2.2" transform="rotate(-60 15 21.5)"/> </g>` },
  recolecta: { vb: '0 0 64 64', markup:
    `<g stroke="#1c1c24" stroke-width="1.6" stroke-linejoin="round"> <path fill="#ffcf3a" stroke="none" d="M18 18 L46 18 L54 30 L32 56 L10 30 Z"/> <path fill="#ffe27a" stroke="none" d="M18 18 L46 18 L37 30 L27 30 Z"/> <path fill="#e6b41e" stroke="none" d="M37 30 L54 30 L32 56 Z"/> <path fill="none" stroke-width="1.1" d="M10 30 L54 30 M18 18 L27 30 L32 56 M46 18 L37 30 L32 56"/> <path fill="none" d="M18 18 L46 18 L54 30 L32 56 L10 30 Z"/> <path fill="#fff0b0" stroke="none" d="M52 7.5 L53.4 10.6 L56.5 12 L53.4 13.4 L52 16.5 L50.6 13.4 L47.5 12 L50.6 10.6 Z"/> </g>` },
};
