// functions/sunatProxy.js
// Proxy para consulta de RUC — usa Decolecta como provider principal,
// con fallback a apis.net.pe.
//
// SETUP:
//   firebase functions:secrets:set DECOLECTA_TOKEN
//   firebase functions:secrets:set APIS_NET_TOKEN   (opcional, fallback)

import fetch from "node-fetch";
import { onRequest } from "firebase-functions/v2/https";

const ALLOWED_ORIGINS = [
  "https://portal.memphismaquinarias.com",
  "http://localhost:5173",
  "http://localhost:4173",
];

const getDecolectaToken = () => process.env.DECOLECTA_TOKEN || "sk_14357.AUTv4TRQxoNOZ4n05LNS8kDeuKP9BQOm";
const getApisNetToken  = () => process.env.APIS_NET_TOKEN   || "";

/** Construye la lista de providers en orden de prioridad */
const buildCandidates = (ruc) => {
  const candidates = [];
  const dcToken = getDecolectaToken();
  const anToken = getApisNetToken();

  // 1) Decolecta (provider principal)
  if (dcToken) {
    candidates.push({
      url: `https://api.decolecta.io/api/ruc/${encodeURIComponent(ruc)}`,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${dcToken}`,
      },
      normalize: (d) => ({
        ruc:          d.ruc || d.numeroRuc || ruc,
        razonSocial:  d.razonSocial || d.nombre || d.nombreComercial || "",
        direccion:    d.direccion || d.domicilioFiscal || "",
        estado:       d.estado || d.estadoContribuyente || "",
        condicion:    d.condicion || d.condicionContribuyente || "",
        departamento: d.departamento || d.ubigeo?.departamento || "",
        ubigeo:       d.ubigeo?.codigo || d.codigoUbigeo || "",
        tipo:         d.tipoContribuyente || "",
      }),
    });
  }

  // 2) apis.net.pe v2 (fallback con token)
  if (anToken) {
    candidates.push({
      url: `https://api.apis.net.pe/v2/sunat/ruc?numero=${encodeURIComponent(ruc)}`,
      headers: {
        Accept: "application/json",
        Authorization: anToken.startsWith("Bearer ") ? anToken : `Bearer ${anToken}`,
      },
      normalize: (d) => ({
        ruc:          d.numeroDocumento || d.numero || ruc,
        razonSocial:  d.razonSocial || d.nombre || "",
        direccion:    d.direccion || d.direccionFiscal || "",
        estado:       d.estado || "",
        condicion:    d.condicion || "",
        departamento: d.departamento || "",
        ubigeo:       d.ubigeo || "",
        tipo:         "",
      }),
    });
  }

  // 3) apis.net.pe v1 (fallback público)
  candidates.push({
    url: `https://api.apis.net.pe/v1/ruc?numero=${encodeURIComponent(ruc)}`,
    headers: { Accept: "application/json" },
    normalize: (d) => ({
      ruc:          d.numero || ruc,
      razonSocial:  d.nombre || d.razonSocial || "",
      direccion:    d.direccion || "",
      estado:       d.estado || "",
      condicion:    d.condicion || "",
      departamento: d.departamento || "",
      ubigeo:       "",
      tipo:         "",
    }),
  });

  return candidates;
};

export const sunatProxy = onRequest(
  {
    cors: ALLOWED_ORIGINS,
    region: "us-central1",
    timeoutSeconds: 15,
  },
  async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).send("");

    const ruc = String(req.query.ruc || "").replace(/\D/g, "");
    if (ruc.length !== 11) {
      return res.status(400).json({ error: "RUC inválido: debe tener 11 dígitos" });
    }

    const candidates = buildCandidates(ruc);
    const errors = [];

    for (const { url, headers, normalize } of candidates) {
      try {
        const resp = await fetch(url, { headers, timeout: 10000 });

        if (!resp.ok) {
          const body = await resp.text().catch(() => "");
          errors.push(`${url}: HTTP ${resp.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
          continue;
        }

        const data = await resp.json();
        const normalized = normalize(data);

        if (!normalized.razonSocial) {
          errors.push(`${url}: respuesta sin razonSocial`);
          continue;
        }

        res.set("Cache-Control", "public, max-age=3600");
        return res.json(normalized);
      } catch (e) {
        errors.push(`${url}: ${e.message}`);
      }
    }

    console.error("[sunatProxy] Todos los providers fallaron:", errors);
    return res.status(503).json({
      error: "No se pudo consultar SUNAT. Verifica el RUC manualmente.",
      details: errors,
    });
  }
);
