// src/utils/aprobaciones.js
// Flujo de aprobaciones configurable.
// Los umbrales se leen desde Firestore (configuracion/aprobaciones).
// Default: ≤5000 SOL → solo Operaciones; >5000 → Gerencia General obligatoria.

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";

/** Catálogo central de roles */
export const ROLES = {
  ADMIN:          "admin",
  SOPORTE:        "soporte",
  COMPRADOR:      "comprador",
  OPERACIONES:    "operaciones",
  GERENCIA_OP:    "gerencia operaciones",
  GERENCIA_GEN:   "gerencia general",
  GERENCIA:       "gerencia",
  FINANZAS:       "finanzas",
  GERENCIA_FIN:   "gerencia finanzas",
  ADMINISTRACION: "administracion",
  LEGAL:          "legal",
};

/** Umbrales por defecto (modificables desde Admin → Firestore) */
export const UMBRALES_DEFAULT = {
  soloOperaciones:   5000,   // ≤ este valor → solo firma Operaciones
  gerenciaGeneral:   5000,   // > este valor → requiere Gerencia General
  monedaBase:        "Soles",
  tipoCambioDef:     3.8,    // usado para convertir USD → SOL si monto en USD
};

/** Lee la configuración de aprobaciones desde Firestore */
export const obtenerConfigAprobaciones = async () => {
  try {
    const snap = await getDoc(doc(db, "configuracion", "aprobaciones"));
    return snap.exists() ? snap.data() : UMBRALES_DEFAULT;
  } catch {
    return UMBRALES_DEFAULT;
  }
};

/** Guarda la configuración de aprobaciones (solo admin) */
export const guardarConfigAprobaciones = async (config) => {
  await setDoc(doc(db, "configuracion", "aprobaciones"), {
    ...UMBRALES_DEFAULT,
    ...config,
    actualizadoEn: new Date().toISOString(),
  }, { merge: true });
};

/**
 * Convierte monto a Soles para comparación con umbrales.
 * @param {number} monto
 * @param {string} moneda - "Soles" | "Dólares"
 * @param {number} tipoCambio
 */
const aSOL = (monto, moneda, tipoCambio) => {
  const m = Number(monto) || 0;
  if (moneda === "Dólares" || moneda === "USD") return m * (Number(tipoCambio) || 3.8);
  return m;
};

/**
 * Calcula las etapas requeridas para una OC según su monto.
 * Flujo: Comprador → Operaciones → (si >umbral) Gerencia General → Aprobada
 * @param {number} montoTotal - Total de la OC
 * @param {string} moneda - "Soles" | "Dólares"
 * @param {object|null} config - De obtenerConfigAprobaciones()
 * @returns {string[]} Lista de estados en orden
 */
export const etapasRequeridas = (montoTotal = 0, moneda = "Soles", config = null) => {
  const cfg    = config || UMBRALES_DEFAULT;
  const tc     = cfg.tipoCambioDef || 3.8;
  const mSOL   = aSOL(montoTotal, moneda, tc);
  const umbral = Number(cfg.soloOperaciones ?? cfg.gerenciaGeneral ?? 5000);

  const etapas = [
    "Pendiente de Comprador",
    "Pendiente de Operaciones",
  ];

  if (mSOL > umbral) {
    etapas.push("Pendiente de Gerencia General");
  }

  return etapas;
};

/**
 * Estado inicial de una OC recién creada (antes de que el comprador la firme).
 */
export const determinarEstadoInicial = () => "Pendiente de Comprador";

/**
 * Siguiente estado tras una aprobación.
 */
export const siguienteEstado = (estadoActual, montoTotal = 0, moneda = "Soles", config = null) => {
  const etapas = etapasRequeridas(montoTotal, moneda, config);
  const idx    = etapas.indexOf(estadoActual);
  if (idx === -1 || idx + 1 >= etapas.length) return "Aprobada";
  return etapas[idx + 1];
};

/**
 * ¿Puede este rol aprobar en el estado actual?
 */
export const puedeAprobarEnEstado = (estadoOC, rol) => {
  const r = String(rol || "").toLowerCase().trim();
  const MAPA = {
    "Pendiente de Comprador":        [ROLES.COMPRADOR, ROLES.ADMIN],
    "Pendiente de Operaciones":      [ROLES.OPERACIONES, ROLES.ADMIN],
    "Pendiente de Gerencia General": [ROLES.GERENCIA_GEN, ROLES.GERENCIA, ROLES.ADMIN],
  };
  return (MAPA[estadoOC] || []).includes(r);
};

// ─── Roles de interfaz ───────────────────────────────────────────────────────

const GERENCIA_ROLES  = [ROLES.GERENCIA_GEN, ROLES.GERENCIA, ROLES.GERENCIA_OP];
const BANDEJA_ROLES   = [ROLES.COMPRADOR, ROLES.OPERACIONES, ROLES.GERENCIA_OP, ...GERENCIA_ROLES];
const APPROVAL_ROLES  = [ROLES.COMPRADOR, ROLES.OPERACIONES, ROLES.GERENCIA_OP, ...GERENCIA_ROLES];

export const isGerenciaRole  = (r = "") => GERENCIA_ROLES.includes(String(r || "").toLowerCase());
export const isBandejaRole   = (r = "") => BANDEJA_ROLES.includes(String(r || "").toLowerCase());
export const isApprovalRole  = (r = "") => APPROVAL_ROLES.includes(String(r || "").toLowerCase());

/** Estados que este rol debe ver en su bandeja */
const PENDING_BY_ROLE = {
  [ROLES.COMPRADOR]:    ["Pendiente de Comprador"],
  [ROLES.OPERACIONES]:  ["Pendiente de Operaciones"],
  [ROLES.GERENCIA_OP]:  ["Pendiente de Operaciones", "Pendiente de Gerencia General"],
  [ROLES.GERENCIA_GEN]: ["Pendiente de Gerencia General"],
  [ROLES.GERENCIA]:     ["Pendiente de Gerencia General"],
};

export const pendingStatesForRole = (role = "") => {
  const key = String(role || "").toLowerCase();
  return PENDING_BY_ROLE[key] || [];
};

/**
 * ¿Esta OC está pendiente para este usuario?
 */
export const ocPendingForRole = (oc = {}, role = "", email = "") => {
  const estados = pendingStatesForRole(role);
  if (!estados.length) return false;

  const estado = oc?.estado || "";
  if (!estados.includes(estado)) return false;

  if (oc?.asignadoA && String(oc.asignadoA).toLowerCase() !== String(email).toLowerCase()) {
    return false;
  }

  if (Array.isArray(oc?.aprobadores)) {
    const yo = oc.aprobadores.find(
      (a) => String(a?.email || "").toLowerCase() === String(email).toLowerCase()
    );
    if (yo?.firmado) return false;
  }

  return true;
};

// ─── Config de IGV inline (para no importar igvHelpers desde aquí) ────────────

export const TAX_CONFIG = {
  IGV_STANDARD: 0.18,
  ZONAS_EXONERADAS: ["LORETO", "AMAZONAS", "SAN MARTIN", "UCAYALI", "MADRE DE DIOS"],
  obtenerTasa: (departamento = "") => {
    const dep = String(departamento).toUpperCase().trim();
    return TAX_CONFIG.ZONAS_EXONERADAS.includes(dep) ? 0 : TAX_CONFIG.IGV_STANDARD;
  },
};
