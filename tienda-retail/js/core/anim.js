// Sistema de animación sobre el reloj central. Lógica pura (no importa three).
// Una "interpolación" (tween) llama onUpdate(e, k) en cada cuadro con k = avance lineal 0..1 y e = curva(k).
// Todo regresa un Handle: { done: Promise, onDone(cb), cancel(), finish(), get activo }.
// Regla: dentro de una animación se encadena con `delay` calculado de antemano o con onDone (síncrono,
// determinista). `await handle.done` solo en orquestación (pasos de la demo).

/** Curvas estándar con nombre. Úsense por nombre: ease: 'io'. */
export const EASE = {
  lin: (t) => t,
  in: (t) => t * t * t,                                   // retirar, hundir
  out: (t) => 1 - Math.pow(1 - t, 3),                     // aparecer, elevar
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // traslados, cámara
  outQuint: (t) => 1 - Math.pow(1 - t, 5),                // trazos de instalaciones, conteos
  back: (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }, // asentar con rebote
  anticip: (t) => { const c1 = 1.4, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; }, // anticipación (baja antes de subir)
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),          // respiraciones, órbita
};

/** @typedef {{done:Promise<void>, onDone:(cb:()=>void)=>Handle, cancel:()=>void, finish:()=>void, readonly activo:boolean}} Handle */

/**
 * @param {ReturnType<import('./reloj.js').crearReloj>} reloj
 */
export function crearAnim(reloj) {
  const activos = new Set();
  let instantaneo = 0; // >0: todo se resuelve al instante (para ir a un paso sin animar)

  function crearHandle() {
    let resolver; const cbs = [];
    let vivo = true;
    const h = {
      done: new Promise((r) => (resolver = r)),
      onDone(cb) { if (!vivo) cb(); else cbs.push(cb); return h; },
      get activo() { return vivo; },
      cancel() { h._cerrar(false); },
      finish() { h._cerrar(true); },
      _cerrar(completo) {
        if (!vivo) return; vivo = false;
        h._alCerrar?.(completo);
        for (const cb of cbs.splice(0)) cb();
        resolver();
      },
    };
    return h;
  }

  /**
   * Interpolación sobre el reloj.
   * @param {{dur?:number, delay?:number, ease?:keyof EASE|((t:number)=>number), onStart?:()=>void,
   *   onUpdate?:(e:number,k:number)=>void, onDone?:()=>void, aplicarInicio?:boolean}} o
   *   aplicarInicio (default true): llama onUpdate(curva(0),0) al crear, para que el objeto quede en su
   *   estado inicial durante el delay (p. ej. pieza oculta antes de su turno).
   * @returns {Handle}
   */
  function tween(o) {
    const ease = typeof o.ease === 'function' ? o.ease : EASE[o.ease || 'io'];
    const dur = instantaneo ? 0 : Math.max(0, o.dur ?? 500);
    const delay = instantaneo ? 0 : Math.max(0, o.delay ?? 0);
    const h = crearHandle();
    const t0 = reloj.ahora + delay;
    let iniciado = false;
    const paso = (ahora) => {
      if (ahora < t0) return false;
      if (!iniciado) { iniciado = true; o.onStart?.(); }
      const k = dur <= 0 ? 1 : Math.min(1, (ahora - t0) / dur);
      o.onUpdate?.(k >= 1 ? ease(1) : ease(k), k);
      return k >= 1;
    };
    h._paso = paso;
    h._alCerrar = (completo) => {
      activos.delete(h);
      if (completo) {
        if (!iniciado) { iniciado = true; o.onStart?.(); }
        o.onUpdate?.(ease(1), 1); o.onDone?.();
      }
    };
    if (o.aplicarInicio !== false) o.onUpdate?.(ease(0), 0);
    if (dur <= 0 && delay <= 0) { h.finish(); return h; }
    activos.add(h);
    reloj.pedirCuadro();
    return h;
  }

  function actualizar(_dt, ahora) {
    for (const h of [...activos]) if (h._paso(ahora)) h.finish();
  }
  reloj.onTick(actualizar, 0);

  /** Espera ms en tiempo de reloj. */
  const wait = (ms) => tween({ dur: 0, delay: ms, aplicarInicio: false });

  /** Handle que termina cuando terminan todos. */
  function all(handles) {
    const h = crearHandle();
    const lista = handles.filter(Boolean);
    let falta = lista.length;
    if (!falta) { h.finish(); return h; }
    h._alCerrar = (completo) => { if (completo) lista.forEach((x) => x.finish()); else lista.forEach((x) => x.cancel()); };
    lista.forEach((x) => x.onDone(() => { if (--falta === 0) h.finish(); }));
    return h;
  }

  /**
   * Escalonado: llama fn(item, i, retardo) con retardo = delay + min(max, i*cada) tras ordenar.
   * fn debe devolver un Handle (o nada).
   * @template T
   * @param {T[]} items
   * @param {{cada?:number, max?:number, delay?:number, orden?:(a:T,b:T)=>number}} o
   * @param {(item:T, i:number, retardo:number)=>Handle|void} fn
   */
  function stagger(items, o, fn) {
    const lista = o.orden ? items.slice().sort(o.orden) : items;
    const cada = o.cada ?? 60, max = o.max ?? Infinity, base = o.delay ?? 0;
    return all(lista.map((it, i) => fn(it, i, base + Math.min(max, i * cada))));
  }

  /**
   * Secuencia: cada elemento es una función que devuelve Handle; arranca la siguiente al terminar la anterior
   * (síncrono, mismo cuadro). Un número en la lista es una pausa en ms.
   * @param {(Array<(()=>Handle|void)|number>)} pasos
   */
  function seq(pasos) {
    const h = crearHandle();
    let actual = null, i = 0;
    const sig = () => {
      if (!h.activo) return;
      if (i >= pasos.length) { h.finish(); return; }
      const p = pasos[i++];
      actual = typeof p === 'number' ? wait(p) : (p() || wait(0));
      actual.onDone(sig);
    };
    h._alCerrar = (completo) => { if (!completo) actual?.cancel(); };
    sig();
    return h;
  }

  /** Ejecuta fn con todas las interpolaciones instantáneas (para ir a un paso sin animar). */
  function instantaneamente(fn) { instantaneo++; try { return fn(); } finally { instantaneo--; } }

  /** Termina de golpe todo lo activo (solo para reinicios de emergencia). */
  function terminarTodo() { for (const h of [...activos]) h.finish(); }

  return {
    EASE, tween, wait, all, stagger, seq, instantaneamente, terminarTodo,
    get activos() { return activos.size; },
    get instantaneo() { return instantaneo > 0; },
    /** Interpolación lineal y utilidades de mezcla */
    lerp: (a, b, t) => a + (b - a) * t,
  };
}
