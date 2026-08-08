// estelas.mjs · doc 97 §6 · LA COLA DE COLOR QUE DEJA TU BOLA EN PISTA
//
// POR QUE EXISTE ESTE FICHERO, Y NO UNA TABLA EN CADA SITIO. La ficha del Garaje dibuja una muestra
// de la estela y el motor pinta la estela de verdad: si cada uno llevara su propia lista de colores,
// el dia que se retoque una, la tienda enseñaria una cosa y la partida entregaria otra. Eso ya paso
// en este juego con los retratos de bola —arte aparte del motor, y acabo vendiendo un personaje y
// entregando otro—, y por eso los colores viven UNA sola vez, aqui, y los lee todo el mundo.
//
// Los IDs no viven aqui: viven en juego.html, porque van al guardado del jugador. Aqui solo esta el
// ASPECTO. Un id sin paleta simplemente no pinta nada, que es el fallo correcto: se le queda la bola
// sin cola, no se le rompe la partida.
//
// ⚠ NO ES UN BOOSTER Y NO PUEDE PARECERLO. La estela cian de velocidad (gfx.trail) es LENGUAJE DE
//   JUEGO: dice «voy rapido» y el jugador la lee para decidir. Esta es cosmetica pura, asi que va
//   deliberadamente mas floja y mas corta —una particula por fotograma contra las cuatro de aquella—
//   para no robarle el significado ni tapar la pista. Un cosmetico que estorba a la lectura de la
//   partida es un cosmetico mal hecho, por bonito que sea.

export const ESTELAS = {
  //   la que la Tienda lleva vendiendo desde siempre (250 Gemas) y que hasta hoy no se veia
  es_arcoiris:{ cols:['#ff4d4d','#ff9f2e','#ffe14d','#4ddc8a','#3fd8ff','#4a7bff','#b97bff'] },
  //   premio del Top 3 de la temporada: plata fria, para que no compita con el oro del campeon
  es_podio:   { cols:['#ffffff','#dfe5f5','#b9bed4','#8e93a8'] },
  //   premio del 1o. Es el unico cosmetico del juego que no vuelve nunca: la del a Temporada 1 solo
  //   la tendran los que ganaron la Temporada 1.
  es_campeon: { cols:['#fff6d0','#ffd23f','#ffb43d','#ff8a00'] },
};

//   hex -> [r,g,b] en 0..1, que es lo que come el emisor de particulas
function rgb01(h){
  const n = parseInt(h.slice(1), 16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
}
const _cache = {};
export function paleta(id){
  if(!id || !ESTELAS[id]) return null;
  return _cache[id] || (_cache[id] = ESTELAS[id].cols.map(rgb01));
}

// Emite la cola detras de la bola. Se llama cada fotograma mientras la bola se mueve; `emit` es el
// emisor crudo del pool de particulas del motor (gfx.mjs), asi que esto no crea ni un objeto nuevo
// por fotograma ni toca la Sim: es render puro y no puede mover el balance ni un milimetro.
//   `t` es el reloj de la partida en segundos: hace que el color RECORRA la paleta en vez de sortearse,
//   que es lo que convierte siete colores sueltos en un arcoiris y no en confeti.
export function emiteEstela(emit, cols, x, y, vx, vy, t){
  if(!cols || !cols.length) return;
  const sp = Math.sqrt(vx*vx + vy*vy);
  if(sp < 0.9) return;                                  // parada o casi: sin cola (si no, mancha bajo la bola)
  const ux = vx/sp, uy = vy/sp;
  //+AG ⚠ ESTA GEOMETRIA ES LA DE gfx.trail() Y NO ES CASUALIDAD: ES LA RECETA QUE EN ESTE MOTOR SI SE
  //   VE. Los dos primeros intentos fueron parametros inventados «para no competir con el nitro» —una
  //   particula por fotograma, y luego dos, con poca velocidad de salida— y los dos se midieron:
  //   ocupaban el 0,11 % y el 0,28 % de la pantalla. En la captura no se distinguian del ruido del
  //   fondo. Un premio de campeon que hay que buscar con lupa no es un premio.
  //   Lo que estaba mal era el planteamiento, no el numero: aqui las bolas van despacio la mitad del
  //   tiempo (rebotan entre pegs) y las particulas ademas CAEN por la gravedad del pool, asi que una
  //   cola floja se descuelga y se apaga antes de leerse. La receta de la estela de velocidad ya tiene
  //   resuelto ese problema —cuatro por fotograma, escalonadas y disparadas hacia atras con fuerza— y
  //   se copia entera.
  //   LO QUE DISTINGUE UNA ESTELA COSMETICA DE LA DE VELOCIDAD ES EL COLOR, NO LA DENSIDAD: aquella es
  //   cian fijo y esta recorre su paleta. Y cuando ademas aprietas el nitro, aquella se dobla o
  //   cuadruplica y la bola se pone al blanco, asi que las dos se siguen distinguiendo en marcha.
  for(let k=0; k<4; k++){
    const c = cols[Math.floor(t*14 + k) % cols.length];  // avanza por la paleta con el tiempo
    const back = 0.12 + k*0.22 + Math.random()*0.18, j = 0.16;
    emit(x - ux*back + (Math.random()-0.5)*j, y - uy*back + (Math.random()-0.5)*j, 0.30,
         c[0], c[1], c[2],
         -ux*(2.0 + Math.random()*1.8), -uy*(2.0 + Math.random()*1.8), 0,
         0.30 + Math.random()*0.20);
  }
}
