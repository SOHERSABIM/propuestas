// Capa de REFRIGERACIÓN: condensadoras (serpentín, ventiladores, base) y, por cada equipo frío, el par de tuberías
// (línea de líquido delgada y línea de succión aislada) con tramos, abrazaderas, codos, válvulas de esfera y
// soportes tipo trapecio. 7 llamadas de dibujo. La tubería avanza tramo a tramo desde la condensadora hasta el equipo.
import * as THREE from 'three';
import * as G from './geo.js';
import { crearLote, crearPulsos } from './kit.js';
import { ventana, alcanceRed } from './tiempos.js';

const GEO = { tubo: G.geoTubo, codoTubo: G.geoCodoTubo, valvula: G.geoValvula, soporte: G.geoSoporte, cond: G.geoCond, ventilador: G.geoVentilador };
const ORDEN = ['soporte', 'tubo', 'codoTubo', 'valvula', 'cond', 'ventilador'];

export function crearCapaFrio() {
  const grupo = new THREE.Group(); grupo.name = 'capa-frio'; grupo.visible = false;
  const matLam = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const matBas = new THREE.MeshBasicMaterial({ color: 0xffffff });
  let lotes = [], pulsos = null, plan = null, pAct = 0, dMax = 1, fan = null;

  function construir(p) {
    liberar(); plan = p; const F = p.frio; dMax = F.dMax; pAct = 0;
    for (const q of F.piezas) {
      const [t0, dur] = ventana('frio', q.ph, (q.d ?? 0) / dMax, q.k ?? 0); q.t0 = t0; q.dur = dur;
      if (q.t === 'cond') q.c = 0xddd6ee; else if (q.t === 'soporte' || q.t === 'ventilador') q.c = 0xffffff;
      if (q.t === 'ventilador') q.gira = true;
    }
    for (const t of ORDEN) {
      const pz = F.piezas.filter((q) => q.t === t); if (!pz.length) continue;
      const lote = crearLote(GEO[t](), matLam, pz); lotes.push(lote); grupo.add(lote.mesh); if (t === 'ventilador') fan = lote;
    }
    // líquido baja de la condensadora al equipo; la succión sube (sentido inverso)
    pulsos = crearPulsos(F.rutas.map((r) => ({ ...r, dir: r.tipo === 'liquido' ? 1 : -1, color: 0xf4eeff })), { cada: 1.6, tam: 0.07, vel: 1.0, dy: 0.0 }, matBas);
    if (pulsos.n) grupo.add(pulsos.mesh);
    actualizar(0, true);
  }
  function liberar() { for (const c of [...grupo.children]) { grupo.remove(c); c.dispose?.(); } lotes = []; pulsos = null; fan = null; }
  function actualizar(p, forzar = false) { pAct = p; for (const l of lotes) l.actualizar(p, forzar); }
  return {
    grupo, get plan() { return plan; }, construir, actualizar,
    flujo(ahora) {
      if (!grupo.visible || !plan) return;
      fan?.girar(ahora * 0.012);
      if (pulsos?.n) pulsos.actualizar(ahora, alcanceRed('frio', pAct) * dMax);
    },
    llamadas: () => grupo.children.length,
  };
}
