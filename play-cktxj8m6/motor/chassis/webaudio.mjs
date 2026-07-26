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

  //+AG PREFETCH sin gesto: crear el AudioContext y DECODIFICAR la música no requieren interacción (el contexto
  //   nace 'suspended' y ahí se queda). Se llama al cargar la página para que en el "¡YA!" la música ya esté
  //   decodificada: son pistas de 1,5–3 MB y en móvil el decode no cabe en los ~4 s de la cuenta atrás.
  function prefetch(){
    ensureCtx();
    if (musicUrl && !musicBuf && !loadingMusic) loadingMusic = loadMusic(musicUrl);
    return loadingMusic;
  }

  //+AG CAMINO CORTO del gesto: solo reanuda el AudioContext, sin esperar al decode de la música. Lo usa el cartel
  //   de "¡LISTO!" (chassis/arranque.mjs) porque su beep de confirmación tiene que sonar EN EL MISMO TAP: si
  //   esperase a la música (megas de mp3) el jugador tocaría y no oiría nada, que es justo lo que veníamos a arreglar.
  async function resume(){
    ensureCtx();
    //+AG unlocked se marca ANTES del await, a propósito: el cartel de "¡LISTO!" no espera esta promesa (hay
    //   navegadores donde ctx.resume() se queda pendiente para siempre si no le gusta el gesto, y el juego JAMÁS
    //   puede quedarse sin arrancar por el audio). Lo que se programe mientras siga 'suspended' suena al reanudar.
    unlocked = true;
    if (musicUrl && !musicBuf && !loadingMusic) loadingMusic = loadMusic(musicUrl);
    if (ctx.state === 'suspended'){ try { await ctx.resume(); } catch {} }
    return unlocked;
  }

  // gesto del usuario: crea/reanuda el AudioContext y carga la música (espera al decode → el 1er play ya la lleva).
  async function unlock(){
    await resume();
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
    unlock, resume, prefetch, start, stop, loadMusic, setMusicGain, musicGain,
    get unlocked(){ return unlocked; },
    get hasMusic(){ return !!musicBuf; },
    get ctx(){ return ctx; },
    get musicLevel(){ return masterMusic ? masterMusic.gain.value : 0; },   // nivel vivo (debug)
  };
}
