// src/firebase/solicitudesHelpers.js
import {
  addDoc,
  collection,
  collectionGroup,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";
import { db } from "./config";

/**
 * Crea una solicitud de edición para una OC
 * @param {string} ocId
 * @param {{ motivo: string, numeroOC?: string, creadoPorEmail: string, creadoPorNombre?: string }} data
 */
export const crearSolicitudEdicion = async (ocId, data) => {
  const ref = collection(db, "ordenesCompra", ocId, "solicitudesEdicion");
  const payload = {
    motivo: data.motivo || "",
    numeroOC: data.numeroOC || "",
    creadoPorEmail: data.creadoPorEmail,
    creadoPorNombre: data.creadoPorNombre || "",
    estado: "pendiente",
    creadoEn: serverTimestamp(),
  };
  await addDoc(ref, payload);
};

/**
 * Lista solicitudes de una OC (más recientes primero)
 */
export const listarSolicitudesEdicion = async (ocId) => {
  const q = query(
    collection(db, "ordenesCompra", ocId, "solicitudesEdicion"),
    orderBy("creadoEn", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Resolver una solicitud (aprobar/rechazar)
 * @param {'aprobada'|'rechazada'} estado
 */
export const resolverSolicitudEdicion = async (ocId, solId, estado, { resueltoPorEmail, resueltoPorNombre, observacion }) => {
  const ref = doc(db, "ordenesCompra", ocId, "solicitudesEdicion", solId);
  await updateDoc(ref, {
    estado: estado,
    observacion: observacion || "",
    resueltoPorEmail: resueltoPorEmail || "",
    resueltoPorNombre: resueltoPorNombre || "",
    resueltoEn: serverTimestamp(),
  });
};

/**
 * 🔸 Contador global de solicitudes de edición pendientes (para roles aprobadores)
 *  - Si el usuario es aprobador: cuenta todas las pendientes
 *  - Si no: 0
 */
export const contarSolicitudesPendientesGlobal = async (esAprobador) => {
  if (!esAprobador) return 0;
  const q = query(collectionGroup(db, "solicitudesEdicion"), where("estado", "==", "pendiente"));
  const snap = await getDocs(q);
  return snap.size || 0;
};
