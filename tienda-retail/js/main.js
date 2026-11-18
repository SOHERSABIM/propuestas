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
const zonas = crearZonas({ escena: esc.escena, anim });
const mep = crearInstalaciones({ escena: esc.escena, anim, reloj });
const app = crearApp({ params, anim, reloj, cascaron, muebles, zonas, mep, camara, pasos: PASOS, esc });
crearInterfaz(document.getElementById('ui'), app);

// Encuadre y sol iniciales sobre el local de arranque
const bb0 = caja(LOCALES[params.local].poligono);
esc.ajustarSol(bb0);
anim.instantaneamente(() => camara.encuadrar(bb0, { dur: 0, forzar: true }));
app.on('layout', (s) => esc.ajustarSol(caja(LOCALES[s.local].poligono)));
reloj.iniciar(esc.dibujar);

async function arrancar() {
  if (params.paso != null) await app.acciones.irAPaso(params.paso, { instantaneo: true });
  if (params.auto) app.acciones.reproducir(true);
  reloj.pedirCuadro();
}

/** API de depuración para pruebas automáticas. Contrato: docs/design.md §6. */
window.__tienda = {
  version: 'fase-b',
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
  stats() {
    const r = esc.renderer.info;
    const L = app.layout;
    return {
      paso: app.estado.paso, local: app.estado.local, semilla: app.estado.semilla, ocupado: app.estado.ocupado,
      reloj: { ahora: reloj.ahora, manual: reloj.manual }, animActivas: anim.activos,
      indicadores: app.estado.indicadores, calificacion: L?.calificacion ?? null, validacion: L?.validacion ?? null,
      candidatos: L ? { evaluados: L.candidatos.evaluados, validos: L.candidatos.validos } : null,
      muebles: muebles.stats(), cascaron: cascaron.stats(), zonas: zonas.stats(), instalaciones: mep.stats(),
      renderer: { calls: r.render.calls, triangles: r.render.triangles, lines: r.render.lines, geometries: r.memory.geometries, textures: r.memory.textures },
    };
  },
  /** Encuadre con nombre (general, aereo, frente, instalaciones, cenital, cierre, pasillo); dur 0 = inmediato. */
  camara: (nombre, op = {}) => app.ops.camara(nombre, { forzar: true, ...op }).done,
  // alias en inglés para scripts de prueba
  goTo: (n, op) => app.acciones.irAPaso(n, op), generate: (s) => app.acciones.generar(s),
  setLocal: (id) => app.acciones.cambiarLocal(id), setLayer: (id, v) => app.acciones.capa(id, v),
};
