// Parámetros de URL (lógica pura salvo la lectura de location). Ver design.md §6.
/**
 * @typedef {Object} Params
 * @property {boolean} relojManual  ?reloj=manual
 * @property {boolean} sinInterfaz  ?ui=0
 * @property {boolean} auto         ?auto=1  reproducción automática
 * @property {number}  semilla      ?semilla=1234 (default 2026)
 * @property {'A'|'B'|'C'} local    ?local=A
 * @property {number|null} paso     ?paso=3 ir directo (instantáneo) a ese paso al arrancar
 * @property {number}  vel          ?vel=1 velocidad del reloj (0.25 a 4)
 * @property {boolean} rotulos      ?rotulos=0 apaga rótulos
 * @property {number}  duracion     ?duracion=90 duración de la reproducción automática en s (45 a 150)
 */
/** @returns {Params} */
export function leerParams(search = (typeof location !== 'undefined' ? location.search : '')) {
  const q = new URLSearchParams(search);
  const num = (k, d) => (q.has(k) && Number.isFinite(+q.get(k)) ? +q.get(k) : d);
  const loc = (q.get('local') || 'A').toUpperCase();
  return {
    relojManual: q.get('reloj') === 'manual',
    sinInterfaz: q.get('ui') === '0',
    auto: q.get('auto') === '1',
    semilla: Math.floor(num('semilla', 2026)) >>> 0,
    local: /** @type {any} */ (['A', 'B', 'C'].includes(loc) ? loc : 'A'),
    paso: q.has('paso') ? Math.floor(num('paso', 1)) : null,
    vel: num('vel', 1),
    rotulos: q.get('rotulos') !== '0',
    duracion: Math.max(45, Math.min(150, num('duracion', 90))),
  };
}
