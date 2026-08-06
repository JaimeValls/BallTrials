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

  // Con que ha entrado este usuario: ['google'], ['email'], ['anonymous']... GoTrue lo dice en
  // app_metadata (provider = el primero, providers = todos) y, si no, en la lista de identidades.
  function proveedoresDe(u) {
    if (!u) return null;
    const am = u.app_metadata || {};
    let ps = Array.isArray(am.providers) ? am.providers : (am.provider ? [am.provider] : null);
    if (!ps && Array.isArray(u.identities)) ps = u.identities.map(i => i && i.provider);
    return Array.isArray(ps) ? ps.filter(Boolean) : null;
  }

  function guardarSesion(s) {
    // expires_in viene en segundos; lo pasamos a instante absoluto para poder
    // decidir si hay que renovar sin volver a preguntar al servidor.
    //
    // OJO con email/proveedores: se HEREDAN de la sesion anterior cuando la respuesta no
    // trae usuario (la vuelta de OAuth solo trae tokens) o cuando trae el MISMO usuario (un
    // refresco). Antes no se heredaban y un simple renovar() borraba el correo: el jugador
    // con cuenta guardada volvia al dia siguiente y Perfil le decia "estas jugando como
    // invitado". Si el usuario es OTRO no se hereda nada, que seria contarle una mentira.
    const mismoUsuario = !s?.user?.id || !ses?.user_id || s.user.id === ses.user_id;
    const heredado = k => (mismoUsuario && ses ? ses[k] : null);
    ses = s ? {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      user_id: s.user?.id || ses?.user_id || null,
      es_anonimo: s.user?.is_anonymous ?? ses?.es_anonimo ?? true,
      email: (s.user && s.user.email) || heredado('email') || null,
      proveedores: proveedoresDe(s.user) || heredado('proveedores') || null,
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

  // --------------------------------------------------------------- captcha
  //
  // Freno de altas anonimas (docs/42 s17). Va aqui dentro y no en juego.html para
  // que TODO el que use esta capa lo herede sin cambiar su codigo, incluidas las
  // baterias de prueba. Apagado por defecto: con la sitekey vacia, captcha.mjs
  // devuelve null siempre y el cuerpo de la peticion sale identico a como salia
  // antes de que esto existiera.
  //
  // opts.captcha admite: una funcion async que devuelve la ficha, un objeto con
  // .token(), o null/false para apagarlo del todo (lo que hacen las pruebas que
  // quieren el camino sin captcha).
  const captchaOpt = opts.captcha;
  let captchaPorDefecto;

  async function fichaCaptcha() {
    try {
      if (captchaOpt === null || captchaOpt === false) return null;
      if (typeof captchaOpt === 'function') return (await captchaOpt()) || null;
      if (captchaOpt && typeof captchaOpt.token === 'function') return (await captchaOpt.token()) || null;
      if (captchaPorDefecto === undefined) {
        const m = await import('./captcha.mjs?v=b812e3b');
        captchaPorDefecto = m.crearCaptcha();
      }
      return (await captchaPorDefecto.token()) || null;
    } catch (e) {
      // Nunca reventar el arranque por el captcha: sin ficha, que el servidor
      // decida. Si esta exigido, el alta falla y el juego sigue en local.
      return null;
    }
  }

  // GoTrue espera la ficha aqui dentro; es el mismo sitio donde la mete el SDK
  // oficial (auth-js: gotrue_meta_security.captcha_token).
  async function conCaptcha(cuerpo) {
    const ficha = await fichaCaptcha();
    return ficha ? { ...cuerpo, gotrue_meta_security: { captcha_token: ficha } } : cuerpo;
  }

  // ---------------------------------------------------------------- sesion

  async function entrarAnonimo() {
    // El equivalente de signInAnonymously() del SDK: un signup sin credenciales.
    const s = guardarSesion(await pedir('/auth/v1/signup',
      { metodo: 'POST', cuerpo: await conCaptcha({ data: {} }), conSesion: false }));
    await marcarSiEsPrueba();
    return s;
  }

  // ------------------------------------------------------- cuentas de prueba
  //
  // docs/53. El juego SOLO corre en un navegador, asi que una sesion creada desde
  // Node es por definicion una bateria de tools/db o una herramienta, no una persona.
  // Se marca sola y el informe la excluye. Se arregla aqui, en el unico sitio por el
  // que nacen todas, y no bateria a bateria: de las 9 que crean usuarios solo una se
  // acordaba de marcarse, y por eso habia 294 fantasmas envenenando todos los ratios.
  // El caso del navegador es tools/captura-pantalla.mjs, que abre el juego DE VERDAD
  // contra la base de produccion en cada captura: pide el marcado con ?bt_test=1.
  //
  // No es una barrera de seguridad y no hace falta que lo sea: marcarse como prueba
  // solo te quita de las estadisticas, no da nada. Y nunca puede tumbar el arranque.
  function esPrueba() {
    try {
      if (typeof window === 'undefined') return true;
      return /[?&]bt_test=1\b/.test(String(window.location?.search || ''));
    } catch (e) { return false; }
  }

  async function marcarSiEsPrueba() {
    if (!esPrueba() || !ses?.user_id) return;
    try { await pedir(`/rest/v1/player?id=eq.${ses.user_id}`, { metodo: 'PATCH', cuerpo: { is_test: true } }); }
    catch (e) { /* si no se puede marcar, se sigue: es telemetria, no el juego */ }
  }

  // Sin captcha a proposito, y no es un olvido: refresh_token no es un endpoint
  // protegido (el SDK oficial tampoco le manda ficha). Gracias a eso el captcha
  // solo puede aparecer en la PRIMERA carga de un aparato nuevo; quien ya jugo
  // vuelve por aqui y no ve nada ni carga el script de Cloudflare.
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

  // ------------------------------------------------------------- metricas
  //
  // docs/52 (catalogo en docs/24). Dos diferencias con reportarPartida, a proposito:
  //   1. apuntarPartida SOLO inserta la fila de match, sin cobrar nada. En Fase 1
  //      la economia vive en el cliente (0004); cobrar aqui seria pagar dos veces.
  //      reportarPartida queda para la Fase 3, cuando el servidor mande.
  //   2. Fire-and-forget de verdad: Prefer minimal (no nos hace falta el id) y
  //      quien llama NUNCA espera esto para seguir. La Regla de Oro de esta capa
  //      aplica doble a las metricas: medir jamas puede estorbar al juego.
  async function apuntarPartida({ mode, format = 'individual', seed = null, place = null, result = {} }) {
    await asegurarSesion();
    await pedir('/rest/v1/match', {
      metodo: 'POST',
      cuerpo: { player_id: ses.user_id, mode, format, seed, place, result },
      cabeceras: { Prefer: 'return=minimal' }
    });
  }

  // Evento ligero de shell (session_start, screen_view...). La lista blanca de
  // nombres vive en la base (0008): un nombre fuera de ella rebota con 23514.
  async function apuntarEvento(nombre, props) {
    await asegurarSesion();
    await pedir('/rest/v1/app_event', {
      metodo: 'POST',
      cuerpo: { player_id: ses.user_id, name: nombre, props: props || {} },
      cabeceras: { Prefer: 'return=minimal' }
    });
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

  // google/facebook salen aparte del email porque el juego los ANUNCIA distinto: "estas dentro
  // con tu cuenta de Google" no es lo mismo que "cuenta guardada con este correo".
  function estadoCuenta() {
    if (!ses) return { entrado: false, anonimo: true, email: null, proveedores: [], google: false };
    const ps = Array.isArray(ses.proveedores) ? ses.proveedores : [];
    //+AG `facebook` se saca igual que `google`: la pantalla de cuenta tiene que poder decir CON QUE
    //   ha entrado el jugador, y sin este dato Facebook caia en el caso "correo" y se pintaba con el
    //   sobre de la casa — daba la sensacion de no estar logueado con Facebook (Jaime, 6-ago).
    return { entrado: true, anonimo: !!ses.es_anonimo, email: ses.email || null,
             proveedores: ps, google: ps.indexOf('google') >= 0, facebook: ps.indexOf('facebook') >= 0 };
  }

  // Quien soy SEGUN EL SERVIDOR, y de paso se pone al dia la sesion guardada. Hace falta para
  // una sesion escrita antes de que existieran email/proveedores, o cuando se enlazo un
  // proveedor desde otra pestana. Una peticion, y solo la pide quien la necesita.
  async function refrescarUsuario() {
    await asegurarSesion();
    const u = await pedir('/auth/v1/user');
    if (ses && u) {
      ses.user_id = u.id || ses.user_id;
      ses.email = u.email || null;
      ses.es_anonimo = !!u.is_anonymous;
      ses.proveedores = proveedoresDe(u) || [];
      try { store.setItem(SES_KEY, JSON.stringify(ses)); } catch (e) { /* sin persistencia */ }
    }
    return estadoCuenta();
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
      { metodo: 'POST', cuerpo: await conCaptcha({ email, password }), conSesion: false });
    guardarSesion(s);
    if (ses) { ses.email = s?.user?.email || email; ses.es_anonimo = false;
      try { store.setItem(SES_KEY, JSON.stringify(ses)); } catch (e) {} }
    return ses;
  }

  // Cerrar sesion. Invalida el token en el servidor y borra la sesion local. Quien llama
  // se encarga del save del aparato: este modulo no sabe nada del juego. OJO: solo tiene
  // sentido con la cuenta guardada; cerrar la de un invitado seria tirar su partida.
  async function salir() {
    try { await pedir('/auth/v1/logout', { metodo: 'POST', cuerpo: {} }); }
    catch (e) { /* si el token ya no vale, da igual: lo que manda es soltarlo aqui */ }
    return guardarSesion(null);
  }

  async function cambiarPassword(password) {
    await asegurarSesion();
    return await pedir('/auth/v1/user', { metodo: 'PUT', cuerpo: { password } });
  }

  // Recuperar por correo. OJO: hoy el proyecto no tiene servidor de correo propio,
  // asi que esto solo llega de verdad cuando se configure uno (docs/42).
  async function pedirCorreoDeRecuperacion(email) {
    return await pedir('/auth/v1/recover',
      { metodo: 'POST', cuerpo: await conCaptcha({ email }), conSesion: false });
  }

  // Google/Meta: el navegador se va a la pantalla del proveedor y vuelve aqui. ENTRAR
  // por aqui es entrar en la cuenta de ESE Google, que puede no ser la que esta jugando.
  function urlDeProveedor(proveedor, volverA) {
    const v = encodeURIComponent(volverA || (typeof location !== 'undefined' ? location.href : ''));
    return `${url}/auth/v1/authorize?provider=${encodeURIComponent(proveedor)}&redirect_to=${v}`;
  }

  // ENLAZAR es lo que pide docs/23: el invitado que ya esta jugando se ELEVA a cuenta
  // permanente, mismo user_id, cero migracion, imposible perder progreso. El navegador
  // no puede mandar la cabecera de sesion en una redireccion, asi que se pide la URL
  // por fetch (skip_http_redirect) y se navega a mano. Necesita "Allow manual linking"
  // encendido en el proyecto; si no lo esta, esto lanza y quien llama cae a urlDeProveedor.
  async function urlDeEnlace(proveedor, volverA) {
    await asegurarSesion();
    const v = encodeURIComponent(volverA || (typeof location !== 'undefined' ? location.href : ''));
    const r = await pedir(`/auth/v1/user/identities/authorize?provider=${encodeURIComponent(proveedor)}&redirect_to=${v}&skip_http_redirect=true`);
    return (r && r.url) || null;
  }

  // La vuelta del proveedor: GoTrue deja los tokens en el FRAGMENTO (#access_token=...),
  // o el fallo en #error_description. Se adopta como sesion y se limpia la barra de
  // direcciones, para no dejar tokens a la vista ni en el historial. Devuelve null si
  // no hay nada que adoptar, que es el caso de todos los arranques normales.
  //
  //+AG EL FALLO VUELVE POR DOS SITIOS, Y MIRAR SOLO UNO SALE CARO (visto el 2026-07-27 con
  //   Facebook): cuando GoTrue revienta DENTRO de /callback -- secreto mal pegado, identidad
  //   ya enlazada a otra cuenta -- no llega a montar fragmento y redirige con ?error=... en la
  //   QUERY. Se miraba solo el fragmento, asi que la vuelta se leia como un arranque normal:
  //   el jugador volvia al juego como invitado y NADIE le decia que su login habia fallado.
  async function adoptarSesionDeUrl(loc) {
    const l = loc || (typeof location !== 'undefined' ? location : null);
    if (!l) return null;
    const frag  = (l.hash   && l.hash.length   > 1) ? new URLSearchParams(l.hash.slice(1))   : null;
    const query = (l.search && l.search.length > 1) ? new URLSearchParams(l.search.slice(1)) : null;
    const errF = frag  && (frag.get('error_description')  || frag.get('error'));
    const errQ = query && (query.get('error_description') || query.get('error'));
    const err = errF || errQ || null;
    const at = frag && frag.get('access_token');
    if (!at && !err) return null;   // un ancla cualquiera, no una vuelta de login
    limpiarUrl(l, !!errQ);
    if (err) return { error: err };
    const antes = ses && ses.user_id ? ses.user_id : null;
    //+AG frag, NO p: el renombrado de arriba (p -> frag/query) se dejo esta linea sin tocar y la
    //   vuelta BUENA de Google reventaba con "p is not defined" justo antes de guardar la sesion.
    //   El jugador volvia del proveedor y se quedaba de invitado, sin aviso: el fragmento ya se
    //   habia limpiado, asi que recargar tampoco lo salvaba.
    guardarSesion({ access_token: at, refresh_token: frag.get('refresh_token'), expires_in: +frag.get('expires_in') || 3600 });
    // Quien es de verdad lo dice el servidor, no el fragmento.
    try {
      const u = await pedir('/auth/v1/user');
      if (ses) {
        ses.user_id = (u && u.id) || ses.user_id;
        ses.email = (u && u.email) || null;
        ses.es_anonimo = !!(u && u.is_anonymous);
        ses.proveedores = proveedoresDe(u) || [];
        try { store.setItem(SES_KEY, JSON.stringify(ses)); } catch (e) { /* sin persistencia */ }
      }
    } catch (e) { /* la sesion sirve igual; el correo se pinta en el siguiente arranque */ }
    const ahora = ses && ses.user_id ? ses.user_id : null;
    return { antes, user_id: ahora, email: (ses && ses.email) || null, mismo: !!antes && antes === ahora };
  }

  //+AG tambienQuery: el fallo venia en ?error=..., asi que la query se va con el. Si no, queda
  //   en la barra y en el historial, y una recarga vuelve a disparar el mismo aviso de fallo.
  function limpiarUrl(l, tambienQuery) {
    try {
      const destino = l.pathname + (tambienQuery ? '' : l.search);
      if (typeof history !== 'undefined' && history.replaceState) history.replaceState(null, '', destino);
      else l.hash = '';
    } catch (e) { /* si no se puede, el token queda en la barra: feo, no roto */ }
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
    apuntarPartida, apuntarEvento,
    crearCodigoTransferencia, canjearCodigoTransferencia,
    estadoCuenta, refrescarUsuario, crearCuentaEmail, entrarConEmail, salir, cambiarPassword, pedirCorreoDeRecuperacion,
    urlDeProveedor, urlDeEnlace, adoptarSesionDeUrl,
    // Solo para pruebas: tirar la sesion local sin tocar la cuenta del servidor.
    olvidarSesion: () => guardarSesion(null)
  };
}
