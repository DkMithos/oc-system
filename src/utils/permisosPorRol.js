// src/utils/permisosPorRol.js
const permisosPorRol = {
  admin: [
    "/",
    "/admin",
    "/crear",
    "/cotizaciones",
    "/proveedores",
    "/editar",
    "/dashboard",
    "/logs",
    "/cargar-maestros",
    "/requerimientos",
    "/caja",
    "/ver",
  ],
  comprador: [
    "/",
    "/crear",
    "/cotizaciones",
    "/proveedores",
    "/editar",
    "/dashboard",
    "/requerimientos",
    "/ver",
  ],
  operaciones: [
    "/",
    "/firmar",
    "/dashboard",
    "/caja",
    "/ver",
  ],
  gerencia: [
    "/",
    "/firmar",
    "/dashboard",
    "/ver",
  ],
  finanzas: [
    "/pago",
    "/pagos",
  ],
};
export default permisosPorRol;
