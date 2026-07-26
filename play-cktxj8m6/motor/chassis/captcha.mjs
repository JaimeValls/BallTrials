// captcha.mjs - BallTrials - freno de altas anonimas - docs/42 seccion 17
//
// POR QUE EXISTE. La cuenta anonima se crea sola al cargar la pagina, sin pedirle
// nada al jugador. Eso es justo lo que queremos para "jugar primero SIEMPRE", pero
// tambien significa que fabricar identidades es gratis: la jornada de pruebas del
// 26-07-2026 creo 120 cuentas anonimas en un dia desde una sola maquina, sin
// intentar abusar. El unico freno hoy es el limite por IP de Supabase (30 altas
// por hora), que es basto: no distingue a un jugador de un bot y una IP rotada lo
// esquiva. Esto pone un freno que si distingue.
//
// POR QUE TURNSTILE Y NO hCAPTCHA. Supabase acepta los dos. hCaptcha manda puzzles
// de imagenes; el publico de este juego tiene entre 7 y 12 anos y eso es un muro.
// Turnstile en modo 'interaction-only' no ensena nada salvo que sospeche de ti, y
// la propia documentacion de Supabase recomienda "invisible CAPTCHA or Cloudflare
// Turnstile" para las altas anonimas.
//
// APAGADO POR DEFECTO, A PROPOSITO. Con TURNSTILE_SITEKEY vacio este modulo no
// carga nada, no toca el DOM y devuelve null siempre, asi que el juego se comporta
// exactamente igual que antes de que existiera. Se enciende poniendo la sitekey, y
// SOLO DESPUES se activa el interruptor del panel de Supabase (ver docs/42 s17: al
// reves rompe el juego para todo aparato nuevo).
//
// REGLA DE ORO, la misma que nube.mjs: esta capa NUNCA es imprescindible. Si
// Cloudflare tarda o no responde, se agota el tope y devolvemos null en vez de
// dejar la pantalla 1 colgada. El alta fallara despues y el juego seguira con
// localStorage, que es la degradacion que ya estaba disenada.
//
// Sin acentos a proposito, igual que nube.mjs.

// Sitekey PUBLICA de Turnstile (widget "BallTrials juego", hostnames balltrials.com
// y www.balltrials.com, modo Managed). Es publica por diseno, igual que NUBE_KEY:
// viaja en el cliente y cualquiera puede leerla. Lo que valida de verdad es la
// clave SECRETA, que vive solo en el panel de Supabase y no entra aqui jamas.
//
// Vacia = captcha apagado del todo. Con clave, el navegador empieza a mandar fichas,
// que es INOFENSIVO mientras el interruptor de Supabase siga apagado: comprobado el
// 26-07-2026 mandando una ficha de mentira a /auth/v1/signup con la proteccion
// desactivada, y contesta 200 ignorandola. Por eso este orden es seguro: primero
// desplegar esto y ver que las fichas viajan, y solo despues encender el panel.
export const TURNSTILE_SITEKEY = '0x4AAAAAAD-Wy0gh4sTjZE0g';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Tope de paciencia. Es el retraso maximo que este modulo puede meter en la primera
// pantalla del juego, asi que va corto a proposito.
const TOPE_MS = 8000;

// Una promesa por documento, no una por llamada: el script se carga una sola vez
// aunque pidamos varias fichas.
let cargaEnCurso = null;

function conTope(promesa, ms, alFallar = null) {
  return new Promise(resolve => {
    let resuelto = false;
    const listo = v => { if (!resuelto) { resuelto = true; resolve(v); } };
    const reloj = setTimeout(() => listo(alFallar), ms);
    Promise.resolve(promesa)
      .then(v => { clearTimeout(reloj); listo(v); })
      .catch(() => { clearTimeout(reloj); listo(alFallar); });
  });
}

function cargarScript(doc) {
  if (cargaEnCurso) return cargaEnCurso;
  cargaEnCurso = new Promise(resolve => {
    if (doc.defaultView && doc.defaultView.turnstile) return resolve(doc.defaultView.turnstile);
    const s = doc.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve((doc.defaultView && doc.defaultView.turnstile) || null);
    s.onerror = () => resolve(null);
    doc.head.appendChild(s);
  });
  return cargaEnCurso;
}

function cajaInvisible(doc) {
  // Turnstile necesita un contenedor aunque no ensene nada. Va centrado y por
  // encima de todo para que, EN EL CASO RARO de que decida preguntar, el jugador
  // vea el desafio en vez de un juego que no arranca sin motivo aparente.
  const d = doc.createElement('div');
  d.setAttribute('data-bt', 'captcha');
  d.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99999';
  doc.body.appendChild(d);
  return d;
}

export function crearCaptcha(opts = {}) {
  const sitekey = opts.sitekey !== undefined ? opts.sitekey : TURNSTILE_SITEKEY;
  const tope = opts.topeMs || TOPE_MS;
  const doc = opts.document !== undefined
    ? opts.document
    : (typeof document !== 'undefined' ? document : null);

  const activo = !!sitekey && !!(doc && doc.head && doc.body);

  // Devuelve una ficha de un solo uso, o null si el captcha esta apagado, no hay
  // DOM (Node, las baterias de prueba) o algo ha fallado. NUNCA lanza: quien la
  // llama esta en el camino critico de arrancar el juego.
  async function token() {
    if (!activo) return null;
    try {
      const ts = await conTope(cargarScript(doc), tope);
      if (!ts || typeof ts.render !== 'function') return null;

      const caja = cajaInvisible(doc);
      let id = null;
      const ficha = await conTope(new Promise(resolve => {
        id = ts.render(caja, {
          sitekey,
          appearance: 'interaction-only',
          callback: resolve,
          'error-callback': () => resolve(null),
          'timeout-callback': () => resolve(null),
          'expired-callback': () => resolve(null)
        });
      }), tope);

      try { if (id !== null && typeof ts.remove === 'function') ts.remove(id); } catch (e) { /* da igual */ }
      try { caja.remove(); } catch (e) { /* da igual */ }
      return ficha || null;
    } catch (e) {
      return null;
    }
  }

  return { token, get activo() { return activo; } };
}

// Solo para las pruebas: olvidar el script ya cargado.
export function _olvidarCarga() { cargaEnCurso = null; }
