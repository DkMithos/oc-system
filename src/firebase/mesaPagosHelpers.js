// src/firebase/mesaPagosHelpers.js
// Helpers para la Mesa de Pagos: scoring de prioridad, sesiones de pago,
// compromisos activos y campos extendidos de transacciones.

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
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { obtenerTransaccionesFinancieras } from "./finanzasHelpers";

const COL_SESIONES = "sesionesPago";
const COL_TRANSACCIONES = "transaccionesFinancieras";

// ── Campos extendidos de transacción para Mesa de Pagos ──
// Estos campos se agregan a las transacciones existentes:
//   presion:          "baja" | "media" | "alta" | "critica"
//   importancia:      "baja" | "media" | "alta"
//   compromiso_fecha: string ISO "YYYY-MM-DD" (fecha prometida de pago)
//   compromiso_nota:  string (observación del compromiso)
//   compromiso_estado: "pendiente" | "cumplido" | "incumplido"
//   mesa_discutido:   boolean (fue discutido en sesión de mesa)
//   mesa_sesionId:    string (ID de la sesión donde se discutió)
//   mesa_decision:    string (decisión tomada en mesa)
//   prioridad_score:  number (calculado automáticamente)

// ── Constantes de scoring ──
const PESO_DIAS_VENCIDO = 3;     // puntos por día vencido
const PESO_MONTO = 0.001;        // puntos por cada S/ 1,000
const PESO_PRESION = { baja: 0, media: 10, alta: 25, critica: 50 };
const PESO_IMPORTANCIA = { baja: 0, media: 5, alta: 15 };
const PESO_COMPROMISO_PROX = 20; // bonus si compromiso vence en <=3 días
const PESO_COMPROMISO_VENCIDO = 30; // bonus si compromiso ya venció

/**
 * Calcula el score de prioridad de una transacción.
 * Mayor score = mayor urgencia de pago.
 * @param {Object} t - Transacción enriquecida
 * @returns {number} Score de prioridad
 */
export function calcularPrioridadScore(t) {
  let score = 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // 1. Días vencido (programado_fecha < hoy y estado pendiente)
  if (t.programado_fechaISO || t.programado_fecha) {
    const fechaProg = new Date((t.programado_fechaISO || t.programado_fecha) + "T00:00:00");
    if (!isNaN(fechaProg.getTime())) {
      const diasDiff = Math.floor((hoy - fechaProg) / 86400000);
      if (diasDiff > 0) {
        score += diasDiff * PESO_DIAS_VENCIDO;
      }
    }
  }

  // 2. Monto (en PEN)
  const monto = Number(t.monto_total_pen ?? t.monto_total ?? 0);
  score += (monto / 1000) * PESO_MONTO * 1000; // simplifica a monto * 0.001

  // 3. Presión del proveedor
  const presion = (t.presion || "baja").toLowerCase();
  score += PESO_PRESION[presion] || 0;

  // 4. Importancia estratégica
  const importancia = (t.importancia || "baja").toLowerCase();
  score += PESO_IMPORTANCIA[importancia] || 0;

  // 5. Compromiso de pago próximo a vencer
  if (t.compromiso_fecha && t.compromiso_estado !== "cumplido") {
    const fechaComp = new Date(t.compromiso_fecha + "T00:00:00");
    if (!isNaN(fechaComp.getTime())) {
      const diasComp = Math.floor((fechaComp - hoy) / 86400000);
      if (diasComp < 0) {
        score += PESO_COMPROMISO_VENCIDO; // compromiso incumplido
      } else if (diasComp <= 3) {
        score += PESO_COMPROMISO_PROX; // compromiso próximo
      }
    }
  }

  return Math.round(score * 10) / 10;
}

/**
 * Obtener transacciones pendientes de pago con scoring.
 * Filtra solo EGRESOS con estado "Pendiente" o "Vencido".
 * @param {Object} filtros
 * @returns {Array} Transacciones ordenadas por prioridad (mayor primero)
 */
export async function obtenerTransaccionesMesaPagos(filtros = {}) {
  const { area, fechaDesde, fechaHasta } = filtros;

  const { transacciones = [] } = await obtenerTransaccionesFinancieras({
    fechaDesde: fechaDesde || null,
    fechaHasta: fechaHasta || null,
    tipo: "EGRESO",
    estado: null, // traemos todo y filtramos en cliente
    pageSize: 5000,
  });

  // Filtrar solo pendientes/vencidos
  const pendientes = transacciones.filter((t) => {
    const est = (t.estado || "").toLowerCase();
    if (est !== "pendiente" && est !== "vencido" && est !== "programado") return false;
    if (area && t.area !== area) return false;
    return true;
  });

  // Calcular score y enriquecer
  const conScore = pendientes.map((t) => {
    const score = calcularPrioridadScore(t);
    // Determinar si está vencido
    let vencido = false;
    if (t.programado_fechaISO) {
      const fechaProg = new Date(t.programado_fechaISO + "T00:00:00");
      vencido = !isNaN(fechaProg.getTime()) && fechaProg < new Date();
    }
    return {
      ...t,
      prioridad_score: score,
      vencido,
      diasVencido: vencido
        ? Math.floor((Date.now() - new Date(t.programado_fechaISO + "T00:00:00").getTime()) / 86400000)
        : 0,
    };
  });

  // Ordenar por score desc
  conScore.sort((a, b) => b.prioridad_score - a.prioridad_score);

  return conScore;
}

// ── Sesiones de pago ──

/**
 * Crear una nueva sesión de mesa de pagos.
 */
export async function crearSesionPago({ titulo, participantes, creadoPorEmail }) {
  const ref = await addDoc(collection(db, COL_SESIONES), {
    titulo: titulo || `Mesa de Pagos — ${new Date().toLocaleDateString("es-PE")}`,
    participantes: participantes || [],
    creadoPorEmail,
    estado: "activa",
    transaccionesDiscutidas: [],
    decisiones: [],
    creadoEn: serverTimestamp(),
    finalizadoEn: null,
  });
  return ref.id;
}

/**
 * Obtener sesiones de pago recientes.
 */
export async function obtenerSesionesPago(maxResultados = 20) {
  const q = query(
    collection(db, COL_SESIONES),
    orderBy("creadoEn", "desc"),
    limit(maxResultados)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Obtener una sesión específica.
 */
export async function obtenerSesionPago(sesionId) {
  const ref = doc(db, COL_SESIONES, sesionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Registrar decisión en una sesión y actualizar la transacción.
 */
export async function registrarDecisionMesa(sesionId, transaccionId, decision) {
  const {
    compromiso_fecha,
    compromiso_nota,
    presion,
    importancia,
    mesa_decision,
  } = decision;

  // Actualizar transacción con campos de mesa
  const txRef = doc(db, COL_TRANSACCIONES, transaccionId);
  const updates = {
    mesa_discutido: true,
    mesa_sesionId: sesionId,
    mesa_decision: mesa_decision || "",
    actualizadoEn: serverTimestamp(),
  };
  if (compromiso_fecha) {
    updates.compromiso_fecha = compromiso_fecha;
    updates.compromiso_nota = compromiso_nota || "";
    updates.compromiso_estado = "pendiente";
  }
  if (presion) updates.presion = presion;
  if (importancia) updates.importancia = importancia;

  // Recalcular score
  const snap = await getDoc(txRef);
  if (snap.exists()) {
    const merged = { ...snap.data(), ...updates };
    updates.prioridad_score = calcularPrioridadScore(merged);
  }

  await updateDoc(txRef, updates);

  // Agregar decisión a la sesión
  const sesRef = doc(db, COL_SESIONES, sesionId);
  const sesSnap = await getDoc(sesRef);
  if (sesSnap.exists()) {
    const sesData = sesSnap.data();
    const decisiones = [...(sesData.decisiones || []), {
      transaccionId,
      ...decision,
      fecha: new Date().toISOString(),
    }];
    const discutidas = [...new Set([...(sesData.transaccionesDiscutidas || []), transaccionId])];
    await updateDoc(sesRef, {
      decisiones,
      transaccionesDiscutidas: discutidas,
    });
  }
}

/**
 * Finalizar una sesión de pago.
 */
export async function finalizarSesionPago(sesionId) {
  const ref = doc(db, COL_SESIONES, sesionId);
  await updateDoc(ref, {
    estado: "finalizada",
    finalizadoEn: serverTimestamp(),
  });
}

// ── Compromisos ──

/**
 * Obtener compromisos activos (transacciones con compromiso_fecha y compromiso_estado != cumplido).
 */
export async function obtenerCompromisosActivos() {
  // Query por compromiso_estado = "pendiente"
  const q = query(
    collection(db, COL_TRANSACCIONES),
    where("compromiso_estado", "==", "pendiente")
  );
  const snap = await getDocs(q);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return snap.docs
    .map((d) => {
      const data = d.data();
      const fechaComp = data.compromiso_fecha ? new Date(data.compromiso_fecha + "T00:00:00") : null;
      const diasRestantes = fechaComp ? Math.ceil((fechaComp - hoy) / 86400000) : null;

      return {
        id: d.id,
        ...data,
        diasRestantes,
        vencido: diasRestantes !== null && diasRestantes < 0,
        proximoVencer: diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3,
      };
    })
    .sort((a, b) => (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999));
}

/**
 * Marcar compromiso como cumplido.
 */
export async function cumplirCompromiso(transaccionId) {
  const ref = doc(db, COL_TRANSACCIONES, transaccionId);
  await updateDoc(ref, {
    compromiso_estado: "cumplido",
    actualizadoEn: serverTimestamp(),
  });
}

/**
 * Marcar compromiso como incumplido.
 */
export async function incumplirCompromiso(transaccionId, nota = "") {
  const ref = doc(db, COL_TRANSACCIONES, transaccionId);
  await updateDoc(ref, {
    compromiso_estado: "incumplido",
    compromiso_nota_incumplimiento: nota,
    actualizadoEn: serverTimestamp(),
  });
}
