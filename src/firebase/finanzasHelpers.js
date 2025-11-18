// src/firebase/finanzasHelpers.js
// Helpers para módulo de Flujos Financieros (sin hardcode de listas ni tasas)
// Todas las listas (categorías, subcategorías, IGV, formas de pago, estados)
// deben administrarse desde colecciones maestras en Firestore.

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";

// ─────────────────────────────────────────────────────────────
// Constantes de colecciones (un solo lugar con strings)
// ─────────────────────────────────────────────────────────────
export const TRANSACCIONES_COLLECTION = "transaccionesFinancieras";
export const IGV_COLLECTION = "igvCodigosFinanzas";
export const CATEGORIAS_COLLECTION = "categoriasFinanzas";
export const SUBCATEGORIAS_COLLECTION = "subcategoriasFinanzas";
export const FORMAS_PAGO_COLLECTION = "formasPagoFinanzas";
export const ESTADOS_COLLECTION = "estadosFinancieros";

// Valores de texto estándar reusables en toda la app
export const TIPO_TRANSACCION = {
  INGRESO: "INGRESO",
  EGRESO: "EGRESO",
};

export const CLASIFICACION_TRANSACCION = {
  OPEX: "OPEX",
  CAPEX: "CAPEX",
};

// ─────────────────────────────────────────────────────────────
// Utils internos
// ─────────────────────────────────────────────────────────────

/**
 * Normaliza una fecha (Date, string ISO o Timestamp de Firestore)
 * a un string "YYYY-MM-DD" para facilitar filtros cliente.
 */
function toISODateString(fecha) {
  if (!fecha) return null;
  try {
    if (typeof fecha === "string") {
      return fecha.slice(0, 10);
    }
    if (fecha.toDate) {
      // Timestamp de Firestore
      return fecha.toDate().toISOString().slice(0, 10);
    }
    if (fecha instanceof Date) {
      return fecha.toISOString().slice(0, 10);
    }
    return null;
  } catch (e) {
    console.error("Error normalizando fecha", e);
    return null;
  }
}

/**
 * Devuelve { anio, mes, yyyymm } a partir de una Date/string/Timestamp
 */
function buildFechaDerivada(fecha) {
  const iso = toISODateString(fecha);
  if (!iso) return { anio: null, mes: null, yyyymm: null };
  const [yearStr, monthStr] = iso.split("-");
  const anio = Number(yearStr);
  const mes = Number(monthStr);
  const yyyymm = `${yearStr}-${monthStr}`;
  return { anio, mes, yyyymm };
}

/**
 * Calcula igv y total a partir de monto_sin_igv y tasa
 */
function calcularMontosDesdeBase(montoSinIgv, tasa) {
  const base = Number(montoSinIgv || 0);
  const t = Number(tasa || 0);
  const igv = +(base * t).toFixed(2);
  const monto_total = +(base + igv).toFixed(2);
  return { igv, monto_total };
}

/**
 * Calcula monto_total_pen en base a moneda, monto_total y tc.
 * Si no se pasa tc, se asume 1 cuando la moneda es PEN y null en otros casos.
 */
function calcularTotalPEN({ moneda, monto_total, tc }) {
  const total = Number(monto_total || 0);
  if (!moneda || moneda === "PEN") {
    return +total.toFixed(2);
  }
  const tasa = tc != null ? Number(tc) : null;
  if (tasa == null || !Number.isFinite(tasa) || tasa <= 0) {
    // Se deja en null si no hay tc válido; se podrá completar luego.
    return null;
  }
  return +(total * tasa).toFixed(2);
}

// ─────────────────────────────────────────────────────────────
// Carga de catálogos (para Selects, Admin, etc.)
// ─────────────────────────────────────────────────────────────

async function obtenerColeccionComoLista(nombreColeccion) {
  const colRef = collection(db, nombreColeccion);
  const q = query(colRef, orderBy("orden", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Devuelve todos los catálogos necesarios para el módulo financiero.
 * Las colecciones deben existir y poblarse desde el panel administrativo.
 *
 * Colecciones esperadas:
 *  - igvCodigosFinanzas: { codigo, nombre, tasa, orden }
 *  - categoriasFinanzas: { nombre, igvCodigoDefault?, orden }
 *  - subcategoriasFinanzas: { nombre, categoriaId, igvCodigoDefault?, orden }
 *  - formasPagoFinanzas: { nombre, orden }
 *  - estadosFinancieros: { nombre, orden }
 */
export async function obtenerCatalogosFinanzas() {
  const [
    igv,
    categorias,
    subcategorias,
    formasPago,
    estados,
  ] = await Promise.all([
    obtenerColeccionComoLista(IGV_COLLECTION),
    obtenerColeccionComoLista(CATEGORIAS_COLLECTION),
    obtenerColeccionComoLista(SUBCATEGORIAS_COLLECTION),
    obtenerColeccionComoLista(FORMAS_PAGO_COLLECTION),
    obtenerColeccionComoLista(ESTADOS_COLLECTION),
  ]);

  return {
    igv,
    categorias,
    subcategorias,
    formasPago,
    estados,
  };
}

/**
 * Busca un código de IGV por id/código y devuelve su tasa.
 * Los documentos en IGV_COLLECTION deben tener { codigo, tasa }.
 */
export async function obtenerIgvPorCodigo(codigo) {
  if (!codigo) return null;
  const colRef = collection(db, IGV_COLLECTION);
  const q = query(colRef, where("codigo", "==", codigo));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docData = snap.docs[0].data();
  return { id: snap.docs[0].id, ...docData };
}

// ─────────────────────────────────────────────────────────────
// CRUD de Transacciones
// ─────────────────────────────────────────────────────────────

/**
 * Prepara el payload final a guardar en Firestore, agregando derivados:
 * - fechaISO, anio, mes, yyyymm
 * - programado_fechaISO
 * - monto_total_pen
 * - signo (1 ingreso, -1 egreso)
 */
function prepararTransaccionParaGuardar(input, opciones = {}) {
  const {
    calcularMontos = true,
    tasaIgv,
  } = opciones;

  const ahora = serverTimestamp();

  const {
    fecha,
    programado_fecha,
    tipo,
    moneda,
    tc,
    monto_sin_igv,
    igv: igvInput,
    monto_total: totalInput,
  } = input;

  const fechaISO = toISODateString(fecha || new Date());
  const { anio, mes, yyyymm } = buildFechaDerivada(fecha || new Date());
  const programado_fechaISO = programado_fecha
    ? toISODateString(programado_fecha)
    : null;

  let igv = igvInput;
  let monto_total = totalInput;

  if (calcularMontos) {
    const tasa =
      tasaIgv != null
        ? tasaIgv
        : input.igvTasa != null
        ? input.igvTasa
        : null;

    if (tasa != null) {
      const res = calcularMontosDesdeBase(monto_sin_igv, tasa);
      igv = res.igv;
      monto_total = res.monto_total;
    }
  }

  const monto_total_pen = calcularTotalPEN({ moneda, monto_total, tc });

  const signo =
    tipo === TIPO_TRANSACCION.INGRESO
      ? 1
      : tipo === TIPO_TRANSACCION.EGRESO
      ? -1
      : null;

  return {
    ...input,
    fecha,
    programado_fecha: programado_fecha || null,
    fechaISO,
    programado_fechaISO,
    anio,
    mes,
    yyyymm,
    igv,
    monto_total,
    monto_total_pen,
    signo,
    creadoEn: input.creadoEn || ahora,
    editadoEn: ahora,
  };
}

/**
 * Crea una nueva transacción financiera.
 * Espera que las listas (tipo, clasificacion, categoriaId, etc.) ya estén validadas en el frontend.
 * Si se quiere calcular IGV automáticamente, se debe pasar:
 *  - igvCodigo OR igvTasa
 */
export async function crearTransaccionFinanciera({
  igvCodigo,
  igvTasa,
  ...resto
}) {
  let tasa = igvTasa != null ? igvTasa : null;

  if (tasa == null && igvCodigo) {
    const igvDoc = await obtenerIgvPorCodigo(igvCodigo);
    if (igvDoc?.tasa != null) {
      tasa = igvDoc.tasa;
    }
  }

  const payload = prepararTransaccionParaGuardar(resto, {
    calcularMontos: true,
    tasaIgv: tasa,
  });

  const colRef = collection(db, TRANSACCIONES_COLLECTION);
  const docRef = await addDoc(colRef, payload);
  return docRef.id;
}

/**
 * Actualiza una transacción existente.
 * Se pueden recalcular montos si cambia el IGV.
 */
export async function actualizarTransaccionFinanciera(
  id,
  { igvCodigo, igvTasa, ...resto },
) {
  if (!id) throw new Error("Falta id de transacción");

  let tasa = igvTasa != null ? igvTasa : null;
  if (tasa == null && igvCodigo) {
    const igvDoc = await obtenerIgvPorCodigo(igvCodigo);
    if (igvDoc?.tasa != null) {
      tasa = igvDoc.tasa;
    }
  }

  const payload = prepararTransaccionParaGuardar(resto, {
    calcularMontos: true,
    tasaIgv: tasa,
  });

  const refDoc = doc(db, TRANSACCIONES_COLLECTION, id);
  await updateDoc(refDoc, payload);
}

/**
 * Obtiene una transacción por id.
 */
export async function obtenerTransaccionPorId(id) {
  if (!id) return null;
  const refDoc = doc(db, TRANSACCIONES_COLLECTION, id);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Obtiene transacciones según filtros simples.
 * Para evitar hardcodear demasiados where, esta función implementa:
 *  - filtro obligatorio por rango de fechas (fechaISO entre desde y hasta)
 *  - filtros opcionales por tipo, estado, centro_costo_id, categoriaId
 */
export async function obtenerTransaccionesFinancieras({
  fechaDesde,
  fechaHasta,
  tipo,
  estado,
  centro_costo_id,
  categoriaId,
}) {
  const colRef = collection(db, TRANSACCIONES_COLLECTION);

  const filtros = [];

  if (fechaDesde) {
    filtros.push(where("fechaISO", ">=", toISODateString(fechaDesde)));
  }
  if (fechaHasta) {
    filtros.push(where("fechaISO", "<=", toISODateString(fechaHasta)));
  }
  if (tipo) {
    filtros.push(where("tipo", "==", tipo));
  }
  if (estado) {
    filtros.push(where("estado", "==", estado));
  }
  if (centro_costo_id) {
    filtros.push(where("centro_costo_id", "==", centro_costo_id));
  }
  if (categoriaId) {
    filtros.push(where("categoriaId", "==", categoriaId));
  }

  // Construimos query dinámicamente
  let q = query(colRef, orderBy("fechaISO", "desc"));
  if (filtros.length) {
    q = query(colRef, ...filtros, orderBy("fechaISO", "desc"));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────
// Adjuntos
// ─────────────────────────────────────────────────────────────

const FINANZAS_STORAGE_BASE = "finanzas";

/**
 * Sube un archivo de comprobante y devuelve { url, path, nombre }.
 * No se hardcodean rutas absolutas, solo el prefijo de módulo.
 */
export async function subirAdjuntoFinanzas(file, transaccionId) {
  if (!file || !transaccionId) {
    throw new Error("Falta archivo o id de transacción");
  }

  const safeName = file.name.replace(/\s+/g, "_");
  const path = `${FINANZAS_STORAGE_BASE}/${transaccionId}/${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path, nombre: file.name };
}
