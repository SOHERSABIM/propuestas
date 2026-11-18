// Zona ropa y hogar: racks, mesa, maniquí y probadores.
import { P, claro, prenda, maniqui as dibujarManiqui } from './comun.js';
import { mezcla } from '../piezas.js';

const ropaCol = (c) => c.rng.elegir(c.paletaRopa);
const OUTFITS = [{ top: 0xd99a8a, bottom: 0x5d6a75 }, { top: 0x8fb2d1, bottom: 0xa67950 }, { top: 0xb7a3c9, bottom: 0x33373c }, { top: 0xe8d9b5, bottom: 0x76808e }];

/** Rack redondo: base circular, poste, aro, y prendas que se descuelgan del aro en tres tandas. */
export function rack_redondo(b, c) {
  const { alto: H } = c, R = 0.3, ya = H - 0.22;
  b.pilar(0, 0, 0, 0.44, 0.03, P.metalOscuro, 16); b.pilar(0, 0.03, 0, 0.06, 0.05, P.metal, 10); b.pieza('base circular', 0, 'escala');
  b.pilar(0, 0.08, 0, 0.018, H - 0.2, P.metal, 8); b.pieza('poste', 1, 'crece');
  b.aro(0, ya, 0, R, 0.012, P.metal, 24, 4); b.cil('x', 0, ya, 0, 0.008, R * 2, P.metal, 6); b.cil('z', 0, ya, 0, 0.008, R * 2, P.metal, 6);
  b.esfera(0, H - 0.1, 0, 0.03, P.metalOscuro, 8); b.pieza('aro de colgado', 2, 'cae', { aristas: false });
  const N = 18, tanda = [[], [], []];
  for (let i = 0; i < N; i++) tanda[i % 3].push(i);
  tanda.forEach((ids, k) => {
    for (const i of ids) {
      const th = (i / N) * Math.PI * 2, h = c.rng.rango(0.5, 0.72);
      prenda(b, R * Math.cos(th), ya - 0.02, R * Math.sin(th), 0.26, h, 0.03, ropaCol(c), -th - Math.PI / 2, c.rng.rango(0.94, 1.05));
    }
    b.pieza(`percheros y ropa ${k + 1}`, 4, 'crece', { aristas: false, py: 'max' });
  });
}

/** Rack de cuatro brazos rectos. */
export function rack_cuatro_brazos(b, c) {
  const { alto: H } = c, ya = H - 0.2;
  b.caja(0, 0, 0, 0.76, 0.04, 0.05, P.metalOscuro); b.caja(0, 0, 0, 0.05, 0.04, 0.76, P.metalOscuro); b.pieza('base en cruz', 0, 'despliega');
  b.pilar(0, 0.04, 0, 0.02, H - 0.1, P.metal, 8); b.esfera(0, H - 0.05, 0, 0.03, P.metalOscuro, 8); b.pieza('poste', 1, 'crece');
  const brazos = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  brazos.forEach(([dx, dz], i) => {
    b.cil(dx ? 'x' : 'z', dx * 0.2, ya, dz * 0.2, 0.011, 0.36, P.metal, 6); b.caja(dx * 0.385, ya - 0.012, dz * 0.385, 0.03, 0.024, 0.03, P.metalOscuro);
    b.pieza(`brazo ${i + 1}`, 2, 'escala', { aristas: false });
  });
  brazos.forEach(([dx, dz], i) => {
    for (let k = 0; k < 5; k++) { const d = 0.14 + k * 0.05; prenda(b, dx * d, ya - 0.015, dz * d, 0.22, c.rng.rango(0.5, 0.72), 0.03, ropaCol(c), dx ? 0 : Math.PI / 2, c.rng.rango(0.94, 1.05)); }
    b.pieza(`percheros y ropa ${i + 1}`, 4, 'crece', { aristas: false, py: 'max' });
  });
}

/** Rack recto doble: dos barras a distinta altura y distinto fondo, prendas en hilera. */
export function rack_recto_doble(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t } = c, mod = W / t, yT = H - 0.12, yB = 0.8, zT = -0.1, zB = 0.15;
  for (let i = 0; i <= t; i++) {
    const x = Math.min(W / 2 - 0.02, Math.max(-W / 2 + 0.02, -W / 2 + i * mod));
    b.caja(x, 0, 0.025, 0.04, 0.03, 0.42, P.metalOscuro); b.pieza(`pie ${i + 1}`, 0, 'escala');
    b.pilar(x, 0.03, zT, 0.018, yT - 0.03 + 0.04, P.metal, 8); b.pilar(x, 0.03, zB, 0.018, yB - 0.03 + 0.04, P.metal, 8);
    b.pieza(`postes ${i + 1}`, 1, 'crece', { aristas: false });
  }
  b.cil('x', 0, yT, zT, 0.012, W - 0.06, P.metal, 6); b.pieza('barra superior', 2, 'despliega', { aristas: false });
  b.cil('x', 0, yB, zB, 0.012, W - 0.06, P.metal, 6); b.pieza('barra inferior', 2, 'despliega', { aristas: false });
  const paso = 0.075;
  for (const [y, z, h0, nom] of [[yT, zT, 0.5, 'superior'], [yB, zB, 0.42, 'inferior']]) {
    for (let x = -W / 2 + 0.06; x < W / 2 - 0.05; x += paso) prenda(b, x, y - 0.015, z, 0.26, h0 * c.rng.rango(0.8, 1.15), 0.03, ropaCol(c), 0, c.rng.rango(0.94, 1.05));
    b.pieza(`percheros y ropa ${nom}`, 4, 'crece', { aristas: false, py: 'max' });
  }
}

/** Mesa de exhibición con pilas de producto doblado. */
export function mesa_exhibicion(b, c) {
  const { ancho: W, fondo: D, alto: H } = c, yt = H - 0.15;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => { b.caja(sx * (W / 2 - 0.07), 0, sz * (D / 2 - 0.07), 0.05, yt, 0.05, P.maderaOscura); b.pieza(`pata ${i + 1}`, 1, 'crece'); });
  b.caja(0, yt, 0, W, 0.04, D, P.madera); b.pieza('cubierta', 2, 'cae');
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 2; iz++) {
    const x = (ix - 1) * 0.38, z = (iz - 0.5) * 0.34, n = 2;
    for (let k = 0; k < n; k++) b.caja(x + c.rng.rango(-0.01, 0.01), yt + 0.04 + k * 0.048, z, 0.32, 0.048, 0.26, ropaCol(c), { v: c.rng.rango(0.95, 1.05) });
    b.pieza(`pila ${ix * 2 + iz + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Maniquí abstracto. */
export function maniqui(b, c) { dibujarManiqui(b, 0, 0, 0, c.rng.elegir(OUTFITS)); }

function cornisa(b, c, W, D, H, acento) { b.caja(0, H - 0.2, D / 2 - 0.05, W, 0.2, 0.1, acento); b.pieza('cornisa', 3, 'cae'); }

/** Probador: batería de cabinas de 1 m con mamparas, cortina, espejo, banca y gancho. */
export function probador(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento } = c, PISO = 0xd9c4a0, PARED = 0xf1efe9, FONDO = 0xcfc8bc, CORT = mezcla(acento, 0xd8d3cc, 0.55);
  b.caja(0, 0, 0, W, 0.03, D, PISO); b.pieza('piso', 0, 'despliega');
  for (let i = 0; i <= t; i++) { b.caja(-W / 2 + 0.015 + i * ((W - 0.03) / t), 0.03, 0, 0.03, H - 0.23, D, PARED); b.pieza(`mampara ${i + 1}`, 1, 'crece'); }
  b.caja(0, 0.03, -D / 2 + 0.015, W - 0.06, H - 0.23, 0.03, FONDO); b.pieza('muro de fondo', 1, 'crece');
  const pw = (W - 0.03) / t;
  for (let i = 0; i < t; i++) {
    const xc = -W / 2 + 0.015 + (i + 0.5) * pw;
    b.caja(xc, 0.7, -D / 2 + 0.034, 0.5, 1.4, 0.008, P.cristal); b.pieza(`espejo ${i + 1}`, 3, 'escala');
    b.caja(xc + 0.2, 0.03, -D / 2 + 0.2, 0.4, 0.42, 0.32, P.madera); b.pieza(`banca ${i + 1}`, 3, 'desliza');
    b.cil('z', xc - 0.3, 1.7, -D / 2 + 0.07, 0.01, 0.07, P.metalOscuro, 6); b.pieza(`gancho ${i + 1}`, 3, 'escala', { aristas: false });
    for (let k = 0; k < 6; k++) b.caja(xc - pw / 2 + 0.05 + 0.1 * k, 0.1, D / 2 - 0.12, 0.1, 2.0, 0.02, CORT, { v: 0.92 + (k % 2) * 0.12 });
    b.pieza(`cortina ${i + 1}`, 3, 'despliega', { px: 'min', aristas: false });
  }
  cornisa(b, c, W, D, H, acento);
}

/** Probador accesible: círculo de giro de 1.52 m, puerta abatible hacia afuera, banca, barra de apoyo. */
export function probador_accesible(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c, PISO = 0xd9c4a0, PARED = 0xf1efe9;
  b.caja(0, 0, 0, W, 0.03, D, PISO); b.pieza('piso', 0, 'despliega');
  b.pilar(0, 0.03, 0, 0.76, 0.004, mezcla(PISO, acento, 0.35), 28, { sinBase: true }); b.pieza('círculo de giro', 1, 'escala', { aristas: false });
  for (const s of [-1, 1]) { b.caja(s * (W / 2 - 0.015), 0.03, 0, 0.03, H - 0.23, D, PARED); b.pieza(`mampara ${s < 0 ? 'izq' : 'der'}`, 1, 'crece'); }
  b.caja(0, 0.03, -D / 2 + 0.015, W - 0.06, H - 0.23, 0.03, 0xcfc8bc); b.pieza('muro de fondo', 1, 'crece');
  for (const s of [-1, 1]) b.caja(s * 0.65, 0.03, D / 2 - 0.015, 0.4, H - 0.23, 0.03, PARED);
  b.pieza('frente con puerta fija', 1, 'crece');
  b.caja(-0.1, 0.03, -D / 2 + 0.28, 1.07, 0.43, 0.5, P.madera); b.pieza('banca', 3, 'desliza');
  b.caja(-0.1, 0.8, -D / 2 + 0.034, 0.9, 1.3, 0.008, P.cristal); b.pieza('espejo', 3, 'escala');
  b.cil('z', 0.79, 0.85, 0.0, 0.016, 0.9, P.metal, 8); b.caja(0.8, 0.8, 0.43, 0.03, 0.1, 0.03, P.metalOscuro); b.caja(0.8, 0.8, -0.43, 0.03, 0.1, 0.03, P.metalOscuro);
  b.pieza('barra de apoyo', 3, 'escala', { aristas: false });
  b.caja(0.45 - 0.45, 0.03, D / 2 - 0.015, 0.88, H - 0.33, 0.03, P.madera); b.caja(0.35, 1.0, D / 2 + 0.0 - 0.03, 0.03, 0.12, 0.03, P.metalOscuro);
  b.pieza('puerta abatible', 3, 'despliega', { px: 'min' });
  cornisa(b, c, W, D, H, acento);
}
