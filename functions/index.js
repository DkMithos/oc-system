/**
 * functions/index.js
 * Cloud Functions para notificaciones FCM (Node 18, ESM)
 * - Triggers: onOCCreated / onOCUpdated / onSolicitudEdicionCreated / onSolicitudEdicionUpdated
 * - Callables: enviarNotificacionRol, enviarNotificacionTest
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";

// ───────────────────────────────────────────────────────────────
// Inicializa Admin SDK
// ───────────────────────────────────────────────────────────────
initializeApp();

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
  const db = getFirestore();
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

/** Elimina un token inválido de tokensFCM y de usuarios/{email}/tokens/{id} */
async function purgeTokenEverywhere(token) {
  const db = getFirestore();

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
    tokens.map((t) => getMessaging().send(buildOCMessage({ token: t, ocId, title, body })))
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

/**
 * A quién notificar según estado real de la OC.
 * Devuelve emails directos; los tokens se resuelven con getUserTokensByEmail.
 * Para estados que requieren un rol completo usa getTokensByRole en el trigger.
 */
function resolveDestinatarios(afterOC) {
  const posibles = [];

  // Siempre notificar al comprador que creó la OC
  if (afterOC.creadoPor) posibles.push(afterOC.creadoPor);
  if (afterOC.asignadoA) posibles.push(afterOC.asignadoA);

  // Estados reales del sistema Memphis
  if (afterOC.estado === "Pendiente de Operaciones")        posibles.push("__rol:operaciones");
  if (afterOC.estado === "Pendiente de Gerencia Operaciones") posibles.push("__rol:gerencia operaciones");
  if (afterOC.estado === "Pendiente de Gerencia General")   posibles.push("__rol:gerencia general");
  if (afterOC.estado === "Aprobada")                        posibles.push("__rol:finanzas");
  if (afterOC.estado === "Rechazada" && afterOC.creadoPor)  posibles.push(afterOC.creadoPor);

  return Array.from(new Set(posibles.filter(Boolean)));
}

/** Devuelve todos los tokens de todos los usuarios con un rol X */
async function getTokensByRole(role) {
  const db = getFirestore();
  const q = await db.collection("usuarios").where("rol", "==", role).get();
  const all = await Promise.all(q.docs.map((d) => getUserTokensByEmail(d.id)));
  return Array.from(new Set(all.flat().filter(Boolean)));
}

/** Reúne tokens de varios roles */
async function getTokensByRoles(roles = []) {
  const sets = await Promise.all(roles.map((r) => getTokensByRole(r)));
  return Array.from(new Set(sets.flat().filter(Boolean)));
}

/**
 * Resuelve destinatarios: separa emails directos de refs a rol (__rol:xxx)
 * y devuelve la lista de tokens unificada.
 */
async function resolveTokens(destinatarios) {
  const emailDests = destinatarios.filter((d) => !d.startsWith("__rol:"));
  const rolDests   = destinatarios.filter((d) =>  d.startsWith("__rol:")).map((d) => d.replace("__rol:", ""));

  const [byEmail, byRol] = await Promise.all([
    Promise.all(emailDests.map(getUserTokensByEmail)).then((r) => r.flat()),
    getTokensByRoles(rolDests),
  ]);

  return Array.from(new Set([...byEmail, ...byRol].filter(Boolean)));
}

// ───────────────────────────────────────────────────────────────
// TRIGGERS – OCs
// ───────────────────────────────────────────────────────────────

export const onOCCreated = onDocumentCreated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const oc = event.data?.data();
  if (!oc) return;

  const title = "Nueva OC creada";
  const body = `Se creó la OC ${oc.numero || ocId} por ${oc.creadoPor || "—"}.`;

  const destinatarios = resolveDestinatarios(oc);
  const tokens = await resolveTokens(destinatarios);

  const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
  console.log(`[onOCCreated] OC ${ocId} -> enviados: ${sent}`, errors);
});

export const onOCUpdated = onDocumentUpdated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;
  if (before.estado === after.estado) return;

  const title = "Estado de OC actualizado";
  const body = `La OC ${after.numero || ocId} cambió a: ${after.estado}.`;

  const destinatarios = resolveDestinatarios(after);
  const tokens = await resolveTokens(destinatarios);

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

    const db = getFirestore();

    if (String(after.estado || "").toLowerCase() === "aprobada") {
      await db.doc(`ordenesCompra/${ocId}`).update({
        permiteEdicion: true,
        edicionAprobadaEn: FieldValue.serverTimestamp(),
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
    // [SEGURIDAD] Verificar autenticación
    if (!request.auth) {
      const { HttpsError } = await import("firebase-functions/v2/https");
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para enviar notificaciones.");
    }
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
    // [SEGURIDAD] Solo admin puede enviar notificaciones de prueba
    if (!request.auth) {
      const { HttpsError } = await import("firebase-functions/v2/https");
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const db = getFirestore();
    const callerEmail = String(request.auth.token.email || "").toLowerCase();
    const callerDoc = await db.doc(`usuarios/${callerEmail}`).get();
    if (callerDoc.data()?.rol !== "admin") {
      const { HttpsError } = await import("firebase-functions/v2/https");
      throw new HttpsError("permission-denied", "Solo administradores pueden enviar notificaciones de prueba.");
    }
    const { email, ocId, title = "Prueba", body = "Mensaje de prueba" } = request.data || {};
    if (!email) throw new Error("email requerido");
    const tokens = await getUserTokensByEmail(String(email).toLowerCase());
    const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
    return { sent, errors };
  }
);

// ── Re-export SUNAT proxy (ver firebase.json rewrite /api/sunat) ──
export { sunatProxy } from "./sunatProxy.js";

// ───────────────────────────────────────────────────────────────
// TICKET CREADO → notificar al agente asignado
// ───────────────────────────────────────────────────────────────
export const onTicketCreated = onDocumentCreated(
  "tickets/{ticketId}",
  async (event) => {
    const ticketId = event.params.ticketId;
    const ticket   = event.data?.data();
    if (!ticket) return;

    const agenteEmail = String(ticket.asignadoA?.email || "").toLowerCase();
    const creadorEmail = String(ticket.creadoPor?.email || "").toLowerCase();
    if (!agenteEmail) return;

    const titulo = String(ticket.asunto || "Nuevo ticket").slice(0, 80);
    const cuerpo = `De: ${creadorEmail} | Categoría: ${ticket.categoria || "—"} | Prioridad: ${ticket.prioridad || "—"}`;

    // Notificar al agente asignado
    const tokensAgente = await getUserTokensByEmail(agenteEmail);
    if (tokensAgente.length) {
      await sendToTokens({ title: `🎫 ${titulo}`, body: cuerpo, ocId: ticketId, tokens: tokensAgente });
    } else {
      const db = getFirestore();
      await db.collection("notificaciones").add({
        destinatario: agenteEmail,
        title: `🎫 ${titulo}`,
        body: cuerpo,
        ocId: ticketId,
        leida: false,
        creadaEn: FieldValue.serverTimestamp(),
      });
    }
  }
);

// ───────────────────────────────────────────────────────────────
// TICKET ACTUALIZADO (estado cambia a resuelto/cerrado) → notificar al creador
// ───────────────────────────────────────────────────────────────
export const onTicketUpdated = onDocumentUpdated(
  "tickets/{ticketId}",
  async (event) => {
    const ticketId = event.params.ticketId;
    const antes  = event.data?.before?.data();
    const despues = event.data?.after?.data();
    if (!antes || !despues) return;

    const estadoAntes  = antes.estado  || "";
    const estadoDespues = despues.estado || "";

    // Solo disparar cuando el estado cambia a resuelto o cerrado
    if (estadoAntes === estadoDespues) return;
    if (!["resuelto", "cerrado"].includes(estadoDespues)) return;

    const creadorEmail = String(despues.creadoPor?.email || "").toLowerCase();
    if (!creadorEmail) return;

    const titulo = `Tu ticket fue ${estadoDespues}`;
    const cuerpo = `"${despues.asunto}" ha sido marcado como ${estadoDespues}.`;

    const tokens = await getUserTokensByEmail(creadorEmail);
    if (tokens.length) {
      await sendToTokens({ title: titulo, body: cuerpo, ocId: ticketId, tokens });
    } else {
      const db = getFirestore();
      await db.collection("notificaciones").add({
        destinatario: creadorEmail,
        title: titulo,
        body: cuerpo,
        ocId: ticketId,
        leida: false,
        creadaEn: FieldValue.serverTimestamp(),
      });
    }
  }
);
