// ✅ src/pages/reportes/Reporteria.jsx
import React, { useEffect, useState } from "react";
import DashboardGeneral from "./DashboardGeneral";
import DashboardCajaChica from "./DashboardCajaChica";
import {
  obtenerCentrosCostoLigero,
  obtenerProveedoresLigero,
} from "../../firebase/finanzasHelpers";

const hoyISO = () => new Date().toISOString().slice(0, 10);

const haceMeses = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

const Reporteria = () => {
  const [filtros, setFiltros] = useState({
    fechaDesde: haceMeses(3),
    fechaHasta: hoyISO(),
    centro_costo_id: "",
    proyecto_id: "",
    proveedor_ruc: "",
  });

  const [dashboardActivo, setDashboardActivo] = useState("general");
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargandoCatalogos(true);
      try {
        const [ccs, provs] = await Promise.all([
          obtenerCentrosCostoLigero(),
          obtenerProveedoresLigero(),
        ]);
        if (!activo) return;
        setCentrosCosto(ccs || []);
        setProveedores(provs || []);
      } catch (e) {
        console.error("Error cargando catálogos de reportería:", e);
      } finally {
        if (activo) setCargandoCatalogos(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, []);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaDesde: haceMeses(3),
      fechaHasta: hoyISO(),
      centro_costo_id: "",
      proyecto_id: "",
      proveedor_ruc: "",
    });
  };

  const tabs = [
    { id: "general", label: "General" },
    { id: "compras", label: "Compras" },
    { id: "finanzas", label: "Finanzas" },
    { id: "caja", label: "Caja Chica" },
    { id: "reqs", label: "Requerimientos / Cotizaciones" },
  ];

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Reportería &amp; Dashboards
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Usa el buscador para filtrar por rango de fechas, centro de costo o
          proveedor. Luego explora los dashboards en cada pestaña.
        </p>
      </div>

      {/* Buscador / filtros globales */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-4">
          {/* Fecha desde */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600">
              Desde
            </label>
            <input
              type="date"
              name="fechaDesde"
              value={filtros.fechaDesde}
              onChange={handleFiltroChange}
              className="mt-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
            />
          </div>

          {/* Fecha hasta */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600">
              Hasta
            </label>
            <input
              type="date"
              name="fechaHasta"
              value={filtros.fechaHasta}
              onChange={handleFiltroChange}
              className="mt-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
            />
          </div>

          {/* Centro de costo */}
          <div className="flex flex-col min-w-[220px]">
            <label className="text-xs font-medium text-gray-600">
              Centro de costo
            </label>
            <select
              name="centro_costo_id"
              value={filtros.centro_costo_id}
              onChange={handleFiltroChange}
              className="mt-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
            >
              <option value="">Todos</option>
              {centrosCosto.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Proveedor */}
          <div className="flex flex-col min-w-[260px]">
            <label className="text-xs font-medium text-gray-600">
              Proveedor
            </label>
            <input
              type="text"
              name="proveedor_ruc"
              value={filtros.proveedor_ruc}
              onChange={handleFiltroChange}
              list="proveedores-reporteria"
              placeholder="RUC o raz&oacute;n social"
              className="mt-1 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500"
            />
            <datalist id="proveedores-reporteria">
              {proveedores.map((p) => (
                <option
                  key={p.id}
                  value={p.ruc}
                  label={`${p.razonSocial} - ${p.ruc}`}
                />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-gray-400">
            {cargandoCatalogos ? "Cargando catálogos..." : "Filtros globales"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={limpiarFiltros}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-xs sm:text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Limpiar
            </button>
            {/* En el futuro aquí podríamos tener "Guardar vista" */}
          </div>
        </div>
      </div>

      {/* Pestañas de dashboards */}
      <div>
        <div className="flex flex-wrap gap-2 mb-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDashboardActivo(t.id)}
              className={
                "px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-colors " +
                (dashboardActivo === t.id
                  ? "bg-blue-900 text-white border-blue-900 shadow-sm"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* “Ventanas”: cada dashboard es como una ventana dentro de Reportería */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
          {dashboardActivo === "general" && (
            <DashboardGeneral filtros={filtros} />
          )}

          {dashboardActivo === "caja" && (
            <DashboardCajaChica filtros={filtros} />
          )}

          {dashboardActivo !== "general" && dashboardActivo !== "caja" && (
            <div className="text-sm text-gray-500 py-10 text-center">
              Aún no hemos implementado este dashboard.
              <br />
              Empezaremos por el <strong>Dashboard General</strong> y luego
              iremos habilitando las demás pestañas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reporteria;
