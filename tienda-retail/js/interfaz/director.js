// DIRECTOR DE PASOS de la demo (guion). Frente: interfaz.
// Contrato (docs/design.md §7): cada paso es {id, titulo, rotulo, entrar(ops, {instantaneo})} y entrar() es
// SÍNCRONO: devuelve un Handle. Cada paso delega en una escena completa del núcleo (cámara, atenuado, rótulos,
// capas y transición), de modo que "ir a un paso" pueda reconstruir los anteriores al instante.

/** @type {{id:string, titulo:string, rotulo:string, entrar:(ops:any, op:{instantaneo:boolean})=>any}[]} */
export const PASOS = [
  { id: 'local', titulo: 'El local', rotulo: 'Losa, estructura y fachada',
    entrar: (ops) => ops.escenas.local() },
  { id: 'mobiliario', titulo: 'El mobiliario', rotulo: 'Ensamble por zonas',
    entrar: (ops) => ops.escenas.mobiliario() },
  { id: 'instalaciones', titulo: 'Las instalaciones', rotulo: 'Iluminación, aire acondicionado y refrigeración',
    entrar: (ops) => ops.escenas.instalaciones() },
  { id: 'layout', titulo: 'Nuevo layout', rotulo: 'Diseño generativo: alternativas evaluadas',
    entrar: (ops) => ops.escenas.nuevoLayout() },
  // Pasos 5 y 6: los dos locales distintos del de arranque (desde A: angosto y en esquina). `local` = cuál de los dos;
  // el título se toma de tituloPorLocal según el local que visita (lo resuelve el núcleo con ops.localDelPaso).
  { id: 'local-2', titulo: 'Local angosto', rotulo: 'El prototipo se adapta a otra forma de local', local: 1,
    tituloPorLocal: { A: 'Local rectangular', B: 'Local angosto', C: 'Local en esquina' },
    entrar: (ops) => ops.escenas.otroLocal(ops.localDelPaso(1)) },
  { id: 'local-3', titulo: 'Local en esquina', rotulo: 'Y a un tercer local, con otra geometría', local: 2,
    tituloPorLocal: { A: 'Local rectangular', B: 'Local angosto', C: 'Local en esquina' },
    entrar: (ops) => ops.escenas.otroLocal(ops.localDelPaso(2)) },
  { id: 'cierre', titulo: 'Cierre', rotulo: 'Un mismo prototipo, distintos locales',
    entrar: (ops) => ops.escenas.cierre() },
];
