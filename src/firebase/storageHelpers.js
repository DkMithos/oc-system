// src/firebase/storageHelpers.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

/**
 * Sube múltiples archivos PDF a Firebase Storage bajo el path 'pagos/{ocId}/'
 * y retorna un array de objetos con nombre y URL de descarga.
 */
export const subirArchivosPago = async (ocId, files) => {
  const urls = [];

  for (const file of files) {
    const storageRef = ref(storage, `pagos/${ocId}/${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    urls.push({ name: file.name, url });
  }

  return urls;
};

/**
 * Obtiene la URL de descarga de un archivo en Firebase Storage.
 * @param {string} path - Ruta del archivo en el storage, por ejemplo: 'pagos/OC-123/factura.pdf'
 * @returns {Promise<string|null>} URL de descarga o null si falla
 */
export const downloadFileFromStorage = async (path) => {
  try {
    const fileRef = ref(storage, path);
    const url = await getDownloadURL(fileRef);
    return url;
  } catch (error) {
    console.error("Error al obtener URL de descarga:", error);
    return null;
  }
};

