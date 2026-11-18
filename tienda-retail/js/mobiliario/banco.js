// Banco de pruebas del mobiliario: un mueble a la vez con reloj manual, o validación de todas las familias.
// Uso: banco-mobiliario.html?familia=gondola_central&tramos=4&t=700&cam=iso   ·   window.__banco.validar()
import * as THREE from 'three';
import { crearReloj } from '../core/reloj.js';
import { crearAnim } from '../core/anim.js';
import { FAMILIAS } from '../datos/catalogo.js';
import { crearMueble, resumenMueble } from './index.js';

const q = new URLSearchParams(location.search);
const reloj = crearReloj({ manual: true });
const anim = crearAnim(reloj);

const cont = document.getElementById('escena');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
cont.appendChild(renderer.domElement);
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
escena.add(new THREE.HemisphereLight(0xffffff, 0xa29d92, 2.35));
const sol = new THREE.DirectionalLight(0xfff5e6, 1.25);
sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.radius = 4; sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.02;
escena.add(sol, sol.target);

/** Mueble de prueba con las medidas del catálogo (y tramos / alto opcionales). */
export function especificar(familia, tramos = 1, alto = null, n = 1) {
  const f = FAMILIAS[familia];
  return {
    id: `${familia}#${String(n).padStart(2, '0')}`, familia, zona: f.zona, x: 0, z: 0, rot: 0,
    ancho: Math.round(f.modulo.ancho * (f.modular ? tramos : 1) * 100) / 100, fondo: f.modulo.fondo, alto: alto ?? f.modulo.alto, variante: { tramos: f.modular ? tramos : 1 },
  };
}

let fx = null, piso = null;
function encuadrar(spec, modo, rotDeg) {
  const r = resumenMueble(spec), min = new THREE.Vector3(...r.min), max = new THREE.Vector3(...r.max);
  const c = min.clone().add(max).multiplyScalar(0.5), tam = max.clone().sub(min), R = Math.max(tam.length() * 0.5, 0.3);
  const az = ((rotDeg ?? 0) + (modo === 'frente' ? 0 : 36)) * Math.PI / 180;
  const pol = modo === 'frente' ? 84 : modo === 'bajo' ? 80 : modo === 'cerca' ? 62 : 56, pr = pol * Math.PI / 180;
  const dist = (R / Math.sin(camara.fov * Math.PI / 360)) * (modo === 'cerca' ? 0.78 : 0.95);
  if (modo === 'bajo') { camara.position.set(c.x + 1.2, 1.5, c.z + Math.max(tam.z, 1) / 2 + 2.6); camara.lookAt(c.x, Math.min(c.y, tam.y * 0.5, 1.2), c.z); }
  else { camara.position.set(c.x + dist * Math.sin(az) * Math.sin(pr), c.y + dist * Math.cos(pr), c.z + dist * Math.cos(az) * Math.sin(pr)); camara.lookAt(c); }
  sol.position.set(c.x - 6, 14, c.z + 8); sol.target.position.copy(c);
  const e = Math.max(R * 1.8, 2); Object.assign(sol.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 60 }); sol.shadow.camera.updateProjectionMatrix();
  if (piso) { escena.remove(piso); piso.geometry.dispose(); }
  piso = new THREE.Mesh(new THREE.BoxGeometry(tam.x + 3, 0.1, tam.z + 3), new THREE.MeshLambertMaterial({ color: 0xe4e2dc }));
  piso.position.set(c.x, -0.05, c.z); piso.receiveShadow = true; escena.add(piso);
}

export function montar(spec, { modo = 'iso', rot = 0 } = {}) {
  if (fx) fx.dispose();
  fx = crearMueble(spec, { anim }); fx.grupo.rotation.y = rot * Math.PI / 180; escena.add(fx.grupo);
  encuadrar(spec, modo, 0);
  return fx;
}

reloj.iniciar(() => renderer.render(escena, camara));

/** Recorre todas las familias (tramos 1..3, alturas de góndola) y reporta triángulos y desbordes de huella. */
function validar() {
  const filas = [];
  for (const id of Object.keys(FAMILIAS)) {
    const f = FAMILIAS[id], casos = f.modular ? [1, 2, 3, 4] : [1];
    for (const t of casos) for (const alto of id === 'gondola_central' || id === 'cabecera_gondola' ? [1.43, 1.83, 2.03] : [null]) {
      const s = especificar(id, t, alto), r = resumenMueble(s), tol = 0.02;
      const dx = Math.max(-s.ancho / 2 - r.min[0], r.max[0] - s.ancho / 2), dz = Math.max(-s.fondo / 2 - r.min[2], r.max[2] - s.fondo / 2), dy = Math.max(-r.min[1], r.max[1] - s.alto);
      filas.push({ familia: id, tramos: t, alto: s.alto, tris: r.tris, vidrio: r.trisVidrio, piezas: r.piezas, exceso: Math.round(Math.max(dx, dz, dy) * 1000) / 1000, fuera: Math.max(dx, dz, dy) > tol, bajoPiso: r.min[1] < -1e-4 });
    }
  }
  return filas;
}

const spec = especificar(q.get('familia') || 'gondola_central', +(q.get('tramos') || 1), q.get('alto') ? +q.get('alto') : null);
const fam = montar(spec, { modo: q.get('cam') || 'iso', rot: +(q.get('rot') || 0) });
if (q.get('info') !== '0') document.getElementById('info').textContent = `${FAMILIAS[spec.familia].nombre}${spec.variante.tramos > 1 ? ` · ${spec.variante.tramos} módulos` : ''}`;
fam.armar({});

window.__banco = {
  advance: (ms) => reloj.advance(ms), especificar, montar, validar, resumen: resumenMueble, familias: () => Object.keys(FAMILIAS),
  estado: () => ({ estado: fam.estado, ahora: reloj.ahora, activos: anim.activos }),
  desarmar: (op) => fx.desarmar(op), armar: (op) => fx.armar(op), fx: () => fx,
  ready: (async () => { await reloj.advance(q.get('t') ? +q.get('t') : 6000); return true; })(),
};
