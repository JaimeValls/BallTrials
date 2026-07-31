// YouBall · reproductor Web Audio para el PREVIEW EN VIVO (solo navegador). Toca EL MISMO buffer de SFX que el
// render (generado por <modo>/sfxmap.mjs) + la música del modo por debajo, arrancados a la vez que la partida.
// Ambos son deterministas a 30 FPS → van sincronizados. NO toca el camino de render (audio.mjs→WAV sigue igual).
//   import { createWebAudio } from '../chassis/webaudio.mjs';
//   const audio = createWebAudio({ musicUrl: '/_music/race.wav' });
//   btn.onclick = async () => { await audio.unlock(); restart(); };   // gesto del usuario
//   // al (re)arrancar la partida en f=0:  audio.start(sfxFloat32, SR);
import { peakGain } from './synth.mjs';

//+AG PLAYLIST POR MODO (doc 14 §1: varias canciones por contexto, elegidas al azar). Se tira el dado UNA vez, al
//   cargar la página, no por ronda: cada partida abre un iframe nuevo → página nueva → tirada nueva, así que "una
//   canción distinta cada vez que juegas" sale solo. Y como se elige ANTES del prefetch, solo se descarga la pista
//   que toca: la playlist engorda el deploy, nunca los megas que baja el jugador.
//   Esto vive en el navegador y no toca la física ni el camino de render del vídeo (ver cabecera de arriba).
//   ?track=N fuerza una pista concreta (0 = la primera): sirve para escucharlas a mano sin jugar a la ruleta.
export function pickTrack(tracks){
  if (!tracks || !tracks.length) return null;
  let forced = null;
  try { forced = new URLSearchParams(location.search).get('track'); } catch {}
  if (forced !== null && forced !== '' && Number.isFinite(+forced)) return tracks[((+forced % tracks.length) + tracks.length) % tracks.length];
  return tracks[Math.floor(Math.random() * tracks.length)];
}

//+AG musicLoopTrim (segundos, 0 = apagado): un mp3 trae PADDING de codificación al principio y al final, así que
//   un loop crudo mete un hueco audible en cada vuelta. Con trim>0 el bucle se cierra por dentro del padding y no
//   se oye la costura. Por defecto 0: los 3 modos siguen byte-idénticos, esto lo pide quien lo necesita (el shell,
//   cuya pista de lobby da vueltas sin parar mientras navegas por los menús).
export function createWebAudio({ musicUrl = null, musicGain = 0.30, sfxGain = 0.92, musicLoopTrim = 0 } = {}){
  let ctx = null, masterSfx = null, masterMusic = null;
  let sfxSrc = null, musicSrc = null, musicBuf = null;
  let unlocked = false, loadingMusic = null, musicWanted = false;

  //+AG plataforma-y-cuentas: al volver de segundo plano (cambiar de app, bloquear
  //   pantalla, una llamada) iOS/Android SUSPENDEN el AudioContext por su cuenta y
  //   NO lo reanudan solos. Sin esto el juego se queda mudo el resto de la partida
  //   aunque music/sfx sigan en ON. Solo actua si ya hubo un gesto (unlocked): no
  //   tiene sentido reanudar un contexto que el jugador nunca desbloqueo.
  if (typeof document !== 'undefined' && document.addEventListener){
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && unlocked && ctx && ctx.state === 'suspended'){
        try { ctx.resume(); } catch {}
      }
    });
  }

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

  //+AG CAMBIAR DE PISTA SIN CAMBIAR DE REPRODUCTOR (lo pide el shell: menús → Resultados → menús). Se descarta el
  //   buffer viejo y se pide el nuevo; NO para lo que esté sonando ni lo arranca — de eso manda quien llama, que
  //   es el único que sabe si en ese momento debe oírse algo. Un segundo createWebAudio sería un segundo
  //   AudioContext, y en iOS/Safari eso es justo lo que no conviene tener suelto.
  function setMusicUrl(url){
    if (url === musicUrl) return false;
    musicUrl = url; musicBuf = null; loadingMusic = null;
    if (ctx) prefetch();          // sin ctx todavía no hay nada que precargar: ya lo hará el prefetch() de siempre
    return true;
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

  //+AG DESPERTAR SIN GESTO (fallo real, Jaime 2026-07-31: "muchas veces la partida empieza sin música: sale el
  //   3-2-1 y no hay nada, queda muy frío"). El iframe de la partida lleva allow="autoplay" (juego.html →
  //   openFrame), o sea que el permiso de sonido que el jugador YA dio en el shell al pulsar JUGAR está delegado
  //   dentro de la partida. Hasta hoy no se usaba: el motor esperaba un gesto PROPIO, así que quien dejaba que el
  //   cartel de "¡LISTO!" se auto-arrancara jugaba la cuenta atrás muda —sin música y sin beeps— hasta su primer
  //   toque de juego.
  //   LA DIFERENCIA CON resume(): resume() marca unlocked ANTES de saber el resultado, a propósito (el cartel no
  //   puede esperar). Aquí es al revés y es lo importante: solo se da por desbloqueado si el AudioContext queda de
  //   VERDAD en 'running'. Donde el navegador lo rechace (Safari/iOS es el caso típico) devuelve false sin mentir y
  //   sigue mandando el gesto de siempre — un unlocked falso dejaría al motor programando sonido que no sale.
  //   EL TIMEOUT NO ES COSMÉTICO: cuando Chrome bloquea el autoplay, ctx.resume() no rechaza — se queda PENDIENTE
  //   hasta que haya un gesto. Sin la carrera contra el reloj esta promesa no volvería nunca.
  async function tryAutoplay(ms = 400){
    ensureCtx();
    if (unlocked) return true;
    if (musicUrl && !musicBuf && !loadingMusic) loadingMusic = loadMusic(musicUrl);
    try { await Promise.race([ ctx.resume(), new Promise(r => setTimeout(r, ms)) ]); } catch {}
    if (ctx.state !== 'running') return false;
    unlocked = true;
    return true;
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
    musicWanted = false;   // un stop() cancela también la música que venía en camino (ver musicWanted abajo)
  }

  // suelta el bucle de música en el instante `at`. Devuelve false si todavía no hay buffer decodificado.
  function playMusic(at){
    if (!musicBuf || !ctx) return false;
    musicSrc = ctx.createBufferSource(); musicSrc.buffer = musicBuf; musicSrc.loop = true;
    //+AG loop sin costura (ver musicLoopTrim arriba). Se protege de una pista más corta que el propio recorte:
    //   con loopEnd <= loopStart el navegador ignora el bucle y la música se pararía a la primera vuelta.
    if (musicLoopTrim > 0 && musicBuf.duration > musicLoopTrim * 3){
      musicSrc.loopStart = musicLoopTrim * 0.4;
      musicSrc.loopEnd   = musicBuf.duration - musicLoopTrim;
    }
    musicSrc.connect(masterMusic); musicSrc.start(at);
    return true;
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
    //+AG LA MÚSICA QUE LLEGA TARDE YA NO SE PIERDE (fallo real, Jaime 2026-07-27: "en el Cazador no hay música").
    //   Antes esto era un `if (musicBuf)` seco: si en el instante del arranque el mp3 no estaba decodificado, la
    //   ronda ENTERA se jugaba muda y nadie volvía a intentarlo. Y el Cazador es justo el que más papeletas
    //   tiene: sus pistas (platform/platform2, 3 min) pesan 2,9 MB, el doble que las de la Carrera, así que en
    //   un móvil con red normal la descarga puede acabar DESPUÉS de la cuenta atrás. Ahora se apunta la
    //   intención (musicWanted) y la música entra en cuanto el buffer llega. stop() la cancela.
    musicWanted = true;
    if (!playMusic(t0) && musicUrl){
      const p = loadingMusic || (loadingMusic = loadMusic(musicUrl));
      p.then(() => { if (musicWanted && !musicSrc) playMusic(ctx.currentTime + 0.04); });
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
    unlock, resume, tryAutoplay, prefetch, start, stop, loadMusic, setMusicUrl, setMusicGain, musicGain,
    get unlocked(){ return unlocked; },
    get hasMusic(){ return !!musicBuf; },
    //+AG "¿ya está sonando (o a punto de sonar) la música?". Lo usan los motores para que el "¡YA!" NO reinicie
    //   la pista que entró con la cuenta atrás. musicWanted cuenta: la música pedida y aún sin decodificar ya
    //   está reservada, y un segundo start() la duplicaría al llegar el buffer.
    get musicPlaying(){ return !!musicSrc || musicWanted; },
    get ctx(){ return ctx; },
    get musicLevel(){ return masterMusic ? masterMusic.gain.value : 0; },   // nivel vivo (debug)
  };
}
