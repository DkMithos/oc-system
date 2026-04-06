// src/utils/consultaSunat.js
// Consulta datos de RUC a través del proxy Cloud Function (/api/sunat).
// El proxy (sunatProxy.js) maneja la autenticación con apis.net.pe y el CORS.

const tryJson = async (url, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
    }
    return r.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") throw new Error("Tiempo de espera agotado (10s)");
    throw e;
  }
};

export const consultarSunat = async (ruc) => {
  const trimmed = String(ruc || "").replace(/\D/g, "");
  if (trimmed.length !== 11) throw new Error("RUC inválido: debe tener 11 dígitos.");

  // 1) Proxy same-origin via Firebase Hosting rewrite → Cloud Function sunatProxy
  const url1 = `/api/sunat?ruc=${encodeURIComponent(trimmed)}`;

  // 2) URL directa a la Function (si VITE_FUNCTIONS_URL está definida)
  const base = (import.meta.env?.VITE_FUNCTIONS_URL || "").replace(/\/$/, "");
  const url2 = base ? `${base}/sunatProxy?ruc=${encodeURIComponent(trimmed)}` : null;

  const candidates = [url1, url2].filter(Boolean);
  const errors = [];

  for (const url of candidates) {
    try {
      const data = await tryJson(url);
      if (!data.razonSocial && !data.nombre) {
        errors.push(`${url}: respuesta vacía`);
        continue;
      }
      return {
        ruc:         data.ruc         || data.numeroDocumento || data.numero || trimmed,
        razonSocial: data.razonSocial || data.nombre || "",
        direccion:   data.direccion   || data.direccionFiscal || "",
        estado:      data.estado      || "",
        condicion:   data.condicion   || "",
        departamento: data.departamento || "",
      };
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }

  throw new Error(
    `No se pudo consultar SUNAT para el RUC ${trimmed}. ` +
    (errors.length ? `Detalle: ${errors.join(" | ")}` : "Verifica tu conexión.")
  );
};
