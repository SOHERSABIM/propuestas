// Director de cámara: encuadres con nombre, tween sobre el reloj y cesión al usuario. Frente: núcleo.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEG } from '../core/geom.js';

/**
 * @param {{camara:any, dom:HTMLElement, anim:any, reloj:any}} ctx
 */
export function crearCamara({ camara, dom, anim, reloj }) {
  const controles = new OrbitControls(camara, dom);
  controles.enableDamping = false;
  controles.maxPolarAngle = Math.PI / 2 - 0.03;
  controles.minDistance = 4; controles.maxDistance = 220; controles.rotateSpeed = 0.7;
  let manual = false, tween = null, orbita = false, bb = null;
  controles.addEventListener('start', () => { manual = true; tween?.cancel(); reloj.pedirCuadro(); });
  controles.addEventListener('change', () => reloj.pedirCuadro());

  /** Calcula posición y objetivo para mirar un rectángulo envolvente. */
  function plano(caja, { azimut = 38, polar = 52, factor = 1.75, alto = 0, centrado = false } = {}) {
    const cx = (caja.x0 + caja.x1) / 2 - (centrado ? 0 : 0.6), cz = (caja.z0 + caja.z1) / 2 + (centrado ? 0.3 : 3.0); // oblicuo: centra la esquina cercana
    let d = Math.max(caja.ancho, caja.fondo) * factor;
    if (camara.aspect < 1.3) d *= 1.3 / camara.aspect;
    const az = azimut * DEG, po = Math.max(2, polar) * DEG;
    // azimut medido desde +z (la calle) hacia -x: la cámara ve la fachada y la esquina izquierda
    return { pos: [cx - d * Math.sin(po) * Math.sin(az), d * Math.cos(po) + alto, cz + d * Math.sin(po) * Math.cos(az)], obj: [cx, alto, cz] };
  }

  /**
   * Viaje interpolando el objetivo en línea recta y la cámara en coordenadas esféricas alrededor de él
   * (radio, polar y azimut por el camino corto). Evita giros raros al entrar o salir de la vista cenital.
   */
  function viajeEsferico(pos, obj, op) {
    const t0 = controles.target.toArray(), p0 = camara.position.toArray();
    const esf = (p, t) => { const dx = p[0] - t[0], dy = p[1] - t[1], dz = p[2] - t[2], r = Math.hypot(dx, dy, dz); return { r, pol: Math.acos(Math.max(-1, Math.min(1, dy / r))), az: Math.atan2(dx, dz) }; };
    const b = esf(pos, obj); let a = esf(p0, t0);
    if (!(a.r > 1e-4)) a = { ...b }; // cámara sin posición previa (arranque)
    let dAz = b.az - a.az; dAz = ((dAz + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return anim.tween({
      dur: op.dur ?? 1400, delay: op.delay ?? 0, ease: op.ease ?? 'io',
      onUpdate: (e) => {
        const t = t0.map((v, i) => v + (obj[i] - v) * e);
        const r = a.r + (b.r - a.r) * e, pol = a.pol + (b.pol - a.pol) * e, az = a.az + dAz * e;
        controles.target.set(...t);
        camara.position.set(t[0] + r * Math.sin(pol) * Math.sin(az), t[1] + r * Math.cos(pol), t[2] + r * Math.sin(pol) * Math.cos(az));
        camara.lookAt(controles.target);
      },
    });
  }

  const api = {
    controles,
    /** true si el usuario tomó la cámara (la automática cede hasta reiniciar o pedir encuadre forzado). */
    get manual() { return manual; },
    set orbita(v) { orbita = !!v; },
    get orbita() { return orbita; },
    /**
     * Mueve la cámara a un encuadre. dur 0 = inmediato.
     * @param {{x0:number,z0:number,x1:number,z1:number,ancho:number,fondo:number}} caja
     * @param {{dur?:number, azimut?:number, polar?:number, factor?:number, forzar?:boolean}} op
     */
    encuadrar(caja, op = {}) {
      bb = caja;
      if (manual && !op.forzar) return anim.wait(0);
      if (op.forzar) manual = false;
      const { pos, obj } = plano(caja, op);
      tween?.cancel();
      tween = viajeEsferico(pos, obj, op);
      return tween;
    },
    /** Mueve la cámara a una posición y objetivo explícitos (planos especiales como el recorrido por pasillo). */
    mirar(pos, obj, op = {}) {
      if (manual && !op.forzar) return anim.wait(0);
      const p0 = camara.position.toArray(), t0 = controles.target.toArray();
      tween?.cancel();
      tween = anim.tween({ dur: op.dur ?? 1400, delay: op.delay ?? 0, ease: op.ease ?? 'io', onUpdate: (e) => {
        camara.position.set(...p0.map((v, i) => v + (pos[i] - v) * e)); controles.target.set(...t0.map((v, i) => v + (obj[i] - v) * e)); camara.lookAt(controles.target);
      } });
      return tween;
    },
    /** Posición y objetivo de un encuadre sin moverse (para componer planos). */
    plano,
    /** Libera la cámara para que vuelva a obedecer a la coreografía. */
    recuperar() { manual = false; },
  };
  // Órbita lenta (paso de cierre / tecla O): 6°/s alrededor del objetivo, sobre el reloj.
  reloj.onTick((dt) => {
    if (!orbita || manual || !bb) return;
    const t = controles.target, p = camara.position, a = (6 * DEG * dt) / 1000;
    const dx = p.x - t.x, dz = p.z - t.z, c = Math.cos(a), s = Math.sin(a);
    p.x = t.x + dx * c - dz * s; p.z = t.z + dx * s + dz * c; camara.lookAt(t);
  }, 50);
  return api;
}
