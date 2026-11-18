// Director de cámara: encuadres con nombre, tween sobre el reloj y cesión al usuario. Frente: núcleo.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
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
        const tx = t0[0] + (obj[0] - t0[0]) * e, ty = t0[1] + (obj[1] - t0[1]) * e, tz = t0[2] + (obj[2] - t0[2]) * e;
        const r = a.r + (b.r - a.r) * e, pol = a.pol + (b.pol - a.pol) * e, az = a.az + dAz * e;
        controles.target.set(tx, ty, tz);
        camara.position.set(tx + r * Math.sin(pol) * Math.sin(az), ty + r * Math.cos(pol), tz + r * Math.sin(pol) * Math.cos(az));
        camara.lookAt(controles.target);
      },
    });
  }

  // ---------- Encuadre automático: el modelo llena una fracción del área libre (sin la interfaz) ----------
  const camTmp = new THREE.PerspectiveCamera(), v3 = new THREE.Vector3(), esquinas = Array.from({ length: 8 }, () => new THREE.Vector3());
  let margenes = { arriba: 0, abajo: 0, izq: 0, der: 0 };
  /**
   * Calcula posición y objetivo para que la caja (con altura) ocupe `llenado` del área libre, vista con azimut/polar.
   * @param {{x0:number,z0:number,x1:number,z1:number}} c
   */
  function ajustar(c, { azimut = 38, polar = 52, llenado = 0.78, alto = 5.4, holgura = 0.6 } = {}) {
    const W = dom.clientWidth || window.innerWidth, H = dom.clientHeight || window.innerHeight;
    camTmp.fov = camara.fov; camTmp.aspect = W / H; camTmp.near = 0.3; camTmp.far = 2000; camTmp.updateProjectionMatrix();
    const xs = [c.x0 - holgura, c.x1 + holgura], zs = [c.z0 - holgura, c.z1 + holgura], ys = [-0.3, alto];
    let k = 0; for (const x of xs) for (const y of ys) for (const z of zs) esquinas[k++].set(x, y, z);
    // área libre en NDC
    const m = margenes;
    const L = -1 + (2 * m.izq) / W, R = 1 - (2 * m.der) / W, B = -1 + (2 * m.abajo) / H, T = 1 - (2 * m.arriba) / H;
    const cxN = (L + R) / 2, cyN = (B + T) / 2, anchoN = (R - L) * llenado, altoN = (T - B) * llenado;
    const az = azimut * DEG, po = Math.max(2, polar) * DEG;
    const dir = new THREE.Vector3(-Math.sin(po) * Math.sin(az), Math.cos(po), Math.sin(po) * Math.cos(az));
    const obj = new THREE.Vector3((c.x0 + c.x1) / 2, alto * 0.25, (c.z0 + c.z1) / 2);
    const medir = (d) => {
      camTmp.position.copy(obj).addScaledVector(dir, d); camTmp.up.set(0, 1, 0); camTmp.lookAt(obj); camTmp.updateMatrixWorld(true);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const e of esquinas) { v3.copy(e).project(camTmp); x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); y0 = Math.min(y0, v3.y); y1 = Math.max(y1, v3.y); }
      return { x0, x1, y0, y1 };
    };
    let d = 60;
    for (let it = 0; it < 4; it++) {
      let lo = 3, hi = 600;
      for (let b = 0; b < 26; b++) { d = (lo + hi) / 2; const r = medir(d); const f = Math.max((r.x1 - r.x0) / anchoN, (r.y1 - r.y0) / altoN); if (f > 1) lo = d; else hi = d; }
      d = hi;
      // centrar: desplaza el objetivo en el plano de la cámara
      const r = medir(d), dx = (r.x0 + r.x1) / 2 - cxN, dy = (r.y0 + r.y1) / 2 - cyN;
      const t = Math.tan((camTmp.fov * DEG) / 2) * d;
      const der = new THREE.Vector3().setFromMatrixColumn(camTmp.matrixWorld, 0), arr = new THREE.Vector3().setFromMatrixColumn(camTmp.matrixWorld, 1);
      obj.addScaledVector(der, dx * t * camTmp.aspect).addScaledVector(arr, dy * t);
    }
    return { pos: obj.clone().addScaledVector(dir, d).toArray(), obj: obj.toArray() };
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
      const { pos, obj } = op.llenado ? ajustar(caja, op) : plano(caja, op);
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
        camara.position.set(p0[0] + (pos[0] - p0[0]) * e, p0[1] + (pos[1] - p0[1]) * e, p0[2] + (pos[2] - p0[2]) * e);
        controles.target.set(t0[0] + (obj[0] - t0[0]) * e, t0[1] + (obj[1] - t0[1]) * e, t0[2] + (obj[2] - t0[2]) * e); camara.lookAt(controles.target);
      } });
      return tween;
    },
    /** Posición y objetivo de un encuadre sin moverse (para componer planos). */
    plano, ajustar,
    /** Márgenes de la interfaz en px {arriba, abajo, izq, der}: el encuadre automático los respeta. */
    set margenes(m) { margenes = { arriba: 0, abajo: 0, izq: 0, der: 0, ...m }; },
    get margenes() { return margenes; },
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
