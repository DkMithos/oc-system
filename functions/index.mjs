/**
 * functions/index.mjs
 * Cloud Functions para notificaciones FCM (Node 20, ESM — firebase-admin v13)
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

initializeApp();

const WEB_BASE_URL = process.env.WEB_BASE_URL || "https://portal.memphismaquinarias.com";
const ICON_URL = `${WEB_BASE_URL}/logo-navbar.png`;
const ALLOWED_ORIGINS = ["http://localhost:5173", WEB_BASE_URL];

// ───────────────────────────────────────────────────────────────
// Helpers de tokens
// ───────────────────────────────────────────────────────────────

async function getUserTokensByEmail(email) {
  const db = getFirestore();
  const tokens = new Set();
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const fcmDoc = await db.doc(`tokensFCM/${email}`).get();
  if (fcmDoc.exists) {
    const data = fcmDoc.data() || {};
    if (typeof data.token === "string" && data.token) tokens.add(data.token);
    if (Array.isArray(data.tokens)) data.tokens.forEach((t) => t && tokens.add(t));
  }

  const col = await db.collection(`usuarios/${email}/tokens`).get();
  col.forEach((d) => {
    const t = d.data()?.token;
    const activo = d.data()?.activo ?? true;
    const creadoEn = d.data()?.creadoEn?.toMillis?.() || 0;
    const expired = creadoEn > 0 && (now - creadoEn) > SIXTY_DAYS_MS;
    if (t && activo && !expired) tokens.add(t);
  });

  return Array.from(tokens);
}

async function purgeTokenEverywhere(token) {
  const db = getFirestore();

  const snap = await db.collection("tokensFCM").get();
  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() || {};
      if (data.token === token) await d.ref.update({ token: FieldValue.delete() });
      if (Array.isArray(data.tokens) && data.tokens.includes(token)) {
        await d.ref.update({ tokens: data.tokens.filter((t) => t !== token) });
      }
    })
  );

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

function buildOCMessage({ token, ocId, title, body }) {
  return {
    token,
    notification: { title, body },
    data: { title, body, ocId: ocId || "", type: "oc" },
    webpush: {
      headers: { Urgency: "high", TTL: "3600" },
      notification: { icon: ICON_URL, vibrate: [200, 100, 200] },
      fcmOptions: { link: `${WEB_BASE_URL}/ver?id=${ocId}` },
    },
    android: { priority: "high", ttl: 3600 * 1000 },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default", contentAvailable: true } },
    },
  };
}

async function sendToTokens({ ocId, title, body, tokens }) {
  if (!tokens || tokens.length === 0) return { sent: 0, errors: [] };

  const results = await Promise.allSettled(
    tokens.map((t) => getMessaging().send(buildOCMessage({ token: t, ocId, title, body })))
  );

  const errors = [];
  await Promise.all(
    results.map(async (res, i) => {
      if (res.status === "rejected") {
        const code = res.reason?.errorInfo?.code;
        errors.push({ token: tokens[i], error: res.reason?.message || String(res.reason) });
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          await purgeTokenEverywhere(tokens[i]);
        }
      }
    })
  );

  return { sent: results.filter((r) => r.status === "fulfilled").length, errors };
}

// ───────────────────────────────────────────────────────────────
// Helpers de negocio
// ───────────────────────────────────────────────────────────────

function resolveDestinatarios(afterOC, includeCreadoPor = true) {
  const posibles = [];
  if (includeCreadoPor && afterOC.creadoPor) posibles.push(afterOC.creadoPor);
  if (afterOC.asignadoA) posibles.push(afterOC.asignadoA);

  if (afterOC.estado === "Pendiente de Operaciones")       posibles.push("__rol:operaciones");
  if (afterOC.estado === "Pendiente de Gerencia General")  posibles.push("__rol:gerencia general");
  if (afterOC.estado === "Aprobada")                       posibles.push("__rol:finanzas");
  if (afterOC.estado === "Rechazada" && afterOC.creadoPor) posibles.push(afterOC.creadoPor);

  return Array.from(new Set(posibles.filter(Boolean)));
}

async function getTokensByRole(role) {
  const db = getFirestore();
  const q = await db.collection("usuarios").where("rol", "==", role).get();
  const all = await Promise.all(q.docs.map((d) => getUserTokensByEmail(d.id)));
  return Array.from(new Set(all.flat().filter(Boolean)));
}

async function getTokensByRoles(roles = []) {
  const sets = await Promise.all(roles.map((r) => getTokensByRole(r)));
  return Array.from(new Set(sets.flat().filter(Boolean)));
}

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
  if (!oc || oc.estado === "Pendiente de Comprador") return;

  const title = "Nueva OC creada";
  const body = `Se creó la OC ${oc.numero || ocId} por ${oc.creadoPor || "—"}.`;
  const destinatarios = resolveDestinatarios(oc, false);
  const tokens = await resolveTokens(destinatarios);
  const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
  console.log(`[onOCCreated] OC ${ocId} -> enviados: ${sent}`, errors);
});

export const onOCUpdated = onDocumentUpdated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after || before.estado === after.estado) return;

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

export const onSolicitudEdicionCreated = onDocumentCreated(
  "ordenesCompra/{ocId}/solicitudesEdicion/{solId}",
  async (event) => {
    const ocId = event.params.ocId;
    const s = event.data?.data();
    if (!s) return;
    const title = "Solicitud de edición de OC";
    const body = `Se solicitó editar la OC ${s.numeroOC || ocId} por ${s.creadoPorNombre || s.creadoPorEmail || "—"}.`;
    const tokens = await getTokensByRoles(["operaciones", "gerencia", "gerencia operaciones", "gerencia general", "gerencia finanzas", "finanzas", "admin"]);
    const { sent, errors } = await sendToTokens({ ocId, title, body, tokens });
    console.log(`[onSolicitudEdicionCreated] OC ${ocId} -> enviados: ${sent}`, errors);
  }
);

export const onSolicitudEdicionUpdated = onDocumentUpdated(
  "ordenesCompra/{ocId}/solicitudesEdicion/{solId}",
  async (event) => {
    const ocId = event.params.ocId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after || before.estado === after.estado) return;

    const db = getFirestore();
    if (String(after.estado || "").toLowerCase() === "aprobada") {
      await db.doc(`ordenesCompra/${ocId}`).update({
        permiteEdicion: true,
        edicionAprobadaEn: FieldValue.serverTimestamp(),
        edicionAprobadaPor: after.resueltoPorNombre || after.resueltoPorEmail || "",
        edicionMotivo: after.motivo || after.motivoEdicion || "",
      });
    }

    const title = String(after.estado || "").toLowerCase() === "aprobada"
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
// TRIGGERS – Tickets
// ───────────────────────────────────────────────────────────────

export const onTicketCreated = onDocumentCreated("tickets/{ticketId}", async (event) => {
  const ticketId = event.params.ticketId;
  const ticket = event.data?.data();
  if (!ticket) return;
  const agenteEmail = String(ticket.asignadoA?.email || "").toLowerCase();
  const creadorEmail = String(ticket.creadoPor?.email || "").toLowerCase();
  if (!agenteEmail) return;
  const titulo = String(ticket.asunto || "Nuevo ticket").slice(0, 80);
  const cuerpo = `De: ${creadorEmail} | Categoría: ${ticket.categoria || "—"} | Prioridad: ${ticket.prioridad || "—"}`;
  const tokens = await getUserTokensByEmail(agenteEmail);
  if (tokens.length) await sendToTokens({ title: `Ticket: ${titulo}`, body: cuerpo, ocId: ticketId, tokens });
});

export const onTicketUpdated = onDocumentUpdated("tickets/{ticketId}", async (event) => {
  const ticketId = event.params.ticketId;
  const antes = event.data?.before?.data();
  const despues = event.data?.after?.data();
  if (!antes || !despues || antes.estado === despues.estado) return;
  if (!["resuelto", "cerrado"].includes(despues.estado)) return;
  const creadorEmail = String(despues.creadoPor?.email || "").toLowerCase();
  if (!creadorEmail) return;
  const tokens = await getUserTokensByEmail(creadorEmail);
  if (tokens.length) {
    await sendToTokens({
      title: `Tu ticket fue ${despues.estado}`,
      body: `"${despues.asunto}" ha sido marcado como ${despues.estado}.`,
      ocId: ticketId,
      tokens,
    });
  }
});

// ───────────────────────────────────────────────────────────────
// CALLABLES
// ───────────────────────────────────────────────────────────────

export const enviarNotificacionRol = onCall(
  { region: "us-central1", cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const { toRole, payload } = request.data || {};
    if (!toRole || !payload?.title) throw new HttpsError("invalid-argument", "Parámetros inválidos.");
    const tokens = await getTokensByRole(String(toRole));
    return sendToTokens({ ocId: payload.ocId || "", title: payload.title, body: payload.body || "", tokens });
  }
);

export const enviarNotificacionTest = onCall(
  { region: "us-central1", cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const db = getFirestore();
    const callerEmail = String(request.auth.token.email || "").toLowerCase();
    const callerDoc = await db.doc(`usuarios/${callerEmail}`).get();
    if (callerDoc.data()?.rol !== "admin") throw new HttpsError("permission-denied", "Solo administradores.");
    const { email, ocId, title = "Prueba", body = "Mensaje de prueba" } = request.data || {};
    if (!email) throw new HttpsError("invalid-argument", "email requerido");
    const tokens = await getUserTokensByEmail(String(email).toLowerCase());
    return sendToTokens({ ocId, title, body, tokens });
  }
);

// [C-06] Elimina usuario de Firebase Auth + Firestore. Solo admin.
export const borrarUsuarioAdmin = onCall(
  { region: "us-central1", cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const db = getFirestore();
    const callerEmail = String(request.auth.token.email || "").toLowerCase();
    const callerDoc = await db.doc(`usuarios/${callerEmail}`).get();
    if (callerDoc.data()?.rol !== "admin") {
      throw new HttpsError("permission-denied", "Solo administradores pueden eliminar usuarios.");
    }
    const { email } = request.data || {};
    if (!email) throw new HttpsError("invalid-argument", "email requerido");
    if (email === callerEmail) throw new HttpsError("invalid-argument", "No puedes eliminar tu propia cuenta.");

    const targetEmail = String(email).toLowerCase();

    try {
      const userRecord = await getAuth().getUserByEmail(targetEmail);
      await getAuth().deleteUser(userRecord.uid);
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found") throw authErr;
    }

    await db.doc(`usuarios/${targetEmail}`).delete();
    await db.doc(`tokensFCM/${targetEmail}`).delete().catch(() => {});
    const tokensSnap = await db.collection(`usuarios/${targetEmail}/tokens`).get().catch(() => null);
    if (tokensSnap) await Promise.all(tokensSnap.docs.map((d) => d.ref.delete()));

    console.log(`[borrarUsuarioAdmin] ${targetEmail} eliminado por ${callerEmail}`);
    return { ok: true };
  }
);

// ── Re-export SUNAT proxy ──
export { sunatProxy } from "./sunatProxy.js";
