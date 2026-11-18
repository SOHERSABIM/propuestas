// Línea de tiempo de cada capa (lógica pura). Todo en fracción del avance p de la capa (0..1).
// La distancia `d` de cada pieza es la distancia por la red desde su equipo (unidad paquete, condensadora o
// cabecera de hilera); la ventana de aparición crece de forma monótona con esa distancia: primero llega lo
// cercano al equipo y al final los extremos y los terminales.
import { clamp } from './util.js';

/** Duraciones de la capa en ms. Encadenadas (paso Instalaciones) y rápidas (re-trazo tras un cambio). */
export const DURACION = {
  larga: { luz: 4600, aire: 6600, frio: 5600 },    // luz 4–5 s · aire 6–7 s · frío 5–6 s
  rapida: { luz: 3200, aire: 3900, frio: 3600 },   // re-trazo en paralelo: ≤ 4 s
  retraer: 900,                                    // ≤ 1 s, en sentido inverso
};
/** ms tras los que arranca la capa siguiente cuando se trazan una tras otra. */
export const SALTO = { luz: 4000, aire: 5800, frio: 0 };

/**
 * @param {'luz'|'aire'|'frio'} capa
 * @param {string} ph  fase de la pieza (equipo, fan, bajante, soporte, red, flex, retorno, canal, cuelga, luz)
 * @param {number} dn  distancia normalizada 0..1 (d / dMax)
 * @param {number} k   orden entre equipos
 * @returns {[number, number]} [t0, dur]
 */
export function ventana(capa, ph, dn = 0, k = 0) {
  dn = clamp(dn);
  if (capa === 'aire') {
    switch (ph) {
      case 'bancada': return [0.052 * k, 0.05];
      case 'equipo': return [0.05 + 0.052 * k, 0.09];
      case 'fan': return [0.15 + 0.052 * k, 0.05];
      case 'bajante': return [0.10 + 0.05 * k, 0.07];
      case 'soporte': return [0.10 + 0.40 * dn, 0.07];
      case 'red': return [0.30 + 0.52 * dn, 0.09];
      case 'flex': return [0.34 + 0.56 * dn, 0.06];
      case 'retorno': return [0.34 + 0.56 * dn, 0.06];
    }
  } else if (capa === 'frio') {
    switch (ph) {
      case 'bancada': return [0.07 * k, 0.05];
      case 'equipo': return [0.05 + 0.07 * k, 0.09];
      case 'fan': return [0.15 + 0.07 * k, 0.05];
      case 'soporte': return [0.15 + 0.50 * dn, 0.07];
      case 'red': return [0.26 + 0.62 * dn, 0.10];
    }
  } else {
    switch (ph) {
      case 'canal': return [0.02 + 0.38 * dn, 0.10];
      case 'cuelga': return [0.12 + 0.50 * dn, 0.16];
      case 'luz': return [0.40 + 0.48 * dn, 0.12];
    }
  }
  return [0, 0.1];
}

/** Fracción de la red (d / dMax) ya instalada cuando la capa va en p. Sirve para dosificar los pulsos de flujo. */
export function alcanceRed(capa, p) {
  if (capa === 'aire') return clamp((p - 0.26) / 0.58);
  if (capa === 'frio') return clamp((p - 0.24) / 0.72);
  return clamp(p);
}
