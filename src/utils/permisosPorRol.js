// ✅ src/utils/permisosPorRol.js

/**
 * Nota de compatibilidad de roles:
 * En toda la app usamos roles en minúsculas y SIN acentos.
 * Ej.: "administracion" (no "administración"), "gerencia finanzas", etc.
 *
 * Rutas reales (según AppRoutes.jsx):
 *   "/", "/historial", "/ver", "/crear", "/editar", "/cotizaciones", "/proveedores",
 *   "/firmar", "/dashboard", "/logs", "/admin", "/cargar-maestros",
 *   "/requerimientos", "/caja", "/resumen", "/indicadores",
 *   "/pago", "/pagos", "/soporte", "/adminsoporte", "/mi-firma"
 */

// Rutas mínimas comunes para la mayoría de roles (visibles y útiles)
const comunes = [
  "/",           // Home
  "/historial",  // Historial (se filtra por rol desde la UI)
  "/ver",        // Ver OC
  "/soporte",    // Centro de soporte/tickets
  "/mi-firma",   // Módulo para registrar/actualizar firma
];

// Mapa de permisos por rol (coincidir con strings reales de rol)
const permisosPorRol = {
  // Acceso total (TI / Soporte)
  admin: [
    ...comunes,
    "/admin",
    "/crear",
    "/editar",
    "/cotizaciones",
    "/proveedores",
    "/requerimientos",
    "/inventario",
    "/recepcion",
    "/caja",
    "/cargar-maestros",
    "/logs",
    "/dashboard",
    "/resumen",
    "/indicadores",
    "/pagos",
    "/pagos-cc",
    "/pago",
    "/solicitudes-edicion",
    "/adminsoporte",
    "/flujos-financieros",
    "/planificacion",
    "/importar-flujos",
    "/reportes",
    "/exportaciones",
  ],

  soporte: [
    ...comunes,
    "/admin",
    "/crear",
    "/editar",
    "/cotizaciones",
    "/proveedores",
    "/requerimientos",
    "/inventario",
    "/recepcion",
    "/caja",
    "/cargar-maestros",
    "/logs",
    "/dashboard",
    "/resumen",
    "/indicadores",
    "/pagos",
    "/pago",
    "/adminsoporte",
    "/flujos-financieros",
    "/planificacion",
    "/importar-flujos",
  ],

  // Comprador (no firma OCs)
  comprador: [
    ...comunes,
    "/crear",
    "/editar",        // edita solo cuando la OC tenga permiteEdicion = true
    "/cotizaciones",
    "/proveedores",
    "/requerimientos",
    "/inventario",
    "/recepcion",
    "/reportes",
    "/exportaciones",
  ],

  // Operaciones (jefatura logística/operaciones)
  operaciones: [
    ...comunes,
    "/firmar",
    "/cotizaciones",
    "/requerimientos",
    "/inventario",
    "/recepcion",
    "/caja",
    "/pagos-cc",
    "/solicitudes-edicion",
    "/flujos-financieros",
    "/planificacion",
    "/reportes",
    "/exportaciones",
    "/proveedores",
  ],

  // Gerencia de Operaciones y Proyectos
  "gerencia operaciones": [
    ...comunes,
    "/firmar",
    "/inventario",
    "/recepcion",
    "/caja",
    "/pagos-cc",
    "/solicitudes-edicion",
    "/flujos-financieros",
    "/planificacion",
  ],

  // Gerencia General
  "gerencia general": [
    ...comunes,
    "/firmar",
    "/pagos-cc",
    "/solicitudes-edicion",
    "/flujos-financieros",
    "/planificacion",
  ],

  // Finanzas/Contabilidad
  finanzas: [
    ...comunes,
    "/firmar",
    "/requerimientos",
    "/cotizaciones",
    "/caja",
    "/pago",
    "/pagos",
    "/pagos-cc",
    "/solicitudes-edicion",
    "/flujos-financieros",
    "/planificacion",
    "/exportaciones",
  ],

  // Gerencia de Finanzas
  "gerencia finanzas": [
    ...comunes,
    "/firmar",
    "/caja",
    "/pago",
    "/pagos",
    "/pagos-cc",
    "/solicitudes-edicion",
    "/flujos-financieros",
    "/planificacion",
    "/exportaciones",
  ],

  // Gerencia (rol genérico de directivos)
  gerencia: [
    ...comunes,
    "/firmar",
    "/dashboard",
    "/resumen",
    "/indicadores",
    "/pagos-cc",
    "/solicitudes-edicion",
    "/flujos-financieros",
    "/planificacion",
    "/reportes",
    "/exportaciones",
  ],

  // Administración (sin acento)
  administracion: [
    ...comunes,
    "/caja",
    "/flujos-financieros",
    "/planificacion",
  ],

  // Legal
  legal: [
    ...comunes,
  ],
};

export default permisosPorRol;

/**
 * (Opcional) Helper para chequear acceso desde componentes
 *  puedeAcceder(rol, path) -> true/false
 */
export const puedeAcceder = (rol, path) => {
  const key = String(rol || "").toLowerCase();
  const lista = permisosPorRol[key] || [];
  return lista.includes(path);
};
