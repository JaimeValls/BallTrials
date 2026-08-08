// YouBall · CENSO DE SUPERVIVENCIA compartido (canvas/WebGL => sale en el video capturado).
// Una franja FINA arriba con TODAS las bolas del plantel: vivas encendidas, cruzadas con anillo dorado, y las
// que MUEREN quedan TACHADAS en rojo + agrietadas (feedback del dueno 2026-07-18: en estos modos se SOBREVIVE,
// no se puntua). Encabezado "SURVIVORS N" que baja segun caen. Texto en INGLeS (canal anglofono).
//
// COMPACTA a proposito (feedback 2026-07-18 "el menu de arriba es monstruoso, reducelo mucho"): una sola fila
// de fichas pequenas + numero moderado, y la ALTURA en pantalla va CLAMPADA (MAX_FRAC) para que no se infle al
// verla en una ventana apaisada (el video final es 9:16, donde la franja es fina; en apaisado se dispararia).
//
// REUTILIZABLE por los 4 modos: cada modo pasa un clasificador classify(ball) => 'alive' | 'safe' | 'dead'
// (la semantica de rank difiere entre modos). survivors = las que NO estan 'dead'.
//   update(dt, cam, balls, classify)  cada frame; redibuja el lienzo solo cuando cambia el estado.
import * as THREE from 'three';
import { sat } from './gfx.mjs?v=05e5c3d';

const CW = 1500;                // ancho del lienzo (fijo en ambos perfiles)
const CH_TOR = 150;             // alto del lienzo en TORNEO (aspecto 10:1) => franja delgada arriba
const CH_SHORT = 200;           // alto del lienzo en SHORT vertical 9:16 (aspecto 7.5:1) => franja MÁS ALTA y legible
const MAX_FRAC = 0.11;          // altura maxima de la franja como fraccion del alto de pantalla (anti "monstruo" en apaisado)

// scene + TEAMS [+ opts]. Devuelve { update(dt, cam, balls, classify), reset() }.
//   opts.maxFrac  = altura máx como fracción del alto de pantalla (default 0.11 torneo / 0.16 short).
//   opts.maxWFrac = ancho máx como fracción del ancho de pantalla (default 0.965 torneo / 0.985 short). Bajarlo =>
//     franja más compacta en apaisado (feedback Jaime 2026-07-18: "muy grande, tapa demasiado" en Carrusel/Group Up/Bomba).
//   opts.short    = perfil SHORT vertical (feedback Jaime 2026-07-19: en 1080×1920 la franja del torneo sale
//     diminuta). Activa lienzo más alto + fichas/tipografía ~2× + franja ~7% del alto. NO cambia el torneo: con
//     short=false todos los literales quedan byte-idénticos a la versión aprobada 16:9.
export function createCensusBoard(scene, TEAMS, opts = {}){
  const SHORT = !!opts.short;
  const CH   = SHORT ? CH_SHORT : CH_TOR;
  const MAXF = opts.maxFrac != null ? opts.maxFrac : (SHORT ? 0.16 : MAX_FRAC);
  const MAXW = opts.maxWFrac != null ? opts.maxWFrac : (SHORT ? 0.985 : 0.965);
  // Geometría de dibujo por perfil. El bloque `!SHORT` reproduce EXACTAMENTE los literales del torneo aprobado.
  const G = SHORT ? {
    corner: 34, labF: 34, labX: 40, labY: 66, numF: 100, numX: 40, numY: 172, numStroke: 8,
    x0: 330, r: 27, sp: 58, barX: 5, barTop: 44, barPad: 88, barW: 8, tokOx: 34,
  } : {
    corner: 26, labF: 26, labX: 34, labY: 52, numF: 74, numX: 34, numY: 124, numStroke: 6,
    x0: 250, r: 19, sp: 44, barX: 4, barTop: 34, barPad: 68, barW: 6, tokOx: 26,
  };
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const x = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = 11; mesh.visible = false; scene.add(mesh);

  let sig = '';   // firma del estado dibujado => solo redibujamos cuando cambia (muertes/cruces son raras)

  function token(cx, cy, r, hex, state){
    if (state === 'dead'){
      x.globalAlpha = 0.85;
      x.fillStyle = '#2a2632'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.strokeStyle = '#ff2d2d'; x.lineWidth = 4; x.lineCap = 'round';   // X roja compacta
      const s = r * 0.66;
      x.beginPath(); x.moveTo(cx - s, cy - s); x.lineTo(cx + s, cy + s); x.stroke();
      x.beginPath(); x.moveTo(cx + s, cy - s); x.lineTo(cx - s, cy + s); x.stroke();
      x.globalAlpha = 1;
    } else if (state === 'safe'){
      x.fillStyle = hex; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.lineWidth = 3; x.strokeStyle = '#ffd34d'; x.stroke();                          // cruzo: anillo dorado + check
      x.strokeStyle = '#0c0c14'; x.lineWidth = 3.5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - r * 0.4, cy + r * 0.02); x.lineTo(cx - r * 0.05, cy + r * 0.38); x.lineTo(cx + r * 0.46, cy - r * 0.36); x.stroke();
    } else {
      x.fillStyle = hex; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();               // viva: chip solido con brillo
      x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.5)'; x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.30)'; x.beginPath(); x.arc(cx - r * 0.3, cy - r * 0.32, r * 0.26, 0, 7); x.fill();
    }
  }

  function draw(balls, classify, survivors){
    x.clearRect(0, 0, CW, CH);
    // barra fina redondeada, poco intrusiva (no una caja pesada)
    const R = G.corner; x.fillStyle = 'rgba(8,6,14,0.50)';
    x.beginPath(); x.moveTo(R, 6); x.arcTo(CW - 6, 6, CW - 6, CH - 6, R); x.arcTo(CW - 6, CH - 6, 6, CH - 6, R);
    x.arcTo(6, CH - 6, 6, 6, R); x.arcTo(6, 6, CW - 6, 6, R); x.closePath(); x.fill();
    // bloque SURVIVORS a la izquierda (compacto)
    x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#cbb9e6'; x.font = `700 ${G.labF}px system-ui, Segoe UI, sans-serif`;
    x.fillText('SURVIVORS', G.labX, G.labY);
    x.fillStyle = '#ffffff'; x.font = `900 ${G.numF}px system-ui, Segoe UI, sans-serif`;
    x.lineWidth = G.numStroke; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.lineJoin = 'round';
    x.strokeText(String(survivors), G.numX, G.numY); x.fillText(String(survivors), G.numX, G.numY);
    // N grupos de equipo (4 en torneo, hasta 8 en el short individual = colores de 1), cada uno con barra de
    // color + sus bolas en UNA fila. gw/loop derivan de TEAMS.length → con 4 equipos queda byte-idéntico.
    const NT = TEAMS.length;
    const x0 = G.x0, gw = (CW - x0 - 24) / NT, r = G.r, sp = G.sp, cy = CH / 2;
    for (let t = 0; t < NT; t++){
      const c = sat(TEAMS[t].color), hex = `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
      const gx = x0 + t * gw;
      x.fillStyle = hex; x.fillRect(gx + G.barX, G.barTop, G.barW, CH - G.barPad);   // barra vertical fina del equipo
      const mine = balls.filter(b => b.team === t).sort((a, b) => (a.num || 0) - (b.num || 0));
      const ox = gx + G.tokOx;
      for (let k = 0; k < mine.length; k++) token(ox + k * sp, cy, r, hex, classify(mine[k]));
    }
    tex.needsUpdate = true;
  }

  function update(dt, cam, balls, classify){
    if (!balls || !balls.length){ mesh.visible = false; return; }
    let survivors = 0, s = '';
    for (const b of balls){ const st = classify(b); if (st !== 'dead') survivors++; s += st[0]; }
    s += '|' + survivors;
    if (s !== sig){ sig = s; draw(balls, classify, survivors); }
    // pegada al borde superior. Ancho ~ el del encuadre, PERO con la altura CLAMPADA a MAX_FRAC del alto de
    // pantalla (en apaisado la franja se dispararia; asi se mantiene fina y solo se estrecha, nunca engorda).
    const cx = cam.position.x, cy = cam.position.y, vh = (cam.top - cam.bottom), vw = (cam.right - cam.left);
    let w = vw * MAXW, h = w * (CH / CW);
    if (h > vh * MAXF){ const k = (vh * MAXF) / h; w *= k; h *= k; }
    mesh.scale.set(w, h, 1);
    mesh.position.set(cx, cy + vh / 2 - h / 2 - vh * 0.012, 3);
    mesh.visible = true;
  }

  function reset(){ sig = ''; mesh.visible = false; }
  return { update, reset };
}
