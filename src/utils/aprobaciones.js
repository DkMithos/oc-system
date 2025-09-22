// ✅ src/utils/aprobaciones.js

// Roles de GERENCIA
const GERENCIA_ROLES = [
  "gerencia",
  "gerencia general",
  "gerencia operaciones",
  "gerencia finanzas",
];

// Roles que muestran "Bandeja/Pendientes" en el header
// (incluye operaciones, y puedes sumar admin/soporte/finanzas si quieres ver todo)
const BANDEJA_ROLES = [...GERENCIA_ROLES, "operaciones"];

// Roles que aprueban/firman (para contador global y permisos de edición)
const APPROVAL_ROLES = [
  "operaciones",
  ...GERENCIA_ROLES,
  "finanzas",
  "admin",
  "soporte",
];

export const isGerenciaRole = (role = "") =>
  GERENCIA_ROLES.includes(String(role || "").toLowerCase());

export const isBandejaRole = (role = "") =>
  BANDEJA_ROLES.includes(String(role || "").toLowerCase());

export const isApprovalRole = (role = "") =>
  APPROVAL_ROLES.includes(String(role || "").toLowerCase());

// Estados “pendientes” por rol (ajústalo a tu flujo real)
const PENDING_BY_ROLE = {
  "operaciones": ["Pendiente de Operaciones"],
  "gerencia operaciones": ["Aprobado por Operaciones", "Pendiente de Gerencia"],
  "gerencia": ["Aprobado por Operaciones", "Pendiente de Gerencia"],
  "gerencia general": ["Aprobado por Operaciones", "Pendiente de Gerencia"],
  "finanzas": ["Aprobado por Gerencia", "Pendiente de Finanzas", "Aprobado por Operaciones"],
  "gerencia finanzas": ["Aprobado por Gerencia", "Pendiente de Finanzas", "Aprobado por Operaciones"],
  // admin/soporte si quisieras contarlos como “pendientes de todos”:
  "admin": ["Pendiente de Operaciones","Aprobado por Operaciones","Pendiente de Gerencia","Aprobado por Gerencia","Pendiente de Finanzas"],
  "soporte": ["Pendiente de Operaciones","Aprobado por Operaciones","Pendiente de Gerencia","Aprobado por Gerencia","Pendiente de Finanzas"],
};

export const pendingStatesForRole = (role = "") => {
  const key = String(role || "").toLowerCase();
  return PENDING_BY_ROLE[key] || [];
};

/**
 * ¿Esta OC está pendiente para que la firme/apruebe este rol/usuario?
 * - Filtra por estados esperados según rol
 * - Respeta asignación directa (asignadoA)
 * - Evita contar si el usuario ya firmó (si usas oc.aprobadores[])
 */
export const ocPendingForRole = (oc = {}, role = "", email = "") => {
  const estados = pendingStatesForRole(role);
  if (!estados.length) return false;

  const estado = oc?.estado || "";
  if (!estados.includes(estado)) return false;

  // Asignación directa por persona (si existe)
  if (oc?.asignadoA && String(oc.asignadoA).toLowerCase() !== String(email || "").toLowerCase()) {
    return false;
  }

  // Ya firmó (si manejas aprobadores por persona)
  if (Array.isArray(oc?.aprobadores)) {
    const yo = oc.aprobadores.find(
      (a) => String(a?.email || "").toLowerCase() === String(email || "").toLowerCase()
    );
    if (yo?.firmado) return false;
  }

  return true;
};
