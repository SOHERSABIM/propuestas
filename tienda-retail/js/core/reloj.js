// Reloj central. TODA animación cuelga de aquí (nada de setTimeout, Date.now ni performance.now).
// Modo real: avanza con la marca de tiempo de requestAnimationFrame (delta acotado a 100 ms).
// Modo manual (?reloj=manual): el tiempo solo avanza con advance(ms); así las capturas son deterministas.

const PASO_MS = 1000 / 60;

/**
 * @param {{manual?:boolean}} op
 */
export function crearReloj({ manual = false } = {}) {
  /** @type {{fn:(dt:number, ahora:number)=>void, prio:number}[]} */
  const subs = [];
  let ahora = 0, velocidad = 1, ultimo = null, render = null, pedido = true, corriendo = false;

  function tick(dt) {
    dt *= velocidad;
    ahora += dt;
    for (const s of subs.slice()) s.fn(dt, ahora);
  }
  async function vaciarMicrotareas() { for (let i = 0; i < 24; i++) await null; }

  const reloj = {
    manual,
    /** Tiempo simulado en ms desde el arranque. */
    get ahora() { return ahora; },
    get velocidad() { return velocidad; },
    set velocidad(v) { velocidad = Math.max(0.1, Math.min(4, v)); },
    /**
     * Suscribe una función por cuadro. prio menor corre antes (anim = 0, cámara = 50, instalaciones = 60).
     * @returns {()=>void} cancelar
     */
    onTick(fn, prio = 100) {
      const s = { fn, prio }; subs.push(s); subs.sort((a, b) => a.prio - b.prio);
      return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); };
    },
    /** Pide un cuadro (en modo manual dibuja en el siguiente rAF sin avanzar el tiempo). */
    pedirCuadro() { pedido = true; },
    /** Arranca el bucle. renderFn dibuja la escena. */
    iniciar(renderFn) {
      render = renderFn; if (corriendo) return; corriendo = true;
      const bucle = (ts) => {
        requestAnimationFrame(bucle);
        if (!manual) {
          const dt = ultimo == null ? PASO_MS : Math.min(100, Math.max(0, ts - ultimo));
          ultimo = ts; tick(dt); render();
        } else if (pedido) { pedido = false; render(); }
      };
      requestAnimationFrame(bucle);
    },
    /**
     * Avanza el reloj ms milisegundos en subpasos de 1/60 s y dibuja al final.
     * Entre subpasos vacía microtareas para que las continuaciones `await handle.done` arranquen
     * en el mismo subpaso, igual que en modo real.
     * Solo tiene efecto en modo manual (en modo real devuelve sin hacer nada).
     */
    async advance(ms) {
      if (!manual) return ahora;
      let resta = ms;
      while (resta > 1e-6) { const dt = Math.min(PASO_MS, resta); resta -= dt; tick(dt); await vaciarMicrotareas(); }
      render?.();
      return ahora;
    },
  };
  return reloj;
}
