// ============================================================================
//  SIM CANÓNICA de La Gran Carrera del JUEGO (BallTrials GAME).
//  Origen: la Sim inline de prototipo/carrera.html (l.106-604), extraída aquí
//  1:1 como módulo ES para el player WebGL vendorizado del canal (docs/21 §9).
//  Base: port FIEL de prototipo-webgl/race/sim.js (canal) + capa de agencia
//  iterada v0.2..v0.14 marcada //+AG (zonas, peso, un-rest, aspas, plataformas,
//  boosters, súper). carrera.html queda CONGELADO como referencia; esta es la
//  fuente de verdad a partir de ahora. Verificada con tracker/fairness (docs/33).
//  Cambios respecto al inline, todos //+AG: exports del módulo, getter scale,
//  y emisión de EVENTOS por frame (observación pura, sin RNG, sin tocar física).
// ============================================================================
'use strict';
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
class RNG{ constructor(seed){ this._r=mulberry32((seed>>>0)||1); } random(){ return this._r(); }
  uniform(a,b){ return a+(b-a)*this._r(); } range(n){ return Math.floor(this._r()*n); }
  shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(this._r()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; } }
const hyp=(a,b)=>Math.sqrt(a*a+b*b);
//+AG v0.13 triángulo con signo por FASE ENTERA (sin trig, determinista): -1 en ph=0, +1 en ph=medio, -1 en ph=period.
//   Patrón de movimiento lineal del gauntlet (fase entera + interpolación con literales) para las plataformas móviles.
function triS(clock,period){ const ph=((clock%period)+period)%period, h=period/2; return ph<h ? ph/h*2-1 : 1-(ph-h)/h*2; }

const GATE_H=0.55, GATE_HH=GATE_H/2, N_BARRIERS=3, GATE_NT=6, GATE_REST=0.36, TILE_HP=32;
const FPS=30, SUBSTEPS=8, DT=1/(FPS*SUBSTEPS);
//+AG v0.7 (feedback Jaime "peso e inercia"): rebotes que cuestan energía + fricción tangencial + drag lateral
//   algo mayor → la bola se frena, re-acelera, "pesa"; menos goma/pogo. Determinista (solo constantes).
//+AG v0.10 (feedback Jaime "nitro"): G más baja = la bola TARDA en coger velocidad (inercia/peso, acelera
//   gradualmente) en vez de saltar a velocidad alta tras cada rebote. La terminal ya NO es un tope-pared duro
//   sino un DRAG de aire (VYDRAG): la aceleración se atenúa sola con la velocidad ⇒ curva asintótica natural
//   ("acelerando, acelerando" y suavizándose), no un empujón. Terminal efectiva ≈ G/VYDRAG. PEG_REST algo
//   mayor para que con G baja la bola conserve energía y no se pose (menos atascos), sin volver al pogo.
const G=9.5, VTERM=16.0, VYDRAG=0.62, PEG_REST=0.47, BALL_REST=0.45, FRICTION=0.18, SLOP=0.012, VXDRAG=0.997;
const PEG_VY_CAP=3.2, WALL_REST=0.35;   //+AG v0.7 clamp de rebote hacia arriba (mata el "pogo"); rebote de muro amortiguado
const WIDTH=9.0, XHALF=WIDTH/2, GATE_Y=2.4, BALL_R=0.42, CAM_SCALE=15.0, TOP=68.0;
const TEAMS=[ {name:'Rojo',color:[0.95,0.20,0.22]},{name:'Verde',color:[0.20,0.85,0.32]},{name:'Azul',color:[0.16,0.42,1.0]},{name:'Amarillo',color:[1.0,0.82,0.15]} ];
const BALLS_PER_TEAM=3, N_BALLS=12;
//+AG PERFIL INDIVIDUAL (juego INDIVIDUAL primero, patrón Brawl Stars, docs/07 §Solo/Equipo): 8 colores SUELTOS,
//   cada color = "equipo" de 1 bola → la coronación/celebración (que leen winner_team) quedan intactas. Paleta y
//   orden de spawn EXACTOS de cazador/redlight (convención: cada modo autocontenido, sin import cruzado → se COPIA,
//   no se importa). balls[0] = jugador (Azul, primero de la paleta). Se activa con opts.individual; sin opts el
//   torneo (4×3) queda BYTE-IDÉNTICO (verificado con _identidad.mjs). Nombres en español (el motor de race no
//   pinta kill-feed; los colores coinciden 1:1 con los de cazador/redlight).
const SHORT_COLORS=[
  {name:'Azul',    color:[0.18,0.52,1.00]},
  {name:'Verde',   color:[0.22,0.88,0.34]},
  {name:'Naranja', color:[1.00,0.55,0.12]},
  {name:'Magenta', color:[1.00,0.40,0.70]},
  {name:'Cian',    color:[0.25,0.92,0.92]},
  {name:'Rojo',    color:[0.95,0.18,0.20]},
  {name:'Violeta', color:[0.70,0.27,1.00]},
  {name:'Amarillo',color:[1.00,0.88,0.22]},
];
const PEG_R=0.22, PEG_SKIP=0.06, CLEAR_TOP=6.0;
const BUMP_R=0.55, J_BUMP=6.2, V_CLAMP=15.0;
const A_BOOST=0.85, BOOST_R=0.95, V_BOOST_CLAMP=14.0;
const TURBO_DUR=36, TURBO_V=14.0, TURBO_CLAMP=16.0;
const GIANT_DUR=45, GIANT_SCALE=1.6;
const STAR_DUR=120, STAR_MASS=12.0, STAR_V=15.0, STAR_CLAMP=18.0;
const RELAY_DUR=45;
const Q_QUAKE=5.5, QUAKE_CLAMP=15.0;
const CHECK_W=30, CHECK_D=0.5;
const FLOOR_MIN_V=1.70, FLOOR_HUG=3.2, FLOOR_PUSH=5.0, FLOOR_START_DELAY=18, FLOOR_ANCHOR_K=2;
const WIN_HOLD=135, FINISH_SCALE=20.0, CAM_FOCUS_ZONE=16.0, CELEB_SCALE=13.0;   //+AG v0.11 celebración más larga (~4.5s) para ver el baile
const SPAWN_DY=2.5, PER_ROW=4;
//+AG constantes de la capa de agencia
//+AG v0.9 CONTROL POR ZONAS (reemplaza agresivo/defensivo/equilibrado): el jugador elige a qué ZONA ir
//   (izquierda/centro/derecha) y la bola DERIVA gradualmente hacia ella, como añadirle un peso hacia ese lado,
//   nunca un tirón. Es un += capado (deriva), jamás un setear vx → no cuenta como recolocación.
//+AG v0.15 EL CONTROL TE ABANDONABA A MEDIO CAMINO (1-ago-2026, lo levantó Jaime jugando: «pulso que
//   quiero ir a la derecha y no hace mucho caso, y a veces se va al medio; tendría que tender a ir a la
//   derecha de verdad»). No era sensación suya, era geometría — medido con 400 carreras conducidas a
//   DERECHA de principio a fin:
//     · la banda muerta arrancaba en x=1,19 y el tercio central llega hasta 1,5 ⇒ el control se apagaba
//       ANTES de que la bola saliera del centro. El sitio donde el juego dejaba de ayudarte estaba, a
//       ojo del jugador, en el medio.
//     · y el empuje era proporcional puro: en el borde de la banda valía CERO. O sea que la fuerza era
//       mínima justo donde la bola pasaba el rato ⇒ el borde se comportaba como un segundo imán.
//   Resultado: 64% del tiempo en su tercio, 5,6 devoluciones al centro por carrera, 1,2 s de mediana
//   para recuperarse... y en el 13,5% de las carreras la bola caía al centro y NO VOLVÍA NUNCA. Una de
//   cada siete partidas el botón dejaba de servir para el resto de la carrera.
//
//   LOS TRES MANDOS QUE LO ARREGLAN (medidos los seis candidatos antes de elegir, no estimados):
//     TX 0.62→0.78  el objetivo se va hacia fuera: «derecha» es la derecha, no el borde del centro.
//     DZ 1.6→1.3    la banda arranca en x=2,21, ya DENTRO del tercio ⇒ el control no se apaga en el medio.
//     MIN (nuevo)   suelo de empuje: al salirte de tu zona la corrección arranca en 0.14 en vez de en
//                   cero. Esto es lo que de verdad mata el «no me hace caso» — sin suelo, el borde de la
//                   banda es un punto de fuerza nula donde la bola se queda a vivir.
//   Después: 92,7% del tiempo en su tercio, 1,7 devoluciones, 0,6 s para recuperarse y CERO carreras
//   abandonadas en el centro. Sigue siendo plinko: dentro de tu tercio la bola rebota libre y nunca se
//   setea vx. Probé una versión más fuerte (TX 0.82 / DZ 1.1 / MIN 0.20) y esa sí se siente pilotada y
//   además desequilibra las zonas (el centro se hundía a 5,34 de puesto medio): descartada.
const DIR={LEFT:0,CENTER:1,RIGHT:2};
const STEER_TX=XHALF*0.78;          // objetivo de x por zona: LEFT -3.51, CENTER 0, RIGHT +3.51
const STEER_K=0.6;                  // ganancia proporcional (want·K) fuera de la banda
const STEER_ACC=0.45;               // tope del empuje lateral (u/s por frame)
const STEER_MIN=0.14;               // SUELO del empuje al salirse de la banda (nunca arranca en cero)
const STEER_DZ=1.3;                 // BANDA: dentro de ±1.3u del objetivo la bola rueda libre (no la clava al carril lento)
//+AG v0.9 UN-REST (vigía de progreso): parámetros del roll-off que despega a una bola clavada (ver step()).
let UNR_T0=7, UNR_RAMP=8, UNR_BASE=0.18, UNR_MAX=0.9;   // dispara a los 7f sin progreso; rampa 0.18→0.9 en 8f
let GEOM_WC=1.9*0.42+0.22;                              // 1.018u: ancho de franja lateral limpia de pegs interiores
let GEOM_CRADLE=1.0;                                    // umbral de-cradle en múltiplos de D (hueco de peligro D..GEOM_CRADLE·D)
let UNR_SQZ=0.54, UNR_REC=0.10;                         // radio de COLISIÓN mínimo al estrujarse (render sin cambio) y ritmo de recuperación
let UNR_DOWN=0.22;                                      //+AG v0.10 empuje de evacuación hacia abajo (≤0.22/f rampado) para una bola HELADA y ya encogida en PINZA/muro que la G baja no logra sacar del hueco
let UNR_SPV=1.9, UNR_LONG=70, UNR_DRAIN=0.5;           //+AG v0.10 umbral de "clavada" igual (1.9) y safety-net a 70f (sin cambios). NUEVO UNR_DRAIN: al drenar stuckT en no-progreso rápido, drena a MEDIA velocidad (0.5/f) en vez de 1/f. Con G baja los rattlers oscilan JUSTO alrededor de 1.9 (a ratos por encima); con drena-1 nunca acumulaban y solo los cazaba el net tardío. Drena-0.5 deja que un rattler oscilante acumule y dispare el give TEMPRANO y GENTIL (arco de bumper genuino, rápido TODOS los frames, sigue drenando a 0).
const NITRO_CD=140, SHIELD_DUR=52, SHIELD_CD=175;
//+AG v0.12 ASPAS (cruz giratoria), CANÓNICA del motor (README canal: "race v2 pendiente: compuertas + aspa").
//   Port FIEL del MOLINILLO de gauntlet/sim.js (a su vez el patrón molinillo de Recolecta): cada brazo es una
//   CÁPSULA y el rebote es relativo a la VELOCIDAD DE SUPERFICIE del aspa (ω×r) → el giro LANZA a la bola.
//   Rotación DETERMINISTA: vector unitario girado por cos/sin(dθ) HARDCODEADOS + renormalizado con sqrt (jamás
//   Math.sin/cos dentro de Sim; hereda docs/33). MECÁNICA "un lado sube, otro baja" = INHERENTE a ω×r: la mitad
//   del disco a un lado del centro imparte velocidad ARRIBA y la otra ABAJO (según el sentido de giro dir). El
//   jugador ELIGE el lado con el control por ZONAS. Set MIRROR-simétrico (par lateral espejo + 2 centrales de
//   giro OPUESTO) ⇒ ninguna zona gana de oficio (justicia; verificado con fairness.mjs).
const ASPA_R=1.0, ASPA_THICK=0.22, ASPA_W=3.0, ASPA_E=0.45, ASPA_VYUP=1.5;   // W=3 rad/s (~0.48 rev/s, legible; más rápido bate más = más malabar). VYUP: tope del impulso HACIA ARRIBA (ver _arm)
const ASPA_COS=0.99992188, ASPA_SIN=0.01249967;               // cos/sin de dθ=ASPA_W*DT (=3/240) HARDCODEADOS (double idéntico Node/Chromium)
//+AG v0.13 PLATAFORMAS MÓVILES (compuertas), 2º obstáculo del encargo (README canal: "compuertas + aspa"). Bloque
//   horizontal SÓLIDO que se desplaza izq↔der (vaivén) por la pista; el jugador la ESQUIVA (si te la comes te frena/
//   desvía). Movimiento DETERMINISTA: x=centro+amp·triS(reloj entero), sin trig ni relojes (fase entera del gauntlet).
//   Colisión sólida (caja) reusando el estilo de las barreras: la bola se POSA/rebota por arriba y la EMPUJA de lado.
//   ARRASTRE: una bola posada recibe la velocidad de la placa (fricción) → rueda al borde y CAE (nunca atasco
//   permanente); sella b._plf (el tracker la trata como "apoyada", igual que una barrera, para V2/V3/V6).
const PLAT_HW=0.85, PLAT_HH=0.22, PLAT_REST=0.30, PLAT_AMP=2.4, PLAT_PERIOD=150, PLAT_CARRY=0.35;

//+AG doc 39 abierto #1 (2026-07-24, VB Jaime): los ATRIBUTOS de la bola equipada modulan la FÍSICA, efecto SUTIL
//   (±STAT_K a los extremos) y SOLO en perfil INDIVIDUAL sobre balls[0] (el jugador). Multiplicador determinista y
//   centrado en 1.0: attr 6.5 → 1.0; attr 13 → +12%; attr 0 → −12%. Sin RNG. Sin opts.stats → todos 1.0 (no-op:
//   individual-sin-stats queda byte-idéntico, verificado con golden). El torneo NUNCA construye con stats → intacto.
const STAT_K=0.12;
//+AG multiplicador CAPADO a ±STAT_K (attr 0→0.88, 6.5→1.0, 13→1.12; y un atributo firma que a nivel alto pase de 13
//   NO rebasa el ±12% → el "sutil, ±10-15% máximo" es una garantía dura, no solo el valor en attr=13).
const statMul=a=>{ const m=1+(a-6.5)/6.5*STAT_K; return m<1-STAT_K?1-STAT_K:(m>1+STAT_K?1+STAT_K:m); };
const NEUTRAL_MUL={vel:1,ace:1,pes:1,aga:1,res:1,bst:1};
//+AG doc 39: RASGOS de Épicas/Legendaria. A diferencia de los stats (que modulan TODO un poco), un rasgo es UNA
//   regla concreta que la ficha de la Tienda promete con palabras. Mismo doble candado que ?stats: solo INDIVIDUAL
//   y solo balls[0]. Un rasgo que no es de este modo, o ausente, deja todos los factores a 1 → byte-idéntico.
//   Los rasgos de este modo: VOLCÁN (boost +20%) · ESTRELLA (súper +1 s) · YUNQUE (medio impulso de las ligeras).
//   FANTASMA no vive aquí (es del Cazador): llega, no hace nada, y no mueve ni un bit.
const TRAITS_RACE=new Set(['volcan','estrella','yunque']);
const VOLCAN_BST=1.20;      // la ficha dice "su boost dura un 20% más"
const ESTRELLA_SUPER_F=30;  // la ficha dice "su súper dura +1 segundo" · 30 FPS
const YUNQUE_IMP=0.5;       // la ficha dice "les roban la MITAD del impulso"

function buildMap(rng){
  const pegs=[], bumpers=[], boosts=[], powerups=[];
  const colGap=rng.uniform(1.85,1.95), rowGap=rng.uniform(1.05,1.20), LIMIT=XHALF-0.55;
  let z=GATE_Y+2.0, row=0;
  while(z<TOP-CLEAR_TOP){ const shift=(row%2===0)?colGap*0.5:0.0; const xs=[];
    for(let x=shift;x<=LIMIT;x+=colGap) xs.push(x);
    for(let x=shift-colGap;x>=-LIMIT;x-=colGap) xs.push(x);
    for(const x of xs){ if(rng.random()<PEG_SKIP) continue; pegs.push([x+rng.uniform(-0.05,0.05),z]); }
    z+=rowGap; row++; }
  const play=TOP-GATE_Y, nBands=Math.max(3,Math.floor(play/13)), bands=[];
  for(let k=0;k<nBands;k++) bands.push([GATE_Y+3+k*(play-6)/nBands, GATE_Y+3+(k+1)*(play-6)/nBands]);
  const rx=()=>+(rng.uniform(-3.2,3.2)).toFixed(2), rxb=()=>+(rng.uniform(-2.8,2.8)).toFixed(2), ry=([lo,hi])=>+(rng.uniform(lo+1.0,hi-1.0)).toFixed(2);
  const bag=['turbo','giant','relay','star'];
  bands.forEach((band,bi)=>{ bumpers.push([rxb(),ry(band)]);
    const depth=1.0-bi/Math.max(1,bands.length-1), nBoost=2+Math.round(depth);
    for(let j=0;j<nBoost;j++){ const dx=rng.uniform(-0.5,0.5), dy=-Math.sqrt(1-dx*dx); boosts.push({x:rx(),y:ry(band),cx:dx,cy:dy}); }
    powerups.push({x:rx(),y:ry(band),type:bag[rng.range(bag.length)],taken:false}); });
  if(!powerups.some(p=>p.type==='relay')) powerups[rng.range(powerups.length)].type='relay';
  if(!powerups.some(p=>p.type==='star')) powerups[rng.range(powerups.length)].type='star';
  const clearR=BUMP_R+BALL_R+0.35;
  let keptPegs=pegs.filter(([px,py])=>!bumpers.some(([bx,by])=>hyp(px-bx,py-by)<clearR));
  const tileW=WIDTH/GATE_NT, barriers=[];
  for(let k=0;k<N_BARRIERS;k++){ const by=+(GATE_Y+play*(0.78-k*0.24)).toFixed(2); const tiles=[];
    for(let t=0;t<GATE_NT;t++){ const x0=-XHALF+t*tileW; tiles.push({x0:+x0.toFixed(3),x1:+(x0+tileW).toFixed(3),cx:+(x0+tileW/2).toFixed(3),hp:TILE_HP,alive:true,brokeF:-1,press:0,pc:null}); }
    barriers.push({y:by,tiles,nt:GATE_NT,tileW:+tileW.toFixed(4)}); }
  keptPegs=keptPegs.filter(([px,py])=>!barriers.some(g=>Math.abs(py-g.y)<1.2));
  //+AG v0.8 CERO NIDOS, geometría SIN punto de reposo estable (feedback Jaime: "ni atascos ni teleports; pon
  //   los pivotes pegados a la pared o cámbialos de forma"). Sustituye el anti-encaje v0.7 (que JUNTABA pares a
  //   0.45·D creando cunas/valles estables, y pegaba pegos al muro dejando rincones). Tres piezas:
  //   (A) LIMPIAR la franja lateral: fuera los pegs interiores a < WALL_CLEAR del muro (ahí nacían los rincones
  //       muro+peg). (B) FUSIÓN por fila: un par cuyo hueco de superficies cae en la "zona de peligro" (~diámetro
  //       de bola) se BORRA entero y se pone UN peg en el punto medio ⇒ ni valle ni carril. (C) COLUMNA DE MURO:
  //       pegos flush AL muro (hueco 0) ⇒ ni la bola encogida cabe entre muro y peg ⇒ rebota hacia dentro. Sin
  //       reposo posible. Todo geométrico y sin rng nuevo (no altera el reparto de bolas). D=diámetro de bola.
  const D=2*BALL_R, GAP_LO=0.55*D, GAP_HI=1.30*D;
  const WALL_CLEAR=GEOM_WC;                          //+AG v0.9 ampliado: franja lateral limpia de pegs interiores. El
  //   canal entre el peg interior más cercano y la columna de muro = WALL_CLEAR-0.66; con 1.018 valía 0.36 < D=0.84
  //   ⇒ la bola NO cabía y se quedaba clavada/rebotando en la franja lateral (traza principal de congeladas). Con
  //   ~1.66 el canal ≥1.0 > D ⇒ la bola desciende por él rebotando entre pegs interiores y columna de muro.
  const WALL_PEG_X=XHALF-PEG_R;                      // 4.28u: columna de muro FLUSH (superficie tocando el muro, hueco 0)
  const WALL_PEG_DY=0.90;                            //+AG v0.10 paso vertical de la columna de muro MÁS DENSO (era 1.15): con G baja una bola se equilibraba sobre UN peg-top flush (traza principal de congeladas al muro); pegos más juntos ⇒ no hay top estable, la geometría la deriva hacia dentro. Hueco vertical 0.46<D ⇒ ni la bola encogida cabe entre dos.
  //   FLUSH (hueco 0, no 0.12): con 0.12u una bola ENCOGIDA (r=0.231 tras un rescate) se colaba entre peg y muro
  //   y quedaba atrapada (el peg la empuja al muro, el muro la devuelve). Con hueco 0 su centro nunca pasa del peg
  //   ⇒ siempre la empuja HACIA DENTRO. Paso 1.15 (hueco vertical 0.71<D) para que ni la bola encogida quepa entre dos.
  // (A) limpiar la franja lateral de pegos interiores
  keptPegs=keptPegs.filter(([px])=>(XHALF-Math.abs(px))>=WALL_CLEAR);
  // (B) fusión interior por filas: borra el par en zona de peligro y planta UN peg en el punto medio (2 pasadas)
  const rows=new Map();
  for(const pg of keptPegs){ if(!rows.has(pg[1])) rows.set(pg[1],[]); rows.get(pg[1]).push(pg); }
  const fused=[];
  for(const [ry,arr] of rows){ arr.sort((a,b)=>a[0]-b[0]); let cur=arr;
    for(let pass=0;pass<2;pass++){ const out=[]; let i=0;
      while(i<cur.length){ if(i+1<cur.length){ const gap=(cur[i+1][0]-cur[i][0])-2*PEG_R;
          if(gap>GAP_LO&&gap<GAP_HI){ out.push([(cur[i][0]+cur[i+1][0])/2,ry]); i+=2; continue; } }
        out.push(cur[i]); i++; }
      cur=out; }
    for(const pg of cur) fused.push(pg); }
  keptPegs=fused;
  // (C) columna de pegos de muro (flush), saltando las alturas de barrera (que ocupan todo el ancho)
  for(const side of [-1,1]){ for(let y=GATE_Y+2.0; y<TOP-CLEAR_TOP; y+=WALL_PEG_DY){
    if(barriers.some(g=>Math.abs(y-g.y)<1.2)) continue; keptPegs.push([side*WALL_PEG_X,y]); } }
  //+AG v0.7 RELLENO DE HUECOS (red de seguridad): ningún carril vertical libre de caída >~4u en el INTERIOR.
  //   Acotado a la zona interior (la franja de muro ya la cubre la columna del punto C) para no re-ensuciar el lateral.
  const zLo=GATE_Y+2.0, zHi=TOP-CLEAR_TOP, MAXV=4.0, added=[], INNER=XHALF-WALL_CLEAR;
  const nearBlocked=(x,y)=> bumpers.some(([bx,by])=>hyp(x-bx,y-by)<clearR) || barriers.some(g=>Math.abs(y-g.y)<1.2);
  for(let bx=-INNER; bx<INNER-0.01; bx+=1.0){ const cx=Math.min(bx+0.5,INNER);
    const ys=keptPegs.filter(([px,py])=>px>=bx&&px<bx+1.0&&py>=zLo&&py<=zHi).map(([,py])=>py).sort((a,b)=>a-b);
    const marks=[zLo,...ys,zHi];
    for(let i=0;i+1<marks.length;i++){ const gap=marks[i+1]-marks[i];
      if(gap>MAXV){ const n=Math.ceil(gap/MAXV)-1; for(let k=1;k<=n;k++){ const y=marks[i]+gap*k/(n+1); if(!nearBlocked(cx,y)) added.push([cx,y]); } } }
  }
  for(const a of added) keptPegs.push(a);
  //+AG v0.8 DE-CRADLE FINAL (2D), la garantía "cero nidos". Dos pegs cuya distancia centro-centro está entre
  //   "casi tocándose" y 2·PEG_R+D, a altura similar (|dy|<0.9·D), forman una V donde la bola (diámetro D) NO
  //   cabe → se posa encima = nido estable (el atasco vibrante). Se FUSIONAN en su punto medio. Cubre pares de
  //   fila, diagonales y los que introduce el relleno. Itera hasta estable. Los pegos de MURO (columna flush) se
  //   excluyen (van flush al muro y con paso 1.15 su hueco vertical 0.71<D ya impide el nido; son intencionales).
  //   Determinista (hyp=sqrt, sin rng).
  //+AG v0.9 CRADLE ampliado a la ZONA DE PELIGRO real: una bola se CLAVA no solo cuando no cabe (hueco<D) sino
  //   también cuando cabe con holgura mínima (hueco D..~1.2D): queda pinzada entre los dos pegs y NINGÚN empuje
  //   lateral la libera (el peg opuesto lo cancela). El de-cradle original (hueco<D) los dejaba pasar. GEOM_CRADLE
  //   los captura (fusiona interior+interior; borra el interior en interior+muro).
  const isWall=([px])=>Math.abs(Math.abs(px)-WALL_PEG_X)<0.001, CRADLE=2*PEG_R+GEOM_CRADLE*D;
  { let changed=true, guard=0;
    while(changed&&guard++<6){ changed=false;
      const H=1.0, mp=new Map();
      for(const pg of keptPegs){ const k=Math.floor(pg[1]/H); if(!mp.has(k))mp.set(k,[]); mp.get(k).push(pg); }
      const removed=new Set(), fresh=[];
      for(const p of keptPegs){ if(removed.has(p)||isWall(p)) continue;
        const k=Math.floor(p[1]/H); let best=null,bd=1e9;
        for(let kk=k-1;kk<=k+1;kk++){ const arr=mp.get(kk); if(!arr) continue;
          for(const q of arr){ if(q===p||removed.has(q)) continue;   //+AG v0.9 q de MURO SÍ cuenta como pareja de cuna
            const dcc=hyp(p[0]-q[0],p[1]-q[1]);
            if(dcc>2*PEG_R+0.02&&dcc<CRADLE&&Math.abs(p[1]-q[1])<0.9*D&&dcc<bd){ bd=dcc; best=q; } } }
        //+AG v0.9 cuna interior+MURO (la traza principal de las congeladas largas: la bola se clava en la V entre el
        //   peg interior más cercano y la columna de muro, canal <D): se borra SOLO el peg interior (el de muro es
        //   intencional) ⇒ se abre el canal y la bola desciende. Cuna interior+interior: fusión normal en el medio.
        if(best){ if(isWall(best)){ removed.add(p); changed=true; }
                  else { removed.add(p); removed.add(best); fresh.push([(p[0]+best[0])/2,(p[1]+best[1])/2]); changed=true; } } }
      if(changed) keptPegs=keptPegs.filter(pg=>!removed.has(pg)).concat(fresh);
    }
  }
  //+AG v0.12 ASPAS: posiciones DETERMINISTAS (constantes, sin rng → no altera el reparto de bolas). En los HUECOS
  //   entre barreras (0.78/0.54/0.30·play) para no solaparlas. Set MIRROR-simétrico: 2 centrales de giro OPUESTO
  //   (dan el "por qué lado" claro en el centro) + par lateral espejo (para que ir a un lado tenga sentido) ⇒ el
  //   conjunto es invariante bajo espejo izq↔der ⇒ estructuralmente JUSTO. Se limpian pegs y bumpers de su disco
  //   (colisionadores duros que atraparían contra el aspa); boosts/powerups se dejan (un pickup bajo el aspa se
  //   coge de paso). Si dos aspas quedasen muy juntas la geometría lo evita por las alturas separadas.
  //+AG v0.14 (feedback Jaime): el sentido de giro se randomiza POR CARRERA (ver constructor: hash aparte del seed, NO
  //   consume el rng del mapa → spawns idénticos). El dir de aquí es un placeholder; el bueno lo pone el constructor.
  //   Motivo: un aspa centrada de giro FIJO = "vete siempre al mismo lado" = sin elección; aleatorio = hay que MIRAR.
  const aspas=[ {x:0.0,y:GATE_Y+play*0.68,dir:1}, {x:0.0,y:GATE_Y+play*0.46,dir:-1},
                {x:0.0,y:GATE_Y+play*0.24,dir:1}, {x:0.0,y:GATE_Y+play*0.12,dir:-1} ];
  const aClrP=ASPA_R+BALL_R+0.35, aClrB=ASPA_R+BUMP_R+0.30;
  keptPegs=keptPegs.filter(([px,py])=>!aspas.some(a=>hyp(px-a.x,py-a.y)<aClrP));
  //+AG v0.13 PLATAFORMAS: alturas deterministas en huecos (evitan barreras 0.78/0.54/0.30 y aspas 0.68/0.46/0.24/0.12).
  //   cx=0, amplitud simétrica ±PLAT_AMP ⇒ barren el ancho por igual (L/R neutro = justo). Fase opuesta entre las dos.
  //   Limpio los pegs de la FRANJA que barre cada placa (tira horizontal, como el hueco de una barrera).
  const plats=[ {y:GATE_Y+play*0.63,cx:0,amp:PLAT_AMP,period:PLAT_PERIOD,off:0,hw:PLAT_HW},
                {y:GATE_Y+play*0.38,cx:0,amp:PLAT_AMP,period:PLAT_PERIOD,off:PLAT_PERIOD>>1,hw:PLAT_HW} ];
  keptPegs=keptPegs.filter(([px,py])=>!plats.some(p=>Math.abs(py-p.y)<PLAT_HH+BALL_R+0.25 && px>p.cx-p.amp-p.hw-0.4 && px<p.cx+p.amp+p.hw+0.4));
  const keptBumpers=bumpers.filter(([bx,by])=>!aspas.some(a=>hyp(bx-a.x,by-a.y)<aClrB));
  const yQuakes=[+(GATE_Y+play*0.58).toFixed(2),+(GATE_Y+play*0.20).toFixed(2)];
  const bucketH=1.2, pegBuckets=new Map();
  for(const pg of keptPegs){ const bi=Math.floor(pg[1]/bucketH); if(!pegBuckets.has(bi)) pegBuckets.set(bi,[]); pegBuckets.get(bi).push(pg); }
  return {pegs:keptPegs,pegBuckets,bucketH,bumpers:keptBumpers,boosts,powerups,yQuakes,barriers,aspas,plats,top:TOP};
}

class Sim{
  constructor(seed, opts){ opts=opts||{};
    this.seed=seed; const rng=new RNG(seed); this.rng=rng;
    this.f=0; this.done=false;
    //+AG PERFIL: torneo (default, 4 equipos×3) o INDIVIDUAL (8 colores sueltos). El default queda BYTE-IDÉNTICO:
    //   con opts vacío this.teams===TEAMS, nTeams===4, ballsPerTeam===3, nBalls===12 → mismos arrays, mismos literales
    //   y la MISMA secuencia de draws de RNG (buildMap primero, luego el shuffle, luego 4 draws por bola). El cálculo
    //   de estos escalares NO consume RNG → buildMap sigue siendo el primer consumidor (identidad intacta).
    this.individual=!!opts.individual;
    //+AG CÓMO JUGAR (tutorial): nivel sin peligro. Flag ausente → todo idéntico a la fuente (no consume RNG).
    this.tutorial=!!opts.tutorial;
    //+AG doc 39 #1: modificador de física por atributos, SOLO individual y SOLO balls[0] (el jugador). Se calcula
    //   ANTES de buildMap pero NO consume RNG (constantes) → el primer consumidor sigue siendo buildMap (identidad ok).
    const _S=(this.individual&&Array.isArray(opts.stats)&&opts.stats.length===6)?opts.stats:null;
    this.pmul=_S?{vel:statMul(_S[0]),ace:statMul(_S[1]),pes:statMul(_S[2]),aga:statMul(_S[3]),res:statMul(_S[4]),bst:statMul(_S[5])}:NEUTRAL_MUL;
    //+AG doc 39: el RASGO de la bola equipada. Mismo doble candado y misma regla de no consumir RNG que los stats.
    this.trait=(this.individual&&TRAITS_RACE.has(opts.trait))?opts.trait:null;
    this.teams=this.individual?SHORT_COLORS:TEAMS;
    this.nTeams=this.teams.length;                         // 4 torneo · 8 individual
    this.ballsPerTeam=this.individual?1:BALLS_PER_TEAM;    // 3 torneo · 1 individual (cada color = equipo de 1)
    this.nBalls=this.individual?this.nTeams:N_BALLS;       // 12 torneo · 8 individual
    this.map=buildMap(rng); this.balls=[];
    const slots=rng.shuffle([...Array(this.nBalls).keys()]);
    for(let i=0;i<this.nBalls;i++){ const team=Math.floor(i/this.ballsPerTeam);
      const col=slots[i]%PER_ROW, rowi=Math.floor(slots[i]/PER_ROW);
      const x=-XHALF+1.4+col*(WIDTH-2.8)/(PER_ROW-1)+rng.uniform(-0.05,0.05);
      const y=(TOP-1.0)-rowi*SPAWN_DY-rng.uniform(0,0.2);
      this.balls.push({ id:i, num:i+1, team, color:this.teams[team].color, x, y, vx:0, vy:0,
        m:1.0, scale:1.0, sqz:1, rank:null, turbo:0, giant:0, star:0, bump_cd:0, in_boost:false,
        prev_vx:0, prev_vy:0, _pgi:0, _pti:0, _pf:-1,
        //+AG
        isPlayer:i===0, dir:DIR.CENTER, nitro:0, nitroCd:0, shield:0, shieldCd:0, hurt:0, cheer:0, sq:0, finF:0,
        rExpr:'', rUntil:-1, rPrio:-1,   //+AG reacción emocional temporizada (como emotions.mjs del canal)
        _seedr:mulberry32((seed*131+i*17+3)>>>0), _nextDir:40+Math.floor(rng.random()*60),
        _skill:0.45+rng.random()*0.75 });
    }
    this.player=this.balls[0];
    this.byTeam=this.teams.map((_,t)=>this.balls.filter(b=>b.team===t));   //+AG dimensionado a nTeams (4 torneo · 8 individual); default = TEAMS.map (idéntico)
    this.placed=0; this.winner_team=null; this.decision_frame=null; this.playerDoneF=null; this.team_done=new Array(this.nTeams).fill(0); this.endHold=-1;   //+AG team_done a nTeams; default [0,0,0,0]
    this.twists=[null,null]; this.floor_y=null;
    //+AG v0.12 orientación VIVA de cada aspa (vector unitario, gira cada substep). La geometría/posición vive en el
    //   mapa; la orientación en la Sim (como this.mill del gauntlet) → el tracker la lee de sim.aspas.
    //+AG v0.14 (feedback Jaime) sentido de giro ALEATORIO por carrera, de un hash APARTE del seed (mulberry32 propio) →
    //   NO consume el rng del mapa (spawns idénticos, V1 estable) y cada partida gira distinto → hay que MIRAR y elegir lado.
    const _ad=mulberry32((seed*2654435761+2246822519)>>>0);
    //+AG tutorial: SIN aspas (vaciar sim.aspas quita colisión Y render a la vez; el hash _ad no toca el rng del mapa)
    this.aspas=this.tutorial?[]:this.map.aspas.map(a=>({x:a.x,y:a.y,dir:_ad()<0.5?1:-1,ux:1,uy:0}));
    //+AG v0.13 estado vivo de las plataformas: x (posición del vaivén) y vx (u/s, para el arrastre). Se recalcula por frame.
    this.plats=this.map.plats.map(p=>({y:p.y,cx:p.cx,amp:p.amp,period:p.period,off:p.off,hw:p.hw,x:p.cx,vx:0}));
    this.cam=TOP-CAM_SCALE/2; this.cam_scale=CAM_SCALE;
    this.super=0;
    //+AG eventos: cola de acciones (jugador/bots, pueden dispararse fuera del step, patrón _pev del cazador)
    //   e histórico acumulado con la forma del motor (this.events, lo consume ?capture=1 vía runToEnd/sfxmap).
    this._pev=[];
    this.events={impacts:[],finishes:[],bump:[],boost:[],pickup:[],relay:[],gatebreak:[],nitro:[],shieldup:[],super:[],twists:this.twists};
  }
  //+AG getter del motor (el player lo usa en las partículas de Sacudida)
  get scale(){ return this.cam_scale; }
  aliveBalls(){ return this.balls.filter(b=>b.rank===null); }
  _clamp(b,vmax){ const sp=hyp(b.vx,b.vy); if(sp>vmax){ b.vx=b.vx*vmax/sp; b.vy=b.vy*vmax/sp; } }
  //+AG reacción emocional (prioridad como emotions.mjs): la nueva manda si es >= o la vigente ya expiró
  fireEmo(b,expr,prio,dur){ if(prio>=b.rPrio||this.f>=b.rUntil){ b.rExpr=expr; b.rPrio=prio; b.rUntil=this.f+dur; } }

  //+AG v0.11 DERIVA POR ZONA como BANDA (justicia): los laterales (junto al muro) son ~25% más rápidos que el
  //   centro (física de plinko). Clavar la bola a un punto la exponía a la velocidad de ESE carril → CENTRO fijo
  //   perdía siempre (carril lento). Ahora: CENTRO = FLUJO NATURAL (sin empuje = muestrea carriles = JUSTO ~6.6, la
  //   opción por defecto no penaliza); IZQ/DER = empuje SOLO si se sale de su tercio (deadzone) → dentro rebota libre
  //   y baja bien, con sesgo claro a ese lado. Nunca setea vx (los rebotes mandan; la deriva solo sesga).
  _steer(b){
    if(b.dir===DIR.CENTER) return;                                   // centro = flujo natural (justo)
    const tx=(b.dir===DIR.LEFT?-STEER_TX:STEER_TX), d=tx-b.x;
    //+AG doc 39 #1: AGA → control/tirón de carril del jugador (deriva lateral más fuerte). Solo balls[0]; pmul.aga=1
    //   fuera de individual-con-stats → expresión idéntica a la fuente. Es un += capado (deriva), nunca setea vx.
    const _g=b.isPlayer?this.pmul.aga:1;
    //+AG v0.15 el empuje arranca en STEER_MIN, no en cero (ver el bloque de constantes): fuera de la banda
    //   siempre hay corrección que se NOTA, y sigue siendo un += capado a STEER_ACC — jamás se setea vx.
    if(Math.abs(d)>STEER_DZ){ const e=Math.abs(d)-STEER_DZ; b.vx += Math.sign(d)*Math.min(STEER_ACC, STEER_MIN+e*STEER_K)*_g; }
  }
  _botThink(b){ const r=b._seedr;
    // el bot elige zona con su rng sembrado y cambia cada ~2-4s → se reparte por la pista, determinista
    if(this.f>=b._nextDir){ const k=r(); b.dir=k<0.33?DIR.LEFT:k<0.66?DIR.CENTER:DIR.RIGHT; b._nextDir=this.f+60+Math.floor(r()*90); }
    if(b.nitroCd===0&&r()<b._skill*0.0026) this.fireNitro(b);
    if(b.shieldCd===0&&r()<b._skill*0.0018) this.fireShield(b);
  }
  //+AG doc 39 #1: BST → duración de los boosters del JUGADOR (nitro/escudo/súper); el cooldown NO cambia (no rompe
  //   el ritmo). _bst() = 1 salvo balls[0] en individual-con-stats. Redondeo → duración entera, determinista.
  //+AG doc 39 RASGO Volcán: se apila SOBRE el bst de los stats (son cosas distintas: el stat es la bola, el rasgo
  //   es su identidad de Épica). Sin rasgo el factor es 1 → la línea vale exactamente lo que valía.
  _bst(b){ return b.isPlayer?this.pmul.bst*(this.trait==='volcan'?VOLCAN_BST:1):1; }
  fireNitro(b){ if(b.nitroCd>0||b.rank!==null) return false; b.turbo=Math.round(TURBO_DUR*this._bst(b)); b.nitroCd=NITRO_CD; this._pev.push({t:'nitro',id:b.id}); return true; }   //+AG evento
  fireShield(b){ if(b.shieldCd>0||b.rank!==null) return false; b.shield=Math.round(SHIELD_DUR*this._bst(b)); b.shieldCd=SHIELD_CD; this._pev.push({t:'shieldup',id:b.id}); return true; }   //+AG evento
  // SÚPER = Estrella (efecto del motor): dorada, grande, PESADA e invencible → arrolla a las demás. Se gana con la barra.
  //+AG doc 39 RASGO Estrella: +1 s de SÚPER (solo el súper; nitro y escudo no cambian). Va DESPUÉS del redondeo
  //   del bst para que sea exactamente "+30 frames" y no un porcentaje disfrazado — la ficha dice un segundo.
  _superF(b){ return Math.round(STAR_DUR*this._bst(b))+((b.isPlayer&&this.trait==='estrella')?ESTRELLA_SUPER_F:0); }
  fireSuper(b){ if(b.rank!==null) return false; b.star=this._superF(b); b.m=STAR_MASS; b.scale=1.2; this.fireEmo(b,'chuleria',6,STAR_DUR); this._pev.push({t:'super',id:b.id}); return true; }   //+AG evento

  //+AG v0.12 colisión bola vs UN brazo de aspa (cápsula segmento): empuja fuera + rebota relativo a la velocidad de
  //   superficie del aspa (ω×r con centro a.x,a.y y sentido a.dir) → el giro LANZA. Port EXACTO de gauntlet._arm.
  //   Sella b._af=frame del contacto: el Δv del lanzamiento es LEGÍTIMO (contacto), no recolocación → el tracker
  //   usa el sello para no marcar V6. La velocidad resultante la capa el clamp global a STAR_CLAMP (V5 a salvo).
  _arm(b,a,s0x,s0y,s1x,s1y){
    const dx=s1x-s0x, dy=s1y-s0y, L2=dx*dx+dy*dy||1e-9;
    let t=((b.x-s0x)*dx+(b.y-s0y)*dy)/L2; t=t<0?0:(t>1?1:t);
    const ccx=s0x+t*dx, ccy=s0y+t*dy, ex=b.x-ccx, ey=b.y-ccy, dd=hyp(ex,ey), minr=BALL_R*b.scale*b.sqz+ASPA_THICK;
    if(dd>=minr||dd<=1e-9) return;
    const nx=ex/dd, ny=ey/dd, ov=minr-dd; b.x+=nx*ov; b.y+=ny*ov;
    // velocidad de superficie del aspa en el punto de contacto: v = ω × r, con ω=dir·ASPA_W y r=(cc-centro)
    const vsx=-a.dir*ASPA_W*(ccy-a.y), vsy=a.dir*ASPA_W*(ccx-a.x), vn=(b.vx-vsx)*nx+(b.vy-vsy)*ny;
    if(vn<0){ const j=(1+ASPA_E)*vn; b.vx-=j*nx; b.vy-=j*ny; b._af=this.f;
      //+AG v0.12 ANTI-MALABAR: capo el impulso HACIA ARRIBA. El lado "baja" (acelera) queda intacto y fuerte; el
      //   lado "sube" queda como un empujón suave que FRENA sin catapultar → sin relanzamiento vertical, la bola se
      //   cuela por la caída en vez de quedar haciendo malabares sobre el aspa. Asimetría a favor del jugador (feel).
      if(b.vy>ASPA_VYUP) b.vy=ASPA_VYUP; }
  }
  //+AG v0.12 el ASPA = UNA sola pala giratoria (no cruz). Una CRUZ enjaula la bola: el brazo opuesto la devuelve al
  //   centro cuando el otro la empuja de lado → ciclo límite (malabar). Con una pala, el empuje lateral la SACA de la
  //   zona (no hay brazo que la devuelva) y la gravedad la cuela. Los dos extremos de la pala van en sentidos opuestos
  //   ⇒ conserva "un lado sube, otro baja". Rechazo rápido por distancia al centro.
  _aspa(b){ for(const a of this.aspas){ const ux=a.ux, uy=a.uy, dcx=b.x-a.x, dcy=b.y-a.y, rr=ASPA_R+BALL_R*b.scale*b.sqz+0.3;
    if(dcx*dcx+dcy*dcy>rr*rr) continue;
    this._arm(b,a, a.x-ux*ASPA_R, a.y-uy*ASPA_R, a.x+ux*ASPA_R, a.y+uy*ASPA_R); } }   // pala única

  //+AG v0.13 colisión bola vs plataformas móviles (caja sólida AABB). Se resuelve por el eje de MENOR penetración
  //   (como una caja): eje Y = se POSA/rebota por arriba (o toca por debajo); eje X = la placa la EMPUJA de lado
  //   (esquivar). ARRASTRE por arriba: la bola toma la velocidad de la placa (fricción PLAT_CARRY) → rueda al borde
  //   y cae sola (nunca atasco permanente). Sella b._plf=frame de apoyo (el tracker la trata como "apoyada").
  _plat(b){ const r=BALL_R*b.scale*b.sqz;
    for(const p of this.plats){ const dx=b.x-p.x, dy=b.y-p.y, exx=PLAT_HW+r, eyy=PLAT_HH+r;
      if(Math.abs(dx)>=exx||Math.abs(dy)>=eyy) continue;
      const ox=exx-Math.abs(dx), oy=eyy-Math.abs(dy);
      if(oy<=ox){ // colisión vertical
        if(dy>0){ b.y=p.y+eyy; if(b.vy<0)b.vy=-b.vy*PLAT_REST; b.vx+=(p.vx-b.vx)*PLAT_CARRY; }   // encima: posa/rebota + arrastre
        else { b.y=p.y-eyy; if(b.vy>0)b.vy=-b.vy*PLAT_REST; }                                     // por debajo (raro)
      } else { // colisión lateral: la placa barre y empuja
        if(dx>0){ b.x=p.x+exx; if(b.vx<p.vx)b.vx=p.vx; } else { b.x=p.x-exx; if(b.vx>p.vx)b.vx=p.vx; }
      }
      b._plf=this.f;
    }
  }

  step(){
    //+AG eventos del frame (forma del motor race/sim.js): OBSERVACIÓN PURA. Ninguna emisión consume RNG ni toca
    //   la física; el harness de identidad (motor/race/_identidad.mjs) verifica que la carrera es bit-idéntica.
    const ev={impacts:[],finishes:[],bump:[],boost:[],pickup:[],relay:[],gatebreak:[],nitro:[],shieldup:[],super:[],quake:null};
    if(this.done) return ev;
    const rng=this.rng, f=++this.f, M=this.map;
    //+AG volcar acciones encoladas (jugador desde la UI entre frames; bots del frame anterior)
    for(const e of this._pev) ev[e.t].push({f,id:e.id});
    this._pev.length=0;
    //+AG v0.13 mover las plataformas (vaivén determinista por fase entera). vx = velocidad de superficie (u/s) para el arrastre.
    for(const p of this.plats){ const ph=((f+p.off)%p.period+p.period)%p.period; p.x=p.cx+p.amp*triS(f+p.off,p.period); p.vx=(ph<p.period/2?1:-1)*p.amp*(4/p.period)*FPS; }
    // El Cierre
    if(f>FLOOR_START_DELAY){ const ys=this.aliveBalls().map(b=>b.y).sort((a,b)=>b-a);
      if(ys.length){ if(this.floor_y===null) this.floor_y=ys[0]+FLOOR_HUG;
        const anchor=Math.min(FLOOR_ANCHOR_K,ys.length-1);
        this.floor_y=Math.max(GATE_Y,Math.min(this.floor_y-FLOOR_MIN_V/FPS,ys[anchor]+FLOOR_HUG));
        //+AG v0.9 El Cierre GENTIL: una rezagada acelera hacia abajo de forma RAMPADA (nunca se setea la
        //   velocidad de golpe → sin tirón/recolocación). ~0.5s hasta la velocidad de arrastre, física-like.
        for(const b of this.aliveBalls()){ if(b.y>this.floor_y&&b.vy>-FLOOR_PUSH) b.vy-=0.35; } } }
    // pre-step: actitud, boosts, turbo, gigante, estrella
    for(const b of this.aliveBalls()){
      if(!b.isPlayer) this._botThink(b);                                    //+AG
      if(b.nitroCd>0)b.nitroCd--; if(b.shieldCd>0)b.shieldCd--; if(b.hurt>0)b.hurt--; if(b.cheer>0)b.cheer--; if(b.shield>0)b.shield--; //+AG
      this._steer(b);                                                       //+AG
      //+AG v0.9 UN-REST CONTINUO (sustituye a los rescates borrados, SIN setear velocidad). Vigía de PROGRESO, no
      //   de velocidad puntual: la bola "progresa" cuando alcanza un nuevo mínimo de y (baja de verdad). Si deja de
      //   bajar (posada sobre un peg, hovering), acumula `stuckT` y recibe un empujoncito CONTINUO y RAMPADO
      //   física-like: roll-off lateral CONSISTENTE (rueda del peg, como un dedo empujando muy poco a poco) + algo
      //   de gravedad extra. Crece suave hasta que baja a un nuevo mínimo ⇒ se apaga. Nunca setea velocidad;
      //   Δv/frame ≤ ~0.9 (imperceptible, << REPOS_MAX 2.2). Una bola que desciende normal SIEMPRE bate su mínimo
      //   ⇒ stuckT=0 ⇒ jamás se toca el juego normal (fiel al principio de Jaime: ayuda solo si está clavada, y se
      //   ve como que rodó sola). Dirección determinista (junto a muro hacia dentro; si no, por paridad del id).
      //   La señal de escape es PROGRESO (nuevo mínimo de y): baja a un mínimo nuevo ⇒ reinicia; lenta sin bajar ⇒
      //   acumula; rápida sin bajar (pico de balanceo/arco de bumper) ⇒ drena (no la nudgeamos con energía).
      const sp0=hyp(b.vx,b.vy);
      if(b.sqz<1) b.sqz=Math.min(1,b.sqz+UNR_REC);         // recupera el tamaño de colisión LENTO ⇒ cae del todo antes de re-inflar (si no, re-encaja = vibración)
      if(b._loY===undefined) b._loY=b.y;
      if(b.y<b._loY-0.05){ b._loY=b.y; b.stuckT=0; b._sdir=0; b.noProg=0; }
      else { b.noProg=(b.noProg||0)+1;                       // frames SIN bajar a un nuevo mínimo (a cualquier velocidad)
        if(sp0<UNR_SPV) b.stuckT=(b.stuckT||0)+1;            // lenta/moderada y SIN bajar ⇒ clavada o pinball lento ⇒ acumula
        else b.stuckT=Math.max(0,(b.stuckT||0)-UNR_DRAIN); } // rápida sin bajar (arco de bumper/boost, breve) ⇒ drena (a media velocidad: un rattler que oscila sobre SPV aún acumula; un arco genuino, rápido siempre, drena a 0)
      //+AG v0.10 contador de HELADA por VELOCIDAD (no por progreso): una bola que REPTA hacia abajo a ~0.01u/f tiene
      //   velocidad casi nula (lo que mide V2: sp<0.5) PERO micro-progresa (baja 0.05u cada pocos frames) ⇒ resetea
      //   stuckT sin parar y el rescate por-progreso NUNCA rampa. Este contador se fija en la VELOCIDAD (igual que V2):
      //   si va lentísima muchos frames, dispara el rescate aunque repte. Una bola que desciende normal rebota/acelera
      //   (sp>0.55 a menudo) ⇒ no acumula. Determinista.
      if(sp0<0.55) b.frzT=(b.frzT||0)+1; else b.frzT=0;
      //+AG red de seguridad: si lleva MUCHO sin bajar (rattle rápido persistente que drena stuckT), fuerza el give igual
      const _st=Math.max(b.stuckT||0, b.noProg>=UNR_LONG?(b.noProg-UNR_LONG+UNR_T0):0, (b.frzT||0)>=UNR_T0?b.frzT:0);
      //   Empuje PURAMENTE LATERAL (rueda del peg; la gravedad G ya la hace caer): meter vy la clavaría más contra
      //   el peg. La dirección se DECIDE UNA VEZ por episodio y se MANTIENE hasta escapar ⇒ nunca oscila (un roll-off
      //   que cambiaba de signo cada frame convergía a un punto fijo = trampa). Y se elige RODAR HACIA EL LADO por el
      //   que la bola YA se inclina respecto a su peg de apoyo (el más cercano por debajo): empujar "hacia el centro"
      //   a ciegas metía la bola CONTRA el peg (lo cancela) y no escapaba. Rampa suave a ≤1.0/frame.
      //   Al fijar el episodio se DIAGNOSTICA el apoyo escaneando pegs cercanos: si hay pegs a AMBOS lados a la
      //   altura de la bola (a <~0.95u, |dy|<0.55) es una PINZA (V-cradle, hueco ~D): ningún empuje lateral libera
      //   (el peg opuesto lo cancela) ⇒ se añade un POP hacia ARRIBA rampado para salir de la V (raro, solo pinzas,
      //   por eso no genera vibración general). Si solo hay apoyo por debajo ⇒ peg-top: roll-off lateral apartándose
      //   del apoyo neto. La dirección/estado se fija UNA VEZ por episodio y se mantiene hasta que baja (progreso).
      if(_st>=UNR_T0){ if(!b._sdir){ let lx=-1e9,rx=1e9,below=0,cnt=0,bkc=Math.floor(b.y/M.bucketH);
          for(let bk=bkc-1;bk<=bkc+1;bk++){ const arr=M.pegBuckets.get(bk); if(!arr) continue;
            for(const pg of arr){ const dx=pg[0]-b.x, dy=pg[1]-b.y; if(hyp(dx,dy)>0.95) continue;
              if(Math.abs(dy)<0.55){ if(dx<-0.05&&pg[0]>lx)lx=pg[0]; if(dx>0.05&&pg[0]<rx)rx=pg[0]; }
              if(dy<-0.05){ below+=pg[0]; cnt++; } } }
          if(XHALF-Math.abs(b.x)<0.6){ b._clamp=0; b._sdir=b.x>0?-1:1; }            //+AG v0.10 pegada al MURO: casi siempre BALANCEADA sobre un peg de la columna de muro (flush). Escape = rodar hacia DENTRO (canal lateral limpio hasta el interior). El empuje inward, RAMPADO por frzT hasta UNR_MAX, la desprende del peg-top (antes fallaba porque el rescate no rampaba: la bola repta y reseteaba stuckT).
          else if(lx>-1e9&&rx<1e9){ b._clamp=1; b._sdir=(b.x-lx)>(rx-b.x)?-1:1; }   // pinza: hacia el lado con más hueco
          else { b._clamp=0; const supX=cnt?below/cnt:b.x, off=b.x-supX; b._sdir=off>0.02?1:off<-0.02?-1:(b.id&1?1:-1); } }
        //+AG FIX v0.10: junto al muro, empujar SIEMPRE hacia dentro, FUERA del latch (si el _sdir se fijó apuntando
        //   afuera y luego la bola derivó al muro, el empuje iba CONTRA el muro y no escapaba → atasco lateral residual).
        if(XHALF-Math.abs(b.x)<0.6) b._sdir=b.x>0?-1:1;
        const k=Math.min(1,(_st-UNR_T0)/UNR_RAMP); b.vx+=b._sdir*(UNR_BASE+(UNR_MAX-UNR_BASE)*k);
        //   GIVE de colisión RAMPADO (b.sqz baja): una bola clavada cede un pelín su radio de COLISIÓN (el RENDER NO
        //   cambia ⇒ INVISIBLE) y así rueda del peg / se cuela por el hueco bajo su propia gravedad + el empujoncito
        //   lateral. No es setear velocidad/posición (prohibido): es un radio que rampa suave (como un squash), el
        //   mecanismo mínimo para que "ir con peso" no se confunda con atasco. La V-cradle (pinza) lo necesita sí o
        //   sí (el empuje lateral no la libera); un peg-top también escapa antes. Se recupera al progresar. Probado:
        //   la geometría no puede evitar estos reposos sin vaciar el mapa (ampliar de-cradle saca la duración de rango).
        b.sqz=Math.max(b._clamp?0.40:UNR_SQZ,b.sqz-0.14);   //+AG v0.10 en PINZA simétrica (rara) el give llega más hondo → se cuela seguro con G baja; el resto sin cambio
        //+AG v0.10 ASISTENCIA DE EVACUACIÓN (solo con G baja): si la bola está casi PARADA mientras da el give (ya
        //   encogida), la gravedad G=9.5 es demasiado floja para sacarla del hueco y se queda helada. Como YA está
        //   encogida (cabe por el hueco), un empujoncito hacia ABAJO RAMPADO (≤UNR_DOWN/f, imperceptible) la deja caer.
        //   Solo cuando sp0<0.8 (helada de verdad, no el pinball que rueda): no toca el juego normal. La bola está en
        //   CONTACTO (toca pegs) ⇒ no es recolocación (V6 exige Δv sin contacto). Se apaga al progresar.
        if(sp0<0.9 && (b._clamp||_st>UNR_T0+18||XHALF-Math.abs(b.x)<0.6)){ const kd=Math.min(1,(_st-UNR_T0)/UNR_RAMP); b.vy-=UNR_DOWN*kd; } }
        //+AG v0.10 EVACUACIÓN hacia ABAJO (velocidad, INVISIBLE): en pinza real (V-cradle, _clamp=1), en cuña de muro
        //   (ranura vertical, _clamp=2) o en un peg-top MUY tozudo que el lateral no liberó (_st grande = pinza no
        //   detectada), la G=9.5 es muy floja para sacarla; un empujoncito abajo la deja caer por el hueco. Se apaga al progresar.
      let hitBoost=false;
      for(const bo of M.boosts){ if(hyp(b.x-bo.x,b.y-bo.y)<BOOST_R){ b.vx+=A_BOOST*bo.cx; b.vy+=A_BOOST*bo.cy; this._clamp(b,Math.max(V_BOOST_CLAMP,hyp(b.vx,b.vy))); hitBoost=true; break; } }
      if(hitBoost&&!b.in_boost) ev.boost.push({f,id:b.id});   //+AG evento en flanco de entrada (como el motor)
      b.in_boost=hitBoost;
      if(b.turbo>0){ b.turbo--; if(hyp(b.vx,b.vy)<TURBO_V) b.vy-=0.8; this._clamp(b,TURBO_CLAMP); }
      if(b.giant>0){ b.giant--; if(b.giant===0){ b.scale=1.0; b.m=1.0; } }
      if(b.star>0){ b.star--; if(hyp(b.vx,b.vy)<STAR_V) b.vy-=1.0; this._clamp(b,STAR_CLAMP); if(b.star===0){ b.scale=1.0; b.m=1.0; } }
    }
    if(this.player.rank===null) this.super=Math.min(1,this.super+0.0022);   //+AG barra de súper (~1 por carrera; se gana jugando)
    const ab=this.balls;
    for(let s=0;s<SUBSTEPS;s++){
      //+AG v0.12 girar cada aspa (vector unitario, cos/sin hardcodeados, renormaliza con sqrt), igual que gauntlet._mill
      for(const a of this.aspas){ const c=ASPA_COS, sn=ASPA_SIN*a.dir, nx=a.ux*c-a.uy*sn, ny=a.ux*sn+a.uy*c, l=Math.sqrt(nx*nx+ny*ny)||1e-9; a.ux=nx/l; a.uy=ny/l; }
      for(const b of ab){ if(b.rank!==null) continue;
        //+AG doc 39 #1: ACE → aceleración de caída (G) del jugador; VEL → su velocidad terminal (menos drag = tope
        //   mayor). Solo balls[0] en individual-con-stats (pmul=NEUTRAL fuera de eso → línea idéntica a la fuente).
        const _g=b.isPlayer?G*this.pmul.ace:G, _vyd=b.isPlayer?VYDRAG/this.pmul.vel:VYDRAG, _vt=b.isPlayer?VTERM*this.pmul.vel:VTERM;
        b.vy-=_g*DT; b.vy-=_vyd*b.vy*DT; if(b.vy<-_vt)b.vy=-_vt; b.vx*=VXDRAG; b.x+=b.vx*DT; b.y+=b.vy*DT;
        const r=BALL_R*b.scale*b.sqz;
        //+AG v0.7 muro: rebote amortiguado (WALL_REST) y SIN empujón continuo al centro (era un parche que
        //   daba movimiento artificial de goma). Ahora la geometría de pegs junto al muro evita el encaje.
        if(b.x>XHALF-r){ b.x=XHALF-r; if(b.vx>0)b.vx=-b.vx*WALL_REST; }
        if(b.x<-XHALF+r){ b.x=-XHALF+r; if(b.vx<0)b.vx=-b.vx*WALL_REST; }
        if(b.rank===null&&this.decision_frame===null&&b.vy<0) for(let gi=0;gi<M.barriers.length;gi++){
          const g=M.barriers[gi], top=g.y+GATE_HH;
          if(b.y-r<top&&b.y-r>g.y-GATE_HH-0.6){ const ti=Math.floor((b.x+XHALF)/g.tileW); const tile=(ti>=0&&ti<g.nt)?g.tiles[ti]:null;
            if(tile&&tile.alive){ b.y=top+r; b.vy=-b.vy*GATE_REST; b._pgi=gi; b._pti=ti; b._pf=f; } } }
      }
      for(const b of ab){ if(b.rank!==null) continue;
        const r=BALL_R*b.scale*b.sqz, bi=Math.floor(b.y/M.bucketH);
        for(let bk=bi-1;bk<=bi+1;bk++){ const arr=M.pegBuckets.get(bk); if(!arr) continue;
          for(const [px,py] of arr){ let dx=b.x-px,dy=b.y-py,d=hyp(dx,dy),mind=r+PEG_R;
            if(d>0&&d<mind){ const nx=dx/d,ny=dy/d,ov=Math.max(0,mind-d-SLOP); b.x+=nx*ov; b.y+=ny*ov;
              const vn=b.vx*nx+b.vy*ny; if(vn<0){ const j=-(1+PEG_REST)*vn; b.vx+=j*nx; b.vy+=j*ny;
                //+AG doc 39 #1: RES → aguante del jugador = menos pérdida tangencial por rozamiento en los pegs (más res
                //   = conserva más momento, "pesa/aguanta"). Solo balls[0]; pmul.res=1 fuera de individual-con-stats.
                const _fr=b.isPlayer?FRICTION*(2-this.pmul.res):FRICTION;
                const tx=-ny,ty=nx,vt=b.vx*tx+b.vy*ty, jt=Math.max(-_fr*j,Math.min(_fr*j,vt)); b.vx-=jt*tx; b.vy-=jt*ty;
                if(b.vy>PEG_VY_CAP)b.vy=PEG_VY_CAP; } } }   //+AG v0.7 clamp de rebote hacia arriba → sin "pogo loco"
        }
      }
      //+AG v0.12/v0.13 ASPAS y PLATAFORMAS: tras pegs, antes de bola-bola (el clamp global al final del substep capa la vel → V5 a salvo)
      for(const b of ab){ if(b.rank!==null) continue; this._aspa(b); this._plat(b); }
      const al=this.aliveBalls();
      for(let i=0;i<al.length;i++)for(let j=i+1;j<al.length;j++){ const a=al[i],c=al[j], ra=BALL_R*a.scale*a.sqz, rc=BALL_R*c.scale*c.sqz;
        let dx=c.x-a.x,dy=c.y-a.y,d=hyp(dx,dy),mind=ra+rc;
        if(d>0&&d<mind){ const nx=dx/d,ny=dy/d,ov=Math.max(0,mind-d-SLOP);
          // escudo: la bola con escudo casi no se mueve/empuja (inmunidad) //+AG
          let ima=1/a.m, imb=1/c.m; if(a.shield>0)ima*=0.12; if(c.shield>0)imb*=0.12;
          //+AG doc 39 #1: PES → masa del jugador en colisiones (dividir la masa inversa = pesar más: empuja más, lo
          //   desvían menos). Se apila sobre giant/star (m temporal) sin romperlos. pmul.pes=1 fuera de con-stats.
          if(a.isPlayer)ima/=this.pmul.pes; if(c.isPlayer)imb/=this.pmul.pes;
          //+AG doc 39 RASGO Yunque: un choque de una bola que NO pesa más que él le roba la MITAD del impulso.
          //   Se amortigua el impulso que RECIBE (no su masa inversa): tocando la masa el reparto tope en −33% y la
          //   ficha promete la mitad. La otra bola sale empujada igual — Yunque hace de yunque, no de muro elástico.
          //   El "<=" importa: una bola en SÚPER (STAR_MASS) sí lo arrolla → hay contra-juego, no es inmunidad.
          let _ya=1,_yc=1;
          if(this.trait==='yunque'){ if(a.isPlayer&&c.m<=a.m)_ya=YUNQUE_IMP; if(c.isPlayer&&a.m<=c.m)_yc=YUNQUE_IMP; }
          const ims=ima+imb;
          a.x-=nx*ov*(ima/ims); a.y-=ny*ov*(ima/ims); c.x+=nx*ov*(imb/ims); c.y+=ny*ov*(imb/ims);
          const vn=(c.vx-a.vx)*nx+(c.vy-a.vy)*ny;
          if(vn<0){ const j=-(1+BALL_REST)*vn/ims; a.vx-=j*nx*ima*_ya; a.vy-=j*ny*ima*_ya; c.vx+=j*nx*imb*_yc; c.vy+=j*ny*imb*_yc;
            const imp=Math.abs(vn); if(imp>4){ for(const x of [a,c]){ if(x.shield<=0){ x.hurt=9; x.sq=Math.min(1,imp/16); if(x.isPlayer) this.super=Math.min(1,this.super+0.05); } } } }
        }
      }
      //+AG v0.8 tope GLOBAL de rapidez = STAR_CLAMP (puerta V5 "velocidad imposible"): nada supera la velocidad
      //   máx legítima (la Estrella). Solo recorta el raro pico bumper+caída libre (~19); el juego normal no lo nota.
      for(const b of ab){ if(b.rank!==null) continue; const sp=hyp(b.vx,b.vy); if(sp>STAR_CLAMP){ const k=STAR_CLAMP/sp; b.vx*=k; b.vy*=k; } }
    }
    // barreras: presión y rotura
    if(this.decision_frame===null){
      for(const b of ab){ if(b.rank===null&&b._pf===f){ const t=M.barriers[b._pgi].tiles[b._pti]; if(t.alive){ t.press++; t.pc=b.color; } } }
      for(let gi=0;gi<M.barriers.length;gi++){ const g=M.barriers[gi];
        for(let ti=0;ti<g.tiles.length;ti++){ const t=g.tiles[ti];
          if(t.alive&&t.press){ t.hp-=t.press; t.press=0; if(t.hp<=0){ t.alive=false; t.brokeF=f;
            ev.gatebreak.push({f,gi,ti,x:t.cx,y:g.y,color:t.pc}); } } } }   //+AG evento (forma del motor)
    }
    // Sacudidas
    const liveYs=this.aliveBalls().map(b=>b.y);
    if(liveYs.length && !this.tutorial){ const leadY=Math.min(...liveYs);   //+AG tutorial: sin Sacudidas (nivel sin sustos)
      for(let qi=0;qi<M.yQuakes.length;qi++){ if(this.twists[qi]===null&&leadY<=M.yQuakes[qi]){
        for(const b of this.aliveBalls()){ b.vx+=rng.uniform(-Q_QUAKE,Q_QUAKE); b.vy-=rng.uniform(0.5,2.0); this._clamp(b,QUAKE_CLAMP); this.fireEmo(b,'susto',5,16); }  //+AG sacudida→susto a todas
        this.twists[qi]={f,y:M.yQuakes[qi]}; this.quakeFlash=8; ev.quake=qi; } } }   //+AG evento
    // post-step: bumpers, pickups, meta, anti-atasco
    for(const b of this.balls){ if(b.rank!==null) continue;
      const sp=hyp(b.vx,b.vy), dv=hyp(b.vx-b.prev_vx,b.vy-b.prev_vy);
      if(dv>8.4){ b.hurt=Math.max(b.hurt,6); b.sq=Math.min(1,dv/30); this.fireEmo(b,'dolor',5,8);
        ev.impacts.push({f,id:b.id,i:Math.min(1,Math.max(0.15,dv/30))}); }  //+AG golpe fuerte→dolor + evento (umbral y forma del motor)
      b.prev_vx=b.vx; b.prev_vy=b.vy; if(b.bump_cd>0)b.bump_cd--;
      for(const [bx,by] of M.bumpers){ let dx=b.x-bx,dy=b.y-by;
        if(hyp(dx,dy)<BALL_R+BUMP_R+0.08){ const dl=hyp(dx,dy)||1.0; let ux=dx/dl; const uy=dy/dl;
          if(Math.abs(ux)<0.35) ux=rng.random()<0.5?0.7:-0.7;
          if(b.bump_cd===0){ b.vx+=ux*J_BUMP; b.vy+=-Math.abs(uy)*J_BUMP*0.6-1.5; this._clamp(b,V_CLAMP); b.bump_cd=12; b.sq=0.5;
            ev.bump.push({f,x:bx,y:by,id:b.id}); }   //+AG evento (forma del motor)
          else if(sp<2.5){ b.vx+=ux*2.5; } break; } }
      for(const p of M.powerups){ if(!p.taken&&hyp(b.x-p.x,b.y-p.y)<BALL_R+0.4){ p.taken=true;
        ev.pickup.push({f,id:b.id,team:b.team,type:p.type,x:p.x,y:p.y});   //+AG evento (forma del motor)
        if(p.type==='turbo'){ b.turbo=TURBO_DUR; this.fireEmo(b,'sorpresa',4,12); }
        else if(p.type==='giant'){ b.giant=GIANT_DUR; b.scale=GIANT_SCALE; b.m=2.0; this.fireEmo(b,'chuleria',6,50); }
        else if(p.type==='relay'){ for(const m of this.byTeam[b.team]) if(m.id!==b.id&&m.rank===null){ m.turbo=RELAY_DUR; this.fireEmo(m,'sorpresa',4,12); } this.fireEmo(b,'sorpresa',4,12);
          ev.relay.push({f,id:b.id,team:b.team,x:p.x,y:p.y}); }   //+AG evento (forma del motor)
        else if(p.type==='star'){ b.star=STAR_DUR; b.m=STAR_MASS; b.scale=1.15; this.fireEmo(b,'chuleria',6,50); } break; } }
      if(b.y<GATE_Y){ this.placed++; b.rank=this.placed; b.cheer=70; b.finF=f; this.team_done[b.team]++;
        ev.finishes.push({f,id:b.id,team:b.team,rank:this.placed});   //+AG evento (forma del motor; el rank sintético del jugador en endHold NO emite)
        // GANADOR = primer EQUIPO que mete sus `ballsPerTeam` bolas. Torneo: 3 bolas (como el vídeo). INDIVIDUAL:
        //   ballsPerTeam=1 ⇒ la 1ª bola que cruza GATE_Y GANA (carrera pura, como redlight individual). Su color
        //   sale como winner_team (equipo de 1) → coronación/celebración intactas; el resto sigue puntuando rank.
        //+AG INDIVIDUAL: se decide el ganador (1ª en cruzar) pero NO se arranca el cierre aquí: la ronda espera a
        //   que el JUGADOR cruce para no cortarle la carrera a media caída (antes moría 4.5s tras el 1º y el
        //   rezagado no veía nada). Torneo: cierre igual que siempre (identidad byte a byte).
        if(this.team_done[b.team]>=this.ballsPerTeam && this.decision_frame===null){ this.winner_team=b.team; this.decision_frame=f; if(!this.individual) this.endHold=WIN_HOLD; }
        if(b.isPlayer){ this.playerDoneF=f; if(this.individual && this.endHold<0) this.endHold=WIN_HOLD; } continue; }   //+AG individual: el cierre arranca cuando cruzo YO (gane o pierda) → siempre veo mi llegada + la celebración
      // (sin tirón al decidirse: el jugador termina a ritmo natural; El Cierre ya evita eternizarse)
      //+AG v0.9 CERO RECOLOCACIÓN: se ELIMINAN el "frozen kick" (b.vx=±3.2, ~123/carrera) y el "anti-atasco por
      //   ventana" (b.vx=dir·(5..8.6), ~58/carrera). Eran rescates que SETEABAN velocidad de golpe, diseñados para
      //   la física rebotona vieja; con el PESO (baja restitución) "ir lento" es normal y los disparaba sin cesar,
      //   causando el "movimiento sin causa" que ve el jugador. La geometría v0.8 (columna de muro flush + fusión de
      //   cunas) ya evita los nidos estables → ningún rescate es necesario. Prohibido setear velocidad/posición.
    }
    //+AG v0.11 APILADO: las bolas que YA llegaron NO desaparecen, siguen cayendo y se apilan al fondo, ESPERANDO
    //   (como el vídeo). Física simple aparte (gravedad+muros+suelo+bola-bola), no cuenta para la carrera ni el tracker.
    const fin=this.balls.filter(x=>x.rank!==null && !(this.decision_frame!==null && x.team===this.winner_team));
    for(const b of fin){ b.vy-=G*DT*SUBSTEPS; if(b.vy<-VTERM)b.vy=-VTERM; b.vx*=0.985; b.x+=b.vx*DT*SUBSTEPS; b.y+=b.vy*DT*SUBSTEPS;
      const fl=BALL_R*1.02; if(b.y<fl){ b.y=fl; if(b.vy<0)b.vy=-b.vy*0.22; b.vx*=0.82; }
      if(b.x>XHALF-BALL_R){ b.x=XHALF-BALL_R; if(b.vx>0)b.vx=-b.vx*0.4; } if(b.x<-XHALF+BALL_R){ b.x=-XHALF+BALL_R; if(b.vx<0)b.vx=-b.vx*0.4; } }
    for(let i=0;i<fin.length;i++)for(let j=i+1;j<fin.length;j++){ const a=fin[i],c=fin[j]; let dx=c.x-a.x,dy=c.y-a.y,d=hyp(dx,dy),mind=BALL_R*2;
      if(d>0&&d<mind){ const nx=dx/d,ny=dy/d,ov=(mind-d)/2; a.x-=nx*ov;a.y-=ny*ov;c.x+=nx*ov;c.y+=ny*ov;
        const vn=(c.vx-a.vx)*nx+(c.vy-a.vy)*ny; if(vn<0){ const jj=-1.2*vn/2; a.vx-=jj*nx;a.vy-=jj*ny;c.vx+=jj*nx;c.vy+=jj*ny; } } }
    // cámara
    const running=this.aliveBalls().map(b=>b.y).sort((a,b)=>a-b), leadY=running.length?running[0]:GATE_Y;
    const py=this.player.rank!==null?GATE_Y+3:this.player.y;
    let ty,tscale;
    if(this.decision_frame!==null&&this.player.rank!==null){ ty=GATE_Y+CELEB_SCALE*0.32; tscale=CELEB_SCALE; }   // celebración plena solo cuando el jugador ya llegó
    //+AG INDIVIDUAL: en cuanto hay ganador (aunque tú sigas cayendo) la cámara ENCUADRA LA META, no tu bola arriba.
    //   Antes se quedaba contigo a media caída y el ganador cruzaba/celebraba fuera de plano → "me dice que ganó
    //   rosa pero no veo bolas rosas bailando" (Jaime 2026-07-23). Con esto ves a la ganadora cruzar y bailar
    //   mientras tú bajas hacia la meta a por tu puesto. Solo individual: el torneo/vídeo no cambia (identidad).
    else if(this.individual&&this.decision_frame!==null){ ty=GATE_Y+FINISH_SCALE/2-3.0; tscale=FINISH_SCALE; }
    else { const foc=Math.min(py,leadY+6); if(foc<GATE_Y+CAM_FOCUS_ZONE){ ty=GATE_Y+FINISH_SCALE/2-3.0; tscale=FINISH_SCALE; }
      else { ty=Math.min(Math.max(py,CAM_SCALE/2-1.0),TOP-CAM_SCALE/2); tscale=CAM_SCALE; } }
    this.cam+=(ty-this.cam)*0.12; this.cam_scale+=(tscale-this.cam_scale)*0.08;
    if(this.quakeFlash>0)this.quakeFlash--;
    // fin: la carrera se decide cuando un EQUIPO completa (arriba). Backstop por si nadie completa a 3600.
    if(f>=3600 && this.decision_frame===null){ let best=0,bc=-1; for(let t=0;t<this.nTeams;t++) if(this.team_done[t]>bc){bc=this.team_done[t];best=t;} this.winner_team=best; this.decision_frame=f; this.endHold=WIN_HOLD; }   //+AG generalizado a nTeams (default t<4)
    //+AG INDIVIDUAL: tope de seguridad — si tardas >10s en cruzar tras decidirse, se cierra igual (no cuelga la ronda).
    if(this.individual && this.decision_frame!==null && this.endHold<0 && f-this.decision_frame>300) this.endHold=WIN_HOLD;
    if(this.endHold>=0){ this.endHold--; if(this.endHold===0){
      if(this.player.rank===null){ const ahead=this.balls.filter(x=>x!==this.player&&(x.rank!==null||x.y<this.player.y)).length; this.player.rank=ahead+1; this.player.finF=f; }  // puesto final del jugador por su posición
      this.done=true; } }
    //+AG acumular histórico (forma this.events del motor, para ?capture=1 con runToEnd/sfxmap)
    const E=this.events;
    for(const k of ['impacts','finishes','bump','boost','pickup','relay','gatebreak','nitro','shieldup','super']) if(ev[k].length) E[k].push(...ev[k]);
    return ev;   //+AG
  }
  playerPlace(){ if(this.player.rank) return this.player.rank; let ahead=1; for(const b of this.balls){ if(b!==this.player&&(b.rank!==null||b.y<this.player.y)) ahead++; } return ahead; }
}

//+AG exports del módulo: la superficie del motor (race/sim.js del canal) + los extras de la capa de agencia
export { Sim, RNG, TEAMS, SHORT_COLORS, GATE_H, FPS, WIDTH, GATE_Y, BALL_R, CAM_SCALE, TOP,
         DIR, N_BALLS, XHALF, ASPA_R, ASPA_THICK, ASPA_W, PLAT_HW, PLAT_HH, TILE_HP,
         NITRO_CD, SHIELD_DUR, SHIELD_CD, STAR_DUR };
