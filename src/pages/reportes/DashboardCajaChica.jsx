// ✅ src/pages/reportes/DashboardCajaChica.jsx
import React, { useEffect, useState } from "react";
import {
  obtenerIndicadoresCajaChica,
} from "../../firebase/reportesHelpers";

// Importa tu librería de gráficos Memphis
import KPI from "../../components/charts/KPI";
import MemphisAreaChart from "../../components/charts/AreaChart";
import MemphisBarChart from "../../components/charts/BarChart";
import MemphisDonutChart from "../../components/charts/DonutChart";

// Export helpers
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const DEMO_CAJA = {
  resumenCajaChica: {
    ingresosPen: 28500, egresosPen: 19800, saldoPen: 8700,
    ingresosUsd: 3200, egresosUsd: 2100, saldoUsd: 1100,
    totalMovimientos: 64,
  },
  porCaja: [
    { cajaId: "Caja Principal", saldoPen: 4800, saldoUsd: 800 },
    { cajaId: "Caja Obras", saldoPen: 2400, saldoUsd: 300 },
    { cajaId: "Caja Admin", saldoPen: 1500, saldoUsd: 0 },
  ],
  rankingCentrosCosto: [
    { nombre: "Mina Norte", saldoGlobal: 4200 },
    { nombre: "Planta Central", saldoGlobal: 3100 },
    { nombre: "Logística", saldoGlobal: 2800 },
    { nombre: "Administración", saldoGlobal: 1600 },
  ],
  egresosMensuales: [
    { label: "Dic 2025", pen: 2800, usd: 300 },
    { label: "Ene 2026", pen: 3200, usd: 350 },
    { label: "Feb 2026", pen: 3600, usd: 400 },
    { label: "Mar 2026", pen: 4100, usd: 420 },
    { label: "Abr 2026", pen: 3800, usd: 380 },
    { label: "May 2026", pen: 2300, usd: 250 },
  ],
  ultimosMovs: [
    { id:"m1", cajaId:"Caja Principal", fechaISO:"2026-05-12", tipo:"Egreso", moneda:"PEN", monto:850, centroCosto:"Mina Norte", descripcion:"Compra de combustible emergencia", creadoPor:"J. García" },
    { id:"m2", cajaId:"Caja Obras", fechaISO:"2026-05-10", tipo:"Egreso", moneda:"PEN", monto:420, centroCosto:"Planta Central", descripcion:"Materiales ferretería", creadoPor:"R. López" },
    { id:"m3", cajaId:"Caja Principal", fechaISO:"2026-05-09", tipo:"Ingreso", moneda:"PEN", monto:5000, centroCosto:"Administración", descripcion:"Reposición fondos", creadoPor:"A. Torres" },
    { id:"m4", cajaId:"Caja Admin", fechaISO:"2026-05-07", tipo:"Egreso", moneda:"PEN", monto:280, centroCosto:"Administración", descripcion:"Útiles de oficina", creadoPor:"M. Quispe" },
    { id:"m5", cajaId:"Caja Obras", fechaISO:"2026-05-05", tipo:"Egreso", moneda:"USD", monto:180, centroCosto:"Logística", descripcion:"Repuesto importado urgente", creadoPor:"J. García" },
  ],
};

const DashboardCajaChica = ({ filtros }) => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [esDemo, setEsDemo] = useState(false);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        const res = await obtenerIndicadoresCajaChica(filtros);
        if (!activo) return;
        if (!res || ((res.resumenCajaChica?.ingresosPen ?? 0) + (res.resumenCajaChica?.egresosPen ?? 0)) < 100) {
          setData(DEMO_CAJA);
          setEsDemo(true);
        } else {
          setData(res);
          setEsDemo(false);
        }
      } catch (e) {
        console.error("Error cargando indicadores de Caja Chica:", e);
        if (activo) setError("No se pudieron cargar los indicadores de Caja Chica.");
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
    const { resumenCajaChica, ultimosMovs } = data;

    const rows = [
      {
        Indicador: "Ingresos PEN",
        Valor: resumenCajaChica.ingresosPen,
      },
      {
        Indicador: "Egresos PEN",
        Valor: resumenCajaChica.egresosPen,
      },
      {
        Indicador: "Saldo PEN",
        Valor: resumenCajaChica.saldoPen,
      },
      {
        Indicador: "Ingresos USD",
        Valor: resumenCajaChica.ingresosUsd,
      },
      {
        Indicador: "Egresos USD",
        Valor: resumenCajaChica.egresosUsd,
      },
      {
        Indicador: "Saldo USD",
        Valor: resumenCajaChica.saldoUsd,
      },
      {
        Indicador: "Total movimientos",
        Valor: resumenCajaChica.totalMovimientos,
      },
      {},
      {
        Indicador: "Fecha",
        Caja: "Caja",
        Tipo: "Tipo",
        Moneda: "Moneda",
        Monto: "Monto",
        "Centro de costo": "Centro de costo",
        Descripción: "Descripción",
        "Creado por": "Creado por",
      },
      ...ultimosMovs.map((m) => ({
        Indicador: m.fechaISO || "",
        Caja: m.cajaId,
        Tipo: m.tipo,
        Moneda: m.moneda,
        Monto: m.monto,
        "Centro de costo": m.centroCosto,
        Descripción: m.descripcion,
        "Creado por": m.creadoPor,
      })),
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CajaChica");
    XLSX.writeFile(wb, "dashboard_caja_chica.xlsx");
  };

  const handleExportPDF = () => {
    if (!data) return;
    const { resumenCajaChica, ultimosMovs } = data;

    const doc = new jsPDF("landscape", "pt", "a4");

    doc.setFontSize(14);
    doc.text("Dashboard Caja Chica - Sistema de Gestión Memphis", 40, 40);

    doc.setFontSize(10);
    doc.text(
      `Periodo: ${filtros.fechaDesde || "-"} a ${filtros.fechaHasta || "-"}`,
      40,
      60
    );

    doc.text(
      `Saldo PEN: ${resumenCajaChica.saldoPen.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}   |   Saldo USD: ${resumenCajaChica.saldoUsd.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      40,
      78
    );

    const head = [
      [
        "Fecha",
        "Caja",
        "Tipo",
        "Moneda",
        "Monto",
        "Centro de costo",
        "Descripción",
        "Creado por",
      ],
    ];

    const body = ultimosMovs.map((m) => [
      m.fechaISO || "",
      m.cajaId,
      m.tipo,
      m.moneda,
      m.monto.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      m.centroCosto,
      m.descripcion,
      m.creadoPor,
    ]);

    doc.autoTable({
      head,
      body,
      startY: 100,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 73, 144] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save("dashboard_caja_chica.pdf");
  };

  if (cargando && !data) {
    return (
      <div className="py-10 flex justify-center">
        <span className="text-sm text-gray-500">
          Cargando indicadores de Caja Chica...
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

  const { resumenCajaChica, porCaja, rankingCentrosCosto, egresosMensuales, ultimosMovs } = data;

  // Dataset para donut PEN / USD global
  const saldoGlobalData = [
    {
      name: "Saldo PEN",
      value: resumenCajaChica.saldoPen,
    },
    {
      name: "Saldo USD",
      value: resumenCajaChica.saldoUsd,
    },
  ].filter((x) => Math.abs(x.value) > 0.01);

  // Dataset para barras por caja (PEN)
  const porCajaPen = porCaja.map((c) => ({
    name: c.cajaId,
    Saldo: c.saldoPen,
  }));

  // Dataset para barras por caja (USD)
  const porCajaUsd = porCaja.map((c) => ({
    name: c.cajaId,
    Saldo: c.saldoUsd,
  }));

  // Dataset egresos mensuales por moneda
  const egresosMensualesPen = egresosMensuales.map((m) => ({
    label: m.label,
    Monto: m.pen,
  }));
  const egresosMensualesUsd = egresosMensuales.map((m) => ({
    label: m.label,
    Monto: m.usd,
  }));

  return (
    <div className="space-y-4">
      {esDemo && (
        <p className="text-[10px] text-gray-400 italic text-center">
          Vista previa con datos de ejemplo — no hay movimientos de Caja Chica en el periodo seleccionado.
        </p>
      )}
      {/* Encabezado y exportaciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Dashboard Caja Chica
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Saldos, movimientos y distribución de gastos por caja y centro de costo.
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <KPI
          label="Saldo total PEN"
          value={resumenCajaChica.saldoPen}
          type="currency"
          currency="PEN"
        />
        <KPI
          label="Saldo total USD"
          value={resumenCajaChica.saldoUsd}
          type="currency"
          currency="USD"
        />
        <KPI
          label="Egresos (PEN)"
          value={resumenCajaChica.egresosPen}
          type="currency"
          currency="PEN"
          subtle
        />
        <KPI
          label="Egresos (USD)"
          value={resumenCajaChica.egresosUsd}
          type="currency"
          currency="USD"
          subtle
        />
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Egresos por mes PEN */}
        <div className="xl:col-span-2 bg-slate-50 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Egresos mensuales (PEN)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Gasto mensual de Caja Chica en soles.
          </p>
          <MemphisAreaChart
            data={egresosMensualesPen}
            dataKey="Monto"
            xKey="label"
            height={220}
            emptyMessage="No hay egresos en el periodo."
          />
        </div>

        {/* Donut saldos PEN vs USD */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Distribución de saldos por moneda
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Saldos globales de Caja Chica por tipo de moneda.
          </p>
          <MemphisDonutChart
            data={saldoGlobalData}
            dataKey="value"
            nameKey="name"
            height={220}
            emptyMessage="No hay saldos registrados."
          />
        </div>
      </div>

      {/* Por caja PEN / USD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Saldos por caja (PEN)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Saldo en soles por cada caja chica.
          </p>
          <MemphisBarChart
            data={porCajaPen}
            dataKey="Saldo"
            xKey="name"
            height={220}
            emptyMessage="No hay cajas con movimiento."
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Saldos por caja (USD)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Saldo en dólares por cada caja chica.
          </p>
          <MemphisBarChart
            data={porCajaUsd}
            dataKey="Saldo"
            xKey="name"
            height={220}
            emptyMessage="No hay cajas con movimiento en USD."
          />
        </div>
      </div>

      {/* Ranking centros de costo + tabla de últimos movimientos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Top centros de costo (saldo Caja Chica)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Centros de costo con mayor impacto (positivo o negativo) en Caja Chica.
          </p>
          <MemphisBarChart
            data={rankingCentrosCosto.map((cc) => ({
              name: cc.nombre,
              Saldo: cc.saldoGlobal,
            }))}
            dataKey="Saldo"
            xKey="name"
            height={240}
            emptyMessage="No hay centros de costo con movimientos."
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Últimos movimientos de Caja Chica
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 uppercase text-gray-500">
                  <th className="px-2 py-1 text-left">Fecha</th>
                  <th className="px-2 py-1 text-left">Caja</th>
                  <th className="px-2 py-1 text-left">Tipo</th>
                  <th className="px-2 py-1 text-left">Moneda</th>
                  <th className="px-2 py-1 text-right">Monto</th>
                  <th className="px-2 py-1 text-left">Centro de costo</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {ultimosMovs.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center text-gray-400 py-4"
                    >
                      No hay movimientos registrados.
                    </td>
                  </tr>
                )}
                {ultimosMovs.map((m) => (
                  <tr
                    key={`${m.cajaId}-${m.id}`}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-2 py-1 align-middle">
                      {m.fechaISO || "-"}
                    </td>
                    <td className="px-2 py-1 align-middle">
                      {m.cajaId}
                    </td>
                    <td className="px-2 py-1 align-middle">
                      {m.tipo}
                    </td>
                    <td className="px-2 py-1 align-middle">
                      {m.moneda}
                    </td>
                    <td className="px-2 py-1 align-middle text-right">
                      {m.monto.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-1 align-middle">
                      {m.centroCosto}
                    </td>
                    <td className="px-2 py-1 align-middle truncate max-w-[200px]">
                      {m.descripcion}
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

export default DashboardCajaChica;
