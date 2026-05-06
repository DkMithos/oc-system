// src/firebase/pagosHelpers.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

const EXTS_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png"];

export const subirArchivoComprobante = async (ordenId, file) => {
  const ext = "." + (file.name || "").split(".").pop().toLowerCase();
  if (!EXTS_PERMITIDAS.includes(ext)) {
    throw new Error(`Tipo de archivo no permitido. Use: ${EXTS_PERMITIDAS.join(", ")}`);
  }
  const safeName = (file.name || "archivo").replace(/\s+/g, "_");
  const path = `facturas/${ordenId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};
