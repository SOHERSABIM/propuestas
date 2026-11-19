// Aplicación: estado observable, cola de acciones con bloqueo, escenas de la demo y operaciones. Frente: núcleo.
// La interfaz (frente 4) SOLO lee app.estado, escucha app.on(...) y llama app.acciones.*. El director de pasos
// (interfaz/director.js) compone con ops.escenas.* (cada escena es un paso completo: cámara incluida).
import { crearEmisor } from './core/eventos.js';
import { LOCALES, IDS_LOCALES } from './datos/locales.js';
import { crearEvaluacion, componerLayout, mejorIndice } from './gen/generador.js';
import { planInstalaciones } from './instalaciones/plan.js';
import { rutaPasos } from './escena/recorrido.js';
import { atenuar } from './core/estilo.js';
import { caja, dentro, DEG as DEG_ } from './core/geom.js';
import { EASE } from './core/anim.js';
import { Vector3 as THREE_V } from 'three';
const EASE_IO = EASE.io;
import { FAMILIAS, NOMBRE_ZONA, ZONAS } from './datos/catalogo.js';

/**
 * @typedef {Object} Estado
 * @property {number} paso            0 = vacío; 1..total
 * @property {number} total
 * @property {{id:string, titulo:string, rotulo:string}|null} pasoInfo
 * @property {'A'|'B'|'C'} local
 * @property {number} semilla
 * @property {string|null} layoutId
 * @property {Object|null} indicadores        indicadores vigentes (layout + instalaciones)
 * @property {Object|null} indicadoresPrevios del layout anterior (para mostrar variación)
 * @property {{total:number, criterios:any[]}|null} calificacion
 * @property {{total:number, criterios:any[]}|null} calificacionAnterior  la del layout publicado antes
 * @property {boolean} esMejor        el layout vigente es el de mayor calificación de los evaluados (evento 'calificacion')
 * @property {{posicion:number, de:number, maximo:number, minimo:number}|null} ranking
 * @property {{evaluados:number, validos:number, descartes:Object}|null} candidatos
 * @property {{luz:boolean, aire:boolean, frio:boolean}} capas   capas deseadas
 * @property {boolean} ocupado
 * @property {string|null} accion
 * @property {boolean} reproduciendo
 * @property {boolean} interfaz
 * @property {boolean} rotulos
 * @property {boolean} orbita
 * @property {{id:string, familia:string, nombre:string, ancho:number, fondo:number, alto:number, zona:string}|null} seleccion
 */

const CAPAS = ['luz', 'aire', 'frio'];
// ---------- Tiempos (reproducción automática) ----------
// Duración total D (?duracion=, 45 a 150 s; 90 por defecto). Cada paso = acción (armado, tendido) + remanso
// (resultado a la vista, la cámara sigue su arco con la deriva). Con D = 60 los pasos duran lo de R6 (≈ 1 minuto);
// con D = 90, 7/13/16/15/9/9/21 s. Las acciones se estiran poco (exponente < 1 sobre D/60) y el remanso absorbe el resto.
/** Ritmo de R6 por paso (factor sobre duraciones y retardos con D = 60). */
const RITMO = [0.78, 0.72, 0.6, 0.52, 0.52, 0.52, 1];
/** Duración por paso en s (pausa incluida) con D = 60 (R6 medido) y con D = 90 (guion de 1:30). */
const T60 = [3.8, 7.5, 9.5, 10.8, 7.5, 7.5, 14], T90 = [7, 13, 16, 15, 9, 9, 21];
/** Cuánto se alarga la ACCIÓN de cada paso al crecer D: factor (D/60)^E (con D = 90: ×1.3 en 1-3, ×1.2 en 4, ×1.1 en 5-6). */
const E_ACCION = [0.65, 0.65, 0.65, 0.45, 0.235, 0.235];
/** Duración objetivo del paso i (0..6) en s para una duración total D. */
export const objetivoPaso = (i, D) => (D >= 60 ? T60[i] + ((T90[i] - T60[i]) * (D - 60)) / 30 : (T60[i] * D) / 60);
/** Ritmo de la acción del paso i (0..5) para D. */
const ritmoPaso = (i, D) => RITMO[i] * Math.min(1.7, D >= 60 ? Math.pow(D / 60, E_ACCION[i]) : D / 60);
/** Deriva de la cámara (°/s) en los pasos 1-6: con avance manual sigue mientras se habla. */
const DERIVA = 2.5;
/** En el remanso: deriva más viva y acercamiento suave (fracción de la distancia). */
const DERIVA_REMANSO = 4.5, ACERCAR = 0.12;
/**
 * Espera manual (pasos 1-6): vaivén a 3 °/s alrededor del azimut en que terminó la acción. Por paso: amplitud (°) y fracción
 * del acercamiento de 4 s (el encuadre de cada paso solo aguanta cierto giro; se ajustó midiendo márgenes). Primer tramo
 * amp/3 s; después cada (2·amp + 7.2)/3 s (la inversión, a 2.5 °/s², pierde 7.2° de recorrido).
 */
const DERIVA_ESPERA = 3;
const ESPERA = [null, { amp: 12, acercar: ACERCAR }, { amp: 12, acercar: 0.03 }, { amp: 12, acercar: 0.04 }, { amp: 10, acercar: 0.03 }, { amp: 12, acercar: 0.03 }, { amp: 12, acercar: 0.03 }];
const vaivenPrimero = (paso) => (ESPERA[paso].amp / DERIVA_ESPERA) * 1000;
const vaivenPeriodo = (paso) => ((2 * ESPERA[paso].amp + 7.2) / DERIVA_ESPERA) * 1000;

/**
 * @param {{params:any, anim:any, reloj:any, cascaron:any, muebles:any, zonas:any, mep:any, camara:any, pasos:any[], esc:any, margenesUI?:()=>any}} d
 */
export function crearApp({ params, anim, reloj, cascaron, cubierta, muebles, zonas, mep, camara, pasos, esc, margenesUI = () => ({}) }) {
  const em = crearEmisor();
  /** @type {Estado} */
  const estado = {
    paso: 0, total: pasos.length, pasoInfo: null, local: params.local, semilla: params.semilla, layoutId: null,
    indicadores: null, indicadoresPrevios: null, calificacion: null, calificacionAnterior: null, esMejor: false, ranking: null, candidatos: null,
    capas: { luz: false, aire: false, frio: false }, ocupado: false, accion: null, reproduciendo: false,
    interfaz: !params.sinInterfaz, rotulos: params.rotulos, orbita: false, seleccion: null,
    // fase del paso 7 para la interfaz: 'recorrido' (primera persona) · 'cierre' (órbita final) · '' (lo demás)
    fase: '',
  };
  const D = params.duracion ?? 90;
  let layout = null;
  const set = (patch, ev) => { Object.assign(estado, patch); if (ev) em.emit(ev, estado); em.emit('estado', estado); };
  const fase = (v) => { if (estado.fase !== v) set({ fase: v }); };

  // ---------- Layouts ----------
  // Cada local y semilla tiene UNA evaluación de candidatos (32). Narrativa honesta:
  //   paso 2 → acomodo base (percentil 30 de los válidos) · primer "nuevo layout" → el mejor evaluado ·
  //   siguientes → los siguientes mejores aún no mostrados y visiblemente distintos.
  // Las evaluaciones se calculan al arrancar y, si falta alguna, en reposo de a un candidato por cuadro.
  const evals = new Map();
  const vistos = new Map(); // candidatos ya mostrados, por local y semilla
  const vistosDe = (loc, semilla) => { const k = `${loc}:${semilla}`; if (!vistos.has(k)) vistos.set(k, []); return vistos.get(k); };
  const evaluacion = (loc, semilla) => { const k = `${loc}:${semilla}`; if (!evals.has(k)) evals.set(k, crearEvaluacion(LOCALES[loc], semilla)); return evals.get(k); };
  function obtenerLayout(loc, semilla, anterior, modo) {
    const ev = evaluacion(loc, semilla), vs = vistosDe(loc, semilla);
    if (modo === 'mejor' && vs.includes(mejorIndice(ev))) modo = 'siguiente';
    const lay = componerLayout(ev, { modo, anterior, vistos: vs });
    if (!vs.includes(lay.candidato)) vs.push(lay.candidato);
    return lay;
  }
  const modoSiguiente = () => 'mejor'; // obtenerLayout baja a 'siguiente' si el mejor ya se mostró
  const localSiguiente = () => IDS_LOCALES[(IDS_LOCALES.indexOf(estado.local) + 1) % IDS_LOCALES.length];
  /**
   * Local que visita el k-ésimo paso de "otro local" (k = 1, 2): los dos locales distintos del de arranque, en el
   * orden B → C → A. Desde A: 1 = B (angosto), 2 = C (en esquina). No depende del estado: "ir a paso" reconstruye igual.
   */
  const localDelPaso = (k) => ['B', 'C', 'A'].filter((id) => id !== params.local)[k - 1] ?? localSiguiente();
  /** Evalúa en reposo, un candidato por cuadro, lo que falte de las evaluaciones de la semilla vigente. */
  function precalcular() {
    if (estado.ocupado || anim.activos > 0) return;
    for (const loc of IDS_LOCALES) { const ev = evaluacion(loc, estado.semilla); if (!ev.terminado) { ev.paso(1); return; } }
  }
  reloj.onTick(precalcular, 95);
  // ---------- Ruta del recorrido (paso 7), precalculada en reposo ----------
  // Al fijar un layout se arma su ruta con un generador (escena/recorrido.js → rutaPasos) que avanza un trozo de pocos
  // ms por cuadro mientras corren los pasos 5-6: al pulsar el paso 7 la ruta ya está (sin cuadro largo).
  const VEL_RECORRIDO = 3.5;
  const rutas = new Map(); let rutaEnCurso = null;
  const opRuta = () => {
    const f7 = objetivoPaso(6, D) / 21, plan = mep.plan, ductos = [];
    if (plan?.aire) for (const d of [...plan.aire.principal.filter((q) => !q.bajante), ...plan.aire.ramales]) for (let k = 1; k < d.puntos.length; k++) ductos.push([d.puntos[k - 1][0], d.puntos[k - 1][2], d.puntos[k][0], d.puntos[k][2]]);
    return { largoObj: 40 * f7, largoMax: Math.min(60, 44 * f7), velocidad: VEL_RECORRIDO, ductos };
  };
  const claveRuta = (lay) => `${lay.localId}|${lay.id}|${lay.candidato}`;
  function prepararRuta(lay) {
    const k = claveRuta(lay); if (rutas.has(k) || rutaEnCurso?.k === k) return;
    rutaEnCurso = { k, g: rutaPasos(LOCALES[lay.localId], lay, opRuta()) };
  }
  reloj.onTick(() => {
    if (!rutaEnCurso) return;
    const r = rutaEnCurso.g.next();
    if (r.done) { rutas.set(rutaEnCurso.k, r.value); rutaEnCurso = null; }
  }, 96);
  /** Ruta del layout (de la caché; si falta y `forzar`, la termina de calcular en el acto). */
  function rutaDe(lay, forzar) {
    const k = claveRuta(lay);
    if (rutas.has(k)) return rutas.get(k);
    if (!forzar) return null;
    let g = rutaEnCurso?.k === k ? rutaEnCurso.g : rutaPasos(LOCALES[lay.localId], lay, opRuta());
    let r = g.next(); while (!r.done) r = g.next();
    if (rutaEnCurso?.k === k) rutaEnCurso = null;
    rutas.set(k, r.value); return r.value;
  }
  /** Al arrancar: las tres evaluaciones de la semilla inicial (≈1 s, antes de "ready"). */
  function precalcularTodo() {
    for (const loc of IDS_LOCALES) evaluacion(loc, params.semilla).terminar();
    // acomodo base del paso 1 ya compuesto, y una primera llamada al plan de instalaciones (la primera, en frío,
    // tarda varias veces más): así pulsar el paso 1 no carga ese trabajo en un solo cuadro
    const lay = componerLayout(evaluacion(params.local, params.semilla), { modo: 'base', anterior: null, vistos: [] });
    planInstalaciones(LOCALES[params.local], lay);
    layoutInicial = lay;
    // planes de piezas de mobiliario de los layouts del guion (base y mejor de cada local): crear un mueble por
    // primera vez cuesta hasta ~30 ms; así ningún cuadro de la demo carga ese trabajo
    const specs = [];
    for (const loc of IDS_LOCALES) for (const modo of ['base', 'mejor']) {
      const l = componerLayout(evaluacion(loc, params.semilla), { modo, anterior: null, vistos: [] });
      specs.push(...l.muebles);
      if (modo === 'mejor' && loc !== params.local) planInstalaciones(LOCALES[loc], l); // primera llamada por local (la más lenta)
    }
    muebles.precalentar(specs);
  }
  let layoutInicial = null;
  /** Acomodo base del local y semilla vigentes (usa el precalculado si coincide). */
  function layoutBase() {
    const li = layoutInicial;
    if (li && li.localId === estado.local && li.semilla === estado.semilla) { const vs = vistosDe(li.localId, li.semilla); if (!vs.includes(li.candidato)) vs.push(li.candidato); return li; }
    return obtenerLayout(estado.local, estado.semilla, null, 'base');
  }

  function indicadoresDe(lay) {
    const mi = mep.indicadores();
    return { ...lay.indicadores, ...Object.fromEntries(Object.entries(mi).filter(([, v]) => v != null)) };
  }
  /** Publica un layout como vigente (estado, eventos e indicadores). */
  function publicar(lay) { fijar(lay); anunciar(lay); }
  /** Lo interno: layout vigente y plan de instalaciones (sin tocar el estado que ve la interfaz). */
  function fijar(lay) { layout = lay; mep.setPlan(LOCALES[lay.localId], lay); if (!anim.instantaneo) prepararRuta(lay); }
  /** Lo visible: estado, indicadores y calificación (en los cambios de local, cuando ya aparece el local nuevo). */
  function anunciar(lay) {
    set({ semilla: lay.semilla, local: lay.localId, layoutId: lay.id, indicadoresPrevios: estado.indicadores, indicadores: indicadoresDe(lay),
      calificacionAnterior: estado.calificacion, calificacion: lay.calificacion, esMejor: lay.esMejor, ranking: lay.ranking,
      candidatos: { evaluados: lay.candidatos.evaluados, validos: lay.candidatos.validos, descartes: lay.candidatos.descartes } }, 'layout');
    em.emit('indicadores', estado);
    em.emit('calificacion', estado);
  }

  const cajaLocal = (id = estado.local) => caja(LOCALES[id].poligono);
  const dentroLocal = (x, z) => dentro(LOCALES[estado.local].poligono, [x, z]);
  /** Azimut base por local: el lado largo del local queda horizontal en pantalla. */
  const AZ = { A: 36, B: 66, C: 40 };
  const POL = { A: 0, B: 6, C: 0 }; // B: algo más cenital para ver por encima del muro largo cercano
  const ENCUADRES = (loc) => ({
    general: { azimut: AZ[loc], polar: 52 + POL[loc], llenado: 0.78 },
    aereo: { azimut: AZ[loc] + 55, polar: 30, llenado: 0.42 },
    frente: { azimut: AZ[loc] - 10, polar: 56 + POL[loc], llenado: 0.9 },
    // movimiento por paso (giro de 45° a 90°): el encuadre final de cada paso está girado respecto al anterior
    mobiliario: { azimut: AZ[loc] - 50, polar: 48 + POL[loc], llenado: 0.78 }, // paso 2: sigue el giro del paso 1
    instalaciones: { azimut: AZ[loc] + 40, polar: 45 + POL[loc], llenado: 0.74 }, // paso 3: arco mientras se monta todo
    traslado: { azimut: AZ[loc] + 44, polar: 52 + POL[loc], llenado: 0.78, abombar: 0.14 }, // paso 4: baja girando desde el cenital
    llegada: { azimut: AZ[loc] + (loc === 'B' ? 54 : loc === 'C' ? 20 : 40), polar: 52 + POL[loc], llenado: 0.78 }, // pasos 5-6: gira alrededor
    cenital: { azimut: loc === 'B' ? 90 : 0, polar: 2, llenado: 0.72 }, // deja hueco al lado del plano para el contador
    cierre: { azimut: AZ[loc] + 22, polar: 55 + POL[loc], llenado: 1.1, alto: 6.4, orbital: true }, // cabe en cualquier azimut de la órbita
  });
  /** Márgenes del plano de cierre: los de la interfaz y, abajo, la tarjeta del logotipo grande (fase 'cierre'). */
  // Tarjeta del logotipo grande: se mide su caja real (getBoundingClientRect, también oculta: visibility no quita la
  // caja) una vez por vista y tamaño de ventana o escala, no por cuadro.
  const cacheLogo = new Map();
  function margenCierre() {
    const m = estado.interfaz ? margenesUI() : {};
    const capa = typeof document !== 'undefined' ? document.querySelector('#ui .ui-capa') : null;
    const modo = capa?.dataset?.modo;
    if (estado.interfaz && capa && modo !== 'oculta') {
      const sUI = parseFloat(document.getElementById('ui')?.style.getPropertyValue('--s')) || innerHeight / 1080;
      const clave = `${modo}|${innerWidth}|${innerHeight}|${sUI}`;
      if (!cacheLogo.has(clave)) {
        const el = capa.querySelector('.marca-grande'), r = el?.getBoundingClientRect();
        // en reposo la tarjeta está 16 px × escala más abajo (entra subiendo): se mide su posición final
        cacheLogo.set(clave, r && r.height > 2 ? innerHeight - (r.top - 16 * sUI) + 18 * sUI : ((modo === 'completa' ? 176 : 76) + 190 + 24) * sUI);
      }
      m.abajo = Math.max(m.abajo || 0, cacheLogo.get(clave));
    }
    return m;
  }
  const niveles = { arq: 1, mob: 1 };
  let ultimoEncuadre = 'general', margenesUsadas = '';
  const claveM = (m) => ['arriba', 'abajo', 'izq', 'der'].map((k) => Math.round(m[k] || 0)).join(',');
  const ATEN_MEP = { arq: 0.4, mob: 0.78 };

  /** Zonas del layout en el orden de las oleadas del paso 2 (las que tienen muebles o tinte). */
  const ordenZonas = () => ZONAS.filter((z) => layout.muebles.some((m) => m.zona === z) || layout.zonas.some((q) => q.id === z && q.rects.length));
  /**
   * Recorrido por el pasillo entre góndolas más largo: entra desde la calle a ~2.1 m (algo por encima de los ojos,
   * para que la mercancía se lea a distancia) y avanza hasta poco más de la mitad del pasillo.
   */
  function recorridoPasillo() {
    const ps = (layout?.pasillos || []).filter((q) => q.tipo === 'entre_gondolas');
    if (!ps.length) return null;
    const lar = (q) => Math.hypot(q.puntos[1][0] - q.puntos[0][0], q.puntos[1][1] - q.puntos[0][1]);
    const q = ps.slice().sort((a, b) => lar(b) - lar(a) || (a.id < b.id ? -1 : 1))[0];
    let [a, b] = q.puntos; if (a[1] < b[1]) [a, b] = [b, a]; // de la calle hacia el fondo
    const L = lar(q), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    // la trayectoria va 0.4 m hacia la góndola izquierda: así la cara izquierda del pasillo se ve más al centro y
    // sale de debajo del panel de indicadores (a la izquierda); la derecha tiene pantalla libre
    const lat = [u[1] * 0.4, -u[0] * 0.4];
    a = [a[0] + lat[0], a[1] + lat[1]];
    const p0 = [a[0] - u[0] * 2.6, 2.15, a[1] - u[1] * 2.6], p1 = [a[0] + u[0] * L * 0.5, 2.0, a[1] + u[1] * L * 0.5];
    // punto de entrada y salida: afuera del local sobre el eje del pasillo (se entra y se sale por la fachada o por
    // un muro cortado, nunca atravesando la cubierta)
    const bb = cajaLocal(), dBorde = u[1] < -0.5 ? bb.z1 - a[1] : u[1] > 0.5 ? a[1] - bb.z0 : u[0] > 0.5 ? a[0] - bb.x0 : bb.x1 - a[0];
    // entrada y salida a la altura del recorrido: la fachada se corta por completo mientras la cámara pasa
    const fuera = dBorde + 6, pm = [a[0] - u[0] * fuera, 2.4, a[1] - u[1] * fuera], pm2 = [a[0] - u[0] * (fuera + 3), 2.6, a[1] - u[1] * (fuera + 3)];
    return { p0, t0: [p0[0] + u[0] * 7, 1.05, p0[2] + u[1] * 7], p1, t1: [p1[0] + u[0] * 7, 1.0, p1[2] + u[1] * 7], pm, pm2, tm: [a[0] + u[0] * 4, 1.2, a[1] + u[1] * 4] };
  }
  /** Tras un cambio de layout o de local: cubierta y capas que estaban visibles vuelven (re-trazo en paralelo). */
  function retrazar(visibles, loc) {
    if (!visibles.length) return anim.wait(0);
    return anim.seq([
      () => anim.all([ops.atenuar(ATEN_MEP, 600), cubierta.montar(loc, { ritmo: 0.7 })]),
      // re-trazo en paralelo, con los arranques separados unos cuadros (cada arranque prepara su capa: no todos juntos)
      () => anim.all(visibles.map((c, i) => anim.seq([i * 70, () => mep.trazar([c])]))),
    ]);
  }

  // ---------- Operaciones ----------
  const ops = {
    anim,
    get local() { return LOCALES[estado.local]; },
    get layout() { return layout; },
    get estado() { return estado; },
    /** Calcula y publica el layout del local y semilla vigentes (sin animar). */
    calcularLayout(semilla = estado.semilla, modo = 'base') { const l = obtenerLayout(estado.local, semilla, null, modo); publicar(l); return l; },
    /** Escena vacía (paso 0). */
    limpiar() {
      anim.terminarTodo(); cascaron.vaciar(); muebles.preparar({ muebles: [] }); zonas.preparar({ zonas: [] }); zonas.rotulos(false);
      anim.instantaneamente(() => { mep.retraer(CAPAS); camara.desplazar(0, { dur: 0 }); }); camara.cerca = 0.3; cubierta.vaciar(); atenuar('arq', 1); atenuar('mob', 1); niveles.arq = niveles.mob = 1; camara.orbita = false;
      vistos.clear(); camara.pararDeriva();
      set({ orbita: false, fase: '', capas: { luz: false, aire: false, frio: false } });
    },
    /** Atenúa arquitectura y mobiliario (instalaciones). nivel 1 = normal. */
    /**
     * Atenuado por grupo. nivel puede ser número (mismo para los grupos dados) o {arq, mob}.
     * Con instalaciones: ATEN_MEP (arquitectura tenue, mobiliario legible).
     */
    atenuar(nivel, dur = 700, grupos = ['arq', 'mob']) {
      const dest = typeof nivel === 'number' ? Object.fromEntries(grupos.map((g) => [g, nivel])) : nivel;
      const ini = { ...niveles };
      Object.assign(niveles, dest);
      return anim.tween({ dur, ease: 'io', onUpdate: (e) => { for (const g of Object.keys(dest)) atenuar(g, ini[g] + (dest[g] - ini[g]) * e); } });
    },
    trazar(capas) { set({ capas: { ...estado.capas, ...Object.fromEntries(capas.map((c) => [c, true])) } }); return mep.trazar(capas); },
    retraer(capas) { return mep.retraer(capas); },
    camara(nombre, op = {}) {
      if (nombre === 'pasillo') {
        const p = layout?.pasillos.find((q) => q.tipo === 'principal'); const loc = LOCALES[estado.local];
        if (!p) return anim.wait(0);
        const [[x0, z0], [x1, z1]] = p.puntos; const zIni = loc.acceso.centro[1] - 1.5;
        return camara.mirar([x0 + 0.6, 1.65, zIni], [x1, 1.3, Math.min(z1 + 2, (z0 + z1) / 2)], op);
      }
      const enCierre = nombre === 'cierre' && estado.paso === pasos.length;
      camara.margenes = enCierre ? margenCierre() : estado.interfaz ? margenesUI() : {};
      margenesUsadas = claveM(estado.interfaz ? margenesUI() : {});
      if (!op.local || op.local === estado.local || nombre === 'llegada') ultimoEncuadre = nombre;
      const enc = { ...(ENCUADRES(op.local || estado.local)[nombre] || {}), ...op };
      // arco principal del paso: la deriva toma el sentido del giro (así al final del arco la cámara sigue igual)
      if (op.arco && !anim.instantaneo && enc.azimut != null) {
        const dAz = ((enc.azimut - camara.azimutActual() + 540) % 360) - 180;
        if (Math.abs(dAz) > 3) camara.deriva = Math.sign(dAz) * DERIVA;
      }
      return camara.encuadrar(cajaLocal(op.local), enc);
    },
    orbita(v) { camara.orbita = v; set({ orbita: v }); },
    localDelPaso,

    /** Escenas: cada una es un paso completo de la demo. Síncronas; devuelven Handle. */
    escenas: {
      /** Paso 1: el local se construye; la cámara baja de un plano aéreo al general. */
      local() {
        // el trabajo pesado se reparte: este cuadro solo compone el layout y arranca la obra; el plan de
        // instalaciones se calcula en otro cuadro y los muebles (desarmados) se crean de a pocos durante la obra
        const lay = layout && layout.localId === estado.local ? layout : layoutBase();
        layout = lay;
        anim.instantaneamente(() => ops.camara('aereo', { dur: 0, forzar: true }));
        return anim.all([
          ops.camara('general', { dur: 4200, delay: 200, arco: true }), cascaron.construir(LOCALES[estado.local], lay),
          anim.seq([50, () => { publicar(lay); return anim.wait(50); }, () => { zonas.preparar(lay); return anim.wait(50); }, () => muebles.preparar(lay)]),
        ]);
      },
      /**
       * Paso 2: vista general (sin acercamiento). Los muebles llegan en oleadas por zona y cada zona se va
       * viendo al llegar su oleada (tinte y rótulo). La cámara solo deriva despacio de general a frente.
       */
      mobiliario() {
        const orden = ordenZonas(), cada = 1150;
        return anim.all([
          cascaron.cortar(true, { dur: 500 }), // los muros entre la cámara y el interior se vuelven translúcidos
          zonas.revelar(orden, { inicio: 150, cada, rotulos: estado.rotulos }),
          muebles.armar({ orden, oleada: cada, inicio: 300 }),
          ops.camara('mobiliario', { dur: 9800, ease: 'io', arco: true }),
        ]);
      },
      /** Paso 3: se atenúa la arquitectura y se trazan las tres capas. */
      instalaciones() {
        // capas: arrancan escalonadas y corren a la vez; la cámara describe un arco durante todo el paso
        return anim.all([
          ops.camara('instalaciones', { dur: 15500, ease: 'io', arco: true }),
          anim.seq([
            () => anim.all([ops.atenuar(ATEN_MEP, 900), zonas.mostrar(true, { nivel: 0.5, dur: 900 }), zonas.rotulos(false), cubierta.montar(LOCALES[estado.local])]),
            () => anim.all(CAPAS.map((c, i) => anim.seq([i * 2200, () => ops.trazar([c])]))),
            // (R10) sin realce por capa: con iluminación o refrigeración solas la vista aérea se veía vacía; las tres
            // capas quedan a plena opacidad mientras la cámara termina su arco. mep.realzar sigue disponible.
          ]),
        ]);
      },
      /**
       * Paso 4: nuevo layout. Retrae capas, vista cenital, parpadeo de alternativas evaluadas, elige, los tintes y
       * muros interiores se transforman, los muebles viajan y las capas se vuelven a trazar.
       */
      nuevoLayout(semilla = estado.semilla) {
        const visibles = mep.capasVisibles();
        const previo = layout;
        const nuevo = obtenerLayout(estado.local, semilla, previo, modoSiguiente(estado.local));
        const bb = cajaLocal();
        return anim.seq([
          () => anim.all([mep.retraer(visibles), cubierta.desmontar(), ops.atenuar({ arq: 1, mob: 1 }, 700), zonas.rotulos(false)]),
          () => anim.all([ops.camara('cenital', { dur: 2700 }), zonas.mostrar(true, { nivel: 1.6, dur: 900 }), ops.atenuar(0.22, 900, ['mob'])]),
          () => zonas.parpadeo(nuevo.candidatos.muestras, { cada: 380, evaluados: nuevo.candidatos.evaluados, elegido: nuevo, centro: [(bb.x0 + bb.x1) / 2, 0.5, bb.z0 - 1.4], caja: bb, margenes: camara.margenes }),
          () => { publicar(nuevo); return anim.wait(50); }, // el plan de instalaciones en su propio cuadro
          () => anim.all([cascaron.setInteriores(nuevo), ops.atenuar(1, 600, ['mob'])]),
          () => anim.all([
            muebles.transitar(nuevo), ops.camara('traslado', { dur: 5600, delay: 0, ease: 'io', arco: true }),
            zonas.mostrar(true, { nivel: 1, dur: 1200, delay: 800 }), zonas.rotulos(estado.rotulos, { delay: 2400, cada: 120 }),
          ]),
          () => retrazar(visibles, LOCALES[estado.local]),
        ]);
      },
      /**
       * Paso 5: otro local. Los muebles que siguen se elevan por encima del pretil y esperan mientras losa, muros,
       * fachada y columnas se transforman; luego bajan a su lugar y los nuevos se arman.
       */
      otroLocal(id = localSiguiente()) {
        if (id === estado.local) return anim.wait(0);
        const visibles = mep.capasVisibles();
        const nuevo = obtenerLayout(id, estado.semilla, layout, 'mejor');
        const locA = LOCALES[estado.local];
        return anim.seq([
          () => anim.all([mep.retraer(visibles), cubierta.desmontar(), ops.atenuar({ arq: 1, mob: 1 }, 600), zonas.rotulos(false)]),
          () => { fijar(nuevo); return anim.wait(50); }, // plan de instalaciones en su propio cuadro
          () => {
            const t = muebles.tiemposLocal; // formación: suben, se sostienen sobre el local nuevo y bajan
            return anim.all([
              // los indicadores cambian cuando ya se ve el local nuevo (a media transformación del cascarón)
              anim.seq([t.subida + t.vuelo * 0.55, () => { anunciar(nuevo); return anim.wait(0); }]),
              muebles.transitar(nuevo, { modo: 'local', localAnterior: locA, localNuevo: LOCALES[id] }),
              cascaron.transformarA(LOCALES[id], nuevo, { delay: t.subida, dur: t.vuelo }),
              zonas.transformar(nuevo, { delay: t.subida, dur: t.vuelo }),
              ops.camara('llegada', { local: id, delay: 300, dur: t.subida + t.vuelo + t.bajada, ease: 'io', arco: true }),
              zonas.rotulos(estado.rotulos, { delay: t.subida + t.vuelo + t.bajada + 400, cada: 120 }),
            ]);
          },
          () => retrazar(visibles, LOCALES[estado.local]),
        ]);
      },
      /**
       * Paso 7: acercamiento progresivo (viaje esférico) a la entrada de un pasillo de góndolas, recorrido a ~2 m con
       * el mobiliario a opacidad y color plenos y la imagen desplazada al centro del área libre de la interfaz; luego
       * sube al plano de cierre (encuadre orbital) y órbita lenta.
       */
      cierre() {
        const capas = mep.capasVisibles().length > 0;
        const f7 = objetivoPaso(6, D) / 21; // reparto del paso 7 con D = 90: entrada 2 · recorrido ≈ 14 · salida 2.5 · órbita
        camara.margenes = estado.interfaz ? margenesUI() : {};
        const VEL = VEL_RECORRIDO;
        // la ruta ya viene precalculada en reposo desde que se fijó el layout (rutaDe); si no, se calcula aquí
        const R = layout ? rutaDe(layout, true) : null;
        const pasos = [];
        const prep = () => anim.all([zonas.rotulos(false), ops.atenuar({ arq: 1, mob: 1 }, 500), zonas.mostrar(true, { nivel: 0.35, dur: 500 })]);
        camara.cerca = 0.3;
        fase('recorrido'); // la interfaz desvanece los indicadores desde el descenso hasta la órbita de cierre
        const bb = cajaLocal();
        let azCierre = AZ[estado.local] + 22;
        if (R && R.n > 20) {
          const OJOS = 1.65, n = R.n;
          // primera persona a 1.65 m por la ruta con la mirada precalculada (escena/recorrido.js). Arranca con una
          // aceleración corta (0.6 s) y termina en marcha: la salida sigue con la misma velocidad.
          const muestra = (sm, out) => { const f = Math.min(n - 1.001, Math.max(0, sm / R.paso)), i = Math.floor(f), t = f - i;
            out[0] = R.xs[i] + (R.xs[i + 1] - R.xs[i]) * t; out[1] = R.zs[i] + (R.zs[i + 1] - R.zs[i]) * t; out[2] = R.yaw[i] + (R.yaw[i + 1] - R.yaw[i]) * t; out[3] = R.pitch[i] + (R.pitch[i + 1] - R.pitch[i]) * t; };
          const pa = [0, 0, 0, 0];
          const mirarDesde = (sm, P, T) => { muestra(sm, pa); const cp = Math.cos(pa[3]); P.set(pa[0], OJOS, pa[1]); T.set(pa[0] + Math.sin(pa[2]) * cp * 3, OJOS + Math.sin(pa[3]) * 3, pa[1] + Math.cos(pa[2]) * cp * 3); };
          const durRec = (R.largo / VEL) * 1000;
          // la marcha es uniforme: el descenso llega ya a la velocidad de la marcha
          const ver = (k, P, T) => mirarDesde(k * R.largo, P, T);
          const V0 = new THREE_V(), T0 = new THREE_V(); mirarDesde(0, V0, T0);
          // entrada (≈ 3 s): descenso continuo tipo dron desde la pose actual hasta la puerta, con el acceso en cuadro.
          // Bézier cúbica en posición y en objetivo: sale con la velocidad de la deriva y llega con la de la marcha.
          const durEnt = 3000 * f7, Te = durEnt / 1000;
          const acc = LOCALES[estado.local].acceso, nA = acc.normal;
          const puerta = [acc.centro[0] - nA[0] * 1.5, 1.4, acc.centro[1] - nA[1] * 1.5];
          const muestra0 = [0, 0, 0, 0]; muestra(0.3, muestra0);
          const uIni = [(muestra0[0] - V0.x) / 0.3, (muestra0[1] - V0.z) / 0.3];
          const bz = (a, b, c, d2, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d2; };
          let EP = null, ET = null;
          const prepararEntrada = () => {
            const pc = [esc.camara.position.x, esc.camara.position.y, esc.camara.position.z], tc = camara.controles.target.toArray();
            const vp = camara.velDeriva(pc, [0, 0, 0]), vt = camara.velDeriva(tc, [0, 0, 0]);
            const p3 = [V0.x, V0.y, V0.z];
            // pasa por un punto frente al acceso (10 m hacia la calle, 4.5 m de alto): el descenso llega de frente
            const W = [acc.centro[0] + nA[0] * 10, 4.5, acc.centro[1] + nA[1] * 10];
            const h1 = 0.55 * Te, h2 = 0.45 * Te;
            const vW = [(p3[0] - W[0]) / h2 * 0.8, (p3[1] - W[1]) / h2 * 0.9, (p3[2] - W[2]) / h2 * 0.8];
            EP = { p0: pc, m0: vp.map((v) => v * h1), w: W, mw1: vW.map((v) => v * h1), mw2: vW.map((v) => v * h2), p3, m3: [uIni[0] * VEL * h2, 0, uIni[1] * VEL * h2] };
            const t3 = [T0.x, T0.y, T0.z];
            ET = [tc, [tc[0] + vt[0] * Te / 3, tc[1], tc[2] + vt[2] * Te / 3], puerta, t3];
            camara.pararDeriva();
          };
          const herm = (a, ma, b, mb, t, k) => { const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * ma[k] + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * mb[k]; };
          const entrar = (k, P, T) => {
            if (k < 0.55) { const t = k / 0.55; P.set(herm(EP.p0, EP.m0, EP.w, EP.mw1, t, 0), herm(EP.p0, EP.m0, EP.w, EP.mw1, t, 1), herm(EP.p0, EP.m0, EP.w, EP.mw1, t, 2)); }
            else { const t = (k - 0.55) / 0.45; P.set(herm(EP.w, EP.mw2, EP.p3, EP.m3, t, 0), herm(EP.w, EP.mw2, EP.p3, EP.m3, t, 1), herm(EP.w, EP.mw2, EP.p3, EP.m3, t, 2)); }
            T.set(bz(ET[0][0], ET[1][0], ET[2][0], ET[3][0], k), bz(ET[0][1], ET[1][1], ET[2][1], ET[3][1], k), bz(ET[0][2], ET[1][2], ET[2][2], ET[3][2], k));
          };
          // salida: sigue hacia la fachada de cristal más cercana a baja altura, la cruza y sube por fuera hasta el
          // plano de cierre (curva de Hermite con la velocidad de la marcha al inicio y la de la órbita al final)
          const fin = [0, 0, 0, 0]; muestra(R.largo, fin); muestra(R.largo - 0.3, pa);
          const uMar = [(fin[0] - pa[0]) / 0.3, (fin[1] - pa[1]) / 0.3];
          const sal = R.salida ? R.salida.dir : uMar;
          const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
          // fachada: distancia desde el final hasta salir del polígono en la dirección de salida
          let dFach = 0; while (dFach < 12 && dentroLocal(fin[0] + sal[0] * dFach, fin[1] + sal[1] * dFach)) dFach += 0.25;
          const Q = [fin[0] + sal[0] * (dFach + 2.5), 2.3, fin[1] + sal[1] * (dFach + 2.5)];
          azCierre = 0.6 * (Math.atan2(-(Q[0] - cx), Q[2] - cz) / DEG_) + 0.4 * (AZ[estado.local] + 22);
          let cierre = null; // se calcula al empezar la salida (márgenes vigentes)
          const durSal = 3200 * f7, t1 = 0.36; // fracción en la que cruza la fachada
          const tgtIni = [0, 0, 0], dir0 = [0, 0], dir1 = [0, 0, 1]; let dYaw = 0;
          const hermite = (p0, m0, p1, m1, t, k) => { const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * p0[k] + (t3 - 2 * t2 + t) * m0[k] + (-2 * t3 + 3 * t2) * p1[k] + (t3 - t2) * m1[k]; };
          let M0, M1, M2, P0;
          const prepararSalida = () => {
            camara.margenes = margenCierre();
            const c = camara.ajustar(bb, { ...ENCUADRES(estado.local).cierre, azimut: azCierre, orbital: true });
            cierre = c;
            camara.pivote.set(cx, (ENCUADRES(estado.local).cierre.alto ?? 5.4) * 0.25, cz);
            P0 = [fin[0], OJOS, fin[1]];
            const T_s = durSal / 1000, h0 = t1 * T_s, h1 = (1 - t1) * T_s;
            // tangentes de Hermite (m = velocidad × duración del tramo)
            M0 = [(uMar[0] * 0.25 + sal[0] * 0.75) * VEL * h0 * 0.6, 0.4 * h0, (uMar[1] * 0.25 + sal[1] * 0.75) * VEL * h0 * 0.6];
            const vQ = [(cierre.pos[0] - P0[0]) / T_s, (cierre.pos[1] - P0[1]) / T_s * 0.5, (cierre.pos[2] - P0[2]) / T_s];
            const vs = Math.hypot(vQ[0], vQ[2]) || 1, vSal = Math.max(VEL, Math.hypot(Q[0] - P0[0], Q[2] - P0[2]) / h0);
            // en la fachada la cámara va hacia afuera (dirección de salida) y empieza a subir
            M1 = [(sal[0] * vSal * 0.8 + vQ[0] / vs * vSal * 0.2) * h0, 1.2 * h0, (sal[1] * vSal * 0.8 + vQ[2] / vs * vSal * 0.2) * h0];
            const M1b = [M1[0] * h1 / h0, M1[1] * h1 / h0, M1[2] * h1 / h0];
            const w = (3 * DEG_), rx = cierre.pos[0] - cx, rz = cierre.pos[2] - cz; // velocidad de la órbita al llegar
            M2 = [-rz * w * h1, 0, rx * w * h1];
            M1 = M1b.map((v, i) => v); // el segundo tramo usa la tangente escalada a su duración
            M1.h0 = [M1b[0] * h0 / h1, M1b[1] * h0 / h1, M1b[2] * h0 / h1];
            const cp = Math.cos(fin[3]); tgtIni[0] = fin[0] + Math.sin(fin[2]) * cp * 3; tgtIni[1] = OJOS + Math.sin(fin[3]) * 3; tgtIni[2] = fin[1] + Math.cos(fin[2]) * cp * 3;
            const dx = cierre.obj[0] - cierre.pos[0], dy = cierre.obj[1] - cierre.pos[1], dz = cierre.obj[2] - cierre.pos[2], dl = Math.hypot(dx, dy, dz);
            dir0[0] = fin[2]; dir0[1] = fin[3];
            dir1[0] = Math.atan2(dx, dz); dir1[1] = Math.asin(dy / dl); dir1[2] = dl;
            dYaw = Math.atan2(Math.sin(dir1[0] - dir0[0]), Math.cos(dir1[0] - dir0[0]));
          };
          const salirH = (k, P, T) => {
            // primer tramo con la tangente de la fachada escalada a su duración
            if (k < t1) { const t = k / t1; const m1 = M1.h0; P.set(hermite(P0, M0, Q, m1, t, 0), hermite(P0, M0, Q, m1, t, 1), hermite(P0, M0, Q, m1, t, 2)); }
            else { const t = (k - t1) / (1 - t1); P.set(hermite(Q, M1, cierre.pos, M2, t, 0), hermite(Q, M1, cierre.pos, M2, t, 1), hermite(Q, M1, cierre.pos, M2, t, 2)); }
            // la mirada gira por rumbo y cabeceo (velocidad angular acotada), no por un objetivo que cruza cerca
            const e = EASE_IO(Math.min(1, k / 0.94)), q = Math.min(1, k / 0.7), ey = 1 - (1 - q) * (1 - q);
            const yw = dir0[0] + dYaw * ey, pt = dir0[1] + (dir1[1] - dir0[1]) * e, cpp = Math.cos(pt);
            if (k >= 0.94) T.set(cierre.obj[0], cierre.obj[1], cierre.obj[2]);
            else { const L = 3 + (dir1[2] - 3) * e; T.set(P.x + Math.sin(yw) * cpp * L, P.y + Math.sin(pt) * L, P.z + Math.cos(yw) * cpp * L); }
          };
          pasos.push(
            () => { prepararEntrada(); return anim.all([prep(), camara.trayecto(entrar, { dur: durEnt }), camara.desplazar(1, { dur: durEnt * 0.8 }), cascaron.cortarTodo(true, { dur: 400, delay: durEnt * 0.45 }),
              anim.seq([durEnt * 0.85, () => { camara.cerca = 1.0; return anim.wait(0); }])]); },
            () => { camara.cerca = 1.0; return camara.trayecto(ver, { dur: durRec }); },
            () => { prepararSalida(); return anim.all([camara.trayecto(salirH, { dur: durSal }), camara.desplazar(0, { dur: durSal }),
              anim.seq([durSal * 0.55, () => { camara.cerca = 0.3; return anim.all([cascaron.cortarTodo(false, { dur: 700 }),
                ops.atenuar(capas ? { arq: 0.7, mob: 1 } : { arq: 1, mob: 1 }, 1000, ['arq', 'mob']), zonas.mostrar(true, { nivel: capas ? 0.5 : 1, dur: 1000 })]); }])]); },
          );
        } else {
          pasos.push(prep, () => { camara.margenes = margenCierre(); return anim.all([ops.camara('cierre', { dur: 2000, ease: 'io', azimut: azCierre }), camara.desplazar(0, { dur: 1600 }),
            ops.atenuar(capas ? { arq: 0.7, mob: 1 } : { arq: 1, mob: 1 }, 1000, ['arq', 'mob']), zonas.mostrar(true, { nivel: capas ? 0.5 : 1, dur: 1000 })]); });
        }
        pasos.push(
          () => { ultimoEncuadre = 'cierre'; margenesUsadas = claveM(estado.interfaz ? margenesUI() : {}); ops.orbita(true); camara.arrancarOrbita(); fase('cierre'); cascaron.cortarTodo(false, { dur: 0 });
            // la órbita sigue sola; el paso termina cuando se cumple su duración objetivo
            return anim.wait(anim.instantaneo ? 0 : Math.max(1500, objetivoPaso(6, D) * 1000 - (reloj.ahora - tInicio))); },
        );
        const tInicio = reloj.ahora;
        return anim.seq(pasos);
      },
    },
    // nombres de la fase A (compatibilidad con el director marcador)
    construirLocal: () => ops.escenas.local(),
    armarMuebles: () => ops.escenas.mobiliario(),
    rotulos: (ver) => zonas.rotulos(ver && estado.rotulos),
    generar: (s) => ops.escenas.nuevoLayout(s),
    cambiarLocal: (id) => ops.escenas.otroLocal(id),
  };

  /**
   * Reencuadre suave cuando cambian los márgenes de la interfaz (H, M, J, o la aparición del panel): repite el
   * último encuadre con nombre. En órbita conserva el azimut actual. No actúa con la cámara en manos del usuario.
   */
  function reencuadrar(dur = 900) {
    if (estado.paso < 1 || estado.ocupado || camara.manual) return;
    const m = estado.interfaz ? margenesUI() : {};
    if (claveM(m) === margenesUsadas) return;
    ops.camara(ultimoEncuadre, estado.orbita ? { dur, azimut: camara.azimutActual(), orbital: true } : { dur });
  }

  // ---------- Cola con bloqueo ----------
  // Una acción grande corre a la vez. Mientras corre, a lo más UNA queda pendiente (la última gana; la
  // desplazada se resuelve {estado:'descartada'}). Las capas tienen su propio carril: se sincronizan al vaciarse.
  let pendiente = null, capasPendientes = false;
  function accion(nombre, fn) {
    return new Promise((resolve) => {
      const t = { nombre, fn, resolve };
      if (estado.ocupado) { pendiente?.resolve({ estado: 'descartada', accion: pendiente.nombre }); pendiente = t; return; }
      correr(t);
    });
  }
  async function correr(t) {
    set({ ocupado: true, accion: t.nombre }, 'ocupado');
    try { const r = t.fn(); await (r?.done ?? r); t.resolve({ estado: 'hecha', accion: t.nombre }); }
    catch (e) { console.error('[tienda] acción fallida', t.nombre, e); t.resolve({ estado: 'error', accion: t.nombre, error: String(e) }); }
    if (pendiente) { const p = pendiente; pendiente = null; return correr(p); }
    if (capasPendientes) { capasPendientes = false; return correr({ nombre: 'capas', fn: sincronizarCapas, resolve: () => {} }); }
    set({ ocupado: false, accion: null }, 'ocupado');
    reencuadrar(); // si la interfaz cambió de forma durante la acción
    em.emit('libre', estado);
  }
  function sincronizarCapas() {
    const ver = mep.capasVisibles();
    const quitar = ver.filter((c) => !estado.capas[c]);
    const poner = CAPAS.filter((c) => estado.capas[c] && !ver.includes(c));
    const algo = CAPAS.some((c) => estado.capas[c]);
    return anim.seq([
      () => anim.all([quitar.length ? mep.retraer(quitar) : null, !algo ? cubierta.desmontar() : null]),
      () => anim.all([algo !== (niveles.arq < 0.9) ? ops.atenuar(algo ? ATEN_MEP : { arq: 1, mob: 1 }, 600) : null, algo && estado.paso >= 1 ? cubierta.montar(LOCALES[estado.local]) : null]),
      () => (poner.length ? mep.trazar(poner) : anim.wait(0)),
    ]);
  }

  /** Lleva la demo al paso n. Si n = actual+1 anima solo ese paso; si no, reconstruye 1..n-1 al instante. */
  async function irA(n, { instantaneo = false } = {}) {
    ficha++; // mata cualquier vaivén anterior
    n = Math.max(0, Math.min(pasos.length, n));
    const animarUltimo = !instantaneo && n === estado.paso + 1;
    const p = n > 0 ? pasos[n - 1] : null;
    const info = p ? { id: p.id, titulo: (p.local && p.tituloPorLocal?.[localDelPaso(p.local)]) || p.titulo, rotulo: p.rotulo } : null;
    // el paso se publica ANTES de reconstruir: la interfaz muestra ya el panel de ese paso y los encuadres lo respetan
    if (!animarUltimo) set({ paso: n, pasoInfo: info }, 'paso');
    if (!animarUltimo) {
      const loc0 = params.local, sem0 = params.semilla;
      ops.limpiar();
      // reconstrucción determinista desde el local y la semilla de arranque
      layout = null; set({ local: loc0, semilla: sem0, layoutId: null, indicadores: null, indicadoresPrevios: null, calificacion: null, calificacionAnterior: null });
      anim.instantaneamente(() => { for (let i = 1; i < n + (instantaneo ? 1 : 0); i++) pasos[i - 1].entrar(ops, { instantaneo: true }); });
      if (n === 0) set({ layoutId: null, calificacion: null, calificacionAnterior: null, esMejor: false, ranking: null, candidatos: null });
    }
    if (animarUltimo) set({ paso: n, pasoInfo: info }, 'paso');
    if (estado.paso !== pasos.length && estado.fase) fase('');
    if (n > 0 && n < pasos.length) {
      if (estado.reproduciendo) camara.deriva = camara.deriva || DERIVA; // deriva en espera (pasos 1-6)
      else if (instantaneo) { camara.deriva = (Math.sign(camara.deriva) || 1) * DERIVA_ESPERA; vaiven(ficha, n, vaivenPrimero(n)); }
    }
    if (n > 0 && (animarUltimo || !instantaneo)) {
      anim.ritmo = n < pasos.length ? ritmoPaso(n - 1, D) : 1; // el paso 7 reparte su tiempo él mismo
      try { const h = p.entrar(ops, { instantaneo: false }); await h?.done; } finally { anim.ritmo = 1; }
      if (!estado.reproduciendo && n < pasos.length) remanso(4000, true);
    }
  }

  /**
   * Remanso de los pasos 1-6: la deriva sube a 4.5 °/s y la cámara se acerca un 12 % (3 % en el paso 2) en `dur` ms. Con avance manual
   * (dur = 4 s) al terminar el acercamiento la deriva baja a 3 °/s y sigue hasta que se avanza.
   */
  /** Vaivén de espera: invierte el signo de la deriva cada medio periodo; muere si cambia la ficha, el paso, hay acción, reproducción o el usuario tomó la cámara. */
  let ficha = 0;
  function vaiven(f, paso, ms) {
    anim.wait(ms).onDone(() => {
      if (f !== ficha || paso !== estado.paso || estado.ocupado || estado.reproduciendo || camara.manual || paso >= pasos.length) return;
      camara.deriva = -camara.deriva;
      vaiven(f, paso, vaivenPeriodo(paso));
    });
  }
  function remanso(dur, manualAvance = false) {
    if (estado.paso < 1 || estado.paso >= pasos.length || camara.manual) return;
    const sg = Math.sign(camara.deriva) || 1;
    camara.deriva = sg * (manualAvance ? DERIVA_ESPERA : DERIVA_REMANSO); // en espera manual arranca el vaivén
    // en el paso 2 el encuadre va más lleno: con 12 % la esquina del edificio tocaba el borde inferior
    camara.acercar(manualAvance ? ESPERA[estado.paso].acercar : estado.paso === 2 ? 0.03 : ACERCAR, { dur: Math.max(300, dur) });
    if (manualAvance) vaiven(ficha, estado.paso, vaivenPrimero(estado.paso));
  }
  const acciones = {
    siguiente: () => accion('siguiente', () => (estado.paso < pasos.length ? irA(estado.paso + 1) : null)),
    anterior: () => accion('anterior', () => irA(Math.max(1, estado.paso - 1), { instantaneo: true })),
    irAPaso: (n, op) => accion(`paso ${n}`, () => irA(n, op)),
    /** Nuevo layout; con semilla (entero) usa la evaluación de esa semilla. Sin argumento, la vigente (tecla G, paso 4). */
    generar: (semilla) => accion('generar', () => (estado.paso >= 2 ? ops.escenas.nuevoLayout(Number.isFinite(semilla) ? Math.floor(semilla) >>> 0 : estado.semilla) : null)),
    cambiarLocal: (id) => accion(`local ${id}`, () => {
      if (!IDS_LOCALES.includes(id) || id === estado.local) return null;
      if (estado.paso >= 2) return ops.escenas.otroLocal(id);
      // antes de que haya muebles: se reconstruye el local nuevo
      set({ local: id }); layout = null; params.local = id;
      return estado.paso >= 1 ? ops.escenas.local() : null;
    }),
    capa(id, ver = !estado.capas[id]) {
      if (!CAPAS.includes(id)) return Promise.resolve({ estado: 'descartada' });
      set({ capas: { ...estado.capas, [id]: ver } });
      if (estado.ocupado) { capasPendientes = true; return Promise.resolve({ estado: 'encolada' }); }
      return accion('capas', sincronizarCapas);
    },
    async reproducir(v = !estado.reproduciendo) {
      ficha++;
      set({ reproduciendo: v });
      while (estado.reproduciendo && estado.paso < pasos.length) {
        // cada paso dura su objetivo: lo que sobra tras la acción es remanso (la cámara sigue con la deriva)
        const i = estado.paso, t0 = reloj.ahora;
        await acciones.siguiente();
        if (estado.reproduciendo && estado.paso < pasos.length) {
          const resta = Math.max(150, t0 + objetivoPaso(i, D) * 1000 - reloj.ahora);
          remanso(resta);
          await anim.wait(resta).done;
        }
      }
      set({ reproduciendo: false });
    },
    reiniciar: () => { ficha++; set({ reproduciendo: false }); camara.recuperar(); return accion('reiniciar', () => irA(0, { instantaneo: true })); },
    interfaz(v = !estado.interfaz) {
      if (v !== estado.interfaz) set({ interfaz: v });
      // reencuadre suave para respetar (o liberar) los márgenes de la interfaz; se mide un instante después,
      // cuando la interfaz ya pintó su nueva vista (J y M no cambian estado.interfaz, solo la forma)
      anim.wait(60).onDone(() => reencuadrar());
    },
    rotulos: (v = !estado.rotulos) => { set({ rotulos: v }); zonas.rotulos(v && estado.paso >= 2 && estado.paso !== 3 && estado.paso !== pasos.length); },
    orbita: (v = !estado.orbita) => ops.orbita(v),
    /** Selecciona el mueble bajo el punto de pantalla (ficha). null si no hay. */
    elegirEn(xNdc, yNdc) {
      const m = esc.elegir(xNdc, yNdc, muebles.cajas());
      const s = m ? { id: m.id, familia: m.familia, nombre: FAMILIAS[m.familia]?.nombre ?? m.familia, zona: m.zona, nombreZona: NOMBRE_ZONA[m.zona], ancho: m.ancho, fondo: m.fondo, alto: m.alto, tramos: m.variante?.tramos ?? 1, supuesto: !!FAMILIAS[m.familia]?.supuesto } : null;
      set({ seleccion: s }, 'seleccion'); return s;
    },
    deseleccionar: () => set({ seleccion: null }, 'seleccion'),
  };

  return {
    estado, acciones, ops, on: em.on.bind(em), precalcularTodo,
    get layout() { return layout; },
    libre: () => (estado.ocupado ? new Promise((r) => { const off = em.on('libre', () => { off(); r(); }); }) : Promise.resolve()),
  };
}
