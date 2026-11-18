// FÁBRICA DE MOBILIARIO (frente mobiliario). Contrato: docs/design.md §5.
// Cada familia (familias/*.js) dibuja su mueble con el Constructor de piezas.js; aquí se arma el Fixture:
// piezas con pivote en la base, aparición escalonada (armar), inversa más rápida (desarmar) y horneado
// (una malla con colores por vértice + una sola LineSegments de aristas; el vidrio, si lo hay, es una malla aparte).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETA, MAT, mate, UMBRAL_ARISTA } from '../core/estilo.js';
import { FAMILIAS } from '../datos/catalogo.js';
import { crearAzar, hash32 } from '../core/azar.js';
import { Constructor, mezcla } from './piezas.js';
import { CONSTRUCTORES } from './familias/index.js';

/**
 * @typedef {'crece'|'cae'|'escala'|'desliza'|'despliega'} ModoAparicion
 *  crece: scale.y 0→1 · cae: baja 0.8 m (nace pequeño, asienta con aplastado) · escala: uniforme con rebote ·
 *  desliza: entra 0.6 m sobre x local · despliega: scale.x 0→1
 */
/** @typedef {{nombre:string, objeto:THREE.Group, orden:number, modo:ModoAparicion}} Pieza */
/**
 * @typedef {Object} Fixture
 * @property {string} id @property {string} familia @property {THREE.Group} grupo @property {Pieza[]} piezas
 * @property {{ancho:number, fondo:number, alto:number}} huella
 * @property {'desarmado'|'armando'|'armado'|'horneado'} estado @property {string} claveHorneado
 * @property {(op?:{delay?:number, ritmo?:number}) => any} armar @property {(op?:{delay?:number, ritmo?:number}) => any} desarmar
 * @property {() => void} hornear @property {() => void} deshornear @property {() => void} dispose
 */

/** Vidrio compartido (registrado en el grupo 'mob' para que atenúe con el resto del mobiliario). */
const MAT_VIDRIO = mate(PALETA.mob.cristal, 'mob', { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });

const planes = new Map();
const VARIANTES = 3;
const EASE_MODO = { crece: 'out', cae: 'back', escala: 'back', desliza: 'out', despliega: 'out' };

const trasladar = (g, p, k) => { const c = g.clone(); c.translate(k * p[0], k * p[1], k * p[2]); return c; };

/** Plan de un mueble: piezas con geometría relativa a su pivote, horneado y tiempos relativos. Cacheado por clave. */
function planDe(spec, clave) {
  let plan = planes.get(clave);
  if (plan) return plan;
  const fam = FAMILIAS[spec.familia], zona = fam?.zona ?? spec.zona, acento = PALETA.zona[zona] ?? PALETA.mob.metal;
  const P = PALETA.mob, paleta = P.mercancia.map((c) => mezcla(c, acento, 0.15));
  const ctx = {
    ancho: spec.ancho, fondo: spec.fondo, alto: spec.alto, tramos: spec.variante?.tramos ?? 1,
    rng: crearAzar(hash32(clave)), paleta, paletaRopa: [...paleta, P.tela, 0xe9e6e0, 0xc9b8a6], acento, zona,
  };
  const b = new Constructor();
  const f = CONSTRUCTORES[spec.familia];
  if (f) f(b, ctx);
  else { // familia desconocida: dos cajas (no debería ocurrir con el catálogo actual)
    b.caja(0, 0, 0, ctx.ancho, 0.1, ctx.fondo, P.oscuro); b.pieza('base', 0, 'crece');
    b.caja(0, 0.1, 0, ctx.ancho * 0.96, ctx.alto - 0.1, ctx.fondo * 0.96, acento); b.pieza('cuerpo', 1, 'cae');
  }
  const lista = b.lista;
  // tiempos relativos: orden lógico (orden, creación) con una pausa extra entre oleadas
  const idx = lista.map((p, i) => ({ p, i })).sort((a, c) => a.p.orden - c.p.orden || a.i - c.i);
  let onda = -1, ultimo = null, pos = 0;
  for (const { p } of idx) { if (p.orden !== ultimo) { onda++; ultimo = p.orden; } p.pos = pos++ + onda * 2; }
  const maxPos = Math.max(1, ...lista.map((p) => p.pos));
  let tris = 0, trisVidrio = 0;
  for (const p of lista) {
    p.f = p.pos / maxPos;
    p.edges = p.aristas ? new THREE.EdgesGeometry(p.geo, UMBRAL_ARISTA) : null;
    p.geoRel = p.geo ? trasladar(p.geo, p.pivot, -1) : null;
    p.edgesRel = p.edges ? trasladar(p.edges, p.pivot, -1) : null;
    p.vidrioRel = p.vidrio ? trasladar(p.vidrio, p.pivot, -1) : null;
    tris += (p.geo?.attributes.position.count ?? 0) / 3; trisVidrio += (p.vidrio?.attributes.position.count ?? 0) / 3;
  }
  const un = (xs) => (xs.length ? mergeGeometries(xs) : null);
  const bake = { geo: un(lista.filter((p) => p.geo).map((p) => p.geo)), edges: un(lista.filter((p) => p.edges).map((p) => p.edges)), vidrio: un(lista.filter((p) => p.vidrio).map((p) => p.vidrio)) };
  const box = new THREE.Box3();
  for (const g of [bake.geo, bake.vidrio]) if (g) { g.computeBoundingBox(); box.union(g.boundingBox); }
  plan = { piezas: lista, bake, tris, trisVidrio, box, T: Math.min(1500, Math.max(950, 700 + lista.length * 22)) };
  planes.set(clave, plan);
  return plan;
}

function claveDe(spec) {
  const t = spec.variante?.tramos ?? 1;
  return `${spec.familia}|t${t}|${spec.ancho}|${spec.fondo}|${spec.alto}|v${hash32(spec.id || '') % VARIANTES}`;
}

/**
 * Datos de geometría de un mueble (para banco de pruebas y pruebas de presupuesto).
 * @returns {{clave:string, tris:number, trisVidrio:number, piezas:number, min:number[], max:number[]}}
 */
export function resumenMueble(spec) {
  const clave = claveDe(spec), p = planDe(spec, clave);
  return { clave, tris: Math.round(p.tris), trisVidrio: Math.round(p.trisVidrio), piezas: p.piezas.length, min: p.box.min.toArray(), max: p.box.max.toArray() };
}

/** Estado de una pieza para un avance v (0 oculta … 1 completa; con rebote puede pasar de 1). */
function aplicar(pz, v) {
  const o = pz.objeto, [px, py, pzz] = pz._p.pivot, g = Math.min(1, Math.max(0, v) * 4), gs = Math.max(0.001, g * g * (3 - 2 * g));
  o.visible = v > 0.002; o.position.set(px, py, pzz);
  switch (pz.modo) {
    case 'crece': o.scale.set(1, Math.max(0.001, v), 1); break;
    case 'cae': { const u = Math.min(1, Math.max(0, v)); o.position.y = py + (1 - u) * 0.8; o.scale.set(gs, Math.max(0.001, gs * (1 - Math.max(0, v - 1) * 0.8)), gs); break; }
    case 'escala': o.scale.setScalar(Math.max(0.001, v)); break;
    case 'desliza': o.position.x = px + (1 - Math.min(1, Math.max(0, v))) * 0.6; o.scale.setScalar(gs); break;
    case 'despliega': o.scale.set(Math.max(0.001, v), 1, 1); break;
  }
}

/**
 * Crea un mueble a partir de un Mueble del layout.
 * @param {import('../gen/generador.js').Mueble} spec
 * @param {{anim:any}} ctx
 * @returns {Fixture}
 */
export function crearMueble(spec, { anim }) {
  const clave = claveDe(spec), plan = planDe(spec, clave);
  const grupo = new THREE.Group(); grupo.name = spec.id;
  const piezas = plan.piezas.map((p) => {
    const g = new THREE.Group(); g.name = p.nombre; g.position.set(p.pivot[0], p.pivot[1], p.pivot[2]); g.visible = false;
    if (p.geoRel) { const m = new THREE.Mesh(p.geoRel, MAT.mobVC); m.castShadow = true; m.receiveShadow = true; g.add(m); }
    if (p.edgesRel) { const l = new THREE.LineSegments(p.edgesRel, MAT.aristaMob); l.raycast = () => {}; g.add(l); }
    if (p.vidrioRel) { const v = new THREE.Mesh(p.vidrioRel, MAT_VIDRIO); v.renderOrder = 2; g.add(v); }
    grupo.add(g);
    return { nombre: p.nombre, objeto: g, orden: p.orden, modo: p.modo, _p: p };
  });
  let horneado = null, activos = [];
  const cancelar = () => { for (const h of activos) h.cancel(); activos = []; };

  const fx = {
    id: spec.id, familia: spec.familia, grupo, piezas, huella: { ancho: spec.ancho, fondo: spec.fondo, alto: spec.alto },
    estado: 'desarmado', claveHorneado: clave,
    armar({ delay = 0, ritmo = 1 } = {}) {
      cancelar(); fx.deshornear(); fx.estado = 'armando';
      const D = 400 * ritmo, span = Math.max(0, plan.T * ritmo - D);
      const hs = piezas.map((pz) => anim.tween({
        delay: delay + pz._p.f * span, dur: D * (pz.modo === 'cae' ? 1.2 : 1), ease: EASE_MODO[pz.modo], onUpdate: (e) => aplicar(pz, e),
      }));
      const h = anim.all(hs).onDone(() => { fx.estado = 'armado'; fx.hornear(); });
      activos = [h]; return h;
    },
    desarmar({ delay = 0, ritmo = 1 } = {}) {
      cancelar(); fx.deshornear(); fx.estado = 'armando';
      const D = 300 * ritmo, span = Math.max(0, Math.min(900, 520 + piezas.length * 8) * ritmo - D);
      const hs = piezas.map((pz) => anim.tween({
        delay: delay + (1 - pz._p.f) * span, dur: D, ease: 'in', aplicarInicio: false, onUpdate: (e) => aplicar(pz, 1 - e),
      }));
      const h = anim.all(hs).onDone(() => { fx.estado = 'desarmado'; });
      activos = [h]; return h;
    },
    hornear() {
      if (horneado) return;
      horneado = new THREE.Group(); horneado.name = 'horneado';
      if (plan.bake.geo) { const m = new THREE.Mesh(plan.bake.geo, MAT.mobVC); m.castShadow = true; m.receiveShadow = true; horneado.add(m); }
      if (plan.bake.edges) { const l = new THREE.LineSegments(plan.bake.edges, MAT.aristaMob); l.raycast = () => {}; horneado.add(l); }
      if (plan.bake.vidrio) { const v = new THREE.Mesh(plan.bake.vidrio, MAT_VIDRIO); v.renderOrder = 2; horneado.add(v); }
      grupo.add(horneado);
      for (const pz of piezas) pz.objeto.visible = false;
      fx.estado = 'horneado';
    },
    deshornear() {
      if (!horneado) return;
      grupo.remove(horneado); horneado = null;
      for (const pz of piezas) aplicar(pz, 1);
      fx.estado = 'armado';
    },
    dispose() { cancelar(); grupo.removeFromParent(); },
  };
  return fx;
}
