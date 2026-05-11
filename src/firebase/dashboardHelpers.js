import { collection, collectionGroup, getDocs, query, where, orderBy, limit, startAfter } from "firebase/firestore";
import { db } from "./config";

/**
 * Obtener todas las OC (excluye eliminadas).
 * Soporta paginación interna para evitar timeouts en colecciones grandes.
 * @param {Object} opciones
 * @param {number} opciones.batchSize - Tamaño de cada lote (default 500)
 * @param {number} opciones.maxTotal  - Máximo de OCs a retornar (0 = sin límite)
 */
export const obtenerTodasOC = async ({ batchSize = 500, maxTotal = 0 } = {}) => {
  const results = [];
  let lastDoc = null;
  let hayMas = true;

  while (hayMas) {
    let q = query(
      collection(db, "ordenesCompra"),
      orderBy("creadaEn", "desc"),
      limit(batchSize)
    );
    if (lastDoc) {
      q = query(
        collection(db, "ordenesCompra"),
        orderBy("creadaEn", "desc"),
        startAfter(lastDoc),
        limit(batchSize)
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) break;

    snap.docs.forEach((d) => {
      const data = d.data();
      if (!data.eliminada) {
        results.push({ id: d.id, ...data });
      }
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    hayMas = snap.docs.length === batchSize;

    // Limite global
    if (maxTotal > 0 && results.length >= maxTotal) {
      return results.slice(0, maxTotal);
    }
  }

  return results;
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
