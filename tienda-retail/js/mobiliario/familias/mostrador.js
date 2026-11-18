// Zona mostrador de servicio: vitrina de cristal, mostrador y estantería de alta densidad (nivel de detalle R1).
import { P, claro, mezcla, carta, surtido, VIVA } from './comun-b.js';

const LIGERO = 0xe9e3d6;
const PLASTICO = [0x6f8fb0, 0x9aa7b0, 0xd6bc6a, 0x7a9a86];

/** Vitrina de cristal: zócalo con niveladores, gabinete con puertas y jaladeras, montantes con escuadras, cristales con riel y cerradura, entrepaños de cristal con LED y producto con portaprecios. */
export function vitrina_cristal(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento, rng } = c, mod = W / t;
  b.caja(0, 0.012, 0, W - 0.04, 0.068, D - 0.04, P.oscuro);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.pilar(sx * (W / 2 - 0.05), 0, sz * (D / 2 - 0.05), 0.02, 0.012, P.negro, 8);
  b.pieza('base', 0, 'despliega');
  b.caja(0, 0.08, 0, W, 0.34, D - 0.016, LIGERO); b.caja(0, 0.3, D / 2 - 0.004, W - 0.04, 0.06, 0.008, acento, { sin: '-y' });
  for (let m = 0; m < t; m++) {
    for (const s of [-1, 1]) {
      const xd = -W / 2 + (m + 0.5) * mod + s * (mod / 4);
      b.caja(xd, 0.11, D / 2 - 0.004, mod / 2 - 0.045, 0.18, 0.008, mezcla(LIGERO, P.madera, 0.18)); b.caja(xd - s * (mod / 4 - 0.06), 0.15, D / 2 + 0.002, 0.01, 0.09, 0.014, P.metal);
    }
    b.cil('z', -W / 2 + (m + 0.5) * mod, 0.335, D / 2 + 0.002, 0.009, 0.006, P.negro, 8);
  }
  b.pieza('cuerpo bajo', 1, 'crece');
  const xs = Array.from({ length: t + 1 }, (_, i) => Math.min(W / 2 - 0.015, Math.max(-W / 2 + 0.015, -W / 2 + i * mod)));
  xs.forEach((x, i) => {
    for (const s of [-1, 1]) {
      const z = s * (D / 2 - 0.02);
      b.caja(x, 0.42, z, 0.03, H - 0.45, 0.03, P.metalOscuro); b.caja(x, 0.405, z, 0.045, 0.015, 0.045, P.metal); b.caja(x, H - 0.045, z, 0.045, 0.02, 0.045, P.metal);
    }
    b.pieza(`montante ${i + 1}`, 1, 'crece');
  });
  b.caja(0, 0.42, -D / 2 + 0.015, W - 0.06, H - 0.5, 0.015, 0xd9e6ec);
  for (let i = 1; i < t; i++) carta(b, -W / 2 + i * mod, 0.45, -D / 2 + 0.0228, 0.006, H - 0.56, 0xa9bcc6);
  b.pieza('fondo de espejo', 2, 'crece', { aristas: false });
  const yt = H - 0.04;
  b.caja(0, yt + 0.012, D / 2 - 0.015, W, 0.028, 0.026, P.metalOscuro); b.caja(0, yt + 0.012, -D / 2 + 0.015, W, 0.028, 0.026, P.metalOscuro);
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.015), yt, 0, 0.03, 0.04, D - 0.06, P.metalOscuro);
  b.caja(0, yt - 0.03, 0, W - 0.06, 0.03, 0.05, P.oscuro); b.caja(0, yt + 0.04, D / 2 - 0.015, W, 0.006, 0.032, P.metal);
  b.pieza('marco superior', 2, 'despliega');
  b.caja(0, H - 0.075, 0, W - 0.1, 0.012, 0.03, P.led);
  const ys = [0.66]; while (ys[ys.length - 1] + 0.24 < H - 0.22) ys.push(ys[ys.length - 1] + 0.24);
  for (const y of ys) b.caja(0, y - 0.03, D / 2 - 0.08, W - 0.12, 0.008, 0.012, P.led);
  b.pieza('luz LED', 2, 'despliega', { aristas: false });
  b.vidrioZ(0, 0.43, D / 2 - 0.02, W - 0.04, H - 0.5); b.vidrioY(0, H - 0.02, 0, W - 0.04, D - 0.04);
  for (const s of [-1, 1]) b.vidrioX(s * (W / 2 - 0.02), 0.43, 0, D - 0.04, H - 0.5);
  b.caja(0, 0.42, D / 2 - 0.02, W - 0.04, 0.02, 0.03, P.metal); for (let m = 0; m < t; m++) b.cil('z', -W / 2 + (m + 0.5) * mod, 0.43, D / 2 + 0.0, 0.011, 0.012, P.negro, 8);
  b.pieza('cristales', 3, 'crece', { aristas: false });
  ys.forEach((y, k) => {
    b.vidrioY(0, y, 0, W - 0.08, D - 0.1);
    b.caja(0, y - 0.006, D / 2 - 0.05, W - 0.08, 0.012, 0.012, 0xcfe6ee); b.caja(0, y - 0.006, -D / 2 + 0.05, W - 0.08, 0.012, 0.012, 0xcfe6ee);
    for (const x of xs) for (const s of [-1, 1]) b.caja(Math.min(W / 2 - 0.045, Math.max(-W / 2 + 0.045, x)), y - 0.02, s * (D / 2 - 0.045), 0.026, 0.02, 0.026, P.metal);
    if (k === 0) b.pieza('entrepaño de cristal', 3, 'despliega', { aristas: false });
    else b.pieza(`entrepaño de cristal ${k + 1}`, 3, 'despliega', { aristas: false });
  });
  const suave = VIVA, niveles = [0.42, ...ys.map((y) => y + 0.012)], tipos = ['botella', 'frasco', 'estuche', 'caja', 'bolsa'];
  niveles.forEach((y, k) => {
    const tope = (k < ys.length ? ys[k] - 0.025 : H - 0.06) - y;
    surtido(b, -W / 2 + 0.06, W / 2 - 0.06, y, -D / 2 + 0.07, D / 2 - 0.1, Math.min(0.17, tope), rng, suave, { wmin: 0.06, escala: 0.85, tipos, filas: 2 });
    for (let x = -W / 2 + 0.12; x < W / 2 - 0.1; x += 0.2) b.caja(x, y, D / 2 - 0.075, 0.05, 0.03, 0.004, P.blanco, { sin: '-y' });
    b.pieza(`producto ${k === 0 ? 'repisa baja' : k === 1 ? 'repisa alta' : `nivel ${k + 1}`}`, 4, 'crece', { aristas: false });
  });
}

/** Mostrador de servicio: zócalo, cuerpo con faldón de listones y marco, cubierta con canto, pasacables y alzada trasera, terminales con pantalla, lector, impresora y exhibidor escalonado. */
export function mostrador_servicio(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento, rng } = c, mod = W / t;
  b.caja(0, 0.012, -0.03, W - 0.1, 0.108, D - 0.16, 0x1f2226); for (let m = 0; m <= t; m++) b.caja(Math.min(W / 2 - 0.06, Math.max(-W / 2 + 0.06, -W / 2 + m * mod)), 0, -0.03, 0.07, 0.012, D - 0.18, P.negro); b.caja(0, 0.115, D / 2 - 0.085, W - 0.1, 0.005, 0.004, P.led, { sin: '-y' });
  b.pieza('base', 0, 'despliega');
  b.caja(0, 0.12, -0.03, W - 0.02, 0.76, D - 0.06, LIGERO);
  b.pieza('cuerpo', 1, 'crece');
  const zf = D / 2 - 0.04;
  for (let m = 0; m < t; m++) {
    const xm = -W / 2 + (m + 0.5) * mod, n = Math.max(10, Math.round((mod - 0.12) / 0.2)), pitch = (mod - 0.12) / n;
    const MOLD = claro(P.madera, 0.3), PANEL = mezcla(LIGERO, P.madera, 0.3);
    b.caja(xm, 0.16, zf - 0.016, mod - 0.04, 0.28, 0.004, mezcla(P.madera, P.oscuro, 0.55));
    for (let k = 0; k < n; k++) b.caja(xm - (mod - 0.12) / 2 + (k + 0.5) * pitch, 0.16, zf, pitch * 0.94, 0.26, 0.03, P.madera, { v: k % 2 ? 0.97 : 1 });
    b.caja(xm, 0.125, zf, mod - 0.02, 0.035, 0.04, MOLD); b.caja(xm, 0.42, zf + 0.004, mod - 0.02, 0.038, 0.05, MOLD); b.caja(xm, 0.77, zf, mod - 0.02, 0.02, 0.04, MOLD);
    b.caja(xm, 0.458, zf - 0.005, mod - 0.04, 0.312, 0.03, PANEL); b.caja(xm, 0.5, zf + 0.011, mod - 0.3, 0.23, 0.006, claro(PANEL, 0.18)); b.caja(xm, 0.52, zf + 0.0155, mod - 0.36, 0.19, 0.004, mezcla(PANEL, P.oscuro, 0.12));
    for (const s of [-1, 1]) b.caja(xm + s * (mod / 2 - 0.05), 0.16, zf, 0.04, 0.61, 0.04, MOLD);
    b.pieza(`faldón ${m + 1}`, 1, 'crece', { aristas: false });
  }
  b.caja(0, 0.88, 0, W, 0.05, D, 0xcfcac0); b.caja(0, 0.88, D / 2 - 0.006, W + 0.004, 0.05, 0.012, claro(P.madera, 0.6)); b.caja(0, 0.79, D / 2 - 0.02, W - 0.04, 0.06, 0.02, acento, { sin: '-y' });
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.006), 0.88, 0, 0.012, 0.05, D, claro(P.madera, 0.6));
  b.caja(0, 0.93, -D / 2 + 0.025, W - 0.04, 0.07, 0.03, claro(P.madera, 0.05));
  for (let m = 0; m < t; m++) for (const dx of [0.3, mod - 0.3]) b.pilar(-W / 2 + m * mod + dx, 0.93, -0.16, 0.032, 0.004, P.oscuro, 10);
  b.pieza('cubierta', 2, 'cae', { aristas: false });
  for (let m = 0; m < t; m++) {
    const x = -W / 2 + (m + 0.5) * mod + 0.7, z = -0.1, y = 0.93;
    b.caja(x, y, z, 0.2, 0.01, 0.17, P.oscuro); b.tronco(x, y + 0.01, z - 0.03, 0.05, 0.04, 0.035, 0.03, 0.025, P.metalOscuro);
    b.caja(x, y + 0.035, z - 0.03, 0.25, 0.1, 0.018, P.negro); carta(b, x, y + 0.045, z - 0.0205, 0.23, 0.08, 0x7fa6c4); b.caja(x, y + 0.1, z - 0.02, 0.04, 0.004, 0.004, P.led);
    b.tronco(x + 0.27, y, z + 0.1, 0.07, 0.11, 0.07, 0.085, 0.032, P.oscuro); b.caja(x + 0.27, y + 0.03, z + 0.095, 0.05, 0.004, 0.04, 0x7fa6c4, { sin: '-y' }); b.caja(x + 0.27, y + 0.025, z + 0.13, 0.055, 0.004, 0.03, P.metalOscuro, { sin: '-y' });
    b.caja(x - 0.26, y, z - 0.02, 0.14, 0.1, 0.12, P.oscuro); b.caja(x - 0.26, y + 0.1, z + 0.02, 0.1, 0.004, 0.06, P.blanco, { sin: '-y' }); b.caja(x - 0.26, y + 0.07, z + 0.061, 0.1, 0.012, 0.004, P.negro);
    b.caja(x - 0.12, y, z + 0.1, 0.075, 0.02, 0.075, P.metalOscuro); b.tronco(x - 0.12, y + 0.02, z + 0.1, 0.05, 0.05, 0.045, 0.045, 0.02, P.negro); b.caja(x - 0.12, y + 0.025, z + 0.126, 0.03, 0.01, 0.004, 0x7fa6c4);
    b.pieza(`terminal de cobro ${m + 1}`, 3, 'escala', { aristas: false });
  }
  const ex = -W / 2 + 0.55;
  b.caja(ex, 0.93, 0.18, 0.7, 0.025, 0.3, P.maderaOscura); b.caja(ex, 0.955, 0.12, 0.6, 0.035, 0.18, P.maderaOscura); b.caja(ex, 0.93, 0.335, 0.7, 0.012, 0.012, claro(P.maderaOscura, 0.3));
  for (const s of [-1, 1]) b.caja(ex + s * 0.345, 0.955, 0.18, 0.01, 0.025, 0.3, claro(P.maderaOscura, 0.2));
  const vx = W / 2 - 0.55, vz = 0.2;
  b.caja(vx, 0.93, vz, 0.46, 0.02, 0.28, 0x1f2226); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.caja(vx + sx * 0.225, 0.95, vz + sz * 0.135, 0.012, 0.1, 0.012, P.metalOscuro);
  b.caja(vx, 1.04, vz, 0.46, 0.01, 0.28, P.metalOscuro, { sin: '-y' }); b.vidrioZ(vx, 0.95, vz + 0.14, 0.45, 0.09); b.vidrioZ(vx, 0.95, vz - 0.14, 0.45, 0.09); for (const sx of [-1, 1]) b.vidrioX(vx + sx * 0.23, 0.95, vz, 0.27, 0.09);
  b.pieza('exhibidor frontal', 3, 'cae', { aristas: false });
  surtido(b, vx - 0.2, vx + 0.2, 0.95, vz - 0.11, vz + 0.11, 0.085, rng, VIVA, { escala: 0.6, tipos: ['frasco', 'estuche', 'botella'], filas: 2 });
  const tp = ['frasco', 'caja', 'estuche', 'bolsa'];
  surtido(b, ex - 0.3, ex + 0.3, 0.955, 0.03, 0.17, 0.085, rng, VIVA, { escala: 0.85, tipos: ['frasco', 'caja', 'estuche', 'bolsa', 'botella', 'lata'], filas: 1 });
  surtido(b, ex - 0.34, ex + 0.34, 0.955, 0.22, 0.33, 0.075, rng, VIVA, { escala: 0.8, tipos: ['frasco', 'caja', 'estuche', 'botella', 'lata'], filas: 1 });
  b.pieza('producto del exhibidor', 4, 'crece', { aristas: false });
}

/** Cartón de refacciones con cinta. */
function carton(b, x, y, z, w, h, d, col, rng) {
  b.caja(x, y, z, w, h, d, col, { v: rng.rango(0.94, 1.05) }); b.caja(x, y + h, z, w * 0.14, 0.002, d, claro(col, 0.45), { sin: '-y' });
}
/** Gaveta plástica con boca, portaetiqueta y escotadura. */
function gaveta(b, x, y, z, w, h, d, col) {
  b.tronco(x, y, z, w * 0.93, d * 0.93, w, d, h, col); b.caja(x, y + h, z, w * 0.86, 0.002, d * 0.8, mezcla(col, P.negro, 0.5), { sin: '-y' });
  b.caja(x, y + h * 0.5, z + d * 0.48, w * 0.5, h * 0.28, 0.004, P.blanco, { sin: '-y' }); b.caja(x, y + h * 0.16, z + d * 0.485, w * 0.4, h * 0.1, 0.004, mezcla(col, P.negro, 0.55), { sin: '-y' });
}

/** Estantería de alta densidad: postes azules con ranuras y zapata, tirantes traseros, entrepaños con labios, divisores, portaetiquetas y gavetas y cajas de refacciones. */
export function estanteria_alta_densidad(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, rng } = c, mod = W / t, N = 7, paso = (H - 0.18 - 0.12) / (N - 1) - 0.005;
  b.caja(0, 0, 0, W - 0.05, 0.06, D - 0.05, P.oscuro); b.pieza('base', 0, 'despliega');
  for (let i = 0; i <= t; i++) {
    const x = Math.min(W / 2 - 0.0225, Math.max(-W / 2 + 0.0225, -W / 2 + i * mod)), zp = D / 2 - 0.0225;
    for (const s of [-1, 1]) {
      b.caja(x, 0, s * zp, 0.045, H, 0.045, P.rackAzul); b.caja(x, 0, s * zp, 0.058, 0.025, 0.058, P.oscuro); b.caja(x, H, s * zp, 0.045, 0.008, 0.045, P.negro);
    }
    for (let y = 0.1; y < H - 0.1; y += 0.075) carta(b, x, y, zp + 0.0227, 0.012, 0.035, 0x1f3b57);
    if (i > 0) { const xp = Math.min(W / 2 - 0.0225, Math.max(-W / 2 + 0.0225, -W / 2 + (i - 1) * mod)); b.barra(i % 2 ? [xp, 0.12, -D / 2 + 0.008] : [xp, H - 0.3, -D / 2 + 0.008], i % 2 ? [x, H - 0.3, -D / 2 + 0.008] : [x, 0.12, -D / 2 + 0.008], 0.012, P.rackAzul); }
    b.pieza(`postes ${i + 1}`, 1, 'crece', { aristas: false });
  }
  const ys = Array.from({ length: N }, (_, l) => 0.12 + l * paso), CAJAS = [P.carton, 0xd6b88c, 0xb8956a, 0xe6dcc8, P.blanco];
  for (let m = 0; m < t; m++) {
    const xm = -W / 2 + (m + 0.5) * mod;
    ys.forEach((y, l) => {
      b.caja(xm, y, 0, mod - 0.06, 0.012, D - 0.06, claro(P.metal, 0.4)); b.caja(xm, y - 0.03, D / 2 - 0.036, mod - 0.06, 0.042, 0.012, claro(P.metal, 0.3)); b.caja(xm, y, -D / 2 + 0.036, mod - 0.06, 0.05, 0.012, claro(P.metal, 0.3));
      for (const k of [1, 2]) b.caja(-W / 2 + m * mod + (k * mod) / 3, y + 0.012, 0, 0.008, 0.2, D - 0.12, mezcla(P.metal, P.oscuro, 0.3));
      b.caja(xm, y - 0.036, D / 2 - 0.023, 0.2, 0.034, 0.006, P.blanco, { sin: '-y' }); carta(b, xm, y - 0.03, D / 2 - 0.0195, 0.17, 0.02, l % 2 ? 0xd6bc6a : 0x7a9a86);
    });
    b.pieza(`entrepaños y divisores módulo ${m + 1}`, 3, 'despliega', { aristas: false });
  }
  ys.forEach((y, l) => {
    const hm = Math.min(0.26, l === N - 1 ? H - y - 0.05 : paso - 0.04), yb = y + 0.012;
    for (let m = 0; m < t; m++) {
      const x0 = -W / 2 + m * mod + 0.04, x1 = -W / 2 + (m + 1) * mod - 0.04, usaGavetas = l < 3 || (l < 5 && rng.r() < 0.5);
      if (usaGavetas) {
        const w = (x1 - x0 - 0.03) / 3, d = Math.min(0.42, D - 0.16), col = rng.elegir(PLASTICO);
        for (let k = 0; k < 3; k++) { if (rng.r() < 0.08) continue; const h = Math.min(hm, rng.rango(0.17, 0.24)); gaveta(b, x0 + w / 2 + k * (w + 0.015), yb, D / 2 - 0.05 - d / 2, w, h, d, k === 1 && rng.r() < 0.3 ? rng.elegir(PLASTICO) : col); }
      } else {
        let x = x0 + rng.rango(0, 0.02);
        while (x < x1 - 0.12) {
          const w = Math.min(rng.rango(0.15, 0.28), x1 - x), h = hm * rng.rango(0.55, 1), d = Math.min(0.44, D - 0.14) * rng.rango(0.8, 1);
          carton(b, x + w / 2, yb, D / 2 - 0.05 - d / 2, w, h, d, rng.elegir(CAJAS), rng); x += w + rng.rango(0.008, 0.025);
        }
      }
    }
    b.pieza(`cajas de refacciones ${l + 1}`, 4, 'crece', { aristas: false });
  });
}
