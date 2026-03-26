// ✅ src/utils/aprobaciones.js

// Diccionario centralizado de roles para evitar typos
export const ROLES = {
  ADMIN: "admin",
  SOPORTE: "soporte",
  COMPRADOR: "comprador",
  OPERACIONES: "operaciones",
  GERENCIA_OP: "gerencia operaciones",
  GERENCIA_GEN: "gerencia general",
  GERENCIA: "gerencia",
  FINANZAS: "finanzas",
  GERENCIA_FIN: "gerencia finanzas",
  ADMINISTRACION: "administracion",
  LEGAL: "legal"
};

// ⚙️ Configuración dinámica de IGV (Zonas Especiales)
export const TAX_CONFIG = {
  IGV_STANDARD: 0.18,
  ZONAS_EXONERADAS: ["LORETO", "AMAZONAS", "SAN MARTIN", "UCAYALI", "MADRE DE DIOS"],
  obtenerTasa: (departamento = "") => {
    const dep = String(departamento).toUpperCase().trim();
    return TAX_CONFIG.ZONAS_EXONERADAS.includes(dep) ? 0 : TAX_CONFIG.IGV_STANDARD;
  }
};

// 💰 Tiers de Aprobación (Regla de Negocio)
export const getRequiredApprovals = (montoTotal = 0) => {
  const steps = [ROLES.OPERACIONES]; // Siempre empieza en operaciones
  
  if (montoTotal > 10000) {
    steps.push(ROLES.GERENCIA_OP);
  }
  if (montoTotal >= 50000) {
    steps.push(ROLES.GERENCIA_GEN);
  }
  return steps;
};

export const calcularSiguienteEstado = (monto, rolActual) => {
  if (monto > 10000 && rolActual === ROLES.OPERACIONES) return "Pendiente de Gerencia Operaciones";
  if (monto >= 50000 && rolActual === ROLES.GERENCIA_OP) return "Pendiente de Gerencia General";
  return "Aprobada";
};

// Roles de GERENCIA
const GERENCIA_ROLES = [
  ROLES.GERENCIA_OP,
  ROLES.GERENCIA_GEN,
  ROLES.GERENCIA,
];

// Roles que muestran "Bandeja/Pendientes" en el header
const BANDEJA_ROLES = [ROLES.OPERACIONES, ...GERENCIA_ROLES];

// Roles que aprueban/firman (para contadores u otros permisos)
const APPROVAL_ROLES = [ROLES.OPERACIONES, ...GERENCIA_ROLES];

export const isGerenciaRole = (role = "") =>
  GERENCIA_ROLES.includes(String(role || "").toLowerCase());

export const isBandejaRole = (role = "") =>
  BANDEJA_ROLES.includes(String(role || "").toLowerCase());

export const isApprovalRole = (role = "") =>
  APPROVAL_ROLES.includes(String(role || "").toLowerCase());

// Estados “pendientes” por rol con el nuevo flujo
const PENDING_BY_ROLE = {
  [ROLES.OPERACIONES]: ["Pendiente de Operaciones"],
  [ROLES.GERENCIA_OP]: ["Pendiente de Gerencia Operaciones"],
  [ROLES.GERENCIA]: ["Pendiente de Gerencia Operaciones"], 
  [ROLES.GERENCIA_GEN]: ["Pendiente de Gerencia General"],
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
