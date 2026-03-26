// src/utils/igv.js
// Lógica de IGV configurable por zona (Perú).
// No hardcodea ningún valor: todo viene de configuración o Firestore.
//
// ZONAS SIN IGV en Perú (Ley de Promoción de la Inversión en la Amazonía):
// - Loreto, Ucayali, Madre de Dios, Amazonas, San Martín (y otras según normativa vigente)
//
// Para extender: agregar zonas a ZONAS_EXONERADAS o cargarlas dinámicamente
// desde Firestore (colección "configuracion/igv").

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// Tasa de IGV estándar en Perú (18 = 18%)
export const IGV_TASA_DEFAULT = 18;

// Zonas exoneradas de IGV (hardcoded como fallback — pueden sobreescribirse desde Firestore)
const ZONAS_EXONERADAS_DEFAULT = [
  "loreto",
  "ucayali",
  "madre de dios",
  "amazonas",
  "san martin",
];

// Cache en memoria para no leer Firestore en cada cálculo
let _configCache = null;

/**
 * Carga la configuración de IGV desde Firestore.
 * Estructura esperada en configuracion/igv:
 *   { tasaDefault: 18, zonasExoneradas: ["loreto", ...] }
 */
export const cargarConfigIGV = async () => {
  if (_configCache) return _configCache;
  try {
    const snap = await getDoc(doc(db, "configuracion", "igv"));
    if (snap.exists()) {
      _configCache = snap.data();
    } else {
      _configCache = {
        tasaDefault: IGV_TASA_DEFAULT,
        zonasExoneradas: ZONAS_EXONERADAS_DEFAULT,
      };
    }
  } catch {
    _configCache = {
      tasaDefault: IGV_TASA_DEFAULT,
      zonasExoneradas: ZONAS_EXONERADAS_DEFAULT,
    };
  }
  return _configCache;
};

/**
 * Invalida el cache de configuración (llamar si se actualiza desde Admin).
 */
export const invalidarCacheIGV = () => {
  _configCache = null;
};

/**
 * Determina si una zona está exonerada de IGV.
 * @param {string} zona - Nombre de la región/departamento (case-insensitive)
 * @returns {boolean}
 */
export const zonaExoneradaDeIGV = async (zona) => {
  if (!zona) return false;
  const config = await cargarConfigIGV();
  const zonas = (config.zonasExoneradas || ZONAS_EXONERADAS_DEFAULT).map((z) =>
    String(z).toLowerCase().trim()
  );
  return zonas.includes(String(zona).toLowerCase().trim());
};

/**
 * Calcula IGV y totales dado un subtotal y una zona.
 * Si la zona está exonerada, IGV = 0.
 *
 * @param {number} subtotal
 * @param {string} zonaProveedor - Región del proveedor
 * @param {string} [zonaProyecto] - Región del proyecto (si difiere, prima el proveedor)
 * @returns {{ subtotal, igvTasa, igv, total, exonerado }}
 */
export const calcularTotalesConIGV = async (subtotal, zonaProveedor, zonaProyecto = "") => {
  const config = await cargarConfigIGV();
  const tasa = config.tasaDefault ?? IGV_TASA_DEFAULT;

  const exoneradoProveedor = await zonaExoneradaDeIGV(zonaProveedor);
  const exoneradoProyecto  = zonaProyecto ? await zonaExoneradaDeIGV(zonaProyecto) : false;

  // Exonerado si AMBAS zonas lo son, o solo la del proveedor si no hay proyecto
  const exonerado = zonaProyecto
    ? exoneradoProveedor && exoneradoProyecto
    : exoneradoProveedor;

  const igvTasa = exonerado ? 0 : tasa;
  const igv = exonerado ? 0 : Math.round(subtotal * (tasa / 100) * 100) / 100;
  const total = subtotal + igv;

  return { subtotal, igvTasa, igv, total, exonerado };
};

/**
 * Versión síncrona con tasa ya conocida (para uso en componentes sin async).
 * Pasar exonerado=true para omitir IGV.
 *
 * @param {number} subtotal
 * @param {boolean} exonerado
 * @param {number} [tasa=18]
 */
export const calcularTotalesSync = (subtotal, exonerado, tasa = IGV_TASA_DEFAULT) => {
  const igvTasa = exonerado ? 0 : tasa;
  const igv = exonerado ? 0 : Math.round(subtotal * (tasa / 100) * 100) / 100;
  return { subtotal, igvTasa, igv, total: subtotal + igv, exonerado };
};

/**
 * Guarda la configuración de IGV en Firestore (solo admin).
 * @param {{ tasaDefault: number, zonasExoneradas: string[] }} config
 */
export const guardarConfigIGV = async (config) => {
  await setDoc(doc(db, "configuracion", "igv"), config, { merge: true });
  invalidarCacheIGV();
};
