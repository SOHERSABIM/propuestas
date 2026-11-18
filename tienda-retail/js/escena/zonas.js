// Zonas: tinte de piso por zona (rectángulos que se transforman entre layouts), rótulos flotantes y el parpadeo de
// alternativas evaluadas del paso 4. Frente: núcleo.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOMBRE_ZONA, ZONAS } from '../datos/catalogo.js';
import { PALETA, mate } from '../core/estilo.js';

const PLANO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const OPAC = 0.34;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/** @param {{escena:any, anim:any}} ctx */
export function crearZonas({ escena, anim, reloj, camara, dom }) {
  const raiz = new THREE.Group(); raiz.name = 'zonas'; escena.add(raiz);
  const gPiso = new THREE.Group(); const gTin = new THREE.Group(); const gFus = new THREE.Group(); gPiso.add(gTin, gFus); raiz.add(gPiso);
  const mats = Object.fromEntries(ZONAS.map((z) => [z, mate(PALETA.zona[z], 'arq', { transparent: true, opacity: OPAC, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })]));
  const matFus = mate(0xffffff, 'arq', { vertexColors: true, transparent: true, opacity: OPAC, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  /** pool de rectángulos por zona: {obj, r:{x0,z0,x1,z1}} */
  const pool = Object.fromEntries(ZONAS.map((z) => [z, []]));
  const rotulos = {};
  let verRotulos = false, nivel = 0, enCurso = null;
  /** Factor de aparición por zona (paso 2: cada zona se tiñe al llegar su oleada). 1 = normal. */
  const factor = Object.fromEntries(ZONAS.map((z) => [z, 1]));
  const todasCompletas = () => ZONAS.every((z) => factor[z] >= 0.999);

  // contador del parpadeo (rótulo 3D sobre el local)
  const elCont = document.createElement('div'); elCont.className = 'rotulo-alternativa'; elCont.style.opacity = '0';
  const elT = document.createElement('span'); elT.className = 'ra-t'; const elR = document.createElement('span'); elR.className = 'ra-r';
  elCont.append(elT, elR);
  const cont = new CSS2DObject(elCont); raiz.add(cont);
  /** Colocación del contador: al lado del plano, en el hueco más amplio del área libre (fuera de la planta). */
  let contCaja = null, contMargenes = null, contTam = null;
  const ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3), pTmp = new THREE.Vector3(), ndc = new THREE.Vector2();
  function colocarContador(W, H) {
    if (!contCaja) return;
    if (!contTam) contTam = { w: elCont.offsetWidth, h: elCont.offsetHeight };
    const m = contMargenes || {}, L = m.izq || 0, R = W - (m.der || 0), T = m.arriba || 0, B = H - (m.abajo || 0);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const x of [contCaja.x0, contCaja.x1]) for (const z of [contCaja.z0, contCaja.z1]) {
      pTmp.set(x, 0.3, z).project(camara); const sx = (pTmp.x * 0.5 + 0.5) * W, sy = (-pTmp.y * 0.5 + 0.5) * H;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const { w, h } = contTam, sep = 22;
    const huecos = [
      { g: x0 - L - w, x: x0 - sep - w / 2, y: (y0 + y1) / 2 }, { g: R - x1 - w, x: x1 + sep + w / 2, y: (y0 + y1) / 2 },
      { g: (B - y1 - h) * 3, x: (x0 + x1) / 2, y: y1 + sep + h / 2 }, { g: (y0 - T - h) * 3, x: (x0 + x1) / 2, y: y0 - sep - h / 2 },
    ];
    const mejor = huecos.reduce((a, b) => (b.g > a.g ? b : a));
    ndc.set((Math.min(R - w / 2 - 8, Math.max(L + w / 2 + 8, mejor.x)) / W) * 2 - 1, -(Math.min(B - h / 2 - 8, Math.max(T + h / 2 + 8, mejor.y)) / H) * 2 + 1);
    ray.setFromCamera(ndc, camara);
    if (ray.ray.intersectPlane(plano, pTmp)) cont.position.copy(pTmp);
  }

  // Rótulos: contenedor (lo posiciona CSS2D) + etiqueta interior (la desplaza el anti-encimado).
  const PRIORIDAD = ['autoservicio', 'refrigerados', 'ropa_hogar', 'mostrador', 'cajas', 'acceso', 'trastienda'];
  for (const z of ZONAS) {
    const el = document.createElement('div'); el.className = 'rotulo-zona-caja'; el.style.opacity = '0';
    const et = document.createElement('div'); et.className = 'rotulo-zona'; et.style.setProperty('--zona', hex(PALETA.zona[z])); et.textContent = NOMBRE_ZONA[z];
    el.appendChild(et);
    const o = new CSS2DObject(el); o.visible = false; o.userData = { fade: 0, vis: 1, dy: 0, et, w: 0, h: 0, op: -1, ty: null }; raiz.add(o); rotulos[z] = o;
  }
  // Anti-encimado en pantalla: por prioridad, si un rótulo choca con otro ya colocado se sube o baja un renglón;
  // si aún choca, se desvanece. Todo sobre el reloj (sin saltos).
  const pv = new THREE.Vector3(); let anchoPrevio = 0;
  reloj?.onTick((dt) => {
    // tamaño de la ventana (el lienzo la ocupa): leer clientWidth aquí forzaría a recalcular el diseño en cada cuadro
    const W = innerWidth, H = innerHeight; if (!W) return;
    colocarContador(W, H);
    if (W !== anchoPrevio) { anchoPrevio = W; for (const z of ZONAS) rotulos[z].userData.w = 0; }
    const puestos = [];
    for (const z of PRIORIDAD) {
      const o = rotulos[z], u = o.userData;
      let objetivo = 0, dy = 0;
      if (o.visible && u.fade > 0.01) {
        if (!u.w) { u.w = u.et.offsetWidth; u.h = u.et.offsetHeight; }
        pv.copy(o.position).project(camara);
        const x = (pv.x * 0.5 + 0.5) * W, y = (-pv.y * 0.5 + 0.5) * H;
        const caja = (d) => ({ x0: x - u.w / 2 - 6, x1: x + u.w / 2 + 6, y0: y - u.h / 2 + d - 4, y1: y + u.h / 2 + d + 4 });
        const choca = (r) => puestos.some((q) => r.x0 < q.x1 && q.x0 < r.x1 && r.y0 < q.y1 && q.y0 < r.y1);
        let ok = null;
        for (const d of [0, -(u.h + 8), u.h + 8, -2 * (u.h + 8)]) { if (!choca(caja(d))) { ok = d; break; } }
        if (ok != null && pv.z < 1) { objetivo = 1; dy = ok; puestos.push(caja(ok)); }
      }
      const k = Math.min(1, dt / 140);
      u.vis += (objetivo - u.vis) * k; u.dy += (dy - u.dy) * k;
      const op = Math.round(u.fade * u.vis * 100) / 100;
      if (op !== u.op) { u.op = op; o.element.style.opacity = String(op); }
      const ty = Math.round(u.dy);
      if (ty !== u.ty) { u.ty = ty; u.et.style.transform = `translateY(${ty}px)`; }
    }
  }, 90);

  function poner(it, r) {
    it.r = r; const w = r.x1 - r.x0, d = r.z1 - r.z0;
    it.obj.position.set((r.x0 + r.x1) / 2, 0.012, (r.z0 + r.z1) / 2); it.obj.scale.set(Math.max(1e-3, w), 1, Math.max(1e-3, d));
    it.obj.visible = w > 0.01 && d > 0.01;
  }
  function item(z, r) { const obj = new THREE.Mesh(PLANO, mats[z]); obj.renderOrder = 1; obj.receiveShadow = true; gTin.add(obj); const it = { obj, r }; poner(it, r); pool[z].push(it); return it; }
  const mayor = (rs) => rs.reduce((a, r) => ((r.x1 - r.x0) * (r.z1 - r.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? r : a), rs[0]);

  function desfusionar() { for (const o of gFus.children.slice()) { o.geometry.dispose(); gFus.remove(o); } gTin.visible = true; }
  function fusionar() {
    desfusionar();
    if (!todasCompletas()) return; // durante la aparición por zona cada tinte lleva su propia opacidad
    const gs = [];
    for (const z of ZONAS) for (const it of pool[z]) {
      if (!it.obj.visible) continue;
      it.obj.updateMatrixWorld(true);
      const g = PLANO.clone().applyMatrix4(it.obj.matrixWorld); const c = new THREE.Color(PALETA.zona[z]);
      const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); gs.push(g);
    }
    if (gs.length) { const m = new THREE.Mesh(mergeGeometries(gs), matFus); m.renderOrder = 1; m.receiveShadow = true; gFus.add(m); gs.forEach((g) => g.dispose()); gTin.visible = false; }
  }
  function opacidad(k) {
    nivel = k;
    for (const z of ZONAS) { const m = mats[z], o = OPAC * k * factor[z]; m.userData.opacidadBase = o; m.opacity = o; }
    matFus.userData.opacidadBase = OPAC * k; matFus.opacity = OPAC * k;
    gPiso.visible = k > 0.001;
  }

  /**
   * Interpola los tintes hacia una lista de zonas {id, rects}. Los rectángulos se emparejan por orden de tamaño.
   * @returns {any} Handle
   */
  function morfear(zonas, { dur = 900, delay = 0, ease = 'io' } = {}) {
    enCurso?.finish(); desfusionar();
    const hs = [];
    const porId = Object.fromEntries(ZONAS.map((z) => [z, []]));
    for (const z of zonas) porId[z.id]?.push(...z.rects);
    for (const z of ZONAS) {
      const dest = porId[z].slice().sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0));
      const items = pool[z].slice().sort((a, b) => (b.r.x1 - b.r.x0) * (b.r.z1 - b.r.z0) - (a.r.x1 - a.r.x0) * (a.r.z1 - a.r.z0));
      dest.forEach((r, i) => {
        let it = items[i];
        if (!it) { const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2; it = item(z, { x0: cx, z0: cz, x1: cx, z1: cz }); }
        const a = { ...it.r };
        hs.push(anim.tween({ delay, dur, ease, onUpdate: (k) => poner(it, { x0: a.x0 + (r.x0 - a.x0) * k, z0: a.z0 + (r.z0 - a.z0) * k, x1: a.x1 + (r.x1 - a.x1) * k, z1: a.z1 + (r.z1 - a.z1) * k }) }));
      });
      for (const it of items.slice(dest.length)) {
        const a = { ...it.r }, cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2;
        hs.push(anim.tween({ delay, dur, ease, onUpdate: (k) => poner(it, { x0: a.x0 + (cx - a.x0) * k, z0: a.z0 + (cz - a.z0) * k, x1: a.x1 + (cx - a.x1) * k, z1: a.z1 + (cz - a.z1) * k }) }));
      }
      // rótulo: al centro del rectángulo mayor
      const o = rotulos[z];
      if (dest.length) {
        const r = mayor(dest), p0 = o.position.clone(), p1 = new THREE.Vector3((r.x0 + r.x1) / 2, 3.0, (r.z0 + r.z1) / 2);
        if (!o.visible) p0.copy(p1);
        o.visible = true;
        hs.push(anim.tween({ delay, dur, ease, onUpdate: (k) => o.position.lerpVectors(p0, p1, k) }));
      }
    }
    enCurso = anim.all(hs).onDone(() => { enCurso = null; fusionar(); });
    return enCurso;
  }

  const api = {
    raiz,
    /** Coloca (sin animar) los tintes del layout, invisibles hasta mostrar(). */
    preparar(layout) {
      enCurso?.finish(); desfusionar();
      for (const z of ZONAS) { for (const it of pool[z]) gTin.remove(it.obj); pool[z] = []; rotulos[z].visible = false; rotulos[z].userData.fade = 0; factor[z] = 1; }
      anim.instantaneamente(() => morfear(layout.zonas || [], { dur: 0 }));
      opacidad(0);
    },
    /** Hace aparecer o desaparecer los tintes. */
    mostrar(ver, { dur = 900, delay = 0, nivel: n = 1 } = {}) {
      const a = nivel, b = ver ? n : 0;
      return anim.tween({ delay, dur, ease: 'io', onUpdate: (k) => opacidad(a + (b - a) * k) });
    },
    get nivel() { return nivel; },
    /**
     * Paso 2: las zonas aparecen una por una, al ritmo de las oleadas de muebles: el tinte de cada zona se
     * enciende y, poco después, su rótulo. Las zonas que no están en `orden` aparecen con la última.
     * @param {string[]} orden  zonas en el orden de las oleadas
     * @param {{inicio?:number, cada?:number, dur?:number, rotulos?:boolean, retardoRotulo?:number}} op
     */
    revelar(orden, { inicio = 0, cada = 1150, dur = 800, rotulos: conRotulos = true, retardoRotulo = 550 } = {}) {
      enCurso?.finish(); desfusionar();
      const pos = (z) => { const i = orden.indexOf(z); return i < 0 ? orden.length - 1 : i; };
      for (const z of ZONAS) factor[z] = 0;
      opacidad(1);
      const hs = ZONAS.map((z) => anim.tween({ delay: inicio + pos(z) * cada, dur, ease: 'out', onUpdate: (k) => { factor[z] = k; opacidad(nivel); } }));
      verRotulos = conRotulos;
      if (conRotulos) for (const z of ZONAS) {
        const o = rotulos[z]; if (!o.visible) continue;
        const a = o.userData.fade;
        hs.push(anim.tween({ delay: inicio + pos(z) * cada + retardoRotulo, dur: 450, ease: 'out', aplicarInicio: false, onUpdate: (e) => { o.userData.fade = a + (1 - a) * e; } }));
      }
      return anim.all(hs).onDone(() => { for (const z of ZONAS) factor[z] = 1; opacidad(nivel); fusionar(); });
    },
    transformar(layout, op) { return morfear(layout.zonas, op); },
    /** Rótulos flotantes de zona: aparecen escalonados. */
    rotulos(ver, { cada = 140, delay = 0 } = {}) {
      verRotulos = ver;
      const lista = ZONAS.map((z) => rotulos[z]).filter((o) => o.visible);
      return anim.all(lista.map((o, i) => { const a = o.userData.fade; return anim.tween({ delay: delay + (ver ? i * cada : 0), dur: 450, ease: 'out', aplicarInicio: false, onUpdate: (e) => { o.userData.fade = a + ((ver ? 1 : 0) - a) * e; } }); }));
    },
    get visibles() { return verRotulos; },
    /**
     * Parpadeo de alternativas evaluadas: los tintes saltan por los diagramas de zonas de candidatos reales,
     * con un contador "Alternativa i de N · calificación". Termina en el layout elegido.
     * @param {{indice:number, valido:boolean, total:number, zonas:any[]}[]} muestras
     * @param {{evaluados:number, elegido:any, cada?:number, centro:[number,number,number]}} op
     */
    parpadeo(muestras, { evaluados, elegido, cada = 170, centro, caja: bb = null, margenes = null }) {
      cont.position.set(...centro);
      contCaja = bb; contMargenes = margenes; contTam = null;
      const pasos = [() => anim.tween({ dur: 250, onUpdate: (k) => { elCont.style.opacity = String(k); } })];
      muestras.forEach((m, i) => pasos.push(() => {
        elT.textContent = `Alternativa ${m.indice + 1} de ${evaluados}`; elR.textContent = m.valido ? `${m.total.toFixed(1)} pts` : 'descartada';
        if (i === 0) contTam = null; // se mide una vez con texto (el ancho casi no cambia entre alternativas)
        elCont.classList.toggle('descartada', !m.valido);
        return morfear(m.zonas, { dur: Math.max(60, cada - 40 - Math.min(60, i * 4)), ease: 'out' });
      }));
      pasos.push(() => {
        elT.textContent = `Elegida: alternativa ${elegido.candidato + 1}`; elR.textContent = `${elegido.calificacion.total.toFixed(1)} pts`; contTam = null;
        elCont.classList.remove('descartada'); elCont.classList.add('elegida');
        return morfear(elegido.zonas, { dur: 600, ease: 'io' });
      });
      pasos.push(900, () => anim.tween({ dur: 400, onUpdate: (k) => { elCont.style.opacity = String(1 - k); } }).onDone(() => { elCont.classList.remove('elegida'); contCaja = null; }));
      return anim.seq(pasos);
    },
    stats() { return { rects: ZONAS.reduce((s, z) => s + pool[z].length, 0), fusionado: gFus.children.length > 0 }; },
  };
  return api;
}
