import { db } from "./config";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";

const COT_COLLECTION = "cotizaciones";

// Obtener todas las cotizaciones
export const obtenerCotizaciones = async () => {
  const snap = await getDocs(collection(db, COT_COLLECTION));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Obtener una cotización por ID
export const obtenerCotizacionPorId = async (id) => {
  const ref = doc(db, COT_COLLECTION, id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Agregar cotización
export const agregarCotizacion = async (data) => {
  const docRef = await addDoc(collection(db, COT_COLLECTION), data);
  return docRef.id;
};

// Editar cotización
export const actualizarCotizacion = async (id, data) => {
  const ref = doc(db, COT_COLLECTION, id);
  await updateDoc(ref, data);
};

// Eliminar cotización
export const eliminarCotizacion = async (id) => {
  const ref = doc(db, COT_COLLECTION, id);
  await deleteDoc(ref);
};
