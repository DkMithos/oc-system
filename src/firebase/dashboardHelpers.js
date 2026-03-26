import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";

// Obtener todas las OC (excluye eliminadas)
export const obtenerTodasOC = async () => {
  const snap = await getDocs(collection(db, "ordenesCompra"));
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((oc) => !oc.eliminada);
};

// Obtener movimientos de caja chica desde cajasChicas/{id}/movimientos
// Usa collectionGroup para obtener todos los movimientos de todas las cajas en una sola query
export const obtenerTodosMovimientosCaja = async () => {
  try {
    const snap = await getDocs(collectionGroup(db, "movimientos"));
    return snap.docs.map((d) => ({ id: d.id, cajaId: d.ref.parent.parent?.id, ...d.data() }));
  } catch {
    // fallback si no existe índice de collectionGroup
    return [];
  }
};
