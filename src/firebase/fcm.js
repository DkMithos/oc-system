// src/firebase/fcm.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { db, firebaseConfig } from "./config";
import { doc, setDoc, collection, serverTimestamp, getDoc, arrayUnion } from "firebase/firestore";

// Una sola app
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Algunas plataformas no soportan FCM
const messagingPromise = (async () => {
  try {
    const ok = await isSupported();
    return ok ? getMessaging(app) : null;
  } catch {
    return null;
  }
})();

// Registra el SW en la raíz y devuelve el registration
async function ensureMessagingSW() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

/**
 * Pide permiso (si hace falta), obtiene el token y lo persiste en:
 *   - usuarios/{email}/tokens/{autoId} => { token, activo }
 *   - tokensFCM/{email} => { token, tokens[] }
 */
export const solicitarPermisoYObtenerToken = async (email) => {
  try {
    if (!email) throw new Error("email requerido");

    const messaging = await messagingPromise;
    if (!messaging) {
      console.info("[FCM] Este navegador no soporta FCM.");
      return null;
    }

    // Permiso de notificaciones si aún no fue concedido
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        console.info("[FCM] Permiso no concedido:", perm);
        return null;
      }
    }

    const reg = await ensureMessagingSW();
    if (!reg) {
      console.warn("[FCM] No se pudo registrar el Service Worker de messaging.");
      return null;
    }

    // Usa tu VAPID pública (de la consola → Cloud Messaging → Web Push certificates)
    const vapidKey = "BOiaDAVx-SNnO4sCATGgK8w8--WehBRQmhg7_nafznWGrSD7jFRQbX2JN4g3H9VvT0QQM6YKzI6EVQ3XqhbPQAU";

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
    if (!token) {
      console.warn("[FCM] No se obtuvo token (¿permiso/VAPID?).");
      return null;
    }

    // 1) Guarda en usuarios/{email}/tokens/*
    const tokensCol = collection(db, "usuarios", email, "tokens");
    await setDoc(doc(tokensCol), {
      token,
      plataforma: "web",
      creado: serverTimestamp(),
      activo: true,
    });

    // 2) Guarda en tokensFCM/{email} (token + array tokens)
    const fcmRef = doc(db, "tokensFCM", email);
    const snap = await getDoc(fcmRef);
    if (!snap.exists()) {
      await setDoc(
        fcmRef,
        {
          token,
          tokens: [token],
          plataforma: "web",
          creadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await setDoc(
        fcmRef,
        {
          token,
          tokens: arrayUnion(token),
          plataforma: "web",
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
    }

    console.log("[FCM] Token listo:", token.slice(0, 12) + "…");
    return token;
  } catch (error) {
    console.error("[FCM] Error obteniendo token:", error);
    return null;
  }
};

// Listener en primer plano
export const onMessageListener = async (callback) => {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
