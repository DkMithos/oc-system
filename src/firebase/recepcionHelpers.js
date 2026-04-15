// src/firebase/recepcionHelpers.js
import {
  collection, addDoc, getDocs, doc, updateDoc,
  serverTimestamp, query, orderBy, collectionGroup, limit,
} from "firebase/firestore";
import { db } from "./config";

const OC_COL = "ordenesCompra";
const SUB_COL = "recepciones";

/** Crea una recepción para una OC y actualiza el estado de recepción en la OC. */
export async function crearRecepcion(ocId, data) {
  const ref = await addDoc(
    collection(db, OC_COL, ocId, SUB_COL),
    { ...data, ocId, creadoEn: serverTimestamp() }
  );
  // Actualizar OC con estado de recepción
  await updateDoc(doc(db, OC_COL, ocId), {
    recepcionEstado: data.estado,
    recepcionFecha: data.fechaRecepcion,
    recepcionPor: data.recibidoPor,
  });
  return ref.id;
}

/** Trae todas las recepciones de una OC. */
export async function obtenerRecepcionesPorOC(ocId) {
  const snap = await getDocs(
    query(collection(db, OC_COL, ocId, SUB_COL), orderBy("creadoEn", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Trae las últimas 200 recepciones de todas las OCs (collectionGroup). */
export async function obtenerTodasRecepciones() {
  const snap = await getDocs(
    query(collectionGroup(db, SUB_COL), orderBy("creadoEn", "desc"), limit(200))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
