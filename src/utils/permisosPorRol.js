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
    "/",
    "/historial",
    "/crear",           // generar OC/OS
    "/cotizaciones",
    "/proveedores",
    "/requerimientos",
    "/tickets",
  ],

  // Operaciones (jefatura de logística/operaciones)
  operaciones: [
    "/",
    "/historial",
    "/FirmarOC",    
    "/requerimientos",
    "/cotizaciones",
    "/crear",
    "/tickets",
    "/caja",
  ],

  // Gerencia de Operaciones y Proyectos (Mónica)
  "gerencia operaciones": [
    "/",
    "/historial",
    "/requerimientos",
    "/cotizaciones",
    "/crear",
    "/tickets",
    "/caja",
  ],

  // Gerencia General (Guillermo)
  "gerencia general": [
    "/",
    "/historial",
  ],

  // Finanzas/Contabilidad (Diego)
  finanzas: [
    "/",
    "/historial",
    "/requerimientos",
    "/cotizaciones",
    "/tickets",
    "/caja",
  ],

  // Gerencia de Finanzas (Luis)
  "gerencia finanzas": [
    "/",
    "/historial",
    "/requerimientos",
    "/cotizaciones",
    "/tickets",
    "/caja",
  ],

  // Administración y Legal
  administración: [
    "/", 
    "/caja",
    "/tickets",
  ],

  legal: [
    "/", 
  ],
};

export default permisosPorRol;
