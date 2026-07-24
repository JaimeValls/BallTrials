// YouBall · EL CAZADOR (3er modo): SIM determinista en JS.
// Port 1:1 de generator/cazador.py (docs/20 §16). Corral rectangular con muros, un DEPREDADOR
// que FIJA y persigue presas (caza focal), crece+acelera al comer (rampa), frenesí por umbrales,
// orbes DASH/SWAP, regla de seguridad. Física de círculos a mano (balls + hunter + muros).

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
const N_BALLS = TEAMS.length * BALLS_PER_TEAM;

// --- PERFIL SHORT (formato vertical individual, docs/35): NO afecta al torneo (modo por defecto). ---
// Mismos 8 colores/orden de spawn que Suelo (convención: cada modo autocontenido, sin import cruzado).
export const SHORT_COLORS = [
  { name: 'Azul',     color: [0.18, 0.52, 1.00] },
  { name: 'Verde',    color: [0.22, 0.88, 0.34] },
  { name: 'Naranja',  color: [1.00, 0.55, 0.12] },
  { name: 'Magenta',  color: [1.00, 0.40, 0.70] },
  { name: 'Cian',     color: [0.25, 0.92, 0.92] },
  { name: 'Rojo',     color: [0.95, 0.18, 0.20] },
  { name: 'Violeta',  color: [0.70, 0.27, 1.00] },
  { name: 'Amarillo', color: [1.00, 0.88, 0.22] },
];
export const SHORT_COLORS_6 = [
  { name: 'Rojo',     color: [0.95, 0.18, 0.20] },
  { name: 'Azul',     color: [0.18, 0.52, 1.00] },
  { name: 'Magenta',  color: [1.00, 0.40, 0.70] },
  { name: 'Verde',    color: [0.22, 0.88, 0.34] },
  { name: 'Cian',     color: [0.25, 0.92, 0.92] },
  { name: 'Amarillo', color: [1.00, 0.88, 0.22] },
];
const _S2 = 1 / Math.sqrt(2), _H3 = Math.sqrt(3) / 2;
const DIRS8 = [[1,0],[_S2,_S2],[0,1],[-_S2,_S2],[-1,0],[-_S2,-_S2],[0,-1],[_S2,-_S2]];   // cada 45°, sin trig
const DIRS6 = [[1,0],[0.5,_H3],[-0.5,_H3],[-1,0],[-0.5,-_H3],[0.5,-_H3]];                 // cada 60°, sin trig

// short: duración objetivo ~28-38s (30 FPS). Rampa del cazador ACELERADA respecto al torneo (menos presas,
// hace falta comer 7/8 en un tercio del tiempo); valores INICIALES, se calibran con cast_short.mjs (docs/35).
const SHORT_GAME_F = 1020;         // ~34s objetivo (calibrable)
const SHORT_START_DELAY = 20;      // hook casi inmediato: el cazador ya persigue a ~0.7s
const SHORT_DIGEST = 42;           // menos digestión entre presas (torneo 56) → ritmo más denso
const SHORT_HUNT_R0 = 0.85, SHORT_HUNT_GROW = 0.15, SHORT_HUNT_R_CAP = 2.1;
const SHORT_HUNT_VMAX0 = 5.35, SHORT_HUNT_VMAX_GROW = 0.36, SHORT_HUNT_VMAX_CAP = 8.6;
const SHORT_HUNT_ACC = 10.2;
const SHORT_FRENZY_THR = [4, 2];   // umbrales de frenesí reescalados a 8 bolas (torneo: 6,3 sobre 12)

export const ARENA_W = 19.0, ARENA_H = 12.5;
const XH = ARENA_W / 2, YH = ARENA_H / 2;

const FLEE = 12.5, FLEE_NEAR = 3.2, COH = 0.6, COH_R = 3.0, SEP = 5.5, SEP_R = 1.9;
const WALLAV = 10.0, WALL_NEAR = 2.1, SEEKPU = 4.5, WANDER = 2.0, DAMP = 0.05, V_CLAMP = 5.0, JITTER0 = 2.0;
//+AG capa de AGENCIA del jugador (docs/21, controles por intencion docs/19 3.3): pesos que sesgan el steering
//   de SU bola (balls[0]). Solo suman a ax/ay como cualquier termino de la IA; no fijan posicion/velocidad,
//   no consumen RNG (los bots no se desincronizan). Deterministas.
const P_FLEE = 9.0, P_SEEK = 9.0, P_HERD = 6.0;
const P_DASH_DUR = 16, P_DASH_CD = 90, P_SHIELD_DUR = 40, P_SHIELD_CD = 150, P_SUPER_IMMUNE = 120;

const HUNT_R0 = 0.78, HUNT_GROW = 0.10, HUNT_R_CAP = 1.9;
const HUNT_VMAX0 = 4.0, HUNT_VMAX_GROW = 0.30, HUNT_VMAX_CAP = 8.0;
const HUNT_ACC = 7.0, HUNT_DAMP = 0.045, DIGEST = 56, SCATTER = 5.0, CAP_PAD = 0.06;
const LOSE_D = 9.0, LOSE_T = 45, FRENZY_DUR = 48, FRENZY_MUL = 1.35, ISO_W = 0.55, TEAM_W = 1.6;
// CZ1 FURIA (feedback): hambre = frames sin comer; 3 escalones (calma/irritado/furioso) suben vmax con TOPE.
const FURY_T1 = 90, FURY_T2 = 180, FURY_VMAX_MUL = [1.0, 1.10, 1.22], FURY_CAP = 1.30;
// CZ4 TEAMWORK: cohesión por COLOR (aliados se agrupan) + cobertura del fijado (interponerse).
const TEAM_COH = 1.0, GUARD = 2.2;

const PU_MAX = 3, PU_INTERVAL = 45, PU_R = 0.55, DASH_DUR = 16, DASH_MUL = 1.9, SWAP_IMMUNE = 80;
const PU_KINDS = ['swap', 'dash', 'swap'];

const GAME_F = 2100, START_DELAY = 36, SAFE_P = 0.68, SHOVE_W = 4, NEAR_SAVE = 0.55;
const WIN_HOLD = 90;

// hipotenusa con Math.sqrt (IEEE 754: correctamente redondeada → IDÉNTICA en Node y Chromium).
// Math.hypot/sin/cos NO están garantizadas bit-idénticas entre motores V8 → divergencia casting↔render.
const hyp = (a, b) => Math.sqrt(a * a + b * b);

function wall(o, r){
  if (o.x > XH - r){ o.x = XH - r; if (o.vx > 0) o.vx = -o.vx * 0.45; }
  if (o.x < -XH + r){ o.x = -XH + r; if (o.vx < 0) o.vx = -o.vx * 0.45; }
  if (o.y > YH - r){ o.y = YH - r; if (o.vy > 0) o.vy = -o.vy * 0.45; }
  if (o.y < -YH + r){ o.y = -YH + r; if (o.vy < 0) o.vy = -o.vy * 0.45; }
}
function resolve(a, b, ra, rb, e){
  let dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy), mind = ra + rb;
  if (d <= 0 || d >= mind) return;
  const nx = dx / d, ny = dy / d, overlap = mind - d;
  const ima = 1 / a.m, imb = 1 / b.m, ims = ima + imb;
  a.x -= nx * overlap * (ima / ims); a.y -= ny * overlap * (ima / ims);
  b.x += nx * overlap * (imb / ims); b.y += ny * overlap * (imb / ims);
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn < 0){
    const jimp = -(1 + e) * vn / ims;
    a.vx -= jimp * nx * ima; a.vy -= jimp * ny * ima;
    b.vx += jimp * nx * imb; b.vy += jimp * ny * imb;
  }
}
function clampv(o, vmax){ const sp = hyp(o.vx, o.vy); if (sp > vmax){ o.vx = o.vx * vmax / sp; o.vy = o.vy * vmax / sp; } }

//+AG doc 39 abierto #1 (2026-07-24, VB Jaime): los ATRIBUTOS de la bola equipada modulan la FÍSICA, efecto SUTIL
//   (±STAT_K) y SOLO en perfil INDIVIDUAL sobre balls[0] (el jugador). attr 6.5 → 1.0; attr 13 → +12%; attr 0 → −12%.
//   Sin RNG. Sin opts.stats → todos 1.0 (no-op: individual-sin-stats byte-idéntico). El torneo nunca trae stats.
//   NINGÚN stat da inmunidad ni cambia el radio de captura: te cazan igual; los stats mueven la física, no la regla.
const STAT_K = 0.12;
//+AG multiplicador CAPADO a ±STAT_K (attr 0→0.88, 6.5→1.0, 13→1.12; firma que pase de 13 a nivel alto no rebasa ±12%).
const statMul = a => { const m = 1 + (a - 6.5) / 6.5 * STAT_K; return m < 1 - STAT_K ? 1 - STAT_K : (m > 1 + STAT_K ? 1 + STAT_K : m); };
const NEUTRAL_MUL = { vel:1, ace:1, pes:1, aga:1, res:1, bst:1 };

export class Sim {
  constructor(seed = 1, opts = {}){
    this.seed = seed;
    const rng = new RNG(seed); this.rng = rng;
    this.f = 0; this.done = false;

    // --- PERFIL: torneo (default, 4 equipos×3) o SHORT individual (docs/35). El default queda IDÉNTICO. ---
    this.individual = !!opts.individual;
    //+AG doc 39 #1: modificador de física por atributos, SOLO individual y SOLO balls[0]. No consume RNG (constantes).
    const _S = (this.individual && Array.isArray(opts.stats) && opts.stats.length === 6) ? opts.stats : null;
    this.pmul = _S ? { vel:statMul(_S[0]), ace:statMul(_S[1]), pes:statMul(_S[2]), aga:statMul(_S[3]), res:statMul(_S[4]), bst:statMul(_S[5]) } : NEUTRAL_MUL;
    const n6 = this.individual && opts.n === 6;
    this.teams = this.individual ? (n6 ? SHORT_COLORS_6 : SHORT_COLORS) : TEAMS;
    this.ballsPerTeam = this.individual ? 1 : BALLS_PER_TEAM;
    this.nBalls = this.individual ? this.teams.length : N_BALLS;
    this.spawnDirs = this.individual ? (n6 ? DIRS6 : DIRS8) : null;
    this.gameF = this.individual ? (opts.gameF || SHORT_GAME_F) : GAME_F;
    this.startDelay = this.individual ? SHORT_START_DELAY : START_DELAY;
    this.digest = this.individual ? SHORT_DIGEST : DIGEST;
    this.huntR0 = this.individual ? SHORT_HUNT_R0 : HUNT_R0;
    this.huntGrow = this.individual ? SHORT_HUNT_GROW : HUNT_GROW;
    this.huntRCap = this.individual ? SHORT_HUNT_R_CAP : HUNT_R_CAP;
    this.huntVmax0 = this.individual ? SHORT_HUNT_VMAX0 : HUNT_VMAX0;
    this.huntVmaxGrow = this.individual ? SHORT_HUNT_VMAX_GROW : HUNT_VMAX_GROW;
    this.huntVmaxCap = this.individual ? SHORT_HUNT_VMAX_CAP : HUNT_VMAX_CAP;
    this.huntAcc = this.individual ? SHORT_HUNT_ACC : HUNT_ACC;
    this.frenzyThr = this.individual ? SHORT_FRENZY_THR : [6, 3];
    this.hardCap = this.individual ? Math.round(this.gameF * 1.4) : 3000;
    //+AG CÓMO JUGAR (tutorial): DEPREDADOR DORMIDO (no fija ni captura) y sin reloj de fin — el coach del index
    //   decide cuándo acaba. Flag ausente → todo idéntico a la fuente (no consume RNG).
    this.tutorial = !!opts.tutorial;
    if (this.tutorial){ this.gameF = 1e9; this.hardCap = 1e9; }

    this.balls = [];
    const cq = [[1, 1], [-1, 1], [-1, -1], [1, -1]]; // NE NO SO SE
    const qorder = rng.shuffle([0, 1, 2, 3]);
    for (let i = 0; i < this.nBalls; i++){
      const team = Math.floor(i / this.ballsPerTeam), k = i % this.ballsPerTeam;
      let bx, by;
      if (this.individual){
        const [dx, dy] = this.spawnDirs[i];   // dirección propia (unitaria, sin trig)
        const rx = XH * 0.62, ry = YH * 0.62;   // radio elíptico inscrito en el corral rectangular
        bx = dx * rx + rng.uniform(-0.3, 0.3); by = dy * ry + rng.uniform(-0.3, 0.3);
      } else {
        const [sx, sy] = cq[qorder[team]];
        bx = sx * (XH * 0.55 + rng.uniform(-0.5, 0.5));
        by = sy * (YH * 0.52 + (k - 1) * 0.9 + rng.uniform(-0.4, 0.4));
      }
      let ux, uy, ul; do { ux = rng.uniform(-1, 1); uy = rng.uniform(-1, 1); ul = ux * ux + uy * uy; } while (ul < 0.04 || ul > 1);
      ul = Math.sqrt(ul); // dirección inicial aleatoria SIN trigonometría (determinista entre motores)
      this.balls.push({ id: i, num: i + 1, team, color: this.teams[team].color,
        x: bx, y: by, vx: JITTER0 * ux / ul, vy: JITTER0 * uy / ul, m: 1.0, scale: 1.0,
        rank: null, dash_until: -1, touch_f: -99, touch_by: null, aggro_immune_until: -1,
        isPlayer: i === 0, shield_until: -1, dash_cd: -1, shield_cd: -1,   /*+AG jugador = balls[0] */
        appeal: rng.uniform(-1.0, 1.0) });
    }
    this.byTeam = this.teams.map((_, t) => this.balls.filter(b => b.team === t));
    //+AG doc 39 #1: PES → masa del jugador (ayuda a NO ser desviado por otras bolas ni por el empujón del cazador).
    //   m no lo tocan los power-ups en cazador, así que fijarlo aquí basta. pmul.pes=1 fuera de individual-con-stats.
    if (this.balls[0]) this.balls[0].m = this.pmul.pes;

    this.H = { x: 0, y: 0, vx: 0, vy: 0, m: 8.0, r: this.huntR0, scale: 1.0, vmax: this.huntVmax0,
      kills: 0, digest_until: -1, stun_until: -1, target: null, lost: 0, frenzy_until: -1, hunger: 0, fury: 0 };
    this.lock = -1;

    this.orbs = []; this.orbSeq = 0; this.nextPu = this.startDelay;
    this.placed = 0; this.winner_team = null; this.decision_frame = null; this.resolved_by = null;
    this.safe_until = Math.floor(this.gameF * SAFE_P);
    this.cam = [0, 0]; this.scale_cur = Math.max(ARENA_W, ARENA_H) * 1.05;
    this.frenzied = new Set(); this.near_cd = new Map();

    this.events = { save: [], falling: [], eliminations: [], bump: [], pickup: [], orbs: [], dash: [], swap: [], frenzy: [], invert: [] };
    this.oob = false; this.contacts = 0; this._touch = new Set();
    this.playerIntent = 'escapar';   //+AG intencion del jugador: 'escapar' | 'booster' | 'tumulto'
    this._pev = null;                //+AG eventos de acciones del jugador pendientes de volcar al proximo step()
  }

  //+AG acciones del jugador (capa de boosters docs/04). Emiten EVENTOS DEL MOTOR (dash/save/swap) para que
  //   la reaccion visual y el SFX salgan por los MISMOS canales que el video (react()/sfxmap), sin glue extra.
  _pushEv(k, e){ (this._pev ??= {}); (this._pev[k] ??= []).push(e); }
  //+AG doc 39 #1: BST → duración de los boosters del jugador (dash/escudo/señuelo); el cooldown NO cambia. pmul.bst=1
  //   fuera de individual-con-stats → duraciones idénticas a la fuente.
  playerDash(){ const p = this.balls[0]; if (!p || p.rank !== null || this.f < p.dash_cd) return false;
    p.dash_until = this.f + Math.round(P_DASH_DUR * this.pmul.bst); p.dash_cd = this.f + P_DASH_CD; this._pushEv('dash', { f: this.f, id: 0 }); return true; }
  playerShield(){ const p = this.balls[0]; if (!p || p.rank !== null || this.f < p.shield_cd) return false;
    p.shield_until = this.f + Math.round(P_SHIELD_DUR * this.pmul.bst); p.shield_cd = this.f + P_SHIELD_CD; this._pushEv('save', { f: this.f, id: 0 }); return true; }
  playerDecoy(){ const p = this.balls[0]; if (!p || p.rank !== null) return false;   // SENUELO: el cazador te suelta y fija a otra presa
    const cands = this.aliveBalls().filter(x => x.id !== p.id);
    if (cands.length){ const nt = cands.reduce((a, x) => ((x.x - this.H.x) ** 2 + (x.y - this.H.y) ** 2) < ((a.x - this.H.x) ** 2 + (a.y - this.H.y) ** 2) ? x : a, cands[0]);
      this.H.target = nt.id; this.H.lost = 0; this._pushEv('swap', { f: this.f, id: 0, to: nt.id }); }
    p.aggro_immune_until = this.f + Math.round(P_SUPER_IMMUNE * this.pmul.bst); return true; }

  aliveBalls(){ return this.balls.filter(b => b.rank === null); }
  aliveTeams(){ const s = []; for (let t = 0; t < this.teams.length; t++) if (this.byTeam[t].some(b => b.rank === null)) s.push(t); return s; }
  teamAlive(t){ return this.byTeam[t].filter(b => b.rank === null).length; }
  get winner_color(){ return this.winner_team != null ? this.teams[this.winner_team]?.name : null; }

  wouldEndEarly(prey, f){
    if (f >= this.safe_until) return false;
    if (this.teamAlive(prey.team) > 1) return false;
    return this.aliveTeams().length <= 2;
  }

  pickTarget(f){
    const ab = this.aliveBalls();
    if (!ab.length){ this.H.target = null; return null; }
    const H = this.H;
    let tb = ab.find(b => b.id === H.target) || null;
    if (tb && !this.wouldEndEarly(tb, f)){
      const dd = hyp(tb.x - H.x, tb.y - H.y);
      H.lost = dd > LOSE_D ? H.lost + 1 : 0;
      if (H.lost < LOSE_T) return tb;
    }
    const score = b => {
      const d = hyp(b.x - H.x, b.y - H.y);
      let iso = Infinity;
      for (const o of ab) if (o !== b) iso = Math.min(iso, hyp(b.x - o.x, b.y - o.y));
      if (iso === Infinity) iso = 0;
      return d - ISO_W * iso - TEAM_W * this.teamAlive(b.team) + b.appeal;
    };
    let free = ab.filter(b => !this.wouldEndEarly(b, f) && f >= b.aggro_immune_until);
    const pool = free.length ? free : ab;
    tb = pool.reduce((best, b) => score(b) < score(best) ? b : best, pool[0]);
    H.target = tb.id; H.lost = 0;
    return tb;
  }

  step(){
    if (this.done) return null;
    const rng = this.rng, H = this.H, f = ++this.f;
    const ev = { save: [], falling: [], eliminations: [], bump: [], pickup: [], orbs: [], dash: [], swap: [], frenzy: [], invert: [] };
    //+AG volcar los eventos de acciones del jugador (dash/escudo/senuelo) a los canales del motor (react + sfxmap)
    if (this._pev){ for (const k in this._pev){ for (const e of this._pev[k]){ ev[k].push(e); this.events[k].push(e); } } this._pev = null; }
    if (this.decision_frame === null) H.hunger++; else H.hunger = 0;                 // CZ1: hambre crece mientras caza
    H.fury = H.hunger >= FURY_T2 ? 2 : (H.hunger >= FURY_T1 ? 1 : 0);                 // 0 calma · 1 irritado · 2 furioso

    // objetivo fijado
    let tgt = null; let lock_id = -1;
    const tb = (!this.tutorial && f > this.startDelay && this.decision_frame === null) ? this.pickTarget(f) : null;   //+AG tutorial: nunca fija
    if (tb){ tgt = [tb.x, tb.y]; lock_id = tb.id; }
    this.lock = lock_id;

    // steering cazador
    if (f < H.stun_until){ H.vx *= 0.86; H.vy *= 0.86; }
    else if (f < H.digest_until){ H.vx *= 0.80; H.vy *= 0.80; }
    else if (tgt){
      const dx = tgt[0] - H.x, dy = tgt[1] - H.y, dl = hyp(dx, dy) || 1e-6;
      H.vx = (H.vx + dx / dl * this.huntAcc / FPS) * (1 - HUNT_DAMP);
      H.vy = (H.vy + dy / dl * this.huntAcc / FPS) * (1 - HUNT_DAMP);
    } else { H.vx *= (1 - HUNT_DAMP); H.vy *= (1 - HUNT_DAMP); }
    clampv(H, H.vmax * Math.min(FURY_CAP, (f < H.frenzy_until ? FRENZY_MUL : 1.0) * FURY_VMAX_MUL[H.fury]));   // CZ1: furia+frenesí con TOPE 1.30

    // steering presas
    const ab_mv = this.aliveBalls();
    const teamC = this.teams.map(() => ({ x: 0, y: 0, n: 0 }));   // CZ4: centroides por equipo (cohesión de color)
    for (const b of ab_mv){ const c = teamC[b.team]; c.x += b.x; c.y += b.y; c.n++; }
    for (const c of teamC) if (c.n){ c.x /= c.n; c.y /= c.n; }
    //+AG centroide global de las vivas (intencion "ir al tumulto")
    let gcx = 0, gcy = 0; if (ab_mv.length){ for (const b of ab_mv){ gcx += b.x; gcy += b.y; } gcx /= ab_mv.length; gcy /= ab_mv.length; }
    for (const b of ab_mv){
      let ax = 0, ay = 0;
      let dx = b.x - H.x, dy = b.y - H.y, dl = hyp(dx, dy) || 1e-6;
      const panic = FLEE * (dl > FLEE_NEAR ? 1.0 : 1.0 + (FLEE_NEAR - dl) / FLEE_NEAR);
      ax += dx / dl * panic; ay += dy / dl * panic;
      const near = ab_mv.filter(o => o !== b && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 < COH_R * COH_R);
      if (near.length){
        let cx = 0, cy = 0; for (const o of near){ cx += o.x; cy += o.y; } cx /= near.length; cy /= near.length;
        let cdx = cx - b.x, cdy = cy - b.y, cl = hyp(cdx, cdy) || 1e-6;
        ax += cdx / cl * COH; ay += cdy / cl * COH;
        for (const o of near){ let sdx = b.x - o.x, sdy = b.y - o.y, sl = hyp(sdx, sdy) || 1e-6;
          if (sl < SEP_R){ ax += sdx / sl * SEP * (1 - sl / SEP_R); ay += sdy / sl * SEP * (1 - sl / SEP_R); } }
      }
      if (XH - Math.abs(b.x) < WALL_NEAR) ax += -Math.sign(b.x) * WALLAV;
      if (YH - Math.abs(b.y) < WALL_NEAR) ay += -Math.sign(b.y) * WALLAV;
      if (this.orbs.length){
        let o = this.orbs[0], bd = Infinity;
        for (const oo of this.orbs){ const dd = (oo.x - b.x) ** 2 + (oo.y - b.y) ** 2; if (dd < bd){ bd = dd; o = oo; } }
        let odx = o.x - b.x, ody = o.y - b.y, ol = hyp(odx, ody) || 1e-6;
        ax += odx / ol * SEEKPU; ay += ody / ol * SEEKPU;
      }
      const tc = teamC[b.team];   // CZ4: cohesión de COLOR (los tríos se agrupan, legible desde arriba)
      if (tc.n > 1){ let tdx = tc.x - b.x, tdy = tc.y - b.y, tl = hyp(tdx, tdy) || 1e-6; ax += tdx / tl * TEAM_COH; ay += tdy / tl * TEAM_COH; }
      if (lock_id >= 0){ const gt = this.balls[lock_id];   // cobertura: si fijan a un aliado y no estoy en peligro, me interpongo
        if (gt && gt.rank === null && gt.team === b.team && gt.id !== b.id && dl > FLEE_NEAR){
          const mx = (H.x + gt.x) / 2, my = (H.y + gt.y) / 2; ax += (mx - b.x) * GUARD; ay += (my - b.y) * GUARD; } }
      //+AG AGENCIA: la intencion elegida sesga el steering de la bola del jugador (no fija vx/pos, no usa RNG)
      if (b.isPlayer){
        //+AG doc 39 #1: ACE → fuerza de empuje/intención del jugador (huir/buscar/tumulto empujan más fuerte).
        const _ace = this.pmul.ace;
        if (this.playerIntent === 'escapar'){ ax += dx / dl * P_FLEE * _ace; ay += dy / dl * P_FLEE * _ace; }
        else if (this.playerIntent === 'booster' && this.orbs.length){
          let po = this.orbs[0], pq = Infinity;
          for (const oo of this.orbs){ const q = (oo.x - b.x) ** 2 + (oo.y - b.y) ** 2; if (q < pq){ pq = q; po = oo; } }
          const odx = po.x - b.x, ody = po.y - b.y, ol = hyp(odx, ody) || 1e-6; ax += odx / ol * P_SEEK * _ace; ay += ody / ol * P_SEEK * _ace;
        } else if (this.playerIntent === 'tumulto'){
          const hdx = gcx - b.x, hdy = gcy - b.y, hl = hyp(hdx, hdy) || 1e-6; ax += hdx / hl * P_HERD * _ace; ay += hdy / hl * P_HERD * _ace;
        }
      }
      ax += rng.uniform(-1, 1) * WANDER; ay += rng.uniform(-1, 1) * WANDER;
      //+AG doc 39 #1: AGA → respuesta de dirección del jugador = menos amortiguación (gira/reacciona más vivo); VEL →
      //   su tope de velocidad. pmul.aga/vel = 1 fuera de individual-con-stats → integración idéntica a la fuente.
      const _dmp = b.isPlayer ? DAMP / this.pmul.aga : DAMP, _vc = b.isPlayer ? V_CLAMP * this.pmul.vel : V_CLAMP;
      b.vx = (b.vx + ax / FPS) * (1 - _dmp); b.vy = (b.vy + ay / FPS) * (1 - _dmp);
      clampv(b, _vc * (f < b.dash_until ? DASH_MUL : 1.0));
    }

    // física substeps
    for (let s = 0; s < SUBSTEPS; s++){
      for (const b of ab_mv){ b.x += b.vx * DT; b.y += b.vy * DT; wall(b, BALL_R); }
      H.x += H.vx * DT; H.y += H.vy * DT; wall(H, H.r);
      for (let i = 0; i < ab_mv.length; i++){
        for (let j = i + 1; j < ab_mv.length; j++) resolve(ab_mv[i], ab_mv[j], BALL_R, BALL_R, 0.4);
        resolve(ab_mv[i], H, BALL_R, H.r, 0.3);
      }
    }

    // orbes spawn
    if (this.decision_frame === null && f >= this.nextPu){
      this.nextPu = f + PU_INTERVAL;
      if (this.orbs.length < PU_MAX){
        const ox = rng.uniform(-XH * 0.82, XH * 0.82), oy = rng.uniform(-YH * 0.82, YH * 0.82);
        if (hyp(ox - H.x, oy - H.y) > 2.0){
          this.orbSeq++; let kind = PU_KINDS[this.orbSeq % PU_KINDS.length]; if (this.orbSeq % 6 === 0) kind = 'invert';   // CZ2: orbe INVERT raro (1 de cada 6)
          this.orbs.push({ id: this.orbSeq, x: ox, y: oy, kind, f0: f });
          const rec = { f, id: this.orbSeq, kind, x: ox, y: oy }; this.events.orbs.push(rec); ev.orbs.push(rec);
        }
      }
    }
    // orbes pickup
    for (const o of [...this.orbs]){
      for (const b of this.aliveBalls()){
        if (hyp(b.x - o.x, b.y - o.y) < BALL_R * b.scale + PU_R){
          const rec = { f, id: b.id, team: b.team, kind: o.kind, orb: o.id, x: o.x, y: o.y };
          this.events.pickup.push(rec); ev.pickup.push(rec);
          if (o.kind === 'dash'){ b.dash_until = f + DASH_DUR; const d = { f, id: b.id }; this.events.dash.push(d); ev.dash.push(d); }
          else if (o.kind === 'swap'){
            const cands = this.aliveBalls().filter(x => x.id !== b.id && f >= x.aggro_immune_until);
            if (cands.length){
              const ntb = cands.reduce((best, x) => ((x.x - H.x) ** 2 + (x.y - H.y) ** 2) < ((best.x - H.x) ** 2 + (best.y - H.y) ** 2) ? x : best, cands[0]);
              H.target = ntb.id; H.lost = 0; b.aggro_immune_until = f + SWAP_IMMUNE;
              const sw = { f, id: b.id, to: ntb.id }; this.events.swap.push(sw); ev.swap.push(sw);
            }
          }
          else if (o.kind === 'invert'){   // CZ2: marca a un rival de OTRO equipo (el de más vivas) → giro dramático
            const rivals = this.teams.map((_, t) => t).filter(t => t !== b.team && this.teamAlive(t) > 0);
            if (rivals.length){
              const tgtTeam = rivals.reduce((a, c) => this.teamAlive(c) > this.teamAlive(a) ? c : a, rivals[0]);
              const cands = this.aliveBalls().filter(x => x.team === tgtTeam && f >= x.aggro_immune_until && !this.wouldEndEarly(x, f));
              if (cands.length){
                const ntb = cands.reduce((best, x) => ((x.x - H.x) ** 2 + (x.y - H.y) ** 2) < ((best.x - H.x) ** 2 + (best.y - H.y) ** 2) ? x : best, cands[0]);
                H.target = ntb.id; H.lost = 0;
                for (const al of this.byTeam[b.team]) al.aggro_immune_until = f + SWAP_IMMUNE;   // mi equipo, inmune un rato
                const iv = { f, id: b.id, to: ntb.id, team: tgtTeam }; this.events.invert.push(iv); ev.invert.push(iv);
              }
            }
          }
          this.orbs.splice(this.orbs.indexOf(o), 1);
          break;
        }
      }
    }

    // contactos (touch + conteo)
    const abc = this.aliveBalls(); const cur = new Set();
    for (let i = 0; i < abc.length; i++){
      for (let j = i + 1; j < abc.length; j++){
        const a = abc[i], c = abc[j];
        if (hyp(a.x - c.x, a.y - c.y) < (a.scale + c.scale) * BALL_R + 0.06){
          a.touch_f = f; a.touch_by = c.id; c.touch_f = f; c.touch_by = a.id;
          const pk = a.id < c.id ? a.id + '_' + c.id : c.id + '_' + a.id;
          cur.add(pk); if (!this._touch.has(pk)) this.contacts++;
        }
      }
    }
    this._touch = cur;

    // CAPTURA (solo activo, 1/frame)
    if (!this.tutorial && this.decision_frame === null && f >= H.digest_until && f >= H.stun_until){   //+AG tutorial: no caza
      let cand = null, cd = 1e9;
      for (const b of this.aliveBalls()){
        const d = hyp(b.x - H.x, b.y - H.y);
        if (d < H.r + CAP_PAD + BALL_R * b.scale && d < cd){ cand = b; cd = d; }
      }
      if (cand){
        const b = cand;
        if (b.isPlayer && f < b.shield_until){   //+AG ESCUDO: rechaza la captura (rebote mutuo), no elimina
          const ex = b.x - H.x, ey = b.y - H.y, el = hyp(ex, ey) || 1e-6;
          b.vx = ex / el * V_CLAMP; b.vy = ey / el * V_CLAMP; H.vx *= -0.3; H.vy *= -0.3;
          if (f - (this.near_cd.get(b.id) ?? -99) > 24){ this.near_cd.set(b.id, f); const s = { f, id: b.id }; this.events.save.push(s); ev.save.push(s); }
        } else if (this.wouldEndEarly(b, f)){
          let ex = b.x - H.x, ey = b.y - H.y, el = hyp(ex, ey) || 1e-6;
          b.vx = ex / el * V_CLAMP; b.vy = ey / el * V_CLAMP;
          if (f - (this.near_cd.get(b.id) ?? -99) > 24){ this.near_cd.set(b.id, f); const s = { f, id: b.id }; this.events.save.push(s); ev.save.push(s); }
        } else {
          this.placed++; b.rank = this.placed;
          const fl = { f, id: b.id, x: b.x, y: b.y, team: b.team }; this.events.falling.push(fl); ev.falling.push(fl);
          const elim = { f, id: b.id, team: b.team, by: 'hunter' };
          if ((f - b.touch_f) <= SHOVE_W && b.touch_by !== null){
            elim.shoved_by = b.touch_by;
            const bp = { f, x: b.x, y: b.y, id: b.touch_by }; this.events.bump.push(bp); ev.bump.push(bp);
          }
          this.events.eliminations.push(elim); ev.eliminations.push(elim);
          for (const o of this.aliveBalls()){
            let sdx = o.x - b.x, sdy = o.y - b.y, sl = hyp(sdx, sdy) || 1e-6;
            //+AG doc 39 #1: RES → al jugador lo desvía MENOS la onda de dispersión de una captura (NO es inmunidad:
            //   solo un pelín más difícil de mover). pmul.res=1 fuera de individual-con-stats.
            if (sl < 3.0){ let imp = SCATTER * (1 - sl / 3.0); if (o.isPlayer) imp /= this.pmul.res; o.vx += sdx / sl * imp; o.vy += sdy / sl * imp; }
          }
          H.kills++; H.digest_until = f + this.digest; H.target = null; H.hunger = 0;   // CZ1: comer resetea la furia
          H.r = Math.min(this.huntRCap, this.huntR0 + this.huntGrow * H.kills);
          H.scale = H.r / this.huntR0;
          H.vmax = Math.min(this.huntVmaxCap, this.huntVmax0 + this.huntVmaxGrow * H.kills);
        }
      }
    }

    // frenesí
    const na = this.aliveBalls().length;
    for (const thr of this.frenzyThr){
      if (na <= thr && !this.frenzied.has(thr) && this.decision_frame === null){
        this.frenzied.add(thr); H.frenzy_until = f + FRENZY_DUR; const fr = { f }; this.events.frenzy.push(fr); ev.frenzy.push(fr);
      }
    }

    // near-miss
    const active = f >= H.digest_until && f >= H.stun_until;
    for (const b of this.aliveBalls()){
      const d = hyp(b.x - H.x, b.y - H.y);
      const capr = H.r + CAP_PAD + BALL_R * b.scale;
      const pd = this.near_cd.get('d' + b.id);
      if (active && pd !== undefined && d < capr + NEAR_SAVE && d - pd > 0.02 && f - (this.near_cd.get(b.id) ?? -99) > 24){
        this.near_cd.set(b.id, f); const s = { f, id: b.id }; this.events.save.push(s); ev.save.push(s);
      }
      this.near_cd.set('d' + b.id, d);
    }

    // decisión
    const atl = this.aliveTeams();
    if (this.decision_frame === null && atl.length <= 1){
      this.winner_team = atl.length ? atl[0] : null; this.decision_frame = f;
      this.resolved_by = this.individual ? 'last_ball' : 'last_team';
    }

    // cámara focal
    const ab = this.aliveBalls();
    let tcx, tcy, tscale;
    if (lock_id >= 0 && this.balls[lock_id].rank === null){
      const tp = this.balls[lock_id];
      tcx = 0.5 * H.x + 0.5 * tp.x; tcy = 0.5 * H.y + 0.5 * tp.y;
      tscale = 2.0 * hyp(H.x - tp.x, H.y - tp.y) + 6.5;
    } else {
      let bx = H.x, by = H.y;
      if (ab.length){ bx = 0; by = 0; for (const b of ab){ bx += b.x; by += b.y; } bx /= ab.length; by /= ab.length; }
      tcx = 0.6 * H.x + 0.4 * bx; tcy = 0.6 * H.y + 0.4 * by;
      let spread = 4.0; for (const b of ab) spread = Math.max(spread, hyp(b.x - tcx, b.y - tcy));
      tscale = 2.0 * spread + 4.0;
    }
    //+AG CAMARA video + sesgo al jugador (decision Jaime 2026-07-10): misma camara focal del video,
    //   pero tu bola SIEMPRE entra en plano (mezcla del centro + apertura minima para cubrirla).
    const _pl = this.balls[0];
    if (_pl && _pl.rank === null){
      tcx = tcx * 0.72 + _pl.x * 0.28; tcy = tcy * 0.72 + _pl.y * 0.28;
      tscale = Math.max(tscale, 2.2 * hyp(_pl.x - tcx, _pl.y - tcy) + 5.0);
    }
    tscale = Math.max(7.0, Math.min(17.0, tscale));
    this.cam[0] += (tcx - this.cam[0]) * 0.07;
    this.cam[1] += (tcy - this.cam[1]) * 0.07;
    this.scale_cur += (tscale - this.scale_cur) * 0.05;

    // R5 fuera de mapa (alguien vivo o el cazador fuera del corral + margen)
    for (const b of ab) if (Math.abs(b.x) > XH + 0.6 || Math.abs(b.y) > YH + 0.6) this.oob = true;
    if (Math.abs(H.x) > XH + 0.6 || Math.abs(H.y) > YH + 0.6) this.oob = true;

    if (this.decision_frame !== null && f - this.decision_frame >= WIN_HOLD) this._finish();
    if (f >= this.hardCap && !this.done) this._finish(true);
    return ev;
  }

  _finish(timeout){
    if (timeout && this.winner_team === null){
      let best = 0, bc = -1;
      for (let t = 0; t < this.teams.length; t++){ const c = this.teamAlive(t); if (c > bc){ bc = c; best = t; } }
      this.winner_team = best; this.decision_frame = this.f; this.resolved_by = 'timeout';
    }
    this.done = true;
  }

  get scale(){ return this.scale_cur; }
}
