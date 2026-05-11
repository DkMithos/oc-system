// src/firebase/dashboardHelpers.js
// Fase 8: Agrega aggregation queries para KPIs eficientes.
import {
  collection,
  collectionGroup,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "./config";

const OC_COL = "ordenesCompra";

// ═══════════════════════════════════════════════════════════════════════════════
// Funciones existentes (sin cambios)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obtener todas las OC (excluye eliminadas).
 * Soporta paginación interna para evitar timeouts en colecciones grandes.
 */
export const obtenerTodasOC = async ({ batchSize = 500, maxTotal = 0 } = {}) => {
  const results = [];
  let lastDoc = null;
  let hayMas = true;

  while (hayMas) {
    let q = query(
      collection(db, OC_COL),
      orderBy("creadaEn", "desc"),
      limit(batchSize)
    );
    if (lastDoc) {
      q = query(
        collection(db, OC_COL),
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

    if (maxTotal > 0 && results.length >= maxTotal) {
      return results.slice(0, maxTotal);
    }
  }

  return results;
};

/** Obtener movimientos de caja chica (collectionGroup) */
export const obtenerTodosMovimientosCaja = async () => {
  try {
    const snap = await getDocs(collectionGroup(db, "movimientos"));
    return snap.docs.map((d) => ({ id: d.id, cajaId: d.ref.parent.parent?.id, ...d.data() }));
  } catch {
    return [];
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Fase 8: Aggregation queries para KPIs sin traer todos los docs
// ═══════════════════════════════════════════════════════════════════════════════

const ESTADOS_PENDIENTES = [
  "Pendiente de Comprador",
  "Pendiente de Operaciones",
  "Pendiente de Gerencia General",
];

/**
 * KPIs rápidos usando aggregation queries del servidor.
 * Evita descargar todos los documentos — solo conteos y sumas.
 * @returns {{ totalOCs, aprobadas, pendientes, montoAprobado, montoPendiente, porEstado }}
 */
export const obtenerKPIsAgregados = async () => {
  try {
    const col = collection(db, OC_COL);

    // Ejecutar todas las queries de agregación en paralelo
    const [
      totalSnap,
      aprobadaSnap,
      pendCompSnap,
      pendOpsSnap,
      pendGerSnap,
    ] = await Promise.all([
      // Total OCs (no eliminadas)
      getCountFromServer(query(col, where("eliminada", "!=", true))),
      // Aprobadas con suma de monto
      getAggregateFromServer(
        query(col, where("estado", "==", "Aprobada")),
        { count: sum("resumen.total") }
      ).catch(() => null),
      // Pendientes por etapa
      getCountFromServer(query(col, where("estado", "==", ESTADOS_PENDIENTES[0]))),
      getCountFromServer(query(col, where("estado", "==", ESTADOS_PENDIENTES[1]))),
      getCountFromServer(query(col, where("estado", "==", ESTADOS_PENDIENTES[2]))),
    ]);

    return {
      totalOCs: totalSnap.data().count,
      pendientesPorEtapa: {
        [ESTADOS_PENDIENTES[0]]: pendCompSnap.data().count,
        [ESTADOS_PENDIENTES[1]]: pendOpsSnap.data().count,
        [ESTADOS_PENDIENTES[2]]: pendGerSnap.data().count,
      },
      // sum() sobre campos anidados puede no estar soportado en todas las versiones;
      // si falla, el Dashboard usa el cálculo local como fallback
      montoAprobado: aprobadaSnap?.data()?.count || 0,
    };
  } catch {
    // Si aggregation queries no están disponibles, devolver null
    // y el Dashboard usará el método clásico (obtenerTodasOC)
    return null;
  }
};

/**
 * Conteo rápido de movimientos de caja por tipo.
 * @returns {{ ingresos: number, egresos: number } | null}
 */
export const obtenerTotalesCaja = async () => {
  try {
    const movCol = collectionGroup(db, "movimientos");
    const [ingSnap, egrSnap] = await Promise.all([
      getAggregateFromServer(
        query(movCol, where("tipo", "==", "ingreso")),
        { total: sum("monto") }
      ),
      getAggregateFromServer(
        query(movCol, where("tipo", "==", "egreso")),
        { total: sum("monto") }
      ),
    ]);
    return {
      ingresos: ingSnap.data().total || 0,
      egresos: egrSnap.data().total || 0,
    };
  } catch {
    return null;
  }
};
