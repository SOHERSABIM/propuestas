// Arranque: crea reloj, animación, escena y módulos; conecta la app y publica window.__tienda. Frente: núcleo.
import { leerParams } from './core/params.js';
import { crearReloj } from './core/reloj.js';
import { crearAnim } from './core/anim.js';
import { crearEscenario } from './escena/escenario.js';
import { crearCamara } from './escena/camara.js';
import { crearCascaron } from './escena/cascaron.js';
import { crearMuebles } from './escena/muebles.js';
import { crearZonas } from './escena/zonas.js';
import { crearInstalaciones } from './instalaciones/index.js';
import { crearInterfaz } from './interfaz/index.js';
import { PASOS } from './interfaz/director.js';
import { crearApp } from './app.js';
import { LOCALES } from './datos/locales.js';
import { caja } from './core/geom.js';

const params = leerParams();
const reloj = crearReloj({ manual: params.relojManual });
reloj.velocidad = params.vel;
const anim = crearAnim(reloj);
const esc = crearEscenario(document.getElementById('escena'), { reloj });
const camara = crearCamara({ camara: esc.camara, dom: esc.renderer.domElement, anim, reloj });
const cascaron = crearCascaron({ escena: esc.escena, anim });
const muebles = crearMuebles({ escena: esc.escena, anim });
const zonas = crearZonas({ escena: esc.escena, anim, reloj, camara: esc.camara, dom: esc.renderer.domElement });
const mep = crearInstalaciones({ escena: esc.escena, anim, reloj });
/**
 * Márgenes que ocupa la interfaz visible (px), leídos del DOM: panel lateral izquierdo, barra inferior, rótulo superior.
 * Solo lectura; si la interfaz cambia de forma, el encuadre se adapta solo.
 */
function margenesUI() {
  const W = window.innerWidth, H = window.innerHeight, m = { arriba: 0, abajo: 0, izq: 0, der: 0 };
  const capa = document.querySelector('#ui .ui-capa') || document.getElementById('ui');
  // En la vista de grabación (J: solo indicadores y rótulo) la barra de controles se oculta con una transición de
  // visibilidad: se descarta por modo para no reservarle espacio mientras se desvanece.
  const solo = capa.dataset?.modo === 'solo';
  // los contenedores sin caja propia (la cabecera, con hijos absolutos) se miden por sus hijos
  const elementos = [...capa.querySelectorAll(':scope > *')].flatMap((el) => (el.getBoundingClientRect().height < 2 ? [...el.children] : [el]));
  for (const el of elementos) {
    if (solo && el.matches('.controles, .marca, .herramientas')) continue;
    if (el.hidden || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (r.left < W * 0.1 && r.width < W * 0.45 && r.height > H * 0.25) m.izq = Math.max(m.izq, r.right + 16);
    else if (r.right > W * 0.9 && r.width < W * 0.45 && r.height > H * 0.25) m.der = Math.max(m.der, W - r.left + 16);
    else if (r.top > H * 0.6 && r.height < H * 0.35) m.abajo = Math.max(m.abajo, H - r.top + 12);
    else if (r.bottom < H * 0.2 && r.height < H * 0.2) m.arriba = Math.max(m.arriba, r.bottom + 12);
  }
  return m;
}
const app = crearApp({ params, anim, reloj, cascaron, muebles, zonas, mep, camara, pasos: PASOS, esc, margenesUI });
crearInterfaz(document.getElementById('ui'), app);

// Encuadre y sol iniciales sobre el local de arranque
const bb0 = caja(LOCALES[params.local].poligono);
esc.ajustarSol(bb0);
anim.instantaneamente(() => camara.encuadrar(bb0, { dur: 0, forzar: true, azimut: 36, polar: 52, llenado: 0.9 }));
app.on('layout', (s) => esc.ajustarSol(caja(LOCALES[s.local].poligono)));
reloj.iniciar(esc.dibujar);

async function arrancar() {
  app.precalcularTodo();
  if (params.paso != null) await app.acciones.irAPaso(params.paso, { instantaneo: true });
  if (params.auto) app.acciones.reproducir(true);
  reloj.pedirCuadro();
}

/** API de depuración para pruebas automáticas. Contrato: docs/design.md §6. */
window.__tienda = {
  version: 'fase-c-7pasos',
  ready: arrancar().then(() => true),
  estado: () => JSON.parse(JSON.stringify(app.estado)),
  layout: () => app.layout,
  irAPaso: (n, op) => app.acciones.irAPaso(n, op),
  siguiente: () => app.acciones.siguiente(),
  anterior: () => app.acciones.anterior(),
  generar: (semilla) => app.acciones.generar(semilla),
  cambiarLocal: (id) => app.acciones.cambiarLocal(id),
  capa: (id, ver) => app.acciones.capa(id, ver),
  reiniciar: () => app.acciones.reiniciar(),
  libre: () => app.libre(),
  /** Avanza el reloj manual ms milisegundos (?reloj=manual). Devuelve el tiempo de reloj. */
  advance: (ms) => reloj.advance(ms),
  ahora: () => reloj.ahora,
  animActivas: () => anim.depurar(),
  stats() {
    const r = esc.renderer.info;
    const L = app.layout;
    return {
      paso: app.estado.paso, local: app.estado.local, semilla: app.estado.semilla, ocupado: app.estado.ocupado,
      reloj: { ahora: reloj.ahora, manual: reloj.manual }, animActivas: anim.activos,
      indicadores: app.estado.indicadores, calificacion: L?.calificacion ?? null, validacion: L?.validacion ?? null,
      candidatos: L ? { evaluados: L.candidatos.evaluados, validos: L.candidatos.validos } : null,
      muebles: muebles.stats(), cascaron: cascaron.stats(), zonas: zonas.stats(), instalaciones: mep.stats(),
      // QA: posición y orientación de la cámara (para comprobar que no hay NaN); solo lectura, no afecta lo que se ve
      encuadre: { margenes: camara.margenes },
      camara: { pos: esc.camara.position.toArray(), rot: [esc.camara.rotation.x, esc.camara.rotation.y, esc.camara.rotation.z], fov: esc.camara.fov },
      renderer: { calls: r.render.calls, triangles: r.render.triangles, lines: r.render.lines, geometries: r.memory.geometries, textures: r.memory.textures },
    };
  },
  /** Encuadre con nombre (general, aereo, frente, instalaciones, cenital, cierre, pasillo); dur 0 = inmediato. */
  camara: (nombre, op = {}) => app.ops.camara(nombre, { forzar: true, ...op }).done,
  // alias en inglés para scripts de prueba
  goTo: (n, op) => app.acciones.irAPaso(n, op), generate: (s) => app.acciones.generar(s),
  setLocal: (id) => app.acciones.cambiarLocal(id), setLayer: (id, v) => app.acciones.capa(id, v),
};
