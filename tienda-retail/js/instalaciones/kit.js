// Motor de instancias de las capas: un InstancedMesh por TIPO de componente; cada instancia tiene su ventana de
// aparición (t0, dur) en el avance p de la capa y una forma de llegar (modo). Las matrices se animan por instancia
// desde el reloj central (nadie más tiene reloj propio). Determinista: sin azar, sin tiempos propios.
import * as THREE from 'three';
import { EASE } from '../core/anim.js';
import { clamp } from './util.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _c2 = new THREE.Color();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const MIN = 1e-5;

/** Cómo llega cada tipo de componente. */
export const MODO = {
  // tramos de red: entran desde arriba y desde el lado del equipo, y se acoplan al anterior
  tramo: 'cae', codo: 'cae', teeR: 'cae', teeP: 'cae', reduccion: 'cae', compuerta: 'cae', tubo: 'cae', codoTubo: 'cae', valvula: 'cae', caja: 'cae', canaleta: 'piso',
  // lo que cuelga de la losa crece hacia abajo anclado arriba
  soporte: 'ext', bajante: 'ext', flex: 'ext', retorno: 'ext', varilla: 'ext',
  unidad: 'grua', cond: 'grua', bancada: 'ext', cuello: 'ext', ventilador: 'pop', difusor: 'punta',
  carcasaLineal: 'cuelga', carcasaPanel: 'cuelga', lente: 'cuelga', spot: 'cuelga', charco: 'charco',
};

/**
 * Pieza del plan → registro de instancia.
 * @param {any} p pieza con t, x, y, z, ry, rz, basis, sx, sy, sz, c, t0, dur y, si es luminosa, lit0/litd
 */
function registro(p) {
  const r = {
    x: p.x, y: p.y, z: p.z, sx: p.sx ?? 1, sy: p.sy ?? 1, sz: p.sz ?? 1, t0: p.t0, dur: Math.max(1e-3, p.dur), modo: MODO[p.t] ?? 'cae',
    ry: p.ry ?? 0, rz: p.rz ?? 0, basis: p.basis ?? null, q: -1, ql: -1, yTop: p.yTop ?? 0, yArr: p.yArranque ?? 0,
    lit: !!p.lit, lit0: p.lit0 ?? 0, litd: p.litd ?? 0.1, col: p.c ?? 0xffffff, colOn: p.colOn ?? 0xffffff, colOff: p.colOff ?? 0x6a7078,
    fr: p.fr ?? [0, 0], gira: !!p.gira, giro: 0, id: p.id,
  };
  // desplazamiento de llegada de los tramos de red: desde el lado del equipo y desde arriba
  const vert = Math.abs(r.fr[0]) + Math.abs(r.fr[1]) < 0.5;
  r.off = [r.fr[0] * 0.9, vert ? 0.75 : 0.5, r.fr[1] * 0.9]; if (r.modo === 'piso') r.off = [r.fr[0] * 0.9, 0, r.fr[1] * 0.9];
  if (r.basis) { _a.fromArray(r.basis[0]); _b.fromArray(r.basis[1]); _d.fromArray(r.basis[2]); _m.makeBasis(_a, _b, _d); r.qrot = new THREE.Quaternion().setFromRotationMatrix(_m); } else r.qrot = null;
  return r;
}

/**
 * Un tipo de componente. `piezas` ya traen sus ventanas; geo y mat se comparten entre instancias.
 */
export function crearLote(geo, mat, piezas, { orden = 0, transparente = false } = {}) {
  const n = piezas.length; const R = piezas.map(registro);
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  mesh.count = n; mesh.frustumCulled = false; mesh.raycast = () => {}; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = orden;
  for (let i = 0; i < n; i++) { mesh.setColorAt(i, _c.set(R[i].lit ? R[i].colOff : R[i].col)); ocultar(mesh, i); }
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tieneLit = R.some((r) => r.lit); const tieneGira = R.some((r) => r.gira);
  void transparente;

  function escribir(i, r, q) {
    if (q <= 0) { ocultar(mesh, i); return; }
    let x = r.x, y = r.y, z = r.z, sx = r.sx, sy = r.sy, sz = r.sz;
    switch (r.modo) {
      case 'piso': { const e = EASE.out(q), k = 1 - e, g = EASE.out(clamp(q * 2.4)); x += r.off[0] * k; z += r.off[2] * k; sx *= g; break; }
      case 'cae': { const e = EASE.out(q), k = 1 - e, g = EASE.out(clamp(q * 2.4)); x += r.off[0] * k; y += r.off[1] * k; z += r.off[2] * k; sx *= g; sy *= g; sz *= g; break; }
      case 'ext': { const e = EASE.out(q); sy *= e; const g = EASE.out(clamp(q * 3)); sx *= g; sz *= g; break; }
      case 'grua': { const e = EASE.out(q); y += 1.7 * (1 - e); const g = 0.9 + 0.1 * e; sx *= g; sy *= g; sz *= g; break; }
      case 'pop': { const e = EASE.back(q); sx *= e; sy *= e; sz *= e; break; }
      case 'punta': { const e = EASE.out(q); y = r.yTop + (r.y - r.yTop) * e; const g = EASE.out(clamp(q * 1.8)); sx *= g; sy *= g; sz *= g; break; }
      case 'cuelga': { const e = EASE.out(q), g = EASE.out(clamp(q * 3)); y += (r.yArr - r.y) * (1 - e); sx *= g; sy *= g; sz *= g; break; }
      case 'charco': { const e = EASE.back(q); sx *= e; sz *= e; break; }
    }
    _p.set(x, y, z); _s.set(Math.max(MIN, sx), Math.max(MIN, sy), Math.max(MIN, sz));
    if (r.qrot) _q.copy(r.qrot); else { _e.set(0, r.ry + r.giro, r.rz, 'YXZ'); _q.setFromEuler(_e); }
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }

  let ultP = NaN;
  return {
    mesh, n,
    /** Escribe las matrices (y colores de encendido) para el avance p de la capa. */
    actualizar(p, forzar = false) {
      if (p === ultP && !forzar) return; ultP = p;
      let cambio = false, cambioC = false;
      for (let i = 0; i < n; i++) {
        const r = R[i], q = clamp((p - r.t0) / r.dur);
        if (q !== r.q || (forzar && r.gira)) { r.q = q; escribir(i, r, q); cambio = true; }
        if (r.lit) {
          const ql = clamp((p - r.lit0) / r.litd);
          if (ql !== r.ql) { r.ql = ql; const k = EASE.outQuint(ql); _c.set(r.colOff); _c2.set(r.colOn); mesh.setColorAt(i, _c.lerp(_c2, k)); cambioC = true; }
        }
      }
      if (cambio) mesh.instanceMatrix.needsUpdate = true;
      if (cambioC && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    /** Giro de los ventiladores (ángulo en rad). Reescribe solo las instancias que giran. */
    girar(ang) {
      if (!tieneGira) return; let cambio = false;
      for (let i = 0; i < n; i++) { const r = R[i]; if (!r.gira || r.q <= 0) continue; r.giro = ang * (i & 1 ? -1 : 1); escribir(i, r, r.q); cambio = true; }
      if (cambio) mesh.instanceMatrix.needsUpdate = true;
    },
    get tieneLit() { return tieneLit; },
    dispose() { mesh.dispose(); },
  };
}
function ocultar(mesh, i) { _p.set(0, -10, 0); _s.set(MIN, MIN, MIN); _q.identity(); mesh.setMatrixAt(i, _m.compose(_p, _q, _s)); }

// ───────────── pulsos de flujo sobre las rutas ya instaladas ─────────────
const GEO_PULSO = new THREE.BoxGeometry(1, 1, 1);
/**
 * @param {{puntos:number[][], d0:number, dir?:1|-1, color?:number}[]} rutas
 * @param {{cada:number, tam:number, vel:number, dy:number}} o
 */
export function crearPulsos(rutas, o, mat) {
  const R = rutas.map((r) => { const segs = []; let cum = 0; for (let i = 0; i + 1 < r.puntos.length; i++) { const a = r.puntos[i], b = r.puntos[i + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); segs.push({ a, b, l, c0: cum }); cum += l; } return { ...r, segs, total: cum }; }).filter((r) => r.total > 0.3);
  const lista = [];
  R.forEach((r, k) => { const n = Math.max(1, Math.round(r.total / o.cada)); for (let i = 0; i < n; i++) lista.push({ k, fase: (i + 0.37 * ((k * 7) % 5) / 5) / n }); });
  const mesh = new THREE.InstancedMesh(GEO_PULSO, mat, Math.max(1, lista.length)); mesh.count = lista.length;
  mesh.frustumCulled = false; mesh.raycast = () => {}; mesh.renderOrder = 3;
  lista.forEach((q, i) => { mesh.setColorAt(i, _c.set(R[q.k].color ?? 0xffffff)); ocultar(mesh, i); });
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const pos = [0, 0, 0];
  const en = (r, s) => { s = clamp(s, 0, r.total); for (const g of r.segs) if (s <= g.c0 + g.l + 1e-9) { const t = g.l > 0 ? (s - g.c0) / g.l : 0; pos[0] = g.a[0] + (g.b[0] - g.a[0]) * t; pos[1] = g.a[1] + (g.b[1] - g.a[1]) * t; pos[2] = g.a[2] + (g.b[2] - g.a[2]) * t; return pos; } const g = r.segs[r.segs.length - 1]; pos[0] = g.b[0]; pos[1] = g.b[1]; pos[2] = g.b[2]; return pos; };
  return {
    mesh, n: lista.length,
    /** ahora en ms (reloj del proyecto); alcance = distancia por la red ya instalada (m). */
    actualizar(ahora, alcance) {
      const seg = ahora / 1000;
      for (let i = 0; i < lista.length; i++) {
        const q = lista[i], r = R[q.k], dir = r.dir || 1;
        let u = (seg * o.vel / r.total * dir + q.fase) % 1; if (u < 0) u += 1;
        const s = u * r.total, vivo = alcance - (r.d0 + s);
        if (vivo <= 0.1) { ocultar(mesh, i); continue; }
        const k = Math.min(1, vivo / 0.6) * Math.min(1, Math.min(s, r.total - s) / 0.35 + 0.15), sc = o.tam * k;
        en(r, s); _p.set(pos[0], pos[1] + o.dy, pos[2]); _s.set(sc, sc, sc); _q.identity(); mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    ocultarTodo() { for (let i = 0; i < lista.length; i++) ocultar(mesh, i); mesh.instanceMatrix.needsUpdate = true; },
    dispose() { mesh.dispose(); },
  };
}
