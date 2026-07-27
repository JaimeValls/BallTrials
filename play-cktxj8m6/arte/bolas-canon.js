// ============================================================================
//  BOLAS-CANON · el color canonico de las 12 bolas-heroe. FUENTE UNICA DE VERDAD.
//
//  POR QUE EXISTE: los mismos 12 colores estaban copiados A MANO en tres sitios
//  (tools/integrar-bolas.py CANDADO, juego.html ARCH_COLOR y la pagina de
//  previsualizacion), y se desincronizaron: SEIS de las doce bolas tenian un
//  color en la ficha que compras y otro distinto en el juego. Chispa se vendia
//  amarilla y salia cian; Pinball violeta y salia amarilla; Bunker gris y salia
//  violeta. Comprar una foto y recibir otra cosa es el peor fallo posible.
//
//  LA REGLA: este fichero manda. Si hay que cambiar un color, se cambia AQUI y
//  en ningun otro sitio. Los tres consumidores lo leen:
//    · tools/integrar-bolas.py  -> valida que el arte que entrega Codex lo cumple
//    · prototipo/juego.html     -> ARCH_COLOR (punto de color del Ranking)
//    · prototipo/bolas-vivas.html -> la pagina de comparacion ficha/pista
//
//  FORMATO CONGELADO: una linea por bola, `clave: '#RRGGBB',`. integrar-bolas.py
//  lo lee con una expresion regular, asi que no metas expresiones ni calculos.
//
//  Los valores salen del encargo 06 (la tabla con la que se pinto el arte v3),
//  que es la que manda porque es la que se ve en la Tienda.
// ============================================================================
window.BOLAS_CANON = {
  cohete:   '#2E85FF',
  tanque:   '#38E057',
  chispa:   '#FFE038',
  pinball:  '#B345FF',
  lapa:     '#FF8C1F',
  burbuja:  '#40EBEB',
  meteoro:  '#4A4550',
  bunker:   '#8A8A94',
  volcan:   '#1C1A22',
  yunque:   '#5A6070',
  fantasma: '#C9B6FF',
  estrella: '#FBB915',
};

// hex -> [r,g,b] en 0..1, que es como lo quieren el motor y el shell.
window.canonRGB = function (hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};

// COLOR PARA UI (puntos del Ranking, listas): el mismo color del heroe pero legible.
// Cuatro de las doce son roca/hierro/basalto y Volcan es casi negro (#1C1A22): un punto
// de 10 px de ese color sobre el indigo del juego simplemente NO SE VE.
//
// Ojo con el remedio evidente, que probe y era peor: subir todas a un SUELO fijo las
// aplasta al mismo valor y entonces Meteoro, Volcan y Yunque salen tres grises calcados
// (lo aviso el auditor y se confirmo midiendo). Esta curva sube el minimo PERO CONSERVA
// EL ORDEN: cada una queda mas clara que la anterior, como en su ficha.
//   v' = max(v, 0.34 + 0.42·v)   -> volcan .13→.40 · meteoro .31→.47 · yunque .44→.52 · bunker .58→.58
// Las vivas (v alto) no se tocan: el max() se queda con su propio valor.
// Tono y saturacion NUNCA cambian: sigue siendo su color, no una version inventada.
window.canonUI = function (hex) {
  const [r, g, b] = window.canonRGB(hex);
  const mx = Math.max(r, g, b);
  if (mx < 1e-4) return [r, g, b];
  const k = Math.max(mx, 0.34 + 0.42 * mx) / mx;
  return [Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k)];
};
