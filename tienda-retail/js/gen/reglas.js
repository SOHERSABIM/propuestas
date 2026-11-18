// Reglas de colocación por familia (lógica pura). Fuente: docs/rules.json y docs/catalog.json.
import { FAMILIAS } from '../datos/catalogo.js';

/** Pasillo libre mínimo exigido frente a cada lado de acceso del mueble (m). Lo usa la validación. */
export const FRENTE_MIN = {
  gondola_central: 1.2, cabecera_gondola: 1.2, estanteria_mural: 1.2, refrigerador_vertical: 1.2, camara_fria: 1.2,
  congelador_isla: 0.9, mueble_caja: 0.91, caja_mostrador: 0.91, rack_redondo: 0.9, rack_cuatro_brazos: 0.9,
  rack_recto_doble: 0.9, mesa_exhibicion: 0.9, maniqui: 0.6, probador: 1.2, probador_accesible: 1.52,
  vitrina_cristal: 0.9, mostrador_servicio: 1.2, estanteria_alta_densidad: 0.9, rack_selectivo: 2.7,
  exhibidor_isla_promo: 1.2, carrito: 0.3, canastilla: 0.3, tarima_aparador: 0.6,
};
/** Lados por los que se usa el mueble: f frente, b fondo, s costados. */
export const LADOS = {
  gondola_central: 'fb', congelador_isla: 'fb', rack_recto_doble: 'fb', rack_redondo: 'fbs', rack_cuatro_brazos: 'fbs',
  mesa_exhibicion: 'fbs', exhibidor_isla_promo: 'fbs',
};
export const ladosDe = (fam) => LADOS[fam] || 'f';
export const medida = (fam) => FAMILIAS[fam].modulo;

/** Metros lineales de exhibición que aporta un mueble (para el indicador y la calificación). */
export function mlDe(m) {
  switch (m.familia) {
    case 'gondola_central': case 'rack_recto_doble': return 2 * m.ancho;
    case 'cabecera_gondola': case 'estanteria_mural': case 'refrigerador_vertical': case 'congelador_isla':
    case 'estanteria_alta_densidad': case 'vitrina_cristal': case 'camara_fria': return m.ancho;
    default: return 0;
  }
}
