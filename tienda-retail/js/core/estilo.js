// Fichas de estilo: paleta, materiales compartidos, aristas y atenuado. Lo usan TODOS los frentes (solo lectura).
// Cambios de paleta: los decide el núcleo; pedirlos en docs/solicitudes.md.
import * as THREE from 'three';

/** Paleta completa (hex sRGB). Ver docs/design.md §7. */
export const PALETA = {
  fondo: { arriba: '#f4f7f9', medio: '#ffffff', abajo: '#eef1f3' },
  arq: {
    losa: 0xcdccc8, losaCanto: 0xb9b8b3, muroExt: 0xd6d2c9, muroInt: 0xefeee9, columna: 0xa3a5a8,
    cristal: 0x8cc8e0, marco: 0x8e979f, peto: 0x5d6a75, puerta: 0xb7bec5, pisoVenta: 0xe4e2dc, pisoBodega: 0xd2d0ca,
  },
  mob: {
    metal: 0xa8aeb5, metalOscuro: 0x6f767e, blanco: 0xefefef, madera: 0xd4b48b, maderaOscura: 0xa67950,
    oscuro: 0x33373c, negro: 0x17191c, cristal: 0xbfe0ee, tela: 0x76808e, led: 0xfff6d8, carton: 0xc9a77a,
    tarima: 0xb98d5a, rackNaranja: 0xd9822b, rackAzul: 0x3f6f9e,
    // mercancía: bloques abstractos, sin colores de marca reconocibles
    mercancia: [0xe2c290, 0x9cc3a5, 0xd99a8a, 0x8fb2d1, 0xe8d9b5, 0xb7a3c9, 0xc9cfa0, 0xf0b98d],
  },
  zona: {
    acceso: 0x9db4c8, cajas: 0xe07b53, autoservicio: 0x4fa58f, refrigerados: 0x6fb7d6,
    ropa_hogar: 0xd779a6, mostrador: 0xb58b5a, trastienda: 0x8a8f96,
  },
  capa: { luz: 0xf2a81d, aire: 0x2b8fd6, frio: 0x8e5bd6 },
  marca: { verde: 0x62b030, verdeOscuro: 0x105020, negro: 0x111111 },
  arista: 0x25282c, aristaSuave: 0x6c7279, aristaClara: 0xa7adb3,
  nuevo: 0xdfeccf, retira: 0xd23b30,
};

/** Umbral de ángulo para EdgesGeometry (no dibuja facetas de cilindros). */
export const UMBRAL_ARISTA = 28;

const grupos = { arq: new Set(), mob: new Set(), fx: new Set() };
const cacheColor = new Map();

function registrar(grupo, mat) {
  mat.userData.opacidadBase = mat.opacity;
  mat.userData.transparenteBase = mat.transparent;
  grupos[grupo].add(mat);
  return mat;
}

/** Material Lambert mate compartido por grupo de atenuado ('arq' | 'mob' | 'fx'). */
export function mate(color, grupo = 'mob', extra = {}) {
  return registrar(grupo, new THREE.MeshLambertMaterial({ color, ...extra }));
}

/**
 * Material mate cacheado por color (para piezas de mobiliario: muchas piezas, pocos materiales).
 * @param {number} color hex
 */
export function mateMob(color) {
  if (!cacheColor.has(color)) cacheColor.set(color, mate(color, 'mob'));
  return cacheColor.get(color);
}

/** Materiales compartidos. Se crean una vez. */
export const MAT = {
  losa: mate(PALETA.arq.losa, 'arq'),
  losaCanto: mate(PALETA.arq.losaCanto, 'arq'),
  pisoVenta: mate(PALETA.arq.pisoVenta, 'arq'),
  muroExt: mate(PALETA.arq.muroExt, 'arq'),
  muroInt: mate(PALETA.arq.muroInt, 'arq'),
  columna: mate(PALETA.arq.columna, 'arq'),
  marco: mate(PALETA.arq.marco, 'arq'),
  peto: mate(PALETA.arq.peto, 'arq'),
  cristal: registrar('arq', new THREE.MeshLambertMaterial({ color: PALETA.arq.cristal, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })),
  /** Mobiliario horneado: un solo material con colores por vértice. */
  mobVC: registrar('mob', new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true })),
  arista: registrar('arq', new THREE.LineBasicMaterial({ color: PALETA.arista, transparent: true, opacity: 0.9 })),
  aristaSuave: registrar('arq', new THREE.LineBasicMaterial({ color: PALETA.aristaSuave, transparent: true, opacity: 0.8 })),
  aristaMob: registrar('mob', new THREE.LineBasicMaterial({ color: PALETA.arista, transparent: true, opacity: 0.85 })),
};

const cacheAristas = new WeakMap();
/**
 * Aristas finas de una geometría (cacheadas por geometría). Sin raycast.
 * @param {THREE.BufferGeometry} geo
 * @param {THREE.LineBasicMaterial} [mat]
 */
export function aristas(geo, mat = MAT.arista) {
  let eg = cacheAristas.get(geo);
  if (!eg) { eg = new THREE.EdgesGeometry(geo, UMBRAL_ARISTA); cacheAristas.set(geo, eg); }
  const l = new THREE.LineSegments(eg, mat);
  l.raycast = () => {};
  return l;
}

/**
 * Atenúa un grupo de materiales. nivel 1 = normal, 0.15 = casi fantasma.
 * La interpolación la hace quien llama (anim.tween → atenuar(grupo, e)).
 * @param {'arq'|'mob'|'fx'} grupo
 * @param {number} nivel
 */
export function atenuar(grupo, nivel) {
  for (const m of grupos[grupo]) {
    const base = m.userData.opacidadBase;
    const op = base * nivel;
    const trans = m.userData.transparenteBase || nivel < 0.999;
    if (m.transparent !== trans) { m.transparent = trans; m.needsUpdate = true; }
    m.opacity = op;
    if (!m.userData.transparenteBase) m.depthWrite = nivel > 0.6;
  }
}
