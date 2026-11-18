// Capa de ILUMINACIÓN: canalización (tubo EMT a 4.68 m) con caja de conexión en cada luminaria y cabecera con bajada
// a la losa; luminarias con cuerpo y difusor (lineales, paneles, rieles con spots) colgadas de dos cables; encendido
// en secuencia con charcos de luz (material emisivo, sin luces reales). 8 llamadas de dibujo.
import * as THREE from 'three';
import { PALETA } from '../core/estilo.js';
import * as G from './geo.js';
import { crearLote } from './kit.js';
import { ventana } from './tiempos.js';

const GEO = { tubo: G.geoConduit, caja: G.geoCajaConex, varilla: G.geoVarilla, carcasaLineal: G.geoLineal, carcasaPanel: G.geoPanel, lente: G.geoLente, spot: G.geoSpot };
const ORDEN = ['tubo', 'caja', 'varilla', 'carcasaLineal', 'carcasaPanel', 'spot', 'lente', 'charco'];
const AMBAR = new THREE.Color(PALETA.capa.luz).lerp(new THREE.Color(0xffffff), 0.22).getHex();

/** Textura radial suave (alfa) calculada, determinista, sin red. */
function texturaCharco() {
  const N = 64, d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const r = Math.hypot((i + 0.5) / N - 0.5, (j + 0.5) / N - 0.5) * 2, a = Math.max(0, Math.exp(-r * r * 3.4) - Math.exp(-3.4)) / (1 - Math.exp(-3.4));
    const k = (j * N + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = Math.round(255 * a);
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

export function crearCapaLuz() {
  const grupo = new THREE.Group(); grupo.name = 'capa-luz'; grupo.visible = false;
  const matLam = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const matLente = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const matCharco = new THREE.MeshBasicMaterial({ map: texturaCharco(), color: PALETA.capa.luz, transparent: true, opacity: 0.17, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  let lotes = [], plan = null, dMax = 1;

  function construir(p) {
    liberar(); plan = p; const L = p.luz; dMax = L.dMax;
    for (const q of L.piezas) {
      const [t0, dur] = ventana('luz', q.ph, (q.d ?? 0) / dMax); q.t0 = t0; q.dur = dur;
      if (q.lit) { const [l0, ld] = ventana('luz', 'luz', (q.d ?? 0) / dMax); q.lit0 = l0; q.litd = ld; q.colOn = q.tapa ? 0xffc95c : q.t === 'lente' ? 0xfff3cf : 0xffe3a0; q.colOff = q.tapa ? 0xc9ccd0 : q.t === 'lente' ? 0x7b8188 : 0xb4b8bd; q.c = q.colOff; }
      if ((q.t === 'carcasaLineal' && q.tipoL !== 'riel') || q.t === 'carcasaPanel') { const [l0, ld] = ventana('luz', 'luz', (q.d ?? 0) / dMax); q.lit = true; q.lit0 = l0; q.litd = ld; q.colOff = 0xe9ecee; q.colOn = 0xffe2a0; q.c = q.colOff; }  // la carcasa se tiñe cálida al encender: legible desde arriba
      if (q.t === 'charco') q.c = 0xffffff;
      else if (q.t === 'carcasaLineal' && q.tipoL === 'riel') q.c = 0xb98a22;
    }
    for (const t of ORDEN) {
      const pz = L.piezas.filter((q) => q.t === t); if (!pz.length) continue;
      const geo = t === 'charco' ? G.GEO_PLANO : GEO[t]();
      const lote = crearLote(geo, t === 'lente' ? matLente : t === 'charco' ? matCharco : matLam, pz, { orden: t === 'charco' ? 1 : 0 });
      lotes.push(lote); grupo.add(lote.mesh);
    }
    actualizar(0, true);
  }
  function liberar() { for (const c of [...grupo.children]) { grupo.remove(c); c.dispose?.(); } lotes = []; }
  function actualizar(p, forzar = false) { for (const l of lotes) l.actualizar(p, forzar); }
  return { grupo, get plan() { return plan; }, construir, actualizar, flujo() {}, llamadas: () => grupo.children.length };
}
