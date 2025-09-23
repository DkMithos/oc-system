// ✅ src/utils/aprobaciones.js

// Roles de GERENCIA
const GERENCIA_ROLES = [
  "gerencia operaciones",
  "gerencia general",
  // si mantienes un rol genérico "gerencia" en otros módulos:
  "gerencia",
];

// Roles que muestran "Bandeja/Pendientes" en el header
const BANDEJA_ROLES = ["operaciones", ...GERENCIA_ROLES];

// Roles que aprueban/firman (para contadores u otros permisos)
const APPROVAL_ROLES = ["operaciones", ...GERENCIA_ROLES];

export const isGerenciaRole = (role = "") =>
  GERENCIA_ROLES.includes(String(role || "").toLowerCase());

export const isBandejaRole = (role = "") =>
  BANDEJA_ROLES.includes(String(role || "").toLowerCase());

export const isApprovalRole = (role = "") =>
  APPROVAL_ROLES.includes(String(role || "").toLowerCase());

// Estados “pendientes” por rol con el nuevo flujo
const PENDING_BY_ROLE = {
  operaciones: ["Pendiente de Operaciones"],
  "gerencia operaciones": ["Pendiente de Gerencia Operaciones"],
  "gerencia": ["Pendiente de Gerencia Operaciones"], // compat si existe
  "gerencia general": ["Pendiente de Gerencia General"],
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

  // Asignado a una persona concreta
  if (
    oc?.asignadoA &&
    String(oc.asignadoA).toLowerCase() !== String(email || "").toLowerCase()
  ) {
    return false;
  }

  // Ya firmó (si manejas aprovadores por persona)
  if (Array.isArray(oc?.aprobadores)) {
    const yo = oc.aprobadores.find(
      (a) =>
        String(a?.email || "").toLowerCase() ===
        String(email || "").toLowerCase()
    );
    if (yo?.firmado) return false;
  }

  return true;
};
