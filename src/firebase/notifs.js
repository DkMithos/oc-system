// src/firebase/notifs.js
// Si VITE_NOTIFS_ENDPOINT está configurado → envía push via Cloud Function
// Si NO está configurado → guarda in-app en Firestore (colección "notificaciones")
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";

const API = import.meta.env.VITE_NOTIFS_ENDPOINT;

// ─── Fallback: notificación in-app en Firestore ───────────────────────────────
async function guardarNotificacionInApp({ destinatario, rol, title, body, ocId }) {
  await addDoc(collection(db, "notificaciones"), {
    destinatario: destinatario || null,  // email específico o null si es por rol
    rol: rol || null,
    title,
    body,
    ocId: ocId || null,
    leida: false,
    creadoEn: serverTimestamp(),
  });
}

// ─── Push via Cloud Function (cuando el endpoint está disponible) ─────────────
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
 * Notifica a un usuario específico (por email).
 * Usa push si hay endpoint configurado; si no, guarda in-app en Firestore.
 */
export const notificarUsuario = async ({ email, title, body, ocId }) => {
  if (API) {
    try {
      return await postJSON(API, { toEmail: email, title, body, ocId });
    } catch (e) {
      console.warn("[notifs] Push falló, guardando in-app:", e.message);
    }
  }
  return guardarNotificacionInApp({ destinatario: email, title, body, ocId });
};

/**
 * Notifica a TODOS los usuarios de un rol.
 * Usa push si hay endpoint configurado; si no, guarda in-app en Firestore.
 */
export const notificarRol = async ({ rol, title, body, ocId }) => {
  if (API) {
    try {
      return await postJSON(API, { toRole: rol, title, body, ocId });
    } catch (e) {
      console.warn("[notifs] Push falló, guardando in-app:", e.message);
    }
  }
  return guardarNotificacionInApp({ rol, title, body, ocId });
};

/**
 * Obtiene notificaciones in-app de un usuario (por email o rol).
 * Usado por el componente de campana para mostrar el badge.
 */
export const obtenerNotificacionesInApp = async (email, rol) => {
  try {
    const porEmail = query(
      collection(db, "notificaciones"),
      where("destinatario", "==", email),
      where("leida", "==", false)
    );
    const porRol = query(
      collection(db, "notificaciones"),
      where("rol", "==", (rol || "").toLowerCase()),
      where("leida", "==", false)
    );
    const [snapEmail, snapRol] = await Promise.all([getDocs(porEmail), getDocs(porRol)]);
    const todas = [
      ...snapEmail.docs.map((d) => ({ id: d.id, ...d.data() })),
      ...snapRol.docs.map((d) => ({ id: d.id, ...d.data() })),
    ];
    // deduplicar por id
    return [...new Map(todas.map((n) => [n.id, n])).values()];
  } catch {
    return [];
  }
};
