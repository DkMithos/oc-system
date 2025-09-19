// ✅ src/utils/aprobaciones.js
const GERENCIA_ROLES = new Set([
  "gerencia",
  "gerencia operaciones",
  "gerencia finanzas",
  "gerencia general",
  "finanzas",
]);

export function isGerenciaRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return GERENCIA_ROLES.has(r);
}

export function ocPendingForRole(oc, role, email) {
  const r = String(role || "").trim().toLowerCase();
  const estado = String(oc?.estado || "").trim().toLowerCase();

  const firmas = {
    comprador: !!oc?.firmaComprador,
    operaciones: !!oc?.firmaOperaciones,
    gerencia: !!oc?.firmaGerencia,
    finanzas: !!oc?.firmaFinanzas,
  };

  let stage = null;
  if (estado.includes("pendiente de operaciones")) stage = "operaciones";
  else if (estado.includes("aprobado por operaciones")) stage = "gerencia";
  else if (estado.includes("aprobado por gerencia")) stage = "finanzas";
  else if (estado.includes("pendiente de firma del comprador")) stage = "comprador";
  else if (estado.includes("pagado") || estado.includes("rechazado")) stage = "cerrado";

  if (!stage) {
    if (!firmas.operaciones) stage = "operaciones";
    else if (!firmas.gerencia) stage = "gerencia";
    else if (!firmas.finanzas) stage = "finanzas";
    else stage = "cerrado";
  }

  switch (stage) {
    case "operaciones":
      return r === "operaciones" || r === "gerencia operaciones";
    case "gerencia":
      return r === "gerencia" || r === "gerencia general" || r === "gerencia operaciones";
    case "finanzas":
      return r === "finanzas" || r === "gerencia finanzas";
    case "comprador":
      return r === "comprador";
    case "cerrado":
    default:
      return false;
  }
}
