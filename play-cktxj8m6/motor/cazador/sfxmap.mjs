// YouBall · MAPEO eventos→buffer de audio de El Cazador, browser-safe (sin Node). El corazón del sonido del modo:
// por cada evento de la sim coloca su SFX en un Float32Array. Lo usan IGUAL el render (audio.mjs → WAV) y el
// preview en vivo (index.html → Web Audio) → la web suena EXACTAMENTE como el render (misma síntesis, mismo seed).
//   import { buildSfxBuffer } from './sfxmap.mjs?v=54f3e58';
//   const buf = buildSfxBuffer({ events, decision_frame, f, seed, SR });   // Float32Array mono (sin normalizar)
import { createSynth, makeRng } from '../chassis/synth.mjs?v=54f3e58';
import { createFx } from '../chassis/sfx.mjs?v=54f3e58';
import { FPS } from './sim.js?v=54f3e58';

// events = sim.events de la SIM (runToEnd / runSeed: la sim acumula en sim.events). Claves array: orbs (SPAWN de
// orbe), pickup (cogerlo, con e.kind 'dash'|'swap'|'invert'), dash, swap, invert (sub-eventos del pickup, mismo
// frame), bump, falling≡eliminations (1:1, la CAPTURA), save, frenzy. f = frame final. decision_frame = victoria.
// Cada clave-array con n≥3 que se ve en pantalla TIENE sonido (detector sfx-coverage → 0 huecos). Ver docs/29.
export function buildSfxBuffer({ events, decision_frame, f, seed, SR = 44100 }){
  const ev = events || {};
  const dur = f / FPS + 0.6, N = Math.ceil(dur * SR);
  const buf = new Float32Array(N);
  const T = fr => fr / FPS;
  const rng = makeRng(seed);
  const { add, note, jingleWin } = createSynth({ SR, N, buf, rng });
  const fx = createFx({ add, note });
  const thin = (arr, minDt) => { const out = []; let last = -1e9; for (const e of (arr || [])){ const t = e.f / FPS; if (t - last >= minDt){ out.push(e); last = t; } } return out; };

  // ORBE APARECE (spawn, ~0,3/s): tilín alto MUY suave = "hay premio ahí" sin robar protagonismo a cogerlo.
  for (const e of thin(ev.orbs, 0.5)){ note(T(e.f), 0.08, 1760, 0.07, { wave: 'sine', decay: 9 }); add(T(e.f), 0.05, 2400, 2900, 0.05, 0.04, 10); }
  // COGER orbe (base de TODO pickup): clic-chispa táctil "lo tengo" (dash/swap/invert añaden su capa encima).
  for (const e of (ev.pickup || [])){ add(T(e.f), 0.05, 1500, 1900, 0.10, 0.05, 11); note(T(e.f) + 0.02, 0.10, 1318, 0.12, { wave: 'tri', decay: 6 }); }
  // DASH (orbe de velocidad → estela CIAN, ver efecto-velocidad): ZIP = hermano sonoro del trail. PUNTUAL al cogerlo.
  for (const e of (ev.dash || [])){ fx.zip(T(e.f), 0.30); }
  // SWAP (el cazador cambia de presa por el orbe): swoosh DESCENDENTE + ding de "nuevo objetivo".
  // LOS BOOSTERS DEL JUGADOR (doc 88, 2ª vuelta). Antes: el DASH sonaba con `fx.zip` por el canal
  // `dash`, que es el mismo que usan las once bolas de la IA; el ESCUDO caía en el canal `save` —el de
  // «librarse por los pelos»— y sonaba a un «uf» de 0,09 s; y el SEÑUELO sonaba al blip del orbe de la
  // IA. Los tres, prestados. ⚠ Estas claves las produce SÓLO el motor (la Sim no las emite), así que el
  // render offline del vídeo no las ve y su WAV no cambia.
  for (const e of (ev.pdash || [])){ const t = T(e.f);
    fx.zip(t, 0.42);                                              // el idioma de velocidad del motor, pero TUYO y más fuerte
    add(t, 0.07, 200, 90, 0.30, 0.22, 8);                         // el empujón grave que el zip no tenía
  }
  // ESCUDO: cúpula que se cierra. Golpe sordo + metal que se asienta. Nada de «uf».
  for (const e of (ev.pshield || [])){ const t = T(e.f);
    add(t, 0.09, 240, 130, 0.34, 0.20, 6);
    add(t + 0.02, 0.34, 620, 900, 0.20, 0.06, 2.2);
    note(t + 0.02, 0.40, 392, 0.20, { wave: 'sine', decay: 2.4 });
    note(t + 0.06, 0.34, 587, 0.12, { wave: 'sine', decay: 3 });
  }
  // SEÑUELO: se gana con la barra y no se compra (doc 83 §1). Un «pluf» de sustitución: algo que
  // aparece donde tú estabas y una nota que se aleja — el cazador se va detrás de otro.
  for (const e of (ev.pdecoy || [])){ const t = T(e.f);
    add(t, 0.12, 900, 240, 0.32, 0.30, 5);                        // el pluf del señuelo apareciendo
    [659, 523, 392].forEach((nf, i) =>                            // la nota SE ALEJA (baja): «ya no vienen a por mí»
      note(t + 0.05 + i * 0.07, 0.22, nf, 0.17 - i * 0.03, { wave: 'tri', decay: 5 }));
    add(t + 0.05, 0.30, 2200, 3000, 0.13, 0.09, 5);               // brillo (es un momentazo, no un roce)
  }
  for (const e of (ev.swap || [])){ add(T(e.f), 0.15, 950, 320, 0.18); add(T(e.f) + 0.09, 0.10, 1500, 1500, 0.13); }
  // INVERT (giro DRAMÁTICO: marca a otro equipo, raro ~1 cada 15s): whoosh grave→agudo + nota de tensión.
  for (const e of (ev.invert || [])){ const t = T(e.f); fx.whoosh(t, { f0: 240, f1: 1100, amp: 0.26, dur: 0.26, noise: 0.12 }); note(t + 0.14, 0.22, 392, 0.18, { wave: 'tri', decay: 4, vib: 0.06 }); }
  // EMPUJÓN (un rival tira a otro a la boca del cazador en la ventana de captura): golpe seco grave.
  for (const e of (ev.bump || [])){ add(T(e.f), 0.11, 190, 80, 0.26, 0.3); }
  // CAÍDA (la presa es ARRASTRADA hacia el cazador, mismo frame que eliminations): "gulp" grave que cae = el tirón.
  for (const e of (ev.falling || [])){ add(T(e.f), 0.18, 150, 55, 0.30, 0.6, 3.2); }
  // ELIMINACIÓN = la CAZA (la bola es DEVORADA): CHOMP jugoso + gritito + jingle CARACTERÍSTICO de "fuera". Lo más
  // prominente del modo (eran 11 MUERTES mudas en la ablación: sonaban por 'falling', ahora suena la muerte misma).
  for (const e of (ev.eliminations || [])){ const t = T(e.f); fx.chomp(t, 0.42); fx.scream(t + 0.01, 0.22); fx.deathJingle(t + 0.10, 0.42); }
  // SALVADA por los pelos (near-miss): pip ascendente corto = "uf".
  for (const e of (ev.save || [])){ add(T(e.f), 0.09, 520, 760, 0.12); }
  // FRENESÍ (quedan ≤6 / ≤3 bolas → el cazador se enfurece): RUGIDO grave ascendente + sub menor.
  for (const e of (ev.frenzy || [])){ add(T(e.f), 0.6, 90, 150, 0.34, 0.5, 1.8); note(T(e.f), 0.55, 110, 0.10, { wave: 'tri', decay: 1.6 }); }
  if (decision_frame !== null && decision_frame !== undefined) jingleWin(T(decision_frame));   // FANFARRIA musical de victoria

  return buf;
}
