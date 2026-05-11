// src/firebase/config.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

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
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  // measurementId: import.meta.env.VITE_MEASUREMENT_ID, // opcional
};

// Evita doble init en HMR
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// ── Firebase App Check (Fase 8) ──────────────────────────────────────────────
// Protege backend de llamadas no autorizadas.
// En dev usamos debug token; en prod, reCAPTCHA Enterprise.
// Para activar: definir VITE_RECAPTCHA_SITE_KEY en .env.local
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaKey) {
  // En dev Vite, habilitar debug para evitar bloqueos por reCAPTCHA
  if (import.meta.env.DEV) {
    // @ts-ignore — debug token para desarrollo local
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export { app, db, storage, auth };
