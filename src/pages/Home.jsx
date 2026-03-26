// src/pages/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useUsuario } from "../context/UsuarioContext";
import { usePendientes } from "../context/PendientesContext";

// Accesos rápidos y guías por rol
const CONFIG_POR_ROL = {
  admin: {
    guias: [
      "Gestiona usuarios y permisos desde el Panel Administrativo.",
      "Accede al historial completo de OCs.",
      "Administra módulos maestros (centros de costo, proveedores).",
      "Revisa la bitácora de eventos del sistema.",
    ],
    accesos: [
      { label: "Panel Administrativo", ruta: "/admin", color: "bg-[#004990]" },
      { label: "Historial OC", ruta: "/historial", color: "bg-blue-600" },
      { label: "Bitácora", ruta: "/logs", color: "bg-gray-600" },
      { label: "Cargar Maestros", ruta: "/cargar-maestros", color: "bg-indigo-600" },
    ],
  },
  comprador: {
    guias: [
      "Crea nuevas órdenes de compra desde 'Generar Órdenes'.",
      "Registra requerimientos de compra antes de crear una OC.",
      "Edita OCs rechazadas para reenviarlas a aprobación.",
      "Consulta el historial y estado de tus OCs.",
    ],
    accesos: [
      { label: "Crear OC", ruta: "/crear", color: "bg-green-600" },
      { label: "Requerimientos", ruta: "/requerimientos", color: "bg-yellow-600" },
      { label: "Historial OC", ruta: "/historial", color: "bg-blue-600" },
      { label: "Cotizaciones", ruta: "/cotizaciones", color: "bg-purple-600" },
    ],
  },
  operaciones: {
    guias: [
      "Aprueba o rechaza OCs en estado 'Pendiente de Operaciones'.",
      "Revisa los detalles completos antes de firmar.",
      "Gestiona el control de Caja Chica.",
      "Aprueba requerimientos de compra pendientes.",
    ],
    accesos: [
      { label: "Bandeja Pendientes", ruta: "/historial?pendientes=1", color: "bg-yellow-600" },
      { label: "Caja Chica", ruta: "/caja", color: "bg-green-600" },
      { label: "Requerimientos", ruta: "/requerimientos", color: "bg-blue-600" },
      { label: "Reportes", ruta: "/reportes", color: "bg-indigo-600" },
    ],
  },
  "gerencia operaciones": {
    guias: [
      "Aprueba OCs que superan S/ 10,000.",
      "Revisa los flujos financieros del área.",
      "Accede al historial completo de órdenes.",
    ],
    accesos: [
      { label: "Bandeja Pendientes", ruta: "/historial?pendientes=1", color: "bg-yellow-600" },
      { label: "Flujos Financieros", ruta: "/flujos-financieros", color: "bg-green-600" },
      { label: "Historial OC", ruta: "/historial", color: "bg-blue-600" },
    ],
  },
  "gerencia general": {
    guias: [
      "Aprueba OCs que superan S/ 50,000.",
      "Accede al historial completo de órdenes.",
      "Revisa los flujos financieros.",
    ],
    accesos: [
      { label: "Bandeja Pendientes", ruta: "/historial?pendientes=1", color: "bg-yellow-600" },
      { label: "Flujos Financieros", ruta: "/flujos-financieros", color: "bg-green-600" },
      { label: "Historial OC", ruta: "/historial", color: "bg-blue-600" },
    ],
  },
  gerencia: {
    guias: [
      "Aprueba OCs pendientes de tu firma.",
      "Revisa el historial completo de órdenes.",
      "Accede a los flujos financieros.",
    ],
    accesos: [
      { label: "Bandeja Pendientes", ruta: "/historial?pendientes=1", color: "bg-yellow-600" },
      { label: "Historial OC", ruta: "/historial", color: "bg-blue-600" },
      { label: "Flujos Financieros", ruta: "/flujos-financieros", color: "bg-green-600" },
    ],
  },
  finanzas: {
    guias: [
      "Registra pagos de facturas.",
      "Consulta el historial financiero de cada OC.",
      "Gestiona los flujos financieros del sistema.",
      "Aprueba OCs en la bandeja de Finanzas.",
    ],
    accesos: [
      { label: "Registrar Pago", ruta: "/pago", color: "bg-green-600" },
      { label: "Historial Pagos", ruta: "/pagos", color: "bg-blue-600" },
      { label: "Flujos Financieros", ruta: "/flujos-financieros", color: "bg-indigo-600" },
      { label: "Dashboard", ruta: "/dashboard", color: "bg-purple-600" },
    ],
  },
  "gerencia finanzas": {
    guias: [
      "Aprueba pagos y revisa el historial financiero.",
      "Gestiona flujos financieros.",
    ],
    accesos: [
      { label: "Historial Pagos", ruta: "/pagos", color: "bg-blue-600" },
      { label: "Flujos Financieros", ruta: "/flujos-financieros", color: "bg-green-600" },
    ],
  },
  administracion: {
    guias: [
      "Gestiona la caja chica.",
      "Revisa los flujos financieros.",
    ],
    accesos: [
      { label: "Caja Chica", ruta: "/caja", color: "bg-green-600" },
      { label: "Flujos Financieros", ruta: "/flujos-financieros", color: "bg-blue-600" },
    ],
  },
  legal: {
    guias: [
      "Consulta el historial de órdenes de compra.",
      "Accede al centro de soporte.",
    ],
    accesos: [
      { label: "Historial OC", ruta: "/historial", color: "bg-blue-600" },
      { label: "Soporte", ruta: "/soporte", color: "bg-gray-600" },
    ],
  },
};

const Home = () => {
  const navigate = useNavigate();
  const { usuario } = useUsuario();
  const { total: pendientesTotal } = usePendientes();

  const rol = String(usuario?.rol || "").toLowerCase();
  const config = CONFIG_POR_ROL[rol] || {
    guias: ["Bienvenido al sistema. Contacta al administrador para configurar tu acceso."],
    accesos: [],
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#004990]">
          Bienvenido, {usuario?.nombre || usuario?.email?.split("@")[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Rol: <span className="font-semibold capitalize">{usuario?.rol}</span>
        </p>
      </div>

      {/* Alerta de pendientes */}
      {pendientesTotal > 0 && (
        <div
          className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between cursor-pointer hover:bg-amber-100 transition"
          onClick={() => navigate("/historial?pendientes=1")}
        >
          <div>
            <p className="font-semibold text-amber-800">
              Tienes {pendientesTotal} {pendientesTotal === 1 ? "orden pendiente" : "órdenes pendientes"} de aprobación.
            </p>
            <p className="text-sm text-amber-600">Haz clic para revisar.</p>
          </div>
          <span className="bg-amber-500 text-white text-sm font-bold px-3 py-1 rounded-full">{pendientesTotal}</span>
        </div>
      )}

      {/* Accesos rápidos */}
      {config.accesos.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {config.accesos.map((a) => (
              <button
                key={a.ruta}
                onClick={() => navigate(a.ruta)}
                className={`${a.color} text-white text-sm font-medium py-3 px-4 rounded-lg hover:opacity-90 transition text-center shadow`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guía del rol */}
      <div className="bg-white border rounded-lg p-5 shadow-sm">
        <h2 className="font-semibold text-gray-700 mb-3">Guía para tu rol</h2>
        <ul className="space-y-2">
          {config.guias.map((g, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Soporte */}
      <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded">
        ¿Necesitas ayuda?{" "}
        <a href="mailto:soporte@memphis.pe" className="underline font-medium text-blue-700">
          soporte@memphis.pe
        </a>{" "}
        o{" "}
        <button onClick={() => navigate("/soporte")} className="underline font-medium text-blue-700">
          abre un ticket
        </button>
        .
      </div>
    </div>
  );
};

export default Home;
