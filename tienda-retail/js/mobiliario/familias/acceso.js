// Zona acceso: carritos anidados, canastillas de mano y tarima de aparador con maniquíes.
import { P, claro, maniqui } from './comun.js';
import { mezcla } from '../piezas.js';

const REJILLA = 0xc3c8cd;
const OUTFITS = [{ top: 0xd99a8a, bottom: 0x5d6a75 }, { top: 0x8fb2d1, bottom: 0xa67950 }, { top: 0xb7a3c9, bottom: 0x33373c }, { top: 0xe8d9b5, bottom: 0x76808e }];

/** Un carrito con su juego de piezas; dz desplaza a lo largo (nido), baja baja la canasta (el de atrás queda más abajo). */
function carro(b, c, dz, baja, w, k) {
  const y0 = 0.3 - baja, yt = 0.8 - baja, zc = dz + 0.05, L = 0.64, mango = c.acento;
  for (const s of [-1, 1]) b.caja(s * (w / 2 - 0.05), 0.12, dz, 0.03, 0.03, 0.62, P.metalOscuro);
  b.caja(0, 0.12, dz - 0.25, w - 0.1, 0.03, 0.03, P.metalOscuro); b.caja(0, 0.12, dz + 0.27, w - 0.1, 0.03, 0.03, P.metalOscuro);
  for (const s of [-1, 1]) b.caja(s * (w / 2 - 0.07), 0.15, zc, 0.025, y0 - 0.15, 0.025, P.metalOscuro);
  b.pieza(`chasis ${k}`, 0, 'crece');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cil('x', sx * (w / 2 - 0.05), 0.05, dz + sz * 0.27, 0.05, 0.035, P.negro, 6); b.pieza(`rueda ${k}`, 1, 'escala', { aristas: false }); }
  b.tronco(0, y0, zc, w - 0.14, L - 0.14, w, L, yt - y0, REJILLA, { sin: '-y+y' });
  b.tronco(0, y0 + 0.012, zc, w - 0.17, L - 0.17, w - 0.03, L - 0.03, yt - y0 - 0.012, claro(REJILLA, 0.3), { sin: '-y+y', inv: true });
  b.caja(0, y0, zc, w - 0.16, 0.012, L - 0.16, claro(REJILLA, 0.3), { sin: '-y+x-x+z-z' });
  b.caja(0, yt - 0.01, zc + L / 2 - 0.01, w, 0.02, 0.02, P.metalOscuro); b.caja(0, yt - 0.01, zc - L / 2 + 0.01, w, 0.02, 0.02, P.metalOscuro);
  for (const s of [-1, 1]) b.caja(s * (w / 2 - 0.01), yt - 0.01, zc, 0.02, 0.02, L, P.metalOscuro);
  b.pieza(`canasta ${k}`, 2, 'cae');
  for (const s of [-1, 1]) b.caja(s * (w / 2 - 0.08), yt - 0.02, zc - L / 2 - 0.02, 0.025, 0.2, 0.025, P.metalOscuro);
  b.cil('x', 0, yt + 0.17, zc - L / 2 - 0.02 + 0.0125, 0.016, w - 0.12, mango, 8); b.pieza(`manija ${k}`, 3, 'crece', { aristas: false });
}

/** Carrito de compras con un segundo carrito anidado detrás. */
export function carrito(b, c) {
  const { ancho: W } = c;
  carro(b, c, 0.12, 0, W - 0.04, 'A');
  carro(b, c, -0.1, 0.06, W - 0.1, 'B');
}

/** Canastillas de mano: una por tramo, con asa plegada. */
export function canastilla(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t, col = mezcla(acento, 0xffffff, 0.1), hb = H - 0.05;
  for (let i = 0; i < t; i++) {
    const x = -W / 2 + (i + 0.5) * mod, w = mod - 0.02, d = D - 0.02;
    b.tronco(x, 0, 0, w - 0.06, d - 0.06, w, d, hb, col, { sin: '-y+y', v: 0.98 });
    b.tronco(x, 0.012, 0, w - 0.09, d - 0.09, w - 0.03, d - 0.03, hb - 0.012, claro(col, 0.25), { sin: '-y+y', inv: true });
    b.caja(x, 0, 0, w - 0.07, 0.012, d - 0.07, claro(col, 0.25), { sin: '-y+x-x+z-z' });
    b.caja(x, hb - 0.015, d / 2 - 0.01, w, 0.015, 0.02, col); b.caja(x, hb - 0.015, -d / 2 + 0.01, w, 0.015, 0.02, col);
    for (const s of [-1, 1]) b.caja(x + s * (w / 2 - 0.01), hb - 0.015, 0, 0.02, 0.015, d - 0.04, col);
    b.pieza(`canasta ${i + 1}`, 0, 'cae');
    for (const s of [-1, 1]) b.caja(x + s * (w / 2 - 0.05), hb, 0, 0.012, H - hb - 0.0, 0.012, P.metalOscuro);
    b.caja(x, H - 0.012, 0, w - 0.08, 0.012, 0.012, P.metalOscuro);
    b.pieza(`asa ${i + 1}`, 1, 'crece', { aristas: false });
  }
}

/**
 * Tarima de aparador: estructura, tablero, forro y maniquíes sobre ella.
 * Desviación documentada: los maniquíes sobresalen del alto de 0.30 m del catálogo (la huella en planta no cambia).
 */
export function tarima_aparador(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, rng } = c, mod = W / t;
  b.caja(0, 0, 0, W - 0.06, H - 0.03, D - 0.06, P.oscuro); b.pieza('estructura', 0, 'despliega');
  b.caja(0, 0, D / 2 - 0.008, W, H - 0.03, 0.016, 0xe9e7e2); b.caja(0, 0, -D / 2 + 0.008, W, H - 0.03, 0.016, 0xe9e7e2);
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.008), 0, 0, 0.016, H - 0.03, D - 0.032, 0xe9e7e2);
  b.pieza('forro', 1, 'crece');
  b.caja(0, H - 0.03, 0, W, 0.03, D, claro(P.madera, 0.3)); b.pieza('tablero', 2, 'cae');
  for (let i = 0; i < t; i++) for (const dx of [-0.45, 0.45]) maniqui(b, -W / 2 + (i + 0.5) * mod + dx, 0, H, rng.elegir(OUTFITS), `${i * 2 + (dx < 0 ? 1 : 2)}`);
}
