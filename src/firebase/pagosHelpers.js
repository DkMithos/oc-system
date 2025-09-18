// src/firebase/pagosHelpers.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

export const subirArchivoComprobante = async (ordenId, file) => {
  const safeName = (file.name || "archivo").replace(/\s+/g, "_");
  const path = `facturas/${ordenId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};
