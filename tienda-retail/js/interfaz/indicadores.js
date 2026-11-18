// Tarjetas de indicadores con conteo animado (colgado del reloj del proyecto) y variación. Frente: interfaz.
const NF = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const DEF = [
  { k: 'superficie', rot: 'Superficie', u: 'm²' },
  { k: 'pisoVenta', rot: 'Piso de venta', u: 'm²', sub: 'pisoVentaPct' },
  { k: 'mlExhibicion', rot: 'Exhibición', u: 'm lin.' },
  { k: 'gondolas', rot: 'Góndolas', u: 'tramos' },
  { k: 'puertasFrio', rot: 'Refrigeración', u: 'puertas' },
  { k: 'cajas', rot: 'Cajas', u: '' },
  { k: 'racksRopa', rot: 'Racks de ropa', u: '' },
  { k: 'probadores', rot: 'Probadores', u: '' },
  { k: 'posicionesTarima', rot: 'Bodega', u: 'tarimas' },
  { k: 'luminarias', rot: 'Luminarias', u: '' },
];
const ok = (v) => typeof v === 'number' && Number.isFinite(v);
const SVG_ARRIBA = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8H1z"/></svg>';
const SVG_ABAJO = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 1 2h8z"/></svg>';

/** @param {HTMLElement} cont  @param {any} anim  ops.anim (reloj del proyecto) */
export function crearIndicadores(cont, anim) {
  const tarj = DEF.map((d) => {
    const el = document.createElement('div');
    el.className = 'tarjeta';
    el.innerHTML = `<span class="t-rot">${d.rot}</span><span class="t-val"><b>—</b><i>${d.u}</i></span><span class="t-sub"></span><span class="t-var"></span>`;
    cont.appendChild(el);
    return { d, el, val: el.querySelector('b'), sub: el.querySelector('.t-sub'), vr: el.querySelector('.t-var'), mostrado: null, h: null };
  });
  const pinta = (t, v) => { t.mostrado = v; t.val.textContent = ok(v) ? NF.format(Math.round(v)) : '—'; };

  /**
   * @param {any} ind valores vigentes  @param {any} prev valores del layout anterior
   * @param {{animar:boolean, desdeCero?:boolean}} op
   */
  function fijar(ind, prev, { animar, desdeCero = false }) {
    for (const t of tarj) {
      const v = ind?.[t.d.k], p = prev?.[t.d.k];
      t.h?.cancel(); t.h = null;
      const ini = desdeCero ? 0 : (ok(t.mostrado) ? t.mostrado : (ok(p) ? p : 0));
      if (animar && anim && ok(v)) {
        t.h = anim.tween({ dur: 1200, ease: 'outQuint', onUpdate: (e) => pinta(t, ini + (v - ini) * e) });
      } else pinta(t, v);
      const pct = t.d.sub ? ind?.[t.d.sub] : null;
      t.sub.textContent = ok(pct) ? `${NF.format(pct > 0 && pct <= 1 ? pct * 100 : pct)} %` : '';
      const dif = ok(v) && ok(p) ? Math.round(v) - Math.round(p) : 0;
      t.vr.className = 't-var' + (dif > 0 ? ' sube' : dif < 0 ? ' baja' : '');
      t.vr.innerHTML = dif ? `${dif > 0 ? SVG_ARRIBA : SVG_ABAJO}${dif > 0 ? '+' : '−'}${NF.format(Math.abs(dif))}` : '';
      t.el.title = dif ? `Respecto al layout anterior (${NF.format(Math.round(p))})` : '';
    }
  }
  return { fijar };
}
