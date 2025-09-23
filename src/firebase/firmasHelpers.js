// ✅ src/firebase/firmasHelpers.js
import { db } from "./config";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * Devuelve el dataURL (string) de la firma guardada del usuario, o null.
 * Doc: firmas/{email} -> { email, firma: "data:image/png;base64,..." }
 */
export const obtenerFirmaGuardada = async (email) => {
  if (!email) return null;
  const ref = doc(db, "firmas", email.toLowerCase());
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().firma || null : null;
};

/**
 * Guarda/actualiza la firma (en dataURL) para el usuario (módulo "Mi Firma").
 */
export const guardarFirmaUsuario = async (email, firmaDataUrl) => {
  if (!email || !firmaDataUrl) throw new Error("Falta email o firma");
  const ref = doc(db, "firmas", email.toLowerCase());
  await setDoc(ref, { email: email.toLowerCase(), firma: firmaDataUrl }, { merge: true });
};

/**
 * (Helper) Convierte un File de imagen a dataURL y guarda la firma.
 * Útil cuando el usuario sube PNG/JPG desde el disco.
 */
export const guardarFirmaDesdeArchivo = async (email, file) => {
  if (!email || !file) throw new Error("Falta email o archivo");
  const toDataURL = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  const dataUrl = await toDataURL(file);
  await guardarFirmaUsuario(email, dataUrl);
  return dataUrl;
};
