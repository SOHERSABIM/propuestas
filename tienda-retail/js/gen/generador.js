// Generador de layouts (diseño generativo). Lógica pura (sin three), probado en node (tests/gen.test.mjs).
// Por solicitud: genera N candidatos con semillas derivadas, descarta inválidos (validación independiente),
// califica los válidos y elige el mejor que sea visiblemente distinto del layout anterior.
import { crearAzar, hash32 } from '../core/azar.js';
import { construirCandidato } from './candidato.js';
import { validar, calificar, indicadores } from './evaluacion.js';
import { emparejar } from './emparejar.js';

/**
 * @typedef {import('../datos/catalogo.js').ZonaId} ZonaId
 * @typedef {{x0:number,z0:number,x1:number,z1:number}} Rect
 * @typedef {{id:ZonaId, rects:Rect[], poligono:[number,number][], area:number}} Zona
 * @typedef {{id:string, a:[number,number], b:[number,number], espesor:number, altura:number, tipo:'interior'|'cancel'}} Muro
 * @typedef {{id:string, muro:string, centro:number, ancho:number, alto:number, tipo:'abatible'|'vano'|'cortina'}} Puerta
 * @typedef {{id:'oficina'|'sanitarios'|'maquinas', nombre:string, rect:[number,number,number,number]}} Cuarto
 * @typedef {{id:string, familia:string, zona:ZonaId, x:number, z:number, rot:number, ancho:number, fondo:number, alto:number,
 *   variante:{tramos?:number, [k:string]:any}, frio?:{conexion:[number,number,number], carga:number}}} Mueble
 * @typedef {{id:string, tipo:'principal'|'secundario'|'entre_gondolas'|'ropa'|'servicio'|'bodega'|'caja', ancho:number, puntos:[number,number][]}} Pasillo
 * @typedef {{id:string, nombre:string, valor:number, unidad:string, puntos:number, peso:number}} Criterio
 * @typedef {Object} Layout
 * @property {string} id
 * @property {'A'|'B'|'C'} localId
 * @property {number} semilla
 * @property {number} candidato         índice del candidato elegido
 * @property {Object} firma             decisiones visibles (orientación, lados, trastienda)
 * @property {Zona[]} zonas
 * @property {Muro[]} muros
 * @property {Puerta[]} puertas
 * @property {Cuarto[]} cuartos
 * @property {Mueble[]} muebles
 * @property {Pasillo[]} pasillos
 * @property {string[]} equiposFrios
 * @property {Object} indicadores
 * @property {{total:number, criterios:Criterio[]}} calificacion
 * @property {{ok:boolean, errores:string[], conteo:Object}} validacion
 * @property {{evaluados:number, validos:number, descartes:Record<string,number>, muestras:{indice:number, valido:boolean, total:number, zonas:{id:string, rects:Rect[]}[]}[]}} candidatos
 * @property {{movidos:string[], quietos:string[], nuevos:string[], retirados:string[]}|null} cambios
 * @property {{posicion:number, de:number, maximo:number, minimo:number}} ranking  lugar entre los válidos (1 = mejor)
 * @property {boolean} esMejor   es el de mayor calificación de los evaluados
 * @property {'base'|'mejor'|'siguiente'} modo
 */

const N_CANDIDATOS = 32;

function distancia(a, b) {
  if (!a || !b) return 9;
  let d = 0;
  for (const k of ['orient', 'ladoRopa', 'ladoCajas', 'parcial', 'ladoFrio']) if (a[k] !== b[k]) d++;
  if (Math.abs(a.dt - b.dt) > 1.2) d++;
  return d;
}

/**
 * Evaluación incremental de los candidatos de un local y una semilla. Se puede avanzar de a poco (paso(k)) para
 * repartir el cálculo en varios cuadros, o de golpe (terminar()). El resultado es determinista.
 * @param {import('../datos/locales.js').Local} local
 * @param {number} semilla
 * @param {number} [n]
 */
export function crearEvaluacion(local, semilla, n = N_CANDIDATOS) {
  const ev = {
    local, semilla, n, i: 0, descartes: {}, validos: [], muestras: [],
    get terminado() { return ev.i >= n; },
    /** Evalúa hasta k candidatos más. */
    paso(k = 1) {
      for (let t = 0; t < k && ev.i < n; t++, ev.i++) {
        const i = ev.i;
        const c = construirCandidato(local, crearAzar(hash32(`${local.id}:${semilla}:${i}`)));
        if (c.error) { ev.descartes[c.error] = (ev.descartes[c.error] || 0) + 1; continue; }
        const v = validar(local, c), ind = indicadores(local, c), cal = calificar(local, c, ind);
        if (ev.muestras.length < 14) ev.muestras.push({ indice: i, valido: v.ok, total: cal.total, zonas: c.zonas.map((z) => ({ id: z.id, rects: z.rects })) });
        if (!v.ok) { for (const [k2, m] of Object.entries(v.conteo)) if (m) ev.descartes[k2] = (ev.descartes[k2] || 0) + 1; continue; }
        ev.validos.push({ i, c, v, ind, cal });
      }
      return ev;
    },
    terminar() { return ev.paso(n); },
  };
  return ev;
}

/**
 * Compone un Layout a partir de una evaluación terminada.
 * modo 'base': candidato válido de calificación modesta (percentil 30 de los válidos, determinista).
 * modo 'mejor': el de mayor calificación. modo 'siguiente': el mejor aún no mostrado (vistos) que sea visiblemente
 * distinto del anterior (≥ 2 decisiones de la firma; si no hay, ≥ 1; si no, el mejor no visto).
 * @param {ReturnType<typeof crearEvaluacion>} ev
 * @param {{modo?:'base'|'mejor'|'siguiente', anterior?:Layout|null, vistos?:number[]}} op
 * @returns {Layout}
 */
export function componerLayout(ev, { modo = 'mejor', anterior = null, vistos = [] } = {}) {
  if (!ev.terminado) ev.terminar();
  const { local, semilla } = ev;
  if (!ev.validos.length) throw new Error(`sin candidatos válidos (${local.id}, semilla ${semilla})`);
  const desc = ev.validos.slice().sort((a, b) => b.cal.total - a.cal.total || a.i - b.i);
  let elegido;
  if (modo === 'base') elegido = desc[desc.length - 1 - Math.round(0.3 * (desc.length - 1))];
  else if (modo === 'mejor') elegido = desc[0];
  else {
    const libres = desc.filter((x) => !vistos.includes(x.i));
    const f = anterior?.firma;
    elegido = libres.find((x) => distancia(x.c.firma, f) >= 2) || libres.find((x) => distancia(x.c.firma, f) >= 1) || libres[0]
      || desc.find((x) => x.i !== anterior?.candidato) || desc[0];
  }
  const { v, ind, cal, i } = elegido;
  // copia: la misma evaluación puede componer varios layouts y el emparejamiento reescribe ids
  const c = JSON.parse(JSON.stringify(elegido.c));
  const cambios = anterior ? emparejar(anterior.muebles, c.muebles) : null;
  return {
    id: `L-${local.id}-${semilla}-${i}`, localId: local.id, semilla, candidato: i, firma: c.firma,
    zonas: c.zonas, muros: c.muros, puertas: c.puertas, cuartos: c.cuartos, muebles: c.muebles, pasillos: c.pasillos,
    equiposFrios: c.muebles.filter((m) => m.frio).map((m) => m.id),
    indicadores: { ...ind }, calificacion: cal, validacion: v,
    candidatos: { evaluados: ev.n, validos: desc.length, descartes: { ...ev.descartes }, muestras: ev.muestras },
    ranking: { posicion: desc.indexOf(elegido) + 1, de: desc.length, maximo: desc[0].cal.total, minimo: desc[desc.length - 1].cal.total },
    esMejor: cal.total >= desc[0].cal.total, modo,
    cambios,
  };
}

/**
 * Atajo: evalúa y compone en una sola llamada.
 * @param {import('../datos/locales.js').Local} local
 * @param {{semilla:number, anterior?:Layout|null, candidatos?:number, modo?:'base'|'mejor'|'siguiente', vistos?:number[]}} op
 * @returns {Layout}
 */
export function generarLayout(local, { semilla, anterior = null, candidatos = N_CANDIDATOS, modo = 'mejor', vistos = [] } = { semilla: 1 }) {
  return componerLayout(crearEvaluacion(local, semilla, candidatos), { modo, anterior, vistos });
}

/** Índice del candidato de mayor calificación de una evaluación (la termina si hace falta). */
export function mejorIndice(ev) {
  if (!ev.terminado) ev.terminar();
  return ev.validos.slice().sort((a, b) => b.cal.total - a.cal.total || a.i - b.i)[0]?.i ?? -1;
}
