// nube.mjs - BallTrials - capa de red contra Supabase - docs/42 Fase 1
//
// POR QUE A PELO CON fetch Y NO EL SDK DE SUPABASE. El juego es autocontenido y
// arranca en moviles con red mala; no queremos que empezar a jugar dependa de que
// un CDN sirva medio megabyte de modulos. Lo que necesitamos son un endpoint de
// auth y cinco de REST, que son 200 lineas.
//
// REGLA DE ORO: esta capa NUNCA es imprescindible. Si la red falla, cada funcion
// lanza y el juego sigue con localStorage igual que hasta hoy. El progreso local
// nunca se borra porque la nube no conteste.
//
// Vive en motor/chassis/ porque es la carpeta que el build de la web copia a
// produccion (ver docs/40); un fichero suelto en prototipo/ no se desplegaria.
//
// Sin acentos ni caracteres raros a proposito: este fichero se ha corrompido una
// vez por un round-trip de PowerShell y no merece la pena arriesgarse.

export const NUBE_URL = 'https://tmirprwlstpdryenjvtl.supabase.co';

// Clave PUBLICABLE. Es publica por diseno: viaja dentro del cliente y cualquiera
// puede leerla del codigo. Lo que protege los datos son las politicas por fila y
// los permisos de tabla (ver supabase/migrations/0002), no el secreto de esta
// cadena. La clave SECRETA jamas entra aqui.
export const NUBE_KEY = 'sb_publishable_WGhVbvwX64XUvQqElcJTPg_axDh0pLr';

const SES_KEY = 'bt_nube_v1';
const MARGEN_MS = 60000;   // renovar el token un minuto antes de que caduque

function almacenDeMemoria() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
}

function almacenPorDefecto() {
  try {
    if (typeof localStorage !== 'undefined') { localStorage.getItem(SES_KEY); return localStorage; }
  } catch (e) { /* navegador en modo privado o sin permiso: caemos a memoria */ }
  return almacenDeMemoria();
}

export class ErrorNube extends Error {
  constructor(estado, cuerpo, ruta) {
    super(`nube ${estado} en ${ruta}: ${typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)}`);
    this.name = 'ErrorNube';
    this.estado = estado;
    this.cuerpo = cuerpo;
    this.ruta = ruta;
  }
}

export function crearNube(opts = {}) {
  const url = (opts.url || NUBE_URL).replace(/\/+$/, '');
  const key = opts.key || NUBE_KEY;
  const fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  const store = opts.storage || almacenPorDefecto();
  if (!fetchFn) throw new Error('nube: no hay fetch en este entorno');

  let ses = null;
  try { ses = JSON.parse(store.getItem(SES_KEY) || 'null'); } catch (e) { ses = null; }

  function guardarSesion(s) {
    // expires_in viene en segundos; lo pasamos a instante absoluto para poder
    // decidir si hay que renovar sin volver a preguntar al servidor.
    ses = s ? {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      user_id: s.user?.id || ses?.user_id || null,
      es_anonimo: s.user?.is_anonymous ?? ses?.es_anonimo ?? true,
      caduca_en: Date.now() + (s.expires_in ? s.expires_in * 1000 : 3600000)
    } : null;
    try { ses ? store.setItem(SES_KEY, JSON.stringify(ses)) : store.removeItem(SES_KEY); } catch (e) { /* sin persistencia, la sesion vive solo en memoria */ }
    return ses;
  }

  async function pedir(ruta, { metodo = 'GET', cuerpo, cabeceras = {}, conSesion = true } = {}) {
    const h = { apikey: key, 'Content-Type': 'application/json', ...cabeceras };
    h.Authorization = 'Bearer ' + ((conSesion && ses?.access_token) ? ses.access_token : key);
    const r = await fetchFn(url + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    const texto = await r.text();
    let datos = null;
    if (texto) { try { datos = JSON.parse(texto); } catch (e) { datos = texto; } }
    if (!r.ok) throw new ErrorNube(r.status, datos ?? '', ruta);
    return datos;
  }

  // ---------------------------------------------------------------- sesion

  async function entrarAnonimo() {
    // El equivalente de signInAnonymously() del SDK: un signup sin credenciales.
    return guardarSesion(await pedir('/auth/v1/signup', { metodo: 'POST', cuerpo: { data: {} }, conSesion: false }));
  }

  async function renovar() {
    if (!ses?.refresh_token) return null;
    try {
      return guardarSesion(await pedir('/auth/v1/token?grant_type=refresh_token',
        { metodo: 'POST', cuerpo: { refresh_token: ses.refresh_token }, conSesion: false }));
    } catch (e) {
      // Un refresh token caducado o revocado no es un error del juego: se empieza
      // sesion nueva. Solo se pierde el vinculo si la cuenta era anonima.
      if (e instanceof ErrorNube && e.estado >= 400 && e.estado < 500) { guardarSesion(null); return null; }
      throw e;
    }
  }

  async function asegurarSesion() {
    if (ses?.access_token && Date.now() < ses.caduca_en - MARGEN_MS) return ses;
    if (ses?.refresh_token && await renovar()) return ses;
    return await entrarAnonimo();
  }

  // ---------------------------------------------------------------- datos

  async function perfil() {
    await asegurarSesion();
    // La RLS ya limita a mi fila, asi que no hace falta filtrar por id.
    const filas = await pedir('/rest/v1/player?select=*&limit=1');
    return Array.isArray(filas) ? (filas[0] || null) : null;
  }

  async function guardarPerfil(parcial) {
    await asegurarSesion();
    const filas = await pedir(`/rest/v1/player?id=eq.${ses.user_id}`,
      { metodo: 'PATCH', cuerpo: parcial, cabeceras: { Prefer: 'return=representation' } });
    return Array.isArray(filas) ? (filas[0] || null) : null;
  }

  async function bolas() {
    await asegurarSesion();
    return await pedir('/rest/v1/ball?select=*&order=acquired_at.asc') || [];
  }

  async function crearBola(b) {
    await asegurarSesion();
    const filas = await pedir('/rest/v1/ball',
      { metodo: 'POST', cuerpo: { ...b, player_id: ses.user_id }, cabeceras: { Prefer: 'return=representation' } });
    return Array.isArray(filas) ? (filas[0] || null) : null;
  }

  async function guardarBola(id, parcial) {
    await asegurarSesion();
    const filas = await pedir(`/rest/v1/ball?id=eq.${id}`,
      { metodo: 'PATCH', cuerpo: parcial, cabeceras: { Prefer: 'return=representation' } });
    return Array.isArray(filas) ? (filas[0] || null) : null;
  }

  async function saldos() {
    await asegurarSesion();
    const filas = await pedir('/rest/v1/wallet_balance?select=currency,balance') || [];
    const out = { chispas: 0, gemas: 0, fichas: 0 };
    for (const f of filas) out[f.currency] = Number(f.balance) || 0;
    return out;
  }

  // Registrar la partida y cobrarla. Son dos pasos a proposito: la fila de match
  // es el ancla del pago, y award_match_reward es idempotente sobre ella, asi que
  // reintentar el cobro tras una desconexion no paga dos veces (docs/33 seccion 4).
  async function reportarPartida({ mode, format = 'individual', seed = null, place = null, result = {}, chispas = 0, xp = 0, matchId = null }) {
    await asegurarSesion();
    let id = matchId;
    if (!id) {
      const filas = await pedir('/rest/v1/match', {
        metodo: 'POST',
        cuerpo: { player_id: ses.user_id, mode, format, seed, place, result },
        cabeceras: { Prefer: 'return=representation' }
      });
      id = Array.isArray(filas) ? filas[0]?.id : null;
      if (!id) throw new Error('nube: la partida no devolvio id');
    }
    await pedir('/rest/v1/rpc/award_match_reward', {
      metodo: 'POST',
      cuerpo: { p_match_id: id, p_chispas: Math.max(0, Math.round(chispas)), p_xp: Math.max(0, Math.round(xp)) }
    });
    return id;
  }

  async function gastar({ moneda = 'chispas', cantidad, motivo, ref }) {
    await asegurarSesion();
    await pedir('/rest/v1/rpc/spend', {
      metodo: 'POST',
      cuerpo: { p_currency: moneda, p_amount: Math.round(cantidad), p_reason: motivo, p_ref_id: ref }
    });
    return true;
  }

  // ------------------------------------------------------------------- cuenta
  //
  // docs/23: cuenta unica en la nube, y el invitado se convierte SIN perder nada.
  // Email es el unico metodo que no depende de terceros: Google y Meta necesitan
  // sus credenciales y sus tramites (docs/43), asi que llegan despues por el mismo
  // sitio (el modulo ya esta preparado con entrarConProveedor).

  function estadoCuenta() {
    if (!ses) return { entrado: false, anonimo: true, email: null };
    return { entrado: true, anonimo: !!ses.es_anonimo, email: ses.email || null };
  }

  // Convierte la cuenta anonima que ya esta jugando en una permanente. NO crea otra
  // cuenta: es la MISMA (mismo user_id), asi que el progreso no se toca ni se migra.
  async function crearCuentaEmail({ email, password }) {
    await asegurarSesion();
    const u = await pedir('/auth/v1/user', { metodo: 'PUT', cuerpo: { email, password } });
    if (ses) { ses.email = u?.email || email; ses.es_anonimo = false;
      try { store.setItem(SES_KEY, JSON.stringify(ses)); } catch (e) {} }
    return u;
  }

  // Entrar en un aparato nuevo. Sustituye la sesion anonima de ESTE aparato por la
  // del dueno del email; el estado se trae luego por sincro.mjs.
  async function entrarConEmail({ email, password }) {
    const s = await pedir('/auth/v1/token?grant_type=password',
      { metodo: 'POST', cuerpo: { email, password }, conSesion: false });
    guardarSesion(s);
    if (ses) { ses.email = s?.user?.email || email; ses.es_anonimo = false;
      try { store.setItem(SES_KEY, JSON.stringify(ses)); } catch (e) {} }
    return ses;
  }

  async function cambiarPassword(password) {
    await asegurarSesion();
    return await pedir('/auth/v1/user', { metodo: 'PUT', cuerpo: { password } });
  }

  // Recuperar por correo. OJO: hoy el proyecto no tiene servidor de correo propio,
  // asi que esto solo llega de verdad cuando se configure uno (docs/42).
  async function pedirCorreoDeRecuperacion(email) {
    return await pedir('/auth/v1/recover', { metodo: 'POST', cuerpo: { email }, conSesion: false });
  }

  // Google/Meta: el navegador se va a la pantalla del proveedor y vuelve aqui. Queda
  // listo para cuando existan las credenciales; hasta entonces el juego no lo ofrece.
  function urlDeProveedor(proveedor, volverA) {
    const v = encodeURIComponent(volverA || (typeof location !== 'undefined' ? location.href : ''));
    return `${url}/auth/v1/authorize?provider=${encodeURIComponent(proveedor)}&redirect_to=${v}`;
  }

  // ------------------------------------------------------- llevarse la partida
  //
  // El unico camino de recuperar cuenta que no depende de Google ni de Meta
  // (docs/42 Fase 2). El servidor hace el trabajo en supabase/migrations/0005.

  async function crearCodigoTransferencia() {
    await asegurarSesion();
    // Un RPC que devuelve texto llega como cadena JSON, no como objeto.
    return await pedir('/rest/v1/rpc/crear_codigo_transferencia', { metodo: 'POST', cuerpo: {} });
  }

  async function canjearCodigoTransferencia(codigo) {
    await asegurarSesion();
    // Devuelve el estado de juego del origen, ya copiado a esta cuenta.
    return await pedir('/rest/v1/rpc/canjear_codigo_transferencia',
      { metodo: 'POST', cuerpo: { p_code: String(codigo || '').trim().toUpperCase() } });
  }

  return {
    get sesion() { return ses ? { user_id: ses.user_id, es_anonimo: ses.es_anonimo, caduca_en: ses.caduca_en } : null; },
    asegurarSesion, entrarAnonimo, renovar,
    perfil, guardarPerfil, bolas, crearBola, guardarBola, saldos, reportarPartida, gastar,
    crearCodigoTransferencia, canjearCodigoTransferencia,
    estadoCuenta, crearCuentaEmail, entrarConEmail, cambiarPassword, pedirCorreoDeRecuperacion, urlDeProveedor,
    // Solo para pruebas: tirar la sesion local sin tocar la cuenta del servidor.
    olvidarSesion: () => guardarSesion(null)
  };
}
