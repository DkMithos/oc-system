// src/firebase/finanzasHelpers.js
// Helper de Flujos Financieros – 100% parametrizable, sin IGV ni reglas hardcodeadas

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./config";

// ─────────────────────────────────────────────────────────────
// Constantes de dominio (usadas en todo el sistema)
// ─────────────────────────────────────────────────────────────

export const TIPO_TRANSACCION = {
  INGRESO: "INGRESO",
  EGRESO: "EGRESO",
};

export const CLASIFICACION_TRANSACCION = {
  OPEX: "OPEX",
  CAPEX: "CAPEX",
};

// Colecciones principales (si cambian, se cambian aquí, no en el código)
const COL_TRANSACCIONES = "transaccionesFinancieras";
const COL_IGV = "igvCodigosFinanzas";
const COL_CATEGORIAS = "categoriasFinanzas";
const COL_SUBCATEGORIAS = "subcategoriasFinanzas";
const COL_FORMAS_PAGO = "formasPagoFinanzas";
const COL_ESTADOS = "estadosFinanzas";
const COL_TIPOS_DOC = "tiposDocumentoFinanzas";
const COL_PROYECTOS = "proyectos";
const COL_DETRACCIONES = "detraccionesSunat";

// Si luego quieres mover Proveedores/CC a otros helpers, basta con borrar estos usos.
const COL_PROVEEDORES = "proveedores";
const COL_CENTROS_COSTO = "centrosCosto";
const COL_ORDENES_COMPRA = "ordenesCompra";

// ─────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────

function mapDoc(d) {
  return { id: d.id, ...d.data() };
}

function normalizarFecha(value) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  // string "YYYY-MM-DD"
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Timestamp.fromDate(d);
}

function fechaToISO(value) {
  if (!value) return "";
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    // Asumimos que viene como "YYYY-MM-DD" o ISO
    return value.slice(0, 10);
  }
  return "";
}

/**
 * Enriquecer una transacción leída de Firestore con campos derivados:
 * - fechaISO, programado_fechaISO
 * - monto_total_pen (según moneda y tc)
 */
function enriquecerTransaccion(data, id) {
  const fechaISO = fechaToISO(data.fecha);
  const programado_fechaISO = fechaToISO(data.programado_fecha);

  // Monto total en su moneda
  const montoTotal = Number(
    data.monto_total != null ? data.monto_total : data.monto_sin_igv || 0
  );

  let montoTotalPen = montoTotal;
  if (data.moneda && data.moneda !== "PEN") {
    const tc = Number(data.tc || 0);
    if (tc > 0) {
      montoTotalPen = montoTotal * tc;
    }
  }

  return {
    id,
    ...data,
    fechaISO,
    programado_fechaISO,
    monto_total_pen: +montoTotalPen.toFixed(2),
  };
}

// ─────────────────────────────────────────────────────────────
// Catálogos financieros
// ─────────────────────────────────────────────────────────────

export async function obtenerIgvCodigos() {
  const snap = await getDocs(collection(db, COL_IGV));
  return snap.docs.map(mapDoc);
}

export async function obtenerCategoriasFinanzas() {
  const snap = await getDocs(collection(db, COL_CATEGORIAS));
  return snap.docs.map(mapDoc);
}

export async function obtenerSubcategoriasFinanzas() {
  const snap = await getDocs(collection(db, COL_SUBCATEGORIAS));
  return snap.docs.map(mapDoc);
}

export async function obtenerFormasPagoFinanzas() {
  const snap = await getDocs(collection(db, COL_FORMAS_PAGO));
  return snap.docs.map(mapDoc);
}

export async function obtenerEstadosFinanzas() {
  const snap = await getDocs(collection(db, COL_ESTADOS));
  return snap.docs.map(mapDoc);
}

export async function obtenerTiposDocumentoFinanzasActivos() {
  const snap = await getDocs(collection(db, COL_TIPOS_DOC));
  return snap.docs
    .map(mapDoc)
    .filter((x) => x.activo !== false)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

export async function obtenerProyectosActivos() {
  const q = query(
    collection(db, COL_PROYECTOS),
    where("estado", "==", "Activo")
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
}

/**
 * Catálogo combinado para uso en FlujosFinancieros.jsx
 */
export async function obtenerCatalogosFinanzas() {
  const [igv, categorias, subcategorias, formasPago, estados] =
    await Promise.all([
      obtenerIgvCodigos(),
      obtenerCategoriasFinanzas(),
      obtenerSubcategoriasFinanzas(),
      obtenerFormasPagoFinanzas(),
      obtenerEstadosFinanzas(),
    ]);

  const [tiposDocumento, proyectos] = await Promise.all([
    obtenerTiposDocumentoFinanzasActivos(),
    obtenerProyectosActivos(),
  ]);

  return {
    igv,
    categorias,
    subcategorias,
    formasPago,
    estados,
    tiposDocumento,
    proyectos,
  };
}

// ─────────────────────────────────────────────────────────────
// Proveedores / Centros de costo / OCs (modo ligero)
// ─────────────────────────────────────────────────────────────

export async function obtenerProveedoresLigero() {
  const snap = await getDocs(collection(db, COL_PROVEEDORES));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ruc: data.ruc || "",
      razonSocial: data.razonSocial || "",
      estado: data.estado || "",
      ...data,
    };
  });
}

export async function obtenerCentrosCostoLigero() {
  const snap = await getDocs(collection(db, COL_CENTROS_COSTO));
  return snap.docs.map(mapDoc);
}

/**
 * Buscar OCs por número/correlativo (para autocompletar).
 * queryText: texto que ingresa el usuario, ej: "MM-0001"
 */
export async function buscarOrdenesCompraPorNumero(queryText, maxResultados = 10) {
  if (!queryText) return [];

  // Si ya tienes un campo "numero" o "correlativoOC", ajusta aquí:
  const colRef = collection(db, COL_ORDENES_COMPRA);

  // Firestore no soporta "contains" directo; normalmente se soluciona con un campo auxiliar
  // en minúsculas o un índice de búsqueda. Como base, hacemos una igualdad exacta:
  const qExact = query(colRef, where("numero", "==", queryText), limit(maxResultados));
  const snapExact = await getDocs(qExact);

  const resultados = snapExact.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      numero: data.numero || data.correlativo || "",
      proveedorRuc: data.proveedor?.ruc || "",
      proveedorNombre: data.proveedor?.razonSocial || "",
      centroCostoId: data.centroCostoId || data.centro_costo_id || "",
      centroCostoNombre:
        data.centroCostoNombre || data.centro_costo_nombre || "",
      proyectoId: data.proyectoId || "",
      proyectoNombre: data.proyectoNombre || "",
      moneda: data.moneda || "",
      total: data.resumen?.total || 0,
      estado: data.estado || "",
      ...data,
    };
  });

  return resultados;
}

// ─────────────────────────────────────────────────────────────
// Detracciones SUNAT
// ─────────────────────────────────────────────────────────────

export async function buscarDetraccionPorCodigo(codigo) {
  if (!codigo) return null;

  const qDet = query(
    collection(db, COL_DETRACCIONES),
    where("codigo", "==", codigo),
    where("vigente", "==", true),
    limit(1)
  );
  const snap = await getDocs(qDet);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ─────────────────────────────────────────────────────────────
// CRUD de transacciones financieras
// ─────────────────────────────────────────────────────────────

/**
 * Obtener código de IGV (desde catálogo) -> retorna doc o null
 */
async function obtenerIgvPorCodigo(igvCodigo) {
  if (!igvCodigo) return null;
  const qIgv = query(
    collection(db, COL_IGV),
    where("codigo", "==", igvCodigo),
    where("activo", "==", true),
    limit(1)
  );
  const snap = await getDocs(qIgv);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Normaliza y calcula derivados:
 * - fecha, programado_fecha a Timestamp
 * - igv, monto_total según código IGV (si aplica)
 */
async function prepararPayloadTransaccion(data) {
  const now = Timestamp.now();

  const payload = { ...data };

  payload.fecha = normalizarFecha(data.fecha) || now;
  payload.programado_fecha = normalizarFecha(data.programado_fecha);

  const base = Number(data.monto_sin_igv || 0);

  // IGV y totales: NADA hardcodeado, se usa catálogo si se pasa igvCodigo
  let igvMonto = data.igv != null ? Number(data.igv) : 0;
  let montoTotal = data.monto_total != null ? Number(data.monto_total) : 0;
  let igvTasa = data.igvTasa != null ? Number(data.igvTasa) : null;

  if (!montoTotal) {
    if (data.igvCodigo) {
      const igvDoc = await obtenerIgvPorCodigo(data.igvCodigo);
      if (igvDoc && igvDoc.tasa != null) {
        igvTasa = Number(igvDoc.tasa);
        igvMonto = +(base * igvTasa).toFixed(2);
        montoTotal = +(base + igvMonto).toFixed(2);
      } else {
        // Si no hay catálogo, usamos lo que venga (si viene)
        igvMonto = Number(data.igv || 0);
        montoTotal = +(base + igvMonto).toFixed(2);
      }
    } else {
      igvMonto = Number(data.igv || 0);
      montoTotal = +(base + igvMonto).toFixed(2);
    }
  }

  payload.monto_sin_igv = +base.toFixed(2);
  payload.igv = +igvMonto.toFixed(2);
  payload.monto_total = +montoTotal.toFixed(2);
  if (igvTasa != null) {
    payload.igvTasa = +igvTasa;
  }

  // Monto en PEN (derivado - útil para KPIs)
  if (payload.moneda === "PEN" || !payload.moneda) {
    payload.monto_total_pen = payload.monto_total;
  } else {
    const tc = Number(payload.tc || 0);
    if (tc > 0) {
      payload.monto_total_pen = +(
        payload.monto_total * tc
      ).toFixed(2);
    }
  }

  // Auditoría si no viene
  if (!payload.creadoEn) payload.creadoEn = now;
  payload.actualizadoEn = now;

  return payload;
}

/**
 * Crear transacción financiera
 * data: objeto que sigue el diccionario Transaccion (sin campos derivados)
 */
export async function crearTransaccionFinanciera(data) {
  const payload = await prepararPayloadTransaccion(data);
  const colRef = collection(db, COL_TRANSACCIONES);
  const docRef = await addDoc(colRef, payload);
  return docRef.id;
}

/**
 * Actualizar una transacción financiera
 */
export async function actualizarTransaccionFinanciera(id, dataParcial) {
  const ref = doc(db, COL_TRANSACCIONES, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Transacción financiera no encontrada");
  }

  const actual = snap.data();
  const merged = { ...actual, ...dataParcial };

  const payload = await prepararPayloadTransaccion(merged);
  await updateDoc(ref, payload);
}

/**
 * Obtener transacciones con filtros básicos
 * filtros:
 *  - fechaDesde, fechaHasta: "YYYY-MM-DD"
 *  - tipo: INGRESO/EGRESO
 *  - estado
 *  - categoriaId
 *  - centro_costo_id
 */
export async function obtenerTransaccionesFinancieras(filtros = {}) {
  const {
    fechaDesde,
    fechaHasta,
    tipo,
    estado,
    categoriaId,
    centro_costo_id,
    pageSize = 200,
    startAfterDoc,
  } = filtros;

  const colRef = collection(db, COL_TRANSACCIONES);
  const condiciones = [];

  // Fechas
  if (fechaDesde) {
    condiciones.push(where("fecha", ">=", normalizarFecha(fechaDesde)));
  }
  if (fechaHasta) {
    // para incluir el día completo, sumamos 1 día a la "hasta"
    const dHasta = new Date(fechaHasta);
    dHasta.setDate(dHasta.getDate() + 1);
    condiciones.push(where("fecha", "<", normalizarFecha(dHasta)));
  }

  if (tipo) {
    condiciones.push(where("tipo", "==", tipo));
  }
  if (estado) {
    condiciones.push(where("estado", "==", estado));
  }
  if (categoriaId) {
    condiciones.push(where("categoriaId", "==", categoriaId));
  }
  if (centro_costo_id) {
    condiciones.push(
      where("centro_costo_id", "==", centro_costo_id)
    );
  }

  let qRef = query(colRef, ...condiciones, orderBy("fecha", "desc"), limit(pageSize));

  if (startAfterDoc) {
    qRef = query(
      colRef,
      ...condiciones,
      orderBy("fecha", "desc"),
      startAfter(startAfterDoc),
      limit(pageSize)
    );
  }

  const snap = await getDocs(qRef);

  const transacciones = snap.docs.map((d) =>
    enriquecerTransaccion(d.data(), d.id)
  );

  const lastVisible = snap.docs[snap.docs.length - 1] || null;

  return {
    transacciones,
    lastVisible,
  };
}

// ─────────────────────────────────────────────────────────────
// Adjuntos
// ─────────────────────────────────────────────────────────────

/**
 * Sube un archivo a Storage para una transacción financiera
 * y devuelve un objeto con la metadata básica:
 *  { url, nombre, tipo, size, creadoEn }
 */
export async function subirAdjuntoFinanzas(file, transaccionId) {
  if (!file || !transaccionId) {
    throw new Error("Archivo o transacción inválidos para adjunto");
  }

  const path = `${COL_TRANSACCIONES}/${transaccionId}/${file.name}`;
  const storageRef = ref(storage, path);

  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);

  return {
    url,
    nombre: file.name,
    tipo: file.type,
    size: file.size,
    creadoEn: Timestamp.now(),
    path,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper: Crear transacción a partir de una factura (Pagos)
// ─────────────────────────────────────────────────────────────

/**
 * Crea una transacción financiera de tipo EGRESO a partir de una factura
 * ligada a una orden de compra.
 *
 * EXPECTATIVAS:
 *  - "orden" viene de ordenesCompra (con proveedor, centro costo, proyecto, moneda, etc.)
 *  - "factura" tiene:
 *      numero, fecha, moneda, montoSinIgv, montoIgv, montoTotal,
 *      aplicaDetraccion, detraccionCodigo, detraccionPorcentaje,
 *      detraccionBase, detraccionMonto, formaPago, tipoDocumento, etc.
 *  - "usuario" es el usuario logueado (uid, email, nombreCompleto)
 *
 * NO se hardcodea nada de negocio (ni 18%, ni 10%, etc.),
 * todo viene desde la factura o los catálogos (IGV, detracciones).
 */
export async function crearTransaccionDesdeFactura({
  orden,
  factura,
  usuario,
  configExtra = {},
}) {
  if (!orden || !factura || !usuario) {
    throw new Error("Faltan datos para crear la transacción desde factura");
  }

  const moneda =
    factura.moneda || orden.moneda || "PEN";

  const tc = factura.tc ?? orden.tc ?? null;

  const montoSinIgv =
    factura.montoSinIgv ??
    factura.monto_sin_igv ??
    orden.montoSinIgv ??
    0;

  const igvCodigo =
    factura.igvCodigo ||
    orden.igvCodigo ||
    configExtra.igvCodigoDefault ||
    null;

  const centroCostoId =
    orden.centro_costo_id || orden.centroCostoId || "";
  const centroCostoNombre =
    orden.centro_costo_nombre ||
    orden.centroCostoNombre ||
    "";

  const proveedorId = orden.proveedor?.ruc || "";
  const proveedorNombre =
    orden.proveedor?.razonSocial ||
    factura.proveedorNombre ||
    "";

  const fechaDocumento =
    factura.fechaEmision ||
    factura.fecha ||
    orden.fecha ||
    new Date();

  const proyectoId = orden.proyectoId || orden.proyecto || "";
  const proyectoNombre = orden.proyectoNombre || "";

  const payload = {
    tipo: TIPO_TRANSACCION.EGRESO,
    clasificacion:
      configExtra.clasificacionDefault ||
      CLASIFICACION_TRANSACCION.OPEX,

    categoriaId: configExtra.categoriaId || null,
    categoriaNombre: configExtra.categoriaNombre || "",
    subcategoriaId: configExtra.subcategoriaId || null,
    subcategoriaNombre: configExtra.subcategoriaNombre || "",

    moneda,
    tc,
    monto_sin_igv: montoSinIgv,

    igvCodigo,

    forma_pago:
      factura.formaPago ||
      configExtra.formaPagoDefault ||
      "",

    proveedor_cliente_id: proveedorId,
    proveedor_cliente_nombre: proveedorNombre,

    centro_costo_id: centroCostoId,
    centro_costo_nombre: centroCostoNombre,

    proyecto_id: proyectoId,
    proyecto_nombre: proyectoNombre,

    documento_tipo:
      factura.tipoDocumento ||
      factura.documento_tipo ||
      "FACTURA",
    documento_numero:
      factura.numero ||
      factura.documento_numero ||
      factura.serieNumero ||
      "",

    oc_id: orden.id || orden.idOC || "",
    oc_numero:
      orden.numero || orden.correlativo || orden.nroOC || "",

    // Estado de la transacción
    estado: configExtra.estadoDefault || "Pagado",

    // Fechas
    fecha: fechaDocumento instanceof Date
      ? fechaDocumento
      : new Date(fechaDocumento),
    programado_fecha: configExtra.programadoFecha || null,

    // Detracción (copiada de la factura)
    aplica_detraccion: !!factura.aplicaDetraccion,
    detraccion_codigo: factura.detraccionCodigo || "",
    detraccion_porcentaje:
      factura.detraccionPorcentaje ?? 0,
    detraccion_base: factura.detraccionBase ?? 0,
    detraccion_monto: factura.detraccionMonto ?? 0,
    detraccion_estado:
      configExtra.detraccionEstadoDefault || "Pendiente",
    detraccion_fecha_deposito: null,

    notas: configExtra.notas || factura.notas || "",

    creadoPor:
      usuario.nombreCompleto ||
      usuario.displayName ||
      usuario.email ||
      "",
    creadoPorUid: usuario.uid || "",
  };

  const id = await crearTransaccionFinanciera({
    ...payload,
    igvCodigo,
  });

  return id;
}
