// Aplicación: estado observable, cola de acciones con bloqueo, escenas de la demo y operaciones. Frente: núcleo.
// La interfaz (frente 4) SOLO lee app.estado, escucha app.on(...) y llama app.acciones.*. El director de pasos
// (interfaz/director.js) compone con ops.escenas.* (cada escena es un paso completo: cámara incluida).
import { crearEmisor } from './core/eventos.js';
import { LOCALES, IDS_LOCALES } from './datos/locales.js';
import { crearEvaluacion, componerLayout, mejorIndice } from './gen/generador.js';
import { atenuar } from './core/estilo.js';
import { caja } from './core/geom.js';
import { FAMILIAS, NOMBRE_ZONA } from './datos/catalogo.js';

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
export function crearApp({ params, anim, reloj, cascaron, muebles, zonas, mep, camara, pasos, esc, margenesUI = () => ({}) }) {
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
  const vistos = { A: [], B: [], C: [] };
  const evaluacion = (loc, semilla) => { const k = `${loc}:${semilla}`; if (!evals.has(k)) evals.set(k, crearEvaluacion(LOCALES[loc], semilla)); return evals.get(k); };
  function obtenerLayout(loc, semilla, anterior, modo) {
    const ev = evaluacion(loc, semilla);
    if (modo === 'mejor' && vistos[loc].includes(mejorIndice(ev))) modo = 'siguiente';
    const lay = componerLayout(ev, { modo, anterior, vistos: vistos[loc] });
    if (!vistos[loc].includes(lay.candidato)) vistos[loc].push(lay.candidato);
    return lay;
  }
  const modoSiguiente = () => 'mejor'; // obtenerLayout baja a 'siguiente' si el mejor ya se mostró
  const localSiguiente = () => IDS_LOCALES[(IDS_LOCALES.indexOf(estado.local) + 1) % IDS_LOCALES.length];
  /** Evalúa en reposo, un candidato por cuadro, lo que falte de las evaluaciones de la semilla vigente. */
  function precalcular() {
    if (estado.ocupado || anim.activos > 0) return;
    for (const loc of IDS_LOCALES) { const ev = evaluacion(loc, estado.semilla); if (!ev.terminado) { ev.paso(1); return; } }
  }
  reloj.onTick(precalcular, 95);
  /** Al arrancar: las tres evaluaciones de la semilla inicial (≈1 s, antes de "ready"). */
  function precalcularTodo() { for (const loc of IDS_LOCALES) evaluacion(loc, params.semilla).terminar(); }

  function indicadoresDe(lay) {
    const mi = mep.indicadores();
    return { ...lay.indicadores, ...Object.fromEntries(Object.entries(mi).filter(([, v]) => v != null)) };
  }
  /** Publica un layout como vigente (estado, eventos e indicadores). */
  function publicar(lay) {
    layout = lay;
    mep.setPlan(LOCALES[lay.localId], lay);
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
    frente: { azimut: AZ[loc] - 10, polar: 56 + POL[loc], llenado: 0.94 },
    instalaciones: { azimut: AZ[loc] + 6, polar: 44 + POL[loc], llenado: 0.92 },
    cenital: { azimut: loc === 'B' ? 90 : 0, polar: 2, llenado: 0.88 },
    cierre: { azimut: AZ[loc] + 22, polar: 55 + POL[loc], llenado: 0.88 },
  });
  const niveles = { arq: 1, mob: 1 };
  let ultimoEncuadre = 'general';
  const ATEN_MEP = { arq: 0.4, mob: 0.78 };

  /** Batería de góndola protagonista: 3 tramos, cerca del frente y del centro. */
  function elegirHeroe() {
    const g = (layout?.muebles || []).filter((m) => m.familia === 'gondola_central');
    if (!g.length) return null;
    const bb = cajaLocal(), cx = (bb.x0 + bb.x1) / 2;
    return g.slice().sort((a, b) => (b.variante.tramos - a.variante.tramos) || (Math.abs(a.x - cx) - a.z * 0.6) - (Math.abs(b.x - cx) - b.z * 0.6))[0];
  }
  /** Posición y objetivo del acercamiento al héroe: de 3/4 desde el lado de la cámara general (−x) y la calle. */
  function planoHeroe(m) {
    const t = [m.x, 0.85, m.z];
    const largoEnZ = Math.round(m.rot / 90) % 2 === 1;
    const p = largoEnZ ? [m.x - 5.2, 3.3, m.z + 4.6] : [m.x - 3.6, 3.3, m.z + 5.4];
    return [p, t];
  }
  /** Recorrido a la altura de los ojos por el pasillo entre góndolas más largo. */
  function recorridoPasillo() {
    const ps = (layout?.pasillos || []).filter((q) => q.tipo === 'entre_gondolas');
    if (!ps.length) return null;
    const q = ps.slice().sort((a, b) => Math.hypot(b.puntos[1][0] - b.puntos[0][0], b.puntos[1][1] - b.puntos[0][1]) - Math.hypot(a.puntos[1][0] - a.puntos[0][0], a.puntos[1][1] - a.puntos[0][1]))[0];
    let [a, b] = q.puntos; if (a[1] < b[1]) [a, b] = [b, a]; // de la calle hacia el fondo
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const p0 = [a[0] - u[0] * 1.5, 1.6, a[1] - u[1] * 1.5], p1 = [a[0] + u[0] * L * 0.55, 1.55, a[1] + u[1] * L * 0.55];
    return { p0, t0: [p0[0] + u[0] * 6, 1.25, p0[2] + u[1] * 6], p1, t1: [p1[0] + u[0] * 6, 1.2, p1[2] + u[1] * 6] };
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
      anim.instantaneamente(() => mep.retraer(CAPAS)); atenuar('arq', 1); atenuar('mob', 1); niveles.arq = niveles.mob = 1; camara.orbita = false;
      for (const k of IDS_LOCALES) vistos[k] = [];
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
      if (!op.local || op.local === estado.local) ultimoEncuadre = nombre;
      return camara.encuadrar(cajaLocal(op.local), { ...(ENCUADRES(op.local || estado.local)[nombre] || {}), ...op });
    },
    orbita(v) { camara.orbita = v; set({ orbita: v }); },

    /** Escenas: cada una es un paso completo de la demo. Síncronas; devuelven Handle. */
    escenas: {
      /** Paso 1: el local se construye; la cámara baja de un plano aéreo al general. */
      local() {
        if (!layout || layout.localId !== estado.local) ops.calcularLayout();
        zonas.preparar(layout); muebles.preparar(layout);
        anim.instantaneamente(() => ops.camara('aereo', { dur: 0, forzar: true }));
        return anim.all([ops.camara('general', { dur: 4200, delay: 200 }), cascaron.construir(LOCALES[estado.local], layout)]);
      },
      /**
       * Paso 2: plano de héroe (acercamiento a una batería de góndola que se arma despacio, pieza por pieza) y
       * luego la cámara abre mientras el resto se arma en oleadas por zona con tintes y rótulos.
       */
      mobiliario() {
        const heroe = elegirHeroe();
        const T0 = heroe ? 3600 : 0;
        const hs = [
          zonas.mostrar(true, { dur: 1200, delay: T0 }), zonas.rotulos(estado.rotulos, { delay: T0 + 900, cada: 1100 }),
          muebles.armar({ heroe: heroe?.id, ritmoHeroe: 2.1, retardoHeroe: 700, inicio: T0 }),
        ];
        if (heroe) {
          const [p, t] = planoHeroe(heroe);
          hs.push(anim.seq([() => camara.mirar(p, t, { dur: 1500 }), 2400, () => ops.camara('frente', { dur: 5200, ease: 'io' })]));
        } else hs.push(ops.camara('frente', { dur: 9000, ease: 'sine' }));
        return anim.all(hs);
      },
      /** Paso 3: se atenúa la arquitectura y se trazan las tres capas. */
      instalaciones() {
        return anim.seq([
          () => anim.all([ops.atenuar(ATEN_MEP, 900), zonas.mostrar(true, { nivel: 0.5, dur: 900 }), zonas.rotulos(false), ops.camara('instalaciones', { dur: 1800 })]),
          () => ops.trazar(CAPAS),
        ]);
      },
      /**
       * Paso 4: nuevo layout. Retrae capas, vista cenital, parpadeo de alternativas evaluadas, elige, los tintes y
       * muros interiores se transforman, los muebles viajan y las capas se vuelven a trazar.
       */
      nuevoLayout() {
        const visibles = mep.capasVisibles();
        const previo = layout;
        const nuevo = obtenerLayout(estado.local, estado.semilla, previo, modoSiguiente(estado.local));
        const bb = cajaLocal();
        return anim.seq([
          () => anim.all([mep.retraer(visibles), ops.atenuar({ arq: 1, mob: 1 }, 700), zonas.rotulos(false)]),
          () => anim.all([ops.camara('cenital', { dur: 1500 }), zonas.mostrar(true, { nivel: 1.6, dur: 900 }), ops.atenuar(0.22, 900, ['mob'])]),
          () => zonas.parpadeo(nuevo.candidatos.muestras, { evaluados: nuevo.candidatos.evaluados, elegido: nuevo, centro: [(bb.x0 + bb.x1) / 2, 0.5, bb.z0 - 1.4] }),
          () => { publicar(nuevo); return anim.all([cascaron.setInteriores(nuevo), ops.atenuar(1, 600, ['mob'])]); },
          () => anim.all([
            muebles.transitar(nuevo), ops.camara('general', { dur: 2600, delay: 200 }),
            zonas.mostrar(true, { nivel: 1, dur: 1200, delay: 800 }), zonas.rotulos(estado.rotulos, { delay: 2400, cada: 120 }),
          ]),
          () => (visibles.length ? anim.seq([() => ops.atenuar(ATEN_MEP, 600), () => anim.all(visibles.map((c) => mep.trazar([c])))  /* re-trazo en paralelo: más corto */]) : anim.wait(0)),
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
          () => anim.all([mep.retraer(visibles), ops.atenuar({ arq: 1, mob: 1 }, 600), zonas.rotulos(false)]),
          () => {
            publicar(nuevo);
            const t = muebles.tiemposLocal; // formación: suben, se sostienen sobre el local nuevo y bajan
            return anim.all([
              muebles.transitar(nuevo, { modo: 'local', localAnterior: locA, localNuevo: LOCALES[id] }),
              cascaron.transformarA(LOCALES[id], nuevo, { delay: t.subida, dur: t.vuelo }),
              zonas.transformar(nuevo, { delay: t.subida, dur: t.vuelo }),
              ops.camara('general', { local: id, delay: t.subida - 300, dur: t.vuelo + 600 }),
              zonas.rotulos(estado.rotulos, { delay: t.subida + t.vuelo + t.bajada + 400, cada: 120 }),
            ]);
          },
          () => (visibles.length ? anim.seq([() => ops.atenuar(ATEN_MEP, 600), () => anim.all(visibles.map((c) => mep.trazar([c])))  /* re-trazo en paralelo: más corto */]) : anim.wait(0)),
        ]);
      },
      /** Paso 6: recorrido bajo por un pasillo de góndolas, sube al plano de cierre y órbita lenta. */
      cierre() {
        const r = recorridoPasillo();
        const pasos = [() => anim.all([zonas.rotulos(false), mep.capasVisibles().length ? ops.atenuar({ arq: 0.7, mob: 1 }, 900) : ops.atenuar({ arq: 1, mob: 1 }, 600)])];
        if (r) pasos.push(() => camara.mirar(r.p0, r.t0, { dur: 2600 }), () => camara.mirar(r.p1, r.t1, { dur: 4200, ease: 'sine' }));
        pasos.push(() => ops.camara('cierre', { dur: 3200 }), () => { ops.orbita(true); return anim.wait(0); });
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
    em.emit('libre', estado);
  }
  function sincronizarCapas() {
    const ver = mep.capasVisibles();
    const quitar = ver.filter((c) => !estado.capas[c]);
    const poner = CAPAS.filter((c) => estado.capas[c] && !ver.includes(c));
    const algo = CAPAS.some((c) => estado.capas[c]);
    return anim.seq([
      () => (quitar.length ? mep.retraer(quitar) : anim.wait(0)),
      () => (algo !== (niveles.arq < 0.9) ? ops.atenuar(algo ? ATEN_MEP : { arq: 1, mob: 1 }, 600) : anim.wait(0)),
      () => (poner.length ? mep.trazar(poner) : anim.wait(0)),
    ]);
  }

  /** Lleva la demo al paso n. Si n = actual+1 anima solo ese paso; si no, reconstruye 1..n-1 al instante. */
  async function irA(n, { instantaneo = false } = {}) {
    n = Math.max(0, Math.min(pasos.length, n));
    const animarUltimo = !instantaneo && n === estado.paso + 1;
    if (!animarUltimo) {
      const loc0 = params.local, sem0 = params.semilla;
      ops.limpiar();
      // reconstrucción determinista desde el local y la semilla de arranque
      layout = null; set({ local: loc0, semilla: sem0, indicadores: null, indicadoresPrevios: null });
      anim.instantaneamente(() => { for (let i = 1; i < n + (instantaneo ? 1 : 0); i++) pasos[i - 1].entrar(ops, { instantaneo: true }); });
      if (n === 0) set({ layoutId: null, calificacion: null, calificacionAnterior: null, esMejor: false, ranking: null, candidatos: null });
    }
    const p = n > 0 ? pasos[n - 1] : null;
    set({ paso: n, pasoInfo: p ? { id: p.id, titulo: p.titulo, rotulo: p.rotulo } : null }, 'paso');
    if (n > 0 && (animarUltimo || !instantaneo)) { const h = p.entrar(ops, { instantaneo: false }); await h?.done; }
  }

  const acciones = {
    siguiente: () => accion('siguiente', () => (estado.paso < pasos.length ? irA(estado.paso + 1) : null)),
    anterior: () => accion('anterior', () => irA(Math.max(1, estado.paso - 1), { instantaneo: true })),
    irAPaso: (n, op) => accion(`paso ${n}`, () => irA(n, op)),
    generar: () => accion('generar', () => (estado.paso >= 2 ? ops.escenas.nuevoLayout() : null)),
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
      if (v === estado.interfaz) return;
      set({ interfaz: v });
      // reencuadre suave para respetar (o liberar) los márgenes de la interfaz
      if (!estado.ocupado && !estado.orbita && estado.paso >= 1 && !camara.manual) ops.camara(ultimoEncuadre, { dur: 900 });
    },
    rotulos: (v = !estado.rotulos) => { set({ rotulos: v }); zonas.rotulos(v && estado.paso >= 2 && estado.paso !== 3); },
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
