import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "../layout/Layout";
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

const NoAutorizado = () => <div className="p-6 text-red-600">Acceso no autorizado</div>;

function AppRoutes({ userRole }) {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Rutas para Finanzas */}
        {userRole === "finanzas" && (
          <>
            <Route index element={<HistorialPagos />} />
            <Route path="pago" element={<RegistrarPago />} />
            <Route path="pagos" element={<HistorialPagos />} />
          </>
        )}

        {/* Rutas comunes */}
        {["admin", "comprador", "gerencia", "operaciones"].includes(userRole) && (
          <>
            <Route index element={<Historial />} />
            <Route path="ver" element={<VerOC />} />
          </>
        )}

        {/* Gerencia y Operaciones */}
        {["gerencia", "operaciones"].includes(userRole) && (
          <>
            <Route path="firmar" element={<FirmarOC />} />
            <Route path="dashboard" element={<Dashboard />} />
          </>
        )}

        {/* Solo Operaciones */}
        {userRole === "operaciones" && (
          <Route path="caja" element={<CajaChica />} />
        )}

        {/* Comprador */}
        {userRole === "comprador" && (
          <>
            <Route path="crear" element={<CrearOC />} />
            <Route path="cotizaciones" element={<Cotizaciones />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="editar" element={<EditarOC />} />
            <Route path="requerimientos" element={<Requerimientos />} />
            <Route path="dashboard" element={<Dashboard />} />
          </>
        )}

        {/* Admin */}
        {userRole === "admin" && (
          <>
            <Route path="admin" element={<Admin />} />
            <Route path="crear" element={<CrearOC />} />
            <Route path="cotizaciones" element={<Cotizaciones />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="editar" element={<EditarOC />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="logs" element={<Logs />} />
            <Route path="cargar-maestros" element={<CargarMaestros />} />
            <Route path="requerimientos" element={<Requerimientos />} />
          </>
        )}

        {/* Ruta no autorizada */}
        <Route path="*" element={<NoAutorizado />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
