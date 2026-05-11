// src/pages/reportes/DashboardOperaciones.jsx
// Sub-dashboard de Reporteria: focalizado en flujos del area de Operaciones/Proyectos.

import React, { useEffect, useState, useMemo } from "react";
import { obtenerTransaccionesFinancieras, TIPO_TRANSACCION } from "../../firebase/finanzasHelpers";
import KPI from "../../components/charts/KPI";
import MemphisBarChart from "../../components/charts/BarChart";
import MemphisDonutChart from "../../components/charts/DonutChart";
import MemphisAreaChart from "../../components/charts/AreaChart";
import * as XLSX from "xlsx";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const DashboardOperaciones = ({ filtros }) => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        const { transacciones } = await obtenerTransaccionesFinancieras({
          fechaDesde: filtros.fechaDesde || null,
          fechaHasta: filtros.fechaHasta || null,
          centro_costo_id: filtros.centro_costo_id || null,
          pageSize: 10000,
        });
        // Filtrar solo operaciones
        const ops = transacciones.filter((t) => t.area === "operaciones");
        if (activo) setData(ops);
      } catch (e) {
        console.error("Error cargando DashboardOperaciones:", e);
        if (activo) setError("No se pudieron cargar los indicadores de Operaciones.");
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [filtros]);

  // KPIs
  const kpis = useMemo(() => {
    if (!data) return null;
    let ingresos = 0, egresos = 0, pendientes = 0, pagados = 0;
    data.forEach((t) => {
      const pen = Number(t.monto_total_pen ?? t.monto_total ?? 0);
      if (t.tipo === TIPO_TRANSACCION.INGRESO) ingresos += pen;
      else egresos += pen;
      const est = (t.estado || "").toLowerCase();
      if (est === "pagado" || est === "pagada") pagados++;
      else if (est === "pendiente") pendientes++;
    });
    return {
      total: data.length,
      ingresos: +ingresos.toFixed(2),
      egresos: +egresos.toFixed(2),
      neto: +(ingresos - egresos).toFixed(2),
      pendientes,
      pagados,
    };
  }, [data]);

  // Mensual
  const flujoMensual = useMemo(() => {
    if (!data) return [];
    const meses = Array.from({ length: 12 }, (_, i) => ({ label: MESES[i], Ingresos: 0, Egresos: 0, Neto: 0 }));
    data.forEach((t) => {
      const idx = parseInt((t.fechaISO || "").slice(5, 7), 10) - 1;
      if (idx < 0 || idx > 11) return;
      const pen = Number(t.monto_total_pen ?? t.monto_total ?? 0);
      if (t.tipo === TIPO_TRANSACCION.INGRESO) meses[idx].Ingresos += pen;
      else meses[idx].Egresos += pen;
    });
    return meses.map((m) => ({ ...m, Neto: +(m.Ingresos - m.Egresos).toFixed(2), Ingresos: +m.Ingresos.toFixed(2), Egresos: +m.Egresos.toFixed(2) }));
  }, [data]);

  // Top CDCs
  const topCDC = useMemo(() => {
    if (!data) return [];
    const map = {};
    data.forEach((t) => {
      const cc = t.centro_costo_nombre || "Sin CDC";
      if (!map[cc]) map[cc] = 0;
      map[cc] += Number(t.monto_total_pen ?? t.monto_total ?? 0);
    });
    return Object.entries(map)
      .map(([name, Monto]) => ({ name, Monto: +Monto.toFixed(2) }))
      .sort((a, b) => b.Monto - a.Monto)
      .slice(0, 10);
  }, [data]);

  // Top categorias
  const topCats = useMemo(() => {
    if (!data) return [];
    const map = {};
    data.forEach((t) => {
      const cat = t.categoriaNombre || "Sin categoria";
      if (!map[cat]) map[cat] = 0;
      map[cat] += Number(t.monto_total_pen ?? t.monto_total ?? 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  // Estado donut
  const porEstado = useMemo(() => {
    if (!data) return [];
    const map = {};
    data.forEach((t) => {
      const est = t.estado || "Sin estado";
      if (!map[est]) map[est] = { name: est, value: 0 };
      map[est].value++;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [data]);

  // Export
  const handleExportExcel = () => {
    if (!data || data.length === 0) return;
    const rows = data.map((t) => ({
      Fecha: t.fechaISO || "",
      Tipo: t.tipo,
      Moneda: t.moneda,
      "Monto Total": Number(t.monto_total ?? 0).toFixed(2),
      "Monto PEN": Number(t.monto_total_pen ?? t.monto_total ?? 0).toFixed(2),
      Categoria: t.categoriaNombre || "",
      Proveedor: t.proveedor_cliente_nombre || "",
      "Centro de Costo": t.centro_costo_nombre || "",
      Estado: t.estado || "",
      "N OC": t.oc_numero || "",
      Notas: t.notas || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Operaciones");
    XLSX.writeFile(wb, "dashboard_operaciones.xlsx");
  };

  if (cargando && !data) return <div className="py-10 flex justify-center"><span className="text-sm text-gray-500">Cargando indicadores de Operaciones...</span></div>;
  if (error && !data) return <div className="py-10 text-center text-sm text-red-600">{error}</div>;
  if (!data || !kpis) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Dashboard Operaciones</h2>
          <p className="text-xs text-gray-500 mt-1">Flujos financieros del area de Operaciones/Proyectos.</p>
        </div>
        <button type="button" onClick={handleExportExcel}
          className="px-3 py-1.5 rounded-md border border-emerald-500 text-xs sm:text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
          Exportar Excel
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Transacciones" value={kpis.total} type="number" />
        <KPI label="Ingresos (S/)" value={kpis.ingresos} type="currency" currency="PEN" />
        <KPI label="Egresos (S/)" value={kpis.egresos} type="currency" currency="PEN" />
        <KPI label="Flujo Neto (S/)" value={kpis.neto} type="currency" currency="PEN" highlight />
        <KPI label="Pagados" value={kpis.pagados} type="number" />
        <KPI label="Pendientes" value={kpis.pendientes} type="number" />
      </div>

      {/* Flujo mensual */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Flujo Mensual Operaciones</h3>
        <MemphisAreaChart
          data={flujoMensual}
          dataKey="Neto"
          xKey="label"
          secondaryKeys={["Ingresos", "Egresos"]}
          height={220}
          emptyMessage="Sin transacciones de operaciones en el periodo."
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Top Centros de Costo (S/)</h3>
          <MemphisBarChart data={topCDC} dataKey="Monto" xKey="name" height={240} emptyMessage="Sin datos." />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Distribucion por Categoria</h3>
          <MemphisDonutChart data={topCats} dataKey="value" nameKey="name" height={240} emptyMessage="Sin categorias." />
        </div>
      </div>

      {/* Estado donut */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 max-w-md">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Distribucion por Estado</h3>
        <MemphisDonutChart data={porEstado} dataKey="value" nameKey="name" height={200} emptyMessage="Sin datos." />
      </div>
    </div>
  );
};

export default DashboardOperaciones;
