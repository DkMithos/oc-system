// src/routes/AppRoutes.jsx
// Lazy loading: cada página se carga solo cuando el usuario navega a ella.
// Reduce el bundle inicial de ~2.9MB a ~400KB.
import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "../layout/Layout";
import RutaProtegida from "../components/RutaProtegida";
import { PageLoader } from "../components/ui/Skeleton";

// ── Fallback de carga ────────────────────────────────────────
const Cargando = () => <PageLoader mensaje="Cargando módulo…" />;

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
const Indicadores       = lazy(() => import("../pages/Indicadores"));
const ResumenGeneral    = lazy(() => import("../pages/ResumenGeneral"));
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
          <Suspense fallback={<Cargando />}><Home /></Suspense>
        </RutaProtegida>
      } />

      {/* HISTORIAL */}
      <Route path="historial" element={
        <RutaProtegida rolesPermitidos={TODOS}>
          <Suspense fallback={<Cargando />}><Historial /></Suspense>
        </RutaProtegida>
      } />

      {/* VER OC */}
      <Route path="ver" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","gerencia","finanzas","gerencia operaciones","gerencia general","gerencia finanzas","soporte"]}>
          <Suspense fallback={<Cargando />}><VerOC /></Suspense>
        </RutaProtegida>
      } />

      {/* CREAR OC */}
      <Route path="crear" element={
        <RutaProtegida rolesPermitidos={["admin","comprador"]}>
          <Suspense fallback={<Cargando />}><CrearOC /></Suspense>
        </RutaProtegida>
      } />

      {/* EDITAR OC */}
      <Route path="editar" element={
        <RutaProtegida rolesPermitidos={["admin","comprador"]}>
          <Suspense fallback={<Cargando />}><EditarOC /></Suspense>
        </RutaProtegida>
      } />

      {/* FIRMAR OC */}
      <Route path="firmar" element={
        <RutaProtegida rolesPermitidos={["comprador","operaciones","gerencia","finanzas","gerencia operaciones","gerencia general","gerencia finanzas","admin"]}>
          <Suspense fallback={<Cargando />}><FirmarOC /></Suspense>
        </RutaProtegida>
      } />

      {/* COTIZACIONES */}
      <Route path="cotizaciones" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","soporte"]}>
          <Suspense fallback={<Cargando />}><Cotizaciones /></Suspense>
        </RutaProtegida>
      } />

      {/* PROVEEDORES */}
      <Route path="proveedores" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","soporte"]}>
          <Suspense fallback={<Cargando />}><Proveedores /></Suspense>
        </RutaProtegida>
      } />

      {/* INVENTARIO */}
      <Route path="inventario" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","gerencia","gerencia operaciones","soporte"]}>
          <Suspense fallback={<Cargando />}><Inventario /></Suspense>
        </RutaProtegida>
      } />

      {/* RECEPCIÓN DE BIENES */}
      <Route path="recepcion" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","gerencia","gerencia operaciones","soporte"]}>
          <Suspense fallback={<Cargando />}><RecepcionBienes /></Suspense>
        </RutaProtegida>
      } />

      {/* REQUERIMIENTOS */}
      <Route path="requerimientos" element={
        <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","soporte"]}>
          <Suspense fallback={<Cargando />}><Requerimientos /></Suspense>
        </RutaProtegida>
      } />

      {/* CAJA CHICA */}
      <Route path="caja" element={
        <RutaProtegida rolesPermitidos={["admin","operaciones","administracion","gerencia operaciones","soporte"]}>
          <Suspense fallback={<Cargando />}><CajaChica /></Suspense>
        </RutaProtegida>
      } />

      {/* REGISTRAR PAGO */}
      <Route path="pago" element={
        <RutaProtegida rolesPermitidos={["admin","finanzas"]}>
          <Suspense fallback={<Cargando />}><RegistrarPago /></Suspense>
        </RutaProtegida>
      } />

      {/* HISTORIAL PAGOS */}
      <Route path="pagos" element={
        <RutaProtegida rolesPermitidos={["admin","finanzas","gerencia finanzas","gerencia general"]}>
          <Suspense fallback={<Cargando />}><HistorialPagos /></Suspense>
        </RutaProtegida>
      } />

      {/* FLUJOS FINANCIEROS */}
      <Route path="flujos-financieros" element={
        <RutaProtegida rolesPermitidos={["admin","operaciones","administracion","gerencia","finanzas","gerencia general","gerencia operaciones","gerencia finanzas"]}>
          <Suspense fallback={<Cargando />}><FlujosFinancieros /></Suspense>
        </RutaProtegida>
      } />

      {/* DASHBOARD */}
      <Route path="dashboard" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia",...GERENCIAS,"operaciones"]}>
          <Suspense fallback={<Cargando />}><Dashboard /></Suspense>
        </RutaProtegida>
      } />

      {/* INDICADORES */}
      <Route path="indicadores" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia",...GERENCIAS,"operaciones"]}>
          <Suspense fallback={<Cargando />}><Indicadores /></Suspense>
        </RutaProtegida>
      } />

      {/* RESUMEN GENERAL */}
      <Route path="resumen" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","gerencia","finanzas",...GERENCIAS,"operaciones"]}>
          <Suspense fallback={<Cargando />}><ResumenGeneral /></Suspense>
        </RutaProtegida>
      } />

      {/* REPORTES */}
      <Route path="reportes" element={
        <RutaProtegida rolesPermitidos={["admin","gerencia","finanzas",...GERENCIAS,"operaciones"]}>
          <Suspense fallback={<Cargando />}><Reporteria /></Suspense>
        </RutaProtegida>
      } />

      {/* EXPORTACIONES */}
      <Route path="exportaciones" element={
        <RutaProtegida rolesPermitidos={["admin","soporte","finanzas","gerencia",...GERENCIAS,"comprador","operaciones"]}>
          <Suspense fallback={<Cargando />}><CentroExportaciones /></Suspense>
        </RutaProtegida>
      } />

      {/* TICKETS */}
      <Route path="soporte" element={
        <RutaProtegida rolesPermitidos={TODOS}>
          <Suspense fallback={<Cargando />}><Tickets /></Suspense>
        </RutaProtegida>
      } />

      {/* ADMIN TICKETS */}
      <Route path="adminsoporte" element={
        <RutaProtegida rolesPermitidos={["admin","soporte"]}>
          <Suspense fallback={<Cargando />}><AdminTickets /></Suspense>
        </RutaProtegida>
      } />

      {/* MI FIRMA */}
      <Route path="mi-firma" element={
        <RutaProtegida rolesPermitidos={TODOS}>
          <Suspense fallback={<Cargando />}><MiFirma /></Suspense>
        </RutaProtegida>
      } />

      {/* PANEL ADMIN */}
      <Route path="admin" element={
        <RutaProtegida rolesPermitidos={SOLO_ADMIN}>
          <Suspense fallback={<Cargando />}><Admin /></Suspense>
        </RutaProtegida>
      } />

      {/* LOGS */}
      <Route path="logs" element={
        <RutaProtegida rolesPermitidos={SOLO_ADMIN}>
          <Suspense fallback={<Cargando />}><Logs /></Suspense>
        </RutaProtegida>
      } />

      {/* CARGAR MAESTROS */}
      <Route path="cargar-maestros" element={
        <RutaProtegida rolesPermitidos={SOLO_ADMIN}>
          <Suspense fallback={<Cargando />}><CargarMaestros /></Suspense>
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
