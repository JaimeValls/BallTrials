// YouBall · reproductor Web Audio para el PREVIEW EN VIVO (solo navegador). Toca EL MISMO buffer de SFX que el
// render (generado por <modo>/sfxmap.mjs) + la música del modo por debajo, arrancados a la vez que la partida.
// Ambos son deterministas a 30 FPS → van sincronizados. NO toca el camino de render (audio.mjs→WAV sigue igual).
//   import { createWebAudio } from '../chassis/webaudio.mjs';
//   const audio = createWebAudio({ musicUrl: '/_music/race.wav' });
//   btn.onclick = async () => { await audio.unlock(); restart(); };   // gesto del usuario
//   // al (re)arrancar la partida en f=0:  audio.start(sfxFloat32, SR);
import { peakGain } from './synth.mjs';

export function createWebAudio({ musicUrl = null, musicGain = 0.30, sfxGain = 0.92 } = {}){
  let ctx = null, masterSfx = null, masterMusic = null;
  let sfxSrc = null, musicSrc = null, musicBuf = null;
  let unlocked = false, loadingMusic = null;

  function ensureCtx(){
    if (!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterSfx = ctx.createGain(); masterSfx.gain.value = sfxGain; masterSfx.connect(ctx.destination);
      masterMusic = ctx.createGain(); masterMusic.gain.value = musicGain; masterMusic.connect(ctx.destination);
    }
    return ctx;
  }

  async function loadMusic(url){
    if (!url) return null;
    try {
      const r = await fetch(url); if (!r.ok) return null;
      const arr = await r.arrayBuffer();
      musicBuf = await ensureCtx().decodeAudioData(arr);
      return musicBuf;
    } catch (e){ console.warn('música no disponible:', e?.message || e); return null; }
  }

  // gesto del usuario: crea/reanuda el AudioContext y carga la música (espera al decode → el 1er play ya la lleva).
  async function unlock(){
    ensureCtx();
    if (ctx.state === 'suspended'){ try { await ctx.resume(); } catch {} }
    unlocked = true;
    if (musicUrl && !musicBuf && !loadingMusic) loadingMusic = loadMusic(musicUrl);
    if (loadingMusic) await loadingMusic;
    return unlocked;
  }

  function stop(){
    if (sfxSrc){ try { sfxSrc.stop(); } catch {} sfxSrc = null; }
    if (musicSrc){ try { musicSrc.stop(); } catch {} musicSrc = null; }
  }

  // arranca AHORA el buffer de SFX (Float32 mono) + la música (en loop por debajo), alineados al mismo instante.
  // Normaliza el SFX a pico 0.9 igual que writeWavStereo → suena idéntico al WAV del render.
  function start(sfxFloat, SR){
    if (!unlocked || !ctx) return;
    stop();
    const t0 = ctx.currentTime + 0.04;   // pequeño margen común para alinear SFX + música
    if (sfxFloat && sfxFloat.length){
      const { gain } = peakGain(sfxFloat);
      const ab = ctx.createBuffer(1, sfxFloat.length, SR);
      const ch = ab.getChannelData(0);
      if (gain === 1) ch.set(sfxFloat); else for (let i = 0; i < sfxFloat.length; i++) ch[i] = sfxFloat[i] * gain;
      sfxSrc = ctx.createBufferSource(); sfxSrc.buffer = ab; sfxSrc.connect(masterSfx); sfxSrc.start(t0);
    }
    if (musicBuf){
      musicSrc = ctx.createBufferSource(); musicSrc.buffer = musicBuf; musicSrc.loop = true;
      musicSrc.connect(masterMusic); musicSrc.start(t0);
    }
  }

  // ajusta el volumen de la MÚSICA con una rampa suave (sin tocar los SFX). Lo usa Red Light Rush para "apagar"
  // la música en ROJO y devolverla en VERDE (el sello del modo: se avanza solo mientras suena). ramp en segundos.
  function setMusicGain(v, ramp = 0.12){
    if (!masterMusic || !ctx) return;
    const g = masterMusic.gain; const now = ctx.currentTime;
    try { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(Math.max(0, v), now + ramp); }
    catch { g.value = Math.max(0, v); }
  }

  return {
    unlock, start, stop, loadMusic, setMusicGain, musicGain,
    get unlocked(){ return unlocked; },
    get hasMusic(){ return !!musicBuf; },
    get ctx(){ return ctx; },
    get musicLevel(){ return masterMusic ? masterMusic.gain.value : 0; },   // nivel vivo (debug)
  };
}
