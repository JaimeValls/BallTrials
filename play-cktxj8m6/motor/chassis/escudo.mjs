// BallTrials · CHASIS: LA BURBUJA DE ESCUDO (los modos que tienen escudo: Carrera y Cazador).
//
//+AG 2026-08-08 (Jaime, jugando el tutorial de la Gran Carrera): «cuando tienes activado el escudo
//   no sale ningún efecto sobre la bola, por lo cual no sabes si ni siquiera lo has activado. Creo
//   que hablamos el año pasado de que apareciese el escudo encima de la bola».
//
//   Tenía razón y el motivo estaba a la vista en el código: lo ÚNICO que decía "llevas escudo" era
//   que el anillo TU —dos décimas de unidad de grosor, y sólo alrededor de TU bola— se ponía cian
//   en vez de blanco. O sea que el estado de un botón que gastas y que dura 5 segundos se contaba
//   con un cambio de color en la pieza más fina de la pantalla, sobre un fondo que ya es azulado.
//   Y para las bolas RIVALES no se contaba de ninguna manera: te chocabas contra una que rebotaba
//   como un muro sin que nada te hubiera avisado de por qué.
//
//   La burbuja es UNA LÁMINA con textura, no una esfera: en un plano cenital ortográfico una esfera
//   translúcida se ve exactamente igual que un disco y cuesta triángulos y una pasada de orden de
//   transparencia. La lámina va en aditivo, así que SUMA luz en el borde y deja pasar la cara de la
//   bola por el centro — la regla de la casa es que nada tape la cara ([[no-glow-over-faces]]).
//
//   ⚠ EL RELOJ ES EL DE LA SIM, NO EL DEL NAVEGADOR. Se recibe `t` en milisegundos derivados del
//   frame de la sim (simNowF), igual que hace la copa de la celebración: con performance.now() la
//   captura de vídeo saldría con un latido distinto en cada pasada.
import * as THREE from 'three';

const AVISO = 45;   // frames que quedan cuando la burbuja empieza a PARPADEAR (1,5 s a 30 fps)
const POP   = 7;    // frames que dura el golpe de entrada (la burbuja nace grande y se asienta)

//+AG el dibujo: un cristal con el CANTO encendido. El centro se deja casi vacío a propósito (en
//   aditivo, pintar el centro = lavar la cara de la bola). El brillo diagonal de arriba a la
//   izquierda es lo que hace que se lea "esfera de cristal" y no "aro": sin él parece una diana.
function burbujaTextura(){
  const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), h = S / 2, R = h * 0.86;
  // cuerpo: transparente en el centro, subiendo hacia el canto
  //+AG los números salieron de mirar la primera versión montada, no de calcularlos: con el canto al 0,95 y
  //   el relleno al 0,42, el BLOOM del chasis derramaba la luz hacia dentro y la bola quedaba lavada — tu
  //   bola dejaba de tener color mientras llevaras escudo, y el color es lo que dice cuál eres tú. Bajan a
  //   la mitad larga: sigue leyéndose la burbuja a 100 px de pantalla y la bola conserva su tinta.
  const g = x.createRadialGradient(h, h, R * 0.20, h, h, R);
  g.addColorStop(0.00, 'rgba(64,190,255,0)');
  g.addColorStop(0.70, 'rgba(84,216,255,0.04)');
  g.addColorStop(0.90, 'rgba(120,232,255,0.24)');
  g.addColorStop(1.00, 'rgba(190,246,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(h, h, R, 0, Math.PI * 2); x.fill();
  // canto encendido (lo que de verdad dibuja la burbuja a tamaño de partida)
  x.lineWidth = R * 0.075; x.strokeStyle = 'rgba(180,244,255,0.62)';
  x.beginPath(); x.arc(h, h, R * 0.945, 0, Math.PI * 2); x.stroke();
  x.lineWidth = R * 0.20; x.strokeStyle = 'rgba(70,200,255,0.16)';
  x.beginPath(); x.arc(h, h, R * 0.90, 0, Math.PI * 2); x.stroke();
  // reflejo: el arco corto de arriba-izquierda + una chispa. Esto es lo que la vuelve cristal.
  x.lineCap = 'round';
  x.lineWidth = R * 0.11; x.strokeStyle = 'rgba(255,255,255,0.55)';
  x.beginPath(); x.arc(h, h, R * 0.80, Math.PI * 1.06, Math.PI * 1.42); x.stroke();
  x.lineWidth = R * 0.07; x.strokeStyle = 'rgba(255,255,255,0.34)';
  x.beginPath(); x.arc(h, h, R * 0.80, Math.PI * 0.52, Math.PI * 0.68); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// crearEscudos({ scene, radio, n, z, bloom }) → { sync(items, t), reset() }
//   radio  = radio de la bola en unidades de mundo
//   n      = cuántas bolas puede haber (se reserva una lámina por bola: pool fijo, cero basura)
//   z      = profundidad a la que va la lámina (delante de la bola, detrás del anillo TU)
//   bloom  = capa de bloom del chasis (gfx.BLOOM); si se pasa, el canto GLOWEA
//   items[i] = { x, y, quedan }  ·  quedan = frames de escudo que le restan (0 = sin escudo)
//   sync devuelve la LISTA DE ÍNDICES cuyo escudo se acaba de caer en este frame, para que el modo
//   tire sus propias chispas: "se me ha acabado" es información, no un apagón silencioso.
export function crearEscudos({ scene, radio, n, z = 1.0, bloom = null }){
  const tex = burbujaTextura();
  const D = radio * 4.05;   // el canto (0.86 del lienzo) cae a 1.74·radio: envuelve la bola sin comerse a la vecina
  const laminas = [], prev = new Array(n).fill(0), nacio = new Array(n).fill(0);
  for (let i = 0; i < n; i++){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(D, D),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, opacity: 1 }));
    m.visible = false; m.renderOrder = 5;
    if (bloom !== null) m.layers.enable(bloom);
    scene.add(m); laminas.push(m);
  }
  return {
    reset(){ for (let i = 0; i < n; i++){ prev[i] = 0; nacio[i] = 0; laminas[i].visible = false; } },
    sync(items, t){
      const caidos = [];
      for (let i = 0; i < laminas.length; i++){
        const it = items[i], q = it ? (it.quedan | 0) : 0, m = laminas[i];
        if (prev[i] > 0 && q <= 0) caidos.push(i);
        if (prev[i] <= 0 && q > 0) nacio[i] = q;          // arranca el golpe de entrada
        prev[i] = q;
        if (q <= 0 || !it){ m.visible = false; continue; }
        m.visible = true;
        m.position.set(it.x, it.y, z);
        // entrada: nace un 38% más grande y se asienta en POP frames (mismo golpe que usa la copa)
        const k = Math.min(1, (nacio[i] - q) / POP);
        const pop = 1 + 0.38 * (1 - k) * (1 - k);
        // respiración lenta mientras aguanta
        m.scale.setScalar(pop * (1 + 0.035 * Math.sin(t * 0.006)));
        //+AG el aviso NO es que se apague: es que PARPADEA. Un escudo que se desvanece poco a poco
        //   no se distingue de uno que sigue puesto hasta que ya te han pegado; uno que parpadea se
        //   lee como "corre, que se acaba", que es lo que el jugador necesita para decidir.
        const rapido = q <= AVISO;
        m.material.opacity = rapido ? (0.42 + 0.58 * Math.abs(Math.sin(t * 0.022))) : 1;
      }
      return caidos;
    },
  };
}
