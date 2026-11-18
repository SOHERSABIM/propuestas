// Capa de ILUMINACIÓN. Luminarias que bajan del techo y encienden (material emisivo, sin luces reales) con un
// charco de luz suave proyectado en el piso. 2 llamadas de dibujo: cajas (cuerpos, varillas, spots, alimentadores)
// y charcos. Avance p (0..1): cada luminaria tiene su turno, de la entrada hacia el fondo.
import * as THREE from 'three';
import { EASE } from '../core/anim.js';
import { PALETA } from '../core/estilo.js';
import { GEO_CAJA, GEO_PLANO, crearLote, poner, ocultar, colorear, colorMezcla, marcar, liberar, crearTrayecto, escribirTrayecto } from './trazo.js';

const CIELO = 4.8, ARRANQUE = 4.62;
const GRIS_APAGADO = 0x5d6269, VARILLA = 0x8a9097, RIEL = 0x9a6f12;
const ALTO_CUERPO = { lineal: 0.1, panel: 0.06, riel: 0.07 };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/** Textura radial suave (alfa) calculada, determinista, sin red. */
function texturaCharco() {
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const r = Math.hypot((i + 0.5) / N - 0.5, (j + 0.5) / N - 0.5) * 2, a = Math.max(0, 1 - r);
    const k = (j * N + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = Math.round(255 * a * a * (3 - 2 * a));
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

export function crearCapaLuz() {
  const grupo = new THREE.Group(); grupo.name = 'capa-luz'; grupo.visible = false;
  const matCaja = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matCharco = new THREE.MeshBasicMaterial({ map: texturaCharco(), color: PALETA.capa.luz, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  let cajas = null, charcos = null, L = [], circ = [], nSpot0 = 0, nCirc0 = 0, plan = null;
  let ultimoP = -1;

  function construir(p) {
    liberar(grupo); plan = p; ultimoP = -1;
    L = p.luz.luminarias; const n = L.length;
    const nSp = L.reduce((s, l) => s + l.spots, 0);
    circ = p.luz.circuitos.map((c) => crearTrayecto(c.puntos, 0.03, 0.03));
    nSpot0 = 3 * n; nCirc0 = nSpot0 + nSp;
    cajas = crearLote(nCirc0 + circ.length, GEO_CAJA, matCaja);
    charcos = crearLote(n, GEO_PLANO, matCharco, false); charcos.renderOrder = 1;
    for (let i = 0; i < n; i++) colorear(cajas, n + 2 * i, VARILLA), colorear(cajas, n + 2 * i + 1, VARILLA);
    for (let i = 0; i < circ.length; i++) colorear(cajas, nCirc0 + i, 0xb98a22);
    grupo.add(charcos, cajas); actualizar(0, true);
  }

  function actualizar(p, forzar = false) {
    if (!cajas || (p === ultimoP && !forzar)) return; ultimoP = p;
    const n = L.length; let sp = nSpot0;
    for (let i = 0; i < n; i++) {
      const l = L[i], t0 = n > 1 ? (0.5 * i) / (n - 1) : 0, q = clamp((p - t0) / 0.5);
      const q1 = clamp(q / 0.6), q2 = clamp((q - 0.5) / 0.5), qe = EASE.out(q1), lit = EASE.outQuint(q2);
      const x = l.p[0], z = l.p[2], yF = l.p[1], y = yF + (ARRANQUE - yF) * (1 - qe), h = ALTO_CUERPO[l.tipo];
      const sc = Math.min(1, q1 * 4), a = l.rot === 0;
      poner(cajas, i, x, y, z, (a ? l.largo : l.ancho) * sc, h * sc, (a ? l.ancho : l.largo) * sc);
      if (l.tipo === 'riel') colorear(cajas, i, RIEL); else colorMezcla(cajas, i, GRIS_APAGADO, PALETA.capa.luz, lit);
      // dos varillas del techo al cuerpo
      const top = y + h / 2, rl = Math.max(0, CIELO - top), off = Math.max(0.2, l.largo / 2 - 0.25);
      for (let k = 0; k < 2; k++) {
        const o = (k ? 1 : -1) * off;
        poner(cajas, n + 2 * i + k, x + (a ? o : 0), top + rl / 2, z + (a ? 0 : o), 0.02, rl * (q1 > 0 ? 1 : 0), 0.02);
      }
      // spots del riel: cuelgan del riel y se encienden con él
      for (let s = 0; s < l.spots; s++, sp++) {
        const o = ((s + 0.5) * l.largo) / l.spots - l.largo / 2;
        poner(cajas, sp, x + (a ? o : 0), y - 0.09, z + (a ? 0 : o), 0.1 * sc, 0.12 * sc, 0.1 * sc);
        colorMezcla(cajas, sp, GRIS_APAGADO, PALETA.capa.luz, lit);
      }
      // charco de luz en el piso: crece al encender (elipse alineada con la luminaria)
      const e = EASE.back(q2) * (q2 > 0 ? 1 : 0);
      const along = l.tipo === 'panel' ? 2.8 : l.largo + 2.2, across = l.tipo === 'panel' ? 2.6 : 2.5;
      poner(charcos, i, x, 0.03, z, (a ? along : across) * e, 1, (a ? across : along) * e);
    }
    for (let i = 0; i < circ.length; i++) escribirTrayecto(cajas, nCirc0 + i, circ[i], EASE.out(clamp((p - 0.05) / 0.5)));
    marcar(cajas); marcar(charcos);
  }
  return {
    grupo, get plan() { return plan; }, construir, actualizar, flujo() {},
    llamadas: () => grupo.children.length,
  };
}
