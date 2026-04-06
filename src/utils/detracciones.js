// src/utils/detracciones.js
// Lógica de Detracciones y Retenciones según normativa SUNAT Perú.
// Configurable desde Admin; defaults basados en Resolución 183-2004/SUNAT.

/**
 * TABLAS DE DETRACCIONES (SPOT) — Resolución 183-2004/SUNAT y modificatorias.
 * Estos porcentajes son los mínimos por ley. Pueden configurarse en Admin.
 */
export const TASAS_DETRACCION = {
  // Bienes
  "MAIZ AMARILLO DURO":             0.04,
  "ARENA Y PIEDRA":                 0.10,
  "RESIDUOS SUBPRODUCTOS CHATARRA": 0.10,
  "MADERA":                         0.04,
  "ACEITE DE PESCADO":              0.09,
  "HARINA DE PESCADO":              0.09,
  // Servicios
  "INTERMEDIACION LABORAL":         0.12,
  "ARRENDAMIENTO DE BIENES":        0.10,
  "FABRICACION DE BIENES POR ENCARGO": 0.10,
  "TRANSPORTE BIENES":              0.04,
  "TRANSPORTE PERSONAS":            0.10,
  "SERVICIOS EMPRESARIALES":        0.12,
  "MANTENIMIENTO REPARACION":       0.12,
  "CONTRATOS CONSTRUCCION":         0.04,
  "DEMAS SERVICIOS":                0.12,
  // Genérico
  "DEFAULT_BIENES":                 0.10,
  "DEFAULT_SERVICIOS":              0.12,
};

/** Umbral mínimo para aplicar detracción: S/ 700 (SUNAT) */
export const UMBRAL_DETRACCION_SOLES = 700;
export const UMBRAL_DETRACCION_USD   = 200; // aprox, para montos en USD

/**
 * TASAS DE RETENCIÓN — Resolución 037-2002/SUNAT (régimen general: 3%).
 */
export const TASA_RETENCION_GENERAL = 0.03;

/** Umbral para agentes de retención: >S/ 700 */
export const UMBRAL_RETENCION_SOLES = 700;

/**
 * Calcula la detracción para una OC.
 * @param {number} monto - Monto total de la OC (en moneda seleccionada)
 * @param {string} moneda - "Soles" | "Dólares"
 * @param {string} tipoOperacion - Tipo de bien/servicio
 * @param {boolean} esAgenteDetraccion - Si el proveedor tiene cuenta BN
 * @param {object|null} config - Config de Firestore (override de tasas)
 * @returns {{ aplica: boolean, tasa: number, monto: number, motivo: string }}
 */
export const calcularDetraccion = (
  monto = 0,
  moneda = "Soles",
  tipoOperacion = "",
  esAgenteDetraccion = false,
  config = null
) => {
  const m = Number(monto) || 0;
  const esSoles = moneda === "Soles" || moneda === "PEN";
  const umbral  = esSoles ? UMBRAL_DETRACCION_SOLES : UMBRAL_DETRACCION_USD;

  if (m <= umbral) {
    return { aplica: false, tasa: 0, monto: 0, motivo: `Monto ≤ S/${umbral}` };
  }

  const operacionNorm = String(tipoOperacion || "").toUpperCase().trim();
  const tablaTasas    = config?.tasasDetraccion || TASAS_DETRACCION;

  // Buscar tasa por tipo de operación
  let tasa = null;
  for (const [key, val] of Object.entries(tablaTasas)) {
    if (operacionNorm.includes(key) || key.includes(operacionNorm)) {
      tasa = val;
      break;
    }
  }

  // Fallback
  if (tasa === null) {
    tasa = operacionNorm.includes("SERVICIO")
      ? (tablaTasas["DEFAULT_SERVICIOS"] ?? 0.12)
      : (tablaTasas["DEFAULT_BIENES"]    ?? 0.10);
  }

  const montoDet = Math.round(m * tasa * 100) / 100;
  return {
    aplica: true,
    tasa,
    monto:  montoDet,
    motivo: `Detracción ${Math.round(tasa * 100)}% sobre ${esSoles ? "S/" : "$"}${m.toFixed(2)}`,
  };
};

/**
 * Calcula la retención para una OC (solo agentes de retención nominados por SUNAT).
 * @param {number} monto
 * @param {string} moneda
 * @param {boolean} esAgenteRetencion - Si el comprador es agente de retención
 * @param {object|null} config
 * @returns {{ aplica: boolean, tasa: number, monto: number, motivo: string }}
 */
export const calcularRetencion = (
  monto = 0,
  moneda = "Soles",
  esAgenteRetencion = false,
  config = null
) => {
  if (!esAgenteRetencion) {
    return { aplica: false, tasa: 0, monto: 0, motivo: "No es agente de retención" };
  }

  const m      = Number(monto) || 0;
  const umbral = (moneda === "Soles" || moneda === "PEN") ? UMBRAL_RETENCION_SOLES : 200;

  if (m <= umbral) {
    return { aplica: false, tasa: 0, monto: 0, motivo: `Monto ≤ ${umbral}` };
  }

  const tasa  = config?.tasaRetencion ?? TASA_RETENCION_GENERAL;
  const montoR = Math.round(m * tasa * 100) / 100;

  return {
    aplica: true,
    tasa,
    monto:  montoR,
    motivo: `Retención ${Math.round(tasa * 100)}% sobre ${moneda === "Soles" ? "S/" : "$"}${m.toFixed(2)}`,
  };
};

/**
 * Resumen completo de obligaciones tributarias de una OC.
 */
export const calcularObligacionesTributarias = (
  monto = 0,
  moneda = "Soles",
  tipoOperacion = "",
  opciones = {}
) => {
  const {
    esAgenteDetraccion = false,
    esAgenteRetencion  = false,
    config = null,
  } = opciones;

  const detraccion = calcularDetraccion(monto, moneda, tipoOperacion, esAgenteDetraccion, config);
  const retencion  = calcularRetencion(monto, moneda, esAgenteRetencion, config);

  const montoNeto = Number(monto) - (detraccion.aplica ? detraccion.monto : 0) - (retencion.aplica ? retencion.monto : 0);

  return {
    bruto:      Number(monto),
    detraccion,
    retencion,
    neto:       Math.max(0, Math.round(montoNeto * 100) / 100),
  };
};
