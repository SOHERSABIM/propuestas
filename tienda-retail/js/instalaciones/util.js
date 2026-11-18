// Utilidades puras (sin three, sin azar, sin reloj) para el plan de instalaciones.
import { dentro, tramosEnX } from '../core/geom.js';

export const r3 = (v) => Math.round(v * 1000) / 1000;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const rectC = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
export const solapa = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.z0 < b.z1 + m && b.z0 < a.z1 + m;
/** c cabe dentro de r (con tolerancia e). */
export const cabe = (r, c, e = 0) => c.x0 >= r.x0 - e && c.x1 <= r.x1 + e && c.z0 >= r.z0 - e && c.z1 <= r.z1 + e;
export const enRect = (r, x, z, e = 1e-6) => x >= r.x0 - e && x <= r.x1 + e && z >= r.z0 - e && z <= r.z1 + e;
export const infl = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });

/** Punto dentro del polígono con holgura m a los muros (rectilíneo). */
export function ptDentro(poly, x, z, m = 0.3) {
  return dentro(poly, [x, z]) && dentro(poly, [x + m, z]) && dentro(poly, [x - m, z]) && dentro(poly, [x, z + m]) && dentro(poly, [x, z - m]);
}
/** Segmento ortogonal (en planta) dentro del polígono, muestreado cada 0.4 m. */
export function segDentro(poly, a, b, m = 0.3) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 0.4));
  for (let i = 0; i <= n; i++) { const t = i / n; if (!ptDentro(poly, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, m)) return false; }
  return true;
}
/** Rectángulo (con holgura) dentro del polígono: perímetro muestreado cada 0.5 m. */
export function rectEnPoligono(poly, r, m = 0.3) {
  const pts = [];
  for (let x = r.x0; x <= r.x1 + 1e-9; x += 0.5) { pts.push([x, r.z0], [x, r.z1]); }
  for (let z = r.z0; z <= r.z1 + 1e-9; z += 0.5) { pts.push([r.x0, z], [r.x1, z]); }
  pts.push([r.x1, r.z1], [r.x1, r.z0]);
  return pts.every(([x, z]) => ptDentro(poly, x, z, m));
}
/** Rectángulo en planta de un segmento ortogonal [a,b] (puntos [x,z]) engrosado m. */
export function rectSeg(a, b, m = 0) {
  return { x0: Math.min(a[0], b[0]) - m, x1: Math.max(a[0], b[0]) + m, z0: Math.min(a[1], b[1]) - m, z1: Math.max(a[1], b[1]) + m };
}
export function segToca(a, b, c) { return solapa(rectSeg(a, b), c); }

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

// ───────────── cajas 3D alineadas a los ejes ─────────────
/** @typedef {{x0:number,x1:number,y0:number,y1:number,z0:number,z1:number}} Caja */
export const cajaC = (cx, cy, cz, sx, sy, sz) => ({ x0: cx - sx / 2, x1: cx + sx / 2, y0: cy - sy / 2, y1: cy + sy / 2, z0: cz - sz / 2, z1: cz + sz / 2 });
/** Caja de un prisma con eje 'x' o 'z' (largo L sobre el eje, ancho w perpendicular, alto h). */
export function cajaEje(cx, cy, cz, eje, L, w, h) { return eje === 'x' ? cajaC(cx, cy, cz, L, h, w) : cajaC(cx, cy, cz, w, h, L); }
export const cajasChocan = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m && a.z0 < b.z1 + m && b.z0 < a.z1 + m;
export const inflarCaja = (c, m) => ({ x0: c.x0 - m, x1: c.x1 + m, y0: c.y0 - m, y1: c.y1 + m, z0: c.z0 - m, z1: c.z1 + m });
export function unirCajas(cs) {
  const o = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
  for (const c of cs) { o.x0 = Math.min(o.x0, c.x0); o.x1 = Math.max(o.x1, c.x1); o.y0 = Math.min(o.y0, c.y0); o.y1 = Math.max(o.y1, c.y1); o.z0 = Math.min(o.z0, c.z0); o.z1 = Math.max(o.z1, c.z1); }
  return o;
}
export const planta = (c) => ({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 });

/** Huella en planta de un mueble (rot múltiplo de 90). */
export function huellaMueble(m) {
  const g = ((Math.round(m.rot / 90) % 4) + 4) % 4, sw = g % 2 === 0;
  const w = sw ? m.ancho : m.fondo, d = sw ? m.fondo : m.ancho;
  return rectC(m.x, m.z, w, d);
}

/** Orientación (yaw de three) con la que el eje local +z del modelo apunta a la dirección mundial (dx, dz). */
export const yawHacia = (dx, dz) => Math.atan2(dx, dz);
/** Yaw con el que el eje local +x del modelo apunta a (dx, dz). */
export const yawX = (dx, dz) => Math.atan2(-dz, dx);
