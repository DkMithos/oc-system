// src/firebase/igvHelpers.js
import { db } from "./config";
import { doc, getDoc, setDoc } from "firebase/firestore";

const IGV_DOC = doc(db, "configuracion", "igv");

// Tasa por defecto si no hay config en Firestore
const IGV_DEFAULT = {
  tasa: 0.18,
  zonasExentas: [],       // Nombres de zonas/regiones sin IGV (ej: "Loreto", "Ucayali")
  rubrosExentos: [],      // Tipos de proveedor exentos (ej: "AMAZONAS", "SELVA")
};

let _cache = null;

/**
 * Obtiene la configuración de IGV desde Firestore.
 * Usa caché en memoria para no consultar en cada cálculo.
 */
export const obtenerConfigIGV = async (force = false) => {
  if (_cache && !force) return _cache;
  try {
    const snap = await getDoc(IGV_DOC);
    _cache = snap.exists() ? { ...IGV_DEFAULT, ...snap.data() } : { ...IGV_DEFAULT };
  } catch {
    _cache = { ...IGV_DEFAULT };
  }
  return _cache;
};

/**
 * Guarda la configuración de IGV (solo admin).
 */
export const guardarConfigIGV = async (config) => {
  await setDoc(IGV_DOC, { ...IGV_DEFAULT, ...config }, { merge: true });
  _cache = null; // Invalida caché
};

/**
 * Determina si aplica IGV según la zona del proveedor/proyecto.
 * @param {string} zona - Nombre de la región (ej: "Loreto")
 * @param {string} [rubro] - Rubro del proveedor (ej: "SELVA")
 * @param {Object} [config] - Config ya cargada (opcional, evita async)
 * @returns {boolean} true si aplica IGV
 */
export const aplicaIGV = (zona = "", rubro = "", config = IGV_DEFAULT) => {
  const zonaNorm = String(zona || "").trim().toLowerCase();
  const rubroNorm = String(rubro || "").trim().toLowerCase();
  const zonasExentas = (config.zonasExentas || []).map((z) => z.toLowerCase());
  const rubrosExentos = (config.rubrosExentos || []).map((r) => r.toLowerCase());

  if (zonaNorm && zonasExentas.includes(zonaNorm)) return false;
  if (rubroNorm && rubrosExentos.includes(rubroNorm)) return false;
  return true;
};

/**
 * Calcula subtotal, IGV y total según configuración dinámica.
 * @param {number} subtotal
 * @param {string} zona - Zona del proveedor/proyecto
 * @param {string} [rubro]
 * @param {Object} [config] - Config IGV ya cargada
 */
export const calcularTotales = (subtotal, zona = "", rubro = "", config = IGV_DEFAULT) => {
  const sub = Number(subtotal) || 0;
  const tasa = Number(config.tasa ?? 0.18);
  const igvAplica = aplicaIGV(zona, rubro, config);
  const igv = igvAplica ? Math.round(sub * tasa * 100) / 100 : 0;
  const total = Math.round((sub + igv) * 100) / 100;
  return { subtotal: sub, igv, total, igvAplica, tasa };
};
