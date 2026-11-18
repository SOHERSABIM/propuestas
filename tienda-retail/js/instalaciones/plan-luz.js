// PLAN DE ILUMINACIÓN (puro). Luminarias por pasillo y relleno (lineales), rieles con spots en ropa, paneles en
// trastienda y cajas. Cada hilera lleva canalización (tubo EMT a 4.68 m) con caja de conexión en cada luminaria,
// cabecera con bajada a la losa y cordón de alimentación; cada luminaria cuelga de dos cables desde la losa.
// Las luminarias se colocan FUERA de los ductos, tuberías, columnas y muebles altos (columna completa hasta la losa).
import { r3, rectC, solapa, cabe, enRect, cajaC, inflarCaja, cajasChocan, huellaMueble, planta } from './util.js';

export const REGLA_LUZ = {
  autoservicio: { tipo: 'lineal', y: 3.6 }, refrigerados: { tipo: 'lineal', y: 3.6 }, acceso: { tipo: 'lineal', y: 3.6 },
  cajas: { tipo: 'panel', y: 3.4 }, mostrador: { tipo: 'lineal', y: 3.4 },
  ropa_hogar: { tipo: 'riel', y: 3.8 }, trastienda: { tipo: 'panel', y: 3.0 },
};
export const DIM_LUZ = { lineal: { largo: 1.5, ancho: 0.16 }, panel: { largo: 1.2, ancho: 0.6 }, riel: { largo: 4.8, ancho: 0.08 } };
export const ALTO_CUERPO = { lineal: 0.1, panel: 0.07, riel: 0.07 };
export const Y_CANAL = 4.68, Y_LOSA = 4.8, D_CANAL = 0.03;

export function planLuz(local, layout, ctx) {
  const zr = layout.zonas.flatMap((z) => z.rects.map((r) => ({ ...r, id: z.id })));
  const colsL = ctx.cols(0.15);
  const muros = (layout.muros || []).map((m) => {
    const h = (m.espesor || 0.15) / 2 + 0.1;
    return { x0: Math.min(m.a[0], m.b[0]) - h, x1: Math.max(m.a[0], m.b[0]) + h, z0: Math.min(m.a[1], m.b[1]) - h, z1: Math.max(m.a[1], m.b[1]) + h };
  });
  const zonaDe = (x, z) => zr.find((r) => enRect(r, x, z, 1e-6));
  // obstáculos verticales: todo lo de aire y frío que ya existe (la columna de cables llega hasta la losa)
  const duros = [...ctx.aire.piezas, ...ctx.frio.piezas].filter((p) => p.caja && p.t !== 'unidad' && p.t !== 'ventilador' && p.t !== 'cond').map((p) => p.caja);
  const mueblesAlt = ctx.muebles.map((m) => ({ r: huellaMueble(m), alto: m.alto }));
  /** ¿la columna de la luminaria (huella fp, desde yBajo hasta la losa) choca con algo? */
  function bloqueada(fp, yBajo) {
    const col = { x0: fp.x0 - 0.12, x1: fp.x1 + 0.12, y0: yBajo, y1: Y_LOSA, z0: fp.z0 - 0.12, z1: fp.z1 + 0.12 };
    if (duros.some((c) => cajasChocan(c, col))) return true;
    if (mueblesAlt.some((q) => q.alto > yBajo - 0.05 && solapa(q.r, fp, 0.08))) return true;
    return false;
  }

  /** @type {any[]} */ const lum = [];
  function poner(tipo, x, z, rot, zr1, largo) {
    const d = DIM_LUZ[tipo]; largo = largo ?? d.largo;
    const fp = rot === 0 ? rectC(x, z, largo, d.ancho) : rectC(x, z, d.ancho, largo);
    if (!cabe(zr1, fp, 0.02)) return false;
    if (colsL.some((c) => solapa(c, fp))) return false;
    if (tipo === 'panel' && muros.some((m) => solapa(m, fp))) return false;
    const y = REGLA_LUZ[zr1.id].y;
    if (bloqueada(fp, y - ALTO_CUERPO[tipo] / 2 - (tipo === 'riel' ? 0.2 : 0.03))) return false;
    const sep = tipo === 'riel' ? 0.2 : 0.3;
    if (lum.some((l) => solapa(l.fp, fp, sep))) return false;
    lum.push({ tipo, x, z, rot, largo, ancho: d.ancho, zona: zr1.id, y, fp });
    return true;
  }

  // 1) lineales/paneles siguiendo los ejes de los pasillos
  for (const pa of layout.pasillos) {
    for (let i = 0; i + 1 < pa.puntos.length; i++) {
      const [ax, az] = pa.puntos[i], [bx, bz] = pa.puntos[i + 1];
      const Ls = Math.hypot(bx - ax, bz - az); if (Ls < 1.0) continue;
      const rot = Math.abs(bx - ax) >= Math.abs(bz - az) ? 0 : 90;
      const ux = (bx - ax) / Ls, uz = (bz - az) / Ls;
      const z0 = zonaDe((ax + bx) / 2, (az + bz) / 2); if (!z0) continue;
      const reg = REGLA_LUZ[z0.id]; if (!reg || reg.tipo === 'riel' || z0.id === 'trastienda') continue;
      const L = DIM_LUZ[reg.tipo].largo, P = L + 0.3;
      let n = Math.floor((Ls - 0.6 + 0.3) / P); if (n < 1 && Ls >= L + 0.2) n = 1;
      for (let k = 0; k < n; k++) {
        const t = Ls / 2 + (k - (n - 1) / 2) * P;
        for (const sh of [0, 0.3, -0.3, 0.6, -0.6]) {
          const x = ax + ux * (t + sh), z = az + uz * (t + sh);
          const zz = zonaDe(x, z); if (!zz || !REGLA_LUZ[zz.id] || REGLA_LUZ[zz.id].tipo === 'riel' || zz.id === 'trastienda') continue;
          if (poner(REGLA_LUZ[zz.id].tipo, x, z, rot, zz)) break;
        }
      }
    }
  }
  // 2) rieles con spots en ropa y hogar
  for (const r of zr.filter((q) => q.id === 'ropa_hogar')) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, alongX = w >= d;
    const len = alongX ? w : d, cross = alongX ? d : w;
    if (cross < 1.2 || len < 2.4) continue;
    const nl = cross >= 2.4 ? Math.floor((cross - 1.6) / 2.4) + 1 : 1;
    const lenU = len - 1.6; const np = Math.max(1, Math.ceil(lenU / 5.2)); const lp = Math.min(4.8, (lenU - (np - 1) * 0.4) / np);
    if (lp < 1.0) continue;
    for (let j = 0; j < nl; j++) {
      const c = (alongX ? (r.z0 + r.z1) : (r.x0 + r.x1)) / 2 + (j - (nl - 1) / 2) * 2.4;
      for (let k = 0; k < np; k++) {
        const a = (alongX ? r.x0 : r.z0) + 0.8 + lp / 2 + k * (lp + 0.4);
        if (alongX) poner('riel', a, c, 0, r, lp); else poner('riel', c, a, 90, r, lp);
      }
    }
    // respaldo: si los obstáculos de arriba impiden todo riel, busca un tramo más corto en cualquier punto libre
    if (!lum.some((l) => l.tipo === 'riel' && cabe(r, l.fp, 0.02))) {
      let hecho = false;
      for (const L of [Math.min(4.8, len - 0.8), 3.0, 2.0, 1.4]) {
        if (hecho || L < 1.0 || L > len - 0.4) continue;
        for (let c = (alongX ? r.z0 : r.x0) + 0.5; c <= (alongX ? r.z1 : r.x1) - 0.5 + 1e-9 && !hecho; c += 0.25) {
          for (let a = (alongX ? r.x0 : r.z0) + L / 2 + 0.2; a <= (alongX ? r.x1 : r.z1) - L / 2 - 0.2 + 1e-9 && !hecho; a += 0.25) {
            hecho = alongX ? poner('riel', a, c, 0, r, L) : poner('riel', c, a, 90, r, L);
          }
        }
      }
    }
  }
  // 3) paneles de trastienda en retícula de 3 m, y al menos uno por cuarto
  for (const r of zr.filter((q) => q.id === 'trastienda')) {
    const nx = Math.max(1, Math.floor((r.x1 - r.x0 - 2) / 3) + 1), nz = Math.max(1, Math.floor((r.z1 - r.z0 - 2) / 3) + 1);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = (r.x0 + r.x1) / 2 + (i - (nx - 1) / 2) * 3, z0 = (r.z0 + r.z1) / 2 + (j - (nz - 1) / 2) * 3;
      for (const [dx, dz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [1.2, 0], [-1.2, 0]]) if (poner('panel', x0 + dx, z0 + dz, 0, r)) break;
    }
  }
  for (const c of layout.cuartos || []) {
    const [x0, z0, x1, z1] = c.rect;
    if (lum.some((l) => l.tipo === 'panel' && enRect({ x0, x1, z0, z1 }, l.x, l.z))) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, zz = zonaDe(cx, cz);
    if (zz?.id === 'trastienda') {
      const cand = [];
      for (let x = x0 + 0.4; x <= x1 - 0.4 + 1e-9; x += 0.1) for (let z = z0 + 0.3; z <= z1 - 0.3 + 1e-9; z += 0.1) cand.push([x, z]);
      cand.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
      cand.some(([x, z]) => poner('panel', x, z, 0, zz) || poner('panel', x, z, 90, zz));
    }
  }
  // 4) relleno de lineales donde los pasillos no cubren (≥ 2 m a cualquier luminaria existente)
  for (const r of zr.filter((q) => REGLA_LUZ[q.id] && REGLA_LUZ[q.id].tipo === 'lineal')) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, alongX = w >= d;
    const len = alongX ? w : d, cross = alongX ? d : w;
    if (cross < 1.2 || len < 2) continue;
    const nl = cross >= 2.5 ? Math.floor((cross - 1.4) / 2.7) + 1 : 1;
    const P = 1.8, nk = Math.max(1, Math.floor((len - 1.6 + 0.3) / P));
    for (let j = 0; j < nl; j++) {
      const c = (alongX ? (r.z0 + r.z1) : (r.x0 + r.x1)) / 2 + (j - (nl - 1) / 2) * 2.7;
      for (let k = 0; k < nk; k++) {
        const a = (alongX ? (r.x0 + r.x1) : (r.z0 + r.z1)) / 2 + (k - (nk - 1) / 2) * P;
        const x = alongX ? a : c, z = alongX ? c : a;
        if (lum.some((l) => Math.hypot(l.x - x, l.z - z) < 2.0)) continue;
        poner('lineal', x, z, alongX ? 0 : 90, r);
      }
    }
  }

  // orden de encendido: desde el acceso hacia el fondo
  const [ax, az] = local.acceso.centro;
  lum.sort((a, b) => (Math.hypot(a.x - ax, a.z - az) - Math.hypot(b.x - ax, b.z - az)) || (a.z - b.z) || (a.x - b.x));
  const luminarias = lum.map((l, i) => ({
    id: 'lz' + String(i + 1).padStart(3, '0'), tipo: l.tipo, p: [r3(l.x), l.y, r3(l.z)], largo: r3(l.largo), ancho: l.ancho,
    rot: l.rot, zona: l.zona, spots: l.tipo === 'riel' ? Math.max(1, Math.floor(l.largo / 1.0)) : 0,
  }));

  // ───────── hileras, canalización y piezas ─────────
  const filas = new Map();
  for (const l of luminarias) {
    const k = `${l.zona}|${l.rot}|${r3(l.rot === 0 ? l.p[2] : l.p[0]).toFixed(1)}`;
    if (!filas.has(k)) filas.set(k, []); filas.get(k).push(l);
  }
  // obstáculos verticales que cruzan la canalización a 4.68 m: columnas, bajantes y subidas a condensadoras
  const verticales = [
    ...local.columnas.map(([x, z]) => cajaC(x, 2.4, z, local.columna + 0.3, 4.8, local.columna + 0.3)),
    ...ctx.aire.piezas.filter((p) => p.t === 'bajante').map((p) => p.caja),
    ...ctx.frio.piezas.filter((p) => p.caja && p.caja.y1 >= Y_CANAL + 0.03 && p.caja.y0 <= Y_CANAL - 0.03 && p.t !== 'cond').map((p) => p.caja),
  ];
  const cruzaVertical = (c) => verticales.some((v) => cajasChocan(v, c, 0.06));
  const piezas = []; const circuitos = [];
  const add = (p) => { p.sys = 'luz'; p.id = p.id || `${p.t}${piezas.length}`; piezas.push(p); return p; };
  const distAcc = (x, z) => Math.hypot(x - ax, z - az);
  let dMax = 1; const runs = [];
  for (const [k, fl] of filas) {
    const rot = fl[0].rot, ord = fl.slice().sort((a, b) => (rot === 0 ? a.p[0] - b.p[0] : a.p[2] - b.p[2]));
    const lineaC = ord.reduce((s, l) => s + (rot === 0 ? l.p[2] : l.p[0]), 0) / ord.length;
    const u = (l) => (rot === 0 ? l.p[0] : l.p[2]);
    // corta la hilera donde la canalización toparía con un obstáculo vertical
    let cur = [ord[0]]; const grupos = [];
    for (let i = 1; i < ord.length; i++) {
      const a = u(ord[i - 1]), b = u(ord[i]);
      const c = rot === 0 ? cajaC((a + b) / 2, Y_CANAL, lineaC, b - a, D_CANAL + 0.02, D_CANAL + 0.02) : cajaC(lineaC, Y_CANAL, (a + b) / 2, D_CANAL + 0.02, D_CANAL + 0.02, b - a);
      if (cruzaVertical(c)) { grupos.push(cur); cur = []; }
      cur.push(ord[i]);
    }
    grupos.push(cur);
    grupos.forEach((g, gi) => {
      const rid = `h${runs.length + 1}`;
      const u0 = u(g[0]), u1 = u(g[g.length - 1]);
      const xzAt = (uu) => (rot === 0 ? [uu, lineaC] : [lineaC, uu]);
      // cabecera en el extremo más cercano al acceso
      const e0 = xzAt(u0), e1 = xzAt(u1);
      const cabIni = distAcc(e0[0], e0[1]) <= distAcc(e1[0], e1[1]);
      const uh = cabIni ? u0 : u1; const dh = distAcc(...xzAt(uh));
      const dd = (uu) => dh + Math.abs(uu - uh);
      runs.push({ id: rid, rot, linea: lineaC, u0, u1, uh, lums: g.map((l) => l.id) });
      circuitos.push({ id: 'cl' + String(circuitos.length + 1).padStart(2, '0'), diam: 0.03, puntos: [rot === 0 ? [u0, Y_CANAL, lineaC] : [lineaC, Y_CANAL, u0], rot === 0 ? [u1, Y_CANAL, lineaC] : [lineaC, Y_CANAL, u1]], fila: k });
      // tubo EMT de tramos de ≤ 3 m entre cajas
      const Lc = u1 - u0;
      const ejeC = rot === 0 ? 'x' : 'z';
      if (Lc > 0.05) {
        const m = Math.ceil(Lc / 3.0), l = Lc / m;
        for (let q = 0; q < m; q++) {
          const a = u0 + q * l, c = a + l / 2, [px, pz] = xzAt(c);
          const dnear = Math.min(dd(a), dd(a + l));
          const dm = dnear; dMax = Math.max(dMax, dm + l);
          add({ t: 'tubo', ph: 'canal', x: px, y: Y_CANAL, z: pz, ry: rot === 0 ? 0 : -Math.PI / 2, rz: 0, sx: l, sy: 1, sz: 1, d: dm, fr: ejeC === 'x' ? [(dd(a) <= dd(a + l)) ? -1 : 1, 0] : [0, (dd(a) <= dd(a + l)) ? -1 : 1], net: rid, c: 0xa9afb6, caja: ejeC === 'x' ? cajaC(px, Y_CANAL, pz, l, D_CANAL, D_CANAL) : cajaC(px, Y_CANAL, pz, D_CANAL, D_CANAL, l), run: rid });
        }
      }
      // cabecera: caja mayor y bajada a la losa
      const [hx, hz] = xzAt(uh);
      add({ t: 'caja', ph: 'canal', x: hx, y: Y_CANAL, z: hz, ry: rot === 0 ? 0 : -Math.PI / 2, sx: 1.7, sy: 1.5, sz: 1.7, d: dh, fr: [0, 0], net: rid, c: 0xd2d6da, caja: cajaC(hx, Y_CANAL, hz, 0.2, 0.11, 0.2), run: rid, cab: true });
      add({ t: 'tubo', ph: 'canal', x: hx, y: (Y_CANAL + 0.055 + Y_LOSA) / 2, z: hz, ry: 0, rz: Math.PI / 2, sx: Y_LOSA - Y_CANAL - 0.055, sy: 1, sz: 1, d: dh, fr: [0, 0], net: rid, c: 0xa9afb6, caja: cajaC(hx, (Y_CANAL + 0.055 + Y_LOSA) / 2, hz, D_CANAL, Y_LOSA - Y_CANAL - 0.055, D_CANAL), run: rid });
      // luminarias de la hilera
      for (const id of g.map((q) => q.id)) {
        const l = luminarias.find((q) => q.id === id); const h = ALTO_CUERPO[l.tipo];
        const uc = u(l), dl = dd(uc), a = l.rot === 0;
        const [lx, lz] = [l.p[0], l.p[2]], y = l.p[1];
        const fpW = a ? l.largo : l.ancho, fpD = a ? l.ancho : l.largo;
        dMax = Math.max(dMax, dl);
        const salto = distAcc(lx, lz); void salto;
        // caja de conexión en la canalización (la cabecera ya hace de caja en su luminaria)
        if (uc !== uh) add({ t: 'caja', ph: 'canal', x: xzAt(uc)[0], y: Y_CANAL, z: xzAt(uc)[1], ry: rot === 0 ? 0 : -Math.PI / 2, sx: 1, sy: 1, sz: 1, d: dl, fr: [0, 0], net: rid, c: 0xd2d6da, caja: cajaC(xzAt(uc)[0], Y_CANAL, xzAt(uc)[1], 0.12, 0.07, 0.12), run: rid });
        // cordón de alimentación de la caja al cuerpo
        const yTopCuerpo = y + h / 2, yCordon = Y_CANAL - 0.04;
        add({ t: 'varilla', ph: 'cuelga', x: xzAt(uc)[0], y: yCordon, z: xzAt(uc)[1], ry: 0, sx: 1, sy: yCordon - yTopCuerpo, sz: 1, d: dl, fr: [0, 0], net: rid, c: 0x33373c, caja: cajaC(xzAt(uc)[0], (yCordon + yTopCuerpo) / 2, xzAt(uc)[1], 0.02, yCordon - yTopCuerpo, 0.02), lum: id, cordon: true });
        // dos cables de suspensión desde la losa, en los extremos y a los lados del eje (no cruzan la canalización)
        const off = l.tipo === 'lineal' ? [l.largo / 2 - 0.25, 0.05] : l.tipo === 'panel' ? [l.largo / 2 - 0.2, l.ancho / 2 - 0.05] : [Math.max(0.3, l.largo / 2 - 0.5), 0.025];
        for (let q = 0; q < 2; q++) {
          const along = (q ? 1 : -1) * off[0], lat = (q ? -1 : 1) * off[1];
          const cx = a ? lx + along : lx + lat, cz = a ? lz + lat : lz + along;
          const len = Y_LOSA - yTopCuerpo;
          add({ t: 'varilla', ph: 'cuelga', x: cx, y: Y_LOSA, z: cz, ry: 0, sx: 1, sy: len, sz: 1, d: dl, fr: [0, 0], net: rid, c: 0x8a9097, caja: cajaC(cx, (Y_LOSA + yTopCuerpo) / 2, cz, 0.03, len, 0.03), lum: id, cable: true });
        }
        // cuerpo (carcasa) y difusor (lente)
        const tCuerpo = l.tipo === 'panel' ? 'carcasaPanel' : 'carcasaLineal';
        add({ t: tCuerpo, ph: 'cuelga', x: lx, y, z: lz, ry: a ? 0 : -Math.PI / 2, sx: l.largo, sy: h, sz: l.ancho, d: dl, fr: [0, 0], net: rid, c: l.tipo === 'riel' ? 0x9a6f12 : 0xe9ecee, caja: cajaC(lx, y, lz, fpW, h, fpD), lum: id, tipoL: l.tipo, yArranque: Y_CANAL - 0.06 });
        if (l.tipo !== 'riel') add({ t: 'lente', ph: 'cuelga', lit: true, x: lx, y: y - h / 2 - 0.004, z: lz, ry: a ? 0 : -Math.PI / 2, sx: l.largo - 0.05, sy: 0.012, sz: l.ancho - 0.05, d: dl, fr: [0, 0], net: rid, caja: cajaC(lx, y - h / 2 - 0.004, lz, fpW, 0.012, fpD), lum: id, yArranque: Y_CANAL - 0.06 });
        for (let s = 0; s < l.spots; s++) {
          const o = ((s + 0.5) * l.largo) / l.spots - l.largo / 2;
          const sx = a ? lx + o : lx, sz = a ? lz : lz + o;
          add({ t: 'spot', ph: 'cuelga', lit: true, x: sx, y: y - h / 2 - 0.02, z: sz, ry: (s % 2 ? 1 : -1) * Math.PI / 2 + (a ? 0 : Math.PI / 2), sx: 1, sy: 1, sz: 1, d: dl, fr: [0, 0], net: rid, caja: cajaC(sx, y - h / 2 - 0.09, sz, 0.12, 0.2, 0.12), lum: id, yArranque: Y_CANAL - 0.06 });
        }
        add({ t: 'charco', ph: 'luz', lit: true, x: lx, y: 0.03, z: lz, ry: 0, sx: a ? (l.tipo === 'panel' ? 2.8 : l.largo + 2.2) : (l.tipo === 'panel' ? 2.6 : 2.5), sy: 1, sz: a ? (l.tipo === 'panel' ? 2.6 : 2.5) : (l.tipo === 'panel' ? 2.8 : l.largo + 2.2), d: dl, fr: [0, 0], net: rid, lum: id });
      }
    });
  }
  // los cables de suspensión no deben cruzar la canalización de otra hilera: se corren hacia el centro de su luminaria
  const canales = piezas.filter((q) => q.run && q.caja);
  for (const cb of piezas.filter((q) => q.cable)) {
    const l = luminarias.find((q) => q.id === cb.lum), a = l.rot === 0;
    for (let n = 0; n < 12 && canales.some((q) => cajasChocan(q.caja, inflarCaja(cb.caja, 0.02))); n++) {
      const sg = Math.sign((a ? l.p[0] - cb.x : l.p[2] - cb.z)) || 1;
      if (a) cb.x += sg * 0.05; else cb.z += sg * 0.05;
      cb.caja = cajaC(cb.x, (Y_LOSA + (l.p[1] + ALTO_CUERPO[l.tipo] / 2)) / 2, cb.z, 0.03, cb.caja.y1 - cb.caja.y0, 0.03);
    }
  }
  // fila → circuitos válidos solo con 2 puntos distintos (compatibilidad con el contrato anterior)
  const circ = circuitos.filter((c) => c.puntos[0] && c.puntos[1] && (Math.abs(c.puntos[0][0] - c.puntos[1][0]) + Math.abs(c.puntos[0][2] - c.puntos[1][2]) > 0.05));
  return { luminarias, circuitos: circ, piezas, runs, dMax };
}
