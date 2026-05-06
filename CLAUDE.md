# Memphis ERP — CLAUDE.md

## Stack técnico
- **Frontend**: React 19 SPA, Vite 6, Tailwind CSS 3
- **Backend**: Firebase (Firestore, Auth, Storage, FCM), Cloud Functions v2 Node 20 ESM
- **Gráficos**: recharts (único — chart.js eliminado)
- **Export**: xlsx, jspdf, jspdf-autotable, file-saver
- **Despliegue**: Firebase Hosting (portal.memphismaquinarias.com)

## Estructura de carpetas clave
```
src/
  pages/          — Páginas lazy-loaded (ver AppRoutes.jsx)
  components/     — Componentes reutilizables
  firebase/       — firestoreHelpers.js, pagosHelpers.js, solicitudesHelpers.js, notifs.js
  utils/          — aprobaciones.js, permisosPorRol.js, tipoCambio.js, exportUtils.js
  context/        — UsuarioContext.jsx (auth + rol)
  routes/         — AppRoutes.jsx (lazy loading + RutaProtegida)
  layout/         — Layout.jsx, Sidebar.jsx, Navbar.jsx
functions/        — Cloud Functions: index.js, sunatProxy.js
```

## Colecciones Firestore
| Colección | Descripción |
|---|---|
| `ordenesCompra` | OCs (soft-delete: `eliminada: true`) |
| `ordenesCompra/{id}/solicitudesEdicion` | Sub-colección de solicitudes de edición |
| `ordenesCompra/{id}/facturas` | Sub-colección de comprobantes de pago |
| `usuarios` | Perfil + rol (email es el ID del documento) |
| `cotizaciones` | Cotizaciones de proveedores |
| `proveedores` | Catálogo de proveedores |
| `requerimientos` | Solicitudes internas de compra |
| `centrosCosto` | Centros de costo activos/inactivos |
| `condicionesPago` | Catálogo de condiciones de pago |
| `configuracion/aprobaciones` | Umbrales de aprobación configurables desde Admin |
| `logs` | Bitácora de acciones |
| `transaccionesFinancieras` | Flujos financieros |
| `inventario` | Ítems de inventario |
| `recepcionBienes` | Recepciones de bienes |

## Roles del sistema
Los roles se almacenan en minúsculas, sin acento. Ver `src/utils/aprobaciones.js::ROLES`.

| Rol | Descripción |
|---|---|
| `admin` | Acceso total, panel de administración |
| `soporte` | TI/soporte técnico, acceso igual a admin excepto crear usuarios desde UI |
| `comprador` | Crea y edita OCs, solicita edición |
| `operaciones` | Aprueba OCs en etapa Operaciones, ve flujos financieros |
| `gerencia operaciones` | **INACTIVO** — Rol delegado/observador. No genera etapa de aprobación. OCs en estado "Pendiente de Gerencia Operaciones" son LEGADO y se redirigen a Operaciones |
| `gerencia general` | Aprueba OCs de alto monto (>umbral SOL) |
| `gerencia` | Alias genérico de directivos, mismo acceso que Gerencia General |
| `finanzas` | Registra pagos, ve historial de pagos y pagos por CC |
| `gerencia finanzas` | Supervisión de finanzas |
| `administracion` | Caja chica y flujos financieros |
| `legal` | Solo lectura de historial |

## Flujo de aprobaciones de OC
```
Comprador crea OC
  → estado: "Pendiente de Comprador"
  → Comprador firma (FirmarOC.jsx)
  → estado: "Pendiente de Operaciones"
  → Operaciones firma
  → SI monto > umbral_SOL → estado: "Pendiente de Gerencia General"
     → Gerencia General firma → estado: "Aprobada"
  → SI monto ≤ umbral_SOL → estado: "Aprobada"
  → Finanzas registra pago → estado: "Pagado" / "Pago Parcial"
```

**Umbrales**: configurables en Firestore `configuracion/aprobaciones`.
Default: 5000 SOL. El tipo de cambio se obtiene de SUNAT en tiempo real al consultar `obtenerConfigAprobaciones()`.

## Flujo de edición de OC
```
Comprador solicita edición (SolicitarEdicionModal → crearSolicitudEdicion)
  → OC.tieneSolicitudEdicion = true
  → Operaciones/Gerencia aprueba en SolicitudesEdicion.jsx o en VerOC.jsx
  → OC.permiteEdicion = true
  → Comprador edita (EditarOC.jsx)
  → Al guardar: permiteEdicion = false, tieneSolicitudEdicion = false
  → OC vuelve a "Pendiente de Comprador" (re-inicia flujo de firmas)
```

## Estado legacy: "Pendiente de Gerencia Operaciones"
Este estado fue creado por una versión anterior cuando Gerencia de Operaciones era un paso de aprobación. El puesto está **inactivo**. Las OCs en este estado son manejadas en `FirmarOC.jsx::ESTADO_OVERRIDE_NEXT` para redirigirlas a "Pendiente de Operaciones". El flujo nuevo (`etapasRequeridas()`) **nunca genera** este estado.

## Seguridad implementada
- **C-01**: Contraseñas nunca almacenadas en Firestore. Creación de usuarios via Cloud Function `crearUsuarioAdmin` (Firebase Admin SDK).
- **C-02**: `sunatProxy` Cloud Function verifica Firebase Auth Bearer token antes de consultar SUNAT.
- **C-03**: `aprobarOC()` y `rechazarOC()` envueltos en `runTransaction` para evitar race conditions.
- Reglas Firestore: validación de transición de estados, roles permitidos por estado.

## Paginación
- **Historial OC**: cursor-based con `obtenerOCsPaginadas(30)` + "Cargar más" + paginación local.
- **Historial Pagos**: query por estado=Pagado/PagoParcial (no bulk load) + paginación local 20/página.
- **Cotizaciones, FlujosFinancieros**: paginación local 20-25/página.
- **Requerimientos, Proveedores**: paginación local ya existente.

## Export con filtros
- `ExportMenu` soporta prop `dataProvider?: async () => row[]` para fetching lazy de todos los registros filtrados (F-05).
- Historial OC usa `obtenerOCsConFiltros()` para exportar todo sin límite de cursor.

## Variables de entorno
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FUNCTIONS_URL   (opcional, URL directa de Cloud Functions)
```

## Cloud Functions secrets
```
firebase functions:secrets:set DECOLECTA_TOKEN   # Provider RUC principal
firebase functions:secrets:set APIS_NET_TOKEN    # Fallback RUC
```
