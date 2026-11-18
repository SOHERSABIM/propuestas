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
}

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

/** Camisa (o abrigo si larga y L grande) colgada de gancho de hombros. Ancho total ≈ 0.37 a escala 1. */
export function camisa(m, c, { L = 0.46, larga = false, w = 0.27, gancho: cg = P.blanco } = {}) {
  gancho(m, w * 0.62, cg, false);
  m.tronco(0, -0.095 - L, 0, w * 0.95, 0.04, w, 0.04, L - 0.03, c, { sin: '-y' });
  m.tronco(0, -0.125, 0, w, 0.04, w * 0.55, 0.036, 0.03, claro(c, 0.08), { sin: '-y' });
  for (const s of [-1, 1]) m.barra([s * w * 0.46, -0.113, 0], [s * (w * 0.5 + 0.035), -0.113 - (larga ? 0.4 : 0.13), 0], 0.05, c, { v: 0.97 });
  m.tronco(0, -0.108, 0, 0.1, 0.046, 0.075, 0.046, 0.03, claro(c, 0.5), { sin: '-y' });
  m.caja(0, -0.095 - L, 0, 0.024, L - 0.06, 0.044, claro(c, 0.3), { sin: '-y+y' });
}

/** Pantalón colgado de gancho de barra por la pretina. */
export function pantalon(m, c, { L = 0.5, gancho: cg = P.oscuro } = {}) {
  gancho(m, 0.15, cg, true);
  m.caja(0, -0.125, 0, 0.27, 0.04, 0.052, mezcla(c, 0x33373c, 0.25), { sin: '-y' });
  for (const s of [-1, 1]) {
    m.tronco(s * 0.068, -0.125 - L, 0, 0.1, 0.05, 0.13, 0.054, L, c, { sin: '-y+y' });
    m.tronco(s * 0.068, -0.125 - L, 0, 0.105, 0.056, 0.105, 0.056, 0.03, claro(c, 0.14), { sin: '-y+y' });
  }
}

/** Vestido: corpiño, cinturón y falda acampanada. */
export function vestido(m, c, { L = 0.64, gancho: cg = P.blanco } = {}) {
  gancho(m, 0.12, cg, false);
  m.tronco(0, -0.3, 0, 0.2, 0.04, 0.26, 0.04, 0.205, c, { sin: '-y' });
  for (const s of [-1, 1]) m.barra([s * 0.11, -0.095, 0], [s * 0.15, -0.14, 0], 0.045, c, { v: 0.97 });
  m.caja(0, -0.32, 0, 0.21, 0.022, 0.046, mezcla(c, 0x33373c, 0.4), { sin: '-y' });
  m.tronco(0, -0.3 - L, 0, 0.38, 0.065, 0.21, 0.046, L - 0.0, claro(c, 0.04), { sin: '-y+y' });
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
// MANIQUÍ de proporción humana abstracta (sin rostro). Mantiene la firma del de comun.js: (b, x, z, y0, ropa, k).
// Alto total ≈ 1.71 m sobre y0; ancho ≤ 0.46; base de 0.30 m de diámetro.
// ---------------------------------------------------------------------------------------------------------------
export function maniquiDetallado(b, x, z, y0, ropa, k = '') {
  const piel = 0xe9e6e0, sombra = 0xd9d5cd, s = (n) => (k ? `${n} ${k}` : n);
  // base: plato con escalón y tapa del tubo trasero
  b.pilar(x, y0, z, 0.15, 0.014, P.oscuro, 18); b.pilar(x, y0 + 0.014, z, 0.13, 0.008, P.metalOscuro, 18); b.pilar(x, y0 + 0.022, z - 0.07, 0.022, 0.012, P.metal, 8);
  b.pieza(s('base'), 0, 'escala');
  // piernas: pies, tobillo, pantorrilla, rodilla, muslo; varilla de soporte trasera
  for (const sx of [-1, 1]) {
    const px = x + sx * 0.085;
    b.caja(px, y0 + 0.022, z + 0.03, 0.08, 0.05, 0.21, sombra);
    b.tronco(px, y0 + 0.072, z, 0.055, 0.06, 0.085, 0.09, 0.34, piel, { sin: '-y' });
    b.esfera(px, y0 + 0.43, z, 0.05, piel, 8);
    b.tronco(px, y0 + 0.43, z, 0.095, 0.1, 0.15, 0.17, 0.36, piel, { sin: '-y' });
  }
  b.pilar(x, y0 + 0.034, z - 0.07, 0.009, 0.82, P.metalOscuro, 6); b.caja(x, y0 + 0.82, z - 0.09, 0.05, 0.03, 0.05, P.metalOscuro);
  b.pieza(s('poste y piernas'), 1, 'crece');
  // tronco, cuello y brazos
  b.tronco(x, y0 + 0.78, z, 0.285, 0.175, 0.315, 0.195, 0.12, piel, { sin: '-y' });
  b.tronco(x, y0 + 0.9, z, 0.315, 0.195, 0.255, 0.165, 0.17, piel);
  b.tronco(x, y0 + 1.07, z, 0.255, 0.165, 0.335, 0.205, 0.2, piel);
  b.tronco(x, y0 + 1.27, z, 0.335, 0.205, 0.395, 0.16, 0.13, piel);
  b.pilar(x, y0 + 1.39, z, 0.038, 0.12, sombra, 8);
  for (const sx of [-1, 1]) {
    const ax = x + sx * 0.195;
    b.esfera(ax, y0 + 1.36, z, 0.042, piel, 8);
    b.barra([ax, y0 + 1.36, z], [ax + sx * 0.008, y0 + 1.1, z + 0.01], 0.06, piel);
    b.barra([ax + sx * 0.008, y0 + 1.1, z + 0.01], [ax + sx * 0.004, y0 + 0.88, z + 0.07], 0.048, piel);
    b.tronco(ax + sx * 0.004, y0 + 0.79, z + 0.075, 0.05, 0.03, 0.045, 0.05, 0.1, sombra);
  }
  b.pieza(s('torso'), 2, 'crece', { aristas: false });
  // cabeza ovoide sin rostro
  b.esfera(x, y0 + 1.625, z, 0.086, piel, 10); b.esfera(x, y0 + 1.575, z + 0.008, 0.066, piel, 8);
  b.pieza(s('cabeza'), 2, 'escala', { aristas: false });
  // pantalón: piernas en dos tramos con dobladillo, pretina y cinturón
  for (const sx of [-1, 1]) {
    const px = x + sx * 0.082;
    b.tronco(px, y0 + 0.1, z, 0.09, 0.095, 0.125, 0.125, 0.36, ropa.bottom, { sin: '-y' });
    b.tronco(px, y0 + 0.46, z, 0.125, 0.125, 0.17, 0.19, 0.4, ropa.bottom, { sin: '-y' });
    b.tronco(px, y0 + 0.1, z, 0.095, 0.1, 0.095, 0.1, 0.025, claro(ropa.bottom, 0.15), { sin: '-y' });
  }
  b.tronco(x, y0 + 0.86, z, 0.335, 0.2, 0.31, 0.19, 0.08, ropa.bottom); b.caja(x, y0 + 0.92, z, 0.315, 0.022, 0.195, mezcla(ropa.bottom, 0x17191c, 0.5));
  b.pieza(s('pantalón'), 4, 'crece', { aristas: false });
  // camisa: faldón, pecho, hombros, mangas cortas y cuello
  b.tronco(x, y0 + 0.9, z, 0.31, 0.205, 0.355, 0.23, 0.32, ropa.top, { sin: '-y' });
  b.tronco(x, y0 + 1.22, z, 0.355, 0.23, 0.42, 0.185, 0.17, ropa.top);
  for (const sx of [-1, 1]) b.barra([x + sx * 0.192, y0 + 1.37, z], [x + sx * 0.2, y0 + 1.16, z + 0.01], 0.075, ropa.top);
  b.tronco(x, y0 + 1.385, z, 0.1, 0.1, 0.085, 0.085, 0.03, claro(ropa.top, 0.4), { sin: '-y' });
  b.caja(x, y0 + 0.9, z + 0.116, 0.026, 0.5, 0.004, claro(ropa.top, 0.3), { sin: '-y+x-x-z' });
  b.pieza(s('camisa'), 4, 'crece', { aristas: false });
}

// ---------------------------------------------------------------------------------------------------------------
// MERCANCÍA DE FORMAS VARIADAS: botellas, latas, frascos, cajas y bolsas (sin texto ni marcas).
// ---------------------------------------------------------------------------------------------------------------
const TAM = { botella: [0.062, 0.17], lata: [0.066, 0.12], frasco: [0.07, 0.08], caja: [0.09, 0.12], bolsa: [0.1, 0.15], estuche: [0.12, 0.05] };

/** Dibuja un artículo con la base en y y centro en (x, z). s escala; devuelve el ancho ocupado. */
function articulo(b, tipo, x, y, z, s, col, rng) {
  const [w0, h0] = TAM[tipo], w = w0 * s, h = h0 * s, r = w / 2;
  if (tipo === 'botella') {
    b.pilar(x, y, z, r, h * 0.6, col, 8); b.pilar(x, y + h * 0.6, z, r * 0.45, h * 0.3, col, 6); b.pilar(x, y + h * 0.9, z, r * 0.52, h * 0.1, claro(col, 0.55), 6);
  } else if (tipo === 'lata') {
    b.pilar(x, y, z, r, h, col, 8); b.pilar(x, y + h, z, r * 0.88, 0.006, P.metal, 8);
  } else if (tipo === 'frasco') {
    b.pilar(x, y, z, r, h * 0.78, claro(col, 0.25), 8); b.pilar(x, y + h * 0.78, z, r * 0.92, h * 0.22, mezcla(col, P.oscuro, 0.35), 8);
  } else if (tipo === 'bolsa') {
    b.tronco(x, y, z, w, w * 0.4, w * 0.88, w * 0.62, h * 0.92, col, { sin: '-y' }); b.caja(x, y + h * 0.92, z, w * 0.9, h * 0.08, w * 0.2, claro(col, 0.3));
  } else if (tipo === 'estuche') {
    b.caja(x, y, z, w, h, w * 0.7, col); b.caja(x, y + h * 0.5, z + w * 0.35, w * 0.7, h * 0.08, 0.002, claro(col, 0.5), { sin: '-y' });
  } else {
    const hh = h * rng.rango(0.8, 1.15); b.caja(x, y, z, w, hh, w * 0.8, col, { v: rng.rango(0.95, 1.05) }); b.caja(x, y + hh * 0.55, z, w * 1.002, hh * 0.1, w * 0.8 * 1.002, claro(col, 0.4), { sin: '-y+y' });
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
