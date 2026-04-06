// src/firebase/igvHelpers.js
// IGV configurable por región/rubro desde Firestore.
// Colección: configuracion/igv

import { doc, getDoc } from "firebase/firestore";
import { db } from "./config";

/** Tasa IGV estándar Perú */
export const IGV_STANDARD = 0.18;

/**
 * Zonas exoneradas de IGV por defecto (Ley 27037 — Amazonía).
 * El admin puede sobreescribir en Firestore.
 */
const ZONAS_EXONERADAS_DEFAULT = [
  "LORETO", "AMAZONAS", "SAN MARTIN", "UCAYALI", "MADRE DE DIOS",
];

/**
 * Rubros/servicios que no aplican IGV por defecto.
 * Ej: exportaciones, medicamentos, etc.
 */
const RUBROS_EXONERADOS_DEFAULT = [
  "EXPORTACION", "EXPORTACIONES",
  "MEDICAMENTOS", "PRODUCTOS AGRARIOS",
];

/** Carga la configuración de IGV desde Firestore */
export const obtenerConfigIGV = async () => {
  try {
    const snap = await getDoc(doc(db, "configuracion", "igv"));
    if (snap.exists()) return snap.data();
  } catch {}
  return null; // usa defaults si falla
};

/**
 * Determina si aplica IGV para una combinación zona/rubro.
 * @param {string} zona - Departamento del proveedor o proyecto
 * @param {string} rubro - Tipo de compra/servicio
 * @param {object|null} config - Config de Firestore (de obtenerConfigIGV)
 * @returns {{ aplica: boolean, tasa: number, motivo: string }}
 */
export const determinarIGV = (zona = "", rubro = "", config = null) => {
  const zonaNorm  = String(zona  || "").toUpperCase().trim();
  const rubroNorm = String(rubro || "").toUpperCase().trim();

  const zonasExoneradas  = config?.zonasExoneradas  || ZONAS_EXONERADAS_DEFAULT;
  const rubrosExonerados = config?.rubrosExonerados  || RUBROS_EXONERADOS_DEFAULT;
  const tasa             = config?.tasa              ?? IGV_STANDARD;

  if (zonaNorm && zonasExoneradas.includes(zonaNorm)) {
    return { aplica: false, tasa: 0, motivo: `Zona exonerada: ${zona}` };
  }
  if (rubroNorm && rubrosExonerados.some((r) => rubroNorm.includes(r))) {
    return { aplica: false, tasa: 0, motivo: `Rubro exonerado: ${rubro}` };
  }

  return { aplica: true, tasa, motivo: "" };
};

/**
 * Calcula subtotal, IGV y total de una OC.
 * @param {number} subtotal
 * @param {string} zona
 * @param {string} rubro
 * @param {object|null} config
 * @returns {{ subtotal, igv, total, igvAplica, tasa, motivo }}
 */
export const calcularTotales = (subtotal = 0, zona = "", rubro = "", config = null) => {
  const sub = Number(subtotal) || 0;
  const { aplica, tasa, motivo } = determinarIGV(zona, rubro, config);
  const igvMonto = aplica ? Math.round(sub * tasa * 100) / 100 : 0;
  return {
    subtotal:  sub,
    igv:       igvMonto,
    total:     Math.round((sub + igvMonto) * 100) / 100,
    igvAplica: aplica,
    tasa,
    motivo,
  };
};
