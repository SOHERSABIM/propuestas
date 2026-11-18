// Geometrías de los componentes de instalaciones. Una sola vez por tipo (compartidas, nunca se liberan), con colores
// por vértice; cada tipo se dibuja como UN InstancedMesh. Unidades en metros salvo que se diga «unitaria»: las
// unitarias se escalan por instancia (largo, sección) y llevan sus bridas/juntas en proporción.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

/** Acumulador de partes → una geometría fusionada con color por vértice. */
class Partes {
  constructor() { this.l = []; }
  _add(g, hex, m) {
    if (m) g.applyMatrix4(m);
    const ng = g.index ? g.toNonIndexed() : g; ng.deleteAttribute('uv');
    const n = ng.attributes.position.count, col = new Float32Array(n * 3); _c.set(hex);
    for (let i = 0; i < n; i++) { col[3 * i] = _c.r; col[3 * i + 1] = _c.g; col[3 * i + 2] = _c.b; }
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); this.l.push(ng); return this;
  }
  caja(cx, cy, cz, sx, sy, sz, hex, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    return this._add(new THREE.BoxGeometry(sx, sy, sz), hex, m);
  }
  /** Cilindro con eje 'x' | 'y' | 'z'. */
  cil(cx, cy, cz, r, h, hex, eje = 'y', seg = 12, abierto = false, rTop = r) {
    const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, abierto);
    if (eje === 'x') g.rotateZ(Math.PI / 2); else if (eje === 'z') g.rotateX(Math.PI / 2);
    return this._add(g, hex, new THREE.Matrix4().makeTranslation(cx, cy, cz));
  }
  /** Prisma vertical sobre un polígono convexo en planta [x,z] (y0..y1). */
  prisma(pts, y0, y1, hex) {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    return this._add(g, hex, new THREE.Matrix4().makeTranslation(0, y0, 0));
  }
  /** Tronco rectangular a lo largo de x: sección (h0,w0) en x0 y (h1,w1) en x1 (centrado). */
  tronco(x0, x1, h0, w0, h1, w1, hex) {
    const P = (x, h, w) => [[x, -h / 2, -w / 2], [x, h / 2, -w / 2], [x, h / 2, w / 2], [x, -h / 2, w / 2]];
    const a = P(x0, h0, w0), b = P(x1, h1, w1), pos = [];
    const quad = (p, q, r, s) => pos.push(...p, ...q, ...r, ...p, ...r, ...s);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(a[i], b[i], b[j], a[j]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return this._add(g, hex);
  }
  /** Tubo barrido a lo largo de una curva: anillos con radio variable. curva(t)→[x,y,z]; radio(t,i)→r; color(i)→hex. */
  barrido(n, seg, curva, radio, color) {
    const pos = [], col = [], idx = []; const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = curva(t), q = curva(Math.min(1, t + 1e-3)), p0 = curva(Math.max(0, t - 1e-3));
      T.set(q[0] - p0[0], q[1] - p0[1], q[2] - p0[2]).normalize();
      N.set(0, 0, 1); if (Math.abs(T.z) > 0.9) N.set(1, 0, 0); B.crossVectors(T, N).normalize(); N.crossVectors(B, T).normalize();
      const r = radio(t, i); _c.set(color(i));
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        pos.push(p[0] + r * (cs * N.x + sn * B.x), p[1] + r * (cs * N.y + sn * B.y), p[2] + r * (cs * N.z + sn * B.z)); col.push(_c.r, _c.g, _c.b);
      }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < seg; k++) { const a = i * seg + k, b = i * seg + (k + 1) % seg, c = (i + 1) * seg + k, d = (i + 1) * seg + (k + 1) % seg; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const ng = g.toNonIndexed(); ng.computeVertexNormals(); this.l.push(ng); return this;
  }
  geo() { const g = mergeGeometries(this.l, false); this.l.forEach((x) => x.dispose()); return g; }
}

const cache = {};
const unica = (k, f) => (cache[k] ??= f());

// ───────────── AIRE ─────────────
const TF = 0.035;   // espesor relativo de brida
const BODY = 0xdcdcdc, BRIDA = 0xffffff, SOMBRA = 0x9aa6b1;

/** Tramo recto unitario a lo largo de x (largo 1, sección 1×1): cuerpo, dos bridas, tornillos y rigidizadores en cruz. */
export const geoTramo = () => unica('tramo', () => {
  const p = new Partes();
  p.caja(0, 0, 0, 1 - 2 * TF, 1, 1, BODY);
  for (const s of [-1, 1]) {
    p.caja(s * (0.5 - TF / 2), 0, 0, TF, 1.13, 1.13, BRIDA);
    for (const [y, z] of [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]]) p.caja(s * (0.5 - TF / 2 - 0.02), y * 1.04, z * 1.04, TF * 0.7, 0.05, 0.05, SOMBRA);
  }
  // rigidizadores en cruz (marcas diagonales) en cara superior y laterales
  const a = Math.atan2(0.5, 0.8);
  p.caja(0, 0.503, 0, 0.9, 0.006, 0.05, SOMBRA, 0, a, 0); p.caja(0, 0.503, 0, 0.9, 0.006, 0.05, SOMBRA, 0, -a, 0);
  p.caja(0, 0, 0.503, 0.9, 0.05, 0.006, SOMBRA, a, 0, 0); p.caja(0, 0, 0.503, 0.9, 0.05, 0.006, SOMBRA, -a, 0, 0);
  p.caja(0, 0, -0.503, 0.9, 0.05, 0.006, SOMBRA, a, 0, 0); p.caja(0, 0, -0.503, 0.9, 0.05, 0.006, SOMBRA, -a, 0, 0);
  return p.geo();
});

/** Codo cuadrado unitario: caras abiertas −x y +z, esquina exterior (+x,−z) achaflanada; bridas en las caras abiertas. */
export const geoCodo = () => unica('codo', () => {
  const p = new Partes();
  p.prisma([[-0.5 + TF, -0.5], [0.1, -0.5], [0.5, -0.1], [0.5, 0.5 - TF], [-0.5 + TF, 0.5 - TF]], -0.5, 0.5, BODY);
  p.caja(-0.5 + TF / 2, 0, 0, TF, 1.13, 1.13, BRIDA);
  p.caja(0, 0, 0.5 - TF / 2, 1.13, 1.13, TF, BRIDA);
  p.caja(-0.5 + TF + 0.03, 0.503, 0.45, 0.08, 0.006, 0.07, SOMBRA);
  return p.geo();
});

/** Té (cuerpo principal a lo largo de x, pico lateral hacia +z). Sección: ancho z = 1 (0.7 m), alto y = 1 (0.4 m). */
const te = (nombre, relW, relH, zFin) => unica(nombre, () => {
  const p = new Partes();
  p.caja(0, 0, 0, 1 - 2 * TF, 1, 1, BODY);
  for (const s of [-1, 1]) p.caja(s * (0.5 - TF / 2), 0, 0, TF, 1.13, 1.13, BRIDA);
  const zl = zFin - 0.5, tfz = 0.05;     // largo del pico y espesor de su brida (en unidades de z)
  p.caja(0, 0, 0.5 + zl / 2 - tfz / 2, relW, relH, zl - tfz, BODY);
  p.caja(0, 0, zFin - tfz / 2, relW * 1.14, relH * 1.14, tfz, BRIDA);
  return p.geo();
});
export const geoTeeR = () => te('teeR', 0.4 / 0.9, 0.75, 0.55 / 0.7);
export const geoTeeP = () => te('teeP', 0.7 / 1.0, 1.0, 0.55 / 0.7);

/** Reducción unitaria a lo largo de x: sección completa en −x y 0.75 en +x. */
export const geoReduccion = () => unica('reduccion', () => {
  const p = new Partes();
  p.tronco(-0.5 + TF, 0.5 - TF, 1, 1, 0.75, 0.75, BODY);
  p.caja(-0.5 + TF / 2, 0, 0, TF, 1.13, 1.13, BRIDA);
  p.caja(0.5 - TF / 2, 0, 0, TF, 0.75 * 1.13, 0.75 * 1.13, BRIDA);
  return p.geo();
});

/** Compuerta de regulación: tramo con cuadrante y palanca en el costado +z. */
export const geoCompuerta = () => unica('compuerta', () => {
  const p = new Partes();
  p.caja(0, 0, 0, 1 - 2 * TF, 1, 1, BODY);
  for (const s of [-1, 1]) p.caja(s * (0.5 - TF / 2), 0, 0, TF, 1.13, 1.13, BRIDA);
  p.caja(0, 0, 0.5 + 0.12, 0.5, 0.7, 0.24, 0x4a525a);          // caja del cuadrante
  p.caja(0.08, 0.14, 0.5 + 0.27, 0.06, 0.62, 0.05, 0xf0f0f0, 0, 0, 0.45);   // palanca
  p.caja(0, 0, 0.5 + 0.26, 0.1, 0.1, 0.06, 0x2c3238);           // volante
  return p.geo();
});

/** Trapecio: origen arriba (losa), perfil horizontal en y = −1. Ancho unitario sobre x. */
export const geoSoporte = () => unica('soporte', () => {
  const p = new Partes();
  for (const s of [-0.5, 0.5]) {
    p.caja(s, -0.5, 0, 0.02, 1, 0.02, 0xa6aeb6);                       // varilla roscada
    p.caja(s, -0.006, 0, 0.06, 0.012, 0.07, 0x8a9097);                 // placa de anclaje
    p.caja(s, -1 + 0.045, 0, 0.04, 0.028, 0.04, 0x4b5258); p.caja(s, -1 - 0.045, 0, 0.04, 0.028, 0.04, 0x4b5258);   // tuercas
  }
  p.caja(0, -1, 0, 1.12, 0.036, 0.06, 0x6f767e);                        // perfil (canal)
  p.caja(0, -1 - 0.019, 0, 1.0, 0.004, 0.024, 0x30353a);                // ranura del canal
  return p.geo();
});

/** Difusor cuadrado de techo: placa, escalones del cono y cuello. Origen: centro de la placa. */
export const geoDifusor = () => unica('difusor', () => {
  const p = new Partes();
  p.caja(0, 0, 0, 0.6, 0.03, 0.6, 0xffffff);
  for (const s of [-1, 1]) { p.caja(s * 0.295, 0.02, 0, 0.012, 0.02, 0.6, 0xe8edf1); p.caja(0, 0.02, s * 0.295, 0.6, 0.02, 0.012, 0xe8edf1); }
  p.caja(0, -0.022, 0, 0.46, 0.018, 0.46, 0xd5dbe0); p.caja(0, -0.04, 0, 0.32, 0.018, 0.32, 0xc3cbd2); p.caja(0, -0.058, 0, 0.18, 0.018, 0.18, 0xaab3bb);
  p.cil(0, 0.04, 0, 0.125, 0.05, 0xb4bcc4, 'y', 14);
  return p.geo();
});

/** Conexión flexible (ducto corrugado) con collarín: origen arriba (en el ramal), cuelga hacia −y; combada. */
export const geoFlex = () => unica('flex', () => {
  const p = new Partes();
  const N = 18;
  p.barrido(N, 10, (t) => [0.07 * Math.sin(Math.PI * t), -t, 0], (t, i) => 0.105 + (i % 2 ? 0 : 0.013), (i) => (i % 2 ? 0x9aa3ab : 0xd4dade));
  p.caja(0, -0.004, 0, 0.3, 0.012, 0.3, 0xe8edf1);
  p.cil(0, -0.03, 0, 0.122, 0.04, 0x4b5258, 'y', 12); p.cil(0, -0.965, 0, 0.122, 0.04, 0x4b5258, 'y', 12);
  return p.geo();
});

/** Rejilla de retorno con caja: origen en la cara inferior del ducto, cuelga 0.18 m. Huella 0.9 (x) × 0.5 (z). */
export const geoRetorno = () => unica('retorno', () => {
  const p = new Partes();
  p.caja(0, -0.06, 0, 0.84, 0.12, 0.44, 0xc9d3dc);
  p.caja(0, -0.165, 0.235, 0.9, 0.03, 0.04, 0xffffff); p.caja(0, -0.165, -0.235, 0.9, 0.03, 0.04, 0xffffff);
  p.caja(0.43, -0.165, 0, 0.04, 0.03, 0.5, 0xffffff); p.caja(-0.43, -0.165, 0, 0.04, 0.03, 0.5, 0xffffff);
  for (let i = 0; i < 6; i++) p.caja(0, -0.162, -0.175 + i * 0.07, 0.82, 0.012, 0.045, 0x7f8c97, 0.55, 0, 0);
  return p.geo();
});

/** Bajante de unidad (cuello de descarga) unitario: origen arriba (base de la unidad), cuelga hasta y = −1; sección 1×1. */
export const geoBajante = () => unica('bajante', () => {
  const p = new Partes();
  p.caja(0, -0.5, 0, 1, 1 - 2 * 0.05, 1, BODY);
  p.caja(0, -0.025, 0, 1.16, 0.05, 1.16, BRIDA); p.caja(0, -0.975, 0, 1.2, 0.05, 1.2, BRIDA);
  p.caja(0, -0.5, 0, 1.04, 0.22, 1.04, 0x4a525a);     // junta de lona
  p.caja(0, -0.5, 0, 1.06, 0.015, 1.06, 0x8a9097);
  return p.geo();
});

/** Anillo poligonal plano (rejilla de protección): n cajas tangentes. */
function anillo(p, cx, cy, cz, r, w, h, hex, n = 20) {
  const l = 2 * r * Math.tan(Math.PI / n) + 0.004;
  for (let i = 0; i < n; i++) { const a = ((i + 0.5) / n) * Math.PI * 2; p.caja(cx + Math.cos(a) * r, cy, cz - Math.sin(a) * r, l, h, w, hex, 0, a + Math.PI / 2, 0); }
}
/** Rejilla de protección del ventilador (aros + radios) con motor central. y0 = cara de la rejilla. */
function rejilla(p, x, z, y0, R, hexRej, hexMotor) {
  for (const r of [0.15, 0.3, R]) anillo(p, x, y0, z, r, 0.014, 0.014, hexRej, r < 0.2 ? 14 : 22);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.caja(x + Math.cos(a) * (R / 2 + 0.05), y0, z - Math.sin(a) * (R / 2 + 0.05), R - 0.1, 0.012, 0.014, hexRej, 0, a, 0); }
  p.cil(x, y0 + 0.03, z, 0.1, 0.07, hexMotor, 'y', 14);       // motor central sobre la rejilla
  p.cil(x, y0 + 0.07, z, 0.06, 0.02, 0x20272e, 'y', 12);
}
const ACENTO_AIRE = 0x3b87c4;
/** Unidad paquete (azotea): gabinete gris con acento de capa, serpentín, capota de retorno y ventiladores bajo rejilla. Origen: centro de la base. */
export const geoUnidad = () => unica('unidad', () => {
  const p = new Partes();
  p.caja(0, 0.1, 0, 2.5, 0.2, 1.7, 0x59626b);                       // base (curb) perimetral
  p.caja(0, 0.045, 0, 2.2, 0.09, 1.4, 0x3d464e);
  p.caja(0, 0.54, 0, 2.4, 0.68, 1.6, 0xc4c9ce);                      // gabinete gris
  p.caja(0, 0.89, 0, 2.44, 0.04, 1.64, 0xaab2b9);                    // cubierta
  for (const x of [-1.0, 1.0]) p.caja(x, 0.54, 0, 0.014, 0.68, 1.62, 0x808b95);            // juntas de paneles
  for (const sz of [-1, 1]) {
    p.caja(0, 0.54, sz * 0.802, 1.9, 0.56, 0.01, 0x7e8d9b);
    for (let i = 0; i < 21; i++) p.caja(-0.9 + i * 0.09, 0.54, sz * 0.808, 0.012, 0.54, 0.012, 0x4f5d6b);
    p.caja(0, 0.84, sz * 0.805, 1.96, 0.04, 0.02, 0xb2bac2); p.caja(0, 0.24, sz * 0.805, 1.96, 0.04, 0.02, 0xb2bac2);
    for (const x of [-0.98, 0.98]) p.caja(x, 0.54, sz * 0.805, 0.04, 0.6, 0.02, 0xb2bac2);
    p.caja(0, 0.905, sz * 0.826, 2.44, 0.03, 0.012, ACENTO_AIRE);   // franja de acento de la capa
  }
  for (const sx of [-1, 1]) { p.caja(sx * 1.205, 0.54, 0, 0.012, 0.5, 1.2, 0xb8bfc6); p.caja(sx * 1.215, 0.54, 0.4, 0.014, 0.1, 0.04, 0x30363c); p.caja(sx * 1.211, 0.74, 0, 0.012, 0.05, 1.2, ACENTO_AIRE); }
  p.caja(-1.38, 0.5, 0, 0.3, 0.42, 1.0, 0xaeb6be); p.caja(-1.5, 0.5, 0, 0.01, 0.34, 0.9, 0x5a6874);
  for (const x of [-0.55, 0.55]) {
    p.cil(x, 0.95, 0, 0.47, 0.1, 0x7f8a95, 'y', 24, true);          // cuello del ventilador
    p.cil(x, 0.9, 0, 0.44, 0.012, 0x20272e, 'y', 24);
    rejilla(p, x, 0, 0.995, 0.45, 0x58636e, 0x3a444e);
  }
  return p.geo();
});

/** Ventilador (palas y cubo) para girar sobre su eje, contenido bajo la rejilla. Origen en el cubo. */
export const geoVentilador = () => unica('ventilador', () => {
  const p = new Partes();
  p.cil(0, 0, 0, 0.075, 0.07, 0x2d3a46, 'y', 12);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.caja(Math.cos(a) * 0.24, 0, -Math.sin(a) * 0.24, 0.34, 0.012, 0.11, 0x3b4c5c, 0.35, a, 0);
  }
  return p.geo();
});

/** Bancada metálica: marco de perfiles (largueros y travesaños) sobre patas con placas y aisladores antivibratorios. Base en y=0, cara superior en H. */
export const geoBancada = (ancho, fondo, H) => unica(`bancada_${ancho}_${fondo}_${H}`, () => {
  const p = new Partes(), ax = ancho / 2 - 0.16, az = fondo / 2 - 0.14, PER = 0x7d8790, PAT = 0x6a737c;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.caja(sx * ax, 0.01, sz * az, 0.24, 0.02, 0.24, 0x4b535b);                     // placa de apoyo
    p.caja(sx * ax, (H - 0.12) / 2 + 0.02, sz * az, 0.08, H - 0.12, 0.08, PAT);     // pata (perfil cuadrado)
    p.cil(sx * ax, H - 0.09, sz * az, 0.055, 0.07, 0x2c3238, 'y', 10);              // aislador antivibratorio
  }
  for (const sz of [-1, 1]) p.caja(0, H - 0.04, sz * az, ancho - 0.1, 0.08, 0.1, PER);   // largueros (canal)
  for (const sx of [-1, 0, 1]) p.caja(sx * ax, H - 0.04, 0, 0.1, 0.08, fondo - 0.1, PER);   // travesaños
  p.caja(0, 0.16, az, ancho - 0.5, 0.04, 0.04, PAT); p.caja(0, 0.16, -az, ancho - 0.5, 0.04, 0.04, PAT);     // arriostres
  return p.geo();
});
/** Cuello de azotea de un ducto: brida, base elevada (curb) con remate y conexión flexible hasta el equipo. Base en y=0 (losa). */
export const geoCuelloAire = () => unica('cuelloAire', () => {
  const p = new Partes();
  p.caja(0, 0.01, 0, 1.0, 0.02, 1.0, 0x555d65);
  for (const s of [-1, 1]) { p.caja(s * 0.38, 0.11, 0, 0.06, 0.2, 0.82, 0x8a949d); p.caja(0, 0.11, s * 0.38, 0.82, 0.2, 0.06, 0x8a949d); }
  p.caja(0, 0.215, 0, 0.9, 0.03, 0.9, 0x666f78);
  p.caja(0, 0.26, 0, 0.62, 0.1, 0.62, 0x4c7fa8);                                      // conexión flexible (lona)
  for (const y of [0.235, 0.285]) p.caja(0, y, 0, 0.66, 0.015, 0.66, 0x2e3a45);
  return p.geo();
});

// ───────────── FRÍO ─────────────
/** Tubo unitario (diámetro 1, largo 1 a lo largo de x). */
export const geoTubo = () => unica('tubo', () => new Partes().cil(0, 0, 0, 0.5, 1, 0xffffff, 'x', 12).geo());
/** Codo de tubería de 90° (diámetro 1, radio de curvatura 1.5): esquina en el origen, entra por −x y sale hacia +y. */
export const geoCodoTubo = () => unica('codoTubo', () => {
  const R = 1.5, p = new Partes();
  p.barrido(8, 10, (t) => { const a = t * Math.PI / 2; return [-R + R * Math.sin(a), R - R * Math.cos(a), 0]; }, () => 0.5, () => 0xffffff);
  return p.geo();
});
/** Válvula de esfera sobre tubería de diámetro 1: largo 2.4 a lo largo de x, palanca hacia +y. */
export const geoValvula = () => unica('valvula', () => {
  const p = new Partes();
  p.cil(0, 0, 0, 0.5, 2.4, 0xd8d0ee, 'x', 12);
  p.cil(0, 0, 0, 0.86, 0.9, 0x6a42b5, 'x', 14);
  for (const s of [-1, 1]) p.cil(s * 0.62, 0, 0, 0.66, 0.22, 0x4d2f8f, 'x', 6);
  p.cil(0, 0.95, 0, 0.17, 0.9, 0xcfc4e8, 'y', 8);
  p.caja(0, 1.5, 0, 2.1, 0.3, 0.38, 0xf0eaff);
  return p.geo();
});
const ACENTO_FRIO = 0x8467bf;
/** Condensadora remota: base con patas, gabinete gris con acento de capa, serpentín en tres caras y ventiladores bajo rejilla con motor central. Origen: centro de la base. */
export const geoCond = () => unica('cond', () => {
  const p = new Partes();
  for (const z of [-0.45, 0.45]) p.caja(0, 0.05, z, 2.2, 0.1, 0.14, 0x30363c);
  p.caja(0, 0.55, 0, 2.1, 0.9, 1.1, 0xc5c9cf);
  p.caja(0, 1.02, 0, 2.2, 0.04, 1.2, 0xaab0b8);
  for (const sz of [-1, 1]) {
    p.caja(0, 0.55, sz * 0.553, 1.9, 0.78, 0.01, 0x7a7e8a);
    for (let i = 0; i < 22; i++) p.caja(-0.95 + i * 0.09, 0.55, sz * 0.559, 0.012, 0.76, 0.012, 0x4c4f5e);
    p.caja(0, 0.96, sz * 0.558, 2.0, 0.05, 0.02, 0xb4bac2); p.caja(0, 0.16, sz * 0.558, 2.0, 0.05, 0.02, 0xb4bac2);
    for (const x of [-0.99, 0.99]) p.caja(x, 0.56, sz * 0.558, 0.05, 0.84, 0.02, 0xb4bac2);
    p.caja(0, 1.0, sz * 0.606, 2.2, 0.035, 0.012, ACENTO_FRIO);   // franja de acento
  }
  p.caja(1.055, 0.5, 0, 0.012, 0.6, 0.86, 0xb9bec6); p.caja(1.065, 0.5, 0.25, 0.012, 0.18, 0.28, ACENTO_FRIO);
  for (const x of [-0.5, 0.5]) {
    p.cil(x, 1.07, 0, 0.47, 0.06, 0x7b8089, 'y', 24, true);
    p.cil(x, 1.02, 0, 0.44, 0.012, 0x20272e, 'y', 24);
    rejilla(p, x, 0, 1.095, 0.45, 0x565a66, 0x3a3e4a);
  }
  return p.geo();
});
/** Pasamuros de azotea de la tubería de frío: brida y base elevada con sellado, para el par líquido/succión. Base en y=0 (losa). */
export const geoCuelloFrio = () => unica('cuelloFrio', () => {
  const p = new Partes();
  p.caja(0, 0.01, 0, 0.7, 0.02, 0.7, 0x555d65);
  for (const s of [-1, 1]) { p.caja(s * 0.27, 0.07, 0, 0.05, 0.1, 0.54, 0x8a949d); p.caja(0, 0.07, s * 0.27, 0.54, 0.1, 0.05, 0x8a949d); }
  p.caja(0, 0.1, 0, 0.5, 0.04, 0.5, 0x3a3f46);                                          // sellado
  return p.geo();
});

// ───────────── LUZ ─────────────
/** Luminaria lineal / riel unitario a lo largo de x: cuerpo, tapas y nervio. Se escala (largo, alto, ancho). */
export const geoLineal = () => unica('lineal', () => {
  const p = new Partes();
  p.caja(0, 0, 0, 0.97, 1, 1, 0xf2f4f5);
  for (const s of [-1, 1]) p.caja(s * 0.4925, 0, 0, 0.015, 1.12, 1.1, 0x8a9097);
  p.caja(0, 0.5, 0, 0.9, 0.35, 0.4, 0xd7dadd);
  for (const s of [-1, 1]) p.caja(0, -0.5, s * 0.5, 0.97, 0.12, 0.05, 0xb9bec3);
  return p.geo();
});
/** Panel (marco y tapa) unitario: x,z ∈ [−0.5, 0.5]; el difusor se dibuja aparte. */
export const geoPanel = () => unica('panel', () => {
  const p = new Partes();
  p.caja(0, 0.3, 0, 0.97, 0.4, 0.95, 0xf2f4f5);
  for (const s of [-1, 1]) { p.caja(0, 0, s * 0.468, 1, 1, 0.065, 0xe6e9ec); p.caja(s * 0.4825, 0, 0, 0.035, 1, 1, 0xe6e9ec); }
  return p.geo();
});
export const geoLente = () => unica('lente', () => new Partes().caja(0, 0, 0, 1, 1, 1, 0xffffff).geo());
/** Spot de riel: brazo, yugo, cuerpo cilíndrico inclinado y lente. Origen: bajo el riel. */
export const geoSpot = () => unica('spot', () => {
  const p = new Partes();
  p.caja(0, -0.015, 0, 0.05, 0.03, 0.07, 0x4a4f55);
  p.cil(0, -0.05, 0, 0.012, 0.05, 0x8a9097, 'y', 6);
  p.caja(0, -0.085, 0, 0.115, 0.012, 0.03, 0x4a4f55);
  p.cil(0, -0.145, 0.025, 0.044, 0.11, 0xf2f4f5, 'y', 14, false, 0.036);
  p.cil(0, -0.202, 0.025, 0.04, 0.008, 0xfff1c9, 'y', 14);
  return p.geo();
});
/** Cable de suspensión unitario: origen arriba (losa), cuelga hasta y = −1. */
export const geoVarilla = () => unica('varilla', () => {
  const p = new Partes();
  p.cil(0, -0.5, 0, 0.0065, 1, 0xffffff, 'y', 6);
  p.caja(0, -0.005, 0, 0.05, 0.01, 0.05, 0xb9bec3);
  p.caja(0, -0.992, 0, 0.022, 0.016, 0.022, 0x5a6168);
  return p.geo();
});
/** Tubo conduit unitario a lo largo de x (radio 0.015): con coples en los extremos. */
export const geoConduit = () => unica('conduit', () => {
  const p = new Partes();
  p.cil(0, 0, 0, 0.015, 1, 0xffffff, 'x', 8);
  for (const s of [-1, 1]) p.cil(s * 0.497, 0, 0, 0.021, 0.006, 0xd0d4d8, 'x', 8);
  return p.geo();
});
/** Caja de conexión: cuerpo, tapa y dos bocas para el tubo (a lo largo de x). */
export const geoCajaConex = () => unica('cajaConex', () => {
  const p = new Partes();
  p.caja(0, 0, 0, 0.12, 0.06, 0.12, 0xe0e3e6);
  p.caja(0, -0.034, 0, 0.1, 0.012, 0.1, 0xb9bec3);
  for (const s of [-1, 1]) p.cil(s * 0.06, 0, 0, 0.02, 0.02, 0xb9bec3, 'x', 8);
  for (const [x, z] of [[-0.045, -0.045], [0.045, -0.045], [-0.045, 0.045], [0.045, 0.045]]) p.caja(x, -0.041, z, 0.012, 0.006, 0.012, 0x4b5258);
  return p.geo();
});

export const GEO_UNIT_CAJA = new THREE.BoxGeometry(1, 1, 1);
export const GEO_PLANO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Canaleta de piso con tapa (unitaria a lo largo de x; ancho 0.24, alto 0.045): marco oscuro, tapa clara con dos nervios. */
export function geoCanaleta() {
  return unica('canaleta', () => {
    const p = new Partes();
    p.caja(0, 0.008, 0, 1, 0.016, 0.26, 0x6f717a);
    p.caja(0, 0.0305, 0, 1, 0.029, 0.22, 0xb9bcc4);
    p.caja(0, 0.0475, -0.06, 1, 0.004, 0.012, 0x8d9099);
    p.caja(0, 0.0475, 0.06, 1, 0.004, 0.012, 0x8d9099);
    return p.geo();
  });
}
