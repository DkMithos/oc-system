// src/firebase/config.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const requiredEnv = [
  "VITE_API_KEY",
  "VITE_AUTH_DOMAIN",
  "VITE_PROJECT_ID",
  "VITE_STORAGE_BUCKET",
  "VITE_MESSAGING_SENDER_ID",
  "VITE_APP_ID",
];

const missing = requiredEnv.filter((k) => !import.meta.env[k]);
if (missing.length) {
  // Lanzamos un error claro en dev para que no te rompas la cabeza.
  throw new Error(
    `[Firebase Config] Faltan variables en .env.local: ${missing.join(", ")}`
  );
}

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET, // debe terminar en appspot.com
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  // measurementId: import.meta.env.VITE_MEASUREMENT_ID, // opcional
};

// Evita doble init en HMR
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
