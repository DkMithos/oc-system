import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./config";

/**
 * Obtiene todas las OC activas (excluye soft-deleted).
 */
export const obtenerTodasOC = async () => {
  const snap = await getDocs(collection(db, "ordenesCompra"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((oc) => oc.eliminada !== true);
};

/**
 * Obtiene movimientos de caja chica.
 */
export const obtenerTodosMovimientosCaja = async () => {
  const snap = await getDocs(collection(db, "cajaChica"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Calcula KPIs del dashboard a partir de las OCs.
 * @param {Object[]} ocs - Array de OCs ya cargadas
 * @returns {Object} KPIs calculados
 */
export const calcularKPIs = (ocs = []) => {
  const estadoAprobado = "Aprobado";

  const aprobadas = ocs.filter((oc) => oc.estado === estadoAprobado);
  const pendientes = ocs.filter((oc) => (oc.estado || "").startsWith("Pendiente"));
  const rechazadas = ocs.filter((oc) => oc.estado === "Rechazado");

  const montoAprobado = aprobadas.reduce((acc, oc) => {
    return acc + Number(oc.resumen?.total || oc.total || 0);
  }, 0);

  const montoPendiente = pendientes.reduce((acc, oc) => {
    return acc + Number(oc.resumen?.total || oc.total || 0);
  }, 0);

  const proveedorMap = ocs.reduce((acc, oc) => {
    const nombre = oc.proveedor?.razonSocial || oc.proveedor?.nombre || "—";
    if (!acc[nombre]) acc[nombre] = { nombre, cantidad: 0, monto: 0 };
    acc[nombre].cantidad += 1;
    acc[nombre].monto += Number(oc.resumen?.total || oc.total || 0);
    return acc;
  }, {});
  const topProveedores = Object.values(proveedorMap)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  return {
    totalOCs: ocs.length,
    aprobadas: aprobadas.length,
    pendientes: pendientes.length,
    rechazadas: rechazadas.length,
    montoAprobado,
    montoPendiente,
    topProveedores,
  };
};
