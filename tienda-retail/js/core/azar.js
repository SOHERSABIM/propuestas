// Generador pseudoaleatorio con semilla (mulberry32). Lógica pura: sin three, usable en node.
// Regla del proyecto: NUNCA Math.random(). Todo azar sale de aquí.

/**
 * Crea un generador determinista.
 * @param {number} semilla entero de 32 bits
 * @returns {{r:()=>number, rango:(a:number,b:number)=>number, entero:(a:number,b:number)=>number,
 *   elegir:<T>(arr:T[])=>T, elegirPeso:<T>(arr:T[], peso:(x:T)=>number)=>T, barajar:<T>(arr:T[])=>T[],
 *   hijo:(etiqueta:string|number)=>ReturnType<typeof crearAzar>, semilla:number}}
 */
export function crearAzar(semilla) {
  let a = (semilla >>> 0) || 0x9e3779b9;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const api = {
    semilla: semilla >>> 0,
    r,
    rango: (lo, hi) => lo + (hi - lo) * r(),
    entero: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)), // ambos incluidos
    elegir: (arr) => arr[Math.floor(r() * arr.length)],
    elegirPeso(arr, peso) {
      let s = 0; for (const x of arr) s += peso(x);
      let u = r() * s;
      for (const x of arr) { u -= peso(x); if (u <= 0) return x; }
      return arr[arr.length - 1];
    },
    barajar(arr) {
      const b = arr.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      return b;
    },
    /** Sub-generador independiente y estable (no consume del padre). */
    hijo: (etiqueta) => crearAzar(hash32(`${semilla}:${etiqueta}`)),
  };
  return api;
}

/** Hash de cadena a entero de 32 bits (FNV-1a). */
export function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
