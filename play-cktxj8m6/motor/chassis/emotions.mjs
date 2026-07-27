// YouBall · MOTOR DE EMOCIONES EN VIVO (WebGL) — port de generator/emotions*.py a tiempo real.
// En Blender el emo_track se calculaba en post sobre el sim_data completo; aquí la sim corre
// frame a frame, así que cada bola tiene una máquina de estados con la MISMA escalera de prioridad:
//   ko/extasis-ganador(9) > extasis-orbe / chuleria-al-lobo(6) > susto/dolor/alivio(5)
//   > feliz(3) > concentrada(2) > parpadeo(1) > neutral(0)
// Cada frame: humor AMBIENTE (proximidad, ranking…) + REACCIONES temporizadas de eventos.
// Gana la prioridad más alta; a igualdad, la reacción (más saliente) gana al ambiente.

export const PRIO = {
  neutral: 0, blink: 1, concentrada: 2, feliz: 3, sorpresa: 4,
  dolor: 5, susto: 5, alivio: 5, enfado: 5,
  chuleria: 6, extasis_pu: 6, ko: 9, extasis: 9,
};

// RNG determinista (mulberry32) para el parpadeo, igual semilla → igual resultado en Node y navegador
function mulberry32(a){
  return function (){ a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Estado de emoción de UNA bola.
class EmoState {
  constructor(blinkStart, blinkPeriod){
    this.aExpr = 'neutral'; this.aPrio = 0;        // ambiente (se fija cada frame)
    this.rExpr = 'neutral'; this.rPrio = -1; this.rUntil = -1;  // reacción temporizada
    this.blinkStart = blinkStart; this.blinkPeriod = blinkPeriod;
  }
  // ambiente del frame (proximidad/ranking/…). Se sobrescribe cada frame.
  ambient(expr, prio){ this.aExpr = expr; this.aPrio = prio; }
  // dispara una reacción de evento. A prioridad >= la vigente (o si la vigente ya expiró), la nueva manda.
  fire(expr, prio, dur, f){ if (prio >= this.rPrio || f >= this.rUntil){ this.rExpr = expr; this.rPrio = prio; this.rUntil = f + dur; } }
  // expresión a mostrar en el frame f
  resolve(f){
    let expr = 'neutral', prio = 0;
    if (this.aPrio > prio){ expr = this.aExpr; prio = this.aPrio; }
    if (prio < 1 && this.blinkStart >= 0){                       // parpadeo idle solo sobre neutral
      const d = f - this.blinkStart;
      if (d >= 0 && (d % this.blinkPeriod) < 3){ expr = 'blink'; prio = 1; }
    }
    if (f < this.rUntil && this.rPrio >= prio){ expr = this.rExpr; prio = this.rPrio; }  // reacción gana empates
    return expr;
  }
}

// Variantes de la cara de LUCHA: 'concentrada' se reparte entre estas para que las caras NO sean
// siempre la misma. Rotan por bola (dorsal) y en el tiempo → cada bola distinta y cambia sola.
const FIGHT = ['concentrada', 'conc_b', 'conc_c', 'concentrada', 'conc_cL', 'conc_b'];
const FIGHT_CYCLE = 100;   // ~3.3 s por variante a 30 fps

// ── CARA DE FIRMA por bola-heroe (paridad ficha/pista, 27-jul) ──────────────────────────────
// En la Tienda cada bola tiene ACTITUD: Pinball te guiña, Volcan se rie con la boca abierta,
// Bunker esta serio bajo el casco, Fantasma sonrie de medio lado. En pista todas ponian la
// MISMA cara neutral de bebe, asi que la personalidad que habias comprado desaparecia justo
// cuando ibas a jugar con ella.
//
// Sustituye SOLO el reposo (la 'neutral' de prioridad 0). Todo lo demas queda intacto:
//   · el PARPADEO sigue funcionando (resolve lo devuelve como 'blink', y 'blink' no es 'neutral')
//   · en cuanto la partida tiene algo que decir (foco, susto, dolor, KO, extasis) manda la
//     escalera de prioridad de siempre y la cara de firma desaparece.
// Es 100% cosmetico y entra por la misma puerta que el material (&arch, solo individual, solo
// balls[0]): el torneo y el video del motor no lo reciben y quedan byte-identicos.
export const ARCH_IDLE = {
  cohete:  'feliz',        // lanzada y con ganas
  tanque:  'concentrada',  // estoico
  chispa:  'feliz',        // sonrison de la ficha
  pinball: 'chuleria',     // guiña en la ficha
  lapa:    'concentrada',  // ceño de la ficha, sin llegar al enfado (las marcas rojas a 56 px son ruido)
  burbuja: 'neutral',      // dulce: su ficha YA es la cara neutral de ojos grandes
  meteoro: 'concentrada',  // agresivo
  bunker:  'concentrada',  // serio militar
  volcan:  'feliz',        // se rie a carcajadas en la ficha
  yunque:  'concentrada',  // duro
  fantasma:'chuleria',     // sonrisa picara
  estrella:'chuleria',     // guiña en la ficha
};
// Devuelve la expresion a pintar: la de firma si la bola esta en reposo, y si no la que venga.
export const archIdle = (arch, expr) => (expr === 'neutral' && ARCH_IDLE[arch]) ? ARCH_IDLE[arch] : expr;

// Libro de emociones para todas las bolas de una sim.
export class EmoBook {
  constructor(nb, seed){
    const rng = mulberry32((seed >>> 0) * 131 + 7);
    this.s = [];
    this.fightOff = [];
    for (let i = 0; i < nb; i++){
      const period = 110 + Math.floor(rng() * 80);
      const start = Math.floor(rng() * period);
      this.s.push(new EmoState(start, period));
      this.fightOff.push(Math.floor(rng() * FIGHT.length));   // arranque de variante distinto por bola
    }
  }
  ambient(id, expr, prio){ const e = this.s[id]; if (e) e.ambient(expr, prio); }
  fire(id, expr, prio, dur, f){ const e = this.s[id]; if (e) e.fire(expr, prio, dur, f); }
  resolve(id, f){ const e = this.s[id]; if (!e) return 'neutral';
    let expr = e.resolve(f);
    if (expr === 'concentrada') expr = FIGHT[(this.fightOff[id] + Math.floor(f / FIGHT_CYCLE)) % FIGHT.length];   // variante de lucha rotatoria
    return expr;
  }
}
