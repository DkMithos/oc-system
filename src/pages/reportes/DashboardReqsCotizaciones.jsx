// src/pages/reportes/DashboardReqsCotizaciones.jsx
// Sub-dashboard de Reporteria: Requerimientos y Cotizaciones.

import React, { useEffect, useState, useMemo } from "react";
import { obtenerRequerimientosAll } from "../../firebase/requerimientosHelpers";
import { obtenerCotizaciones } from "../../firebase/cotizacionesHelpers";
import KPI from "../../components/charts/KPI";
import MemphisBarChart from "../../components/charts/BarChart";
import MemphisDonutChart from "../../components/charts/DonutChart";

const parseFecha = (v) => {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (v instanceof Date) return v;
  return null;
};

const DEMO_REQS = [
  { id:"r1", estado:"Pendiente", solicitanteNombre:"J. García", prioridad:"Alta", creadoEn:"2026-05-10" },
  { id:"r2", estado:"Aprobado", solicitanteNombre:"R. López", prioridad:"Normal", creadoEn:"2026-05-08" },
  { id:"r3", estado:"Pendiente", solicitanteNombre:"A. Torres", prioridad:"Alta", creadoEn:"2026-05-06" },
  { id:"r4", estado:"En proceso", solicitanteNombre:"M. Quispe", prioridad:"Baja", creadoEn:"2026-05-04" },
  { id:"r5", estado:"Aprobado", solicitanteNombre:"J. García", prioridad:"Normal", creadoEn:"2026-04-28" },
  { id:"r6", estado:"Rechazado", solicitanteNombre:"C. Flores", prioridad:"Normal", creadoEn:"2026-04-22" },
  { id:"r7", estado:"Pendiente", solicitanteNombre:"R. López", prioridad:"Alta", creadoEn:"2026-04-18" },
  { id:"r8", estado:"En proceso", solicitanteNombre:"A. Torres", prioridad:"Normal", creadoEn:"2026-04-12" },
];
const DEMO_COTS = [
  { id:"c1", estado:"Aprobada", proveedorNombre:"Ferreyros S.A.", creadoEn:"2026-05-11" },
  { id:"c2", estado:"Pendiente", proveedorNombre:"Komatsu Mitsui", creadoEn:"2026-05-09" },
  { id:"c3", estado:"Aprobada", proveedorNombre:"Epiroc Perú", creadoEn:"2026-05-07" },
  { id:"c4", estado:"Rechazada", proveedorNombre:"SKF del Perú", creadoEn:"2026-05-03" },
  { id:"c5", estado:"Pendiente", proveedorNombre:"Ferreyros S.A.", creadoEn:"2026-04-29" },
  { id:"c6", estado:"Aprobada", proveedorNombre:"Suministros Técnicos", creadoEn:"2026-04-24" },
  { id:"c7", estado:"Pendiente", proveedorNombre:"Komatsu Mitsui", creadoEn:"2026-04-20" },
];

const DashboardReqsCotizaciones = ({ filtros }) => {
  const [reqs, setReqs] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [esDemo, setEsDemo] = useState(false);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        const [r, c] = await Promise.all([
          obtenerRequerimientosAll(),
          obtenerCotizaciones(),
        ]);
        if (!activo) return;
        if ((!r || r.length === 0) || (!c || c.length === 0)) {
          setReqs(DEMO_REQS);
          setCotizaciones(DEMO_COTS);
          setEsDemo(true);
        } else {
          setReqs(r || []);
          setCotizaciones(c || []);
          setEsDemo(false);
        }
      } catch (e) {
        console.error("Error cargando DashboardReqsCotizaciones:", e);
        if (activo) setError("No se pudieron cargar los datos de requerimientos/cotizaciones.");
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [filtros]);

  // Filtrar por fechas si aplican
  const reqsFiltrados = useMemo(() => {
    const desde = filtros.fechaDesde ? new Date(filtros.fechaDesde + "T00:00:00") : null;
    const hasta = filtros.fechaHasta ? new Date(filtros.fechaHasta + "T23:59:59") : null;
    return reqs.filter((r) => {
      const f = parseFecha(r.creadoEn || r.fecha);
      if (!f) return true; // si no tiene fecha, incluir
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }, [reqs, filtros]);

  const cotFiltradas = useMemo(() => {
    const desde = filtros.fechaDesde ? new Date(filtros.fechaDesde + "T00:00:00") : null;
    const hasta = filtros.fechaHasta ? new Date(filtros.fechaHasta + "T23:59:59") : null;
    return cotizaciones.filter((c) => {
      const f = parseFecha(c.creadoEn || c.fecha);
      if (!f) return true;
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }, [cotizaciones, filtros]);

  // Reqs por estado
  const reqsPorEstado = useMemo(() => {
    const map = {};
    reqsFiltrados.forEach((r) => {
      const est = r.estado || "Sin estado";
      if (!map[est]) map[est] = { name: est, value: 0 };
      map[est].value++;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [reqsFiltrados]);

  // Reqs por solicitante
  const reqsPorSolicitante = useMemo(() => {
    const map = {};
    reqsFiltrados.forEach((r) => {
      const sol = r.solicitanteNombre || r.solicitante || r.creadoPor || "Sin asignar";
      if (!map[sol]) map[sol] = { name: sol, Cantidad: 0 };
      map[sol].Cantidad++;
    });
    return Object.values(map).sort((a, b) => b.Cantidad - a.Cantidad).slice(0, 10);
  }, [reqsFiltrados]);

  // Reqs por prioridad
  const reqsPorPrioridad = useMemo(() => {
    const map = {};
    reqsFiltrados.forEach((r) => {
      const p = r.prioridad || r.urgencia || "Normal";
      if (!map[p]) map[p] = { name: p, value: 0 };
      map[p].value++;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [reqsFiltrados]);

  // Cotizaciones por estado
  const cotPorEstado = useMemo(() => {
    const map = {};
    cotFiltradas.forEach((c) => {
      const est = c.estado || "Sin estado";
      if (!map[est]) map[est] = { name: est, value: 0 };
      map[est].value++;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [cotFiltradas]);

  // Cotizaciones por proveedor
  const cotPorProveedor = useMemo(() => {
    const map = {};
    cotFiltradas.forEach((c) => {
      const prov = c.proveedorNombre || c.proveedor?.razonSocial || c.proveedor || "Sin proveedor";
      if (!map[prov]) map[prov] = { name: prov, Cantidad: 0 };
      map[prov].Cantidad++;
    });
    return Object.values(map).sort((a, b) => b.Cantidad - a.Cantidad).slice(0, 10);
  }, [cotFiltradas]);

  if (cargando) return <div className="py-10 flex justify-center"><span className="text-sm text-gray-500">Cargando requerimientos y cotizaciones...</span></div>;
  if (error) return <div className="py-10 text-center text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      {esDemo && (
        <p className="text-[10px] text-gray-400 italic text-center">
          Vista previa con datos de ejemplo — no hay requerimientos ni cotizaciones registrados.
        </p>
      )}
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Requerimientos y Cotizaciones</h2>
        <p className="text-xs text-gray-500 mt-1">Estado actual de solicitudes internas de compra y cotizaciones de proveedores.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Total Requerimientos" value={reqsFiltrados.length} type="number" />
        <KPI label="Reqs Pendientes" value={reqsFiltrados.filter((r) => (r.estado || "").toLowerCase().includes("pendiente")).length} type="number" />
        <KPI label="Total Cotizaciones" value={cotFiltradas.length} type="number" />
        <KPI label="Cotizaciones Aprobadas" value={cotFiltradas.filter((c) => (c.estado || "").toLowerCase().includes("aprobad")).length} type="number" />
      </div>

      {/* Requerimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Requerimientos por Estado</h3>
          <MemphisDonutChart data={reqsPorEstado} dataKey="value" nameKey="name" height={220} emptyMessage="Sin requerimientos." />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Top Solicitantes</h3>
          <MemphisBarChart data={reqsPorSolicitante} dataKey="Cantidad" xKey="name" height={220} emptyMessage="Sin datos." />
        </div>
      </div>

      {reqsPorPrioridad.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 max-w-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Requerimientos por Prioridad</h3>
          <MemphisDonutChart data={reqsPorPrioridad} dataKey="value" nameKey="name" height={200} emptyMessage="Sin datos." />
        </div>
      )}

      {/* Cotizaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Cotizaciones por Estado</h3>
          <MemphisDonutChart data={cotPorEstado} dataKey="value" nameKey="name" height={220} emptyMessage="Sin cotizaciones." />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Top Proveedores Cotizados</h3>
          <MemphisBarChart data={cotPorProveedor} dataKey="Cantidad" xKey="name" height={220} emptyMessage="Sin datos." />
        </div>
      </div>
    </div>
  );
};

export default DashboardReqsCotizaciones;
