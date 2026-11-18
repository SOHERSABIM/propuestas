// Cubierta ligera del local: trabes sobre los ejes de columnas, largueros entre ellas y una lámina muy translúcida.
// Explica el apoyo de los equipos de azotea sin tapar el interior. Aparece al inicio del paso de instalaciones
// (trabes y luego largueros), se queda mientras haya capas y se retira en las vistas cenitales del sorteo y en los
// cambios de local. Se dibuja en lotes dinámicos (pocas llamadas). Frente: núcleo.
import * as THREE from 'three';
import * as INST from '../instalaciones/index.js';
import { mate, PALETA } from '../core/estilo.js';
import { regionDePoligono } from '../gen/regiones.js';
import { crearLotes } from './lotes.js';

/** Cara superior de la cubierta (m): la misma que usa instalaciones para sus bancadas (respaldo 4.8). */
export const NIVEL = INST.NIVEL_AZOTEA ?? 4.8;
const LAM = 0.04, LARG = { b: 0.08, h: 0.14 }, TRABE = { b: 0.22, h: 0.42 }, PASO_LARG = 2.0;
const OPAC_LAM = 0.07;
const MAT_TRABE = mate(0x7f8891, 'fx');
const MAT_LARG = MAT_TRABE; // mismo material: una llamada menos
const MAT_LAM = mate(0xe3e8eb, 'fx', { transparent: true, opacity: OPAC_LAM, depthWrite: false, side: THREE.DoubleSide });
const AR_CUB = new THREE.LineBasicMaterial({ color: PALETA.aristaSuave, transparent: true, opacity: 0.55 });

/** Elementos (cajas) de la cubierta de un local. Pura salvo materiales. */
export function elementosCubierta(loc) {
  const els = [];
  const E = (tipo, mat, arista, x, z, y0, w, h, d, ang = 0) => els.push({ tipo, mat, arista, x, z, y0, w, h, d, ang });
  const regs = regionDePoligono(loc.poligono);
  // trabes: una por fila de columnas (z agrupada a 0.6 m), sobre todo el ancho del local a esa altura de planta
  const filas = [];
  for (const [, z] of loc.columnas) { const f = filas.find((q) => Math.abs(q.z - z) < 0.6); if (f) { f.n++; f.z = Math.min(f.z, z); } else filas.push({ z, n: 1 }); }
  const yT = NIVEL - LAM - LARG.h - TRABE.h;
  for (const f of filas.filter((q) => q.n >= 2).sort((a, b) => a.z - b.z)) {
    const tramos = regs.filter((r) => f.z >= r.z0 - 0.6 && f.z <= r.z1 + 0.6);
    const x0 = Math.min(...tramos.map((r) => r.x0)), x1 = Math.max(...tramos.map((r) => r.x1));
    const z = Math.min(Math.max(f.z, TRABE.b / 2), Math.max(...tramos.map((r) => r.z1)) - TRABE.b / 2);
    E('trabe', MAT_TRABE, AR_CUB, (x0 + x1) / 2, z, yT, x1 - x0, TRABE.h, TRABE.b);
  }
  // largueros (sobre las trabes, perpendiculares) y lámina, por franja del polígono
  const yL = NIVEL - LAM - LARG.h;
  for (const r of regs) {
    const n = Math.max(1, Math.round((r.x1 - r.x0) / PASO_LARG));
    for (let i = 0; i < n; i++) { const x = r.x0 + ((i + 0.5) * (r.x1 - r.x0)) / n; E('larguero', MAT_LARG, null, x, (r.z0 + r.z1) / 2, yL, LARG.b, LARG.h, r.z1 - r.z0);}
    E('lamina', MAT_LAM, AR_CUB, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, NIVEL - LAM, r.x1 - r.x0, LAM, r.z1 - r.z0);
  }
  return els;
}

/** @param {{escena:any, anim:any}} ctx */
export function crearCubierta({ escena, anim }) {
  const raiz = new THREE.Group(); raiz.name = 'cubierta'; escena.add(raiz);
  const lotes = crearLotes(raiz, { sombra: () => false, orden: (m) => (m === MAT_LAM ? 3 : 0) });
  let vivos = [], visible = false, enCurso = null, local = null;
  const lam = (k) => { MAT_LAM.opacity = OPAC_LAM * k; MAT_LAM.userData.opacidadBase = OPAC_LAM * k; };
  const aplicar = (v, s) => { v.s = s; lotes.escribir(v); };
  /** Estado parcial de montaje: trabes y largueros crecen a lo largo; la lámina, solo opacidad. */
  const parcial = (e, k) => (e.tipo === 'trabe' ? { ...e, w: e.w * k } : e.tipo === 'larguero' ? { ...e, d: e.d * k } : k > 0.01 ? e : { ...e, h: 0 });
  /** Lámina: opacidad del material y presencia (sus aristas son el contorno de la cubierta). */
  const lamina = (k) => { lam(k); for (const v of vivos) if (v.e.tipo === 'lamina') aplicar(v, parcial(v.e, k)); };
  lam(0);

  const api = {
    raiz,
    get visible() { return visible; },
    get local() { return local; },
    /**
     * Monta la cubierta del local: trabes (escalonadas desde el frente), luego largueros y al final la lámina.
     * Si ya está montada en ese local no hace nada. @returns {any} Handle
     */
    montar(loc, { delay = 0, ritmo = 1 } = {}) {
      if (visible && local === loc) return anim.wait(0);
      enCurso?.finish();
      local = loc; visible = true;
      vivos = elementosCubierta(loc).map((e) => ({ e, s: parcial(e, 0), mat: e.mat, arista: e.arista }));
      lotes.reconstruir(vivos); lam(0);
      const hs = [];
      const trabes = vivos.filter((v) => v.e.tipo === 'trabe').sort((a, b) => b.e.z - a.e.z);
      const largs = vivos.filter((v) => v.e.tipo === 'larguero').sort((a, b) => a.e.x - b.e.x);
      trabes.forEach((v, i) => hs.push(anim.tween({ delay: delay + Math.min(500, i * 90) * ritmo, dur: 650 * ritmo, ease: 'out', onUpdate: (k) => aplicar(v, parcial(v.e, k)) })));
      const t1 = delay + (Math.min(500, trabes.length * 90) + 450) * ritmo;
      largs.forEach((v, i) => hs.push(anim.tween({ delay: t1 + Math.min(600, i * 30) * ritmo, dur: 450 * ritmo, ease: 'out', onUpdate: (k) => aplicar(v, parcial(v.e, k)) })));
      hs.push(anim.tween({ delay: t1 + 500 * ritmo, dur: 500 * ritmo, ease: 'io', onUpdate: lamina }));
      enCurso = anim.all(hs).onDone(() => { enCurso = null; });
      return enCurso;
    },
    /** Retira la cubierta (lámina se desvanece, largueros y trabes se recogen). @returns {any} Handle */
    desmontar({ dur = 600, delay = 0 } = {}) {
      if (!visible) return anim.wait(0);
      enCurso?.finish(); visible = false;
      const hs = [anim.tween({ delay, dur: dur * 0.4, ease: 'io', onUpdate: (k) => lamina(1 - k) })];
      for (const v of vivos) if (v.e.tipo !== 'lamina') {
        const r = v.e.tipo === 'larguero' ? 0 : dur * 0.3;
        hs.push(anim.tween({ delay: delay + r, dur: dur * 0.7, ease: 'in', aplicarInicio: false, onUpdate: (k) => aplicar(v, parcial(v.e, 1 - k)) }));
      }
      enCurso = anim.all(hs).onDone(() => { enCurso = null; vivos = []; lotes.vaciar(); local = null; });
      return enCurso;
    },
    vaciar() { enCurso?.cancel(); enCurso = null; vivos = []; lotes.vaciar(); visible = false; local = null; lam(0); },
    stats() { return { visible, elementos: vivos.length, llamadas: lotes.llamadas(), nivel: NIVEL }; },
  };
  return api;
}
