// Colocación y traslado de muebles. Frente: núcleo. Usa la fábrica del frente de mobiliario (crearMueble).
// - Identidad: el id del layout (familia#NN) se conserva entre layouts (lo empareja el generador).
// - Armado en oleadas por zona; traslado con anticipación, elevación, arco y asentado; desarmado de sobrantes.
// - En reposo FUSIONA las mallas horneadas (MAT.mobVC) y sus aristas (MAT.aristaMob) en una sola malla y unas
//   solas líneas; las piezas con otros materiales se quedan como están. Antes de animar se deshace la fusión.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearMueble, liberarPlanesSinUso, resumenMueble } from '../mobiliario/index.js';
import { ZONAS } from '../datos/catalogo.js';
import { MAT } from '../core/estilo.js';
import { DEG } from '../core/geom.js';
import { EASE } from '../core/anim.js';
import { regionDePoligono } from '../gen/regiones.js';
import { caja as cajaPoly } from '../core/geom.js';

/** Tiempos del cambio de local (ms): subir en formación, vuelo sobre el local nuevo, bajada. */
export const TIEMPOS_LOCAL = { subida: 1650, vuelo: 2600, bajada: 1300 };

/** ¿El segmento p→q cruza algún muro interior del layout? */
function cruzaMuro(p, q, muros) {
  for (const m of muros || []) {
    const [ax, az] = m.a, [bx, bz] = m.b;
    const d = (q[0] - p[0]) * (bz - az) - (q[1] - p[1]) * (bx - ax);
    if (Math.abs(d) < 1e-9) continue;
    const t = ((ax - p[0]) * (bz - az) - (az - p[1]) * (bx - ax)) / d;
    const u = ((ax - p[0]) * (q[1] - p[1]) - (az - p[1]) * (q[0] - p[0])) / d;
    if (t >= -0.05 && t <= 1.05 && u >= -0.02 && u <= 1.02) return true;
  }
  return false;
}
const giroCorto = (a, b) => { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d; };

/**
 * @param {{escena:any, anim:any}} ctx
 */
export function crearMuebles({ escena, anim }) {
  const raiz = new THREE.Group(); raiz.name = 'muebles'; escena.add(raiz);
  const gFus = new THREE.Group(); gFus.name = 'muebles-fusion'; raiz.add(gFus);
  /** @type {Map<string, {fx:any, spec:any}>} */
  const porId = new Map();
  let layout = null, ocultos = [];

  const colocar = (fx, m, y = 0) => { fx.grupo.position.set(m.x, y, m.z); fx.grupo.rotation.y = (m.rot || 0) * DEG; };
  function nuevo(m) { const fx = crearMueble(m, { anim }); colocar(fx, m); raiz.add(fx.grupo); porId.set(m.id, { fx, spec: m }); return fx; }
  function quitar(id) { const r = porId.get(id); if (!r) return; r.fx.dispose(); r.fx.grupo.removeFromParent(); porId.delete(id); }

  // ---------- Fusión en reposo, repartida en cuadros ----------
  // Antes se clonaban y fusionaban todas las mallas horneadas en un solo cuadro (100-190 ms). Ahora se reservan los
  // arreglos y se copian (transformados) unos cuantos miles de vértices por cuadro; al terminar se cambia de golpe a
  // la malla fusionada (lo visible es idéntico). Si empieza otra transición, se cancela.
  let fusion = null;
  const VERT_CUADRO = 90000;
  function desfusionar() {
    fusion?.cancel(); fusion = null;
    for (const o of gFus.children.slice()) { o.geometry.dispose(); gFus.remove(o); }
    for (const o of ocultos) o.visible = true; ocultos = [];
  }
  /**
   * Fusiona en reposo lo horneado de todos los muebles: una malla por material (mobVC, vidrio, …) y unas líneas
   * por material de aristas. Solo toma mallas de muebles en estado 'horneado' (las piezas sueltas no).
   * @returns {any} Handle (tarea repartida en cuadros)
   */
  function fusionar() {
    desfusionar();
    const grupos = new Map(), cola = [];
    raiz.updateMatrixWorld(true);
    for (const { fx } of porId.values()) {
      if (fx.estado !== 'horneado') continue;
      fx.grupo.traverse((o) => {
        if (o === fx.grupo || !(o.isMesh || o.isLineSegments)) return;
        for (let p = o; p && p !== fx.grupo; p = p.parent) if (!p.visible) return;
        const g = o.geometry, nombres = Object.keys(g.attributes).sort(), clave = o.material.uuid + '|' + nombres.join(',') + '|' + (g.index ? 'i' : 'n') + (o.isLineSegments ? 'L' : 'M');
        if (!grupos.has(clave)) grupos.set(clave, { mat: o.material, linea: o.isLineSegments, ro: o.renderOrder, nombres, indexado: !!g.index, nv: 0, ni: 0, attrs: null, idx: null, v: 0, i: 0, fuentes: [] });
        const gr = grupos.get(clave);
        gr.fuentes.push(o); gr.nv += g.attributes.position.count; gr.ni += g.index ? g.index.count : 0;
        cola.push([gr, o, o.matrixWorld.clone()]);
      });
    }
    if (!cola.length) return anim.wait(0);
    let k = 0;
    const tmp = new THREE.Vector3();
    function copiar(gr, o, mw) {
      const g = o.geometry, n = g.attributes.position.count, e = mw.elements, base = gr.v;
      if (!gr.attrs) {
        gr.attrs = {};
        for (const nm of gr.nombres) { const a = g.attributes[nm]; gr.attrs[nm] = { tam: a.itemSize, arr: new Float32Array(gr.nv * a.itemSize), norm: a.normalized }; }
        if (gr.indexado) gr.idx = new Uint32Array(gr.ni);
      }
      for (const nm of gr.nombres) {
        const src = g.attributes[nm], dst = gr.attrs[nm], t = dst.tam, d = dst.arr, o0 = base * t;
        if (nm === 'position') {
          for (let i = 0; i < n; i++) { tmp.fromBufferAttribute(src, i).applyMatrix4(mw); d[o0 + i * 3] = tmp.x; d[o0 + i * 3 + 1] = tmp.y; d[o0 + i * 3 + 2] = tmp.z; }
        } else if (nm === 'normal') {
          for (let i = 0; i < n; i++) {
            const x = src.getX(i), y = src.getY(i), z = src.getZ(i);
            d[o0 + i * 3] = e[0] * x + e[4] * y + e[8] * z; d[o0 + i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z; d[o0 + i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z;
          }
        } else if (!src.isInterleavedBufferAttribute && !src.normalized && src.array.length === n * t) d.set(src.array, o0);
        else for (let i = 0; i < n; i++) for (let c = 0; c < t; c++) d[o0 + i * t + c] = src.getComponent(i, c);
      }
      if (gr.indexado) { const ix = g.index; for (let i = 0; i < ix.count; i++) gr.idx[gr.i + i] = ix.getX(i) + base; gr.i += ix.count; }
      gr.v += n;
    }
    fusion = anim.tarea(() => {
      let presup = VERT_CUADRO;
      while (k < cola.length && presup > 0) { const [gr, o, mw] = cola[k++]; copiar(gr, o, mw); presup -= o.geometry.attributes.position.count; }
      if (k < cola.length) return false;
      for (const gr of grupos.values()) {
        const geo = new THREE.BufferGeometry();
        for (const nm of gr.nombres) geo.setAttribute(nm, new THREE.BufferAttribute(gr.attrs[nm].arr, gr.attrs[nm].tam, gr.attrs[nm].norm));
        if (gr.idx) geo.setIndex(new THREE.BufferAttribute(gr.idx, 1));
        geo.computeBoundingSphere();
        if (gr.linea) { const l = new THREE.LineSegments(geo, gr.mat); l.raycast = () => {}; gFus.add(l); }
        else { const m = new THREE.Mesh(geo, gr.mat); m.renderOrder = gr.ro; m.castShadow = !gr.mat.transparent; m.receiveShadow = true; gFus.add(m); }
        for (const o of gr.fuentes) { o.visible = false; ocultos.push(o); }
      }
      fusion = null;
      return true;
    });
    return fusion;
  }
  // Al terminar cada transición se liberan en la GPU las geometrías de los planes de mobiliario que ya nadie usa
  // (antes crecían ~350 geometrías por transición; ver mobiliario/index.js liberarPlanesSinUso).
  const alTerminar = (h) => h.onDone(() => { liberarPlanesSinUso(); fusionar(); });
  /** Hundir horneado (sin despiezar): para los que se retiran en un cambio de local. */
  function hundir(id, delay) {
    const r = porId.get(id); if (!r) return null;
    const g = r.fx.grupo;
    return anim.tween({ delay, dur: 520, ease: 'in', aplicarInicio: false, onUpdate: (k) => { g.scale.set(1 - 0.15 * k, Math.max(0.001, 1 - k), 1 - 0.15 * k); g.position.y = -0.05 * k; } }).onDone(() => quitar(id));
  }

  const api = {
    raiz, porId,
    get layout() { return layout; },
    /** Crea (sin mostrar: desarmados) los muebles del layout. Sustituye a los anteriores. */
    preparar(lay, { porCuadro = 3 } = {}) {
      desfusionar();
      for (const id of [...porId.keys()]) quitar(id);
      layout = lay;
      liberarPlanesSinUso(); // los planes de los muebles retirados ya no se usan: libera su GPU (ver arriba)
      // crear un mueble cuesta (su plan de piezas la primera vez): se reparte en cuadros; quedan desarmados
      const lista = (lay.muebles || []).slice(); let i = 0;
      return anim.tarea(() => { for (let n = 0; n < porCuadro && i < lista.length; n++) nuevo(lista[i++]); return i >= lista.length; });
    },
    /**
     * Arma todos en oleadas por zona (paso 2), en vista general. `orden` = zonas en el orden de las oleadas (por
     * omisión ZONAS); dentro de cada zona, de la fachada al fondo, escalonado `cada` ms con tope `max`.
     * @param {{orden?:string[], oleada?:number, cada?:number, max?:number, inicio?:number}} op
     */
    armar({ orden = ZONAS, oleada = 1150, cada = 55, max = 1100, inicio = 0 } = {}) {
      desfusionar();
      const hs = [];
      const ola = (z) => { const i = orden.indexOf(z); return i < 0 ? orden.length : i; };
      for (const z of ZONAS) {
        const lista = layout.muebles.filter((m) => m.zona === z).sort((a, b) => b.z - a.z || a.x - b.x);
        lista.forEach((m, i) => hs.push(porId.get(m.id).fx.armar({ delay: inicio + ola(z) * oleada + Math.min(max, i * cada) })));
      }
      return alTerminar(anim.all(hs));
    },
    /** Desarma todo (en orden inverso por zona). */
    desarmar() { desfusionar(); return anim.all([...porId.values()].map(({ fx }, i) => fx.desarmar({ delay: Math.min(700, i * 8) }))); },
    /**
     * Transición al layout nuevo: retirados se desarman, movidos viajan (anticipan, se elevan, viajan en arco, asientan),
     * nuevos se arman al final. lay.cambios lo calcula el generador con anterior = layout vigente.
     * @param {any} lay
     * @param {{modo?:'layout'|'local', pausa?:number, cada?:number}} op  modo 'local': todos se elevan por encima del
     *   pretil (5.8 m) y esperan `pausa` ms en el aire mientras el cascarón se transforma.
     */
    transitar(lay, op = {}) {
      const { modo = 'layout', pausa = 0, cada = 28 } = op;
      desfusionar();
      const prev = layout; layout = lay;
      const c = lay.cambios || { movidos: [], quietos: [], nuevos: lay.muebles.map((m) => m.id), retirados: [...porId.keys()] };
      const hs = [];
      // 1) retirados: se desarman
      // en cambio de local se hunden horneados (sin despiezar: pocas llamadas); en cambio de layout se desarman,
      // escalonados para que no se despiecen muchos a la vez
      c.retirados.forEach((id, i) => {
        const r = porId.get(id); if (!r) return;
        if (modo === 'local') hs.push(hundir(id, Math.min(700, i * 18)));
        else hs.push(r.fx.desarmar({ delay: Math.min(1600, i * 130) }).onDone(() => quitar(id)));
      });
      // 2) movidos: barrido por x
      const specs = new Map(lay.muebles.map((m) => [m.id, m]));
      const mov = c.movidos.filter((id) => porId.has(id)).sort((a, b) => porId.get(a).spec.x - porId.get(b).spec.x || (a < b ? -1 : 1));
      const t0 = 250;
      let finMov = t0;
      const TL = TIEMPOS_LOCAL;
      let formacion = null;
      if (modo === 'local' && op.localAnterior && op.localNuevo) {
        const ob = cajaPoly(op.localAnterior.poligono), nb = cajaPoly(op.localNuevo.poligono), reg = regionDePoligono(op.localNuevo.poligono);
        formacion = (a) => {
          let x = nb.x0 + ((a.x - ob.x0) / ob.ancho) * nb.ancho, z = nb.z0 + ((a.z - ob.z0) / ob.fondo) * nb.fondo;
          if (!reg.some((r) => x > r.x0 + 0.5 && x < r.x1 - 0.5 && z > r.z0 + 0.5 && z < r.z1 - 0.5)) {
            let mejor = [x, z], dMin = Infinity;
            for (const r of reg) { const px = Math.min(r.x1 - 0.6, Math.max(r.x0 + 0.6, x)), pz = Math.min(r.z1 - 0.6, Math.max(r.z0 + 0.6, z)), d = Math.hypot(px - x, pz - z); if (d < dMin) { dMin = d; mejor = [px, pz]; } }
            [x, z] = mejor;
          }
          return [x, z];
        };
      }
      mov.forEach((id, i) => {
        const r = porId.get(id), a = r.spec, b = specs.get(id), fx = r.fx, g = fx.grupo;
        if (formacion) {
          // cambio de local: suben escalonados, vuelan en formación (posición relativa conservada) y bajan a su sitio
          const H = 5.8, f = formacion(a), ini = 150 + Math.min(700, i * cada * 0.8);
          const iniBaja = TL.subida + TL.vuelo + Math.min(450, i * 6);
          const q0 = a.rot, q1 = giroCorto(a.rot, b.rot);
          hs.push(anim.seq([
            () => anim.wait(ini),
            () => anim.tween({ dur: 150, ease: 'lin', onUpdate: (k) => { g.position.y = -0.04 * Math.sin(Math.PI * k); g.scale.y = 1 - 0.05 * Math.sin(Math.PI * k); } }),
            () => anim.tween({ dur: 650, ease: 'out', onUpdate: (k) => { g.position.y = H * k; g.scale.y = 1; } }),
            () => anim.wait(Math.max(0, TL.subida - ini - 800)),
            () => anim.tween({ dur: TL.vuelo, ease: 'io', onUpdate: (k) => { g.position.x = a.x + (f[0] - a.x) * k; g.position.z = a.z + (f[1] - a.z) * k; } }),
            () => anim.wait(iniBaja - TL.subida - TL.vuelo),
            () => anim.tween({ dur: TL.bajada, ease: 'lin', onUpdate: (k) => {
              const e = EASE.io(k); g.position.x = f[0] + (b.x - f[0]) * e; g.position.z = f[1] + (b.z - f[1]) * e;
              g.position.y = H * (1 - EASE.out(k)); g.rotation.y = (q0 + (q1 - q0) * e) * DEG;
            } }),
            () => anim.tween({ dur: 220, ease: 'lin', onUpdate: (k) => { g.scale.y = 1 - 0.06 * Math.sin(Math.PI * k); g.scale.x = g.scale.z = 1 + 0.02 * Math.sin(Math.PI * k); } }),
          ]).onDone(() => { colocar(fx, b); g.scale.set(1, 1, 1); r.spec = b; }));
          finMov = Math.max(finMov, iniBaja + TL.bajada);
          return;
        }
        const muros = [...(prev?.muros || []), ...(lay.muros || [])];
        const alto = modo === 'local' ? 5.8 : cruzaMuro([a.x, a.z], [b.x, b.z], muros) ? 3.5 : Math.min(1.1, 0.5 + Math.hypot(b.x - a.x, b.z - a.z) * 0.05);
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        const dMov = modo === 'local' ? 1500 : Math.min(1500, 800 + d * 45);
        const ini = t0 + Math.min(modo === 'local' ? 900 : 1000, i * cada);
        const tAnt = 150, tSub = modo === 'local' ? 650 : 380, tBaj = modo === 'local' ? 600 : 420;
        const iniMov = ini + tAnt + tSub + pausa;
        const r0 = a.rot, r1 = giroCorto(a.rot, b.rot);
        hs.push(anim.seq([
          () => anim.wait(ini),
          () => anim.tween({ dur: tAnt, ease: 'lin', onUpdate: (k) => { g.position.y = -0.04 * Math.sin(Math.PI * k); g.scale.y = 1 - 0.05 * Math.sin(Math.PI * k); } }),
          () => anim.tween({ dur: tSub, ease: 'out', onUpdate: (k) => { g.position.y = alto * k; g.scale.y = 1; } }),
          () => anim.wait(pausa + (modo === 'local' ? Math.max(0, 900 - i * cada) : 0)),
          () => anim.tween({ dur: dMov, ease: 'io', onUpdate: (k) => {
            g.position.x = a.x + (b.x - a.x) * k; g.position.z = a.z + (b.z - a.z) * k;
            g.position.y = alto + Math.sin(Math.PI * k) * Math.min(0.6, d * 0.03);
            g.rotation.y = (r0 + (r1 - r0) * k) * DEG;
          } }),
          () => anim.tween({ dur: tBaj, ease: 'lin', onUpdate: (k) => { g.position.y = alto * (1 - EASE.out(k)) ; } }),
          () => anim.tween({ dur: 220, ease: 'lin', onUpdate: (k) => { g.scale.y = 1 - 0.06 * Math.sin(Math.PI * k); g.scale.x = g.scale.z = 1 + 0.02 * Math.sin(Math.PI * k); } }),
        ]).onDone(() => { colocar(fx, b); g.scale.set(1, 1, 1); r.spec = b; }));
        finMov = Math.max(finMov, iniMov + dMov);
      });
      for (const id of c.quietos) { const r = porId.get(id); if (r) r.spec = specs.get(id); }
      // 3) nuevos: se arman cuando los viajeros van llegando
      const nuevos = c.nuevos.map((id) => specs.get(id)).sort((p, q) => q.z - p.z || p.x - q.x);
      // se crean al llegar su turno (crear cuesta) y se escalonan para que pocos estén despiezados a la vez.
      // Cambio de local: bajan horneados desde la altura de la formación (como los demás) en vez de armarse.
      if (modo === 'local' && formacion) {
        const H = 5.8, ini0 = TL.subida + TL.vuelo - 200;
        nuevos.forEach((m, i) => {
          const d = ini0 + Math.min(1600, i * 35);
          hs.push(anim.seq([() => anim.wait(d), () => {
            if (porId.has(m.id)) quitar(m.id);
            const fx = nuevo(m); fx.hornear(); const g = fx.grupo;
            return anim.seq([
              () => anim.tween({ dur: 260, ease: 'out', onUpdate: (k) => { g.position.y = H; g.scale.setScalar(Math.max(0.001, k)); } }),
              () => anim.tween({ dur: TL.bajada, ease: 'lin', onUpdate: (k) => { g.position.y = H * (1 - EASE.out(k)); } }),
              () => anim.tween({ dur: 220, ease: 'lin', onUpdate: (k) => { g.scale.y = 1 - 0.06 * Math.sin(Math.PI * k); g.scale.x = g.scale.z = 1 + 0.02 * Math.sin(Math.PI * k); } }),
            ]).onDone(() => { colocar(fx, m); g.scale.set(1, 1, 1); });
          }]));
        });
      } else {
        const iniNuevos = 600;
        nuevos.forEach((m, i) => hs.push(anim.seq([() => anim.wait(iniNuevos + Math.min(5000, i * 190)), () => {
          if (porId.has(m.id)) quitar(m.id);
          return nuevo(m).armar({ ritmo: 0.8 });
        }])));
      }
      return alTerminar(anim.all(hs));
    },
    fusionar, desfusionar, tiemposLocal: TIEMPOS_LOCAL,
    /**
     * Precalienta los planes de piezas (lo caro de crear un mueble la primera vez) de una lista de muebles, sin
     * ponerlos en escena (resumenMueble calcula y deja el plan en la caché de mobiliario).
     * @param {any[]} specs
     */
    precalentar(specs) { for (const m of specs) resumenMueble(m); },
    /** Caja 3D (min/max) de cada mueble para elegir con el puntero (ficha). */
    cajas() { return [...porId.values()].map(({ spec: m }) => { const g = ((Math.round(m.rot / 90) % 4) + 4) % 4, w = g % 2 ? m.fondo : m.ancho, d = g % 2 ? m.ancho : m.fondo; return { spec: m, min: [m.x - w / 2, 0, m.z - d / 2], max: [m.x + w / 2, m.familia === 'tarima_aparador' ? 2.0 : m.alto, m.z + d / 2] }; }); },
    stats() { return { muebles: porId.size, fusionado: gFus.children.length > 0, fusionando: !!fusion }; },
  };
  return api;
}
