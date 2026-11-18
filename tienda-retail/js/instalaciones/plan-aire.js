// PLAN DE AIRE ACONDICIONADO (puro). Red de ductos rectangulares hecha de piezas reales: tramos de 1.2–1.5 m con
// bridas, codos, tés, reducciones, compuertas, bajantes de unidades paquete, conexiones flexibles a difusores y
// rejillas de retorno. Cada pieza lleva su distancia `d` por la red desde la unidad más cercana: de ahí sale el
// orden de aparición (tiempos.js). Alturas: ducto principal y ramales a 3.90 m; difusores con cuello a 3.75 m.
import { r3, rectC, solapa, rectEnPoligono, segDentro, rectSeg, cajaEje, cajaC, unirCajas, huellaMueble, rectsDePoligono, yawX, yawHacia } from './util.js';

export const Y_DUCTO = 3.9, Y_CUELLO = 3.75, Y_CARA = 3.35, Y_RETORNO = 3.55, Y_AZOTEA = 4.8;
export const DIM_UNIDAD = { ancho: 2.4, fondo: 1.6, alto: 1.0 };
export const SZ = { P: { w: 0.7, h: 0.4 }, R: { w: 0.4, h: 0.3 }, S: { w: 0.3, h: 0.225 } };
const TEE_R = 0.9, TEE_P = 1.0, STUB = 0.55, TRAMO = 1.35, DROP = 0.7;

const dirNeg = (d) => [-d[0], -d[1]];
const ejeDe = (d) => (Math.abs(d[0]) > 0.5 ? 'x' : 'z');

/**
 * @param {any} local @param {any} layout
 * @param {{equiposFrios:any[], altos:{r:any,alto:number}[]}} ctx
 */
export function planAire(local, layout, ctx) {
  const poly = local.poligono;
  const equipos = ctx.equiposFrios;
  const media = local.columna / 2;
  const obs = [
    ...local.columnas.map(([x, z]) => ({ x, z, h: media })),
    ...equipos.map((e) => ({ x: e.frio.conexion[0], z: e.frio.conexion[2], h: 0.2 })),
  ];
  const rects = rectsDePoligono(poly).filter((r) => Math.max(r.x1 - r.x0, r.z1 - r.z0) >= 6 && Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 3.5);
  const area = layout.indicadores?.superficie ?? rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
  const Y = Y_DUCTO;
  const altosCh = (yMin) => ctx.altos.filter((a) => a.alto > yMin).map((a) => a.r);

  // ───────── espinas (ducto principal) ─────────
  const espinas = [];
  for (const r of rects) {
    const eje = r.x1 - r.x0 >= r.z1 - r.z0 ? 'x' : 'z';
    const a = (eje === 'x' ? r.x0 : r.z0) + 1.0, b = (eje === 'x' ? r.x1 : r.z1) - 1.0;
    const pMin = (eje === 'x' ? r.z0 : r.x0) + 1.2, pMax = (eje === 'x' ? r.z1 : r.x1) - 1.2;
    const centro = (pMin + pMax) / 2; let fijo = null;
    for (let k = 0; k < 80 && fijo == null; k++) {
      const f = centro + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25);
      if (f < pMin || f > pMax) continue;
      const choca = obs.some((c) => { const per = eje === 'x' ? c.z : c.x, al = eje === 'x' ? c.x : c.z; return Math.abs(per - f) < 0.35 + c.h + 0.2 && al > a - 0.75 && al < b + 0.75; });
      if (!choca) fijo = f;
    }
    if (fijo == null) fijo = centro;
    espinas.push({ rect: r, eje, a, b, fijo, long: b - a, id: 'dp' + (espinas.length + 1) });
  }
  const pt = (e, u, f = e.fijo) => (e.eje === 'x' ? [r3(u), Y, r3(f)] : [r3(f), Y, r3(u)]);
  const xz = (e, u, f = e.fijo) => (e.eje === 'x' ? [u, f] : [f, u]);

  // ───────── ramales: tés escalonados (izquierda en u−0.45, derecha en u+0.45) ─────────
  const juncs = espinas.map(() => []);
  espinas.forEach((e, i) => {
    const nb = Math.max(1, Math.round(e.long / 6));
    const perMin = (e.eje === 'x' ? e.rect.z0 : e.rect.x0) + 0.9, perMax = (e.eje === 'x' ? e.rect.z1 : e.rect.x1) - 0.9;
    const alcance = (u, lado) => {
      const tope = lado < 0 ? e.fijo - perMin : perMax - e.fijo; let r = tope;
      for (const c of obs) {
        const al = e.eje === 'x' ? c.x : c.z, per = e.eje === 'x' ? c.z : c.x;
        if (Math.abs(al - u) < 0.2 + c.h + 0.15 && (per - e.fijo) * lado > 0) r = Math.min(r, Math.abs(per - e.fijo) - c.h - 0.25);
      }
      return { r, tope };
    };
    for (let k = 0; k < nb; k++) {
      const u0 = e.a + ((k + 0.5) * e.long) / nb; let mejor = null;
      for (let q = 0; q < 11; q++) {
        const s = q === 0 ? 0 : (q % 2 ? 1 : -1) * Math.ceil(q / 2) * 0.3, u = u0 + s;
        if (u < e.a + 0.9 || u > e.b - 0.9) continue;
        const L = alcance(u - 0.45, -1), R = alcance(u + 0.45, 1);
        const sc = Math.min(L.r, L.tope) + Math.min(R.r, R.tope) - 0.4 * Math.abs(s);
        if (!mejor || sc > mejor.sc + 1e-9) mejor = { u, L, R, sc };
      }
      if (!mejor) continue;
      for (const [lado, A] of [[-1, mejor.L], [1, mejor.R]]) {
        const len = Math.min(A.r, A.tope); if (len < 1.5) continue;
        juncs[i].push({ u: r3(mejor.u + lado * 0.45), lado, len: r3(len), tipo: 'ramal' });
      }
    }
  });

  // ───────── enlaces entre espinas del mismo eje ─────────
  const enlaces = [];
  for (let i = 0; i + 1 < espinas.length; i++) {
    const e1 = espinas[i], e2 = espinas[i + 1]; if (e1.eje !== e2.eje) continue;
    const lo = Math.max(e1.a, e2.a) + 1, hi = Math.min(e1.b, e2.b) - 1; if (hi <= lo) continue;
    const f1 = Math.min(e1.fijo, e2.fijo), f2 = Math.max(e1.fijo, e2.fijo);
    if (f2 - f1 < 1.6) continue;
    const mid = (lo + hi) / 2; let u = null;
    for (let k = 0; k < 120 && u == null; k++) {
      const c = mid + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25); if (c < lo || c > hi) continue;
      const choca = obs.some((q) => { const al = e1.eje === 'x' ? q.x : q.z, per = e1.eje === 'x' ? q.z : q.x; return Math.abs(al - c) < 0.35 + q.h + 0.2 && per > f1 - 0.4 && per < f2 + 0.4; });
      const cerca = [...juncs[i], ...juncs[i + 1]].some((j) => Math.abs(j.u - c) < 1.1);
      if (!choca && !cerca) u = c;
    }
    if (u != null) { u = r3(u); enlaces.push({ i1: i, i2: i + 1, u, f1: e1.fijo, f2: e2.fijo }); juncs[i].push({ u, lado: Math.sign(e2.fijo - e1.fijo) || 1, tipo: 'enlace', len: Math.abs(e2.fijo - e1.fijo) }); juncs[i + 1].push({ u, lado: Math.sign(e1.fijo - e2.fijo) || 1, tipo: 'enlace', len: 0, par: true }); }
  }

  // ───────── unidades paquete (al menos una por espina) ─────────
  let n = Math.max(2, Math.min(5, Math.round(area / 200))); n = Math.max(n, Math.min(5, espinas.length));
  const cuenta = espinas.map(() => 1); let tot = espinas.length;
  while (tot < n) { let bi = 0; espinas.forEach((e, i) => { if (e.long / cuenta[i] > espinas[bi].long / cuenta[bi]) bi = i; }); cuenta[bi]++; tot++; }
  const trU = Math.round((area / 27 / n) * 2) / 2;
  const unidades = []; const principal = []; const posU = [];
  espinas.forEach((e, i) => principal.push({ id: e.id, ancho: SZ.P.w, alto: SZ.P.h, puntos: [pt(e, e.a), pt(e, e.b)] }));
  for (const en of enlaces) principal.push({ id: 'dp' + (principal.length + 1), ancho: SZ.P.w, alto: SZ.P.h, puntos: [pt(espinas[en.i1], en.u), pt(espinas[en.i2], en.u)], enlace: true });
  espinas.forEach((e, i) => {
    for (let k = 0; k < cuenta[i]; k++) {
      const u = r3(e.a + ((k + 0.5) * e.long) / cuenta[i]); const p = pt(e, u);
      const w = e.eje === 'x' ? DIM_UNIDAD.ancho : DIM_UNIDAD.fondo, d = e.eje === 'x' ? DIM_UNIDAD.fondo : DIM_UNIDAD.ancho;
      const id = 'ua' + (unidades.length + 1);
      unidades.push({ id, p: [p[0], Y_AZOTEA, p[2]], tr: trU, ancho: w, fondo: d, alto: DIM_UNIDAD.alto, eje: e.eje });
      principal.push({ id: 'bj' + (unidades.length), ancho: 0.6, alto: 0.6, puntos: [[p[0], Y_AZOTEA, p[2]], [p[0], Y, p[2]]], bajante: true });
      posU.push({ i, u, id, p });
    }
  });

  // ───────── grafo de la red y distancias desde las unidades ─────────
  const nodos = new Map();
  const nodo = (i, u) => { const k = i + '|' + u.toFixed(3); if (!nodos.has(k)) nodos.set(k, { i, u, d: Infinity }); return nodos.get(k); };
  espinas.forEach((e, i) => { nodo(i, e.a); nodo(i, e.b); });
  juncs.forEach((js, i) => js.forEach((j) => nodo(i, j.u)));
  posU.forEach((q) => { nodo(q.i, q.u).d = 0; });
  const aristas = [];
  espinas.forEach((e, i) => { const ns = [...nodos.values()].filter((q) => q.i === i).sort((a, b) => a.u - b.u); for (let k = 0; k + 1 < ns.length; k++) aristas.push([ns[k], ns[k + 1], ns[k + 1].u - ns[k].u]); });
  for (const en of enlaces) aristas.push([nodo(en.i1, en.u), nodo(en.i2, en.u), Math.abs(en.f2 - en.f1)]);
  for (let it = 0; it < 200; it++) { let ch = false; for (const [a, b, w] of aristas) { if (a.d + w < b.d - 1e-9) { b.d = a.d + w; ch = true; } if (b.d + w < a.d - 1e-9) { a.d = b.d + w; ch = true; } } if (!ch) break; }
  const distU = (i, u) => { let m = Infinity; for (const q of nodos.values()) if (q.i === i) m = Math.min(m, q.d + Math.abs(q.u - u)); return m; };

  // ───────── piezas ─────────
  /** @type {any[]} */ const piezas = [];
  let dMax = 0;
  const add = (p) => { p.sys = 'aire'; p.id = p.id || `${p.t}${piezas.length}`; piezas.push(p); if (p.d != null && Number.isFinite(p.d) && p.ph !== 'equipo') dMax = Math.max(dMax, p.d); return p; };

  // unidades y bajantes
  posU.forEach((q, k) => {
    const e = espinas[q.i], un = unidades[k]; const ry = e.eje === 'x' ? 0 : yawX(0, -1);
    add({ t: 'unidad', ph: 'equipo', k, x: un.p[0], y: Y_AZOTEA, z: un.p[2], ry, sx: 1, sy: 1, sz: 1, d: 0, fr: [0, 0], net: 'aire', caja: cajaC(un.p[0], Y_AZOTEA + DIM_UNIDAD.alto / 2, un.p[2], un.ancho, DIM_UNIDAD.alto, un.fondo), ref: un.id });
    add({ t: 'bajante', ph: 'bajante', k, x: un.p[0], y: Y_AZOTEA, z: un.p[2], ry: 0, sx: 0.6, sy: DROP, sz: 0.6, d: 0, fr: [0, 0], net: 'aire', caja: cajaC(un.p[0], Y_AZOTEA - DROP / 2, un.p[2], 0.6, DROP, 0.6), ref: un.id });
    for (let f = 0; f < 2; f++) {
      const o = (f ? 1 : -1) * 0.55, ex = e.eje === 'x' ? o : 0, ez = e.eje === 'x' ? 0 : o;
      add({ t: 'ventilador', ph: 'fan', k: k * 2 + f, x: un.p[0] + ex, y: Y_AZOTEA + DIM_UNIDAD.alto + 0.03, z: un.p[2] + ez, ry: 0, sx: 1, sy: 1, sz: 1, d: 0, fr: [0, 0], net: 'aire', caja: cajaC(un.p[0] + ex, Y_AZOTEA + DIM_UNIDAD.alto + 0.07, un.p[2] + ez, 0.9, 0.14, 0.9), ref: un.id });
    }
  });

  /** Llena [g0,g1] de una recta con tramos de ~1.35 m. fn(centro, largo, u0, u1). */
  const llenar = (g0, g1, fn) => {
    const G = g1 - g0; if (G < 0.12) return;
    let m = Math.max(1, Math.round(G / TRAMO)); if (G / m > 1.5) m++; const L = G / m;
    for (let q = 0; q < m; q++) fn(g0 + (q + 0.5) * L, L, g0 + q * L, g0 + (q + 1) * L);
  };

  // espinas: tés de ramal y de enlace, y tramos entre ellos
  espinas.forEach((e, i) => {
    const cortes = juncs[i].map((j) => ({ ...j, L: j.tipo === 'ramal' ? TEE_R : TEE_P })).sort((a, b) => a.u - b.u);
    let cur = e.a;
    const eje = e.eje;
    const tramo = (c, L, u0, u1) => {
      const p = pt(e, c), da = distU(i, u0), db = distU(i, u1), bajo = posU.some((q) => q.i === i && q.u >= u0 - 1e-6 && q.u <= u1 + 1e-6), d = bajo ? 0 : Math.min(da, db);
      add({ t: 'tramo', ph: 'red', rol: 'principal', x: p[0], y: Y, z: p[2], ry: eje === 'x' ? 0 : yawX(0, -1), sx: L, sy: SZ.P.h, sz: SZ.P.w, d, fr: bajo ? [0, 0] : eje === 'x' ? [da <= db ? -1 : 1, 0] : [0, da <= db ? -1 : 1], net: 'aire', eje, caja: cajaEje(p[0], Y, p[2], eje, L, SZ.P.w, SZ.P.h), u0, u1, esp: i });
    };
    for (const c of cortes) {
      llenar(cur, c.u - c.L / 2, tramo);
      const p = pt(e, c.u), d = distU(i, c.u);
      const sd = eje === 'x' ? [0, c.lado] : [c.lado, 0];
      const L = c.L, w = SZ.P.w;
      // el té ocupa el cuerpo principal más el pico lateral (stub) del lado del ramal o del enlace
      const cuerpo = cajaEje(p[0], Y, p[2], eje, L, w, SZ.P.h);
      const wst = c.tipo === 'ramal' ? SZ.R.w : SZ.P.w, hst = c.tipo === 'ramal' ? SZ.R.h : SZ.P.h;
      const mid = w / 2 + (STUB - w / 2) / 2;
      const stub = cajaC(p[0] + sd[0] * mid, Y, p[2] + sd[1] * mid, sd[0] ? STUB - w / 2 : wst, hst, sd[1] ? STUB - w / 2 : wst);
      add({ t: c.tipo === 'ramal' ? 'teeR' : 'teeP', ph: 'red', rol: 'te', x: p[0], y: Y, z: p[2], ry: yawHacia(sd[0], sd[1]), sx: L, sy: SZ.P.h, sz: SZ.P.w, d, fr: [0, 0], net: 'aire', eje, caja: unirCajas([cuerpo, stub]), esp: i, u: c.u, lado: c.lado, tipo: c.tipo });
      cur = c.u + c.L / 2;
    }
    llenar(cur, e.b, tramo);
  });
  // enlaces: tramos entre los picos de los tés (la distancia se mide desde la unidad más cercana de cualquier extremo)
  for (const en of enlaces) {
    const e1 = espinas[en.i1], eje = e1.eje === 'x' ? 'z' : 'x';
    const lo = Math.min(en.f1, en.f2) + STUB, hi = Math.max(en.f1, en.f2) - STUB;
    const d1 = distU(en.i1, en.u), d2 = distU(en.i2, en.u);
    const dd = (c) => Math.min(d1 + Math.abs(c - en.f1), d2 + Math.abs(c - en.f2));
    llenar(lo, hi, (c, L, a, b) => {
      const da = dd(a), db = dd(b), d = Math.min(da, db), sg = da <= db ? -1 : 1;
      const p = e1.eje === 'x' ? [en.u, Y, c] : [c, Y, en.u];
      add({ t: 'tramo', ph: 'red', rol: 'enlace', x: p[0], y: Y, z: p[2], ry: eje === 'x' ? 0 : yawX(0, -1), sx: L, sy: SZ.P.h, sz: SZ.P.w, d, fr: eje === 'x' ? [sg, 0] : [0, sg], net: 'aire', eje, caja: cajaEje(p[0], Y, p[2], eje, L, SZ.P.w, SZ.P.h) });
    });
  }

  // ───────── ramales con compuerta, reducción, codo, tramos y difusores ─────────
  const ramales = [], difusores = [], rutas = [], huellasRamal = [];
  const altosDif = altosCh(Y_CARA - 0.08);
  let nRam = 0;
  espinas.forEach((e, i) => {
    for (const j of juncs[i]) {
      if (j.tipo !== 'ramal') continue;
      const id = 'rm' + (ramales.length + 1), idx = nRam++;
      const dirR = e.eje === 'x' ? [0, j.lado] : [j.lado, 0];
      const O = xz(e, j.u), len = j.len, d0 = distU(i, j.u);
      // codo al final (cada dos ramales largos) con un tramo final paralelo a la espina
      let Lf = 0, dirT = null;
      if (idx % 2 === 0 && len >= 3.5) {
        const C = [O[0] + dirR[0] * len, O[1] + dirR[1] * len];
        outer: for (const sg of [1, -1]) for (const Lc of [2.4, 1.8, 1.2]) {
          const dt = e.eje === 'x' ? [sg, 0] : [0, sg];
          const E2 = [C[0] + dt[0] * (Lc + 0.3), C[1] + dt[1] * (Lc + 0.3)];
          const rs = rectSeg(C, E2, 0.35);
          if (!segDentro(poly, C, E2, 0.3)) continue;
          if (obs.some((c) => solapa(rs, rectC(c.x, c.z, 2 * c.h, 2 * c.h)))) continue;
          if (huellasRamal.some((h) => solapa(h, rs, 0.3))) continue;
          Lf = Lc; dirT = dt; break outer;
        }
      }
      const Ltot = len + Lf;
      const P = (s) => (s <= len ? [O[0] + dirR[0] * s, O[1] + dirR[1] * s] : [O[0] + dirR[0] * len + dirT[0] * (s - len), O[1] + dirR[1] * len + dirT[1] * (s - len)]);
      const conRed = len >= 3.5, sRed = 2.3, conComp = len >= 2.4;
      const wCod = conRed ? SZ.S.w : SZ.R.w;
      huellasRamal.push(rectSeg(O, P(Ltot), 0.35));
      const puntos = [pt(e, j.u)];
      const Cp = [O[0] + dirR[0] * len, O[1] + dirR[1] * len];
      if (Lf) puntos.push([r3(Cp[0]), Y, r3(Cp[1])]);
      const Ep = P(Ltot); puntos.push([r3(Ep[0]), Y, r3(Ep[1])]);
      ramales.push({ id, ancho: SZ.R.w, alto: SZ.R.h, puntos, largo: r3(len), total: r3(Ltot), codo: !!Lf });
      rutas.push({ id: 'rt_' + id, puntos: puntos.map((q) => q.slice()), d0 });
      // tramos / compuerta / reducción / codo
      const leg = (s) => (s <= len + 1e-9 ? dirR : dirT);
      const colocar = (t, s0, s1, sz, extra = {}) => {
        const sc = (s0 + s1) / 2, dl = leg(sc), q = P(sc), eje = ejeDe(dl), L = s1 - s0;
        const d = d0 + s0;
        return add({ t, ph: 'red', rol: 'ramal', x: q[0], y: Y, z: q[1], ry: eje === 'x' ? 0 : yawX(0, -1), sx: L, sy: sz.h, sz: sz.w, d, fr: dirNeg(dl), net: 'aire', eje, caja: cajaEje(q[0], Y, q[1], eje, L, sz.w, sz.h), ...extra });
      };
      const tramosRamal = (s0, s1, sz) => { if (s1 - s0 < 0.12) return; let m = Math.max(1, Math.round((s1 - s0) / TRAMO)); if ((s1 - s0) / m > 1.5) m++; const L = (s1 - s0) / m; for (let q = 0; q < m; q++) colocar('tramo', s0 + q * L, s0 + (q + 1) * L, sz); };
      let s = STUB;
      if (conComp) { colocar('compuerta', s, s + 0.4, SZ.R); s += 0.4; }
      if (conRed) {
        tramosRamal(s, sRed, SZ.R);
        const dl = leg(sRed + 0.3), q = P(sRed + 0.3), L = 0.6;
        add({ t: 'reduccion', ph: 'red', rol: 'ramal', x: q[0], y: Y, z: q[1], ry: yawX(dl[0], dl[1]), sx: L, sy: SZ.R.h, sz: SZ.R.w, d: d0 + sRed, fr: dirNeg(dl), net: 'aire', eje: ejeDe(dl), caja: cajaEje(q[0], Y, q[1], ejeDe(dl), L, SZ.R.w, SZ.R.h) });
        s = sRed + L;
      }
      const sz = conRed ? SZ.S : SZ.R;
      if (Lf) {
        tramosRamal(s, len - wCod / 2, sz);
        // codo: caras unidas hacia la espina (−dirR) y hacia el tramo final (+dirT)
        const caras = [dirNeg(dirR), dirT];
        let ry = 0;
        for (let g = 0; g < 4; g++) {
          const a = g * Math.PI / 2, f1 = [-Math.cos(a), Math.sin(a)], f2 = [Math.sin(a), Math.cos(a)];
          const ok = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]) < 1e-6;
          if ((ok(f1, caras[0]) && ok(f2, caras[1])) || (ok(f1, caras[1]) && ok(f2, caras[0]))) { ry = a; break; }
        }
        add({ t: 'codo', ph: 'red', rol: 'ramal', x: Cp[0], y: Y, z: Cp[1], ry, sx: wCod, sy: sz.h, sz: wCod, d: d0 + len - wCod / 2, fr: dirNeg(dirR), net: 'aire', eje: ejeDe(dirR), caja: cajaC(Cp[0], Y, Cp[1], wCod, sz.h, wCod) });
        tramosRamal(len + wCod / 2, Ltot, sz);
      } else tramosRamal(s, Ltot, sz);

      // difusores (3–4.5 m entre sí): primero a 1.4 m y último a 0.7 m del extremo
      const L2 = Ltot - 2.1; let gaps = 0;
      if (L2 > 0) { const fuera = (g) => { const q = L2 / g; return q < 3 ? 3 - q : q > 4.5 ? q - 4.5 : 0; }; const g1 = Math.max(1, Math.floor(L2 / 3)), g2 = Math.max(1, Math.ceil(L2 / 4.5)); gaps = fuera(g1) <= fuera(g2) ? g1 : g2; }
      const ds = gaps === 0 ? [Math.max(0.8, Ltot * 0.7)] : Array.from({ length: gaps + 1 }, (_, g) => 1.4 + (g * L2) / gaps);
      const prohibido = (sd) => (sd < 1.0) || (sd > Ltot - 0.35) || (Lf && Math.abs(sd - len) < 0.45) || (conRed && sd > sRed - 0.3 && sd < sRed + 0.9) || (conComp && sd < STUB + 0.5);
      for (const d of ds) {
        let elegido = null;
        for (const sh of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) {
          const sd = d + sh; if (prohibido(sd)) continue;
          const q = P(sd); const fp = rectC(q[0], q[1], 0.75, 0.75);
          if (altosDif.some((r) => solapa(r, fp, 0.1))) continue;
          elegido = { sd, q }; break;
        }
        if (!elegido) continue;
        const { sd, q } = elegido, dl = leg(sd), dn = d0 + sd;
        const hDuc = conRed && sd > sRed + 0.6 ? SZ.S.h : SZ.R.h, yTop = Y - hDuc / 2;   // el collarín apoya en la cara inferior real
        const did = 'df' + (difusores.length + 1);
        difusores.push({ id: did, p: [r3(q[0]), Y_CUELLO, r3(q[1])], ramal: id, d: r3(sd), yCara: Y_CARA });
        add({ t: 'flex', ph: 'flex', id: 'fx_' + did, x: q[0], y: yTop, z: q[1], ry: Math.atan2(dl[0], dl[1]), sx: 1, sy: yTop - Y_CARA - 0.03, sz: 1, d: dn, fr: [0, 0], net: 'aire', caja: cajaC(q[0], (yTop + Y_CARA + 0.03) / 2, q[1], 0.3, yTop - Y_CARA - 0.03, 0.3), ref: did, rama: id });
        add({ t: 'difusor', ph: 'flex', id: 'dd_' + did, x: q[0], y: Y_CARA, z: q[1], ry: 0, sx: 1, sy: 1, sz: 1, d: dn, fr: [0, 0], net: 'aire', caja: cajaC(q[0], Y_CARA + 0.0, q[1], 0.6, 0.12, 0.6), ref: did, rama: id, yTop });
      }
    }
  });

  // ───────── retornos bajo la espina cada ~7.5 m ─────────
  const retornos = [];
  const altosRet = altosCh(Y_RETORNO - 0.08);
  espinas.forEach((e, i) => {
    const nr = Math.max(1, Math.round(e.long / 7.5));
    const ocup = [...juncs[i].map((j) => [j.u - (j.tipo === 'ramal' ? TEE_R : TEE_P) / 2 - 0.55, j.u + (j.tipo === 'ramal' ? TEE_R : TEE_P) / 2 + 0.55]), ...posU.filter((q) => q.i === i).map((q) => [q.u - 0.9, q.u + 0.9])];
    for (let k = 0; k < nr; k++) {
      const u0 = e.a + ((k + 0.5) * e.long) / nr; let sel = null;
      for (let q = 0; q < 17 && !sel; q++) {
        const u = u0 + (q === 0 ? 0 : (q % 2 ? 1 : -1) * Math.ceil(q / 2) * 0.35);
        if (u < e.a + 0.9 || u > e.b - 0.9) continue;
        if (ocup.some(([a, b]) => u > a && u < b)) continue;
        const pp = xz(e, u); const fp = e.eje === 'x' ? rectC(pp[0], pp[1], 0.95, 0.55) : rectC(pp[0], pp[1], 0.55, 0.95);
        if (altosRet.some((r) => solapa(r, fp, 0.1))) continue;
        sel = u;
      }
      if (sel == null) continue;
      const p = pt(e, sel), d = distU(i, sel), rid = 'rt' + (retornos.length + 1);
      retornos.push({ id: rid, p: [p[0], Y_RETORNO, p[2]], eje: e.eje, d: r3(sel - e.a), espina: e.id });
      add({ t: 'retorno', ph: 'retorno', id: 'rg_' + rid, x: p[0], y: Y - SZ.P.h / 2, z: p[2], ry: e.eje === 'x' ? 0 : yawX(0, -1), sx: 1, sy: 1, sz: 1, d, fr: [0, 0], net: 'aire', eje: e.eje, caja: cajaEje(p[0], Y - SZ.P.h / 2 - 0.09, p[2], e.eje, 0.9, 0.5, 0.18), ref: rid });
    }
  });

  // rutas de flujo: de la unidad hacia ambos lados de cada espina, y los enlaces
  espinas.forEach((e, i) => {
    const us = posU.filter((q) => q.i === i).map((q) => q.u); const fuente = us.length ? us[0] : (juncs[i].filter((j) => j.tipo === 'enlace').map((j) => j.u)[0] ?? e.a);
    const d0 = distU(i, fuente);
    if (fuente - e.a > 0.5) rutas.push({ id: `rt_${e.id}_a`, puntos: [pt(e, fuente), pt(e, e.a)], d0 });
    if (e.b - fuente > 0.5) rutas.push({ id: `rt_${e.id}_b`, puntos: [pt(e, fuente), pt(e, e.b)], d0 });
  });
  for (const en of enlaces) { const a = distU(en.i1, en.u), b = distU(en.i2, en.u); const [p0, p1, d0] = a <= b ? [pt(espinas[en.i1], en.u), pt(espinas[en.i2], en.u), a] : [pt(espinas[en.i2], en.u), pt(espinas[en.i1], en.u), b]; rutas.push({ id: 'rt_enl' + en.u, puntos: [p0, p1], d0 }); }

  const bajantes = posU.map((q, k) => ({ x: unidades[k].p[0], z: unidades[k].p[2], caja: cajaC(unidades[k].p[0], Y_AZOTEA - DROP / 2, unidades[k].p[2], 0.6, DROP, 0.6) }));
  return { unidades, principal, ramales, difusores, retornos, tr: r3(trU * unidades.length), espinas, piezas, rutas, dMax: Math.max(dMax, 1), bajantes, enlaces, obs };
}
