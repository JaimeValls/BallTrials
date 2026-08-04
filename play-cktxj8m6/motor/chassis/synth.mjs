// YouBall · NÚCLEO de síntesis de audio, PURO (sin Node) → reutilizable en NAVEGADOR y en Node.
// Extraído de chassis/audio.mjs para que el preview en vivo pueda generar EXACTAMENTE el mismo buffer que el
// render (mismo makeRng/createSynth) sin arrastrar node:fs. chassis/audio.mjs lo re-exporta para Node, así que
// los audio.mjs existentes ("import { createSynth, makeRng } from '../chassis/audio.mjs?v=3c100d3'") siguen funcionando.
//   import { createSynth, makeRng } from '../chassis/synth.mjs?v=3c100d3';

export function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function makeRng(seed){ return mulberry32((seed >>> 0) || 1); }   // RNG seedeado → ruido determinista (WAV reproducible)

// Crea add()/note()/jingleWin() ligados a un buffer concreto. Mismas firmas que los add/note locales.
export function createSynth({ SR, N, buf, rng }){
  const rnd = rng || Math.random;
  // sweep de frecuencia + ruido opcional + envolvente attack/decay (idéntico a los add() locales)
  function add(tSec, durSec, f0, f1, amp, noiseMix = 0, decay = 4.5){
    const start = Math.floor(tSec * SR), n = Math.floor(durSec * SR); let ph = 0;
    for (let i = 0; i < n; i++){ const idx = start + i; if (idx < 0 || idx >= N) continue;
      const tt = i / n, f = f0 + (f1 - f0) * tt; ph += 2 * Math.PI * f / SR;
      const s = Math.sin(ph) * (1 - noiseMix) + (rnd() * 2 - 1) * noiseMix;
      buf[idx] += s * (tt < 0.015 ? tt / 0.015 : 1) * Math.exp(-tt * decay) * amp; }
  }
  // nota MUSICAL con timbre de videojuego (pulse/tri/sine) + vibrato leve (idéntica a suelo/recolecta)
  function note(tSec, durSec, freq, amp, { wave = 'pulse', duty = 0.5, decay = 4, vib = 0 } = {}){
    const start = Math.floor(tSec * SR), n = Math.floor(durSec * SR); let ph = 0;
    for (let i = 0; i < n; i++){ const idx = start + i; if (idx < 0 || idx >= N) continue;
      const tt = i / n;
      const f = freq * (1 + vib * Math.sin(2 * Math.PI * 5.5 * i / SR));
      ph += f / SR; const frac = ph - Math.floor(ph);
      let s;
      if (wave === 'tri') s = 4 * Math.abs(frac - 0.5) - 1;
      else if (wave === 'sine') s = Math.sin(2 * Math.PI * frac);
      else s = 0.7 * (frac < duty ? 1 : -1) + 0.3 * Math.sin(2 * Math.PI * frac);
      buf[idx] += s * (tt < 0.04 ? tt / 0.04 : Math.exp(-tt * decay)) * amp; }
  }
  // FANFARRIA DE VICTORIA "2ª prueba": arpegio staccato ascendente + ACORDE mayor resonante + chispa (satisfactoria)
  function jingleWin(vt, { minor = false } = {}){
    const arp = minor ? [523, 622, 784, 1047, 1245] : [523, 659, 784, 1047, 1319];
    arp.forEach((f, i) => note(vt + i * 0.12, 0.11, f, 0.22, { wave: 'pulse', duty: 0.5, decay: 7 }));
    const ct = vt + 5 * 0.12 + 0.05;
    const chord = minor ? [220, 1047, 1245, 1568] : [262, 1047, 1319, 1568];
    chord.forEach((f, i) => note(ct, 1.15, f, i === 0 ? 0.14 : 0.17, { wave: 'tri', decay: 1.7 }));
    note(ct, 1.15, 2093, 0.07, { wave: 'sine', decay: 1.5, vib: 0.004 });
  }
  return { add, note, jingleWin };
}

// Gain de normalización a pico 0.9 (idéntico al de writeWavStereo). Para que el buffer del navegador suene IGUAL
// que el WAV del render. Devuelve 1 si el pico ya es ≤ 0.9 (caso de todos los modos actuales).
export function peakGain(buf){
  let peak = 0; for (let i = 0; i < buf.length; i++){ const a = Math.abs(buf[i]); if (a > peak) peak = a; }
  return { peak, gain: peak > 0.9 ? 0.9 / peak : 1 };
}
