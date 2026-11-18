// Zona cajas: mueble de caja con banda, separador, lector, terminal, pantalla, cajón y porta-bolsas; caja de mostrador.
import { P, claro, zapatas } from './comun.js';

const TOPE = claro(P.metal, 0.35), PANTALLA = 0x7fa6c4, CINTA = 0x2b2f34;

/** Estante escalonado de impulso (chicles, dulces): tres peldaños con labio y artículos diminutos. */
function exhibidorImpulso(b, c, x, y, z, w) {
  b.caja(x, y, z, w, 0.04, 0.2, P.oscuro); b.caja(x, y + 0.04, z - 0.03, w - 0.04, 0.04, 0.14, P.oscuro); b.caja(x, y + 0.08, z - 0.06, w - 0.08, 0.04, 0.08, P.oscuro);
  for (const [k, zz] of [[0, z + 0.1], [1, z + 0.04], [2, z - 0.02]]) b.caja(x, y + k * 0.04 + 0.025, zz - 0.0, w - k * 0.04, 0.012, 0.008, P.blanco, { sin: '-y' });
  b.caja(x, y + 0.12, z - 0.1, w - 0.08, 0.045, 0.008, P.metalOscuro); // mampara trasera
  b.pieza('exhibidor de impulso', 3, 'escala');
  const mix = { caja: 4, bolsa: 3, frasco: 1 };
  b.mercV(x - w / 2 + 0.02, x + w / 2 - 0.02, y + 0.04, z + 0.0, z + 0.09, 0.05, c, { atras: '-z', mix, esc: 0.4, dens: 1 });
  b.mercV(x - w / 2 + 0.04, x + w / 2 - 0.04, y + 0.08, z - 0.05, z + 0.01, 0.05, c, { atras: '-z', mix, esc: 0.4 });
  b.mercV(x - w / 2 + 0.06, x + w / 2 - 0.06, y + 0.12, z - 0.075, z - 0.035, 0.05, c, { atras: '-z', mix, esc: 0.4 });
  b.pieza('mercancía de impulso', 4, 'crece', { aristas: false });
}

/** Terminal de cobro: pie articulado, pantalla de dos caras, teclado con lector de tarjetas y lector de código de barras. */
function terminal(b, x, y, z, w, h, conTeclado = true) {
  b.caja(x, y, z, 0.1, 0.012, 0.1, P.oscuro); b.cil('y', x, y + 0.03, z, 0.012, 0.04, P.metalOscuro, 6); b.caja(x, y + 0.045, z, w * 0.3, 0.02, 0.03, P.metalOscuro);
  b.caja(x, y + 0.062, z, w, h, 0.03, P.negro);
  b.caja(x, y + 0.077, z + 0.0165, w - 0.04, h - 0.03, 0.004, PANTALLA); b.caja(x, y + 0.077, z - 0.0165, w - 0.04, h - 0.03, 0.004, PANTALLA);
  for (const [dz, i] of [[0.0185, 1], [-0.0185, -1]]) for (let k = 0; k < 3; k++) b.lamZ(x - w / 2 + 0.07 + k * 0.05, y + 0.1 + k * 0.01, z + dz, 0.04, 0.012, claro(PANTALLA, 0.6), i);
  if (conTeclado) {
    b.caja(x + w / 2 + 0.12, y, z + 0.06, 0.1, 0.03, 0.14, P.oscuro);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) b.lamY(x + w / 2 + 0.09 + k * 0.03, y + 0.0305, z + 0.02 + r * 0.03, 0.022, 0.022, P.metal);
    b.caja(x + w / 2 + 0.12, y + 0.03, z + 0.13, 0.06, 0.008, 0.02, P.negro); // ranura de tarjetas
    b.caja(x - w / 2 - 0.15, y, z, 0.2, 0.018, 0.09, P.metalOscuro); // teclado del cajero
    for (let k = 0; k < 8; k++) b.lamY(x - w / 2 - 0.23 + k * 0.022, y + 0.0185, z, 0.016, 0.07, P.metal);
  }
  b.pieza('terminal de cobro', 3, 'escala');
}

/** Lector de código de barras de mesa: cuerpo, ventana inclinada y luz. */
function lector(b, x, y, z, ry = 0) {
  b.tronco(x, y, z, 0.15, 0.1, 0.15, 0.085, 0.07, P.metalOscuro, { ry }); b.caja(x, y + 0.071, z, 0.1, 0.004, 0.06, P.negro, { ry });
  b.caja(x, y + 0.04, z + 0.05, 0.03, 0.006, 0.004, P.led);
}

/** Porta-bolsas: base, mástil, brazos y bolsas colgadas (láminas). */
function portaBolsas(b, x, y, z) {
  b.caja(x, y, z, 0.16, 0.012, 0.1, P.metalOscuro); b.caja(x, y + 0.012, z - 0.03, 0.02, 0.2, 0.02, P.metal);
  b.barra([x, y + 0.2, z - 0.03], [x, y + 0.2, z + 0.02], 0.012, P.metal);
  for (const dx of [-0.05, 0, 0.05]) b.caja(x + dx, y + 0.06, z + 0.015, 0.03, 0.14, 0.0035, claro(P.mercancia?.[0] ?? 0xe8d9b5, 0.2), { sin: '-y' });
}

/** Mueble de caja (checkout): banda al lado del cliente (+z), cajero al lado -z, empaque al extremo. */
export function mueble_caja(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c;
  b.caja(0, 0.015, 0, W - 0.1, 0.065, D - 0.1, P.oscuro); zapatas(b, [[-W / 2 + 0.1, D / 2 - 0.1], [W / 2 - 0.1, D / 2 - 0.1], [-W / 2 + 0.1, -D / 2 + 0.1], [W / 2 - 0.1, -D / 2 + 0.1]], 0.02, 0.015);
  b.pieza('base', 0, 'despliega');
  b.caja(0, 0.08, 0, W, 0.62, D - 0.016, P.blanco);
  for (const s of [-1, 1]) b.caja(0, 0.3, s * (D / 2 - 0.004), W - 0.04, 0.14, 0.008, acento, { sin: '-y' });
  for (const x of [-W / 2 + 0.5, 0.0, W / 2 - 0.5]) { b.lamZ(x, 0.1, D / 2 - 0.0075, 0.004, 0.58, 0xc2c4c0, 1); }
  b.lamZ(0, 0.1, D / 2 - 0.0075, W - 0.06, 0.004, 0xc2c4c0, 1);
  // cajón de efectivo del lado del cajero: frente, hendidura de agarre y cerradura
  b.caja(0.2, 0.5, -(D / 2 - 0.016), 0.46, 0.1, 0.012, 0xd6d9dc); b.lamZ(0.2, 0.545, -(D / 2 - 0.0095) - 0.0, 0.2, 0.014, P.metalOscuro, -1); b.pilar(0.4, 0.55, -(D / 2 - 0.0115), 0.007, 0.012, P.metalOscuro, 6);
  b.caja(-0.45, 0.14, -(D / 2 - 0.01), 0.5, 0.3, 0.004, P.metalOscuro, { sin: '-y' }); b.lamZ(0.0, 0.1, -(D / 2 - 0.0075), 0.004, 0.4, 0xc2c4c0, -1);
  b.pieza('cuerpo del mueble', 1, 'crece');
  b.caja(0, 0.7, 0, W, 0.04, D, TOPE); b.caja(0, 0.742, D / 2 - 0.006, W, 0.006, 0.012, P.metalOscuro, { sin: '-y' }); b.caja(0, 0.742, -D / 2 + 0.006, W, 0.006, 0.012, P.metalOscuro, { sin: '-y' });
  b.cil('y', 0.2, 0.74, -0.3, 0.025, 0.004, P.negro, 8, { sinBase: true });
  b.pieza('cubierta', 2, 'cae');
  const bx = -0.26, bw = 0.98;
  b.caja(bx, 0.74, 0.2, bw, 0.03, 0.4, P.metalOscuro); b.caja(bx, 0.77, 0.2, bw - 0.04, 0.012, 0.32, CINTA);
  for (let i = 0; i < 12; i++) b.lamY(bx - bw / 2 + 0.07 + i * 0.077, 0.7821, 0.2, 0.012, 0.32, P.tela);
  b.caja(bx, 0.77, 0.4 - 0.012, bw, 0.03, 0.024, P.metal); b.caja(bx, 0.77, 0.012, bw, 0.03, 0.024, P.metal);
  for (const s of [-1, 1]) b.cil('z', bx + s * (bw / 2 - 0.03), 0.783, 0.2, 0.012, 0.32, P.metal, 8, { sinTapas: true });
  b.caja(bx + 0.18, 0.8, 0.384, 0.012, 0.03, 0.012, P.negro); b.caja(bx + 0.18, 0.8, 0.016, 0.012, 0.03, 0.012, P.negro); // fotocelda
  b.caja(bx + 0.28, 0.782, 0.2, 0.03, 0.045, 0.3, acento); b.caja(bx + 0.28, 0.782, 0.2, 0.012, 0.06, 0.34, claro(acento, 0.4)); // separador de pedido
  b.pieza('banda transportadora', 2, 'desliza');
  b.caja(0.5, 0.74, 0.22, 0.44, 0.012, 0.32, 0xd9dde0); b.caja(0.5, 0.752, 0.38, 0.44, 0.03, 0.01, P.metal); b.caja(0.5, 0.752, 0.06, 0.44, 0.03, 0.01, P.metal);
  b.caja(0.44, 0.752, 0.26, 0.12, 0.13, 0.08, 0xe8d9b5); b.caja(0.58, 0.752, 0.18, 0.1, 0.1, 0.07, P.blanco);
  b.lamZ(0.44, 0.8, 0.3005, 0.09, 0.03, claro(acento, 0.5), 1);
  portaBolsas(b, 0.66, 0.74, 0.04); portaBolsas(b, 0.34, 0.74, 0.04);
  b.pieza('área de empaque', 3, 'cae', { caida: 0.25 });
  lector(b, 0.0, 0.74, -0.085);
  terminal(b, 0.35, 0.74, -0.2, 0.26, 0.15);
  exhibidorImpulso(b, c, -0.53, 0.74, -0.2, 0.4);
}

/** Caja de mostrador: cuerpo bajo con cajón, cubierta, terminal, lector, impresora de tickets y exhibidor. */
export function caja_mostrador(b, c) {
  const { ancho: W, fondo: D, acento } = c;
  b.caja(0, 0.015, 0, W - 0.1, 0.065, D - 0.1, P.oscuro); zapatas(b, [[-W / 2 + 0.1, D / 2 - 0.08], [W / 2 - 0.1, D / 2 - 0.08], [-W / 2 + 0.1, -D / 2 + 0.08], [W / 2 - 0.1, -D / 2 + 0.08]], 0.02, 0.015);
  b.pieza('base', 0, 'despliega');
  b.caja(0, 0.08, 0, W, 0.72, D - 0.016, P.blanco);
  for (const s of [-1, 1]) b.caja(0, 0.33, s * (D / 2 - 0.004), W - 0.04, 0.14, 0.008, acento, { sin: '-y' });
  for (const x of [-W / 2 + 0.4, W / 2 - 0.4]) b.lamZ(x, 0.1, D / 2 - 0.0075, 0.004, 0.68, 0xc2c4c0, 1);
  b.caja(0.2, 0.62, -(D / 2 - 0.016), 0.4, 0.11, 0.012, 0xd6d9dc); b.lamZ(0.2, 0.67, -(D / 2 - 0.0095), 0.18, 0.014, P.metalOscuro, -1);
  // vano de impulso al frente (lado del cliente): nicho oscuro con dos repisas y producto de frente
  b.lamZ(-0.3, 0.5, D / 2 - 0.0075, 0.52, 0.26, P.oscuro, 1);
  for (const [k, y] of [[0, 0.52], [1, 0.64]]) {
    b.caja(-0.3, y, D / 2 - 0.0085, 0.52, 0.012, 0.004, P.metal);
    for (let i = 0; i < 6; i++) b.lamZ(-0.3 - 0.22 + i * 0.088 + 0.04, y + 0.014, D / 2 - 0.0072, 0.07, 0.1 - k * 0.02, c.paleta[(i + k * 3) % c.paleta.length], 1);
  }
  b.caja(0.3, 0.1, D / 2 - 0.0085, 0.6, 0.02, 0.004, P.negro); // zoclo retranqueado: sombra
  b.caja(0.3, 0.5, D / 2 - 0.009, 0.4, 0.14, 0.004, 0xd6d9dc); b.lamZ(0.3, 0.57, D / 2 - 0.0065, 0.2, 0.014, P.metalOscuro, 1); // cajón visible
  b.pieza('cuerpo', 1, 'crece');
  b.caja(0, 0.8, 0, W, 0.04, D, TOPE); b.caja(0, 0.842, D / 2 - 0.006, W, 0.006, 0.012, P.metalOscuro, { sin: '-y' }); b.cil('y', -0.05, 0.84, -0.22, 0.022, 0.004, P.negro, 8, { sinBase: true });
  b.pieza('cubierta', 2, 'cae');
  b.caja(-0.1, 0.84, 0.17, 0.1, 0.07, 0.1, P.oscuro); b.caja(-0.1, 0.84, 0.21, 0.08, 0.004, 0.03, P.led); // impresora de tickets
  lector(b, 0.1, 0.84, 0.18);
  terminal(b, -0.2, 0.84, -0.05, 0.22, 0.07);
  exhibidorImpulso(b, c, 0.37, 0.84, -0.1, 0.32);
}
