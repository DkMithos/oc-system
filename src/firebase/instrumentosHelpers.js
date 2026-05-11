// src/firebase/instrumentosHelpers.js
// Helpers para instrumentos financieros (CIPRL, cartas fianza, etc.)
// Colección: instrumentosFinancieros

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
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "./config";

const COL = "instrumentosFinancieros";

// ── Tipos de instrumento ──
export const TIPOS_INSTRUMENTO = [
  { id: "ciprl", nombre: "CIPRL" },
  { id: "carta_fianza", nombre: "Carta Fianza" },
  { id: "otro", nombre: "Otro" },
];

/**
 * Obtener todos los instrumentos financieros, opcionalmente filtrados.
 * @param {{ tipo?: string, estado?: string }} filtros
 * @returns {Promise<Array>}
 */
export async function obtenerInstrumentos(filtros = {}) {
  const constraints = [orderBy("creadoEn", "desc")];
  if (filtros.tipo) constraints.unshift(where("tipo", "==", filtros.tipo));
  if (filtros.estado) constraints.unshift(where("estado", "==", filtros.estado));

  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Obtener un instrumento por ID.
 */
export async function obtenerInstrumento(id) {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Crear un nuevo instrumento financiero.
 * @param {Object} datos
 * @param {string} datos.tipo - ciprl | carta_fianza | otro
 * @param {string} datos.codigo - Código/número del instrumento
 * @param {string} datos.descripcion
 * @param {number} datos.monto_total - Monto total del instrumento
 * @param {string} datos.moneda - PEN | USD
 * @param {string} [datos.entidad_emisora] - Entidad que emite (gobierno regional, banco, etc.)
 * @param {string} [datos.fecha_emision] - ISO YYYY-MM-DD
 * @param {string} [datos.fecha_vencimiento] - ISO YYYY-MM-DD
 * @param {string} [datos.proyecto] - Proyecto asociado
 * @param {string} [datos.notas]
 * @param {string} email - Email del usuario que crea
 * @returns {Promise<string>} ID del documento creado
 */
export async function crearInstrumento(datos, email) {
  const nuevo = {
    tipo: datos.tipo || "ciprl",
    codigo: datos.codigo || "",
    descripcion: datos.descripcion || "",
    monto_total: Number(datos.monto_total) || 0,
    monto_utilizado: 0,
    saldo: Number(datos.monto_total) || 0,
    moneda: datos.moneda || "PEN",
    entidad_emisora: datos.entidad_emisora || "",
    fecha_emision: datos.fecha_emision || "",
    fecha_vencimiento: datos.fecha_vencimiento || "",
    proyecto: datos.proyecto || "",
    notas: datos.notas || "",
    estado: "activo", // activo | agotado | vencido | anulado
    movimientos: [],
    creadoPor: email,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COL), nuevo);
  return ref.id;
}

/**
 * Registrar un uso/movimiento del instrumento (reduce saldo).
 * Usa runTransaction para atomicidad.
 * @param {string} instrumentoId
 * @param {Object} movimiento
 * @param {number} movimiento.monto - Monto a descontar
 * @param {string} movimiento.concepto - Descripción del uso
 * @param {string} [movimiento.transaccionId] - ID de transacción financiera asociada
 * @param {string} [movimiento.referencia] - Referencia externa
 * @param {string} email - Email del usuario
 */
export async function registrarUsoInstrumento(instrumentoId, movimiento, email) {
  const ref = doc(db, COL, instrumentoId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Instrumento no encontrado");
    const data = snap.data();

    if (data.estado !== "activo") {
      throw new Error(`Instrumento no está activo (estado: ${data.estado})`);
    }

    const monto = Number(movimiento.monto) || 0;
    if (monto <= 0) throw new Error("Monto debe ser mayor a 0");
    if (monto > data.saldo) {
      throw new Error(`Saldo insuficiente. Disponible: ${data.saldo}, solicitado: ${monto}`);
    }

    const nuevoSaldo = data.saldo - monto;
    const nuevoUtilizado = (data.monto_utilizado || 0) + monto;
    const nuevoMov = {
      fecha: new Date().toISOString(),
      tipo: "uso",
      monto,
      concepto: movimiento.concepto || "",
      transaccionId: movimiento.transaccionId || "",
      referencia: movimiento.referencia || "",
      registradoPor: email,
    };

    const movimientos = [...(data.movimientos || []), nuevoMov];
    const nuevoEstado = nuevoSaldo <= 0 ? "agotado" : "activo";

    tx.update(ref, {
      saldo: nuevoSaldo,
      monto_utilizado: nuevoUtilizado,
      estado: nuevoEstado,
      movimientos,
      actualizadoEn: serverTimestamp(),
    });
  });
}

/**
 * Registrar un abono/recarga al instrumento (aumenta saldo).
 */
export async function registrarAbonoInstrumento(instrumentoId, movimiento, email) {
  const ref = doc(db, COL, instrumentoId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Instrumento no encontrado");
    const data = snap.data();

    const monto = Number(movimiento.monto) || 0;
    if (monto <= 0) throw new Error("Monto debe ser mayor a 0");

    const nuevoSaldo = (data.saldo || 0) + monto;
    const nuevoMov = {
      fecha: new Date().toISOString(),
      tipo: "abono",
      monto,
      concepto: movimiento.concepto || "",
      referencia: movimiento.referencia || "",
      registradoPor: email,
    };

    const movimientos = [...(data.movimientos || []), nuevoMov];

    tx.update(ref, {
      saldo: nuevoSaldo,
      monto_total: (data.monto_total || 0) + monto,
      estado: "activo",
      movimientos,
      actualizadoEn: serverTimestamp(),
    });
  });
}

/**
 * Actualizar datos generales del instrumento (no financieros).
 */
export async function actualizarInstrumento(id, datos) {
  const ref = doc(db, COL, id);
  await updateDoc(ref, {
    ...datos,
    actualizadoEn: serverTimestamp(),
  });
}

/**
 * Anular un instrumento (soft delete).
 */
export async function anularInstrumento(id, motivo, email) {
  const ref = doc(db, COL, id);
  await updateDoc(ref, {
    estado: "anulado",
    motivo_anulacion: motivo || "",
    anulado_por: email,
    anulado_en: new Date().toISOString(),
    actualizadoEn: serverTimestamp(),
  });
}

/**
 * Obtener instrumentos activos con saldo > 0 (para selector en Mesa de Pagos).
 * @param {string} [tipo] - Filtrar por tipo (ej: "ciprl")
 * @returns {Promise<Array>}
 */
export async function obtenerInstrumentosConSaldo(tipo) {
  const constraints = [
    where("estado", "==", "activo"),
    orderBy("creadoEn", "desc"),
  ];
  if (tipo) constraints.unshift(where("tipo", "==", tipo));

  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((i) => i.saldo > 0);
}
