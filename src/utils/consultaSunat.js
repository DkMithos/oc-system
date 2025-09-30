// src/utils/consultaSunat.js
const tryJson = async (url, init = {}) => {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export const consultarSunat = async (ruc) => {
  const trimmed = String(ruc || "").replace(/\D/g, "");
  if (trimmed.length !== 11) throw new Error("RUC inválido");

  // 1) Same-origin (Hosting rewrite)
  const url1 = `/api/sunat?ruc=${encodeURIComponent(trimmed)}`;

  // 2) (Opcional) Llamada directa a la Function si estás en otro hosting
  const base = (import.meta.env?.VITE_FUNCTIONS_URL || "").replace(/\/$/, "");
  const url2 = base ? `${base}/sunatProxy?ruc=${encodeURIComponent(trimmed)}` : null;

  // No más fallback al endpoint público para evitar CORS
  const candidates = [url1, url2].filter(Boolean);

  let lastErr;
  for (const url of candidates) {
    try {
      const data = await tryJson(url);
      return {
        ruc: data.numeroDocumento || data.numero || trimmed,
        razonSocial: data.razonSocial || data.nombre || "",
        direccion: data.direccion || data.direccionFiscal || "",
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No se pudo consultar SUNAT");
};
