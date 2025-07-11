import { db } from "./config";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

// 👉 Referencia a la colección
const requerimientosRef = collection(db, "requerimientos");

/**
 * Agrega un nuevo requerimiento
 * @param {Object} requerimiento - Requerimiento a guardar
 */
export const agregarRequerimiento = async (requerimiento) => {
  const data = {
    ...requerimiento,
    fechaCreacion: Timestamp.now(),
  };
  await addDoc(requerimientosRef, data);
};

/**
 * Obtiene todos los requerimientos creados por un usuario
 * @param {String} email - Correo del usuario
 */
export const obtenerRequerimientosPorUsuario = async (email) => {
  const q = query(requerimientosRef, where("usuario", "==", email));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};


// Genera el siguiente código de requerimiento
export const generarCodigoRequerimiento = async () => {
  const snapshot = await getDocs(collection(db, "requerimientos"));
  const total = snapshot.size;
  const siguienteNumero = total + 1;
  return `RQ-${siguienteNumero.toString().padStart(5, "0")}`;
};