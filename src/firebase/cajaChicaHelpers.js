// ✅ firebase/cajaChicaHelpers.js
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";

const CAJA_COLLECTION = "cajaChica";

// 🔹 Agregar movimiento de caja chica
export const agregarMovimientoCaja = async (movimiento) => {
  const nuevoMovimiento = {
    ...movimiento,
    fecha: serverTimestamp(),
  };
  await addDoc(collection(db, CAJA_COLLECTION), nuevoMovimiento);
};

// 🔹 Obtener todos los movimientos (ordenados por fecha descendente)
export const obtenerMovimientosCaja = async () => {
  const q = query(collection(db, CAJA_COLLECTION), orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// 🔹 Subir comprobante (PDF o imagen) a Storage
export const subirComprobanteCaja = async (file, nombreArchivo) => {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `comprobantesCaja/${nombreArchivo}.${ext}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
};
