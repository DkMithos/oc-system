// functions/sunatProxy.js (Node 18, v2)
import fetch from "node-fetch";
import { onRequest } from "firebase-functions/v2/https";

export const sunatProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    const ruc = req.query.ruc;
    if (!ruc) return res.status(400).json({ error: "Falta ruc" });

    const url = `https://api.apis.net.pe/v1/ruc?numero=${encodeURIComponent(ruc)}`;
    const resp = await fetch(url, { headers: { /* si tu API necesita token, agrégalo aquí */ }});
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
