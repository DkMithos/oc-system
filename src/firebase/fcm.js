// src/firebase/fcm.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { db, firebaseConfig } from "./config";
import { doc, setDoc, collection, serverTimestamp } from "firebase/firestore";

// Evita doble init si otro módulo ya lo hizo
const app = initializeApp(firebaseConfig);

// Algunas plataformas no soportan FCM (Safari macOS sin PWA, etc.)
const messagingPromise = (async () => {
  const ok = await isSupported().catch(() => false);
  return ok ? getMessaging(app) : null;
})();

// Registra el SW en la RAÍZ y devuelve el registration
async function ensureMessagingSW() {
  if (!("serviceWorker" in navigator)) return null;
  // Registra (o reusa) el SW en / con el script correcto
  const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  // Espera a que esté “listo”
  await navigator.serviceWorker.ready;
  return reg;
}

// Pide permiso y devuelve el token (o null)
export const solicitarPermisoYObtenerToken = async (email) => {
  try {
    const messaging = await messagingPromise;
    if (!messaging) {
      console.warn("[FCM] Este navegador no soporta FCM.");
      return null;
    }

    const reg = await ensureMessagingSW();
    // IMPORTANTE: debes haber solicitado Notification permission before
    const token = await getToken(messaging, {
      vapidKey: "BOiaDAVx-SNnO4sCATGgK8w8--WehBRQmhg7_nafznWGrSD7jFRQbX2JN4g3H9VvT0QQM6YKzI6EVQ3XqhbPQAU",
      serviceWorkerRegistration: reg,
    });

    if (token && email) {
      const tokenRef = doc(collection(db, "usuarios", email, "tokens"), token);
      await setDoc(tokenRef, {
        token,
        plataforma: "web",
        creado: serverTimestamp(),
        activo: true,
      });
    }
    return token;
  } catch (error) {
    console.error("[FCM] Error obteniendo token:", error);
    return null;
  }
};

// Listener en primer plano: pásale un callback y devuelve unsubscribe
export const onMessageListener = async (callback) => {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
