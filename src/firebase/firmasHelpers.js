// src/firebase/firmasHelpers.js
// Fase 8: Firmas almacenadas en Firebase Storage, Firestore solo guarda la URL.
// Backward compatible: si firma existente es base64, se muestra igual.

import { db, storage } from "./config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

/**
 * Sube un dataURL (base64) a Firebase Storage y devuelve la URL pública.
 * @param {string} email - Email del usuario (se usa como path)
 * @param {string} dataUrl - "data:image/png;base64,..."
 * @returns {Promise<string>} Download URL
 */
const subirFirmaAStorage = async (email, dataUrl) => {
  const path = `firmas/${email.toLowerCase()}/firma.png`;
  const storageRef = ref(storage, path);
  await uploadString(storageRef, dataUrl, "data_url");
  return getDownloadURL(storageRef);
};

/**
 * Devuelve la URL (o dataURL legacy) de la firma guardada del usuario, o null.
 * Doc: firmas/{email} -> { email, firma: "https://..." | "data:image/png;base64,..." }
 */
export const obtenerFirmaGuardada = async (email) => {
  if (!email) return null;
  const snap = await getDoc(doc(db, "firmas", email.toLowerCase()));
  return snap.exists() ? snap.data().firma || null : null;
};

/**
 * Guarda/actualiza la firma para el usuario.
 * - Sube la imagen a Storage
 * - Guarda la URL en Firestore (ya no el base64 completo)
 */
export const guardarFirmaUsuario = async (email, firmaDataUrl) => {
  if (!email || !firmaDataUrl) throw new Error("Falta email o firma");

  // Validación de tamaño (previene uploads enormes)
  if (firmaDataUrl.length > 800000) {
    throw new Error("La imagen de la firma es demasiado pesada. Intenta con una más pequeña.");
  }

  let firmaUrl = firmaDataUrl;

  // Si es dataURL (base64), subir a Storage y obtener URL
  if (firmaDataUrl.startsWith("data:")) {
    firmaUrl = await subirFirmaAStorage(email, firmaDataUrl);
  }

  const docRef = doc(db, "firmas", email.toLowerCase());
  await setDoc(docRef, {
    email: email.toLowerCase(),
    firma: firmaUrl,
    actualizadoEn: new Date().toISOString(),
  }, { merge: true });

  return firmaUrl;
};

/**
 * Convierte un File de imagen a dataURL, sube a Storage y guarda la URL.
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
  return guardarFirmaUsuario(email, dataUrl);
};
