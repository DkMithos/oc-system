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
    "/caja",
    "/cargar-maestros",
    "/logs",
    "/dashboard",
    "/resumen",
    "/indicadores",
    "/pagos",
    "/pago",
    "/adminsoporte",
  ],

  soporte: [
    ...comunes,
    "/admin",
    "/crear",
    "/editar",
    "/cotizaciones",
    "/proveedores",
    "/requerimientos",
    "/caja",
    "/cargar-maestros",
    "/logs",
    "/dashboard",
    "/resumen",
    "/indicadores",
    "/pagos",
    "/pago",
    "/adminsoporte",
  ],

  // Comprador (no firma OCs)
  comprador: [
    ...comunes,
    "/crear",
    "/editar",        // edita solo cuando la OC tenga permiteEdicion = true
    "/cotizaciones",
    "/proveedores",
    "/requerimientos",
  ],

  // Operaciones (jefatura logística/operaciones)
  operaciones: [
    ...comunes,
    "/firmar",
    "/caja",
  ],

  // Gerencia de Operaciones y Proyectos
  "gerencia operaciones": [
    ...comunes,
    "/firmar",
    "/caja",
  ],

  // Gerencia General
  "gerencia general": [
    ...comunes,
    "/firmar",
    // Si habilitas acceso al dashboard en AppRoutes para este rol, añade "/dashboard".
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
  ],

  // Gerencia de Finanzas
  "gerencia finanzas": [
    ...comunes,
    "/firmar",
    "/caja",
    "/pago",
    "/pagos",
  ],

  // Administración (sin acento)
  administracion: [
    ...comunes,
    "/caja",
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
