// ✅ src/pages/reportes/DashboardFinanzas.jsx
import React, { useEffect, useState } from "react";
import { obtenerIndicadoresFinanzas } from "../../firebase/reportesHelpers";

// Memphis Charts
import KPI from "../../components/charts/KPI";
import MemphisAreaChart from "../../components/charts/AreaChart";
import MemphisBarChart from "../../components/charts/BarChart";
import MemphisDonutChart from "../../components/charts/DonutChart";

// Export helpers
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const DashboardFinanzas = ({ filtros }) => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        const res = await obtenerIndicadoresFinanzas(filtros);
        if (!activo) return;
        setData(res);
      } catch (e) {
        console.error("Error cargando indicadores de Finanzas:", e);
        if (activo) setError("No se pudieron cargar los indicadores de Finanzas.");
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
    const { resumenFinanzas, ultimas } = data;

    const rows = [
      { Indicador: "Ingresos PEN", Valor: resumenFinanzas.ingresosPen },
      { Indicador: "Egresos PEN", Valor: resumenFinanzas.egresosPen },
      { Indicador: "Flujo neto PEN", Valor: resumenFinanzas.netoPen },
      { Indicador: "Ingresos USD", Valor: resumenFinanzas.ingresosUsd },
      { Indicador: "Egresos USD", Valor: resumenFinanzas.egresosUsd },
      { Indicador: "Flujo neto USD", Valor: resumenFinanzas.netoUsd },
      { Indicador: "CAPEX PEN", Valor: resumenFinanzas.capexPen },
      { Indicador: "OPEX PEN", Valor: resumenFinanzas.opexPen },
      { Indicador: "CAPEX USD", Valor: resumenFinanzas.capexUsd },
      { Indicador: "OPEX USD", Valor: resumenFinanzas.opexUsd },
      {
        Indicador: "Total transacciones",
        Valor: resumenFinanzas.totalTransacciones,
      },
      {},
      {
        Indicador: "Fecha",
        Tipo: "Tipo",
        Clasificacion: "Clasificación",
        Moneda: "Moneda",
        Monto: "Monto",
        Categoría: "Categoría",
        "Centro de costo": "Centro de costo",
        "Forma de pago": "Forma de pago",
        Estado: "Estado",
        Documento: "Documento",
        "N° OC": "N° OC",
        Notas: "Notas",
      },
      ...ultimas.map((t) => ({
        Indicador: t.fechaISO || "",
        Tipo: t.tipo,
        Clasificacion: t.clasificacion,
        Moneda: t.moneda,
        Monto: t.monto,
        Categoría: t.categoria,
        "Centro de costo": t.centroCosto,
        "Forma de pago": t.formaPago,
        Estado: t.estado,
        Documento: t.documento,
        "N° OC": t.ocNumero,
        Notas: t.notas,
      })),
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Finanzas");
    XLSX.writeFile(wb, "dashboard_finanzas.xlsx");
  };

  const handleExportPDF = () => {
    if (!data) return;
    const { resumenFinanzas, ultimas } = data;

    const doc = new jsPDF("landscape", "pt", "a4");

    doc.setFontSize(14);
    doc.text("Dashboard Finanzas - Sistema de Gestión Memphis", 40, 40);

    doc.setFontSize(10);
    doc.text(
      `Periodo: ${filtros.fechaDesde || "-"} a ${filtros.fechaHasta || "-"}`,
      40,
      60
    );

    doc.text(
      `Flujo neto PEN: ${resumenFinanzas.netoPen.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}   |   Flujo neto USD: ${resumenFinanzas.netoUsd.toLocaleString(
        "es-PE",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}`,
      40,
      78
    );

    const head = [
      [
        "Fecha",
        "Tipo",
        "Clasificación",
        "Moneda",
        "Monto",
        "Categoría",
        "Centro de costo",
        "Forma de pago",
        "Estado",
        "Documento",
        "N° OC",
        "Notas",
      ],
    ];

    const body = ultimas.map((t) => [
      t.fechaISO || "",
      t.tipo,
      t.clasificacion,
      t.moneda,
      t.monto.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      t.categoria,
      t.centroCosto,
      t.formaPago,
      t.estado,
      t.documento,
      t.ocNumero,
      t.notas,
    ]);

    doc.autoTable({
      head,
      body,
      startY: 100,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 73, 144] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save("dashboard_finanzas.pdf");
  };

  if (cargando && !data) {
    return (
      <div className="py-10 flex justify-center">
        <span className="text-sm text-gray-500">
          Cargando indicadores de Finanzas...
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
    resumenFinanzas,
    flujoMensualPen,
    flujoMensualUsd,
    rankingCategorias,
    rankingCentrosCosto,
    porFormaPago,
    ultimas,
  } = data;

  // Data para gráficos
  const flujoPenData = flujoMensualPen.map((m) => ({
    label: m.label,
    Ingresos: m.ingresos,
    Egresos: m.egresos,
    Neto: m.neto,
  }));

  const flujoUsdData = flujoMensualUsd.map((m) => ({
    label: m.label,
    Ingresos: m.ingresos,
    Egresos: m.egresos,
    Neto: m.neto,
  }));

  const capexOpexPenData = [
    { name: "CAPEX", Valor: resumenFinanzas.capexPen },
    { name: "OPEX", Valor: resumenFinanzas.opexPen },
  ];

  const capexOpexUsdData = [
    { name: "CAPEX", Valor: resumenFinanzas.capexUsd },
    { name: "OPEX", Valor: resumenFinanzas.opexUsd },
  ];

  const rankingCategoriasData = rankingCategorias.map((c) => ({
    name: c.categoria,
    Neto: c.netoGlobal,
  }));

  const rankingCCData = rankingCentrosCosto.map((c) => ({
    name: c.centroCosto,
    Neto: c.netoGlobal,
  }));

  const formaPagoData = porFormaPago.map((f) => ({
    name: f.formaPago,
    Neto: f.netoGlobal,
  }));

  return (
    <div className="space-y-4">
      {/* Encabezado + export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Dashboard Finanzas
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Flujo de ingresos y egresos, CAPEX/OPEX y distribución por categoría
            y centro de costo.
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

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI
          label="Ingresos PEN"
          value={resumenFinanzas.ingresosPen}
          type="currency"
          currency="PEN"
        />
        <KPI
          label="Egresos PEN"
          value={resumenFinanzas.egresosPen}
          type="currency"
          currency="PEN"
        />
        <KPI
          label="Flujo neto PEN"
          value={resumenFinanzas.netoPen}
          type="currency"
          currency="PEN"
          highlight
        />
        <KPI
          label="Ingresos USD"
          value={resumenFinanzas.ingresosUsd}
          type="currency"
          currency="USD"
        />
        <KPI
          label="Egresos USD"
          value={resumenFinanzas.egresosUsd}
          type="currency"
          currency="USD"
        />
        <KPI
          label="Flujo neto USD"
          value={resumenFinanzas.netoUsd}
          type="currency"
          currency="USD"
          highlight
        />
      </div>

      {/* Flujo mensual PEN / USD */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Flujo mensual (PEN)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Ingresos, egresos y flujo neto mensual en soles.
          </p>
          <MemphisAreaChart
            data={flujoPenData}
            dataKey="Neto"
            xKey="label"
            secondaryKeys={["Ingresos", "Egresos"]}
            height={220}
            emptyMessage="No hay transacciones en PEN en el periodo."
          />
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Flujo mensual (USD)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Ingresos, egresos y flujo neto mensual en dólares.
          </p>
          <MemphisAreaChart
            data={flujoUsdData}
            dataKey="Neto"
            xKey="label"
            secondaryKeys={["Ingresos", "Egresos"]}
            height={220}
            emptyMessage="No hay transacciones en USD en el periodo."
          />
        </div>
      </div>

      {/* CAPEX vs OPEX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            CAPEX vs OPEX (PEN)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Distribución de CAPEX y OPEX en soles.
          </p>
          <MemphisDonutChart
            data={capexOpexPenData}
            dataKey="Valor"
            nameKey="name"
            height={220}
            emptyMessage="No hay movimientos clasificados en PEN."
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            CAPEX vs OPEX (USD)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Distribución de CAPEX y OPEX en dólares.
          </p>
          <MemphisDonutChart
            data={capexOpexUsdData}
            dataKey="Valor"
            nameKey="name"
            height={220}
            emptyMessage="No hay movimientos clasificados en USD."
          />
        </div>
      </div>

      {/* Ranking categorías / centros de costo */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Top categorías (neto PEN + USD)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Categorías con mayor impacto neto (positivo o negativo).
          </p>
          <MemphisBarChart
            data={rankingCategoriasData}
            dataKey="Neto"
            xKey="name"
            height={240}
            emptyMessage="No hay categorías con movimientos."
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Top centros de costo (neto PEN + USD)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Centros de costo con mayor impacto en el flujo financiero.
          </p>
          <MemphisBarChart
            data={rankingCCData}
            dataKey="Neto"
            xKey="name"
            height={240}
            emptyMessage="No hay centros de costo con movimientos."
          />
        </div>
      </div>

      {/* Forma de pago + tabla últimas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Distribución por forma de pago
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Impacto neto por forma de pago (transferencia, efectivo, etc.).
          </p>
          <MemphisBarChart
            data={formaPagoData}
            dataKey="Neto"
            xKey="name"
            height={240}
            emptyMessage="No hay movimientos con forma de pago registrada."
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Últimas transacciones financieras
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 uppercase text-gray-500">
                  <th className="px-2 py-1 text-left">Fecha</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-left">Clasificación</th>
                  <th className="px-2 py-1 text-left">Moneda</th>
                  <th className="px-2 py-1 text-right">Monto</th>
                  <th className="px-2 py-1 text-left">Categoría</th>
                  <th className="px-2 py-1 text-left">Centro de costo</th>
                </tr>
              </thead>
              <tbody>
                {ultimas.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center text-gray-400 py-4"
                    >
                      No hay transacciones registradas.
                    </td>
                  </tr>
                )}
                {ultimas.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-2 py-1 align-middle">
                      {t.fechaISO || "-"}
                    </td>
                    <td className="px-2 py-1 align-middle">{t.tipo}</td>
                    <td className="px-2 py-1 align-middle">
                      {t.clasificacion}
                    </td>
                    <td className="px-2 py-1 align-middle">{t.moneda}</td>
                    <td className="px-2 py-1 align-middle text-right">
                      {t.monto.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-1 align-middle">
                      {t.categoria}
                    </td>
                    <td className="px-2 py-1 align-middle">
                      {t.centroCosto}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFinanzas;
