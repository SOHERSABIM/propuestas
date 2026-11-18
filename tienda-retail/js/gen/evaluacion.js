// Validación independiente y calificación de un layout. Lógica pura.
// La validación NO confía en el constructor: vuelve a medir todo (traslapes, zonas, pasillos, salidas).
import * as R from './regiones.js';
import { aabb, holguras } from './candidato.js';
import { mlDe } from './reglas.js';
import { area, caja } from '../core/geom.js';

const BAJOS = new Set(['tarima_aparador', 'carrito', 'canastilla', 'mesa_exhibicion', 'congelador_isla', 'mueble_caja']);

/** Rectángulos de muros interiores, con los huecos de puerta (abatible) abiertos. */
export function rectsMuros(layout, conHuecos = true) {
  const out = [];
  for (const m of layout.muros) {
    const dx = m.b[0] - m.a[0], dz = m.b[1] - m.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, e = m.espesor / 2;
    let tramos = [[0, L]];
    if (conHuecos) for (const p of layout.puertas.filter((q) => q.muro === m.id)) {
      const a = p.centro - p.ancho / 2, b = p.centro + p.ancho / 2;
      tramos = tramos.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, Math.max(u, a)], [Math.min(v, b), v]]).filter(([x, y]) => y - x > 0.01));
    }
    for (const [u, v] of tramos) {
      const p0 = [m.a[0] + ux * u, m.a[1] + uz * u], p1 = [m.a[0] + ux * v, m.a[1] + uz * v];
      out.push(R.rect(Math.min(p0[0], p1[0]) - Math.abs(uz) * e, Math.min(p0[1], p1[1]) - Math.abs(ux) * e, Math.max(p0[0], p1[0]) + Math.abs(uz) * e, Math.max(p0[1], p1[1]) + Math.abs(ux) * e));
    }
  }
  return out;
}

/**
 * Valida un layout contra el local.
 * @returns {{ok:boolean, errores:string[], conteo:{traslapes:number, fueraDeZona:number, pasilloBajoMinimo:number, salidaBloqueada:number, descompresion:number}}}
 */
export function validar(local, layout) {
  const todo = R.regionDePoligono(local.poligono);
  const conteo = { traslapes: 0, fueraDeZona: 0, pasilloBajoMinimo: 0, salidaBloqueada: 0, descompresion: 0 };
  const errores = [];
  const err = (k, msg) => { conteo[k]++; if (errores.length < 12) errores.push(msg); };
  const cajas = layout.muebles.map(aabb);
  const muros = rectsMuros(layout, true);
  const cuartos = (layout.cuartos || []).map((c) => R.rect(...c.rect));
  const cols = local.columnas.map(([x, z]) => R.rect(x - local.columna / 2, z - local.columna / 2, x + local.columna / 2, z + local.columna / 2));
  const zonas = Object.fromEntries(layout.zonas.map((z) => [z.id, z.rects]));
  layout.muebles.forEach((m, i) => {
    const b = cajas[i];
    for (let j = i + 1; j < cajas.length; j++) if (R.traslapa(b, cajas[j])) err('traslapes', `traslape ${m.id} / ${layout.muebles[j].id}`);
    if (cols.some((c) => R.traslapa(b, c)) || muros.some((w) => R.traslapa(b, w)) || cuartos.some((c) => R.traslapa(b, c))) err('traslapes', `${m.id} contra estructura o muro`);
    if (!R.contiene(todo, b)) err('fueraDeZona', `${m.id} fuera del local`);
    else if (!zonas[m.zona] || !R.contiene(zonas[m.zona], b)) err('fueraDeZona', `${m.id} fuera de su zona (${m.zona})`);
    for (const h of holguras(m)) {
      if (!R.contiene(todo, h) || cajas.some((o, j) => j !== i && R.traslapa(h, o)) || muros.some((w) => R.traslapa(h, w))) { err('pasilloBajoMinimo', `${m.id}: pasillo bajo mínimo`); break; }
    }
  });
  // descompresión: nada alto en los primeros 3 m del acceso
  const [ax, az] = local.acceso.centro, aw = local.acceso.ancho / 2 + 1.0;
  const vest = R.rect(ax - aw, az - 3, ax + aw, az);
  layout.muebles.forEach((m, i) => { if (R.traslapa(cajas[i], vest) && !BAJOS.has(m.familia) && m.alto > 1.2) err('descompresion', `${m.id} alto en la descompresión`); });

  // recorridos accesibles (≥ 0.9 m) del acceso a cada salida, al recibo y a cada zona de venta
  const g = rejilla(local, todo, [...cajas, ...muros, ...cuartos, ...cols]);
  const dentro = (v, d = 0.6) => [v.centro[0] - v.normal[0] * d, v.centro[1] - v.normal[1] * d];
  const alcanzados = g.bfs(dentro(local.acceso));
  const destinos = [['recibo', dentro(local.recibo)], ...local.salidas.map((s, i) => [`salida ${i + 1}`, dentro(s)])];
  for (const [nom, p] of destinos) if (!g.alcanza(alcanzados, p)) err('salidaBloqueada', `${nom} sin recorrido libre desde el acceso`);
  return { ok: errores.length === 0 && Object.values(conteo).every((v) => v === 0), errores, conteo };
}

/** Rejilla de 0.15 m con obstáculos inflados 0.42 m: una celda libre admite el paso de un ancho ≈ 0.9 m. */
function rejilla(local, todo, obst) {
  const bb = caja(local.poligono), c = 0.15, inf = 0.42;
  const nx = Math.ceil(bb.ancho / c), nz = Math.ceil(bb.fondo / c);
  const bloq = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = bb.x0 + (i + 0.5) * c, z = bb.z0 + (j + 0.5) * c;
    if (!todo.some((r) => x > r.x0 + inf && x < r.x1 - inf && z > r.z0 + inf && z < r.z1 - inf) && !todo.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && bordeAbierto(todo, r, x, z, inf))) bloq[j * nx + i] = 1;
  }
  for (const o of obst) {
    const i0 = Math.max(0, Math.floor((o.x0 - inf - bb.x0) / c)), i1 = Math.min(nx - 1, Math.floor((o.x1 + inf - bb.x0) / c));
    const j0 = Math.max(0, Math.floor((o.z0 - inf - bb.z0) / c)), j1 = Math.min(nz - 1, Math.floor((o.z1 + inf - bb.z0) / c));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) bloq[j * nx + i] = 1;
  }
  const idx = ([x, z]) => { const i = Math.floor((x - bb.x0) / c), j = Math.floor((z - bb.z0) / c); return i >= 0 && j >= 0 && i < nx && j < nz ? j * nx + i : -1; };
  return {
    bfs(p) {
      const vis = new Uint8Array(nx * nz); const q = new Int32Array(nx * nz); let h = 0, t = 0;
      // la celda de arranque puede estar pegada al muro: se busca la libre más cercana
      const s = cercana(p); if (s < 0) return vis;
      vis[s] = 1; q[t++] = s;
      while (h < t) { const k = q[h++], i = k % nx, j = (k - i) / nx;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const n = b * nx + a; if (!vis[n] && !bloq[n]) { vis[n] = 1; q[t++] = n; } } }
      return vis;
    },
    alcanza(vis, p) { const k = cercana(p, vis); return k >= 0 && vis[k] === 1; },
  };
  function cercana(p, vis = null) {
    const k0 = idx(p); if (k0 < 0) return -1;
    const i0 = k0 % nx, j0 = (k0 - i0) / nx;
    for (let r = 0; r <= 5; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
      const k = j * nx + i; if (vis ? vis[k] : !bloq[k]) return k;
    }
    return -1;
  }
}
/** Una celda cerca de la frontera entre dos rectángulos de la misma región no es pared. */
function bordeAbierto(todo, r, x, z, inf) {
  for (const [dx, dz] of [[inf, 0], [-inf, 0], [0, inf], [0, -inf], [inf, inf], [-inf, inf], [inf, -inf], [-inf, -inf]]) {
    const px = x + dx, pz = z + dz;
    if (!todo.some((q) => px >= q.x0 && px <= q.x1 && pz >= q.z0 && pz <= q.z1)) return false;
  }
  void r; return true;
}

/** Indicadores conceptuales calculados del layout (todo lo que se muestra sale de aquí). */
export function indicadores(local, layout) {
  const sup = area(local.poligono);
  const tras = layout.zonas.filter((z) => z.id === 'trastienda').reduce((s, z) => s + z.area, 0);
  const cam = layout.muebles.filter((m) => m.familia === 'camara_fria').reduce((s, m) => s + m.ancho * m.fondo, 0);
  const venta = sup - tras - cam - layout.muros.reduce((s, m) => s + Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) * m.espesor, 0) * 0.5;
  const n = (f) => layout.muebles.filter((m) => m.familia === f);
  const tr = (f) => n(f).reduce((s, m) => s + (m.variante?.tramos || 1), 0);
  return {
    superficie: Math.round(sup), pisoVenta: Math.round(venta), pisoVentaPct: Math.round((venta / sup) * 100),
    mlExhibicion: Math.round(layout.muebles.reduce((s, m) => s + mlDe(m), 0)),
    gondolas: tr('gondola_central'), puertasFrio: tr('refrigerador_vertical') * 3 + n('camara_fria').length * 4,
    cajas: n('mueble_caja').length + n('caja_mostrador').length,
    racksRopa: n('rack_redondo').length + n('rack_cuatro_brazos').length + n('rack_recto_doble').length,
    probadores: n('probador').length + n('probador_accesible').length,
    posicionesTarima: n('rack_selectivo').length * 6, luminarias: null,
  };
}

/** Calificación con criterios visibles. Pesos suman 1; puntos = peso × 100 × cumplimiento. */
export function calificar(local, layout, ind) {
  const [ax, az] = local.acceso.centro, bb = caja(local.poligono), diag = Math.hypot(bb.ancho, bb.fondo);
  const cen = (id) => { const z = layout.zonas.find((q) => q.id === id); if (!z) return null; let s = 0, cx = 0, cz = 0; for (const r of z.rects) { const a = R.areaR(r); s += a; cx += a * (r.x0 + r.x1) / 2; cz += a * (r.z0 + r.z1) / 2; } return [cx / s, cz / s]; };
  const dist = (p) => (p ? Math.hypot(p[0] - ax, p[1] - az) : 0);
  const cl = (v) => Math.max(0, Math.min(1, v));
  const ent = layout.pasillos.filter((p) => p.tipo === 'entre_gondolas');
  const anchoMedio = ent.length ? ent.reduce((s, p) => s + p.ancho, 0) / ent.length : 1.5;
  const destino = (dist(cen('refrigerados')) + dist(cen('mostrador'))) / 2 / (diag * 0.75);
  const dCajas = dist(cen('cajas'));
  const c = [
    ['ml', 'Metros lineales de exhibición', ind.mlExhibicion, 'm', 0.25, cl(ind.mlExhibicion / (ind.pisoVenta * 0.42))],
    ['venta', 'Piso de venta', ind.pisoVentaPct, '%', 0.15, cl(1 - Math.max(0, 80 - ind.pisoVentaPct, ind.pisoVentaPct - 88) / 10)],
    ['destino', 'Productos destino al fondo', Math.round(destino * 100), '%', 0.2, cl(destino)],
    ['cajas', 'Cajas junto a la salida', Math.round(dCajas * 10) / 10, 'm', 0.15, cl(1 - (dCajas - 6) / 9)],
    ['pasillos', 'Ancho de pasillos', Math.round(anchoMedio * 100) / 100, 'm', 0.15, cl(1 - Math.abs(anchoMedio - 1.5) / 0.6)],
    ['frio', 'Puertas de refrigeración', ind.puertasFrio, 'pzas', 0.1, cl(ind.puertasFrio / 24)],
  ].map(([id, nombre, valor, unidad, peso, k]) => ({ id, nombre, valor, unidad, peso, puntos: Math.round(peso * 100 * k * 10) / 10 }));
  return { total: Math.round(c.reduce((s, x) => s + x.puntos, 0) * 10) / 10, criterios: c };
}
