// Zona acceso: carritos anidados de varilla, canastillas de mano apiladas y tarima de aparador con maniquíes.
import { P, claro, cesta } from './comun.js';
import { maniquiDetallado } from './comun-b.js';
import { mezcla } from '../piezas.js';

const REJILLA = 0xc3c8cd, VARILLA = 0xaab0b6;
const OUTFITS = [{ top: 0xd99a8a, bottom: 0x5d6a75 }, { top: 0x8fb2d1, bottom: 0xa67950 }, { top: 0xb7a3c9, bottom: 0x33373c }, { top: 0xe8d9b5, bottom: 0x76808e }];

/** Un carrito de varilla: chasis con bandeja inferior y parachoques, ruedas con horquilla, canasta de alambre con asiento, manija. */
function carro(b, c, dz, baja, w, k) {
  const y0 = 0.3 - baja, yt = 0.8 - baja, zc = dz + 0.05, L = 0.64, mango = c.acento, wb = w - 0.14, Lb = L - 0.14;
  // chasis: largueros, travesaños, bandeja inferior de varilla y parachoques frontal
  for (const s of [-1, 1]) b.caja(s * (w / 2 - 0.05), 0.12, dz, 0.022, 0.022, 0.62, P.metalOscuro);
  b.caja(0, 0.12, dz - 0.25, w - 0.1, 0.02, 0.02, P.metalOscuro); b.caja(0, 0.12, dz + 0.27, w - 0.1, 0.02, 0.02, P.metalOscuro);
  for (const s of [-1, 1]) b.caja(s * (w / 2 - 0.07), 0.14, zc, 0.02, y0 - 0.14, 0.02, P.metalOscuro);
  for (const xx of [-0.16, 0, 0.16]) b.caja(xx, 0.1, dz + 0.01, 0.008, 0.008, 0.5, VARILLA);
  b.caja(0, 0.1, dz - 0.14, w - 0.12, 0.008, 0.008, VARILLA); b.caja(0, 0.1, dz + 0.16, w - 0.12, 0.008, 0.008, VARILLA);
  b.caja(0, 0.1, dz + 0.31, w - 0.06, 0.03, 0.02, mango); // parachoques de color
  b.pieza(`chasis ${k}`, 0, 'crece');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - 0.05), z = dz + sz * 0.27;
    b.cil('x', x, 0.05, z, 0.05, 0.03, P.negro, 8); b.cil('x', x, 0.05, z, 0.022, 0.036, P.metal, 6);
    b.caja(x - 0.022, 0.05, z, 0.006, 0.07, 0.034, P.metalOscuro); b.caja(x + 0.022, 0.05, z, 0.006, 0.07, 0.034, P.metalOscuro); b.caja(x, 0.115, z, 0.05, 0.008, 0.05, P.metalOscuro);
    b.pieza(`rueda ${k}`, 1, 'escala', { aristas: false });
  }
  // canasta de alambre: aro superior, aro inferior, varillas horizontales y verticales (cónicas)
  const rect = (y, ww, ll, t) => {
    b.caja(0, y, zc - ll / 2, ww, t, t, VARILLA); b.caja(0, y, zc + ll / 2, ww, t, t, VARILLA);
    b.caja(-ww / 2, y, zc, t, t, ll, VARILLA, { sin: '-y' }); b.caja(ww / 2, y, zc, t, t, ll, VARILLA, { sin: '-y' });
  };
  rect(yt - 0.014, w, L, 0.018); rect(y0, wb, Lb, 0.014);
  for (const f of [0.34, 0.68]) rect(y0 + f * (yt - y0), wb + 0.14 * f, Lb + 0.14 * f, 0.008);
  for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) {
    const u = -0.5 + i / 6;
    b.barra([u * wb, y0, zc + s * Lb / 2], [u * w, yt - 0.014, zc + s * L / 2], 0.008, REJILLA);
  }
  for (let i = 1; i < 8; i++) for (const s of [-1, 1]) {
    const u = -0.5 + i / 8;
    b.barra([s * wb / 2, y0, zc + u * Lb], [s * w / 2, yt - 0.014, zc + u * L], 0.008, REJILLA);
  }
  for (let i = 0; i < 7; i++) b.caja(-wb / 2 + 0.02 + i * (wb - 0.04) / 6, y0 - 0.008, zc, 0.008, 0.008, Lb - 0.02, REJILLA, { sin: '-y' });
  for (let i = 1; i < 6; i++) b.caja(0, y0 - 0.008, zc - Lb / 2 + i * Lb / 6, wb - 0.02, 0.008, 0.008, REJILLA, { sin: '-y' });
  // asiento infantil plegable (lado de la manija) con aberturas para piernas
  b.caja(0, yt - 0.2, zc - L / 2 + 0.1, wb - 0.04, 0.012, 0.18, claro(mango, 0.45)); b.caja(0, yt - 0.2, zc - L / 2 + 0.2, wb - 0.04, 0.012, 0.012, P.metalOscuro); b.caja(0, yt - 0.2, zc - L / 2 + 0.01, wb - 0.04, 0.1, 0.012, claro(mango, 0.45)); b.caja(-0.05, yt - 0.2, zc - L / 2 + 0.1, 0.012, 0.014, 0.16, P.oscuro, { sin: '-y' }); b.caja(0.05, yt - 0.2, zc - L / 2 + 0.1, 0.012, 0.014, 0.16, P.oscuro, { sin: '-y' });
  b.pieza(`canasta ${k}`, 2, 'cae', { aristas: false, caida: 0.3 });
  for (const s of [-1, 1]) { b.caja(s * (w / 2 - 0.08), yt - 0.02, zc - L / 2 - 0.02, 0.025, 0.2, 0.025, P.metalOscuro); b.barra([s * (w / 2 - 0.08), yt - 0.03, zc - L / 2 - 0.02], [s * (w / 2 - 0.05), yt - 0.12, zc - L / 2 + 0.01], 0.014, P.metalOscuro); }
  b.cil('x', 0, yt + 0.17, zc - L / 2 - 0.02 + 0.0125, 0.016, w - 0.12, mango, 8);
  b.pieza(`manija ${k}`, 3, 'crece', { aristas: false });
}

/** Carrito de compras: un carro con asiento abatible y manija con agarradera de color. */
export function carrito(b, c) {
  const { ancho: W } = c;
  carro(b, c, 0.0, 0, W - 0.04, 'A');
}

/** Canastillas de mano: pila de cinco cestas de varilla encajadas sobre una base, con asa abatida; una pila por tramo. */
export function canastilla(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, mod = W / t, col = mezcla(acento, 0xffffff, 0.1), n = 5, hb = 0.1, paso = Math.min(0.03, (H - 0.04 - hb) / (n - 1));
  for (let i = 0; i < t; i++) {
    const x = -W / 2 + (i + 0.5) * mod, w0 = mod - 0.03, d0 = D - 0.03;
    b.caja(x, 0, 0, w0 - 0.06, 0.012, d0 - 0.06, P.oscuro); // base
    b.caja(x, 0.012, d0 / 2 - 0.05, w0 - 0.08, 0.008, 0.012, P.metalOscuro); b.caja(x, 0.012, -d0 / 2 + 0.05, w0 - 0.08, 0.008, 0.012, P.metalOscuro);
    for (let k = 0; k < n; k++) {
      const w = w0 - (n - 1 - k) * 0.012, d = d0 - (n - 1 - k) * 0.012; // la de abajo es la mayor; las de arriba encajan
      cesta(b, x, 0.02 + k * paso, 0, w, d, hb, { rod: 0.1, color: k % 2 ? claro(col, 0.35) : col, rim: k % 2 ? col : claro(col, 0.2), t: 0.008, fondo: k === n - 1 });
    }
    b.pieza(`canasta ${i + 1}`, 0, 'cae', { caida: 0.35 });
    const yt = 0.02 + (n - 1) * paso + hb, w = w0 - 0.0, d = d0;
    for (const s of [-1, 1]) b.cil('z', x + s * (w / 2 - 0.03), yt - 0.004, 0, 0.007, 0.02, P.metalOscuro, 6);
    b.caja(x, yt, 0, w - 0.07, 0.007, 0.024, P.metalOscuro); b.caja(x, yt, 0.02, w - 0.07, 0.007, 0.012, P.metal);
    b.pieza(`asa ${i + 1}`, 1, 'crece', { aristas: false });
  }
}

/**
 * Tarima de aparador: zócalo, bastidor, forro en paneles con juntas, tablero con canto y alfombra, y maniquíes sobre ella.
 * Desviación documentada: los maniquíes sobresalen del alto de 0.30 m del catálogo (la huella en planta no cambia).
 */
export function tarima_aparador(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, rng } = c, mod = W / t, FORRO = 0xe9e7e2;
  b.caja(0, 0, 0, W - 0.14, 0.05, D - 0.14, P.negro); b.caja(0, 0.05, 0, W - 0.06, H - 0.08, D - 0.06, P.oscuro);
  b.pieza('estructura', 0, 'despliega');
  const n = Math.max(1, Math.round(W / 1.0)), pw = W / n;
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) b.caja(-W / 2 + (k + 0.5) * pw, 0.05, s * (D / 2 - 0.008), pw - 0.008, H - 0.08, 0.016, FORRO);
    b.caja(0, 0.05, s * (D / 2 - 0.004), W, 0.012, 0.008, 0xcfcdc8); // junta inferior
  }
  for (const e of [-1, 1]) b.caja(e * (W / 2 - 0.008), 0.05, 0, 0.016, H - 0.08, D - 0.032, FORRO);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.caja(sx * (W / 2 - 0.01), 0.05, sz * (D / 2 - 0.01), 0.02, H - 0.08, 0.02, 0xd7d4ce);
  b.pieza('forro', 1, 'crece');
  b.caja(0, H - 0.03, 0, W, 0.03, D, claro(P.madera, 0.3)); b.caja(0, H - 0.03, 0, W - 0.04, 0.026, D - 0.04, claro(P.madera, 0.45), { sin: '-y+y' });
  b.lamY(0, H + 0.0015, 0, W - 0.3, D - 0.3, claro(P.tela, 0.65));
  for (let k = 1; k < n; k++) b.lamY(-W / 2 + k * pw, H + 0.0025, 0, 0.006, D - 0.3, 0xa7a49d);
  b.pieza('tablero', 2, 'cae');
  for (let i = 0; i < t; i++) for (const dx of [-0.45, 0.45]) {
    const k = `${i * 2 + (dx < 0 ? 1 : 2)}`;
    maniquiDetallado(b, -W / 2 + (i + 0.5) * mod + dx, 0, H, rng.elegir(OUTFITS), k);
    b.agrupar((p) => p.nombre.endsWith(` ${k}`) && p.orden <= 1, `soporte ${k}`, 1, 'crece');
    b.agrupar((p) => p.nombre.endsWith(` ${k}`) && p.orden === 2, `torso ${k}`, 2, 'crece');
    b.agrupar((p) => p.nombre.endsWith(` ${k}`) && p.orden >= 4, `ropa ${k}`, 4, 'crece');
  }
}
