// Emisor de eventos mínimo. Lógica pura.

/** @returns {{on:(ev:string, fn:Function)=>()=>void, off:(ev:string, fn:Function)=>void, emit:(ev:string, data?:any)=>void}} */
export function crearEmisor() {
  const m = new Map();
  return {
    on(ev, fn) { if (!m.has(ev)) m.set(ev, new Set()); m.get(ev).add(fn); return () => this.off(ev, fn); },
    off(ev, fn) { m.get(ev)?.delete(fn); },
    emit(ev, data) { for (const fn of [...(m.get(ev) || [])]) fn(data); },
  };
}
