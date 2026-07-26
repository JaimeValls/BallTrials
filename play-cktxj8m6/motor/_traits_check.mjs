// RASGOS de Épicas/Legendaria (doc 39, abierto: "los rasgos son solo texto") — banco de verificación.
//
// Dos preguntas, y las dos hay que contestarlas antes de tocar producción:
//   1) IDENTIDAD: sin ?trait, y con un trait que no es de este modo, la simulación tiene que salir
//      BYTE-IDÉNTICA a la de antes. Es el mismo doble candado que ?stats y ?arch.
//   2) EFECTO: el rasgo tiene que hacer lo que promete la ficha de la Tienda, medido. Si la ficha
//      dice "+20%", aquí se mide +20%.
//
// Uso: node prototipo/motor/_traits_check.mjs        (N=120)
//      N=400 node prototipo/motor/_traits_check.mjs
const load = m => import(new URL('./' + m + '/sim.js', import.meta.url).href).then(x => x.Sim);
const [Race, Caza, Red] = await Promise.all([load('race'), load('cazador'), load('redlight')]);

const N = Number(process.env.N) || 120;
const SIMS = { race: Race, cazador: Caza, redlight: Red };

// Huella de una partida: posiciones y velocidades de TODAS las bolas en cada paso, redondeadas.
// Si dos huellas coinciden, la simulación es la misma; si difieren en un bit, salta.
function huella(Sim, seed, opts){
  const sim = new Sim(seed, { individual:true, n:8, ...opts });
  let h = 0;
  const mez = v => { h = (h * 31 + Math.round(v * 1e6)) | 0; };
  for (let i = 0; i < 900; i++){
    const r = sim.step(); if (!r) break;
    for (const b of sim.balls){ mez(b.x); mez(b.y); mez(b.vx); mez(b.vy); }
  }
  return h;
}

console.log(`RASGOS · ${N} semillas · los 3 modos\n`);

// ---- 1) IDENTIDAD ----
let fallos = 0;
for (const [modo, Sim] of Object.entries(SIMS)){
  let igualSin = 0, igualAjeno = 0;
  for (let s = 1; s <= N; s++){
    const base = huella(Sim, s, {});
    if (huella(Sim, s, {}) === base) igualSin++;                       // determinismo del propio banco
    // un rasgo que NO es de este modo no puede mover ni un bit
    const ajeno = modo === 'cazador' ? 'noexiste' : 'fantasma';
    if (huella(Sim, s, { trait: ajeno }) === base) igualAjeno++;
  }
  // TORNEO/VÍDEO: el perfil de equipos tiene que quedar byte-idéntico aunque le llegue un rasgo. Importa medirlo
  // y no darlo por hecho: en redlight el index.html mete ?trait en las opciones sin mirar el perfil, y lo único que
  // lo detiene es el SEGUNDO candado (la Sim comprueba this.individual). Esto es la prueba de que ese candado cierra.
  let igualTorneo = 0;
  for (let s = 1; s <= N; s++){
    const sim0 = new Sim(s, {}), sim1 = new Sim(s, { trait: 'volcan' });
    let h0 = 0, h1 = 0;
    const mez = (h, v) => (h * 31 + Math.round(v * 1e6)) | 0;
    for (let i = 0; i < 300; i++){
      const a = sim0.step(), b = sim1.step(); if (!a && !b) break;
      for (const x of sim0.balls){ h0 = mez(h0, x.x); h0 = mez(h0, x.vx); }
      for (const x of sim1.balls){ h1 = mez(h1, x.x); h1 = mez(h1, x.vx); }
    }
    if (h0 === h1) igualTorneo++;
  }
  const ok = igualSin === N && igualAjeno === N && igualTorneo === N;
  if (!ok) fallos++;
  console.log(`  ${modo.padEnd(9)} identidad: sin trait ${igualSin}/${N} · trait ajeno ${igualAjeno}/${N} · TORNEO con rasgo ${igualTorneo}/${N}  ${ok ? 'OK' : '<-- ROMPE LA IDENTIDAD'}`);
}

// ---- 2) EFECTO MEDIDO ----
// VOLCÁN: la duración del booster del jugador tiene que subir un 20%.
// ESTRELLA: el súper del jugador tiene que durar 30 frames (1 s a 30 FPS) más.
console.log('\n  efecto de cada rasgo (duraciones en frames de sim):');
const dur = {
  race: sim => { const b = sim.balls[0]; sim.fireNitro(b); const t = b.turbo; sim.fireSuper(b); return [t, b.star]; },
  // en cazador el "súper" es la ventana de inmunidad al aggro que abre el señuelo
  cazador: sim => { const p = sim.balls[0]; sim.playerShield(); const t = p.shield_until - sim.f;
                    sim.playerDecoy(); return [t, p.aggro_immune_until - sim.f]; },
  redlight: sim => { sim.playerNitro(); const t = sim.pIn.nitroUntil - sim.f;
                     sim.playerSuper(); return [t, sim.pIn.superUntil - sim.f]; },
};
for (const [modo, Sim] of Object.entries(SIMS)){
  const f = dur[modo]; if (!f) continue;
  const mk = t => { const sim = new Sim(7, { individual:true, n:8, ...(t ? {trait:t} : {}) }); for (let i=0;i<40;i++) sim.step(); return f(sim); };
  let base, vol, est;
  try { base = mk(null); vol = mk('volcan'); est = mk('estrella'); }
  catch (e){ console.log(`  ${modo.padEnd(9)} no se pudo medir aqui: ${e.message}`); continue; }
  const pct = (a, b) => b ? ((a / b - 1) * 100).toFixed(0) + '%' : 'n/a';
  console.log(`  ${modo.padEnd(9)} boost ${base[0]} -> ${vol[0]} (${pct(vol[0], base[0])}, se pide +20%)` +
              `   super ${base[1]} -> ${est[1]} (+${est[1] - base[1]} frames, se piden +30)`);
}

// FANTASMA: cuántos frames tarda el Cazador en fijar al jugador por primera vez.
function framesHastaFijar(seed, trait){
  const sim = new Caza(seed, { individual:true, n:8, ...(trait ? {trait} : {}) });
  for (let f = 1; f <= 900; f++){ if (!sim.step()) break; if (sim.lock === 0) return f; }
  return 900;   // no lo fijó en toda la partida
}
let sumBase = 0, sumFan = 0;
for (let s = 1; s <= N; s++){ sumBase += framesHastaFijar(s, null); sumFan += framesHastaFijar(s, 'fantasma'); }
const mBase = sumBase / N, mFan = sumFan / N, subida = (mFan / mBase - 1) * 100;
console.log(`\n  fantasma  el Cazador tarda ${mBase.toFixed(0)} -> ${mFan.toFixed(0)} frames en fijarte ` +
            `(+${subida.toFixed(1)}%, la ficha promete +15%)`);

// YUNQUE: hay que medir el impulso de CHOQUE ENTRE BOLAS, no el tirón total (en la Carrera el mayor tirón lo dan
// las aspas y los pegs, y ahí el rasgo no pinta nada: mezclarlos escondía el efecto detrás del ruido).
// Truco: se aísla llamando a la misma resolución de colisión con dos bolas puestas a mano.
function empujonEntreBolas(Sim, trait){
  const sim = new Sim(3, { individual:true, n:8, ...(trait ? {trait} : {}) });
  for (let i = 0; i < 30; i++) sim.step();
  const p = sim.balls[0], o = sim.balls[1];
  // se coloca a la rival justo encima del jugador y viniendo hacia él, a la misma masa
  o.m = p.m; p.rank = null; o.rank = null;
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
  o.x = 0.30; o.y = 0; o.vx = -8; o.vy = 0;
  const antes = p.vx;
  for (let i = 0; i < 3; i++) sim.step();
  return Math.abs(p.vx - antes);
}
// OJO al leer esto: el impulso de CADA choque se parte por la mitad por construcción (es un factor 0.5 en la línea
// que aplica el impulso). Lo que se mide aquí es el empujón NETO que se le queda al jugador unos frames después,
// con el resto de fuerzas del modo actuando encima — por eso no sale un -50% limpio, y por eso no hay que tocar la
// constante para "cuadrar" el número: se cuadraría el banco, no el juego.
console.log('\n  yunque (empujón NETO que le queda tras un choque a bocajarro de una bola igual):');
for (const [modo, Sim] of Object.entries(SIMS)){
  const b = empujonEntreBolas(Sim, null), y = empujonEntreBolas(Sim, 'yunque');
  console.log(`  ${modo.padEnd(9)} ${b.toFixed(2)} -> ${y.toFixed(2)} u/s (${((y/b - 1) * 100).toFixed(0)}%; el impulso del choque va al 50% exacto)`);
}

// ---- 3) PRESUPUESTO DE JUSTICIA (mismo criterio que _stats_fairness.mjs: ayuda notable, sin dominar) ----
// Los rasgos TOCAN la física, así que hay que medir si desequilibran. Política de conducción mínima y FIJA para
// aislar el rasgo de la maña, y los 7 rivales en baseline neutro.
// Se reusan LAS MISMAS políticas de _stats_fairness.mjs (no se inventan otras: una política distinta mediría otra
// cosa y los dos bancos dejarían de ser comparables). Son mínimas y sin boosters bajo demanda a propósito.
const corre = {
  race: (Sim, seed, o) => { const sim = new Sim(seed, o); let g = 0;
    while (!sim.done && g++ < 6000) sim.step();
    return sim.player.rank === 1; },
  cazador: (Sim, seed, o) => { const sim = new Sim(seed, o); sim.playerIntent = 'escapar'; let g = 0;
    while (!sim.done && g++ < 6000) sim.step();
    return sim.winner_team === sim.balls[0].team; },
  redlight: (Sim, seed, o) => { const sim = new Sim(seed, o); sim.playerEngage(); let g = 0;
    while (!sim.done && g++ < 6000){ sim.playerRun(sim.color === 'green'); sim.step(); }
    return sim.winner_team === sim.balls[0].team; },
};
function tasaVictoria(Sim, modo, trait, semillas){
  let win = 0;
  for (let s = 1; s <= semillas; s++)
    if (corre[modo](Sim, s, { individual:true, n:8, ...(trait ? {trait} : {}) })) win++;
  return win / semillas;
}
console.log('\n  presupuesto de justicia (victorias del jugador · baseline 1/8 = 12.5% · techo sano <45%):');
let riesgo = 0;
for (const [modo, Sim] of Object.entries(SIMS)){
  const base = tasaVictoria(Sim, modo, null, N);
  const linea = ['volcan','estrella','yunque','fantasma'].map(t => {
    const v = tasaVictoria(Sim, modo, t, N);
    if (v > 0.45) riesgo++;
    return `${t} ${(v*100).toFixed(0)}%`;
  }).join(' · ');
  console.log(`  ${modo.padEnd(9)} sin rasgo ${(base*100).toFixed(0)}%  ->  ${linea}`);
  // AVISO honesto: estas políticas NO usan boosters bajo demanda (es lo que las hace comparables con
  // _stats_fairness.mjs), así que VOLCÁN y ESTRELLA salen clavados al baseline: no es que no hagan nada, es que
  // esta medida no los ve. Su techo está acotado por construcción: +20% de duración y +1 s sobre un booster que
  // el jugador tiene que ganarse y disparar. Los que esta medida SÍ ve son Yunque y Fantasma.
}
if (riesgo) console.log(`  <-- ${riesgo} rasgo(s) pasan del 45%: DOMINAN, hay que bajarlos.`);

console.log(fallos ? `\nREVISAR: ${fallos} modo(s) rompen la identidad.` : '\nIDENTIDAD OK en los 3 modos.');
