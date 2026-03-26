// src/utils/consultaSunat.js

const RUC_REGEX = /^\d{11}$/;
const DNI_REGEX = /^\d{8}$/;

/**
 * Valida formato de RUC peruano:
 * - 11 dígitos
 * - Empieza en 10 (persona natural) o 20 (empresa)
 */
export const validarRUC = (ruc) => {
  const r = String(ruc || "").replace(/\D/g, "");
  if (!RUC_REGEX.test(r)) return { ok: false, mensaje: "El RUC debe tener exactamente 11 dígitos." };
  if (!["10", "20"].includes(r.slice(0, 2))) return { ok: false, mensaje: "RUC inválido: debe comenzar con 10 o 20." };
  return { ok: true, ruc: r };
};

const tryJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Consulta datos de un RUC en SUNAT.
 * Intenta: proxy same-origin → Cloud Function → datos vacíos (fallback)
 *
 * @param {string} ruc
 * @returns {{ ruc, razonSocial, direccion, estado, condicion }}
 */
export const consultarSunat = async (ruc) => {
  const { ok, mensaje, ruc: rucLimpio } = validarRUC(ruc);
  if (!ok) throw new Error(mensaje);

  const base = (import.meta.env?.VITE_FUNCTIONS_URL || "").replace(/\/$/, "");
  const candidates = [
    `/api/sunat?ruc=${encodeURIComponent(rucLimpio)}`,
    base ? `${base}/sunatProxy?ruc=${encodeURIComponent(rucLimpio)}` : null,
  ].filter(Boolean);

  let lastErr;
  for (const url of candidates) {
    try {
      const data = await tryJson(url);
      return {
        ruc: data.numeroDocumento || data.ruc || data.numero || rucLimpio,
        razonSocial: data.razonSocial || data.nombre || "",
        direccion: data.direccionFiscal || data.direccion || "",
        estado: data.estado || "",
        condicion: data.condicion || "",
      };
    } catch (e) {
      lastErr = e;
    }
  }

  // Si el error fue timeout, mensaje amigable
  if (lastErr?.name === "AbortError") {
    throw new Error("La consulta a SUNAT tardó demasiado. Verifica tu conexión o ingresa los datos manualmente.");
  }

  throw new Error(
    "No se pudo consultar SUNAT. Verifica que el RUC sea correcto o ingresa los datos manualmente."
  );
};

/**
 * Wrapper seguro: nunca lanza, devuelve null si falla.
 * Útil para autocompletar sin bloquear el formulario.
 */
export const consultarSunatSeguro = async (ruc) => {
  try {
    return await consultarSunat(ruc);
  } catch {
    return null;
  }
};
