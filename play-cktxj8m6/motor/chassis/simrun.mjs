// YouBall · acumulador de eventos de simulación, browser-safe (sin Node). La sim devuelve los eventos de CADA frame
// en step() y los resetea en el siguiente → para sonar (o medir) hace falta acumularlos a lo largo de toda la partida.
// Lo usan IGUAL el render (audio.mjs en Node) y el preview en vivo (index.html en navegador) → MISMOS eventos.
//   import { accumulateEvents } from '../chassis/simrun.mjs?v=deb26dc-SUCIO';
//   const run = accumulateEvents(new Sim(seed));   // { events, f, decision_frame, winner_team, seed }

// TOBOGÁN: la sim RESETEA los eventos en cada step() y los devuelve → hay que acumular el retorno frame a frame.
// Acumula TODOS los campos array de cada evento (orden de frame preservado). Los campos escalares se ignoran.
export function accumulateEvents(sim, { maxFrames = 100000 } = {}){
  const acc = {};
  let guard = 0;
  while (!sim.done && guard++ < maxFrames){
    const ev = sim.step();
    if (!ev) break;
    for (const k in ev){
      const v = ev[k];
      if (Array.isArray(v)){ const a = acc[k] || (acc[k] = []); for (const e of v) a.push(e); }
    }
  }
  return { events: acc, f: sim.f, decision_frame: sim.decision_frame, winner_team: sim.winner_team, seed: sim.seed };
}

// SUELO/RECOLECTA/CAZADOR/CARRERA/PLATAFORMA: la sim ACUMULA sus propios eventos en sim.events durante toda la
// partida → basta correrla hasta el final y leerlos. IDÉNTICO a qa.runSeed (new Sim; while(!done) step; return s)
// → mismos eventos que el render. Devuelve la misma forma que accumulateEvents.
export function runToEnd(sim, { maxFrames = 100000 } = {}){
  let guard = 0;
  while (!sim.done && guard++ < maxFrames) sim.step();
  return { events: sim.events, f: sim.f, decision_frame: sim.decision_frame, winner_team: sim.winner_team, seed: sim.seed };
}
