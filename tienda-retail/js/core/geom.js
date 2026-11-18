// Geometría en planta. Lógica pura (sin three). Puntos como [x, z] en metros.
// Convención (ver docs/design.md §2): origen en la esquina trasera izquierda del rectángulo envolvente del
// local, a nivel de piso terminado; +x a la derecha vista desde la calle; +z hacia la calle (fachada
// principal en z máximo); +y arriba. rot en grados: three rotation.y = rot·π/180. El frente de un mueble
// mira a +z local; tras girar, frente(rot) = [sin, cos]. Ancho sobre x local, fondo sobre z local.

export const DEG = Math.PI / 180;

/** Área con signo (positiva si el recorrido es antihorario visto en planta con +x derecha y +z abajo). */
export function areaFirmada(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; s += x1 * z2 - x2 * z1; }
  return s / 2;
}
export const area = (poly) => Math.abs(areaFirmada(poly));

export function caja(poly) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return { x0, z0, x1, z1, ancho: x1 - x0, fondo: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

export function centroide(poly) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length]; const f = x1 * z2 - x2 * z1;
    a += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f;
  }
  a /= 2; return a ? [cx / (6 * a), cz / (6 * a)] : poly[0].slice();
}

/** Punto dentro de polígono (par-impar). */
export function dentro(poly, [x, z]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Vector frente de un mueble girado rot grados. */
export const frente = (rot) => [Math.sin(rot * DEG), Math.cos(rot * DEG)];

/** Esquinas en planta de un rectángulo centrado en (x,z) con ancho×fondo girado rot. */
export function esquinas(x, z, ancho, fondo, rot = 0) {
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG), w = ancho / 2, d = fondo / 2;
  // rotación de three sobre +y: (lx, lz) -> (lx·c + lz·s, -lx·s + lz·c)
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
}

/** Rectángulo alineado {x0,z0,x1,z1} que envuelve la huella girada (para rot múltiplo de 90 es exacto). */
export function huellaAABB(m) { return caja(esquinas(m.x, m.z, m.ancho, m.fondo, m.rot || 0)); }

/** Traslape de dos rectángulos alineados con holgura opcional. */
export const traslapan = (a, b, h = 0) => a.x0 < b.x1 + h && b.x0 < a.x1 + h && a.z0 < b.z1 + h && b.z0 < a.z1 + h;

/** Intervalos en x donde la recta z = cte está dentro del polígono rectilíneo. */
export function tramosEnX(poly, z) {
  const xs = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
    if ((z1 > z) !== (z2 > z)) xs.push(x1 + ((z - z1) * (x2 - x1)) / (z2 - z1));
  }
  xs.sort((a, b) => a - b); const r = [];
  for (let i = 0; i + 1 < xs.length; i += 2) r.push([xs[i], xs[i + 1]]);
  return r;
}
/** Igual que tramosEnX pero sobre la recta x = cte (intervalos en z). */
export function tramosEnZ(poly, x) { return tramosEnX(poly.map(([a, b]) => [b, a]), x); }

/** Lados del polígono como segmentos {a,b,largo,normal exterior}. */
export function lados(poly) {
  const sgn = Math.sign(areaFirmada(poly)) || 1;
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz);
    // normal exterior (verificada con el local C): (dz, -dx)/L para recorrido de área positiva
    const n = [(dz / L) * sgn, (-dx / L) * sgn];
    return { i, a, b, largo: L, dir: [dx / L, dz / L], normal: n };
  });
}

/** Distancia de un punto a un segmento. */
export function distSegmento([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export const redondear = (v, p = 0.01) => Math.round(v / p) * p;
