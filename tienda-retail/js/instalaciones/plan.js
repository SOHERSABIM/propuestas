// PLAN DE INSTALACIONES. Lógica pura (sin three, sin azar, sin reloj), probada en node con tests/mep.test.mjs.
// Frente: instalaciones. Contrato: docs/design.md §6. Todo es CONCEPTUAL (no es ingeniería).
// Entrada: Local (poligono, columnas, altura) y Layout (pasillos, zonas[].rects, cuartos, muros, muebles con `frio`).
// Salida: PlanMEP con puntos 3D [x, y, z] en metros. Los tramos son polilíneas ortogonales (un eje por segmento).
import { dentro, tramosEnX } from '../core/geom.js';

/** Alturas fijas por capa (m sobre piso terminado). Fuente: docs/rules.json y design.md §6. */
export const ALTURAS = {
  luz: { autoservicio: 3.6, refrigerados: 3.6, ropa_hogar: 3.8, cajas: 3.4, mostrador: 3.4, acceso: 3.6, trastienda: 3.0 },
  aire: { ductoPrincipal: 3.9, ramal: 3.9, difusor: 3.75, azotea: 4.8 },
  frio: { lineas: 4.1, azotea: 4.8 },
};

/** Tipo de luminaria por zona. Cajas: panel (sobre la línea de cajas); ropa: riel con spots. */
const REGLA_LUZ = {
  autoservicio: { tipo: 'lineal', y: 3.6 }, refrigerados: { tipo: 'lineal', y: 3.6 }, acceso: { tipo: 'lineal', y: 3.6 },
  cajas: { tipo: 'panel', y: 3.4 }, mostrador: { tipo: 'lineal', y: 3.4 },
  ropa_hogar: { tipo: 'riel', y: 3.8 }, trastienda: { tipo: 'panel', y: 3.0 },
};
const DIM_LUZ = { lineal: { largo: 1.5, ancho: 0.16 }, panel: { largo: 1.2, ancho: 0.6 }, riel: { largo: 4.8, ancho: 0.08 } };

export const DIM_UNIDAD = { ancho: 2.4, fondo: 1.6, alto: 1.0 };   // unidad paquete (largo sobre el eje del ducto)
export const DIM_COND = { ancho: 2.2, fondo: 1.2, alto: 1.1 };     // condensadora remota

/**
 * @typedef {[number, number, number]} P3   punto [x, y, z] en metros
 * @typedef {{id:string, puntos:P3[], diam?:number, ancho?:number, alto?:number}} Tramo  polilínea ortogonal
 * @typedef {Object} PlanMEP
 * @property {{luminarias:{id:string, tipo:'lineal'|'riel'|'panel', p:P3, largo:number, ancho:number, rot:number, zona:string, spots:number}[], circuitos:Tramo[]}} luz
 * @property {{unidades:any[], principal:Tramo[], ramales:Tramo[], difusores:any[], retornos:any[], tr:number}} aire
 * @property {{condensadoras:any[], lineas:(Tramo & {desde:string, hasta:string, tipo:'liquido'|'succion'})[]}} frio
 * @property {{luminarias:number|null, tr:number|null, condensadoras:number|null}} indicadores
 */

// ───────────────────────────── utilidades geométricas ─────────────────────────────
const r3 = (v) => Math.round(v * 1000) / 1000;
const rectC = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
const solapa = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.z0 < b.z1 + m && b.z0 < a.z1 + m;
/** c cabe dentro de r (con tolerancia e). */
const cabe = (r, c, e = 0) => c.x0 >= r.x0 - e && c.x1 <= r.x1 + e && c.z0 >= r.z0 - e && c.z1 <= r.z1 + e;
const enRect = (r, x, z, e = 1e-6) => x >= r.x0 - e && x <= r.x1 + e && z >= r.z0 - e && z <= r.z1 + e;

/** Punto dentro del polígono con holgura m a los muros (rectilíneo). */
function ptDentro(poly, x, z, m = 0.3) {
  return dentro(poly, [x, z]) && dentro(poly, [x + m, z]) && dentro(poly, [x - m, z]) && dentro(poly, [x, z + m]) && dentro(poly, [x, z - m]);
}
/** Segmento ortogonal (en planta) dentro del polígono, muestreado cada 0.4 m. */
function segDentro(poly, a, b, m = 0.3) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 0.4));
  for (let i = 0; i <= n; i++) { const t = i / n; if (!ptDentro(poly, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, m)) return false; }
  return true;
}
/** Rectángulo (con holgura) dentro del polígono: perímetro muestreado cada 0.5 m. */
function rectEnPoligono(poly, r, m = 0.3) {
  const pts = [];
  for (let x = r.x0; x <= r.x1 + 1e-9; x += 0.5) { pts.push([x, r.z0], [x, r.z1]); }
  for (let z = r.z0; z <= r.z1 + 1e-9; z += 0.5) { pts.push([r.x0, z], [r.x1, z]); }
  pts.push([r.x1, r.z1], [r.x1, r.z0]);
  return pts.every(([x, z]) => ptDentro(poly, x, z, m));
}
/** Segmento planta [a,b] (ortogonal) toca la caja? */
function segToca(a, b, c) {
  return solapa({ x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) }, c);
}

/** Descompone el polígono rectilíneo en rectángulos (franjas horizontales fusionadas si comparten intervalo). */
export function rectsDePoligono(poly) {
  const zs = [...new Set(poly.map((p) => p[1]))].sort((a, b) => a - b);
  /** @type {{x0:number,x1:number,z0:number,z1:number}[]} */
  const rs = [];
  for (let i = 0; i + 1 < zs.length; i++) {
    const zm = (zs[i] + zs[i + 1]) / 2;
    for (const [a, b] of tramosEnX(poly, zm)) {
      const prev = rs.find((r) => Math.abs(r.x0 - a) < 1e-6 && Math.abs(r.x1 - b) < 1e-6 && Math.abs(r.z1 - zs[i]) < 1e-6);
      if (prev) prev.z1 = zs[i + 1]; else rs.push({ x0: a, x1: b, z0: zs[i], z1: zs[i + 1] });
    }
  }
  return rs;
}

// ───────────────────────────── ILUMINACIÓN ─────────────────────────────
function planLuz(local, layout, cols) {
  const zr = layout.zonas.flatMap((z) => z.rects.map((r) => ({ ...r, id: z.id })));
  const colsL = cols(0.15);
  const muros = (layout.muros || []).map((m) => {
    const h = (m.espesor || 0.15) / 2 + 0.1;
    return { x0: Math.min(m.a[0], m.b[0]) - h, x1: Math.max(m.a[0], m.b[0]) + h, z0: Math.min(m.a[1], m.b[1]) - h, z1: Math.max(m.a[1], m.b[1]) + h };
  });
  const zonaDe = (x, z) => zr.find((r) => enRect(r, x, z, 1e-6));
  /** @type {any[]} */ const lum = [];

  function poner(tipo, x, z, rot, zr1, largo) {
    const d = DIM_LUZ[tipo]; largo = largo ?? d.largo;
    const fp = rot === 0 ? rectC(x, z, largo, d.ancho) : rectC(x, z, d.ancho, largo);
    if (!cabe(zr1, fp, 0.02)) return false;
    if (colsL.some((c) => solapa(c, fp))) return false;
    if (tipo === 'panel' && muros.some((m) => solapa(m, fp))) return false;
    const sep = tipo === 'riel' ? 0.2 : 0.3;
    if (lum.some((l) => solapa(l.fp, fp, sep))) return false;
    lum.push({ tipo, x, z, rot, largo, ancho: d.ancho, zona: zr1.id, y: REGLA_LUZ[zr1.id].y, fp });
    return true;
  }

  // 1) Lineales/paneles siguiendo los ejes de los pasillos (autoservicio, refrigerados, acceso, cajas, mostrador).
  for (const pa of layout.pasillos) {
    for (let i = 0; i + 1 < pa.puntos.length; i++) {
      const [ax, az] = pa.puntos[i], [bx, bz] = pa.puntos[i + 1];
      const Ls = Math.hypot(bx - ax, bz - az); if (Ls < 1.0) continue;
      const rot = Math.abs(bx - ax) >= Math.abs(bz - az) ? 0 : 90;
      const ux = (bx - ax) / Ls, uz = (bz - az) / Ls;
      // el tipo se decide por la zona del centro del segmento; el largo por el tipo
      const z0 = zonaDe((ax + bx) / 2, (az + bz) / 2); if (!z0) continue;
      const reg = REGLA_LUZ[z0.id]; if (!reg || reg.tipo === 'riel' || z0.id === 'trastienda') continue;
      const L = DIM_LUZ[reg.tipo].largo, P = L + 0.3;
      let n = Math.floor((Ls - 0.6 + 0.3) / P); if (n < 1 && Ls >= L + 0.2) n = 1;
      for (let k = 0; k < n; k++) {
        const t = Ls / 2 + (k - (n - 1) / 2) * P;
        const x = ax + ux * t, z = az + uz * t;
        const zz = zonaDe(x, z); if (!zz || !REGLA_LUZ[zz.id] || REGLA_LUZ[zz.id].tipo === 'riel' || zz.id === 'trastienda') continue;
        poner(REGLA_LUZ[zz.id].tipo, x, z, rot, zz);
      }
    }
  }

  // 2) Rieles con spots en ropa y hogar: líneas paralelas al lado largo de cada rectángulo, cada 2.4 m.
  for (const r of zr.filter((q) => q.id === 'ropa_hogar')) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, alongX = w >= d;
    const len = alongX ? w : d, cross = alongX ? d : w;
    if (cross < 1.2 || len < 2.4) continue;
    const nl = cross >= 2.4 ? Math.floor((cross - 1.6) / 2.4) + 1 : 1;
    const lenU = len - 1.6; const np = Math.max(1, Math.ceil(lenU / 5.2)); const lp = Math.min(4.8, (lenU - (np - 1) * 0.4) / np);
    if (lp < 1.0) continue;
    for (let j = 0; j < nl; j++) {
      const c = (alongX ? (r.z0 + r.z1) : (r.x0 + r.x1)) / 2 + (j - (nl - 1) / 2) * 2.4;
      for (let k = 0; k < np; k++) {
        const a = (alongX ? r.x0 : r.z0) + 0.8 + lp / 2 + k * (lp + 0.4);
        if (alongX) poner('riel', a, c, 0, r, lp); else poner('riel', c, a, 90, r, lp);
      }
    }
  }

  // 3) Paneles de trastienda en retícula de 3 m, y al menos uno por cuarto.
  for (const r of zr.filter((q) => q.id === 'trastienda')) {
    const nx = Math.max(1, Math.floor((r.x1 - r.x0 - 2) / 3) + 1), nz = Math.max(1, Math.floor((r.z1 - r.z0 - 2) / 3) + 1);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      poner('panel', (r.x0 + r.x1) / 2 + (i - (nx - 1) / 2) * 3, (r.z0 + r.z1) / 2 + (j - (nz - 1) / 2) * 3, 0, r);
    }
  }
  for (const c of layout.cuartos || []) {
    const [x0, z0, x1, z1] = c.rect;
    if (lum.some((l) => l.tipo === 'panel' && enRect({ x0, x1, z0, z1 }, l.x, l.z))) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, zz = zonaDe(cx, cz);
    if (zz?.id === 'trastienda') poner('panel', cx, cz, 0, zz) || poner('panel', cx, cz + 0.5, 0, zz) || poner('panel', cx + 0.5, cz, 0, zz);
  }

  // 4) Relleno de lineales donde los pasillos no cubren (sin duplicar: ≥ 2 m a cualquier luminaria existente).
  for (const r of zr.filter((q) => REGLA_LUZ[q.id] && REGLA_LUZ[q.id].tipo === 'lineal')) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, alongX = w >= d;
    const len = alongX ? w : d, cross = alongX ? d : w;
    if (cross < 1.2 || len < 2) continue;
    const nl = cross >= 2.5 ? Math.floor((cross - 1.4) / 2.7) + 1 : 1;
    const P = 1.8, nk = Math.max(1, Math.floor((len - 1.6 + 0.3) / P));
    for (let j = 0; j < nl; j++) {
      const c = (alongX ? (r.z0 + r.z1) : (r.x0 + r.x1)) / 2 + (j - (nl - 1) / 2) * 2.7;
      for (let k = 0; k < nk; k++) {
        const a = (alongX ? (r.x0 + r.x1) : (r.z0 + r.z1)) / 2 + (k - (nk - 1) / 2) * P;
        const x = alongX ? a : c, z = alongX ? c : a;
        if (lum.some((l) => Math.hypot(l.x - x, l.z - z) < 2.0)) continue;
        poner('lineal', x, z, alongX ? 0 : 90, r);
      }
    }
  }

  // Orden de encendido: desde el acceso hacia el fondo.
  const [ax, az] = local.acceso.centro;
  lum.sort((a, b) => (Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az)) || (a.z - b.z) || (a.x - b.x));
  const luminarias = lum.map((l, i) => ({
    id: 'lz' + String(i + 1).padStart(3, '0'), tipo: l.tipo, p: [r3(l.x), l.y, r3(l.z)], largo: r3(l.largo), ancho: l.ancho,
    rot: l.rot, zona: l.zona, spots: l.tipo === 'riel' ? Math.max(1, Math.floor(l.largo / 1.0)) : 0,
  }));

  // Circuitos: un alimentador por hilera (misma zona, misma línea), a 4.70 m, de la primera a la última.
  const filas = new Map();
  for (const l of luminarias) {
    const k = `${l.zona}|${l.rot}|${r3(l.rot === 0 ? l.p[2] : l.p[0]).toFixed(1)}`;
    if (!filas.has(k)) filas.set(k, []); filas.get(k).push(l);
  }
  const circuitos = [];
  for (const [k, fl] of filas) {
    if (fl.length < 2) continue;
    const ord = fl.slice().sort((a, b) => (a.rot === 0 ? a.p[0] - b.p[0] : a.p[2] - b.p[2]));
    const a = ord[0], b = ord[ord.length - 1];
    // alimentador recto: la coordenada transversal es la de la primera luminaria de la hilera
    const bz = a.rot === 0 ? [b.p[0], 4.7, a.p[2]] : [a.p[0], 4.7, b.p[2]];
    circuitos.push({ id: 'cl' + String(circuitos.length + 1).padStart(2, '0'), diam: 0.03, puntos: [[a.p[0], 4.7, a.p[2]], bz], fila: k });
  }
  return { luminarias, circuitos };
}

// ───────────────────────────── AIRE ACONDICIONADO ─────────────────────────────
function planAire(local, layout, cols) {
  const poly = local.poligono;
  const colsM = local.columnas.map(([x, z]) => ({ x, z }));
  const media = local.columna / 2;
  const rects = rectsDePoligono(poly).filter((r) => Math.max(r.x1 - r.x0, r.z1 - r.z0) >= 6 && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 3.5);
  const Y = ALTURAS.aire.ductoPrincipal;
  const area = layout.indicadores?.superficie ?? rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);

  // Espinas (ducto principal): una por rectángulo, a lo largo de su lado largo, desplazada para no tocar columnas.
  const espinas = [];
  for (const r of rects) {
    const eje = r.x1 - r.x0 >= r.z1 - r.z0 ? 'x' : 'z';
    const a = (eje === 'x' ? r.x0 : r.z0) + 1.0, b = (eje === 'x' ? r.x1 : r.z1) - 1.0;
    const pMin = (eje === 'x' ? r.z0 : r.x0) + 1.2, pMax = (eje === 'x' ? r.z1 : r.x1) - 1.2;
    const centro = (pMin + pMax) / 2; let fijo = null;
    for (let k = 0; k < 80 && fijo == null; k++) {
      const f = centro + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25);
      if (f < pMin || f > pMax) continue;
      const choca = colsM.some((c) => { const per = eje === 'x' ? c.z : c.x, al = eje === 'x' ? c.x : c.z; return Math.abs(per - f) < 0.35 + media + 0.2 && al > a - 0.75 && al < b + 0.75; });
      if (!choca) fijo = f;
    }
    if (fijo == null) fijo = centro;
    espinas.push({ rect: r, eje, a, b, fijo, long: b - a });
  }
  const pt = (e, u, f = e.fijo) => (e.eje === 'x' ? [r3(u), Y, r3(f)] : [r3(f), Y, r3(u)]);

  /** @type {Tramo[]} */ const principal = [];
  espinas.forEach((e, i) => principal.push({ id: 'dp' + (i + 1), ancho: 0.7, alto: 0.4, puntos: [pt(e, e.a), pt(e, e.b)] }));
  // Enlace entre espinas consecutivas (mismo eje): tramo perpendicular por un x/z libre de columnas.
  for (let i = 0; i + 1 < espinas.length; i++) {
    const e1 = espinas[i], e2 = espinas[i + 1]; if (e1.eje !== e2.eje) continue;
    const lo = Math.max(e1.a, e2.a) + 1, hi = Math.min(e1.b, e2.b) - 1; if (hi <= lo) continue;
    const mid = (lo + hi) / 2; let u = null;
    for (let k = 0; k < 80 && u == null; k++) {
      const c = mid + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25); if (c < lo || c > hi) continue;
      const f1 = Math.min(e1.fijo, e2.fijo), f2 = Math.max(e1.fijo, e2.fijo);
      const choca = colsM.some((q) => { const al = e1.eje === 'x' ? q.x : q.z, per = e1.eje === 'x' ? q.z : q.x; return Math.abs(al - c) < 0.35 + media + 0.2 && per > f1 - 0.4 && per < f2 + 0.4; });
      if (!choca) u = c;
    }
    if (u != null) principal.push({ id: 'dp' + (principal.length + 1), ancho: 0.7, alto: 0.4, puntos: [pt(e1, u), pt(e2, u, e2.fijo)] });
  }

  // Unidades paquete en azotea sobre la espina, con bajante hasta el ducto.
  const n = Math.max(2, Math.min(5, Math.round(area / 200)));
  const Ltot = espinas.reduce((s, e) => s + e.long, 0);
  const trTotal = area / 27;                                  // 22–32 m²/TR (research); punto medio
  const trU = Math.round((trTotal / n) * 2) / 2;
  const unidades = [];
  for (let k = 0; k < n; k++) {
    let s = ((k + 0.5) * Ltot) / n, e = espinas[0];
    for (const q of espinas) { if (s <= q.long) { e = q; break; } s -= q.long; }
    const p = pt(e, e.a + s);
    const w = e.eje === 'x' ? DIM_UNIDAD.ancho : DIM_UNIDAD.fondo, d = e.eje === 'x' ? DIM_UNIDAD.fondo : DIM_UNIDAD.ancho;
    unidades.push({ id: 'ua' + (k + 1), p: [p[0], ALTURAS.aire.azotea, p[2]], tr: trU, ancho: w, fondo: d, alto: DIM_UNIDAD.alto, eje: e.eje });
    principal.push({ id: 'bj' + (k + 1), ancho: 0.6, alto: 0.6, puntos: [[p[0], ALTURAS.aire.azotea, p[2]], [p[0], Y, p[2]]], bajante: true });
  }

  // Ramales perpendiculares a cada espina, hacia ambos lados, desplazados para no chocar con columnas.
  const ramales = [], difusores = [], retornos = [];
  for (const e of espinas) {
    const nb = Math.max(1, Math.round(e.long / 6));
    const perMin = (e.eje === 'x' ? e.rect.z0 : e.rect.x0) + 0.9, perMax = (e.eje === 'x' ? e.rect.z1 : e.rect.x1) - 0.9;
    const alcance = (u, lado) => {
      const tope = lado < 0 ? e.fijo - perMin : perMax - e.fijo; let r = tope;
      for (const c of colsM) {
        const al = e.eje === 'x' ? c.x : c.z, per = e.eje === 'x' ? c.z : c.x;
        if (Math.abs(al - u) < 0.2 + media + 0.15 && (per - e.fijo) * lado > 0) r = Math.min(r, Math.abs(per - e.fijo) - media - 0.25);
      }
      return { r, tope };
    };
    for (let i = 0; i < nb; i++) {
      const u0 = e.a + ((i + 0.5) * e.long) / nb; let mejor = null;
      for (let k = 0; k < 11; k++) {
        const s = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.3, u = u0 + s; if (u < e.a + 0.6 || u > e.b - 0.6) continue;
        const L = alcance(u, -1), R = alcance(u, 1);
        const sc = Math.min(L.r, L.tope) + Math.min(R.r, R.tope) - 0.4 * Math.abs(s);
        if (!mejor || sc > mejor.sc + 1e-9) mejor = { u, L, R, sc };
      }
      if (!mejor) continue;
      for (const [lado, A] of [[-1, mejor.L], [1, mejor.R]]) {
        const len = Math.min(A.r, A.tope); if (len < 1.5) continue;
        const p0 = pt(e, mejor.u), f1 = e.fijo + lado * len;
        const p1 = e.eje === 'x' ? [p0[0], Y, r3(f1)] : [r3(f1), Y, p0[2]];
        const id = 'rm' + (ramales.length + 1);
        ramales.push({ id, ancho: 0.4, alto: 0.3, puntos: [p0, p1], largo: r3(len) });
        // Difusores: primero a 1.4 m, último a 0.7 m del extremo, espaciados 3–4.5 m.
        const L2 = len - 2.1; let gaps = 0;
        if (L2 > 0) {   // nº de claros que deja el espaciado más cercano al rango 3–4.5 m
          const fuera = (g) => { const s = L2 / g; return s < 3 ? 3 - s : s > 4.5 ? s - 4.5 : 0; };
          const g1 = Math.max(1, Math.floor(L2 / 3)), g2 = Math.max(1, Math.ceil(L2 / 4.5)); gaps = fuera(g1) <= fuera(g2) ? g1 : g2;
        }
        const ds = gaps === 0 ? [Math.max(0.8, len * 0.7)] : Array.from({ length: gaps + 1 }, (_, g) => 1.4 + (g * L2) / gaps);
        for (const d of ds) {
          const f = e.fijo + lado * d;
          difusores.push({ id: 'df' + (difusores.length + 1), p: e.eje === 'x' ? [p0[0], ALTURAS.aire.difusor, r3(f)] : [r3(f), ALTURAS.aire.difusor, p0[2]], ramal: id, d: r3(d) });
        }
      }
    }
    // Retornos: rejillas bajo la espina cada ~7.5 m (6–9 m).
    const nr = Math.max(1, Math.round(e.long / 7.5));
    for (let i = 0; i < nr; i++) {
      const u = e.a + ((i + 0.5) * e.long) / nr; const p = pt(e, u);
      retornos.push({ id: 'rt' + (retornos.length + 1), p: [p[0], 3.55, p[2]], eje: e.eje, d: r3(u - e.a), espina: principal[espinas.indexOf(e)].id });
    }
  }
  return { unidades, principal, ramales, difusores, retornos, tr: r3(trU * unidades.length), espinas };
}

// ───────────────────────────── REFRIGERACIÓN ─────────────────────────────
function planFrio(local, layout, cols, unidades) {
  const poly = local.poligono;
  const colsR = cols(0.3);                                    // columnas inflando 0.3 m (holgura del par de líneas)
  const Yl = ALTURAS.frio.lineas, Yr = ALTURAS.frio.azotea;
  const equipos = layout.muebles.filter((m) => m.frio && m.frio.conexion && (!layout.equiposFrios || layout.equiposFrios.includes(m.id)));
  if (!equipos.length) return { condensadoras: [], lineas: [] };
  const bb = poly.reduce((a, [x, z]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), z0: Math.min(a.z0, z), z1: Math.max(a.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });

  /** Ruta ortogonal en planta de S a T sin columnas ni salirse del local. */
  function ruta(S, T) {
    const cand = [];
    const add = (pts) => cand.push(limpiar(pts));
    add([S, [S[0], T[1]], T]); add([S, [T[0], S[1]], T]);
    for (let q = 0.5; q <= 60; q += 0.5) {
      for (const sg of [1, -1]) {
        const zm = S[1] + sg * q, zm2 = T[1] + sg * q, xm = S[0] + sg * q, xm2 = T[0] + sg * q;
        if (zm >= bb.z0 && zm <= bb.z1) add([S, [S[0], zm], [T[0], zm], T]);
        if (zm2 >= bb.z0 && zm2 <= bb.z1) add([S, [S[0], zm2], [T[0], zm2], T]);
        if (xm >= bb.x0 && xm <= bb.x1) add([S, [xm, S[1]], [xm, T[1]], T]);
        if (xm2 >= bb.x0 && xm2 <= bb.x1) add([S, [xm2, S[1]], [xm2, T[1]], T]);
      }
    }
    const largo = (p) => p.reduce((s, v, i) => s + (i ? Math.abs(v[0] - p[i - 1][0]) + Math.abs(v[1] - p[i - 1][1]) : 0), 0);
    cand.sort((a, b) => (largo(a) - largo(b)) || (a.length - b.length));
    for (const c of cand) {
      let ok = true;
      for (let i = 0; i + 1 < c.length && ok; i++) {
        if (colsR.some((k) => segToca(c[i], c[i + 1], k))) ok = false;
        else if (!segDentro(poly, c[i], c[i + 1], 0.3)) ok = false;
      }
      if (ok) return c;
    }
    return null;
  }
  function limpiar(pts) {
    const o = [];
    for (const p of pts) { if (o.length && Math.abs(o[o.length - 1][0] - p[0]) < 1e-9 && Math.abs(o[o.length - 1][1] - p[1]) < 1e-9) continue; o.push(p); }
    for (let i = 1; i + 1 < o.length; i++) {
      const a = o[i - 1], b = o[i], c = o[i + 1];
      if ((Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(b[0] - c[0]) < 1e-9) || (Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(b[1] - c[1]) < 1e-9)) { o.splice(i, 1); i--; }
    }
    return o;
  }

  // Grupos: ordenados sobre el eje en que se extienden y repartidos por metros de equipo (6–12 m por condensadora).
  const total = equipos.reduce((s, e) => s + e.ancho, 0);
  const ng = Math.max(1, Math.min(4, equipos.length, Math.ceil(total / 9)));
  const bx = Math.max(...equipos.map((e) => e.x)) - Math.min(...equipos.map((e) => e.x)), bz = Math.max(...equipos.map((e) => e.z)) - Math.min(...equipos.map((e) => e.z));
  const ord = equipos.slice().sort((a, b) => (bx >= bz ? (a.x - b.x) || (a.z - b.z) : (a.z - b.z) || (a.x - b.x)) || a.id.localeCompare(b.id));
  const grupos = Array.from({ length: ng }, () => []); let acc = 0;
  for (const e of ord) { const g = Math.min(ng - 1, Math.floor((acc + e.ancho / 2) / (total / ng))); grupos[g].push(e); acc += e.ancho; }
  const gruposOk = grupos.filter((g) => g.length);

  const spiral = [];
  for (let dx = -12; dx <= 12; dx += 0.5) for (let dz = -12; dz <= 12; dz += 0.5) spiral.push([dx, dz]);
  spiral.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]) || a[0] - b[0] || a[1] - b[1]);

  const condensadoras = [], lineas = []; const huellas = unidades.map((u) => rectC(u.p[0], u.p[2], u.ancho, u.fondo));
  gruposOk.forEach((g, gi) => {
    const cx0 = g.reduce((s, e) => s + e.frio.conexion[0], 0) / g.length, cz0 = g.reduce((s, e) => s + e.frio.conexion[2], 0) / g.length;
    const sep = Math.min(0.28, 1.6 / Math.max(1, g.length));
    // orden de puertos: por posición a lo largo de x del equipo (evita cruces)
    const gOrd = g.slice().sort((a, b) => a.frio.conexion[0] - b.frio.conexion[0] || a.frio.conexion[2] - b.frio.conexion[2]);
    let elegido = null, mejorSinRuta = null;
    for (const [dx, dz] of spiral) {
      const cx = r3(cx0 + dx), cz = r3(cz0 + dz); const fp = rectC(cx, cz, DIM_COND.ancho + 0.2, DIM_COND.fondo + 0.2);
      if (!rectEnPoligono(poly, fp, 0.5)) continue;
      if (huellas.some((h) => solapa(h, fp, 0.5))) continue;
      const puertos = gOrd.map((_, j) => [r3(cx + (j - (gOrd.length - 1) / 2) * sep), r3(cz)]);
      if (puertos.some((p) => colsR.some((k) => enRect(k, p[0] + 0.12, p[1] + 0.12) || enRect(k, p[0], p[1])))) continue;
      mejorSinRuta ??= { cx, cz, puertos };
      const rutas = gOrd.map((e, j) => ruta([e.frio.conexion[0], e.frio.conexion[2]], puertos[j]));
      if (rutas.every(Boolean)) { elegido = { cx, cz, puertos, rutas, fp }; break; }
    }
    if (!elegido) {   // último recurso (no ocurre en los tres locales): condensadora sobre el centroide
      const m = mejorSinRuta ?? { cx: r3(cx0), cz: r3(cz0), puertos: gOrd.map((_, j) => [r3(cx0 + (j - (gOrd.length - 1) / 2) * sep), r3(cz0)]) };
      elegido = { ...m, rutas: gOrd.map(() => null), fp: rectC(m.cx, m.cz, DIM_COND.ancho, DIM_COND.fondo) };
    }
    huellas.push(elegido.fp);
    const cid = 'cd' + (gi + 1);
    condensadoras.push({ id: cid, p: [elegido.cx, Yr, elegido.cz], ancho: DIM_COND.ancho, fondo: DIM_COND.fondo, alto: DIM_COND.alto, equipos: gOrd.map((e) => e.id), metros: r3(gOrd.reduce((s, e) => s + e.ancho, 0)) });
    gOrd.forEach((e, j) => {
      const [sx, sy, sz] = e.frio.conexion; const T = elegido.puertos[j]; const rt = elegido.rutas[j] || limpiar([[sx, sz], [sx, T[1]], T]);
      for (const [tipo, off] of [['liquido', 0], ['succion', 0.12]]) {
        const pts = [[sx + off, sy, sz + off]];
        const pl = rt.map(([x, z]) => [r3(x + off), r3(z + off)]);
        pts.push([pl[0][0], Yl, pl[0][1]]);
        for (let i = 1; i < pl.length; i++) pts.push([pl[i][0], Yl, pl[i][1]]);
        pts.push([pl[pl.length - 1][0], Yr, pl[pl.length - 1][1]]);
        lineas.push({ id: `fr_${e.id}_${tipo}`, desde: e.id, hasta: cid, tipo, diam: 0.05, puntos: pts.map((p) => [r3(p[0]), p[1], r3(p[2])]) });
      }
    });
  });
  return { condensadoras, lineas };
}

/**
 * Plan de instalaciones conceptual para un local y un layout.
 * @param {import('../datos/locales.js').Local} local
 * @param {import('../gen/generador.js').Layout} layout
 * @returns {PlanMEP}
 */
export function planInstalaciones(local, layout) {
  const cols = (m) => local.columnas.map(([x, z]) => rectC(x, z, local.columna + 2 * m, local.columna + 2 * m));
  const luz = planLuz(local, layout, cols);
  const aire = planAire(local, layout, cols);
  const frio = planFrio(local, layout, cols, aire.unidades);
  return {
    localId: local.id, layoutId: layout.id,
    luz, aire, frio,
    indicadores: { luminarias: luz.luminarias.length, tr: aire.tr, condensadoras: frio.condensadoras.length },
    extra: { difusores: aire.difusores.length, retornos: aire.retornos.length, unidadesAire: aire.unidades.length, lineasFrio: frio.lineas.length },
  };
}
