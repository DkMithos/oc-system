// src/firebase/inventarioHelpers.js
import { db } from "./config";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

const INVENTARIO_COLLECTION = "inventario";

// ── Constantes exportadas ────────────────────────────────────────────────────
export const CATEGORIAS_INVENTARIO = [
  "Herramientas",
  "Repuestos",
  "Equipos",
  "Materiales",
  "EPP",
  "Servicios",
  "Combustibles",
  "Oficina",
  "Otros",
];

export const UNIDADES_INVENTARIO = [
  "UND", "CJ", "PAQ", "PAR", "JGO", "PZA", "KIT",
  "KG", "TON", "LT", "GLN", "MT", "MT2", "SERV", "HRS",
];

// ── Helpers de lectura ───────────────────────────────────────────────────────

/** Devuelve todos los ítems activos (activo !== false). */
export const obtenerItemsInventario = async () => {
  const snap = await getDocs(collection(db, INVENTARIO_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => item.activo !== false);
};

/**
 * [F-05] Suscripción en tiempo real a todos los ítems (activos e inactivos).
 * Devuelve la función `unsubscribe` para limpiar el listener.
 * @param {(items: object[]) => void} callback
 * @returns {() => void} unsubscribe
 */
export const escucharItemsInventario = (callback) => {
  return onSnapshot(
    collection(db, INVENTARIO_COLLECTION),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (err) => {
      console.error("[inventario] Error en listener:", err);
    }
  );
};

/** Devuelve ítems activos filtrados por centroCostoId. */
export const obtenerItemsInventarioPorCentro = async (centroCostoId) => {
  const q = query(
    collection(db, INVENTARIO_COLLECTION),
    where("centroCostoId", "==", centroCostoId),
    where("activo", "==", true)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// ── Helpers de escritura ─────────────────────────────────────────────────────

/**
 * Crea un nuevo ítem en el inventario.
 * Si `codigo` está vacío, auto-genera uno con el patrón: {CAT}-{últimos 4 del timestamp}
 */
export const agregarItemInventario = async (data) => {
  const ahora = new Date().toISOString();
  const codigoFinal =
    data.codigo?.trim() ||
    `${(data.categoria || "OTR").slice(0, 3).toUpperCase()}-${ahora.slice(-8, -4)}`;

  const payload = {
    ...data,
    codigo: codigoFinal,
    activo: data.activo !== false,
    precioReferencia: data.precioReferencia ? Number(data.precioReferencia) : null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };

  const ref = await addDoc(collection(db, INVENTARIO_COLLECTION), payload);
  return ref.id;
};

/** Actualiza campos de un ítem existente. */
export const actualizarItemInventario = async (id, data) => {
  const ref = doc(db, INVENTARIO_COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    precioReferencia: data.precioReferencia ? Number(data.precioReferencia) : null,
    actualizadoEn: new Date().toISOString(),
  });
  return id;
};

/** Soft-delete: marca activo=false. */
export const desactivarItemInventario = async (id) => {
  const ref = doc(db, INVENTARIO_COLLECTION, id);
  await updateDoc(ref, {
    activo: false,
    actualizadoEn: new Date().toISOString(),
  });
};

/**
 * Búsqueda de texto en memoria sobre todos los ítems (activos e inactivos).
 * Cruza código, nombre y categoría.
 */
export const buscarItemsInventario = async (q) => {
  const todos = await getDocs(collection(db, INVENTARIO_COLLECTION));
  const lista = todos.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!q || q.length < 2) return lista;
  const texto = q.toLowerCase();
  return lista.filter(
    (item) =>
      (item.codigo || "").toLowerCase().includes(texto) ||
      (item.nombre || "").toLowerCase().includes(texto) ||
      (item.categoria || "").toLowerCase().includes(texto)
  );
};
