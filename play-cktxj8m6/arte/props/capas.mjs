// ============================================================================
//  capas.mjs · QUE CAPAS OPCIONALES TIENE CADA ACCESORIO.
//  GENERADO por tools/partir-props.py. NO SE EDITA A MANO: se reescribe solo al instalar capas, o
//  a mano con `python tools/partir-props.py --manifiesto`, que mira los ficheros de esta carpeta.
//
//  POR QUE EXISTE: el motor pedia SIEMPRE las dos capas opcionales de cada bola
//  (prop-<clave>-fx.webp y prop-<clave>-em.webp) y aguantaba el 404 sin quejarse. Como solo 6 de
//  los 12 accesorios tienen alguna, cada bola viva soltaba hasta 2 peticiones fallidas en
//  produccion. No rompia el juego, pero llenaba la consola de rojo y escondia los 404 DE VERDAD
//  entre el ruido. Ahora propgen.mjs mira esta carta y solo pide lo que existe.
//
//  VIVE AL LADO DEL ARTE a proposito, no junto al codigo del motor: quien crea estas capas es
//  tools/partir-props.py y las deja en ESTA carpeta. El dia que Codex entregue un accesorio nuevo
//  con isla animable, volver a correr la herramienta actualiza la carta sola — no hay que acordarse
//  de tocar ningun fichero de motor/.
// ============================================================================
export const CAPAS_PROP = {
  burbuja: { fx: true },
  chispa:  { fx: true },
  lapa:    { fx: true },
  meteoro: { fx: true },
  pinball: { em: true },
  volcan:  { em: true },
  yunque:  { fx: true },
};
