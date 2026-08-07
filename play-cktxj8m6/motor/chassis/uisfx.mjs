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
//   import { createUiSfx } from './motor/chassis/uisfx.mjs?v=d17deb4';
//   const ui = createUiSfx(audio, ()=>SAVE.settings.sfx!==false);
//   ui.tap();  ui.confirm();  ui.back();  ui.denied();
//
// REGLA DE VOLUMEN: un clic de menú se oye 200 veces por sesión, así que se queda DEBAJO de lo que hace la
// partida (amplitudes ~0.2 contra ~0.5 de los golpes del motor) y siempre por debajo de 90 ms. Tiene que
// confirmar el toque, no llamar la atención.
import { createSynth, makeRng, peakGain } from './synth.mjs?v=d17deb4';
//+AG 2026-08-07: `createFx` da el `pop` y el `sparkle` que pide el diseño de «Recompensa reclamada» de
//   prototipo/sonidos.html. Se importa aqui y no se reescribe a mano: son los mismos efectos que usa la
//   partida, asi que reclamar un premio suena de la familia del juego y no de otro sitio.
import { createFx } from './sfx.mjs?v=d17deb4';

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

  // COMPRAR (2026-08-06): clic de caja + tres monedas que TINTINEAN SUBIENDO. Nace de que Jaime probara
  // la Tienda y dijera «hago clic y aparece una cosita abajo ahí pequeña»: comprar sonaba con el CONFIRM
  // genérico, o sea igual que pulsar JUGAR, y el cerebro no registra como logro algo que suena a
  // navegación. Este es el único sonido del juego con esta forma, y por eso se reconoce.
  //
  // ⚠ NO ES INVENTADO: es el diseño que ya estaba probado y sonando en prototipo/sonidos.html
  //   ("UI · Economía y recompensas" → "Comprar con Chispas"), que nunca se había traído al juego.
  //   Las frecuencias son las suyas: 1319 / 1568 / 2093 Hz sobre un golpe de caja de 1100→700.
  //
  // ⚠ Y SIN AZAR, a diferencia del original. Allí la lluvia usaba rng() para separar las monedas; aquí
  //   los buffers se CACHEAN, así que ese azar se congelaría en el primer disparo y sonaría idéntico el
  //   resto de la sesión — el azar no aportaría nada y costaría reproducibilidad. Separaciones fijas.
  const COMPRA = ()=>{ const { buf:b, S } = mkBuf(0.60);
    S.add(0, 0.04, 1100, 700, 0.20, 0.30, 10);                                  // el golpe de la caja
    S.note(0.05, 0.10, 1319, 0.18, { wave:'sine', decay:8 });
    S.note(0.11, 0.10, 1568, 0.18, { wave:'sine', decay:8 });
    S.note(0.17, 0.14, 2093, 0.15, { wave:'sine', decay:8 });
    return b; };

  // COMPRA GORDA (lotes de 15 y 40): la misma caja, pero LLOVIENDO monedas. Que comprar 40 suene igual
  // que comprar 1 es perder gratis la mejor forma de premiar la compra grande.
  const LLUVIA = ()=>{ const { buf:b, S } = mkBuf(0.90);
    S.add(0, 0.05, 900, 600, 0.14, 0.35, 9);
    const F = [1319, 1568, 1760, 2093];                                          // orden fijo, cero dado
    for(let i=0;i<9;i++) S.note(0.03 + i*0.058, 0.09, F[i%4], 0.15*(1-i*0.05), { wave:'sine', decay:9 });
    return b; };

  // RECLAMAR UN PREMIO (2026-08-07). Hasta hoy, recoger el regalo del día, cobrar el cofre de Liga y
  // pulsar JUGAR en la portada disparaban LOS TRES el mismo `confirm()`: el mismo buffer, byte por byte.
  // Y si un logro suena igual que navegar, el cerebro no lo registra como logro. Esto separa lo que el
  // juego te DA de lo que tú ARRANCAS, que es la mitad de por qué un premio se siente premio.
  //
  // ⚠ NO ES INVENTADO, igual que COMPRA: es «Recompensa reclamada» de prototipo/sonidos.html, donde
  //   estaba diseñado y sonando desde siempre y nunca se había traído. Pop de regalo + doble chispa.
  const PREMIO = ()=>{ const { buf:b, S } = mkBuf(0.70);
    const fx = createFx(S);
    fx.pop(0, 0.40); fx.sparkle(0.09, 0.40); fx.sparkle(0.20, 0.30);
    return b; };

  // EL REGALO DEL DÍA tiene el suyo propio, y esa es toda la gracia: es lo primero que haces cada día y
  // tiene que reconocerse de oído antes de mirar. Campanita cálida, 1175 → 1568 Hz («Bonus del día»,
  // misma hoja de sonidos). ⚠ Cero rng() aquí dentro: los buffers se CACHEAN y el azar se congelaría en
  // el primer disparo, sonando idéntico el resto de la sesión (la lección que ya dejó LLUVIA).
  const BONUS = ()=>{ const { buf:b, S } = mkBuf(0.90);
    S.note(0,    0.5, 1175, 0.20, { wave:'sine', decay:2, vib:0.004 });
    S.note(0.12, 0.5, 1568, 0.14, { wave:'sine', decay:2 });
    S.add(0.01, 0.03, 2400, 2000, 0.06, 0.1, 12);
    return b; };

  return {
    tap(){     play(buf('tap',     TAP)); },
    open(){    play(buf('open',    OPEN)); },
    confirm(){ play(buf('confirm', CONFIRM)); },
    back(){    play(buf('back',    BACK)); },
    denied(){  play(buf('denied',  DENIED)); },
    //+AG `gorda` = true en los lotes grandes. Un solo método para que quien compre no tenga que saber
    //   qué sonido le toca: se le pasa si la compra es gorda y ya.
    compra(gorda){ play(buf(gorda?'lluvia':'compra', gorda?LLUVIA:COMPRA)); },
    premio(){  play(buf('premio', PREMIO)); },
    bonus(){   play(buf('bonus',  BONUS)); },
  };
}
