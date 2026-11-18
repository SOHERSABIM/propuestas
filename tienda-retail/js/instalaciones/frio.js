// Capa de REFRIGERACIÓN. Condensadoras que crecen en cubierta; desde cada equipo frío sube un par de líneas
// (líquido y succión) hasta 4.10 m, corre ortogonal y sube a su condensadora. Pulsos de flujo en sentidos opuestos.
// 3 llamadas de dibujo: cajas (líneas y condensadoras), ventiladores, pulsos.
import * as THREE from 'three';
import { EASE } from '../core/anim.js';
import { PALETA } from '../core/estilo.js';
import { GEO_CAJA, GEO_FAN, crearLote, poner, colorear, marcar, liberar, crearTrayecto, escribirTrayecto, crearPulsos } from './trazo.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// Grosor visual de las líneas: mayor que el diámetro real (0.05 m) para que se lean en video a 1080p.
const GROSOR = 0.085;
const C = { liquido: PALETA.capa.frio, succion: 0xb48ced, cond: 0xd6c9f3, ventilador: 0x5a3a9a, pulso: 0xf4eeff };

export function crearCapaFrio() {
  const grupo = new THREE.Group(); grupo.name = 'capa-frio'; grupo.visible = false;
  const matLam = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const matBas = new THREE.MeshBasicMaterial({ color: 0xffffff });
  let cajas = null, fans = null, pulsos = null, plan = null, ultimoP = -1, tr = [], conds = [], nBase = 0;

  function construir(p) {
    liberar(grupo); plan = p; ultimoP = -1; const F = p.frio; conds = F.condensadoras;
    const m = F.lineas.length / 2 || 1; let n = 0;
    tr = F.lineas.map((l, i) => {
      const o = { t: crearTrayecto(l.puntos, GROSOR, GROSOR), tipo: l.tipo, base: n };
      const orden = Math.floor(i / 2); o.a = 0.1 + (0.4 * orden) / Math.max(1, m - 1); o.b = o.a + 0.45; n += o.t.segs.length; return o;
    });
    nBase = n; n += conds.length;
    cajas = crearLote(n, GEO_CAJA, matLam);
    for (const o of tr) for (let s = 0; s < o.t.segs.length; s++) colorear(cajas, o.base + s, C[o.tipo]);
    conds.forEach((c, i) => colorear(cajas, nBase + i, C.cond));
    fans = crearLote(conds.length * 2, GEO_FAN, matLam);
    for (let i = 0; i < fans.count; i++) colorear(fans, i, C.ventilador);
    // líquido baja de la condensadora al equipo (sentido inverso al trazo); succión sube
    pulsos = crearPulsos(tr.map((o) => ({ t: o.t, dir: o.tipo === 'liquido' ? -1 : 1, color: C.pulso })), { cada: 2.0, tam: 0.1, vel: 1.0, dy: 0.1 }, matBas);
    grupo.add(cajas, fans, pulsos.mesh); actualizar(0, true);
  }

  function actualizar(p, forzar = false) {
    if (!cajas || (p === ultimoP && !forzar)) return; ultimoP = p;
    for (const o of tr) escribirTrayecto(cajas, o.base, o.t, EASE.out(clamp((p - o.a) / (o.b - o.a))));
    conds.forEach((c, i) => {
      const q = clamp((p - 0.03 * i) / 0.2), e = EASE.back(q) * (q > 0 ? 1 : 0), h = c.alto * e;
      poner(cajas, nBase + i, c.p[0], c.p[1] + h / 2, c.p[2], c.ancho, h, c.fondo);
      const ef = EASE.out(clamp((q - 0.7) / 0.3));
      for (let k = 0; k < 2; k++) poner(fans, 2 * i + k, c.p[0] + (k ? 1 : -1) * 0.5, c.p[1] + c.alto + 0.03, c.p[2], ef, 0.06 * ef, ef);
    });
    marcar(cajas); marcar(fans);
  }
  return {
    grupo, get plan() { return plan; }, construir, actualizar,
    flujo(ahora) { if (pulsos && grupo.visible) pulsos.actualizar(ahora); },
    llamadas: () => grupo.children.length,
  };
}
