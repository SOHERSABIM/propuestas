// Trastienda: rack selectivo con tarimas y cajas de cartón.
import { P } from './comun.js';

/** Rack selectivo: placas base, bastidores con arriostres, largueros por nivel, tarimas y cajas apiladas. */
export function rack_selectivo(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, rng } = c, mod = W / t, zf = D / 2 - 0.05, up = 0.08;
  const xs = Array.from({ length: t + 1 }, (_, i) => Math.min(W / 2 - up / 2, Math.max(-W / 2 + up / 2, -W / 2 + i * mod)));
  xs.forEach((x, i) => {
    const xp = Math.min(W / 2 - 0.05, Math.max(-W / 2 + 0.05, x));
    for (const s of [-1, 1]) b.caja(xp, 0, s * zf, 0.1, 0.012, 0.1, P.oscuro, { sin: '-y' });
    b.pieza(`placas base ${i + 1}`, 0, 'escala');
  });
  xs.forEach((x, i) => {
    for (const s of [-1, 1]) b.caja(x, 0.012, s * zf, up, H - 0.012, up, P.rackAzul);
    for (const y of [0.25, 1.35, 2.45, H - 0.06]) b.caja(x, y, 0, 0.03, 0.03, D - 0.18, P.rackAzul);
    b.barra([x, 0.27, zf], [x, 1.36, -zf], 0.03, P.rackAzul); b.barra([x, 1.36, -zf], [x, 2.46, zf], 0.03, P.rackAzul); b.barra([x, 2.46, zf], [x, H - 0.05, -zf], 0.03, P.rackAzul);
    b.pieza(`bastidor ${i + 1}`, 1, 'crece');
  });
  const niv = [1.2, 2.4];
  niv.forEach((y, k) => {
    for (let m = 0; m < t; m++) for (const s of [-1, 1]) b.caja(-W / 2 + (m + 0.5) * mod, y - 0.13, s * zf, mod - up, 0.13, 0.05, P.rackNaranja);
    b.pieza(`largueros nivel ${k + 2}`, 2, 'despliega');
  });
  const CART = [P.carton, 0xd6b88c, 0xb8956a];
  for (const [lv, yb] of [[1, 0], [2, 1.2], [3, 2.4]]) {
    for (let m = 0; m < t; m++) for (const dx of [-0.62, 0.62]) {
      if (rng.r() < 0.1) continue;
      const x = -W / 2 + (m + 0.5) * mod + dx, nom = `${lv}.${m * 2 + (dx < 0 ? 1 : 2)}`;
      for (const k of [-0.45, 0, 0.45]) b.caja(x + k, yb, 0, 0.1, 0.1, 1.04, P.tarima);
      b.caja(x, yb + 0.1, 0, 1.0, 0.03, 1.04, P.tarima, { v: 1.06 });
      b.pieza(`tarima ${nom}`, 3, 'cae', { aristas: false });
      const h1 = rng.rango(0.34, 0.44);
      for (const sx of [-0.25, 0.25]) for (const sz of [-0.26, 0.26]) b.caja(x + sx, yb + 0.13, sz, 0.48, h1, 0.5, CART[Math.floor(rng.r() * 3)], { v: rng.rango(0.94, 1.05) });
      if (rng.r() < 0.7) for (const sz of [-0.26, 0.26]) b.caja(x, yb + 0.13 + h1, sz, 0.98, rng.rango(0.3, 0.38), 0.5, CART[Math.floor(rng.r() * 3)], { v: rng.rango(0.94, 1.05) });
      b.pieza(`cajas ${nom}`, 4, 'crece', { aristas: false });
    }
  }
}
