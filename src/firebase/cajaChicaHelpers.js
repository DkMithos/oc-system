// ✅ src/firebase/cajaChicaHelpers.js
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";

// -----------------------------------------------------------------------------
// Estructura base
// -----------------------------------------------------------------------------
const ROOT = "cajasChicas"; // colección raíz: cajasChicas/{caja}/movimientos
export const CAJAS_KEYS = ["op_proyectos", "operaciones", "administracion"];

// Utilidad para validar la caja
function validarCaja(caja) {
  if (!CAJAS_KEYS.includes(caja)) {
    throw new Error(`Caja inválida: "${caja}". Usa una de: ${CAJAS_KEYS.join(", ")}`);
  }
}

// -----------------------------------------------------------------------------
// Storage: subir comprobante
// -----------------------------------------------------------------------------
/**
 * Sube un comprobante a Storage en una carpeta por caja.
 * @param {'op_proyectos'|'operaciones'|'administracion'} caja
 * @param {File} file
 * @param {string} nombreArchivoBase - sin extensión
 * @returns {Promise<string>} URL de descarga
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
// Firestore: agregar movimiento
// -----------------------------------------------------------------------------
/**
 * Agrega un movimiento a la caja indicada.
 * @param {'op_proyectos'|'operaciones'|'administracion'} caja
 * @param {{
 *  tipo: 'ingreso'|'egreso',
 *  monto: number|string,
 *  descripcion: string,
 *  centroCosto: string,
 *  fecha: string|Date,   // "yyyy-mm-dd" o Date
 *  usuario: string,
 *  comprobanteUrl?: string
 * }} movimiento
 */
export const agregarMovimientoCaja = async (caja, movimiento) => {
  validarCaja(caja);

  // Normaliza fecha
  let fechaFinal;
  if (movimiento.fecha instanceof Date) {
    fechaFinal = movimiento.fecha;
  } else if (typeof movimiento.fecha === "string" && movimiento.fecha) {
    // yyyy-mm-dd -> Date a medianoche local
    const [y, m, d] = movimiento.fecha.split("-").map(Number);
    fechaFinal = new Date(y || 1970, (m || 1) - 1, d || 1);
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
    anulado: false,
    caja, // útil para trazabilidad y reporting
  };

  await addDoc(colRef, payload);
};

// -----------------------------------------------------------------------------
// Firestore: obtener movimientos por caja
// -----------------------------------------------------------------------------
/**
 * Obtiene los movimientos de UNA caja, ordenados por fecha desc.
 * Excluye por defecto los anulados.
 * @param {'op_proyectos'|'operaciones'|'administracion'} caja
 * @param {{ incluirAnulados?: boolean }} [opts]
 * @returns {Promise<Array>}
 */
export const obtenerMovimientosCaja = async (caja, opts = {}) => {
  validarCaja(caja);

  const qRef = query(collection(db, ROOT, caja, "movimientos"), orderBy("fecha", "desc"));
  const snapshot = await getDocs(qRef);

  const incluirAnulados = !!opts.incluirAnulados;

  return snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data(), caja }))
    .filter((m) => (incluirAnulados ? true : !m?.anulado));
};

// -----------------------------------------------------------------------------
// Firestore: obtener movimientos de TODAS las cajas
// -----------------------------------------------------------------------------
/**
 * Obtiene los movimientos de TODAS las cajas, combinados y ordenados por fecha desc.
 * Excluye por defecto los anulados.
 * @param {{ incluirAnulados?: boolean }} [opts]
 * @returns {Promise<Array>}
 */
export const obtenerMovimientosTodas = async (opts = {}) => {
  const incluirAnulados = !!opts.incluirAnulados;

  const listados = await Promise.all(CAJAS_KEYS.map((k) => obtenerMovimientosCaja(k, { incluirAnulados })));
  const all = listados.flat();

  // Ordena por fecha (admite Timestamp o Date)
  all.sort((a, b) => {
    const toDate = (v) => (v?.toDate ? v.toDate() : new Date(v));
    const fa = toDate(a.fecha);
    const fb = toDate(b.fecha);
    return (fb?.getTime?.() || 0) - (fa?.getTime?.() || 0); // desc
  });

  return all;
};

// -----------------------------------------------------------------------------
// Utilidad: calcular resumen
// -----------------------------------------------------------------------------
/**
 * Calcula totales de ingresos, egresos y saldo.
 * @param {Array} movimientos
 * @returns {{ ingresos: number, egresos: number, saldo: number }}
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

// -----------------------------------------------------------------------------
// Soft delete (nada se elimina): marcar como anulado
// -----------------------------------------------------------------------------
/**
 * Marca un movimiento como anulado (soft delete).
 * NO borra el documento; solo setea { anulado: true, anuladoPor, anuladoEn }.
 * @param {'op_proyectos'|'operaciones'|'administracion'} caja
 * @param {string} movimientoId
 * @param {{ anuladoPor?: string, motivo?: string }} [meta]
 */
export const eliminarMovimientoCaja = async (caja, movimientoId, meta = {}) => {
  validarCaja(caja);
  if (!movimientoId) throw new Error("movimientoId requerido");

  const ref = doc(db, ROOT, caja, "movimientos", movimientoId);
  await updateDoc(ref, {
    anulado: true,
    anuladoPor: meta.anuladoPor || null,
    motivoAnulacion: meta.motivo || null,
    anuladoEn: serverTimestamp(),
  });
};
