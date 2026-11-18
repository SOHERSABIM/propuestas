// Trastienda: rack selectivo con tarimas y cargas flejadas (nivel de detalle R1).
import { P, claro, mezcla, carta } from './comun-b.js';

const AMARILLO = 0xd9b13b, CART = [P.carton, 0xd6b88c, 0xb8956a], BARRIL = 0x6f8aa3;

/** Tarima de madera: 3 tablas inferiores, 3 largueros y 5 tablas superiores (alto total 0.116). */
function tarima(b, x, yb, rng) {
  for (const z of [-0.47, 0, 0.47]) b.caja(x, yb, z, 1.0, 0.016, 0.1, P.tarima, { v: rng.rango(0.93, 1.03) });
  for (const k of [-0.455, 0, 0.455]) b.caja(x + k, yb + 0.016, 0, 0.09, 0.08, 1.04, P.tarima, { v: 0.9 });
  for (const z of [-0.46, -0.23, 0, 0.23, 0.46]) b.caja(x, yb + 0.096, z, 1.0, 0.02, 0.14, P.tarima, { v: rng.rango(1.02, 1.1) });
}
/** Fleje: aro delgado alrededor de una carga de ancho wx y fondo dz, a la altura y. */
function fleje(b, x, y, wx, dz) {
  const col = P.negro;
  b.caja(x, y, dz / 2 + 0.003, wx + 0.012, 0.016, 0.006, col, { sin: '-y+y' }); b.caja(x, y, -dz / 2 - 0.003, wx + 0.012, 0.016, 0.006, col, { sin: '-y+y' });
  b.caja(x - wx / 2 - 0.003, y, 0, 0.006, 0.016, dz, col, { sin: '-y+y' }); b.caja(x + wx / 2 + 0.003, y, 0, 0.006, 0.016, dz, col, { sin: '-y+y' });
}
/** Caja de cartón con cinta superior. */
function carton(b, x, y, z, w, h, d, rng) {
  const col = CART[Math.floor(rng.r() * 3)];
  b.caja(x, y, z, w, h, d, col, { v: rng.rango(0.94, 1.05) }); b.caja(x, y + h, z, w * 0.14, 0.002, d, claro(col, 0.45), { sin: '-y' });
}

/** Rack selectivo: placas con pernos y protectores, bastidores con ranuras y arriostres, largueros con conectores y seguros, malla, tarimas y cargas flejadas. */
export function rack_selectivo(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, rng } = c, mod = W / t, zf = D / 2 - 0.05, up = 0.08;
  const xs = Array.from({ length: t + 1 }, (_, i) => Math.min(W / 2 - 0.06, Math.max(-W / 2 + 0.06, -W / 2 + i * mod)));
  const nivs = [1.2, 2.4].filter((y) => y + 0.95 <= H), puntos = [0.25, ...nivs.map((y) => y + 0.15), H - 0.06];
  xs.forEach((x, i) => {
    for (const s of [-1, 1]) {
      b.caja(x, 0, s * zf, 0.12, 0.012, 0.12, P.oscuro, { sin: '-y' });
      for (const dx of [-0.045, 0.045]) for (const dz of [-0.045, 0.045]) b.pilar(x + dx, 0.012, s * zf + dz, 0.008, 0.016, P.metalOscuro, 6);
      b.caja(x, 0.012, s * zf, 0.11, 0.4, 0.11, AMARILLO, { v: 0.98 }); b.caja(x, 0.412, s * zf, 0.115, 0.012, 0.115, mezcla(AMARILLO, P.negro, 0.3));
    }
    b.pieza(`placas base ${i + 1}`, 0, 'escala', { aristas: false });
  });
  xs.forEach((x, i) => {
    for (const s of [-1, 1]) b.caja(x, 0.012, s * zf, up, H - 0.012, up, P.rackAzul);
    for (const y of puntos) b.caja(x, y, 0, 0.03, 0.03, D - 0.18, P.rackAzul);
    for (let k = 0; k < puntos.length - 1; k++) { const a = puntos[k] + 0.02, e = puntos[k + 1] + 0.01; b.barra([x, a, k % 2 ? -zf : zf], [x, e, k % 2 ? zf : -zf], 0.028, P.rackAzul); }
    for (let y = 0.45; y < H - 0.15; y += 0.1) { if (Math.abs(y - 0.4) < 0.0) continue; for (const dx of [-0.018, 0.018]) carta(b, x + dx, y, zf + up / 2 + 0.0007, 0.014, 0.04, 0x1f3b57); }
    b.pieza(`bastidor ${i + 1}`, 1, 'crece', { aristas: false });
  });
  nivs.forEach((y, k) => {
    for (let m = 0; m < t; m++) {
      const xa = xs[m] + up / 2, xb = xs[m + 1] - up / 2, xc = (xa + xb) / 2, len = xb - xa;
      for (const s of [-1, 1]) {
        b.caja(xc, y - 0.13, s * zf, len, 0.13, 0.05, P.rackNaranja); b.caja(xc, y - 0.13, s * (zf - 0.03), len, 0.02, 0.02, mezcla(P.rackNaranja, P.negro, 0.25), { sin: '-y' });
        for (const e of [-1, 1]) { const xe = e < 0 ? xa : xb; b.caja(xe - e * 0.008, y - 0.125, s * zf, 0.016, 0.1, 0.07, P.metalOscuro); b.pilar(xe - e * 0.02, y - 0.02, s * zf + s * 0.0, 0.005, 0.03, P.negro, 5); }
      }
      for (let x = xa + 0.06; x < xb - 0.03; x += 0.15) b.caja(x, y - 0.012, 0, 0.006, 0.006, 2 * zf - 0.05, P.metal, { sin: '-y' });
      for (const z of [-0.36, -0.18, 0, 0.18, 0.36]) b.caja(xc, y - 0.018, z, len - 0.06, 0.006, 0.006, P.metal, { sin: '-y' });
    }
    b.pieza(`largueros nivel ${k + 2}`, 2, 'despliega', { aristas: false });
  });
  const niveles = [0, ...nivs];
  niveles.forEach((yb, lv) => {
    const sig = nivs[lv] ?? H, espacio = Math.min(0.93, sig - yb - 0.27);
    if (espacio < 0.4) return;
    const sitios = [];
    for (let m = 0; m < t; m++) for (const dx of [-0.62, 0.62]) { if (rng.r() < 0.1) continue; sitios.push({ x: xs[m] + (xs[m + 1] - xs[m]) / 2 + dx, tipo: rng.r() }); }
    for (const st of sitios) tarima(b, st.x, yb, rng);
    b.pieza(`tarimas nivel ${lv + 1}`, 3, 'cae', { aristas: false });
    for (const { x, tipo } of sitios) {
      const y0 = yb + 0.116;
      if (tipo < 0.14 && espacio >= 0.85) {
        for (const sx of [-0.25, 0.25]) for (const sz of [-0.25, 0.25]) {
          b.pilar(x + sx, y0, sz, 0.235, 0.86, BARRIL, 10); b.pilar(x + sx, y0 + 0.2, sz, 0.239, 0.022, mezcla(BARRIL, P.negro, 0.2), 10, { sinBase: true }); b.pilar(x + sx, y0 + 0.6, sz, 0.239, 0.022, mezcla(BARRIL, P.negro, 0.2), 10, { sinBase: true });
          b.pilar(x + sx, y0 + 0.86, sz, 0.18, 0.006, claro(BARRIL, 0.2), 10);
        }
        fleje(b, x, y0 + 0.3, 1.0, 1.0);
      } else {
        const k1 = Math.min(rng.rango(0.34, 0.44), espacio * 0.5), k2 = Math.min(rng.rango(0.3, 0.38), espacio - k1), dos = tipo < 0.55;
        for (const sx of [-0.25, 0.25]) for (const sz of [-0.26, 0.26]) {
          carton(b, x + sx, y0, sz, 0.48, k1, 0.5, rng);
          if (!dos) carton(b, x + sx, y0 + k1, sz, 0.48, k2 * 0.9, 0.5, rng);
        }
        if (dos && rng.r() < 0.85) for (const sz of [-0.26, 0.26]) carton(b, x, y0 + k1, sz, 0.98, k2, 0.5, rng);
        else if (dos) for (const sz of [-0.26, 0.26]) for (const sx of [-0.25, 0.25]) carton(b, x + sx, y0 + k1, sz, 0.48, k2 * 0.8, 0.5, rng);
        fleje(b, x, y0 + k1 * 0.4, 1.0, 1.04); fleje(b, x, y0 + k1 * 0.85, 1.0, 1.04);
        carta(b, x + (rng.r() < 0.5 ? -0.25 : 0.25), y0 + k1 * 0.45, 0.26 + 0.2503, 0.14, 0.1, P.blanco);
      }
    }
    b.pieza(`cargas nivel ${lv + 1}`, 4, 'crece', { aristas: false });
  });
}
