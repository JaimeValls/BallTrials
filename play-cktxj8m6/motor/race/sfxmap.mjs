// YouBall · MAPEO eventos→buffer de audio de La Gran Carrera, browser-safe (sin Node). El corazón del sonido del
// modo: por cada evento de la sim coloca su SFX en un Float32Array. Lo usan IGUAL el render (audio.mjs → WAV) y el
// preview en vivo (index.html → Web Audio) → la web suena EXACTAMENTE como el render (misma síntesis, mismo seed).
//   import { buildSfxBuffer } from './sfxmap.mjs?v=ae32416';
//   const buf = buildSfxBuffer({ events, decision_frame, f, seed, SR });   // Float32Array mono (sin normalizar)
import { createSynth, makeRng } from '../chassis/synth.mjs?v=ae32416';
import { createFx } from '../chassis/sfx.mjs?v=ae32416';
import { FPS } from './sim.js?v=ae32416';

// events = sim.events (la sim de la Carrera ACUMULA sus propios eventos durante toda la partida; ver runToEnd/qa).
// Claves array: bump, pickup, relay, gatebreak, twists, finishes. f = frame final. decision_frame = victoria (o null).
export function buildSfxBuffer({ events, decision_frame, f, seed, SR = 44100 }){
  const ev = events || {};
  const dur = f / FPS + 0.6, N = Math.ceil(dur * SR);
  const buf = new Float32Array(N);
  const T = fr => fr / FPS;
  const rng = makeRng(seed);
  const synth = createSynth({ SR, N, buf, rng });
  const { add, note, jingleWin } = synth;
  const fx = createFx(synth);

  const thin = (arr, m) => { const o = []; let l = -1e9; for (const e of arr){ const t = e.f / FPS; if (t - l >= m){ o.push(e); l = t; } } return o; };
  for (const e of thin(ev.bump || [], 0.45)){ add(T(e.f), 0.07, 200, 110, 0.14, 0.25); }              // pin/bumper (suave, ESPACIADO: son muchos)
  // POWER-UP cogido (bling) + ZIP de velocidad si el buff deja ESTELA CIAN (turbo/relevo encienden P.trail; ver efecto-velocidad).
  // estrella=invencibilidad (parpadeo, sin estela) y gigante NO llevan estela → solo bling, sin zip.
  for (const e of (ev.pickup || [])){ const t = T(e.f);
    add(t, 0.10, 760, 1180, 0.20); add(t + 0.05, 0.09, 1180, 1560, 0.14);                             // bling de coger ítem
    if (e.type === 'turbo' || e.type === 'relay') fx.zip(t + 0.02, 0.34); }                            // ráfaga de velocidad (hermano sonoro de la estela cian)
  for (const e of (ev.relay || [])){ [523, 784].forEach((nf, i) => add(T(e.f) + i * 0.06, 0.16, nf, nf, 0.18)); }       // relevo (acorde de equipo)
  // BOOST PAD: NO suena. Los pads los pisan MUCHAS bolas sin parar (~26/partida, ~0,7/s) = carpet → la regla de densidad manda
  // MUTEARLO. El zip de velocidad sale del power-up DISCRETO (turbo/relevo, arriba) = "al coger el power-up", que es lo que pidió
  // el dueño. El pad es estela ambiente: se VE (P.trail cian) pero no se suena por cada pisada. (ev.boost intencionadamente MUDO.)
  // NITRO (doc 74): tenía el sonido de coger un ítem del suelo, y es lo más gordo que hace el jugador tras el súper.
  // Ahora suena fx.nitro (golpe de encendido + acelerón + cola de llama). Va THINNED a 1,1 s por la regla de densidad
  // de este fichero: en el VÍDEO no hay jugador y las 11 bolas de la IA gastan su nitro 2-3 veces cada una (~20 por
  // carrera, 0,7/s) — sin el thin sería un carpet, justo lo que mutea el pad de impulso. En el juego en vivo llega
  // filtrado a la bola del jugador (ver liveSfx en index.html), así que ahí el thin no recorta nada.
  for (const e of thin(ev.nitro || [], 1.1)){ fx.nitro(T(e.f), 0.55); }
  // ESCUDO y SÚPER DEL JUGADOR (doc 88, 2ª vuelta). Los dos sonaban con el BLING DE COGER UN ÍTEM DEL
  // SUELO: `liveSfx` los metía por el canal `pickup` con type 'shield' y 'star'. O sea la enfermedad
  // exacta que el doc 74 le curó al nitro — «sonaba a *he cogido algo* cuando lo que pasa es otra
  // cosa» — y que se quedó sin curar en sus dos vecinos.
  // ⚠ EL VÍDEO DEL CANAL NO CAMBIA NI UN BYTE: el render offline recibe los eventos crudos de la Sim
  //   (`shieldup`, `super`), y este fichero NUNCA ha tenido una rama para ellos — sólo sonaban en vivo
  //   porque el motor los re-mapeaba a `pickup`. Estas claves las produce sólo el motor.
  // ESCUDO: una CÚPULA que se cierra. Nada de bling: un golpe sordo grave + un timbre metálico que se
  // asienta. Dice "me he blindado", no "he recogido algo".
  for (const e of (ev.pshield || [])){ const t = T(e.f);
    add(t, 0.09, 240, 130, 0.34, 0.20, 6);                       // el golpe de la cúpula al cerrarse
    add(t + 0.02, 0.34, 620, 900, 0.20, 0.06, 2.2);              // el metal que se asienta (sube poco y aguanta)
    note(t + 0.02, 0.40, 392, 0.20, { wave: 'sine', decay: 2.4 });   // cuerpo grave y limpio = protección
    note(t + 0.06, 0.34, 587, 0.12, { wave: 'sine', decay: 3 });     // quinta: acorde estable, no fanfarria
  }
  // SÚPER: es lo más gordo que puede hacer el jugador y lo único que no se compra (doc 83 §1). Fanfarria
  // corta ascendente + brillo, por encima de todo lo demás del modo.
  for (const e of (ev.psuper || [])){ const t = T(e.f);
    add(t, 0.10, 180, 90, 0.42, 0.28, 6);                        // el impulso grave
    add(t, 0.36, 420, 2200, 0.40, 0.14, 2.4);                    // barrido ascendente (el "arranque")
    [523, 659, 784, 1047].forEach((nf, i) =>                     // acorde mayor que RESUELVE hacia arriba
      note(t + 0.03 + i * 0.045, 0.30, nf, 0.20 - i * 0.02, { wave: 'pulse', duty: 0.4, decay: 4 }));
    add(t + 0.10, 0.30, 2600, 3600, 0.16, 0.08, 5);              // glaseado (el destello dorado)
  }
  for (const e of thin(ev.gatebreak || [], 1.0)){ fx.shatter(T(e.f), 0.5); }                         // ¡ROTURA de barrera! 1 crash por barrera (hito, ver carrera-barreras-rompibles); muchas baldosas/barrera -> agrupado
  for (const t of (ev.twists || [])){ if (t) add(T(t.f), 0.7, 80, 55, 0.32, 0.5, 2.0); }               // Sacudida (rumble)
  (ev.finishes || []).forEach((e, i) => note(T(e.f), 0.16, 784 + Math.min(e.rank!=null?e.rank-1:i, 8) * 28, 0.16, { wave: 'pulse', decay: 6 }));   // ding MUSICAL ascendente por orden de llegada //+AG en vivo llegan de UNO en uno (i siempre 0): e.rank conserva la escala ascendente
  if (decision_frame !== null && decision_frame !== undefined) jingleWin(T(decision_frame));    // FANFARRIA musical "2ª prueba" (arpegio + acorde resonante)

  return buf;
}
