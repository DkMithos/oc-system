// src/firebase/fcm.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  serverTimestamp
} from "firebase/firestore";
import { db, firebaseConfig, auth } from "./config";

// Inicializa (evita doble init si ya existe en otras partes)
const app = initializeApp(firebaseConfig);

// Algunas plataformas no soportan FCM (Safari macOS sin PWA, etc.)
let messagingPromise = (async () => {
  const ok = await isSupported().catch(() => false);
  return ok ? getMessaging(app) : null;
})();

// Registra/obtiene el service worker de FCM en la RAÍZ
async function ensureMessagingSW() {
  if (!('serviceWorker' in navigator)) return null;
  // Intenta recuperar un SW activo sobre la ruta del file
  let reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
  if (!reg) {
    reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  }
  // Espera a que esté activo
  return navigator.serviceWorker.ready;
}

// Pide permiso con un gesto del usuario y devuelve el token (o null)
export const solicitarPermisoYObtenerToken = async (email) => {
  try {
    const messaging = await messagingPromise;
    if (!messaging) {
      console.warn("[FCM] Este navegador no soporta FCM.");
      return null;
    }

    const reg = await ensureMessagingSW();
    // Si el sitio está bloqueado, esto lanzará messaging/permission-blocked
    const token = await getToken(messaging, {
      vapidKey: "BOiaDAVx-SNnO4sCATGgK8w8--WehBRQmhg7_nafznWGrSD7jFRQbX2JN4g3H9VvT0QQM6YKzI6EVQ3XqhbPQAU",
      serviceWorkerRegistration: reg
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
    console.error("Error obteniendo token FCM:", error);
    return null;
  }
};

// Guarda/actualiza el token en una colección plana
export const guardarTokenFCM = async (token) => {
  try {
    const email = localStorage.getItem("userEmail") || auth.currentUser?.email;
    if (!email || !token) return;

    const _db = getFirestore();
    await setDoc(doc(_db, "tokensFCM", email), {
      usuarioEmail: email,
      token,
      actualizado: new Date().toISOString(),
    });
    console.log("[FCM] Token guardado en Firestore");
  } catch (e) {
    console.error("[FCM] Error guardando token FCM:", e);
  }
};

// Foreground messages
export const onMessageListener = async (callback) => {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
