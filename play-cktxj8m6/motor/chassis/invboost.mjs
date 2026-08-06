// ============================================================================
//  invboost.mjs · EL INVENTARIO DE BOOSTERS, compartido por los tres modos.
//
//  POR QUÉ EXISTE (encargo de Jaime, 2026-08-06, sus palabras): «los boosters que no son de barra se
//  usan una vez GRATIS y a partir de ese momento tienes un inventario de boosters, por lo cual hay que
//  diseñar una tienda para comprar boosters».
//
//  LA REGLA, en una línea:
//        EL PRIMER USO DE CADA BOTÓN, EN TODA PARTIDA, ES GRATIS.
//  Sin comprar nada juegas con los mismos botones de siempre, una vez cada uno. Lo que compras es
//  poder pulsarlos MÁS veces. Nadie se queda jugando sin botones por no pagar.
//
//  LO QUE NO ENTRA AQUÍ: el SÚPER de los tres modos. Se gana con su barra jugando bien y no se compra
//  nunca — es lo único que blinda que el remontón grande siga siendo 100% mérito.
//
//  ⚠ SIN `&inv` NO HAY LÍMITE. `crear(params)` devuelve un inventario "infinito" cuando el parámetro
//  falta, y eso NO es un descuido: es lo que necesitan el TUTORIAL (enseñar un botón no puede costar
//  stock), el perfil de EQUIPOS/torneo y el motor abierto suelto para grabar vídeo del canal. Ojo con
//  la diferencia: `&inv=nitro:0` SÍ limita (a un solo uso); no mandar el parámetro no limita nada.
//
//  ⚠ EL ORDEN DE LLAMADA IMPORTA, y es la trampa de este módulo. Se pregunta `quedan()` ANTES de
//  disparar y se llama `consume()` DESPUÉS de que el motor confirme que ha disparado. Al revés, un
//  booster en enfriamiento se comería una carga sin que la bola hiciera nada — la peor forma posible
//  de gastar algo que has pagado.
// ============================================================================

export function crearInventario(params, claves){
  const raw = params.get('inv');
  const ilimitado = (raw === null);
  const stock = {};
  if (!ilimitado){
    for (const par of String(raw).split(',')){
      const [k, v] = par.split(':');
      if (k) stock[k] = Math.max(0, +v || 0);
    }
  }
  // sólo se administran las claves que este modo declara; una clave de otro modo que llegue por la URL
  // se ignora, igual que el motor ignora un ?trait que no es suyo.
  const KEYS = Array.isArray(claves) && claves.length ? claves : Object.keys(stock);
  let gastado = {}, usado = {};

  const restante = k => Math.max(0, (stock[k] | 0) - (gastado[k] | 0));

  return {
    ilimitado,
    claves: KEYS,
    // usos que le quedan al jugador AHORA, contando el gratis si no lo ha tocado
    quedan(k){ return ilimitado ? Infinity : (usado[k] ? 0 : 1) + restante(k); },
    // ¿es este disparo el gratuito? (para que el HUD pueda decirlo si algún día hace falta)
    esGratis(k){ return !ilimitado && !usado[k]; },
    // apunta un uso. Devuelve false si no había con qué — en ese caso el motor NO debe disparar.
    consume(k){
      if (ilimitado) return true;
      if (!usado[k]){ usado[k] = true; return true; }
      if (restante(k) <= 0) return false;
      gastado[k] = (gastado[k] | 0) + 1;
      return true;
    },
    // ronda nueva = uso gratis nuevo. El stock consumido NO se devuelve: en el shell el iframe se cierra
    // tras cada partida, y en standalone lo correcto es que siga bajando dentro de la misma sesión.
    reset(){ usado = {}; },
    // lo que esta partida se ha comido DEL INVENTARIO (el gratis no cuenta). Va en el bt:matchEnd.
    gastados(){ const o = {}; for (const k of KEYS) if (gastado[k]) o[k] = gastado[k]; return o; },
    // pie del botón: la recarga manda mientras corre; si no, el contador.
    // ⚠ se dice con ×N y no con palabras porque el juego va a 20 idiomas y el canon es cero idioma
    // obligatorio (§G): un número se lee igual en árabe que en tailandés.
    pie(k, cdFrames, fps, textoListo){
      if (cdFrames > 0) return Math.ceil(cdFrames / fps) + 's';
      const q = this.quedan(k);
      return q === Infinity ? textoListo : '×' + q;
    },
  };
}
