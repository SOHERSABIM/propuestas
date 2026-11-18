// Capa de ayuda con el mapa de teclas. Frente: interfaz.
export const MAPA = [
  ['Navegación', [
    ['→  ·  Espacio  ·  Re Pág', 'Paso siguiente'], ['←  ·  Av Pág', 'Paso anterior'],
    ['Mayús + 1 … 7', 'Ir directo al paso'], ['P', 'Reproducir / pausar toda la secuencia'], ['0', 'Reiniciar']]],
  ['Contenido', [
    ['G', 'Generar layout'], ['1  ·  2  ·  3', 'Local rectangular · angosto · en esquina'],
    ['I  ·  A  ·  R', 'Capas: iluminación · aire · refrigeración']]],
  ['Pantalla', [
    ['H', 'Ocultar toda la interfaz'], ['M', 'Mostrar la interfaz completa'], ['J', 'Solo indicadores y rótulo'],
    ['T', 'Rótulos sí / no'], ['+  ·  −', 'Agrandar / reducir la interfaz'], ['O', 'Órbita automática'], ['F', 'Pantalla completa'], ['?', 'Esta ayuda'], ['Esc', 'Cerrar la ayuda']]],
];

export function crearAyuda(raiz) {
  const el = document.createElement('div');
  el.className = 'ayuda'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'ayuda-t');
  el.innerHTML = `<div class="ayuda-caja"><div class="ayuda-cab"><h2 id="ayuda-t">Mapa de teclas</h2>
    <button class="btn icono" type="button" data-cerrar aria-label="Cerrar ayuda"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13"/></svg></button></div>
    <div class="ayuda-cols">${MAPA.map(([t, fs]) => `<section><h3>${t}</h3><dl>${fs.map(([k, d]) => `<dt>${k.split('  ·  ').map((x) => `<kbd>${x}</kbd>`).join('')}</dt><dd>${d}</dd>`).join('')}</dl></section>`).join('')}</div><p class="ayuda-pie">Escala inicial por URL: <b>?escala=1.2</b> (base 1080 px de alto). Parámetros: ui=0 · ui=solo · auto=1 · semilla=N · local=A|B|C · paso=N.</p></div>`;
  raiz.appendChild(el);
  let previo = null;
  const abierta = () => !el.hidden;
  function abrir() { if (abierta()) return; previo = document.activeElement; el.hidden = false; el.querySelector('[data-cerrar]').focus(); }
  function cerrar() { if (!abierta()) return; el.hidden = true; if (previo && previo.focus && document.contains(previo)) previo.focus(); else document.activeElement?.blur?.(); }
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-cerrar]')) cerrar(); });
  // el foco no escapa de la capa mientras está abierta
  el.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); el.querySelector('[data-cerrar]').focus(); } });
  return { abrir, cerrar, abierta, alternar: () => (abierta() ? cerrar() : abrir()) };
}
