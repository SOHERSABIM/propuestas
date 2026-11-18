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
 * @param {import('../datos/locales.js').Local} local
 * @param {{semilla:number, anterior?:Layout|null, candidatos?:number}} op
 * @returns {Layout}
 */
export function generarLayout(local, { semilla, anterior = null, candidatos = N_CANDIDATOS } = { semilla: 1 }) {
  const descartes = {}; const validos = []; const muestras = [];
  for (let i = 0; i < candidatos; i++) {
    const az = crearAzar(hash32(`${local.id}:${semilla}:${i}`));
    const c = construirCandidato(local, az);
    if (c.error) { descartes[c.error] = (descartes[c.error] || 0) + 1; continue; }
    const v = validar(local, c);
    const ind = indicadores(local, c);
    const cal = calificar(local, c, ind);
    if (muestras.length < 14) muestras.push({ indice: i, valido: v.ok, total: cal.total, zonas: c.zonas.map((z) => ({ id: z.id, rects: z.rects })) });
    if (!v.ok) { for (const [k, n] of Object.entries(v.conteo)) if (n) descartes[k] = (descartes[k] || 0) + 1; continue; }
    validos.push({ i, c, v, ind, cal });
  }
  if (!validos.length) throw new Error(`sin candidatos válidos (${local.id}, semilla ${semilla})`);
  validos.sort((a, b) => b.cal.total - a.cal.total || a.i - b.i);
  const mismoLocal = anterior && anterior.localId === local.id;
  let elegido = validos[0];
  if (mismoLocal) elegido = validos.find((x) => distancia(x.c.firma, anterior.firma) >= 2) || validos.find((x) => distancia(x.c.firma, anterior.firma) >= 1) || validos[0];
  const { c, v, ind, cal, i } = elegido;
  const cambios = anterior ? emparejar(anterior.muebles, c.muebles) : null;
  return {
    id: `L-${local.id}-${semilla}-${i}`, localId: local.id, semilla, candidato: i, firma: c.firma,
    zonas: c.zonas, muros: c.muros, puertas: c.puertas, cuartos: c.cuartos, muebles: c.muebles, pasillos: c.pasillos,
    equiposFrios: c.muebles.filter((m) => m.frio).map((m) => m.id),
    indicadores: ind, calificacion: cal, validacion: v,
    candidatos: { evaluados: candidatos, validos: validos.length, descartes, muestras },
    cambios,
  };
}
