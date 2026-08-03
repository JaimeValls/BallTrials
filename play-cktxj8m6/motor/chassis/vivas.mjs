// ============================================================================
//  VIVAS · la bola DE VERDAD, viva, dentro de las pantallas del menu.
//
//  QUE SUSTITUYE Y POR QUE. El Garaje y la Tienda enseñaban un RETRATO PINTADO por bola
//  (`arte/bolas/bola-<clave>-hero.webp`). Ese retrato es arte aparte del motor, asi que cada vez que
//  cambia el personaje hay que repintar doce fichas — y mientras tanto la tienda vende una cosa y la
//  partida entrega otra. El 31-07-2026 la tienda seguia vendiendo un pulpo («Lapa») cuando en pista
//  ya salia un iman. Jaime, mirandolo: «quita la foto estatica, porque no tiene nada que ver con la
//  del gameplay; quiero sencillamente la bola con sus efectos, saltando y haciendo gestos».
//
//  Asi que aqui no se pinta nada nuevo: se monta LA MISMA bola del motor (su material, su accesorio,
//  su aura, su cuerpo si lo tiene, su cara de cuatro capas y el squash & stretch). Lo que promete la
//  tienda pasa a ser, por construccion, lo que entrega la partida. No hay nada que sincronizar.
//
//  EL COLOR NO ES EL DE EQUIPO. En pista tu bola lleva el color de tu equipo, pero en la tienda eso
//  seria mentir sobre el personaje: «la bola chispitas es amarilla, pues dejala amarilla; no la
//  pongas roja, que creo que estas poniendo todas rojas». Aqui manda el color CANONICO del heroe
//  (`arte/bolas-canon.js`, la misma tabla con la que se valida el arte). Y se pasa por `canonUI()`,
//  que sube las cuatro oscuras (Volcan es #1C1A22, casi negro) SIN cambiarles tono ni orden: una
//  bola de basalto sobre carta indigo, a 62 px, simplemente no se veria.
//
//  UN SOLO WebGLRenderer, con viewport + scissor por celda. No es una preferencia: con un renderer
//  por tarjeta, Chromium pasa de ~16 contextos vivos, tira los mas viejos y media pantalla sale en
//  blanco. Es la misma leccion que ya costo la pagina de previsualizacion.
//
//  COMO SE USA desde el shell:
//     import { vivas } from './motor/chassis/vivas.mjs?v=689c6e8';
//     ... pinta `<div class="gi" data-viva="cohete"></div>` en vez del <img> ...
//     vivas.sincroniza();      // despues de cada render de la pantalla
//     vivas.para();            // al salir de la pantalla (deja de gastar bateria)
//  `data-viva-off="1"` en el elemento = bola no comprada: se pinta en gris.
// ============================================================================
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { makeBallVinyl } from './gfx.mjs?v=689c6e8';
import { archLook } from './ballmat.mjs?v=689c6e8';
import { archFace } from './facegen.mjs?v=689c6e8';
import { attachSquash } from './squash.mjs?v=689c6e8';

// El mundo de cada celda. HW es el SEMIANCHO de la camara en radios de bola: cuanto MENOR, mas
// grande sale la bola... y antes lo elegi mirando solo la bola. Error: lo que decide el encuadre no
// es la bola, es EL ACCESORIO, que sobresale mucho mas. A 1.02 se cortaban las burbujas, la
// electricidad y los cuernos — «la imagen se corta» (Jaime, 31-jul).
//
// MEDIDO pieza a pieza (medio-ancho y medio-alto que necesita cada una, en radios, ya con su escala
// y su colocacion de PLACE): la mas ANCHA es Chispa con su aura, **1.58 R**; las mas ALTAS son el
// penacho del Espartano y el gorro del Mago, **1.87 R**. Por eso HW = 1.62 y no un numero a ojo.
//
// Y la camara se DESPLAZA hacia arriba (`CY`): lo que hay que encuadrar va de la sombra en el suelo
// (~-1.05) a la punta del gorro en lo alto del brinco (~+2.1), que no esta centrado en cero. Con la
// camara en cero se malgastaba media vista en suelo vacio y aun asi se cortaba el gorro.
// Como la bola sale mas pequeña con este encuadre, los HUECOS de las cartas crecen a la vez: el
// tamaño en pantalla se mantiene y lo unico que cambia es que ya no se corta nada.
const HW = 1.62, CY = 0.50, R = 0.62, SUELO = -0.86, REPOSO = SUELO + R;

//+AG ENCUADRE POR BOLA. Un encuadre unico para las doce lo tiene que fijar la pieza MAS grande —el
//   aura de Chispa a 1.58 R de ancho, el penacho del Espartano a 1.87 R de alto— y entonces las
//   otras once nadan en su carta. Jaime: «hay mucho espacio vacio, yo haria las bolas mas grandes».
//   Asi que cada bola trae SU caja, medida del propio arte (alfa de base+fx+aura, ya con la escala
//   y el desplazamiento de PLACE aplicados). El precio, dicho claro: los cuerpos NO salen todos del
//   mismo tamaño entre cartas — el Mago, que lleva un gorro altisimo, sale con el cuerpo mas
//   pequeño que el Blindado. A cambio ninguna carta tiene un agujero de aire.
//   Se regenera con la medicion de tools/ (ver el comentario de PIEZA en el commit): si cambia el
//   arte de una pieza, este numero cambia con ella.
const PIEZA = {
  cohete:   [1.10, 1.39, 0.62],   // [medio-ancho, cuanto sube sobre el centro, cuanto baja]
  tanque:   [1.15, 0.94, 0.91],
  chispa:   [1.58, 1.44, 1.36],
  pinball:  [1.02, 1.43, 0.62],
  lapa:     [0.81, 1.32, 0.62],
  burbuja:  [1.36, 1.40, 0.95],
  meteoro:  [0.86, 1.52, 0.62],
  bunker:   [1.09, 1.60, 0.62],
  volcan:   [0.62, 1.86, 0.62],
  yunque:   [0.88, 1.87, 0.62],
  fantasma: [0.63, 0.62, 0.97],
  estrella: [0.94, 1.58, 0.62],
};
const MARGEN = 1.05;             // un pelin de aire: pegar la pieza al borde tambien canta

// Devuelve el encuadre de ESTA bola para una celda de proporcion `agrandado = alto/ancho`:
// {hw, cy}. Cubre desde la sombra en el suelo hasta lo mas alto que llega la pieza EN EL APICE del
// brinco — que es el instante que decide, no la bola en reposo.
function encuadre(arch, aspecto){
  const p = PIEZA[arch] || [R, R, R];
  const arriba = REPOSO + SALTO + p[1];
  const abajo  = Math.min(SUELO - 0.18, REPOSO - p[2]);   // -0.18 = la sombra de contacto
  const cy = (arriba + abajo) / 2;
  const medioV = (arriba - abajo) / 2 * MARGEN;
  const medioH = p[0] * MARGEN;
  return { hw: Math.max(medioH, medioV / Math.max(aspecto, 0.01)), cy };
}
const SALTO = 0.52;              // altura del brinco, en radios
const G_SOMBRA = 0.34;

let REN = null, canvas = null, corriendo = false, celdas = [], ultimo = 0, lazo = 0;
let CAM = null;

function arranca(){
  if (REN) return;
  canvas = document.createElement('canvas');
  canvas.id = 'vivasGL';
  // fija y SIN eventos: se pinta encima del fondo de las cartas pero no roba ni un toque, asi que
  // la carta entera sigue siendo pulsable como cuando era un <img>.
  // z-index 20: por ENCIMA de las cartas y del fondo de pantalla (la escala del shell llega a 6 ahi)
  // y por DEBAJO de todo lo que es chrome —fichas, modales, avisos, que empiezan en 45—. A 3 no se
  // veia NADA: algo de la pantalla pintaba por encima y parecia que el motor no arrancaba.
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:20';
  document.body.appendChild(canvas);
  REN = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  REN.setPixelRatio(Math.min(2, devicePixelRatio || 1));   // a 3 no se nota y en movil se arrastra
  REN.setClearColor(0x000000, 0);
  REN.autoClear = false;
  CAM = new THREE.OrthographicCamera(-HW, HW, HW, -HW, 0.1, 100); CAM.position.z = 10;
  addEventListener('resize', ajusta);
}

function ajusta(){
  if (!REN) return;
  REN.setSize(innerWidth, innerHeight, false);
}

const SOMBRA = (() => {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.24)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

function color(arch){
  const hex = (window.BOLAS_CANON || {})[arch];
  if (!hex || !window.canonUI) return [0.16, 0.42, 1.0];
  return window.canonUI(hex);
}

function construye(el, arch, apagada, i){
  const scene = new THREE.Scene();
  // `data-viva-hw` FIJA el encuadre de una celda a mano y se salta el calculo por bola. Solo para
  // casos raros; lo normal es dejar que `encuadre()` lo mida.
  const hwFijo = el.dataset.vivaHw ? +el.dataset.vivaHw : null;
  // La bola NO COMPRADA se apaga a gris, igual que hacia el filtro CSS del <img> de antes: sigue
  // reconociendose la silueta y el accesorio, pero se lee «esta no es tuya». Se apaga en el COLOR
  // que se le pasa, no tocando el material despues: el vinilo es un shader y hurgarle los uniforms
  // desde fuera es como se rompen estas cosas.
  //   ⚠ y se apaga A MEDIAS, no a gris plano. Con un save nuevo solo UNA de las doce es tuya, asi
  //   que un gris total dejaba el Garaje entero en blanco y negro — justo lo contrario de «la bola
  //   chispitas es amarilla, pues dejala amarilla». Se conserva el TONO y se le baja media
  //   saturacion y algo de brillo, que es exactamente lo que hacia el filtro CSS del retrato viejo
  //   (`grayscale(.5) brightness(.78)`): se sigue viendo de que color es, y se lee que no la tienes.
  //   ⚠⚠ 2-ago: LA FORMULA ANTERIOR NO LLEGABA AL PIXEL. Era `(v*0.5 + luz*0.5) * 0.78`, copiada del
  //   filtro CSS del retrato viejo — pero un filtro CSS se aplica al resultado FINAL y esto es un
  //   tinte que entra ANTES del shader, asi que el especular y el rim light le devuelven casi todo el
  //   brillo que le habiamos quitado. Medido sobre el recorte real de la tarjeta (HSV, excluyendo el
  //   fondo): bloqueada saturacion 0,607 / valor 0,372 contra poseida 0,613 / 0,386. O sea CASI CERO
  //   de diferencia: en pantalla una bola que no tienes se veia igual de viva que la tuya.
  //   Ahora el tinte va casi entero a luminancia y a la mitad de brillo. El especular sigue ahi —no
  //   se le hurgan los uniforms al vinilo, que es la regla de este fichero— pero por debajo queda un
  //   cuerpo gris oscuro, y eso si se lee como «esta no es tuya».
  //   ⚠ NO se valida leyendo estos numeros: se valida MIDIENDO EL RECORTE, que es lo que la formula
  //   anterior no hizo. La prueba esta en tools/prueba-bolas-apagadas.mjs.
  const vivo = color(arch);
  const luz = vivo[0] * 0.299 + vivo[1] * 0.587 + vivo[2] * 0.114;
  const col = apagada ? vivo.map(v => (v * 0.18 + luz * 0.82) * 0.46) : vivo;
  // OJO: `makeBallVinyl` YA monta el accesorio si le llega `arch` (y guarda el handle en `o.prop`).
  // Colgar otro `makeProp` aqui pondria DOS cascos superpuestos — se ve como un borde sucio y cuesta
  // caro averiguar de donde sale.
  //   Y LA OTRA MITAD, que es la que de verdad lo arregla: se le baja la LUZ, no solo el color.
  //   `makeBallVinyl` acepta un `look` (spec, spec2, glow, rim, shade) — es la puerta que el propio
  //   modulo ofrece, asi que esto NO es hurgarle los uniforms al shader por detras: es pasarle otros
  //   parametros. Bajando brillo especular, resplandor propio y luz de contorno, y subiendo la
  //   sombra, el especular deja de rellenar lo que el tinte habia quitado. Con esto la caida de
  //   brillo medida en el pixel pasa de 0,014 (formula vieja) a lo que exija el banco.
  let look = archLook(arch) || undefined;
  if (apagada && look) look = Object.assign({}, look, {
    spec:  (look.spec  || 0) * 0.22,
    spec2: (look.spec2 || 0) * 0.18,
    glow:  (look.glow  || 0) * 0.12,
    rim:   (look.rim   || 0) * 0.30,
    shade: Math.min(1, (look.shade || 0.5) + 0.28) });
  const o = makeBallVinyl(scene, { id: i, color: col }, R, look, arch);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.8, R * 1.1),
    new THREE.MeshBasicMaterial({ map: SOMBRA, transparent: true, depthWrite: false, toneMapped: false }));
  sh.position.set(0, SUELO - R * 0.14, -2); scene.add(sh);
  attachSquash(o, { R, vRef: 5.4, impact: 2.0, tilt: 0.16 });
  // Desfase por tarjeta: doce bolas saltando a la vez parecen un unico bloque, no doce personajes.
  return { el, arch, scene, o, sombra: sh, t: i * 0.37, apagada, hwFijo, caja: contenedor(el) };
}

function destruye(c){
  c.scene.traverse(n => {
    if (n.geometry) n.geometry.dispose();
    if (n.material){ const m = Array.isArray(n.material) ? n.material : [n.material]; m.forEach(x => x.dispose && x.dispose()); }
  });
}

// EL SALTO. Un brinco continuo con su pausa abajo: sin pausa parece una pelota de goma en bucle,
// con pausa parece que el personaje SALTA porque quiere.
//
// ⚠ AQUI ESTABA LA CONVULSION que veia Jaime («el squash hace como una convulsion en la mayoria de
// las bolas»). `squash.mjs` deduce la velocidad de cuanto se ha movido la bola entre fotogramas y
// trata los CAMBIOS BRUSCOS de esa velocidad como impactos. La curva de antes salia disparada desde
// el reposo: en un fotograma pasaba de estar quieta a subir a 2,27 radios/s. Eso es un impacto, y
// otro igual al aterrizar: dos aplastados violentos por ciclo, en las doce bolas a la vez.
//
// MEDIDO antes de elegir, porque mi primer arreglo iba en la direccion contraria — el mayor golpe
// de velocidad de cada curva, fotograma a fotograma:
//     seno con escalon (la vieja) .... 2,27 radios/s, en el DESPEGUE
//     parabola (mi primer intento) ... 2,82 radios/s, en el DESPEGUE   <- peor
//     esta ........................... 1,81 radios/s, en el ATERRIZAJE
//
// Sube con sin² (que arranca con velocidad CERO: la bola se despega, no sale disparada) y cae con
// sin (que sí llega al suelo con velocidad de verdad). En la cima las dos tienen pendiente cero, asi
// que empalman sin costura. Resultado: UN aplastado por ciclo y en el sitio correcto — al aterrizar,
// que es lo unico que de verdad tiene que aplastar una bola.
const CICLO = 1.15, VUELO = 0.72;
function altura(t){
  const u = t % CICLO;
  if (u >= VUELO) return 0;
  const k = u / VUELO, s = Math.sin(k * Math.PI);
  return k < 0.5 ? SALTO * s * s : SALTO * s;
}

function tick(c, dt){
  c.t += dt;
  const h = altura(c.t);
  const x = Math.sin(c.t * 0.8) * 0.10;
  const y = REPOSO + h;
  c.o.g.position.set(x, y, 0);
  c.o.sqUpdate(x, y, dt);
  // GESTO. Se pide con `archFace`, la misma puerta que usa el motor, para que la ceja y la boca sean
  // las suyas y no una cara generica (doc 51).
  //
  // ⚠ ABAJO VA 'neutral', NO 'feliz'. Jaime: «estan con los ojos cerrados y de repente abren los ojos
  // con estrellitas; parecen dormidas». Y tenia razon literal: el preset 'feliz' es `eye:'happy'`, que
  // son los dos ojos CERRADOS en arco (^^). En una carta de 62 px eso no se lee como alegria, se lee
  // como una bola dormida — y el salto la despertaba de golpe con ojos de estrella. Con 'neutral' el
  // ojo es redondo y ABIERTO en todo el reposo, y las estrellitas quedan donde tienen sentido: en el
  // aire, como premio del brinco.
  //
  // De regalo arregla la mayor perdida de caracter frente al retrato (auditoria del 31-jul, punto 1):
  // 'feliz' NO esta en el set REPOSO de facegen, asi que cada heroe solo heredaba el GROSOR de ceja y
  // la forma y la boca caian al preset generico — las doce ponian practicamente la misma cara.
  // 'neutral' SI esta en REPOSO, o sea que entra el modificador ENTERO: vuelve el smirk de Cohete, la
  // boca de matón de Tanque, el guiño de Pinball y el iris de cada uno. Y esto se queda en el MENU:
  // no toca `facegen.mjs`, asi que el atlas del motor, el torneo y el video no se mueven.
  const alto = h > SALTO * 0.45;
  c.o.setExpr(archFace(c.arch, alto ? 'extasis' : 'neutral'));
  const k = Math.max(0, h / SALTO);
  c.sombra.scale.set(1 - G_SOMBRA * k, 1 - G_SOMBRA * k, 1);
  c.sombra.material.opacity = 1 - 0.6 * k;
}

// El contenedor que hace scroll. Se busca UNA vez por celda y se guarda: es el que define hasta
// donde puede verse la bola.
function contenedor(el){
  for (let e = el.parentElement; e; e = e.parentElement){
    const ov = getComputedStyle(e).overflowY;
    if (ov === 'auto' || ov === 'scroll') return e;
  }
  return null;
}

function pinta(c){
  const r = c.el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  if (r.bottom < 0 || r.top > innerHeight) return;         // fuera de pantalla: ni se pinta
  const w = r.width, hgt = r.height;
  const abajo = innerHeight - r.bottom;
  // El VIEWPORT es la celda entera (manda la proyeccion) y el SCISSOR se recorta a lo que de verdad
  // se ve. Y «lo que se ve» es lo que cabe DENTRO de la rejilla que hace scroll, no de la ventana:
  // el lienzo esta por encima de la barra de pestañas, asi que sin este recorte una carta a medio
  // salir por abajo pintaba su bola ENCIMA de las pestañas. Es la misma trampa del viewport contra
  // el scissor de la pagina de previsualizacion, con otro disfraz.
  const caja = c.caja ? c.caja.getBoundingClientRect() : null;
  const tope  = Math.min(abajo + hgt, caja ? innerHeight - caja.top : innerHeight);
  const suelo = Math.max(abajo, caja ? innerHeight - caja.bottom : 0);
  if (tope - suelo <= 0) return;
  REN.setViewport(r.left, abajo, w, hgt);
  REN.setScissor(r.left, suelo, w, tope - suelo);
  REN.setScissorTest(true);
  // El encuadre se calcula con la proporcion REAL de la celda, aqui y cada frame: la misma bola en
  // la carta del Garaje y en la ficha grande tiene cajas distintas, y el CSS puede cambiarlas.
  const e = c.hwFijo != null ? { hw: c.hwFijo, cy: CY } : encuadre(c.arch, hgt / w);
  const vv = e.hw * hgt / w;
  CAM.left = -e.hw; CAM.right = e.hw; CAM.top = e.cy + vv; CAM.bottom = e.cy - vv;
  CAM.updateProjectionMatrix();
  REN.render(c.scene, CAM);
}

function frame(now){
  if (!corriendo) return;
  const dt = Math.min(0.05, (now - ultimo) / 1000); ultimo = now;
  ajusta();
  REN.setScissorTest(false); REN.clear();
  for (const c of celdas){ tick(c, dt); pinta(c); }
  lazo = requestAnimationFrame(frame);
}

export const vivas = {
  // Rehace las celdas a partir de lo que hay AHORA en el DOM. Se llama despues de cada render de
  // pantalla: el shell repinta el Garaje entero con innerHTML, asi que los elementos viejos ya no
  // existen y quedarse con ellos seria pintar bolas en coordenadas de la nada.
  //   `raiz` limita a un subarbol y `z` sube el lienzo. Existe por la FICHA de la bola, que es un
  //   overlay a z-index 45: con el lienzo a 20 su bola quedaba debajo del velo y no se veia, y
  //   subirlo sin mas habria sacado las doce bolas de la rejilla por encima del velo. Cuando la
  //   ficha esta abierta se monta SOLO su bola y el lienzo sube; al cerrarla se vuelve a la rejilla.
  sincroniza(raiz, z){
    arranca();
    if (z !== undefined) canvas.style.zIndex = z;
    const nodos = [...(raiz || document).querySelectorAll('[data-viva]')].filter(n => n.offsetParent !== null);
    celdas.forEach(destruye);
    celdas = nodos.map((n, i) => construye(n, n.dataset.viva, n.dataset.vivaOff === '1', i));
    if (!celdas.length){ this.para(); return; }
    if (!corriendo){ corriendo = true; ultimo = performance.now(); lazo = requestAnimationFrame(frame); }
  },
  para(){
    corriendo = false;
    if (lazo) cancelAnimationFrame(lazo), lazo = 0;
    celdas.forEach(destruye); celdas = [];
    if (REN){ REN.setScissorTest(false); REN.clear(); }
  },
  // sonda para verificar sin ojos: cuantas bolas vivas hay, si el WebGL arranco y donde esta cada una
  info(){
    return { celdas: celdas.length, gl: !!(REN && REN.getContext()), corriendo,
      // `sq` = cuanto esta aplastada AHORA, leido de la ESCALA DEL CUERPO. ⚠ No sirve `o.squash`:
      // ese campo es la ENTRADA (el golpe que le mandan los modos) y `squash.mjs` lo consume y lo
      // pone a cero en el mismo frame, asi que leerlo da 0 siempre. El estado real vive en una
      // closure; lo unico observable desde fuera es lo que acaba en la malla.
      // Si entre dos muestras seguidas `sq` pega un salto grande, la curva del brinco tiene un escalon.
      bolas: celdas.map(c => ({ k: c.arch, y: +c.o.g.position.y.toFixed(3),
        sq: +(c.o.body.scale.y / (c.o.body.scale.x || 1)).toFixed(4),
        prop: !!c.o.prop, cuerpo: !!(c.o.cuerpo && c.o.cuerpo.visible),
        col: c.o.col && c.o.col.map(v => +v.toFixed(2)) })) };
  }
};
