// sincro.mjs - BallTrials - sincroniza el progreso con la nube - docs/42 Fase 1
//
// QUE RESUELVE. Hoy el progreso vive en el localStorage del movil: si el jugador
// borra el navegador o cambia de telefono, lo pierde todo. Aqui el progreso pasa a
// vivir en la nube y el localStorage se queda como copia rapida.
//
// TRES REGLAS QUE NO SE ROMPEN:
//   1. Nunca se pierde progreso. Si hay duda, gana el estado con MAS partidas
//      jugadas, no el mas reciente. Un reloj mal puesto no puede borrarte el mes.
//   2. Sin red, el juego funciona igual. Todo error de red se traga y se reintenta
//      en el siguiente guardado; el estado local no se toca jamas por un fallo.
//   3. Un solo empuje por rafaga. El juego llama a persist() muchas veces seguidas
//      (cada moneda, cada toque); la nube recibe uno.
//
// Sin acentos a proposito, como nube.mjs.

const RETARDO_MS = 1500;     // rafaga de guardados locales -> un solo empuje
const REINTENTO_MS = 15000;  // si la nube falla, volver a intentarlo asi

export function crearSincro({ nube, ahora = () => Date.now(), aviso = null }) {
  let temporizador = null;
  let empujando = false;
  let pendiente = false;      // llego otro guardado mientras empujabamos
  let ultimoError = null;
  let estado = 'sin-arrancar';
  let leerSave = null;        // lo fija arrancar(): de donde sacar el estado vivo

  const decir = (q, d) => { try { aviso && aviso(q, d); } catch (e) { /* el aviso no puede tumbar la sincronizacion */ } };

  //+AG legacy_local_id es una columna uuid. Un save viejo o manoseado a mano puede
  //   traer ahi cualquier cosa, y entonces el PATCH entero se cae con 22P02: la nube
  //   dejaria de guardar el progreso PARA SIEMPRE y en silencio, porque el error se
  //   traga y se reintenta. Si no parece un uuid, se manda null y se sigue: el dato
  //   solo sirve para reclamar el save viejo, no vale perder la sincronizacion por el.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidOnada = v => (typeof v === 'string' && UUID.test(v.trim())) ? v.trim() : null;

  // Lo que se sube. El grueso va en save_blob; fuera salen solo los pocos campos
  // que la nube necesita poder consultar sin abrir el blob.
  function aFilas(save) {
    return {
      alias: String(save?.profile?.name || '').slice(0, 40),
      legacy_local_id: uuidOnada(save?.profile?.playerId),
      level: Math.max(1, Math.round(save?.level || 1)),
      xp: Math.max(0, Math.round(save?.xp || 0)),
      chispas: Math.max(0, Math.round(save?.chispas || 0)),
      gemas: Math.max(0, Math.round(save?.gemas || 0)),
      played: Math.max(0, Math.round(save?.played || 0)),
      save_blob: save || {},
      save_ts: ahora()
    };
  }

  const partidas = s => Math.max(0, Math.round(s?.played || 0));

  // Decide quien gana cuando hay estado en los dos lados.
  // Regla 1 en accion: el reloj solo decide si el progreso empata o mejora. Una
  // nube con MENOS partidas nunca pisa al movil, por muy nuevo que diga ser.
  function quienGana(local, remoto, tsLocal, tsRemoto) {
    if (!remoto) return { gana: 'local', motivo: 'la nube esta vacia' };
    if (!local) return { gana: 'remoto', motivo: 'el movil esta vacio' };
    if (partidas(remoto) < partidas(local)) {
      return { gana: 'local', motivo: `la nube tiene menos partidas (${partidas(remoto)} < ${partidas(local)})`, conflicto: true };
    }
    if (tsRemoto > tsLocal) return { gana: 'remoto', motivo: 'la nube es mas nueva' };
    return { gana: 'local', motivo: 'el movil es igual o mas nuevo' };
  }

  // ------------------------------------------------------------------ arrancar
  //
  // fuente: { save, fresco, escribir(saveNuevo) }
  //   save     = el SAVE vivo del juego
  //   fresco   = true si este dispositivo no tenia partida guardada
  //   escribir = como aplicar un estado traido de la nube
  async function arrancar(fuente) {
    leerSave = () => fuente.save ?? (fuente.leer ? fuente.leer() : null);
    try {
      await nube.asegurarSesion();
      const p = await nube.perfil();
      const remoto = (p && p.save_ts > 0 && p.save_blob && Object.keys(p.save_blob).length) ? p.save_blob : null;
      const local = fuente.fresco ? null : leerSave();
      const v = quienGana(local, remoto, Number(leerSave()?.syncTs || 0), Number(p?.save_ts || 0));

      if (v.gana === 'remoto') {
        const traido = { ...remoto, syncTs: Number(p.save_ts) };
        fuente.escribir(traido);
        estado = 'traido';
        decir('traido', { motivo: v.motivo, partidas: partidas(remoto) });
      } else {
        await empujarYa();
        estado = remoto ? 'empujado' : 'reclamado';
        decir(estado, { motivo: v.motivo, conflicto: !!v.conflicto });
      }
      return { estado, conflicto: !!v.conflicto, motivo: v.motivo, usuario: nube.sesion?.user_id || null };
    } catch (e) {
      // Regla 2: un fallo de red no cambia nada de lo que el jugador tiene delante.
      ultimoError = e;
      estado = 'sin-red';
      decir('sin-red', { error: String(e?.message || e) });
      return { estado, error: String(e?.message || e) };
    }
  }

  // ------------------------------------------------------------------ empujar

  async function empujarYa() {
    const save = leerSave ? leerSave() : null;
    if (!save) return false;
    if (empujando) { pendiente = true; return false; }
    empujando = true;
    try {
      const filas = aFilas(save);
      await nube.guardarPerfil(filas);
      // Dejar en el estado local la marca de lo ultimo sincronizado, para que el
      // proximo arranque sepa comparar sin volver a preguntar.
      save.syncTs = filas.save_ts;
      ultimoError = null;
      return true;
    } catch (e) {
      ultimoError = e;
      decir('fallo-empuje', { error: String(e?.message || e) });
      // Regla 2: reintento en silencio, sin molestar al jugador.
      if (!temporizador) { temporizador = setTimeout(() => { temporizador = null; empujarYa(); }, REINTENTO_MS);
        //+AG en Node (los verificadores) un temporizador vivo impide que el proceso termine.
        //   unref no existe en el navegador, donde el reintento debe seguir vivo.
        if (temporizador && typeof temporizador.unref === 'function') temporizador.unref(); }
      return false;
    } finally {
      empujando = false;
      if (pendiente) { pendiente = false; programar(); }
    }
  }

  // Regla 3: agrupa la rafaga de persist() en un solo empuje.
  function programar() {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => { temporizador = null; empujarYa(); }, RETARDO_MS);
  }

  // Para cuando el jugador cierra la pestana: no hay tiempo de esperar el retardo.
  function empujarAlSalir() {
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }
    return empujarYa();
  }

  return {
    arrancar, programar, empujarYa, empujarAlSalir,
    get estado() { return estado; },
    get ultimoError() { return ultimoError ? String(ultimoError.message || ultimoError) : null; },
    // expuesto solo para pruebas
    _quienGana: quienGana, _aFilas: aFilas
  };
}
