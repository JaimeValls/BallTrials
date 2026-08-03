// YouBall · SONIDO DE LA INTERFAZ (el "clic" de los menús del shell).
//
// POR QUE EXISTE (VB Jaime 2026-07-27: "echo en falta los efectos de hacer clic en los botones, menú y tal, no
// oigo nada"): el juego solo sonaba DENTRO de la partida. Fuera de ella —portada, pestañas, Garaje, Tienda,
// Ajustes— tocabas y no pasaba nada: la mitad del juego era muda, y sin respuesta sonora un botón se siente
// muerto aunque se hunda al pulsarlo.
//
// SE SINTETIZA, no se descarga: mismos add/note de chassis/synth.mjs que usa el vídeo y la cuenta atrás
// (chassis/arranque.mjs), así que los menús suenan de la MISMA familia que la partida y no hay ni un byte más
// que bajarse. Copiado del patrón de arranque.mjs: buffer suelto + BufferSource por el AudioContext que ya
// tiene el shell (createWebAudio), sin tocar la música que está sonando por debajo.
//
// SON EFECTOS, no música: van con el interruptor de EFECTOS de Ajustes (el que llama pásalo en sfxOn).
//
//   import { createUiSfx } from './motor/chassis/uisfx.mjs?v=f4e19ee';
//   const ui = createUiSfx(audio, ()=>SAVE.settings.sfx!==false);
//   ui.tap();  ui.confirm();  ui.back();  ui.denied();
//
// REGLA DE VOLUMEN: un clic de menú se oye 200 veces por sesión, así que se queda DEBAJO de lo que hace la
// partida (amplitudes ~0.2 contra ~0.5 de los golpes del motor) y siempre por debajo de 90 ms. Tiene que
// confirmar el toque, no llamar la atención.
import { createSynth, makeRng, peakGain } from './synth.mjs?v=f4e19ee';

const SR = 44100;

export function createUiSfx(audio, sfxOn){
  let gain = null;
  const cache = new Map();          // el mismo clic suena cientos de veces: se sintetiza UNA y se reusa el buffer

  function mkBuf(dur){ const N = Math.floor(SR*dur); const buf = new Float32Array(N);
    return { buf, S: createSynth({ SR, N, buf, rng: makeRng(1) }) }; }

  //+AG el buffer se construye la PRIMERA vez que suena, no al cargar: son 4 sonidos de <0,4 s pero el arranque
  //   del juego no tiene por qué pagar ni eso, y la mayoría de sesiones no los usa todos.
  function buf(nombre, hacer){ let b = cache.get(nombre); if(!b){ b = hacer(); cache.set(nombre, b); } return b; }

  function play(b){
    if(!b || !audio || !audio.ctx) return;
    try{
      if(sfxOn && !sfxOn()) return;
      const ctx = audio.ctx;
      //+AG el nodo de salida se re-crea si cambia el contexto (igual que arranque.mjs). Va DIRECTO a destination
      //   y no por el gain de la música: subir o bajar la música en Ajustes no puede alterar los clics.
      if(!gain || gain.context !== ctx){ gain = ctx.createGain(); gain.gain.value = 0.9; gain.connect(ctx.destination); }
      const { gain:g } = peakGain(b);
      const ab = ctx.createBuffer(1, b.length, SR); const ch = ab.getChannelData(0);
      if(g === 1) ch.set(b); else for(let i=0;i<b.length;i++) ch[i] = b[i]*g;
      const src = ctx.createBufferSource(); src.buffer = ab; src.connect(gain); src.start();
    }catch(e){}   //+AG el audio NUNCA puede tumbar un toque de la interfaz: si falla, el botón sigue funcionando
  }

  // CLIC genérico: el toque de cualquier botón, pestaña o carta. Corto y seco (60 ms), con un pelín de aire en
  // el ataque para que suene a "toc" físico y no a pitido.
  const TAP = ()=>{ const { buf:b, S } = mkBuf(0.07);
    S.note(0, 0.055, 740, 0.24, { wave:'pulse', duty:0.35, decay:16 });
    S.add(0, 0.022, 2400, 1300, 0.07, 0.45, 20);
    return b; };

  // CONFIRMAR: lo que ARRANCA algo (JUGAR, equipar, comprar, volver a jugar). Dos notas hacia ARRIBA, hermano
  // del blip de "¡LISTO!" del motor (arranque.mjs) para que empezar suene igual dentro y fuera de la partida.
  const CONFIRM = ()=>{ const { buf:b, S } = mkBuf(0.30);
    S.note(0,     0.09, 880,  0.22, { wave:'pulse', duty:0.42, decay:13 });
    S.note(0.065, 0.18, 1319, 0.20, { wave:'pulse', duty:0.42, decay:8 });
    S.note(0.065, 0.18, 1760, 0.06, { wave:'sine', decay:7 });
    return b; };

  // ABRIR: las tarjetas GRANDES que te llevan a otra pantalla (la tarjeta de modo, la bola-héroe, la banda del
  // Pase, los rieles, una ficha del Garaje). Un swish de aire que SUBE, con un pelín de nota para que tenga
  // cuerpo. Existe porque un clic seco de 55 ms se pierde debajo de la transición de pantalla: lo que mueve
  // medio juego tiene que sonar a algo más que una pestaña (VB Jaime 2026-07-27: "la tarjeta de cambiar modo
  // no suena" — sonaba, pero con el mismo clic diminuto que un botón cualquiera).
  const OPEN = ()=>{ const { buf:b, S } = mkBuf(0.20);
    S.add(0,    0.16, 430, 1250, 0.17, 0.32, 5);
    S.note(0.02,0.13, 880,  0.11, { wave:'tri', decay:9 });
    return b; };

  // VOLVER / cerrar: las mismas dos notas, hacia ABAJO y más apagadas. Cerrar no es un logro.
  const BACK = ()=>{ const { buf:b, S } = mkBuf(0.26);
    S.note(0,    0.09, 660, 0.17, { wave:'tri', decay:12 });
    S.note(0.06, 0.16, 440, 0.15, { wave:'tri', decay:9 });
    return b; };

  // NO SE PUEDE: bloqueado, sin monedas, aún no desbloqueado. Dos golpes graves iguales (el "nope" de toda la
  // vida): no suena a error de sistema, suena a "por aquí no".
  const DENIED = ()=>{ const { buf:b, S } = mkBuf(0.24);
    S.note(0,    0.08, 220, 0.20, { wave:'pulse', duty:0.5, decay:12 });
    S.note(0.09, 0.12, 185, 0.20, { wave:'pulse', duty:0.5, decay:10 });
    return b; };

  return {
    tap(){     play(buf('tap',     TAP)); },
    open(){    play(buf('open',    OPEN)); },
    confirm(){ play(buf('confirm', CONFIRM)); },
    back(){    play(buf('back',    BACK)); },
    denied(){  play(buf('denied',  DENIED)); },
  };
}
