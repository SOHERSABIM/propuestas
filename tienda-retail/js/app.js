// Aplicación: estado observable, cola de acciones con bloqueo, escenas de la demo y operaciones. Frente: núcleo.
// La interfaz (frente 4) SOLO lee app.estado, escucha app.on(...) y llama app.acciones.*. El director de pasos
// (interfaz/director.js) compone con ops.escenas.* (cada escena es un paso completo: cámara incluida).
import { crearEmisor } from './core/eventos.js';
import { LOCALES, IDS_LOCALES } from './datos/locales.js';
import { crearEvaluacion, componerLayout, mejorIndice } from './gen/generador.js';
import { planInstalaciones } from './instalaciones/plan.js';
import { atenuar } from './core/estilo.js';
import { caja } from './core/geom.js';
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
  };
  let layout = null;
  const set = (patch, ev) => { Object.assign(estado, patch); if (ev) em.emit(ev, estado); em.emit('estado', estado); };

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
    for (const loc of IDS_LOCALES) for (const modo of ['base', 'mejor']) specs.push(...componerLayout(evaluacion(loc, params.semilla), { modo, anterior: null, vistos: [] }).muebles);
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
  function fijar(lay) { layout = lay; mep.setPlan(LOCALES[lay.localId], lay); }
  /** Lo visible: estado, indicadores y calificación (en los cambios de local, cuando ya aparece el local nuevo). */
  function anunciar(lay) {
    set({ semilla: lay.semilla, local: lay.localId, layoutId: lay.id, indicadoresPrevios: estado.indicadores, indicadores: indicadoresDe(lay),
      calificacionAnterior: estado.calificacion, calificacion: lay.calificacion, esMejor: lay.esMejor, ranking: lay.ranking,
      candidatos: { evaluados: lay.candidatos.evaluados, validos: lay.candidatos.validos, descartes: lay.candidatos.descartes } }, 'layout');
    em.emit('indicadores', estado);
    em.emit('calificacion', estado);
  }

  const cajaLocal = (id = estado.local) => caja(LOCALES[id].poligono);
  /** Azimut base por local: el lado largo del local queda horizontal en pantalla. */
  const AZ = { A: 36, B: 66, C: 40 };
  const POL = { A: 0, B: 6, C: 0 }; // B: algo más cenital para ver por encima del muro largo cercano
  const ENCUADRES = (loc) => ({
    general: { azimut: AZ[loc], polar: 52 + POL[loc], llenado: 0.9 },
    aereo: { azimut: AZ[loc] - 18, polar: 30, llenado: 0.42 },
    frente: { azimut: AZ[loc] - 10, polar: 56 + POL[loc], llenado: 0.9 },
    mobiliario: { azimut: AZ[loc] - 4, polar: 47 + POL[loc], llenado: 0.9 }, // paso 2: deriva leve desde general, algo más alta
    instalaciones: { azimut: AZ[loc] + 6, polar: 44 + POL[loc], llenado: 0.92 },
    cenital: { azimut: loc === 'B' ? 90 : 0, polar: 2, llenado: 0.82 }, // deja hueco al lado del plano para el contador
    cierre: { azimut: AZ[loc] + 22, polar: 55 + POL[loc], llenado: 0.96, alto: 6.4, orbital: true }, // cabe en cualquier azimut de la órbita
  });
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
    const p0 = [a[0] - u[0] * 2.6, 2.15, a[1] - u[1] * 2.6], p1 = [a[0] + u[0] * L * 0.5, 2.0, a[1] + u[1] * L * 0.5];
    // punto de entrada y salida: afuera del local sobre el eje del pasillo (se entra y se sale por la fachada o por
    // un muro cortado, nunca atravesando la cubierta)
    const bb = cajaLocal(), dBorde = u[1] < -0.5 ? bb.z1 - a[1] : u[1] > 0.5 ? a[1] - bb.z0 : u[0] > 0.5 ? a[0] - bb.x0 : bb.x1 - a[0];
    const fuera = dBorde + 6, pm = [a[0] - u[0] * fuera, 4.2, a[1] - u[1] * fuera], pm2 = [a[0] - u[0] * (fuera + 2), 6.5, a[1] - u[1] * (fuera + 2)];
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
      anim.instantaneamente(() => { mep.retraer(CAPAS); camara.desplazar(0, { dur: 0 }); }); cubierta.vaciar(); atenuar('arq', 1); atenuar('mob', 1); niveles.arq = niveles.mob = 1; camara.orbita = false;
      vistos.clear();
      set({ orbita: false, capas: { luz: false, aire: false, frio: false } });
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
      camara.margenes = estado.interfaz ? margenesUI() : {};
      margenesUsadas = claveM(camara.margenes);
      if (!op.local || op.local === estado.local) ultimoEncuadre = nombre;
      return camara.encuadrar(cajaLocal(op.local), { ...(ENCUADRES(op.local || estado.local)[nombre] || {}), ...op });
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
          ops.camara('general', { dur: 4200, delay: 200 }), cascaron.construir(LOCALES[estado.local], lay),
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
          ops.camara('mobiliario', { dur: 9500, ease: 'sine' }),
        ]);
      },
      /** Paso 3: se atenúa la arquitectura y se trazan las tres capas. */
      instalaciones() {
        return anim.seq([
          () => anim.all([ops.atenuar(ATEN_MEP, 900), zonas.mostrar(true, { nivel: 0.5, dur: 900 }), zonas.rotulos(false), ops.camara('instalaciones', { dur: 1800 }), cubierta.montar(LOCALES[estado.local])]),
          () => ops.trazar(CAPAS),
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
          () => anim.all([ops.camara('cenital', { dur: 1500 }), zonas.mostrar(true, { nivel: 1.6, dur: 900 }), ops.atenuar(0.22, 900, ['mob'])]),
          () => zonas.parpadeo(nuevo.candidatos.muestras, { evaluados: nuevo.candidatos.evaluados, elegido: nuevo, centro: [(bb.x0 + bb.x1) / 2, 0.5, bb.z0 - 1.4], caja: bb, margenes: camara.margenes }),
          () => { publicar(nuevo); return anim.wait(50); }, // el plan de instalaciones en su propio cuadro
          () => anim.all([cascaron.setInteriores(nuevo), ops.atenuar(1, 600, ['mob'])]),
          () => anim.all([
            muebles.transitar(nuevo), ops.camara('general', { dur: 2600, delay: 200 }),
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
              ops.camara('general', { local: id, delay: t.subida - 300, dur: t.vuelo + 600 }),
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
        const r = recorridoPasillo(), capas = mep.capasVisibles().length > 0;
        camara.margenes = estado.interfaz ? margenesUI() : {};
        const pasos = [() => anim.all([zonas.rotulos(false), ops.atenuar({ arq: 1, mob: 1 }, 700), zonas.mostrar(true, { nivel: 0.35, dur: 700 })])];
        if (r) pasos.push(
          // se acerca por fuera hasta el eje del pasillo, entra por la fachada, recorre y sale por donde entró
          () => anim.all([camara.viajar(r.pm, r.tm, { dur: 3000, ease: 'io' }), camara.desplazar(1, { dur: 2400, delay: 600 })]),
          () => camara.mirar(r.p0, r.t0, { dur: 2200, ease: 'io' }),
          () => camara.mirar(r.p1, r.t1, { dur: 4200, ease: 'sine' }),
          () => camara.mirar(r.pm2, r.t1, { dur: 2600, ease: 'io' }),
        );
        pasos.push(
          () => anim.all([ops.camara('cierre', { dur: 3200 }), camara.desplazar(0, { dur: 2000 }),
            ops.atenuar(capas ? { arq: 0.7, mob: 1 } : { arq: 1, mob: 1 }, 1200, ['arq', 'mob']), zonas.mostrar(true, { nivel: capas ? 0.5 : 1, dur: 1200 })]),
          () => { ops.orbita(true); return anim.wait(0); },
        );
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
    if (n > 0 && (animarUltimo || !instantaneo)) { const h = p.entrar(ops, { instantaneo: false }); await h?.done; }
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
      set({ reproduciendo: v });
      while (estado.reproduciendo && estado.paso < pasos.length) {
        await acciones.siguiente();
        if (estado.reproduciendo && estado.paso < pasos.length) await anim.wait(1500).done;
      }
      set({ reproduciendo: false });
    },
    reiniciar: () => { set({ reproduciendo: false }); camara.recuperar(); return accion('reiniciar', () => irA(0, { instantaneo: true })); },
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
