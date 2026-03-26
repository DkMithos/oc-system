// src/utils/aprobaciones.js

// ============================================================
//  UMBRALES DE APROBACIÓN (configurables aquí)
// ============================================================
export const APPROVAL_THRESHOLDS = {
  operaciones: 0,          // Siempre requiere Operaciones
  gerenciaOperaciones: 10_000, // > 10,000 → requiere Gerencia Operaciones
  gerenciaGeneral: 50_000,    // >= 50,000 → requiere Gerencia General
};

// ============================================================
//  ROLES
// ============================================================
const GERENCIA_ROLES = [
  "gerencia operaciones",
  "gerencia general",
  "gerencia",
];

const BANDEJA_ROLES = ["operaciones", ...GERENCIA_ROLES];
const APPROVAL_ROLES = ["operaciones", ...GERENCIA_ROLES];

export const isGerenciaRole = (role = "") =>
  GERENCIA_ROLES.includes(String(role || "").toLowerCase());

export const isBandejaRole = (role = "") =>
  BANDEJA_ROLES.includes(String(role || "").toLowerCase());

export const isApprovalRole = (role = "") =>
  APPROVAL_ROLES.includes(String(role || "").toLowerCase());

// ============================================================
//  LÓGICA DE ESTADO INICIAL SEGÚN MONTO
// ============================================================

/**
 * Determina el estado inicial de la OC según el monto total.
 * @param {number} montoTotal - Total de la OC
 * @returns {string} Estado inicial
 */
export const determinarEstadoInicial = (montoTotal = 0) => {
  const monto = Number(montoTotal) || 0;
  // Todo pasa primero por Operaciones
  return "Pendiente de Operaciones";
};

/**
 * Calcula qué etapas de aprobación requiere esta OC según su monto.
 * @param {number} montoTotal
 * @returns {string[]} Lista de etapas requeridas en orden
 */
export const etapasRequeridas = (montoTotal = 0) => {
  const monto = Number(montoTotal) || 0;
  const etapas = ["Pendiente de Operaciones"];

  if (monto > APPROVAL_THRESHOLDS.gerenciaOperaciones) {
    etapas.push("Pendiente de Gerencia Operaciones");
  }
  if (monto >= APPROVAL_THRESHOLDS.gerenciaGeneral) {
    etapas.push("Pendiente de Gerencia General");
  }

  return etapas;
};

/**
 * Dado el estado actual de la OC (aprobado en un nivel), devuelve el siguiente estado.
 * @param {string} estadoActual
 * @param {number} montoTotal
 * @returns {string} Siguiente estado o "Aprobado" si ya terminó el flujo
 */
export const siguienteEstado = (estadoActual, montoTotal = 0) => {
  const etapas = etapasRequeridas(montoTotal);
  const idx = etapas.indexOf(estadoActual);

  if (idx === -1) return "Aprobado";
  if (idx + 1 < etapas.length) return etapas[idx + 1];
  return "Aprobado";
};

/**
 * Verifica si el rol tiene autoridad para aprobar la OC en su estado actual.
 * @param {string} estadoOC
 * @param {string} rol
 * @returns {boolean}
 */
export const puedeAprobarEnEstado = (estadoOC, rol) => {
  const rolNorm = String(rol || "").toLowerCase().trim();
  const estadoNorm = String(estadoOC || "");

  const mapa = {
    "Pendiente de Operaciones": ["operaciones", "admin"],
    "Pendiente de Gerencia Operaciones": ["gerencia operaciones", "admin"],
    "Pendiente de Gerencia General": ["gerencia general", "gerencia", "admin"],
  };

  const rolesAutorizados = mapa[estadoNorm] || [];
  return rolesAutorizados.includes(rolNorm);
};

// ============================================================
//  ESTADOS PENDIENTES POR ROL (para bandeja)
// ============================================================
const PENDING_BY_ROLE = {
  operaciones: ["Pendiente de Operaciones"],
  "gerencia operaciones": ["Pendiente de Gerencia Operaciones"],
  gerencia: ["Pendiente de Gerencia Operaciones", "Pendiente de Gerencia General"],
  "gerencia general": ["Pendiente de Gerencia General"],
};

export const pendingStatesForRole = (role = "") => {
  const key = String(role || "").toLowerCase();
  return PENDING_BY_ROLE[key] || [];
};

/**
 * ¿Esta OC está pendiente para que la firme/apruebe este rol/usuario?
 */
export const ocPendingForRole = (oc = {}, role = "", email = "") => {
  const estados = pendingStatesForRole(role);
  if (!estados.length) return false;

  const estado = oc?.estado || "";
  if (!estados.includes(estado)) return false;

  if (oc?.asignadoA && String(oc.asignadoA).toLowerCase() !== String(email || "").toLowerCase()) {
    return false;
  }

  if (Array.isArray(oc?.aprobadores)) {
    const yo = oc.aprobadores.find(
      (a) => String(a?.email || "").toLowerCase() === String(email || "").toLowerCase()
    );
    if (yo?.firmado) return false;
  }

  return true;
};
