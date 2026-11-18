// Cascarón del local: losa, columnas, muros exteriores, fachada de cristal, puertas y muros interiores. Frente: núcleo.
// Modelo de ELEMENTOS: cada pieza es una caja unitaria escalada {x, z, y0, w, h, d, ang}. Así el paso 1 la hace
// crecer, el paso 5 la transforma (se empareja por tipo y orientación con la del local destino y se interpola)
// y todo se dibuja en LOTES dinámicos: una malla por material y unas líneas por material de aristas, escritas en sitio
// (pocas llamadas de dibujo también durante las animaciones y sin fusión costosa al terminar).
// Corte dinámico: los muros exteriores que quedan entre la cámara y el interior se vuelven translúcidos (desde el
// paso 2), en cualquier local y ángulo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, mate, PALETA } from '../core/estilo.js';
import { caja, lados, areaFirmada } from '../core/geom.js';
import { regionDePoligono } from '../gen/regiones.js';
import { crearLotes } from './lotes.js';

const ALTO_PRETIL = 0.6;
const MODULO_CANCEL = 1.5;
const MAT_PUERTA = mate(PALETA.arq.puerta, 'arq');

/** Muro exterior cortado (entre la cámara y el interior). Grupo 'arq': se atenúa con la arquitectura. */
const MAT_CORTE = mate(PALETA.arq.muroExt, 'arq', { transparent: true, opacity: 1, depthWrite: false });
const OPAC_CORTE = 0.16;
const CORTABLES = new Set(['muro', 'dintel', 'puerta']);
/** Corte total (recorrido del cierre): también la fachada, y sin aristas, para que nada cruce la lente. */
const CORTABLES_TOTAL = new Set(['muro', 'dintel', 'puerta', 'cristal', 'parteluz', 'trav', 'peto', 'zocalo', 'marco']);

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
  const E = (tipo, mat, arista, x, z, y0, w, h, d, ang = 0, sombra = true, n = null) => els.push({ tipo, mat, arista, x, z, y0, w, h, d, ang, sombra, n });
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
    const pieza = (tipo, mat, ar, ta, tb, y0, h, d = esp, off = esp / 2, sombra = true) => { if (tb - ta < 0.01 || h < 0.01) return; const [x, z] = en((ta + tb) / 2, off); E(tipo, mat, ar, x, z, y0, tb - ta, h, d, ang, sombra, l.normal); };
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
 * @param {{escena:any, anim:any, reloj?:any, camara?:any}} ctx
 */
export function crearCascaron({ escena, anim, reloj, camara }) {
  const raiz = new THREE.Group(); raiz.name = 'cascaron'; escena.add(raiz);
  const lotes = crearLotes(raiz, {
    sombra: (m) => m !== MAT.cristal && m !== MAT.losa && m !== MAT_CORTE,
    orden: (m) => (m === MAT.cristal || m === MAT_CORTE ? 2 : 0),
  });
  /** @type {{e:any, s:any, mat:any, arista:any}[]} */
  let vivos = [];
  let local = null, layout = null, enCurso = null;
  const item = (e, s = e) => ({ e, s: { ...s }, mat: e.mat, arista: e.arista, corte: false });
  const aplicar = (v, s) => { v.s = s; lotes.escribir(v); };
  const rehacer = (lista = lotes.items) => { firma = NaN; lotes.reconstruir(lista); };

  // ---------- Corte dinámico de muros ----------
  let corte = 0, firma = NaN, tCorte = null, total = 0, tTotal = null;
  function nivelArq() { const b = MAT.muroExt.userData.opacidadBase || 1; return MAT.muroExt.opacity / b; }
  function opacidadCorte() {
    const base = (1 - (1 - OPAC_CORTE) * corte) * (1 - total);
    MAT_CORTE.userData.opacidadBase = base; MAT_CORTE.opacity = base * nivelArq();
  }
  /** Revisa qué muros quedan entre la cámara y el interior; si cambió el conjunto, reasigna materiales. */
  function revisarCorte() {
    const lista = lotes.items; if (!lista.length || !camara) return;
    const px = camara.position.x, pz = camara.position.z;
    const tipos = total > 0 ? CORTABLES_TOTAL : CORTABLES;
    let h = total > 0 ? 11 : 7;
    for (const v of lista) {
      const n = v.e.n;
      const c = (corte > 0 || total > 0) && n && tipos.has(v.e.tipo) && n[0] * (px - v.s.x) + n[1] * (pz - v.s.z) > 0.5;
      v.corte = c; h = (h * 31 + (c ? 1 : 0)) | 0;
    }
    if (h === firma) return;
    for (const v of lista) { v.mat = v.corte ? MAT_CORTE : v.e.mat; v.arista = v.corte ? (total > 0 ? null : MAT.aristaSuave) : v.e.arista; }
    lotes.reconstruir(lista); firma = h;
  }
  reloj?.onTick(revisarCorte, 55);

  const api = {
    raiz,
    get local() { return local; },
    caja: () => caja(local.poligono),
    /** Deja la escena sin local (paso 0). */
    vaciar() { enCurso?.cancel(); enCurso = null; vivos = []; rehacer([]); local = null; layout = null; api.cortar(false, { dur: 0 }); api.cortarTodo(false, { dur: 0 }); },
    /**
     * Corte dinámico de muros (paso 2 en adelante): los muros exteriores entre la cámara y el interior se vuelven
     * translúcidos con un fundido. @returns {any} Handle
     */
    cortar(ver, { dur = 600, delay = 0 } = {}) {
      tCorte?.cancel();
      const a = corte, b = ver ? 1 : 0;
      tCorte = anim.tween({ delay, dur, ease: 'io', onUpdate: (k) => { corte = a + (b - a) * k; opacidadCorte(); if (k === 0 || k === 1) firma = NaN; } });
      return tCorte;
    },
    /**
     * Corte total (recorrido del cierre): fachada y muros del lado de la cámara se desvanecen por completo y sin
     * aristas, para entrar y salir del local sin que nada cruce la lente. @returns {any} Handle
     */
    cortarTodo(ver, { dur = 500, delay = 0 } = {}) {
      tTotal?.cancel();
      const a = total, b = ver ? 1 : 0;
      tTotal = anim.tween({ delay, dur, ease: 'io', onUpdate: (k) => { total = a + (b - a) * k; opacidadCorte(); firma = NaN; } });
      return tTotal;
    },
    /** Reaplica la opacidad del corte tras un atenuado de la arquitectura. */
    refrescar: opacidadCorte,
    /**
     * Construye el local desde cero con animación (paso 1): losa, columnas, muros, fachada, interiores.
     * @returns {any} Handle
     */
    construir(loc, lay) {
      enCurso?.cancel(); local = loc; layout = lay;
      const bb = caja(loc.poligono);
      const hs = [];
      vivos = elementosDe(loc, lay).map((e) => item(e));
      rehacer(vivos);
      for (const v of vivos) {
        const e = v.e, fin = { ...e };
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
        aplicar(v, f(0));
        hs.push(anim.tween({ delay, dur, ease, onUpdate: (k) => aplicar(v, f(Math.max(0, k))) }));
      }
      enCurso = anim.all(hs).onDone(() => { enCurso = null; });
      return enCurso;
    },
    /**
     * Transforma el cascarón vigente al de otro local/layout: las piezas emparejadas se deslizan y estiran, las que
     * sobran se hunden y las nuevas se levantan. Sirve también para cambiar solo los muros interiores (paso 4).
     * @param {{dur?:number, delay?:number}} op
     */
    transformarA(loc, lay, { dur = 2200, delay = 0 } = {}) {
      if (!local) return api.construir(loc, lay);
      enCurso?.finish();
      const nuevos = elementosDe(loc, lay);
      const { pares, soloViejos, soloNuevos } = emparejarEl(vivos.map((v) => v.e), nuevos);
      const hs = [], sig = [], dibujo = [...vivos];
      const igual = (a, b) => ['x', 'z', 'y0', 'w', 'h', 'd', 'ang'].every((k) => Math.abs(a[k] - b[k]) < 1e-6);
      for (const [i, j] of pares) {
        const v = vivos[i], a = { ...v.s }, b = nuevos[j];
        v.e = b; v.mat = b.mat; v.arista = b.arista; sig.push(v);
        if (igual(a, b)) continue; // sin cambio: no se anima
        hs.push(anim.tween({ delay: delay + 150, dur: dur - 150, ease: 'io', onUpdate: (k) => aplicar(v, { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, y0: a.y0 + (b.y0 - a.y0) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, d: a.d + (b.d - a.d) * k, ang: b.ang }) }));
      }
      for (const i of soloViejos) {
        const v = vivos[i], a = { ...v.s };
        hs.push(anim.tween({ delay, dur: dur * 0.45, ease: 'in', onUpdate: (k) => aplicar(v, a.w !== undefined && v.e.tipo === 'losa' ? { ...a, w: a.w * (1 - k), d: a.d * (1 - k) } : { ...a, h: a.h * (1 - k) }) }));
      }
      const entran = [];
      for (const j of soloNuevos) {
        const e = nuevos[j], v = item(e); sig.push(v); dibujo.push(v); entran.push(v);
        const f = (k) => (e.tipo === 'losa' ? { ...e, w: e.w * k, d: e.d * k } : { ...e, h: e.h * k });
        v.s = f(0);
        hs.push(anim.tween({ delay: delay + dur * 0.5, dur: dur * 0.5, ease: e.tipo === 'col' ? 'back' : 'out', aplicarInicio: false, onUpdate: (k) => aplicar(v, f(Math.max(0, k))) }));
      }
      rehacer(dibujo);
      vivos = sig; local = loc; layout = lay;
      enCurso = anim.all(hs).onDone(() => { enCurso = null; rehacer(vivos); });
      return enCurso;
    },
    /** Solo muros interiores (cambio de layout en el mismo local). */
    setInteriores(lay, op) { return api.transformarA(local, lay, { dur: 1600, ...op }); },
    stats() { return { elementos: vivos.length, fusionado: true, llamadas: lotes.llamadas(), corte: lotes.items.filter((v) => v.corte).length }; },
  };
  return api;
}
