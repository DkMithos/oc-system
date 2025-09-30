// functions/sunatProxy.js
import fetch from "node-fetch";
import { onRequest } from "firebase-functions/v2/https";

export const sunatProxy = onRequest({ cors: true, region: "us-central1" }, async (req, res) => {
  // CORS extra por si usas otro hosting/CDN delante
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const ruc = req.query.ruc;
    if (!ruc) return res.status(400).json({ error: "Falta ruc" });

    const url = `https://api.apis.net.pe/v1/ruc?numero=${encodeURIComponent(ruc)}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return res.status(resp.status).send(await resp.text());

    const data = await resp.json();
    res.set("Cache-Control", "public, max-age=3600");
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Proxy error" });
  }
});
