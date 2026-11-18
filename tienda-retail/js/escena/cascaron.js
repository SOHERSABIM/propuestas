// Cascarón del local: losa, columnas, muros exteriores, fachada de cristal, puertas y muros interiores. Frente: núcleo.
// Modelo de ELEMENTOS: cada pieza es una caja unitaria escalada {x, z, y0, w, h, d, ang}. Así el paso 1 la hace
// crecer, el paso 5 la transforma (se empareja por tipo y orientación con la del local destino y se interpola)
// y en reposo todo se FUSIONA en una malla por material (pocas llamadas de dibujo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, mate, PALETA, UMBRAL_ARISTA } from '../core/estilo.js';
import { caja, lados, areaFirmada } from '../core/geom.js';
import { regionDePoligono } from '../gen/regiones.js';

const ALTO_PRETIL = 0.6;
const MODULO_CANCEL = 1.5;
const MAT_PUERTA = mate(PALETA.arq.puerta, 'arq');

const CAJA = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const ARISTAS_CAJA = new THREE.EdgesGeometry(CAJA, UMBRAL_ARISTA);

/** Desplaza un polígono hacia afuera una distancia d. */
function desplazar(poly, d) {
  const L = lados(poly);
  return L.map((l, i) => {
    const p = L[(i + L.length - 1) % L.length];
    const a1 = [p.a[0] + p.normal[0] * d, p.a[1] + p.normal[1] * d], d1 = p.dir;
    const a2 = [l.a[0] + l.normal[0] * d, l.a[1] + l.normal[1] * d], d2 = l.dir;
    const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) return a2;
    const t = ((a2[0] - a1[0]) * d2[1] - (a2[1] - a1[1]) * d2[0]) / den;
    return [a1[0] + d1[0] * t, a1[1] + d1[1] * t];
  });
}
const sobreLado = (l, p) => Math.abs((p[0] - l.a[0]) * l.dir[1] - (p[1] - l.a[1]) * l.dir[0]) < 1e-6;
const tEn = (l, p) => (p[0] - l.a[0]) * l.dir[0] + (p[1] - l.a[1]) * l.dir[1];

/**
 * Lista de elementos (datos puros) de un local y su layout.
 * @returns {{tipo:string, mat:any, arista:any, x:number, z:number, y0:number, w:number, h:number, d:number, ang:number, sombra:boolean}[]}
 */
export function elementosDe(loc, layout) {
  const els = [];
  const E = (tipo, mat, arista, x, z, y0, w, h, d, ang = 0, sombra = true) => els.push({ tipo, mat, arista, x, z, y0, w, h, d, ang, sombra });
  const esp = loc.espesorMuro, H = loc.altura + ALTO_PRETIL, sgn = Math.sign(areaFirmada(loc.poligono));
  // losa: franjas del polígono desplazado
  for (const r of regionDePoligono(desplazar(loc.poligono, esp + 0.35))) E('losa', MAT.losa, MAT.aristaSuave, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, -0.3, r.x1 - r.x0, 0.3, r.z1 - r.z0, 0, false);
  for (const [x, z] of loc.columnas) E('col', MAT.columna, MAT.arista, x, z, 0, loc.columna, loc.altura, loc.columna);
  const L = lados(loc.poligono);
  const vanos = [loc.recibo, ...loc.salidas];
  L.forEach((l, i) => {
    const sig = L[(i + 1) % L.length];
    const convexoFin = (l.dir[0] * sig.dir[1] - l.dir[1] * sig.dir[0]) * sgn > 0;
    const largo = l.largo + (convexoFin ? esp : 0);
    const ang = Math.atan2(-l.dir[1], l.dir[0]);
    const en = (t, off = esp / 2) => [l.a[0] + l.dir[0] * t + l.normal[0] * off, l.a[1] + l.dir[1] * t + l.normal[1] * off];
    const pieza = (tipo, mat, ar, ta, tb, y0, h, d = esp, off = esp / 2, sombra = true) => { if (tb - ta < 0.01 || h < 0.01) return; const [x, z] = en((ta + tb) / 2, off); E(tipo, mat, ar, x, z, y0, tb - ta, h, d, ang, sombra); };
    const fach = loc.fachadas.some((f) => sobreLado(l, f.a) && sobreLado(l, f.b));
    if (!fach) {
      const cortes = vanos.filter((v) => sobreLado(l, v.centro) && tEn(l, v.centro) > 0 && tEn(l, v.centro) < l.largo).map((v) => ({ t: tEn(l, v.centro), v })).sort((a, b) => a.t - b.t);
      let t0 = 0;
      for (const { t, v } of cortes) {
        pieza('muro', MAT.muroExt, MAT.arista, t0, t - v.ancho / 2, 0, H);
        pieza('dintel', MAT.muroExt, MAT.arista, t - v.ancho / 2, t + v.ancho / 2, v.alto, H - v.alto);
        pieza('puerta', MAT_PUERTA, MAT.arista, t - v.ancho / 2, t + v.ancho / 2, 0, v.alto, 0.06, esp * 0.75);
        t0 = t + v.ancho / 2;
      }
      pieza('muro', MAT.muroExt, MAT.arista, t0, largo, 0, H);
      return;
    }
    // fachada de cristal
    const acc = loc.acceso, enEste = sobreLado(l, acc.centro) && tEn(l, acc.centro) > 0 && tEn(l, acc.centro) < l.largo;
    const tA = enEste ? tEn(l, acc.centro) : -1e3, a0 = tA - acc.ancho / 2, a1 = tA + acc.ancho / 2;
    if (enEste) { pieza('zocalo', MAT.peto, MAT.aristaSuave, 0, a0, 0, 0.3); pieza('zocalo', MAT.peto, MAT.aristaSuave, a1, largo, 0, 0.3); }
    else pieza('zocalo', MAT.peto, MAT.aristaSuave, 0, largo, 0, 0.3);
    const n = Math.max(1, Math.round(largo / MODULO_CANCEL));
    for (let k = 0; k <= n; k++) { const t = (largo * k) / n; if (enEste && t > a0 + 0.05 && t < a1 - 0.05) continue; pieza('parteluz', MAT.marco, MAT.aristaSuave, t - 0.04, t + 0.04, 0, loc.altura, 0.12); }
    pieza('trav', MAT.marco, MAT.aristaSuave, 0, largo, 3.0, 0.1, 0.12);
    pieza('peto', MAT.peto, MAT.aristaSuave, 0, largo, loc.altura, H - loc.altura);
    const vid = (ta, tb, y0, h) => pieza('cristal', MAT.cristal, null, ta, tb, y0, h, 0.03, esp / 2, false);
    if (enEste) {
      vid(0, a0, 0.3, loc.altura - 0.3); vid(a1, largo, 0.3, loc.altura - 0.3); vid(a0, a1, acc.alto + 0.1, loc.altura - acc.alto - 0.1);
      pieza('marco', MAT.marco, MAT.arista, a0 - 0.06, a1 + 0.06, acc.alto, 0.1, 0.16);
      pieza('marco', MAT.marco, MAT.arista, a0 - 0.06, a0 + 0.02, 0, acc.alto, 0.16); pieza('marco', MAT.marco, MAT.arista, a1 - 0.02, a1 + 0.06, 0, acc.alto, 0.16);
    } else vid(0, largo, 0.3, loc.altura - 0.3);
  });
  // muros interiores del layout, con huecos de puerta (y dintel)
  for (const mu of layout?.muros || []) {
    const dx = mu.b[0] - mu.a[0], dz = mu.b[1] - mu.a[1], Lm = Math.hypot(dx, dz), ux = dx / Lm, uz = dz / Lm, ang = Math.atan2(-uz, ux);
    const ps = (layout.puertas || []).filter((p) => p.muro === mu.id).sort((a, b) => a.centro - b.centro);
    const tramo = (ta, tb, y0, h) => { if (tb - ta < 0.01 || h < 0.01) return; const tm = (ta + tb) / 2; E('interior', MAT.muroInt, MAT.arista, mu.a[0] + ux * tm, mu.a[1] + uz * tm, y0, tb - ta, h, mu.espesor, ang); };
    let t0 = 0;
    for (const p of ps) { tramo(t0, p.centro - p.ancho / 2, 0, mu.altura); tramo(p.centro - p.ancho / 2, p.centro + p.ancho / 2, p.alto, mu.altura - p.alto); t0 = p.centro + p.ancho / 2; }
    tramo(t0, Lm, 0, mu.altura);
  }
  return els;
}

/** Empareja elementos viejos y nuevos del mismo tipo y orientación, por cercanía (voraz). */
function emparejarEl(viejos, nuevos) {
  const pares = [];
  const k = (e) => `${e.tipo}|${Math.round(((e.ang % Math.PI) + Math.PI) % Math.PI * 100)}`;
  const idx = new Map(); viejos.forEach((v, i) => { const c = k(v); if (!idx.has(c)) idx.set(c, []); idx.get(c).push(i); });
  nuevos.forEach((n, j) => { for (const i of idx.get(k(n)) || []) pares.push([Math.hypot(viejos[i].x - n.x, viejos[i].z - n.z) + Math.abs(viejos[i].w - n.w) * 0.3, i, j]); });
  pares.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const uv = new Set(), un = new Set(), m = [];
  for (const [, i, j] of pares) { if (uv.has(i) || un.has(j)) continue; uv.add(i); un.add(j); m.push([i, j]); }
  return { pares: m, soloViejos: viejos.map((_, i) => i).filter((i) => !uv.has(i)), soloNuevos: nuevos.map((_, j) => j).filter((j) => !un.has(j)) };
}

/**
 * @param {{escena:any, anim:any}} ctx
 */
export function crearCascaron({ escena, anim }) {
  const raiz = new THREE.Group(); raiz.name = 'cascaron'; escena.add(raiz);
  const gEl = new THREE.Group(); const gFus = new THREE.Group(); raiz.add(gEl, gFus);
  /** @type {{e:any, obj:THREE.Mesh}[]} */
  let vivos = [];
  let local = null, layout = null, enCurso = null;

  function crearObj(e) {
    const m = new THREE.Mesh(CAJA, e.mat); m.castShadow = e.sombra; m.receiveShadow = true;
    if (e.mat === MAT.cristal) m.renderOrder = 2;
    if (e.arista) { const l = new THREE.LineSegments(ARISTAS_CAJA, e.arista); l.raycast = () => {}; m.add(l); }
    gEl.add(m); return m;
  }
  function aplicar(obj, s) {
    obj.position.set(s.x, s.y0, s.z); obj.rotation.y = s.ang;
    obj.scale.set(Math.max(1e-3, s.w), Math.max(1e-3, s.h), Math.max(1e-3, s.d));
    obj.visible = s.w > 2e-3 && s.h > 2e-3 && s.d > 2e-3;
  }

  /** Fusiona todo en una malla por material + aristas por material (reposo). */
  function fusionar() {
    desfusionar();
    const porMat = new Map(), porArista = new Map();
    for (const { obj } of vivos) {
      if (!obj.visible) continue;
      obj.updateMatrixWorld(true);
      const g = CAJA.clone().applyMatrix4(obj.matrixWorld);
      if (!porMat.has(obj.material)) porMat.set(obj.material, []); porMat.get(obj.material).push(g);
      const l = obj.children[0];
      if (l) { const gl = ARISTAS_CAJA.clone().applyMatrix4(obj.matrixWorld); if (!porArista.has(l.material)) porArista.set(l.material, []); porArista.get(l.material).push(gl); }
    }
    for (const [mat, gs] of porMat) {
      const m = new THREE.Mesh(mergeGeometries(gs), mat); gs.forEach((g) => g.dispose());
      m.castShadow = mat !== MAT.cristal && mat !== MAT.losa; m.receiveShadow = true; if (mat === MAT.cristal) m.renderOrder = 2;
      gFus.add(m);
    }
    for (const [mat, gs] of porArista) { const l = new THREE.LineSegments(mergeGeometries(gs), mat); gs.forEach((g) => g.dispose()); l.raycast = () => {}; gFus.add(l); }
    gEl.visible = false;
  }
  function desfusionar() {
    for (const o of gFus.children.slice()) { o.geometry.dispose(); gFus.remove(o); }
    gEl.visible = true;
  }
  function limpiarEl() { for (const { obj } of vivos) gEl.remove(obj); vivos = []; }

  const api = {
    raiz,
    get local() { return local; },
    caja: () => caja(local.poligono),
    /** Deja la escena sin local (paso 0). */
    vaciar() { enCurso?.cancel(); desfusionar(); limpiarEl(); local = null; layout = null; },
    /**
     * Construye el local desde cero con animación (paso 1): losa, columnas, muros, fachada, interiores.
     * @returns {any} Handle
     */
    construir(loc, lay) {
      enCurso?.cancel(); desfusionar(); limpiarEl(); local = loc; layout = lay;
      const bb = caja(loc.poligono);
      const hs = [];
      for (const e of elementosDe(loc, lay)) {
        const obj = crearObj(e); vivos.push({ e, obj });
        const fin = { ...e };
        const ord = (bb.z1 - e.z) + (e.x - bb.x0); // de la esquina frontal izquierda hacia el fondo
        let delay, dur = 650, ease = 'out', f;
        switch (e.tipo) {
          case 'losa': delay = 0; dur = 900; f = (k) => ({ ...fin, w: e.w * k, d: e.d * k }); break;
          case 'col': delay = 500 + Math.min(900, ord * 22); dur = 600; ease = 'back'; f = (k) => ({ ...fin, h: e.h * k }); break;
          case 'muro': case 'dintel': delay = 1200 + Math.min(900, ord * 20); dur = 800; f = (k) => ({ ...fin, h: e.h * k }); break;
          case 'puerta': delay = 2100 + Math.min(500, ord * 10); f = (k) => ({ ...fin, h: e.h * k }); break;
          case 'interior': delay = 2700 + Math.min(900, ord * 25); dur = 700; f = (k) => ({ ...fin, h: e.h * k }); break;
          default: delay = 1700 + Math.min(1000, ord * 18); dur = 650; ease = 'back'; f = (k) => ({ ...fin, h: e.h * k, y0: e.tipo === 'peto' || e.tipo === 'trav' ? e.y0 * k : e.y0 });
        }
        aplicar(obj, f(0));
        hs.push(anim.tween({ delay, dur, ease, onUpdate: (k) => aplicar(obj, f(Math.max(0, k))) }));
      }
      enCurso = anim.all(hs).onDone(() => { enCurso = null; fusionar(); });
      return enCurso;
    },
    /**
     * Transforma el cascarón vigente al de otro local/layout: las piezas emparejadas se deslizan y estiran, las que
     * sobran se hunden y las nuevas se levantan. Sirve también para cambiar solo los muros interiores (paso 4).
     * @param {{dur?:number, delay?:number}} op
     */
    transformarA(loc, lay, { dur = 2200, delay = 0 } = {}) {
      if (!local) return api.construir(loc, lay);
      enCurso?.finish(); desfusionar();
      const nuevos = elementosDe(loc, lay);
      const { pares, soloViejos, soloNuevos } = emparejarEl(vivos.map((v) => v.e), nuevos);
      const hs = [], sig = [];
      for (const [i, j] of pares) {
        const v = vivos[i], a = { ...v.e }, b = nuevos[j];
        v.e = b; sig.push(v);
        hs.push(anim.tween({ delay: delay + 150, dur: dur - 150, ease: 'io', onUpdate: (k) => aplicar(v.obj, { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, y0: a.y0 + (b.y0 - a.y0) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, d: a.d + (b.d - a.d) * k, ang: b.ang }) }));
      }
      for (const i of soloViejos) {
        const v = vivos[i], a = { ...v.e };
        hs.push(anim.tween({ delay, dur: dur * 0.45, ease: 'in', onUpdate: (k) => aplicar(v.obj, a.tipo === 'losa' ? { ...a, w: a.w * (1 - k), d: a.d * (1 - k) } : { ...a, h: a.h * (1 - k) }), onDone: () => gEl.remove(v.obj) }));
      }
      for (const j of soloNuevos) {
        const e = nuevos[j], obj = crearObj(e); const v = { e, obj }; sig.push(v);
        const f = (k) => (e.tipo === 'losa' ? { ...e, w: e.w * k, d: e.d * k } : { ...e, h: e.h * k });
        aplicar(obj, f(0));
        hs.push(anim.tween({ delay: delay + dur * 0.5, dur: dur * 0.5, ease: e.tipo === 'col' ? 'back' : 'out', onUpdate: (k) => aplicar(obj, f(Math.max(0, k))) }));
      }
      vivos = sig; local = loc; layout = lay;
      enCurso = anim.all(hs).onDone(() => { enCurso = null; fusionar(); });
      return enCurso;
    },
    /** Solo muros interiores (cambio de layout en el mismo local). */
    setInteriores(lay, op) { return api.transformarA(local, lay, { dur: 1600, ...op }); },
    stats() { return { elementos: vivos.length, fusionado: !gEl.visible }; },
  };
  return api;
}
