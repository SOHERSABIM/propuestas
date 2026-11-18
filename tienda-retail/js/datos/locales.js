// Los tres locales del prototipo. Lógica pura. Metros, convención de ejes en core/geom.js y design.md §2.
// Polígono = cara interior del muro exterior (los muros crecen hacia afuera, el espacio útil es el polígono).
// Vanos: {centro:[x,z], ancho, alto, normal:[nx,nz] exterior}. Columnas: centros [x,z] de 0.40 × 0.40.

/** @typedef {[number, number]} P */
/**
 * @typedef {Object} Vano
 * @property {P} centro  punto medio del vano sobre la línea del polígono
 * @property {number} ancho
 * @property {number} alto
 * @property {P} normal  normal exterior del lado donde está
 */
/**
 * @typedef {Object} Local
 * @property {'A'|'B'|'C'} id
 * @property {string} nombre
 * @property {P[]} poligono
 * @property {number} altura         altura libre (lecho bajo de cubierta)
 * @property {number} espesorMuro
 * @property {{a:P, b:P, tipo:'cristal'}[]} fachadas  tramos de fachada de cristal (sobre lados del polígono)
 * @property {Vano} acceso            acceso principal (doble puerta de cristal)
 * @property {Vano} recibo            puerta de recibo de mercancía (cortina 2.4 × 2.4)
 * @property {Vano[]} salidas         salidas de emergencia
 * @property {P[]} columnas           todas las columnas (perimetrales e interiores)
 * @property {number} columna         lado de columna (0.40)
 */

const ALTURA = 4.8, ESP = 0.25;

/** Columnas en retícula, conservando solo las que caen dentro o en el borde del polígono. */
function reticula(xs, zs, poly) {
  const r = [];
  for (const x of xs) for (const z of zs) if (enOBorde(poly, x, z)) r.push([x, z]);
  return r;
}
function enOBorde(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    const d = Math.abs((xj - xi) * (zi - z) - (xi - x) * (zj - zi)) / Math.hypot(xj - xi, zj - zi);
    const enSeg = Math.min(xi, xj) - 1e-6 <= x && x <= Math.max(xi, xj) + 1e-6 && Math.min(zi, zj) - 1e-6 <= z && z <= Math.max(zi, zj) + 1e-6;
    if (d < 1e-6 && enSeg) return true;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/** Mete la columna perimetral 0.20 hacia adentro para que su cara quede al paño interior del muro. */
function alPano(poly, cols) {
  const b = poly.reduce((a, [x, z]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), z0: Math.min(a.z0, z), z1: Math.max(a.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
  return cols.map(([x, z]) => {
    let nx = x, nz = z;
    const borde = (px, pz) => !enOBorde(poly, px, pz);
    if (borde(x - 0.3, z)) nx = x + 0.2; else if (borde(x + 0.3, z)) nx = x - 0.2;
    if (borde(x, z - 0.3)) nz = z + 0.2; else if (borde(x, z + 0.3)) nz = z - 0.2;
    void b; return [nx, nz];
  });
}

const polyA = [[0, 0], [25, 0], [25, 30], [0, 30]];
const polyB = [[0, 0], [16, 0], [16, 40], [0, 40]];
const polyC = [[0, 0], [18, 0], [18, 17], [34, 17], [34, 34], [0, 34]];

/** @type {Record<'A'|'B'|'C', Local>} */
export const LOCALES = {
  A: {
    id: 'A', nombre: 'Rectangular', poligono: polyA, altura: ALTURA, espesorMuro: ESP, columna: 0.4,
    fachadas: [{ a: [25, 30], b: [0, 30], tipo: 'cristal' }],
    acceso: { centro: [12.5, 30], ancho: 2.4, alto: 2.6, normal: [0, 1] },
    recibo: { centro: [20.5, 0], ancho: 2.4, alto: 2.4, normal: [0, -1] },
    salidas: [{ centro: [3, 0], ancho: 1.2, alto: 2.2, normal: [0, -1] }],
    columnas: alPano(polyA, reticula([0, 8.33, 16.67, 25], [0, 7.5, 15, 22.5, 30], polyA)),
  },
  B: {
    // Claro libre de 16 m con armaduras: sin columnas interiores, pilastras perimetrales cada 8 m.
    id: 'B', nombre: 'Angosto y profundo', poligono: polyB, altura: ALTURA, espesorMuro: ESP, columna: 0.4,
    fachadas: [{ a: [16, 40], b: [0, 40], tipo: 'cristal' }],
    acceso: { centro: [8, 40], ancho: 2.4, alto: 2.6, normal: [0, 1] },
    recibo: { centro: [11.5, 0], ancho: 2.4, alto: 2.4, normal: [0, -1] },
    salidas: [{ centro: [0, 5], ancho: 1.2, alto: 2.2, normal: [-1, 0] }],
    columnas: alPano(polyB, reticula([0, 16], [0, 8, 16, 24, 32, 40], polyB)),
  },
  C: {
    // Planta en L en esquina: fachadas al frente (z = 34) y al costado izquierdo (x = 0).
    id: 'C', nombre: 'En esquina (L)', poligono: polyC, altura: ALTURA, espesorMuro: ESP, columna: 0.4,
    fachadas: [{ a: [34, 34], b: [0, 34], tipo: 'cristal' }, { a: [0, 34], b: [0, 17], tipo: 'cristal' }],
    acceso: { centro: [7, 34], ancho: 2.4, alto: 2.6, normal: [0, 1] },
    recibo: { centro: [9, 0], ancho: 2.4, alto: 2.4, normal: [0, -1] },
    salidas: [{ centro: [34, 26], ancho: 1.2, alto: 2.2, normal: [1, 0] }],
    // la columna de la esquina entrante (18,17) se lleva al paño interior a mano
    columnas: alPano(polyC, reticula([0, 9, 18, 26, 34], [0, 8.5, 17, 25.5, 34], polyC)).map(([x, z]) => (x === 18 && z === 17 ? [18.2, 17.2] : [x, z])),
  },
};
export const IDS_LOCALES = /** @type {const} */ (['A', 'B', 'C']);
