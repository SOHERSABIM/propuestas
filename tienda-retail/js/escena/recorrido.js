// Recorrido en primera persona del paso 7: ruta por los pasillos reales del layout vigente (rejilla de ocupación +
// A*), suavizada y muestreada por longitud de arco para avanzar a velocidad constante, y una MIRADA de comprador
// precalculada por muestra (rumbo y cabeceo): pasea por los entrepaños, mira de frente el muro de refrigerados,
// sube sostenida a un tramo de ducto con difusores y luminarias y, al final, voltea hacia lo que tiene contenido
// para salir retrocediendo por una fachada de cristal. Lógica pura (sin three). Frente: núcleo.
import { caja, dentro, frente, distSegmento } from '../core/geom.js';

const CELDA = 0.25, HOLGURA = 0.55, HOLGURA_COL = 1.4, HOLGURA_MURO = 0.8; // la lente no pasa rozando columnas ni muebles
const PASO = 0.1;                    // muestreo de la ruta (m)
const OJOS = 1.65;
/** Giro máximo de la mirada (°/s): caminata tranquila con cámara estabilizada. */
export const GIRO_MAX = 37;
const RAD = Math.PI / 180;
/** Campo de visión de la cámara (38° vertical) y horizontal a 16:9. */
const FOV_V = 38 * RAD, FOV_H = 2 * Math.atan(Math.tan(FOV_V / 2) * 16 / 9);

/** Huella en planta de un mueble girado (rectángulo alineado: el generador usa 0/90/180/270). */
function huella(m) {
  const g = ((Math.round(m.rot / 90) % 4) + 4) % 4, w = g % 2 ? m.fondo : m.ancho, d = g % 2 ? m.ancho : m.fondo;
  return { x0: m.x - w / 2, x1: m.x + w / 2, z0: m.z - d / 2, z1: m.z + d / 2 };
}
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const suaveEscalon = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * Rejilla de ocupación del piso: libre = dentro del local, lejos de muebles, columnas y muros interiores.
 */
function rejilla(local, layout, H = { m: HOLGURA, col: HOLGURA_COL, muro: HOLGURA_MURO }) {
  const bb = caja(local.poligono), x0 = bb.x0, z0 = bb.z0;
  const nx = Math.ceil((bb.x1 - bb.x0) / CELDA), nz = Math.ceil((bb.z1 - bb.z0) / CELDA);
  const libre = new Uint8Array(nx * nz);
  const centro = (i) => [x0 + ((i % nx) + 0.5) * CELDA, z0 + (Math.floor(i / nx) + 0.5) * CELDA];
  for (let i = 0; i < nx * nz; i++) {
    const [x, z] = centro(i);
    libre[i] = dentro(local.poligono, [x, z]) && dentro(local.poligono, [x - 0.6, z]) && dentro(local.poligono, [x + 0.6, z]) && dentro(local.poligono, [x, z - 0.6]) && dentro(local.poligono, [x, z + 0.6]) ? 1 : 0;
  }
  const bloquear = (r, h) => {
    const i0 = Math.max(0, Math.floor((r.x0 - h - x0) / CELDA)), i1 = Math.min(nx - 1, Math.floor((r.x1 + h - x0) / CELDA));
    const j0 = Math.max(0, Math.floor((r.z0 - h - z0) / CELDA)), j1 = Math.min(nz - 1, Math.floor((r.z1 + h - z0) / CELDA));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) libre[j * nx + i] = 0;
  };
  for (const m of layout.muebles) bloquear(huella(m), m.familia.startsWith("probador") ? Math.max(H.m, 1.2) : H.m); // probadores: cajas lisas, de lejos
  for (const [x, z] of local.columnas) bloquear({ x0: x - local.columna / 2, x1: x + local.columna / 2, z0: z - local.columna / 2, z1: z + local.columna / 2 }, H.col);
  for (const mu of layout.muros || []) {
    const r = { x0: Math.min(mu.a[0], mu.b[0]), x1: Math.max(mu.a[0], mu.b[0]), z0: Math.min(mu.a[1], mu.b[1]), z1: Math.max(mu.a[1], mu.b[1]) };
    bloquear(r, H.muro + mu.espesor / 2);
  }
  for (const z of layout.zonas) if (z.id === 'trastienda') for (const r of z.rects) bloquear(r, 0.3);
  const idx = (x, z) => { const i = Math.floor((x - x0) / CELDA), j = Math.floor((z - z0) / CELDA); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  return { nx, nz, x0, z0, libre, idx, centro };
}

/** Celda libre más cercana a un punto. */
function libreCerca(R, p) {
  const k0 = R.idx(p[0], p[1]); if (k0 >= 0 && R.libre[k0]) return k0;
  let mejor = -1, dMin = Infinity;
  for (let i = 0; i < R.libre.length; i++) if (R.libre[i]) { const [x, z] = R.centro(i), d = (x - p[0]) ** 2 + (z - p[1]) ** 2; if (d < dMin) { dMin = d; mejor = i; } }
  return mejor;
}

/** A* en 8 direcciones (sin cortar esquinas) con montículo binario. Devuelve lista de índices o null. */
function aEstrella(R, a, b) {
  const { nx, libre } = R, n = libre.length;
  const g = new Float32Array(n).fill(Infinity), de = new Int32Array(n).fill(-1), cerrado = new Uint8Array(n);
  const bx = b % nx, bz = Math.floor(b / nx), h = (i) => Math.hypot((i % nx) - bx, Math.floor(i / nx) - bz);
  const heap = [], hf = [];
  const push = (v, f) => { heap.push(v); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } };
  const pop = () => { const v = heap[0], lv = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lv; hf[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m; } } return v; };
  g[a] = 0; push(a, h(a));
  const V = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const c = pop();
    if (c === b) { const out = []; for (let x = b; x >= 0; x = de[x]) out.push(x); return out.reverse(); }
    if (cerrado[c]) continue; cerrado[c] = 1;
    const cx = c % nx, cz = Math.floor(c / nx);
    for (const [dx, dz, w] of V) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nx || z * nx >= n) continue;
      const v = z * nx + x; if (!libre[v] || cerrado[v]) continue;
      if (dx && dz && (!libre[cz * nx + x] || !libre[z * nx + cx])) continue;
      const ng = g[c] + w; if (ng < g[v]) { g[v] = ng; de[v] = c; push(v, ng + h(v)); }
    }
  }
  return null;
}

/** Distancias por la rejilla (Dijkstra en 8 direcciones) desde una celda a todas: para elegir el orden de la ruta. */
function campo(R, a) {
  const { nx, libre } = R, n = libre.length, g = new Float32Array(n).fill(Infinity);
  const heap = [], hf = [];
  const push = (v, f) => { heap.push(v); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } };
  const pop = () => { const v = heap[0], lv = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lv; hf[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m; } } return v; };
  if (a < 0) return g;
  g[a] = 0; push(a, 0);
  const V = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.length) {
    const c = pop(), gc = g[c], cx = c % nx, cz = Math.floor(c / nx);
    for (const [dx, dz, w] of V) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nx || z * nx >= n) continue;
      const v = z * nx + x; if (!libre[v]) continue;
      if (dx && dz && (!libre[cz * nx + x] || !libre[z * nx + cx])) continue;
      if (gc + w < g[v]) { g[v] = gc + w; push(v, g[v]); }
    }
  }
  for (let i = 0; i < n; i++) g[i] *= CELDA * 0.93; // la cuerda y el suavizado acortan ~7 %
  return g;
}

/** ¿El segmento p→q va todo por celdas libres? */
function visible(R, p, q) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(L / (CELDA * 0.5)));
  for (let k = 0; k <= n; k++) { const t = k / n, i = R.idx(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t); if (i < 0 || !R.libre[i]) return false; }
  return true;
}

// ---------- Vista: qué ve la cámara desde un punto (para la mirada y para medir) ----------
const ALTO_CIEGO = 1.5; // muebles más altos que esto tapan la vista (refrigeradores, racks, estantes murales)
/**
 * Rejilla de vista. Clases: 0 libre · 1 mueble alto o columna (contenido) · 2 fuera del local · 3 muro interior ·
 * 4 columna. `bajo` guarda la altura de los muebles bajos (góndolas, cajas) que tapan la parte baja de lo de atrás.
 */
function rejillaVista(local, layout) {
  const bb = caja(local.poligono), x0 = bb.x0, z0 = bb.z0;
  const nx = Math.ceil((bb.x1 - bb.x0) / CELDA), nz = Math.ceil((bb.z1 - bb.z0) / CELDA);
  const clase = new Uint8Array(nx * nz), bajo = new Float32Array(nx * nz), altoM = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (!dentro(local.poligono, [x0 + (i + 0.5) * CELDA, z0 + (j + 0.5) * CELDA])) clase[j * nx + i] = 2;
  const marcar = (r, c, alto = 0) => {
    const i0 = Math.max(0, Math.floor((r.x0 - x0) / CELDA)), i1 = Math.min(nx - 1, Math.floor((r.x1 - x0) / CELDA));
    const j0 = Math.max(0, Math.floor((r.z0 - z0) / CELDA)), j1 = Math.min(nz - 1, Math.floor((r.z1 - z0) / CELDA));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; if (c) { clase[k] = c; if (c === 1) altoM[k] = Math.max(altoM[k], alto); } else bajo[k] = Math.max(bajo[k], alto); }
  };
  // probadores: cajas lisas de 2.4 m (cuentan como muro liso para la mirada)
  for (const m of layout.muebles) { if (m.familia.startsWith('probador')) marcar(huella(m), 3); else if (m.alto > ALTO_CIEGO) marcar(huella(m), 1, m.alto); else marcar(huella(m), 0, m.alto); }
  for (const mu of layout.muros || []) { const e = mu.espesor / 2; marcar({ x0: Math.min(mu.a[0], mu.b[0]) - e, x1: Math.max(mu.a[0], mu.b[0]) + e, z0: Math.min(mu.a[1], mu.b[1]) - e, z1: Math.max(mu.a[1], mu.b[1]) + e }, 3); }
  for (const [x, z] of local.columnas) marcar({ x0: x - local.columna / 2, x1: x + local.columna / 2, z0: z - local.columna / 2, z1: z + local.columna / 2 }, 4);
  const cristal = local.fachadas || [];
  const esCristal = (x, z) => cristal.some((f) => distSegmento([x, z], f.a, f.b) < 0.35);
  /**
   * Rayo en planta desde (x,z) con rumbo yaw: devuelve {d, c, bajo} = distancia y clase del primer impacto alto
   * (hasta 30 m) y el mayor ángulo de elevación de lo bajo que hay delante. Fuera del local por cristal: c = 5.
   */
  const out = { d: 30, c: 0, bajo: -Math.PI / 2, alto: 0 };
  const rayo = (x, z, yaw, max = 30) => {
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    let adentro = false, px = x, pz = z; out.d = max; out.c = 0; out.bajo = -Math.PI / 2;
    for (let d = 0.15; d < max; d += 0.15) {
      const qx = x + dx * d, qz = z + dz * d, i = Math.floor((qx - x0) / CELDA), j = Math.floor((qz - z0) / CELDA);
      const k = i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i, c = k < 0 ? 2 : clase[k];
      if (c === 0) { adentro = true; if (bajo[k] > 0) out.bajo = Math.max(out.bajo, Math.atan2(bajo[k] - OJOS, d)); px = qx; pz = qz; continue; }
      if (c === 2 && !adentro) continue;
      out.d = d; out.c = c === 2 && esCristal((px + qx) / 2, (pz + qz) / 2) ? 5 : c; out.alto = c === 1 ? altoM[k] : 0; return out;
    }
    return out;
  };
  return { rayo, nx, nz, x0, z0, clase };
  // (altoM: altura de los muebles altos por celda; el muro liso que asoma encima también cuenta)
}

const CONO = [-25, -18, -12, -6, 0, 6, 12, 18, 25].map((g) => g * RAD);
/** Fracción del cono de visión (±25°) que choca con algo alto a menos de `cerca` m. */
function tapado(V, x, z, yaw, cerca = 4.5) { let n = 0; for (const c of CONO) if (V.rayo(x, z, yaw + c).d < cerca) n++; return n / CONO.length; }

/**
 * Medidas de un cuadro (aproximadas en planta, 15 rayos en el ancho del cuadro):
 *  muro    fracción del cuadro ocupada por muro liso (exterior opaco o tabique) visible por encima de lo bajo;
 *  columna ancho de la columna más ancha en el cuadro, como fracción del ancho.
 */
export function medirCuadro(V, x, z, yaw, pitch = 0) {
  let muro = 0, columna = 0; const N = 15;
  const lo = pitch - FOV_V / 2, hi = pitch + FOV_V / 2;
  for (let r = 0; r < N; r++) {
    const a = yaw + (r / (N - 1) - 0.5) * FOV_H, h = V.rayo(x, z, a);
    if (h.c === 1 && h.alto < 4.6) {
      // (R12) sobre un mueble alto pegado a un muro (refrigeradores, racks) asoma el muro liso hasta 4.8 m
      const d1 = h.d, top = h.alto, x2 = x + Math.sin(a) * (d1 + 0.05), z2 = z + Math.cos(a) * (d1 + 0.05);
      let dd = 0.15; while (dd < 2.5) { const qx = x2 + Math.sin(a) * dd, qz = z2 + Math.cos(a) * dd, i = Math.floor((qx - V.x0) / CELDA), j = Math.floor((qz - V.z0) / CELDA), cl = i < 0 || j < 0 || i >= V.nx || j >= V.nz ? 2 : V.clase[j * V.nx + i]; if (cl === 2 || cl === 3) break; dd += 0.15; }
      if (dd < 2.5) { const abajo = Math.atan2(top - OJOS, d1), arriba = Math.atan2(4.8 - OJOS, d1 + dd); muro += Math.max(0, Math.min(hi, arriba) - Math.max(lo, abajo)) / FOV_V; }
    }
    if (h.c === 2 || h.c === 3) {
      const abajo = Math.max(Math.atan2(-OJOS, h.d), h.bajo), arriba = Math.atan2(4.8 - OJOS, h.d);
      muro += Math.max(0, Math.min(hi, arriba) - Math.max(lo, abajo)) / FOV_V;
    }
  }
  // columnas en el cuadro (ancho angular directo)
  return { muro: muro / N, columna };
}
function anchoColumnas(local, x, z, yaw) {
  let peor = 0;
  for (const [cx, cz] of local.columnas) {
    const d = Math.hypot(cx - x, cz - z); if (d < 0.05) continue;
    const a = angulo(Math.atan2(cx - x, cz - z) - yaw), w = 2 * Math.atan(local.columna / 2 / d);
    if (Math.abs(a) - w / 2 < FOV_H / 2) peor = Math.max(peor, w / FOV_H);
  }
  return peor;
}

// ---------- Ruta ----------
/**
 * Ruta del recorrido: acceso → frente de cajas → un pasillo de góndolas → frente del muro de refrigerados → ropa y
 * hogar, con un tramo inicial desde la calle. Si hay una fachada de cristal cerca de ropa, la ruta termina a 3-5 m
 * de ella caminando hacia ella (la salida sigue derecho, atraviesa el cristal y sube por fuera).
 * @param {{largoObj?:number, largoMax?:number, velocidad?:number, ductos?:number[][]}} op
 *   ductos: segmentos [x0,z0,x1,z1] de ductos de aire (la mirada hacia arriba sigue uno).
 * @returns {{xs:Float32Array, zs:Float32Array, yaw:Float32Array, pitch:Float32Array, n:number, largo:number,
 *   paso:number, marcas:Object, salida:{dir:number[], fin:number[]}|null}|null}
 */
export function rutaRecorrido(local, layout, op = {}) {
  const g = rutaPasos(local, layout, op); let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
/**
 * La misma ruta como generador: cada `next()` hace un trozo de trabajo de pocos milisegundos (para repartir el cálculo
 * en varios cuadros mientras corre otra animación). El valor final (`done`) es la ruta.
 */
export function* rutaPasos(local, layout, op = {}) {
  let mejor = null;
  for (const H of [{ m: HOLGURA, col: HOLGURA_COL, muro: HOLGURA_MURO }, { m: 0.5, col: 1.0, muro: 0.6 }, { m: 0.45, col: 0.7, muro: 0.5 }]) {
    const r = yield* rutaCon(local, layout, H, op);
    if (r && (!mejor || (r.completa && !mejor.completa) || (r.completa === mejor.completa && r.puntos > mejor.puntos))) mejor = r;
    if (mejor && mejor.completa) break;
  }
  if (!mejor) return null;
  const R = muestrear(mejor.P, op.largoMax ?? 42);
  R.salida = mejor.salida;
  R.metas = mejor.metas; R.plan = mejor.plan;
  yield;
  yield* mirar(local, layout, R, op);
  return R;
}

function centroZona(layout, id) {
  const z = layout.zonas.find((q) => q.id === id); if (!z || !z.rects.length) return null;
  const r = z.rects.reduce((a, b) => ((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? b : a));
  return [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
}
const enZona = (layout, id, x, z) => layout.zonas.some((q) => q.id === id && q.rects.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function* rutaCon(local, layout, H, { largoObj = 38 } = {}) {
  const R = rejilla(local, layout, H);
  yield;
  const acc = local.acceso, nrm = acc.normal;
  const entrada = [acc.centro[0] - nrm[0] * 1.2, acc.centro[1] - nrm[1] * 1.2];
  const afuera = [acc.centro[0] + nrm[0] * 1.0, acc.centro[1] + nrm[1] * 1.0];
  // frente de cajas: el punto de un pasillo principal más cercano al centro de cajas
  const cc = centroZona(layout, 'cajas');
  let cajas = cc;
  if (cc) {
    let dMin = Infinity;
    for (const q of layout.pasillos.filter((p) => p.tipo === 'principal')) {
      const [a, b] = q.puntos, L = dist(a, b) || 1, t = Math.max(0, Math.min(1, ((cc[0] - a[0]) * (b[0] - a[0]) + (cc[1] - a[1]) * (b[1] - a[1])) / (L * L)));
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d = dist(p, cc);
      if (d < dMin && d < 6) { dMin = d; cajas = p; }
    }
  }
  // muro de refrigerados: frentes de los refrigeradores verticales (o equipos fríos altos), a 1.7 m de su cara
  let frios = layout.muebles.filter((m) => m.familia === 'refrigerador_vertical');
  if (frios.length < 2) frios = layout.muebles.filter((m) => m.frio && m.alto > 1.5);
  let frioPar = null;
  if (frios.length) {
    const f0 = frente(frios[0].rot), u = [f0[1], -f0[0]]; // dirección de la hilera
    const fr = frios.filter((m) => Math.abs(frente(m.rot)[0] - f0[0]) < 0.1 && Math.abs(frente(m.rot)[1] - f0[1]) < 0.1);
    // distancia de la línea de marcha a las caras: la menor (1.6 a 4 m) con la línea libre (más allá de las islas)
    let dLin = 1.75;
    for (const d of [1.75, 2.2, 2.6, 3.0, 3.3, 3.6, 4.0]) {
      const libres = fr.filter((m) => { const k = R.idx(m.x + f0[0] * (m.fondo / 2 + d), m.z + f0[1] * (m.fondo / 2 + d)); return k >= 0 && R.libre[k]; }).length;
      const ok = libres * 2 >= fr.length;
      if (ok) { dLin = d; break; }
    }
    const pts = fr.map((m) => [m.x + f0[0] * (m.fondo / 2 + dLin), m.z + f0[1] * (m.fondo / 2 + dLin), m]);
    pts.sort((a, b) => (a[0] * u[0] + a[1] * u[1]) - (b[0] * u[0] + b[1] * u[1]));
    const A = pts[0], B = pts[pts.length - 1], ex = (A[2].ancho / 2 - 0.4);
    const a0 = [A[0] - u[0] * ex, A[1] - u[1] * ex], b0 = [B[0] + u[0] * (B[2].ancho / 2 - 0.4), B[1] + u[1] * (B[2].ancho / 2 - 0.4)];
    // el tramo libre más largo sobre esa línea (las puntas pueden caer junto a probadores o islas)
    const Lf = dist(a0, b0), nF = Math.max(1, Math.ceil(Lf / 0.25));
    let mejorRun = null, ini = -1;
    for (let k = 0; k <= nF + 1; k++) {
      const t = k / nF, q = [a0[0] + (b0[0] - a0[0]) * t, a0[1] + (b0[1] - a0[1]) * t], kk = k <= nF ? R.idx(q[0], q[1]) : -1;
      const ok = k <= nF && kk >= 0 && R.libre[kk];
      if (ok && ini < 0) ini = k;
      if (!ok && ini >= 0) { if (!mejorRun || k - 1 - ini > mejorRun[1] - mejorRun[0]) mejorRun = [ini, k - 1]; ini = -1; }
    }
    if (mejorRun && (mejorRun[1] - mejorRun[0]) * Lf / nF > 3) {
      const P0 = (k) => [a0[0] + (b0[0] - a0[0]) * k / nF, a0[1] + (b0[1] - a0[1]) * k / nF];
      frioPar = [P0(mejorRun[0]), P0(mejorRun[1])];
    }
  }
  // ropa: final a 3-5 m de una fachada de cristal, caminando hacia ella, con la línea de salida libre
  const salida = finalRopa(local, layout, R, frioPar);
  const ropa = salida ? salida.fin : centroZona(layout, 'ropa_hogar');
  // orden y tramos: se prueban pasillos de góndolas (en ambos sentidos), con y sin parada en cajas, y el muro de
  // refrigerados completo o solo sus últimos 6.5 m; gana el más cercano al largo objetivo (distancias por la rejilla)
  const ps = layout.pasillos.filter((q) => q.tipo === 'entre_gondolas' && dist(q.puntos[0], q.puntos[1]) > 3);
  const cel = (p) => libreCerca(R, p), campos = new Map();
  const d = (p, q) => { const a = cel(p), b = cel(q); if (a < 0 || b < 0) return Infinity; if (!campos.has(a)) campos.set(a, campo(R, a)); return campos.get(a)[b]; };
  const opciones = [];
  const fN0 = frios.length ? frente(frios[0].rot) : null;
  const tramosFrio = (desde) => {
    if (!frioPar) return [[]];
    const out = [];
    for (const [a, b] of [frioPar, [frioPar[1], frioPar[0]]]) {
      const L = dist(a, b); out.push([a, b]);
      // tramos finales más cortos (recorrido pausado: la ruta es de ≈ 25 m)
      for (const Lc of [6.5, 4.5, 3]) if (L > Lc + 1) { const t = 1 - Lc / L; out.push([[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], b]); }
      out.push([b]); // solo pasar frente a ellos (se ven de frente al llegar y en escorzo al seguir)
      if (fN0) { const q = [b[0] + fN0[0] * 2.3, b[1] + fN0[1] * 2.3], k = R.idx(q[0], q[1]); if (k >= 0 && R.libre[k]) out.push([q]); }
    }
    // sin pasar por ellos: la caminata termina mirándolos (el final de ropa queda a ≤ 8.5 m de sus puertas)
    if (ropa && frios.some((m) => { const f = frente(m.rot); return dist(ropa, [m.x + f[0] * m.fondo / 2, m.z + f[1] * m.fondo / 2]) <= 9; })) out.push([]);
    return out;
  };
  const destino = [ropa].filter(Boolean);
  // campos de distancia desde cada origen posible (uno por trozo de trabajo)
  for (const p of [entrada, cajas, ...ps.flatMap((q) => q.puntos), ...tramosFrio(entrada).flat()].filter(Boolean)) {
    const a = cel(p); if (a >= 0 && !campos.has(a)) { campos.set(a, campo(R, a)); yield; }
  }
  // pasillos de góndolas: completos o solo su boca (los primeros 3.5 a 5 m desde una punta)
  const tramosPas = [];
  for (const q of ps) {
    const [a, b] = q.puntos, L = dist(a, b);
    for (const [p0, p1] of [[a, b], [b, a]]) {
      tramosPas.push({ q, t: [p0, p1], largo: L });
      for (const Lb of [5, 3.5]) if (L > Lb + 2) { const t = Lb / L; tramosPas.push({ q, t: [p0, [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]], largo: Lb }); }
      // pasar por la boca del pasillo (cabeceras a un lado, la mirada entra al pasillo)
      const ub = [(p0[0] - p1[0]) / L, (p0[1] - p1[1]) / L], boca = [p0[0] + ub[0] * 1.3, p0[1] + ub[1] * 1.3], kb = R.idx(boca[0], boca[1]);
      if (kb >= 0 && R.libre[kb]) tramosPas.push({ q, t: [boca], largo: 2, boca: true });
    }
  }
  for (const tp of [...tramosPas, null]) for (const conCajas of [true, false]) {
    const q = tp?.q ?? null;
    const tramo = tp ? tp.t : [];
    const pre = [entrada, ...(conCajas && cajas ? [cajas] : []), ...tramo];
    for (const tf of tramosFrio(pre[pre.length - 1])) {
      // metas inalcanzables (con estas holguras) se saltan
      const lista = [entrada];
      let L = dist(afuera, entrada);
      for (const m of [...pre.slice(1), ...tf, ...destino]) { const dd = d(lista[lista.length - 1], m); if (dd < Infinity) { L += dd; lista.push(m); } }
      if (lista.length < 2) continue;
      const largoPas = tp ? tp.largo : 0;
      // vueltas en U entre tramos: obligan a mirar muros de cerca
      let giros = 0;
      for (let k = 1; k + 1 < lista.length; k++) {
        const u = [lista[k][0] - lista[k - 1][0], lista[k][1] - lista[k - 1][1]], v = [lista[k + 1][0] - lista[k][0], lista[k + 1][1] - lista[k][1]];
        const nu = Math.hypot(...u), nv = Math.hypot(...v); if (nu < 0.5 || nv < 0.5) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (nu * nv))));
        giros += Math.max(0, ang - Math.PI / 3) / (Math.PI / 3) * 3;
      }
      const faltan = (pre.length - 1 + tf.length + destino.length) - (lista.length - 1);
      const puntaje = faltan * 12 + giros + Math.abs(L - largoObj) + Math.max(0, L - largoObj - 1.5) * 3 + (conCajas ? 0 : 3) - Math.min(8, largoPas) * 0.25 + (tp ? (tp.boca ? 1 : 0) : 4) + (tf.length < 2 ? 2 : 0);
      opciones.push({ lista: lista.slice(1), puntaje, L, faltan, frioFinal: !!frioPar && tf.length === 0 });
    }
  }
  if (!opciones.length) return null;
  opciones.sort((a, b) => a.puntaje - b.puntaje);
  const metas = opciones[0].lista;
  const planElegido = { L: opciones[0].L, metas, frioFinal: opciones[0].frioFinal };
  let actual = libreCerca(R, entrada); if (actual < 0) return null;
  const celdas = [actual]; let alcanzadas = 0;
  const cortes = [0]; // índice de celda donde empieza cada meta alcanzada
  for (const m of metas) {
    const dest = libreCerca(R, m); if (dest < 0 || dest === actual) continue;
    const c = aEstrella(R, actual, dest); if (!c) continue;
    celdas.push(...c.slice(1)); actual = dest; alcanzadas++; cortes.push(celdas.length - 1);
    yield;
  }
  // cuerda: se conservan los vértices necesarios y SIEMPRE las metas (el paso por cada zona no se recorta)
  const pts = celdas.map((i) => R.centro(i));
  const cuerda = [pts[0]];
  for (let t = 0; t + 1 < cortes.length; t++) {
    let ancla = pts[cortes[t]];
    for (let k = cortes[t] + 1; k <= cortes[t + 1]; k++) if (!visible(R, ancla, pts[k])) { ancla = pts[k - 1]; cuerda.push(ancla); }
    cuerda.push(pts[cortes[t + 1]]);
  }
  let P = [afuera, entrada, ...cuerda];
  if (salida && dist(P[P.length - 1], salida.fin) < 0.6) P[P.length - 1] = salida.fin; // termina justo en el punto elegido
  else if (salida) salida.fin = P[P.length - 1];
  for (let it = 0; it < 3; it++) {
    const Q = [P[0]];
    for (let k = 0; k + 1 < P.length; k++) { const a = P[k], b = P[k + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    Q.push(P[P.length - 1]); P = Q;
  }
  // (R12) esquinas más abiertas: media móvil de hasta ±1.5 m sobre la ruta densificada, solo donde el punto sigue en
  // celda libre (si no, ventana menor). En una esquina cerrada la cámara avanzaba menos en línea recta (tropiezo).
  {
    const D = [P[0]];
    for (let k = 0; k + 1 < P.length; k++) { const a = P[k], b = P[k + 1], L = dist(a, b), m = Math.max(1, Math.ceil(L / 0.1)); for (let j = 1; j <= m; j++) D.push([a[0] + ((b[0] - a[0]) * j) / m, a[1] + ((b[1] - a[1]) * j) / m]); }
    const S = D.map((p) => p.slice());
    for (let i = 1; i + 1 < D.length; i++) {
      for (let W = Math.min(15, i, D.length - 1 - i); W >= 2; W -= 2) {
        let x = 0, z = 0; for (let j = i - W; j <= i + W; j++) { x += D[j][0]; z += D[j][1]; } x /= 2 * W + 1; z /= 2 * W + 1;
        const kk = R.idx(x, z); if (kk >= 0 && R.libre[kk]) { S[i] = [x, z]; break; }
      }
    }
    P = S;
  }
  return { P, puntos: alcanzadas, completa: alcanzadas === metas.length && opciones[0].faltan === 0 && opciones[0].L >= largoObj * 0.6, salida, metas: { cajas, frio: frioPar, ropa }, plan: planElegido };
}

/**
 * Final del recorrido en ropa junto a una fachada de cristal: punto libre a 3-5 m del cristal con la línea hasta la
 * fachada despejada (muebles a ≥ 0.9 m, columnas a ≥ 1.6 m) y el punto 3 m antes también libre.
 * @returns {{fin:number[], antes:number[], dir:number[]}|null} dir = dirección de salida (hacia afuera)
 */
function finalRopa(local, layout, R, frioPar) {
  const cRopa = centroZona(layout, 'ropa_hogar');
  if (!layout.zonas.some((z) => z.id === 'ropa_hogar')) return null;
  const tapa = layout.muebles.map(huella), cols = local.columnas;
  const dRect = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  let mejor = null;
  for (const f of local.fachadas || []) {
    const L = dist(f.a, f.b), u = [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L];
    // normal hacia el interior: la que apunta al centroide del polígono
    const bb = caja(local.poligono), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
    let n = [u[1], -u[0]]; if ((cx - f.a[0]) * n[0] + (cz - f.a[1]) * n[1] < 0) n = [-n[0], -n[1]];
    for (let s = 1.5; s < L - 1.5; s += 0.25) {
      const b0 = [f.a[0] + u[0] * s, f.a[1] + u[1] * s];
      for (const d of [3.5, 4, 3, 4.5]) {
        const fin = [b0[0] + n[0] * d, b0[1] + n[1] * d], antes = [b0[0] + n[0] * (d + 2), b0[1] + n[1] * (d + 2)];
        if (!enZona(layout, 'ropa_hogar', fin[0], fin[1])) continue;
        const kf = R.idx(fin[0], fin[1]), ka = R.idx(antes[0], antes[1]);
        if (kf < 0 || ka < 0 || !R.libre[kf] || !R.libre[ka] || !visible(R, antes, fin)) continue;
        // línea de salida: de "antes" al cristal y 1 m más afuera
        let hol = Infinity, holCol = Infinity;
        for (let t = 0; t <= d + 1; t += 0.25) {
          const x = fin[0] - n[0] * t, z = fin[1] - n[1] * t;
          for (const r of tapa) hol = Math.min(hol, dRect(r, x, z));
          for (const [qx, qz] of cols) holCol = Math.min(holCol, Math.hypot(qx - x, qz - z) - local.columna / 2);
        }
        if (hol < 1.25 || holCol < 1.6) continue;
        // cerca del centro de ropa y del final de refrigerados (ruta más corta), con holgura
        const ref = frioPar ? Math.min(dist(fin, frioPar[0]), dist(fin, frioPar[1])) : 0;
        const puntaje = Math.min(hol, 1.6) * 2 + Math.min(holCol, 3) - Math.abs(d - 3.5) * 0.5 - 0.25 * dist(fin, cRopa) - 0.15 * ref;
        if (!mejor || puntaje > mejor.puntaje) mejor = { fin, antes, dir: [-n[0], -n[1]], puntaje };
      }
    }
  }
  return mejor;
}

/** Muestreo cada PASO m hasta largoMax (se conserva el final: si sobra, se recorta del tramo de calle). */
function muestrear(P, largoMax) {
  const xs = [], zs = [];
  xs.push(P[0][0]); zs.push(P[0][1]);
  let resto = 0;
  for (let k = 0; k + 1 < P.length; k++) {
    const a = P[k], b = P[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = PASO - resto;
    for (; s <= L + 1e-9; s += PASO) { xs.push(a[0] + ((b[0] - a[0]) * s) / L); zs.push(a[1] + ((b[1] - a[1]) * s) / L); }
    resto = L - (s - PASO);
  }
  let i0 = 0; const nMax = Math.round(largoMax / PASO) + 1;
  if (xs.length > nMax) i0 = Math.min(xs.length - nMax, 30); // a lo más 3 m menos de calle (el descenso entra por la puerta); luego se corta el final
  const n = Math.min(xs.length - i0, nMax);
  return { xs: Float32Array.from(xs.slice(i0, i0 + n)), zs: Float32Array.from(zs.slice(i0, i0 + n)), n, largo: (n - 1) * PASO, paso: PASO };
}

// ---------- Mirada ----------
/**
 * Rumbo (yaw) y cabeceo (pitch) por muestra:
 *  · base: tangente adelantada 2.5 m; si al frente hay un muro ciego cerca, gira hacia donde se ve más lejos.
 *  · góndolas: paseo de comprador, ±24° hacia los entrepaños de un lado y luego del otro, cabeceo −7°.
 *  · refrigerados: voltea hacia el muro de puertas (escorzo de hasta 55°) mientras se camina frente a él.
 *  · arriba: 0.9 s de subida, 2.5 s sostenidos a 42° siguiendo un ducto, 0.9 s de bajada.
 *  · final: voltea (≤ 120°) hacia el lado con más contenido; la salida sigue derecho.
 *  · giro ≤ 70°/s y cabeceo ≤ 45°/s a la velocidad dada.
 */
function* mirar(local, layout, R, { velocidad = 3, ductos = [], techo = [] } = {}) {
  const V = rejillaVista(local, layout), n = R.n, base = new Float32Array(n), pitch = new Float32Array(n);
  yield;
  const AD = 50;
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, i + AD), k = Math.max(0, j - AD);
    base[i] = j > i ? Math.atan2(R.xs[j] - R.xs[i], R.zs[j] - R.zs[i]) : Math.atan2(R.xs[i] - R.xs[k], R.zs[i] - R.zs[k]);
  }
  for (let i = 1; i < n; i++) base[i] = base[i - 1] + angulo(base[i] - base[i - 1]);
  const suavizar = (arr, W) => { const y = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) { s += arr[k]; c++; } y[i] = s / c; } return y; };
  let yaw = suavizar(base, 18);
  // vueltas en U: la mirada puede girar por cualquiera de los dos lados; se elige el que ve menos muro y columnas
  {
    const costoV = (i, a) => { const m = medirCuadro(V, R.xs[i], R.zs[i], a, 0); return m.muro + Math.max(0, anchoColumnas(local, R.xs[i], R.zs[i], a) - 0.1) * 4; };
    for (let i = 10; i + 90 < n; i += 5) {
      if (i % 40 === 10) yield;
      const j = i + 90, d = yaw[j] - yaw[i];
      if (Math.abs(d) < 2.0) continue;
      const alt = d - Math.sign(d) * 2 * Math.PI;
      let cA = 0, cB = 0;
      for (let k = i; k <= j; k += 6) { const t = suaveEscalon((k - i) / (j - i)); cA += costoV(k, yaw[i] + d * t); cB += costoV(k, yaw[i] + alt * t); }
      if (cB < cA * 0.75 && Math.abs(alt) < Math.abs(d) + 30 * RAD) { // por el otro lado solo si casi es lo mismo (caminata pausada)
        for (let k = i; k <= j; k++) { const t = suaveEscalon((k - i) / (j - i)); yaw[k] = yaw[i] + alt * t; }
        for (let k = j + 1; k < n; k++) yaw[k] += alt - d;
      }
      // también se suaviza el giro por el lado original en toda la ventana (sin ella el giro se concentra)
      i = j;
    }
  }
  const off = new Float32Array(n), pesoOff = new Float32Array(n);
  // miradas impuestas (rumbo absoluto y peso) que se aplican DESPUÉS de las correcciones por muro y columna: refrigerados
  // a la vista y volteo final (si no, una corrección por una columna cercana puede llevar la mirada a un tabique)
  const forz = new Float32Array(n), wForz = new Float32Array(n);
  const mPorS = velocidad, muestrasPorS = mPorS / PASO;
  // muro ciego al frente: girar hacia lo abierto (como antes, más suave)
  for (let i = 20; i < n; i++) {
    if (i % 60 === 0) yield;
    if (tapado(V, R.xs[i], R.zs[i], yaw[i]) <= 0.4) continue;
    let mejor = 0, pts = -Infinity;
    for (const g of [0, -20, 20, -40, 40, -60, 60]) { const a = yaw[i] + g * RAD; let s = 0; for (const c of CONO) s += Math.min(9, V.rayo(R.xs[i], R.zs[i], a + c).d); s = s / CONO.length - 0.03 * Math.abs(g); if (s > pts) { pts = s; mejor = g * RAD; } }
    off[i] = mejor; pesoOff[i] = 1;
  }
  // tramos por zona
  const zonaDe = (i) => {
    const x = R.xs[i], z = R.zs[i];
    if (R.metas?.frio) { const [a, b] = R.metas.frio; if (distSegmento([x, z], a, b) < 2.2) return 'frio'; }
    for (const q of layout.pasillos) if (q.tipo === 'entre_gondolas' && distSegmento([x, z], q.puntos[0], q.puntos[1]) < 0.7) return 'gondolas';
    return '';
  };
  const zona = Array.from({ length: n }, (_, i) => zonaDe(i));
  const tramos = (id) => { const out = []; let s = -1; for (let i = 0; i <= n; i++) { const en = i < n && zona[i] === id; if (en && s < 0) s = i; if (!en && s >= 0) { if (i - s > 15) out.push([s, i]); s = -1; } } return out; };
  const rampa = (i, s, e, w) => Math.min(suaveEscalon((i - s) / w), suaveEscalon((e - i) / w));
  const marcas = { gondolas: [], frio: [], arriba: null, volteo: null };
  // góndolas: paseo por los entrepaños
  for (const [s, e] of tramos('gondolas')) {
    marcas.gondolas.push([s * PASO, e * PASO]);
    const lam = 7.5 / PASO;
    for (let i = s; i < e; i++) { const w = rampa(i, s, e, 6); off[i] = 18 * RAD * Math.cos((2 * Math.PI * (i - s)) / lam); pesoOff[i] = w; pitch[i] = -2 * RAD * w; }
  }
  // bocas de pasillo: al pasar junto a las cabeceras la mirada entra un momento al pasillo (vistazo de comprador)
  for (const q of layout.pasillos) {
    if (q.tipo !== 'entre_gondolas') continue;
    const [a, b] = q.puntos, L = dist(a, b); if (L < 3) continue;
    for (const [p0, p1] of [[a, b], [b, a]]) {
      const u = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L], foco = [p0[0] + u[0] * 4, p0[1] + u[1] * 4];
      let iMin = -1, dMin = 4.2;
      for (let i = 0; i < n; i++) { if (zona[i] === 'gondolas') continue; const dd = Math.hypot(R.xs[i] - p0[0], R.zs[i] - p0[1]); if (dd < dMin) { dMin = dd; iMin = i; } }
      if (iMin < 0) continue;
      const W = Math.round(1.6 * muestrasPorS / 2);
      for (let i = Math.max(0, iMin - W); i < Math.min(n, iMin + W); i++) {
        const a2 = angulo(Math.atan2(foco[0] - R.xs[i], foco[1] - R.zs[i]) - yaw[i]);
        if (Math.abs(a2) > 75 * RAD) continue;
        const w = 0.75 * Math.sin(Math.PI * (i - iMin + W) / (2 * W));
        if (w > pesoOff[i]) { off[i] = a2; pesoOff[i] = w; }
      }
      marcas.gondolas.push([Math.max(0, iMin - W) * PASO, Math.min(n - 1, iMin + W) * PASO]);
    }
  }
  // refrigerados: hacia el muro de puertas
  if (R.metas?.frio) {
    const [a, b] = R.metas.frio, u = [b[0] - a[0], b[1] - a[1]], Lu = Math.hypot(u[0], u[1]) || 1;
    // la cara de los refrigeradores queda a 1.75 m del eje del recorrido, del lado opuesto al pasillo
    const fr = layout.muebles.find((m) => m.familia === 'refrigerador_vertical') || layout.muebles.find((m) => m.frio && m.alto > 1.5);
    const fN = fr ? frente(fr.rot) : [0, 0];
    for (const [s, e] of tramos('frio')) {
      marcas.frio.push([s * PASO, e * PASO]);
      for (let i = s; i < e; i++) {
        const w = rampa(i, s, e, 15);
        // punto del muro de puertas 3 m adelante en el sentido de la marcha
        const sg = Math.sign((R.xs[Math.min(n - 1, i + 5)] - R.xs[i]) * u[0] + (R.zs[Math.min(n - 1, i + 5)] - R.zs[i]) * u[1]) || 1;
        const px = R.xs[i] - fN[0] * 3.0 + (u[0] / Lu) * sg * 2.6, pz = R.zs[i] - fN[1] * 3.0 + (u[1] / Lu) * sg * 2.6;
        const a2 = angulo(Math.atan2(px - R.xs[i], pz - R.zs[i]) - yaw[i]);
        off[i] = Math.max(-60 * RAD, Math.min(60 * RAD, a2)); pesoOff[i] = Math.max(pesoOff[i] * (1 - w), w); pitch[i] = -6 * RAD * w;
      }
    }
  }
  // refrigerados a la vista (≤ 9 m, hasta 65° del rumbo) fuera de su tramo: la mirada va a las puertas
  {
    const fr = layout.muebles.filter((m) => m.familia === 'refrigerador_vertical');
    const puertas = fr.flatMap((m) => { const f = frente(m.rot), u = [f[1], -f[0]]; return [-0.3, 0.3].map((q) => [m.x + u[0] * m.ancho * q + f[0] * m.fondo / 2, m.z + u[1] * m.ancho * q + f[1] * m.fondo / 2, f]); });
    let ini = -1;
    const W = new Float32Array(n), A = new Float32Array(n);
    for (let i = 20; i < n; i++) {
      if (zona[i] === 'frio') continue;
      let sx = 0, sz = 0, c = 0;
      for (const [px, pz, f] of puertas) {
        const dx = px - R.xs[i], dz = pz - R.zs[i], d = Math.hypot(dx, dz);
        if (d > 11.5 || d < 2 || dx * f[0] + dz * f[1] > 0) continue; // de frente a la cara (se ven desde lejos)
        if (Math.abs(angulo(Math.atan2(dx, dz) - yaw[i])) > 95 * RAD) continue;
        if (V.rayo(R.xs[i], R.zs[i], Math.atan2(dx, dz), d + 0.5).d < d - 0.6) continue; // algo alto lo tapa
        sx += dx / d; sz += dz / d; c++;
      }
      if (c >= 1) {
        // sin una columna cercana tapando media puerta: se corre la mirada hasta 20° si hace falta
        let a0 = angulo(Math.atan2(sx, sz) - yaw[i]), mejorA = a0, mejorC = Infinity;
        for (const g of [0, -8, 8, -15, 15, -22, 22, 30]) { const ya = yaw[i] + a0 + g * RAD; const cc = Math.max(0, anchoColumnas(local, R.xs[i], R.zs[i], ya) - 0.13) * 4 + Math.max(0, medirCuadro(V, R.xs[i], R.zs[i], ya, -9 * RAD).muro - 0.2) * 4 + Math.abs(g) * 0.0015; if (cc < mejorC - 1e-6) { mejorC = cc; mejorA = a0 + g * RAD; } }
        A[i] = mejorA; W[i] = 1;
      }
    }
    // tramos continuos de ≥ 1 s, con entrada y salida suaves
    for (let i = 0; i <= n; i++) {
      const en = i < n && W[i] > 0;
      if (en && ini < 0) ini = i;
      if (!en && ini >= 0) {
        if (i - ini > muestrasPorS) {
          marcas.frio.push([ini * PASO, i * PASO]);
          for (let k = ini; k < i; k++) { const w = 0.9 * rampa(k, ini, i, Math.round(0.6 * muestrasPorS)); if (w > wForz[k]) { forz[k] = yaw[k] + A[k]; wForz[k] = w; pitch[k] = Math.min(pitch[k], -9 * RAD * w); } }
        }
        ini = -1;
      }
    }
  }
  // ropa: la mirada se va hacia mesas, percheros y maniquíes (no hacia probadores ni fachada)
  {
    const ropa = layout.muebles.filter((m) => m.zona === 'ropa_hogar' && !m.familia.startsWith('probador'));
    if (ropa.length) {
      for (let i = 20; i < n; i++) {
        if (!enZona(layout, 'ropa_hogar', R.xs[i], R.zs[i]) && !(i + 15 < n && enZona(layout, 'ropa_hogar', R.xs[i + 15], R.zs[i + 15]))) continue;
        if (marcas.frio.some(([a, b]) => i * PASO >= a && i * PASO <= b)) continue; // los refrigerados mandan mientras se ven
        let sx = 0, sz = 0, sw = 0;
        for (const m of ropa) { const dx = m.x - R.xs[i], dz = m.z - R.zs[i], d = Math.hypot(dx, dz); if (d < 1.2 || d > 9) continue; const w = 1 / d; sx += dx * w; sz += dz * w; sw += w; }
        if (!sw) continue;
        const a = angulo(Math.atan2(sx, sz) - yaw[i]);
        if (Math.abs(a) > 100 * RAD) continue;
        // si en esa dirección lo primero que hay cerca es un probador (caja lisa), se mira al frente
        if (V.rayo(R.xs[i], R.zs[i], yaw[i] + a, 4).c === 3) continue;
        off[i] = Math.max(-70 * RAD, Math.min(70 * RAD, a)); pesoOff[i] = Math.max(pesoOff[i], 0.85);
      }
    }
  }
  // final: volteo hacia el lado con más contenido (la salida sigue derecho hacia el cristal)
  const nVol = Math.round(3.8 * muestrasPorS); // volteo pausado (giro ≤ 40 °/s)
  if (R.salida && n > nVol + 40) {
    const i = n - 1, x = R.xs[i], z = R.zs[i], ySal = Math.atan2(R.salida.dir[0], R.salida.dir[1]);
    // el volteo arranca al terminar de mirar los refrigerados (si quedan cerca del final) y gira por el arco corto
    // desde esa mirada: sin barrer de vuelta todo lo que gira el camino (caminata pausada, giro ≤ 40 °/s)
    let ini = n - nVol;
    const fUlt = marcas.frio[marcas.frio.length - 1];
    if (fUlt) { const a0 = Math.round(fUlt[0] / PASO), a1 = Math.round(fUlt[1] / PASO), c = Math.min(a1 - Math.round(0.6 * muestrasPorS), a0 + Math.round(2.4 * muestrasPorS)); if (c > 20 && c < ini && n - c < nVol * 2.4) ini = c; }
    const yIni = wForz[ini] > 0 ? yaw[ini] + angulo(forz[ini] - yaw[ini]) : yaw[ini] + off[ini] * pesoOff[ini];
    let mejor = null;
    for (const g of [90, 120, 150, -150]) { // nunca hacia la fachada ni hacia los probadores del fondo
      const a = ySal + g * RAD; let s = 0;
      for (let r = -3; r <= 3; r++) { const h = V.rayo(x, z, a + r * 8 * RAD, 12); s += h.c === 1 ? 3 : h.c === 4 ? 0 : h.c === 5 ? 0.5 : h.c === 0 ? 1.5 : 0; s += h.bajo > -0.6 ? 0.8 : 0; }
      s += Math.abs(g) >= 150 ? 2 : 0; // mirar de regreso a la tienda: la salida es un retroceso
      s -= Math.abs(g) / 120;
      const arco = angulo(a - yIni); s -= (Math.abs(arco) / RAD / 90) * 2.5; // menos giro, mejor
      // tabiques lisos (probadores, muros) en el cuadro durante la segunda mitad del volteo: muy castigados
      for (const q of [0.5, 0.75, 1]) { const k = Math.round(ini + (n - 1 - ini) * q); s -= medirCuadro(V, R.xs[k], R.zs[k], yIni + arco * suaveEscalon(q), -8 * RAD).muro * 10; }
      if (!mejor || s > mejor.s) mejor = { s, a, arco };
    }
    marcas.volteo = [ini * PASO, (n - 1) * PASO];
    for (let k = ini; k < n; k++) {
      const w = 1 - Math.pow(1 - suaveEscalon((k - ini) / (n - 1 - ini)), 1.8); // adelantado: pasa pronto por el muro del rincón
      forz[k] = yIni + mejor.arco * w; wForz[k] = 1; pitch[k] = pitch[k] * (1 - w) + (-8 * RAD) * w;
    }
    R.yawFinal = mejor.a;
  }
  // mirada hacia arriba: ventana con un ducto paralelo cerca, en tramo recto, fuera de refrigerados y del volteo
  const nSub = Math.round(0.9 * muestrasPorS), nSos = Math.round(2.5 * muestrasPorS), nVen = nSos + 2 * nSub;
  /** Peso de los elementos de techo [x, z, alto, peso] que caben en el cuadro desde la muestra i con rumbo y cabeceo dados. */
  const verTecho = (i, y, p) => {
    let t = 0; const sy = Math.sin(y), cy = Math.cos(y);
    for (const [x, z, h, w] of techo) {
      const dx = x - R.xs[i], dz = z - R.zs[i], al = dx * sy + dz * cy, lat = dx * cy - dz * sy; if (al < 0.5 || al > 9) continue;
      const el = Math.atan2(h - OJOS, al); if (el < p - FOV_V / 2 + 0.05 || el > p + FOV_V / 2 - 0.05) continue;
      if (Math.abs(Math.atan2(lat, al)) < FOV_H / 2 - 0.05) t += w;
    }
    return t;
  };
  let mejorV = null;
  const iMax = Math.min(n - (R.salida ? nVol : 30), marcas.volteo ? Math.round(marcas.volteo[0] / PASO) : n) - nVen - 10;
  yield;
  for (let i0 = Math.round(4 / PASO); i0 < iMax; i0 += 5) {
    if (i0 % 100 === 0) yield;
    let s = 0, curva = 0, malo = false;
    for (let i = i0 + nSub; i < i0 + nSub + nSos; i += 3) {
      if (zona[i] === 'frio' || marcas.frio.some(([a, b]) => i * PASO > a - 0.5 && i * PASO < b)) { malo = true; break; }
      const dx = Math.sin(yaw[i]), dz = Math.cos(yaw[i]);
      let cerca = 0;
      for (const [x0, z0, x1, z1] of ductos) {
        const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1) continue;
        const par = Math.abs(((x1 - x0) * dx + (z1 - z0) * dz) / L); if (par < 0.8) continue;
        const d = distSegmento([R.xs[i], R.zs[i]], [x0, z0], [x1, z1]); if (d < 2.2) cerca = Math.max(cerca, (2.2 - Math.max(0.4, d)) / 1.8);
      }
      s += cerca * 0.3; curva += Math.abs(angulo(yaw[Math.min(n - 1, i + 3)] - yaw[i]));
      // (R12) lo que se ve al mirar a 42°: difusores (2), luminarias (1); el primer segundo cuenta doble
      s += verTecho(i, yaw[i], 38.5 * RAD) * (i < i0 + nSub + muestrasPorS ? 2 : 1) * 0.25;
    }
    if (malo) continue;
    const p = s - curva * 6 - (zona[i0 + nSub] === 'gondolas' ? 1 : 0);
    if (!mejorV || p > mejorV.p) mejorV = { p, i0 };
  }
  if (!mejorV && n > nVen + 40) mejorV = { i0: Math.max(30, Math.min(n - nVen - 10, Math.round(n * 0.3))) };
  if (mejorV) {
    const i0 = mejorV.i0, i3 = i0 + nVen;
    marcas.arriba = { inicio: i0 * PASO, sostenido: (i0 + nSub) * PASO, baja: (i0 + nSub + nSos) * PASO, fin: i3 * PASO };
    for (let i = i0; i < i3; i++) {
      const w = i < i0 + nSub ? suaveEscalon((i - i0) / nSub) : i >= i0 + nSub + nSos ? 1 - suaveEscalon((i - i0 - nSub - nSos) / nSub) : 1;
      pitch[i] = pitch[i] * (1 - w) + 38.5 * RAD * w; pesoOff[i] *= 1 - w;
      // la mirada se corre (≤ 20°) hacia los difusores y luminarias que hay adelante
      let sx = 0, sz = 0;
      for (const [x, z, , pw] of techo) { const dx = x - R.xs[i], dz = z - R.zs[i], d = Math.hypot(dx, dz); if (d < 1 || d > 8) continue; const a = angulo(Math.atan2(dx, dz) - yaw[i]); if (Math.abs(a) > 50 * RAD) continue; sx += (dx / d) * pw; sz += (dz / d) * pw; }
      if (sx || sz) { off[i] = Math.max(-20 * RAD, Math.min(20 * RAD, angulo(Math.atan2(sx, sz) - yaw[i]))); pesoOff[i] = 0.8 * w; }
    }
    // al bajar, la mirada queda un poco abajo (pasillo y mercancía), no a la altura del muro del fondo
    for (let i = i3 - Math.round(nSub / 2); i < Math.min(n, i3 + 25); i++) { const w = Math.min(1, (i - (i3 - nSub / 2)) / 8, (i3 + 25 - i) / 8); pitch[i] = Math.min(pitch[i], pitch[i] * (1 - w) - 7 * RAD * w); }
  }
  // composición; luego, donde el cuadro quedaría con mucho muro liso o una columna muy cerca, se corrige el rumbo
  // hacia el giro más pequeño que lo evita (fuera de la mirada hacia arriba)
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = yaw[i] + off[i] * pesoOff[i];
  const costo = (i, a) => { const m = pitch[i] > 20 * RAD ? { muro: 0 } : medirCuadro(V, R.xs[i], R.zs[i], a, pitch[i]); return Math.max(0, m.muro - 0.2) * 3 + Math.max(0, anchoColumnas(local, R.xs[i], R.zs[i], a) - 0.12) * 8; };
  for (let pasada = 0; pasada < 4; pasada++) {
    const corr = new Float32Array(n);
    for (let i = 15; i < n; i += 2) {
      if (i % 30 === 15) yield;
      const c0 = costo(i, out[i]); if (c0 <= 0) continue;
      let mejor = 0, mc = c0;
      for (const g of [-12, 12, -24, 24, -36, 36, -50, 50, -65, 65, -80, 80]) { const c = costo(i, out[i] + g * RAD) + Math.abs(g) * 0.004; if (c < mc - 0.02) { mc = c; mejor = g * RAD; } }
      corr[i] = mejor; if (i + 1 < n) corr[i + 1] = mejor;
    }
    // la corrección entra y sale suave: se conserva el máximo de la vecindad y luego media móvil
    const W = 6, m1 = new Float32Array(n), corrS = new Float32Array(n);
    for (let i = 0; i < n; i++) { let a = 0; for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) if (Math.abs(corr[k]) > Math.abs(a)) a = corr[k]; m1[i] = a; }
    for (let i = 0; i < n; i++) { let s2 = 0, c = 0; for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) { s2 += m1[k]; c++; } corrS[i] = s2 / c; }
    for (let i = 0; i < n; i++) out[i] += corrS[i];
  }

  for (let i = 0; i < n; i++) if (wForz[i] > 0) out[i] += angulo(forz[i] - out[i]) * wForz[i];
  for (let i = 1; i < n; i++) out[i] = out[i - 1] + angulo(out[i] - out[i - 1]); // continuo (sin saltos de 360°)
  // suavizado (media móvil de ±0.6 m, dos pasadas) y límite de giro; luego un suavizado fino
  const media = (a, Wm) => { const y = new Float32Array(n); for (let i = 0; i < n; i++) { let s2 = 0, c = 0; for (let k = Math.max(0, i - Wm); k <= Math.min(n - 1, i + Wm); k++) { s2 += a[k]; c++; } y[i] = s2 / c; } return y; };
  let yawF = media(media(out, 6), 6);
  limitar(yawF, (GIRO_MAX * RAD) / muestrasPorS);
  limitar(pitch, (45 * RAD) / muestrasPorS);
  yawF = suavizarFino(yawF);
  // la subida y bajada de la mirada conservan su forma (el límite solo recorta excesos)
  R.yaw = yawF; R.pitch = suavizarFino(pitch);
  R.marcas = marcas;
  // medidas por muestra (para pruebas y para el resumen)
  R.medir = (i) => { const m = medirCuadro(V, R.xs[i], R.zs[i], R.yaw[i], R.pitch[i]); m.columna = anchoColumnas(local, R.xs[i], R.zs[i], R.yaw[i]); return m; };
  R.vista = V;
}
/** Limita el cambio por muestra (hacia adelante y hacia atrás, hasta que no haya excesos). */
function limitar(a, max) {
  for (let it = 0; it < 6; it++) {
    let ok = true;
    for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; if (Math.abs(d) > max) { a[i] = a[i - 1] + Math.sign(d) * max; ok = false; } }
    for (let i = a.length - 2; i >= 0; i--) { const d = a[i] - a[i + 1]; if (Math.abs(d) > max) { a[i] = a[i + 1] + Math.sign(d) * max; ok = false; } }
    if (ok) break;
  }
}
function suavizarFino(a) { const y = new Float32Array(a); for (let it = 0; it < 3; it++) for (let i = 1; i < a.length - 1; i++) y[i] = (y[i - 1] + 2 * y[i] + y[i + 1]) / 4; return y; }

/**
 * Prueba de la ruta: peor fracción tapada del cono central (muro, columna o mueble alto a menos de 4.5 m), ignorando
 * los primeros 2 m; tramo más largo con muro liso > 45 % del cuadro (s, a la velocidad dada); columna más ancha; tiempo
 * mirando de frente/escorzo el muro de refrigerados (s); mirada arriba ≥ 35° sostenida (s); giro máximo (°/s).
 */
export function revisarRuta(local, layout, R, velocidad = 3) {
  const V = R.vista || rejillaVista(local, layout); let peor = 0, en = -1;
  let liso30 = 0, racha = 0, peorRacha = 0, enRacha = 0, colMax = 0, enCol = 0, frioS = 0, arriba = 0, arribaMax = 0, giro = 0, muroMax = 0;
  const fr = layout.muebles.filter((m) => m.familia === 'refrigerador_vertical');
  for (let i = 0; i < R.n; i++) {
    if (i >= 20) { const t = tapado(V, R.xs[i], R.zs[i], R.yaw[i]); if (t > peor) { peor = t; en = i; } }
    const m = R.medir ? R.medir(i) : { muro: 0, columna: 0 };
    muroMax = Math.max(muroMax, m.muro);
    if (m.muro > 0.3) liso30++;
    if (m.muro > 0.45) { racha++; if (racha > peorRacha) { peorRacha = racha; enRacha = i; } } else racha = 0;
    if (i >= 25 && m.columna > colMax) { colMax = m.columna; enCol = i; }
    // refrigerados en el cuadro: alguna puerta a ≤ 6 m dentro de ±25° del centro, con la mirada a la altura de ellas
    if (Math.abs(R.pitch[i]) < 20 * RAD && fr.some((f) => { const fN = frente(f.rot), u = [fN[1], -fN[0]]; return [-0.4, 0, 0.4].some((q) => { const fx = f.x + u[0] * f.ancho * q + fN[0] * f.fondo / 2, fz = f.z + u[1] * f.ancho * q + fN[1] * f.fondo / 2; const d = Math.hypot(fx - R.xs[i], fz - R.zs[i]); const a = Math.abs(angulo(Math.atan2(fx - R.xs[i], fz - R.zs[i]) - R.yaw[i])); return d < 9 && a < 25 * RAD; }); })) frioS++;
    if (R.pitch[i] >= 35 * RAD) { arriba++; arribaMax = Math.max(arribaMax, arriba); } else arriba = 0;
    if (i > 0) giro = Math.max(giro, Math.abs(R.yaw[i] - R.yaw[i - 1]) / PASO * velocidad / RAD);
  }
  const s = PASO / velocidad;
  return { liso30: liso30 * s, peor, en: en * R.paso, muroRacha: peorRacha * s, muroEn: enRacha * PASO, muroMax, columna: colMax, columnaEn: enCol * PASO, frio: frioS * s, arriba: arribaMax * s, giro };
}
