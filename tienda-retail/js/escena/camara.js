// Director de cámara: encuadres con nombre, tween sobre el reloj y cesión al usuario. Frente: núcleo.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import { DEG } from '../core/geom.js';
import { EASE } from '../core/anim.js';
const EASE_IO = EASE.io;

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
  // ---------- Pose base + deriva ----------
  // Las interpolaciones escriben la pose BASE (bPos, bObj); la cámara real es esa pose girada `phi` alrededor del eje
  // vertical que pasa por el centro del modelo (pivote). `phi` avanza con la deriva (órbita lenta). Al empezar cada
  // interpolación la pose real se vuelve base y phi = 0 ("hornear"): nunca hay salto, y como la velocidad de la
  // deriva se suma a la de la interpolación, la cámara no se queda quieta al final de un movimiento con curva.
  const bPos = camara.position.clone(), bObj = controles.target.clone();
  let phi = 0, omega = 0, omegaObj = 0, velOrbita = 3;
  function hornear() { bPos.copy(camara.position); bObj.copy(controles.target); phi = 0; E.on = false; }
  function componer() {
    if (phi === 0) { camara.position.copy(bPos); controles.target.copy(bObj); }
    else {
      const c = Math.cos(phi), s2 = Math.sin(phi);
      let dx = bPos.x - pivote.x, dz = bPos.z - pivote.z;
      camara.position.set(pivote.x + dx * c - dz * s2, bPos.y, pivote.z + dx * s2 + dz * c);
      dx = bObj.x - pivote.x; dz = bObj.z - pivote.z;
      controles.target.set(pivote.x + dx * c - dz * s2, bObj.y, pivote.z + dx * s2 + dz * c);
    }
    camara.lookAt(controles.target);
  }
  /** Gira (pos, obj) -grados alrededor del pivote: anticipa la deriva que acumulará una interpolación. */
  function preGirar(pos, obj, grados) {
    if (!grados) return;
    const a = -grados * DEG, c = Math.cos(a), s2 = Math.sin(a);
    for (const v of [pos, obj]) { const dx = v[0] - pivote.x, dz = v[2] - pivote.z; v[0] = pivote.x + dx * c - dz * s2; v[2] = pivote.z + dx * s2 + dz * c; }
  }
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
    hornear();
    const t0 = bObj.toArray(), p0 = bPos.toArray();
    const esf = (p, t) => { const dx = p[0] - t[0], dy = p[1] - t[1], dz = p[2] - t[2], r = Math.hypot(dx, dy, dz); return { r, pol: Math.acos(Math.max(-1, Math.min(1, dy / r))), az: Math.atan2(dx, dz) }; };
    const b = esf(pos, obj); let a = esf(p0, t0);
    if (!(a.r > 1e-4)) a = { ...b }; // cámara sin posición previa (arranque)
    let dAz = b.az - a.az; dAz = ((dAz + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return anim.tween({
      dur: op.dur ?? 1400, delay: op.delay ?? 0, ease: op.ease ?? 'io',
      onUpdate: (e) => {
        const tx = t0[0] + (obj[0] - t0[0]) * e, ty = t0[1] + (obj[1] - t0[1]) * e, tz = t0[2] + (obj[2] - t0[2]) * e;
        const r = (a.r + (b.r - a.r) * e) * (1 + (op.abombar || 0) * Math.sin(Math.PI * e)), pol = a.pol + (b.pol - a.pol) * e, az = a.az + dAz * e;
        bObj.set(tx, ty, tz);
        bPos.set(tx + r * Math.sin(pol) * Math.sin(az), ty + r * Math.cos(pol), tz + r * Math.sin(pol) * Math.cos(az));
        componer();
      },
    });
  }

  // ---------- Encuadre que sigue al azimut (R11) ----------
  // En los pasos 1-6 y en el cierre la cámara no guarda una pose: guarda PARÁMETROS (azimut, polar, llenado, altura de la
  // caja, área libre de la interfaz y planta del local). En cada cuadro se resuelve la pose para esos parámetros: el
  // edificio llena `llenado` del área libre en su dimensión limitante con el azimut REAL (con la deriva, el vaivén o la
  // órbita), sin recortarse ni meterse bajo la interfaz. Los viajes entre encuadres interpolan parámetros (no poses).
  // Todo en arreglos reservados al crear: no se asigna memoria por cuadro.
  const MAXV = 64, HOL_MURO = 0.25, HOL_LOSA = 0.6, Y0 = -0.3; // muro y losa sobresalen del polígono (cascaron.js, medido en pantalla)
  /** Planta (vértices x,z) de los dos locales que se mezclan (A → B al cambiar de local). */
  const plA = new Float64Array(MAXV * 2), plB = new Float64Array(MAXV * 2);
  const pC = new Float64Array((MAXV * 13 + 128) * 3); // puntos proyectados del cuadro (planta y equipos)
  const E = {
    on: false, az: 0, pol: 52, fill: 0.88, alto: 5.4, nA: 0, nB: 0, w: 0, // w: mezcla de la planta A hacia la B
    cA: [0, 0], cB: [0, 0], L: -0.9, R: 0.9, B: -0.9, T: 0.9, // área libre en NDC
  };
  const resA = new Float64Array(7), resB = new Float64Array(7); // d, tx, ty, tz, px, py, pz
  /** Puntos extra (equipos de azotea: x, y de su tope, z). Su altura se mezcla desde el pretil con E.wExt (sin saltos). */
  const MAXE = 128, ext = new Float64Array(MAXE * 3); let nExt = 0;
  E.wExt = 0;
  /**
   * Pico pasajero (muebles en formación sobre el pretil al cambiar de local): los vértices de la planta de cada
   * solución, 1.5 m hacia su centro, a la altura yPico, con su peso E.wPico.
   */
  let yPico = 0; E.wPico = 0;
  function cargarExtras(lista) { nExt = 0; for (const q of lista || []) { if (nExt >= MAXE) break; ext[3 * nExt] = q[0]; ext[3 * nExt + 1] = q[1]; ext[3 * nExt + 2] = q[2]; nExt++; } }
  let fovTan = Math.tan((camara.fov * DEG) / 2);
  function cargarPlanta(dst, caja) {
    const poly = caja.poligono && caja.poligono.length <= MAXV ? caja.poligono : [[caja.x0, caja.z0], [caja.x1, caja.z0], [caja.x1, caja.z1], [caja.x0, caja.z1]];
    for (let i = 0; i < poly.length; i++) { dst[2 * i] = poly[i][0]; dst[2 * i + 1] = poly[i][1]; }
    return poly.length;
  }
  /**
   * Pose para los parámetros dados (planta xz con n vértices, centro c), escrita en out. Cada vértice cuenta como un
   * cuadrado de ±HOL (muro y losa) a dos alturas. Bisección en la distancia y centrado en el plano de la imagen.
   */
  function resolver(xz, n, c, az, pol, fill, alto, aspect, out) {
    const po = Math.max(2, pol) * DEG, a = az * DEG;
    const dx = -Math.sin(po) * Math.sin(a), dy = Math.cos(po), dz = Math.sin(po) * Math.cos(a);
    const rl = Math.hypot(dz, dx) || 1, rx = dz / rl, rz = -dx / rl; // derecha = arriba × dir
    const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx;       // arriba de la imagen = dir × derecha
    const cx = c[0], cz = c[1], cy = alto * 0.25;
    let m = 0, cMax = -Infinity, cSum = 0;
    for (let i = 0; i < n; i++) for (let sx = -1; sx <= 1; sx += 2) for (let sz = -1; sz <= 1; sz += 2) for (let k = 0; k < 3; k++) {
      // losa (y = -0.3 y 0, sobresale 0.6 m) y tope del muro o pretil (y = alto, 0.25 m)
      const h = k === 2 ? HOL_MURO : HOL_LOSA;
      const vx = xz[2 * i] + sx * h - cx, vy = (k === 2 ? alto : k ? 0 : Y0) - cy, vz = xz[2 * i + 1] + sz * h - cz;
      const cc = vx * dx + vy * dy + vz * dz;
      pC[3 * m] = vx * rx + vz * rz; pC[3 * m + 1] = vx * ux + vy * uy + vz * uz; pC[3 * m + 2] = cc;
      if (cc > cMax) cMax = cc; cSum += cc; m++;
    }
    for (let i = 0; i < nExt && E.wExt > 0; i++) {
      // con peso parcial el punto se acerca al centro y baja al pretil: entra y sale sin saltos
      const vx = (ext[3 * i] - cx) * E.wExt, vy = alto + (ext[3 * i + 1] - alto) * E.wExt - cy, vz = (ext[3 * i + 2] - cz) * E.wExt;
      const cc = vx * dx + vy * dy + vz * dz;
      pC[3 * m] = vx * rx + vz * rz; pC[3 * m + 1] = vx * ux + vy * uy + vz * uz; pC[3 * m + 2] = cc;
      if (cc > cMax) cMax = cc; cSum += cc; m++;
    }
    for (let i = 0; i < n && E.wPico > 0; i++) {
      // vértices de la planta 1.5 m hacia el centro (en una planta en L no cae fuera del local)
      const ex = xz[2 * i] - cx, ez = xz[2 * i + 1] - cz, el = Math.hypot(ex, ez) || 1, f = Math.max(0, 1 - 1.5 / el);
      const vx = ex * f * E.wPico, vy = alto + (yPico - alto) * E.wPico - cy, vz = ez * f * E.wPico;
      const cc = vx * dx + vy * dy + vz * dz;
      pC[3 * m] = vx * rx + vz * rz; pC[3 * m + 1] = vx * ux + vy * uy + vz * uz; pC[3 * m + 2] = cc;
      if (cc > cMax) cMax = cc; cSum += cc; m++;
    }
    const cMed = cSum / m, ky = fovTan, kx = fovTan * aspect;
    const Wn = (E.R - E.L) * fill, Hn = (E.T - E.B) * fill, cxN = (E.L + E.R) / 2, cyN = (E.B + E.T) / 2;
    let ox = 0, oy = 0, d = 0;
    for (let it = 0; it < 5; it++) {
      let lo = cMax + 0.4, hi = cMax + 600;
      for (let b = 0; b < 28; b++) {
        d = (lo + hi) / 2;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let j = 0; j < m; j++) { const q = 1 / (d - pC[3 * j + 2]), x = (pC[3 * j] - ox) * q, y = (pC[3 * j + 1] - oy) * q; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (Math.max((x1 - x0) / kx / Wn, (y1 - y0) / ky / Hn) > 1) lo = d; else hi = d;
      }
      d = hi;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let j = 0; j < m; j++) { const q = 1 / (d - pC[3 * j + 2]), x = (pC[3 * j] - ox) * q, y = (pC[3 * j + 1] - oy) * q; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      ox += ((x0 + x1) / 2 / kx - cxN) * (d - cMed) * kx; oy += ((y0 + y1) / 2 / ky - cyN) * (d - cMed) * ky;
    }
    const tx = cx + rx * ox + ux * oy, ty = cy + uy * oy, tz = cz + rz * ox + uz * oy;
    out[0] = d; out[1] = tx; out[2] = ty; out[3] = tz; out[4] = tx + dx * d; out[5] = ty + dy * d; out[6] = tz + dz * d;
    return out;
  }
  /** Aplica a la cámara la pose de los parámetros vigentes + la deriva acumulada (phi). */
  function componerEncuadre() {
    const W = dom.clientWidth || innerWidth, H = dom.clientHeight || innerHeight, asp = W / H;
    fovTan = Math.tan((camara.fov * DEG) / 2);
    const az = E.az + phi / DEG;
    resolver(plA, E.nA, E.cA, az, E.pol, E.fill, E.alto, asp, resA);
    if (E.w > 0) {
      resolver(plB, E.nB, E.cB, az, E.pol, E.fill, E.alto, asp, resB);
      for (let k = 0; k < 7; k++) resA[k] += (resB[k] - resA[k]) * E.w;
    }
    camara.position.set(resA[4], resA[5], resA[6]); controles.target.set(resA[1], resA[2], resA[3]);
    camara.lookAt(controles.target);
    // pivote (para la velocidad de la deriva y el azimut actual): centro de la planta a la altura de encuadre
    pivote.set(E.cA[0] + (E.cB[0] - E.cA[0]) * E.w, E.alto * 0.25, E.cA[1] + (E.cB[1] - E.cA[1]) * E.w);
  }
  /** Área libre en px → NDC. */
  let libre = null; // {x0,y0,x1,y1} px
  function libreNdc(lb, out) {
    const W = dom.clientWidth || innerWidth, H = dom.clientHeight || innerHeight;
    const r = lb || { x0: 0.025 * H, y0: 0.025 * H, x1: W - 0.025 * H, y1: 0.975 * H };
    out.L = (2 * r.x0) / W - 1; out.R = (2 * r.x1) / W - 1; out.T = 1 - (2 * r.y0) / H; out.B = 1 - (2 * r.y1) / H;
    return out;
  }
  /** Parámetros de destino de un encuadre con nombre (op del encuadre). */
  function destino(caja, op) {
    return { az: op.azimut ?? 38, pol: op.polar ?? 52, fill: op.llenado ?? 0.88, alto: op.alto ?? 5.4, caja, lib: libreNdc(op.libre || libre, {}) };
  }
  const tmpNdc = { L: 0, R: 0, B: 0, T: 0 };
  /** Pose (sin mover la cámara) de un encuadre: para componer planos (salida del recorrido). */
  function poseEncuadre(caja, op = {}) {
    const g = { ...E }, plTmp = new Float64Array(MAXV * 2), n = cargarPlanta(plTmp, caja), c = [(caja.x0 + caja.x1) / 2, (caja.z0 + caja.z1) / 2];
    const lib = libreNdc(op.libre || libre, tmpNdc); E.L = lib.L; E.R = lib.R; E.B = lib.B; E.T = lib.T;
    const W = dom.clientWidth || innerWidth, H = dom.clientHeight || innerHeight; fovTan = Math.tan((camara.fov * DEG) / 2);
    const extPrev = ext.slice(0, 3 * nExt), nPrev = nExt;
    if (op.extras && op.extras.length) { cargarExtras(op.extras); E.wExt = 1; } else E.wExt = 0;
    const r = resolver(plTmp, n, c, op.azimut ?? 38, op.polar ?? 52, op.llenado ?? 0.88, op.alto ?? 5.4, W / H, new Float64Array(7));
    ext.set(extPrev); nExt = nPrev;
    Object.assign(E, { L: g.L, R: g.R, B: g.B, T: g.T, wExt: g.wExt });
    return { pos: [r[4], r[5], r[6]], obj: [r[1], r[2], r[3]] };
  }
  /** Fija los parámetros del encuadre sin animar (la pose sale de ellos en el acto). */
  function fijarParams(caja, op) {
    E.nA = cargarPlanta(plA, caja); E.cA[0] = (caja.x0 + caja.x1) / 2; E.cA[1] = (caja.z0 + caja.z1) / 2; E.w = 0; E.nB = 0;
    const lib = libreNdc(op.libre || libre, tmpNdc);
    Object.assign(E, { on: true, az: op.azimut ?? 38, pol: op.polar ?? 52, fill: op.llenado ?? 0.88, alto: op.alto ?? 5.4, L: lib.L, R: lib.R, B: lib.B, T: lib.T });
    if (op.extras && op.extras.length) { cargarExtras(op.extras); E.wExt = 1; } else E.wExt = 0;
    phi = 0; componerEncuadre(); bPos.copy(camara.position); bObj.copy(controles.target);
  }
  /** Viaje entre encuadres interpolando parámetros (azimut por el camino corto). Desde una pose libre: mezcla de poses. */
  function viajeParams(caja, op) {
    const dst = destino(caja, op);
    const mismaPlanta = E.on && E.nA > 0 && (() => { const n = cargarPlanta(pC, caja); if (n !== E.nA) return false; for (let i = 0; i < 2 * n; i++) if (Math.abs(pC[i] - plA[i]) > 1e-6) return false; return true; })();
    if (E.on) {
      // la deriva acumulada pasa al azimut base (sin salto); una mezcla de planta a medias se termina en la más cercana
      E.az += phi / DEG; phi = 0;
      if (E.w > 0) { if (E.w >= 0.5) { plA.set(plB.subarray(0, 2 * E.nB)); E.nA = E.nB; E.cA[0] = E.cB[0]; E.cA[1] = E.cB[1]; } E.w = 0; }
    }
    const libre0 = !E.on; // desde una pose libre (recorrido, mano del usuario): se mezcla la pose
    const p0 = camara.position.toArray(), t0 = controles.target.toArray();
    if (libre0) { E.nA = cargarPlanta(plA, caja); E.cA[0] = (caja.x0 + caja.x1) / 2; E.cA[1] = (caja.z0 + caja.z1) / 2; E.w = 0; E.az = dst.az; E.pol = dst.pol; E.fill = dst.fill; E.alto = dst.alto; Object.assign(E, dst.lib); }
    const cambia = E.on && !mismaPlanta && !libre0;
    if (cambia) { E.nB = cargarPlanta(plB, caja); E.cB[0] = (caja.x0 + caja.x1) / 2; E.cB[1] = (caja.z0 + caja.z1) / 2; }
    E.on = true;
    if (libre0) E.wExt = 0;
    const conExt = !!(op.extras && op.extras.length);
    yPico = op.pico || 0; E.wPico = 0;
    const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    // con `extrasAlFinal` los equipos nuevos se cargan a la mitad del viaje (peso 0): los viejos salen antes
    let extPendientes = conExt && op.extrasAlFinal;
    if (conExt && !extPendientes) cargarExtras(op.extras);
    const a = { az: E.az, pol: E.pol, fill: E.fill, alto: E.alto, L: E.L, R: E.R, B: E.B, T: E.T, wExt: E.wExt }, wExt1 = conExt ? 1 : 0;
    let dAz = dst.az - a.az; dAz = ((dAz + 180) % 360 + 360) % 360 - 180;
    const abombar = op.abombar || 0;
    return anim.tween({
      dur: op.dur ?? 1400, delay: op.delay ?? 0, ease: op.ease ?? 'io',
      onUpdate: (e, k) => {
        if (manual) return;
        // entra y sale con rampas largas: cuando el pico manda, la distancia sigue a su peso
        if (yPico) E.wPico = ss(k / 0.4) * (1 - ss((k - 0.7) / 0.28));
        E.az = a.az + dAz * e; E.pol = a.pol + (dst.pol - a.pol) * e; E.alto = a.alto + (dst.alto - a.alto) * e;
        E.fill = (a.fill + (dst.fill - a.fill) * e) / (1 + abombar * Math.sin(Math.PI * e));
        E.L = a.L + (dst.lib.L - a.L) * e; E.R = a.R + (dst.lib.R - a.R) * e; E.B = a.B + (dst.lib.B - a.B) * e; E.T = a.T + (dst.lib.T - a.T) * e;
        // mezcla de plantas: con `mezcla` [k0, k1] sigue la transformación del cascarón (misma curva 'io'); si no, el viaje
        if (cambia) E.w = op.mezcla ? EASE_IO(Math.min(1, Math.max(0, (k - op.mezcla[0]) / (op.mezcla[1] - op.mezcla[0])))) : e;
        // con `extrasAlFinal` (cambio de local: los equipos se retiran y se vuelven a trazar al final) los equipos salen
        // del cuadro al empezar y vuelven en el último 20 % del viaje
        if (extPendientes && k >= 0.5) { cargarExtras(op.extras); extPendientes = false; }
        E.wExt = op.extrasAlFinal ? Math.max(a.wExt * (1 - ss(k / 0.15)), ss((k - 0.8) / 0.2)) : a.wExt + (wExt1 - a.wExt) * e;
        componerEncuadre();
        if (libre0 && e < 1) { // mezcla desde la pose libre de partida
          const k = 1 - e; camara.position.set(camara.position.x * e + p0[0] * k, camara.position.y * e + p0[1] * k, camara.position.z * e + p0[2] * k);
          controles.target.set(controles.target.x * e + t0[0] * k, controles.target.y * e + t0[1] * k, controles.target.z * e + t0[2] * k); camara.lookAt(controles.target);
        }
        if (e >= 1 && cambia) { plA.set(plB.subarray(0, 2 * E.nB)); E.nA = E.nB; E.cA[0] = E.cB[0]; E.cA[1] = E.cB[1]; E.w = 0; }
      },
    });
  }

  // ---------- Desplazamiento de la imagen (planos cercanos): el punto de fuga va al centro del área libre ----------
  let desp = 0;
  const ultimo = { px: 0, py: 0, W: 0, H: 0 };
  function aplicarDesplazamiento() {
    if (desp === 0 && ultimo.px === 0 && ultimo.py === 0) return;
    const W = window.innerWidth, H = window.innerHeight; // sin forzar diseño (el lienzo ocupa la ventana)
    const r = libre || { x0: 0, y0: 0, x1: W, y1: H }, px = desp * ((r.x0 + r.x1 - W) / 2), py = desp * ((r.y0 + r.y1 - H) / 2);
    if (px === ultimo.px && py === ultimo.py && W === ultimo.W && H === ultimo.H) return;
    ultimo.px = px; ultimo.py = py; ultimo.W = W; ultimo.H = H;
    if (Math.abs(px) < 0.5 && Math.abs(py) < 0.5) camara.clearViewOffset(); else camara.setViewOffset(W, H, -px, -py, W, H);
    camara.updateProjectionMatrix();
  }
  reloj.onTick(aplicarDesplazamiento, 51);

  const tPos = new THREE.Vector3(), tObj = new THREE.Vector3();
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
      tween?.cancel();
      if (op.llenado) {
        // la deriva sumará omegaObj durante el viaje: el azimut de destino se descuenta de antemano
        const adelanto = op.anticipar !== false && !anim.instantaneo ? (omegaObj * ((op.dur ?? 1400) + (op.delay ?? 0)) * anim.ritmo) / 1000 : 0;
        if (anim.instantaneo || (op.dur ?? 1400) === 0) { fijarParams(caja, { ...op, azimut: (op.azimut ?? 38) - adelanto }); tween = anim.wait(0); return tween; }
        tween = viajeParams(caja, { ...op, azimut: (op.azimut ?? 38) - adelanto });
        return tween;
      }
      const { pos, obj } = plano(caja, op);
      // el pivote cambia con la pose ya horneada (phi = 0): sin salto
      hornear();
      pivote.fromArray(obj);
      if (op.anticipar !== false && !anim.instantaneo) preGirar(pos, obj, (omegaObj * ((op.dur ?? 1400) + (op.delay ?? 0)) * anim.ritmo) / 1000);
      tween = viajeEsferico(pos, obj, op);
      return tween;
    },
    /** Mueve la cámara a una posición y objetivo explícitos (planos especiales como el recorrido por pasillo). */
    mirar(pos, obj, op = {}) {
      if (manual && !op.forzar) return anim.wait(0);
      tween?.cancel(); hornear();
      const p0 = bPos.toArray(), t0 = bObj.toArray();
      tween = anim.tween({ dur: op.dur ?? 1400, delay: op.delay ?? 0, ease: op.ease ?? 'io', onUpdate: (e) => {
        bPos.set(p0[0] + (pos[0] - p0[0]) * e, p0[1] + (pos[1] - p0[1]) * e, p0[2] + (pos[2] - p0[2]) * e);
        bObj.set(t0[0] + (obj[0] - t0[0]) * e, t0[1] + (obj[1] - t0[1]) * e, t0[2] + (obj[2] - t0[2]) * e); componer();
      } });
      return tween;
    },
    /**
     * Viaje esférico alrededor de un objetivo explícito (acercamientos progresivos: el radio, la altura y el giro
     * cambian juntos, sin cortes bruscos).
     */
    viajar(pos, obj, op = {}) {
      if (manual && !op.forzar) return anim.wait(0);
      tween?.cancel(); tween = viajeEsferico(pos, obj, op); return tween; // viajeEsferico hornea
    },
    /**
     * Trayecto libre: en cada cuadro f(k, pos, obj) escribe en dos Vector3 reutilizados (sin asignar memoria) la
     * posición y el objetivo para el avance k (0..1, lineal). La cámara cede si el usuario la toma. @returns Handle
     */
    trayecto(f, op = {}) {
      if (manual && !op.forzar) return anim.wait(0);
      tween?.cancel(); hornear();
      tween = anim.tween({ dur: op.dur ?? 10000, delay: op.delay ?? 0, ease: 'lin', onUpdate: (e, k) => {
        if (manual) return;
        f(k, tPos, tObj); bPos.copy(tPos); bObj.copy(tObj); componer();
      } });
      return tween;
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
    /**
     * Plano cercano (m): en los planos a la altura de los ojos lo que quede a menos de esa distancia de la lente no
     * se dibuja (columnas o ductos que pasarían rozando). 0.3 = normal.
     */
    set cerca(v) { if (camara.near !== v) { camara.near = v; camara.updateProjectionMatrix(); } },
    get cerca() { return camara.near; },
    /** Posición y objetivo de un encuadre sin moverse (para componer planos). */
    plano, poseEncuadre,
    /** Fija un encuadre (parámetros) sin animar: la pose sale de ellos y desde ahí sigue la deriva u órbita. */
    fijarEncuadre(caja, op) { tween?.cancel(); bb = caja; fijarParams(caja, op); },
    /**
     * Área libre de la interfaz en px {x0, y0, x1, y1} (null = ventana con 2.5 % de borde). La miden la app y la
     * interfaz una vez por paso, modo, escala o tamaño; el encuadre la usa para los viajes que arrancan después.
     */
    set libre(r) { libre = r ? { ...r } : null; },
    get libre() { return libre; },
    /** Márgenes equivalentes {arriba, abajo, izq, der} (compatibilidad: rótulo del sorteo, desplazamiento). */
    set margenes(m) { const W = innerWidth, H = innerHeight; m = { arriba: 0, abajo: 0, izq: 0, der: 0, ...m }; libre = { x0: m.izq, y0: m.arriba, x1: W - m.der, y1: H - m.abajo }; },
    get margenes() { const W = innerWidth, H = innerHeight, r = libre || { x0: 0, y0: 0, x1: W, y1: H }; return { arriba: r.y0, abajo: H - r.y1, izq: r.x0, der: W - r.x1 }; },
    /** Parámetros del encuadre vigente (depuración y medidas). */
    get encuadre() { return { activo: E.on, azimut: E.az + phi / DEG, polar: E.pol, llenado: E.fill, alto: E.alto, libre }; },
    /** Azimut actual (grados, misma convención que los encuadres) de la cámara alrededor del centro del modelo. */
    azimutActual() { if (E.on) return E.az + phi / DEG; const p = camara.position; return Math.atan2(-(p.x - pivote.x), p.z - pivote.z) / DEG; },
    /** Libera la cámara para que vuelva a obedecer a la coreografía. */
    recuperar() { if (manual) hornear(); manual = false; },
    /**
     * Deriva (°/s, con signo: + = azimut creciente) alrededor del centro del modelo. Cambia de velocidad con
     * aceleración limitada (sin tirones). 0 = quieta. La órbita (tecla O y cierre) usa `velOrbita`.
     */
    set deriva(v) { omegaObj = v; },
    get deriva() { return omegaObj; },
    set velOrbita(v) { velOrbita = v; },
    /** Velocidad angular actual de la deriva (°/s). */
    get omega() { return omega; },
    /**
     * Acercamiento suave (remanso): la cámara avanza hacia su objetivo `frac` de la distancia en `dur` ms. Lo cancela
     * el siguiente movimiento (que arranca desde la pose alcanzada). @returns Handle
     */
    acercar(frac, { dur = 4000, ease = 'sine' } = {}) {
      if (manual) return anim.wait(0);
      if (E.on) return api.llenar(E.fill / Math.max(0.2, 1 - frac), { dur, ease });
      tween?.cancel(); hornear();
      const p0 = bPos.clone(), o = bObj.clone();
      tween = anim.tween({ dur, ease, aplicarInicio: false, onUpdate: (e) => { bPos.copy(p0).sub(o).multiplyScalar(1 - frac * e).add(o); componer(); } });
      return tween;
    },
    /**
     * Remanso con encuadre por parámetros: el llenado sube a `f` en `dur` ms (la cámara se acerca sin que el edificio
     * se salga, gire lo que gire). Lo cancela el siguiente movimiento. @returns Handle
     */
    llenar(f, { dur = 4000, ease = 'sine' } = {}) {
      if (manual || !E.on) return anim.wait(0);
      tween?.cancel();
      const a = E.fill;
      tween = anim.tween({ dur, ease, aplicarInicio: false, onUpdate: (e) => { if (!E.on || manual) return; E.fill = a + (f - a) * e; componerEncuadre(); } });
      return tween;
    },
    get llenado() { return E.fill; },
    /** Velocidad actual de la deriva en un punto (m/s), escrita en out [x, y, z]. */
    velDeriva(p, out) { const w = omega * DEG; out[0] = -(p[2] - pivote.z) * w; out[1] = 0; out[2] = (p[0] - pivote.x) * w; return out; },
    /** Deja la deriva en 0 de inmediato (planos en primera persona). */
    pararDeriva() { omega = omegaObj = 0; },
    /** La órbita arranca ya a su velocidad (la salida del recorrido llega con esa misma velocidad). */
    arrancarOrbita() { omega = velOrbita; },
    pivote,
  };
  // Deriva y órbita sobre el reloj: phi avanza con omega (que sigue a su objetivo con aceleración ≤ 2.5 °/s²).
  // La órbita (cierre, tecla O) gira cámara y objetivo juntos alrededor del centro del modelo: el desplazamiento
  // del encuadre (que deja libre el panel de indicadores) se conserva al girar.
  reloj.onTick((dt) => {
    if (manual || !bb) return;
    const obj = orbita ? velOrbita : omegaObj, acc = 2.5 * dt / 1000;
    omega = Math.abs(obj - omega) <= acc ? obj : omega + Math.sign(obj - omega) * acc;
    if (omega === 0) return;
    phi += (omega * DEG * dt) / 1000;
    if (E.on) componerEncuadre(); else componer();
  }, 50);
  return api;
}
