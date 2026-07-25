// YouBall · ICONOS DE MODO (fuente ÚNICA del dibujo; spec del brand-designer en docs/39). Los usan:
//   · la WEB oficial (web/index.html, sección The Trials: sustituyen a los emoji)
//   · la TARJETA de ronda del torneo (torneo/frame.html?scene=card&mode=<clave>)
// Familia visual del marco (frame.html): SVG plano, oro #ffcf3a, oro oscuro #e6b41e, oro claro #ffe27a,
// brillo #fff0b0, tinta #1c1c24, blanco SOLO en escleróticas; trazo 1.6 en viewBox 64, margen interno 4.
// TODO ORO, sin acento por modo (los colores de equipo están reservados); la diferenciación la da la
// SILUETA: hexágono / bandera / persecución / banda ondulada / repisa / disco de púas / rombo en punta.
// SIN texto ni números (regla de marca). El campo `emoji` es el equivalente para texto plano de YouTube.

const GOLD = '#ffcf3a', GDARK = '#e6b41e', GLIGHT = '#ffe27a', HI = '#fff0b0', INK = '#1c1c24', WHITE = '#ffffff';

export const MODE_ICONS = {
  // "La baldosa que cae": baldosa hexagonal con un HUECO hexagonal (la pieza que faltaba) y el fragmento cayendo girado (docs/39 §3)
  suelo: { name: 'Shrinking Floor', emoji: '⬡', vb: '0 0 64 64', markup:
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <path fill="${GOLD}" fill-rule="evenodd" d="M51 29 L40 48.1 L18 48.1 L7 29 L18 9.9 L40 9.9 Z M43 36.5 L39.3 43 L31.8 43 L28 36.5 L31.8 30 L39.3 30 Z"/>
      <path fill="${GDARK}" d="M7.5 0 L3.8 6.5 L-3.8 6.5 L-7.5 0 L-3.8 -6.5 L3.8 -6.5 Z" transform="translate(51 52) rotate(20)"/>
      <path fill="none" stroke-width="1.8" stroke-linecap="round" d="M41.5 44 L43.5 46 M45 39.5 L47.5 42"/>
      <ellipse fill="${HI}" stroke="none" opacity=".7" cx="15" cy="21.5" rx="6" ry="2.2" transform="rotate(-60 15 21.5)"/>
    </g>` },

  // "La bandera de meta": mástil + paño ondulado con damero 4x3 de celdas grandes (docs/39 §4)
  race: { name: 'The Race', emoji: '🏁', vb: '0 0 64 64', markup:
    `<defs><clipPath id="btfcl"><path d="M16 10 C27 6.5 38 12.5 56 8.5 L58.5 21.2 L57 34.5 C38 38.5 27 32.5 16 36.2 Z"/></clipPath></defs>
    <g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <rect fill="${GDARK}" x="12" y="6" width="4" height="52" rx="2"/>
      <circle fill="${GLIGHT}" cx="14" cy="7" r="3"/>
      <path fill="${GOLD}" d="M16 10 C27 6.5 38 12.5 56 8.5 L58.5 21.2 L57 34.5 C38 38.5 27 32.5 16 36.2 Z"/>
      <g clip-path="url(#btfcl)" stroke="none">
        <path fill="${GLIGHT}" d="M14 5 L26 5 L26 17.5 L14 18.7 Z"/>
        <path fill="${INK}" d="M26 5 L36 5 L36 18.9 L26 17.5 Z M46 5 L59 5 L59 17.2 L46 18.5 Z M14 18.7 L26 17.5 L26 26.2 L14 27.4 Z M36 18.9 L46 18.5 L46 27.2 L36 27.6 Z M26 26.2 L36 27.6 L36 40 L26 40 Z M46 27.2 L59 25.9 L59 40 L46 40 Z"/>
      </g>
      <path fill="none" d="M16 10 C27 6.5 38 12.5 56 8.5 L58.5 21.2 L57 34.5 C38 38.5 27 32.5 16 36.2 Z"/>
    </g>` },

  // "La persecución": el depredador furioso (cejas en V, mirada a la presa) se abalanza sobre la bolita que huye (docs/39 §5)
  cazador: { name: 'The Hunter', emoji: '😡', vb: '0 0 64 64', markup:
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <circle fill="${GOLD}" cx="40" cy="32" r="19"/>
      <ellipse fill="${HI}" stroke="none" opacity=".75" cx="33" cy="18.5" rx="4.5" ry="2.4" transform="rotate(-24 33 18.5)"/>
      <ellipse fill="${WHITE}" stroke-width="1.4" cx="33" cy="31" rx="3" ry="3.5"/>
      <ellipse fill="${WHITE}" stroke-width="1.4" cx="45" cy="31" rx="3" ry="3.5"/>
      <circle fill="${INK}" stroke="none" cx="31.9" cy="32.4" r="2"/>
      <circle fill="${INK}" stroke="none" cx="43.9" cy="32.4" r="2"/>
      <path fill="none" stroke-width="3.5" stroke-linecap="round" d="M26 22.5 L34.5 26.5 M52 22.5 L43.5 26.5"/>
      <path fill="none" stroke-width="2.2" stroke-linecap="round" d="M34 43 Q39 39.5 44 43"/>
      <path fill="none" stroke-width="2" stroke-linecap="round" d="M18.5 41 H23 M19 46.5 H24.5 M20.5 51.5 H25.5"/>
      <circle fill="${GLIGHT}" cx="13" cy="47" r="7.5"/>
      <circle fill="${INK}" stroke="none" cx="15.8" cy="44.4" r="1.4"/>
      <circle fill="${INK}" stroke="none" cx="18.4" cy="45.6" r="1.4"/>
    </g>` },

  // "La rampa loca": perfil de TOBOGÁN-RAMPA que baja y remonta en kicker; la bola sale DISPARADA (docs/39 §6, as-built)
  tobogan: { name: 'The Crazy Slide', emoji: '🎢', vb: '0 0 64 64', markup:
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <path fill="${GOLD}" d="M6 14 C14 18 22 30 30 38 C35 42.5 40 44.5 44.5 42.5 C47.2 41.2 49.3 39 50.5 36 L52.5 47 C49.3 51 47.2 53.2 44.5 54.5 C40 56.5 35 54.5 30 50 C22 42 14 30 6 26 Z"/>
      <path fill="none" stroke="${HI}" stroke-width="2.2" stroke-linecap="round" opacity=".7" d="M8.5 16 C14 20 19.5 27.5 24.5 33"/>
      <path fill="none" stroke-width="1.8" stroke-linecap="round" d="M49.6 33.5 Q50.3 30.3 51.2 27.8"/>
      <circle fill="${GLIGHT}" cx="54" cy="19" r="6"/>
      <circle fill="${INK}" stroke="none" cx="52.5" cy="18.2" r="1.15"/>
      <circle fill="${INK}" stroke="none" cx="55.5" cy="18.2" r="1.15"/>
    </g>` },

  // "El borde": repisa suspendida, una bola en pie y otra cayendo por el extremo; tira de llamas abajo (docs/39 §7)
  plataforma: { name: 'The Platform', emoji: '🥊', vb: '0 0 64 64', markup:
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <path fill="${GDARK}" stroke-width="1.1" d="M8 61 L8 58.5 L10 55.5 L14 59 L18 55 L22 59 L26 55.5 L30 59.5 L34 55 L38 59 L42 55.8 L46 59.5 L50 55.2 L53 59 L56 57 L56 61 Z"/>
      <rect fill="${GOLD}" x="10" y="31" width="44" height="6" rx="2"/>
      <path fill="none" stroke="${HI}" stroke-width="1.8" stroke-linecap="round" opacity=".7" d="M13 32.8 H40"/>
      <circle fill="${GOLD}" cx="26" cy="23" r="8"/>
      <circle fill="${INK}" stroke="none" cx="23.5" cy="21.5" r="1.5"/>
      <circle fill="${INK}" stroke="none" cx="28.5" cy="21.5" r="1.5"/>
      <circle fill="${GDARK}" cx="51.5" cy="43.5" r="7.5"/>
      <circle fill="${INK}" stroke="none" cx="48.9" cy="41.9" r="1.4"/>
      <circle fill="${INK}" stroke="none" cx="52.1" cy="45.1" r="1.4"/>
      <path fill="none" stroke-width="1.8" stroke-linecap="round" d="M57.5 33.5 L56.9 37 M60.5 37.5 L60 40.5"/>
    </g>` },

  // "La sierra": disco dentado de 7 dientes emergiendo de la ranura del suelo, cubo pequeño (docs/39 §8)
  gauntlet: { name: 'The Gauntlet', emoji: '⚙️', vb: '0 0 64 64', markup:
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <path fill="${GOLD}" d="M17 44 L16.6 43.2 L10 40.7 L15 35.7 L15.2 33.3 L11.1 27.6 L18.1 26.2 L19.6 24.4 L19.4 17.3 L25.9 20.1 L28.2 19.4 L32 13.5 L35.8 19.4 L38.1 20.1 L44.6 17.3 L44.4 24.4 L45.9 26.2 L52.9 27.6 L48.8 33.3 L49 35.7 L54 40.7 L47.4 43.2 L47 44 Z"/>
      <ellipse fill="${HI}" stroke="none" opacity=".75" cx="24.5" cy="24.5" rx="4" ry="2.4" transform="rotate(-40 24.5 24.5)"/>
      <circle fill="${GDARK}" cx="32" cy="36" r="5"/>
      <circle fill="${INK}" stroke="none" cx="32" cy="36" r="1.8"/>
      <path fill="none" stroke-width="1.8" stroke-linecap="round" d="M22 12 Q27 8.8 33 8.3 M38 9 Q42 9.8 45.5 12"/>
      <rect fill="${GDARK}" x="6" y="44" width="52" height="6" rx="1.5"/>
    </g>` },

  // "El botín": diamante de talla brillante con facetas y destello (docs/39 §9)
  recolecta: { name: 'The Heist', emoji: '💎', vb: '0 0 64 64', markup:
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <path fill="${GOLD}" stroke="none" d="M18 18 L46 18 L54 30 L32 56 L10 30 Z"/>
      <path fill="${GLIGHT}" stroke="none" d="M18 18 L46 18 L37 30 L27 30 Z"/>
      <path fill="${GDARK}" stroke="none" d="M37 30 L54 30 L32 56 Z"/>
      <path fill="none" stroke-width="1.1" d="M10 30 L54 30 M18 18 L27 30 L32 56 M46 18 L37 30 L32 56"/>
      <path fill="none" d="M18 18 L46 18 L54 30 L32 56 L10 30 Z"/>
      <path fill="${HI}" stroke="none" d="M52 7.5 L53.4 10.6 L56.5 12 L53.4 13.4 L52 16.5 L50.6 13.4 L47.5 12 L50.6 10.6 Z"/>
    </g>` },

  // "El semáforo": carcasa vertical y gorda con la luz superior encendida; silueta distinta de los siete modos previos (encargo 05)
  redlight: { name: 'Red Light', emoji: '🚦', vb: '0 0 64 64', markup:
    `<g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">
      <rect fill="${GOLD}" x="13" y="6" width="38" height="52" rx="12"/>
      <path fill="${HI}" stroke="none" opacity=".72" d="M20 11 Q17 15 17 23 L20 23 Q21 16 25 12 Z"/>
      <circle fill="${GLIGHT}" cx="32" cy="18" r="8"/>
      <circle fill="${GDARK}" cx="32" cy="32" r="8"/>
      <circle fill="${GDARK}" cx="32" cy="46" r="8"/>
    </g>` },
};

// <svg> listo para insertar inline (web): mismo dibujo a cualquier tamaño
export const modeIconSvg = (key, attrs = '') => {
  const ic = MODE_ICONS[key]; if (!ic) return '';
  return `<svg viewBox="${ic.vb}" ${attrs} aria-hidden="true">${ic.markup}</svg>`;
};
