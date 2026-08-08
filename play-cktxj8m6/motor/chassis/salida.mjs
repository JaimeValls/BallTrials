// ============================================================================
//  salida.mjs · LA SALIDA ARMADA — preparar la bola DURANTE la cuenta atrás
//
//  POR QUÉ EXISTE (VB Jaime, 2026-08-08). Su petición, literal: «cuando empieza la partida no haya
//  nadie seleccionado, todos los botones estén grises y tú, mientras está la cuenta atrás antes de que
//  empiece la partida, puedas pulsar a run, se ponga verde y sientas que estás preparando durante la
//  cuenta atrás el personaje para correr. Y lo mismo con las direcciones o los boosters, si así lo
//  deseas.»
//
//  QUÉ HABÍA ANTES, medido en los tres modos con la cuenta atrás en pantalla:
//    · CARRERA   el carril del CENTRO venía elegido, y los tres carriles se veían encendidos y
//                pulsables… y no hacían NADA. Peor que estar grises: parece que sí y no.
//    · CAZADOR   venía elegido «ESCAPAR COMO SEA» —la orden más extrema de las tres— encendida en rojo
//                como si la hubiera pulsado el jugador. Y tampoco respondía.
//    · LUZ ROJA  el carril del centro elegido y todo lo demás gris, sin responder.
//  O sea: el juego elegía por ti y encima no te dejaba cambiarlo hasta que ya estabas corriendo.
//
//  QUÉ HACE ESTA PIEZA. Guarda lo que el jugador prepara antes del «¡YA!» y lo suelta de golpe cuando
//  la partida arranca. Nada más: no sabe de carriles ni de boosters, solo guarda funciones con una
//  clave. La clave es lo que hace que armar dos veces el rumbo SUSTITUYA en vez de sumar (el rumbo es
//  uno) mientras dos boosters distintos conviven.
//
//  ⚠ POR QUÉ SE ARMA Y NO SE EJECUTA. Un booster pulsado en la cuenta atrás no puede dispararse en el
//    momento: su efecto dura unos segundos y se consumiría ANTES de que la bola se mueva, o sea que le
//    estaríamos comiendo al jugador una carga que ha pagado sin darle nada. Jaime eligió «se arma y
//    sale contigo»: el botón se queda encendido esperando y el efecto prende en el «¡YA!».
//
//  ⚠ VIVE EN chassis/ Y NO COPIADA EN LOS TRES MOTORES A PROPÓSITO. Es una regla de SENSACIÓN, y las
//    reglas de sensación tienen que ir a los tres modos iguales; copiadas, se desincronizan en el
//    primer arreglo que alguien haga en uno solo.
// ============================================================================

export function crearSalida() {
  // clave -> función que se ejecutará al arrancar. Map y no objeto: conserva el ORDEN de armado, así
  // que si armas nitro y luego escudo, salen en ese orden y no en el que decida el motor.
  const pend = new Map();

  return {
    // Arma (o RE-arma) una acción. Misma clave = sustituye, que es lo que hace que el rumbo sea uno solo.
    arma(clave, fn) { if (typeof fn === 'function') pend.set(clave, fn); },
    desarma(clave) { pend.delete(clave); },
    // Alterna: si ya estaba armado lo quita y devuelve false; si no, lo arma y devuelve true. Es lo que
    // permite al jugador cambiar de idea en la cuenta atrás — pulsar dos veces el nitro lo desarma.
    alterna(clave, fn) { if (pend.has(clave)) { pend.delete(clave); return false; } this.arma(clave, fn); return true; },
    armado(clave) { return pend.has(clave); },
    get cuantos() { return pend.size; },
    // Suelta TODO lo armado, en el orden en que se armó. Se llama al pasar a 'play'.
    // Cada una en su try: un booster que falle no puede dejar sin arrancar a los que van detrás.
    soltar() {
      const fs = [...pend.values()];
      pend.clear();
      for (const f of fs) { try { f(); } catch (e) { console.error('[salida] no se pudo soltar lo armado:', e); } }
    },
    // Ronda nueva = salida limpia. Si no se llamara, lo armado en la ronda anterior prendería en esta.
    reset() { pend.clear(); },
  };
}
