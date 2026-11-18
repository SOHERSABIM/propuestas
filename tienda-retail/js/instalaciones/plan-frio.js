// PLAN DE REFRIGERACIÓN (puro). Por cada equipo frío corre un par de tuberías (línea de líquido, delgada, y línea de
// succión, más gruesa y aislada) desde la condensadora en azotea hasta el equipo. Las rutas son ortogonales, sin
// columnas, sin cruzarse entre sí ni con los bajantes de aire; a 4.35 m (por encima de los ductos). Cada ruta se
// descompone en piezas (tramos de ≤ 2.4 m, codos, válvulas, abrazaderas) con su distancia `d` desde la condensadora.
import { ANCHO_CANALETA, ALTO_CANALETA } from './plan-trinchera.js';
import { r3, rectC, solapa, ptDentro, rectSeg, enRect, cajaC, unirCajas, NIVEL_AZOTEA, H_BANC } from './util.js';

export const Y_FRIO = 4.5, Y_AZOTEA = NIVEL_AZOTEA;
export const DIM_COND = { ancho: 2.2, fondo: 1.2, alto: 1.1 };
export const D_LIQ = 0.045, D_SUC = 0.11;    // diámetro visual (el real es menor; así se lee a 1080p)
const OFF = 0.13;                            // separación del par
const TL = 1.5;                              // radio del codo = 1.5 diámetros
const TRAMO_MAX = 2.2;

const eqPunto = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
function limpiar(pts) {
  const o = [];
  for (const p of pts) { if (o.length && eqPunto(o[o.length - 1], p)) continue; o.push(p); }
  for (let i = 1; i + 1 < o.length; i++) {
    const a = o[i - 1], b = o[i], c = o[i + 1];
    if ((Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(b[0] - c[0]) < 1e-9) || (Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(b[1] - c[1]) < 1e-9)) { o.splice(i, 1); i--; }
  }
  return o;
}
/** ¿Se cruzan (o se traslapan) dos polilíneas ortogonales en planta? */
function seCruzan(A, B) {
  for (let i = 0; i + 1 < A.length; i++) for (let j = 0; j + 1 < B.length; j++) {
    const r1 = rectSeg(A[i], A[i + 1]), r2 = rectSeg(B[j], B[j + 1]);
    if (r1.x0 <= r2.x1 + 1e-9 && r2.x0 <= r1.x1 + 1e-9 && r1.z0 <= r2.z1 + 1e-9 && r2.z0 <= r1.z1 + 1e-9) return true;
  }
  return false;
}
const largoPl = (p) => p.reduce((s, v, i) => s + (i ? Math.abs(v[0] - p[i - 1][0]) + Math.abs(v[1] - p[i - 1][1]) : 0), 0);

const memosPor = new WeakMap();   // memo de «punto dentro del polígono» por local (el polígono no cambia entre layouts)
export function planFrio(local, layout, ctx) {
  const poly = local.poligono;
  const colsR = ctx.cols(0.3);
  const Yl = Y_FRIO, Yr = Y_AZOTEA;
  const equipos = ctx.equiposFrios;
  if (!equipos.length) return { condensadoras: [], lineas: [], piezas: [], rutas: [], dMax: 1, risers: [] };
  const aire = ctx.aire;
  const bb = poly.reduce((a, [x, z]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), z0: Math.min(a.z0, z), z1: Math.max(a.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
  const conx = (e) => [e.frio.conexion[0], e.frio.conexion[2]];

  // bloqueos fijos para tramos horizontales: bajantes de aire (suben a la losa) y columnas
  const fijosEstrictos = [...colsR, ...aire.bajantes.map((b) => rectC(b.x, b.z, 1.0, 1.0))];
  // segunda pasada (si la estricta no encuentra ruta): márgenes menores a columnas y bajantes
  const fijosFlojos = [...ctx.cols(0.12), ...aire.bajantes.map((b) => rectC(b.x, b.z, 0.7, 0.7))];
  let fijos = fijosEstrictos, relajar = false;
  const ocupadas = [];                                   // franjas de rutas ya aceptadas
  const reservas = equipos.map((e) => ({ id: e.id, r: rectC(conx(e)[0], conx(e)[1], 0.5, 0.5) }));

  const memos = memosPor.get(poly) ?? (memosPor.set(poly, { a: new Map(), b: new Map() }), memosPor.get(poly));
  const memo = memos.a;
  const ptOk = (x, z) => { const k = Math.round(x * 50) * 100003 + Math.round(z * 50); let v = memo.get(k); if (v === undefined) { v = ptDentro(poly, x, z, 0.3); memo.set(k, v); } return v; };
  const memo5 = memos.b;
  const ptOk5 = (x, z) => { const k = Math.round(x * 50) * 100003 + Math.round(z * 50); let v = memo5.get(k); if (v === undefined) { v = ptDentro(poly, x, z, 0.5); memo5.set(k, v); } return v; };
  const rectEnPoligono = (P, r) => {
    for (let x = r.x0; x <= r.x1 + 1e-9; x += 0.5) if (!ptOk5(x, r.z0) || !ptOk5(x, r.z1)) return false;
    for (let z = r.z0; z <= r.z1 + 1e-9; z += 0.5) if (!ptOk5(r.x0, z) || !ptOk5(r.x1, z)) return false;
    return ptOk5(r.x1, r.z1) && ptOk5(r.x1, r.z0);
  };
  const segDentro = (P, a, b) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 0.4));
    for (let i = 0; i <= n; i++) { const t = i / n; if (!ptOk(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
    return true;
  };

  const bloqBase = new Map();
  function ruta(S, T, propio, tmp) { 
    let base = bloqBase.get(propio);
    if (!base) { base = [...fijos, ...reservas.filter((q) => q.id !== propio).map((q) => q.r), ...ocupadas]; bloqBase.set(propio, base); }
    const libre = (a, b) => {
      const rs = rectSeg(a, b, 0.2);
      for (let i = 0; i < base.length; i++) if (solapa(rs, base[i])) return false;
      for (let i = 0; i < tmp.length; i++) if (solapa(rs, tmp[i])) return false;
      return true;
    };
    if (Math.abs(S[0] - T[0]) < 0.02 && Math.abs(S[1] - T[1]) < 0.02) return libre(S, S) ? [S] : null;
    // poda rápida: tanto S como T necesitan al menos un tramo libre de 0.5 m saliendo de ellos
    for (const P of [S, T]) {
      if (![[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].some(([dx, dz]) => { const e = [P[0] + dx, P[1] + dz]; return libre(P, e) && segDentro(poly, P, e); })) { return null; }
    }
    // alcance libre perezoso desde S y T en cada dirección (pasos de 0.5 m): evita probar trayectos con un extremo bloqueado
    const mkR = () => ({ e: { n: 0, b: false }, w: { n: 0, b: false }, s: { n: 0, b: false }, n: { n: 0, b: false } });
    const rS = mkR(), rT = mkR();
    const libreHasta = (P, R, dx, dz, dist) => {
      const k = dx > 0 ? 'e' : dx < 0 ? 'w' : dz > 0 ? 's' : 'n', st = R[k], ux = Math.sign(dx), uz = Math.sign(dz);
      while (st.n * 0.5 < dist - 1e-9 && !st.b) {
        const a = [P[0] + ux * 0.5 * st.n, P[1] + uz * 0.5 * st.n], b2 = [P[0] + ux * 0.5 * (st.n + 1), P[1] + uz * 0.5 * (st.n + 1)];
        if (libre(a, b2) && segDentro(poly, a, b2)) st.n++; else st.b = true;
      }
      return st.n * 0.5 >= dist - 1e-9;
    };
    const legOk = (P, R, Q) => { const dx = Q[0] - P[0], dz = Q[1] - P[1]; return libreHasta(P, R, Math.abs(dz) < 1e-9 ? dx : 0, Math.abs(dz) < 1e-9 ? 0 : dz, Math.abs(dx) + Math.abs(dz)); };
    const cand = []; const add = (pts) => {
      const c = limpiar(pts); for (let i = 0; i + 1 < c.length; i++) if (Math.abs(c[i + 1][0] - c[i][0]) + Math.abs(c[i + 1][1] - c[i][1]) < 0.5) return;
      if (legOk(S, rS, c[1]) && legOk(T, rT, c[c.length - 2])) cand.push(c);
    };
    add([S, [S[0], T[1]], T]); add([S, [T[0], S[1]], T]);
    const along = (P, R, ax, d) => d === 0 || libreHasta(P, R, ax === 0 ? d : 0, ax === 1 ? d : 0, Math.abs(d));
    for (let q = 0.5; q <= 40; q += q < 6 ? 0.5 : 1.5) {
      for (const sg of [1, -1]) {
        const zm = S[1] + sg * q, zm2 = T[1] + sg * q, xm = S[0] + sg * q, xm2 = T[0] + sg * q;
        if (zm >= bb.z0 && zm <= bb.z1 && Math.abs(zm - T[1]) >= 0.5 && along(S, rS, 1, zm - S[1]) && along(T, rT, 1, zm - T[1])) add([S, [S[0], zm], [T[0], zm], T]);
        if (zm2 >= bb.z0 && zm2 <= bb.z1 && Math.abs(zm2 - S[1]) >= 0.5 && along(S, rS, 1, zm2 - S[1]) && along(T, rT, 1, zm2 - T[1])) add([S, [S[0], zm2], [T[0], zm2], T]);
        if (xm >= bb.x0 && xm <= bb.x1 && Math.abs(xm - T[0]) >= 0.5 && along(S, rS, 0, xm - S[0]) && along(T, rT, 0, xm - T[0])) add([S, [xm, S[1]], [xm, T[1]], T]);
        if (xm2 >= bb.x0 && xm2 <= bb.x1 && Math.abs(xm2 - S[0]) >= 0.5 && along(S, rS, 0, xm2 - S[0]) && along(T, rT, 0, xm2 - T[0])) add([S, [xm2, S[1]], [xm2, T[1]], T]);
      }
    }
    cand.sort((a, b) => (largoPl(a) - largoPl(b)) || (a.length - b.length));
    for (const c of cand) {
      let ok = true;
      for (let i = 0; i + 1 < c.length && ok; i++) { if (!libre(c[i], c[i + 1])) ok = false; else if (!segDentro(poly, c[i], c[i + 1], 0.3)) ok = false; }
      if (ok) return c;
    }
    return null;
  }

  // las subidas de las canaletas van pegadas a un muro o columna: la ruta aérea arranca 45 cm hacia el interior
  const rutaEq = (e, T, tmp) => {
    const S = conx(e), al = e.trinchera?.alejar;
    let S2 = null;
    if (al && (al[0] || al[1])) S2 = [r3(S[0] + al[0] * 0.45), r3(S[1] + al[1] * 0.45)];
    else if (fijos.some((q) => S[0] > q.x0 - 0.2 && S[0] < q.x1 + 0.2 && S[1] > q.z0 - 0.2 && S[1] < q.z1 + 0.2)) {
      // el riser del equipo cae dentro del margen de una columna o bajante: la ruta aérea arranca un poco más allá
      for (let d = 0.2; d <= 1.2 && !S2; d += 0.1) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = [r3(S[0] + dx * d), r3(S[1] + dz * d)];
        if (!fijos.some((q) => c[0] > q.x0 - 0.25 && c[0] < q.x1 + 0.25 && c[1] > q.z0 - 0.25 && c[1] < q.z1 + 0.25) && ptOk(c[0], c[1])) { S2 = c; break; }
      }
    }
    if (!S2) return ruta(S, T, e.id, tmp);
    const rt = ruta(S2, T, e.id, tmp); if (!rt) return null;
    return limpiar([S, ...rt]);
  };
  // grupos por posición y metros de equipo (≤ 8 puertos por condensadora)
  const total = equipos.reduce((s, e) => s + e.ancho, 0);
  const ng = Math.max(1, Math.min(5, equipos.length, Math.max(Math.ceil(total / 9), Math.ceil(equipos.length / 8))));
  const bx = Math.max(...equipos.map((e) => e.x)) - Math.min(...equipos.map((e) => e.x)), bz = Math.max(...equipos.map((e) => e.z)) - Math.min(...equipos.map((e) => e.z));
  const ord = equipos.slice().sort((a, b) => (bx >= bz ? (a.x - b.x) || (a.z - b.z) : (a.z - b.z) || (a.x - b.x)) || a.id.localeCompare(b.id));
  const grupos = Array.from({ length: ng }, () => []); let acc = 0;
  for (const e of ord) { const g = Math.min(ng - 1, Math.floor((acc + e.ancho / 2) / (total / ng))); grupos[g].push(e); acc += e.ancho; }
  const gruposOk = grupos.filter((g) => g.length);

  const spiral = [];
  for (let dx = -20; dx <= 20; dx += 1) for (let dz = -20; dz <= 20; dz += 1) if ((Math.abs(dx) <= 6 && Math.abs(dz) <= 6) || (dx % 2 === 0 && dz % 2 === 0 && Math.abs(dx) <= 14 && Math.abs(dz) <= 14) || (dx % 3 === 0 && dz % 3 === 0)) spiral.push([dx, dz]);
  spiral.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]) || a[0] - b[0] || a[1] - b[1]);

  const ductosPl = ctx.aire.piezas.filter((q) => q.caja && ((q.t === 'tramo' && q.rol !== 'ramal') || q.t === 'teeR' || q.t === 'teeP' || q.t === 'bajante')).map((q) => ({ x0: q.caja.x0, x1: q.caja.x1, z0: q.caja.z0, z1: q.caja.z1 }));
  const huellas = ctx.aire.unidades.map((u) => rectC(u.p[0], u.p[2], u.ancho, u.fondo));
  const condensadoras = [], lineas = [], piezas = [], rutas = [], risers = [], sinRuta = [];
  let dMax = 1;
  const add = (p) => { p.sys = 'frio'; p.id = p.id || `${p.t}${piezas.length}`; piezas.push(p); if (p.ph === 'red' && p.d > dMax) dMax = p.d; return p; };

  const cola = gruposOk.slice(); let gi = -1;
  while (cola.length) {
    const g = cola.shift(); gi++;
    const cx0 = g.reduce((s, e) => s + conx(e)[0], 0) / g.length, cz0 = g.reduce((s, e) => s + conx(e)[1], 0) / g.length;
    const gOrd = g.slice().sort((a, b) => a.frio.conexion[0] - b.frio.conexion[0] || a.frio.conexion[2] - b.frio.conexion[2]);
    const cols2 = Math.ceil(gOrd.length / 2);
    const puertosDe = (cx, cz) => gOrd.map((_, j) => {
      const c = j >> 1, r = j & 1;
      return [r3(cx + (c - (cols2 - 1) / 2) * 0.5), r3(cz + (gOrd.length === 1 ? 0 : r ? 0.3 : -0.3))];
    });
    let elegido = null, mejorSinRuta = null;
    for (let pasada = 0; pasada < 3 && !elegido; pasada++) {
      relajar = pasada >= 1; fijos = relajar ? fijosFlojos : fijosEstrictos; bloqBase.clear();
    for (const [dx, dz] of spiral) {
      const cx = r3(cx0 + dx), cz = r3(cz0 + dz); const fp = rectC(cx, cz, DIM_COND.ancho + 0.2, DIM_COND.fondo + 0.2);
      if (!rectEnPoligono(poly, fp)) continue;
      if (huellas.some((h) => solapa(h, fp, 0.5))) continue;
      if (pasada < 2 && ductosPl.some((h) => solapa(h, fp, 0.05))) continue;
      const puertos = puertosDe(cx, cz);
      if (puertos.some((p) => colsR.some((k) => enRect(k, p[0] + 0.12, p[1] + 0.12) || enRect(k, p[0], p[1])))) continue;
      if (puertos.some((p) => aire.bajantes.some((b) => Math.abs(b.x - p[0]) < 0.8 && Math.abs(b.z - p[1]) < 0.8))) continue;
      mejorSinRuta ??= { cx, cz, puertos };
      if (!ptOk(puertos[0][0], puertos[0][1])) continue;
      const tmp = []; const rutasC = [];
      let todas = true;
      for (let j = 0; j < gOrd.length; j++) {
        const e = gOrd[j]; const rt = rutaEq(e, puertos[j], tmp);
        if (!rt) { todas = false; break; }
        rutasC.push(rt);
        for (let i = 0; i + 1 < rt.length; i++) tmp.push(rectSeg(rt[i], rt[i + 1], 0.2));
        if (rt.length === 1) tmp.push(rectC(rt[0][0], rt[0][1], 0.4, 0.4));
        // el puerto también se reserva para las siguientes rutas
        tmp.push(rectC(puertos[j][0], puertos[j][1], 0.36, 0.36));
      }
      if (todas) { elegido = { cx, cz, puertos, rutas: rutasC, fp, tmp }; break; }
    }
    }
    fijos = fijosEstrictos; bloqBase.clear();
    if (!elegido && g.length > 1 && condensadoras.length + cola.length + 2 <= 4) {   // si el grupo no tiene solución, se parte en dos condensadoras
      const h = Math.ceil(g.length / 2); cola.unshift(g.slice(0, h), g.slice(h)); gi--; continue;
    }
    if (!elegido) {   // último recurso (no debería ocurrir en los tres locales): ruta directa en L
      const m = mejorSinRuta ?? { cx: r3(cx0), cz: r3(cz0), puertos: puertosDe(r3(cx0), r3(cz0)) };
      elegido = { ...m, rutas: gOrd.map((e, j) => limpiar([conx(e), [conx(e)[0], m.puertos[j][1]], m.puertos[j]])), fp: rectC(m.cx, m.cz, DIM_COND.ancho, DIM_COND.fondo), tmp: [], sinRuta: true }; sinRuta.push(...gOrd.map((q) => q.id));
    }
    ocupadas.push(...elegido.tmp); bloqBase.clear();
    huellas.push(elegido.fp);
    const cid = 'cd' + (gi + 1);
    const cond = { id: cid, p: [elegido.cx, Yr, elegido.cz], ancho: DIM_COND.ancho, fondo: DIM_COND.fondo, alto: DIM_COND.alto, equipos: gOrd.map((e) => e.id), metros: r3(gOrd.reduce((s, e) => s + e.ancho, 0)) };
    condensadoras.push(cond);
    add({ t: 'bancada', ph: 'bancada', k: gi, x: cond.p[0], y: Yr, z: cond.p[2], ry: 0, sx: 1, sy: 1, sz: 1, d: 0, fr: [0, 0], net: 'frio', caja: cajaC(cond.p[0], Yr + H_BANC / 2, cond.p[2], DIM_COND.ancho, H_BANC, DIM_COND.fondo), ref: cid, nivel: Yr, bw: DIM_COND.ancho, bd: DIM_COND.fondo });
    add({ t: 'cond', ph: 'equipo', k: gi, x: cond.p[0], y: Yr + H_BANC, z: cond.p[2], ry: 0, sx: 1, sy: 1, sz: 1, d: 0, fr: [0, 0], net: 'frio', caja: cajaC(cond.p[0], Yr + H_BANC + DIM_COND.alto / 2, cond.p[2], DIM_COND.ancho, DIM_COND.alto, DIM_COND.fondo), ref: cid });
    for (let f = 0; f < 2; f++) {
      const x = cond.p[0] + (f ? 1 : -1) * 0.5;
      add({ t: 'ventilador', ph: 'fan', k: gi * 2 + f, x, y: Yr + H_BANC + DIM_COND.alto - 0.04, z: cond.p[2], ry: 0, sx: 1, sy: 1, sz: 1, d: 0, fr: [0, 0], net: 'frio', caja: cajaC(x, Yr + H_BANC + DIM_COND.alto - 0.01, cond.p[2], 0.9, 0.14, 0.9), ref: cid });
    }

    gOrd.forEach((e, j) => {
      const [sx, sy, sz] = e.frio.conexion; const T = elegido.puertos[j]; const rt = elegido.rutas[j];
      // desplazamiento del par: el que no cruza la propia ruta
      let off = [OFF, OFF];
      for (const o of (e.offPref ?? [[OFF, OFF], [-OFF, OFF], [OFF, -OFF], [-OFF, -OFF]])) { if (!seCruzan(rt, rt.map((q) => [q[0] + o[0], q[1] + o[1]]))) { off = o; break; } }
      const defs = [['liquido', [0, 0], D_LIQ, 0x5d33b8], ['succion', off, D_SUC, 0x9a86d0]];
      let lenLiq = 0;
      for (const [tipo, o, dia] of defs) {
        const pl = rt.map(([x, z]) => [r3(x + o[0]), r3(z + o[1])]);
        const pts = [[r3(sx + o[0]), sy, r3(sz + o[1])], [pl[0][0], Yl, pl[0][1]]];
        for (let i = 1; i < pl.length; i++) pts.push([pl[i][0], Yl, pl[i][1]]);
        pts.push([pl[pl.length - 1][0], Yr, pl[pl.length - 1][1]]);
        // quita vértices duplicados (ruta de un solo punto)
        const lim = []; for (const p of pts) { const u = lim[lim.length - 1]; if (u && Math.hypot(u[0] - p[0], u[1] - p[1], u[2] - p[2]) < 1e-9) continue; lim.push(p); }
        for (let q = 1; q + 1 < lim.length; q++) {
          const a = lim[q - 1], b = lim[q], c = lim[q + 1];
          const col = [0, 1, 2].every((k) => { const u = Math.sign(b[k] - a[k]), v = Math.sign(c[k] - b[k]); return Math.abs(b[k] - a[k]) < 1e-9 ? Math.abs(c[k] - b[k]) < 1e-9 : u === v; });
          if (col) { lim.splice(q, 1); q--; }
        }
        lineas.push({ id: `fr_${e.id}_${tipo}`, desde: e.id, hasta: cid, tipo, diam: 0.05, puntos: lim, dVisual: dia });
        const limP = lim.map((q, i) => (i === lim.length - 1 ? [q[0], Yr + H_BANC, q[2]] : q));   // la tubería atraviesa el cuello y la bancada hasta la base de la condensadora
        const lg = piezasDeLinea(limP, dia, tipo, e.id, add, `${e.id}_${tipo}`); if (tipo === 'liquido') lenLiq = lg;
        rutas.push({ id: `rt_${e.id}_${tipo}`, puntos: lim.slice().reverse(), d0: 0, dia, tipo });
      }
      if (e.trinchera) piezasTrinchera(e, lenLiq, add);
      add({ t: 'cuello', ph: 'bancada', k: gi, x: r3(T[0] + off[0] / 2), y: Yr, z: r3(T[1] + off[1] / 2), ry: 0, sx: 1, sy: 1, sz: 1, d: 0, fr: [0, 0], net: 'frio', caja: cajaC(T[0] + off[0] / 2, Yr + 0.06, T[1] + off[1] / 2, 0.7, 0.12, 0.7), ref: cid });
      risers.push({ x: sx, z: sz, equipo: e.id });
      // soportes tipo trapecio sobre los tramos horizontales (a 2 m como máximo)
      soportesDe(rt, off, e.id, add);
    });
  }
  return { condensadoras, lineas, piezas, rutas, dMax, risers, sinRuta };
}

/**
 * Descompone una polilínea 3D (del equipo a la condensadora) en piezas ordenadas desde la condensadora.
 * @param {number[][]} pts  [x,y,z] del equipo a la condensadora
 */
function piezasDeLinea(pts, d, tipo, eqId, add, net) {
  const V = pts.slice().reverse();                 // desde la condensadora
  const n = V.length - 1; if (n < 1) return 0;
  const col = tipo === 'liquido' ? 0x5d33b8 : 0x9a86d0, colBanda = tipo === 'liquido' ? 0x2f1a6e : 0x4a3a86;
  const U = [], Ls = [];
  for (let i = 0; i < n; i++) { const dx = V[i + 1][0] - V[i][0], dy = V[i + 1][1] - V[i][1], dz = V[i + 1][2] - V[i][2]; const l = Math.abs(dx) + Math.abs(dy) + Math.abs(dz); Ls.push(l); U.push([Math.sign(dx) * (Math.abs(dx) > 1e-9), Math.sign(dy) * (Math.abs(dy) > 1e-9), Math.sign(dz) * (Math.abs(dz) > 1e-9)]); }
  const R = TL * d;
  const orient = (u) => (Math.abs(u[1]) > 0.5 ? { ry: 0, rz: Math.PI / 2 } : Math.abs(u[2]) > 0.5 ? { ry: Math.PI / 2, rz: 0 } : { ry: 0, rz: 0 });
  const lv = 2.4 * d;
  let cum = 0;
  const mk = (t, c, u, L, extra = {}) => {
    const Lreal = L;
    const o = orient(u), ax = Math.abs(u[0]) > 0.5 ? 0 : Math.abs(u[1]) > 0.5 ? 1 : 2;
    const valv = t === 'valvula'; if (valv) L = d;
    const sz = [d, d, d]; const caja = cajaC(c[0], c[1], c[2], ax === 0 ? Lreal : (extra.dia ?? d), ax === 1 ? Lreal : (extra.dia ?? d), ax === 2 ? Lreal : (extra.dia ?? d));
    return add({ t, ph: 'red', x: c[0], y: c[1], z: c[2], ry: o.ry, rz: o.rz, sx: L, sy: sz[1] * (extra.k ?? 1), sz: sz[2] * (extra.k ?? 1), d: extra.dd, fr: ax === 1 ? [0, 0] : [-u[0], -u[2]], net, caja, ...extra, eq: eqId, tipo });
  };
  for (let i = 0; i < n; i++) {
    const a = V[i], u = U[i], L = Ls[i];
    const s0 = i > 0 ? R : 0, s1 = L - (i < n - 1 ? R : 0);
    const at = (s) => [a[0] + u[0] * s, a[1] + u[1] * s, a[2] + u[2] * s];
    // cortes: válvula en el extremo de la condensadora (primer tramo) y junto al equipo (último)
    const iv = [];
    if (i === 0 && s1 - s0 >= lv + 0.08) iv.push([s0 + 0.04, s0 + 0.04 + lv]);
    if (i === n - 1 && s1 - s0 >= lv + 0.5 && n >= 1 && (i > 0 || s1 - s0 >= 2 * lv + 0.3)) iv.push([s1 - 0.3 - lv, s1 - 0.3]);
    let cur = s0;
    const tub = (g0, g1) => {
      const G = g1 - g0; if (G < 0.03) return;
      const m = Math.max(1, Math.round(G / TRAMO_MAX)), l = G / m;
      for (let q = 0; q < m; q++) {
        const p0 = g0 + q * l, c = at(p0 + l / 2);
        mk('tubo', c, u, l, { dd: cum + p0, c: col, dia: d });
        if (q > 0) { const cb = at(p0); mk('tubo', cb, u, 0.035, { dd: cum + p0, c: colBanda, k: 1.28, dia: d * 1.28, banda: true }); }
      }
    };
    for (const [v0, v1] of iv) {
      tub(cur, v0 - 0.0);
      mk('valvula', at((v0 + v1) / 2), u, lv, { dd: cum + v0, c: tipo === 'liquido' ? 0x2f1a6e : 0x3a2878, dia: d * 1.9 });
      cur = v1;
    }
    tub(cur, s1);
    // codo en el vértice siguiente (si lo hay)
    if (i < n - 1) {
      const u2 = U[i + 1], C = V[i + 1];
      const aU = u, bU = u2, cr = [aU[1] * bU[2] - aU[2] * bU[1], aU[2] * bU[0] - aU[0] * bU[2], aU[0] * bU[1] - aU[1] * bU[0]];
      const p0 = [C[0] - aU[0] * R, C[1] - aU[1] * R, C[2] - aU[2] * R], p1 = [C[0] + bU[0] * R, C[1] + bU[1] * R, C[2] + bU[2] * R];
      const mn = [0, 1, 2].map((k) => Math.min(p0[k], p1[k], C[k]) - d / 2), mx = [0, 1, 2].map((k) => Math.max(p0[k], p1[k], C[k]) + d / 2);
      add({ t: 'codoTubo', ph: 'red', x: C[0], y: C[1], z: C[2], basis: [aU, bU, cr], sx: d, sy: d, sz: d, d: cum + s1, fr: [-aU[0], -aU[2]], net, caja: { x0: mn[0], x1: mx[0], y0: mn[1], y1: mx[1], z0: mn[2], z1: mx[2] }, eq: eqId, tipo, c: col });
      // abrazadera en cada extremo del codo
    }
    cum += L;
  }
  return cum;
}

/** Trapecios (perfil + dos varillas) sobre los tramos horizontales de la ruta; el par queda entre las varillas. */
function soportesDe(rt, off, eqId, add) {
  const LL = largoPl(rt); let arc = 0;
  for (let i = 0; i + 1 < rt.length; i++) {
    const a = rt[i], b = rt[i + 1]; const horiz = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]); const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    const s0 = i > 0 ? 0.3 : 0.45, s1 = L - 0.3; const arc0 = arc; arc += L; if (s1 - s0 < 0.15) continue;
    const m = Math.max(1, Math.round((s1 - s0) / 2.0)), l = (s1 - s0) / m;
    for (let q = 0; q < m; q++) {
      const s = s0 + (q + 0.5) * l, t = s / L;
      const cx = a[0] + (b[0] - a[0]) * t + off[0] / 2, cz = a[1] + (b[1] - a[1]) * t + off[1] / 2;
      const sep = Math.abs(horiz ? off[1] : off[0]); const span = sep + 0.34;
      const yb = Y_FRIO - D_SUC / 2 - 0.03, H = Y_AZOTEA - yb;
      add({ t: 'soporte', ph: 'soporte', x: cx, y: Y_AZOTEA, z: cz, ry: horiz ? -Math.PI / 2 : 0, sx: span, sy: H, sz: 1, d: (LL - (arc0 + s)) + (Y_AZOTEA - Y_FRIO), fr: [0, 0], net: 'frio-soporte', eje: horiz ? 'x' : 'z', H, span, yb, eq: eqId, orden: s });
    }
  }
}

/**
 * Canaleta con tapa a ras de piso: del pie de la subida a cada isla. Cada tramo lleva su distancia por la red (desde la
 * condensadora, siguiendo la tubería y luego la canaleta), así que aparece después de la subida y avanza hacia la isla.
 */
function piezasTrinchera(e, base, add) {
  const ramas = e.trinchera.ramas, hechas = [];
  const largo = (pl) => pl.reduce((s, v, i) => s + (i ? Math.abs(v[0] - pl[i - 1][0]) + Math.abs(v[1] - pl[i - 1][1]) : 0), 0);
  const sobre = (pl, q) => { let acc = 0; for (let i = 0; i + 1 < pl.length; i++) { const a = pl[i], b = pl[i + 1]; if (q[0] >= Math.min(a[0], b[0]) - 1e-3 && q[0] <= Math.max(a[0], b[0]) + 1e-3 && q[1] >= Math.min(a[1], b[1]) - 1e-3 && q[1] <= Math.max(a[1], b[1]) + 1e-3) return largo(pl) - acc - Math.abs(q[0] - a[0]) - Math.abs(q[1] - a[1]); acc += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); } return null; };
  for (const r of ramas) {
    let dEnd = 0;
    if (r.empalme) { for (const h of hechas) { const rest = sobre(h.puntos, r.empalme); if (rest !== null) { dEnd = h.dEnd + rest; break; } } }
    hechas.push({ puntos: r.puntos, dEnd });
    const pl = r.puntos, L = largo(pl); let acc = 0;
    for (let i = pl.length - 1; i > 0; i--) {   // de la subida (o empalme) hacia la isla
      const a = pl[i], b = pl[i - 1]; const l = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); if (l < 0.02) continue;
      const horiz = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]); const ux = Math.sign(b[0] - a[0]), uz = Math.sign(b[1] - a[1]);
      const es = 0.12, ee = i === 1 ? 0 : 0.12, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const Lp = l + es + ee, cc = [c[0] + ux * (ee - es) / 2, c[1] + uz * (ee - es) / 2];
      add({ t: 'canaleta', ph: 'red', x: cc[0], y: 0, z: cc[1], ry: horiz ? 0 : Math.PI / 2, rz: 0, sx: Lp, sy: 1, sz: 1, d: base + dEnd + acc, fr: [-ux, -uz], net: 'frio-canal', c: 0xffffff, eq: e.id, isla: r.isla,
        caja: horiz ? { x0: cc[0] - Lp / 2, x1: cc[0] + Lp / 2, y0: 0, y1: ALTO_CANALETA, z0: cc[1] - ANCHO_CANALETA / 2, z1: cc[1] + ANCHO_CANALETA / 2 } : { x0: cc[0] - ANCHO_CANALETA / 2, x1: cc[0] + ANCHO_CANALETA / 2, y0: 0, y1: ALTO_CANALETA, z0: cc[1] - Lp / 2, z1: cc[1] + Lp / 2 } });
      acc += l;
    }
    void L;
  }
}
