// Colocación y traslado de muebles. Frente: núcleo. Usa la fábrica del frente de mobiliario (crearMueble).
// - Identidad: el id del layout (familia#NN) se conserva entre layouts (lo empareja el generador).
// - Armado en oleadas por zona; traslado con anticipación, elevación, arco y asentado; desarmado de sobrantes.
// - En reposo FUSIONA las mallas horneadas (MAT.mobVC) y sus aristas (MAT.aristaMob) en una sola malla y unas
//   solas líneas; las piezas con otros materiales se quedan como están. Antes de animar se deshace la fusión.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearMueble, liberarPlanesSinUso } from '../mobiliario/index.js';
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

  function desfusionar() {
    for (const o of gFus.children.slice()) { o.geometry.dispose(); gFus.remove(o); }
    for (const o of ocultos) o.visible = true; ocultos = [];
  }
  /**
   * Fusiona en reposo lo horneado de todos los muebles: una malla por material (mobVC, vidrio, …) y unas líneas
   * por material de aristas. Solo toma mallas de muebles en estado 'horneado' (las piezas sueltas no).
   */
  function fusionar() {
    desfusionar();
    const mallas = new Map(), lineas = new Map();
    raiz.updateMatrixWorld(true);
    for (const { fx } of porId.values()) {
      if (fx.estado !== 'horneado') continue;
      fx.grupo.traverse((o) => {
        if (o === fx.grupo || !(o.isMesh || o.isLineSegments)) return;
        for (let p = o; p && p !== fx.grupo; p = p.parent) if (!p.visible) return;
        const g = o.geometry, clave = o.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + (g.index ? 'i' : 'n');
        const dest = o.isLineSegments ? lineas : mallas;
        if (!dest.has(clave)) dest.set(clave, { mat: o.material, gs: [], ro: o.renderOrder });
        dest.get(clave).gs.push(g.clone().applyMatrix4(o.matrixWorld)); ocultos.push(o);
      });
    }
    for (const o of ocultos) o.visible = false;
    for (const { mat, gs, ro } of mallas.values()) { const m = new THREE.Mesh(mergeGeometries(gs), mat); m.renderOrder = ro; m.castShadow = !mat.transparent; m.receiveShadow = true; gFus.add(m); gs.forEach((g) => g.dispose()); }
    for (const { mat, gs } of lineas.values()) { const l = new THREE.LineSegments(mergeGeometries(gs), mat); l.raycast = () => {}; gFus.add(l); gs.forEach((g) => g.dispose()); }
  }
  // Al terminar cada transición se liberan en la GPU las geometrías de los planes de mobiliario que ya nadie usa
  // (antes crecían ~350 geometrías por transición; ver mobiliario/index.js liberarPlanesSinUso).
  const alTerminar = (h) => h.onDone(() => { liberarPlanesSinUso(); fusionar(); });

  const api = {
    raiz, porId,
    get layout() { return layout; },
    /** Crea (sin mostrar: desarmados) los muebles del layout. Sustituye a los anteriores. */
    preparar(lay) {
      desfusionar();
      for (const id of [...porId.keys()]) quitar(id);
      layout = lay;
      for (const m of lay.muebles || []) nuevo(m);
      liberarPlanesSinUso(); // los planes de los muebles retirados ya no se usan: libera su GPU (ver arriba)
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
      c.retirados.forEach((id, i) => { const r = porId.get(id); if (!r) return; hs.push(r.fx.desarmar({ delay: Math.min(500, i * 20) }).onDone(() => quitar(id))); });
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
      const iniNuevos = Math.max(600, finMov - 600);
      nuevos.forEach((m, i) => { if (porId.has(m.id)) quitar(m.id); const fx = nuevo(m); hs.push(fx.armar({ delay: iniNuevos + Math.min(1200, i * 30) })); });
      return alTerminar(anim.all(hs));
    },
    fusionar, desfusionar, tiemposLocal: TIEMPOS_LOCAL,
    /** Caja 3D (min/max) de cada mueble para elegir con el puntero (ficha). */
    cajas() { return [...porId.values()].map(({ spec: m }) => { const g = ((Math.round(m.rot / 90) % 4) + 4) % 4, w = g % 2 ? m.fondo : m.ancho, d = g % 2 ? m.ancho : m.fondo; return { spec: m, min: [m.x - w / 2, 0, m.z - d / 2], max: [m.x + w / 2, m.familia === 'tarima_aparador' ? 2.0 : m.alto, m.z + d / 2] }; }); },
    stats() { return { muebles: porId.size, fusionado: gFus.children.length > 0 }; },
  };
  return api;
}
