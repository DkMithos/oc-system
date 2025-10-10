// src/utils/aprobaciones.js

// -----------------------------
// Estados canónicos del flujo
// -----------------------------
export const ESTADOS = {
  PEND_OP: "Pendiente de Operaciones",
  PEND_GOP: "Pendiente de Gerencia Operaciones",
  PEND_GGRAL: "Pendiente de Gerencia General",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  PENDIENTE: "Pendiente", // compatibilidad antigua / fallback para OI
};

// -----------------------------
// Roles y utilitarios
// -----------------------------
export function rolToKey(rol = "") {
  const r = String(rol || "").toLowerCase().trim();
  if (r.includes("operac")) return "operaciones";
  if (r.includes("gerencia general")) return "gerenciaGeneral";
  if (r.includes("gerencia")) return "gerenciaOperaciones";
  if (r.includes("finanzas")) return "finanzas";
  return null;
}
// alias para evitar imports rotos en código legado
export const rolTokey = rolToKey;

// ¿el rol participa del flujo de aprobación?
export function isApprovalRole(rol = "") {
  const k = rolToKey(rol);
  return ["operaciones", "gerenciaOperaciones", "gerenciaGeneral", "finanzas"].includes(k || "");
}

// -----------------------------
// Estado inicial y transición
// -----------------------------
export function estadoInicial({ tipoOrden } = {}) {
  if (tipoOrden === "OC" || tipoOrden === "OS") return ESTADOS.PEND_OP;
  return ESTADOS.PENDIENTE; // OI u otros
}

export function nextEstadoAprobando(estadoActual = "") {
  switch (estadoActual) {
    case ESTADOS.PEND_OP:
    case "Pendiente": // compatibilidad con datos viejos
      return ESTADOS.PEND_GOP;
    case ESTADOS.PEND_GOP:
      return ESTADOS.PEND_GGRAL;
    case ESTADOS.PEND_GGRAL:
      return ESTADOS.APROBADO;
    default:
      return estadoActual;
  }
}
// alias para evitar errores de import
export const nextEstadoAprobado = nextEstadoAprobando;

// -----------------------------
// Firmas y permisos
// -----------------------------
export function yaFirmo(oc = {}, roleKey = "") {
  const f = oc.firmas || {};
  return !!f[roleKey];
}

// ¿La orden está pendiente para el rol dado?
export function ocPendingForRole(oc = {}, rol = "", _email = "") {
  const k = rolToKey(rol);
  if (!k) return false;

  const estado = oc.estado || ESTADOS.PEND_OP;

  if (k === "operaciones") {
    return (
      [ESTADOS.PEND_OP, ESTADOS.PENDIENTE].includes(estado) &&
      !yaFirmo(oc, "operaciones")
    );
  }
  if (k === "gerenciaOperaciones") {
    return estado === ESTADOS.PEND_GOP && !yaFirmo(oc, "gerenciaOperaciones");
  }
  if (k === "gerenciaGeneral") {
    return estado === ESTADOS.PEND_GGRAL && !yaFirmo(oc, "gerenciaGeneral");
  }
  if (k === "finanzas") {
    // Si más adelante incluyes firma de finanzas, ajusta el estado aquí.
    return false;
  }
  return false;
}
