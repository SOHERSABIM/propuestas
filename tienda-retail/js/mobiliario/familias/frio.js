// Zona refrigerados: refrigerador vertical de puertas, cuarto frío con puertas de exhibición y congelador isla.
import { P, claro } from './comun.js';

const CREMA = 0xf1ecd9, ACERO = 0xc4c9ce;

/** Refrigerador vertical: zócalo, gabinete, parrillas, luz LED, puertas de cristal por módulo y producto por parrilla. */
export function refrigerador_vertical(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t, hCab = H - 0.26 - 0.12;
  b.caja(0, 0, 0, W - 0.04, 0.12, D - 0.06, P.oscuro); b.pieza('base y zoclo', 0, 'despliega');
  for (const s of [-1, 1]) { b.caja(s * (W / 2 - 0.025), 0.12, 0, 0.05, hCab, D - 0.04, P.blanco); b.pieza(`costado ${s < 0 ? 'izq' : 'der'}`, 1, 'crece'); }
  b.caja(0, 0.12, -D / 2 + 0.02, W - 0.1, hCab, 0.04, CREMA); b.pieza('fondo interior', 1, 'crece');
  b.caja(0, H - 0.26, 0, W, 0.26, D, acento); b.caja(0, H - 0.3, D / 2 - 0.02, W - 0.1, 0.04, 0.02, P.led); b.pieza('cabecera', 1, 'cae');
  for (let i = 1; i < t; i++) { b.caja(-W / 2 + i * mod, 0.12, 0, 0.02, hCab, D - 0.1, P.blanco); b.pieza(`divisor ${i}`, 1, 'crece'); }
  const niv = [0.39, 0.66, 0.93, 1.2, 1.47];
  niv.forEach((y, k) => { b.caja(0, y, -0.045, W - 0.1, 0.012, 0.53, ACERO); b.pieza(`parrilla ${k + 1}`, 2, 'despliega', { aristas: false }); });
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.07), 0.14, D / 2 - 0.1, 0.02, hCab - 0.04, 0.015, P.led);
  b.pieza('luz LED', 2, 'crece', { aristas: false });
  for (let m = 0; m < t; m++) {
    const xm = -W / 2 + (m + 0.5) * mod, dw = (mod - 0.06) / 3, zf = D / 2 - 0.02, hd = hCab - 0.1;
    for (let k = 0; k <= 3; k++) b.caja(xm - mod / 2 + 0.03 + k * dw, 0.14, zf, 0.035, hd, 0.04, P.metalOscuro);
    b.caja(xm, 0.14, zf, mod - 0.03, 0.035, 0.04, P.metalOscuro); b.caja(xm, 0.14 + hd - 0.035, zf, mod - 0.03, 0.035, 0.04, P.metalOscuro);
    for (let k = 0; k < 3; k++) {
      const xc = xm - mod / 2 + 0.03 + (k + 0.5) * dw;
      b.vidrioZ(xc, 0.17, D / 2 - 0.004, dw - 0.03, hd - 0.07);
      b.caja(xc + dw / 2 - 0.06, 0.6, D / 2 - 0.015, 0.02, 0.6, 0.03, ACERO);
    }
    b.pieza(`puertas de cristal ${m + 1}`, 3, 'crece');
  }
  const ys = [0.12, ...niv.map((y) => y + 0.012)];
  ys.forEach((y, k) => {
    b.merc(-W / 2 + 0.07, W / 2 - 0.07, y, -D / 2 + 0.06, 0.2, 0.22, c, { atras: '-z', wmin: 0.12, wmax: 0.26 });
    b.pieza(`producto ${k + 1}`, 4, 'crece', { aristas: false });
  });
}

/** Cuarto frío: piso, muros de panel con frente de puertas de cristal, techo, evaporadores, puerta de servicio y producto. */
export function camara_fria(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, n = 4 * t, pitch = (W - 0.2) / n, dw = pitch - 0.14, PANEL = 0xf0f0ee;
  b.caja(0, 0, 0, W, 0.06, D, 0xd6d9dc); b.pieza('piso aislado', 0, 'despliega');
  b.caja(0, 0.06, -D / 2 + 0.07, W, H - 0.06, 0.1, PANEL); b.pieza('muro posterior', 1, 'crece');
  for (const s of [-1, 1]) { b.caja(s * (W / 2 - 0.05), 0.06, 0, 0.1, H - 0.06, D - 0.2, PANEL); b.pieza(`muro lateral ${s < 0 ? 'izq' : 'der'}`, 1, 'crece'); }
  for (let k = 0; k <= n; k++) b.caja(-W / 2 + 0.1 + k * pitch, 0.2, D / 2 - 0.05, 0.12, 2.0, 0.1, PANEL);
  b.caja(0, 0.06, D / 2 - 0.05, W - 0.2, 0.14, 0.1, 0x9aa1a8); b.caja(0, 2.2, D / 2 - 0.054, W - 0.2, H - 2.2, 0.092, PANEL);
  b.caja(0, 2.3, D / 2 - 0.004, W - 0.2, 0.12, 0.008, acento);
  b.pieza('muro frontal', 1, 'crece');
  for (let m = 0; m < t; m++) { b.caja(-W / 2 + (m + 0.5) * 3.6, H - 0.15, 0, 3.6, 0.15, D - 0.2, PANEL); b.pieza(`techo de panel ${m + 1}`, 2, 'cae'); }
  for (let m = 0; m < t; m++) {
    for (const dx of [-0.9, 0.9]) { b.caja(-W / 2 + (m + 0.5) * 3.6 + dx, H - 0.5, -D / 2 + 0.5, 0.9, 0.35, 0.5, P.metal); b.caja(-W / 2 + (m + 0.5) * 3.6 + dx, H - 0.47, -D / 2 + 0.755, 0.8, 0.28, 0.01, P.oscuro); }
    b.pieza(`evaporadores ${m + 1}`, 2, 'escala');
  }
  [0.52, 1.0, 1.48, 1.96].forEach((y, k) => { b.caja(0, y, -D / 2 + 0.45, W - 0.5, 0.03, 0.5, P.metal); b.pieza(`estante ${k + 1}`, 2, 'despliega', { aristas: false }); });
  for (let k = 0; k < n; k++) {
    const xd = -W / 2 + 0.1 + (k + 0.5) * pitch;
    b.vidrioZ(xd, 0.22, D / 2 - 0.03, dw, 1.96); b.caja(xd + dw / 2 - 0.06, 0.8, D / 2 - 0.02, 0.025, 0.7, 0.04, ACERO);
    b.caja(xd, 0.2, D / 2 - 0.03, dw, 0.03, 0.04, P.metalOscuro); b.caja(xd, 2.17, D / 2 - 0.03, dw, 0.03, 0.04, P.metalOscuro);
    b.pieza(`puerta de cristal ${k + 1}`, 3, 'crece');
  }
  const xs = W / 2 - 0.9;
  b.caja(xs, 0.06, -D / 2 + 0.01, 1.0, 2.1, 0.02, 0xb7bec5); b.caja(xs - 0.38, 1.0, -D / 2 + 0.03, 0.04, 0.2, 0.03, P.metalOscuro);
  b.pieza('puerta de servicio', 3, 'despliega', { px: 'min' });
  [0.06, 0.55, 1.03, 1.51].forEach((y, k) => {
    b.merc(-W / 2 + 0.3, W / 2 - 0.3, y, -D / 2 + 0.2, -D / 2 + 0.68, k === 3 ? 0.4 : 0.38, c, { wmin: 0.22, wmax: 0.42, atras: '-z' });
    b.pieza(`producto ${k + 1}`, 4, 'crece', { aristas: false });
  });
}

/** Congelador isla: zócalo, gabinete con piso de canastillas, borde, tapas de cristal corredizas y producto. */
export function congelador_isla(b, c) {
  const { ancho: W, fondo: D, tramos: t, acento } = c, mod = W / t;
  b.caja(0, 0, 0, W - 0.08, 0.08, D - 0.08, P.oscuro); b.pieza('base', 0, 'despliega');
  for (const s of [-1, 1]) {
    b.caja(0, 0.08, s * (D / 2 - 0.044), W, 0.72, 0.072, P.blanco); b.caja(0, 0.45, s * (D / 2 + 0.0) - s * 0.004, W - 0.1, 0.1, 0.008, acento, { sin: '-y' });
    b.pieza(`pared ${s < 0 ? 'posterior' : 'frontal'}`, 1, 'crece');
    b.caja(s * (W / 2 - 0.04), 0.08, 0, 0.08, 0.72, D - 0.16, P.blanco); b.pieza(`cabecera ${s < 0 ? 'izq' : 'der'}`, 1, 'crece');
  }
  b.caja(0, 0.08, 0, W - 0.16, 0.42, D - 0.16, 0xdfe3e6); b.pieza('piso de canastillas', 1, 'crece');
  b.caja(0, 0.8, D / 2 - 0.04, W, 0.07, 0.08, P.metalOscuro); b.caja(0, 0.8, -D / 2 + 0.04, W, 0.07, 0.08, P.metalOscuro);
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.04), 0.8, 0, 0.08, 0.07, D - 0.16, P.metalOscuro);
  b.pieza('borde', 1, 'despliega');
  for (let m = 0; m < t; m++) for (let k = 1; k < 3; k++) { b.caja(-W / 2 + m * mod + k * mod / 3, 0.5, 0, 0.02, 0.16, D - 0.2, ACERO); }
  b.pieza('canastillas', 2, 'crece', { aristas: false });
  for (let m = 0; m < t; m++) for (const k of [0, 1]) {
    const xc = -W / 2 + m * mod + (k + 0.5) * mod / 2, w = mod / 2 - 0.04;
    b.vidrioY(xc, 0.865, 0, w, D - 0.2);
    for (const s of [-1, 1]) b.caja(xc, 0.84, s * (D / 2 - 0.12), w, 0.04, 0.025, P.metal);
    for (const s of [-1, 1]) b.caja(xc + s * (w / 2 - 0.0125), 0.84, 0, 0.025, 0.04, D - 0.2, P.metal);
    b.pieza(`tapa de cristal ${m * 2 + k + 1}`, 3, 'desliza');
  }
  b.merc(-W / 2 + 0.1, W / 2 - 0.1, 0.5, -D / 2 + 0.12, -0.01, 0.28, c, { wmin: 0.12, wmax: 0.26 });
  b.merc(-W / 2 + 0.1, W / 2 - 0.1, 0.5, 0.01, D / 2 - 0.12, 0.28, c, { wmin: 0.12, wmax: 0.26 });
  b.pieza('producto', 4, 'crece', { aristas: false });
}
