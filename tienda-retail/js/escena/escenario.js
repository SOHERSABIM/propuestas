// Escenario: renderer, escena, luces, sombras, rótulos CSS2D y bucle de dibujo. Frente: núcleo.
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * @param {HTMLElement} contenedor  #escena (el fondo degradado lo pone la hoja de estilos, no three)
 * @param {{reloj:any}} ctx
 */
export function crearEscenario(contenedor, { reloj }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap fue retirado en r18x (daría advertencia)
  contenedor.appendChild(renderer.domElement);

  const rotulos = new CSS2DRenderer();
  rotulos.domElement.className = 'capa-rotulos';
  contenedor.appendChild(rotulos.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 600);

  // Luz de relleno dominante + sol cálido suave (familia Betterware). Intensidades calibradas para r187.
  const hemi = new THREE.HemisphereLight(0xffffff, 0xa29d92, 2.35);
  const sol = new THREE.DirectionalLight(0xfff5e6, 1.25);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02; sol.shadow.radius = 4;
  escena.add(hemi, sol, sol.target);

  /** Ajusta el sol y su frustum de sombras al rectángulo envolvente del local. */
  function ajustarSol(bb) {
    const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, r = Math.max(26, Math.hypot(bb.ancho, bb.fondo) / 2 + 4);
    sol.position.set(cx - 28, 55, cz + 34); sol.target.position.set(cx, 0, cz);
    const c = sol.shadow.camera; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 160;
    c.updateProjectionMatrix();
  }

  function redimensionar() {
    const w = contenedor.clientWidth || window.innerWidth, h = contenedor.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); rotulos.setSize(w, h);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camara.aspect = w / h; camara.updateProjectionMatrix();
    reloj.pedirCuadro();
  }
  window.addEventListener('resize', redimensionar);
  redimensionar();

  // Elegir mueble: rayo contra las cajas (min/max) de cada mueble; devuelve el más cercano.
  const rayo = new THREE.Raycaster(), caja3 = new THREE.Box3(), pt = new THREE.Vector3();
  function elegir(xNdc, yNdc, cajas) {
    rayo.setFromCamera({ x: xNdc, y: yNdc }, camara);
    let mejor = null, dMin = Infinity;
    for (const c of cajas) {
      caja3.min.set(...c.min); caja3.max.set(...c.max);
      if (rayo.ray.intersectBox(caja3, pt)) { const d = pt.distanceTo(rayo.ray.origin); if (d < dMin) { dMin = d; mejor = c.spec; } }
    }
    return mejor;
  }
  const dibujar = () => { renderer.render(escena, camara); rotulos.render(escena, camara); };
  return { renderer, escena, camara, hemi, sol, rotulos, ajustarSol, redimensionar, dibujar, elegir };
}
