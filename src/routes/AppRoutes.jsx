// ✅ src/routes/AppRoutes.jsx
import { Routes, Route } from "react-router-dom";
import Layout from "../layout/Layout";
import RutaProtegida from "../components/RutaProtegida";

import Home from "../pages/Home";
import Historial from "../pages/Historial";
import VerOC from "../pages/VerOC";
import CrearOC from "../pages/CrearOC";
import Admin from "../pages/Admin";
import Cotizaciones from "../pages/Cotizaciones";
import Proveedores from "../pages/Proveedores";
import FirmarOC from "../pages/FirmarOC";
import EditarOC from "../pages/EditarOC";
import Dashboard from "../pages/Dashboard";
import Logs from "../pages/Logs";
import RegistrarPago from "../pages/RegistrarPago";
import HistorialPagos from "../pages/HistorialPagos";
import CargarMaestros from "../pages/CargarMaestros";
import CajaChica from "../pages/CajaChica";
import Requerimientos from "../pages/Requerimientos";
import ResumenGeneral from "../pages/ResumenGeneral";
import Indicadores from "../pages/Indicadores";
import Tickets from "../pages/Tickets";
import AdminTickets from "../pages/AdminTickets";
import MiFirma from "../pages/MiFirma"; // ⬅️ NUEVO

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador", "operaciones", "gerencia", "finanzas", "legal", "administracion", "gerencia operaciones", "gerencia general", "gerencia finanzas"]}>
              <Home />
            </RutaProtegida>
          }
        />

        <Route
          path="historial"
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador", "operaciones", "gerencia", "gerencia operaciones", "gerencia general", "gerencia finanzas"]}>
              <Historial />
            </RutaProtegida>
          }
        />
        <Route
          path="ver"
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador", "operaciones", "gerencia", "finanzas", "gerencia operaciones", "gerencia general", "gerencia finanzas"]}>
              <VerOC />
            </RutaProtegida>
          }
        />
        <Route
          path="crear"
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador"]}>
              <CrearOC />
            </RutaProtegida>
          }
        />
        <Route
          path="cotizaciones"
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador", "operaciones"]}>
              <Cotizaciones />
            </RutaProtegida>
          }
        />
        <Route
          path="proveedores"
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador"]}>
              <Proveedores />
            </RutaProtegida>
          }
        />
        <Route
          path="editar"
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador"]}>
              <EditarOC />
            </RutaProtegida>
          }
        />
        <Route
          path="firmar"
          element={
            <RutaProtegida rolesPermitidos={["operaciones", "gerencia", "finanzas", "gerencia operaciones", "gerencia general", "gerencia finanzas"]}>
              <FirmarOC />
            </RutaProtegida>
          }
        />

        {/* ⬇️ NUEVO: módulo para registrar/actualizar firma */}
        <Route
          path="mi-firma"
          element={
            <RutaProtegida rolesPermitidos={["admin","comprador","operaciones","gerencia","finanzas","legal","administracion", "gerencia operaciones", "gerencia general", "gerencia finanzas"]}>
              <MiFirma />
            </RutaProtegida>
          }
        />

        <Route
          path="dashboard"
          element={
            <RutaProtegida rolesPermitidos={["admin", "finanzas", "gerencia"]}>
              <Dashboard />
            </RutaProtegida>
          }
        />
        <Route
          path="logs"
          element={
            <RutaProtegida rolesPermitidos={["admin"]}>
              <Logs />
            </RutaProtegida>
          }
        />
        <Route
          path="admin"
          element={
            <RutaProtegida rolesPermitidos={["admin"]}>
              <Admin />
            </RutaProtegida>
          }
        />
        <Route
          path="cargar-maestros"
          element={
            <RutaProtegida rolesPermitidos={["admin"]}>
              <CargarMaestros />
            </RutaProtegida>
          }
        />
        <Route
          path="requerimientos"
          element={
            <RutaProtegida rolesPermitidos={["admin", "comprador", "operaciones"]}>
              <Requerimientos />
            </RutaProtegida>
          }
        />
        <Route
          path="caja"
          element={
            <RutaProtegida rolesPermitidos={["admin", "operaciones", "administracion", "gerencia operaciones"]}>
              <CajaChica />
            </RutaProtegida>
          }
        />
        <Route
          path="pago"
          element={
            <RutaProtegida rolesPermitidos={["admin", "finanzas"]}>
              <RegistrarPago />
            </RutaProtegida>
          }
        />
        <Route
          path="resumen"
          element={
            <RutaProtegida rolesPermitidos={["admin", "gerencia", "operaciones"]}>
              <ResumenGeneral />
            </RutaProtegida>
          }
        />
        <Route
          path="indicadores"
          element={
            <RutaProtegida rolesPermitidos={["admin", "gerencia", "operaciones"]}>
              <Indicadores />
            </RutaProtegida>
          }
        />
        <Route
          path="pagos"
          element={
            <RutaProtegida rolesPermitidos={["admin", "finanzas"]}>
              <HistorialPagos />
            </RutaProtegida>
          }
        />
        <Route
          path="soporte"
          element={
            <RutaProtegida rolesPermitidos={["admin", "finanzas", "gerencia", "administracion", "operaciones", "comprador", "gerencia operaciones", "gerencia general", "gerencia finanzas"]}>
              <Tickets />
            </RutaProtegida>
          }
        />
        <Route
          path="adminsoporte"
          element={
            <RutaProtegida rolesPermitidos={["admin", "finanzas", "gerencia", "administracion", "operaciones", "comprador"]}>
              <AdminTickets />
            </RutaProtegida>
          }
        />
        <Route path="*" element={<div className="p-6 text-red-600">⛔ Ruta no autorizada</div>} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
