// Álgebra de regiones rectilíneas: una región es una lista de rectángulos alineados disjuntos {x0,z0,x1,z1}.
// Lógica pura. La usan el generador, la validación y el dibujo de zonas.

const EPS = 1e-6;
export const rect = (x0, z0, x1, z1) => ({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
export const areaR = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0);
export const areaRegion = (rs) => rs.reduce((s, r) => s + areaR(r), 0);
export const vacio = (r) => r.x1 - r.x0 < 1e-4 || r.z1 - r.z0 < 1e-4;

export function interseca(a, b) {
  const r = { x0: Math.max(a.x0, b.x0), z0: Math.max(a.z0, b.z0), x1: Math.min(a.x1, b.x1), z1: Math.min(a.z1, b.z1) };
  return r.x1 - r.x0 > EPS && r.z1 - r.z0 > EPS ? r : null;
}
/** a menos b → hasta 4 rectángulos. */
export function restar(a, b) {
  if (!interseca(a, b)) return [a];
  const out = [];
  if (b.z0 > a.z0) out.push({ x0: a.x0, z0: a.z0, x1: a.x1, z1: b.z0 });
  if (b.z1 < a.z1) out.push({ x0: a.x0, z0: b.z1, x1: a.x1, z1: a.z1 });
  const z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
  if (b.x0 > a.x0) out.push({ x0: a.x0, z0, x1: b.x0, z1 });
  if (b.x1 < a.x1) out.push({ x0: b.x1, z0, x1: a.x1, z1 });
  return out.filter((r) => !vacio(r));
}
export const restarRegion = (rs, b) => rs.flatMap((r) => restar(r, b));
export const restarRegiones = (rs, bs) => bs.reduce((acc, b) => restarRegion(acc, b), rs);
export const intersecarRegion = (rs, b) => rs.map((r) => interseca(r, b)).filter(Boolean);
/** Área de la intersección de un rectángulo con una región. */
export const areaEn = (rs, b) => rs.reduce((s, r) => { const i = interseca(r, b); return s + (i ? areaR(i) : 0); }, 0);
/** ¿El rectángulo r cabe completo en la región? */
export const contiene = (rs, r, tol = 1e-3) => areaEn(rs, r) >= areaR(r) - tol;
export const cajaRegion = (rs) => rs.reduce((a, r) => ({ x0: Math.min(a.x0, r.x0), z0: Math.min(a.z0, r.z0), x1: Math.max(a.x1, r.x1), z1: Math.max(a.z1, r.z1) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
export const centro = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
export const expandir = (r, d) => ({ x0: r.x0 - d, z0: r.z0 - d, x1: r.x1 + d, z1: r.z1 + d });
export const traslapa = (a, b, eps = 0.004) => a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.z0 < b.z1 - eps && b.z0 < a.z1 - eps;

/** Descompone un polígono rectilíneo en franjas horizontales (fusionando las verticalmente iguales). */
export function regionDePoligono(poly) {
  const zs = [...new Set(poly.map((p) => p[1]))].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    const zm = (zs[i] + zs[i + 1]) / 2, xs = [];
    for (let k = 0; k < poly.length; k++) {
      const [x1, z1] = poly[k], [x2, z2] = poly[(k + 1) % poly.length];
      if ((z1 > zm) !== (z2 > zm)) xs.push(x1 + ((zm - z1) * (x2 - x1)) / (z2 - z1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const prev = out.find((r) => Math.abs(r.z1 - zs[i]) < EPS && Math.abs(r.x0 - xs[k]) < EPS && Math.abs(r.x1 - xs[k + 1]) < EPS);
      if (prev) prev.z1 = zs[i + 1]; else out.push({ x0: xs[k], z0: zs[i], x1: xs[k + 1], z1: zs[i + 1] });
    }
  }
  return out;
}

/** Normaliza una región: la redibuja como franjas horizontales máximas (menos piezas, sin traslapes). */
export function normalizar(rs) {
  const zs = [...new Set(rs.flatMap((r) => [r.z0, r.z1]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    const zm = (zs[i] + zs[i + 1]) / 2;
    const iv = rs.filter((r) => r.z0 < zm && r.z1 > zm).map((r) => [r.x0, r.x1]).sort((a, b) => a[0] - b[0]);
    const m = [];
    for (const v of iv) { const u = m[m.length - 1]; if (u && v[0] <= u[1] + 1e-4) u[1] = Math.max(u[1], v[1]); else m.push(v.slice()); }
    for (const [x0, x1] of m) {
      const prev = out.find((r) => Math.abs(r.z1 - zs[i]) < 1e-4 && Math.abs(r.x0 - x0) < 1e-4 && Math.abs(r.x1 - x1) < 1e-4);
      if (prev) prev.z1 = zs[i + 1]; else out.push({ x0, z0: zs[i], x1, z1: zs[i + 1] });
    }
  }
  return out;
}

/** Contorno (polígono) del mayor anillo de una región. */
export function contorno(rs) {
  if (!rs.length) return [];
  const xs = [...new Set(rs.flatMap((r) => [r.x0, r.x1]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
  const zs = [...new Set(rs.flatMap((r) => [r.z0, r.z1]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
  const nx = xs.length - 1, nz = zs.length - 1;
  const cub = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && rs.some((r) => { const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2; return cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1; });
  const C = []; for (let i = 0; i < nx; i++) { C[i] = []; for (let j = 0; j < nz; j++) C[i][j] = cub(i, j); }
  const c = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && C[i][j];
  const ar = new Map(); const k = (i, j) => i * 10007 + j;
  const add = (a, b) => ar.set(k(...a), b);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (!C[i][j]) continue;
    if (!c(i, j - 1)) add([i, j], [i + 1, j]);
    if (!c(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
    if (!c(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
    if (!c(i - 1, j)) add([i, j + 1], [i, j]);
  }
  let mejor = [], mejorA = 0; const usados = new Set();
  for (const [inicio] of ar) {
    if (usados.has(inicio)) continue;
    const anillo = []; let cur = inicio, guard = 0;
    while (!usados.has(cur) && guard++ < 10000) {
      usados.add(cur); const i = Math.floor(cur / 10007), j = cur % 10007; anillo.push([xs[i], zs[j]]);
      const s = ar.get(cur); if (!s) break; cur = k(...s);
    }
    let a = 0; for (let t = 0; t < anillo.length; t++) { const p = anillo[t], q = anillo[(t + 1) % anillo.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (Math.abs(a) > mejorA) { mejorA = Math.abs(a); mejor = anillo; }
  }
  // quita vértices colineales
  return mejor.filter((p, t) => { const a = mejor[(t + mejor.length - 1) % mejor.length], b = mejor[(t + 1) % mejor.length]; return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9; });
}

/** Como normalizar pero en franjas verticales máximas (para corridas a lo largo de z). */
export function normalizarV(rs) {
  const t = (r) => ({ x0: r.z0, z0: r.x0, x1: r.z1, z1: r.x1 });
  return normalizar(rs.map(t)).map(t);
}
