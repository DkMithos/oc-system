// ✅ src/utils/aprobaciones.js (unificado)

export const ROLE_KEYS = {
  operaciones: "operaciones",
  gerenciaOperaciones: "gerenciaOperaciones",
  gerenciaGeneral: "gerenciaGeneral",
};

// Estado inicial recomendado al crear OC/OS
export function estadoInicial(oc) {
  if (oc?.tipoOrden === "OI") return "Pendiente de Gerencia General";
  return "Pendiente de Operaciones";
}

// mapear rol de usuario → clave interna
export function rolToKey(userRol = "") {
  const r = String(userRol || "").toLowerCase();
  if (r.includes("operac") && !r.includes("gerencia")) return ROLE_KEYS.operaciones;
  if (r.includes("gerencia") && r.includes("operac")) return ROLE_KEYS.gerenciaOperaciones;
  if (r.includes("gerencia") && (r.includes("general") || r.includes("gral"))) return ROLE_KEYS.gerenciaGeneral;
  return null;
}

export function yaFirmo(oc, roleKey) {
  return Boolean(oc?.firmas?.[roleKey]);
}

// ¿puede firmar este usuario?
export function ocPendingForRole(oc, userRol, userEmail) {
  if (!oc || !userRol || !userEmail) return false;

  const estado = oc.estado || "Pendiente de Operaciones";
  const rolKey = rolToKey(userRol);
  if (!rolKey) return false;
  if (yaFirmo(oc, rolKey)) return false;

  if (estado === "Pendiente" || estado === "Pendiente de Operaciones")
    return rolKey === ROLE_KEYS.operaciones;

  if (estado === "Pendiente de Gerencia de Operaciones")
    return rolKey === ROLE_KEYS.gerenciaOperaciones;

  if (estado === "Pendiente de Gerencia General")
    return rolKey === ROLE_KEYS.gerenciaGeneral;

  return false;
}

// estado siguiente al aprobar
export function nextEstadoAprobando(actual = "") {
  switch (actual) {
    case "Pendiente":
    case "Pendiente de Operaciones":
      return "Pendiente de Gerencia de Operaciones";
    case "Pendiente de Gerencia de Operaciones":
      return "Pendiente de Gerencia General";
    case "Pendiente de Gerencia General":
      return "Aprobado";
    default:
      return actual;
  }
}
