// src/firebase/notifs.js
import { db } from "./config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const API = import.meta.env.VITE_NOTIFS_ENDPOINT;

// Guarda notificación en Firestore como fallback (o como fuente de verdad si no hay endpoint)
const guardarNotificacionFirestore = async ({ toEmail, toRole, title, body, ocId, tipo = "general" }) => {
  try {
    await addDoc(collection(db, "notificaciones"), {
      toEmail: toEmail || null,
      toRole: toRole || null,
      title,
      body,
      ocId: ocId || null,
      tipo,
      leida: false,
      creadaEn: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[Notifs] No se pudo guardar en Firestore:", e?.message);
  }
};

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${txt || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

/**
 * Notifica a un usuario por email.
 * Si no hay endpoint configurado, guarda en Firestore.
 */
export const notificarUsuario = async ({ email, title, body, ocId, tipo }) => {
  // Siempre guarda en Firestore (para in-app notifications)
  await guardarNotificacionFirestore({ toEmail: email, title, body, ocId, tipo });

  if (!API) {
    console.info("[Notifs] VITE_NOTIFS_ENDPOINT no configurado. Guardado solo en Firestore.");
    return;
  }
  try {
    await postJSON(API, { toEmail: email, title, body, ocId });
  } catch (e) {
    console.warn("[Notifs] Push notification falló (guardado en Firestore):", e?.message);
  }
};

/**
 * Notifica a TODOS los usuarios de un rol.
 * Si no hay endpoint, guarda en Firestore con campo toRole.
 */
export const notificarRol = async ({ rol, title, body, ocId, tipo }) => {
  await guardarNotificacionFirestore({ toRole: rol, title, body, ocId, tipo });

  if (!API) {
    console.info("[Notifs] VITE_NOTIFS_ENDPOINT no configurado. Guardado solo en Firestore.");
    return;
  }
  try {
    await postJSON(API, { toRole: rol, title, body, ocId });
  } catch (e) {
    console.warn("[Notifs] Push notification falló (guardado en Firestore):", e?.message);
  }
};

/**
 * Eventos predefinidos del sistema
 */
export const notificarEventos = {
  nuevaOrden: (ocId, creadoPor) =>
    notificarRol({
      rol: "operaciones",
      title: "Nueva Orden de Compra",
      body: `Se ha generado la orden ${ocId} por ${creadoPor}. Requiere tu aprobación.`,
      ocId,
      tipo: "orden_creada",
    }),

  ordenAprobada: (ocId, aprobadoPor, siguiente) =>
    notificarRol({
      rol: siguiente?.toLowerCase()?.replace("pendiente de ", "") || "finanzas",
      title: "Orden Aprobada",
      body: `La orden ${ocId} fue aprobada por ${aprobadoPor} y avanza a: ${siguiente}.`,
      ocId,
      tipo: "orden_aprobada",
    }),

  ordenRechazada: (ocId, rechazadoPor, creadoPor) => [
    notificarRol({ rol: "comprador", title: "Orden Rechazada", body: `La orden ${ocId} fue rechazada por ${rechazadoPor}.`, ocId, tipo: "orden_rechazada" }),
    notificarUsuario({ email: creadoPor, title: "Tu orden fue rechazada", body: `La orden ${ocId} fue rechazada por ${rechazadoPor}.`, ocId, tipo: "orden_rechazada" }),
  ],

  nuevoRequerimiento: (codigo, creadoPor) =>
    notificarRol({
      rol: "comprador",
      title: "Nuevo Requerimiento",
      body: `Se creó el requerimiento ${codigo} por ${creadoPor}.`,
      tipo: "requerimiento_creado",
    }),
};
