import { db } from "./config";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  runTransaction,
} from "firebase/firestore";

const requerimientosRef = collection(db, "requerimientos");

// Roles que pueden ver TODOS los requerimientos (no solo los propios)
const ROLES_VEN_TODO = ["admin", "operaciones", "gerencia operaciones", "gerencia general", "gerencia", "finanzas", "gerencia finanzas", "comprador"];

/**
 * Obtiene requerimientos según el rol:
 * - admin/operaciones/gerencia → TODOS
 * - comprador/otros → solo los propios (por email)
 */
export const obtenerRequerimientosPorRol = async (email, rol) => {
  const rolNorm = String(rol || "").toLowerCase().trim();
  const verTodo = ["admin", "operaciones", "gerencia operaciones", "gerencia general", "gerencia", "finanzas", "gerencia finanzas"].includes(rolNorm);

  if (verTodo) {
    const snap = await getDocs(requerimientosRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const q = query(requerimientosRef, where("usuario", "==", email));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Obtiene todos los requerimientos creados por un usuario (legacy - mantener compatibilidad)
 */
export const obtenerRequerimientosPorUsuario = async (email) => {
  const q = query(requerimientosRef, where("usuario", "==", email));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Obtiene todos los requerimientos sin filtro
 */
export const obtenerRequerimientosAll = async () => {
  const snap = await getDocs(requerimientosRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Agrega un nuevo requerimiento con estado inicial "Pendiente"
 */
export const agregarRequerimiento = async (requerimiento) => {
  const data = {
    ...requerimiento,
    estado: requerimiento.estado || "Pendiente",
    fechaCreacion: Timestamp.now(),
  };
  const ref = await addDoc(requerimientosRef, data);
  return ref.id;
};

/**
 * Actualiza el estado de un requerimiento y registra quién lo hizo
 */
export const actualizarEstadoRequerimiento = async (id, nuevoEstado, actualizadoPor = "") => {
  const ref = doc(db, "requerimientos", id);
  await updateDoc(ref, {
    estado: nuevoEstado,
    actualizadoPor,
    actualizadoEn: new Date().toISOString(),
  });
};

/**
 * Genera el siguiente código de requerimiento de forma atómica (sin race condition)
 */
export const generarCodigoRequerimiento = async () => {
  const corrRef = doc(db, "correlativos", "requerimientos");
  let codigo = "";
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(corrRef);
    const ultimo = snap.exists() ? Number(snap.data().ultimo || 0) : 0;
    const siguiente = ultimo + 1;
    codigo = `RQ-${String(siguiente).padStart(5, "0")}`;
    tx.set(corrRef, { ultimo: siguiente }, { merge: true });
  });
  return codigo;
};
