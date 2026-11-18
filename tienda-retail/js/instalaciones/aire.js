// Capa de AIRE ACONDICIONADO: unidades paquete en azotea, bajantes, ducto principal y ramales hechos de tramos con
// bridas, tés, codos, reducciones y compuertas; soportería de varilla y perfil; difusores con conexión flexible y
// rejillas de retorno. Un InstancedMesh por tipo de componente (14 llamadas de dibujo). La aparición sigue la red:
// primero la soportería, luego tramo por tramo desde la unidad hacia los extremos y al final los terminales.
import * as THREE from 'three';
import * as G from './geo.js';
import { crearLote } from './kit.js';
import { H_BANC } from './util.js';
import { ventana, alcanceRed } from './tiempos.js';

const COL = { principal: 0x4d8dbd, ramal: 0x68a0c9, bajante: 0x3d77a3, unidad: 0xffffff, ventilador: 0xffffff, difusor: 0xe6f1fa, flex: 0xffffff, retorno: 0xa5c3da, soporte: 0xffffff, pulso: 0xe3f3ff };
const GEO = { tramo: G.geoTramo, codo: G.geoCodo, teeR: G.geoTeeR, teeP: G.geoTeeP, reduccion: G.geoReduccion, compuerta: G.geoCompuerta, soporte: G.geoSoporte, difusor: G.geoDifusor, flex: G.geoFlex, retorno: G.geoRetorno, bajante: G.geoBajante, unidad: G.geoUnidad, bancada: () => G.geoBancada(2.4, 1.6, H_BANC), cuello: G.geoCuelloAire, ventilador: G.geoVentilador };
const ORDEN = ['soporte', 'tramo', 'teeR', 'teeP', 'codo', 'reduccion', 'compuerta', 'bajante', 'flex', 'difusor', 'retorno', 'bancada', 'cuello', 'unidad', 'ventilador'];

function colorDe(p) {
  if (p.c != null) return p.c;
  if (p.t === 'tramo') return p.rol === 'ramal' ? COL.ramal : COL.principal;
  if (p.t === 'teeR' || p.t === 'teeP') return COL.principal;
  if (p.t === 'codo' || p.t === 'reduccion' || p.t === 'compuerta') return COL.ramal;
  return COL[p.t] ?? 0xffffff;
}

export function crearCapaAire() {
  const grupo = new THREE.Group(); grupo.name = 'capa-aire'; grupo.visible = false;
  const matLam = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  let lotes = [], pulsos = null, plan = null, pAct = 0, dMax = 1, fan = null;

  function construir(p) {
    liberar(); plan = p; const A = p.aire; dMax = A.dMax; pAct = 0;
    for (const q of A.piezas) {
      const [t0, dur] = ventana('aire', q.ph, (q.d ?? 0) / dMax, q.k ?? 0); q.t0 = t0; q.dur = dur;
      q.c = colorDe(q); if (q.t === 'ventilador') q.gira = true;
    }
    for (const t of ORDEN) {
      const pz = A.piezas.filter((q) => q.t === t); if (!pz.length) continue;
      const lote = crearLote(GEO[t](), matLam, pz); lotes.push(lote); grupo.add(lote.mesh); if (t === 'ventilador') fan = lote;
    }
    // sin cubos de flujo sobre los ductos (se leían como piezas sueltas): el movimiento lo dan los ventiladores
    actualizar(0, true);
  }
  function liberar() { for (const c of [...grupo.children]) { grupo.remove(c); c.dispose?.(); } lotes = []; pulsos = null; fan = null; }
  function actualizar(p, forzar = false) { pAct = p; for (const l of lotes) l.actualizar(p, forzar); }
  return {
    grupo, get plan() { return plan; }, construir, actualizar,
    flujo(ahora) {
      if (!grupo.visible || !plan) return;
      fan?.girar(ahora * 0.012);
      pulsos?.actualizar(ahora, alcanceRed('aire', pAct) * dMax);
    },
    llamadas: () => grupo.children.length,
  };
}
