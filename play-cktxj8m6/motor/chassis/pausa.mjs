// PAUSA · CUANDO EL JUEGO PREGUNTA ALGO ENCIMA, LA PARTIDA SE PARA.
// Capa compartida por los 3 motores (race, cazador, redlight), igual que arranque.mjs y coach.mjs.
//
// POR QUÉ EXISTE (docs/65, lo único que quedó abierto de aquella tanda): el botón atrás del móvil ya no
// echa al jugador de la web — en partida abre la hoja del juego "¿Abandonar la partida?". Pero la partida
// SEGUÍA CORRIENDO detrás mientras el jugador decidía. Si el atrás te pilla a diez metros de la meta,
// pierdes terreno por leer una pregunta que no pediste. Y el velo de esa hoja es #05040bb8 (72 % de negro
// sobre TODA la pantalla): mientras está abierta el tablero no se lee, así que ni siquiera puedes seguir
// jugando "a ojo". Parar es lo único honesto.
//
// LAS TRES REGLAS QUE NO SE ROMPEN AQUÍ:
//   1. NO TOCA LA SIM. Esto congela el BUCLE (no se llama a stepOnce), no cambia una sola constante de
//      física ni consume RNG. La secuencia de frames de la partida es exactamente la misma, solo que
//      repartida en más tiempo de reloj de pared. La huella de tools/huella-sim.mjs sale idéntica, y
//      tools/prueba-pausa-partida.mjs lo comprueba EN EL NAVEGADOR: misma semilla con y sin pausa =
//      misma trayectoria, hash a hash.
//   2. CERO TELEPORTS. El peligro real de pausar es el reloj: si el motor acumulara tiempo de pared
//      mientras está quieto, al volver le entraría un dt gigante y las bolas SALTARÍAN. Aquí el motor
//      consume su `clock.getDelta()` en la PRIMERA línea del bucle y solo DESPUÉS pregunta si está
//      congelado, así que el reloj se vacía en cada frame y nunca hay atraso que soltar. El acumulador
//      (`acc`) se queda tal cual estaba —siempre por debajo de un paso— así que al volver se reanuda en
//      la misma fase del paso, sin ráfaga y sin salto de interpolación.
//   3. LOS TRES MODOS, LO MISMO. Una regla de sensación va a los tres modos en la misma entrega. Por eso
//      esto es un módulo del chassis y no tres parches: la cuenta de vuelta es la misma función, con los
//      mismos números y el mismo "¡YA!" en los tres.
//
// LA CUENTA DE VUELTA (3 · 2 · 1 · ¡YA!, 0,5 s por cifra). Volver de golpe a una partida en marcha es
// injusto: el jugador lleva sin ver el tablero desde que se abrió el velo. La referencia de cuánto aviso
// necesita la pone el propio juego: Luz Roja avisa de un cambio de luz con WARN = 18 frames = 0,6 s. O
// sea que menos de 0,6 s de tablero visible está por debajo del listón que el juego se pone a sí mismo.
// 3 cifras × 0,5 s = 1,5 s, con cifras de medio segundo (legibles) y menos de la mitad de la cadencia de
// la cuenta de salida (DIGIT = 1,15 s): se reconoce como VOLVER, no como empezar otra vez. Y se apoya en
// el vocabulario que el juego ya habla —el mismo #count, las mismas cifras, el mismo "¡YA!" y los mismos
// beeps de arranque.mjs— en vez de inventar un segundo lenguaje para lo mismo.
//
// DÓNDE NO HAY CUENTA: si la partida todavía no está en juego (el cartel de "¿LISTO?" o la cuenta de
// salida) se vuelve en el acto. Ahí no hay nada que perder, y encima la cuenta de vuelta caería encima de
// la de salida: dos cuentas atrás a la vez es un fallo, no un detalle.

//+AG ESTE MÓDULO NO IMPORTA NADA A PROPÓSITO. Los beeps de la cuenta son los de arranque.mjs, pero
//   arranque.mjs ya importa de aquí (la bandera PAUSA, para congelar su auto-arranque): pedirle a él
//   sfxCountdown cerraría un ciclo entre los dos ficheros. Los ciclos de módulos ES "funcionan" hasta el
//   día que uno de los dos mueve una constante al cuerpo del módulo y sale una TDZ imposible de leer. La
//   dependencia va en UN SOLO sentido y el motor —que ya importa sfxCountdown— pasa los beeps por cfg.sfx.

// Bandera compartida: "el mundo NO se está moviendo". La lee arranque.mjs para que su auto-arranque de 5 s
// no suelte la ronda mientras el shell está preguntando algo (pasa de verdad: tocar JUGAR y dar atrás).
export const PAUSA = { on: false };

const DIGITS = 3, DIGIT = 0.5, DUR = DIGITS * DIGIT;

// cfg:
//   enJuego  ()=>bool     ¿la sim está viva? (phase==='play'). Si no, volver es instantáneo.
//   goFlash  ()=>void     el "¡YA!" del propio motor (mismo cartel que al empezar la ronda)
//   sfx      (o)=>void    los beeps de la cuenta: el motor pasa su sfxCountdown ya atado a su audio
//   alSeguir ()=>void     lo que el motor quiera hacer al reanudar (consumir su reloj, y poco más)
export function createPausa(cfg = {}){
  const { enJuego, goFlash, sfx, alSeguir } = cfg;
  let estado = 'libre';        // 'libre' · 'quieta' (el shell pregunta) · 'volviendo' (cuenta de vuelta)
  let resta = 0;

  const caja = () => document.getElementById('count');
  const cifra = () => document.getElementById('countN');

  //+AG ⚠ VOLVER NO PUEDE PARECER EMPEZAR. #count no lleva solo la cifra: cuelgan de él la BANDA DEL MODO
  //   ("MODO · LUZ ROJA", de arranque.mjs) y el rótulo "ESTE ERES TÚ", que son el ritual de SALIDA. Medido en
  //   captura: la cuenta de vuelta salía con las dos cosas puestas y se leía igual que el arranque de una
  //   ronda — o sea "¿se ha reiniciado la partida?" justo cuando el jugador acaba de decir que quiere seguir
  //   la suya. Peor aún, el "este eres tú" se apoya en un aro que late alrededor de tu bola, y ese aro lo
  //   pinta la sim... que está parada: el rótulo señalaba a nada. Se apagan los dos, y lo que distingue
  //   volver de empezar pasa a ser justo eso: la vuelta son SOLO las cifras y el "¡YA!".
  //   No se inventa un texto nuevo ("seguimos", "volvemos") a propósito: sería una cadena más en 20 idiomas
  //   para decir lo que la ausencia de la ceremonia ya dice.
  const ADORNOS = ['btBanner', 'countYou'];
  function adornos(ver){
    for(const id of ADORNOS){ const e = document.getElementById(id); if(e) e.style.display = ver ? '' : 'none'; }
  }

  function pinta(){
    const c = caja(), n = cifra(); if(!c || !n) return;
    c.classList.add('show');
    // mismos números y mismo pop que introUI() de los 3 motores: se copia el gesto, no se inventa otro
    const t = DUR - resta, cur = Math.max(1, DIGITS - Math.floor(t / DIGIT)), frac = (t % DIGIT) / DIGIT;
    n.textContent = String(cur); n.style.color = '#fff';
    n.style.transform = `scale(${(1 + 0.45 * (1 - frac)).toFixed(2)})`;
    n.style.opacity = (0.5 + 0.5 * (1 - frac)).toFixed(2);
  }

  function pausa(){
    if(estado === 'quieta') return;
    //+AG ⚠ SE PUEDE PAUSAR DESDE LA CUENTA DE VUELTA. El jugador dice "seguir jugando" y vuelve a dar atrás
    //   antes de que acabe el 3-2-1: si esto fuera un `if(estado!=='libre') return`, la segunda pregunta se
    //   quedaría sin pausa y la partida arrancaría DEBAJO de la hoja. La cuenta se retira al congelar.
    if(estado === 'volviendo'){ const c = caja(); if(c) c.classList.remove('show'); adornos(true); }
    estado = 'quieta'; PAUSA.on = true; resta = 0;
  }

  function sigue(){
    if(estado !== 'quieta') return;
    if(!enJuego || !enJuego()){ estado = 'libre'; PAUSA.on = false; if(alSeguir) alSeguir(); return; }
    estado = 'volviendo'; resta = DUR;
    adornos(false);
    try{ if(sfx) sfx({ digits: DIGITS, digitDur: DIGIT, goAt: DUR }); }catch(e){}
    pinta();
  }

  //+AG EL MOTOR LLAMA A ESTO EN LA PRIMERA LÍNEA DE SU BUCLE, con el dt YA consumido del reloj (ver regla 2).
  //   Devuelve true = "no hagas nada este frame". El render tampoco corre: el lienzo de WebGL conserva el
  //   último fotograma compuesto, así que la imagen se queda CLAVADA (que es lo que significa pausar) y no
  //   se gasta batería dibujando 60 veces por segundo lo mismo debajo de una hoja.
  function congelada(dt){
    if(estado === 'quieta') return true;
    if(estado === 'volviendo'){
      resta -= dt;
      if(resta > 0){ pinta(); return true; }
      estado = 'libre'; PAUSA.on = false;
      if(goFlash) goFlash();          // el "¡YA!" de siempre: la ronda sigue EN ESTE MISMO FRAME
      //+AG los adornos vuelven a su sitio DESPUÉS de que el "¡YA!" retire #count (GO_HOLD = 550 ms en los 3
      //   motores), así que el jugador no ve reaparecer la banda del modo. Se devuelven en vez de dejarlos
      //   apagados porque la SIGUIENTE ronda —el "R" del standalone, el "otra partida"— vuelve a necesitarlos.
      setTimeout(()=>{ if(estado === 'libre') adornos(true); }, 1200);
      if(alSeguir) alSeguir();
      return false;
    }
    return false;
  }

  //+AG EL CANAL. El shell (juego.html) manda bt:pausa / bt:sigue al iframe. Se acepta SOLO lo que venga del
  //   documento que nos embebe —espejo exacto del filtro que el shell le hace al motor (e.source!==contentWindow)—
  //   así que abierto suelto (vídeo, preview, captura) esto no se dispara jamás.
  addEventListener('message', e => {
    if(window.parent === window || e.source !== window.parent) return;
    const d = e.data; if(!d || typeof d !== 'object') return;
    if(d.type === 'bt:pausa') pausa();
    else if(d.type === 'bt:sigue') sigue();
  });
  //+AG Y EL SALUDO, que no es cortesía: entre que el shell crea el iframe y este módulo existe pasan cientos
  //   de milisegundos, y en ese hueco un postMessage se pierde en el documento vacío. Si el jugador toca
  //   JUGAR y da atrás en el acto, el shell habría pedido la pausa a nadie. Al saludar, el shell le repite
  //   el estado en el que está.
  try{ if(window.parent !== window) parent.postMessage({ type: 'bt:motorListo' }, '*'); }catch(e){}

  //+AG ventana de SOLO LECTURA para verificarlo desde fuera (tools/prueba-pausa-partida.mjs), hermana de
  //   __cap y de __test. No la usa nada del juego.
  window.__pausa = { get estado(){ return estado; }, get resta(){ return resta; }, get dur(){ return DUR; } };

  return { congelada, pausa, sigue, get estado(){ return estado; } };
}
