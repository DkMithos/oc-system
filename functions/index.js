/**
 * Cloud Functions para notificaciones FCM (Node 18)
 * Asegura payload con notification + data + webpush.fcmOptions.link
 */

import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

// Inicializa Admin SDK
admin.initializeApp();

// ====== Config / Secrets ======
// URL base de tu panel web (sin slash final), ajusta a producción
const WEB_BASE_URL = process.env.WEB_BASE_URL || "https://portal.memphismaquinarias.com";
// Icono a mostrar en notificación
const ICON_URL = `${WEB_BASE_URL}/logo-navbar.png`;

// (Opcional) Si manejas más de un proyecto o quieres controlar clics a staging:
// export const WEB_BASE_URL_SECRET = defineSecret("WEB_BASE_URL");

// ====== Utilidades ======

/** Devuelve tokens FCM para un email desde:
 *  - tokensFCM/{email} => { token }
 *  - usuarios/{email}/tokens/* => { token, activo }
 */
async function getUserTokensByEmail(email) {
  const tokens = new Set();

  // tokensFCM/{email}
  const doc = await admin.firestore().doc(`tokensFCM/${email}`).get();
  if (doc.exists && doc.data()?.token) {
    tokens.add(doc.data().token);
  }

  // usuarios/{email}/tokens/*
  const col = await admin.firestore().collection(`usuarios/${email}/tokens`).get();
  col.forEach((d) => {
    const t = d.data()?.token;
    const activo = d.data()?.activo ?? true;
    if (t && activo) tokens.add(t);
  });

  return Array.from(tokens);
}

/** Permite decidir a quién notificar según la OC */
function resolveDestinatarios(ocData) {
  // Ajusta esta lógica a tu flujo:
  // prioridad: asignadoA -> comprador -> ocData.proveedor?.email (no se usará para FCM salvo que guardes tokens del proveedor)
  const posibles = [];
  if (ocData.asignadoA) posibles.push(ocData.asignadoA);
  if (ocData.comprador) posibles.push(ocData.comprador);
  // Ejemplo: notificar a operaciones o finanzas por estado
  if (ocData.estado === "Pendiente de Operaciones") posibles.push("operaciones@memphis.pe");
  if (ocData.estado === "Aprobado por Operaciones") posibles.push("gerencia@memphis.pe");
  if (ocData.estado === "Aprobado por Gerencia") posibles.push("finanzas@memphis.pe");

  // Quita vacíos y duplica correos
  return Array.from(new Set(posibles.filter(Boolean)));
}

/** Construye el mensaje FCM (notification + data) */
function buildOCMessage({ token, ocId, titulo, cuerpo }) {
  return {
    token,
    notification: {
      title: titulo,
      body: cuerpo,
    },
    data: {
      title: titulo,
      body: cuerpo,
      ocId: ocId || "",
      // Puedes agregar más campos para tu UI:
      // tipo: "oc_estado" | "oc_creada"
    },
    webpush: {
      headers: {
        // prioridad y expiración razonable
        Urgency: "high",
        TTL: "3600",
      },
      notification: {
        icon: ICON_URL,
        // vibración (opcional)
        vibrate: [200, 100, 200],
        // badge (opcional): pequeño icono monocromo
        // badge: `${WEB_BASE_URL}/badge.png`,
      },
      fcmOptions: {
        // En web, al hacer clic en la notificación, abre la OC
        link: `${WEB_BASE_URL}/ver?id=${ocId}`,
      },
    },
    android: {
      priority: "high",
      ttl: 3600 * 1000, // 1h
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: {
        aps: {
          sound: "default",
          contentAvailable: true,
        },
      },
    },
  };
}

/** Envía a múltiples tokens con manejo de errores y limpieza de tokens inválidos */
async function sendToTokens({ ocId, titulo, cuerpo, tokens }) {
  if (!tokens || tokens.length === 0) return { sent: 0, errors: [] };

  const results = await Promise.allSettled(
    tokens.map((t) => admin.messaging().send(buildOCMessage({ token: t, ocId, titulo, cuerpo })))
  );

  // Limpieza de tokens inválidos
  const errors = [];
  await Promise.all(
    results.map(async (res, i) => {
      if (res.status === "rejected") {
        errors.push({ token: tokens[i], error: res.reason?.message || String(res.reason) });
        // Opcional: eliminar token inválido de tus colecciones
        const code = res.reason?.errorInfo?.code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          await purgeTokenEverywhere(tokens[i]);
        }
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, errors };
}

/** Elimina un token de tokensFCM/* y usuarios/*/tokens/* si lo encuentras */
async function purgeTokenEverywhere(token) {
  const db = admin.firestore();

  // tokensFCM/*: revisar todos (si son pocos). Si tienes muchos, mantén un índice inverso en otra colección.
  const snap = await db.collection("tokensFCM").get();
  await Promise.all(
    snap.docs.map(async (d) => {
      if (d.data()?.token === token) {
        await d.ref.delete();
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

// ====== Triggers ======

/** Notificación al CREAR una OC */
export const onOCCreated = onDocumentCreated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const oc = event.data?.data();
  if (!oc) return;

  const titulo = "OC creada";
  const cuerpo = `Se creó la OC ${oc.numeroOC || ocId} por ${oc.creadoPor || "—"}.`;

  const destinatarios = resolveDestinatarios(oc);
  const tokens = (
    await Promise.all(destinatarios.map((email) => getUserTokensByEmail(email)))
  ).flat();

  const { sent, errors } = await sendToTokens({ ocId, titulo, cuerpo, tokens });
  console.log(`[onOCCreated] OC ${ocId} -> enviados: ${sent}`, errors);
});

/** Notificación al CAMBIAR estado de la OC */
export const onOCUpdated = onDocumentUpdated("ordenesCompra/{ocId}", async (event) => {
  const ocId = event.params.ocId;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;

  if (before.estado === after.estado) return; // sólo cuando cambia el estado

  const titulo = "Estado de OC actualizado";
  const cuerpo = `La OC ${after.numeroOC || ocId} cambió a: ${after.estado}.`;

  const destinatarios = resolveDestinatarios(after);
  const tokens = (
    await Promise.all(destinatarios.map((email) => getUserTokensByEmail(email)))
  ).flat();

  const { sent, errors } = await sendToTokens({ ocId, titulo, cuerpo, tokens });
  console.log(`[onOCUpdated] OC ${ocId} -> enviados: ${sent}`, errors);
});

// ====== Callable para pruebas ======

/**
 * Llama desde frontend:
 *   const send = httpsCallable(functions, 'enviarNotificacionTest');
 *   await send({ email: 'usuario@memphis.pe', ocId: 'ABC123', titulo: 'Prueba', cuerpo: 'Hola mundo' });
 */
export const enviarNotificacionTest = onCall(async (request) => {
  const { email, ocId, titulo = "Prueba", cuerpo = "Mensaje de prueba" } = request.data || {};
  if (!email) throw new Error("email requerido");

  const tokens = await getUserTokensByEmail(email);
  const { sent, errors } = await sendToTokens({ ocId, titulo, cuerpo, tokens });
  return { sent, errors };
});
