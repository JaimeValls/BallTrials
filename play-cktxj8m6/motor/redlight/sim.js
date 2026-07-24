// YouBall · RED LIGHT RUSH (Luz Roja / Luz Verde) — prueba EXCLUSIVA del torneo temático "The Marble Games"
// (NO forma parte del pool general de docs/16 §2.1, VB del dueño 2026-07-06). SIM determinista en JS.
// Diseño: docs/44-red-light-rush.md. Explanada ABIERTA 16:9 (fondo->cámara, eje Y=profundidad); 12 bolas
// (4x3) avanzan a meta SOLO en fase VERDE del semáforo global; en ROJO el motor se apaga y frenan por
// fricción realista (patinan) — quien sigue moviéndose pasado el margen muere. Trampas ESTÁTICAS activadas
// por PARÓN (losas/minas), contacto ciego (boulder), barrera rompible y bloqueadores en zigzag.
// OJO: NI apisonadora NI Muro Compactador — los dos se ELIMINARON en la v5 (ver línea ~81 y ~179); esta
// cabecera los siguió anunciando y el 2026-07-19 se coló un "crushing wall" en los metadatos publicables de
// un short (miniatura y descripción prometiendo algo que no sale en el vídeo). Siguen vivos SOLO en la
// versión de torneo largo de docs/52. Gana el 1er equipo con sus 3 bolas en meta (en SHORT, la 1ª bola en
// cruzar: es una CARRERA, no "last one standing"). Da 1 punto al torneo "The Marble Games".
//
// Hermano de gauntlet/cazador/recolecta: mismo shape público (balls, byTeam, events, winner_team/
// decision_frame/resolved_by/done/f) + extras de este modo (color, wallY, geo para el render).
//
// DETERMINISMO (casting Node == render navegador, docs/22 §1): SOLO ops IEEE (sqrt,+,-,*,/). PROHIBIDO
// hypot/sin/cos/atan2 por frame. Direcciones iniciales por RECHAZO. Semáforo = máquina de estados por FRAME
// ENTERO (secuencia precalculada en el constructor a partir de la semilla). Boulder = aritmética pura
// (triángulo de rebote, sin trig). Apisonadora/Muro = fase entera / avance lineal con literales.
//
// SIMPLIFICACIONES de este primer prototipo (a revisar con el sweep, ver docs/44 §16 "qué falta"):
//  - La detección de movimiento en rojo se evalúa 1×/frame (tras los 8 substeps), no cada substep: con
//    SUBSTEPS=8 y FRIC_RED=7.5 la velocidad no cambia lo bastante en 1/240s para que importe en la práctica.
//  - El "rayo de escaneo" (telegrafía de 3f) y el "clank"/luces de armado son eventos que dispara el sim para
//    que el render/audio los consuma; el sim no retrasa la muerte por ellos (igual que el resto del pool).
//  - El frenado anticipatorio (§6.2) usa una heurística simple (reduce el vmax objetivo si hay una trampa
//    dentro de AVOID_R*1.5 delante y quedan <=PLAN_HORIZON_F para el rojo), no una proyección exacta de la
//    trayectoria futura.

function mulberry32(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export class RNG {
  constructor(seed){ this._r = mulberry32((seed >>> 0) || 1); }
  random(){ return this._r(); }
  uniform(a, b){ return a + (b - a) * this._r(); }
  shuffle(arr){ for (let i = arr.length - 1; i > 0; i--){ const j = Math.floor(this._r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}

export const FPS = 30;
const SUBSTEPS = 8;
const DT = 1.0 / (FPS * SUBSTEPS);
export const BALL_R = 0.42;

export const TEAMS = [
  { name: 'Rojo',     color: [0.95, 0.20, 0.22] },
  { name: 'Verde',    color: [0.20, 0.85, 0.32] },
  { name: 'Azul',     color: [0.10, 0.28, 1.00] },
  { name: 'Amarillo', color: [1.00, 0.85, 0.15] },
];
const BALLS_PER_TEAM = 3;
const N_BALLS = TEAMS.length * BALLS_PER_TEAM;   // 12

// --- PERFIL SHORT (formato vertical individual, docs/35): NO afecta al torneo (modo por defecto, byte-idéntico).
// Carrera pura de N colores INDIVIDUALES (cada color = "equipo" de 1 bola → no toca coronación/celebración, que
// leen winner_team). Misma paleta/orden EXACTOS que cazador/tobogan (convención: cada modo autocontenido, sin
// import cruzado). Se activa con opts.individual (index: ?short=1 / ?n=6|8). ---
// Nombres en INGLÉS: el kill feed los PINTA en pantalla (canal anglófono). Con nombres en español el feed sacaba
// "NARANJA/CIAN/VIOLETA" en los shorts publicados (2026-07-19). Mismo orden/colores que antes; solo cambia el texto.
export const SHORT_COLORS = [
  { name: 'Blue',    color: [0.18, 0.52, 1.00] },
  { name: 'Green',   color: [0.22, 0.88, 0.34] },
  { name: 'Orange',  color: [1.00, 0.55, 0.12] },
  { name: 'Magenta', color: [1.00, 0.40, 0.70] },
  { name: 'Cyan',    color: [0.25, 0.92, 0.92] },
  { name: 'Red',     color: [0.95, 0.18, 0.20] },
  { name: 'Violet',  color: [0.70, 0.27, 1.00] },
  { name: 'Yellow',  color: [1.00, 0.88, 0.22] },
];
export const SHORT_COLORS_6 = [
  { name: 'Red',     color: [0.95, 0.18, 0.20] },
  { name: 'Blue',    color: [0.18, 0.52, 1.00] },
  { name: 'Magenta', color: [1.00, 0.40, 0.70] },
  { name: 'Green',   color: [0.22, 0.88, 0.34] },
  { name: 'Cyan',    color: [0.25, 0.92, 0.92] },
  { name: 'Yellow',  color: [1.00, 0.88, 0.22] },
];

// --- EXPLANADA (ancha en X, larga en Y=profundidad hacia meta; 16:9, cámara tres-cuartos alta §5) ---
// v5 (feedback del dueño 2026-07-07): campo CORTO (partida punchy ~25-35s; el v4 largo era un slog). La variedad
// y el "tiempo" ya no vienen de más distancia sino de OBSTÁCULOS interactivos: barrera rompible (igualador) +
// bloqueadores de media pista (zigzag). Fuera la apisonadora (confundía). Bolas a velocidad natural.
export const FIELD_W = 26.0;
const TILE_L = 48.0, NTILES = 1;
export const FIELD_L = TILE_L * NTILES;   // 48
export const XL = -FIELD_W / 2, XR = FIELD_W / 2;   // -13 .. +13
export const SPAWN_Y = 2.0;
export const GATE_Y = FIELD_L - 4.0;      // cruzar = a salvo (44)
export const SAFE_Y = FIELD_L - 1.5;      // centro del corral de meta

// --- RELOJ / VICTORIA (docs/44 §13.1) --- (v5: modo CORTO, ~25-38s → tope y protección acordes)
export const GAME_F = 1500;          // 50 s tope de juego standalone (fallback; la partida acaba antes al decidirse)
export const GAME_F_FUNNEL = 2250;   // 75 s tope en EMBUDO (presupuesto §9 Red Light): da tiempo a que crucen las últimas
const START_DELAY = 9;               // gracia inicial de spawn (docs/16 §7.2), 0.3 s
const WIN_HOLD = 90;                 // celebración tras decisión
const SAFE_F = 420;                  // no eliminar a la ÚLTIMA bola de un equipo (si deja 1 equipo) antes de 14s;
                                     // pasado eso, las muertes valen (antes 0.75*GAME_F=64s > partida → nadie moría
                                     // en el tramo final = "la mina no mata" + no se acababa). docs/44 §10.6

// --- PARÁMETROS AJUSTABLES por el sweep de calibración (mutar TUNE entre lotes; los valores por defecto son
//     los de docs/44 como punto de partida). El resto de constantes son estructurales y no se barren. ---
// Valores CALIBRADOS v2 (sweep 2026-07-06): equilibran las 4 causas de muerte (§7.4, ninguna >45%). El punto
// crítico es FRIC_RED≈9: por debajo el semáforo mata casi todo (paran tarde), por encima perdona casi todo
// (paran dentro de la gracia) → el boulder domina. 9.0 cae en la meseta equilibrada. Los defaults de docs/44
// (FRIC 7.5, BOULDER_V 4.5, AVOID 12/8, fases 54-108/66-132) quedan como referencia de diseño, sobreescritos aquí.
export const TUNE = {
  V_CLAMP: 5.0,                    // vmax en verde (u/s) — palanca principal de DURACIÓN (más lento = más largo)
  GREEN_MIN: 66, GREEN_MAX: 120,   // §3.1 semáforo (frames)
  RED_MIN: 60, RED_MAX: 120,
  // v6 (opción C "que patine VISIBLE", calibrado por grid-search 2026-07-08): FRIC_RED bajado 9→6 alarga el
  // patinaje para que se VEA que la culpable siguió deslizándose (skid mediano 1.7→2.7 diámetros de bola). Para
  // que eso NO dispare las muertes por semáforo (con FRIC bajo casi nadie para → sem 98%), se sube el umbral
  // 0.07→0.19 (solo se marca a las que siguen CLARAMENTE en movimiento) y la gracia 12→18f. Resultado sweep:
  // causas 42/25/33 (maxC 42% ✅ <45), dur 30s, saves 14, teams 87%, DRAMA 100%.
  FRIC_RED: 6.0,                   // §3.2 deceleración de patinaje (u/s^2) — más bajo = deslizón más largo y visible
  V_THRESH_FRAC: 0.19,             // §3.2 umbral "sigue en movimiento" = fracción de V_CLAMP (ver nota abajo)
  STOP_GRACE: 18,                  // §3.2 frames de gracia de frenado tras empezar el rojo (0.6 s a 30fps)
  BOULDER_V: 3.0,                  // §7.3 velocidad del boulder (u/s) — más lento = esquivable en verde
  BOULDER_AVOID_R: 12.0,           // §6 radio de esquive del boulder (v5: 12 para que no domine en campo corto)
  AVOID_TRAP: 16.0,                // §6 peso de evitación de trampas estáticas
  BARRIER_HP: 150,                 // v5 vida de la barrera rompible (bola-contacto-frames para reventarla)
};

// --- SEMÁFORO (docs/44 §3.1) ---
const WARN_F = 18;                        // telegrafía ámbar antes de pasar a rojo (0.6 s)

// --- INERCIA / FRICCIÓN / DETECCIÓN (docs/44 §3.2) --- (V_CLAMP ajustable → TUNE.V_CLAMP)
// (STOP_GRACE y V_THRESH_FRAC viven ahora en TUNE ↑ para poder calibrarlos; V_THRESH_FRAC es PROPORCIONAL a
//  V_CLAMP → la detección dispara al mismo frame sea cual sea la velocidad; si fuera absoluto, con bolas lentas
//  nadie se movería lo bastante y el semáforo no mataría a nadie.)
const DETECT_CONFIRM_F = 3;   // frames consecutivos sobre el umbral antes de MARCAR (apuntar la mirilla)
const SNIPER_LOCK_F = 18;     // frames que la mirilla APUNTA antes de disparar (0.6s: da tiempo a leerlo y a frenar)
const SCAN_WARN_F = 3;        // telegrafía cosmética del rayo de escaneo (evento, no retrasa la muerte)
const PLAN_HORIZON_F = 30;    // ventana de frenado anticipatorio antes del aviso ámbar

// --- STEERING (docs/44 §6, pesos VB del dueño 2026-07-06 como punto de partida, calibrar con sweep) ---
const GOAL = 10.0;
const AVOID_R = 4.0;   // AVOID_TRAP (peso) es ajustable → TUNE.AVOID_TRAP
const WALLAV = 9.0, WALL_NEAR = 1.5;
const SEP = 5.5, SEP_R = 1.7;
const WANDER = 1.5;
const DAMP = 0.04;
const RUBBER = 1.08;           // rebufo <= +8% al equipo más atrasado, solo en verde
const STUCK_F = 150;           // anti-atasco (5 s sin avanzar en verde)
const ANTICIP_MIN = 6, ANTICIP_MAX = PLAN_HORIZON_F;   // rango de b.brakeLead (temeraria..veterana)

//+AG capa de AGENCIA del jugador (docs/21, port del Cazador): el jugador controla SOLO su bola (balls[0]) y SOLO
//   cuando da input (this.pIn.engaged). El control PRINCIPAL es CORRER (mantener pulsado): decide CUÁNDO empuja el
//   motor, no CUÁNTO (usa la MISMA fuerza GOAL y el MISMO vmax V_CLAMP que la IA). Todo se aplica DESPUÉS del
//   steering normal de la IA (que sigue consumiendo el MISMO RNG) → con IA sola (engaged=false) la sim queda
//   BYTE-IDÉNTICA a la fuente y los bots nunca se desincronizan. El jugador obedece la MISMA física y la MISMA
//   regla de muerte que la IA (moverse en rojo pasado el margen = ejecutado por el francotirador).
const P_BRAKE_DUR = 12;    //+AG FRENAZO: ~0.4 s de frenada fuerte
const P_BRAKE_CD = 90;     //+AG FRENAZO: ~3 s de recarga
const P_BRAKE_FRIC = 42;   //+AG FRENAZO: deceleración (u/s^2) muy por encima de FRIC_RED → clava la bola en seco
//+AG CARRILES (izq/centro/der): objetivos X de cada pasillo. ±0.30*FIELD_W = ±7.8, que cae DENTRO del hueco de
//   9u de su bloqueador (gap 'R'→[+4,+13], 'L'→[-13,-4]) y deja aire con el muro (±13) y con el jitter de minas
//   (clamp a ±11.7) → cada carril es un pasillo jugable de verdad; el centro es el eje. La fuerza lateral es
//   PROPORCIONAL a la distancia al eje del carril con TOPE (misma familia y orden de magnitud que el steering
//   de esquive de la IA: el empuje al hueco del bloqueador llega a AVOID_TRAP*1.3≈21; aquí tope 12 ≈ GOAL →
//   "la bola tira hacia ese pasillo", no un raíl) y SOLO se aplica mientras CORRES: al soltar, patina libre.
const P_LANE_X = { left: -FIELD_W * 0.30, center: 0, right: FIELD_W * 0.30 };
const P_LANE_K = 3.0;      //+AG ganancia (u/s^2 por unidad de distancia al eje del carril elegido)
const P_LANE_MAX = 12.0;   //+AG tope de la fuerza lateral de carril
//+AG NITRO: ~1.5s de sobreempuje x1.6 (multiplica el GOAL del jugador y su V_CLAMP objetivo). Solo empuja si
//   CORRES. RIESGO INTENCIONAL: a más velocidad el patinaje es más largo (skid = v²/2·FRIC_RED: a 8 u/s son
//   ~5.3u vs ~2.1u a 5) → con Nitro es MÁS difícil frenar antes del rojo, y la regla de muerte NO se ablanda:
//   moverte en rojo pasado el margen te ejecuta el francotirador igual, con Nitro o sin él.
const P_NITRO_DUR = 45, P_NITRO_CD = 240, P_NITRO_MUL = 1.6;
//+AG FANTASMA: ~2s intangible para lo ESTÁTICO: no ACTIVA trampas de parón (losas/minas: se le excluye de la
//   ocupación → ni arman ni le estallan) y ATRAVIESA bloqueadores y barrera. SÍ sigue colisionando con las
//   demás bolas, SÍ lo arrolla el boulder (roca rodante, no trampa activada) y SÍ lo mata el francotirador si
//   se mueve en rojo: el Fantasma engaña a las trampas, no al semáforo.
const P_GHOST_DUR = 60, P_GHOST_CD = 300;
//+AG SÚPER NITRO (por barra: superVal vive en el embed y se llena jugando bien, patrón Cazador): ~2.5s de
//   sobreempuje x2.0. Igual que el Nitro, NO te salva del rojo — solo corre más quien más se arriesga.
const P_SUPER_DUR = 75, P_SUPER_MUL = 2.0;
//+AG SALIDA FALSA (feedback del dueño 2026-07-22): la gracia del semáforo (STOP_GRACE + confirmación +
//   apuntado) es un MARGEN DE FRENADA para quien venía en movimiento cuando saltó el rojo. Quien ya estaba
//   PARADO en rojo y acelera A PROPÓSITO (CORRER pulsado) no está frenando: está robando la salida — y ahí el
//   francotirador no perdona: fija al instante (sin confirmación y sin esperar el STOP_GRACE) y dispara en
//   P_FS_LOCK_F. Solo con input (running): un empujón de otra bola estando parado NO es trampa tuya y sigue
//   con la regla normal. Umbrales con histéresis: "parada" muy por debajo del umbral de detección (SETTLE),
//   "arranca" por debajo del umbral normal (V) → más sensible que con la IA, como pidió el dueño.
const P_FS_SETTLE = 0.35;  //+AG fracción de vThresh por debajo de la cual tu bola cuenta como PARADA en rojo
const P_FS_V = 0.5;        //+AG fracción de vThresh que, ya parada y corriendo TÚ, dispara el fijado inmediato
const P_FS_LOCK_F = 6;     //+AG frames de apuntado de la salida falsa (~0.2 s; el normal es SNIPER_LOCK_F)

// --- LAYOUT PROGRESIVO del campo corto (48u) (v5.3, feedback del dueño). Secuencia por Y:
//   BARRERA(7) → BLOQUEADOR(12) → 1 boulder(18) → minas dispersas(20-25) → BLOQUEADOR(27) → BARRERA(30) →
//   minas densas(31-35) → PAR de boulders(37,39) → meta(44).
//   La idea: EMPEZAR entretenido SIN matar (barrera+bloqueador), y que la MATANZA SUBA (minas más tarde y en
//   aumento; boulders 1 primero, el PAR al final). El layout se genera por SEMILLA con jitter leve → no idéntico. ---

// --- MINAS (si una bola PARA encima, se ARMA y estalla; render = mina con pinchos). Base + jitter por semilla. ---
const PAD_R = 1.0, ARM_F = 15;
const PADS_BASE = [
  // dispersas (Z1) — primeras muertes por mina, POCAS
  { x: -6, y: 20, zone: 'Z1' }, { x: 7, y: 22, zone: 'Z1' }, { x: -1, y: 25, zone: 'Z1' }, { x: 9, y: 24, zone: 'Z1' },
  // densas — la matanza sube
  { x: -9, y: 31 }, { x: 0, y: 32 }, { x: 9, y: 32 }, { x: -5, y: 34 }, { x: 5, y: 35 },
];

// --- BOULDER: rueda perpendicular, arrolla por contacto. 1 SOLO temprano (Y18), el PAR al final (Y37,39). ---
const BOULDER_R = 1.6;                                      // BOULDER_V (velocidad) es ajustable → TUNE.BOULDER_V
const BOULDER_PLAY = (XR - BOULDER_R) - (XL + BOULDER_R);   // ancho jugable para el rebote
const BOULDERS_BASE = [ { y: 18, phaseFrac: 0.0 }, { y: 37, phaseFrac: 0.0 }, { y: 39, phaseFrac: 0.5 } ];
const BOULDER_LEAD_F = 15;   // reacción anticipada (§6): la IA reacciona a la posición futura del boulder
const BOULDER_BAND = BOULDER_R + BALL_R;   // semi-anchura de la franja letal de UN boulder (para "no pararse ahí")

// --- BLOQUEADORES DE MEDIA PISTA (sólidos, NO matan): tapan media anchura dejando un HUECO a un lado → zigzag. ---
const BLOCK_THICK = 1.2, BLOCK_GAP = 9.0;   // hueco abierto de 9u a un lado (el resto es muro)
const BLOCKERS_BASE = [ { y: 12, gap: 'R' }, { y: 27, gap: 'L' } ];   // 'R'=hueco a la derecha; alternan = slalom
function blockerOpen(b){ return b.gap === 'R' ? [XR - BLOCK_GAP, XR] : [XL, XL + BLOCK_GAP]; }

// --- BARRERA ROMPIBLE (IGUALADOR, NO mata): paso obligado; las bolas la revientan embistiendo en verde → bunchea.
//     Una TEMPRANA (Y7, engancha al arrancar) + una tardía (Y30, igualador antes del par de boulders). ---
const BARRIER_THICK = 1.4, BARRIER_HALFW = 11.0;   // cubre x∈[-11,11]; con muros a ±13 = sin escapatoria
const BARRIERS_BASE = [ { y: 7, xc: 0 }, { y: 30, xc: 0 } ];
const BASH_DMG = 1;   // daño por bola-en-contacto-y-verde por frame (HP en estas unidades)

// (v5: el MURO COMPACTADOR de §8 se elimina — no aporta en el modo corto y era un artefacto visual)

// --- hipotenusa IEEE (idéntica Node/Chromium) ---
const hyp = (a, b) => Math.sqrt(a * a + b * b);
const clampn = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
// triángulo 0..1..0 con fase entera (sin trig) — patrón de gauntlet/sim.js
function tri(clock, period){ const ph = ((clock % period) + period) % period, half = period / 2; return ph < half ? ph / half : (period - ph) / half; }

//+AG doc 39 abierto #1 (2026-07-24, VB Jaime): los ATRIBUTOS de la bola equipada modulan la FÍSICA, efecto SUTIL
//   (±STAT_K) y SOLO en perfil INDIVIDUAL sobre balls[0] (el jugador). attr 6.5 → 1.0; attr 13 → +12%; attr 0 → −12%.
//   Sin RNG. Sin opts.stats → todos 1.0 (no-op: individual-sin-stats byte-idéntico). El torneo nunca trae stats.
//   REGLA DURA: ningún stat te salva del francotirador — moverte en rojo pasado el margen te mata igual (RES/AGA
//   mueven la física del frenado/control, no la regla de muerte). Sin inmunidad ni teleport.
const STAT_K = 0.12;
//+AG multiplicador CAPADO a ±STAT_K (attr 0→0.88, 6.5→1.0, 13→1.12; firma que pase de 13 a nivel alto no rebasa ±12%).
const statMul = a => { const m = 1 + (a - 6.5) / 6.5 * STAT_K; return m < 1 - STAT_K ? 1 - STAT_K : (m > 1 + STAT_K ? 1 + STAT_K : m); };
const NEUTRAL_MUL = { vel:1, ace:1, pes:1, aga:1, res:1, bst:1 };

export class Sim {
  // opts (MODO EMBUDO del torneo, docs/52 §2.2/§2.3; sin opts = standalone byte-idéntico):
  //   roster: [{num, team}, …] → plantel con IDENTIDAD PERSISTENTE (dorsal/color originales, §3).
  //           Sin roster: plantel nativo 4×3 = 12.
  //   survTarget: sobreviven las PRIMERAS N en cruzar; al cruzar la N-ésima el resultado está cerrado y las
  //           que siguen corriendo mueren (las alcanza el muro). null = regla nativa ("1er equipo completo").
  constructor(seed = 1, opts = {}){
    this.seed = seed; const rng = new RNG(seed); this.rng = rng;
    this.f = 0; this.done = false;
    this.survTarget = opts.survTarget != null ? opts.survTarget : null;

    // --- PERFIL: torneo (default, 4 equipos×3) o SHORT individual (docs/35). El default queda BYTE-IDÉNTICO:
    //     con opts vacío this.teams===TEAMS, nTeams===4, ballsPerTeam===3 → mismos arrays y misma secuencia RNG. ---
    this.individual = !!opts.individual;
    //+AG CÓMO JUGAR (tutorial): nivel sin peligro (sin minas/boulders, francotirador desarmado, bots sin meta).
    //   Flag ausente → todo idéntico a la fuente (no consume RNG).
    this.tutorial = !!opts.tutorial;
    //+AG doc 39 #1: modificador de física por atributos, SOLO individual y SOLO balls[0]. No consume RNG (constantes).
    const _S = (this.individual && Array.isArray(opts.stats) && opts.stats.length === 6) ? opts.stats : null;
    this.pmul = _S ? { vel:statMul(_S[0]), ace:statMul(_S[1]), pes:statMul(_S[2]), aga:statMul(_S[3]), res:statMul(_S[4]), bst:statMul(_S[5]) } : NEUTRAL_MUL;
    const nInd6 = this.individual && opts.n === 6;
    this.teams = this.individual ? (nInd6 ? SHORT_COLORS_6 : SHORT_COLORS) : TEAMS;
    this.nTeams = this.teams.length;                                   // 4 torneo · 8/6 individual
    this.ballsPerTeam = this.individual ? 1 : BALLS_PER_TEAM;
    this.nBalls = this.individual ? this.nTeams : N_BALLS;             // 1 bola por color en individual

    // Bolas en rejilla de 4 columnas al fondo (spawn), empujadas a +Y. Barajar fila/columna por semilla.
    // Sin roster el plantel es el nativo (12, dorsal = i+1) y el RNG se consume igual → standalone idéntico.
    // Individual: N bolas, cada una su propio "equipo" (team = i, color = paleta[i]) → carrera de N colores.
    const roster = (opts.roster && opts.roster.length)
      ? opts.roster
      : this.individual
        ? Array.from({ length: this.nBalls }, (_, i) => ({ num: i + 1, team: i }))
        : Array.from({ length: N_BALLS }, (_, i) => ({ num: i + 1, team: Math.floor(i / BALLS_PER_TEAM) }));
    this.census = roster.length;
    this.balls = [];
    const slots = rng.shuffle([...Array(roster.length).keys()]);
    for (let i = 0; i < roster.length; i++){
      const team = roster[i].team;
      const s = slots[i], col = s % 4, row = (s / 4) | 0;
      const x = (col - 1.5) * 3.0 + rng.uniform(-0.15, 0.15);
      const y = SPAWN_Y + row * 1.3 + rng.uniform(-0.15, 0.15);
      let ux, uy, ul; do { ux = rng.uniform(-1, 1); uy = rng.uniform(0.2, 1); ul = ux * ux + uy * uy; } while (ul < 0.05 || ul > 1);
      ul = Math.sqrt(ul);
      this.balls.push({ id: i, num: roster[i].num, team, color: this.teams[team].color,
        x, y, vx: 0.6 * ux / ul, vy: 0.6 * uy / ul, m: 1.0, scale: 1.0,
        rank: null, safe: false, waitf: 0, stuckF: 0, stuckMarkY: y, starF: 0, invuln: false,
        isPlayer: i === 0 });   //+AG balls[0] = jugador (color Azul en individual, primero de la paleta short)
    }
    this.byTeam = this.teams.map((_, t) => this.balls.filter(b => b.team === t));
    //+AG doc 39 #1: PES → masa del jugador en colisiones (empuja más, lo desvían menos). m no lo tocan las trampas
    //   en redlight → fijarlo aquí basta. pmul.pes=1 fuera de individual-con-stats.
    if (this.balls[0]) this.balls[0].m = this.pmul.pes;
    this.crossed = new Array(this.nTeams).fill(0);
    this.placed = 0;
    this.vThresh = TUNE.V_THRESH_FRAC * TUNE.V_CLAMP;   // umbral de detección, proporcional a la velocidad tope

    // periodo del boulder (depende de TUNE.BOULDER_V): se fija por instancia para determinismo Node/render.
    this.boulderPeriodOneway = Math.round(FPS * BOULDER_PLAY / TUNE.BOULDER_V);
    this.boulderPeriod = this.boulderPeriodOneway * 2;

    // CAP consciente del modo (Jaime 2026-07-18, "opción 2"): el EMBUDO (24 bolas, solo 8 muertes) necesita más
    // tiempo que el short standalone para que las últimas supervivientes CRUCEN la meta de verdad — si no, al llegar
    // el cap se teletransportan (cierre 'funnel_progress', que Jaime rechazó). 75s embudo = presupuesto §9 de Red
    // Light (2250f); 50s standalone (sin cambio → byte-idéntico, no consume RNG de fases extra).
    this.capF = this.survTarget !== null ? GAME_F_FUNNEL : GAME_F;

    // semáforo: secuencia precalculada [color, dur] hasta cubrir de sobra el cap. Arranca SIEMPRE en VERDE.
    this.phases = [];
    { let total = 0, color = 'green';
      while (total < this.capF + 200){
        const dur = Math.round(color === 'green' ? rng.uniform(TUNE.GREEN_MIN, TUNE.GREEN_MAX) : rng.uniform(TUNE.RED_MIN, TUNE.RED_MAX));
        this.phases.push({ color, dur });
        total += dur; color = color === 'green' ? 'red' : 'green';
      }
    }
    this.phaseIdx = 0; this.phaseStart = 0; this.phaseEnd = this.phases[0].dur;
    this.color = 'green'; this.redStartF = null;
    for (const b of this.balls) b.brakeLead = Math.round(rng.uniform(ANTICIP_MIN, ANTICIP_MAX));

    // trampas/obstáculos: layout POR SEMILLA (jitter leve → el mapa no sale idéntico siempre). RNG SEPARADA del
    // juego (no desplaza la secuencia de la sim). Solo las MINAS se jitterean (X±1.6, Y±0.7); boulders/bloqueadores/
    // barreras mantienen su Y estructural (para no romper el balance progresivo).
    const lrng = mulberry32((seed * 0x9e3779b1) >>> 0);
    const jitX = (x, a) => { const v = x + (lrng() * 2 - 1) * a; return v < XL + 1.3 ? XL + 1.3 : (v > XR - 1.3 ? XR - 1.3 : v); };
    //+AG tutorial: SIN minas ni boulders (vaciar aquí quita física Y render a la vez; bloqueadores y barreras se
    //   quedan: no matan y son la lección de carril/embestida). lrng es local → no toca la secuencia del juego.
    this.pads = this.tutorial ? [] : PADS_BASE.map(p => ({ ...p, x: jitX(p.x, 1.6), y: p.y + (lrng() * 2 - 1) * 0.7, armed: false, armF: 0 }));
    this.boulders = this.tutorial ? [] : BOULDERS_BASE.map(b => ({ ...b }));
    this.blockers = BLOCKERS_BASE.map(b => ({ ...b }));
    this.barriers = BARRIERS_BASE.map(b => ({ ...b, hp: TUNE.BARRIER_HP, hp0: TUNE.BARRIER_HP, broken: false }));
    //+AG tutorial: barrera BLANDA (150 HP está pensada para el pelotón; aquí embiste el jugador solo → ~1.3s en verde)
    if (this.tutorial) for (const bar of this.barriers){ bar.hp = bar.hp0 = 40; }
    this.lastCrossPlaced = new Array(this.nTeams).fill(0);   // placed-order del último cruce de cada equipo (desempate: cruzar antes gana)

    this.winner_team = null; this.decision_frame = null; this.resolved_by = null;
    this.oob = false;
    this.events = this._freshEvents();
    this.geo = { field_w: FIELD_W, field_l: FIELD_L, xl: XL, xr: XR, spawn_y: SPAWN_Y, gate_y: GATE_Y, safe_y: SAFE_Y,
      pads: this.pads, pad_r: PAD_R, boulders: this.boulders, boulder_r: BOULDER_R,
      blockers: this.blockers, block_thick: BLOCK_THICK, block_gap: BLOCK_GAP,
      barriers: this.barriers, barrier_thick: BARRIER_THICK, barrier_halfw: BARRIER_HALFW };
    this.win_score = this.ballsPerTeam; this.game_f = this.capF;

    //+AG estado de la capa de agencia. INERTE hasta que el embed llame playerEngage(): mientras engaged=false toda
    //   la lógica +AG es un no-op → identidad byte a byte con la fuente (verificado headless). engaged=true hace que
    //   "no pulsar CORRER = frenar" desde el primer frame de juego (perfil Luz Roja: hay que decidir cuándo correr).
    //+AG lane arranca en 'center'; nitro/ghost/super con ventana activa (Until) + recarga (Cd) en frames de sim,
    //   como dash_cd del Cazador. Campos extra inertes sin engaged → identidad intacta.
    this.pIn = { engaged: false, running: false, brakeUntil: -1, brakeCd: -1,
      lane: 'center', nitroUntil: -1, nitroCd: -1, ghostUntil: -1, ghostCd: -1, superUntil: -1,
      redStopped: false };   //+AG SALIDA FALSA: true cuando TU bola ya se asentó (parada) durante este rojo
  }
  //+AG ACCIONES DEL JUGADOR (solo balls[0], solo si está viva). NO consumen RNG ni tocan a las demás bolas.
  playerEngage(){ this.pIn.engaged = true; }        // el embed lo llama al soltar la intro: desde aquí manda el input
  playerRun(on){ this.pIn.running = !!on; }         // CORRER (mantener): en verde empuja tu motor; en rojo te delata
  playerBrake(){ const p = this.balls[0];           // FRENAZO: frenada fuerte instantánea con recarga (~3 s)
    if (!p || p.rank !== null || this.f < this.pIn.brakeCd) return false;
    this.pIn.brakeUntil = this.f + P_BRAKE_DUR; this.pIn.brakeCd = this.f + P_BRAKE_CD; return true; }
  playerLane(k){                                    //+AG CARRIL: cambiar la intención es instantáneo; la bola
    if (k !== 'left' && k !== 'center' && k !== 'right') return false;   //   tarda lo que tarde la física
    this.pIn.lane = k; return true; }
  //+AG doc 39 #1: BST → duración de los boosters del jugador (nitro/fantasma/súper); el cooldown NO cambia. pmul.bst=1
  //   fuera de individual-con-stats → duraciones idénticas a la fuente.
  playerNitro(){ const p = this.balls[0];           //+AG NITRO: sobreempuje x1.6 ~1.5s, recarga ~8s
    if (!p || p.rank !== null || this.f < this.pIn.nitroCd) return false;
    this.pIn.nitroUntil = this.f + Math.round(P_NITRO_DUR * this.pmul.bst); this.pIn.nitroCd = this.f + P_NITRO_CD; return true; }
  playerGhost(){ const p = this.balls[0];           //+AG FANTASMA: intangible a trampas/obstáculos ~2s, recarga ~10s
    if (!p || p.rank !== null || this.f < this.pIn.ghostCd) return false;
    this.pIn.ghostUntil = this.f + Math.round(P_GHOST_DUR * this.pmul.bst); this.pIn.ghostCd = this.f + P_GHOST_CD; return true; }
  playerSuper(){ const p = this.balls[0];           //+AG SÚPER NITRO: x2.0 ~2.5s; lo raciona la barra del embed
    if (!p || p.rank !== null || this.f < this.pIn.superUntil) return false;
    this.pIn.superUntil = this.f + Math.round(P_SUPER_DUR * this.pmul.bst); return true; }
  //+AG multiplicador de empuje vigente (Nitro/Súper; si coinciden manda el mayor) y tirón lateral de carril.
  //   Solo se consultan dentro de ramas isPlayer&&engaged → jamás tocan a la IA ni al modo sin jugador.
  _pBoost(){ let m = 1;
    if (this.f < this.pIn.nitroUntil) m = P_NITRO_MUL;
    if (this.f < this.pIn.superUntil && P_SUPER_MUL > m) m = P_SUPER_MUL;
    return m; }
  //+AG doc 39 #1: AGA → control/tirón lateral de carril del jugador (ganancia y tope escalados). Solo se llama para
  //   balls[0]; pmul.aga=1 fuera de individual-con-stats → expresión idéntica a la fuente.
  _pLaneAx(b){ const g = this.pmul.aga, mx = P_LANE_MAX * g, a = (P_LANE_X[this.pIn.lane] - b.x) * P_LANE_K * g;
    return a < -mx ? -mx : (a > mx ? mx : a); }
  _freshEvents(){ return { kill: [], save: [], cross: [], phase: [], scan: [], target: [], barrier: [], block: [] }; }
  aliveBalls(){ return this.balls.filter(b => b.rank === null); }
  activeNotSafe(){ return this.balls.filter(b => b.rank === null && !b.safe); }
  get winner_color(){ return this.winner_team != null ? this.teams[this.winner_team]?.name : null; }
  // Supervivientes = las que CRUZARON (b.safe), con su identidad, para que el ensamblador se las pase a la
  // prueba siguiente (§3). Ojo semántica de este modo: rank>0 = cruzada a salvo, rank=-1 = muerta, null = corriendo.
  survivors(){ return this.balls.filter(b => b.safe).sort((a, b) => a.rank - b.rank).map(b => ({ num: b.num, team: b.team })); }

  // EMBUDO (docs/52 §2.3): cierra dejando EXACTAMENTE survTarget supervivientes.
  //  · 'funnel'  → el cupo se llenó (cruzó la N-ésima): las que aún corren mueren (las alcanza el muro).
  //  · 'funnel_progress' → llegó GAME_F sin llenar el cupo: ASCIENDEN las más adelantadas (mayor y) hasta
  //    completar N (nunca deja de menos); el resto muere. Determinista (desempate por dorsal).
  _finishByFunnel(ev, by){
    let racers = this.balls.filter(b => b.rank === null && !b.safe);
    const short = this.survTarget - this.placed;
    if (short > 0 && racers.length){
      racers.sort((p, q) => q.y - p.y || p.num - q.num);   // más cerca de meta = más progreso
      for (const b of racers.slice(0, short)){
        b.safe = true; b.rank = ++this.placed; this.crossed[b.team]++; this.lastCrossPlaced[b.team] = this.placed;
        ev.cross.push({ id: b.id, team: b.team, rank: this.placed, f: this.f });
      }
      racers = this.balls.filter(b => b.rank === null && !b.safe);
    }
    // OPCIÓN A (Jaime 2026-07-18): las rezagadas que NO cruzaron a tiempo NO mueren de golpe sin causa (el 'muro'
    // era invisible → se leía "se acabó la ronda y murieron" sin motivo). Las FUSILA el francotirador ESCALONADAS
    // (una cada pocos frames, causa 'semaforo' = la ejecución estrella del modo) → cada muerte con causa visible.
    // Se ordenan de más atrás a más cerca de meta: la ÚLTIMA fusilada es la que CASI cruza (más dramático). NO
    // cambia QUIÉN sobrevive (las mismas 16 a salvo), solo CÓMO mueren las eliminadas. El escalonado real lo hace
    // el bucle de decisión (drena `_loserQ` cada STAG frames). Standalone no pasa por aquí.
    racers.sort((p, q) => p.y - q.y || p.num - q.num);   // más atrás primero → la que casi cruza, la última
    this._loserQ = racers.slice();
    this._execCause = 'semaforo';
    this.decision_frame = this.f; this.resolved_by = by;
  }
  teamsWithBalls(){ let n = 0; for (let t = 0; t < this.nTeams; t++) if (this.byTeam[t].some(b => b.rank === null)) n++; return n; }

  // ¿matar a 'b' dejaría <=1 equipo con bolas en juego, y aún es MUY pronto (antes de SAFE_F)? (anti-decidir-pronto,
  // docs/44 §10.6). Umbral FIJO corto (no % de GAME_F): en el modo corto, 0.75*GAME_F caía más allá de la partida
  // → la protección quedaba activa siempre → la última bola era inmortal (la mina no la mataba) y no se acababa.
  _wouldEndEarly(b){
    if (this.f >= SAFE_F) return false;
    const teammatesLeft = this.byTeam[b.team].filter(x => x.rank === null && x !== b).length;
    if (teammatesLeft > 0) return false;
    return this.teamsWithBalls() <= 2;
  }
  // EMBUDO — SUELO PROGRESIVO (Jaime 2026-07-18, "opción 2"): el suelo de supervivientes NO es fijo en survTarget
  // desde el principio (eso mataba las 8 muy pronto → 40s de cola muerta con hazards neutralizados y cierre por
  // 'funnel_progress' = teletransporte). En su lugar BAJA con el progreso de la carrera (líder hacia la meta): de
  // censo→survTarget. Así las muertes se REPARTEN a lo largo del recorrido y el suelo se toca CERCA del final,
  // justo cuando las líderes cruzan → cierra por 'funnel' (cruces reales), sin cola ni teletransporte, y los
  // hazards (minas/boulders) matan durante TODO el clip. Standalone (survTarget=null) no pasa por aquí.
  _funnelFloorNow(){
    // progreso REAL de la carrera = fracción del cupo que YA ha cruzado la meta. Los cruces se aceleran hacia el
    // final → atar el suelo a esto reparte las muertes por todo el recorrido y hace que las ÚLTIMAS caigan cerca de
    // la meta (donde está el PAR de boulders), no todas pronto en las minas. Mezclo un piso por progreso del líder
    // para que las minas del centro no sean 100% inertes antes del 1er cruce (arranque entretenido).
    let leadY = SPAWN_Y;
    for (const b of this.balls){ if (b.rank === null && !b.safe && b.y > leadY) leadY = b.y; }
    const byLead = clampn((leadY - SPAWN_Y) / (GATE_Y - SPAWN_Y), 0, 1) * 0.5;   // el líder solo desbloquea HASTA la mitad
    const byCross = clampn(this.placed / this.survTarget, 0, 1);                  // el resto lo desbloquean los CRUCES
    const progress = Math.max(byLead, byCross);
    return Math.round(this.survTarget + (this.balls.length - this.survTarget) * (1 - progress));
  }
  _kill(b, x, y, cause, extra){
    //+AG tutorial: FRANCOTIRADOR DESARMADO (y ningún hazard mata). La mirilla/luz siguen (se aprende la regla),
    //   la ejecución no. Fuera del tutorial esta rama no existe.
    if (this.tutorial) return false;
    // EMBUDO: si esta muerte dejaría menos vivas (corriendo + a salvo) que el SUELO PROGRESIVO de ahora mismo,
    // "falla por poco" y sale como SAVE con estrella de invencibilidad (ver _funnelFloorNow arriba).
    if (this.survTarget !== null && this.balls.filter(x2 => x2.rank !== -1).length <= this._funnelFloorNow()){
      // ESTRELLA DE INVENCIBILIDAD (Jaime 2026-07-18): la bola no muere porque el hazard falle, sino porque tiene
      // el booster de invencibilidad activo (tipo Mario). Marca la ventana `starF` para que el render pinte el
      // efecto (el megaball la aplasta, destello, sobrevive). No cambia QUIÉN sobrevive (el embudo ya lo decidió),
      // solo lo ETIQUETA para que el espectador lo entienda. STAR_HOLD=20f (~0.67s de destello tras el golpe).
      b.starF = this.f + 20;
      this.events.save.push({ id: b.id, x, y, f: this.f, cause, star: true }); return false;
    }
    if (this._wouldEndEarly(b)){ this.events.save.push({ id: b.id, x, y, f: this.f, cause }); return false; }
    b.rank = -1; b.killed_f = this.f;
    this.events.kill.push({ id: b.id, x, y, cause, f: this.f, ...extra });
    return true;
  }

  boulderX(i){ return this._boulderXAt(i, this.f); }
  _boulderXAt(i, f){ const b = this.boulders[i]; return XL + BOULDER_R + BOULDER_PLAY * tri(f + b.phaseFrac * this.boulderPeriod, this.boulderPeriod); }

  step(){
    if (this.done) return null;
    const f = ++this.f; const ev = this.events = this._freshEvents();

    // ---- si ya se decidió el punto: explotar perdedoras ESCALONADAS + asentar a las a salvo + esperar (congelado) ----
    if (this.decision_frame !== null){
      // una perdedora cae ESCALONADA (cadena, no todas de golpe). En el EMBUDO son fusilamientos del francotirador
      // (causa 'semaforo', opción A) y van más espaciados (STAG=7f ≈ 0.23s) para que se lea cada disparo; en el modo
      // por equipos son explosiones normales (causa 'eliminated', cada 4f). `_execCause` lo fija el cierre.
      const STAG = this.survTarget !== null ? 7 : 4;
      if (this._loserQ && this._loserQ.length && (f - this.decision_frame) % STAG === 0){
        const b = this._loserQ.shift();
        if (b && b.rank === null){ b.rank = -1; b.killed_f = f; b.killed_y = b.y; ev.kill.push({ id: b.id, x: b.x, y: b.y, cause: this._execCause || 'eliminated', f }); }
      }
      for (const b of this.balls){ if (b.safe){
        if (b.y < GATE_Y) b.y = GATE_Y; if (b.y > SAFE_Y + 2) b.y = SAFE_Y + 2;
        b.vx *= 0.86; b.vy *= 0.86; b.x += b.vx / FPS; b.y += b.vy / FPS;
        if (b.x < XL + BALL_R) b.x = XL + BALL_R; if (b.x > XR - BALL_R) b.x = XR - BALL_R; } }
      if ((!this._loserQ || this._loserQ.length === 0) && f - this.decision_frame >= WIN_HOLD) this.done = true;
      return ev;
    }

    // ---- SEMÁFORO: avanzar la máquina de estados por frame entero ----
    while (f >= this.phaseEnd){
      this.phaseIdx++; this.phaseStart = this.phaseEnd; this.phaseEnd += this.phases[this.phaseIdx].dur;
      const prevColor = this.color; this.color = this.phases[this.phaseIdx].color;
      if (this.color === 'red') this.redStartF = f;
      else for (const b of this.balls) b.brakeLead = Math.round(this.rng.uniform(ANTICIP_MIN, ANTICIP_MAX));
      ev.phase.push({ f, color: this.color, from: prevColor });
    }
    const framesToPhaseEnd = this.phaseEnd - f;
    const warnAmber = this.color === 'green' && framesToPhaseEnd <= WARN_F;

    // ---- STEERING (1 vez por frame): solo en VERDE; en ROJO el motor está apagado ----
    const ab = this.activeNotSafe();
    const green = this.color === 'green';
    //+AG FANTASMA activo este frame (false siempre sin engaged → todas las ramas que lo miran quedan como antes)
    const pGhost = this.pIn.engaged && f < this.pIn.ghostUntil;
    // rubber-band: equipo más atrasado (menor Y media entre sus bolas activas) -> +8% vmax, solo en verde
    let lagTeam = -1, lagY = 1e9;
    for (let t = 0; t < this.nTeams; t++){ const al = this.byTeam[t].filter(x => x.rank === null && !x.safe); if (!al.length) continue;
      let my = 0; for (const x of al) my += x.y; my /= al.length; if (my < lagY){ lagY = my; lagTeam = t; } }

    for (const b of ab){
      if (!green){ b.ax = 0; b.ay = 0; b.braking = false;
        //+AG MOTOR DEL JUGADOR EN ROJO: el motor global está apagado (la IA no empuja en rojo), pero si el jugador
        //   MANTIENE CORRER en rojo su bola SÍ empuja hacia meta (+Y). Se moverá, el francotirador la marcará y,
        //   pasado el margen de gracia, la EJECUTA — la MISMA regla de muerte que la IA. Decisión de diseño (Jaime):
        //   pulsar en rojo empuja y puede matarte; ese riesgo real es la gracia del modo, no un botón inerte. El
        //   empuje se aplica en la rama de rojo de la integración usando este b.ay.
        //+AG con NITRO/SÚPER el empuje en rojo es aún mayor → te delatas antes y el tiro llega igual (la regla
        //   de muerte NO se ablanda); el carril sigue tirando lateral mientras corres (mismo contrato que verde).
        if (b.isPlayer && this.pIn.engaged && this.pIn.running){ const m = this._pBoost();
          //+AG doc 39 #1: ACE → empuje del motor del jugador; VEL → su tope. NO ablanda la regla: seguir en rojo te
          //   delata y te fusila igual (solo mueve la física del empuje/tope, no la muerte). pmul=1 fuera de con-stats.
          b.ay = GOAL * m * this.pmul.ace; b.ax = this._pLaneAx(b); b.vmax = TUNE.V_CLAMP * m * this.pmul.vel; }
        continue;
      }
      // frenado anticipatorio general (docs/44 §6.2): cada bola decide, al entrar en esta fase VERDE, a
      // cuántos frames del aviso ámbar empieza a soltar el acelerador (b.brakeLead, sorteado al entrar en
      // verde). Con menos margen (temeraria) llega más rápido al corte y se juega más el patinaje; con más
      // margen (veterana) ya ha perdido bastante velocidad cuando el semáforo cambia. Mientras frena, NO
      // recibe empuje de meta (§3.2: "el motor se apaga"); en su lugar decelera con FRIC_RED igual que en
      // rojo, así el frenado real empieza ANTES del corte y no depende solo de la ventana de gracia.
      b.braking = framesToPhaseEnd <= b.brakeLead;
      // "zona de no pararse" del boulder (§6.2 aplicado a la franja letal del boulder): si el rojo se acerca y
      // pararía DENTRO de la franja, o bien COMPROMETE el cruce (ya está dentro → sprint para salir por +Y) o
      // frena ANTES de entrar (aún al sur → para en seguro). Así el boulder mata OCASIONALMENTE (mala decisión),
      // no como matadero de todo el que cruza.
      let goalBoost = 1;
      if (framesToPhaseEnd <= PLAN_HORIZON_F){
        const speed = hyp(b.vx, b.vy), skid = (speed * speed) / (2 * TUNE.FRIC_RED), stopY = b.y + skid;
        // por CADA franja de boulder por delante: si pararía dentro, o cruza ya (si está al borde) o frena antes
        for (const bo of this.boulders){ const bmin = bo.y - BOULDER_BAND, bmax = bo.y + BOULDER_BAND;
          if (b.y < bmax && stopY > bmin){
            if (b.y >= bmin - 0.6){ b.braking = false; goalBoost = 1.5; }   // ya dentro/al borde: cruzar ya
            else b.braking = true;                                          // al sur: frenar para parar antes
            break;
          }
        }
      }
      let ax = 0, ay = 0;
      // 1) atracción a meta (+Y) — se omite mientras frena (ver arriba)
      //+AG tutorial: los BOTS no tiran a meta (figurantes cerca de la salida: nadie te gana la carrera mientras
      //   aprendes); el resto de su steering (wander, separación) sigue → mismo consumo de RNG por frame.
      if (!b.braking && !(this.tutorial && !b.isPlayer)) ay += GOAL * goalBoost;
      // 2) muros laterales
      if (XR - b.x < WALL_NEAR) ax -= WALLAV;
      if (b.x - XL < WALL_NEAR) ax += WALLAV;
      // 3) evitación de MINAS (apartarse) + de BLOQUEADORES (dirigirse al hueco)
      const AV = TUNE.AVOID_TRAP;
      for (const p of this.pads){ const dx = b.x - p.x, dy = b.y - p.y, d = hyp(dx, dy);
        if (d < AVOID_R && d > 1e-3){ ax += (dx / d) * AV * (1 - d / AVOID_R); ay += (dy / d) * AV * 0.4 * (1 - d / AVOID_R); } }
      // BLOQUEADOR por delante (dentro de ~5u; rango corto para NO estorbar el esquive del boulder que esté antes):
      // si la bola no está alineada con el hueco, empújala hacia él (zigzag)
      const BLK_RANGE = 5;
      for (const bl of this.blockers){ const dyB = bl.y - b.y;
        if (dyB > -1.5 && dyB < BLK_RANGE){ const [o0, o1] = blockerOpen(bl);
          if (b.x < o0) ax += AV * 1.3 * (1 - dyB / BLK_RANGE);          // hueco a la derecha → ir a +X
          else if (b.x > o1) ax -= AV * 1.3 * (1 - dyB / BLK_RANGE);     // hueco a la izquierda → ir a -X
        } }
      // el boulder es RÁPIDO (~V_CLAMP): lookahead más amplio + reacciona a su posición FUTURA (unos frames por
      // delante), no solo la actual, para dar tiempo real a esquivarlo (docs/44 §7.3: "se esquiva con steering
      // normal... no es su función central" -> debe ser un esquive fácil en verde).
      // escape en X (apartarse lateralmente) + escape en Y (salir de la FRANJA del boulder): sin el término Y,
      // una bola pegada a un muro lateral queda en PINZA (empujar contra la pared no sirve) y muere en verde.
      // El escape en Y crece cuanto más cerca del muro está en X (menos margen lateral disponible).
      const BAR = TUNE.BOULDER_AVOID_R;
      const wallProx = Math.max(0, 1 - (Math.min(b.x - XL, XR - b.x)) / 4.0);   // 0 en el centro, 1 pegada al muro
      for (let i = 0; i < this.boulders.length; i++){ const bo = this.boulders[i], bx = this.boulderX(i), bxLead = this._boulderXAt(i, f + BOULDER_LEAD_F);
        const dx = b.x - bx, dy = b.y - bo.y, d = hyp(dx, dy);
        const dxL = b.x - bxLead, dL = hyp(dxL, dy);
        const ySign = dy >= 0 ? 1 : -1;   // sale de la franja hacia donde ya está (adelante si ya cruzó el eje del boulder)
        if (d < BAR && d > 1e-3){ const w = 1 - d / BAR; ax += (dx / d) * AV * 1.6 * w; ay += ySign * AV * (0.5 + 1.5 * wallProx) * w; }
        if (dL < BAR && dL > 1e-3){ const w = 1 - dL / BAR; ax += (dxL / dL) * AV * 1.2 * w; } }
      // 4) separación anti-blob
      for (const o of ab){ if (o === b) continue; const dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy;
        if (d2 < SEP_R * SEP_R && d2 > 1e-6){ const d = Math.sqrt(d2); ax += (dx / d) * SEP * (1 - d / SEP_R); ay += (dy / d) * SEP * (1 - d / SEP_R); } }
      // 5) wander determinista
      ax += this.rng.uniform(-1, 1) * WANDER; ay += this.rng.uniform(-1, 1) * WANDER;
      // 6) anti-atasco: si lleva STUCK_F sin avanzar en verde, nudge lateral+adelante determinista
      if (b.y - b.stuckMarkY < 0.15){ b.stuckF++; if (b.stuckF >= STUCK_F){ ax += (b.id % 2 === 0 ? 1 : -1) * GOAL * 0.6; ay += GOAL * 0.4; b.stuckF = 0; b.stuckMarkY = b.y; } }
      else { b.stuckF = 0; b.stuckMarkY = b.y; }
      b.ax = ax; b.ay = ay;
      // el frenado anticipatorio ya reduce el impulso (goalMul); el tope de velocidad no cambia, solo el empuje
      b.vmax = (b.team === lagTeam ? TUNE.V_CLAMP * RUBBER : TUNE.V_CLAMP);
      //+AG AGENCIA EN VERDE (se aplica DESPUÉS del steering normal → el RNG del wander/anti-atasco ya se consumió
      //   igual: identidad intacta). El jugador decide CUÁNDO corre, no cuánto: manteniendo CORRER, motor ON con la
      //   MISMA fuerza GOAL / vmax que la IA (incluida su evitación lateral); al soltar, motor OFF y patina por
      //   fricción (b.braking = true, exactamente como el frenado anticipatorio de la IA). Nunca recibe el rebufo.
      if (b.isPlayer && this.pIn.engaged){
        if (this.pIn.running){ if (b.braking){ b.ay += GOAL; b.braking = false; }   // insiste en avanzar: ignora el frenado anticipatorio de la IA
          const m = this._pBoost();                    //+AG NITRO/SÚPER: sobreempuje SOLO mientras corres
          if (m > 1) b.ay += GOAL * (m - 1);
          b.ay += GOAL * (this.pmul.ace - 1);          //+AG doc 39 #1: ACE → empuje EXTRA del motor (0 sin stats)
          b.ax += this._pLaneAx(b);                    //+AG CARRIL: tirón lateral suave hacia el pasillo elegido (solo corriendo)
          b.vmax = TUNE.V_CLAMP * m * this.pmul.vel;   //+AG doc 39 #1: VEL → tope de velocidad del jugador
        }
        else { if (!b.braking) b.ay -= GOAL; b.braking = true; b.vmax = TUNE.V_CLAMP; }   // suelta el acelerador: se deja frenar por fricción (sin fuerza lateral: patina libre)
      }
    }

    // ---- INTEGRACIÓN por substeps ----
    for (let s = 0; s < SUBSTEPS; s++){
      for (const b of ab){
        const pB = b.isPlayer && this.pIn.engaged;               //+AG jugador con agencia activa
        const pBraking = pB && f < this.pIn.brakeUntil;          //+AG FRENAZO activo: corta el motor y clava en seco
        if (pBraking){
          //+AG FRENAZO: deceleración FUERTE (P_BRAKE_FRIC), sin ningún empuje. Vale en verde Y en rojo (en rojo te
          //   ayuda a pararte antes de que el francotirador dispare). Misma familia de op que la fricción de la IA.
          const sp = hyp(b.vx, b.vy);
          if (sp > 1e-6){ const dec = P_BRAKE_FRIC * DT, nsp = sp - dec > 0 ? sp - dec : 0; b.vx *= nsp / sp; b.vy *= nsp / sp; }
        } else if (green && !b.braking){
          b.vx += b.ax * DT; b.vy += b.ay * DT;
          b.vx *= (1 - DAMP * DT * 8); b.vy *= (1 - DAMP * DT * 8);
          clampv(b, b.vmax);
        } else {
          // ROJO, o VERDE-pero-frenando-anticipadamente: motor apagado, fricción realista (patinaje)
          // opuesta a la velocidad actual, más las fuerzas laterales (evitar trampa/muro/separación/wander)
          // que sí se siguen aplicando mientras se frena (la bola puede desviarse mientras decelera).
          //+AG MOTOR DEL JUGADOR EN ROJO: si mantiene CORRER, su motor VENCE al patinaje — integración como en
          //   verde (empuje + damp + clamp, SIN la fricción de patinaje), para que el botón responda igual de
          //   vivo que en verde (feedback del dueño 2026-07-22: "no me deja correr en rojo" — el empuje neto de
          //   antes, GOAL−FRIC_RED, dejaba la bola reptando). El castigo no es un botón sordo: es el
          //   francotirador (regla normal si venías en movimiento; SALIDA FALSA fulminante si ya estabas parado).
          if (!green && pB && this.pIn.running){
            b.vx += b.ax * DT; b.vy += b.ay * DT;
            b.vx *= (1 - DAMP * DT * 8); b.vy *= (1 - DAMP * DT * 8);
            clampv(b, b.vmax);
          } else {
          const sp = hyp(b.vx, b.vy);
          //+AG doc 39 #1: RES → agarre/aguante del jugador = frena mejor, patina menos (más fricción de deslizamiento).
          //   NO es inmunidad: si sigue en movimiento pasado el margen, el francotirador dispara igual. pmul.res=1 fuera.
          const _fr = b.isPlayer ? TUNE.FRIC_RED * this.pmul.res : TUNE.FRIC_RED;
          if (sp > 1e-6){ const dec = _fr * DT, nsp = sp - dec > 0 ? sp - dec : 0;
            b.vx *= nsp / sp; b.vy *= nsp / sp; }
          if (green){ b.vx += b.ax * DT; b.vy += b.ay * DT; clampv(b, b.vmax); }
          }
        }
        b.x += b.vx * DT; b.y += b.vy * DT;
        // muros laterales (rebote simple, no eliminan; R5 nunca expulsa)
        if (b.x < XL + BALL_R){ b.x = XL + BALL_R; if (b.vx < 0) b.vx = -b.vx * 0.4; }
        if (b.x > XR - BALL_R){ b.x = XR - BALL_R; if (b.vx > 0) b.vx = -b.vx * 0.4; }
        if (b.y < SPAWN_Y - 1.0) b.y = SPAWN_Y - 1.0;
        //+AG FANTASMA: el jugador ATRAVIESA bloqueadores y barrera mientras dura (se salta los dos clamps
        //   sólidos de abajo). Sin engaged pGhost es false → rama idéntica a la fuente para todas las bolas.
        const bGhost = b.isPlayer && pGhost;
        // BLOQUEADORES de media pista (sólidos): bloquean el avance si la bola está en la mitad tapada
        if (!bGhost) for (const bl of this.blockers){ const [o0, o1] = blockerOpen(bl);
          if (Math.abs(b.y - bl.y) < BLOCK_THICK / 2 + BALL_R && (b.x < o0 || b.x > o1)){
            if (b.vy > 0 && b.y < bl.y){ b.y = bl.y - BLOCK_THICK / 2 - BALL_R; b.vy = 0; }        // llegando desde el sur
            else if (b.vy < 0 && b.y > bl.y){ b.y = bl.y + BLOCK_THICK / 2 + BALL_R; b.vy = 0; } } }
        // BARRERA rompible (sólida hasta romperse): bloquea el avance; el daño se aplica 1×/frame abajo
        if (!bGhost) for (const bar of this.barriers){ if (bar.broken) continue;
          if (Math.abs(b.y - bar.y) < BARRIER_THICK / 2 + BALL_R && Math.abs(b.x - bar.xc) < BARRIER_HALFW){
            if (b.y < bar.y){ b.y = bar.y - BARRIER_THICK / 2 - BALL_R; if (b.vy > 0) b.vy = 0; }
            else { b.y = bar.y + BARRIER_THICK / 2 + BALL_R; if (b.vy < 0) b.vy = 0; } } }
      }
      for (let i = 0; i < ab.length; i++) for (let j = i + 1; j < ab.length; j++) resolve(ab[i], ab[j], BALL_R, BALL_R, 0.2);
    }

    // ---- BARRERA: daño por embestida (1×/frame): cada bola en contacto Y EN VERDE le resta vida; al llegar a 0
    //      estalla y se abre para todas (bunchea al pelotón = igualador). No mata. ----
    for (const bar of this.barriers){ if (bar.broken) continue;
      let bashers = 0;
      for (const b of ab){ if (b.rank !== null) continue;
        if (b.isPlayer && pGhost) continue;   //+AG intangible: la atraviesa, no la embiste (no le hace daño)
        if (Math.abs(b.y - bar.y) < BARRIER_THICK / 2 + BALL_R + 0.15 && Math.abs(b.x - bar.xc) < BARRIER_HALFW && b.y < bar.y + 0.5) bashers++; }
      if (green && bashers > 0){ bar.hp -= BASH_DMG * bashers;
        if (bar.hp > 0) this.events.barrier.push({ y: bar.y, xc: bar.xc, hp: bar.hp, hp0: bar.hp0, bashers, f });
        else { bar.broken = true; this.events.barrier.push({ y: bar.y, xc: bar.xc, broken: true, f }); } }
    }

    // ---- gracia inicial de spawn ----
    if (f > START_DELAY){
      //+AG SALIDA FALSA (ver constantes P_FS_*): SOLO el jugador y SOLO con CORRER pulsado. Corre durante TODO
      //   el rojo (incluida la ventana STOP_GRACE, que el tramposo aprovechaba para robar salida gratis). El
      //   apuntado usa el mismo camino que el francotirador normal (targeted/targetedF + evento 'target' → misma
      //   mirilla en el render, misma causa 'semaforo', y frenar ya NO te libra: el tiro va). Durante la ventana
      //   de gracia el bucle normal de abajo aún no corre → la cuenta atrás del disparo se lleva aquí.
      if (this.color === 'red'){
        const p0 = this.balls[0];
        if (p0 && p0.isPlayer && this.pIn.engaged && p0.rank === null && !p0.safe){
          const sp0 = hyp(p0.vx, p0.vy);
          if (!this.pIn.redStopped && sp0 < this.vThresh * P_FS_SETTLE) this.pIn.redStopped = true;
          if (this.pIn.redStopped && this.pIn.running && !p0.targeted && sp0 > this.vThresh * P_FS_V){
            p0.targeted = true; p0.targetedF = P_FS_LOCK_F; p0.detectF = 0;
            ev.target.push({ id: p0.id, x: p0.x, y: p0.y, f }); }
          const graceOn = this.redStartF === null || f - this.redStartF <= TUNE.STOP_GRACE;
          if (graceOn && p0.targeted){ p0.targetedF--;
            if (p0.targetedF <= 0){ this._kill(p0, p0.x, p0.y, 'semaforo'); p0.targeted = false; } }
        }
      } else this.pIn.redStopped = false;   //+AG vuelve el verde → el próximo rojo empieza de cero
      // ---- DETECCIÓN DE MOVIMIENTO EN ROJO + FRANCOTIRADOR (docs/44 §3.2, mejora del dueño 2026-07-07):
      //   moverte en rojo NO te mata al instante; el semáforo te MARCA (mirilla que apunta ~SNIPER_LOCK_F) y
      //   luego DISPARA. Si paras a tiempo durante el apuntado, te libras (near-miss). Da tiempo + espectáculo. ----
      if (this.color === 'red' && this.redStartF !== null && f - this.redStartF > TUNE.STOP_GRACE){
        for (const b of ab){
          if (b.rank !== null) continue;
          const sp = hyp(b.vx, b.vy);
          if (b.targeted){                                            // ya apuntada por la mirilla → disparo COMPROMETIDO
            b.targetedF--;                                            // (te pilló moviéndote; frenar ya no te libra, el tiro va)
            if (b.targetedF <= 0){ this._kill(b, b.x, b.y, 'semaforo'); b.targeted = false; }   // ¡DISPARO!
          } else if (sp > this.vThresh){
            b.detectF = (b.detectF || 0) + 1;
            if (b.detectF === 1) ev.scan.push({ id: b.id, x: b.x, y: b.y, f });   // primer aviso (retícula)
            if (b.detectF >= DETECT_CONFIRM_F){ b.targeted = true; b.targetedF = SNIPER_LOCK_F; b.detectF = 0; ev.target.push({ id: b.id, x: b.x, y: b.y, f }); }
          } else if (b.detectF){ ev.save.push({ id: b.id, x: b.x, y: b.y, f, cause: 'semaforo' }); b.detectF = 0; }
        }
      } else { for (const b of ab){ b.detectF = 0; if (b.targeted){ b.targeted = false; } } }   // vuelve el verde → suelta las mirillas

      // ---- TRAMPA A: LOSAS ----
      //+AG FANTASMA: el jugador NO cuenta como ocupante → ni arma la losa parándose encima ni le estalla la
      //   que otro armó; al expirar vuelve a contar (y si sigue parado encima, la arma y muere como todos).
      for (const pad of this.pads){
        const occ = ab.filter(b => b.rank === null && !(b.isPlayer && pGhost) && hyp(b.x - pad.x, b.y - pad.y) < PAD_R + BALL_R);
        if (!pad.armed){
          if (occ.some(b => hyp(b.vx, b.vy) < this.vThresh)){ pad.armed = true; pad.armF = 0; }
        } else {
          if (occ.length === 0){
            // la bola se apartó de la losa armada antes de que saltara: near-miss legible (§13.2 #4). Solo cuenta
            // si el armado ya había telegrafiado (armF>=3), no un arme/desarme instantáneo por ruido de jitter.
            if (pad.armF >= 3) this.events.save.push({ x: pad.x, y: pad.y, f: this.f, cause: 'losa' });
            pad.armed = false; pad.armF = 0;
          }
          else { pad.armF++; if (pad.armF >= ARM_F){ for (const b of occ) this._kill(b, b.x, b.y, 'losa', { zone: pad.zone }); pad.armed = false; pad.armF = 0; } }
        }
      }

      // ---- BOULDER (contacto ciego, siempre activo) ----
      for (let i = 0; i < this.boulders.length; i++){ const bo = this.boulders[i], bx = this.boulderX(i);
        for (const b of ab){ if (b.rank === null && hyp(b.x - bx, b.y - bo.y) < BOULDER_R + BALL_R) this._kill(b, b.x, b.y, 'boulder'); } }
    }

    // ---- cruce de META ----
    for (const b of this.balls){ if (b.rank === null && !b.safe && b.y >= GATE_Y){
      b.safe = true; b.rank = ++this.placed; this.crossed[b.team]++; this.lastCrossPlaced[b.team] = this.placed;
      ev.cross.push({ id: b.id, team: b.team, rank: this.placed, f });
      // SHORT individual: CARRERA PURA — la PRIMERA bola en cruzar GANA (resolved_by 'points', estilo tobogan).
      // Su color sale como winner_team (equipo de 1) → coronación/celebración intactas. Las demás vivas explotan
      // escalonadas (cause 'eliminated') en la rama de decisión, igual que las perdedoras del torneo.
      if (this.individual){ if (this.decision_frame === null) this._decide(b.team, 'points'); }
      // EMBUDO: al cruzar la N-ésima, el cupo está lleno → cierra y el muro se lleva a las que aún corren.
      else if (this.survTarget !== null){ if (this.placed >= this.survTarget && this.decision_frame === null) this._finishByFunnel(ev, 'funnel'); }
      else if (this.crossed[b.team] === BALLS_PER_TEAM && this.decision_frame === null) this._decide(b.team, 'complete');
    } }
    // bolas a salvo se quedan en el corral de meta
    for (const b of this.balls){ if (b.safe){ if (b.y < GATE_Y) b.y = GATE_Y; if (b.y > SAFE_Y + 2) b.y = SAFE_Y + 2;
      b.vx *= 0.86; b.vy *= 0.86; b.x += b.vx / FPS; b.y += b.vy / FPS;
      if (b.x < XL + BALL_R) b.x = XL + BALL_R; if (b.x > XR - BALL_R) b.x = XR - BALL_R; } }

    // R5: fuera del campo
    for (const b of this.balls) if (b.x < XL - 0.6 || b.x > XR + 0.6) this.oob = true;

    // ESTRELLA DE INVENCIBILIDAD — señal de ESTADO por frame (spec brand-designer 2026-07-18): una bola corriendo
    // es invencible AHORA MISMO si el embudo ya está en el suelo (no puede bajar de survTarget) → el render pinta el
    // aura ANTES de que el megaball llegue (no retroactivo). Sin survTarget (standalone) siempre false → no cambia.
    if (this.survTarget !== null){
      const aliveOrSafe = this.balls.filter(x => x.rank !== -1).length;
      const floor = aliveOrSafe <= this.survTarget;
      for (const b of this.balls) b.invuln = floor && b.rank === null;
    }

    // ---- FIN CUANDO EL RESULTADO YA ESTÁ DECIDIDO (no esperar al tope si nada puede cambiar) ----
    if (this.decision_frame === null && this.survTarget === null) this._checkDecided();   // "ya decidido" es por equipos: no aplica al embudo
    // fin por tiempo (fallback)
    if (this.decision_frame === null && f >= this.capF){ if (this.survTarget !== null) this._finishByFunnel(ev, 'funnel_progress'); else this._finishByProgress(this.individual ? 'timeout' : undefined); }
    if (this.decision_frame !== null && f - this.decision_frame >= WIN_HOLD) this.done = true;
    return ev;
  }

  // ¿el ganador ya está fijado? Termina en cuanto ninguna bola viva pueda cambiar el resultado (feedback del
  // dueño 2026-07-07). El líder = más bolas en meta; empate → el que CRUZÓ ANTES gana (menor lastCrossPlaced).
  // Como el líder gana los empates de cuenta, basta con que NADIE pueda SUPERAR su cuenta actual (>=, no >) →
  // p.ej. 3 supervivientes de colores distintos y la roja cruza primero: las otras solo podrían EMPATAR (y
  // perderían el desempate) → ya está decidido, gana la roja. (b) sin bolas vivas → decidir por progreso.
  _checkDecided(){
    const alive = t => this.byTeam[t].filter(b => b.rank === null).length;
    const potential = t => this.crossed[t] + alive(t);
    let lead = 0;
    for (let t = 1; t < this.nTeams; t++){
      if (this.crossed[t] > this.crossed[lead]) lead = t;
      else if (this.crossed[t] === this.crossed[lead] && this.crossed[t] > 0 && this.lastCrossPlaced[t] < this.lastCrossPlaced[lead]) lead = t;
    }
    // Individual (carrera pura) NUNCA llega aquí con un cruce: el 1er cruce cierra en el handler de META ('points').
    // Solo entra por la rama "todas muertas" (nadie cruzó) → gana la más avanzada como SUPERVIVIENTE.
    if (this.crossed[lead] > 0){
      let locked = true;
      for (let o = 0; o < this.nTeams; o++){ if (o === lead) continue; if (potential(o) > this.crossed[lead]){ locked = false; break; } }
      if (locked){ this._decide(lead, this.crossed[lead] >= BALLS_PER_TEAM ? 'complete' : 'locked'); return; }
    }
    if (this.balls.every(b => b.rank !== null)) this._finishByProgress(this.individual ? 'survivor' : undefined);
  }

  _decide(team, by){ this.winner_team = team; this.decision_frame = this.f; this.resolved_by = by;
    // FINISH dramático: las bolas VIVAS de los equipos PERDEDORES explotan, pero ESCALONADAS (una tras otra en
    // la rama congelada, no todas de golpe → menos pico de render y cadena más espectacular). Ganador celebra.
    this._loserQ = this.balls.filter(b => b.rank === null && b.team !== team);
  }

  // decisión por PROGRESO (docs/44 §11.1, caso límite sin ganador nítido en GAME_F):
  // 1) más bolas en meta · 2) mayor suma de Y (muertas cuentan Y de muerte, a salvo cuentan GATE_Y)
  // 3) bola más adelantada con mayor Y · 4) menor dorsal de esa bola
  _finishByProgress(byOverride){
    const sumY = t => this.byTeam[t].reduce((acc, b) => acc + (b.safe ? GATE_Y : (b.rank === -1 ? (b.killed_y ?? b.y) : b.y)), 0);
    const bestY = t => Math.max(...this.byTeam[t].map(b => b.safe ? GATE_Y : b.y));
    const bestBallNum = t => { let by = -1, num = 99; for (const b of this.byTeam[t]){ const y = b.safe ? GATE_Y : b.y; if (y > by || (y === by && b.num < num)){ by = y; num = b.num; } } return num; };
    let bt = 0;
    for (let t = 1; t < this.nTeams; t++){
      if (this.crossed[t] !== this.crossed[bt]){ if (this.crossed[t] > this.crossed[bt]) bt = t; continue; }
      // empate en cuenta con ambos habiendo cruzado → gana el que cruzó ANTES (menor lastCrossPlaced)
      if (this.crossed[t] > 0 && this.lastCrossPlaced[t] !== this.lastCrossPlaced[bt]){ if (this.lastCrossPlaced[t] < this.lastCrossPlaced[bt]) bt = t; continue; }
      const st = sumY(t), sb = sumY(bt);
      if (st !== sb){ if (st > sb) bt = t; continue; }
      const yt = bestY(t), yb = bestY(bt);
      if (yt !== yb){ if (yt > yb) bt = t; continue; }
      if (bestBallNum(t) < bestBallNum(bt)) bt = t;
    }
    // ¿qué criterio separó al ganador del subcampeón? (para DRAMA balance_bonus: solo el desempate por DORSAL
    // —el más feo, §11.1 caso 4— penaliza). Compara el ganador con el mejor de los demás.
    let ru = -1;
    for (let t = 0; t < this.nTeams; t++){ if (t === bt) continue;
      if (ru === -1 || this.crossed[t] > this.crossed[ru] || (this.crossed[t] === this.crossed[ru] && sumY(t) > sumY(ru))) ru = t; }
    this.progress_tiebreak = 'crossed';
    if (ru !== -1){
      if (this.crossed[bt] === this.crossed[ru]){
        if (sumY(bt) === sumY(ru)){ this.progress_tiebreak = (bestY(bt) === bestY(ru)) ? 'dorsal' : 'bestY'; }
        else this.progress_tiebreak = 'sumY';
      }
    }
    this._decide(bt, byOverride || 'progress');
  }

  get scale(){ return FIELD_L; }   // compat
}

function resolve(a, b, ra, rb, e){
  let dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy), mind = ra + rb + 0.06;
  if (d <= 0 || d >= mind) return;
  const nx = dx / d, ny = dy / d, overlap = mind - d;
  const ima = 1 / a.m, imb = 1 / b.m, ims = ima + imb;
  a.x -= nx * overlap * (ima / ims); a.y -= ny * overlap * (ima / ims);
  b.x += nx * overlap * (imb / ims); b.y += ny * overlap * (imb / ims);
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0){ const j = -(1 + e) * vn / ims; a.vx -= j * nx * ima; a.vy -= j * ny * ima; b.vx += j * nx * imb; b.vy += j * ny * imb; }
}
function clampv(o, vmax){ const sp = hyp(o.vx, o.vy); if (sp > vmax){ o.vx = o.vx * vmax / sp; o.vy = o.vy * vmax / sp; } }
