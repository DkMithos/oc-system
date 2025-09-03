// functions/index.mjs
import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";

admin.initializeApp();

// Ajusta tu dominio de producción aquí:
const WEB_BASE_URL = process.env.WEB_BASE_URL || "https://portal.memphismaquinarias.com";
const ICON_URL = `${WEB_BASE_URL}/logo-navbar.png`;

/** Obtiene tokens FCM por email desde:
 *  - tokensFCM/{email} -> { token }
 *  - usuarios/{email}/tokens/* -> { token, activo }
 */
async function getUserTokensByEmail(email) {
  const db = admin.firestore();
  const set = new Set();

  // tokensFCM/{email}
  const tDoc = await db.doc(`tokensFCM/${email}`).get();
  if (tDoc.exists && tDoc.data()?.token) set.add(tDoc.data().token);

  // usuarios/{email}/tokens/*
  const tSnap = await db.collection(`usuarios/${email}/tokens`).get();
  tSnap.forEach(d => {
    const t = d.data()?.token;
    const activo = d.data()?.activo ?? true;
    if (t && activo) set.add(t);
  });

  return Array.from(set);
}

/** Decide destinatarios según datos de la OC */
function resolveDestinatarios(oc) {
  const out = [];
  if (oc.asignadoA) out.push(oc.asignadoA);
  if (oc.comprador) out.push(oc.comprador);
  if (oc.estado === "Pendiente de Operaciones") out.push("operaciones@memphis.pe");
  if (oc.estado === "Aprobado por Operaciones") out.push("gerencia@memphis.pe");
  if (oc.estado === "Aprobado por Gerencia") out.push("finanzas@memphis.pe");
  return Array.from(new Set(out.filter(Boolean)));
}

/** Construye el mensaje web seguro (notification + data + webpush.link) */
function buildOCMessage({ token, ocId, titulo, cuerpo }) {
  return {
    token,
    notification: { title: titulo, body: cuerpo },
    data: {
      title: titulo,
      body: cuerpo,
      ocId: ocId || "",
      type: "oc_event"
    },
    webpush: {
      headers: { Urgency: "high", TTL: "3600" },
      notification: {
        icon: ICON_URL,
        vibrate: [200, 100, 200]
      },
      fcmOptions: { link: `${WEB_BASE_URL}/ver?id=${ocId}` }
    },
    android: { priority: "high", ttl: 3600 * 1000 },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default", contentAvailable: true } }
    }
  };
}

/** Envía mensajes y limpia tokens inválidos */
async function sendToTokens({ ocId, titulo, cuerpo, tokens }) {
  if (!tokens?.length) return { sent: 0, errors: [] };

  const results = await Promise.allSettled(
    tokens.map(t => admin.messaging().send(buildOCMessage({ token: t, ocId, titulo, cuerpo })))
  );

  const errors = [];
  await Promise.all(results.map(async (res, i) => {
    if (res.status === "rejected") {
      const token = tokens[i];
      errors.push({ token, error: res.reason?.message || String(res.reason) });

      const code = res.reason?.errorInfo?.code;
      if (code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token") {
        await purgeTokenEverywhere(token);
      }
    }
  }));

  return { sent: results.filter(r => r.status === "fulfilled").length, errors };
}

/** Elimina un token de tokensFCM y usuarios/*/tokens/* si lo encuentra */
async function purgeTokenEverywhere(token) {
  const db = admin.firestore();

  // tokensFCM/*
  const top = await db.collection("tokensFCM").get();
  await Promise.all(top.docs.map(async d => {
    if (d.data()?.token === token) await d.ref.delete();
  }));

  // usuarios/*/tokens/*
  const users = await db.collection("usuarios").get();
  await Promise.all(users.docs.map(async u => {
    const snap = await u.ref.collection("tokens").get();
    await Promise.all(snap.docs.map(async td => {
      if (td.data()?.token === token) await td.ref.delete();
    }));
  }));
}

/** TRIGGER: al crear OC */
export const onOCCreated = onDocumentCreated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const oc = event.data?.data();
  if (!oc) return;

  const titulo = "OC creada";
  const cuerpo = `Se creó la OC ${oc.numeroOC || ocId} por ${oc.creadoPor || "—"}.`;

  const destinatarios = resolveDestinatarios(oc);
  const tokens = (await Promise.all(destinatarios.map(getUserTokensByEmail))).flat();

  const { sent, errors } = await sendToTokens({ ocId, titulo, cuerpo, tokens });
  console.log(`[onOCCreated] ${ocId} enviados=${sent}`, errors);
});

/** TRIGGER: al cambiar estado */
export const onOCUpdated = onDocumentUpdated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.estado === after.estado) return;

  const titulo = "Estado de OC actualizado";
  const cuerpo = `La OC ${after.numeroOC || ocId} cambió a: ${after.estado}.`;

  const destinatarios = resolveDestinatarios(after);
  const tokens = (await Promise.all(destinatarios.map(getUserTokensByEmail))).flat();

  const { sent, errors } = await sendToTokens({ ocId, titulo, cuerpo, tokens });
  console.log(`[onOCUpdated] ${ocId} enviados=${sent}`, errors);
});

/** CALLABLE: pruebas manuales */
export const enviarNotificacionTest = onCall(async (req) => {
  const { email, ocId, titulo = "Prueba", cuerpo = "Mensaje de prueba" } = req.data || {};
  if (!email) throw new Error("email requerido");
  const tokens = await getUserTokensByEmail(email);
  const { sent, errors } = await sendToTokens({ ocId, titulo, cuerpo, tokens });
  return { sent, errors };
});
