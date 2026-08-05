// YouBall · RED LIGHT RUSH — casting (DRAMA). Fórmula: docs/44 §14.1 (VB del dueño 2026-07-06, punto de
// partida a recalibrar con datos reales del sweep). Simula una partida completa y puntúa su drama para que
// el casting elija, de N_SIM semillas por hueco de torneo, la de mayor DRAMA que cumpla los gates duros.
import { Sim, GAME_F } from './sim.js?v=663c9be';

// simula una partida entera y devuelve { sim, events, saves, leadChanges, causeSet } acumulados.
export function simulate(seed){
  const sim = new Sim(seed);
  let saves = 0, leadChanges = 0, lastLeadTeam = -1, causeSet = new Set();
  let contentFrames = 0, totalFrames = 0;
  let guard = 0;
  while (!sim.done && guard < GAME_F + 500){
    const ev = sim.step();
    if (ev){
      saves += ev.save.length;
      for (const k of ev.kill) if (k.cause !== 'eliminated') causeSet.add(k.cause);   // 'eliminated' (perdedoras al ganar) no cuenta como variedad de causa
      totalFrames++;   // CONTENCIÓN: fracción de la partida con >=2 equipos aún peleando (final reñido, sin depender del muro)
      if ([0, 1, 2, 3].filter(t => sim.byTeam[t].some(b => b.rank === null)).length >= 2) contentFrames++;
      // equipo con más Y media entre sus bolas activas = "más adelantado" ahora mismo
      let leadTeam = -1, leadY = -1;
      for (let t = 0; t < 4; t++){ const al = sim.byTeam[t].filter(b => b.rank === null || b.safe);
        if (!al.length) continue;
        let my = 0; for (const b of al) my += (b.safe ? 44 : b.y); my /= al.length;
        if (my > leadY){ leadY = my; leadTeam = t; } }
      if (lastLeadTeam !== -1 && leadTeam !== -1 && leadTeam !== lastLeadTeam) leadChanges++;
      lastLeadTeam = leadTeam;
    }
    guard++;
  }
  return { sim, saves, leadChanges, causeSet, contention: totalFrames ? contentFrames / totalFrames : 0 };
}

// DRAMA = 0.25*closeness_final + 0.20*lead_changes_norm + 0.20*saves_norm + 0.15*near_wall_tension
//       + 0.10*cause_variety + 0.10*balance_bonus   (docs/44 §14.1)
export function computeDrama(res){
  const { sim, saves, leadChanges, causeSet, contention } = res;
  const pts = sim.crossed.slice().sort((a, b) => b - a);
  const closeness = 1 - Math.abs(pts[0] - pts[1]) / 3;
  const leadChangesNorm = Math.min(1, leadChanges / 6);
  const savesNorm = Math.min(1, saves / 12);
  const causeVariety = Math.min(1, causeSet.size / 3);   // 3 causas posibles ahora: semaforo/losa/boulder
  // balance_bonus (§14.1): 0 SOLO si se decidió por el desempate más feo (dorsal, §11.1 caso 4).
  const balanceBonus = sim.progress_tiebreak === 'dorsal' ? 0 : 1;
  return 0.25 * closeness + 0.20 * leadChangesNorm + 0.20 * savesNorm + 0.15 * contention + 0.10 * causeVariety + 0.10 * balanceBonus;
}

// gates duros de corrección/justicia (docs/44 §13.2 #1,#5,#6,#7) antes de rankear por DRAMA
export function passesHardGates(sim){
  if (sim.oob) return false;
  if (sim.winner_team === null) return false;
  const durS = (sim.decision_frame ?? sim.f) / 30;
  if (durS < 18 || durS > 50) return false;   // v5: modo CORTO por decisión de diseño (~25-35s); banda ancha
  return true;
}
