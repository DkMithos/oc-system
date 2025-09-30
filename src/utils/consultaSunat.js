// ✅ src/utils/consultaSunat.js
// Intenta 3 rutas en este orden:
// 1) VITE_FUNCTIONS_URL (e.g. https://us-central1-tu-proyecto.cloudfunctions.net)
// 2) Ruta relativa si tienes rewrites en Hosting: /api/sunat?ruc=...
// 3) Fallback directo al endpoint público (puede fallar por CORS o requerir token)
const tryJson = async (url, init = {}) => {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export const consultarSunat = async (ruc) => {
  const trimmed = String(ruc || "").replace(/\D/g, "");
  if (trimmed.length !== 11) throw new Error("RUC inválido");

  const base = (import.meta.env?.VITE_FUNCTIONS_URL || "").replace(/\/$/, "");
  const candidates = [];

  if (base) candidates.push(`${base}/sunatProxy?ruc=${encodeURIComponent(trimmed)}`);
  candidates.push(`/api/sunat?ruc=${encodeURIComponent(trimmed)}`); // requiere rewrite opcional
  candidates.push(`https://api.apis.net.pe/v1/ruc?numero=${encodeURIComponent(trimmed)}`);

  let lastErr;
  for (const url of candidates) {
    try {
      const data = await tryJson(url);
      // normaliza campos
      const razon = data.razonSocial || data.nombre || "";
      const direccion = data.direccion || data.direccionFiscal || "";
      const numero = data.numeroDocumento || data.numero || trimmed;
      return { ruc: numero, razonSocial: razon, direccion };
    } catch (e) {
      lastErr = e;
      // prueba el siguiente
    }
  }
  throw lastErr || new Error("No se pudo consultar SUNAT");
};
