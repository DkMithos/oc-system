import { db } from "./config";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  Timestamp,
  runTransaction,
} from "firebase/firestore";

const requerimientosRef = collection(db, "requerimientos");
const CORRELATIVO_REQ = doc(db, "correlativos", "requerimientos");

// Roles que pueden ver TODOS los requerimientos (no solo los propios)
const ROLES_VER_TODOS = ["admin", "soporte", "operaciones", "finanzas", "gerencia", "gerencia operaciones", "gerencia general", "gerencia finanzas", "administracion", "legal"];

/**
 * Agrega un nuevo requerimiento con correlativo atómico.
 */
export const agregarRequerimiento = async (requerimiento) => {
  const numero = await _siguienteCorrelativo();
  const data = {
    ...requerimiento,
    codigo: numero,
    fechaCreacion: Timestamp.now(),
    estado: requerimiento.estado || "Pendiente",
  };
  const ref = await addDoc(requerimientosRef, data);
  return { id: ref.id, codigo: numero };
};

/**
 * Correlativo atómico para requerimientos (transacción Firestore).
 * Evita duplicados incluso con concurrencia.
 */
const _siguienteCorrelativo = async () => {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(CORRELATIVO_REQ);
    const ultimo = snap.exists() ? Number(snap.data().ultimo || 0) : 0;
    const siguiente = ultimo + 1;
    tx.set(CORRELATIVO_REQ, { ultimo: siguiente }, { merge: true });
    return `RQ-${String(siguiente).padStart(5, "0")}`;
  });
};

/**
 * Genera el siguiente código SIN consumirlo (para preview en UI).
 */
export const generarCodigoRequerimiento = async () => {
  try {
    const snap = await getDoc(CORRELATIVO_REQ);
    const ultimo = snap.exists() ? Number(snap.data().ultimo || 0) : 0;
    return `RQ-${String(ultimo + 1).padStart(5, "0")}`;
  } catch {
    return `RQ-${Date.now()}`;
  }
};

/**
 * Retorna requerimientos según el rol:
 * - admin / operaciones / finanzas / gerencia* → todos
 * - comprador / otros → solo los del propio email
 */
export const obtenerRequerimientosPorRol = async (email, rol) => {
  const key = String(rol || "").toLowerCase();
  if (ROLES_VER_TODOS.includes(key)) {
    return obtenerRequerimientosAll();
  }
  return obtenerRequerimientosPorUsuario(email);
};

/**
 * Obtiene requerimientos de un usuario específico.
 */
export const obtenerRequerimientosPorUsuario = async (email) => {
  const q = query(requerimientosRef, where("usuario", "==", email));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Obtiene TODOS los requerimientos (admin/operaciones).
 */
export const obtenerRequerimientosAll = async () => {
  const snap = await getDocs(requerimientosRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Actualiza el estado de un requerimiento.
 * estados válidos: "Pendiente" | "En proceso" | "Completado" | "Cancelado"
 */
export const actualizarEstadoRequerimiento = async (id, nuevoEstado, actualizadoPor = "") => {
  const ref = doc(db, "requerimientos", id);
  const { updateDoc, serverTimestamp } = await import("firebase/firestore");
  await updateDoc(ref, {
    estado: nuevoEstado,
    actualizadoPor,
    actualizadoEn: serverTimestamp(),
  });
};
