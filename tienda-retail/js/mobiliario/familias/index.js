// Registro de familias: id del catálogo → función constructora (b: Constructor, c: contexto).
import { gondola_central, cabecera_gondola, estanteria_mural, exhibidor_isla_promo } from './autoservicio.js';
import { refrigerador_vertical, camara_fria, congelador_isla } from './frio.js';
import { mueble_caja, caja_mostrador } from './cajas.js';
import { rack_redondo, rack_cuatro_brazos, rack_recto_doble, mesa_exhibicion, maniqui, probador, probador_accesible } from './ropa.js';
import { vitrina_cristal, mostrador_servicio, estanteria_alta_densidad } from './mostrador.js';
import { rack_selectivo } from './trastienda.js';
import { carrito, canastilla, tarima_aparador } from './acceso.js';

export const CONSTRUCTORES = {
  gondola_central, cabecera_gondola, estanteria_mural, exhibidor_isla_promo,
  refrigerador_vertical, camara_fria, congelador_isla,
  mueble_caja, caja_mostrador,
  rack_redondo, rack_cuatro_brazos, rack_recto_doble, mesa_exhibicion, maniqui, probador, probador_accesible,
  vitrina_cristal, mostrador_servicio, estanteria_alta_densidad,
  rack_selectivo,
  carrito, canastilla, tarima_aparador,
};
