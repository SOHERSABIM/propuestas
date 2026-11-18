// Capa de AIRE ACONDICIONADO. Unidades paquete que crecen sobre la cubierta, bajantes, ducto principal y ramales
// que se extienden, difusores y retornos que aparecen al llegar el ducto, y pulsos de flujo sutiles.
// 3 llamadas de dibujo: cajas (ductos, unidades, rejillas), ventiladores, pulsos.
import * as THREE from 'three';
import { EASE } from '../core/anim.js';
import { PALETA } from '../core/estilo.js';
import { GEO_CAJA, GEO_FAN, crearLote, poner, ocultar, colorear, marcar, liberar, crearTrayecto, escribirTrayecto, crearPulsos } from './trazo.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const C = { principal: PALETA.capa.aire, ramal: 0x3f9fe2, bajante: 0x2477b4, unidad: 0xcfe4f5, ventilador: 0x1b5f93, difusor: 0x9fd0f2, retorno: 0x1f6fb0, pulso: 0xe3f3ff };

export function crearCapaAire() {
  const grupo = new THREE.Group(); grupo.name = 'capa-aire'; grupo.visible = false;
  const matLam = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const matBas = new THREE.MeshBasicMaterial({ color: 0xffffff });
  let cajas = null, fans = null, pulsos = null, plan = null, ultimoP = -1;
  let tr = [], U = [], R = [], base = {}, nEsp = 0;

  function construir(p) {
    liberar(grupo); plan = p; ultimoP = -1; const A = p.aire; nEsp = A.espinas.length;
    // trayectos: principal (espinas, enlaces y bajantes) y ramales
    tr = [];
    A.principal.forEach((t, i) => tr.push({ t: crearTrayecto(t.puntos, t.ancho, t.alto), tipo: t.bajante ? 'bajante' : 'principal', i, v0: 0, v1: 0 }));
    A.ramales.forEach((t, j) => tr.push({ t: crearTrayecto(t.puntos, t.ancho, t.alto), tipo: 'ramal', j, id: t.id, largo: t.largo }));
    // ventanas de tiempo (fracción del avance de la capa)
    const nB = A.ramales.length;
    for (const o of tr) {
      if (o.tipo === 'bajante') [o.a, o.b] = [0.08, 0.26];
      else if (o.tipo === 'principal') [o.a, o.b] = o.i < nEsp ? [0.2, 0.55] : [0.45, 0.62];
      else [o.a, o.b] = [0.45 + (0.35 * o.j) / Math.max(1, nB - 1), 0.65 + (0.35 * o.j) / Math.max(1, nB - 1)];
    }
    let n = 0; for (const o of tr) { o.base = n; n += o.t.segs.length; }
    base.unid = n; n += A.unidades.length; base.rej = n; n += A.difusores.length + A.retornos.length;
    cajas = crearLote(n, GEO_CAJA, matLam);
    for (const o of tr) for (let s = 0; s < o.t.segs.length; s++) colorear(cajas, o.base + s, C[o.tipo]);
    A.unidades.forEach((u, i) => colorear(cajas, base.unid + i, C.unidad));
    A.difusores.forEach((d, i) => colorear(cajas, base.rej + i, C.difusor));
    A.retornos.forEach((d, i) => colorear(cajas, base.rej + A.difusores.length + i, C.retorno));
    fans = crearLote(A.unidades.length * 2, GEO_FAN, matLam);
    for (let i = 0; i < fans.count; i++) colorear(fans, i, C.ventilador);
    pulsos = crearPulsos(tr.map((o) => ({ t: o.t, dir: 1, color: C.pulso })), { cada: 2.6, tam: 0.15, vel: 1.4, dy: 0.26 }, matBas);
    U = A.unidades; R = A.ramales;
    grupo.add(cajas, fans, pulsos.mesh); actualizar(0, true);
  }

  const avance = (o, p) => EASE.out(clamp((p - o.a) / (o.b - o.a)));

  function actualizar(p, forzar = false) {
    if (!cajas || (p === ultimoP && !forzar)) return; ultimoP = p;
    const A = plan.aire;
    for (const o of tr) escribirTrayecto(cajas, o.base, o.t, avance(o, p));
    // unidades: crecen desde la cubierta con rebote; sus ventiladores aparecen al final
    U.forEach((u, i) => {
      const q = clamp((p - 0.02 * i) / 0.22), e = EASE.back(q) * (q > 0 ? 1 : 0), h = u.alto * e;
      poner(cajas, base.unid + i, u.p[0], u.p[1] + h / 2, u.p[2], u.ancho, h, u.fondo);
      const qf = clamp((q - 0.7) / 0.3), ef = EASE.out(qf);
      for (let k = 0; k < 2; k++) {
        const o = (k ? 1 : -1) * 0.55, ex = u.eje === 'x' ? o : 0, ez = u.eje === 'x' ? 0 : o;
        poner(fans, 2 * i + k, u.p[0] + ex, u.p[1] + u.alto + 0.03, u.p[2] + ez, ef, 0.06 * ef, ef);
      }
    });
    // difusores: aparecen cuando el ramal llega a su posición; retornos: cuando llega la espina
    const nd = A.difusores.length;
    A.difusores.forEach((d, i) => {
      const o = tr[A.principal.length + R.findIndex((r) => r.id === d.ramal)], f = clamp((o.t.r * o.t.total - d.d) / 0.5), e = EASE.back(f) * (f > 0 ? 1 : 0);
      poner(cajas, base.rej + i, d.p[0], d.p[1] - 0.05, d.p[2], 0.6 * e, 0.08 * e, 0.6 * e);
    });
    A.retornos.forEach((d, i) => {
      const o = tr[A.principal.findIndex((t) => t.id === d.espina)], f = clamp((o.t.r * o.t.total - d.d) / 0.5), e = EASE.back(f) * (f > 0 ? 1 : 0);
      poner(cajas, base.rej + nd + i, d.p[0], d.p[1], d.p[2], (d.eje === 'x' ? 0.9 : 0.5) * e, 0.1 * e, (d.eje === 'x' ? 0.5 : 0.9) * e);
    });
    marcar(cajas); marcar(fans);
  }
  return {
    grupo, get plan() { return plan; }, construir, actualizar,
    flujo(ahora) { if (pulsos && grupo.visible) pulsos.actualizar(ahora); },
    llamadas: () => grupo.children.length,
  };
}
