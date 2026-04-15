// src/firebase/firestoreHelpers.js
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
  query,
  where,
  orderBy,
  runTransaction,
  limit,
  startAfter,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./config";
import { etapasRequeridas, siguienteEstado } from "../utils/aprobaciones";

/** =========================
 *  Constantes de colecciones
 * ========================= */
const OC_COLLECTION = "ordenesCompra";            // OC/OS/OI viven aquí
const USUARIOS_COLLECTION = "usuarios";
const LOGS_COLLECTION = "logs";
const COTIZACIONES_COLLECTION = "cotizaciones";
const PROVEEDORES_COLLECTION = "proveedores";
const CENTROS_COSTO_COLLECTION = "centrosCosto";
const CONDICIONES_PAGO_COLLECTION = "condicionesPago";
const FIRMAS_COLLECTION = "firmas";
const CORRELATIVOS_DOC = doc(db, "correlativos", "ordenes"); // correlativo único global

/** =========================
 *  USUARIOS
 * ========================= */
export const obtenerUsuarios = async () => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map((docu) => {
    const data = docu.data() || {};
    return {
      id: docu.id,
      email: data.email || docu.id,
      rol: data.rol || "comprador",
      estado: data.estado || "Activo",
    };
  });
};


// Crear usuario con contraseña inicial (opcional)
export const guardarUsuario = async ({ email, rol, password }) => {
  if (!email || !rol) throw new Error("El usuario debe tener correo y rol.");
  const userRef = doc(db, USUARIOS_COLLECTION, email);
  await setDoc(userRef, {
    email,
    rol,
    estado: "Activo",
    password: password || null,
    creadoEn: new Date().toISOString(),
  });
};

export const actualizarPasswordUsuario = async (email, nuevaPassword) => {
  if (!email || !nuevaPassword) throw new Error("Datos incompletos.");
  const ref = doc(db, USUARIOS_COLLECTION, email);
  await updateDoc(ref, {
    password: nuevaPassword,
    actualizadoEn: new Date().toISOString(),
  });
};

// [C-06] Elimina usuario tanto en Firestore como en Firebase Auth (vía Cloud Function admin)
export const eliminarUsuario = async (email) => {
  const fn = httpsCallable(getFunctions(), "borrarUsuarioAdmin");
  await fn({ email });
};

export const actualizarRolUsuario = async (email, nuevoRol) => {
  const ref = doc(db, USUARIOS_COLLECTION, email);
  await updateDoc(ref, { rol: nuevoRol });
};

/** =========================
 *  LOGS (auditoría)
 * ========================= */
// Compatible con llamadas tipo registrarLog({ ... }) y también con registrarLog("accion", ocId, usuario, rol, comentario)
export const registrarLog = async (payload = {}) => {
  try {
    // Normaliza y acepta cualquier shape (accion, descripcion, ocId, usuario, rol, comentario, hechoPor, etc.)
    const base = {
      fecha: serverTimestamp(),
    };
    await addDoc(collection(db, LOGS_COLLECTION), { ...base, ...payload });
  } catch (error) {
    console.error("Error registrando log:", error);
  }
};

export const obtenerLogs = async () => {
  const logsRef = collection(db, LOGS_COLLECTION);
  const qy = query(logsRef, orderBy("fecha", "desc"), limit(200));
  const snapshot = await getDocs(qy);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    fecha: d.data().fecha?.toDate().toLocaleString("es-PE") || "",
  }));
};

/** =========================
 *  ORDENES (OC/OS/OI)
 * ========================= */

// Lee el correlativo actual y devuelve el siguiente número formateado (sin consumirlo).
// Devuelve { siguiente: number, numero: "MM-000415" }
export const obtenerSiguienteNumeroOrden = async () => {
  const snap = await getDoc(CORRELATIVOS_DOC);
  const ultimo = snap.exists() ? Number(snap.data().ultimo || 0) : 0;
  const siguiente = ultimo + 1;
  return { siguiente, numero: `MM-${String(siguiente).padStart(6, "0")}` };
};

// Guarda OC/OS/OI con correlativo único y reglas de enlace (SP->COT->OC/OS)
// - tipoOrden: "OC" | "OS" | "OI"
// - OC/OS deben estar ligadas a una cotización, y la cotización a un requerimiento
// - Estado inicial: "Pendiente", firmas nulas (comprador NO firma), soft-delete=false
export const guardarOrden = async (ordenData) => {
  const { tipoOrden, cotizacionId, requerimientoId } = ordenData || {};
  if (!["OC", "OS", "OI"].includes(tipoOrden)) {
    throw new Error("tipoOrden debe ser 'OC' | 'OS' | 'OI'");
  }
  if (tipoOrden !== "OI" && !cotizacionId) {
    throw new Error("Las OC/OS deben estar ligadas a una cotización.");
  }
  if (cotizacionId && !requerimientoId) {
    throw new Error("La cotización debe estar ligada a un requerimiento.");
  }

  const { id: newId } = await runTransaction(db, async (tx) => {
    const seqSnap = await tx.get(CORRELATIVOS_DOC);
    const ultimo = seqSnap.exists() ? Number(seqSnap.data().ultimo || 0) : 0;
    const siguiente = ultimo + 1;
    const numero = `MM-${String(siguiente).padStart(6, "0")}`;

    const ref = doc(collection(db, OC_COLLECTION));
    const montoTotal = Number(ordenData?.resumen?.total || ordenData?.total || 0);
    const etapas = etapasRequeridas(montoTotal);
    const estadoInicial = etapas[0] || "Pendiente de Operaciones";

    tx.set(ref, {
      ...ordenData,
      numero,
      estado: estadoInicial,
      etapasAprobacion: etapas,
      historialAprobaciones: [],
      firmas: {
        comprador: null,
        operaciones: null,
        gerenciaOperaciones: null,
        gerenciaGeneral: null,
        finanzas: null,
      },
      creadaEn: serverTimestamp(),
      eliminada: false,
    });

    tx.set(CORRELATIVOS_DOC, { ultimo: siguiente }, { merge: true });
    return { id: ref.id };
  });

  await registrarLog({
    accion: "orden_creada",
    ocId: newId,
    usuario: ordenData?.creadoPor || "",
    rol: ordenData?.rolCreador || "",
  });

  return newId;
};

// Obtener todas las órdenes (excluye eliminadas) y ordena por correlativo (desc)
export const obtenerOCs = async () => {
  const snapshot = await getDocs(collection(db, OC_COLLECTION));
  const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) || [];
  const vivas = lista.filter((x) => x?.eliminada !== true);

  const parseN = (num) => {
    if (!num) return 0;
    const n = String(num).split("-")[1] || "0";
    return Number(n);
  };
  vivas.sort((a, b) => parseN(b.numero) - parseN(a.numero));
  return vivas;
};

// Paginación con cursor — devuelve { items, lastDoc, hasMore }
export const obtenerOCsPaginadas = async (pageSize = 30, lastVisible = null) => {
  let q = query(
    collection(db, OC_COLLECTION),
    orderBy("creadaEn", "desc"),
    limit(pageSize)
  );
  if (lastVisible) q = query(q, startAfter(lastVisible));

  const snapshot = await getDocs(q);
  const items = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => x?.eliminada !== true);
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  return { items, lastDoc, hasMore: snapshot.docs.length === pageSize };
};

// [F-03] Trae solo OCs con estado "Aprobada" — evita cargar todo para RegistrarPago
export const obtenerOCsAprobadas = async () => {
  const q = query(
    collection(db, OC_COLLECTION),
    where("estado", "==", "Aprobada")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => x?.eliminada !== true);
};

export const obtenerOCporId = async (id) => {
  const ref = doc(db, OC_COLLECTION, id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const actualizarOC = async (id, nuevaData) => {
  const ref = doc(db, OC_COLLECTION, id);
  await updateDoc(ref, { ...nuevaData, actualizadoEn: new Date().toISOString() });
};

// Soft-delete (no elimina físicamente)
export const eliminarOrdenLogico = async (id, usuarioEmail = "") => {
  const ref = doc(db, OC_COLLECTION, id);
  await updateDoc(ref, {
    eliminada: true,
    eliminadoPor: usuarioEmail,
    eliminadoEn: new Date().toISOString(),
  });
  await registrarLog({
    accion: "orden_eliminada_soft",
    ocId: id,
    usuario: usuarioEmail,
  });
};

/** =========================
 *  COTIZACIONES
 * ========================= */
// [C-05] Filtra cotizaciones con activo: false (soft-deleted)
export const obtenerCotizaciones = async () => {
  const snapshot = await getDocs(collection(db, COTIZACIONES_COLLECTION));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.activo !== false);
};

// [C-05] Soft-delete: marca activo: false en lugar de borrar físicamente
export const eliminarCotizacion = async (id, usuarioEmail = "") => {
  const ref = doc(db, COTIZACIONES_COLLECTION, id);
  await updateDoc(ref, {
    activo: false,
    eliminadaPor: usuarioEmail,
    eliminadaEn: new Date().toISOString(),
  });
  await registrarLog({
    accion: "cotizacion_eliminada",
    cotizacionId: id,
    usuario: usuarioEmail,
  });
};

/** =========================
 *  PROVEEDORES
 * ========================= */
export const obtenerProveedores = async () => {
  const snapshot = await getDocs(collection(db, PROVEEDORES_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** =========================
 *  MAESTROS: Centros de Costo / Condiciones de Pago
 * ========================= */
export const obtenerCentrosCosto = async () => {
  const snap = await getDocs(collection(db, CENTROS_COSTO_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const guardarCentroCosto = async (centro) => {
  await addDoc(collection(db, CENTROS_COSTO_COLLECTION), centro);
};

export const editarCentroCosto = async (id, nombre) => {
  await updateDoc(doc(db, CENTROS_COSTO_COLLECTION, id), { nombre });
};

export const eliminarCentroCosto = async (id) => {
  await deleteDoc(doc(db, CENTROS_COSTO_COLLECTION, id));
};

export const guardarCondicionPago = async (condicion) => {
  await addDoc(collection(db, CONDICIONES_PAGO_COLLECTION), condicion);
};

export const obtenerCondicionesPago = async () => {
  const snap = await getDocs(collection(db, CONDICIONES_PAGO_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const editarCondicionPago = async (id, nombre) => {
  await updateDoc(doc(db, CONDICIONES_PAGO_COLLECTION, id), { nombre });
};

export const eliminarCondicionPago = async (id) => {
  await deleteDoc(doc(db, CONDICIONES_PAGO_COLLECTION, id));
};

/** =========================
 *  FIRMAS
 * ========================= */
export const obtenerFirmaUsuario = async (email) => {
  const docRef = doc(db, FIRMAS_COLLECTION, email);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data().firma : null;
};

export const guardarFirmaUsuario = async (email, firmaDataUrl) => {
  const docRef = doc(db, FIRMAS_COLLECTION, email);
  await setDoc(docRef, { firma: firmaDataUrl });
};

/** =========================
 *  Solicitud de Edición (workflow)
 * ========================= */
export const solicitarEdicionOrden = async (ordenId, motivo, solicitante) => {
  const ref = doc(db, OC_COLLECTION, ordenId);
  await updateDoc(ref, {
    solicitudEdicion: {
      estado: "pendiente",
      motivo,
      solicitante,
      solicitadoEn: new Date().toISOString(),
    },
  });
  await registrarLog({
    accion: "orden_solicitud_edicion",
    ocId: ordenId,
    usuario: solicitante,
  });
};

export const resolverSolicitudEdicion = async (
  ordenId,
  aprobado,
  aprobador,
  observacion = ""
) => {
  const ref = doc(db, OC_COLLECTION, ordenId);
  await updateDoc(ref, {
    solicitudEdicion: {
      estado: aprobado ? "aprobada" : "rechazada",
      aprobador,
      observacion,
      resueltoEn: new Date().toISOString(),
    },
  });
  await registrarLog({
    accion: aprobado
      ? "orden_solicitud_edicion_aprobada"
      : "orden_solicitud_edicion_rechazada",
    ocId: ordenId,
    usuario: aprobador,
  });
};

/** =========================
 *  FLUJO DE APROBACIÓN DE ÓRDENES
 * ========================= */

/**
 * Aprueba una OC en su etapa actual y avanza al siguiente estado según el monto.
 * Guarda historial de aprobaciones.
 * @param {string} ordenId
 * @param {string} aprobador - email del aprobador
 * @param {string} rolAprobador
 * @param {string} [comentario]
 */
export const aprobarOC = async (ordenId, aprobador, rolAprobador, comentario = "") => {
  const ref = doc(db, OC_COLLECTION, ordenId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Orden no encontrada");

  const orden = snap.data();
  const estadoActual = orden.estado;
  const montoTotal = Number(orden?.resumen?.total || orden?.total || 0);
  const nuevoEstado = siguienteEstado(estadoActual, montoTotal);

  const entrada = {
    estado: estadoActual,
    aprobadoPor: aprobador,
    rol: rolAprobador,
    comentario,
    fecha: new Date().toISOString(),
    accion: "aprobado",
  };

  await updateDoc(ref, {
    estado: nuevoEstado,
    historialAprobaciones: [...(orden.historialAprobaciones || []), entrada],
    actualizadoEn: new Date().toISOString(),
    [`firmas.${rolAprobador.replace(/ /g, "")}`]: aprobador,
  });

  await registrarLog({
    accion: "orden_aprobada",
    ocId: ordenId,
    usuario: aprobador,
    rol: rolAprobador,
    estadoAnterior: estadoActual,
    estadoNuevo: nuevoEstado,
    comentario,
  });

  return nuevoEstado;
};

/**
 * Rechaza una OC en su etapa actual.
 */
export const rechazarOC = async (ordenId, rechazadoPor, rolRechazador, motivo = "") => {
  const ref = doc(db, OC_COLLECTION, ordenId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Orden no encontrada");

  const orden = snap.data();
  const estadoActual = orden.estado;
  const entrada = {
    estado: estadoActual,
    aprobadoPor: rechazadoPor,
    rol: rolRechazador,
    comentario: motivo,
    fecha: new Date().toISOString(),
    accion: "rechazado",
  };

  await updateDoc(ref, {
    estado: "Rechazado",
    historialAprobaciones: [...(orden.historialAprobaciones || []), entrada],
    actualizadoEn: new Date().toISOString(),
  });

  await registrarLog({
    accion: "orden_rechazada",
    ocId: ordenId,
    usuario: rechazadoPor,
    rol: rolRechazador,
    estadoAnterior: estadoActual,
    motivo,
  });
};

/** =========================
 *  FACTURAS (múltiples por orden)
 * ========================= */
export const agregarFacturaAOrden = async (ordenId, factura) => {
  const ref = doc(collection(db, `${OC_COLLECTION}/${ordenId}/facturas`));
  await setDoc(ref, {
    ...factura,
    creadaEn: serverTimestamp(),
  });
  await registrarLog({
    accion: "orden_factura_registrada",
    ocId: ordenId,
    usuario: factura?.registradoPor || "",
  });
};

export const obtenerFacturasDeOrden = async (ordenId) => {
  const snap = await getDocs(collection(db, `${OC_COLLECTION}/${ordenId}/facturas`));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
