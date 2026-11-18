// PLAN DE INSTALACIONES (fachada). Lógica pura (sin three, sin azar, sin reloj), probada con tests/mep.test.mjs.
// Contrato: docs/design.md §6. Todo es CONCEPTUAL (no es ingeniería). Entrada: Local y Layout; salida: PlanMEP con
// los datos del contrato (luminarias, unidades, ramales, difusores, líneas de frío…) y, además, las PIEZAS de cada red
// (tramos, codos, tés, soportes…) con su distancia por la red al equipo, que usa la animación por tramos.
import { rectC, solapa, cajaC, cajasChocan, huellaMueble, rectsDePoligono, r3 } from './util.js';
import { planAire, DIM_UNIDAD, SZ, Y_DUCTO, Y_CUELLO, Y_CARA, Y_AZOTEA } from './plan-aire.js';
import { planTrincheras } from './plan-trinchera.js';
import { planFrio, DIM_COND, Y_FRIO, D_SUC } from './plan-frio.js';
import { planLuz, REGLA_LUZ, DIM_LUZ, Y_CANAL } from './plan-luz.js';

export { rectsDePoligono, DIM_UNIDAD, DIM_COND, REGLA_LUZ, DIM_LUZ };

/** Alturas por capa (m sobre piso terminado). Cambios respecto al contrato: ver docs/status/r1-inst.done. */
export const ALTURAS = {
  luz: { autoservicio: 3.6, refrigerados: 3.6, ropa_hogar: 3.8, cajas: 3.4, mostrador: 3.4, acceso: 3.6, trastienda: 3.0, canalizacion: Y_CANAL },
  aire: { ductoPrincipal: Y_DUCTO, ramal: Y_DUCTO, difusor: Y_CUELLO, caraDifusor: Y_CARA, azotea: Y_AZOTEA },
  frio: { lineas: Y_FRIO, azotea: Y_AZOTEA },
};

/** Cajas (AABB) de una pieza: una o varias. */
export const cajasDe = (p) => p.cajas ?? (p.caja ? [p.caja] : []);

/** Busca la posición de cada soporte (trapecio) que no choque con nada: desplaza a lo largo del tramo. */
function colocarSoportes(candidatos, otros, extraOcupadas) {
  const hechos = [];
  const cerca = (lista, u) => lista.filter((o) => o.x0 < u.x1 + 0.02 && o.x1 > u.x0 - 0.02 && o.z0 < u.z1 + 0.02 && o.z1 > u.z0 - 0.02 && o.y0 < u.y1 + 0.02 && o.y1 > u.y0 - 0.02);
  for (const c of candidatos) {
    // todas las posiciones posibles de este soporte caben en una caja: solo se comparan los obstáculos que la tocan
    const opciones = c.desplazamientos.map((t) => ({ t, cj: c.cajasEn(t) }));
    const u = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
    for (const o of opciones) for (const b of o.cj) { u.x0 = Math.min(u.x0, b.x0); u.x1 = Math.max(u.x1, b.x1); u.y0 = Math.min(u.y0, b.y0); u.y1 = Math.max(u.y1, b.y1); u.z0 = Math.min(u.z0, b.z0); u.z1 = Math.max(u.z1, b.z1); }
    const rel = [...cerca(otros, u), ...cerca(extraOcupadas, u), ...cerca(hechos, u)];
    let ok = null;
    for (const o of opciones) { if (o.cj.some((b) => rel.some((q) => cajasChocan(q, b, 0.01)))) continue; ok = o; break; }
    if (!ok) continue;
    hechos.push(...ok.cj);
    c.crear(ok.t, ok.cj);
  }
}

/**
 * Plan de instalaciones conceptual para un local y un layout.
 * @param {import('../datos/locales.js').Local} local
 * @param {import('../gen/generador.js').Layout} layout
 */
export function planInstalaciones(local, layout) {
  const cols = (m) => local.columnas.map(([x, z]) => rectC(x, z, local.columna + 2 * m, local.columna + 2 * m));
  const conFrio = layout.muebles.filter((m) => m.frio && m.frio.conexion && (!layout.equiposFrios || layout.equiposFrios.includes(m.id)));
  // congeladores isla: sin tubería desde el techo; reciben su línea por canaleta de piso desde un muro o columna
  const tr = planTrincheras(local, layout, layout.equiposFrios);
  const equiposFrios = [...conFrio.filter((m) => !tr.islas.has(m.id)), ...tr.equipos];
  const altos = layout.muebles.map((m) => ({ r: huellaMueble(m), alto: m.alto }));
  const aire = planAire(local, layout, { equiposFrios, altos });
  const frio = planFrio(local, layout, { cols, equiposFrios, aire });
  const luz = planLuz(local, layout, { cols, aire, frio, muebles: layout.muebles });

  // ───────── soportería (después de fijar todo lo demás) ─────────
  const colCajas = local.columnas.map(([x, z]) => cajaC(x, 2.4, z, local.columna, 4.8, local.columna));
  const bajoLosa = (c) => c.y0 < Y_AZOTEA - 0.01;   // lo que está sobre la losa (unidades, condensadoras, ventiladores) no estorba a los soportes
  const fijosLuz = luz.piezas.flatMap(cajasDe).filter(bajoLosa);
  const fijosFrio = frio.piezas.flatMap(cajasDe).filter(bajoLosa);
  const fijosAire = aire.piezas.flatMap(cajasDe).filter(bajoLosa);
  // frío: trapecios sobre los tramos horizontales (ya propuestos por planFrio)
  const candF = [];
  for (const p of frio.piezas.filter((q) => q.t === 'soporte')) {
    const horiz = p.eje === 'x';
    const dsp = [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6, 0.8, -0.8];
    candF.push({
      desplazamientos: dsp,
      cajasEn: (t) => soporteCajas(p.x + (horiz ? t : 0), p.z + (horiz ? 0 : t), p.eje, p.span, p.yb, p.H),
      crear: (t, cj) => { p.x += horiz ? t : 0; p.z += horiz ? 0 : t; p.cajas = cj; p.ok = true; },
      p,
    });
  }
  colocarSoportes(candF, [...fijosLuz, ...fijosFrio.filter(() => true), ...fijosAire, ...colCajas], []);
  frio.piezas = frio.piezas.filter((p) => p.t !== 'soporte' || p.ok);
  const sopFrioCajas = frio.piezas.filter((q) => q.t === 'soporte').flatMap(cajasDe);
  // aire: un trapecio por tramo (y compuerta), de varilla roscada y perfil
  const candA = [];
  for (const p of aire.piezas.filter((q) => q.t === 'tramo' || q.t === 'compuerta')) {
    const eje = p.eje, w = p.sz, span = w + 0.2; const yb = Y_DUCTO - p.sy / 2 - 0.03, H = Y_AZOTEA - yb;
    const m = Math.max(0, p.sx / 2 - 0.14);
    const dsp = [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6].filter((t) => Math.abs(t) <= m + 1e-9);
    const perp = eje === 'x' ? 'z' : 'x';
    candA.push({
      desplazamientos: dsp.length ? dsp : [0],
      cajasEn: (t) => soporteCajas(p.x + (eje === 'x' ? t : 0), p.z + (eje === 'z' ? t : 0), eje, span, yb, H),
      crear: (t, cj) => { aire.piezas.push({ sys: 'aire', t: 'soporte', ph: 'soporte', id: `sp_${p.id}`, x: p.x + (eje === 'x' ? t : 0), y: Y_AZOTEA, z: p.z + (eje === 'z' ? t : 0), ry: eje === 'x' ? -Math.PI / 2 : 0, sx: span, sy: H, sz: 1, d: p.d, fr: [0, 0], net: 'aire-soporte', eje, cajas: cj, span, yb, H }); },
    });
    void perp;
  }
  colocarSoportes(candA, [...fijosLuz, ...fijosFrio, ...sopFrioCajas, ...fijosAire.filter((c, i) => true), ...colCajas].filter(Boolean), []);
  // el propio ducto no debe contar contra su soporte (varillas a ±(w/2+0.1) de su eje): se excluye al colocarlos
  return {
    localId: local.id, layoutId: layout.id,
    luz, aire, frio, trincheras: tr.arboles.map((t, i) => ({ id: tr.equipos[i].id, islas: t.islas, subida: t.subida })), sinTrinchera: tr.sinTrinchera,
    indicadores: { luminarias: luz.luminarias.length, tr: aire.tr, condensadoras: frio.condensadoras.length },
    extra: { difusores: aire.difusores.length, retornos: aire.retornos.length, unidadesAire: aire.unidades.length, lineasFrio: frio.lineas.length, piezas: { luz: luz.piezas.length, aire: aire.piezas.length, frio: frio.piezas.length } },
  };
}

/** Cajas de un trapecio: dos varillas laterales y el perfil horizontal. eje = eje del ducto/tubo que sostiene. */
export function soporteCajas(cx, cz, eje, span, yb, H) {
  const top = Y_AZOTEA;
  if (eje === 'x') return [cajaC(cx, (yb + top) / 2, cz - span / 2, 0.03, H, 0.03), cajaC(cx, (yb + top) / 2, cz + span / 2, 0.03, H, 0.03), cajaC(cx, yb, cz, 0.05, 0.04, span + 0.06)];
  return [cajaC(cx - span / 2, (yb + top) / 2, cz, 0.03, H, 0.03), cajaC(cx + span / 2, (yb + top) / 2, cz, 0.03, H, 0.03), cajaC(cx, yb, cz, span + 0.06, 0.04, 0.05)];
}
