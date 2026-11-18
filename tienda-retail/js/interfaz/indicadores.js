// Tarjetas de indicadores con conteo animado (colgado del reloj del proyecto) y variación neutra. Frente: interfaz.
// Seis tarjetas grandes (las de la vista "solo indicadores") y cinco chicas que solo aparecen en la vista completa.
const NF = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const DEF = [
  { k: 'pisoVenta', rot: 'Piso de venta', u: 'm²', sub: 'pisoVentaPct' },
  { k: 'mlExhibicion', rot: 'Exhibición', u: 'm lineales' },
  { k: 'gondolas', rot: 'Góndolas', u: 'tramos' },
  { k: 'puertasFrio', rot: 'Puertas de refrigeración', u: '' },
  { k: 'cajas', rot: 'Cajas', u: '' },
  { k: 'calificacion', rot: 'Calificación', u: 'pts', dec: 1, cal: true },
  { k: 'superficie', rot: 'Superficie', u: 'm²', chica: true },
  { k: 'racksRopa', rot: 'Racks de ropa', u: '', chica: true },
  { k: 'probadores', rot: 'Probadores', u: '', chica: true },
  { k: 'posicionesTarima', rot: 'Bodega', u: 'tarimas', chica: true },
  { k: 'luminarias', rot: 'Luminarias', u: '', chica: true },
];
const ok = (v) => typeof v === 'number' && Number.isFinite(v);
const SVG_ARRIBA = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8H1z"/></svg>';
const SVG_ABAJO = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 1 2h8z"/></svg>';
const SVG_OK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5"/></svg>';

/** @param {HTMLElement} cont  @param {any} anim  ops.anim (reloj del proyecto) */
export function crearIndicadores(cont, anim) {
  const tarj = DEF.map((d) => {
    const el = document.createElement('div');
    el.className = 'tarjeta' + (d.chica ? ' chica' : '') + (d.cal ? ' calif' : '');
    el.dataset.k = d.k;
    el.innerHTML = `<span class="t-rot">${d.rot}</span><span class="t-val"><b>—</b><i>${d.u}</i></span><span class="t-der"><span class="t-sub"></span><span class="t-var"></span></span>${d.cal ? '<span class="t-ins" hidden></span>' : ''}`;
    cont.appendChild(el);
    return { d, el, val: el.querySelector('b'), sub: el.querySelector('.t-sub'), vr: el.querySelector('.t-var'), ins: el.querySelector('.t-ins'), mostrado: null, h: null };
  });
  const fmt = (t, v) => (ok(v) ? (t.d.dec ? NF1 : NF).format(t.d.dec ? v : Math.round(v)) : '—');
  const pinta = (t, v) => { t.mostrado = v; t.val.textContent = fmt(t, v); };

  /**
   * @param {any} ind valores vigentes  @param {any} prev valores del layout anterior
   * @param {{animar:boolean, desdeCero?:boolean, cal?:{total:any, previo:any, mejor:boolean, n:any}}} op
   */
  function fijar(ind, prev, { animar, desdeCero = false, cal = null }) {
    for (const t of tarj) {
      const v = t.d.cal ? cal?.total : ind?.[t.d.k], p = t.d.cal ? cal?.previo : prev?.[t.d.k];
      // las tarjetas chicas sin dato (p. ej. luminarias antes de que instalaciones reporte) no se muestran
      if (t.d.chica) t.el.hidden = !ok(v);
      t.h?.cancel(); t.h = null;
      const ini = desdeCero ? 0 : (ok(t.mostrado) ? t.mostrado : (ok(p) ? p : 0));
      if (animar && anim && ok(v)) {
        t.h = anim.tween({ dur: 1200, ease: 'outQuint', onUpdate: (e) => pinta(t, ini + (v - ini) * e) });
      } else pinta(t, v);
      const pct = t.d.sub ? ind?.[t.d.sub] : null;
      t.sub.textContent = ok(pct) ? `${NF.format(pct > 0 && pct <= 1 ? pct * 100 : pct)} %` : '';
      const f = t.d.dec ? 10 ** t.d.dec : 1;
      const dif = ok(v) && ok(p) ? (Math.round(v * f) - Math.round(p * f)) / f : 0;
      t.vr.innerHTML = dif ? `${dif > 0 ? SVG_ARRIBA : SVG_ABAJO}${dif > 0 ? '+' : '−'}${t.d.dec ? NF1.format(Math.abs(dif)) : NF.format(Math.abs(dif))}` : '';
      t.el.title = dif ? `Respecto al layout anterior (${fmt(t, p)})` : '';
      if (t.d.cal) {
        t.el.classList.toggle('mejora', dif > 0);
        const mejor = cal?.mejor === true && ok(v) && ok(+cal.n) && +cal.n > 0;
        t.ins.hidden = !mejor;
        t.ins.innerHTML = mejor ? `${SVG_OK}Mejor de ${NF.format(+cal.n)} alternativas` : '';
      }
    }
  }
  return { fijar };
}
