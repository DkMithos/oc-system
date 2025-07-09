import { collection, getDocs } from "firebase/firestore";
import { db } from "./config";

// Obtener todas las OC
export const obtenerTodasOC = async () => {
  const snap = await getDocs(collection(db, "ordenesCompra"));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Obtener movimientos de caja chica
export const obtenerTodosMovimientosCaja = async () => {
  const snap = await getDocs(collection(db, "cajaChica"));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
