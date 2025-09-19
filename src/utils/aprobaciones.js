// ✅ src/utils/aprobaciones.js

// Incluye todos tus nuevos nombres de rol "gerencia ..."
const GERENCIA_ROLES = [
  "gerencia",
  "gerencia general",
  "gerencia operaciones",
  "gerencia finanzas",
];

export const isGerenciaRole = (role) => GERENCIA_ROLES.includes(String(role || "").toLowerCase());

// Mapa simple de estados que “esperan” la firma del rol correspondiente.
// Ajusta estos arrays según tu flujo real.
// 🆕 Roles que deben ver la BANDEJA/PENDIENTES en header (incluye OPERACIONES)
const BANDEJA_ROLES = [...GERENCIA_ROLES, "operaciones"];

export const isBandejaRole = (role) =>
  BANDEJA_ROLES.includes(String(role || "").toLowerCase());

// Estados “pendientes” por rol (ajústalo a tu flujo real)
const PENDING_BY_ROLE = {
  "operaciones": ["Pendiente de Operaciones"],
  "gerencia operaciones": ["Pendiente de Operaciones"],

  // Cuando Operaciones aprueba
  "gerencia": ["Aprobado por Operaciones", "Pendiente de Gerencia"],
  "gerencia general": ["Aprobado por Operaciones", "Pendiente de Gerencia"],

  // Finanzas
  "finanzas": ["Aprobado por Gerencia", "Aprobado por Operaciones"],
  "gerencia finanzas": ["Aprobado por Gerencia", "Aprobado por Operaciones"],
};

export const pendingStatesForRole = (role) => {
  const key = String(role || "").toLowerCase();
  return PENDING_BY_ROLE[key] || [];
};

// Determina si una OC está pendiente para el rol/persona
export const ocPendingForRole = (oc, role, email) => {
  const estados = pendingStatesForRole(role);
  if (!estados.length) return false;

  const estado = oc?.estado || "";
  if (!estados.includes(estado)) return false;

  // Respeta asignación directa si existe
  if (oc?.asignadoA && String(oc.asignadoA).toLowerCase() !== String(email || "").toLowerCase()) {
    return false;
  }

  // Si guardas aprobadores por persona y ya firmó, no cuenta
  if (Array.isArray(oc?.aprobadores)) {
    const yo = oc.aprobadores.find(
      (a) => String(a?.email || "").toLowerCase() === String(email || "").toLowerCase()
    );
    if (yo?.firmado) return false;
  }

  return true;
};
