// BallTrials · web oficial · AUDIO del fondo vivo (F3).
// Mudo por defecto; el botón 🔊 lo enciende (gesto del usuario). Dos capas:
//  - SFX: banco de one-shots HORNEADO con la MISMA síntesis del canal (chassis/synth.mjs +
//    chassis/sfx.mjs) → el vocabulario sonoro de los vídeos, disparado en tiempo real y con
//    THROTTLE (regla: throttlear, no silenciar; y nunca carpet de ruido).
//  - MÚSICA: versión "lobby" tranquila del tema del canal (assets/music/lobby.mp3, generada
//    de _music/intro.wav: atempo 0.9 + lowpass) en loop gapless, a volumen bajo.
// La preferencia se recuerda en localStorage ('bt-snd'); al volver, el primer gesto la reactiva.

import { createSynth, makeRng, peakGain } from './chassis/synth.mjs';
import { createFx } from './chassis/sfx.mjs';

const SR = 44100;
const MUSIC_URL = new URL('assets/music/lobby.mp3', import.meta.url).href;
const MUSIC_GAIN = 0.26, SFX_GAIN = 0.75;

let ctx = null, sfxBus = null, musicBus = null, musicSrc = null, musicBuf = null;
let enabled = false, loading = null, played = 0;
const bank = new Map();
const lastAt = new Map();          // throttle por efecto
let windowT = 0, windowN = 0;      // throttle global (máx 6 sonidos / 180 ms)

function bake(name, dur, build){
  const N = Math.ceil(dur * SR), buf = new Float32Array(N);
  const synth = createSynth({ SR, N, buf, rng: makeRng(163) });
  build(createFx(synth), synth);
  const { gain } = peakGain(buf);
  const ab = ctx.createBuffer(1, N, SR), ch = ab.getChannelData(0);
  for (let i = 0; i < N; i++) ch[i] = buf[i] * gain;
  bank.set(name, ab);
}

function bakeAll(){
  bake('tick', 0.24, fx => fx.impact(0, 'soft', 0.55));                  // peg / pared
  bake('thud', 0.32, fx => fx.impact(0, 'med', 0.55));                   // tarjeta / péndulo
  bake('pop', 0.45, fx => fx.pop(0, 0.45));                              // choque bola-bola fuerte
  bake('boing', 0.55, (fx, s) => {                                       // trampolín
    fx.whoosh(0, { f0: 170, f1: 780, amp: 0.5, dur: 0.24, noise: 0.12 });
    s.note(0.05, 0.30, 392, 0.30, { wave: 'tri', decay: 4, vib: 0.02 });
    s.note(0.11, 0.28, 523, 0.22, { wave: 'tri', decay: 4 });
  });
  bake('spawn', 0.5, fx => { fx.sparkle(0, 0.5); fx.pop(0.02, 0.26); }); // clic: nace bola
  bake('push', 0.3, fx => fx.whoosh(0, { f0: 540, f1: 240, amp: 0.45, dur: 0.20, noise: 0.35 })); // clic: empujón
}

async function loadMusic(){
  try {
    const r = await fetch(MUSIC_URL); if (!r.ok) return;
    musicBuf = await ctx.decodeAudioData(await r.arrayBuffer());
  } catch (e){ console.warn('lobby music no disponible:', e?.message || e); }
}

function startMusic(){
  if (!musicBuf || musicSrc) return;
  musicSrc = ctx.createBufferSource();
  musicSrc.buffer = musicBuf; musicSrc.loop = true;
  musicSrc.loopStart = 0.05; musicSrc.loopEnd = musicBuf.duration - 0.12;  // esquiva el padding del mp3 (loop sin hueco)
  musicSrc.connect(musicBus); musicSrc.start();
}

export async function enableAudio(){
  if (!ctx){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_GAIN; sfxBus.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_GAIN; musicBus.connect(ctx.destination);
    bakeAll();
    loading = loadMusic();
  }
  if (ctx.state === 'suspended'){ try { await ctx.resume(); } catch {} }
  if (loading){ await loading; loading = null; }
  startMusic();
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(MUSIC_GAIN, ctx.currentTime, 0.3);
  enabled = true;
  try { localStorage.setItem('bt-snd', '1'); } catch {}
}

export function disableAudio(){
  enabled = false;
  if (ctx && ctx.state === 'running') ctx.suspend();
  try { localStorage.setItem('bt-snd', '0'); } catch {}
}

export function audioEnabled(){ return enabled; }
export function audioPref(){ try { return localStorage.getItem('bt-snd') === '1'; } catch { return false; } }
export function audioStats(){ return { enabled, played, music: !!musicSrc }; }

// baja la música cuando un embed de YouTube empieza a sonar (no compite con el vídeo)
export function duckMusic(){
  if (ctx && musicBus) musicBus.gain.setTargetAtTime(0.02, ctx.currentTime, 0.4);
}

// dispara un efecto del banco con throttle (por nombre y global) y volumen 0..1
export function sfx(name, vol = 1){
  if (!enabled || !ctx || ctx.state !== 'running') return;
  const buf = bank.get(name); if (!buf) return;
  const now = ctx.currentTime;
  if (now - (lastAt.get(name) || -9) < 0.085) return;          // por efecto
  if (now - windowT > 0.18){ windowT = now; windowN = 0; }     // ventana global
  if (++windowN > 6) return;
  lastAt.set(name, now);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = Math.max(0.05, Math.min(1, vol));
  src.connect(g); g.connect(sfxBus);
  src.start();
  played++;
}
