// Zona refrigerados: refrigerador vertical de puertas, cuarto frío con puertas de exhibición y congelador isla.
// Nivel de detalle R1: puertas con marco, empaque, jaladera y bisagras; parrillas de alambre; luz interior; rejilla inferior;
// cuarto frío de paneles con juntas, evaporadores con ventiladores y soportería; congelador con tapas corredizas y canastillas.
import { P, claro, cremallera, etiquetas, zapatas } from './comun.js';

const CREMA = 0xf1ecd9, ACERO = 0xc4c9ce, ALAMBRE = 0x8f969d, CANAST = 0x48525c, SATURADA = [0xd9503f, 0x3f86c9, 0xf0b83a, 0x4fae6f, 0xf6f6f2, 0x8a5fc4];

/** Puerta de cristal con marco, empaque interior, jaladera con soportes y bisagras. Cara frontal en z = zf (+z). */
function puertaVidrio(b, xc, y0, zf, w, h, ladoJal = 1) {
  const f = 0.032, d = 0.04;
  b.caja(xc - w / 2 + f / 2, y0, zf - d / 2, f, h, d, P.metalOscuro); b.caja(xc + w / 2 - f / 2, y0, zf - d / 2, f, h, d, P.metalOscuro);
  b.caja(xc, y0, zf - d / 2, w - 2 * f, f, d, P.metalOscuro); b.caja(xc, y0 + h - f, zf - d / 2, w - 2 * f, f, d, P.metalOscuro);
  // empaque (burlete) en el perímetro interior del marco
  const g = 0.016;
  b.caja(xc, y0 + f, zf - d + 0.004, w - 2 * f, g, 0.014, P.negro, { sin: '-y' }); b.caja(xc, y0 + h - f - g, zf - d + 0.004, w - 2 * f, g, 0.014, P.negro, { sin: '-y' });
  b.caja(xc - w / 2 + f + g / 2, y0 + f + g, zf - d + 0.004, g, h - 2 * f - 2 * g, 0.014, P.negro); b.caja(xc + w / 2 - f - g / 2, y0 + f + g, zf - d + 0.004, g, h - 2 * f - 2 * g, 0.014, P.negro);
  b.vidrioZ(xc, y0 + f, zf - 0.004, w - 2 * f, h - 2 * f);
  // jaladera vertical con dos soportes
  const xj = xc + ladoJal * (w / 2 - 0.075), hj = Math.min(0.62, h * 0.38), yj = y0 + h * 0.5 - hj / 2;
  b.caja(xj, yj, zf + 0.003, 0.03, hj, 0.024, 0xf1f3f5); b.caja(xj, yj + 0.01, zf + 0.0155, 0.012, hj - 0.02, 0.002, P.negro, { sin: '-y' }); b.caja(xj, yj + 0.03, zf - 0.008, 0.012, 0.016, 0.02, P.metalOscuro); b.caja(xj, yj + hj - 0.046, zf - 0.008, 0.012, 0.016, 0.02, P.metalOscuro);
  b.caja(xc - ladoJal * (w / 2 - f - 0.004), y0 + f + 0.02, zf - 0.006, 0.007, h - 2 * f - 0.04, 0.008, P.led); // LED en el poste
  // bisagras en el lado opuesto
  for (const k of [0.12, 0.5, 0.88]) b.caja(xc - ladoJal * (w / 2 - 0.012), y0 + k * (h - 0.06), zf + 0.004, 0.02, 0.06, 0.012, ACERO);
}

/** Parrilla de alambre: marco perimetral, alambres transversales (láminas) y riel portaprecios frontal. */
function parrilla(b, x0, x1, y, z0, z1, paso = 0.09) {
  const w = x1 - x0, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
  b.caja(xc, y, z1 - 0.008, w, 0.014, 0.016, ALAMBRE); b.caja(xc, y, z0 + 0.008, w, 0.014, 0.016, ALAMBRE);
  b.caja(x0 + 0.008, y, zc, 0.016, 0.014, z1 - z0 - 0.032, ALAMBRE, { sin: '-y' }); b.caja(x1 - 0.008, y, zc, 0.016, 0.014, z1 - z0 - 0.032, ALAMBRE, { sin: '-y' });
  for (let x = x0 + paso / 2; x < x1 - 0.02; x += paso) b.lamY(x, y + 0.0145, zc, 0.006, z1 - z0 - 0.03, 0x7c838b);
  b.caja(xc, y - 0.026, z1 + 0.002, w, 0.026, 0.008, P.blanco, { sin: '-y' }); // portaprecios
}

/** Refrigerador vertical: zócalo con rejilla, gabinete, parrillas de alambre, luz LED, puertas con marco y empaque, producto. */
export function refrigerador_vertical(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t, hCab = H - 0.26 - 0.12;
  b.caja(0, 0.02, 0, W - 0.04, 0.1, D - 0.06, P.oscuro);
  for (let m = 0; m < t; m++) {
    const xm = -W / 2 + (m + 0.5) * mod;
    b.caja(xm, 0.03, D / 2 - 0.028, mod - 0.2, 0.08, 0.006, P.negro);
    for (let k = 0; k < 5; k++) b.caja(xm, 0.04 + k * 0.016, D / 2 - 0.021, mod - 0.22, 0.007, 0.022, P.metalOscuro);
  }
  zapatas(b, [[-W / 2 + 0.06, D / 2 - 0.1], [W / 2 - 0.06, D / 2 - 0.1], [-W / 2 + 0.06, -D / 2 + 0.1], [W / 2 - 0.06, -D / 2 + 0.1]], 0.02, 0.02);
  b.pieza('base y zoclo', 0, 'despliega');
  for (const s of [-1, 1]) {
    b.caja(s * (W / 2 - 0.025), 0.12, 0, 0.05, hCab, D - 0.04, P.blanco);
    for (const z of [-(D / 2 - 0.12), D / 2 - 0.16]) cremallera(b, s * (W / 2 - 0.05), z, 0.3, hCab - 0.1, s > 0 ? '-x' : '+x', { ancho: 0.014, paso: 0.045 });
    b.caja(s * (W / 2 - 0.025), 0.12, D / 2 - 0.022, 0.054, hCab, 0.016, P.metalOscuro); // canto frontal
    b.pieza(`costado ${s < 0 ? 'izq' : 'der'}`, 1, 'crece');
  }
  b.caja(0, 0.12, -D / 2 + 0.02, W - 0.1, hCab, 0.04, CREMA);
  for (let m = 0; m < t; m++) { const xm = -W / 2 + (m + 0.5) * mod; for (let k = 0; k < 6; k++) b.lamZ(xm, hCab - 0.12 - k * 0.025, -D / 2 + 0.0415, mod - 0.5, 0.012, 0xc7c1a7, 1); }
  b.pieza('fondo interior', 1, 'crece', { aristas: false });
  b.caja(0, H - 0.26, 0, W, 0.26, D, claro(acento, 0.45)); b.caja(0, H - 0.3, D / 2 - 0.02, W - 0.1, 0.05, 0.02, P.led); b.caja(0, H - 0.06, D / 2 - 0.004, W - 0.02, 0.025, 0.008, acento);
  b.lamZ(0, H - 0.2, D / 2 + 0.002, W - 0.2, 0.12, claro(acento, 0.7), 1); for (let k = 0; k < 5; k++) b.lamZ(0, H - 0.18 + k * 0.02, D / 2 + 0.0035, W - 0.3, 0.008, claro(acento, 0.1), 1); b.caja(0, H - 0.015, 0, W - 0.1, 0.012, D - 0.1, claro(acento, 0.3), { sin: '-y' });
  b.pieza('cabecera', 1, 'cae');
  for (let i = 1; i < t; i++) {
    b.caja(-W / 2 + i * mod, 0.12, 0, 0.02, hCab, D - 0.1, P.blanco); b.caja(-W / 2 + i * mod, 0.12, D / 2 - 0.05, 0.034, hCab, 0.016, P.metalOscuro);
    b.pieza(`divisor ${i}`, 1, 'crece');
  }
  const niv = [0.39, 0.66, 0.93, 1.2, 1.47];
  niv.forEach((y, k) => { parrilla(b, -W / 2 + 0.06, W / 2 - 0.06, y, -D / 2 + 0.06, 0.22); b.pieza(`parrilla ${k + 1}`, 2, 'despliega', { aristas: false }); });
  for (const s of [-1, 1]) { b.caja(s * (W / 2 - 0.075), 0.14, D / 2 - 0.1, 0.035, hCab - 0.04, 0.02, P.led); }
  for (let i = 1; i < t; i++) for (const s of [-1, 1]) b.caja(-W / 2 + i * mod + s * 0.015, 0.14, D / 2 - 0.1, 0.01, hCab - 0.04, 0.012, P.led);
  b.caja(0, hCab + 0.05, D / 2 - 0.11, W - 0.14, 0.012, 0.02, P.led);
  b.pieza('luz LED', 2, 'crece', { aristas: false });
  for (let m = 0; m < t; m++) {
    const xm = -W / 2 + (m + 0.5) * mod, dw = (mod - 0.06) / 3, zf = D / 2 - 0.0, hd = hCab - 0.1;
    for (let k = 0; k < 3; k++) puertaVidrio(b, xm - mod / 2 + 0.03 + (k + 0.5) * dw, 0.14, zf, dw - 0.004, hd, k === 2 ? -1 : 1);
    b.pieza(`puertas de cristal ${m + 1}`, 3, 'crece', { aristas: false });
  }
  const ys = [0.12, ...niv.map((y) => y + 0.014)], mixR = { carton: 3, botella: 3, lata: 2, caja: 2, frasco: 1 };
  ys.forEach((y, k) => {
    b.mercV(-W / 2 + 0.08, W / 2 - 0.08, y, -D / 2 + 0.06, 0.2, 0.22, c, { atras: '-z', mix: mixR, dens: 1.5, esc: 1 + Math.max(0, t - 1) * 0.1 });
    b.pieza(`producto ${k + 1}`, 4, 'crece', { aristas: false });
  });
}

/** Cuarto frío: piso, muros de panel con juntas, frente de puertas de cristal con marco, techo, evaporadores con ventiladores, puerta de servicio y producto. */
export function camara_fria(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, n = 4 * t, pitch = (W - 0.2) / n, dw = pitch - 0.14, PANEL = 0xf0f0ee, JUNTA = 0xc9ccd0;
  b.caja(0, 0, 0, W, 0.06, D, 0xd6d9dc); b.caja(0, 0.06, 0, W - 0.3, 0.012, D - 0.6, 0xc6cacd, { sin: '-y' });
  for (let x = -W / 2 + 0.6; x < W / 2 - 0.3; x += 0.6) b.lamY(x, 0.0725, 0, 0.004, D - 0.6, 0xaeb3b8);
  b.pieza('piso aislado', 0, 'despliega', { aristas: false });
  b.caja(0, 0.06, -D / 2 + 0.07, W, H - 0.06, 0.1, PANEL);
  for (let x = -W / 2 + 1.0; x < W / 2 - 0.5; x += 1.0) b.lamZ(x, 0.1, -D / 2 + 0.122, 0.005, H - 0.3, JUNTA, 1);
  b.pieza('muro posterior', 1, 'crece');
  for (const s of [-1, 1]) {
    b.caja(s * (W / 2 - 0.05), 0.06, 0, 0.1, H - 0.06, D - 0.2, PANEL);
    for (let z = -D / 2 + 0.7; z < D / 2 - 0.5; z += 0.6) b.lamX(s * (W / 2) + s * 0.0015, 0.1, z, 0.005, H - 0.4, JUNTA, s);
    b.caja(s * (W / 2 - 0.05), 0.06, 0, 0.104, 0.12, D - 0.2, 0x9aa1a8);
    b.pieza(`muro lateral ${s < 0 ? 'izq' : 'der'}`, 1, 'crece');
  }
  for (let k = 0; k <= n; k++) b.caja(-W / 2 + 0.1 + k * pitch, 0.2, D / 2 - 0.05, 0.12, 2.0, 0.1, PANEL);
  b.caja(0, 0.06, D / 2 - 0.05, W - 0.2, 0.14, 0.1, 0x9aa1a8); b.caja(0, 2.2, D / 2 - 0.054, W - 0.2, H - 2.2, 0.092, PANEL);
  b.caja(0, 2.3, D / 2 - 0.004, W - 0.2, 0.12, 0.008, acento);
  for (let x = -W / 2 + 0.7; x < W / 2 - 0.4; x += 1.2) b.lamZ(x, 2.22, D / 2 - 0.0075, 0.005, 0.07, JUNTA, 1);
  b.caja(0, 2.2, D / 2 - 0.02, W - 0.2, 0.012, 0.06, P.metalOscuro); // riel superior de puertas
  b.pieza('muro frontal', 1, 'crece');
  for (let m = 0; m < t; m++) {
    const xm = -W / 2 + (m + 0.5) * 3.6;
    b.caja(xm, H - 0.15, 0, 3.6, 0.15, D - 0.2, PANEL);
    for (let k = 1; k < 4; k++) b.lamY(xm - 1.8 + k * 0.9, H + 0.0015, 0, 0.005, D - 0.3, JUNTA, 1);
    b.caja(xm, H - 0.17, D / 2 - 0.12, 3.5, 0.02, 0.03, P.led, { sin: '-y' }); // luminaria de servicio
    b.pieza(`techo de panel ${m + 1}`, 2, 'cae');
  }
  for (let m = 0; m < t; m++) {
    for (const dx of [-0.9, 0.9]) {
      const ex = -W / 2 + (m + 0.5) * 3.6 + dx, ey = H - 0.5, ez = -D / 2 + 0.5;
      b.caja(ex, ey, ez, 0.9, 0.35, 0.5, P.metal); b.caja(ex, ey - 0.03, ez, 0.8, 0.03, 0.44, P.metalOscuro); // gabinete y charola de goteo
      b.lamZ(ex, ey + 0.03, ez + 0.2505, 0.82, 0.28, P.oscuro, 1);
      for (const fx of [-0.22, 0.22]) { b.cil('z', ex + fx, ey + 0.17, ez + 0.256, 0.11, 0.012, P.metalOscuro, 12, { sinBase: true }); b.cil('z', ex + fx, ey + 0.17, ez + 0.262, 0.028, 0.014, P.metal, 6, { sinBase: true }); }
      for (const hx of [-0.32, 0.32]) b.caja(ex + hx, ey + 0.35, ez, 0.012, 0.0001 + 0.1, 0.012, 0x8c939a); // varillas roscadas al techo
      b.cil('y', ex + 0.4, ey - 0.12, ez + 0.1, 0.012, 0.24, 0x9aa1a8, 6);
    }
    b.pieza(`evaporadores ${m + 1}`, 2, 'escala', { aristas: false });
  }
  [0.52, 1.0, 1.48, 1.96].forEach((y, k) => {
    if (k === 0) for (let x = -W / 2 + 0.3; x <= W / 2 - 0.29; x += 1.2) b.caja(x, 0.06, -D / 2 + 0.45, 0.04, 2.0, 0.04, P.metalOscuro); // postes del anaquel
    b.caja(0, y, -D / 2 + 0.45, W - 0.5, 0.02, 0.5, P.metal, { sin: '-y' });
    for (let x = -W / 2 + 0.3; x <= W / 2 - 0.29; x += 0.06) if (Math.abs(((x + W / 2 - 0.3) % 1.2) - 0) > 0.03) b.lamY(x, y + 0.0205, -D / 2 + 0.45, 0.005, 0.46, 0x848b92);
    b.pieza(`estante ${k + 1}`, 2, 'despliega', { aristas: false });
  });
  for (let k = 0; k < n; k++) {
    const xd = -W / 2 + 0.1 + (k + 0.5) * pitch;
    puertaVidrio(b, xd, 0.22, D / 2 - 0.0, dw, 1.96, k % 2 ? 1 : -1);
    b.pieza(`puerta de cristal ${k + 1}`, 3, 'crece', { aristas: false });
  }
  for (let m = 0; m < t; m++) b.agrupar((p) => { const k = +(p.nombre.match(/^puerta de cristal (\d+)$/)?.[1] ?? -1) - 1; return k >= 4 * m && k < 4 * m + 4; }, `puertas de cristal ${m + 1}`, 3, 'crece');
  // puerta de servicio con marco, ventanilla, placa de impacto, manija con cerradura y bisagras
  const xs = W / 2 - 0.9, zd = -D / 2;
  b.caja(xs, 0.06, zd + 0.01, 1.0, 2.1, 0.02, 0xb7bec5); b.caja(xs, 0.06, zd + 0.022, 0.96, 0.25, 0.004, 0x9aa1a8);
  b.caja(xs - 0.52, 0.06, zd + 0.02, 0.04, 2.14, 0.04, P.metalOscuro); b.caja(xs + 0.52, 0.06, zd + 0.02, 0.04, 2.14, 0.04, P.metalOscuro); b.caja(xs, 2.2, zd + 0.02, 1.08, 0.04, 0.04, P.metalOscuro);
  b.caja(xs, 1.45, zd + 0.024, 0.34, 0.44, 0.012, P.metalOscuro); b.vidrioZ(xs, 1.49, zd + 0.032, 0.26, 0.36);
  b.caja(xs - 0.38, 0.95, zd + 0.03, 0.06, 0.3, 0.03, P.metalOscuro); b.caja(xs - 0.38, 1.06, zd + 0.056, 0.05, 0.05, 0.03, ACERO); b.caja(xs - 0.38, 1.06, zd + 0.07, 0.04, 0.2, 0.02, ACERO); b.pilar(xs - 0.38, 0.9, zd + 0.052, 0.014, 0.02, P.negro, 8);
  for (const y of [0.3, 1.1, 1.9]) { b.caja(xs + 0.5, y, zd + 0.045, 0.06, 0.16, 0.04, ACERO); b.pilar(xs + 0.5, y, zd + 0.06, 0.012, 0.16, P.metalOscuro, 6); }
  b.pieza('puerta de servicio', 3, 'despliega', { px: 'min' });
  const mixC = { caja: 4, carton: 3, botella: 2, frasco: 1 };
  const cols = c.rng.barajar(c.paleta.slice());
  for (const sx of [-1, 1]) for (let z = -D / 2 + 0.95; z < D / 2 - 0.45; z += 0.48) {
    const n = c.rng.entero(2, 3), x = sx * (W / 2 - 0.34);
    for (let k = 0; k < n; k++) { b.caja(x, 0.06 + k * 0.27, z, 0.42, 0.26, 0.4, cols[(k + (z > 0 ? 1 : 0)) % cols.length], { sin: '-y' }); b.lamZ(x, 0.12 + k * 0.27, z + 0.2005, 0.3, 0.1, 0xf0efe9, 1); }
  }
  [0.06, 0.55, 1.03, 1.51].forEach((y, k) => {
    b.mercV(-W / 2 + 0.3, W / 2 - 0.3, y + (k ? 0.02 : 0), -D / 2 + 0.2, -D / 2 + 0.68, k === 3 ? 0.4 : 0.38, c, { atras: '-z', mix: mixC, esc: 1.7 + Math.max(0, t - 1) * 0.15, dens: 1.3 });
    b.pieza(`producto ${k + 1}`, 4, 'crece', { aristas: false });
  });
}

/** Congelador isla: zócalo con rejilla, gabinete, borde con rieles, tapas de cristal corredizas con marco, canastillas de alambre y producto. */
export function congelador_isla(b, c) {
  const { ancho: W, fondo: D, tramos: t, acento } = c, mod = W / t;
  b.caja(0, 0.02, 0, W - 0.08, 0.06, D - 0.08, P.oscuro);
  zapatas(b, [[-W / 2 + 0.08, D / 2 - 0.08], [W / 2 - 0.08, D / 2 - 0.08], [-W / 2 + 0.08, -D / 2 + 0.08], [W / 2 - 0.08, -D / 2 + 0.08]], 0.025, 0.02);
  b.pieza('base', 0, 'despliega');
  for (const s of [-1, 1]) {
    b.caja(0, 0.08, s * (D / 2 - 0.044), W, 0.72, 0.072, P.blanco); b.caja(0, 0.45, s * (D / 2 + 0.0) - s * 0.004, W - 0.1, 0.1, 0.008, acento, { sin: '-y' });
    for (let k = 0; k < 5; k++) b.lamZ(-W / 2 + 0.35, 0.1 + k * 0.022, s * (D / 2 + 0.0015), 0.4, 0.012, 0x9ba2a8, s); // rejilla del compresor
    b.lamZ(0, 0.6, s * (D / 2 + 0.0015), W - 0.2, 0.012, 0xb9c0c6, s);
    b.caja(0, 0.24, s * (D / 2 - 0.004), W - 0.02, 0.06, 0.012, P.oscuro); // defensa perimetral
    b.pieza(`pared ${s < 0 ? 'posterior' : 'frontal'}`, 1, 'crece');
    b.caja(s * (W / 2 - 0.04), 0.08, 0, 0.08, 0.72, D - 0.16, P.blanco); b.caja(s * (W / 2 - 0.004), 0.24, 0, 0.012, 0.06, D - 0.1, P.oscuro);
    b.pieza(`cabecera ${s < 0 ? 'izq' : 'der'}`, 1, 'crece');
  }
  b.caja(0, 0.08, 0, W - 0.16, 0.42, D - 0.16, 0xdfe3e6); for (let x = -W / 2 + 0.2; x < W / 2 - 0.15; x += 0.4) b.lamY(x, 0.5005, 0, 0.004, D - 0.2, 0xb6bcc1);
  b.pieza('piso de canastillas', 1, 'crece', { aristas: false });
  // borde con doble riel de corredera (dos rieles de aluminio por lado) y portaprecios
  b.caja(0, 0.8, D / 2 - 0.04, W, 0.07, 0.08, P.metalOscuro); b.caja(0, 0.8, -D / 2 + 0.04, W, 0.07, 0.08, P.metalOscuro);
  for (const s of [-1, 1]) {
    b.caja(s * (W / 2 - 0.04), 0.8, 0, 0.08, 0.07, D - 0.16, P.metalOscuro); b.caja(0, 0.87, s * (D / 2 - 0.1), W - 0.1, 0.012, 0.012, ACERO); b.caja(0, 0.87, s * (D / 2 - 0.07), W - 0.1, 0.012, 0.012, ACERO);
    b.caja(0, 0.76, s * (D / 2 + 0.003), W - 0.1, 0.03, 0.006, P.blanco); etiquetas(b, -W / 2 + 0.1, W / 2 - 0.1, 0.765, s * (D / 2 + 0.007), s, claro(acento, 0.6), P.blanco, 0.22);
  }
  b.pieza('borde', 1, 'despliega', { aristas: false });
  // canastillas de varilla con marco claro: un marco divisor cada medio módulo, con travesaños y varillas
  const MARCO = 0xe9edf0, dd = D - 0.3;
  for (let m = 0; m < t; m++) for (let k = 0; k < 2; k++) {
    const x = -W / 2 + m * mod + k * mod / 2 + mod / 2 / 2 * 0 + (k ? 0 : mod / 2);
    b.caja(x, 0.5, 0, 0.016, 0.016, dd, MARCO); b.caja(x, 0.775, 0, 0.016, 0.016, dd, MARCO);
    for (const s of [-1, 1]) b.caja(x, 0.5, s * dd / 2, 0.016, 0.29, 0.016, MARCO);
    for (let z = -dd / 2 + 0.12; z < dd / 2 - 0.05; z += 0.12) b.caja(x, 0.5, z, 0.008, 0.28, 0.008, CANAST, { sin: '-y+y' });
  }
  for (const s of [-1, 1]) { b.caja(0, 0.5, s * dd / 2, W - 0.2, 0.012, 0.012, MARCO); b.caja(0, 0.775, s * dd / 2, W - 0.2, 0.012, 0.012, MARCO); }
  b.pieza('canastillas', 2, 'crece', { aristas: false });
  for (let m = 0; m < t; m++) for (const k of [0, 1]) {
    const xc = -W / 2 + m * mod + (k + 0.5) * mod / 2, w = mod / 2 - 0.04;
    b.vidrioY(xc, 0.865, 0, w, D - 0.2);
    for (const s of [-1, 1]) b.caja(xc, 0.84, s * (D / 2 - 0.12), w, 0.04, 0.04, P.metal);
    for (const s of [-1, 1]) b.caja(xc + s * (w / 2 - 0.02), 0.84, 0, 0.04, 0.04, D - 0.2, P.metal);
    b.caja(xc, 0.87, 0, 0.14, 0.012, 0.03, P.metalOscuro); // agarradera embutida
    b.pieza(`tapa de cristal ${m * 2 + k + 1}`, 3, 'desliza', { aristas: false });
  }
  const mixI = { bolsa: 4, caja: 3, frasco: 3, carton: 1 }, pal = SATURADA;
  for (const [y, hm] of [[0.5, 0.14], [0.64, 0.14]]) {
    b.mercV(-W / 2 + 0.1, W / 2 - 0.1, y, -D / 2 + 0.12, -0.01, hm, c, { atras: '+z', mix: mixI, dens: 1.1 });
    b.mercV(-W / 2 + 0.1, W / 2 - 0.1, y, 0.01, D / 2 - 0.12, hm, c, { atras: '-z', mix: mixI, dens: 1.1 });
  }
  b.pieza('producto', 4, 'crece', { aristas: false });
}
