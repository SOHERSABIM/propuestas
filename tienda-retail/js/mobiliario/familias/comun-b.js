// Ayudantes de detalle del grupo 2 (ropa, mostrador, trastienda): marco local con giro y escala, prendas con silueta
// colgadas de ganchos, maniquí de proporción humana abstracta, mercancía de formas variadas y ranuras de postes.
// Todo determinista: el azar viene del generador con semilla del contexto (c.rng).
import { P, claro } from './comun.js';
import { mezcla } from '../piezas.js';

export { P, claro, mezcla };

/** Giro (ry) para que el eje local x de un Marco apunte a la dirección horizontal (dx, dz). */
export const giroHacia = (dx, dz) => Math.atan2(-dz, dx);

/**
 * Marco local: origen (ox, oy, oz), giro ry alrededor de la vertical y escala uniforme s.
 * Convierte cajas, troncos, barras, pilares y esferas a coordenadas del mueble para dibujar prendas giradas.
 */
export class Marco {
  constructor(b, ox, oy, oz, ry = 0, s = 1) {
    this.b = b; this.ox = ox; this.oy = oy; this.oz = oz; this.ry = ry; this.s = s; this.cs = Math.cos(ry); this.sn = Math.sin(ry);
  }
  p(x, y, z) { const s = this.s; return [this.ox + (x * this.cs + z * this.sn) * s, this.oy + y * s, this.oz + (-x * this.sn + z * this.cs) * s]; }
  tronco(cx, y0, cz, w0, d0, w1, d1, h, color, o = {}) {
    const s = this.s, q = this.p(cx, y0, cz);
    this.b.tronco(q[0], q[1], q[2], w0 * s, d0 * s, w1 * s, d1 * s, h * s, color, this.ry || o.ry ? { ...o, ry: (o.ry || 0) + this.ry } : o);
  }
  caja(cx, y0, cz, w, h, d, color, o) { this.tronco(cx, y0, cz, w, d, w, d, h, color, o); }
  barra(p, q, t, color, o) { this.b.barra(this.p(...p), this.p(...q), t * this.s, color, o); }
  pilar(cx, y0, cz, r, h, color, seg = 8, o) { const q = this.p(cx, y0, cz); this.b.pilar(q[0], q[1], q[2], r * this.s, h * this.s, color, seg, o); }
  esfera(cx, cy, cz, r, color, seg = 8, o) { const q = this.p(cx, cy, cz); this.b.esfera(q[0], q[1], q[2], r * this.s, color, seg, o); }
  /** Loft con anillos en coordenadas locales (cx, cy, cz, rx, rz). */
  loft(anillos, color, o = {}) {
    const sc = this.s;
    loft(this.b, anillos.map((a) => { const q = this.p(a.cx, a.cy, a.cz); return { cx: q[0], cy: q[1], cz: q[2], rx: a.rx * sc, rz: a.rz * sc }; }), color, { ...o, giro: this.ry });
  }
}
const R = (cx, cy, cz, rx, rz) => ({ cx, cy, cz, rx, rz });

/** Cara plana (2 triángulos) pegada a la cara +z de un elemento: ranuras de postes, etiquetas en blanco. */
export function carta(b, cx, y0, z, w, h, color) { b.tronco(cx, y0, z, w, 0.0005, w, 0.0005, h, color, { sin: '-y+y-x+x-z' }); }

// ---------------------------------------------------------------------------------------------------------------
// PRENDAS COLGADAS. Marco con origen en el centro del riel (o clavija) y eje x local = ancho de la prenda.
// ---------------------------------------------------------------------------------------------------------------
const GANCHOS = [P.blanco, P.oscuro, P.madera, 0xc9c4ba];

function gancho(m, hw, color, barra) {
  m.barra([0, -0.062, 0], [0, 0.03, 0], 0.006, P.metal); m.barra([0, 0.03, 0], [0.028, 0.03, 0], 0.006, P.metal);
  if (barra) m.barra([-hw, -0.078, 0], [hw, -0.078, 0], 0.009, color);
  else { m.barra([0, -0.062, 0], [-hw, -0.104, 0], 0.008, color); m.barra([0, -0.062, 0], [hw, -0.104, 0], 0.008, color); }
}

/** Camisa (o abrigo si larga y L grande): cuerpo con caída (ensanche y vaivén al borde), mangas que cuelgan y cuello. Ancho total ≈ 0.37 a escala 1. */
export function camisa(m, c, { L = 0.46, larga = false, w = 0.27, gancho: cg = P.blanco } = {}) {
  gancho(m, w * 0.62, cg, false);
  const sw = (((L * 1000) | 0) % 5 - 2) * 0.004, hw = w / 2, yh = -0.095 - L;
  m.loft([R(0, -0.1, 0, hw * 0.34, 0.02), R(0, -0.13, 0, hw, 0.022), R(sw * 0.3, -0.095 - L * 0.5, 0.002, hw * 0.95, 0.024), R(sw, yh + 0.02, 0.003, hw * 1.08, 0.026), R(sw * 1.3, yh, 0.0, hw * 1.12, 0.022)], c, { seg: 6, exp: 3, arriba: true });
  for (const s of [-1, 1]) {
    const x0 = s * hw * 0.94;
    if (larga) m.loft([R(x0, -0.115, 0, 0.032, 0.026), R(x0 + s * 0.03, -0.3, 0.004, 0.03, 0.024), R(x0 + s * 0.04 + s * sw, -0.52, 0.008, 0.026, 0.02)], c, { seg: 6, v: 0.97 });
    else m.loft([R(x0, -0.115, 0, 0.034, 0.028), R(x0 + s * 0.028, -0.25, 0.003, 0.036, 0.028)], c, { seg: 6, v: 0.97 });
  }
  m.tronco(0, -0.108, 0, 0.1, 0.046, 0.075, 0.046, 0.03, claro(c, 0.5), { sin: '-y' });
  m.caja(0, yh + 0.02, 0.0, 0.022, L - 0.07, 0.045, claro(c, 0.3), { sin: '-y+y' });
}

/** Pantalón colgado de gancho de barra por la pretina: piernas con leve separación y vaivén, bota con dobladillo. */
export function pantalon(m, c, { L = 0.5, gancho: cg = P.oscuro } = {}) {
  gancho(m, 0.15, cg, true);
  m.caja(0, -0.125, 0, 0.27, 0.04, 0.052, mezcla(c, 0x33373c, 0.25), { sin: '-y' });
  const sw = (((L * 1000) | 0) % 5 - 2) * 0.003;
  for (const s of [-1, 1]) {
    const x0 = s * 0.068, y1 = -0.125 - L;
    m.loft([R(x0, -0.125, 0, 0.066, 0.028), R(x0 + s * 0.004, -0.125 - L * 0.45, 0.002, 0.06, 0.026), R(x0 + s * (0.012 + sw), y1 + 0.03, 0.003, 0.052, 0.026), R(x0 + s * (0.014 + sw), y1, 0, 0.056, 0.029)], c, { seg: 6, exp: 2.6 });
    m.loft([R(x0 + s * (0.014 + sw), y1 + 0.028, 0, 0.058, 0.031), R(x0 + s * (0.014 + sw), y1, 0, 0.058, 0.031)], claro(c, 0.14), { seg: 6, exp: 2.6 });
  }
}

/** Vestido de una pieza: busto, cintura marcada y falda acampanada con vaivén. */
export function vestido(m, c, { L = 0.64, gancho: cg = P.blanco } = {}) {
  gancho(m, 0.12, cg, false);
  const sw = (((L * 1000) | 0) % 5 - 2) * 0.005;
  m.loft([R(0, -0.1, 0, 0.05, 0.02), R(0, -0.15, 0, 0.1, 0.022), R(0, -0.2, 0, 0.1, 0.024), R(0, -0.3, 0, 0.082, 0.022), R(sw * 0.5, -0.3 - L * 0.4, 0.003, 0.125, 0.028), R(sw, -0.3 - L, 0.004, 0.2, 0.034)], c, { seg: 10, exp: 2.6, arriba: true });
  m.loft([R(0, -0.292, 0, 0.088, 0.026), R(0, -0.318, 0, 0.088, 0.026)], mezcla(c, 0x33373c, 0.4), { seg: 10, exp: 2.6 });
  for (const s of [-1, 1]) m.loft([R(s * 0.1, -0.12, 0, 0.026, 0.02), R(s * 0.125, -0.19, 0, 0.024, 0.02)], c, { seg: 5, v: 0.97 });
}

/** Elige y dibuja una prenda según una mezcla de tipos. m: Marco con origen en el riel; rng: azar con semilla. */
export function prendaVariada(m, rng, paleta, { tipos = ['camisa', 'camisa', 'pantalon', 'vestido', 'abrigo'], L = 1 } = {}) {
  const t = rng.elegir(tipos), c = rng.elegir(paleta), g = rng.elegir(GANCHOS), l = rng.rango(0.92, 1.08) * L;
  if (t === 'pantalon') pantalon(m, c, { L: 0.5 * l, gancho: g });
  else if (t === 'vestido') vestido(m, c, { L: 0.64 * l, gancho: g });
  else if (t === 'abrigo') camisa(m, c, { L: 0.62 * l, larga: true, w: 0.29, gancho: g });
  else if (t === 'blusa') camisa(m, c, { L: 0.38 * l, w: 0.26, gancho: g });
  else camisa(m, c, { L: 0.46 * l, larga: rng.r() < 0.3, gancho: g });
}

// ---------------------------------------------------------------------------------------------------------------
// LOFT: superficie suave por anillos (secciones elípticas o redondeadas) apilados en y, con normales suaves.
// Anillo = {cx, cy, cz, rx, rz}. Sirve para torsos, miembros, cabezas, prendas ceñidas y pilas dobladas.
// ---------------------------------------------------------------------------------------------------------------
export function loft(b, anillos, color, { seg = 12, arriba = false, abajo = false, exp = 2, v, giro = 0 } = {}) {
  const col = b._col(color, { v }), n = anillos.length, e = 2 / exp, gc = Math.cos(giro), gs = Math.sin(giro);
  const P = anillos.map((a) => Array.from({ length: seg }, (_, j) => {
    const th = (j / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const dx = a.rx * Math.sign(c) * Math.abs(c) ** e, dz = a.rz * Math.sign(s) * Math.abs(s) ** e;
    return [a.cx + dx * gc + dz * gs, a.cy, a.cz - dx * gs + dz * gc];
  }));
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]], len = (u) => Math.hypot(u[0], u[1], u[2]);
  const N = P.map((ring, i) => ring.map((p, j) => {
    const tt = sub(ring[(j + 1) % seg], ring[(j + seg - 1) % seg]), ts = sub(P[Math.min(n - 1, i + 1)][j], P[Math.max(0, i - 1)][j]);
    let nn = [tt[1] * ts[2] - tt[2] * ts[1], tt[2] * ts[0] - tt[0] * ts[2], tt[0] * ts[1] - tt[1] * ts[0]], l = len(nn);
    const a = anillos[i], out = [p[0] - a.cx, 0, p[2] - a.cz];
    if (l < 1e-9) return [0, i === 0 ? -1 : 1, 0];
    nn = [nn[0] / l, nn[1] / l, nn[2] / l];
    if (nn[0] * out[0] + nn[2] * out[2] < 0) nn = [-nn[0], -nn[1], -nn[2]];
    return nn;
  }));
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const k = (j + 1) % seg;
    if (len(sub(P[i][j], P[i + 1][j])) + len(sub(P[i][k], P[i + 1][k])) < 1e-6) continue;
    b._triH(P[i][j], P[i + 1][j], P[i + 1][k], N[i][j], N[i + 1][j], N[i + 1][k], col);
    b._triH(P[i][j], P[i + 1][k], P[i][k], N[i][j], N[i + 1][k], N[i][k], col);
  }
  const tapa = (i, ny) => { const a = anillos[i], c = [a.cx, a.cy, a.cz], nv = [0, ny, 0]; for (let j = 0; j < seg; j++) b._triH(c, P[i][j], P[i][(j + 1) % seg], nv, nv, nv, col); };
  if (arriba) tapa(n - 1, 1); if (abajo) tapa(0, -1);
}
/** Prenda doblada con canto redondeado (sección cuadrada suave). Base en y0; deja un pliegue fino en la cara superior. */
export function doblada(b, x, y0, z, w, h, d, color, { pliegue = true, v } = {}) {
  const a = w / 2, e = d / 2;
  loft(b, [ani(x, y0, z, a * 0.93, e * 0.93), ani(x, y0 + h * 0.22, z, a * 0.995, e * 0.995), ani(x, y0 + h * 0.78, z, a * 0.995, e * 0.995), ani(x, y0 + h, z, a * 0.93, e * 0.93)], color, { seg: 16, exp: 4, arriba: true, v });
  if (pliegue) b.tronco(x, y0 + h + 0.0004, z - d * 0.18, w * 0.84, 0.006, w * 0.84, 0.006, 0.0004, mezcla(color, 0x33373c, 0.22), { sin: '-y-x+x-z+z' });
}
const ani = (cx, cy, cz, rx, rz = rx) => ({ cx, cy, cz, rx, rz });

// ---------------------------------------------------------------------------------------------------------------
// MANIQUÍ de proporción humana abstracta (sin rostro), de volúmenes redondeados. Firma intacta: (b, x, z, y0, ropa, k).
// Alto total ≈ 1.73 m sobre y0; ancho ≤ 0.47; base de 0.30 m de diámetro.
// ---------------------------------------------------------------------------------------------------------------
export function maniquiDetallado(b, x, z, y0, ropa, k = '') {
  const piel = 0xe9e6e0, sombra = 0xd9d5cd, s = (n) => (k ? `${n} ${k}` : n), Y = (y) => y0 + y;
  b.pilar(x, y0, z, 0.15, 0.014, P.oscuro, 28); b.pilar(x, y0 + 0.014, z, 0.13, 0.008, P.metalOscuro, 28); b.pilar(x, y0 + 0.022, z - 0.07, 0.022, 0.012, P.metal, 10);
  b.pieza(s('base'), 0, 'escala');
  // piernas torneadas, pies y varilla trasera
  for (const sx of [-1, 1]) {
    const px = x + sx * 0.085;
    loft(b, [ani(px, Y(0.022), z + 0.038, 0.037, 0.108), ani(px, Y(0.04), z + 0.038, 0.039, 0.1), ani(px, Y(0.058), z + 0.022, 0.034, 0.07), ani(px, Y(0.078), z + 0.0, 0.031, 0.04)], sombra, { seg: 10, abajo: true });
    loft(b, [ani(px, Y(0.07), z, 0.03, 0.032), ani(px, Y(0.16), z, 0.04, 0.05), ani(px, Y(0.25), z, 0.049, 0.055), ani(px, Y(0.38), z, 0.043, 0.046), ani(px, Y(0.45), z, 0.046, 0.05),
      ani(px, Y(0.56), z, 0.06, 0.07), ani(px, Y(0.68), z, 0.074, 0.083), ani(px, Y(0.82), z, 0.083, 0.09)], piel, { seg: 12, abajo: true });
  }
  b.pilar(x, Y(0.034), z - 0.075, 0.009, 0.8, P.metalOscuro, 6); b.caja(x, Y(0.82), z - 0.09, 0.05, 0.03, 0.05, P.metalOscuro);
  b.pieza(s('poste y piernas'), 1, 'crece', { aristas: false });
  // torso ahusado con hombros redondeados, cuello y brazos
  loft(b, [ani(x, Y(0.8), z, 0.165, 0.108), ani(x, Y(0.9), z, 0.156, 0.1), ani(x, Y(1.02), z, 0.124, 0.082), ani(x, Y(1.15), z + 0.006, 0.15, 0.1), ani(x, Y(1.27), z + 0.012, 0.172, 0.114),
    ani(x, Y(1.34), z + 0.004, 0.176, 0.096), ani(x, Y(1.385), z, 0.125, 0.07), ani(x, Y(1.425), z, 0.05, 0.046)], piel, { seg: 16 });
  loft(b, [ani(x, Y(1.4), z, 0.043), ani(x, Y(1.46), z, 0.038), ani(x, Y(1.52), z + 0.004, 0.036)], sombra, { seg: 10 });
  for (const sx of [-1, 1]) {
    const hx = x + sx * 0.18;
    b.esfera(hx, Y(1.3), z, 0.046, piel, 10);
    loft(b, [ani(hx, Y(1.3), z, 0.044), ani(hx + sx * 0.004, Y(1.22), z, 0.041), ani(hx + sx * 0.01, Y(1.1), z + 0.008, 0.034)], piel, { seg: 10 });
    b.esfera(hx + sx * 0.01, Y(1.1), z + 0.008, 0.034, piel, 8);
    loft(b, [ani(hx + sx * 0.01, Y(1.1), z + 0.008, 0.033), ani(hx + sx * 0.006, Y(0.98), z + 0.04, 0.03), ani(hx + sx * 0.004, Y(0.88), z + 0.062, 0.023)], piel, { seg: 10 });
    loft(b, [ani(hx + sx * 0.004, Y(0.88), z + 0.062, 0.022, 0.02), ani(hx + sx * 0.004, Y(0.83), z + 0.066, 0.028, 0.013), ani(hx + sx * 0.004, Y(0.775), z + 0.068, 0.016, 0.01)], sombra, { seg: 8, abajo: true });
  }
  b.pieza(s('torso'), 2, 'crece', { aristas: false });
  // cabeza ovoide lisa, sin rostro, con normales suaves
  loft(b, [ani(x, Y(1.5), z + 0.012, 0.012, 0.012), ani(x, Y(1.515), z + 0.012, 0.045, 0.05), ani(x, Y(1.545), z + 0.008, 0.072, 0.08), ani(x, Y(1.585), z + 0.002, 0.086, 0.095), ani(x, Y(1.63), z, 0.09, 0.097),
    ani(x, Y(1.675), z - 0.004, 0.083, 0.09), ani(x, Y(1.708), z - 0.006, 0.06, 0.066), ani(x, Y(1.728), z - 0.006, 0.026, 0.03), ani(x, Y(1.733), z - 0.006, 0.002, 0.002)], piel, { seg: 16 });
  b.pieza(s('cabeza'), 2, 'escala', { aristas: false });
  // pantalón: piernas ceñidas con dobladillo, cadera y cinturón
  for (const sx of [-1, 1]) {
    const px = x + sx * 0.085;
    loft(b, [ani(px, Y(0.1), z, 0.043, 0.046), ani(px, Y(0.16), z, 0.049, 0.058), ani(px, Y(0.25), z, 0.06, 0.066), ani(px, Y(0.38), z, 0.056, 0.06), ani(px, Y(0.45), z, 0.058, 0.064),
      ani(px, Y(0.56), z, 0.072, 0.082), ani(px, Y(0.68), z, 0.086, 0.095), ani(px, Y(0.84), z, 0.096, 0.1)], ropa.bottom, { seg: 12 });
    loft(b, [ani(px, Y(0.1), z, 0.047, 0.05), ani(px, Y(0.125), z, 0.047, 0.05)], claro(ropa.bottom, 0.15), { seg: 12 });
  }
  loft(b, [ani(x, Y(0.84), z, 0.174, 0.114), ani(x, Y(0.9), z, 0.165, 0.106), ani(x, Y(0.97), z, 0.15, 0.094)], ropa.bottom, { seg: 16 });
  b.pieza(s('pantalón'), 4, 'crece', { aristas: false });
  // camisa: capa que sigue el torso, mangas cortas que siguen el brazo y cuello
  loft(b, [ani(x, Y(0.8), z, 0.198, 0.13), ani(x, Y(0.9), z, 0.184, 0.118), ani(x, Y(1.02), z, 0.14, 0.094), ani(x, Y(1.15), z + 0.006, 0.164, 0.112), ani(x, Y(1.27), z + 0.012, 0.188, 0.126),
    ani(x, Y(1.34), z + 0.004, 0.192, 0.108), ani(x, Y(1.385), z, 0.135, 0.082), ani(x, Y(1.418), z, 0.058, 0.054)], ropa.top, { seg: 16 });
  for (const sx of [-1, 1]) {
    const hx = x + sx * 0.18;
    b.esfera(hx, Y(1.3), z, 0.056, ropa.top, 10);
    loft(b, [ani(hx, Y(1.3), z, 0.056), ani(hx + sx * 0.006, Y(1.24), z, 0.053), ani(hx + sx * 0.012, Y(1.17), z + 0.004, 0.05)], ropa.top, { seg: 10, v: 0.97 });
  }
  loft(b, [ani(x, Y(1.405), z, 0.056), ani(x, Y(1.435), z, 0.05)], claro(ropa.top, 0.45), { seg: 12 });
  b.pieza(s('camisa'), 4, 'crece', { aristas: false });
}

// ---------------------------------------------------------------------------------------------------------------
// MERCANCÍA DE FORMAS VARIADAS: botellas, latas, frascos, cajas y bolsas (sin texto ni marcas).
// ---------------------------------------------------------------------------------------------------------------
const TAM = { botella: [0.062, 0.17], lata: [0.066, 0.12], frasco: [0.07, 0.08], caja: [0.09, 0.12], bolsa: [0.1, 0.15], estuche: [0.12, 0.05] };

/** Paleta de mercancía viva y sobria (sin colores de marca): se usa con tapas y bandas de contraste. */
export const VIVA = [0xc8453a, 0x2f6fb0, 0xe0a82e, 0x3f9a64, 0x7d4fa8, 0xe9e4d8, 0x2b2f36, 0xd9772b, 0x2f9aa6];
const TAPA = [0x2b2f36, 0xefefef, 0xd9b13b, 0x8a8f96];

/** Dibuja un artículo con la base en y y centro en (x, z). s escala; cada tipo lleva 2 o 3 tonos (cuerpo, tapa o banda). */
function articulo(b, tipo, x, y, z, s, col, rng) {
  const [w0, h0] = TAM[tipo], w = w0 * s, h = h0 * s, r = w / 2, tapa = rng.elegir(TAPA), banda = claro(col, 0.72);
  if (tipo === 'botella') {
    b.pilar(x, y, z, r, h * 0.6, col, 8); b.pilar(x, y + h * 0.22, z, r * 1.02, h * 0.22, banda, 8); b.pilar(x, y + h * 0.6, z, r * 0.45, h * 0.3, mezcla(col, P.negro, 0.3), 6); b.pilar(x, y + h * 0.9, z, r * 0.52, h * 0.1, tapa, 6);
  } else if (tipo === 'lata') {
    b.pilar(x, y, z, r, h, col, 8); b.pilar(x, y + h * 0.3, z, r * 1.02, h * 0.34, banda, 8); b.pilar(x, y + h, z, r * 0.88, 0.006, P.metal, 8);
  } else if (tipo === 'frasco') {
    b.pilar(x, y, z, r, h * 0.78, claro(col, 0.18), 8); b.pilar(x, y + h * 0.25, z, r * 1.02, h * 0.28, col, 8); b.pilar(x, y + h * 0.78, z, r * 0.92, h * 0.22, tapa, 8);
  } else if (tipo === 'bolsa') {
    b.tronco(x, y, z, w, w * 0.4, w * 0.88, w * 0.62, h * 0.92, col, { sin: '-y' }); b.caja(x, y + h * 0.92, z, w * 0.9, h * 0.08, w * 0.2, tapa); b.caja(x, y + h * 0.3, z + w * 0.2, w * 0.6, h * 0.3, 0.004, banda, { sin: '-y' });
  } else if (tipo === 'estuche') {
    b.caja(x, y, z, w, h, w * 0.7, col); b.caja(x, y + h * 0.5, z + w * 0.35, w * 0.7, h * 0.1, 0.003, tapa, { sin: '-y' }); b.caja(x, y + h, z, w * 1.002, 0.003, w * 0.702, tapa, { sin: '-y' });
  } else {
    const hh = h * rng.rango(0.8, 1.15); b.caja(x, y, z, w, hh, w * 0.8, col, { v: rng.rango(0.95, 1.05) }); b.caja(x, y + hh * 0.5, z, w * 1.004, hh * 0.18, w * 0.8 * 1.004, tapa, { sin: '-y+y' });
  }
  return w;
}

/**
 * Hilera(s) de artículos sobre un entrepaño entre x0..x1, z0..z1, con alto máximo hmax.
 * o.tipos: tipos permitidos; o.escala; o.filas (por defecto 1, o 2 si cabe).
 */
export function surtido(b, x0, x1, y, z0, z1, hmax, rng, paleta, o = {}) {
  const tipos = o.tipos ?? ['botella', 'lata', 'frasco', 'caja', 'bolsa'], esc = o.escala ?? 1;
  const filas = o.filas ?? ((z1 - z0) > 0.3 ? 2 : 1), dz = (z1 - z0) / filas;
  for (let f = 0; f < filas; f++) {
    const zc = z0 + dz * (f + 0.5);
    let x = x0 + 0.015;
    for (let n = 0; n < 200; n++) {
      const t = rng.elegir(tipos), s = Math.min(rng.rango(0.8, 1.05) * esc, hmax / TAM[t][1] * 1.0), w = TAM[t][0] * s;
      if (x + w > x1 - 0.005) break;
      articulo(b, t, x + w / 2, y, zc, s, rng.elegir(paleta), rng);
      x += w + rng.rango(0.006, 0.02);
    }
  }
}
