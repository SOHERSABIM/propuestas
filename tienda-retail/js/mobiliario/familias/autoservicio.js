// Zona autoservicio: góndola central doble, cabecera, estantería mural y exhibidor isla.
// Nivel de detalle R1: postes con cremallera y zapatas niveladoras, ménsulas, entrepaños con labio frontal y portaprecios con
// etiquetas, respaldos ranurados, y mercancía con formas variadas (botellas, latas, frascos, bolsas, cajas, cartones).
import { mezcla } from '../piezas.js';
import { P, claro, cremallera, etiquetas, zapatas, cesta } from './comun.js';

const oscuro = (h, t = 0.35) => mezcla(h, 0x000000, t);
const METAL_CLARO = claro(P.metal, 0.55), RANURA = 0x4a5159, LABIO = claro(P.metal, 0.75);
const MIX = {
  bajo: { caja: 3, bolsa: 3, botella: 2, carton: 2 },
  medio: { lata: 3, botella: 1, frasco: 2, caja: 3, bolsa: 2, carton: 1 },
  alto: { frasco: 2, caja: 4, bolsa: 2, lata: 2 },
};
const mixDe = (l, n) => (l === 0 ? MIX.bajo : l >= n - 1 ? MIX.alto : MIX.medio);

/** Entrepaño de una cara: plancha, labio frontal doblado, ménsulas en cada poste y portaprecios (en otra pieza). */
function plancha(b, x0, x1, y, z0, z1, s, xsPostes) {
  const zc = (z0 + z1) / 2, d = Math.abs(z1 - z0), zf = s > 0 ? Math.max(z0, z1) : Math.min(z0, z1);
  b.caja((x0 + x1) / 2, y, zc, x1 - x0, 0.022, d, P.blanco);
  b.caja((x0 + x1) / 2, y - 0.026, zf - s * 0.007, x1 - x0, 0.048, 0.014, LABIO);
  b.caja((x0 + x1) / 2, y - 0.012, zf - s * 0.0135, x1 - x0, 0.01, 0.007, claro(P.metal, 0.4), { sin: '-y' });
  b.caja((x0 + x1) / 2, y + 0.022, zc - s * (d / 2 - 0.006), x1 - x0, 0.012, 0.012, LABIO, { sin: '-y' }); // pestaña trasera
  for (const xp of xsPostes) { b.caja(xp, y - 0.05, zc, 0.036, 0.05, d - 0.03, P.oscuro, { sin: '-y' }); b.caja(xp, y - 0.05, zc - s * (d / 2 - 0.02), 0.036, 0.05, 0.03, P.negro); }
}

/** Góndola central doble: base con zapatas, postes con cremallera, respaldo ranurado, entrepaños con labio y portaprecios, mercancía. */
export function gondola_central(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t;
  const nL = H < 1.6 ? 4 : H < 1.9 ? 5 : 6, y1 = 0.2, paso = (H - 0.44 - y1) / (nL - 1), zb = D / 2 - 0.01;
  const xp = []; for (let i = 0; i <= t; i++) xp.push(Math.min(W / 2 - 0.015, Math.max(-W / 2 + 0.015, -W / 2 + i * mod)));
  const xi = xp.slice(1, -1);
  // base: zócalo retranqueado, rodón superior y zapatas niveladoras
  b.caja(0, 0.03, 0, W - 0.08, 0.06, D - 0.16, P.oscuro); b.caja(0, 0.09, 0, W - 0.05, 0.03, D - 0.05, P.metalOscuro);
  zapatas(b, xp.flatMap((x) => [[x, D / 2 - 0.09], [x, -D / 2 + 0.09]]), 0.02, 0.03);
  b.pieza('base y zócalo', 0, 'despliega');
  xp.forEach((x, i) => {
    if (i === 0 || i === t) {
      const s = i === 0 ? -1 : 1;
      b.caja(x, 0.03, 0, 0.03, H - 0.08, D - 0.02, P.metal); b.caja(x - s * 0.0155, 0.03, 0, 0.002, 0.12, D - 0.02, P.metalOscuro);
      for (const z of [-(D / 2 - 0.06), D / 2 - 0.06]) cremallera(b, x + s * 0.0155, z, 0.28, H - 0.2, s > 0 ? '+x' : '-x', { ancho: 0.016 });
      b.caja(x, H - 0.1, 0, 0.034, 0.04, D - 0.02, METAL_CLARO);
    } else {
      b.caja(x, 0.03, 0, 0.05, H - 0.08, 0.1, P.metalOscuro);
      for (const dz of [1, -1]) cremallera(b, x, dz * 0.051, 0.2, H - 0.14, dz > 0 ? '+z' : '-z', { ancho: 0.016, paso: 0.05 });
    }
    b.pieza(`costado ${i + 1}`, 1, 'crece', { aristas: i === 0 || i === t });
  });
  b.caja(0, 0.12, 0, W - 0.06, H - 0.17, 0.04, METAL_CLARO);
  for (const dz of [1, -1]) for (let y = 0.2; y < H - 0.2; y += 0.075) for (let m = 0; m < t; m++) b.lamZ(-W / 2 + (m + 0.5) * mod, y, dz * 0.0215, mod - 0.12, 0.022, RANURA, dz);
  b.pieza('respaldo central', 2, 'crece', { aristas: false });
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso;
    for (const s of [1, -1]) plancha(b, -W / 2 + 0.03, W / 2 - 0.03, y, s * 0.035, s * zb, s, xi);
    b.pieza(`entrepaño ${l + 1}`, 3, 'despliega');
    for (const s of [1, -1]) {
      b.caja(0, y - 0.034, s * (zb + 0.002), W - 0.08, 0.03, 0.006, acento, { sin: '-y' });
      etiquetas(b, -W / 2 + 0.05, W / 2 - 0.05, y - 0.03, s * (zb + 0.005), s, P.blanco, 0xf2cf4a, 0.12);
    }
    b.pieza(`cenefa ${l + 1}`, 3, 'despliega', { aristas: false });
  }
  b.agrupar((p) => p.nombre.startsWith('costado '), 'costados y postes', 1, 'crece', { aristas: true });
  b.agrupar((p) => p.nombre.startsWith('cenefa '), 'portaprecios', 3, 'despliega');
  for (const sz of [-1, 1]) { b.caja(0, H - 0.14, sz * (D / 2 - 0.006), W - 0.04, 0.07, 0.012, acento); b.caja(0, H - 0.075, sz * (D / 2 - 0.006), W - 0.04, 0.012, 0.016, P.blanco); }
  for (const x of xp) if (x === xp[0] || x === xp[xp.length - 1]) b.caja(x, H - 0.05, 0, 0.034, 0.03, D - 0.02, acento);
  b.pieza('remate superior', 3, 'cae', { caida: 0.35 });
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso + 0.022, hm = l === nL - 1 ? Math.min(0.25, H - 0.17 - y) : paso - 0.05, mix = mixDe(l, nL), esc = 1 + Math.max(0, nL * t - 12) * 0.045;
    b.mercV(-W / 2 + 0.05, W / 2 - 0.05, y, 0.05, zb - 0.02, hm, c, { atras: '-z', mix, esc });
    b.mercV(-W / 2 + 0.05, W / 2 - 0.05, y, -(zb - 0.02), -0.05, hm, c, { atras: '+z', mix, esc });
    b.pieza(`mercancía ${l + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Cabecera de góndola: una cara, entrepaños con labio y portaprecios, rótulo promocional con marco y repisa. */
export function cabecera_gondola(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c, nL = 4, y1 = 0.2, paso = (H - 0.5 - y1) / (nL - 1), zf = D / 2 - 0.02;
  b.caja(0, 0.03, 0, W - 0.08, 0.06, D - 0.12, P.oscuro); b.caja(0, 0.09, 0, W - 0.05, 0.03, D - 0.04, P.metalOscuro);
  zapatas(b, [[-W / 2 + 0.05, D / 2 - 0.07], [W / 2 - 0.05, D / 2 - 0.07], [-W / 2 + 0.05, -D / 2 + 0.07], [W / 2 - 0.05, -D / 2 + 0.07]], 0.02, 0.03);
  b.pieza('base y zócalo', 0, 'despliega');
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.015);
    b.caja(x, 0.03, 0, 0.03, H - 0.07, D - 0.02, P.metal); b.caja(x, 0.03, 0, 0.034, 0.1, D - 0.02, P.metalOscuro);
    for (const z of [-(D / 2 - 0.06), D / 2 - 0.06]) cremallera(b, x + s * 0.0155, z, 0.28, H - 0.32, s > 0 ? '+x' : '-x', { ancho: 0.016 });
    b.pieza(`costado ${s < 0 ? 'izq' : 'der'}`, 1, 'crece');
  }
  b.caja(0, 0.12, -D / 2 + 0.02, W - 0.06, H - 0.16, 0.03, METAL_CLARO);
  for (let y = 0.2; y < H - 0.4; y += 0.1) b.lamZ(0, y, -D / 2 + 0.0365, W - 0.16, 0.016, RANURA, 1);
  b.pieza('respaldo', 2, 'crece', { aristas: false });
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso;
    plancha(b, -W / 2 + 0.03, W / 2 - 0.03, y, -D / 2 + 0.035, zf, 1, [-W / 2 + 0.03 + 0.02, W / 2 - 0.05]);
    b.pieza(`entrepaño ${l + 1}`, 3, 'despliega');
    b.caja(0, y - 0.034, zf + 0.002, W - 0.08, 0.03, 0.006, acento, { sin: '-y' });
    etiquetas(b, -W / 2 + 0.05, W / 2 - 0.05, y - 0.03, zf + 0.005, 1, P.blanco, 0xf2cf4a, 0.12);
    b.pieza(`cenefa ${l + 1}`, 3, 'despliega', { aristas: false });
  }
  // cenefa promocional: caja con marco, cara frontal y tapa con repisa
  b.caja(0, H - 0.12, D / 2 - 0.02, W, 0.12, 0.04, acento);
  for (const sx of [-1, 1]) b.caja(sx * (W / 2 - 0.015), H - 0.2, 0, 0.03, 0.03, D - 0.04, acento); // remate fino sobre los costados
  b.caja(0, H - 0.115, D / 2 + 0.003, W - 0.1, 0.01, 0.01, P.blanco); b.caja(0, H - 0.03, D / 2 + 0.003, W - 0.1, 0.01, 0.01, P.blanco);
  b.lamZ(0, H - 0.105, D / 2 + 0.0095, W - 0.14, 0.07, claro(acento, 0.3), 1);
  b.pieza('cenefa promocional', 3, 'cae');
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso + 0.022;
    if (l === 0) { // exhibición masiva: cartones de promoción apilados en dos alturas
      const PROMO = [0xd2452f, 0x2f6fb5, 0xe8a526, 0x3f9a5a], n = Math.floor((W - 0.12) / 0.2), dd = zf - 0.02 - (-D / 2 + 0.06);
      for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
        const col = PROMO[(i + k * 2) % 4], x = -W / 2 + 0.06 + 0.1 + i * 0.2, yy = y + k * 0.095, zc = (zf - 0.02 + (-D / 2 + 0.06)) / 2;
        b.caja(x, yy, zc, 0.19, 0.09, dd, col, { sin: '-y' }); b.lamZ(x, yy + 0.02, zf - 0.0195, 0.15, 0.05, P.blanco, 1); b.lamZ(x, yy + 0.077, zf - 0.0195, 0.19, 0.013, oscuro(col), 1);
      }
    } else b.mercV(-W / 2 + 0.05, W / 2 - 0.05, y, -D / 2 + 0.05, zf - 0.01, l === nL - 1 ? Math.min(0.3, H - 0.24 - y) : paso - 0.05, c, { atras: '-z', mix: mixDe(l, nL) });
    b.pieza(`mercancía ${l + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Estantería mural: respaldo ranurado, postes con cremallera, ménsulas, entrepaños con labio y portaprecios, cornisa con luminaria. */
export function estanteria_mural(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t;
  const nL = H > 2.3 ? 7 : 6, y1 = 0.22, paso = (H - 0.42 - y1) / (nL - 1), zw = -D / 2 + 0.035, zf = D / 2 - 0.012;
  b.caja(0, 0.05, 0, W - 0.08, 0.04, D - 0.12, P.oscuro); b.caja(0, 0.09, 0.0, W - 0.04, 0.03, D - 0.04, P.metalOscuro);
  zapatas(b, Array.from({ length: t + 1 }, (_, i) => [Math.min(W / 2 - 0.05, Math.max(-W / 2 + 0.05, -W / 2 + i * mod)), D / 2 - 0.07]), 0.028, 0.05, P.negro);
  b.pieza('base y zócalo', 0, 'despliega');
  const xs = []; for (let i = 0; i <= t; i++) xs.push(Math.min(W / 2 - 0.0225, Math.max(-W / 2 + 0.0225, -W / 2 + i * mod)));
  xs.forEach((x, i) => {
    b.caja(x, 0.03, -D / 2 + 0.03, 0.045, H - 0.1, 0.05, P.metalOscuro);
    cremallera(b, x, -D / 2 + 0.056, 0.22, H - 0.2, '+z', { ancho: 0.016 });
    b.pieza(`poste de pared ${i + 1}`, 1, 'crece', { aristas: false });
  });
  for (let m = 0; m < t; m++) {
    const xm = -W / 2 + (m + 0.5) * mod;
    b.caja(xm, 0.12, -D / 2 + 0.014, mod - 0.05, H - 0.24, 0.02, METAL_CLARO);
    for (let y = 0.16; y < H - 0.2; y += 0.07) b.lamZ(xm, y, -D / 2 + 0.0255, mod - 0.1, 0.02, RANURA, 1); // panel ranurado
    b.pieza(`panel de respaldo ${m + 1}`, 2, 'crece', { aristas: false });
  }
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso;
    plancha(b, -W / 2 + 0.03, W / 2 - 0.03, y, zw, zf, 1, xs.slice(1, -1));
    for (const x of xs) { // ménsula: brazo inferior y escuadra
      b.caja(x, y - 0.05, (zw + zf) / 2, 0.02, 0.012, D - 0.12, P.metalOscuro, { sin: '-y' }); b.barra([x, y - 0.002, zf - 0.07], [x, y - 0.14, zw + 0.02], 0.014, P.metalOscuro);
    }
    b.pieza(`entrepaño ${l + 1}`, 3, 'despliega');
    b.caja(0, y - 0.034, zf + 0.0, W - 0.08, 0.03, 0.006, acento, { sin: '-y' });
    etiquetas(b, -W / 2 + 0.05, W / 2 - 0.05, y - 0.03, zf + 0.003, 1, P.blanco, 0xf2cf4a, 0.12);
    b.pieza(`cenefa ${l + 1}`, 3, 'despliega', { aristas: false });
  }
  b.agrupar((p) => p.nombre.startsWith('poste de pared'), 'postes de pared', 1, 'crece');
  b.agrupar((p) => p.nombre.startsWith('panel de respaldo'), 'paneles de respaldo', 2, 'crece');
  b.agrupar((p) => p.nombre.startsWith('cenefa '), 'portaprecios', 3, 'despliega');
  b.caja(0, H - 0.05, D / 2 - 0.05, W, 0.03, 0.1, acento); b.caja(0, H - 0.075, D / 2 - 0.04, W - 0.04, 0.025, 0.05, P.blanco); b.caja(0, H - 0.0775, D / 2 - 0.04, W - 0.06, 0.004, 0.04, P.led, { sin: '+y' });
  b.pieza('cornisa', 3, 'cae', { caida: 0.35 });
  for (let l = 0; l < nL; l++) {
    const y = y1 + l * paso + 0.022;
    b.mercV(-W / 2 + 0.05, W / 2 - 0.05, y, zw + 0.015, zf - 0.015, l === nL - 1 ? H - 0.12 - y : paso - 0.05, c, { atras: '-z', mix: mixDe(l, nL), dens: 1.1 });
    b.pieza(`mercancía ${l + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Exhibidor promocional tipo isla: plataforma con zócalo, mástil delgado, cuatro cestas de varilla y rótulo con marco. */
export function exhibidor_isla_promo(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c;
  b.caja(0, 0.025, 0, W - 0.04, 0.075, D - 0.04, P.madera); b.caja(0, 0.1, 0, W - 0.1, 0.02, D - 0.1, claro(acento, 0.35)); b.caja(0, 0.0, 0, W - 0.16, 0.025, D - 0.16, P.oscuro);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.caja(sx * (W / 2 - 0.1), 0.12, sz * (D / 2 - 0.1), 0.05, 0.004, 0.05, P.metal, { sin: '-y' });
  b.pieza('base', 0, 'despliega');
  b.pilar(0, 0.12, 0, 0.026, H - 0.12, P.metalOscuro, 10); b.pilar(0, 0.12, 0, 0.07, 0.04, P.metal, 12); b.pilar(0, 0.16, 0, 0.04, 0.03, P.metalOscuro, 10);
  b.pieza('mástil', 1, 'crece', { aristas: false });
  const q = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  q.forEach(([sx, sz], i) => {
    const bx = sx * 0.31, bz = sz * 0.31;
    cesta(b, bx, 0.125, bz, 0.5, 0.5, 0.2, { rod: 0.065, color: claro(acento, 0.15), rim: acento });
    b.barra([sx * 0.045, 0.2, sz * 0.045], [bx - sx * 0.2, 0.2, bz - sz * 0.2], 0.018, P.metalOscuro); // brazo al mástil
    b.pieza(`bandeja ${i + 1}`, 3, 'cae', { caida: 0.4 });
  });
  b.caja(0, H - 0.34, 0, W - 0.2, 0.3, 0.05, acento); b.caja(0, H - 0.34, 0, W - 0.28, 0.04, 0.07, P.blanco);
  for (const dz of [1, -1]) { b.lamZ(0, H - 0.31, dz * 0.0255, W - 0.32, 0.22, claro(acento, 0.35), dz); b.lamZ(0, H - 0.29, dz * 0.0262, W - 0.5, 0.06, P.blanco, dz); }
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.1), H - 0.34, 0, 0.012, 0.3, 0.07, P.blanco);
  b.pieza('rótulo superior', 3, 'cae', { caida: 0.4 });
  q.forEach(([sx, sz], i) => {
    const bx = sx * 0.31, bz = sz * 0.31;
    b.mercV(bx - 0.23, bx + 0.23, 0.14, bz - 0.23, bz, 0.26, c, { atras: '-z', mix: { caja: 3, bolsa: 3, frasco: 2, botella: 2, lata: 2 }, dens: 1.2 });
    b.mercV(bx - 0.23, bx + 0.23, 0.14, bz, bz + 0.23, 0.2, c, { atras: '+z', mix: { frasco: 3, lata: 3, caja: 2, bolsa: 2 }, dens: 1.2 });
    b.pieza(`mercancía ${i + 1}`, 4, 'crece', { aristas: false });
  });
}
