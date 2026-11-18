// INSTALACIONES (iluminación, aire acondicionado, refrigeración). Frente: instalaciones. Contrato: docs/design.md §6.
// Tres capas con trazo progresivo (la geometría crece), retracción en sentido inverso (más rápida) y flujo animado.
// Todo el tiempo cuelga del reloj y del sistema de animación del proyecto (sin setTimeout ni relojes propios).
import * as THREE from 'three';
import { planInstalaciones } from './plan.js';
import { crearCapaLuz } from './luz.js';
import { crearCapaAire } from './aire.js';
import { crearCapaFrio } from './frio.js';

/** @typedef {'luz'|'aire'|'frio'} CapaId */
export const CAPAS = /** @type {const} */ (['luz', 'aire', 'frio']);
const DUR_TRAZO = { luz: 2500, aire: 3000, frio: 3000 };   // ms por capa
const SALTO = { luz: 2100, aire: 2600, frio: 0 };           // ms hasta que arranca la siguiente capa
const DUR_RETRAER = 800;                                    // ms (≈3× más rápido que el trazo)

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
  function animarA(id, destino, delay = 0) {
    const e = est[id]; e.h?.cancel(); e.destino = destino;
    const desde = e.prog, hasta = destino ? 1 : 0;
    if (!capa[id].plan) { e.h = null; return anim.wait(0); }
    if (Math.abs(desde - hasta) < 1e-6) { aplicar(id, hasta); e.h = null; return anim.wait(0); }
    const dur = destino ? DUR_TRAZO[id] * (1 - desde) : Math.max(250, DUR_RETRAER * desde);
    const h = anim.tween({ dur, delay, ease: 'lin', aplicarInicio: false, onUpdate: (k) => aplicar(id, desde + (hasta - desde) * k) });
    e.h = h.activo ? h : null; h.onDone(() => { if (e.h === h) e.h = null; }); return h;
  }

  // Flujo animado (pulsos) de las capas visibles; prioridad 60 del reloj central.
  reloj.onTick((dt, ahora) => {
    for (const id of CAPAS) if (est[id].prog > 0) capa[id].flujo(ahora);
  }, 60);

  return {
    raiz,
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
      for (const id of lista) {
        if (plan && capa[id].plan !== plan) { est[id].h?.cancel(); capa[id].construir(plan); aplicar(id, 0); }
        hs.push(animarA(id, true, delay)); delay += SALTO[id];
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
