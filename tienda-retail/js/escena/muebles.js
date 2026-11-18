// Colocación y traslado de muebles. Frente: núcleo. Usa la fábrica del frente de mobiliario (crearMueble).
// - Identidad: el id del layout (familia#NN) se conserva entre layouts (lo empareja el generador).
// - Armado en oleadas por zona; traslado con anticipación, elevación, arco y asentado; desarmado de sobrantes.
// - En reposo FUSIONA las mallas horneadas (MAT.mobVC) y sus aristas (MAT.aristaMob) en una sola malla y unas
//   solas líneas; las piezas con otros materiales se quedan como están. Antes de animar se deshace la fusión.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearMueble } from '../mobiliario/index.js';
import { ZONAS } from '../datos/catalogo.js';
import { MAT } from '../core/estilo.js';
import { DEG } from '../core/geom.js';
import { EASE } from '../core/anim.js';

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
  /** Fusiona todo lo horneado (MAT.mobVC / MAT.aristaMob) en una malla y unas líneas. */
  function fusionar() {
    desfusionar();
    const gs = [], ls = [];
    raiz.updateMatrixWorld(true);
    for (const { fx } of porId.values()) {
      fx.grupo.traverse((o) => {
        if (!o.visible || o === fx.grupo) return;
        let vis = true; for (let p = o.parent; p && p !== raiz; p = p.parent) if (!p.visible) vis = false;
        if (!vis) return;
        if (o.isMesh && o.material === MAT.mobVC) { gs.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); ocultos.push(o); }
        else if (o.isLineSegments && o.material === MAT.aristaMob && fx.estado === 'horneado') { ls.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); ocultos.push(o); }
      });
    }
    for (const o of ocultos) o.visible = false;
    if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), MAT.mobVC); m.castShadow = true; m.receiveShadow = true; gFus.add(m); gs.forEach((g) => g.dispose()); }
    if (ls.length) { const l = new THREE.LineSegments(mergeGeometries(ls), MAT.aristaMob); l.raycast = () => {}; gFus.add(l); ls.forEach((g) => g.dispose()); }
  }
  const alTerminar = (h) => h.onDone(() => fusionar());

  const api = {
    raiz, porId,
    get layout() { return layout; },
    /** Crea (sin mostrar: desarmados) los muebles del layout. Sustituye a los anteriores. */
    preparar(lay) {
      desfusionar();
      for (const id of [...porId.keys()]) quitar(id);
      layout = lay;
      for (const m of lay.muebles || []) nuevo(m);
    },
    /**
     * Arma todos en oleadas por zona (paso 2). Orden de ZONAS; dentro de cada zona, de la fachada al fondo.
     * @param {{oleada?:number, cada?:number, max?:number}} op
     */
    armar({ oleada = 1250, cada = 55, max = 1100 } = {}) {
      desfusionar();
      const hs = [];
      ZONAS.forEach((z, iz) => {
        const lista = layout.muebles.filter((m) => m.zona === z).sort((a, b) => b.z - a.z || a.x - b.x);
        lista.forEach((m, i) => hs.push(porId.get(m.id).fx.armar({ delay: iz * oleada + Math.min(max, i * cada) })));
      });
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
    transitar(lay, { modo = 'layout', pausa = 0, cada = 28 } = {}) {
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
      mov.forEach((id, i) => {
        const r = porId.get(id), a = r.spec, b = specs.get(id), fx = r.fx, g = fx.grupo;
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
    fusionar, desfusionar,
    /** Caja 3D (min/max) de cada mueble para elegir con el puntero (ficha). */
    cajas() { return [...porId.values()].map(({ spec: m }) => { const g = ((Math.round(m.rot / 90) % 4) + 4) % 4, w = g % 2 ? m.fondo : m.ancho, d = g % 2 ? m.ancho : m.fondo; return { spec: m, min: [m.x - w / 2, 0, m.z - d / 2], max: [m.x + w / 2, m.alto, m.z + d / 2] }; }); },
    stats() { return { muebles: porId.size, fusionado: gFus.children.length > 0 }; },
  };
  return api;
}
