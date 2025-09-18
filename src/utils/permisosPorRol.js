// src/utils/permisosPorRol.js

// Rutas comunes visibles para la mayoría de roles
const comunes = [
  "/",                 // home / dashboard general
  "/historial",        // historial (filtrado por rol desde la UI)
  "/dashboard",
  "/resumen",
  "/soporte",          // centro de ayuda/tickets
  "/soporte/admin",    // vista admin de tickets (oculta por rol)
];

// Mapa de permisos por rol. Ajusta/añade rutas según tus páginas reales.
const permisosPorRol = {
  // Acceso total (TI/Soporte)
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
    "/tickets",
    "/admin-tickets",
    "/indicadores",
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
    "/tickets",
    "/admin-tickets",
    "/indicadores",
  ],

  // Comprador (ya NO firma órdenes)
  comprador: [
    ...comunes,
    "/crear",           // generar OC/OS
    "/cotizaciones",
    "/proveedores",
    "/requerimientos",
    "/tickets",
    "/indicadores",
  ],

  // Operaciones (jefatura de logística/operaciones)
  operaciones: [
    ...comunes,
    "/requerimientos",
    "/cotizaciones",
    "/crear",
    "/tickets",
    "/caja",
    "/indicadores",
  ],

  // Gerencia de Operaciones y Proyectos (Mónica)
  "gerencia operaciones": [
    ...comunes,
    "/requerimientos",
    "/cotizaciones",
    "/crear",
    "/tickets",
    "/caja",
    "/indicadores",
  ],

  // Gerencia General (Guillermo)
  "gerencia general": [
    ...comunes,
    "/indicadores",
  ],

  // Finanzas/Contabilidad (Diego)
  finanzas: [
    ...comunes,
    "/requerimientos",
    "/cotizaciones",
    "/tickets",
    "/caja",
    "/indicadores",
  ],

  // Gerencia de Finanzas (Luis)
  "gerencia finanzas": [
    ...comunes,
    "/requerimientos",
    "/cotizaciones",
    "/tickets",
    "/caja",
    "/indicadores",
  ],

  // Administración y Legal
  administración: [
    ...comunes,
    "/caja",
    "/tickets",
    "/indicadores",
  ],

  legal: [
    ...comunes,
    "/indicadores",
  ],
};

export default permisosPorRol;
