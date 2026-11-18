// Emparejamiento de identidad entre layouts: el mismo mueble (misma familia y medidas) conserva su id y viaja.
// Voraz por cercanía: todos los pares compatibles ordenados por distancia. Lógica pura.

const clave = (m) => `${m.familia}|${m.ancho}|${m.fondo}|${m.alto}`;

/**
 * Reasigna ids de `nuevos` para reutilizar los de `anteriores`. Muta y devuelve los cambios.
 * @param {any[]} anteriores
 * @param {any[]} nuevos
 * @returns {{movidos:string[], quietos:string[], nuevos:string[], retirados:string[]}}
 */
export function emparejar(anteriores, nuevos) {
  const pares = [];
  const porClave = new Map();
  anteriores.forEach((a, i) => { const k = clave(a); if (!porClave.has(k)) porClave.set(k, []); porClave.get(k).push(i); });
  nuevos.forEach((n, j) => { for (const i of porClave.get(clave(n)) || []) pares.push([Math.hypot(anteriores[i].x - n.x, anteriores[i].z - n.z), i, j]); });
  pares.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const usadoA = new Set(), usadoN = new Set(), asign = new Map();
  for (const [, i, j] of pares) { if (usadoA.has(i) || usadoN.has(j)) continue; usadoA.add(i); usadoN.add(j); asign.set(j, anteriores[i]); }
  const ocupados = new Set(anteriores.map((a) => a.id));
  const cont = {};
  for (const id of ocupados) { const [f, n] = id.split('#'); cont[f] = Math.max(cont[f] || 0, +n || 0); }
  const res = { movidos: [], quietos: [], nuevos: [], retirados: [] };
  nuevos.forEach((n, j) => {
    const a = asign.get(j);
    if (a) { n.id = a.id; (Math.hypot(a.x - n.x, a.z - n.z) > 0.01 || a.rot !== n.rot ? res.movidos : res.quietos).push(n.id); }
    else { const k = (cont[n.familia] = (cont[n.familia] || 0) + 1); n.id = `${n.familia}#${String(k).padStart(2, '0')}`; res.nuevos.push(n.id); }
  });
  anteriores.forEach((a, i) => { if (!usadoA.has(i)) res.retirados.push(a.id); });
  return res;
}
