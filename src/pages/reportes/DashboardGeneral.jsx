// ✅ src/pages/reportes/DashboardGeneral.jsx
import React, { useEffect, useState } from "react";
import { obtenerIndicadoresDashboardGeneral } from "../../firebase/reportesHelpers";

// Export helpers
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Memphis Charts
import KPI from "../../components/charts/KPI";
import MemphisAreaChart from "../../components/charts/AreaChart";
import MemphisBarChart from "../../components/charts/BarChart";
import MemphisDonutChart from "../../components/charts/DonutChart";

const DashboardGeneral = ({ filtros }) => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        const res = await obtenerIndicadoresDashboardGeneral(filtros);
        if (!activo) return;
        setData(res);
      } catch (e) {
        console.error("Error cargando indicadores generales:", e);
        if (activo) setError("No se pudieron cargar los indicadores.");
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();
    return () => {
      activo = false;
    };
  }, [filtros]);

  const handleExportExcel = () => {
    if (!data) return;

    const { resumenOC, ultimasOC } = data;

    const rows = [
      { Indicador: "Total de OCs", Valor: resumenOC.totalOC },
      { Indicador: "Monto OC PEN", Valor: resumenOC.totalMontoPen },
      { Indicador: "Monto OC USD", Valor: resumenOC.totalMontoUsd },
      {
        Indicador: "Monto Global (PEN)",
        Valor: resumenOC.totalGlobalPen,
      },
      {
        Indicador: "Tiempo prom. aprobación (h)",
        Valor: resumenOC.tiempoPromedioHoras ?? "",
      },
      {},
      {
        Indicador: "Fecha",
        "N° OC": "N° OC",
        Proveedor: "Proveedor",
        "Centro de costo": "Centro de costo",
        Estado: "Estado",
        Moneda: "Moneda",
        "Monto PEN": "Monto PEN",
        "Monto USD": "Monto USD",
      },
      ...ultimasOC.map((oc) => ({
        Indicador: oc.fechaISO || "",
        "N° OC": oc.numeroOC,
        Proveedor: oc.proveedor,
        "Centro de costo": oc.centroCosto,
        Estado: oc.estado,
        Moneda: oc.moneda,
        "Monto PEN": oc.totalPen,
        "Monto USD": oc.totalUsd,
      })),
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard_General");
    XLSX.writeFile(wb, "dashboard_general_oc.xlsx");
  };

  const handleExportPDF = () => {
    if (!data) return;

    const { resumenOC, ultimasOC } = data;

    const doc = new jsPDF("landscape", "pt", "a4");

    doc.setFontSize(14);
    doc.text("Dashboard General - Sistema de Gestión Memphis", 40, 40);

    doc.setFontSize(10);
    doc.text(
      `Periodo: ${filtros.fechaDesde || "-"} a ${filtros.fechaHasta || "-"}`,
      40,
      60
    );

    doc.text(
      `Total OCs: ${resumenOC.totalOC}   |   PEN: ${resumenOC.totalMontoPen.toLocaleString(
        "es-PE",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}   |   USD: ${resumenOC.totalMontoUsd.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}   |   Tiempo prom. aprobación: ${
        resumenOC.tiempoPromedioHoras ?? "-"
      } h`,
      40,
      78
    );

    const head = [
      [
        "Fecha",
        "N° OC",
        "Proveedor",
        "Centro de costo",
        "Estado",
        "Moneda",
        "Monto PEN",
        "Monto USD",
      ],
    ];

    const body = ultimasOC.map((oc) => [
      oc.fechaISO || "",
      oc.numeroOC,
      oc.proveedor,
      oc.centroCosto,
      oc.estado,
      oc.moneda,
      oc.totalPen.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      oc.totalUsd.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ]);

    doc.autoTable({
      head,
      body,
      startY: 100,
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: [0, 73, 144],
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
    });

    doc.save("dashboard_general_oc.pdf");
  };

  if (cargando && !data) {
    return (
      <div className="py-10 flex justify-center">
        <span className="text-sm text-gray-500">
          Cargando indicadores...
        </span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="py-10 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const {
    resumenOC,
    comprasMensuales,
    rankingProveedores,
    rankingCentrosCosto,
    ultimasOC,
  } = data;

  const comprasPen = comprasMensuales.map((m) => ({
    label: m.label,
    total: m.totalPen,
  }));

  const comprasUsd = comprasMensuales.map((m) => ({
    label: m.label,
    total: m.totalUsd,
  }));

  const comprasGlobal = comprasMensuales.map((m) => ({
    label: m.label,
    total: m.totalGlobalPen,
  }));

  const rankingProveedoresGlobal = rankingProveedores.map((p) => ({
    nombre: p.nombre,
    total: p.totalGlobalPen,
  }));

  const rankingCentrosCostoGlobal = rankingCentrosCosto.map((c) => ({
    nombre: c.nombre,
    total: c.totalGlobalPen,
  }));

  const porTipoOrdenChart = resumenOC.porTipoOrden.map((t) => ({
    nombre: t.tipoOrden,
    total: t.totalGlobalPen,
  }));

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Dashboard General
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Vista consolidada de órdenes de compra (PEN / USD) en el periodo
            seleccionado.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 rounded-md border border-emerald-500 text-xs sm:text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          >
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-md border border-blue-600 text-xs sm:text-sm text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPIs — multi moneda + tiempo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KPI
          titulo="Órdenes de compra"
          valor={resumenOC.totalOC}
          tipo="numero"
          subtitulo="Total de OCs creadas"
          variant="primary"
        />
        <KPI
          titulo="Monto OC PEN"
          valor={resumenOC.totalMontoPen}
          tipo="moneda"
          currency="PEN"
          subtitulo="Suma de OCs en soles"
          variant="secondary"
        />
        <KPI
          titulo="Monto OC USD"
          valor={resumenOC.totalMontoUsd}
          tipo="moneda"
          currency="USD"
          subtitulo="Suma de OCs en dólares"
          variant="secondary"
        />
        <KPI
          titulo="Tiempo prom. aprobación"
          valor={resumenOC.tiempoPromedioHoras ?? 0}
          tipo="horas"
          subtitulo="De creación a aprobación de gerencia"
          variant="success"
        />
      </div>

      {/* Gráficos de compras mensuales (Global vs PEN vs USD) + estados */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Global (PEN equivalente) */}
        <div className="col-span-1 xl:col-span-2 bg-slate-50 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Compras por mes (Global en PEN)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Monto total global (PEN + USD convertido) de órdenes de compra por
            mes.
          </p>
          {comprasGlobal.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-10">
              No hay compras en el periodo seleccionado.
            </div>
          ) : (
            <MemphisAreaChart
              data={comprasGlobal}
              xKey="label"
              yKey="total"
              descripcion="Mes"
              height={220}
            />
          )}
        </div>

        {/* Estados */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Órdenes por estado
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Cantidad de OCs según su estado actual.
          </p>

          <MemphisDonutChart
            data={resumenOC.porEstado}
            valueKey="cantidad"
            nameKey="estado"
          />
        </div>
      </div>

      {/* Compras PEN / USD por mes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Compras mensuales en PEN
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Solo órdenes registradas en moneda PEN.
          </p>
          {comprasPen.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">
              No hay datos.
            </div>
          ) : (
            <MemphisAreaChart
              data={comprasPen}
              xKey="label"
              yKey="total"
              descripcion="Mes"
              height={200}
            />
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Compras mensuales en USD
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Solo órdenes registradas en moneda USD.
          </p>
          {comprasUsd.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">
              No hay datos.
            </div>
          ) : (
            <MemphisAreaChart
              data={comprasUsd}
              xKey="label"
              yKey="total"
              descripcion="Mes"
              height={200}
            />
          )}
        </div>
      </div>

      {/* Rankings y tipos de orden */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Proveedores */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 xl:col-span-1">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Top proveedores (Global PEN)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Ranking por monto equivalente en PEN (PEN + USD con TC).
          </p>

          {rankingProveedoresGlobal.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">
              No hay datos.
            </div>
          ) : (
            <MemphisBarChart
              data={rankingProveedoresGlobal}
              xKey="nombre"
              yKey="total"
              layout="vertical"
            />
          )}
        </div>

        {/* Centros de costo */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 xl:col-span-1">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Top centros de costo (Global PEN)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Centros de costo con mayor monto de compras.
          </p>

          {rankingCentrosCostoGlobal.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">
              No hay datos.
            </div>
          ) : (
            <MemphisBarChart
              data={rankingCentrosCostoGlobal}
              xKey="nombre"
              yKey="total"
              layout="vertical"
            />
          )}
        </div>

        {/* Tipos de orden */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 xl:col-span-1">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Órdenes por tipo
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Compra vs Servicio vs Interna (monto global en PEN).
          </p>

          {porTipoOrdenChart.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">
              No hay datos.
            </div>
          ) : (
            <MemphisBarChart
              data={porTipoOrdenChart}
              xKey="nombre"
              yKey="total"
              layout="horizontal"
            />
          )}
        </div>
      </div>

      {/* Tabla de últimas OC */}
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Últimas órdenes de compra
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="px-2 py-1 text-left">Fecha</th>
                <th className="px-2 py-1 text-left">N° OC</th>
                <th className="px-2 py-1 text-left">Proveedor</th>
                <th className="px-2 py-1 text-left">Centro de costo</th>
                <th className="px-2 py-1 text-left">Tipo</th>
                <th className="px-2 py-1 text-left">Estado</th>
                <th className="px-2 py-1 text-left">Moneda</th>
                <th className="px-2 py-1 text-right">Monto PEN</th>
                <th className="px-2 py-1 text-right">Monto USD</th>
              </tr>
            </thead>
            <tbody>
              {ultimasOC.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center text-gray-400 py-4"
                  >
                    No hay órdenes registradas.
                  </td>
                </tr>
              )}
              {ultimasOC.map((oc) => (
                <tr
                  key={oc.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-2 py-1 align-middle">
                    {oc.fechaISO || "-"}
                  </td>
                  <td className="px-2 py-1 align-middle font-medium text-blue-800">
                    {oc.numeroOC}
                  </td>
                  <td className="px-2 py-1 align-middle">
                    {oc.proveedor}
                  </td>
                  <td className="px-2 py-1 align-middle">
                    {oc.centroCosto}
                  </td>
                  <td className="px-2 py-1 align-middle">
                    {oc.tipoOrden}
                  </td>
                  <td className="px-2 py-1 align-middle">
                    <EstadoPill estado={oc.estado} />
                  </td>
                  <td className="px-2 py-1 align-middle">
                    {oc.moneda}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {oc.totalPen.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-2 py-1 align-middle text-right">
                    {oc.totalUsd.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const EstadoPill = ({ estado }) => {
  const e = String(estado || "").toLowerCase();
  let colorClasses =
    "bg-gray-100 text-gray-700 border border-gray-200";

  if (e.includes("aprob")) {
    colorClasses =
      "bg-emerald-50 text-emerald-700 border border-emerald-200";
  } else if (e.includes("pend")) {
    colorClasses =
      "bg-amber-50 text-amber-700 border border-amber-200";
  } else if (e.includes("rechaz") || e.includes("anula")) {
    colorClasses = "bg-red-50 text-red-700 border border-red-200";
  }

  return (
    <span
      className={
        "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium " +
        colorClasses
      }
    >
      {estado || "Sin estado"}
    </span>
  );
};

export default DashboardGeneral;
