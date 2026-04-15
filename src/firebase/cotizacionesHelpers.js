import { db } from "./config";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

const COT_COLLECTION = "cotizaciones";

// Obtener cotizaciones activas (excluye soft-deleted)
export const obtenerCotizaciones = async () => {
  const snap = await getDocs(collection(db, COT_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.activo !== false);
};

// Obtener una cotización por ID
export const obtenerCotizacionPorId = async (id) => {
  const ref = doc(db, COT_COLLECTION, id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Agregar cotización
export const agregarCotizacion = async (data) => {
  const docRef = await addDoc(collection(db, COT_COLLECTION), {
    ...data,
    activo: true,
    creadoEn: serverTimestamp(),
  });
  return docRef.id;
};

// Editar cotización
export const actualizarCotizacion = async (id, data) => {
  const ref = doc(db, COT_COLLECTION, id);
  await updateDoc(ref, data);
};

// [C-05] Soft-delete: marca activo: false en lugar de borrar físicamente
export const eliminarCotizacion = async (id, usuarioEmail = "") => {
  const ref = doc(db, COT_COLLECTION, id);
  await updateDoc(ref, {
    activo: false,
    eliminadaPor: usuarioEmail,
    eliminadaEn: new Date().toISOString(),
  });
};
