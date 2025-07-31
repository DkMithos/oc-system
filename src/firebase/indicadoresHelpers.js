// src/firebase/indicadoresHelpers.js
import { collection, getDocs } from "firebase/firestore";
import { db } from "./config";

// Total de OC generadas
export const obtenerTotalOCs = async () => {
  const snapshot = await getDocs(collection(db, "ordenesCompra"));
  return snapshot.size;
};

// Resumen por estado
export const obtenerResumenEstadosOC = async () => {
  const snapshot = await getDocs(collection(db, "ordenesCompra"));
  const resumen = { activas: 0, cerradas: 0, rechazadas: 0 };
  snapshot.forEach((doc) => {
    const estado = doc.data().estado;
    if (estado === "cerrado") resumen.cerradas++;
    else if (estado === "rechazado") resumen.rechazadas++;
    else resumen.activas++;
  });
  return resumen;
};

// Monto total aprobado
export const obtenerMontoTotalOCs = async () => {
  const snapshot = await getDocs(collection(db, "ordenesCompra"));
  let total = 0;
  snapshot.forEach((doc) => {
    const estado = doc.data().estado;
    if (estado === "cerrado" || estado === "aprobado") {
      const items = doc.data().items || [];
      total += items.reduce((acc, item) => acc + (item.total || 0), 0);
    }
  });
  return total;
};

// Caja chica resumen
export const obtenerResumenCajaChica = async () => {
  const snapshot = await getDocs(collection(db, "cajaChica"));
  let ingresos = 0, egresos = 0;
  snapshot.forEach((doc) => {
    const m = doc.data();
    const monto = parseFloat(m.monto);
    if (m.tipo === "ingreso") ingresos += monto;
    if (m.tipo === "egreso") egresos += monto;
  });
  return { ingresos, egresos, saldo: ingresos - egresos };
};
// 🔹 Obtener lista completa de usuarios
export const obtenerUsuarios = async () => {
  const ref = collection(db, "usuarios");
  const snap = await getDocs(ref);
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
};

// 🔹 Obtener registros de logs (opcional para comportamiento del sistema)
export const obtenerLogs = async () => {
  const ref = collection(db, "logs");
  const snap = await getDocs(ref);
  return snap.docs.map((doc) => doc.data());
};

// 🔹 Obtener acciones de exportación (opcional)
export const obtenerExportaciones = async () => {
  const ref = collection(db, "exportaciones");
  const snap = await getDocs(ref);
  return snap.docs.map((doc) => doc.data());
};