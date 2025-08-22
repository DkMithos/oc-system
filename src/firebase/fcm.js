// src/firebase/fcm.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { db, firebaseConfig } from "./config";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { auth } from "./config";

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const VAPID_KEY = "BOiaDAVx-SNnO4sCATGgK8w8--WehBRQmhg7_nafznWGrSD7jFRQbX2JN4g3H9VvT0QQM6YKzI6EVQ3XqhbPQAU";

// 1. Obtener token FCM del navegador (y pedir permisos)
export const solicitarPermisoYObtenerToken = async (email) => {
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token && email) {
      // Guarda el token en Firestore
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

// 2. Guardar el token en Firestore para el usuario (llama esto después de login)
export const guardarTokenFCM = async (token) => {
  try {
    // Usa localStorage o el usuario autenticado
    const email = localStorage.getItem("userEmail") || auth.currentUser?.email;
    if (!email || !token) return;

    const db = getFirestore();
    // Usar email como ID para evitar duplicados
    await setDoc(doc(db, "tokensFCM", email), {
      usuarioEmail: email,
      token: token,
      actualizado: new Date().toISOString(),
    });
    console.log("[FCM] Token guardado en Firestore");
  } catch (e) {
    console.error("[FCM] Error guardando token FCM:", e);
  }
};

// 3. Escuchar notificaciones en primer plano
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
