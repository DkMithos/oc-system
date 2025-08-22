// ✅ src/firebase/cajaChicaHelpers.js
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

// Rutas por caja: cajasChicas/{caja}/movimientos
// caja: 'administrativa' | 'operativa'
const ROOT = "cajasChicas";

/**
 * Sube un comprobante a Storage con carpeta por caja.
 * @param {'administrativa'|'operativa'} caja
 * @param {File} file
 * @param {string} nombreArchivoBase - sin extensión
 * @returns {Promise<string>} url de descarga
 */
export const subirComprobanteCaja = async (caja, file, nombreArchivoBase) => {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const storageRef = ref(
    storage,
    `comprobantesCaja/${caja}/${nombreArchivoBase}.${ext}`
  );
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
};

/**
 * Agrega un movimiento a la caja indicada.
 * @param {'administrativa'|'operativa'} caja
 * @param {{
 *  tipo: 'ingreso'|'egreso',
 *  monto: number,
 *  descripcion: string,
 *  centroCosto: string,
 *  fecha: string|Date, // yyyy-mm-dd o Date
 *  usuario: string,
 *  comprobanteUrl?: string
 * }} movimiento
 */
export const agregarMovimientoCaja = async (caja, movimiento) => {
  // Respetamos la fecha ingresada (si viene string yyyy-mm-dd la convertimos a Date)
  let fechaFinal;
  if (movimiento.fecha instanceof Date) {
    fechaFinal = movimiento.fecha;
  } else if (typeof movimiento.fecha === "string") {
    // yyyy-mm-dd -> Date a medianoche local
    const [y, m, d] = movimiento.fecha.split("-").map(Number);
    fechaFinal = new Date(y, (m || 1) - 1, d || 1);
  } else {
    // fallback
    fechaFinal = new Date();
  }

  const docRef = collection(db, ROOT, caja, "movimientos");
  const payload = {
    tipo: movimiento.tipo,
    monto: Number(movimiento.monto) || 0,
    descripcion: movimiento.descripcion || "",
    centroCosto: movimiento.centroCosto || "",
    fecha: fechaFinal, // guardamos Date; Firestore lo serializa como Timestamp
    usuario: movimiento.usuario || "",
    comprobanteUrl: movimiento.comprobanteUrl || null,
    creadoEn: serverTimestamp(),
  };
  await addDoc(docRef, payload);
};

/**
 * Obtiene los movimientos de una caja, ordenados por fecha desc.
 * @param {'administrativa'|'operativa'} caja
 */
export const obtenerMovimientosCaja = async (caja) => {
  const q = query(
    collection(db, ROOT, caja, "movimientos"),
    orderBy("fecha", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};
