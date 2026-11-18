// Zona autoservicio: góndola central doble, cabecera, estantería mural y exhibidor isla.
import { P, claro } from './comun.js';

const METAL_CLARO = claro(P.metal, 0.55);

/** Góndola central doble: base, costados por tramo, respaldo central, entrepaños y cenefas por nivel, mercancía por nivel. */
export function gondola_central(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t;
  const nL = H < 1.6 ? 4 : H < 1.9 ? 5 : 6, y1 = 0.2, paso = (H - 0.44 - y1) / (nL - 1), zb = D / 2 - 0.01;
  b.caja(0, 0, 0, W - 0.06, 0.12, D - 0.08, P.oscuro); b.pieza('base y zócalo', 0, 'despliega');
  for (let i = 0; i <= t; i++) {
    const x = Math.min(W / 2 - 0.015, Math.max(-W / 2 + 0.015, -W / 2 + i * mod));
    b.caja(x, 0, 0, 0.03, H - 0.05, D - 0.02, P.metal); b.pieza(`costado ${i + 1}`, 1, 'crece');
  }
  b.caja(0, 0.12, 0, W - 0.06, H - 0.17, 0.04, METAL_CLARO); b.pieza('respaldo central', 2, 'crece');
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso;
    for (const s of [1, -1]) b.caja(0, y, s * (0.035 + zb) / 2, W - 0.06, 0.03, zb - 0.035, P.blanco);
    b.pieza(`entrepaño ${l + 1}`, 3, 'despliega');
    for (const s of [1, -1]) b.caja(0, y - 0.035, s * (zb + 0.002), W - 0.06, 0.05, 0.012, acento, { sin: '-y' });
    b.pieza(`cenefa ${l + 1}`, 3, 'despliega', { aristas: false });
  }
  b.caja(0, H - 0.05, 0, W, 0.05, D, acento); b.pieza('tapa superior', 3, 'cae');
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso + 0.03, hm = l === nL - 1 ? H - 0.07 - y : paso - 0.05;
    b.merc(-W / 2 + 0.04, W / 2 - 0.04, y, 0.05, zb - 0.02, hm, c, { atras: '-z' });
    b.merc(-W / 2 + 0.04, W / 2 - 0.04, y, -(zb - 0.02), -0.05, hm, c, { atras: '+z' });
    b.pieza(`mercancía ${l + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Cabecera de góndola: una cara, rótulo promocional arriba. */
export function cabecera_gondola(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c, nL = 4, y1 = 0.2, paso = (H - 0.5 - y1) / (nL - 1);
  b.caja(0, 0, 0, W - 0.06, 0.12, D - 0.06, P.oscuro); b.pieza('base y zócalo', 0, 'despliega');
  for (const s of [-1, 1]) { b.caja(s * (W / 2 - 0.015), 0, 0, 0.03, H - 0.04, D - 0.02, P.metal); b.pieza(`costado ${s < 0 ? 'izq' : 'der'}`, 1, 'crece'); }
  b.caja(0, 0.12, -D / 2 + 0.02, W - 0.06, H - 0.16, 0.03, METAL_CLARO); b.pieza('respaldo', 2, 'crece');
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso;
    b.caja(0, y, 0.02, W - 0.06, 0.03, D - 0.06, P.blanco); b.pieza(`entrepaño ${l + 1}`, 3, 'despliega');
    b.caja(0, y - 0.035, D / 2 - 0.005, W - 0.06, 0.05, 0.012, acento, { sin: '-y' }); b.pieza(`cenefa ${l + 1}`, 3, 'despliega', { aristas: false });
  }
  b.caja(0, H - 0.2, D / 2 - 0.02, W, 0.2, 0.04, acento); b.caja(0, H - 0.2, -0.02, W, 0.2, D - 0.04, acento, { sin: '-y+z' });
  b.pieza('cenefa promocional', 3, 'cae');
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso + 0.03;
    b.merc(-W / 2 + 0.04, W / 2 - 0.04, y, -D / 2 + 0.05, D / 2 - 0.03, l === nL - 1 ? H - 0.22 - y : paso - 0.05, c, { atras: '-z', wmin: 0.12, wmax: 0.26 });
    b.pieza(`mercancía ${l + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Estantería mural pegada al muro (respaldo en -z). */
export function estanteria_mural(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t;
  const nL = H > 2.3 ? 7 : 6, y1 = 0.22, paso = (H - 0.42 - y1) / (nL - 1);
  b.caja(0, 0, 0.0, W - 0.06, 0.12, D - 0.04, P.oscuro); b.pieza('base y zócalo', 0, 'despliega');
  for (let i = 0; i <= t; i++) {
    const x = Math.min(W / 2 - 0.0225, Math.max(-W / 2 + 0.0225, -W / 2 + i * mod));
    b.caja(x, 0, -D / 2 + 0.02, 0.045, H - 0.1, 0.04, P.metalOscuro); b.pieza(`poste de pared ${i + 1}`, 1, 'crece');
  }
  for (let m = 0; m < t; m++) { b.caja(-W / 2 + (m + 0.5) * mod, 0.12, -D / 2 + 0.014, mod - 0.05, H - 0.24, 0.02, METAL_CLARO); b.pieza(`panel de respaldo ${m + 1}`, 2, 'crece'); }
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso, z0 = -D / 2 + 0.035;
    b.caja(0, y, (z0 + D / 2) / 2, W - 0.06, 0.03, D / 2 - z0, P.blanco); b.pieza(`entrepaño ${l + 1}`, 3, 'despliega');
    b.caja(0, y - 0.035, D / 2 - 0.005, W - 0.06, 0.05, 0.012, acento, { sin: '-y' }); b.pieza(`cenefa ${l + 1}`, 3, 'despliega', { aristas: false });
  }
  b.caja(0, H - 0.12, 0, W, 0.12, D, acento); b.pieza('cornisa', 3, 'cae');
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso + 0.03;
    b.merc(-W / 2 + 0.04, W / 2 - 0.04, y, -D / 2 + 0.05, D / 2 - 0.03, l === nL - 1 ? H - 0.14 - y : paso - 0.05, c, { atras: '-z', wmin: 0.12, wmax: 0.26 });
    b.pieza(`mercancía ${l + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Exhibidor promocional tipo isla: plataforma, mástil con rótulo de dos caras y cuatro bandejas con mercancía. */
export function exhibidor_isla_promo(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c;
  b.caja(0, 0, 0, W, 0.1, D, P.madera); b.caja(0, 0.1, 0, W - 0.1, 0.02, D - 0.1, claro(acento, 0.35)); b.pieza('base', 0, 'despliega');
  b.caja(0, 0.12, 0, 0.12, H - 0.12, 0.12, P.metalOscuro); b.pieza('mástil', 1, 'crece');
  const q = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  q.forEach(([sx, sz], i) => { b.tronco(sx * 0.31, 0.12, sz * 0.31, 0.44, 0.44, 0.52, 0.52, 0.22, P.blanco, { sin: '-y+y' }); b.caja(sx * 0.31, 0.12, sz * 0.31, 0.44, 0.05, 0.44, P.metal); b.pieza(`bandeja ${i + 1}`, 3, 'cae'); });
  b.caja(0, H - 0.34, 0, W - 0.2, 0.3, 0.05, acento); b.caja(0, H - 0.34, 0, W - 0.28, 0.04, 0.07, P.blanco); b.pieza('rótulo superior', 3, 'cae');
  q.forEach(([sx, sz], i) => {
    b.merc(sx * 0.31 - 0.23, sx * 0.31 + 0.23, 0.34, sz * 0.31 - 0.24, sz * 0.31, 0.3, c, { wmin: 0.11, wmax: 0.2 });
    b.merc(sx * 0.31 - 0.23, sx * 0.31 + 0.23, 0.34, sz * 0.31, sz * 0.31 + 0.24, 0.2, c, { wmin: 0.11, wmax: 0.2 });
    b.pieza(`mercancía ${i + 1}`, 4, 'crece', { aristas: false });
  });
}
