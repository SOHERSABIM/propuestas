// CONSTRUCTOR DE PIEZAS (frente mobiliario). Geometría procedimental sin dependencias fuera de three.
// Todo se dibuja en coordenadas del mueble (origen = centro de la huella a nivel de piso, frente a +z) y se
// agrupa en PIEZAS: cada pieza es una geometría fusionada (colores por vértice) con su orden y modo de aparición.
// Las caras que nadie ve (la inferior, la que da al respaldo) se omiten para ahorrar triángulos.
import * as THREE from 'three';

const _c = new THREE.Color();
const cacheCol = new Map();
/** hex sRGB → [r,g,b] lineales (igual que new THREE.Color(hex)). */
export function rgb(hex) {
  let r = cacheCol.get(hex);
  if (!r) { _c.setHex(hex); r = [_c.r, _c.g, _c.b]; cacheCol.set(hex, r); }
  return r;
}
/** Mezcla dos colores hex en sRGB (t = peso del segundo). */
export function mezcla(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function geoDe(P, N, C) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (C) g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeBoundingBox();
  return g;
}

export class Constructor {
  constructor() { this.lista = []; this._n(); }
  _n() { this.P = []; this.N = []; this.C = []; this.GP = []; this.GN = []; }

  /** Triángulo con normal dada. */
  _tri(a, b, c, n, col) {
    this.P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.N.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
    this.C.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
  }
  /** Triángulo orientado hacia las normales de pista (para cilindros y esferas). */
  _triH(a, b, c, na, nb, nc, col) {
    const g = cruz(sub(b, a), sub(c, a));
    const h = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
    if (g[0] * h[0] + g[1] * h[1] + g[2] * h[2] < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    this.P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.N.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    this.C.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
  }
  _quad(a, b, c, d, col, inv) {
    let n = cruz(sub(b, a), sub(c, a));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) n = cruz(sub(c, a), sub(d, a));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;
    n = norm(n);
    if (inv) { n = [-n[0], -n[1], -n[2]]; this._tri(a, c, b, n, col); this._tri(a, d, c, n, col); }
    else { this._tri(a, b, c, n, col); this._tri(a, c, d, n, col); }
  }
  _col(hex, o) { const c = rgb(hex), v = o?.v ?? 1; return v === 1 ? c : [Math.min(1, c[0] * v), Math.min(1, c[1] * v), Math.min(1, c[2] * v)]; }

  /**
   * Tronco de pirámide (caja si las dos bases son iguales). Base en y0, centro en (cx, cz).
   * o.sin: caras omitidas, p. ej. '-y+z' (por defecto '-y'); o.inv: caras hacia adentro; o.v: brillo.
   */
  tronco(cx, y0, cz, w0, d0, w1, d1, h, color, o = {}) {
    const sin = o.sin ?? '-y', col = this._col(color, o);
    const y1 = y0 + h, a = w0 / 2, b = d0 / 2, c = w1 / 2, d = d1 / 2;
    const b0 = [cx - a, y0, cz - b], b1 = [cx + a, y0, cz - b], b2 = [cx + a, y0, cz + b], b3 = [cx - a, y0, cz + b];
    const t0 = [cx - c, y1, cz - d], t1 = [cx + c, y1, cz - d], t2 = [cx + c, y1, cz + d], t3 = [cx - c, y1, cz + d];
    if (o.ry) { // giro alrededor del eje vertical que pasa por (cx, cz)
      const cs = Math.cos(o.ry), sn = Math.sin(o.ry);
      for (const p of [b0, b1, b2, b3, t0, t1, t2, t3]) { const dx = p[0] - cx, dz = p[2] - cz; p[0] = cx + dx * cs + dz * sn; p[2] = cz - dx * sn + dz * cs; }
    }
    const q = (k, p0, p1, p2, p3) => { if (!sin.includes(k)) this._quad(p0, p1, p2, p3, col, o.inv); };
    q('+z', b3, b2, t2, t3); q('-z', b1, b0, t0, t1); q('+x', b2, b1, t1, t2);
    q('-x', b0, b3, t3, t0); q('+y', t3, t2, t1, t0); q('-y', b0, b1, b2, b3);
  }
  /** Caja con base en y0 y centro (cx, cz). */
  caja(cx, y0, cz, w, h, d, color, o) { this.tronco(cx, y0, cz, w, d, w, d, h, color, o); }
  /** Caja por esquinas mínimas y máximas. */
  cajaMM(x0, y0, z0, x1, y1, z1, color, o) { this.caja((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color, o); }

  /** Barra de sección cuadrada entre dos puntos (diagonales de bastidor, brazos inclinados). */
  barra(p, q, t, color, o = {}) {
    const col = this._col(color, o), dir = norm(sub(q, p));
    let u = cruz(dir, Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]); u = norm(u);
    const v = norm(cruz(dir, u)), h = t / 2;
    const pt = (s, i, j) => [s[0] + u[0] * h * i + v[0] * h * j, s[1] + u[1] * h * i + v[1] * h * j, s[2] + u[2] * h * i + v[2] * h * j];
    const A = [pt(p, -1, -1), pt(p, 1, -1), pt(p, 1, 1), pt(p, -1, 1)], B = [pt(q, -1, -1), pt(q, 1, -1), pt(q, 1, 1), pt(q, -1, 1)];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this._quad(A[i], A[j], B[j], B[i], col); }
    this._quad(A[3], A[2], A[1], A[0], col); this._quad(B[0], B[1], B[2], B[3], col);
  }

  /** Cilindro centrado en (cx,cy,cz) con eje 'x'|'y'|'z' y largo len. */
  cil(eje, cx, cy, cz, r, len, color, seg = 8, o = {}) {
    const col = this._col(color, o), hl = len / 2;
    const P = (th, w) => {
      const cs = Math.cos(th), sn = Math.sin(th);
      if (eje === 'y') return [[cx + r * cs, cy + w, cz + r * sn], [cs, 0, sn]];
      if (eje === 'x') return [[cx + w, cy + r * cs, cz + r * sn], [0, cs, sn]];
      return [[cx + r * cs, cy + r * sn, cz + w], [cs, sn, 0]];
    };
    const ax = eje === 'y' ? [0, 1, 0] : eje === 'x' ? [1, 0, 0] : [0, 0, 1];
    const cen = (w) => [cx + (eje === 'x' ? w : 0), cy + (eje === 'y' ? w : 0), cz + (eje === 'z' ? w : 0)];
    for (let i = 0; i < seg; i++) {
      const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
      const [a0, n0] = P(t0, -hl), [a1, n1] = P(t1, -hl), [b0] = P(t0, hl), [b1] = P(t1, hl);
      this._triH(a0, a1, b1, n0, n1, n1, col); this._triH(a0, b1, b0, n0, n1, n0, col);
      if (!o.sinTapas) {
        this._triH(cen(hl), b0, b1, ax, ax, ax, col);
        if (!o.sinBase) this._triH(cen(-hl), a0, a1, [-ax[0], -ax[1], -ax[2]], [-ax[0], -ax[1], -ax[2]], [-ax[0], -ax[1], -ax[2]], col);
      }
    }
  }
  /** Cilindro vertical con base en y0. */
  pilar(cx, y0, cz, r, h, color, seg = 8, o = {}) { this.cil('y', cx, y0 + h / 2, cz, r, h, color, seg, { sinBase: true, ...o }); }

  /** Esfera de pocos polígonos. */
  esfera(cx, cy, cz, r, color, seg = 8, o = {}) {
    const col = this._col(color, o), rings = Math.max(3, seg >> 1);
    const pt = (i, j) => {
      const ph = (i / rings) * Math.PI, th = (j / seg) * Math.PI * 2;
      const n = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      return [[cx + r * n[0], cy + r * n[1], cz + r * n[2]], n];
    };
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const [a, na] = pt(i, j), [b, nb] = pt(i + 1, j), [c, nc] = pt(i + 1, j + 1), [d, nd] = pt(i, j + 1);
      if (i > 0) this._triH(a, b, d, na, nb, nd, col);
      if (i < rings - 1) this._triH(b, c, d, nb, nc, nd, col);
    }
  }
  /** Aro (toro) horizontal de radio mayor R y tubo r. */
  aro(cx, cy, cz, R, r, color, seg = 20, segr = 4, o = {}) {
    const col = this._col(color, o);
    const pt = (i, j) => {
      const th = (i / seg) * Math.PI * 2, ph = (j / segr) * Math.PI * 2;
      const n = [Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)];
      return [[cx + (R + r * Math.cos(ph)) * Math.cos(th), cy + r * Math.sin(ph), cz + (R + r * Math.cos(ph)) * Math.sin(th)], n];
    };
    for (let i = 0; i < seg; i++) for (let j = 0; j < segr; j++) {
      const [a, na] = pt(i, j), [b, nb] = pt(i + 1, j), [c, nc] = pt(i + 1, j + 1), [d, nd] = pt(i, j + 1);
      this._triH(a, b, c, na, nb, nc, col); this._triH(a, c, d, na, nc, nd, col);
    }
  }

  /** Paños de vidrio (un quad; el material es de doble cara). */
  vidrioZ(cx, y0, cz, w, h) { this._vq([cx - w / 2, y0, cz], [cx + w / 2, y0, cz], [cx + w / 2, y0 + h, cz], [cx - w / 2, y0 + h, cz]); }
  vidrioX(cx, y0, cz, d, h) { this._vq([cx, y0, cz + d / 2], [cx, y0, cz - d / 2], [cx, y0 + h, cz - d / 2], [cx, y0 + h, cz + d / 2]); }
  vidrioY(cx, y, cz, w, d) { this._vq([cx - w / 2, y, cz + d / 2], [cx + w / 2, y, cz + d / 2], [cx + w / 2, y, cz - d / 2], [cx - w / 2, y, cz - d / 2]); }
  _vq(a, b, c, d) {
    const n = norm(cruz(sub(b, a), sub(c, a)));
    for (const t of [a, b, c, a, c, d]) { this.GP.push(t[0], t[1], t[2]); this.GN.push(n[0], n[1], n[2]); }
  }

  /**
   * Cierra la pieza actual con todo lo dibujado desde la anterior.
   * @param {string} nombre
   * @param {number} orden  oleada (0 base, 1 postes, 2 respaldos, 3 entrepaños/cenefas, 4 mercancía)
   * @param {'crece'|'cae'|'escala'|'desliza'|'despliega'} modo
   * @param {{aristas?:boolean, px?:'min'|'max'|'c'|number, py?:'min'|'max'|'c'|number, pz?:'min'|'max'|'c'|number}} o
   *   pivote: por defecto centro en x y z y base en y (px/py/pz lo cambian; p. ej. py:'max' para prendas colgadas)
   */
  pieza(nombre, orden, modo, o = {}) {
    if (!this.P.length && !this.GP.length) { this._n(); return; }
    const geo = this.P.length ? geoDe(this.P, this.N, this.C) : null;
    const vid = this.GP.length ? geoDe(this.GP, this.GN, null) : null;
    const box = new THREE.Box3();
    if (geo) box.union(geo.boundingBox); if (vid) box.union(vid.boundingBox);
    const f = (v, mn, mx, def) => { const k = v ?? def; return typeof k === 'number' ? k : k === 'min' ? mn : k === 'max' ? mx : (mn + mx) / 2; };
    const pivot = [f(o.px, box.min.x, box.max.x, 'c'), f(o.py, box.min.y, box.max.y, 'min'), f(o.pz, box.min.z, box.max.z, 'c')];
    this.lista.push({ nombre, orden, modo, pivot, geo, vidrio: vid, aristas: o.aristas !== false && !!geo });
    this._n();
  }

  /**
   * Hilera de mercancía sobre un entrepaño: bloques de color con variación, sin caras ocultas.
   * @param {number} x0 @param {number} x1 @param {number} y base @param {number} z0 @param {number} z1
   * @param {number} hmax altura máxima del bloque
   * @param {{rng:any, paleta:number[]}} c  @param {{atras?:'-z'|'+z', wmin?:number, wmax?:number, hmin?:number}} o
   */
  merc(x0, x1, y, z0, z1, hmax, c, o = {}) {
    const rng = c.rng, cols = rng.barajar(c.paleta.slice()).slice(0, 3);
    const wmin = o.wmin ?? 0.13, wmax = o.wmax ?? 0.3, sin = '-y' + (o.atras || '');
    let x = x0 + rng.rango(0, 0.02);
    while (x < x1 - 0.06) {
      const w = Math.min(rng.rango(wmin, wmax), x1 - x);
      if (w < 0.06) break;
      const h = hmax * rng.rango(o.hmin ?? 0.55, 1), d = (z1 - z0) * rng.rango(0.78, 1);
      const zc = o.atras === '-z' ? z0 + d / 2 : o.atras === '+z' ? z1 - d / 2 : (z0 + z1) / 2;
      this.caja(x + w / 2, y, zc, w, h, d, cols[Math.floor(rng.r() * cols.length)], { sin, v: rng.rango(0.92, 1.05) });
      x += w + rng.rango(0.006, 0.022);
    }
  }
}
