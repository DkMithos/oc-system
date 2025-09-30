// ✅ functions/sunatProxy.js (Node 18, v2)
import { onRequest } from "firebase-functions/v2/https";

export const sunatProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    const ruc = String(req.query.ruc || "").replace(/\D/g, "");
    if (!ruc) return res.status(400).json({ error: "Falta ruc" });

    const url = `https://api.apis.net.pe/v1/ruc?numero=${encodeURIComponent(ruc)}`;

    const headers = { Accept: "application/json" };
    // Si usas token privado, colócalo como variable de entorno:
    // functions:config:set apis.token="TU_TOKEN"
    const token = process.env.APIS_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(url, { headers, method: "GET" });
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).send(text);
    }
    const data = await resp.json();
    res.set("Cache-Control", "public, max-age=3600");
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Proxy error" });
  }
});
