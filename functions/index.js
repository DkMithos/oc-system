/**
 * Cloud Functions para notificaciones FCM (Node 18, ESM)
 * - Triggers: onOCCreated / onOCUpdated / onSolicitudEdicionCreated / onSolicitudEdicionUpdated
 * - Callables: enviarNotificacionRol, enviarNotificacionTest
 */

import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";

// ───────────────────────────────────────────────────────────────
// Inicializa Admin SDK
// ───────────────────────────────────────────────────────────────
admin.initializeApp();

// ───────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────
const WEB_BASE_URL = process.env.WEB_BASE_URL || "https://portal.memphismaquinarias.com";
const ICON_URL = `${WEB_BASE_URL}/logo-navbar.png`;
const ALLOWED_ORIGINS = ["http://localhost:5173", WEB_BASE_URL]; // CORS local y prod

// ───────────────────────────────────────────────────────────────
// Helpers de tokens
// ───────────────────────────────────────────────────────────────

/**
 * Obtiene tokens FCM para un email desde:
 *  - tokensFCM/{email} => { token }  o  { tokens: string[] }
 *  - usuarios/{email}/tokens/* => { token, activo? }
 */
async function getUserTokensByEmail(email) {
  const db = admin.firestore();
  const tokens = new Set();

  // tokensFCM/{email}
  const doc = await db.doc(`tokensFCM/${email}`).get();
  if (doc.exists) {
    const data = doc.data() || {};
    if (typeof data.token === "string" && data.token) tokens.add(data.token);
    if (Array.isArray(data.tokens)) data.tokens.forEach((t) => t && tokens.add(t));
  }

  // usuarios/{email}/tokens/*
  const col = await db.collection(`usuarios/${email}/tokens`).get();
  col.forEach((d) => {
    const t = d.data()?.token;
    const activo = d.data()?.activo ?? true;
    if (t && activo) tokens.add(t);
  });

  return Array.from(tokens);
}

/** Elimina un token inválido de tokensFCM y usuarios/*/tokens/* */
async function purgeTokenEverywhere(token) {
  const db = admin.firestore();

  // tokensFCM/*
  const snap = await db.collection("tokensFCM").get();
  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() || {};
      if (data.token === token) await d.ref.delete();
      if (Array.isArray(data.tokens) && data.tokens.includes(token)) {
        const left = data.tokens.filter((t) => t !== token);
        await d.ref.update({ tokens: left });
      }
    })
  );

  // usuarios/*/tokens/*
  const usersSnap = await db.collection("usuarios").get();
  await Promise.all(
    usersSnap.docs.map(async (userDoc) => {
      const tokensSnap = await userDoc.ref.collection("tokens").get();
      await Promise.all(
        tokensSnap.docs.map(async (tDoc) => {
          if (tDoc.data()?.token === token) await tDoc.ref.delete();
        })
      );
    })
  );
}

/** Construye un mensaje FCM listo para webpush + apps nativas */
function buildOCMessage({ token, ocId, title, body }) {
  return {
    token,
    notification: { title, body },
    data: {
      title,
      body,
      ocId: ocId || "",
      type: "oc",
    },
    webpush: {
      headers: { Urgency: "high", TTL: "3600" },
      notification: {
        icon: ICON_URL,
        vibrate: [200, 100, 200],
      },
      fcmOptions: {
        link: `${WEB_BASE_URL}/ver?id=${ocId}`,
      },
    },
    android: { priority: "high", ttl: 3600 * 1000 },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default", contentAvailable: true } },
    },
  };
}

/** Envía a múltiples tokens y limpia tokens inválidos */
async function sendToTokens({ ocId, title, body, tokens }) {
  if (!tokens || tokens.length === 0) return { sent: 0, errors: [] };

  const results = await Promise.allSettled(
    tokens.map((t) => admin.messaging().send(buildOCMessage({ token: t, ocId, title, body })))
  );

  const errors = [];
  await Promise.all(
    results.map(async (res, i) => {
      if (res.status === "rejected") {
        const reason = res.reason;
        const code = reason?.errorInfo?.code;
        errors.push({ token: tokens[i], error: reason?.message || String(reason) });
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          await purgeTokenEverywhere(tokens[i]);
        }
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, errors };
}

// ───────────────────────────────────────────────────────────────
// Helpers de negocio
// ───────────────────────────────────────────────────────────────

/** A quién notificar según estado/propiedades de la OC (ajústalo a tu flujo) */
function resolveDestinatarios(afterOC) {
  const posibles = [];
  if (afterOC.asignadoA) posibles.push(afterOC.asignadoA);
  if (afterOC.comprador) posibles.push(afterOC.comprador);

  if (afterOC.estado === "Pendiente de Operaciones") posibles.push("operaciones@memphis.pe");
  if (afterOC.estado === "Aprobado por Operaciones" || afterOC.estado === "Pendiente de Gerencia") posibles.push("gerencia@memphis.pe");
  if (afterOC.estado === "Aprobado por Gerencia" || afterOC.estado === "Pendiente de Finanzas") posibles.push("finanzas@memphis.pe");

  return Array.from(new Set(posibles.filter(Boolean)));
}

/** Devuelve todos los tokens de todos los usuarios con un rol X */
async function getTokensByRole(role) {
  const db = admin.firestore();
  const q = await db.collection("usuarios").where("rol", "==", role).get();
  const all = await Promise.all(q.docs.map((d) => getUserTokensByEmail(d.id)));
  return Array.from(new Set(all.flat().filter(Boolean)));
}

/** Reúne tokens de varios roles */
async function getTokensByRoles(roles = []) {
  const sets = await Promise.all(roles.map((r) => getTokensByRole(r)));
  return Array.from(new Set(sets.flat().filter(Boolean)));
}

// ───────────────────────────────────────────────────────────────
// TRIGGERS – OCs
// ───────────────────────────────────────────────────────────────

export const onOCCreated = onDocumentCreated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const oc = event.data?.data();
  if (!oc) return;

  const title = "OC creada";
  const body = `Se creó la OC ${oc.numeroOC || ocId} por ${oc.creadoPor || "—"}.`;

  const destinatarios = resolveDestinatarios(oc);
  const tokens = (await Promise.all(destinatarios.map((email) => getUserTokensByEmail(email)))).flat();

  const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
  console.log(`[onOCCreated] OC ${ocId} -> enviados: ${sent}`, errors);
});

export const onOCUpdated = onDocumentUpdated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.estado === after.estado) return; // solo si cambia estado

  const title = "Estado de OC actualizado";
  const body = `La OC ${after.numeroOC || ocId} cambió a: ${after.estado}.`;

  const destinatarios = resolveDestinatarios(after);
  const tokens = (await Promise.all(destinatarios.map((email) => getUserTokensByEmail(email)))).flat();

  const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
  console.log(`[onOCUpdated] OC ${ocId} -> enviados: ${sent}`, errors);
});

// ───────────────────────────────────────────────────────────────
// TRIGGERS – Solicitudes de Edición
// ───────────────────────────────────────────────────────────────

/** Nueva solicitud → notifica a operaciones/gerencias/finanzas */
export const onSolicitudEdicionCreated = onDocumentCreated(
  "ordenesCompra/{ocId}/solicitudesEdicion/{solId}",
  async (event) => {
    const ocId = event.params.ocId;
    const s = event.data?.data();
    if (!s) return;

    const title = "Solicitud de edición de OC";
    const body = `Se solicitó editar la OC ${s.numeroOC || ocId} por ${s.creadoPorNombre || s.creadoPorEmail || "—"}.`;

    const rolesAprobadores = ["operaciones", "gerencia", "gerencia operaciones", "gerencia general", "gerencia finanzas", "finanzas", "admin", "soporte"];
    const tokens = await getTokensByRoles(rolesAprobadores);

    const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
    console.log(`[onSolicitudEdicionCreated] OC ${ocId} -> enviados: ${sent}`, errors);
  }
);

/** Cambio de estado → marcar permiteEdicion y notificar al solicitante */
export const onSolicitudEdicionUpdated = onDocumentUpdated(
  "ordenesCompra/{ocId}/solicitudesEdicion/{solId}",
  async (event) => {
    const ocId = event.params.ocId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.estado === after.estado) return;

    const db = admin.firestore();

    if (String(after.estado || "").toLowerCase() === "aprobada") {
      await db.doc(`ordenesCompra/${ocId}`).update({
        permiteEdicion: true,
        edicionAprobadaEn: admin.firestore.FieldValue.serverTimestamp(),
        edicionAprobadaPor: after.resueltoPorNombre || after.resueltoPorEmail || "",
        edicionMotivo: after.motivo || after.motivoEdicion || "",
      });
    }

    const title =
      String(after.estado || "").toLowerCase() === "aprobada"
        ? "Solicitud de edición APROBADA"
        : "Solicitud de edición RECHAZADA";
    const body = `OC ${after.numeroOC || ocId} – Estado: ${after.estado}.`;

    const destinatario = after.creadoPorEmail || after.creadoPor || "";
    if (destinatario) {
      const tokens = await getUserTokensByEmail(destinatario);
      const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
      console.log(`[onSolicitudEdicionUpdated] OC ${ocId} -> enviados: ${sent}`, errors);
    }
  }
);

// ───────────────────────────────────────────────────────────────
// CALLABLES (v2) con región + CORS
// ───────────────────────────────────────────────────────────────

export const enviarNotificacionRol = onCall(
  { region: "us-central1", cors: ALLOWED_ORIGINS },
  async (request) => {
    const { toRole, payload } = request.data || {};
    if (!toRole || !payload?.title) {
      throw new Error("Parámetros inválidos: { toRole, payload: { title, body?, ocId? } }");
    }
    const tokens = await getTokensByRole(String(toRole));
    const { sent, errors } = await sendToTokens({
      ocId: payload.ocId || "",
      title: payload.title,
      body: payload.body || "",
      tokens,
    });
    return { sent, errors };
  }
);

export const enviarNotificacionTest = onCall(
  { region: "us-central1", cors: ALLOWED_ORIGINS },
  async (request) => {
    const { email, ocId, title = "Prueba", body = "Mensaje de prueba" } = request.data || {};
    if (!email) throw new Error("email requerido");
    const tokens = await getUserTokensByEmail(String(email).toLowerCase());
    const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
    return { sent, errors };
  }
);
