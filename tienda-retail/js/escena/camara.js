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
  /** Centro del modelo encuadrado: la órbita gira cámara y objetivo juntos alrededor de él (el modelo no se sale del área libre). */
  const pivote = new THREE.Vector3();
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
  function ajustar(c, { azimut = 38, polar = 52, llenado = 0.78, alto = 5.4, holgura = 0.6, orbital = false } = {}) {
    const W = dom.clientWidth || window.innerWidth, H = dom.clientHeight || window.innerHeight;
    camTmp.fov = camara.fov; camTmp.aspect = W / H; camTmp.near = 0.3; camTmp.far = 2000; camTmp.updateProjectionMatrix();
    const xs = [c.x0 - holgura, c.x1 + holgura], zs = [c.z0 - holgura, c.z1 + holgura], ys = [-0.3, alto];
    const ccx = (c.x0 + c.x1) / 2, ccz = (c.z0 + c.z1) / 2;
    // área libre en NDC
    const m = margenes;
    const L = -1 + (2 * m.izq) / W, R = 1 - (2 * m.der) / W, B = -1 + (2 * m.abajo) / H, T = 1 - (2 * m.arriba) / H;
    const cxN = (L + R) / 2, cyN = (B + T) / 2, anchoN = (R - L) * llenado, altoN = (T - B) * llenado;
    /** Distancia y objetivo para un azimut; con giro = g, la caja se gira g alrededor de su centro (órbita). */
    const resolver = (azGrados, giro, dFijo) => {
      let k = 0; const cg = Math.cos(giro), sg = Math.sin(giro);
      for (const x of xs) for (const y of ys) for (const z of zs) { const dx = x - ccx, dz = z - ccz; esquinas[k++].set(ccx + dx * cg + dz * sg, y, ccz - dx * sg + dz * cg); }
      const az = azGrados * DEG, po = Math.max(2, polar) * DEG;
      const dir = new THREE.Vector3(-Math.sin(po) * Math.sin(az), Math.cos(po), Math.sin(po) * Math.cos(az));
      const obj = new THREE.Vector3(ccx, alto * 0.25, ccz);
      const medir = (d) => {
        camTmp.position.copy(obj).addScaledVector(dir, d); camTmp.up.set(0, 1, 0); camTmp.lookAt(obj); camTmp.updateMatrixWorld(true);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const e of esquinas) { v3.copy(e).project(camTmp); x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); y0 = Math.min(y0, v3.y); y1 = Math.max(y1, v3.y); }
        return { x0, x1, y0, y1 };
      };
      let d = dFijo ?? 60;
      for (let it = 0; it < 4; it++) {
        if (dFijo == null) {
          let lo = 3, hi = 600;
          for (let b = 0; b < 26; b++) { d = (lo + hi) / 2; const r = medir(d); const f = Math.max((r.x1 - r.x0) / anchoN, (r.y1 - r.y0) / altoN); if (f > 1) lo = d; else hi = d; }
          d = hi;
        }
        // centrar: desplaza el objetivo en el plano de la cámara
        const r = medir(d), dx = (r.x0 + r.x1) / 2 - cxN, dy = (r.y0 + r.y1) / 2 - cyN;
        const t = Math.tan((camTmp.fov * DEG) / 2) * d;
        const der = new THREE.Vector3().setFromMatrixColumn(camTmp.matrixWorld, 0), arr = new THREE.Vector3().setFromMatrixColumn(camTmp.matrixWorld, 1);
        obj.addScaledVector(der, dx * t * camTmp.aspect).addScaledVector(arr, dy * t);
      }
      return { d, pos: obj.clone().addScaledVector(dir, d).toArray(), obj: obj.toArray() };
    };
    if (!orbital) { const r = resolver(azimut, 0); return { pos: r.pos, obj: r.obj }; }
    // órbita: la distancia es la mayor que exige la caja real girada en 12 azimuts (cabe al girar y llena más que
    // el cilindro circunscrito); el encuadre se centra en el azimut de partida
    let dMax = 0;
    for (let i = 0; i < 12; i++) dMax = Math.max(dMax, resolver(azimut, (i * 30) * DEG).d);
    const r = resolver(azimut, 0, dMax);
    return { pos: r.pos, obj: r.obj };
  }

  // ---------- Desplazamiento de la imagen (planos cercanos): el punto de fuga va al centro del área libre ----------
  let desp = 0;
  const ultimo = { px: 0, py: 0, W: 0, H: 0 };
  function aplicarDesplazamiento() {
    if (desp === 0 && ultimo.px === 0 && ultimo.py === 0) return;
    const W = window.innerWidth, H = window.innerHeight; // sin forzar diseño (el lienzo ocupa la ventana)
    const px = desp * ((margenes.izq - margenes.der) / 2), py = desp * ((margenes.arriba - margenes.abajo) / 2);
    if (px === ultimo.px && py === ultimo.py && W === ultimo.W && H === ultimo.H) return;
    ultimo.px = px; ultimo.py = py; ultimo.W = W; ultimo.H = H;
    if (Math.abs(px) < 0.5 && Math.abs(py) < 0.5) camara.clearViewOffset(); else camara.setViewOffset(W, H, -px, -py, W, H);
    camara.updateProjectionMatrix();
  }
  reloj.onTick(aplicarDesplazamiento, 51);

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
      if (op.llenado) pivote.set((caja.x0 + caja.x1) / 2, (op.alto ?? 5.4) * 0.25, (caja.z0 + caja.z1) / 2); else pivote.fromArray(obj);
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
    /**
     * Viaje esférico alrededor de un objetivo explícito (acercamientos progresivos: el radio, la altura y el giro
     * cambian juntos, sin cortes bruscos).
     */
    viajar(pos, obj, op = {}) {
      if (manual && !op.forzar) return anim.wait(0);
      tween?.cancel(); tween = viajeEsferico(pos, obj, op); return tween;
    },
    /**
     * Desplazamiento de la imagen hacia el centro del área libre de la interfaz (0 = centrado en pantalla, 1 =
     * centrado en el área libre). Para planos cercanos que no pueden usar el encuadre automático. @returns Handle
     */
    desplazar(v, { dur = 1200, delay = 0, ease = 'io' } = {}) {
      const a = desp;
      return anim.tween({ dur, delay, ease, onUpdate: (e) => { desp = a + (v - a) * e; } });
    },
    get desplazamiento() { return desp; },
    /** Posición y objetivo de un encuadre sin moverse (para componer planos). */
    plano, ajustar,
    /** Márgenes de la interfaz en px {arriba, abajo, izq, der}: el encuadre automático los respeta. */
    set margenes(m) { margenes = { arriba: 0, abajo: 0, izq: 0, der: 0, ...m }; },
    get margenes() { return margenes; },
    /** Azimut actual (grados, misma convención que los encuadres) de la cámara alrededor del centro del modelo. */
    azimutActual() { const p = camara.position; return Math.atan2(-(p.x - pivote.x), p.z - pivote.z) / DEG; },
    /** Libera la cámara para que vuelva a obedecer a la coreografía. */
    recuperar() { manual = false; },
  };
  // Órbita lenta (paso de cierre / tecla O): 6°/s, sobre el reloj. Gira cámara y objetivo juntos alrededor del centro
  // del modelo: el desplazamiento del encuadre (que deja libre el panel de indicadores) se conserva al girar.
  reloj.onTick((dt) => {
    if (!orbita || manual || !bb) return;
    const a = (6 * DEG * dt) / 1000, c = Math.cos(a), s = Math.sin(a);
    for (const v of [camara.position, controles.target]) {
      const dx = v.x - pivote.x, dz = v.z - pivote.z;
      v.x = pivote.x + dx * c - dz * s; v.z = pivote.z + dx * s + dz * c;
    }
    camara.lookAt(controles.target);
  }, 50);
  return api;
}
