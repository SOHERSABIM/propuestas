// INTERFAZ: pantalla limpia, controles, indicadores y modo de grabación. Frente: interfaz.
// Usa SOLO app.estado, app.on(...), app.acciones.* y el reloj del proyecto (app.ops.anim) para animar y esperar.
import { LOCALES } from '../datos/locales.js';
import { area } from '../core/geom.js';
import { PASOS } from './director.js';
import { crearIndicadores } from './indicadores.js';
import { crearAyuda } from './ayuda.js';
import { montarTeclado } from './teclado.js';

const I = {
  ant: '<path d="M10 3 5 8l5 5"/>', sig: '<path d="M6 3l5 5-5 5"/>', play: '<path d="M5 3.5v9l7-4.5z" class="rel"/>',
  pausa: '<path d="M5 3.5v9M11 3.5v9"/>', reiniciar: '<path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3"/>',
  gen: '<path d="M2.5 4h4v4h-4zM9.5 8h4v4h-4zM8 6l-1 4M6.5 6h3"/>', ayuda: '<path d="M6 6a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.5M8 12v.01"/>',
  pantalla: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>', ocultar: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM2.5 13.5l11-11"/>',
};
const ico = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true">${d}</svg>`;
const CAPAS = [['luz', 'Iluminación', '#f2a81d', 'I'], ['aire', 'Aire acondicionado', '#2b8fd6', 'A'], ['frio', 'Refrigeración', '#8e5bd6', 'R']];
const LOCS = [['A', 'Rectangular'], ['B', 'Angosto'], ['C', 'En esquina']];
const NF = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/**
 * @param {HTMLElement} raiz
 * @param {{estado:any, acciones:any, on:Function, ops?:any}} app
 */
export function crearInterfaz(raiz, app) {
  const A = app.acciones, anim = app.ops?.anim ?? null;
  raiz.innerHTML = `
  <div class="ui-capa" data-modo="completa">
    <header class="zona-sup">
      <div class="marca"><img src="assets/logo-sohersa.png" alt="Sohersa BIM" draggable="false"></div>
      <div class="rotulo-paso" aria-live="polite" hidden><span class="rp-n"></span><span class="rp-t"></span><span class="rp-d"></span><span class="rp-c">Trazo conceptual</span></div>
      <div class="herramientas">
        <button class="btn icono" type="button" data-a="ayuda" aria-label="Mapa de teclas (?)" title="Mapa de teclas (?)">${ico(I.ayuda)}</button>
        <button class="btn icono" type="button" data-a="pantalla" aria-label="Pantalla completa (F)" title="Pantalla completa (F)">${ico(I.pantalla)}</button>
        <button class="btn icono" type="button" data-a="ocultar" aria-label="Ocultar interfaz (H)" title="Ocultar interfaz (H)">${ico(I.ocultar)}</button>
      </div>
    </header>
    <aside class="panel-ind" aria-label="Indicadores" hidden>
      <div class="rejilla-ind"></div>
      <p class="gen-linea"></p>
    </aside>
    <div class="marca-grande" aria-hidden="true"><img src="assets/logo-sohersa.png" alt="" draggable="false"></div>
    <nav class="controles" aria-label="Controles de la demo">
      <div class="g-pasos">
        <ol class="pasos">${PASOS.map((p, i) => `<li><button class="punto" type="button" data-paso="${i + 1}" aria-label="Paso ${i + 1}: ${p.titulo}" title="${i + 1} · ${p.titulo}">${i + 1}</button></li>`).join('')}</ol>
        <div class="fila">
          <button class="btn icono" type="button" data-a="anterior" aria-label="Paso anterior (←)" title="Paso anterior (←)">${ico(I.ant)}</button>
          <button class="btn primario grande" type="button" data-a="siguiente"><span class="et">Comenzar</span>${ico(I.sig)}</button>
          <button class="btn icono" type="button" data-a="reproducir" aria-pressed="false" aria-label="Reproducir secuencia (P)" title="Reproducir secuencia (P)">${ico(I.play)}</button>
          <button class="btn icono" type="button" data-a="reiniciar" aria-label="Reiniciar (0)" title="Reiniciar (0)">${ico(I.reiniciar)}</button>
        </div>
      </div>
      <div class="g-gen"><button class="btn grande" type="button" data-a="generar">${ico(I.gen)}<span>Generar layout</span></button></div>
      <div class="g-local" role="group" aria-label="Cambiar local"><span class="g-tit">Cambiar local</span><div class="fila">
        ${LOCS.map(([id, n], i) => `<button class="btn opcion" type="button" data-local="${id}" aria-pressed="false" title="${n} (${i + 1})"><b>${n}</b><small>${LOCALES[id] ? NF.format(area(LOCALES[id].poligono)) + ' m²' : ''}</small></button>`).join('')}</div></div>
      <div class="g-capas" role="group" aria-label="Capas"><span class="g-tit">Capas</span><div class="fila">
        ${CAPAS.map(([id, n, c, t]) => `<button class="btn capa" type="button" role="switch" aria-checked="false" data-capa="${id}" style="--c:${c}" title="${n} (${t})"><i class="sw" aria-hidden="true"></i><span>${n}</span></button>`).join('')}</div></div>
    </nav>
  </div>`;
  const capa = raiz.querySelector('.ui-capa');
  // ---------- Escala para video: base 1080 px de alto (y 1920 de ancho); "+" "-" y ?escala=1.2 ----------
  let listo = false;
  const ESC_MIN = 0.5, ESC_MAX = 2.5;
  const pe = parseFloat(new URLSearchParams(location.search).get('escala'));
  let escala = Number.isFinite(pe) && pe > 0 ? Math.min(ESC_MAX, Math.max(ESC_MIN, pe)) : 1;
  function aplicarEscala() {
    const base = Math.max(0.45, Math.min(innerHeight / 1080, innerWidth / 1920));
    raiz.style.setProperty('--s', (base * escala).toFixed(4));
    medir();
  }
  const escalar = (d) => { escala = Math.min(ESC_MAX, Math.max(ESC_MIN, Math.round((escala + d) * 100) / 100)); aplicarEscala(); };
  window.addEventListener('resize', aplicarEscala);
  aplicarEscala();
  // ?datos=N: tamaño del panel de indicadores en % (100 por defecto; 50 a 160; 0 lo oculta)
  const pd = parseFloat(new URLSearchParams(location.search).get('datos'));
  const DATOS = Number.isFinite(pd) ? (pd <= 0 ? 0 : Math.min(160, Math.max(50, pd))) : 100;
  raiz.querySelector('.panel-ind').style.setProperty('--d', String(DATOS / 100));
  raiz.querySelector('.panel-ind').classList.toggle('sin-datos', DATOS === 0);
  const MARGEN_INF = 24;   // px x --s libres bajo el panel de indicadores en modo "solo"
  const $ = (s) => raiz.querySelector(s);
  const btn = (a) => $(`[data-a="${a}"]`);
  const ayuda = crearAyuda(raiz);
  const ind = crearIndicadores($('.rejilla-ind'), anim);

  // ---------- Modo de vista: completa | solo (indicadores y rótulo) | oculta ----------
  let visible = new URLSearchParams(location.search).get('ui') === 'solo' ? 'solo' : 'completa';
  const modo = () => (app.estado.interfaz ? visible : 'oculta');
  const vista = {
    ocultar: () => A.interfaz(false),
    completa: () => { visible = 'completa'; A.interfaz(true); pintar(app.estado); },
    solo: () => { visible = 'solo'; A.interfaz(true); pintar(app.estado); },
  };

  // Cursor: con la interfaz oculta (o reducida) desaparece tras 2.5 s quieto. Cuelga del reloj del proyecto.
  let ficha = 0;
  const esperar = (ms, fn) => { const t = ++ficha; const alFin = () => { if (t === ficha) fn(); };
    if (anim) anim.wait(ms).onDone(alFin); else setTimeout(alFin, ms); }; // fallback solo cosmético
  function actividadRaton() {
    document.body.classList.remove('sin-cursor');
    ficha++;
    if (modo() !== 'completa') esperar(2500, () => document.body.classList.add('sin-cursor'));
  }
  window.addEventListener('pointermove', actividadRaton, { passive: true });
  window.addEventListener('pointerdown', actividadRaton, { passive: true });

  // ---------- Pintado ----------
  let indRef = null, visPrev = false, modoPrev = null;
  // Calificación del layout vigente y del anterior. Usa estado.calificacionAnterior / esMejor si el núcleo ya los expone;
  // si no, guarda aquí el total del layout previo (se reinicia al volver al paso 0).
  let calUlt = null, mejorUlt = false, calId = null, calAct = null, calPrev = null;
  const total = (c) => (c && typeof c === 'object' ? c.total : c);
  function seguirCalificacion(s) {
    if (s.layoutId == null) { calId = calAct = calPrev = null; return; }
    if (s.layoutId !== calId) { calId = s.layoutId; calPrev = calAct; calAct = total(s.calificacion) ?? null; }
  }
  // Ajuste de cabida (se mide solo si cambia escala, ventana, modo, rótulo o tarjetas; no en cada cuadro):
  // 1) rótulo del paso: si descripción no cabe en una línea, pasa a dos (.dos-lineas); 2) panel en "solo": reduce --k para caber.
  let claveMed = '';
  function medir(forzar = true) {
    if (!listo) return;
    const rp = $('.rotulo-paso'), pan = $('.panel-ind'), m = capa.dataset.modo;
    const clave = [raiz.style.getPropertyValue('--s'), innerWidth, innerHeight, m, rp.textContent, rp.classList.contains('con-capas'), rp.hidden, pan.hidden,
      pan.querySelectorAll('.t-ins:not(:empty)').length, pan.querySelectorAll('.tarjeta').length].join('|');
    if (!forzar && clave === claveMed) return;
    claveMed = clave;
    if (!rp.hidden && m !== 'oculta') {
      rp.classList.remove('dos-lineas');
      const d = rp.querySelector('.rp-d');
      if (!d.hidden && (d.scrollWidth > d.clientWidth + 1 || rp.scrollWidth > rp.clientWidth + 1)) rp.classList.add('dos-lineas');
    }
    pan.style.removeProperty('--k'); pan.style.removeProperty('top');
    if (m === 'solo' && !pan.hidden && !rp.hidden) {   // el rótulo en dos líneas crece hacia abajo: el panel cede
      const sc = parseFloat(raiz.style.getPropertyValue('--s')) || 1, rr = rp.getBoundingClientRect(), pr = pan.getBoundingClientRect();
      if (rr.left < pr.right + 8 * sc && rr.bottom + 12 * sc > pr.top) pan.style.top = `${(rr.bottom + 12 * sc).toFixed(1)}px`;
    }
    if (m === 'solo' && !pan.hidden) {
      const sc = parseFloat(raiz.style.getPropertyValue('--s')) || 1, r0 = pan.getBoundingClientRect();
      const disp = innerHeight - r0.top - MARGEN_INF * sc;
      let k = 1;
      for (let i = 0; i < 3 && r0.height > 0; i++) {
        const h = pan.getBoundingClientRect().height;
        if (h <= disp + 0.5) break;
        k = Math.max(0.35, k * (disp / h) * 0.995); pan.style.setProperty('--k', k.toFixed(4));
      }
    }
    claveMed = clave;
  }
  const tx = (el, v) => { if (el.textContent !== v) el.textContent = v; };
  function pintar(s) {
    const m = modo();
    seguirCalificacion(s);
    if (m !== modoPrev) { modoPrev = m; capa.dataset.modo = m; capa.inert = m === 'oculta'; actividadRaton(); }
    capa.dataset.fase = s.fase || '';
    raiz.classList.toggle('ocupada', s.ocupado);
    // pasos
    raiz.querySelectorAll('.punto').forEach((b) => { const n = +b.dataset.paso;
      b.classList.toggle('hecho', n < s.paso); if (n === s.paso) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    const fin = s.paso >= s.total;
    tx(btn('siguiente').querySelector('.et'), s.paso === 0 ? 'Comenzar' : fin ? 'Fin' : 'Siguiente');
    btn('siguiente').setAttribute('aria-disabled', String(fin));
    btn('anterior').setAttribute('aria-disabled', String(s.paso <= 1));
    btn('generar').setAttribute('aria-disabled', String(s.paso < 2));
    const rep = btn('reproducir');
    rep.setAttribute('aria-pressed', String(s.reproduciendo));
    rep.firstElementChild.innerHTML = s.reproduciendo ? I.pausa : I.play;
    const tit = s.reproduciendo ? 'Pausar secuencia (P)' : 'Reproducir secuencia (P)';
    rep.title = tit; rep.setAttribute('aria-label', tit);
    // acción en curso: solo se marca el botón que la origina (sin deshabilitar: la app encola)
    const acc = s.ocupado ? (s.accion || '') : '';
    for (const [a, re] of [['siguiente', /^(siguiente|paso)/], ['anterior', /^anterior/], ['generar', /^generar/], ['reiniciar', /^reiniciar/]])
      btn(a).classList.toggle('trabajando', re.test(acc));
    raiz.querySelectorAll('[data-local]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.local === s.local)); b.classList.toggle('trabajando', acc === `local ${b.dataset.local}`); });
    raiz.querySelectorAll('[data-capa]').forEach((b) => b.setAttribute('aria-checked', String(!!s.capas?.[b.dataset.capa])));
    // rótulo del paso (se apaga con "rótulos")
    const rp = $('.rotulo-paso'), hay = s.paso > 0 && s.rotulos && !!s.pasoInfo;
    rp.hidden = !hay;
    if (hay) {
      tx(rp.querySelector('.rp-n'), `Paso ${s.paso} de ${s.total}`); tx(rp.querySelector('.rp-t'), s.pasoInfo.titulo); tx(rp.querySelector('.rp-d'), s.pasoInfo.rotulo || '');
      rp.querySelector('.rp-d').hidden = !s.pasoInfo.rotulo;
    }
    rp.classList.toggle('con-capas', !!(s.capas && (s.capas.luz || s.capas.aire || s.capas.frio)));
    // indicadores
    const vis = s.paso >= 2 && !!s.indicadores;
    $('.panel-ind').hidden = !vis;
    const cal = { total: total(s.calificacion) ?? calAct, previo: total(s.calificacionAnterior) ?? calPrev,
      mejor: s.esMejor === true, n: s.candidatos?.evaluados };
    if (vis && (!visPrev || s.indicadores !== indRef || cal.total !== calUlt || cal.mejor !== mejorUlt)) {
      const animar = /^(siguiente|generar|local)/.test(s.accion || '') && s.ocupado;
      ind.fijar(s.indicadores, s.indicadoresPrevios, { animar, desdeCero: !visPrev && s.paso === 2, cal });
      calUlt = cal.total; mejorUlt = cal.mejor;
    }
    visPrev = vis; indRef = s.indicadores;
    const c = s.candidatos, g = $('.gen-linea');
    g.hidden = !(vis && c && Number.isFinite(c.evaluados));
    if (!g.hidden) tx(g, `${c.evaluados} alternativas evaluadas${Number.isFinite(c.validos) ? ` · ${c.validos} válidas` : ''}`);
    medir(false);
  }

  // ---------- Eventos ----------
  const bloqueado = (b) => b.getAttribute('aria-disabled') === 'true';
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !capa.contains(b)) return;
    if (e.detail > 0) b.blur();                       // el teclado vuelve a mandar tras un clic con ratón
    if (bloqueado(b)) return;
    const d = b.dataset;
    if (d.paso) A.irAPaso(+d.paso);
    else if (d.local) A.cambiarLocal(d.local);
    else if (d.capa) A.capa(d.capa);
    else if (d.a === 'siguiente') A.siguiente();
    else if (d.a === 'anterior') A.anterior();
    else if (d.a === 'generar') A.generar();
    else if (d.a === 'reproducir') A.reproducir();
    else if (d.a === 'reiniciar') A.reiniciar();
    else if (d.a === 'ayuda') ayuda.abrir();
    else if (d.a === 'ocultar') vista.ocultar();
    else if (d.a === 'pantalla') { const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); r?.catch?.(() => {}); }
  });
  app.on('estado', pintar);
  montarTeclado({ app, ayuda, vista, escalar });
  listo = true;
  pintar(app.estado);
  medir();
}
