/* ============================================================================================
   BallTrials · CATALOGO DE IDIOMAS Y CARGADOR DE PAQUETES        (doc 49 · pase de idiomas)
   ============================================================================================
   POR QUE ESTE FICHERO EXISTE
   El shell (juego.html) llevaba 350 textos en DOS idiomas (es/en) escritos a mano dentro del
   HTML, y los 3 motores otros tantos por su cuenta. Meter 18 idiomas mas por ese camino eran
   ~250 KB extra en el HTML que TODO jugador se descarga para usar UNO. Aqui se parte en dos:
     · este fichero  = el catalogo (que idiomas hay) + el cargador. Pesa nada, se carga siempre.
     · i18n/<l>.js   = los textos de UN idioma. Se descarga SOLO si el jugador usa ese idioma.

   POR QUE SCRIPT CLASICO Y NO MODULO
   juego.html es un <script> clasico y los motores son modulos: un fichero que valga para los dos
   solo puede ser clasico (se inyecta con <script>). De regalo funciona abriendo el juego con
   doble clic (file://), donde import() muere por CORS y nos dejaria el juego en ingles.

   CONTRATO DEL PAQUETE (i18n/<l>.js)  ->  BTI18N.packs.<l> = { shell:{...}, race:{...}, ... }
     shell         los 350 textos de juego.html (mismas claves que SHELL+MORE en ingles)
     race          la tabla del HUD de La Gran Carrera      (motor/race)
     raceTeam      los 4 textos de por-equipos de la carrera
     raceCoach     { done, exit, steps:[...] }  del tutorial de la carrera
     cazador       la tabla del HUD de El Cazador           + cazadorCoach
     redlight      la tabla del HUD de Luz Roja             + redlightCoach
     arranque      el cartel de "MODO / objetivo" comun a los 3 (chassis/arranque.mjs)
     veredicto     el cartel de puesto al terminar          (chassis/veredicto.mjs)
   Lo que falte en un paquete cae al INGLES clave a clave, nunca al español y nunca a "undefined".
   ============================================================================================ */
(function (root) {
  'use strict';

  // ── EL CATALOGO ───────────────────────────────────────────────────────────────────────────
  //  name  el idioma ESCRITO EN SI MISMO: asi lo encuentra quien no entiende la lengua de la app.
  //  html  la etiqueta BCP-47 para <html lang> (accesibilidad, corte de linea, lectores).
  //  nloc  el locale de formato de numero (1.234 / 1,234 / 1 234).
  //  ord   como se dice "el 3.º" en ese idioma. Se ve en el HUD, en Resultados y en el veredicto.
  //  rtl   escribe de derecha a izquierda (solo el arabe, de momento).
  //  font  webfont extra cuando Fredoka no cubre esa escritura (null = con Fredoka basta).
  //  sys   pila de fuentes de sistema para las escrituras que NO llevan webfont (CJK: pesan MB).
  const EN_ORD = function (n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  const LANGS = {
    en:   { name: 'English',            html: 'en',      nloc: 'en-US', ord: EN_ORD },
    es:   { name: 'Español',            html: 'es',      nloc: 'es-ES', ord: n => n + 'º' },
    pt:   { name: 'Português',          html: 'pt-BR',   nloc: 'pt-BR', ord: n => n + 'º' },
    fr:   { name: 'Français',           html: 'fr',      nloc: 'fr-FR', ord: n => (n === 1 ? '1er' : n + 'e') },
    de:   { name: 'Deutsch',            html: 'de',      nloc: 'de-DE', ord: n => n + '.' },
    it:   { name: 'Italiano',           html: 'it',      nloc: 'it-IT', ord: n => n + 'º' },
    nl:   { name: 'Nederlands',         html: 'nl',      nloc: 'nl-NL', ord: n => n + 'e' },
    pl:   { name: 'Polski',             html: 'pl',      nloc: 'pl-PL', ord: n => n + '.' },
    ru:   { name: 'Русский',            html: 'ru',      nloc: 'ru-RU', ord: n => n + '-й',
            font: { fam: 'Nunito', url: 'Nunito:wght@600;700;800;900' } },       // Fredoka no trae cirilico
    tr:   { name: 'Türkçe',             html: 'tr',      nloc: 'tr-TR', ord: n => n + '.' },
    //+AG el numero arabe va en cifras OCCIDENTALES a proposito. 'ar-EG' a secas formatea en cifras
    //   arabe-indigas (٠ ١ ٢) y el juego quedaba con DOS sistemas a la vez en la misma pantalla: las
    //   copas en ٠ (pasan por nfmt) y el nivel y las gemas en 0-9 (no pasan). Mezclar es peor que
    //   elegir; el sufijo -u-nu-latn mantiene el resto del formato arabe y unifica los digitos.
    ar:   { name: 'العربية',              html: 'ar',      nloc: 'ar-EG-u-nu-latn', ord: n => '#' + n, rtl: true,
            font: { fam: 'Baloo Bhaijaan 2', url: 'Baloo+Bhaijaan+2:wght@600;700;800' } },
    hi:   { name: 'हिन्दी',                html: 'hi',      nloc: 'hi-IN', ord: n => n + 'वां',
            font: { fam: 'Baloo 2', url: 'Baloo+2:wght@600;700;800' } },
    th:   { name: 'ไทย',                 html: 'th',      nloc: 'th-TH', ord: n => 'ที่ ' + n,
            font: { fam: 'Mitr', url: 'Mitr:wght@500;600;700' } },
    vi:   { name: 'Tiếng Việt',          html: 'vi',      nloc: 'vi-VN', ord: n => 'thứ ' + n,
            font: { fam: 'Nunito', url: 'Nunito:wght@600;700;800;900' } },
    id:   { name: 'Bahasa Indonesia',   html: 'id',      nloc: 'id-ID', ord: n => 'ke-' + n },
    ms:   { name: 'Bahasa Melayu',      html: 'ms',      nloc: 'ms-MY', ord: n => 'ke-' + n },
    ja:   { name: '日本語',               html: 'ja',      nloc: 'ja-JP', ord: n => n + '位',
            sys: '"Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP","Meiryo"' },
    ko:   { name: '한국어',               html: 'ko',      nloc: 'ko-KR', ord: n => n + '등',
            sys: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Nanum Gothic"' },
    zh:   { name: '简体中文',              html: 'zh-Hans', nloc: 'zh-CN', ord: n => '第' + n + '名',
            sys: '"PingFang SC","Microsoft YaHei","Noto Sans SC","Source Han Sans SC"' },
    zhTW: { name: '繁體中文',              html: 'zh-Hant', nloc: 'zh-TW', ord: n => '第' + n + '名',
            sys: '"PingFang TC","Microsoft JhengHei","Noto Sans TC","Source Han Sans TC"' },
  };

  // ── ELEGIR IDIOMA AL ENTRAR ───────────────────────────────────────────────────────────────
  //  Regla de la casa (feedback Jaime 2026-07-23): por defecto INGLES, nunca español. Solo se
  //  cambia si el navegador pide EXPLICITAMENTE otra cosa que sepamos hablar.
  //  El chino se mira entero (zh-TW/zh-HK/zh-Hant -> tradicional) antes de cortar por las dos
  //  primeras letras, que es lo que colapsaba todo el chino en simplificado.
  function pick(nav) {
    const s = String(nav || 'en').toLowerCase().replace('_', '-');
    if (s.indexOf('zh') === 0) return (/hant|-tw|-hk|-mo/.test(s)) ? 'zhTW' : 'zh';
    if (s.indexOf('pt') === 0) return 'pt';
    const two = s.slice(0, 2);
    if (two === 'in') return 'id';           // el codigo viejo de indonesio que aun mandan algunos Android
    if (two === 'iw') return 'en';           // hebreo: aun no lo hablamos
    return LANGS[two] ? two : 'en';
  }

  // ── CARGA DEL PAQUETE ─────────────────────────────────────────────────────────────────────
  //  Un idioma se pide UNA vez: si se pide dos veces (el selector, y luego el motor) las dos
  //  esperan a la MISMA descarga. Si el fichero no esta o revienta, se resuelve a null y quien
  //  llame se queda en ingles: un idioma que falta nunca puede dejar la pantalla en blanco.
  //+AG la ruta del propio fichero: el shell lo carga como "i18n/idiomas.js" y los motores como
  //   "../../i18n/idiomas.js". Sin esto, el motor pediria los paquetes a motor/race/i18n/*.js.
  const BASE = (function () {
    const me = document.currentScript && document.currentScript.src;
    return me ? me.slice(0, me.lastIndexOf('i18n/')) : '';
  })();

  const packs = {};
  const pending = {};
  function load(l) {
    if (l === 'en' || l === 'es') return Promise.resolve(null);      // van dentro de juego.html
    if (packs[l] !== undefined) return Promise.resolve(packs[l]);
    if (pending[l]) return pending[l];
    if (!LANGS[l]) return Promise.resolve(null);
    pending[l] = new Promise(res => {
      const s = document.createElement('script');
      s.src = BASE + 'i18n/' + l + '.js';
      s.onload = () => { packs[l] = packs[l] || null; res(packs[l]); };
      s.onerror = () => { console.warn('[i18n] no se pudo cargar el idioma', l); packs[l] = null; res(null); };
      document.head.appendChild(s);
    });
    return pending[l];
  }

  // ── FUENTE POR ESCRITURA ──────────────────────────────────────────────────────────────────
  //  Fredoka no dibuja cirilico, arabe ni tailandes, y las CJK como webfont pesan megas. Cada
  //  idioma dice con que se escribe; esto lo pone DELANTE de Fredoka en la pila (var --fam) y,
  //  si hace falta webfont, la pide a Google la primera vez y nunca mas.
  const asked = {};
  function applyFont(l) {
    const d = LANGS[l] || LANGS.en, head = [];
    if (d.font) {
      head.push("'" + d.font.fam + "'");
      if (!asked[d.font.url]) {
        asked[d.font.url] = 1;
        const lk = document.createElement('link');
        lk.rel = 'stylesheet';
        lk.href = 'https://fonts.googleapis.com/css2?family=' + d.font.url + '&display=swap';
        document.head.appendChild(lk);
      }
    }
    if (d.sys) head.push(d.sys);
    const stack = head.concat(["'Fredoka'", "'Segoe UI Rounded'", "'Nunito'", 'system-ui', '-apple-system', 'Arial', 'sans-serif']).join(',');
    document.documentElement.style.setProperty('--fam', stack);
  }

  // ── APLICAR EL IDIOMA AL DOCUMENTO ────────────────────────────────────────────────────────
  //  lang para lectores y corte de linea, dir para el arabe y la fuente de su escritura.
  //  El arabe espeja la INTERFAZ (menus, tienda, perfil), no la PISTA: en los 3 motores el HUD
  //  se queda de izquierda a derecha porque los botones estan atados a lo que pasa en pantalla
  //  (el carril de la izquierda es el de la izquierda), y espejarlos mentiria sobre el juego.
  function applyDoc(l, opts) {
    const d = LANGS[l] || LANGS.en;
    document.documentElement.lang = d.html;
    document.documentElement.dir = (d.rtl && !(opts && opts.noRtl)) ? 'rtl' : 'ltr';
    document.documentElement.classList.toggle('rtl', !!d.rtl && !(opts && opts.noRtl));
    applyFont(l);
  }

  // ── UNA TABLA DEL PAQUETE, YA FUNDIDA SOBRE SU RESPALDO ───────────────────────────────────
  //  La usan los modulos del chasis (arranque.mjs, veredicto.mjs), que tienen su propia tabla en+es
  //  dentro y no saben nada de paquetes. Si el idioma no ha llegado (o no existe) devuelve el
  //  respaldo tal cual, asi que el cartel siempre tiene texto: nunca se queda en blanco esperando.
  //  Se cachea porque esto se llama en cada repintado del cartel, no una vez.
  const fundidas = {};
  function tabla(l, nombre, respaldo) {
    const k = l + '/' + nombre;
    if (fundidas[k]) return fundidas[k];
    const p = packs[l];
    if (!p || !p[nombre]) return respaldo;
    return (fundidas[k] = Object.assign({}, respaldo, p[nombre]));
  }

  root.BTI18N = {
    tabla: tabla,
    LANGS: LANGS, packs: packs, load: load, pick: pick, applyDoc: applyDoc, applyFont: applyFont,
    ord: (n, l) => ((LANGS[l] || LANGS.en).ord)(n),
    nloc: l => (LANGS[l] || LANGS.en).nloc,
    // el idioma que MANDA el shell por ?lang= (los motores nunca miran navigator.language)
    fromUrl: () => { const q = new URLSearchParams(location.search).get('lang'); return (q && LANGS[q]) ? q : 'en'; },
  };
})(window);
