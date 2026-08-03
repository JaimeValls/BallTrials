// YouBall · LIBRERÍA SEMÁNTICA de efectos compartidos (el "vocabulario" de sonido del canal). Construida sobre
// createSynth (add/note) de chassis/audio.mjs → byte-determinista (mismo rng). Da efectos CON NOMBRE para que
// todos los modos suenen coherentes y NINGUNA situación quede muda: reventón, grito, impacto, whoosh, chispa,
// explosión, metálico, ding de llegada. El "director de audio" (agente) audita qué evento de cada modo usa cuál.
//   import { createFx } from '../chassis/sfx.mjs?v=042f69e';
//   const synth = createSynth({SR,N,buf,rng}); const fx = createFx(synth);
// NOTA: el audio es RENDER (no sim) → aquí SÍ valen Math.pow/etc. Las amplitudes son orientativas (amp≈volumen).
export function createFx({ add, note }){
  // POP / reventón de bola: caída de tono REDONDA + chispita corta + tono musical. Jugoso, poco ruido = satisfactorio.
  function pop(t, amp = 0.5){
    add(t, 0.13, 880, 190, amp * 0.60, 0.06, 7);                   // "bup" que cae
    add(t, 0.035, 1900, 950, amp * 0.22, 0.12, 11);                // chispita de ataque
    note(t + 0.01, 0.17, 523, amp * 0.34, { wave: 'sine', decay: 8 });  // redondez musical
  }
  // GRITO / yelp de dibujos: "wee-oo" que SUBE y BAJA, tono LIMPIO (casi sin ruido) = simpático, no chirriante.
  function scream(t, amp = 0.4){
    add(t, 0.09, 520, 1080, amp * 0.45, 0.02, 6);                  // sube
    add(t + 0.085, 0.20, 1080, 340, amp * 0.50, 0.02, 4);          // baja (cae)
    note(t + 0.02, 0.20, 840, amp * 0.34, { wave: 'tri', decay: 5, vib: 0.05 });  // carácter vocal cálido
  }
  // IMPACTO/golpe por niveles (soft/med/hard): el "toc/tunk/tonk" de chocar.
  function impact(t, level = 'med', amp = 0.5){
    const L = { soft: [0.06, 200, 130, 0.5], med: [0.11, 210, 80, 0.85], hard: [0.18, 260, 55, 1.0] }[level] || [0.11, 210, 80, 0.85];
    add(t, L[0], L[1], L[2], amp * L[3], 0.4, 4.5);
  }
  // WHOOSH: swish de aire (configurable). Para saltos, dashes, trofeo que vuela, trampolín.
  function whoosh(t, { f0 = 300, f1 = 900, amp = 0.4, dur = 0.22, noise = 0.3 } = {}){ add(t, dur, f0, f1, amp, noise, 2.4); }
  // ZIP / ráfaga de VELOCIDAD: el "voom" del buff de velocidad = HERMANO sonoro de la estela CIAN (chassis/gfx.mjs P.trail).
  // Sube de tono rápido (acelerón) + glaseado agudo brillante. PUNTUAL: dispáralo al ACTIVAR el buff (coger turbo/booster,
  // pisar el pad de boost), NUNCA por frame. Coherente entre modos (carrera, tobogán…) para que "voy rápido" suene igual.
  function zip(t, amp = 0.4){
    add(t, 0.14, 360, 1500, amp * 0.55, 0.10, 6);                  // acelerón ascendente (whoosh con cuerpo)
    add(t + 0.02, 0.10, 1700, 2600, amp * 0.22, 0.05, 9);         // glaseado agudo (el "brillo" cian)
  }
  // BOMB FALL / silbido de amenaza que CAE: telégrafo de la bomba de magma del cielo. Whoosh DESCENDENTE largo con cola de
  // ruido (aire desplazado) → avisa "algo gordo va a caer". Pensado para sonar SOLO mientras cae (1 por bomba, espaciado).
  function bombFall(t, { amp = 0.34, dur = 0.55 } = {}){
    add(t, dur, 1200, 240, amp * 0.55, 0.18, 1.6);                 // silbido que cae (pitch desciende)
    add(t, dur, 520, 120, amp * 0.40, 0.32, 1.4);                  // cuerpo grave del aire desplazado
  }
  // CHISPA / power-up: zip ascendente brillante + ding. Coger orbe/booster.
  function sparkle(t, amp = 0.4){ add(t, 0.10, 700, 1400, amp * 0.5, 0.1, 5); note(t + 0.06, 0.12, 1568, amp * 0.4, { wave: 'tri', decay: 5 }); }
  // EXPLOSIÓN: boom con sub + ruido + nota grave. Magma/onda expansiva.
  function explosion(t, amp = 0.6){ add(t, 0.28, 200, 55, amp, 0.55, 2.6); add(t, 0.12, 900, 240, amp * 0.5, 0.7, 6); note(t + 0.02, 0.30, 98, amp * 0.4, { wave: 'tri', decay: 3 }); }
  // METÁLICO: chirrido/clang (sierra, péndulo, choque metálico).
  function clang(t, amp = 0.5){ add(t, 0.16, 1500, 520, amp * 0.7, 0.45, 4); add(t, 0.10, 300, 120, amp * 0.5, 0.4, 5); }
  // DING de llegada ascendente por orden (k=0,1,2…): cada llegada suena un poco más aguda (satisfactorio).
  function arriveDing(t, k = 0, amp = 0.5){ const f = 784 * Math.pow(2, (k * 2) / 12); note(t, 0.16, f, amp * 0.6, { wave: 'pulse', duty: 0.5, decay: 6 }); note(t + 0.08, 0.20, f * 1.5, amp * 0.4, { wave: 'tri', decay: 5 }); }
  // DEATH JINGLE: motivo retro CARACTERÍSTICO de "fuera/eliminado" (estilo muerte de Mario): sube y cae con un
  // "bwomp" grave final. Limpio (chiptune), reconocible al instante. Para que sepas que una bola ha muerto.
  function deathJingle(t, amp = 0.5){
    const seq = [[0.00, 659], [0.09, 880], [0.20, 587], [0.30, 494], [0.42, 392]];   // E5 A5 D5 B4 G4
    seq.forEach(([dt, f]) => note(t + dt, 0.11, f, amp * 0.5, { wave: 'pulse', duty: 0.5, decay: 6 }));
    note(t + 0.42, 0.30, 196, amp * 0.34, { wave: 'tri', decay: 4 });                // G3 grave = el "se fue"
  }
  // CHOMP / mordisco: "ñam" jugoso = golpe grave que cae + crunch ruidoso CORTO + clic de ataque. Para la devoradora
  // comiendo baldosas, el cazador atrapando, cualquier "se lo comió". Diseñado para sonar bien EN RÁFAGA (ñam-ñam-ñam).
  function chomp(t, amp = 0.4){
    add(t, 0.10, 240, 70, amp * 0.6, 0.25, 6);                     // cuerpo grave que cae
    add(t + 0.005, 0.05, 1200, 380, amp * 0.30, 0.65, 9);          // crunch (ruido) del trozo que se rompe
    note(t + 0.01, 0.07, 130, amp * 0.28, { wave: 'tri', decay: 7 });  // peso/redondez del bocado
  }
  // MONSTER RISE: rugido grave que EMERGE (sube de tono) + estruendo de suelo roto. Bicho que sale de abajo.
  function monsterRise(t, amp = 0.5){
    add(t, 0.5, 55, 150, amp * 0.6, 0.45, 1.8);                    // growl que sube
    add(t, 0.18, 320, 90, amp * 0.4, 0.6, 3.5);                    // suelo que se RESQUEBRAJA al emerger
    note(t, 0.45, 82, amp * 0.24, { wave: 'tri', decay: 1.6 });    // sub musical (peso del bicho)
  }
  // MONSTER SINK: gluglú/rugido que BAJA (se hunde). Cierre del momento.
  function monsterSink(t, amp = 0.4){ add(t, 0.4, 150, 45, amp * 0.5, 0.4, 2.2); note(t, 0.3, 70, amp * 0.2, { wave: 'tri', decay: 2.2 }); }
  // SHATTER / rotura: estallido de cristal-hielo (barrera que se rompe): crack ruidoso + tintineo descendente brillante.
  // Satisfactorio y PUNTUAL (un hito), no carpet. Para la rotura de barreras de la Carrera.
  function shatter(t, amp = 0.5){
    add(t, 0.12, 900, 260, amp * 0.55, 0.5, 5);                    // CRACK (madera/cristal que cede)
    add(t, 0.07, 2200, 1300, amp * 0.30, 0.6, 8);                  // astillas agudas
    [1568, 1175, 880].forEach((f, i) => note(t + 0.04 + i * 0.05, 0.14, f, amp * 0.26, { wave: 'tri', decay: 6 }));  // tintineo que cae
  }
  return { pop, scream, impact, whoosh, zip, bombFall, sparkle, explosion, clang, arriveDing, deathJingle, chomp, monsterRise, monsterSink, shatter };
}
