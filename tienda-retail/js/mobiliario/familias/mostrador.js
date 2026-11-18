// Zona mostrador de servicio: vitrina de cristal, mostrador y estantería de alta densidad.
import { P, claro } from './comun.js';

const LIGERO = 0xe9e3d6;

/** Vitrina de cristal: gabinete bajo, marco, cristales, entrepaño de cristal, LED y producto pequeño. */
export function vitrina_cristal(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t;
  b.caja(0, 0, 0, W - 0.04, 0.08, D - 0.04, P.oscuro); b.pieza('base', 0, 'despliega');
  b.caja(0, 0.08, 0, W, 0.34, D - 0.016, LIGERO); b.caja(0, 0.3, D / 2 - 0.004, W - 0.04, 0.06, 0.008, acento, { sin: '-y' }); b.pieza('cuerpo bajo', 1, 'crece');
  for (let i = 0; i <= t; i++) {
    const x = Math.min(W / 2 - 0.015, Math.max(-W / 2 + 0.015, -W / 2 + i * mod));
    for (const s of [-1, 1]) b.caja(x, 0.42, s * (D / 2 - 0.02), 0.03, H - 0.45, 0.03, P.metalOscuro);
    b.pieza(`montante ${i + 1}`, 1, 'crece');
  }
  b.caja(0, 0.42, -D / 2 + 0.015, W - 0.06, H - 0.5, 0.015, 0xd9e6ec); b.pieza('fondo de espejo', 2, 'crece');
  const yt = H - 0.04;
  b.caja(0, yt, D / 2 - 0.015, W, 0.04, 0.03, P.metalOscuro); b.caja(0, yt, -D / 2 + 0.015, W, 0.04, 0.03, P.metalOscuro);
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.015), yt, 0, 0.03, 0.04, D - 0.06, P.metalOscuro);
  b.pieza('marco superior', 2, 'despliega');
  b.caja(0, H - 0.075, 0, W - 0.1, 0.012, 0.03, P.led); b.pieza('luz LED', 2, 'despliega', { aristas: false });
  b.vidrioZ(0, 0.43, D / 2 - 0.02, W - 0.04, H - 0.5); b.vidrioY(0, H - 0.02, 0, W - 0.04, D - 0.04);
  for (const s of [-1, 1]) b.vidrioX(s * (W / 2 - 0.02), 0.43, 0, D - 0.04, H - 0.5);
  b.pieza('cristales', 3, 'crece');
  b.vidrioY(0, 0.66, 0, W - 0.08, D - 0.1); b.caja(0, 0.655, D / 2 - 0.06, W - 0.08, 0.012, 0.012, 0xcfe6ee); b.pieza('entrepaño de cristal', 3, 'despliega');
  for (const [y, nom, hm] of [[0.42, 'repisa baja', 0.17], [0.672, 'repisa alta', 0.17]]) {
    b.merc(-W / 2 + 0.06, W / 2 - 0.06, y, -D / 2 + 0.06, D / 2 - 0.08, hm, c, { wmin: 0.06, wmax: 0.12, hmin: 0.4 });
    b.pieza(`producto ${nom}`, 4, 'crece', { aristas: false });
  }
}

/** Mostrador de servicio: zócalo, cuerpo con faldones, cubierta con voladizo, terminales y exhibidor frontal. */
export function mostrador_servicio(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t;
  b.caja(0, 0, 0, W - 0.06, 0.08, D - 0.08, P.oscuro); b.pieza('base', 0, 'despliega');
  b.caja(0, 0.08, -0.05, W - 0.02, 0.8, D - 0.1, LIGERO); b.pieza('cuerpo', 1, 'crece');
  for (let m = 0; m < t; m++) {
    for (let k = 0; k < 15; k++) b.caja(-W / 2 + m * mod + 0.1 + k * ((mod - 0.2) / 14), 0.12, D / 2 - 0.045, 0.09, 0.67, 0.02, k % 2 ? P.madera : P.maderaOscura);
    b.pieza(`faldón ${m + 1}`, 1, 'crece', { aristas: false });
  }
  b.caja(0, 0.88, 0, W, 0.05, D, claro(P.madera, 0.25)); b.caja(0, 0.79, D / 2 - 0.045, W - 0.04, 0.06, 0.02, acento, { sin: '-y' });
  b.pieza('cubierta', 2, 'cae');
  for (let m = 0; m < t; m++) {
    const x = -W / 2 + (m + 0.5) * mod + 0.7;
    b.caja(x, 0.93, -0.1, 0.07, 0.04, 0.07, P.oscuro); b.caja(x, 0.97, -0.1, 0.3, 0.07, 0.03, P.negro); b.caja(x, 0.98, -0.083, 0.26, 0.05, 0.004, 0x7fa6c4); b.caja(x + 0.28, 0.93, -0.05, 0.1, 0.025, 0.07, P.metalOscuro);
    b.pieza(`terminal de cobro ${m + 1}`, 3, 'escala');
  }
  b.caja(-W / 2 + 0.55, 0.93, 0.18, 0.7, 0.03, 0.3, P.maderaOscura); b.caja(-W / 2 + 0.55, 0.96, 0.12, 0.6, 0.04, 0.18, P.maderaOscura); b.pieza('exhibidor frontal', 3, 'cae');
  b.merc(-W / 2 + 0.25, -W / 2 + 0.85, 0.96, 0.17, 0.34, 0.07, c, { wmin: 0.05, wmax: 0.09, hmin: 0.6 });
  b.merc(-W / 2 + 0.3, -W / 2 + 0.8, 1.0, 0.07, 0.17, 0.05, c, { wmin: 0.05, wmax: 0.09, hmin: 0.6 });
  b.pieza('producto del exhibidor', 4, 'crece', { aristas: false });
}

/** Estantería de alta densidad: postes azules, entrepaños, divisores, etiquetas y cajas de refacciones. */
export function estanteria_alta_densidad(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t, N = 7, paso = (H - 0.18 - 0.12) / (N - 1) - 0.005;
  b.caja(0, 0, 0, W - 0.05, 0.06, D - 0.05, P.oscuro); b.pieza('base', 0, 'despliega');
  for (let i = 0; i <= t; i++) {
    const x = Math.min(W / 2 - 0.0225, Math.max(-W / 2 + 0.0225, -W / 2 + i * mod));
    for (const s of [-1, 1]) b.caja(x, 0, s * (D / 2 - 0.0225), 0.045, H, 0.045, P.rackAzul);
    b.pieza(`postes ${i + 1}`, 1, 'crece');
  }
  const ys = Array.from({ length: N }, (_, l) => 0.12 + l * paso);
  ys.forEach((y, l) => { b.caja(0, y, 0, W - 0.05, 0.02, D - 0.04, claro(P.metal, 0.4)); b.pieza(`entrepaño ${l + 1}`, 3, 'despliega'); });
  ys.forEach((y, l) => {
    for (let m = 0; m < t; m++) for (const k of [1, 2]) b.caja(-W / 2 + m * mod + (k * mod) / 3, y + 0.02, 0, 0.008, 0.2, D - 0.12, P.metal);
    b.pieza(`divisores ${l + 1}`, 3, 'crece', { aristas: false });
  });
  for (const [l, y] of ys.entries()) for (let m = 0; m < t; m++) b.caja(-W / 2 + (m + 0.5) * mod, y - 0.012, D / 2 - 0.004, 0.07, 0.028, 0.008, P.blanco, { sin: '-y' });
  b.pieza('etiquetas de ubicación', 3, 'crece', { aristas: false });
  const CAJAS = [P.carton, 0xd6b88c, 0xb8956a, 0xe6dcc8, P.blanco];
  ys.forEach((y, l) => {
    const hm = Math.min(0.26, l === N - 1 ? H - y - 0.05 : paso - 0.04);
    b.merc(-W / 2 + 0.04, W / 2 - 0.04, y + 0.02, -D / 2 + 0.07, D / 2 - 0.05, hm, { rng: c.rng, paleta: CAJAS }, { wmin: 0.15, wmax: 0.3, hmin: 0.6 });
    b.pieza(`cajas de refacciones ${l + 1}`, 4, 'crece', { aristas: false });
  });
}
