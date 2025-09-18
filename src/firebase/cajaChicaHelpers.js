// ✅ src/firebase/cajaChicaHelpers.js
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";

// -----------------------------------------------------------------------------
// Estructura base
// -----------------------------------------------------------------------------
const ROOT = "cajasChicas"; // cajasChicas/{caja}/movimientos
export const CAJAS_KEYS = ["op_proyectos", "operaciones", "administracion"];

// Valida la caja
function validarCaja(caja) {
  if (!CAJAS_KEYS.includes(caja)) {
    throw new Error(`Caja inválida: "${caja}". Usa una de: ${CAJAS_KEYS.join(", ")}`);
  }
}

// Convierte "yyyy-mm-dd" → Date (local) y deja 00:00:00
function dateFromYMD(ymd) {
  if (!ymd) return null;
  try {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Storage: subir comprobante
// -----------------------------------------------------------------------------
/**
 * Sube un comprobante a Storage en carpeta por caja.
 * @param {'op_proyectos'|'operaciones'|'administracion'} caja
 * @param {File} file
 * @param {string} nombreArchivoBase  (sin extensión)
 * @returns {Promise<string>} URL pública
 */
export const subirComprobanteCaja = async (caja, file, nombreArchivoBase) => {
  validarCaja(caja);
  if (!file) throw new Error("Archivo requerido para subir comprobante.");

  const ext = (file.name?.split(".").pop() || "bin").toLowerCase();
  const storageRef = ref(storage, `comprobantesCaja/${caja}/${nombreArchivoBase}.${ext}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
};

// -----------------------------------------------------------------------------
// Firestore: agregar / actualizar / eliminar movimiento
// -----------------------------------------------------------------------------
/**
 * Agrega un movimiento a la caja indicada.
 */
export const agregarMovimientoCaja = async (caja, movimiento) => {
  validarCaja(caja);

  // Normaliza fecha
  let fechaFinal;
  if (movimiento.fecha instanceof Date) {
    fechaFinal = movimiento.fecha;
  } else if (typeof movimiento.fecha === "string" && movimiento.fecha) {
    fechaFinal = dateFromYMD(movimiento.fecha);
  } else {
    fechaFinal = new Date();
  }

  const colRef = collection(db, ROOT, caja, "movimientos");
  const payload = {
    tipo: (movimiento.tipo || "").toLowerCase() === "ingreso" ? "ingreso" : "egreso",
    monto: Number(movimiento.monto) || 0,
    descripcion: movimiento.descripcion || "",
    centroCosto: movimiento.centroCosto || "",
    fecha: fechaFinal, // Firestore lo serializa como Timestamp
    usuario: movimiento.usuario || "",
    comprobanteUrl: movimiento.comprobanteUrl || null,
    creadoEn: serverTimestamp(),
    caja,
  };

  await addDoc(colRef, payload);
};

/**
 * Actualiza parcialmente un movimiento (opcional).
 */
export const actualizarMovimientoCaja = async (caja, movimientoId, patch) => {
  validarCaja(caja);
  if (!movimientoId) throw new Error("movimientoId requerido");
  const refDoc = doc(db, ROOT, caja, "movimientos", movimientoId);
  await updateDoc(refDoc, patch || {});
};

/**
 * Elimina un movimiento por ID.
 */
export const eliminarMovimientoCaja = async (caja, movimientoId) => {
  validarCaja(caja);
  if (!movimientoId) throw new Error("movimientoId requerido");
  const refDoc = doc(db, ROOT, caja, "movimientos", movimientoId);
  await deleteDoc(refDoc);
};

// -----------------------------------------------------------------------------
// Firestore: obtener movimientos por caja / todas
// -----------------------------------------------------------------------------
/**
 * Obtiene los movimientos de UNA caja, ordenados por fecha desc.
 * @param {string} caja
 * @param {{desde?: string, hasta?: string}} [opts] Fechas "yyyy-mm-dd" (filtro client-side)
 */
export const obtenerMovimientosCaja = async (caja, opts = {}) => {
  validarCaja(caja);
  const qRef = query(collection(db, ROOT, caja, "movimientos"), orderBy("fecha", "desc"));
  const snapshot = await getDocs(qRef);

  let list = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
    caja,
  }));

  // Filtro client-side por rango de fechas si viene {desde, hasta}
  const dDesde = dateFromYMD(opts.desde);
  const dHasta = dateFromYMD(opts.hasta);
  if (dDesde || dHasta) {
    list = list.filter((m) => {
      const f = m.fecha?.toDate ? m.fecha.toDate() : new Date(m.fecha);
      const t = f?.getTime?.() || 0;
      const okDesde = dDesde ? t >= dDesde.getTime() : true;
      const okHasta = dHasta ? t <= dHasta.getTime() + 24 * 60 * 60 * 1000 - 1 : true; // inclusivo
      return okDesde && okHasta;
    });
  }

  return list;
};

/**
 * Obtiene los movimientos de TODAS las cajas, combinados y ordenados por fecha desc.
 * @param {{desde?: string, hasta?: string}} [opts]
 */
export const obtenerMovimientosTodas = async (opts = {}) => {
  const listados = await Promise.all(CAJAS_KEYS.map((k) => obtenerMovimientosCaja(k, opts)));
  const all = listados.flat();

  all.sort((a, b) => {
    const toDate = (v) => (v?.toDate ? v.toDate() : new Date(v));
    const fa = toDate(a.fecha);
    const fb = toDate(b.fecha);
    return (fb?.getTime?.() || 0) - (fa?.getTime?.() || 0); // desc
  });

  return all;
};

// -----------------------------------------------------------------------------
// Utilidad: resumen
// -----------------------------------------------------------------------------
/**
 * Calcula totales de ingresos, egresos y saldo.
 */
export const calcularResumen = (movimientos) => {
  const ingresos = (movimientos || [])
    .filter((m) => (m?.tipo || "").toLowerCase() === "ingreso")
    .reduce((acc, m) => acc + Number(m?.monto || 0), 0);

  const egresos = (movimientos || [])
    .filter((m) => (m?.tipo || "").toLowerCase() === "egreso")
    .reduce((acc, m) => acc + Number(m?.monto || 0), 0);

  return { ingresos, egresos, saldo: ingresos - egresos };
};
