// Construcción de UN candidato de layout: zonificación + colocación. Lógica pura (sin three).
// Supone locales rectilíneos con la calle en z máximo (acceso con normal [0,1]) y el recibo en el muro del
// fondo (z mínimo), como los tres de datos/locales.js. Cada decisión se toma con el azar recibido.
import { FAMILIAS } from '../datos/catalogo.js';
import { area, caja, tramosEnX, tramosEnZ, DEG } from '../core/geom.js';
import * as R from './regiones.js';
import { FRENTE_MIN, ladosDe } from './reglas.js';

const E = 0.15;            // espesor de muro interior
const ALTO_MURO = 3.2;
const r2 = (v) => Math.round(v * 100) / 100;

/** Rectángulo alineado de la huella de un mueble (rot múltiplo de 90). */
export function aabb(m) {
  const g = ((Math.round(m.rot / 90) % 4) + 4) % 4;
  const w = g % 2 ? m.fondo : m.ancho, d = g % 2 ? m.ancho : m.fondo;
  return { x0: m.x - w / 2, z0: m.z - d / 2, x1: m.x + w / 2, z1: m.z + d / 2 };
}
/** Rectángulos de pasillo libre requeridos alrededor del mueble (según LADOS y FRENTE_MIN). */
export function holguras(m, req = FRENTE_MIN[m.familia] ?? 0.9) {
  const lados = ladosDe(m.familia), a = m.ancho / 2, f = m.fondo / 2, out = [];
  const loc = [];
  if (lados.includes('f')) loc.push([-a, f, a, f + req]);
  if (lados.includes('b')) loc.push([-a, -f - req, a, -f]);
  if (lados.includes('s')) { loc.push([a, -f, a + req, f]); loc.push([-a - req, -f, -a, f]); }
  const c = Math.round(Math.cos(m.rot * DEG)), s = Math.round(Math.sin(m.rot * DEG));
  for (const [x0, z0, x1, z1] of loc) {
    const p = [[x0, z0], [x1, z1]].map(([lx, lz]) => [m.x + lx * c + lz * s, m.z - lx * s + lz * c]);
    out.push(R.rect(p[0][0], p[0][1], p[1][0], p[1][1]));
  }
  return out;
}

/** Lienzo de colocación: valida cada mueble al ponerlo (validez por construcción). */
class Lienzo {
  constructor(todo) { this.todo = todo; this.muebles = []; this.cajas = []; this.holg = []; this.obst = []; this.col = []; this.veda = []; this.cont = {}; }
  libre(m, zonaRegion) {
    const b = aabb(m);
    if (!R.contiene(zonaRegion, b) || !R.contiene(this.todo, b)) return false;
    if (this.obst.some((o) => R.traslapa(b, o)) || this.col.some((o) => R.traslapa(b, o)) || this.veda.some((o) => R.traslapa(b, o))) return false;
    if (this.cajas.some((o) => R.traslapa(b, o)) || this.holg.some((h) => R.traslapa(b, h))) return false;
    for (const h of holguras(m)) {
      const hh = R.interseca(h, R.cajaRegion(this.todo)) && h;
      if (!hh || !R.contiene(this.todo, h)) return false;
      if (this.obst.some((o) => R.traslapa(h, o)) || this.cajas.some((o) => R.traslapa(h, o))) return false;
    }
    return true;
  }
  poner(familia, zona, zonaRegion, x, z, rot, tramos = 1, extra = {}) {
    const f = FAMILIAS[familia];
    const m = { id: '', familia, zona, x: r2(x), z: r2(z), rot: ((rot % 360) + 360) % 360, ancho: r2(f.modulo.ancho * tramos), fondo: f.modulo.fondo, alto: extra.alto ?? f.modulo.alto, variante: { tramos } };
    if (!this.libre(m, zonaRegion)) return null;
    const n = (this.cont[familia] = (this.cont[familia] || 0) + 1);
    m.id = `${familia}#${String(n).padStart(2, '0')}`;
    if (f.frio) {
      // punto de conexión de refrigeración: centro de la cara superior, del lado del fondo
      const c = Math.cos(m.rot * DEG), s = Math.sin(m.rot * DEG), lz = -m.fondo / 2 + 0.1;
      m.frio = { conexion: [r2(m.x + lz * s), m.alto, r2(m.z + lz * c)], carga: familia === 'camara_fria' ? 4 : familia === 'refrigerador_vertical' ? 3 * tramos : tramos };
    }
    this.muebles.push(m); this.cajas.push(aabb(m)); this.holg.push(...holguras(m));
    return m;
  }
  /** Fila de módulos a lo largo de x o z entre a y b: intenta baterías de maxT tramos, luego menos; avanza si choca. */
  fila(familia, zona, reg, eje, a, b, fijo, rot, maxT = 3, paso = 0.3) {
    const mod = FAMILIAS[familia].modulo.ancho, puestos = [];
    let t = a;
    while (t + mod <= b + 1e-6) {
      let ok = null;
      for (let k = Math.min(maxT, Math.floor((b - t + 1e-6) / mod)); k >= 1 && !ok; k--) {
        const c = t + (k * mod) / 2;
        ok = eje === 'x' ? this.poner(familia, zona, reg, c, fijo, rot, k) : this.poner(familia, zona, reg, fijo, c, rot, k);
        if (ok) { puestos.push(ok); t += k * mod + 0.02; }
      }
      if (!ok) t += paso;
    }
    return puestos;
  }
}

/**
 * Construye un candidato.
 * @param {import('../datos/locales.js').Local} local
 * @param {ReturnType<import('../core/azar.js').crearAzar>} az
 */
export function construirCandidato(local, az) {
  const poly = local.poligono, bb = caja(poly), todo = R.regionDePoligono(poly);
  const ax = local.acceso.centro[0], z1 = bb.z1, rec = local.recibo.centro;
  const p = {
    trasPct: az.rango(0.14, 0.2), parcial: az.r() < 0.4, ladoRopa: az.elegir(['izq', 'der']), ladoCajas: az.elegir(['izq', 'der']),
    orient: az.elegir(['z', 'x']), pasillo: az.elegir([1.35, 1.5, 1.5, 1.65, 1.8]), altoG: az.elegir([1.43, 1.43, 1.6, 1.83]),
    ropaPct: az.rango(0.17, 0.27), ladoFrio: az.elegir(['izq', 'der']), fondoTira: az.rango(4.4, 5.0), spine: az.rango(-2.5, 2.5),
    patronRopa: az.elegir(['mixto', 'hileras']), probadores: az.entero(4, 6),
  };
  const zonas = {}; const muros = []; const puertas = []; const cuartos = []; const pasillos = [];

  // ---------- Trastienda ----------
  const span = tramosEnX(poly, bb.z0 + 0.01).find(([a, b]) => rec[0] > a && rec[0] < b);
  if (!span) return { error: 'recibo' };
  let [tx0, tx1] = span; const W = tx1 - tx0;
  if (p.parcial && W > 20) {
    const w = W * az.rango(0.62, 0.78);
    if (rec[0] - tx0 > tx1 - rec[0]) tx0 = tx1 - w; else tx1 = tx0 + w;
    if (rec[0] - 3 < tx0 || rec[0] + 3 > tx1) { tx0 = span[0]; tx1 = span[1]; p.parcial = false; }
  } else p.parcial = false;
  let dt = Math.min(11, Math.max(7.3, (p.trasPct * area(poly)) / (tx1 - tx0)));
  dt = Math.round(dt * 10) / 10;
  const cubre = tramosEnX(poly, bb.z0 + dt + E + 0.05).some(([a, b]) => a <= tx0 + 1e-6 && b >= tx1 - 1e-6);
  if (!cubre) return { error: 'trastienda' };
  const T = R.rect(tx0, bb.z0, tx1, bb.z0 + dt);
  const izqAbierto = tx0 > span[0] + 1e-6, derAbierto = tx1 < span[1] - 1e-6;
  const muroF = R.rect(tx0 - (izqAbierto ? E : 0), T.z1, tx1 + (derAbierto ? E : 0), T.z1 + E);
  const murosT = [muroF];
  if (izqAbierto) murosT.push(R.rect(tx0 - E, bb.z0, tx0, T.z1 + E));
  if (derAbierto) murosT.push(R.rect(tx1, bb.z0, tx1 + E, T.z1 + E));
  const S = R.normalizar(R.restarRegiones(todo, [T, ...murosT]));
  const areaS = R.areaRegion(S);

  // ---------- Banda de fachada: acceso, cajas ----------
  const zf = z1 - 7.5;
  const F1 = R.intersecarRegion(S, R.rect(-1e3, z1 - 3, 1e3, z1));
  const F2 = R.intersecarRegion(S, R.rect(-1e3, zf, 1e3, z1 - 3));
  const centro = R.rect(ax - 2.4, zf, ax + 2.4, z1 - 3);
  let nC = Math.max(3, Math.min(6, Math.round(areaS / 165)));
  let cajasR = null, ladoC = p.ladoCajas;
  for (let n = nC; n >= 2 && !cajasR; n--) {
    for (const lado of [p.ladoCajas, p.ladoCajas === 'izq' ? 'der' : 'izq']) {
      const w = n * 2.0 + 0.6;
      const r = lado === 'izq' ? R.rect(ax - 2.4 - w, zf, ax - 2.4, z1 - 3) : R.rect(ax + 2.4, zf, ax + 2.4 + w, z1 - 3);
      if (!cajasR && R.contiene(S, r)) { cajasR = r; nC = n; ladoC = lado; }
    }
  }
  if (!cajasR) return { error: 'cajas' };
  zonas.acceso = R.normalizar([...F1, ...R.intersecarRegion(F2, centro)]);
  zonas.cajas = [cajasR];
  const F2resto = R.restarRegiones(F2, [centro, cajasR]);
  let M = R.normalizar([...R.intersecarRegion(S, R.rect(-1e3, -1e3, 1e3, zf)), ...F2resto]);

  // ---------- Ropa y hogar: franja lateral ----------
  const bS = R.cajaRegion(S);
  const xs = p.ladoRopa === 'izq' ? bS.x0 : bS.x1;
  const xm = p.ladoRopa === 'izq' ? xs + 0.5 : xs - 0.5;
  const colZ = M.filter((r) => r.x0 < xm && r.x1 > xm);
  if (!colZ.length) return { error: 'ropa' };
  const zTop = Math.max(...colZ.map((r) => r.z1)), zBot = Math.min(...colZ.map((r) => r.z0));
  const zRopa0 = zBot + p.fondoTira; // la franja del fondo queda libre para refrigerados y mostrador
  const h = zTop - zRopa0;
  if (h < 6) return { error: 'ropa' };
  const wR = Math.max(5.5, Math.min(10, 0.42 * bS.x1 - 0.42 * bS.x0, (p.ropaPct * areaS) / h));
  const ropaR = p.ladoRopa === 'izq' ? R.rect(xs, zRopa0, xs + wR, zTop) : R.rect(xs - wR, zRopa0, xs, zTop);
  zonas.ropa_hogar = R.normalizar(R.intersecarRegion(M, ropaR));
  M = R.normalizar(R.restarRegion(M, ropaR));

  // ---------- Tiras del fondo: refrigerados y mostrador ----------
  const segs = [];
  for (const r of M) {
    let iv2 = [[r.x0, r.x1]];
    for (const o of M) if (Math.abs(o.z1 - r.z0) < 1e-4) iv2 = iv2.flatMap(([a, b]) => (o.x1 <= a || o.x0 >= b ? [[a, b]] : [[a, Math.max(a, o.x0)], [Math.min(b, o.x1), b]]).filter(([u, v]) => v - u > 0.01));
    for (const [a, b] of iv2) if (b - a >= 4) segs.push({ x0: a, x1: b, z: r.z0, tras: Math.abs(r.z0 - (T.z1 + E)) < 1e-3 && a >= tx0 - E - 1e-3 && b <= tx1 + E + 1e-3 });
  }
  if (!segs.length) return { error: 'fondo', dbg: { M, T } };
  segs.sort((a, b) => (b.tras - a.tras) || (b.x1 - b.x0) - (a.x1 - a.x0));
  const s0 = segs[0], fd = p.fondoTira, puerta = 2.2;
  const L0 = s0.x1 - s0.x0;
  let refR, mosR, puertaX = null;
  const otro = segs.slice(1).find((s) => s.x1 - s.x0 >= 5.5);
  const Lm = Math.min(8, Math.max(5.5, L0 * 0.3));
  const fIzq = p.ladoFrio === 'izq';
  if (otro && az.r() < 0.6) {
    const Lr = Math.min(L0 - (s0.tras ? puerta : 0), Math.max(6, L0 * az.rango(0.6, 0.8)));
    refR = fIzq ? R.rect(s0.x0, s0.z, s0.x0 + Lr, s0.z + fd) : R.rect(s0.x1 - Lr, s0.z, s0.x1, s0.z + fd);
    if (s0.tras) puertaX = fIzq ? refR.x1 + puerta / 2 : refR.x0 - puerta / 2;
    const Lo = Math.min(otro.x1 - otro.x0, Lm);
    mosR = az.r() < 0.5 ? R.rect(otro.x0, otro.z, otro.x0 + Lo, otro.z + fd) : R.rect(otro.x1 - Lo, otro.z, otro.x1, otro.z + fd);
  } else {
    const Lr = Math.min(14, L0 - Lm - (s0.tras ? puerta : 0));
    if (Lr < 6) return { error: 'fondo', dbg: { segs, Lr, Lm } };
    refR = fIzq ? R.rect(s0.x0, s0.z, s0.x0 + Lr, s0.z + fd) : R.rect(s0.x1 - Lr, s0.z, s0.x1, s0.z + fd);
    mosR = fIzq ? R.rect(s0.x1 - Lm, s0.z, s0.x1, s0.z + fd) : R.rect(s0.x0, s0.z, s0.x0 + Lm, s0.z + fd);
    if (s0.tras) puertaX = fIzq ? refR.x1 + puerta / 2 + 0.1 : refR.x0 - puerta / 2 - 0.1;
  }
  if (puertaX == null) {
    // la trastienda necesita una puerta al piso de venta: en su muro frontal, del lado del recibo
    puertaX = Math.min(tx1 - 1.5, Math.max(tx0 + 1.5, rec[0]));
  }
  if (!R.contiene(M, refR) || !R.contiene(M, mosR) || R.interseca(refR, mosR)) return { error: 'fondo', dbg: { M, refR, mosR, segs } };
  zonas.refrigerados = [refR]; zonas.mostrador = [mosR];
  zonas.autoservicio = R.normalizar(R.restarRegiones(M, [refR, mosR]));
  zonas.trastienda = [T];

  const lz = new Lienzo(todo);
  lz.col = local.columnas.map(([x, z]) => R.rect(x - 0.25, z - 0.25, x + 0.25, z + 0.25));
  // vedas: vanos de puertas exteriores y vestíbulo
  const vano = (v, prof) => { const [cx, cz] = v.centro, [nx, nz] = v.normal; const a = v.ancho / 2 + 0.3; return nx ? R.rect(cx, cz - a, cx - nx * prof, cz + a) : R.rect(cx - a, cz, cx + a, cz - nz * prof); };
  lz.veda.push(vano(local.acceso, 3.2), vano(local.recibo, 4.5), ...local.salidas.map((s) => vano(s, 1.8)));
  const vPuerta = R.rect(puertaX - 1.2, T.z1 - 2.2, puertaX + 1.2, T.z1 + E + 2.2);
  lz.veda.push(vPuerta);

  // ---------- Cámara fría: detrás de los refrigeradores, con su frente en el muro (vano) ----------
  let camR = null;
  if (s0.tras) {
    const prohibido = [vPuerta, vano(local.recibo, 4.6), ...local.salidas.map((v) => vano(v, 2)), ...lz.col];
    for (let d = 0; d <= 8 && !camR; d += 0.5) {
      const cx = fIzq ? Math.max(refR.x0, tx0) + 1.95 + d : Math.min(refR.x1, tx1) - 1.95 - d;
      const cand = R.rect(cx - 1.8, T.z1 - 2.4, cx + 1.8, T.z1);
      if (cand.x0 >= tx0 + 0.05 && cand.x1 <= tx1 - 0.05 && cand.x0 >= refR.x0 && cand.x1 <= refR.x1 && !prohibido.some((o) => R.traslapa(R.rect(cand.x0, cand.z0, cand.x1, T.z1 + E + 1.25), o))) camR = cand;
    }
  }
  // ---------- Cuartos de servicio (oficina, sanitarios, máquinas): muro frontal o, si no caben, muro del fondo ----------
  const rd = 3.0;
  const libresEn = (ocup) => {
    let libres = [[tx0, tx1]];
    for (const [a, b] of ocup) libres = libres.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, Math.max(u, a)], [Math.min(v, b), v]]).filter(([x, y]) => y - x > 0.01));
    return libres.sort((m, n) => (n[1] - n[0]) - (m[1] - m[0]))[0];
  };
  const ocupF = [[puertaX - 1.3, puertaX + 1.3], [rec[0] - 2.0, rec[0] + 2.0]];
  if (camR) ocupF.push([camR.x0 - 0.2, camR.x1 + 0.2]);
  const ocupB = [[rec[0] - 2.0, rec[0] + 2.0], ...local.salidas.filter((v) => Math.abs(v.centro[1] - bb.z0) < 1e-3).map((v) => [v.centro[0] - 1.4, v.centro[0] + 1.4])];
  let lib = libresEn(ocupF), alFrente = true;
  if (!lib || lib[1] - lib[0] < 6.6) { lib = libresEn(ocupB); alFrente = false; }
  if (!lib || lib[1] - lib[0] < 6.6 || dt < rd + 2.8) return { error: 'cuartos' };
  let ra0, ra1;
  if (Math.abs(lib[0] - rec[0]) > Math.abs(lib[1] - rec[0])) { ra0 = lib[0]; ra1 = Math.min(lib[1], lib[0] + 10.4); } else { ra1 = lib[1]; ra0 = Math.max(lib[0], lib[1] - 10.4); }
  const cz0 = alFrente ? T.z1 - rd : T.z0, cz1 = alFrente ? T.z1 : T.z0 + rd;
  const roomsR = alFrente ? R.rect(ra0, cz0 - E, ra1, cz1) : R.rect(ra0, cz0, ra1, cz1 + E);
  if (camR) {
    zonas.refrigerados = [refR, camR];
    zonas.trastienda = R.restarRegion([T], camR);
  }
  // muros de la trastienda como obstáculos (con huecos de puerta y de cámara)
  let obstF = [muroF];
  obstF = R.restarRegion(obstF, R.rect(puertaX - 0.9, T.z1 - 1, puertaX + 0.9, T.z1 + 1));
  if (camR) obstF = R.restarRegion(obstF, R.rect(camR.x0, T.z1 - 1, camR.x1, T.z1 + 1));
  lz.obst.push(...obstF, ...murosT.slice(1), roomsR);
  const mF = { id: 'mt1', a: [r2(muroF.x0), r2(T.z1 + E / 2)], b: [r2(muroF.x1), r2(T.z1 + E / 2)], espesor: E, altura: ALTO_MURO, tipo: 'interior' };
  muros.push(mF);
  puertas.push({ id: 'pt1', muro: 'mt1', centro: r2(puertaX - muroF.x0), ancho: 1.8, alto: 2.4, tipo: 'abatible' });
  if (camR) puertas.push({ id: 'pt-cam', muro: 'mt1', centro: r2((camR.x0 + camR.x1) / 2 - muroF.x0), ancho: r2(camR.x1 - camR.x0), alto: 2.7, tipo: 'vano' });
  murosT.slice(1).forEach((w, i) => muros.push({ id: `mt${i + 2}`, a: [r2((w.x0 + w.x1) / 2), r2(w.z0)], b: [r2((w.x0 + w.x1) / 2), r2(w.z1)], espesor: E, altura: ALTO_MURO, tipo: 'interior' }));
  const lejos0 = Math.abs(ra0 - rec[0]) > Math.abs(ra1 - rec[0]);
  const nombres = [['oficina', 'Oficina'], ['sanitarios', 'Sanitarios'], ['maquinas', 'Cuarto de máquinas']];
  const anchoC = (ra1 - ra0) / 3;
  const orden = lejos0 ? nombres.slice().reverse() : nombres;
  orden.forEach(([id, nombre], i) => cuartos.push({ id, nombre, rect: [r2(ra0 + i * anchoC), r2(cz0), r2(ra0 + (i + 1) * anchoC), r2(cz1)] }));
  const zcm = alFrente ? cz0 - E / 2 : cz1 + E / 2;
  muros.push({ id: 'mc1', a: [r2(ra0), r2(zcm)], b: [r2(ra1), r2(zcm)], espesor: E, altura: ALTO_MURO, tipo: 'interior' });
  for (let i = 0; i < 3; i++) puertas.push({ id: `pc${i + 1}`, muro: 'mc1', centro: r2(anchoC * (i + 0.5)), ancho: 0.9, alto: 2.1, tipo: 'abatible' });
  const divs = [ra0 + anchoC, ra0 + 2 * anchoC, ...(ra0 > tx0 + 0.01 ? [ra0] : []), ...(ra1 < tx1 - 0.01 ? [ra1] : [])];
  divs.forEach((x, i) => muros.push({ id: `md${i + 1}`, a: [r2(x), r2(alFrente ? cz0 - E : cz0)], b: [r2(x), r2(alFrente ? cz1 : cz1 + E)], espesor: E, altura: ALTO_MURO, tipo: 'interior' }));

  // ---------- Refrigerados ----------
  if (camR) lz.poner('camara_fria', 'refrigerados', zonas.refrigerados, (camR.x0 + camR.x1) / 2, camR.z1 - 1.2, 0);
  else {
    // sin vano posible: la cámara va dentro de la tira, contra el muro, en el primer hueco libre
    for (let d = 0, ok = null; d <= refR.x1 - refR.x0 - 3.9 && !ok; d += 0.5) {
      ok = lz.poner('camara_fria', 'refrigerados', zonas.refrigerados, fIzq ? refR.x0 + 1.95 + d : refR.x1 - 1.95 - d, refR.z0 + 1.25, 0);
    }
  }
  const zr = refR.z0 + 0.05 + 0.35;
  lz.fila('refrigerador_vertical', 'refrigerados', zonas.refrigerados, 'x', refR.x0 + 0.1, refR.x1 - 0.1, zr, 0, 2);
  const zi = refR.z0 + 0.75 + 1.6 + 0.45;
  for (let x = refR.x0 + 1.3; x + 1.3 < refR.x1; x += 1.88 + 1.0) lz.poner('congelador_isla', 'refrigerados', zonas.refrigerados, x + 0.94, zi, 0);

  // ---------- Mostrador de servicio ----------
  lz.fila('estanteria_alta_densidad', 'mostrador', zonas.mostrador, 'x', mosR.x0 + 0.2, mosR.x1 - 0.2, mosR.z0 + 0.05 + 0.3, 0, 3);
  const tm = mosR.x1 - mosR.x0 >= 7.4 ? 2 : 1, Lmos = tm * 3.0;
  const mx = (mosR.x0 + mosR.x1) / 2 + (az.r() < 0.5 ? -0.7 : 0.7);
  lz.poner('mostrador_servicio', 'mostrador', zonas.mostrador, mx, mosR.z0 + 2.25, 0, tm);
  const ladoV = mx < (mosR.x0 + mosR.x1) / 2 ? 1 : -1;
  lz.poner('vitrina_cristal', 'mostrador', zonas.mostrador, mx + ladoV * (Lmos / 2 + 0.65), mosR.z0 + 2.2, 0);
  lz.poner('caja_mostrador', 'mostrador', zonas.mostrador, mx - ladoV * (Lmos / 2 + 0.65), mosR.z0 + 2.25, 0);

  // ---------- Cajas, carritos y aparadores ----------
  const zc = zf + 1.6;
  for (let i = 0; i < nC; i++) {
    const x = ladoC === 'izq' ? cajasR.x1 - 0.7 - i * 2.0 : cajasR.x0 + 0.7 + i * 2.0;
    lz.poner('mueble_caja', 'cajas', zonas.cajas, x, zc, ladoC === 'izq' ? 270 : 90);
  }
  const sgn = ladoC === 'izq' ? -1 : 1;
  for (let i = 0; i < 4; i++) lz.poner('carrito', 'acceso', zonas.acceso, ax + sgn * (local.acceso.ancho / 2 + 0.95 + i * 0.75), z1 - 3 + 0.55, 0);
  lz.poner('canastilla', 'acceso', zonas.acceso, ax + sgn * (local.acceso.ancho / 2 + 0.95 + 4 * 0.75), z1 - 3 + 0.3, 0);
  for (const [a, b] of tramosEnX(poly, z1 - 0.01)) {
    for (let x = a + 0.25; x + 2 <= b - 0.2;) {
      if (x + 2 > ax - local.acceso.ancho / 2 - 4.2 && x < ax + local.acceso.ancho / 2 + 4.2) { x = ax + local.acceso.ancho / 2 + 4.2; continue; }
      if (lz.poner('tarima_aparador', 'acceso', zonas.acceso, x + 1, z1 - 0.62, 180)) x += 2.1; else x += 0.3;
    }
  }

  // isla promocional al centro de la descompresión (fuera de los primeros 3 m)
  lz.poner('exhibidor_isla_promo', 'acceso', zonas.acceso, ax + (az.r() < 0.5 ? -1 : 1) * 0.4, zf + 2.0, 0);

  // ---------- Ropa y hogar ----------
  for (const r of zonas.ropa_hogar) {
    // probadores contra el muro del fondo de la franja
    const zP = r.z0 + 0.05;
    const nP = p.probadores;
    const x = p.ladoRopa === 'izq' ? r.x0 + 0.4 : r.x1 - 0.4 - nP * 1.02 - 1.72;
    lz.poner('probador_accesible', 'ropa_hogar', zonas.ropa_hogar, x + 0.85, zP + 0.85, 0);
    for (let i = 0; i < nP; i++) lz.poner('probador', 'ropa_hogar', zonas.ropa_hogar, x + 1.72 + 0.5 + i * 1.02, zP + 0.6, 0);
    const g0 = R.rect(r.x0 + 1.0, r.z0 + 1.7 + 1.6, r.x1 - 1.0, r.z1 - 1.0);
    const paso = 1.95;
    const nx = Math.max(1, Math.floor((g0.x1 - g0.x0) / paso)), nz = Math.max(1, Math.floor((g0.z1 - g0.z0) / paso));
    const ox = (g0.x1 - g0.x0 - (nx - 1) * paso) / 2, oz = (g0.z1 - g0.z0 - (nz - 1) * paso) / 2;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const cx = g0.x0 + ox + i * paso, cz = g0.z0 + oz + j * paso;
      const frente = j === nz - 1;
      let fam;
      if (frente) fam = (i % 2 === 0) ? 'mesa_exhibicion' : 'maniqui';
      else if (p.patronRopa === 'hileras') fam = j % 2 ? 'rack_recto_doble' : az.elegir(['rack_redondo', 'rack_cuatro_brazos']);
      else fam = az.elegirPeso(['rack_redondo', 'rack_cuatro_brazos', 'rack_recto_doble', 'mesa_exhibicion'], (f) => ({ rack_redondo: 4, rack_cuatro_brazos: 3, rack_recto_doble: 3, mesa_exhibicion: 1 })[f]);
      const rot = fam === 'rack_recto_doble' ? 90 : fam === 'maniqui' ? 0 : 0;
      lz.poner(fam, 'ropa_hogar', zonas.ropa_hogar, cx, cz, rot);
    }
  }

  // ---------- Autoservicio: mural perimetral y góndolas ----------
  const esCristal = (eje, v, a, b) => local.fachadas.some((f) => eje === 'x' ? Math.abs(f.a[0] - v) < 1e-3 && Math.abs(f.b[0] - v) < 1e-3 && Math.min(f.a[1], f.b[1]) < b && Math.max(f.a[1], f.b[1]) > a : false);
  const bAut = R.cajaRegion(zonas.autoservicio);
  let spineX = Math.max(bS.x0 + 4, Math.min(bS.x1 - 4, ax + p.spine));
  let spine = R.rect(spineX - 1.0, -1e3, spineX + 1.0, zf);
  if (p.orient === 'x' && bAut.x1 - bAut.x0 < 14) {
    // zona angosta con corridas transversales: el pasillo principal corre por el borde de la zona, no la corta
    spineX = p.ladoRopa === 'izq' ? bAut.x0 + 1.0 : bAut.x1 - 1.0; spine = R.rect(-1e4, -1e4, -1e4 + 1, -1e4 + 1);
  }
  const runs = [];
  const zonaA = zonas.autoservicio;
  const piezasA = (p.orient === 'z' ? R.normalizarV(zonaA) : R.normalizar(zonaA)).filter((q) => R.areaR(q) > 10);
  for (const r0 of piezasA) {
    const r = { ...r0 };
    // mural en muros exteriores laterales (no en cristal)
    for (const lado of ['x0', 'x1']) {
      const xv = r[lado];
      const exterior = Math.abs(xv - bS.x0) < 1e-3 || Math.abs(xv - bS.x1) < 1e-3 || !tramosEnX(poly, (r.z0 + r.z1) / 2).some(([a, b]) => (lado === 'x0' ? a < xv - 0.3 : b > xv + 0.3) && a < xv + 1e-3 && b > xv - 1e-3);
      if (!exterior || esCristal('x', xv, r.z0, r.z1) || r.z1 - r.z0 < 4) continue;
      const xm2 = lado === 'x0' ? xv + 0.05 + 0.225 : xv - 0.05 - 0.225;
      const puestos = lz.fila('estanteria_mural', 'autoservicio', zonaA, 'z', r.z0 + 0.3, r.z1 - 0.3, xm2, lado === 'x0' ? 90 : 270, 3);
      if (puestos.length) r[lado] = lado === 'x0' ? xv + 0.5 + p.pasillo : xv - 0.5 - p.pasillo;
      if (puestos.length) pasillos.push({ id: '', tipo: 'secundario', ancho: p.pasillo, puntos: [[r2(lado === 'x0' ? xv + 0.5 + p.pasillo / 2 : xv - 0.5 - p.pasillo / 2), r2(r0.z0 + 0.5)], [r2(lado === 'x0' ? xv + 0.5 + p.pasillo / 2 : xv - 0.5 - p.pasillo / 2), r2(r0.z1 - 0.5)]] });
    }
  }
  runs.push(...campoGondolas(lz, zonaA, p, spine));
  // pasillos entre góndolas (centro entre corridas vecinas)
  const porEje = runs.slice().sort((a, b) => a.c - b.c);
  for (let i = 0; i + 1 < porEje.length; i++) {
    const a = porEje[i], b = porEje[i + 1];
    const solape = [Math.max(a.a, b.a), Math.min(a.b, b.b)];
    const gap = b.c - a.c - 0.9;
    if (a.eje !== b.eje || gap > 2.2 || gap < 1 || solape[1] - solape[0] < 1.5) continue;
    const m = (a.c + b.c) / 2;
    pasillos.push({ id: '', tipo: 'entre_gondolas', ancho: r2(gap), puntos: a.eje === 'z' ? [[r2(m), r2(solape[0])], [r2(m), r2(solape[1])]] : [[r2(solape[0]), r2(m)], [r2(solape[1]), r2(m)]] });
  }

  // ---------- Bodega: racks selectivos en hileras ----------
  const regT = zonas.trastienda;
  const filasZ = [[T.z0 + 0.05 + 0.55, 0], [T.z0 + 1.15 + 2.7 + 0.55, 180], [T.z0 + 1.15 + 2.7 + 1.1 + 0.55, 0],
    [roomsR.z1 + 0.05 + 0.55, 0], [T.z1 - 0.05 - 0.55, 180]];
  for (const [zz, rot] of filasZ) lz.fila('rack_selectivo', 'trastienda', regT, 'x', tx0 + 0.25, tx1 - 0.25, zz, rot, 1, 0.25);

  // ---------- Pasillos principales ----------
  const zFondo = refR.z1;
  pasillos.push({ id: '', tipo: 'principal', ancho: 2.0, puntos: [[r2(spineX), r2(z1 - 1.0)], [r2(spineX), r2(zFondo + 0.5)]] });
  const bA = R.cajaRegion(zonaA.length ? zonaA : M);
  pasillos.push({ id: '', tipo: 'principal', ancho: 1.8, puntos: [[r2(bA.x0 + 0.6), r2(zf - 0.95)], [r2(bA.x1 - 0.6), r2(zf - 0.95)]] });
  pasillos.push({ id: '', tipo: 'secundario', ancho: 1.6, puntos: [[r2(refR.x0 + 0.5), r2(refR.z0 + 1.55)], [r2(refR.x1 - 0.5), r2(refR.z0 + 1.55)]] });
  pasillos.push({ id: '', tipo: 'servicio', ancho: 1.2, puntos: [[r2(mosR.x0 + 0.5), r2(mosR.z0 + 1.25)], [r2(mosR.x1 - 0.5), r2(mosR.z0 + 1.25)]] });
  for (const r of zonas.ropa_hogar) pasillos.push({ id: '', tipo: 'ropa', ancho: 1.2, puntos: [[r2((r.x0 + r.x1) / 2), r2(r.z0 + 3.4)], [r2((r.x0 + r.x1) / 2), r2(r.z1 - 0.6)]] });
  pasillos.push({ id: '', tipo: 'bodega', ancho: 2.7, puntos: [[r2(tx0 + 0.6), r2(T.z0 + 1.15 + 1.35)], [r2(tx1 - 0.6), r2(T.z0 + 1.15 + 1.35)]] });
  for (let i = 0; i < nC; i++) {
    const x = ladoC === 'izq' ? cajasR.x1 - 0.7 - i * 2.0 + 1.0 * (ladoC === 'izq' ? 1 : -1) * -1 : cajasR.x0 + 0.7 + i * 2.0 + 1.0;
    pasillos.push({ id: '', tipo: 'caja', ancho: 1.2, puntos: [[r2(x), r2(zf + 0.3)], [r2(x), r2(z1 - 3.2)]] });
  }
  pasillos.forEach((q, i) => (q.id = `pa${i + 1}`));

  const OBLIG = ['gondola_central', 'cabecera_gondola', 'refrigerador_vertical', 'camara_fria', 'mueble_caja', 'mostrador_servicio', 'rack_selectivo', 'probador'];
  const falta = OBLIG.find((f) => !lz.muebles.some((m) => m.familia === f));
  if (falta && !globalThis.__genDepurar) return { error: `falta:${falta}` };
  const zonasOut = Object.entries(zonas).map(([id, rects]) => {
    const rs = rects.map((r) => ({ x0: r2(r.x0), z0: r2(r.z0), x1: r2(r.x1), z1: r2(r.z1) }));
    return { id, rects: rs, poligono: R.contorno(rs), area: r2(R.areaRegion(rs)) };
  });
  return {
    firma: { orient: p.orient, ladoRopa: p.ladoRopa, ladoCajas: ladoC, parcial: p.parcial, ladoFrio: p.ladoFrio, dt },
    params: p, zonas: zonasOut, muros, puertas, cuartos, muebles: lz.muebles, pasillos,
    meta: { T, S, zf, spineX, refR, mosR, cajasR, puertaX, camR, nC },
  };
}

/**
 * Campo de góndolas sobre toda la zona de autoservicio: líneas paralelas a paso (0.9 + pasillo); en cada línea se
 * buscan los intervalos libres (dentro de la zona con margen, sin columnas ni pasillo central) y se llenan con
 * baterías de hasta 3 tramos y cabeceras. Se prueban 4 desfases y se queda el que más tramos acomoda.
 */
function campoGondolas(lz, zonaA, p, spine) {
  const eje = p.orient, pitch = 0.9 + p.pasillo, bA = R.cajaRegion(zonaA);
  const c0 = eje === 'z' ? bA.x0 : bA.z0, c1 = eje === 'z' ? bA.x1 : bA.z1, t0 = eje === 'z' ? bA.z0 : bA.x0, t1 = eje === 'z' ? bA.z1 : bA.x1;
  const ML = 0.95, ME = 1.0 + 0.6, paso = 0.2;
  const celda = (c, t) => (eje === 'z' ? R.rect(c - 0.45 - ML, t, c + 0.45 + ML, t + paso) : R.rect(t, c - 0.45 - ML, t + paso, c + 0.45 + ML));
  const nucleo = (c, t) => (eje === 'z' ? R.rect(c - 0.5, t - 0.05, c + 0.5, t + paso + 0.05) : R.rect(t - 0.05, c - 0.5, t + paso + 0.05, c + 0.5));
  const intervalos = (c) => {
    const out = []; let ini = null;
    for (let t = t0; t <= t1; t += paso) {
      const ok = t + paso <= t1 && R.contiene(zonaA, celda(c, t)) && !R.traslapa(nucleo(c, t), spine) && !lz.col.some((o) => R.traslapa(nucleo(c, t), o)) && !lz.cajas.some((o) => R.traslapa(nucleo(c, t), o));
      if (ok && ini == null) ini = t; if (!ok && ini != null) { out.push([ini, t]); ini = null; }
    }
    if (ini != null) out.push([ini, t1]);
    return out.map(([a, b]) => [a + ME, b - ME]).filter(([a, b]) => b - a >= 1.2 + 2 * 1.22);
  };
  const tramos = (L) => Math.min(12, Math.floor((L - 1.2 + 1e-6) / 1.22));
  const plan = (off) => { const lineas = []; for (let c = c0 + off; c <= c1; c += pitch) lineas.push([c, intervalos(c)]); return lineas; };
  let mejor = null, mejorN = -1;
  for (const off of [0, 0.25, 0.5, 0.75].map((f) => f * pitch)) {
    const pl = plan(off); const n = pl.reduce((s, [, iv]) => s + iv.reduce((u, [a, b]) => u + tramos(b - a), 0), 0);
    if (n > mejorN) { mejorN = n; mejor = pl; }
  }
  const runs = [];
  for (const [c, ivs] of mejor) for (const [a, b] of ivs) {
    const partes = b - a > 16 ? 2 : 1, Lp = (b - a - (partes - 1) * 1.8) / partes;
    for (let pt = 0; pt < partes; pt++) {
      const nT = tramos(Lp); if (nT < 2) continue;
      const L = nT * 1.22 + 1.2, base = a + pt * (Lp + 1.8) + (Lp - L) / 2, ini = base + 0.6;
      const lotes = []; let resta = nT; while (resta > 0) { const t = resta === 4 ? 2 : Math.min(3, resta); lotes.push(t); resta -= t; }
      let t = ini, puestos = 0;
      for (const n of lotes) {
        const cc = t + (n * 1.22) / 2;
        const m = eje === 'z' ? lz.poner('gondola_central', 'autoservicio', zonaA, c, cc, 90, n, { alto: p.altoG }) : lz.poner('gondola_central', 'autoservicio', zonaA, cc, c, 0, n, { alto: p.altoG });
        if (m) puestos++; t += n * 1.22;
      }
      if (!puestos) continue;
      if (eje === 'z') { lz.poner('cabecera_gondola', 'autoservicio', zonaA, c, ini - 0.305, 180, 1, { alto: p.altoG }); lz.poner('cabecera_gondola', 'autoservicio', zonaA, c, t + 0.305, 0, 1, { alto: p.altoG }); }
      else { lz.poner('cabecera_gondola', 'autoservicio', zonaA, ini - 0.305, c, 270, 1, { alto: p.altoG }); lz.poner('cabecera_gondola', 'autoservicio', zonaA, t + 0.305, c, 90, 1, { alto: p.altoG }); }
      runs.push({ eje, c, a: ini, b: t });
    }
  }
  return runs;
}
