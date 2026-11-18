// Utilidades comunes a las familias: contexto de construcción, maniquí y prenda reutilizables.
import { PALETA } from '../../core/estilo.js';
import { mezcla } from '../piezas.js';

export const P = PALETA.mob;
export const claro = (hex, t = 0.5) => mezcla(hex, 0xffffff, t);

/** Prenda plana colgada: caja delgada de ancho w (en el plano), alto h y grosor g, girada ry. */
export function prenda(b, cx, ytop, cz, w, h, g, color, ry = 0, v = 1) {
  b.caja(cx, ytop - h, cz, g, h, w, color, { sin: '-y', ry, v });
}

/**
 * Maniquí abstracto sin rostro. Emite piezas con el sufijo k.
 * @param {number} y0 altura de la base (0 en piso; 0.30 sobre una tarima)
 * @param {{top:number, bottom:number}} ropa colores de las prendas
 */
export function maniqui(b, x, z, y0, ropa, k = '') {
  const piel = 0xe9e6e0, s = (n) => (k ? `${n} ${k}` : n);
  b.pilar(x, y0, z, 0.15, 0.025, P.oscuro, 14); b.pilar(x, y0, z, 0.05, 0.06, P.metalOscuro, 8);
  b.pieza(s('base'), 0, 'escala');
  b.tronco(x - 0.075, y0 + 0.03, z, 0.06, 0.06, 0.1, 0.1, 0.86, piel); b.tronco(x + 0.075, y0 + 0.03, z, 0.06, 0.06, 0.1, 0.1, 0.86, piel);
  b.pieza(s('poste y piernas'), 1, 'crece');
  b.tronco(x, y0 + 0.9, z, 0.3, 0.2, 0.38, 0.22, 0.5, piel); b.tronco(x, y0 + 1.4, z, 0.38, 0.22, 0.42, 0.2, 0.05, piel);
  b.pieza(s('torso'), 2, 'crece');
  b.pilar(x, y0 + 1.45, z, 0.03, 0.1, piel, 8); b.esfera(x, y0 + 1.63, z, 0.085, piel, 8);
  b.pieza(s('cabeza'), 2, 'escala');
  b.tronco(x - 0.078, y0 + 0.34, z, 0.115, 0.125, 0.125, 0.135, 0.6, ropa.bottom); b.tronco(x + 0.078, y0 + 0.34, z, 0.115, 0.125, 0.125, 0.135, 0.6, ropa.bottom);
  b.pieza(s('pantalón'), 4, 'crece', { aristas: false });
  b.tronco(x, y0 + 0.93, z, 0.33, 0.215, 0.425, 0.235, 0.5, ropa.top, { sin: '-y' });
  b.pieza(s('camisa'), 4, 'crece', { aristas: false });
}

/**
 * Cremallera (columna de ranuras de ajuste de entrepaños): láminas oscuras sobre una cara plana.
 * cara: '+z'|'-z'|'+x'|'-x'; (x, z) = posición de la columna sobre esa cara (la coordenada normal ya viene en x o z).
 */
export function cremallera(b, x, z, y0, y1, cara, { ancho = 0.012, paso = 0.05, alto = 0.022, color = P.metalOscuro } = {}) {
  const dir = cara[0] === '+' ? 1 : -1;
  for (let y = y0; y < y1 - alto; y += paso) {
    if (cara[1] === 'z') b.lamZ(x, y, z + dir * 0.0015, ancho, alto, color, dir);
    else b.lamX(x + dir * 0.0015, y, z, ancho, alto, color, dir);
  }
}
/** Hilera de rótulos de precio (láminas pequeñas alternadas) sobre un portaprecios a lo largo de x. */
export function etiquetas(b, x0, x1, y, z, dir, color, color2, paso = 0.14) {
  let k = 0;
  for (let x = x0 + paso / 2; x < x1 - 0.03; x += paso, k++) b.lamZ(x, y, z + dir * 0.0015, 0.065, 0.02, k % 3 ? color2 : color, dir);
}
/** Patas niveladoras (zapatas): cilindros cortos bajo la base. */
export function zapatas(b, pts, r = 0.022, h = 0.03, color = P.negro) { for (const [x, z] of pts) b.pilar(x, 0, z, r, h, color, 6); }
