// Lotes dinámicos de cajas: muchas cajas escaladas {x, z, y0, w, h, d, ang} dibujadas en UNA malla por material
// (y unas líneas por material de aristas), con los vértices escritos en sitio cuando una caja cambia. Así el
// cascarón y la cubierta se animan pieza por pieza sin multiplicar las llamadas de dibujo y sin "fusionar" al final
// (antes la fusión y la desfusión costaban decenas de ms en un solo cuadro). Frente: núcleo.
import * as THREE from 'three';
import { UMBRAL_ARISTA } from '../core/estilo.js';

const BASE = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const BP = BASE.attributes.position.array, BN = BASE.attributes.normal.array, BI = BASE.index.array;
const NV = BP.length / 3, NI = BI.length;
const AP = new THREE.EdgesGeometry(BASE, UMBRAL_ARISTA).attributes.position.array, NA = AP.length / 3;

/**
 * @param {THREE.Object3D} padre
 * @param {{sombra?:(mat:any)=>boolean, orden?:(mat:any)=>number}} [op]
 */
export function crearLotes(padre, { sombra = () => true, orden = () => 0 } = {}) {
  const raiz = new THREE.Group(); raiz.name = 'lotes'; padre.add(raiz);
  /** @type {Map<any, {mat:any, linea:boolean, items:any[], geo:THREE.BufferGeometry, obj:any}>} */
  let lotes = new Map();
  let todos = [];

  function nuevoLote(mat, linea, n) {
    const geo = new THREE.BufferGeometry();
    if (linea) geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * NA * 3), 3));
    else {
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * NV * 3), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * NV * 3), 3));
      const idx = new (n * NV > 65535 ? Uint32Array : Uint16Array)(n * NI);
      for (let k = 0; k < n; k++) for (let i = 0; i < NI; i++) idx[k * NI + i] = BI[i] + k * NV;
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    for (const a of Object.values(geo.attributes)) a.setUsage(THREE.DynamicDrawUsage);
    const obj = linea ? new THREE.LineSegments(geo, mat) : new THREE.Mesh(geo, mat);
    obj.frustumCulled = false; obj.raycast = () => {};
    if (!linea) { obj.castShadow = sombra(mat); obj.receiveShadow = true; obj.renderOrder = orden(mat); }
    raiz.add(obj);
    return obj;
  }

  /** Escribe los vértices de un elemento en sus lotes. */
  function escribir(it) {
    const s = it.s, vis = s.w > 2e-3 && s.h > 2e-3 && s.d > 2e-3;
    const c = Math.cos(s.ang), sn = Math.sin(s.ang);
    if (it._m) {
      const { lote, i } = it._m, P = lote.geo.attributes.position, N = lote.geo.attributes.normal, p = P.array, n = N.array, o = i * NV * 3;
      for (let v = 0; v < NV; v++) {
        const lx = BP[v * 3] * s.w, ly = BP[v * 3 + 1] * s.h, lz = BP[v * 3 + 2] * s.d, k = o + v * 3;
        if (vis) { p[k] = s.x + lx * c + lz * sn; p[k + 1] = s.y0 + ly; p[k + 2] = s.z - lx * sn + lz * c; }
        else { p[k] = s.x; p[k + 1] = s.y0; p[k + 2] = s.z; }
        const nx = BN[v * 3], nz = BN[v * 3 + 2];
        n[k] = nx * c + nz * sn; n[k + 1] = BN[v * 3 + 1]; n[k + 2] = -nx * sn + nz * c;
      }
      P.needsUpdate = true; N.needsUpdate = true;
    }
    if (it._a) {
      const { lote, i } = it._a, P = lote.geo.attributes.position, p = P.array, o = i * NA * 3;
      for (let v = 0; v < NA; v++) {
        const lx = AP[v * 3] * s.w, ly = AP[v * 3 + 1] * s.h, lz = AP[v * 3 + 2] * s.d, k = o + v * 3;
        if (vis) { p[k] = s.x + lx * c + lz * sn; p[k + 1] = s.y0 + ly; p[k + 2] = s.z - lx * sn + lz * c; }
        else { p[k] = s.x; p[k + 1] = s.y0; p[k + 2] = s.z; }
      }
      P.needsUpdate = true;
    }
  }

  const api = {
    raiz,
    get items() { return todos; },
    /**
     * Rehace los lotes para una lista de elementos {s, mat, arista}. Cada elemento queda con su sitio en el lote de
     * su material y en el de su arista; luego basta escribir(it) al cambiar it.s. Barato: solo cajas.
     */
    reconstruir(items) {
      for (const l of lotes.values()) { l.geo.dispose(); raiz.remove(l.obj); }
      lotes = new Map(); todos = items;
      const cuenta = new Map();
      const sumar = (mat, linea) => { const k = mat; if (!cuenta.has(k)) cuenta.set(k, { mat, linea, n: 0 }); cuenta.get(k).n++; };
      for (const it of items) { sumar(it.mat, false); if (it.arista) sumar(it.arista, true); }
      for (const [k, { mat, linea, n }] of cuenta) { const obj = nuevoLote(mat, linea, n); lotes.set(k, { mat, linea, n, geo: obj.geometry, obj, i: 0 }); }
      for (const it of items) {
        const lm = lotes.get(it.mat); it._m = { lote: lm, i: lm.i++ };
        if (it.arista) { const la = lotes.get(it.arista); it._a = { lote: la, i: la.i++ }; } else it._a = null;
        escribir(it);
      }
    },
    escribir,
    vaciar() { api.reconstruir([]); },
    llamadas() { return lotes.size; },
  };
  return api;
}
