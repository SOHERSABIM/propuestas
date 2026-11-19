// INSTALACIONES (iluminación, aire acondicionado, refrigeración). Frente: instalaciones. Contrato: docs/design.md §6.
// Tres capas con trazo progresivo (la geometría crece), retracción en sentido inverso (más rápida) y flujo animado.
// Todo el tiempo cuelga del reloj y del sistema de animación del proyecto (sin setTimeout ni relojes propios).
import * as THREE from 'three';
import { planInstalaciones } from './plan.js';
import { crearCapaLuz } from './luz.js';
import { crearCapaAire } from './aire.js';
import { crearCapaFrio } from './frio.js';
import { DURACION, SALTO } from './tiempos.js';
import { NIVEL_AZOTEA } from './util.js';

/** Cara superior de la losa de azotea (m): todas las bancadas de equipos apoyan exactamente en este nivel. */
export { NIVEL_AZOTEA };

/** @typedef {'luz'|'aire'|'frio'} CapaId */
export const CAPAS = /** @type {const} */ (['luz', 'aire', 'frio']);
// Tiempos (tiempos.js): encadenadas luz 4.6 s · aire 6.6 s · frío 5.6 s; re-trazo de una capa suelta ≤ 3.9 s (en
// paralelo tras un cambio de layout o local); retraer ≤ 0.9 s en sentido inverso.

/**
 * @param {{escena:any, anim:any, reloj:any}} ctx
 */
export function crearInstalaciones({ escena, anim, reloj }) {
  const raiz = new THREE.Group(); raiz.name = 'instalaciones'; escena.add(raiz);
  const capa = { luz: crearCapaLuz(), aire: crearCapaAire(), frio: crearCapaFrio() };
  for (const c of CAPAS) raiz.add(capa[c].grupo);
  /** @type {Record<CapaId, {prog:number, destino:boolean, h:any}>} */
  const est = { luz: { prog: 0, destino: false, h: null }, aire: { prog: 0, destino: false, h: null }, frio: { prog: 0, destino: false, h: null } };
  let plan = null;

  function aplicar(id, p) {
    est[id].prog = p; capa[id].grupo.visible = p > 0 && !!capa[id].plan; capa[id].actualizar(p); reloj.pedirCuadro();
  }
  /** Lleva el avance de la capa a 0 o 1 con un tween sobre el reloj del proyecto. */
  function animarA(id, destino, delay = 0, rapido = false) {
    const e = est[id]; e.h?.cancel(); e.destino = destino;
    const desde = e.prog, hasta = destino ? 1 : 0;
    if (!capa[id].plan) { e.h = null; return anim.wait(0); }
    if (Math.abs(desde - hasta) < 1e-6) { aplicar(id, hasta); e.h = null; return anim.wait(0); }
    const dur = destino ? (rapido ? DURACION.rapida : DURACION.larga)[id] * (1 - desde) : Math.max(250, DURACION.retraer * desde);
    const h = anim.tween({ dur, delay, ease: 'lin', aplicarInicio: false, onUpdate: (k) => aplicar(id, desde + (hasta - desde) * k) });
    e.h = h.activo ? h : null; h.onDone(() => { if (e.h === h) e.h = null; }); return h;
  }

  // Flujo animado (pulsos) de las capas visibles; prioridad 60 del reloj central.
  reloj.onTick((dt, ahora) => {
    for (const id of CAPAS) if (est[id].prog > 0) capa[id].flujo(ahora);
  }, 60);

  // Realce por capa (R9): opacidad multiplicada por capa, sin tocar geometría ni conteos. Los materiales se recogen
  // al empezar cada realce (la geometría puede haberse reconstruido) y se guarda su opacidad original.
  const baseOp = new Map(), matsCapa = { luz: [], aire: [], frio: [] }, nivelCapa = { luz: 1, aire: 1, frio: 1 };
  function recoger(id) {
    const s = new Set();
    capa[id].grupo.traverse((o) => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) s.add(m); });
    matsCapa[id] = [...s];
    for (const m of matsCapa[id]) if (!baseOp.has(m)) baseOp.set(m, { op: m.opacity, tr: m.transparent, dw: m.depthWrite });
  }
  function nivelar(id, v) {
    nivelCapa[id] = v;
    for (const m of matsCapa[id]) {
      const b = baseOp.get(m), t = v < 0.999 || b.tr;
      if (m.transparent !== t) { m.transparent = t; m.depthWrite = v < 0.999 ? false : b.dw; m.needsUpdate = true; }
      m.opacity = b.op * v;
    }
    reloj.pedirCuadro();
  }

  return {
    raiz,
    /**
     * Realce: lleva la opacidad de cada capa al nivel dado (1 = normal) en `dur` ms. Solo materiales; Handle.
     * @param {{luz?:number, aire?:number, frio?:number}} niveles
     */
    realzar(niveles, { dur = 450, delay = 0 } = {}) {
      const ids = CAPAS.filter((c) => niveles[c] != null);
      for (const id of ids) recoger(id);
      const ini = Object.fromEntries(ids.map((c) => [c, nivelCapa[c]]));
      return anim.tween({ dur, delay, ease: 'io', aplicarInicio: false, onUpdate: (k) => { for (const id of ids) nivelar(id, ini[id] + (niveles[id] - ini[id]) * k); } });
    },
    /** Calcula el plan para el local/layout vigente sin animar. No toca lo que está dibujado. */
    setPlan(local, layout) { plan = planInstalaciones(local, layout); return plan; },
    get plan() { return plan; },
    /** Indicadores de instalaciones (luminarias, TR, condensadoras) del plan vigente. */
    indicadores() { return plan ? { ...plan.indicadores } : { luminarias: null, tr: null, condensadoras: null }; },
    /**
     * Traza capas en orden luz → aire → frío (escalonadas). Si el plan cambió desde que se dibujó la capa, la
     * geometría se reconstruye con el plan nuevo y crece desde cero.
     * @param {CapaId[]} capas
     */
    trazar(capas = [...CAPAS]) {
      const lista = CAPAS.filter((c) => capas.includes(c)); const hs = []; let delay = 0;
      const rapido = lista.length === 1;   // una capa suelta (re-trazo en paralelo o conmutador): variante rápida
      for (const id of lista) {
        if (plan && capa[id].plan !== plan) { est[id].h?.cancel(); capa[id].construir(plan); aplicar(id, 0); }
        hs.push(animarA(id, true, delay, rapido)); delay += SALTO[id];
      }
      return hs.length ? anim.all(hs) : anim.wait(0);
    },
    /** Retrae (des-dibuja) capas en sentido inverso y más rápido. Handle. */
    retraer(capas = CAPAS.filter((c) => est[c].destino)) {
      const lista = CAPAS.filter((c) => capas.includes(c)).reverse(); const hs = lista.map((id, i) => animarA(id, false, i * 80));
      return hs.length ? anim.all(hs) : anim.wait(0);
    },
    /** Prende/apaga una capa (traza o retrae solo esa). Handle. */
    setCapa(id, ver) { return ver ? this.trazar([id]) : this.retraer([id]); },
    capasVisibles() { return CAPAS.filter((c) => est[c].destino); },
    stats() {
      const llamadas = Object.fromEntries(CAPAS.map((c) => [c, capa[c].grupo.visible ? capa[c].llamadas() : 0]));
      return {
        capas: this.capasVisibles(), objetos: raiz.children.length, avance: Object.fromEntries(CAPAS.map((c) => [c, +est[c].prog.toFixed(3)])),
        llamadas, llamadasTotal: Object.values(llamadas).reduce((a, b) => a + b, 0),
        indicadores: this.indicadores(), detalle: plan?.extra ?? null,
      };
    },
  };
}
