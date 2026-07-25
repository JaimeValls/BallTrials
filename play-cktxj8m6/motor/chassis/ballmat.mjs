// YouBall · MATERIAL "VINILO GLOSSY" de las bolas (mini-shader propio, docs/41).
// Look de juguete de vinilo de la referencia de marca: degradado de volumen + highlight blanco
// grande arriba-izquierda + brillo secundario + BORDE oscuro tipo contorno + rebote violeta abajo.
// Es un matcap PROCEDURAL en el fragment (sin luces, sin texturas, solo ~20 ops por pixel):
// MAS BARATO que el MeshStandardMaterial anterior (que pagaba 2 luces + ambiente) y movil-friendly.
// COMPATIBILIDAD: expone .color / .emissive / .emissiveIntensity como el material viejo, asi los
// tintes dinamicos de los modos (estrella Carrera, chamuscado Suelo, stun Recolecta) siguen igual.
// El brillo usa las normales reales -> con squash & stretch el highlight se estira solo (gratis).
// Las caras NO se tocan aqui: siguen siendo sprite unlit fuera del bloom ([[no-glow-over-faces]]).
import * as THREE from 'three';

// Ajustes de LOOK por defecto (calibrados en _look.html; el lab los puede pisar en vivo).
// REGLA DE ORO DEL COLOR (por que se lavaban las bolas una y otra vez): todo lo "glossy" (highlight,
// chispa, brillo de borde, aclarado de volumen) SUMA BLANCO sobre el color, y sumar blanco DESATURA
// por construccion. Solucion permanente: el shader separa CUERPO (el color, que se re-satura con
// satFloor -> rojo=rojo, azul=azul) del GLOSS (reflejos blancos, pequenos y ENCIMA). Si en el futuro
// hay que subir brillo, subelo en el GLOSS, nunca metiendo blanco en el cuerpo. Ver docs/41 y _look.html
// (fila MINI a tamano de juego + ?freeze=1: la saturacion se JUZGA con numeros ahi, no a ojo).
export const LOOK = {
  shade:    0.55,   // fuerza del degradado de volumen (0 = plano)
  rim:      0.80,   // oscuridad del borde/contorno (0 = sin contorno)
  rimW:     0.30,   // anchura del borde (fraccion del radio visto)
  spec:     0.82,   // intensidad del highlight principal (blanco, arriba-izq)
  specHard: 0.88,   // dureza del highlight (0 = suave difuso, 1 = borde duro tipo vinilo)
  specSize: 0.30,   // tamano del highlight principal (compacto: NO debe cubrir media bola = lavado)
  spec2:    0.50,   // brillo secundario pequeno (chispa nitida)
  edge:     0.24,   // specular de BORDE: banda FINA en el contorno (0.60 lavaba: cubria un arco enorme de blanco)
  bounce:   0.14,   // luz de rebote violeta (abajo-derecha), integra con fondos morados
  glow:     0.20,   // cuanto suma el canal emissive (compat estrella/gominola). Bajo: aclaraba de mas.
  satFloor: 0.74,   // SALVAGUARDA: saturacion minima del CUERPO. La bola NUNCA se lava por debajo de esto.
};

const VS = /* glsl */`
varying vec3 vN;
void main(){
  vN = normalMatrix * normal;            // view-space; normalMatrix ya corrige el squash no uniforme
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FS = /* glsl */`
uniform vec3 uColor; uniform vec3 uEmissive; uniform float uEmissiveI;
uniform float uShade, uRim, uRimW, uSpec, uSpecHard, uSpecSize, uSpec2, uEdge, uBounce, uGlow, uSatFloor;
varying vec3 vN;
// SALVAGUARDA DE COLOR: sube la saturacion HSV de c hasta al menos 'floor' sin tocar su brillo (mx) ni su
// tono. Es lo que garantiza que rojo=rojo aunque el sombreado haya aclarado el cuerpo. Solo actua si hace
// falta (s < floor) y matematicamente mantiene cada canal en [0, mx] (no rompe nada, no genera negativos).
vec3 keepSat(vec3 c, float floor){
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float s = (mx < 1e-4) ? 0.0 : (mx - mn) / mx;
  if (s >= floor || s < 1e-4) return c;
  return mx - (mx - c) * (floor / s);            // separa los canales de mx -> mas saturado, mismo mx
}
void main(){
  vec3 n = normalize(vN);
  vec2 d = n.xy;                                   // coords tipo matcap: |d|=1 en la silueta
  float L = length(d);
  // ============ CUERPO (el COLOR del equipo: esto DEBE leerse como rojo/azul/amarillo) ============
  // volumen: claro hacia arriba-izquierda (misma direccion que el catchlight de los ojos), profundo abajo.
  float t = clamp(0.5 + 0.5 * dot(n, normalize(vec3(-0.35, 0.55, 0.62))), 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  // el volumen OSCURECE la zona en sombra y como MUCHO llega al color pleno (x1.0): NUNCA aclara por
  // encima del color (aclarar hacia blanco = lavar; oscurecer conserva el tono). Ese era el motivo de fondo
  // de que las bolas salieran claras/blanquecinas pese a tener buen color base.
  vec3 body = uColor * mix(1.0 - uShade, 1.0, t);
  // borde oscuro: tinta violeta que CONSERVA el matiz del equipo (no negro muerto)
  float rim = smoothstep(1.0 - uRimW, 1.0, L);
  body = mix(body, uColor * vec3(0.10, 0.08, 0.18) + vec3(0.008, 0.006, 0.018), rim * uRim);
  // rebote violeta abajo-derecha: asienta la bola en los fondos morados de las arenas (colorea, no lava)
  float bb = 1.0 - smoothstep(0.15, 0.80, distance(d, vec2(0.44, -0.58)));
  body += vec3(0.36, 0.22, 0.65) * (uBounce * bb * bb);
  body += uEmissive * (uEmissiveI * uGlow);       // compat: destello de estrella, apagado en stun...
  body = keepSat(body, uSatFloor);                // <<< AQUI se respeta el color pase lo que pase
  // ============ GLOSS (reflejos BLANCOS: se permite que laven porque son PEQUENOS y van ENCIMA) ======
  // en bolas OSCURAS un reflejo blanco puro canta como pegatina: se atenua (hiK) y se tinta al propio
  // color aclarado (hiCol). En claras no cambia nada (hiT=1 -> blanco puro) para no tocar su calibracion.
  float lum = dot(uColor, vec3(0.299, 0.587, 0.114));
  float hiT = smoothstep(0.12, 0.62, lum);
  float hiK = mix(0.55, 1.0, hiT);
  vec3 hiCol = mix(clamp(uColor * 1.8 + 0.12, 0.0, 1.0), vec3(1.0), hiT);
  // highlight principal DURO y COMPACTO tipo vinilo (specSize pequeno = no cubre media bola = no lava)
  float s1 = 1.0 - smoothstep(uSpecSize * mix(0.25, 0.92, uSpecHard), uSpecSize, distance(d, vec2(-0.36, 0.45)));
  vec3 gloss = hiCol * (uSpec * s1 * hiK);
  // chispa secundaria pequena y nitida, algo mas abajo (como en la referencia)
  float s2 = 1.0 - smoothstep(0.03, 0.10, distance(d, vec2(-0.08, 0.14)));
  gloss += hiCol * (uSpec2 * s2 * hiK);
  // specular de BORDE: banda FINA junto a la silueta, mas fuerte abajo-derecha (lectura 3D sin lavar)
  vec2 dn = d / max(L, 1e-4);
  float band = smoothstep(0.70, 0.86, L) * (1.0 - smoothstep(0.92, 0.995, L));
  float w = pow(clamp(0.25 + 0.75 * dot(dn, normalize(vec2(0.55, -0.80))), 0.0, 1.0), 1.6);
  gloss += vec3(1.0) * (uEdge * band * w);
  gl_FragColor = vec4(body + gloss, 1.0);          // gloss ENCIMA del cuerpo ya saturado
}`;

// Crea el material de UNA bola. col = [r,g,b] 0..1 (ya saturado por sat() del chasis).
// El programa GLSL se comparte entre instancias (Three cachea por shader identico).
export function ballMaterial(col, look = LOOK){
  const u = {
    uColor:     { value: new THREE.Color(col[0], col[1], col[2]) },
    uEmissive:  { value: new THREE.Color(col[0], col[1], col[2]) },
    uEmissiveI: { value: 0.40 },
    uShade: { value: look.shade }, uRim: { value: look.rim }, uRimW: { value: look.rimW },
    uSpec: { value: look.spec }, uSpecHard: { value: look.specHard }, uSpecSize: { value: look.specSize },
    uSpec2: { value: look.spec2 }, uEdge: { value: look.edge },
    uBounce: { value: look.bounce }, uGlow: { value: look.glow },
    uSatFloor: { value: look.satFloor ?? 0.62 },
  };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS });
  // fachada compatible con el material viejo: los modos hacen mat.color.setRGB(...), mat.emissive.copy(...)
  m.color = u.uColor.value;
  m.emissive = u.uEmissive.value;
  Object.defineProperty(m, 'emissiveIntensity', {
    get(){ return u.uEmissiveI.value; }, set(v){ u.uEmissiveI.value = v; },
  });
  return m;
}

// Pisa los ajustes de look de UN material ya creado (lo usa el lab _look.html en vivo).
//+AG doc 41 bloque G: MATERIAL POR BOLA-HEROE. Que tu Volcan se reconozca EN PISTA, no solo en el menu.
//  Por que el material y no el color: en carrera el color lo manda tu EQUIPO/slot, no el heroe. Si la
//  identidad dependiera del color, en pista dejarias de ser Volcan. El material sobrevive al recoloreado
//  (es la palanca fuerte de la formula del doc 41: material > cara > prop > efecto > color).
//  Cada entrada es un DELTA sobre LOOK, no un look entero: si mañana se recalibra el look de marca en
//  _look.html, estas heredan la mejora en vez de quedarse congeladas en los valores de hoy.
//  satFloor NO se toca en ninguna: es la salvaguarda anti-lavado y bajarla es justo el fallo que el
//  shader existe para evitar. La translucidez de Burbuja/Fantasma sale de shade/rim/edge, no de desaturar.
export const ARCH_LOOK = {
  cohete:  { spec: 0.92, specHard: 0.95, edge: 0.30 },                                            // vinilo pulido, aeronautico
  tanque:  { spec: 0.62, specHard: 0.80, specSize: 0.34, rim: 0.92, shade: 0.58 },                // placa de vinilo: brillo ancho y contorno fuerte
  chispa:  { spec: 0.90, specSize: 0.24, spec2: 0.85, glow: 0.42 },                               // cargada: chispa nitida y brillo propio
  pinball: { spec: 1.00, specHard: 1.00, specSize: 0.20, spec2: 0.95, edge: 0.42 },               // laca espejo: highlight diminuto y durisimo
  lapa:    { spec: 0.22, specHard: 0.35, specSize: 0.50, spec2: 0.10, edge: 0.10, shade: 0.62 },  // goma MATE: practicamente sin brillo
  burbuja: { shade: 0.30, rim: 0.45, edge: 0.55, spec: 0.95, specHard: 0.55, specSize: 0.45, glow: 0.34 },   // jabon: cuerpo tenue, borde luminoso
  meteoro: { spec: 0.26, specHard: 0.45, shade: 0.90, rim: 0.98, glow: 0.08 },                    // roca APAGADA y oscura. El poco glow es deliberado: separa a Meteoro de Volcan, que es el fundido
  bunker:  { spec: 0.18, specHard: 0.30, spec2: 0.08, edge: 0.08, shade: 0.70, rim: 0.98 },       // hormigon: cero brillo, contorno duro
  volcan:  { glow: 0.70, shade: 0.60, rim: 0.86, spec: 0.45, specHard: 0.65 },                    // FUNDIDO: brilla desde dentro. Es lo que lo separa de Meteoro (misma idea, distinta temperatura)
  yunque:  { spec: 0.60, specHard: 0.92, specSize: 0.18, edge: 0.50, shade: 0.72, rim: 0.95, bounce: 0.22 }, // hierro forjado
  fantasma:{ shade: 0.25, rim: 0.35, edge: 0.60, spec: 0.70, specHard: 0.40, specSize: 0.55, glow: 0.40 },   // eterea: casi sin cuerpo, borde que la dibuja
  estrella:{ spec: 1.00, specHard: 0.94, specSize: 0.26, spec2: 1.00, edge: 0.45, glow: 0.38, bounce: 0.20 },// oro pulido de marca
};
// Devuelve el LOOK completo de un arquetipo, o null si no lo conoce (=> el llamante usa el de siempre).
export const archLook = (k) => (k && ARCH_LOOK[k]) ? Object.assign({}, LOOK, ARCH_LOOK[k]) : null;

export function applyLook(mat, look){
  const u = mat.uniforms; if (!u || !u.uShade) return;
  u.uShade.value = look.shade; u.uRim.value = look.rim; u.uRimW.value = look.rimW;
  u.uSpec.value = look.spec; u.uSpecHard.value = look.specHard; u.uSpecSize.value = look.specSize;
  u.uSpec2.value = look.spec2; u.uEdge.value = look.edge;
  u.uBounce.value = look.bounce; u.uGlow.value = look.glow;
  if (u.uSatFloor && look.satFloor !== undefined) u.uSatFloor.value = look.satFloor;
}
