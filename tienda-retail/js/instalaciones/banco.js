// Banco de pruebas de instalaciones: un local con su layout, el módulo de instalaciones y reloj manual.
// Uso: banco-instalaciones.html?local=A&capas=luz,aire,frio   ·   window.__banco.{ir, trazar, retraer, vista, llamadas, plan}
import * as THREE from 'three';
import { crearReloj } from '../core/reloj.js';
import { crearAnim } from '../core/anim.js';
import { LOCALES } from '../datos/locales.js';
import { generarLayout } from '../gen/generador.js';
import { crearInstalaciones } from './index.js';

const q = new URLSearchParams(location.search);
const reloj = crearReloj({ manual: true });
const anim = crearAnim(reloj);
const cont = document.getElementById('escena');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x000000, 0);
cont.appendChild(renderer.domElement);
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 400);
escena.add(new THREE.HemisphereLight(0xffffff, 0xa29d92, 2.35));
const sol = new THREE.DirectionalLight(0xfff5e6, 1.25); escena.add(sol, sol.target);

const id = q.get('local') || 'A';
const local = LOCALES[id];
const layout = generarLayout(local, { semilla: q.get('semilla') ? +q.get('semilla') : 2026 });
const mep = crearInstalaciones({ escena, anim, reloj });

// escenografía mínima: losa, muros interiores y exteriores bajos, columnas y muebles como cajas
const mat = (c, o = 1) => new THREE.MeshLambertMaterial({ color: c, transparent: o < 1, opacity: o });
const sh = new THREE.Shape(local.poligono.map(([x, z]) => new THREE.Vector2(x, -z)));
const losa = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(0xe4e2dc)); losa.rotation.x = -Math.PI / 2; losa.position.y = -0.01; escena.add(losa);
const esc = new THREE.Group(); escena.add(esc);
for (let i = 0; i < local.poligono.length; i++) {
  const [x1, z1] = local.poligono[i], [x2, z2] = local.poligono[(i + 1) % local.poligono.length];
  const L = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.BoxGeometry(L, 4.8, 0.2), mat(0xd6d2c9, 0.18));
  m.position.set((x1 + x2) / 2, 2.4, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); esc.add(m);
}
for (const [x, z] of local.columnas) { const m = new THREE.Mesh(new THREE.BoxGeometry(local.columna, 4.8, local.columna), mat(0xa3a5a8)); m.position.set(x, 2.4, z); esc.add(m); }
for (const mu of layout.muros || []) {
  const L = Math.hypot(mu.b[0] - mu.a[0], mu.b[1] - mu.a[1]) + 0.15, m = new THREE.Mesh(new THREE.BoxGeometry(L, mu.altura, mu.espesor || 0.15), mat(0xefeee9));
  m.position.set((mu.a[0] + mu.b[0]) / 2, mu.altura / 2, (mu.a[1] + mu.b[1]) / 2); m.rotation.y = -Math.atan2(mu.b[1] - mu.a[1], mu.b[0] - mu.a[0]); esc.add(m);
}
for (const mu of layout.muebles) {
  const r = ((mu.rot % 360) + 360) % 360, sw = r === 90 || r === 270;
  const m = new THREE.Mesh(new THREE.BoxGeometry(sw ? mu.fondo : mu.ancho, mu.alto, sw ? mu.ancho : mu.fondo), mat(mu.frio ? 0xb8d4e0 : 0xc9ccd0)); m.position.set(mu.x, mu.alto / 2, mu.z); esc.add(m);
}
if (q.get('mobiliario') === '0') esc.children.filter((c) => c.geometry?.type === 'BoxGeometry' && c.position.y < 3 && c.material.color.getHex() !== 0xefeee9).forEach((c) => (c.visible = false));

const poly = local.poligono, bb = poly.reduce((a, [x, z]) => ({ x0: Math.min(a.x0, x), x1: Math.max(a.x1, x), z0: Math.min(a.z0, z), z1: Math.max(a.z1, z) }), { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
const centro = [(bb.x0 + bb.x1) / 2, (bb.z0 + bb.z1) / 2], R = Math.hypot(bb.x1 - bb.x0, bb.z1 - bb.z0) / 2;
function mirar(t, dist, azDeg = 36, polDeg = 52) {
  const az = azDeg * Math.PI / 180, pol = polDeg * Math.PI / 180;
  camara.position.set(t[0] + dist * Math.sin(az) * Math.sin(pol), t[1] + dist * Math.cos(pol), t[2] + dist * Math.cos(az) * Math.sin(pol));
  camara.up.set(0, 1, 0); if (polDeg < 2) camara.up.set(0, 0, -1);
  camara.lookAt(t[0], t[1], t[2]); sol.position.set(t[0] - 28, 55, t[2] + 34); sol.target.position.set(t[0], 0, t[2]); reloj.pedirCuadro();
}
function vista(v = 'general', o = {}) {
  if (v === 'cenital') mirar([centro[0], 0, centro[1]], R * 2.9, 0, 0.5);
  else if (typeof v === 'object') mirar(v.t, v.dist, v.az ?? 36, v.pol ?? 52);
  else mirar([centro[0], 0, centro[1] + 2], R * 3.2, o.az ?? 36, o.pol ?? 50);
}
vista('general');
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); reloj.pedirCuadro(); });
reloj.iniciar(() => renderer.render(escena, camara));

mep.setPlan(local, layout);
const capas = (q.get('capas') || '').split(',').filter(Boolean);
document.getElementById('info').textContent = q.get('info') === '0' ? '' : `Instalaciones · local ${id}`;

window.__banco = {
  mep, plan: mep.plan, layout, local, renderer, escena, camara,
  advance: (ms) => reloj.advance(ms),
  ir: (ms) => reloj.advance(ms),
  trazar: (c = ['luz', 'aire', 'frio']) => mep.trazar(c),
  retraer: (c) => mep.retraer(c),
  vista, mirar,
  llamadas: () => ({ ...mep.stats().llamadas, total: mep.stats().llamadasTotal, escena: renderer.info.render.calls, tris: renderer.info.render.triangles, geometrias: renderer.info.memory.geometries }),
  ahora: () => reloj.ahora,
  stats: () => mep.stats(),
};
if (capas.length) mep.trazar(capas);
reloj.pedirCuadro();
