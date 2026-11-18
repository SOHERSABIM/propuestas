// Capa de AIRE ACONDICIONADO: unidades paquete en azotea, bajantes, ducto principal y ramales hechos de tramos con
// bridas, tés, codos, reducciones y compuertas; soportería de varilla y perfil; difusores con conexión flexible y
// rejillas de retorno. Un InstancedMesh por tipo de componente (14 llamadas de dibujo). La aparición sigue la red:
// primero la soportería, luego tramo por tramo desde la unidad hacia los extremos y al final los terminales.
import * as THREE from 'three';
import * as G from './geo.js';
import { crearLote, crearPulsos } from './kit.js';
import { ventana, alcanceRed } from './tiempos.js';

const COL = { principal: 0x2b8fd6, ramal: 0x4aa3e8, bajante: 0x2477b4, unidad: 0xd4e6f4, ventilador: 0xffffff, difusor: 0xe6f1fa, flex: 0xffffff, retorno: 0x9cc9ee, soporte: 0xffffff, pulso: 0xe3f3ff };
const GEO = { tramo: G.geoTramo, codo: G.geoCodo, teeR: G.geoTeeR, teeP: G.geoTeeP, reduccion: G.geoReduccion, compuerta: G.geoCompuerta, soporte: G.geoSoporte, difusor: G.geoDifusor, flex: G.geoFlex, retorno: G.geoRetorno, bajante: G.geoBajante, unidad: G.geoUnidad, ventilador: G.geoVentilador };
const ORDEN = ['soporte', 'tramo', 'teeR', 'teeP', 'codo', 'reduccion', 'compuerta', 'bajante', 'flex', 'difusor', 'retorno', 'unidad', 'ventilador'];

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
  const matBas = new THREE.MeshBasicMaterial({ color: 0xffffff });
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
    pulsos = crearPulsos(A.rutas.map((r) => ({ ...r, dir: 1, color: COL.pulso })), { cada: 2.6, tam: 0.15, vel: 1.4, dy: 0.27 }, matBas);
    grupo.add(pulsos.mesh); actualizar(0, true);
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
