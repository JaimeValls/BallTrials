// YouBall · MAPEO eventos→buffer de audio de RED LIGHT RUSH, browser-safe (sin Node). Mismo patrón que
// gauntlet/sfxmap.mjs: por cada evento de la sim coloca su SFX en un Float32Array. Determinista (mismo seed →
// mismo WAV). Lo usa el preview en vivo (index.html → Web Audio); cuando exista el render Node reusará esto igual.
//   import { buildSfxBuffer } from './sfxmap.mjs?v=0a52a34';
//   const buf = buildSfxBuffer({ events, decision_frame, f, seed, SR });   // Float32Array mono (sin normalizar)
//
// Los SFX van por el canal de EFECTOS (no el de música). v7.3: la música ya NO se calla en rojo; en su lugar
// suena una ALARMA (klaxon) al ponerse rojo (ver fase 'red' abajo) que marca el "¡ALTO!" por encima de la música.
import { createSynth, makeRng } from '../chassis/synth.mjs?v=0a52a34';
import { createFx } from '../chassis/sfx.mjs?v=0a52a34';
import { FPS } from './sim.js?v=0a52a34';

const WARN_F = 18;   // igual que en sim/render: el aviso ámbar dura 0.6 s antes del rojo

// events = acumulados por accumulateEvents. Claves array: kill (e.cause 'semaforo'|'losa'|'apisonadora'|
// 'boulder'|'muro'), save (e.cause 'semaforo'|'losa'), cross (e.rank), phase (e.color 'green'|'red'), scan, wall
// (e.type 'start'|'accel'). f = frame final. decision_frame = victoria.
// noJingle: la capa de mezcla va a poner la fanfarria REAL (wav) encima → no sintetizar la de jingleWin
export function buildSfxBuffer({ events, decision_frame, resolved_by, f, seed, SR = 44100, noJingle = false }){
  const ev = events || {};
  const dur = f / FPS + 0.6, N = Math.ceil(dur * SR);
  const buf = new Float32Array(N);
  const T = fr => fr / FPS;
  const rng = makeRng(seed);
  const { add, note, jingleWin } = createSynth({ SR, N, buf, rng });
  const fx = createFx({ add, note });

  // ---- SEMÁFORO: aviso ámbar antes del ROJO + ALARMA de peligro al ponerse ROJO + LATIDOS mientras están
  //      parados + nota "ya" al volver a VERDE. La música ya NO se calla (v7.3); esto lo lleva TODO el canal SFX. ----
  const phases = ev.phase || [];
  for (let pi = 0; pi < phases.length; pi++){ const p = phases[pi];
    if (p.color === 'red'){
      const t0 = T(p.f), redEnd = (pi + 1 < phases.length) ? phases[pi + 1].f : f;
      // aviso ámbar: tono que sube durante los 18 f previos (anticipa el corte)
      add(t0 - WARN_F / FPS, WARN_F / FPS, 460, 1000, 0.10, 0, 1.6);
      // ALARMA DE PELIGRO (v7.4, rediseño): NO es un blip como el resto — es una SIRENA que ONDULA (sube-baja ×2),
      // con una capa DISONANTE (tritono) sostenida y un SUB-BASS de pavor. Textura única en el modo → se lee como
      // "¡ALERTA/MIEDO!", no como un efecto más. Fuerte, por encima de la música.
      add(t0,        0.22, 360, 860, 0.30, 0.10, 0.8);   // sirena: sube
      add(t0 + 0.22, 0.22, 860, 360, 0.30, 0.10, 0.8);   // baja
      add(t0 + 0.44, 0.22, 360, 860, 0.28, 0.10, 0.8);   // sube
      add(t0 + 0.66, 0.26, 860, 300, 0.28, 0.10, 0.9);   // baja (cola)
      add(t0, 0.95, 466, 466, 0.11, 0.02, 0.7);          // disonancia sostenida (tritono con ↓)
      add(t0, 0.95, 659, 659, 0.11, 0.02, 0.7);
      add(t0, 0.70,  58,  44, 0.22, 0.12, 1.0);          // SUB-BASS de pavor ("oh no")
      // LATIDOS de corazón mientras están parados en rojo (dread) hasta que vuelve el verde: lub-dub grave repetido
      for (let tb = t0 + 0.9; tb < T(redEnd) - 0.1; tb += 0.78){
        add(tb,        0.10, 85, 40, 0.24, 0.05, 9);     // "lub"
        add(tb + 0.17, 0.09, 70, 36, 0.15, 0.05, 10);    // "dub" (más suave)
      }
    } else {
      // vuelta a VERDE: nota ascendente alegre = "¡ya podéis!"
      note(T(p.f), 0.10, 784, 0.16, { wave: 'pulse', duty: 0.5, decay: 7 });
      note(T(p.f) + 0.07, 0.14, 1175, 0.15, { wave: 'tri', decay: 6 });
    }
  }

  // ---- RAYO DE ESCANEO: el farol detecta a una bola moviéndose de más (primer aviso) ----
  for (const s of (ev.scan || [])){ const t = T(s.f);
    add(t, 0.10, 1800, 900, 0.12, 0.15, 7);                                       // "bip" de detección
  }
  // ---- MIRILLA APUNTANDO: pitido de fijado que SUBE mientras apunta (0.6s hasta el disparo) ----
  for (const tg of (ev.target || [])){ const t = T(tg.f);
    add(t, 0.55, 700, 1500, 0.10, 0, 1.4);                                        // tono de "lock-on" ascendente
    note(t, 0.09, 1568, 0.10, { wave: 'pulse', duty: 0.3, decay: 8 });            // bip agudo inicial
  }

  // ---- ELIMINACIÓN: la bola REVIENTA (pop compartido) + sabor por causa + gritillo cómico ----
  for (const k of (ev.kill || [])){ const t = T(k.f);
    fx.pop(t, 0.42);                                                              // ¡el estallido de la bola!
    if (k.cause === 'semaforo'){                                                  // pillada moviéndose: ¡DISPARO del francotirador!
      add(t, 0.03, 2600, 400, 0.42, 0.6, 14);                                     // CRACK seco del disparo (gunshot)
      add(t + 0.005, 0.16, 900, 90, 0.30, 0.3, 4);                                // cuerpo/eco del tiro
      note(t + 0.02, 0.12, 98, 0.22, { wave: 'tri', decay: 4 });                  // golpe grave (impacto)
    } else if (k.cause === 'losa'){                                               // pincho de la losa de presión
      add(t, 0.06, 2400, 1400, 0.22, 0.5, 10);                                    // "shnk" del pincho al salir
      fx.clang(t, 0.24);                                                          // clic/clang metálico
    } else if (k.cause === 'boulder'){                                            // arrollada por la piedra rodante
      fx.impact(t, 'hard', 0.6); add(t, 0.3, 90, 55, 0.26, 0.5, 1.8);             // golpe + rumor grave de piedra
    } else if (k.cause === 'eliminated'){                                         // perdedora que explota al decidirse
      add(t, 0.14, 260, 90, 0.20, 0.4, 4);                                        // "pum" seco (sin sabor de trampa)
    }
    fx.scream(t + 0.02, 0.18);                                                    // ¡gritillo! cómico
  }

  // ---- NEAR-MISS ("uy, por poco"): escaneo que no confirma / losa que se desarma a tiempo ----
  for (const s of (ev.save || [])){ const t = T(s.f);
    add(t, 0.10, 900, 560, 0.11, 0.05, 5);                                        // "uf" suave descendente
    note(t + 0.03, 0.10, 660, 0.09, { wave: 'tri', decay: 6 });
  }

  // ---- META: ding ascendente por orden de llegada (cada bola que cruza suena un poco más aguda) ----
  for (const c of (ev.cross || [])){ fx.arriveDing(T(c.f), Math.max(0, (c.rank || 1) - 1), 0.5); }

  // ---- BARRERA ROMPIBLE: golpes secos al embestir (throttleados para no zumbar) + ESTALLIDO al reventarse ----
  let lastBash = -99;
  for (const bz of (ev.barrier || [])){ const t = T(bz.f);
    if (bz.broken){ fx.explosion(t, 0.42); fx.shatter(t + 0.01, 0.5); }            // ¡CRASH! + astillas
    else if (bz.f - lastBash >= 5){ lastBash = bz.f;                               // "tunk" de embestida (cada ~5 f)
      add(t, 0.09, 190, 80, 0.20 + 0.02 * Math.min(4, bz.bashers || 1), 0.35, 5); }
  }

  // ---- CIERRE (en el frame de decisión) ----
  // EMBUDO (torneo, resolved_by 'funnel'*): la ronda se CIERRA al llenarse el cupo (survTarget asegurados). Sting
  // DISTINTIVO de "ROUND OVER" — un GONG/CAMPANA brillante de cola larga + acorde mayor que resuelve. Textura PROPIA
  // (parciales inarmónicos de campana + cuerpo grave), sin los timbres del francotirador (CRACK) ni de la mina
  // (shnk/clang) → se lee como "se acabó la ronda", no como una muerte. Justo despues cae el fusilamiento escalonado.
  // Sin resolved_by (llamadas antiguas) o victoria por equipos (standalone) → fanfarria de victoria como siempre.
  if (decision_frame !== null && decision_frame !== undefined){
    const dt = T(decision_frame);
    if (resolved_by && String(resolved_by).startsWith('funnel')){
      add(dt,        1.5, 1320, 1300, 0.24, 0.05, 1.1);   // parcial agudo de campana (cola larga, casi sin sweep)
      add(dt,        1.7,  660,  656, 0.20, 0.03, 0.9);   // fundamental de la campana
      add(dt,        1.9,  990,  986, 0.14, 0.03, 0.8);   // parcial (5ª) → brillo metálico de campana
      add(dt,        1.2,  132,  120, 0.22, 0.06, 1.4);   // cuerpo grave del golpe (el "gong")
      // acorde mayor que RESUELVE justo despues (cierre "oddly satisfying")
      note(dt + 0.03, 0.95, 523, 0.16, { wave: 'sine', decay: 1.6 });
      note(dt + 0.03, 0.95, 659, 0.15, { wave: 'sine', decay: 1.6 });
      note(dt + 0.03, 0.95, 784, 0.15, { wave: 'sine', decay: 1.6 });
    } else if (!noJingle) jingleWin(dt);   // fanfarria SINTETIZADA (fallback: sin wav de fanfarria disponible)
  }

  return buf;
}
