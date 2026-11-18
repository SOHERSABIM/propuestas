// Zona ropa y hogar: racks, mesa, maniquí y probadores (nivel de detalle R1: prendas con silueta colgadas de ganchos,
// componentes reales de cada mueble, maniquí de proporción humana abstracta).
import { P, claro, Marco, giroHacia, prendaVariada, maniquiDetallado, carta, mezcla, doblada } from './comun-b.js';

const OUTFITS = [{ top: 0xd99a8a, bottom: 0x5d6a75 }, { top: 0x8fb2d1, bottom: 0xa67950 }, { top: 0xb7a3c9, bottom: 0x33373c }, { top: 0xe8d9b5, bottom: 0x76808e }];
const SEMI = 0.205; // semiancho nominal de una prenda con mangas (a escala 1)

/** Rack redondo: base con escalón, poste telescópico con abrazadera y perilla, aro con rayos y prendas radiales en ganchos. */
export function rack_redondo(b, c) {
  const { alto: H, ancho: A, rng } = c, hw = Math.min(0.185, A * 0.21), R = A / 2 - hw - 0.005, ya = H - 0.22, rb = Math.min(0.44, A / 2 - 0.004);
  b.pilar(0, 0, 0, rb, 0.012, P.metalOscuro, 40); b.pilar(0, 0.012, 0, rb * 0.95, 0.008, P.metalOscuro, 40); b.pilar(0, 0.02, 0, rb * 0.8, 0.012, P.oscuro, 40); b.aro(0, 0.032, 0, rb * 0.9, 0.004, P.metal, 40, 3);
  b.pilar(0, 0.028, 0, 0.075, 0.03, P.metal, 12); b.pilar(0, 0.058, 0, 0.05, 0.022, P.metalOscuro, 10);
  b.pieza('base circular', 0, 'escala');
  const yc = 0.08 + H * 0.45;
  b.pilar(0, 0.08, 0, 0.02, yc - 0.08, P.metal, 10); b.pilar(0, yc, 0, 0.029, 0.045, P.oscuro, 10); b.cil('x', 0.05, yc + 0.022, 0, 0.011, 0.04, P.metalOscuro, 6); b.esfera(0.075, yc + 0.022, 0, 0.016, P.negro, 6);
  b.pilar(0, yc + 0.045, 0, 0.014, H - 0.13 - (yc + 0.045), P.metal, 8); b.pilar(0, ya - 0.025, 0, 0.026, 0.05, P.metalOscuro, 10); b.esfera(0, H - 0.1, 0, 0.03, P.metalOscuro, 8);
  b.pieza('poste', 1, 'crece', { aristas: false });
  b.aro(0, ya, 0, R, 0.012, P.metal, 28, 4); b.cil('x', 0, ya, 0, 0.008, R * 2, P.metal, 6); b.cil('z', 0, ya, 0, 0.008, R * 2, P.metal, 6);
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) b.barra([0.02 * Math.cos(a), ya, 0.02 * Math.sin(a)], [R * Math.cos(a), ya, R * Math.sin(a)], 0.012, P.metal);
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; b.caja(R * Math.cos(a), ya - 0.016, R * Math.sin(a), 0.032, 0.032, 0.032, P.metalOscuro); }
  b.pieza('aro de colgado', 2, 'cae', { aristas: false });
  const N = Math.max(12, Math.round((2 * Math.PI * R) / 0.088)), tanda = [[], [], []];
  for (let i = 0; i < N; i++) tanda[i % 3].push(i);
  tanda.forEach((ids, k) => {
    for (const i of ids) {
      const th = (i / N) * Math.PI * 2, s = (hw / SEMI) * rng.rango(0.9, 1);
      prendaVariada(new Marco(b, R * Math.cos(th), ya, R * Math.sin(th), giroHacia(Math.cos(th), Math.sin(th)), s), rng, c.paletaRopa, { L: 0.78 });
    }
    b.pieza(`percheros y ropa ${k + 1}`, 4, 'crece', { aristas: false, py: 'max' });
  });
}

/** Rack de cuatro brazos: base en cruz con regatones, poste telescópico, cubo con cuatro cuencas, brazos con tirante y remates. */
export function rack_cuatro_brazos(b, c) {
  const { alto: H, ancho: A, rng } = c, ya = H - 0.2, Lb = A / 2 - 0.02, base = A - 0.04, yc = 0.06 + H * 0.4;
  b.caja(0, 0, 0, base - 0.08, 0.04, 0.05, P.metalOscuro); b.caja(0, 0, 0, 0.05, 0.04, base - 0.08, P.metalOscuro);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.caja(dx * (base / 2 - 0.02), 0, dz * (base / 2 - 0.02), 0.055, 0.044, 0.055, P.negro);
  b.pilar(0, 0, 0, 0.075, 0.052, P.metal, 12);
  b.pieza('base en cruz', 0, 'despliega');
  b.pilar(0, 0.052, 0, 0.022, yc - 0.052, P.metal, 10); b.pilar(0, yc, 0, 0.03, 0.045, P.oscuro, 10); b.cil('x', 0.05, yc + 0.022, 0, 0.011, 0.04, P.metalOscuro, 6); b.esfera(0.075, yc + 0.022, 0, 0.016, P.negro, 6);
  b.pilar(0, yc + 0.045, 0, 0.015, ya - 0.04 - (yc + 0.045) + 0.1, P.metal, 8); b.pilar(0, ya - 0.035, 0, 0.034, 0.07, P.metalOscuro, 10);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.caja(dx * 0.04, ya - 0.017, dz * 0.04, 0.034, 0.034, 0.034, P.metal);
  b.esfera(0, ya + 0.095, 0, 0.03, P.metalOscuro, 8);
  b.pieza('poste', 1, 'crece', { aristas: false });
  const brazos = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  brazos.forEach(([dx, dz], i) => {
    b.cil(dx ? 'x' : 'z', dx * (0.05 + Lb) / 2, ya, dz * (0.05 + Lb) / 2, 0.011, Lb - 0.05, P.metal, 6); b.esfera(dx * Lb, ya, dz * Lb, 0.017, P.metalOscuro, 6);
    b.barra([0, ya - 0.2, 0], [dx * Lb * 0.6, ya - 0.008, dz * Lb * 0.6], 0.009, P.metal);
    b.pieza(`brazo ${i + 1}`, 2, 'escala', { aristas: false });
  });
  brazos.forEach(([dx, dz], i) => {
    const s = 0.14 / SEMI;
    for (let d = 0.17; d < Lb - 0.025; d += 0.062) prendaVariada(new Marco(b, dx * d, ya, dz * d, giroHacia(dx ? 0 : 1, dx ? 1 : 0), s * rng.rango(0.92, 1)), rng, c.paletaRopa, { L: 0.8 });
    b.pieza(`percheros y ropa ${i + 1}`, 4, 'crece', { aristas: false, py: 'max' });
  });
}

/** Rack recto doble: pies en T con regatones, postes telescópicos con abrazaderas, dos barras con remates y prendas variadas. */
export function rack_recto_doble(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, rng } = c, mod = W / t, hw = 0.15, g = Math.max(0.03, D / 2 - hw - 0.005), yT = H - 0.12, yB = Math.min(0.8, yT - 0.62), zT = -g, zB = g, lf = Math.min(2 * g + 0.2, D - 0.04);
  const xs = Array.from({ length: t + 1 }, (_, i) => Math.min(W / 2 - 0.02, Math.max(-W / 2 + 0.02, -W / 2 + i * mod)));
  xs.forEach((x, i) => {
    b.caja(x, 0.006, 0, 0.04, 0.026, lf, P.metalOscuro); for (const s of [-1, 1]) b.caja(x, 0, s * (lf / 2 - 0.02), 0.05, 0.032, 0.05, P.negro);
    b.pieza(`pie ${i + 1}`, 0, 'escala');
    for (const [z, y] of [[zT, yT], [zB, yB]]) {
      b.pilar(x, 0.03, z, 0.018, y - 0.03 + 0.03, P.metal, 8); b.pilar(x, 0.34, z, 0.026, 0.04, P.oscuro, 8); b.pilar(x, y - 0.045, z, 0.026, 0.045, P.metalOscuro, 8); b.esfera(x, y + 0.03, z, 0.019, P.metalOscuro, 6);
    }
    b.pieza(`postes ${i + 1}`, 1, 'crece', { aristas: false });
  });
  for (const [y, z, nom] of [[yT, zT, 'superior'], [yB, zB, 'inferior']]) {
    b.cil('x', 0, y, z, 0.012, W - 0.06, P.metal, 6); for (const s of [-1, 1]) b.esfera(s * (W / 2 - 0.03), y, z, 0.017, P.metalOscuro, 6);
    b.pieza(`barra ${nom}`, 2, 'despliega', { aristas: false });
  }
  const paso = 0.09;
  for (const [y, z, nom, tipos, L] of [[yT, zT, 'superior', ['camisa', 'camisa', 'abrigo', 'vestido', 'blusa'], 0.9], [yB, zB, 'inferior', ['pantalon', 'pantalon', 'blusa', 'camisa', 'vestido', 'abrigo'], 1.0]]) {
    for (let x = -W / 2 + 0.07; x < W / 2 - 0.06; x += paso) prendaVariada(new Marco(b, x, y, z, giroHacia(0, 1), (hw / SEMI) * rng.rango(0.92, 1)), rng, c.paletaRopa, { tipos, L });
    b.pieza(`percheros y ropa ${nom}`, 4, 'crece', { aristas: false, py: 'max' });
  }
}

/** Mesa de exhibición: patas cónicas con niveladores, faldón, tablero con canto y pilas de producto doblado de varios tipos. */
export function mesa_exhibicion(b, c) {
  const { ancho: W, fondo: D, alto: H, rng } = c, yt = H - 0.15, MAD = P.maderaOscura;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    const x = sx * (W / 2 - 0.06), z = sz * (D / 2 - 0.06);
    b.tronco(x, 0.012, z, 0.034, 0.034, 0.056, 0.056, yt - 0.012, MAD); b.pilar(x, 0, z, 0.02, 0.012, P.negro, 8);
    b.pieza(`pata ${i + 1}`, 1, 'crece', { aristas: false });
  });
  b.caja(0, yt, 0, W, 0.034, D, P.madera); b.caja(0, yt + 0.034, 0, W - 0.0, 0.006, D - 0.0, claro(P.madera, 0.3), { sin: '-y' });
  b.caja(0, yt - 0.075, D / 2 - 0.07, W - 0.12, 0.075, 0.025, MAD); b.caja(0, yt - 0.075, -D / 2 + 0.07, W - 0.12, 0.075, 0.025, MAD);
  for (const s of [-1, 1]) b.caja(s * (W / 2 - 0.07), yt - 0.075, 0, 0.025, 0.075, D - 0.14, MAD);
  b.pieza('cubierta', 2, 'cae');
  const dx = (W - 0.16) / 3, pw = Math.min(0.34, dx - 0.04), pd = Math.min(0.3, (D - 0.14) / 2 - 0.03), y0 = yt + 0.04, tipos = ['camisa', 'camisa', 'jean', 'jersey', 'camisa', 'toalla'];
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 2; iz++) {
    const x = (ix - 1) * dx, z = (iz - 0.5) * (D / 2 - 0.02), tipo = tipos[ix * 2 + iz], col = rng.elegir(c.paletaRopa), col2 = rng.elegir(c.paletaRopa);
    if (tipo === 'toalla') {
      const r = 0.035, base = [[-1.1, 0], [0, 0], [1.1, 0], [-0.55, 1], [0.55, 1]];
      base.forEach(([k, row], n) => b.cil('z', x + k * (pw * 0.3), y0 + r + row * r * 1.55, z, r, pd, n % 2 ? col : col2, 8));
    } else {
      const n = tipo === 'jersey' ? 3 : tipo === 'jean' ? 4 : 5, hh = tipo === 'jersey' ? 0.038 : tipo === 'jean' ? 0.03 : 0.024;
      for (let k = 0; k < n; k++) {
        const cc = tipo === 'jean' ? (k % 2 ? 0x6f87a3 : 0x5f7691) : k % 2 ? col : col2, ox = rng.rango(-0.012, 0.012), oz = rng.rango(-0.01, 0.01);
        doblada(b, x + ox, y0 + k * hh, z + oz, pw * rng.rango(0.94, 1), hh * 1.04, pd * rng.rango(0.94, 1), cc, { pliegue: k === n - 1, v: rng.rango(0.97, 1.03) });
      }
    }
    b.pieza(`pila ${ix * 2 + iz + 1}`, 4, 'crece', { aristas: false });
  }
}

/** Maniquí abstracto de proporción humana (7.5 cabezas), sin rostro, con soporte trasero. */
export function maniqui(b, c) { maniquiDetallado(b, 0, 0, 0, c.rng.elegir(OUTFITS)); }

function cornisa(b, c, W, D, H, acento, t = 1) {
  b.caja(0, H - 0.2, D / 2 - 0.05, W, 0.2, 0.1, acento); b.caja(0, H - 0.012, D / 2 - 0.05, W + 0.01, 0.012, 0.112, claro(acento, 0.4)); b.caja(0, H - 0.2, D / 2 - 0.05, W - 0.04, 0.012, 0.112, P.metalOscuro);
  for (let i = 0; i < t; i++) {
    const xc = -W / 2 + ((i + 0.5) * W) / t;
    b.caja(xc, H - 0.14, D / 2 + 0.002, 0.14, 0.07, 0.006, claro(acento, 0.75), { sin: '-y' }); b.esfera(xc + 0.2 * (W / t) / 1, H - 0.105, D / 2 + 0.003, 0.012, i % 2 ? 0x7bbf8a : 0xd98f7a, 6);
  }
  b.pieza('cornisa', 3, 'cae', { aristas: false });
}

/** Probador: batería de cabinas con mamparas con perfil, zócalo metálico, cortina con riel y anillos, espejo con marco, banca y colgador con prenda. */
export function probador(b, c) {
  const { ancho: W, fondo: D, alto: H, tramos: t, acento, rng } = c, PISO = 0xd9c4a0, PARED = 0xf1efe9, FONDO = 0xcfc8bc, CORT = mezcla(acento, 0xd8d3cc, 0.55), hp = H - 0.23, pw = (W - 0.03) / t;
  b.caja(0, 0, 0, W, 0.03, D, PISO); b.caja(0, 0.03, D / 2 - 0.02, W, 0.008, 0.04, P.metal);
  for (let i = 0; i < t; i++) b.caja(-W / 2 + 0.015 + (i + 0.5) * pw, 0.03, 0.05, Math.min(0.72, pw - 0.2), 0.005, 0.6, mezcla(acento, 0xd8d3cc, 0.7));
  b.pieza('piso', 0, 'despliega', { aristas: false });
  for (let i = 0; i <= t; i++) {
    const x = -W / 2 + 0.015 + i * pw;
    b.caja(x, 0.03, 0, 0.03, hp, D, PARED); b.caja(x, 0.03, D / 2 - 0.01, 0.034, hp, 0.02, P.metal); b.caja(x, 0.03, 0, 0.034, 0.1, D - 0.02, P.metalOscuro); b.caja(x, 0.03 + hp - 0.02, 0, 0.034, 0.02, D, claro(PARED, 0.0));
    b.pieza(`mampara ${i + 1}`, 1, 'crece');
  }
  b.caja(0, 0.03, -D / 2 + 0.015, W - 0.06, hp, 0.03, FONDO); b.caja(0, 0.03, -D / 2 + 0.034, W - 0.06, 0.09, 0.008, mezcla(FONDO, 0x33373c, 0.2)); b.caja(0, 0.03 + hp - 0.03, -D / 2 + 0.034, W - 0.06, 0.03, 0.008, claro(FONDO, 0.3));
  b.pieza('muro de fondo', 1, 'crece');
  for (let i = 0; i < t; i++) {
    const xc = -W / 2 + 0.015 + (i + 0.5) * pw, zm = -D / 2 + 0.034, my = 0.7, mh = 1.4;
    b.caja(xc, my, zm, 0.5, mh, 0.008, P.cristal, { v: 1.04 }); carta(b, xc - 0.12, my + 0.25, zm + 0.0042, 0.05, 0.85, claro(P.cristal, 0.55)); carta(b, xc - 0.02, my + 0.1, zm + 0.0042, 0.02, 0.6, claro(P.cristal, 0.55));
    for (const s of [-1, 1]) b.caja(xc + s * 0.265, my - 0.015, zm, 0.03, mh + 0.03, 0.02, P.metalOscuro); b.caja(xc, my - 0.015, zm, 0.5, 0.03, 0.02, P.metalOscuro); b.caja(xc, my + mh - 0.015, zm, 0.5, 0.03, 0.02, P.metalOscuro);
    b.caja(xc, my + mh + 0.03, zm + 0.02, 0.4, 0.022, 0.03, P.led);
    b.pieza(`espejo ${i + 1}`, 3, 'escala', { aristas: false });
    const bx = xc + 0.2, bz = -D / 2 + 0.2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.tronco(bx + sx * 0.16, 0.03, bz + sz * 0.11, 0.032, 0.032, 0.042, 0.042, 0.37, P.madera);
    b.caja(bx, 0.15, bz, 0.32, 0.02, 0.026, P.madera); b.caja(bx, 0.4, bz, 0.4, 0.035, 0.32, P.madera); b.caja(bx, 0.435, bz, 0.37, 0.03, 0.29, P.tela);
    b.pieza(`banca ${i + 1}`, 3, 'desliza', { aristas: false });
    const px = xc - 0.37, pz = -D / 2 + 0.03;
    b.caja(px, 1.58, pz, 0.2, 0.07, 0.016, P.madera);
    for (const dx of [-0.06, 0, 0.06]) { b.cil('z', px + dx, 1.615, pz + 0.04, 0.008, 0.064, P.metal, 6); b.esfera(px + dx, 1.615, pz + 0.075, 0.012, P.metalOscuro, 6); }
    prendaVariada(new Marco(b, px, 1.615, pz + 0.075, 0, 0.72), rng, c.paletaRopa, { tipos: ['camisa', 'abrigo', 'vestido'] });
    b.pieza(`gancho ${i + 1}`, 3, 'escala', { aristas: false });
    const zc = D / 2 - 0.12, n = 11, abierta = i % 2 === 0, sw = ((pw - 0.06) * (abierta ? 0.36 : 1)) / n;
    b.caja(xc, H - 0.27, zc, pw - 0.05, 0.02, 0.028, P.metal);
    for (let k = 0; k < n; k++) {
      const x = xc - (pw - 0.06) / 2 + (k + 0.5) * sw, dz = k % 2 ? 0.014 : -0.014;
      if (abierta) { const xr = xc + (pw - 0.06) / 2 - (k + 0.5) * sw; b.caja(xr, 0.1, zc + dz * 1.6, sw * 1.35, 2.0, 0.026, CORT, { v: 0.9 + (k % 2) * 0.14 }); b.caja(xr, H - 0.3, zc, 0.012, 0.03, 0.012, P.metalOscuro, { sin: '-y' }); continue; }
      b.caja(x, 0.1, zc + dz, sw * 1.02, 2.0 + 0.0, 0.02, CORT, { v: 0.9 + (k % 2) * 0.14 });
      b.caja(x, H - 0.3, zc, 0.012, 0.03, 0.012, P.metalOscuro, { sin: '-y' });
    }
    if (abierta) b.caja(xc + (pw - 0.06) / 2 - (pw - 0.06) * 0.18, 0.1, zc, (pw - 0.06) * 0.36, 0.035, 0.05, mezcla(CORT, 0x33373c, 0.3), { sin: '-y' }); else b.caja(xc, 0.1, zc, pw - 0.06, 0.035, 0.05, mezcla(CORT, 0x33373c, 0.3), { sin: '-y' });
    b.pieza(`cortina ${i + 1}`, 3, 'despliega', { px: 'min', aristas: false });
  }
  cornisa(b, c, W, D, H, acento, t);
}

/** Probador accesible: círculo de giro de 1.52 m, banca abatible con soportes, barras de apoyo con bridas, espejo, botón de llamada y puerta con herrajes. */
export function probador_accesible(b, c) {
  const { ancho: W, fondo: D, alto: H, acento } = c, PISO = 0xd9c4a0, PARED = 0xf1efe9, hp = H - 0.23;
  b.caja(0, 0, 0, W, 0.03, D, PISO); b.caja(0, 0.03, D / 2 - 0.025, 0.9, 0.006, 0.05, P.metal);
  b.pieza('piso', 0, 'despliega', { aristas: false });
  b.pilar(0, 0.03, 0, 0.76, 0.002, mezcla(PISO, 0x7d7566, 0.1), 36, { sinBase: true });
  b.pieza('círculo de giro', 1, 'escala', { aristas: false });
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.015);
    b.caja(x, 0.03, 0, 0.03, hp, D, PARED); b.caja(x, 0.03, D / 2 - 0.01, 0.034, hp, 0.02, P.metal); b.caja(x, 0.03, 0, 0.034, 0.1, D - 0.02, P.metalOscuro); b.caja(x, 0.03 + hp - 0.02, 0, 0.034, 0.02, D, PARED);
    b.pieza(`mampara ${s < 0 ? 'izq' : 'der'}`, 1, 'crece');
  }
  b.caja(0, 0.03, -D / 2 + 0.015, W - 0.06, hp, 0.03, 0xcfc8bc); b.caja(0, 0.03, -D / 2 + 0.034, W - 0.06, 0.09, 0.008, 0xa9a398); b.caja(0, 0.03 + hp - 0.03, -D / 2 + 0.034, W - 0.06, 0.03, 0.008, 0xded9cf);
  b.pieza('muro de fondo', 1, 'crece');
  for (const s of [-1, 1]) { b.caja(s * 0.65, 0.03, D / 2 - 0.015, 0.4, hp, 0.03, PARED) }
  b.caja(0, 0.03 + hp - 0.12, D / 2 - 0.015, 0.9, 0.12, 0.03, PARED); b.caja(-0.45, 0.03, D / 2 - 0.015, 0.03, hp - 0.1, 0.034, P.metal); b.caja(0.45, 0.03, D / 2 - 0.015, 0.03, hp - 0.1, 0.034, P.metal);
  b.pieza('frente con puerta fija', 1, 'crece');
  const bz = -D / 2 + 0.03 + 0.25;
  b.caja(-0.1, 0.43, bz, 1.07, 0.04, 0.5, P.madera); b.caja(-0.1, 0.47, bz, 1.0, 0.035, 0.44, P.tela);
  for (const s of [-1, 1]) { b.caja(-0.1 + s * 0.48, 0.03, bz + 0.2, 0.04, 0.4, 0.04, P.metalOscuro); b.barra([-0.1 + s * 0.48, 0.2, bz + 0.2], [-0.1 + s * 0.48, 0.43, -D / 2 + 0.06], 0.025, P.metal); }
  b.pieza('banca', 3, 'desliza', { aristas: false });
  const zm = -D / 2 + 0.034;
  b.caja(-0.1, 0.8, zm, 0.9, 1.3, 0.008, P.cristal, { v: 1.04 }); carta(b, -0.3, 1.0, zm + 0.0042, 0.07, 0.9, claro(P.cristal, 0.55)); carta(b, -0.18, 0.9, zm + 0.0042, 0.025, 0.6, claro(P.cristal, 0.55));
  for (const s of [-1, 1]) b.caja(-0.1 + s * 0.465, 0.785, zm, 0.03, 1.33, 0.02, P.metalOscuro); b.caja(-0.1, 0.785, zm, 0.9, 0.03, 0.02, P.metalOscuro); b.caja(-0.1, 2.085, zm, 0.9, 0.03, 0.02, P.metalOscuro);
  b.pieza('espejo', 3, 'escala', { aristas: false });
  const xw = W / 2 - 0.03;
  b.cil('z', xw - 0.05, 0.85, 0, 0.017, 0.9, P.metal, 8);
  for (const z of [-0.43, 0.43]) { b.cil('x', xw - 0.008, 0.85, z, 0.03, 0.012, P.metalOscuro, 10); b.cil('x', xw - 0.03, 0.85, z, 0.012, 0.04, P.metal, 6); }
  b.cil('y', -W / 2 + 0.09, 1.0, -D / 2 + 0.07, 0.017, 0.75, P.metal, 8); b.cil('x', 0.0, 0.85, -D / 2 + 0.065, 0.017, 0.7, P.metal, 8);
  b.cil('x', xw - 0.019, 1.11, 0.42, 0.022, 0.014, 0xc8574a, 10); b.caja(xw - 0.006, 1.075, 0.42, 0.012, 0.07, 0.07, P.blanco);
  b.caja(xw - 0.01, 1.5, -0.3, 0.02, 0.05, 0.3, P.madera); for (const z of [-0.37, -0.3, -0.23]) b.cil('x', xw - 0.04, 1.525, z, 0.007, 0.04, P.metal, 6);
  b.pieza('barra de apoyo', 3, 'escala', { aristas: false });
  const dl = 0.88, dh = hp - 0.1, dz = D / 2 - 0.015;
  b.caja(0, 0.03, dz, dl, dh, 0.03, P.madera); b.caja(0, 0.15, dz + 0.016, dl - 0.1, dh - 0.24, 0.004, claro(P.madera, 0.12));
  b.caja(0, 0.03, dz + 0.017, dl, 0.2, 0.006, P.metal); b.caja(0, 0.03, dz - 0.017, dl, 0.2, 0.006, P.metal);
  b.caja(0.33, 1.0, dz + 0.017, 0.05, 0.12, 0.006, P.metalOscuro); b.cil('x', 0.31, 1.03, dz + 0.027, 0.007, 0.16, P.metal, 6);
  for (const y of [0.25, 1.1, 1.95]) b.caja(-dl / 2 + 0.01, y, dz, 0.025, 0.1, 0.04, P.metalOscuro);
  b.pieza('puerta abatible', 3, 'despliega', { px: 'min' });
  cornisa(b, c, W, D, H, acento, 1);
}
