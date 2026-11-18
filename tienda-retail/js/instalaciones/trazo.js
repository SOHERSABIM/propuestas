// Utilidades de dibujo para las tres capas: lotes instanciados, trayectos que crecen y pulsos de flujo.
// Todo es determinista: ningún azar ni reloj propio (el tiempo lo da quien llama).
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Color();
const MIN = 1e-5; // escala "cero" (evita matrices singulares)

/** Geometría unitaria compartida (caja de 1 m). Se escala por instancia. */
export const GEO_CAJA = new THREE.BoxGeometry(1, 1, 1);
export const GEO_FAN = new THREE.CylinderGeometry(0.42, 0.42, 1, 18);
export const GEO_PLANO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Malla instanciada con n instancias, todas ocultas y blancas. conColor=false omite instanceColor. */
export function crearLote(n, geo, mat, conColor = true) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  mesh.count = n; mesh.frustumCulled = false; mesh.raycast = () => {}; mesh.castShadow = false; mesh.receiveShadow = false;
  for (let i = 0; i < n; i++) { ocultar(mesh, i); if (conColor) mesh.setColorAt(i, _c.set(0xffffff)); }
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
export function poner(mesh, i, x, y, z, sx, sy, sz) {
  _p.set(x, y, z); _s.set(Math.max(MIN, sx), Math.max(MIN, sy), Math.max(MIN, sz));
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
}
export function ocultar(mesh, i) { poner(mesh, i, 0, -10, 0, 0, 0, 0); }
export function colorear(mesh, i, hex) { mesh.setColorAt(i, _c.set(hex)); }
export function colorMezcla(mesh, i, a, b, t) { _c.set(a).lerp(new THREE.Color(b), t); mesh.setColorAt(i, _c); }
export function marcar(mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
export function liberar(grupo) {
  for (const h of [...grupo.children]) { grupo.remove(h); h.dispose?.(); }
}

// ───────────── trayectos (polilíneas ortogonales que crecen) ─────────────
/** @param {number[][]} puntos [x,y,z]… @param {number} ancho grosor horizontal @param {number} alto grosor vertical */
export function crearTrayecto(puntos, ancho, alto) {
  const segs = []; let cum = 0;
  for (let i = 0; i + 1 < puntos.length; i++) {
    const a = puntos[i], b = puntos[i + 1]; const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ax = [0, 1, 2].reduce((m, k) => (Math.abs(d[k]) > Math.abs(d[m]) ? k : m), 0); const len = Math.abs(d[ax]);
    segs.push({ a, ax, sg: Math.sign(d[ax]) || 1, len, cum0: cum }); cum += len;
  }
  return { puntos, segs, total: cum, ancho, alto, r: 0 };
}
/** Escribe los segmentos del trayecto en las instancias base..base+segs.length para un avance r (0..1). */
export function escribirTrayecto(mesh, base, t, r) {
  t.r = r; const n = t.segs.length;
  for (let i = 0; i < n; i++) {
    const s = t.segs[i]; const f = Math.min(1, Math.max(0, (r * t.total - s.cum0) / s.len));
    if (f <= 1e-4) { ocultar(mesh, base + i); continue; }
    const ext = t.ancho / 2;                                   // solapa en codos para que no queden mellas
    const ini = i > 0 ? ext : 0, fin = i < n - 1 && f >= 1 ? ext : 0;
    const L = s.len * f + ini + fin, c = s.sg * (s.len * f / 2 + (fin - ini) / 2);
    const px = s.a[0] + (s.ax === 0 ? c : 0), py = s.a[1] + (s.ax === 1 ? c : 0), pz = s.a[2] + (s.ax === 2 ? c : 0);
    const sz = [t.ancho, t.alto, t.ancho]; if (s.ax === 1) { sz[0] = t.ancho; sz[2] = t.ancho; sz[1] = L; } else { sz[s.ax] = L; sz[1] = t.alto; sz[s.ax === 0 ? 2 : 0] = t.ancho; }
    poner(mesh, base + i, px, py, pz, sz[0], sz[1], sz[2]);
  }
}
/** Punto a distancia s del inicio; devuelve [x,y,z,ejeDelSegmento]. */
export function puntoEn(t, s, out = [0, 0, 0, 0]) {
  s = Math.min(t.total, Math.max(0, s));
  for (const g of t.segs) if (s <= g.cum0 + g.len + 1e-9) {
    const d = s - g.cum0; out[0] = g.a[0] + (g.ax === 0 ? g.sg * d : 0); out[1] = g.a[1] + (g.ax === 1 ? g.sg * d : 0); out[2] = g.a[2] + (g.ax === 2 ? g.sg * d : 0); out[3] = g.ax; return out;
  }
  const g = t.segs[t.segs.length - 1]; const p = t.puntos[t.puntos.length - 1]; out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; out[3] = g.ax; return out;
}

// ───────────── pulsos de flujo a lo largo de trayectos ─────────────
/**
 * @param {{t:any, dir?:1|-1, color?:number}[]} items trayectos con su sentido
 * @param {{cada:number, tam:number, vel:number, dy:number}} o  separación (m), tamaño (m), velocidad (m/s), elevación sobre el eje (m)
 */
export function crearPulsos(items, o, mat) {
  const lista = [];
  items.forEach((it, k) => { const n = Math.max(1, Math.round(it.t.total / o.cada)); for (let i = 0; i < n; i++) lista.push({ k, fase: (i + 0.37 * ((k * 7) % 5) / 5) / n }); });
  const mesh = crearLote(lista.length, GEO_CAJA, mat);
  lista.forEach((q, i) => colorear(mesh, i, items[q.k].color ?? 0xffffff));
  const tmp = [0, 0, 0, 0];
  return {
    mesh, n: lista.length,
    /** ahora en ms (reloj del proyecto). Los pulsos solo viven sobre la parte ya trazada de cada trayecto. */
    actualizar(ahora) {
      const seg = ahora / 1000;
      for (let i = 0; i < lista.length; i++) {
        const q = lista[i], it = items[q.k], t = it.t, dir = it.dir || 1;
        let u = (seg * o.vel / t.total * dir + q.fase) % 1; if (u < 0) u += 1;
        const s = u * t.total, vivo = t.r * t.total - s;
        if (vivo <= 0.05) { ocultar(mesh, i); continue; }
        const k = Math.min(1, vivo / 0.5) * Math.min(1, Math.min(s, t.total - s) / 0.35 + 0.15);
        puntoEn(t, s, tmp); const sc = o.tam * k;
        poner(mesh, i, tmp[0], tmp[1] + (tmp[3] === 1 ? 0 : o.dy), tmp[2], sc, sc, sc);
      }
      marcar(mesh);
    },
    ocultarTodo() { for (let i = 0; i < lista.length; i++) ocultar(mesh, i); marcar(mesh); },
  };
}
