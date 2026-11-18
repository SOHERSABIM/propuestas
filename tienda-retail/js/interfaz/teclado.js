// Mapa de teclas y protecciones del modo de grabación. Frente: interfaz.
// Todo se resuelve con app.acciones.*; aquí no hay lógica de secuencia ni temporizadores.

/** @param {{app:any, ayuda:any, vista:{ocultar:Function, completa:Function, solo:Function}}} c */
export function montarTeclado({ app, ayuda, vista }) {
  const A = app.acciones, E = app.estado;
  const pantallaCompleta = () => {
    const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    r?.catch?.(() => {});
  };
  const reproducir = async () => {
    if (!E.reproduciendo && E.paso >= E.total) await A.reiniciar();
    A.reproducir();
  };
  const LETRAS = {
    p: reproducir, g: () => A.generar(), i: () => A.capa('luz'), a: () => A.capa('aire'), r: () => A.capa('frio'),
    h: vista.ocultar, m: vista.completa, j: vista.solo, f: pantallaCompleta, o: () => A.orbita(), t: () => A.rotulos(),
  };
  const LOCAL = { 1: 'A', 2: 'B', 3: 'C' };

  function manejar(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // evita el zoom accidental del navegador (+, −, 0) durante la grabación
      if (['+', '-', '=', '_', '0'].includes(e.key)) e.preventDefault();
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
    const k = e.key;
    if (k === 'Escape') { if (ayuda.abierta()) { e.preventDefault(); ayuda.cerrar(); } return; }
    if (k === '?') { e.preventDefault(); if (!e.repeat) ayuda.alternar(); return; }
    if (ayuda.abierta()) { if (k === ' ' || k.startsWith('Arrow')) e.preventDefault(); return; }
    const espacio = k === ' ';
    const teclaPropia = espacio || k.startsWith('Arrow') || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End';
    if (teclaPropia) e.preventDefault();          // sin scroll ni activar el botón enfocado con Espacio
    if (e.repeat) return;
    if (e.shiftKey && /^Digit[1-6]$/.test(e.code)) { e.preventDefault(); A.irAPaso(+e.code.slice(5)); return; }
    if (k === 'ArrowRight' || espacio || k === 'PageDown') A.siguiente();
    else if (k === 'ArrowLeft' || k === 'PageUp') A.anterior();
    else if (k === '0') A.reiniciar();
    else if (LOCAL[k]) A.cambiarLocal(LOCAL[k]);
    else if (LETRAS[k.toLowerCase()]) LETRAS[k.toLowerCase()]();
  }
  window.addEventListener('keydown', manejar);
  // Espacio activa un botón al soltarse: se anula para que no duplique la acción
  window.addEventListener('keyup', (e) => { if (e.key === ' ' && !/^(INPUT|TEXTAREA)$/.test(e.target?.tagName)) e.preventDefault(); });

  // Sin zoom (Ctrl + rueda, pellizco), sin scroll ni selección accidentales
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) window.addEventListener(g, (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  window.addEventListener('scroll', () => window.scrollTo(0, 0));
}
