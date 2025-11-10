import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot,              // ⬅️ realtime
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";

/* ─────────────────────────────────────────────────────────────
 * Colecciones base y helpers
 * ───────────────────────────────────────────────────────────── */
const TIPOS_DOC_COL = collection(db, "tiposDocumento"); // { nombre, activo?:bool, orden?:number }

const cajaDocRef = (cajaId) => doc(db, "cajasChicas", cajaId);
const movsColRef = (cajaId) => collection(db, "cajasChicas", cajaId, "movimientos");

export const CAJAS_IDS = ["operaciones", "administracion", "proyectos"];

/* ─────────────────────────────────────────────────────────────
 * Tipos de Documento
 * ───────────────────────────────────────────────────────────── */
export async function obtenerTiposDocumento() {
  const snap = await getDocs(TIPOS_DOC_COL);
  const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const vivos = lista.filter((x) => x.activo !== false);
  vivos.sort((a, b) => {
    const ao = a.orden ?? 9999;
    const bo = b.orden ?? 9999;
    if (ao !== bo) return ao - bo;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""));
  });

  return vivos;
}

/* ─────────────────────────────────────────────────────────────
 * Subida de archivos (Storage)
 * ───────────────────────────────────────────────────────────── */
const EXT_PERMITIDAS = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function subirArchivoCaja(file, cajaId = "proyectos") {
  if (!file) return { url: "", nombre: "" };
  if (!EXT_PERMITIDAS.includes(file.type)) {
    throw new Error("Formato no permitido. Usa PDF o imagen (JPG/PNG).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Archivo muy pesado. Máximo 10MB.");
  }
  const ts = Date.now();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `caja-chica/${cajaId}/${ts}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, nombre: safeName, path };
}

/* ─────────────────────────────────────────────────────────────
 * Movimientos (crear) — esquema nuevo
 * ─────────────────────────────────────────────────────────────
 * data esperada:
 * {
 *   cajaId, tipo("Ingreso"|"Egreso"), monto, fecha(YYYY-MM-DD),
 *   centroCostoId, centroCostoNombre,
 *   razonSocial, tipoDocumentoId, tipoDocumentoNombre,
 *   comprobante, descripcion,
 *   archivoUrl?, archivoNombre?,
 *   creadoPorEmail
 * }
 */
export async function crearMovimientoCaja(data) {
  const cajaId = data.cajaId || "proyectos";
  const payload = {
    ...data,
    monto: Number(data.monto || 0),
    fechaISO: (data.fecha || "").slice(0, 10), // yyyy-mm-dd
    fechaCreacion: serverTimestamp(),          // útil para auditoría
  };
  delete payload.archivoFile;
  await addDoc(movsColRef(cajaId), payload);
}

/* ─────────────────────────────────────────────────────────────
 * Movimientos (leer) — NORMALIZA docs viejos
 * ───────────────────────────────────────────────────────────── */
function normalizaMovimiento(raw, cajaId) {
  const tipoRaw = String(raw.tipo || "").trim();
  let tipo = tipoRaw.charAt(0).toUpperCase() + tipoRaw.slice(1).toLowerCase();
  if (tipo !== "Ingreso" && tipo !== "Egreso") tipo = raw.tipo || "Ingreso";

  // fechaISO fijo
  let fechaISO = raw.fechaISO;
  if (!fechaISO && raw.fecha?.toDate) {
    try { fechaISO = raw.fecha.toDate().toISOString().slice(0, 10); } catch { fechaISO = ""; }
  }
  if (!fechaISO && typeof raw.fecha === "string") fechaISO = raw.fecha.slice(0, 10);

  const centroCostoNombre = raw.centroCostoNombre || raw.centroCosto || "";
  const tipoDocumentoNombre = raw.tipoDocumentoNombre || raw.tipoDocumento || "";
  const tipoDocumentoId = raw.tipoDocumentoId || "";
  const comprobante = raw.comprobante || raw.nroComprobante || "";
  const descripcion = raw.descripcion || raw.detalle || "";
  const archivoUrl = raw.archivoUrl ?? raw.comprobanteUrl ?? null;
  const archivoNombre = raw.archivoNombre ?? raw.nombreArchivo ?? null;
  const creadoPorEmail = raw.creadoPorEmail || raw.usuario || raw.creadoPor || "";
  const fechaCreacion = raw.fechaCreacion || raw.creadoEn || null;

  return {
    ...raw,
    cajaId,
    tipo,
    fechaISO: fechaISO || "",
    centroCostoNombre,
    tipoDocumentoNombre,
    tipoDocumentoId,
    comprobante,
    descripcion,
    archivoUrl,
    archivoNombre,
    creadoPorEmail,
    fechaCreacion,
  };
}

/* Lectura puntual (una vez) ordenada por fechaISO */
export async function obtenerMovimientosPorCaja(cajaId) {
  const qy = query(movsColRef(cajaId), orderBy("fechaISO", "desc")); // ⬅️ cambio clave
  const snap = await getDocs(qy);
  return snap.docs.map((d) => normalizaMovimiento({ id: d.id, ...d.data() }, cajaId));
}

/* Suscripción en tiempo real */
export function onMovimientosPorCaja(cajaId, callback) {
  const qy = query(movsColRef(cajaId), orderBy("fechaISO", "desc")); // ⬅️ consistente
  return onSnapshot(qy, (snap) => {
    const list = snap.docs.map((d) => normalizaMovimiento({ id: d.id, ...d.data() }, cajaId));
    callback(list);
  });
}

export async function obtenerMovimientosTodas(cajaIds = CAJAS_IDS) {
  const resultados = await Promise.all(
    (cajaIds || []).map((id) =>
      obtenerMovimientosPorCaja(id).then((arr) => (arr || []).map((m) => ({ ...m, cajaId: id })))
    )
  );
  return resultados.flat();
}

/* ─────────────────────────────────────────────────────────────
 * Estado de Caja: cajasChicas/{cajaId}
 * ───────────────────────────────────────────────────────────── */
export async function obtenerEstadoCajaActual(cajaId = "proyectos") {
  const ref = cajaDocRef(cajaId);
  const d = await getDoc(ref);
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() };
}

export async function abrirCaja({ cajaId = "proyectos", saldoInicial = 0, fecha, email }) {
  const ref = cajaDocRef(cajaId);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data()?.abierta) {
    throw new Error("Ya existe una apertura de caja activa.");
  }
  await setDoc(
    ref,
    {
      abierta: true,
      aperturaFecha: (fecha || new Date().toISOString().slice(0, 10)).slice(0, 10),
      aperturaSaldoInicial: Number(saldoInicial || 0),
      aperturaPorEmail: email || "",
      cierreFecha: null,
      cierreSaldoFinal: null,
      cierrePorEmail: null,
    },
    { merge: true }
  );
}

export async function cerrarCaja({ cajaId = "proyectos", saldoFinal = 0, fecha, email }) {
  const ref = cajaDocRef(cajaId);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!data?.abierta) throw new Error("No hay una caja abierta para cerrar.");
  await updateDoc(ref, {
    abierta: false,
    cierreFecha: (fecha || new Date().toISOString().slice(0, 10)).slice(0, 10),
    cierreSaldoFinal: Number(saldoFinal || 0),
    cierrePorEmail: email || "",
  });
}

/* ─────────────────────────────────────────────────────────────
 * Filtro por período (apertura → cierre|hoy)
 * ───────────────────────────────────────────────────────────── */
export function filtrarMovsPorPeriodo(movs, estado) {
  if (!estado?.aperturaFecha) return movs || [];
  const desde = String(estado.aperturaFecha).slice(0, 10);
  const hasta = estado.abierta ? "9999-12-31" : String(estado.cierreFecha || "9999-12-31").slice(0, 10);
  return (movs || []).filter((m) => {
    const f = String(m.fechaISO || "").slice(0, 10);
    return f >= desde && f <= hasta;
  });
}
