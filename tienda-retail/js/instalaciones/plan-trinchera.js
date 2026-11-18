// PLAN DE TRINCHERAS PARA CONGELADORES ISLA (puro). Los congeladores isla están en medio del piso de venta: no bajan
// tuberías del techo hasta ellos. Cada isla recibe su línea por una canaleta con tapa a ras de piso que llega desde
// el muro o la columna más cercana (ruta de costo mínimo con penalización por giros, rodeando el mobiliario); la
// subida vertical queda pegada a ese muro o columna y de ahí la línea sigue por arriba como las demás. Cada árbol
// de canaletas (hasta 4 islas) es un «equipo virtual» para el plan de frío y de aire (su subida es un obstáculo).
import { r3, rectC, solapa, huellaMueble, ptDentro } from './util.js';

export const ANCHO_CANALETA = 0.24, ALTO_CANALETA = 0.045, Y_SUBIDA = 0.045;
const CELDA = 0.2, MAX_ISLAS = 4;

const distRect = (r, x, z) => { const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1); return Math.hypot(dx, dz); };
const puntoRect = (r, x, z) => [Math.min(Math.max(x, r.x0), r.x1), Math.min(Math.max(z, r.z0), r.z1)];

// memoria de trabajo reutilizada entre llamadas (evita asignar varios MB por layout)
let _buf = null;
function buffers(n) {
  if (!_buf || _buf.n < n) _buf = { n, lib: new Int8Array(n), obj: new Int16Array(n), dist: new Float32Array(n * 4), prev: new Int32Array(n * 4), hc: new Float32Array(260000), hs: new Int32Array(260000) };
  return _buf;
}
/**
 * @returns {{equipos:any[], islas:Set<string>, arboles:any[]}}
 */
export function planTrincheras(local, layout, ids) {
  const poly = local.poligono;
  const islas = layout.muebles.filter((m) => m.familia === 'congelador_isla' && m.frio && m.frio.conexion && (!ids || ids.includes(m.id)));
  if (!islas.length) return { equipos: [], islas: new Set(), arboles: [] };
  const bb = poly.reduce((a, [x, z]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), z0: Math.min(a.z0, z), z1: Math.max(a.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
  const W = Math.ceil((bb.x1 - bb.x0) / CELDA) + 1, H = Math.ceil((bb.z1 - bb.z0) / CELDA) + 1;
  const cx = (i) => bb.x0 + i * CELDA, cz = (j) => bb.z0 + j * CELDA;

  // objetivos: columnas, muros interiores y muros del perímetro
  const objetivos = [];
  for (const [x, z] of local.columnas) objetivos.push(rectC(x, z, local.columna, local.columna));
  for (const m of layout.muros || []) { const h = (m.espesor || 0.15) / 2; objetivos.push({ x0: Math.min(m.a[0], m.b[0]) - h, x1: Math.max(m.a[0], m.b[0]) + h, z0: Math.min(m.a[1], m.b[1]) - h, z1: Math.max(m.a[1], m.b[1]) + h }); }
  for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; if (Math.abs(x1 - x2) > 1e-6 && Math.abs(z1 - z2) > 1e-6) continue; objetivos.push({ x0: Math.min(x1, x2) - 0.075, x1: Math.max(x1, x2) + 0.075, z0: Math.min(z1, z2) - 0.075, z1: Math.max(z1, z2) + 0.075 }); }
  const duros = [...objetivos];
  const fp = layout.muebles.map((m) => ({ id: m.id, r: huellaMueble(m) }));
  const libreBase = (x, z, propio, inicio = false) => {
    if (!ptDentro(poly, x, z, 0.15)) return false;
    for (const q of duros) if (distRect(q, x, z) < 0.13) return false;
    if (!inicio) for (const f of fp) if (x > f.r.x0 - 0.3 && x < f.r.x1 + 0.3 && z > f.r.z0 - 0.3 && z < f.r.z1 + 0.3) return false;
    return true;
  };
  const B = buffers(W * H); const libCache = B.lib, objCache = B.obj; libCache.fill(0, 0, W * H); objCache.fill(0, 0, W * H);
  const libre = (i, j, propio) => { const k = i * H + j; let v = libCache[k]; if (!v) { v = libreBase(cx(i), cz(j), propio) ? 1 : -1; libCache[k] = v; } return v > 0; };
  const objIdx = (i, j) => { const k = i * H + j; let v = objCache[k]; if (!v) { const q = objCelda(cx(i), cz(j)); v = q ? objetivos.indexOf(q) + 1 : -1; objCache[k] = v; } return v > 0 ? objetivos[v - 1] : null; };
  const objCelda = (x, z) => { for (const q of objetivos) { const d = distRect(q, x, z); if (d > 0.1 && d < 0.33) return q; } return null; };

  const dist = B.dist, prev = B.prev, hc = B.hc, hs = B.hs;
  const orden = islas.slice().sort((a, b) => a.id.localeCompare(b.id));
  const arboles = [];
  for (const isla of orden) {
    const f = huellaMueble(isla); const [ex, , ez] = isla.frio.conexion;
    // salida: del centro de la isla hacia su conexión, hasta el borde del mueble
    const ux = ex - isla.x, uz = ez - isla.z; const ox = Math.abs(ux) >= Math.abs(uz) ? Math.sign(ux) : 0, oz = ox ? 0 : Math.sign(uz) || 1;
    const borde = [ox > 0 ? f.x1 : ox < 0 ? f.x0 : ex, oz > 0 ? f.z1 : oz < 0 ? f.z0 : ez];
    const ini = [borde[0] + ox * 0.22, borde[1] + oz * 0.22];
    const si = Math.round((ini[0] - bb.x0) / CELDA), sj = Math.round((ini[1] - bb.z0) / CELDA);
    // Dijkstra con penalización por giro; destino: objetivo (nueva subida) o celda de una canaleta existente (empalme)
    const arbolesAbiertos = arboles.filter((t) => t.islas.length < MAX_ISLAS);
    const empalme = new Map(); for (const t of arbolesAbiertos) for (const c of t.celdas) empalme.set(c.k, { t, c });
    const key = (i, j) => i * H + j;
    dist.fill(Infinity, 0, W * H * 4); prev.fill(-1, 0, W * H * 4);
    let hn = 0;
    const push = (c, st) => { let n = hn++; hc[n] = c; hs[n] = st; while (n > 0) { const p = (n - 1) >> 1; if (hc[p] <= hc[n]) break; const tc = hc[p], ts = hs[p]; hc[p] = hc[n]; hs[p] = hs[n]; hc[n] = tc; hs[n] = ts; n = p; } };
    const pop = () => { const c = hc[0], st = hs[0]; hn--; if (hn > 0) { hc[0] = hc[hn]; hs[0] = hs[hn]; let n = 0; for (;;) { const l = 2 * n + 1, r = l + 1; let m = n; if (l < hn && hc[l] < hc[m]) m = l; if (r < hn && hc[r] < hc[m]) m = r; if (m === n) break; const tc = hc[m], ts = hs[m]; hc[m] = hc[n]; hs[m] = hs[n]; hc[n] = tc; hs[n] = ts; n = m; } } popC = c; return st; };
    let popC = 0;
    const DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];
    if (!libreBase(cx(si), cz(sj), isla.id, true)) continue;
    const d0 = ox ? (ox > 0 ? 0 : 1) : (oz > 0 ? 2 : 3);
    const s0 = key(si, sj) * 4 + d0; dist[s0] = 0; push(0, s0); let fin = null, expand = 0;
    while (hn > 0 && expand++ < 60000) {
      const st = pop(), c = popC; if (c > dist[st] + 1e-6) continue;
      const kc = (st / 4) | 0, e = st & 3, i = (kc / H) | 0, j = kc - i * H;
      const emp = empalme.get(kc);
      const oc = emp ? null : objIdx(i, j);
      if (emp || oc) { fin = { i, j, e, emp }; break; }
      for (let q = 0; q < 4; q++) {
        const ni = i + DX[q], nj = j + DZ[q]; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        if (!libre(ni, nj, isla.id)) continue;
        const nc = c + 1 + (q === e ? 0 : 3), ns = key(ni, nj) * 4 + q;
        if (nc < dist[ns] - 1e-6) { dist[ns] = nc; prev[ns] = st; push(nc, ns); }
      }
    }
    if (!fin) continue;
    // reconstruye la lista de celdas del inicio al fin
    const cel = []; let ks = key(fin.i, fin.j) * 4 + fin.e;
    while (ks >= 0) { const kc = (ks / 4) | 0; const ci = (kc / H) | 0; cel.push([ci, kc - ci * H]); ks = prev[ks]; }
    cel.reverse();
    const pts = cel.map(([i, j]) => [r3(cx(i)), r3(cz(j))]);
    // polilínea compacta (solo esquinas) desde el borde de la isla
    const pl = [[r3(ox ? borde[0] : pts[0][0]), r3(ox ? pts[0][1] : borde[1])], ...pts];
    const poli = [pl[0]]; for (let i = 1; i < pl.length - 1; i++) { const a = pl[i - 1], b = pl[i], c = pl[i + 1]; if ((Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(b[0] - c[0]) < 1e-6) || (Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(b[1] - c[1]) < 1e-6)) continue; poli.push(b); } poli.push(pl[pl.length - 1]);
    // el primer punto del borde y el primero de la rejilla pueden no ser colineales: asegura tramos ortogonales
    const ort = [poli[0]]; for (let i = 1; i < poli.length; i++) { const a = ort[ort.length - 1], b = poli[i]; if (Math.abs(a[0] - b[0]) > 1e-6 && Math.abs(a[1] - b[1]) > 1e-6) ort.push([b[0], a[1]]); ort.push(b); }
    const celdas = cel.map(([i, j]) => ({ k: key(i, j), p: [cx(i), cz(j)] }));
    if (fin.emp) {
      const t = fin.emp.t; t.ramas.push({ isla: isla.id, puntos: ort, empalme: fin.emp.c.p }); t.islas.push(isla.id); t.ancho += isla.ancho; t.celdas.push(...celdas);
    } else {
      const q = objIdx(fin.i, fin.j); const [qx, qz] = puntoRect(q, cx(fin.i), cz(fin.j));
      arboles.push({ islas: [isla.id], ancho: isla.ancho, subida: [r3(cx(fin.i)), r3(cz(fin.j))], cara: [qx, qz], ramas: [{ isla: isla.id, puntos: ort, empalme: null }], celdas });
    }
  }
  const equipos = arboles.map((t, n) => {
    const dx = t.subida[0] - t.cara[0], dz = t.subida[1] - t.cara[1]; const tang = Math.abs(dx) >= Math.abs(dz) ? [0, 1] : [1, 0];
    const OFF = 0.13;
    return {
      id: `trinchera#${String(n + 1).padStart(2, '0')}`, familia: 'trinchera', x: t.subida[0], z: t.subida[1], rot: 0, ancho: r3(t.ancho), fondo: 0.3, alto: 0, virtual: true,
      frio: { conexion: [t.subida[0], Y_SUBIDA, t.subida[1]], carga: t.islas.length },
      offPref: [[tang[0] * OFF, tang[1] * OFF], [-tang[0] * OFF, -tang[1] * OFF], [OFF, OFF], [-OFF, OFF], [OFF, -OFF], [-OFF, -OFF]],
      trinchera: { islas: t.islas, ramas: t.ramas, subida: t.subida, alejar: Math.hypot(dx, dz) > 1e-6 ? (Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)]) : [0, 0] },
    };
  });
  const sinTrinchera = islas.filter((m) => !arboles.some((t) => t.islas.includes(m.id))).map((m) => m.id);
  return { equipos, islas: new Set(islas.map((m) => m.id).filter((id) => !sinTrinchera.includes(id))), arboles, sinTrinchera };
}
