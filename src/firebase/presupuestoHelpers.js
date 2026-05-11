// src/firebase/presupuestoHelpers.js
// Helpers para la gestión de presupuestos anuales.
// Colección: presupuestosAnuales/{año}
// Estructura del documento:
// {
//   anio: 2026,
//   partidas: [
//     { area: "operaciones", mes: 1, presupuesto: 50000, moneda: "PEN" },
//     { area: "operaciones", mes: 2, presupuesto: 50000, moneda: "PEN" },
//     ...
//   ],
//   creadoPor: "email",
//   creadoEn: Timestamp,
//   actualizadoEn: Timestamp
// }

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";
import { obtenerTransaccionesFinancieras } from "./finanzasHelpers";

const COLECCION = "presupuestosAnuales";

/**
 * Obtener presupuesto anual.
 * @param {number} anio
 * @returns {Object|null} Documento del presupuesto o null si no existe.
 */
export async function obtenerPresupuestoAnual(anio) {
  const ref = doc(db, COLECCION, String(anio));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Guardar / actualizar presupuesto anual.
 * @param {number} anio
 * @param {Array} partidas - Array de { area, mes, presupuesto, moneda }
 * @param {string} email - Email del usuario que guarda
 */
export async function guardarPresupuestoAnual(anio, partidas, email) {
  const ref = doc(db, COLECCION, String(anio));
  await setDoc(ref, {
    anio,
    partidas,
    creadoPor: email,
    actualizadoEn: serverTimestamp(),
  }, { merge: true });
}

/**
 * Obtener datos consolidados de Presupuesto vs Ejecutado.
 * Combina presupuesto anual con transacciones financieras reales.
 * @param {number} anio
 * @returns {{ partidas, ejecutado, comparativo, resumen }}
 */
export async function obtenerPresupuestoVsEjecutado(anio) {
  // 1) Cargar presupuesto
  const presupuesto = await obtenerPresupuestoAnual(anio);
  const partidas = presupuesto?.partidas || [];

  // 2) Cargar egresos reales del año
  const { transacciones = [] } = await obtenerTransaccionesFinancieras({
    fechaDesde: `${anio}-01-01`,
    fechaHasta: `${anio}-12-31`,
    pageSize: 10000,
  });

  // 3) Agrupar egresos por área + mes
  const ejecutadoMap = {}; // key: "area-mes" → monto acumulado PEN
  const egresosOnly = transacciones.filter(
    (t) => (t.tipo || "").toUpperCase() === "EGRESO"
  );

  egresosOnly.forEach((t) => {
    const area = t.area || "administracion";
    const fechaISO = t.fechaISO || "";
    if (!fechaISO || fechaISO.length < 7) return;
    const mes = parseInt(fechaISO.slice(5, 7), 10);
    if (mes < 1 || mes > 12) return;
    const pen = Number(t.monto_total_pen ?? t.monto_total ?? 0);
    const key = `${area}-${mes}`;
    ejecutadoMap[key] = (ejecutadoMap[key] || 0) + pen;
  });

  // 4) Construir comparativo
  const AREAS = ["administracion", "contabilidad", "operaciones", "ti"];
  const AREA_LABELS = {
    administracion: "Administración",
    contabilidad: "Contabilidad",
    operaciones: "Operaciones",
    ti: "TI",
  };

  // Crear tabla de presupuesto por area-mes
  const presupuestoMap = {};
  partidas.forEach((p) => {
    const key = `${p.area}-${p.mes}`;
    presupuestoMap[key] = (presupuestoMap[key] || 0) + Number(p.presupuesto || 0);
  });

  // Comparativo detallado por área y mes
  const comparativo = [];
  let totalPresupuesto = 0;
  let totalEjecutado = 0;

  AREAS.forEach((area) => {
    for (let mes = 1; mes <= 12; mes++) {
      const key = `${area}-${mes}`;
      const pres = presupuestoMap[key] || 0;
      const ejec = ejecutadoMap[key] || 0;
      const variacion = pres > 0 ? ejec - pres : 0;
      const porcentaje = pres > 0 ? (ejec / pres) * 100 : ejec > 0 ? 999 : 0;

      // Semáforo: verde <100%, amarillo 100-110%, rojo >110%
      let semaforo = "verde";
      if (porcentaje > 110) semaforo = "rojo";
      else if (porcentaje >= 100) semaforo = "amarillo";

      comparativo.push({
        area,
        areaLabel: AREA_LABELS[area] || area,
        mes,
        presupuesto: +pres.toFixed(2),
        ejecutado: +ejec.toFixed(2),
        variacion: +variacion.toFixed(2),
        porcentaje: +porcentaje.toFixed(1),
        semaforo,
      });

      totalPresupuesto += pres;
      totalEjecutado += ejec;
    }
  });

  // Resumen mensual global (para gráfico)
  const resumenMensual = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    let pres = 0;
    let ejec = 0;
    AREAS.forEach((area) => {
      const key = `${area}-${mes}`;
      pres += presupuestoMap[key] || 0;
      ejec += ejecutadoMap[key] || 0;
    });
    return {
      mes,
      presupuesto: +pres.toFixed(2),
      ejecutado: +ejec.toFixed(2),
      variacion: +(ejec - pres).toFixed(2),
    };
  });

  // Resumen por área
  const resumenPorArea = AREAS.map((area) => {
    let pres = 0;
    let ejec = 0;
    for (let mes = 1; mes <= 12; mes++) {
      const key = `${area}-${mes}`;
      pres += presupuestoMap[key] || 0;
      ejec += ejecutadoMap[key] || 0;
    }
    const porcentaje = pres > 0 ? (ejec / pres) * 100 : ejec > 0 ? 999 : 0;
    let semaforo = "verde";
    if (porcentaje > 110) semaforo = "rojo";
    else if (porcentaje >= 100) semaforo = "amarillo";

    return {
      area,
      areaLabel: AREA_LABELS[area] || area,
      presupuesto: +pres.toFixed(2),
      ejecutado: +ejec.toFixed(2),
      variacion: +(ejec - pres).toFixed(2),
      porcentaje: +porcentaje.toFixed(1),
      semaforo,
    };
  });

  const variacionGlobal = totalEjecutado - totalPresupuesto;
  const porcentajeGlobal = totalPresupuesto > 0
    ? (totalEjecutado / totalPresupuesto) * 100
    : totalEjecutado > 0 ? 999 : 0;

  return {
    tienePresupuesto: partidas.length > 0,
    comparativo,
    resumenMensual,
    resumenPorArea,
    resumen: {
      totalPresupuesto: +totalPresupuesto.toFixed(2),
      totalEjecutado: +totalEjecutado.toFixed(2),
      variacion: +variacionGlobal.toFixed(2),
      porcentaje: +porcentajeGlobal.toFixed(1),
    },
  };
}
