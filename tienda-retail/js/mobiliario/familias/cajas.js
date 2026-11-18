// Zona cajas: mueble de caja con banda, pantalla y área de empaque; caja de mostrador.
import { P, claro } from './comun.js';

const TOPE = claro(P.metal, 0.35), PANTALLA = 0x7fa6c4;

/** Estante escalonado de impulso (chicles, dulces): tres peldaños con bloques diminutos. */
function exhibidorImpulso(b, c, x, y, z, w) {
  b.caja(x, y, z, w, 0.04, 0.2, P.oscuro); b.caja(x, y + 0.04, z - 0.03, w - 0.04, 0.04, 0.14, P.oscuro); b.caja(x, y + 0.08, z - 0.06, w - 0.08, 0.04, 0.08, P.oscuro);
  b.pieza('exhibidor de impulso', 3, 'escala');
  b.merc(x - w / 2 + 0.02, x + w / 2 - 0.02, y + 0.04, z + 0.0, z + 0.09, 0.04, c, { wmin: 0.035, wmax: 0.06, hmin: 0.7 });
  b.merc(x - w / 2 + 0.04, x + w / 2 - 0.04, y + 0.08, z - 0.05, z + 0.01, 0.04, c, { wmin: 0.035, wmax: 0.06, hmin: 0.7 });
  b.merc(x - w / 2 + 0.06, x + w / 2 - 0.06, y + 0.12, z - 0.075, z - 0.035, 0.04, c, { wmin: 0.035, wmax: 0.06, hmin: 0.7 });
  b.pieza('mercancía de impulso', 4, 'crece', { aristas: false });
}
/** Terminal de cobro: pie, pantalla de dos caras (cliente y cajero) y lector. */
function terminal(b, x, y, z, w, h) {
  b.caja(x, y, z, 0.08, 0.03, 0.08, P.oscuro); b.caja(x, y + 0.03, z, w, h, 0.03, P.negro);
  b.caja(x, y + 0.045, z + 0.0165, w - 0.04, h - 0.03, 0.004, PANTALLA); b.caja(x, y + 0.045, z - 0.0165, w - 0.04, h - 0.03, 0.004, PANTALLA);
  b.caja(x + w / 2 + 0.1, y, z + 0.07, 0.09, 0.025, 0.06, P.oscuro); b.caja(x - w / 2 - 0.1, y, z, 0.1, 0.02, 0.07, P.metalOscuro);
  b.pieza('terminal de cobro', 3, 'escala');
}

/** Mueble de caja (checkout): banda al lado del cliente (+z), cajero al lado -z, empaque al extremo. */
export function mueble_caja(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c;
  b.caja(0, 0, 0, W - 0.06, 0.08, D - 0.06, P.oscuro); b.pieza('base', 0, 'despliega');
  b.caja(0, 0.08, 0, W, 0.62, D - 0.016, P.blanco);
  for (const s of [-1, 1]) b.caja(0, 0.3, s * (D / 2 - 0.004), W - 0.04, 0.14, 0.008, acento, { sin: '-y' });
  b.pieza('cuerpo del mueble', 1, 'crece');
  b.caja(0, 0.7, 0, W, 0.04, D, TOPE); b.pieza('cubierta', 2, 'cae');
  const bx = -0.26, bw = 0.98;
  b.caja(bx, 0.74, 0.2, bw, 0.03, 0.4, P.metalOscuro); b.caja(bx, 0.77, 0.2, bw - 0.04, 0.012, 0.32, P.oscuro);
  for (let i = 0; i < 6; i++) b.caja(bx - bw / 2 + 0.1 + i * 0.16, 0.782, 0.2, 0.014, 0.004, 0.32, P.tela, { sin: '-y' });
  b.caja(bx, 0.77, 0.4 - 0.012, bw, 0.03, 0.024, P.metal); b.caja(bx, 0.77, 0.012, bw, 0.03, 0.024, P.metal);
  b.pieza('banda transportadora', 2, 'desliza');
  b.caja(0.5, 0.74, 0.22, 0.44, 0.012, 0.32, 0xd9dde0); b.caja(0.44, 0.752, 0.26, 0.12, 0.13, 0.08, 0xe8d9b5); b.caja(0.58, 0.752, 0.18, 0.1, 0.1, 0.07, P.blanco);
  b.pieza('área de empaque', 3, 'cae');
  terminal(b, 0.35, 0.74, -0.18, 0.26, 0.15);
  exhibidorImpulso(b, c, -0.53, 0.74, -0.2, 0.4);
}

/** Caja de mostrador: cuerpo bajo, cubierta, terminal y exhibidor. */
export function caja_mostrador(b, c) {
  const { ancho: W, fondo: D, acento } = c;
  b.caja(0, 0, 0, W - 0.06, 0.08, D - 0.06, P.oscuro); b.pieza('base', 0, 'despliega');
  b.caja(0, 0.08, 0, W, 0.78, D - 0.016, P.blanco);
  for (const s of [-1, 1]) b.caja(0, 0.36, s * (D / 2 - 0.004), W - 0.04, 0.14, 0.008, acento, { sin: '-y' });
  b.pieza('cuerpo', 1, 'crece');
  b.caja(0, 0.86, 0, W, 0.04, D, TOPE); b.pieza('cubierta', 2, 'cae');
  terminal(b, -0.3, 0.9, -0.05, 0.22, 0.07);
  exhibidorImpulso(b, c, 0.37, 0.9, -0.1, 0.32);
}
