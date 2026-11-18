// Aplicación: estado observable, cola de acciones con bloqueo, escenas de la demo y operaciones. Frente: núcleo.
// La interfaz (frente 4) SOLO lee app.estado, escucha app.on(...) y llama app.acciones.*. El director de pasos
// (interfaz/director.js) compone con ops.escenas.* (cada escena es un paso completo: cámara incluida).
import { crearEmisor } from './core/eventos.js';
import { LOCALES, IDS_LOCALES } from './datos/locales.js';
import { generarLayout } from './gen/generador.js';
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
 * @param {{params:any, anim:any, reloj:any, cascaron:any, muebles:any, zonas:any, mep:any, camara:any, pasos:any[], esc:any}} d
 */
export function crearApp({ params, anim, cascaron, muebles, zonas, mep, camara, pasos, esc }) {
  const em = crearEmisor();
  /** @type {Estado} */
  const estado = {
    paso: 0, total: pasos.length, pasoInfo: null, local: params.local, semilla: params.semilla, layoutId: null,
    indicadores: null, indicadoresPrevios: null, calificacion: null, candidatos: null,
    capas: { luz: false, aire: false, frio: false }, ocupado: false, accion: null, reproduciendo: false,
    interfaz: !params.sinInterfaz, rotulos: params.rotulos, orbita: false, seleccion: null,
  };
  let layout = null;
  const set = (patch, ev) => { Object.assign(estado, patch); if (ev) em.emit(ev, estado); em.emit('estado', estado); };

  // ---------- Layouts (con caché: el siguiente se calcula en un momento quieto) ----------
  const cache = new Map();
  const claveL = (loc, semilla, ant) => `${loc}:${semilla}:${ant?.id ?? '-'}`;
  function obtenerLayout(loc, semilla, anterior) {
    const k = claveL(loc, semilla, anterior);
    if (!cache.has(k)) { cache.set(k, generarLayout(LOCALES[loc], { semilla, anterior })); if (cache.size > 12) cache.delete(cache.keys().next().value); }
    return cache.get(k);
  }
  const semillaSiguiente = () => estado.semilla + 1;
  const localSiguiente = () => IDS_LOCALES[(IDS_LOCALES.indexOf(estado.local) + 1) % IDS_LOCALES.length];
  /** Precalcula lo que pedirán los pasos 4 y 5 (solo en reposo: congela ~0.3 s). */
  function precalcular() {
    if (!layout || estado.orbita || estado.reproduciendo && estado.paso >= 5) return;
    obtenerLayout(estado.local, semillaSiguiente(), layout);
  }

  function indicadoresDe(lay) {
    const mi = mep.indicadores();
    return { ...lay.indicadores, ...Object.fromEntries(Object.entries(mi).filter(([, v]) => v != null)) };
  }
  /** Publica un layout como vigente (estado, eventos e indicadores). */
  function publicar(lay) {
    layout = lay;
    mep.setPlan(LOCALES[lay.localId], lay);
    set({ semilla: lay.semilla, local: lay.localId, layoutId: lay.id, indicadoresPrevios: estado.indicadores, indicadores: indicadoresDe(lay),
      calificacion: lay.calificacion, candidatos: { evaluados: lay.candidatos.evaluados, validos: lay.candidatos.validos, descartes: lay.candidatos.descartes } }, 'layout');
    em.emit('indicadores', estado);
  }

  const cajaLocal = (id = estado.local) => caja(LOCALES[id].poligono);
  const ENCUADRES = {
    general: { azimut: 38, polar: 52 }, aereo: { azimut: 20, polar: 30, factor: 2.4 }, frente: { azimut: 26, polar: 58, factor: 1.45 },
    instalaciones: { azimut: 44, polar: 46, factor: 1.6 }, cenital: { azimut: 0, polar: 2, factor: 1.7, centrado: true }, cierre: { azimut: 58, polar: 56, factor: 1.6 },
  };
  let nivelAt = 1;

  // ---------- Operaciones ----------
  const ops = {
    anim,
    get local() { return LOCALES[estado.local]; },
    get layout() { return layout; },
    get estado() { return estado; },
    /** Calcula y publica el layout del local y semilla vigentes (sin animar). */
    calcularLayout(semilla = estado.semilla) { const l = obtenerLayout(estado.local, semilla, null); publicar(l); return l; },
    /** Escena vacía (paso 0). */
    limpiar() {
      anim.terminarTodo(); cascaron.vaciar(); muebles.preparar({ muebles: [] }); zonas.preparar({ zonas: [] }); zonas.rotulos(false);
      anim.instantaneamente(() => mep.retraer(CAPAS)); atenuar('arq', 1); atenuar('mob', 1); nivelAt = 1; camara.orbita = false;
      set({ orbita: false, capas: { luz: false, aire: false, frio: false } });
    },
    /** Atenúa arquitectura y mobiliario (instalaciones). nivel 1 = normal. */
    atenuar(nivel, dur = 700, grupos = ['arq', 'mob']) {
      const a0 = nivelAt; nivelAt = nivel;
      return anim.tween({ dur, ease: 'io', onUpdate: (e) => { const v = a0 + (nivel - a0) * e; for (const g of grupos) atenuar(g, v); } });
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
      return camara.encuadrar(cajaLocal(op.local), { ...(ENCUADRES[nombre] || {}), ...op });
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
      /** Paso 2: tinte de zonas, rótulos y armado de muebles en oleadas; la cámara se acerca un poco. */
      mobiliario() {
        return anim.all([
          zonas.mostrar(true, { dur: 1200 }), zonas.rotulos(estado.rotulos, { delay: 600, cada: 1250 }),
          muebles.armar(), ops.camara('frente', { dur: 9000, ease: 'sine' }),
        ]);
      },
      /** Paso 3: se atenúa la arquitectura y se trazan las tres capas. */
      instalaciones() {
        return anim.seq([
          () => anim.all([ops.atenuar(0.42, 900), zonas.mostrar(true, { nivel: 0.35, dur: 900 }), zonas.rotulos(false), ops.camara('instalaciones', { dur: 1800 })]),
          () => ops.trazar(CAPAS),
        ]);
      },
      /**
       * Paso 4: nuevo layout. Retrae capas, vista cenital, parpadeo de alternativas evaluadas, elige, los tintes y
       * muros interiores se transforman, los muebles viajan y las capas se vuelven a trazar.
       */
      nuevoLayout(semilla = semillaSiguiente()) {
        const visibles = mep.capasVisibles();
        const previo = layout;
        const nuevo = obtenerLayout(estado.local, semilla, previo);
        const bb = cajaLocal();
        return anim.seq([
          () => anim.all([mep.retraer(visibles), ops.atenuar(1, 700), zonas.rotulos(false)]),
          () => anim.all([ops.camara('cenital', { dur: 1500 }), zonas.mostrar(true, { nivel: 1.6, dur: 900 }), ops.atenuar(0.22, 900, ['mob'])]),
          () => zonas.parpadeo(nuevo.candidatos.muestras, { evaluados: nuevo.candidatos.evaluados, elegido: nuevo, centro: [(bb.x0 + bb.x1) / 2, 0.5, bb.z0 - 1.4] }),
          () => { publicar(nuevo); return anim.all([cascaron.setInteriores(nuevo), ops.atenuar(1, 600, ['mob'])]); },
          () => anim.all([
            muebles.transitar(nuevo), ops.camara('general', { dur: 2600, delay: 200 }),
            zonas.mostrar(true, { nivel: 1, dur: 1200, delay: 800 }), zonas.rotulos(estado.rotulos, { delay: 2400, cada: 120 }),
          ]),
          () => (visibles.length ? anim.seq([() => ops.atenuar(0.42, 600), () => mep.trazar(visibles)]) : anim.wait(0)),
        ]);
      },
      /**
       * Paso 5: otro local. Los muebles que siguen se elevan por encima del pretil y esperan mientras losa, muros,
       * fachada y columnas se transforman; luego bajan a su lugar y los nuevos se arman.
       */
      otroLocal(id = localSiguiente()) {
        if (id === estado.local) return anim.wait(0);
        const visibles = mep.capasVisibles();
        const nuevo = obtenerLayout(id, estado.semilla, layout);
        const PAUSA = 2600;
        return anim.seq([
          () => anim.all([mep.retraer(visibles), ops.atenuar(1, 600), zonas.rotulos(false)]),
          () => {
            publicar(nuevo);
            return anim.all([
              muebles.transitar(nuevo, { modo: 'local', pausa: PAUSA }),
              cascaron.transformarA(LOCALES[id], nuevo, { delay: 1400, dur: 2600 }),
              zonas.transformar(nuevo, { delay: 1400, dur: 2600 }),
              ops.camara('general', { local: id, delay: 1200, dur: 3000 }),
              zonas.rotulos(estado.rotulos, { delay: 6000, cada: 120 }),
            ]);
          },
          () => (visibles.length ? anim.seq([() => ops.atenuar(0.42, 600), () => mep.trazar(visibles)]) : anim.wait(0)),
        ]);
      },
      /** Paso 6: plano de cierre y órbita lenta. */
      cierre() {
        return anim.seq([() => anim.all([ops.camara('cierre', { dur: 2400 }), zonas.rotulos(false), ops.atenuar(mep.capasVisibles().length ? 0.6 : 1, 900)]), () => { ops.orbita(true); return anim.wait(0); }]);
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
    precalcular();
  }
  function sincronizarCapas() {
    const ver = mep.capasVisibles();
    const quitar = ver.filter((c) => !estado.capas[c]);
    const poner = CAPAS.filter((c) => estado.capas[c] && !ver.includes(c));
    const algo = CAPAS.some((c) => estado.capas[c]);
    return anim.seq([
      () => (quitar.length ? mep.retraer(quitar) : anim.wait(0)),
      () => (algo !== (nivelAt < 0.9) ? ops.atenuar(algo ? 0.42 : 1, 600) : anim.wait(0)),
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
      if (n === 0) set({ layoutId: null, calificacion: null, candidatos: null });
    }
    const p = n > 0 ? pasos[n - 1] : null;
    set({ paso: n, pasoInfo: p ? { id: p.id, titulo: p.titulo, rotulo: p.rotulo } : null }, 'paso');
    if (n > 0 && (animarUltimo || !instantaneo)) { const h = p.entrar(ops, { instantaneo: false }); await h?.done; }
  }

  const acciones = {
    siguiente: () => accion('siguiente', () => (estado.paso < pasos.length ? irA(estado.paso + 1) : null)),
    anterior: () => accion('anterior', () => irA(Math.max(1, estado.paso - 1), { instantaneo: true })),
    irAPaso: (n, op) => accion(`paso ${n}`, () => irA(n, op)),
    generar: (semilla) => accion('generar', () => (estado.paso >= 2 ? ops.escenas.nuevoLayout(semilla ?? semillaSiguiente()) : null)),
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
    interfaz: (v = !estado.interfaz) => set({ interfaz: v }),
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
    estado, acciones, ops, on: em.on.bind(em),
    get layout() { return layout; },
    libre: () => (estado.ocupado ? new Promise((r) => { const off = em.on('libre', () => { off(); r(); }); }) : Promise.resolve()),
  };
}
