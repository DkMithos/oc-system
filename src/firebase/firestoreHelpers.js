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
  orderBy,
  runTransaction,
} from "firebase/firestore";
import { db } from "./config";

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

export const eliminarUsuario = async (email) => {
  await deleteDoc(doc(db, USUARIOS_COLLECTION, email));
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
  const qy = query(logsRef, orderBy("fecha", "desc"));
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
    tx.set(ref, {
      ...ordenData,
      numero,
      // 👇 Al inicio pasa a Operaciones (coincide con cadena de firmas)
      estado: "Pendiente de Operaciones",
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
export const obtenerCotizaciones = async () => {
  const snapshot = await getDocs(collection(db, COTIZACIONES_COLLECTION));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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
