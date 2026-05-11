// src/firebase/solicitudesHelpers.js
import {
  addDoc,
  collection,
  collectionGroup,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  runTransaction,
} from "firebase/firestore";
import { db } from "./config";

/**
 * Crea una solicitud de edición para una OC
 * @param {string} ocId
 * @param {{ motivo: string, numeroOC?: string, creadoPorEmail: string, creadoPorNombre?: string }} data
 */
export const crearSolicitudEdicion = async (ocId, data) => {
  const ref = collection(db, "ordenesCompra", ocId, "solicitudesEdicion");
  const payload = {
    motivo: data.motivo || "",
    numeroOC: data.numeroOC || "",
    creadoPorEmail: data.creadoPorEmail,
    creadoPorNombre: data.creadoPorNombre || "",
    estado: "pendiente",
    creadoEn: serverTimestamp(),
  };
  await addDoc(ref, payload);
};

/**
 * Lista solicitudes de una OC (más recientes primero)
 */
export const listarSolicitudesEdicion = async (ocId) => {
  const q = query(
    collection(db, "ordenesCompra", ocId, "solicitudesEdicion"),
    orderBy("creadoEn", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Resolver una solicitud (aprobar/rechazar)
 * @param {'aprobada'|'rechazada'} estado
 */
export const resolverSolicitudEdicion = async (ocId, solId, estado, { resueltoPorEmail, resueltoPorNombre, observacion }) => {
  const ref = doc(db, "ordenesCompra", ocId, "solicitudesEdicion", solId);
  await updateDoc(ref, {
    estado: estado,
    observacion: observacion || "",
    resueltoPorEmail: resueltoPorEmail || "",
    resueltoPorNombre: resueltoPorNombre || "",
    resueltoEn: serverTimestamp(),
  });
};

/**
 * [C-03] Aprueba una solicitud de edición dentro de una transacción atómica.
 * Actualiza tanto la solicitud como la OC padre para evitar race conditions.
 * @param {string} ocId
 * @param {string} solId
 * @param {{ resueltoPorEmail: string, resueltoPorNombre?: string, observacion?: string }} resolucion
 */
export const aprobarSolicitudEdicionAtomico = async (ocId, solId, resolucion) => {
  const ocRef = doc(db, "ordenesCompra", ocId);
  const solRef = doc(db, "ordenesCompra", ocId, "solicitudesEdicion", solId);

  await runTransaction(db, async (tx) => {
    const [ocSnap, solSnap] = await Promise.all([tx.get(ocRef), tx.get(solRef)]);

    if (!ocSnap.exists()) throw new Error("Orden no encontrada");
    if (!solSnap.exists()) throw new Error("Solicitud no encontrada");

    const solData = solSnap.data();
    if (solData.estado !== "pendiente") {
      throw new Error(`La solicitud ya fue resuelta (estado: ${solData.estado})`);
    }

    const oc = ocSnap.data();
    const historial = [
      ...(oc.historial || []),
      {
        accion: "Solicitud de edición aprobada",
        por: resolucion.resueltoPorEmail,
        fecha: new Date().toLocaleString("es-PE"),
      },
    ];

    // Actualizar solicitud
    tx.update(solRef, {
      estado: "aprobada",
      observacion: resolucion.observacion || "",
      resueltoPorEmail: resolucion.resueltoPorEmail || "",
      resueltoPorNombre: resolucion.resueltoPorNombre || "",
      resueltoEn: serverTimestamp(),
    });

    // Actualizar OC: habilitar edición
    tx.update(ocRef, {
      permiteEdicion: true,
      tieneSolicitudEdicion: false,
      historial,
      actualizadoEn: new Date().toISOString(),
    });
  });
};

/**
 * 🔸 Contador global de solicitudes de edición pendientes (para roles aprobadores)
 */
export const contarSolicitudesPendientesGlobal = async (esAprobador) => {
  if (!esAprobador) return 0;
  const q = query(collectionGroup(db, "solicitudesEdicion"), where("estado", "==", "pendiente"));
  const snap = await getDocs(q);
  return snap.size || 0;
};

/**
 * Lista todas las solicitudes pendientes con el id del OC padre.
 * Para roles aprobadores (operaciones/gerencia).
 */
export const listarSolicitudesPendientesGlobal = async () => {
  const q = query(collectionGroup(db, "solicitudesEdicion"), where("estado", "==", "pendiente"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ocId: d.ref.parent.parent.id,
    ...d.data(),
  }));
};

/**
 * Lista solicitudes creadas por un email específico (para comprador).
 * Devuelve las aprobadas para que el comprador sepa que puede editar.
 */
export const listarSolicitudesPorEmail = async (email) => {
  const q = query(
    collectionGroup(db, "solicitudesEdicion"),
    where("creadoPorEmail", "==", email)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ocId: d.ref.parent.parent.id,
    ...d.data(),
  }));
};
