// ============================================================================
//  juice.mjs · LO QUE PASA CUANDO EL DEDO TOCA UN BOTÓN DE PARTIDA.
//              Compartido por los tres motores (Carrera · Cazador · Luz Roja).
//
//  POR QUÉ EXISTE (encargo de Jaime, 2026-08-07, sus palabras): «que cuando se apriete algo sea
//  espectacular, que los botones brillen mucho y te apetezca hacerles click».
//
//  Y no era una impresión suya. Medido con `tools/banco-jugosidad.mjs` sobre los 20 pulsables de los
//  tres HUD, con la partida EN JUEGO:
//
//    · 12 de 20 NO acusaban el toque. Cambiaban de color de estado, o nada.
//    · 3 de ellos —escudo de la Carrera, dash y escudo del Cazador— tenían como ÚNICA reacción
//      visible APAGARSE (opacity .35), porque al dispararse pasan a `disabled`. Eso es, palabra por
//      palabra, lo que el doc 74 diagnosticó del nitro: «lo único que veía el jugador al pulsar era
//      el botón APAGÁNDOSE, y el gesto se leía como no ha pasado nada». Se arregló para el nitro y se
//      dejó igual en todos los demás.
//    · ΔDOM = 0 en los 20: pulsar cualquier botón de partida no creaba ni un elemento en pantalla.
//      El listón que el doc 84 puso para la Tienda es +12.
//
//  LA REGLA QUE IMPLEMENTA ESTE MÓDULO:
//        NINGÚN BOTÓN SE APAGA SIN HABER CANTADO ANTES.
//  Primero el acuse de recibo, y sólo después el estado nuevo. Si el disparo NO prende (enfriamiento,
//  sin existencias), el botón lo dice con `deny()` en vez de comerse el toque en silencio.
//
//  LOS TRES PESOS (la escala del doc 84, recortada a lo que cabe en una partida):
//    roce   · zona / carril / intención — se pulsan cientos de veces: fogonazo corto y CERO partículas.
//             Si el gesto que más se repite hiciera confeti, la pista sería una verbena en 10 segundos.
//    acción · un booster que prende — fogonazo + aro + 10 chispas del color del booster.
//    momento· el SÚPER — lo mismo, más grande y con 18 chispas. Es la jugada más gorda que existe.
//
//  ⚠ APAGADO REAL, NO ANIMACIÓN APAGADA. Con `prefers-reduced-motion` o con «Efectos reducidos»
//  (&redfx=1) no se crea NI UNA chispa. Apagar sólo la animación dejaría los divs congelados encima
//  del HUD, que se ve peor que no tener efecto (doc 84 §3). El fogonazo del botón sí se queda en una
//  versión sin movimiento: el acuse de recibo es información, no decoración.
//
//  ⚠ EL ÁMBITO ES OBLIGATORIO Y ES UNA TRAMPA DE ESPECIFICIDAD, la misma que ya costó una versión
//  muerta en la Carrera (doc 74 §6) y otra en Luz Roja. Las reglas base de los HUD son `#ctr button` y
//  `#controls button` (id + etiqueta), que le ganan a cualquier `.hit` suelto, y `#ctr button:disabled`
//  le gana además a `#ctr .hit`. Por eso el CSS se genera con el ámbito puesto —`#ctr button.j-hit`— y
//  por eso `createJuice()` PIDE el selector del contenedor en vez de adivinarlo.
//
//  ⚠ LAS CHISPAS NO SON HIJAS DEL BOTÓN. `#bSup.ready` lleva `overflow:hidden` (lo necesita el barrido
//  de brillo del súper), así que una partícula dentro del botón se recortaría justo en el botón más
//  importante del juego. Viven en una capa `position:fixed` propia, por encima del HUD y por debajo
//  de los carteles de cuenta atrás y de fin de partida.
//
//  ⚠ SIN AZAR. Los ángulos y los radios salen de dos tablas fijas, igual que en `celebra()` del shell
//  (doc 84 §3). Aquí no es por determinismo de la Sim —esto es render puro y no toca el RNG— sino
//  porque un efecto que a veces sale bonito y a veces sale torcido no se puede juzgar ni corregir.
//
//  USO:
//    import { createJuice } from '../chassis/juice.mjs?v=e491a9a';
//    const juice = createJuice({ ambito:'#ctr', reducido: params.get('redfx')==='1' });
//    juice.hit(btn, { color:'#6fe4ff', peso:'accion' });   // ha prendido
//    juice.deny(btn);                                       // NO ha prendido
//    juice.roce(btn);                                       // zona / carril / intención
// ============================================================================

//+AG 14 ángulos y 14 radios, primos entre sí para que el patrón no se repita a simple vista pero sí
//   sea siempre el mismo. Copiados en espíritu de CEL_ANG/CEL_RAD del shell.
const ANG = [-90, -66, -114, -42, -138, -18, -162, -78, -102, -30, -150, -54, -126, -6];
const RAD = [30, 42, 26, 48, 34, 22, 44, 38, 28, 50, 32, 24, 46, 36];

const PESOS = { roce: 0, accion: 10, momento: 18 };

let capa = null;      // la capa de partículas, una sola para toda la página
let estilo = false;   // el <style> se inyecta una vez aunque se creen varios juice

function inyectaCSS(ambito) {
  const id = 'juice-css-' + ambito.replace(/[^a-z]/gi, '');
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  //+AG el ámbito va DELANTE de la clase (`#ctr button.j-hit`) para ganarle a `#ctr button:disabled`,
  //   que es quien apaga el botón en el mismo instante en que se dispara. Sin esto el fogonazo no se
  //   ve JAMÁS en un booster, que es justo donde hace falta.
  s.textContent = `
  ${ambito} button{ position:relative; }
  /* EL DEDO: se hunde el canto entero y se aprieta un pelin. El :active de antes movia 2px y nada mas.
     OJO: se excluyen LAS DOS formas de estar apagado: .off (la nueva, que sigue oyendo el dedo para
     poder decir que no) y :disabled (la de siempre, en los botones que aun no han migrado).
     Y OJO 2: aqui dentro NO se pueden usar acentos graves — esto es una plantilla de JS y un acento
     grave la cierra. Costo un motor entero sin arrancar. */
  ${ambito} button:active:not(.off):not(:disabled){ filter:brightness(1.18) saturate(1.1); }
  /* EL DISPARO. Escala + brillo + un aro que sale despedido. El aro va en box-shadow y NO en un
     pseudo-elemento a propósito: el ::after de #bSup.ready ya está ocupado por el barrido de brillo, y
     su overflow:hidden recortaría un ::before. Un box-shadow no lo recorta el overflow del elemento. */
  @keyframes jHit{
    0%  { transform:scale(1.15); filter:brightness(2.5) saturate(1.35); }
    45% { transform:scale(.975); filter:brightness(1.25) saturate(1.1); }
    100%{ transform:scale(1);    filter:none; } }
  @keyframes jAro{
    0%  { box-shadow:0 0 0 0 var(--j-tinte), 0 0 24px var(--j-tinte); }
    100%{ box-shadow:0 0 0 15px transparent,  0 0 0 transparent; } }
  ${ambito} button.j-hit{ opacity:1 !important; animation:jHit .30s cubic-bezier(.2,.85,.3,1), jAro .42s ease-out; }
  ${ambito} button.j-roce{ opacity:1 !important; animation:jHit .18s ease-out; }
  /* EL TOQUE QUE NO PRENDE. Hoy el botón en enfriamiento o sin existencias se comía el dedo en
     silencio, que es la peor respuesta posible: idéntica a la de un botón roto. */
  @keyframes jDeny{ 0%,100%{ transform:translateX(0) } 18%{ transform:translateX(-5px) }
                    42%{ transform:translateX(5px) } 66%{ transform:translateX(-3px) } 84%{ transform:translateX(2px) } }
  @keyframes jDenyAro{ 0%{ box-shadow:0 0 0 3px #ff5a52dd } 100%{ box-shadow:0 0 0 3px #ff5a5200 } }
  ${ambito} button.j-deny{ animation:jDeny .28s ease-out, jDenyAro .40s ease-out; }
  /* la capa de chispas: por encima del HUD (z 6) y por debajo de la cuenta atrás (8) y del cartel (10) */
  #jFx{ position:fixed; inset:0; z-index:7; pointer-events:none; overflow:hidden; }
  #jFx .jp{ position:absolute; width:7px; height:7px; border-radius:50%; will-change:transform,opacity; }
  @keyframes jPz{
    0%  { transform:translate(-50%,-50%) scale(1); opacity:1 }
    70% { opacity:.9 }
    100%{ transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.25); opacity:0 } }
  /*+AG el apagado de sistema: aquí sólo hace falta silenciar los latidos, porque las partículas ni
     llegan a crearse (lo decide el JS de abajo). */
  @media (prefers-reduced-motion:reduce){
    ${ambito} button.j-hit, ${ambito} button.j-roce, ${ambito} button.j-deny{ animation:none }
    ${ambito} button.j-hit{ filter:brightness(1.9) } }
  `;
  document.head.appendChild(s);
  estilo = true;
}

export function createJuice({ ambito = "#controls", reducido = false, alNegar = null } = {}) {
  inyectaCSS(ambito);
  //+AG `alNegar` es el SONIDO DEL "NO". Es el único sonido que este módulo pide, y es a propósito:
  //   · el toque que SÍ prende ya suena — lo hace el motor con el efecto de lo que has disparado
  //     (`fx.nitro`, el escudo, el súper), que es más informativo que un clic genérico encima;
  //   · el roce (zona, carril, intención) se repite cientos de veces por partida y un clic en cada uno
  //     sería una ametralladora — es justo el caso que `uisfx.mjs` documenta como "queda por debajo";
  //   · el "no puedo" no sonaba NUNCA, y es el único de los tres que el jugador no puede deducir
  //     mirando la pista, porque en la pista no ha pasado nada. Ahí un sonido no sobra: es el aviso.
  //+AG el ajuste del jugador y el del sistema pesan lo mismo: cualquiera de los dos apaga las chispas.
  const quieto = () => reducido ||
    (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function reinicia(el, cls) {
    //+AG quitar-forzar reflow-poner: sin el `void offsetWidth` la animación NO se reinicia si el botón
    //   se pulsa dos veces seguidas, que en un booster con recarga corta pasa constantemente.
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 460);
  }

  function chispas(el, color, n) {
    if (n <= 0 || quieto()) return 0;
    if (!capa || !capa.isConnected) {
      capa = document.getElementById('jFx');
      if (!capa) { capa = document.createElement('div'); capa.id = 'jFx'; document.body.appendChild(capa); }
    }
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const a = ANG[i % ANG.length] * Math.PI / 180;
      const rad = RAD[i % RAD.length] * (1 + (i / n) * 0.45);
      const p = document.createElement('div');
      p.className = 'jp';
      p.style.cssText =
        `left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;background:${color};` +
        `box-shadow:0 0 8px ${color};` +
        `--dx:${(Math.cos(a) * rad).toFixed(1)}px;--dy:${(Math.sin(a) * rad).toFixed(1)}px;` +
        `animation:jPz ${(420 + i * 16)}ms cubic-bezier(.15,.7,.35,1) ${(i * 7)}ms forwards`;
      p.addEventListener('animationend', () => p.remove());
      //+AG red de seguridad: si la pestaña pierde el foco a mitad, `animationend` no llega nunca y la
      //   chispa se quedaría clavada encima del HUD el resto de la partida. 1,2 s > la más lenta (0,64 s).
      setTimeout(() => p.remove(), 1200);
      frag.appendChild(p);
    }
    capa.appendChild(frag);
    return n;
  }

  return {
    /** El botón ha DISPARADO de verdad. Nunca se llama si el motor no ha confirmado el disparo:
     *  un botón que destella sin hacer nada miente, y esa mentira es el origen de todo esto (doc 74). */
    hit(el, { color = '#ffffff', peso = 'accion' } = {}) {
      if (!el) return;
      el.style.setProperty('--j-tinte', color);
      reinicia(el, 'j-hit');
      return chispas(el, color, PESOS[peso] ?? PESOS.accion);
    },
    /** El dedo ha llegado pero el disparo NO ha prendido (enfriamiento o sin existencias). */
    deny(el) { if (!el) return; reinicia(el, 'j-deny');
      if (alNegar) { try { alNegar(); } catch (e) {} } },   //+AG el audio nunca puede tumbar un toque
    /** Zona, carril, intención: se pulsan sin mirar y cientos de veces. Corto y sin partículas. */
    roce(el, { color = '#ffffff' } = {}) {
      if (!el) return;
      el.style.setProperty('--j-tinte', color);
      reinicia(el, 'j-roce');
    },
    /** El sonido del "no" se enchufa DESPUÉS. El juice se crea junto a los imports, y el AudioContext
     *  del motor no existe hasta bastante más abajo; pedirlo en el constructor obligaría a mover uno de
     *  los dos y a jugársela con el orden de arranque. */
    sonidoNo(fn) { alNegar = fn; },
    /** para el banco y las pruebas: cuántas chispas hay vivas ahora mismo */
    _vivas() { return capa ? capa.children.length : 0; },
  };
}
