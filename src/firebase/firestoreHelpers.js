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
  onSnapshot,
} from "firebase/firestore";
import {
  rolToKey,
  yaFirmo,
  nextEstadoAprobado,     // 👈 ahora sí existe
  nextEstadoAprobando,    // 👈 por si lo usabas en algún lugar
  estadoInicial,
  ESTADOS,
} from "../utils/aprobaciones";
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
  const snapshot = await getDocs(collection(db, USUARIOS_COLLECTION));
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
export const registrarLog = async (payload = {}) => {
  try {
    const base = { fecha: serverTimestamp() };
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

// Guarda OC/OS/OI con correlativo único y reglas de enlace
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
      numero,                // 👈 número estandar
      numeroOC: numero,      // 👈 para compatibilidad con vistas que usan numeroOC
      estado: estadoInicial({ tipoOrden }), // 👈 estado inicial correcto
      firmas: {
        operaciones: null,
        gerenciaOperaciones: null,
        gerenciaGeneral: null,
        finanzas: null, // si aún no la usas, quedará null
      },
      creadaEn: serverTimestamp(),
      eliminada: false, // soft-delete
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
 *  MAESTROS
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

/** =========================
 *  Suscripción en vivo a una OC
 * ========================= */
export function suscribirOC(ocId, callback) {
  if (!ocId) return () => {};
  const ref = doc(db, OC_COLLECTION, ocId); // 👈 misma colección
  return onSnapshot(ref, (snap) =>
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  );
}

/** =========================
 *  Aprobar / Rechazar con transacción
 * ========================= */
function pushHist(hist = [], accion, por, extra = {}) {
  return [
    ...hist,
    { accion, por: por || "", fecha: new Date().toLocaleString("es-PE"), ...extra },
  ];
}

export async function firmarOrden(
  ocId,
  { userRol, userEmail, firmaUrl = "", comentario = "" }
) {
  const ref = doc(db, OC_COLLECTION, ocId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error("La orden no existe.");
    const oc = snap.data();

    const roleKey = rolToKey(userRol);
    if (!roleKey) throw new Error("Tu rol no puede firmar.");
    if (yaFirmo(oc, roleKey)) throw new Error("Ya firmaste esta orden.");

    const estadoActual = oc.estado || ESTADOS.PEND_OP;
    const turnos = {
      operaciones: [ESTADOS.PEND_OP, ESTADOS.PENDIENTE],
      gerenciaOperaciones: [ESTADOS.PEND_GOP],
      gerenciaGeneral: [ESTADOS.PEND_GGRAL],
    };
    const puede = (turnos[roleKey] || []).includes(estadoActual);
    if (!puede) throw new Error("Aún no te corresponde firmar.");

    const next = nextEstadoAprobado(estadoActual);
    const firmas = { ...(oc.firmas || {}) };
    firmas[roleKey] = firmaUrl || true;

    trx.update(ref, {
      firmas,
      estado: next,
      historial: pushHist(
        oc.historial || [],
        `Aprobación (${roleKey})${comentario ? `: ${comentario}` : ""}`,
        userEmail
      ),
      actualizadoEn: serverTimestamp(),
      ...(next === ESTADOS.APROBADO ? { aprobadoEn: serverTimestamp() } : {}),
    });
  });
}

export async function rechazarOrden(
  ocId,
  { userRol, userEmail, comentario = "" }
) {
  const ref = doc(db, OC_COLLECTION, ocId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error("La orden no existe.");

    const oc = snap.data();
    const roleKey = rolToKey(userRol);
    if (!roleKey) throw new Error("Tu rol no puede rechazar.");

    const estadoActual = oc.estado || ESTADOS.PEND_OP;
    const turnos = {
      operaciones: [ESTADOS.PEND_OP, ESTADOS.PENDIENTE],
      gerenciaOperaciones: [ESTADOS.PEND_GOP],
      gerenciaGeneral: [ESTADOS.PEND_GGRAL],
    };
    const puede = (turnos[roleKey] || []).includes(estadoActual);
    if (!puede) throw new Error("Aún no te corresponde esta acción.");

    trx.update(ref, {
      estado: ESTADOS.RECHAZADO,
      historial: pushHist(
        oc.historial || [],
        `Rechazo (${roleKey})${comentario ? `: ${comentario}` : ""}`,
        userEmail
      ),
      actualizadoEn: serverTimestamp(),
      rechazadoPor: userEmail,
    });
  });
}
