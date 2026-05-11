// src/routes/AppRoutes.jsx
// Lazy loading: cada página se carga solo cuando el usuario navega a ella.
// Reduce el bundle inicial de ~2.9MB a ~400KB.
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../layout/Layout";
import RutaProtegida from "../components/RutaProtegida";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PageLoader } from "../components/ui/Skeleton";

// ── Fallback de carga ────────────────────────────────────────
const Cargando = () => <PageLoader mensaje="Cargando módulo…" />;

// ── Wrapper: ErrorBoundary + Suspense ────────────────────────
const SafeLoad = ({ children }) => (
  <ErrorBoundary>
    <Suspense fallback={<Cargando />}>{children}</Suspense>
  </ErrorBoundary>
);

// ── Importaciones lazy ───────────────────────────────────────
const Home              = lazy(() => import("../pages/Home"));
const Historial         = lazy(() => import("../pages/Historial"));
const VerOC             = lazy(() => import("../pages/VerOC"));
const CrearOC           = lazy(() => import("../pages/CrearOC"));
const EditarOC          = lazy(() => import("../pages/EditarOC"));
const FirmarOC          = lazy(() => import("../pages/FirmarOC"));
const Cotizaciones      = lazy(() => import("../pages/Cotizaciones"));
const Proveedores       = lazy(() => import("../pages/Proveedores"));
const Requerimientos    = lazy(() => import("../pages/Requerimientos"));
const CajaChica         = lazy(() => import("../pages/CajaChica"));
const RegistrarPago     = lazy(() => import("../pages/RegistrarPago"));
const HistorialPagos    = lazy(() => import("../pages/HistorialPagos"));
const FlujosFinancieros = lazy(() => import("../pages/FlujosFinancieros"));
const Dashboard         = lazy(() => import("../pages/Dashboard"));
// Indicadores y ResumenGeneral eliminados (Fase 7: consolidación → redirigen a /dashboard)
const Admin             = lazy(() => import("../pages/Admin"));
const Logs              = lazy(() => import("../pages/Logs"));
const CargarMaestros    = lazy(() => import("../pages/CargarMaestros"));
const MiFirma           = lazy(() => import("../pages/MiFirma"));
const Tickets           = lazy(() => import("../pages/Tickets"));
const AdminTickets      = lazy(() => import("../pages/AdminTickets"));
const Reporteria        = lazy(() => import("../pages/reportes/Reporteria"));
const CentroExportaciones = lazy(() => import("../pages/reportes/CentroExportaciones"));
const Inventario          = lazy(() => import("../pages/Inventario"));
const RecepcionBienes     = lazy(() => import("../pages/RecepcionBienes"));
const PagosPorCentroCosto  = lazy(() => import("../pages/PagosPorCentroCosto"));
const SolicitudesEdicion   = lazy(() => import("../pages/SolicitudesEdicion"));
const ImportarFlujosExcel  = lazy(() => import("../pages/ImportarFlujosExcel"));
const FlujoCajaPlanning    = lazy(() => import("../pages/FlujoCajaPlanning"));
const DashboardGerencial       = lazy(() => import("../pages/DashboardGerencial"));
const PresupuestoVsEjecutado   = lazy(() => import("../pages/PresupuestoVsEjecutado"));
const SalaPagos                = lazy(() => import("../pages/SalaPagos"));
const CompromisosActivos       = lazy(() => import("../pages/CompromisosActivos"));
const InstrumentosFinancieros  = lazy(() => import("../pages/InstrumentosFinancieros"));

// ── Todos los roles del sistema ──────────────────────────────
const TODOS = [
  "admin","soporte","comprador","operaciones","gerencia",
  "gerencia operaciones","gerencia general","gerencia finanzas",
  "finanzas","administracion","legal",
];
const GERENCIAS = ["gerencia","gerencia operaciones","gerencia general","gerencia finanzas"];
const SOLO_ADMIN = ["admin"];

// ── Componente ───────────────────────────────────────────────
const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Layout />}>

      {/* HOME */}
      <Route index element={
        <RutaProtegida rolesPermitidos={TODOS.filter(r => r !== "soporte")}>
          <SafeLoad><Home /></SafeLoad>
        </RutaProtegida>
      } />

      {/* HISTORIAL */}
      <Route path="historial" element={
        <RutaProtegida rolesPermitidos={TODOS}>
          <SafeLoad><Historial /></SafeLoad>
        </RutaProtegida>
      } />

      {/* VER OC */}
      <Route path="ver" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","gerencia","finanzas","gerencia operaciones","gerencia general","gerencia finanzas","soporte"]}>
          <SafeLoad><VerOC /></SafeLoad>
        </RutaProtegida>
      } />

      {/* CREAR OC */}
      <Route path="crear" element={
        <RutaProtegida rolesPermitidos={["admin","comprador"]}>
          <SafeLoad><CrearOC /></SafeLoad>
        </RutaProtegida>
      } />

      {/* EDITAR OC */}
      <Route path="editar" element={
        <RutaProtegida rolesPermitidos={["admin","comprador"]}>
          <SafeLoad><EditarOC /></SafeLoad>
        </RutaProtegida>
      } />

      {/* FIRMAR OC */}
      <Route path="firmar" element={
        <RutaProtegida rolesPermitidos={["comprador","operaciones","gerencia","finanzas","gerencia operaciones","gerencia general","gerencia finanzas","admin"]}>
          <SafeLoad><FirmarOC /></SafeLoad>
        </RutaProtegida>
      } />

      {/* COTIZACIONES */}
      <Route path="cotizaciones" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","soporte"]}>
          <SafeLoad><Cotizaciones /></SafeLoad>
        </RutaProtegida>
      } />

      {/* PROVEEDORES */}
      <Route path="proveedores" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","soporte"]}>
          <SafeLoad><Proveedores /></SafeLoad>
        </RutaProtegida>
      } />

      {/* INVENTARIO */}
      <Route path="inventario" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","gerencia","gerencia operaciones","soporte"]}>
          <SafeLoad><Inventario /></SafeLoad>
        </RutaProtegida>
      } />

      {/* RECEPCIÓN DE BIENES */}
      <Route path="recepcion" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","gerencia","gerencia operaciones","soporte"]}>
          <SafeLoad><RecepcionBienes /></SafeLoad>
        </RutaProtegida>
      } />

      {/* REQUERIMIENTOS */}
      <Route path="requerimientos" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","soporte"]}>
          <SafeLoad><Requerimientos /></SafeLoad>
        </RutaProtegida>
      } />

      {/* CAJA CHICA */}
      <Route path="caja" element={
        <RutaProtegida rolesPermitidos={["admin","operaciones","administracion","gerencia operaciones","soporte"]}>
          <SafeLoad><CajaChica /></SafeLoad>
        </RutaProtegida>
      } />

      {/* REGISTRAR PAGO */}
      <Route path="pago" element={
        <RutaProtegida rolesPermitidos={["admin","finanzas","gerencia finanzas"]}>
          <SafeLoad><RegistrarPago /></SafeLoad>
        </RutaProtegida>
      } />

      {/* HISTORIAL PAGOS */}
      <Route path="pagos" element={
        <RutaProtegida rolesPermitidos={["admin","finanzas","gerencia finanzas","gerencia general"]}>
          <SafeLoad><HistorialPagos /></SafeLoad>
        </RutaProtegida>
      } />

      {/* SOLICITUDES DE EDICIÓN */}
      <Route path="solicitudes-edicion" element={
        <RutaProtegida rolesPermitidos={["admin","operaciones","gerencia","gerencia operaciones","gerencia general","gerencia finanzas","finanzas"]}>
          <SafeLoad><SolicitudesEdicion /></SafeLoad>
        </RutaProtegida>
      } />

      {/* PAGOS POR CENTRO DE COSTO */}
      <Route path="pagos-cc" element={
        <RutaProtegida rolesPermitidos={["admin","finanzas","gerencia finanzas","gerencia general","gerencia","gerencia operaciones","operaciones"]}>
          <SafeLoad><PagosPorCentroCosto /></SafeLoad>
        </RutaProtegida>
      } />

      {/* PLANIFICACIÓN DE PAGOS */}
      <Route path="planificacion" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia finanzas","operaciones","gerencia operaciones","administracion","gerencia","gerencia general"]}>
          <SafeLoad><FlujoCajaPlanning /></SafeLoad>
        </RutaProtegida>
      } />

      {/* IMPORTAR FLUJOS EXCEL */}
      <Route path="importar-flujos" element={
        <RutaProtegida rolesPermitidos={["admin","soporte"]}>
          <SafeLoad><ImportarFlujosExcel /></SafeLoad>
        </RutaProtegida>
      } />

      {/* FLUJOS FINANCIEROS */}
      <Route path="flujos-financieros" element={
        <RutaProtegida rolesPermitidos={["admin","operaciones","administracion","gerencia","finanzas","gerencia general","gerencia operaciones","gerencia finanzas"]}>
          <SafeLoad><FlujosFinancieros /></SafeLoad>
        </RutaProtegida>
      } />

      {/* DASHBOARD */}
      <Route path="dashboard" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia",...GERENCIAS,"operaciones"]}>
          <SafeLoad><Dashboard /></SafeLoad>
        </RutaProtegida>
      } />

      {/* DASHBOARD GERENCIAL — Flujos Financieros */}
      <Route path="dashboard-gerencial" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","gerencia","gerencia general","gerencia finanzas","gerencia operaciones","finanzas","operaciones","administracion"]}>
          <SafeLoad><DashboardGerencial /></SafeLoad>
        </RutaProtegida>
      } />

      {/* MESA DE PAGOS */}
      <Route path="mesa-pagos" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia finanzas","gerencia","gerencia general","gerencia operaciones","operaciones","administracion"]}>
          <SafeLoad><SalaPagos /></SafeLoad>
        </RutaProtegida>
      } />

      {/* COMPROMISOS DE PAGO */}
      <Route path="compromisos" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia finanzas","gerencia","gerencia general","gerencia operaciones","operaciones","administracion"]}>
          <SafeLoad><CompromisosActivos /></SafeLoad>
        </RutaProtegida>
      } />

      {/* INSTRUMENTOS FINANCIEROS (CIPRL) */}
      <Route path="instrumentos-financieros" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia finanzas","gerencia","gerencia general","gerencia operaciones","operaciones","administracion"]}>
          <SafeLoad><InstrumentosFinancieros /></SafeLoad>
        </RutaProtegida>
      } />

      {/* PRESUPUESTO VS EJECUTADO */}
      <Route path="presupuesto-vs-ejecutado" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","gerencia","gerencia general","gerencia finanzas","gerencia operaciones","finanzas","operaciones","administracion"]}>
          <SafeLoad><PresupuestoVsEjecutado /></SafeLoad>
        </RutaProtegida>
      } />

      {/* INDICADORES — redirigido a Dashboard (Fase 7: consolidación) */}
      <Route path="indicadores" element={<Navigate to="/dashboard" replace />} />

      {/* RESUMEN GENERAL — redirigido a Dashboard (Fase 7: consolidación) */}
      <Route path="resumen" element={<Navigate to="/dashboard" replace />} />

      {/* REPORTES */}
      <Route path="reportes" element={
        <RutaProtegida rolesPermitidos={["admin","gerencia","finanzas",...GERENCIAS,"operaciones"]}>
          <SafeLoad><Reporteria /></SafeLoad>
        </RutaProtegida>
      } />

      {/* EXPORTACIONES */}
      <Route path="exportaciones" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia",...GERENCIAS,"comprador","operaciones"]}>
          <SafeLoad><CentroExportaciones /></SafeLoad>
        </RutaProtegida>
      } />

      {/* TICKETS */}
      <Route path="soporte" element={
        <RutaProtegida rolesPermitidos={TODOS}>
          <SafeLoad><Tickets /></SafeLoad>
        </RutaProtegida>
      } />

      {/* ADMIN TICKETS */}
      <Route path="adminsoporte" element={
        <RutaProtegida rolesPermitidos={["admin","soporte"]}>
          <SafeLoad><AdminTickets /></SafeLoad>
        </RutaProtegida>
      } />

      {/* MI FIRMA */}
      <Route path="mi-firma" element={
        <RutaProtegida rolesPermitidos={TODOS}>
          <SafeLoad><MiFirma /></SafeLoad>
        </RutaProtegida>
      } />

      {/* PANEL ADMIN */}
      <Route path="admin" element={
        <RutaProtegida rolesPermitidos={SOLO_ADMIN}>
          <SafeLoad><Admin /></SafeLoad>
        </RutaProtegida>
      } />

      {/* LOGS */}
      <Route path="logs" element={
        <RutaProtegida rolesPermitidos={SOLO_ADMIN}>
          <SafeLoad><Logs /></SafeLoad>
        </RutaProtegida>
      } />

      {/* CARGAR MAESTROS */}
      <Route path="cargar-maestros" element={
        <RutaProtegida rolesPermitidos={SOLO_ADMIN}>
          <SafeLoad><CargarMaestros /></SafeLoad>
        </RutaProtegida>
      } />

      {/* 404 */}
      <Route path="*" element={
        <div className="p-10 text-center">
          <p className="text-4xl font-bold text-gray-300 mb-3">404</p>
          <p className="text-gray-600">Ruta no encontrada o sin acceso.</p>
        </div>
      } />
    </Route>
  </Routes>
);

export default AppRoutes;
