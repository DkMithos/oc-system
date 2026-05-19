// ✅ DashboardCompras.jsx
import React, { useEffect, useState } from "react";
import { obtenerIndicadoresCompras } from "../../firebase/reportesHelpers";

import KPI from "../../components/charts/KPI";
import MemphisAreaChart from "../../components/charts/AreaChart";
import MemphisDonutChart from "../../components/charts/DonutChart";
import MemphisBarChart from "../../components/charts/BarChart";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const DEMO_COMPRAS = {
  totales: {
    compraPen: 342000, compraUsd: 28400,
    servicioPen: 142800, servicioUsd: 9600,
    internaPen: 58000, internaUsd: 0,
  },
  comprasMensuales: [
    { label: "Dic 2025", total: 68000 },
    { label: "Ene 2026", total: 92500 },
    { label: "Feb 2026", total: 97400 },
    { label: "Mar 2026", total: 114700 },
    { label: "Abr 2026", total: 120000 },
    { label: "May 2026", total: 64200 },
  ],
  porTipo: [
    { tipo: "Compra", total: 370400 },
    { tipo: "Servicio", total: 152400 },
    { tipo: "Interna", total: 58000 },
  ],
  porEstado: [
    { estado: "Aprobada", cantidad: 98 },
    { estado: "Pendiente de Operaciones", cantidad: 34 },
    { estado: "Pagado", cantidad: 34 },
    { estado: "Pendiente de Gerencia General", cantidad: 12 },
    { estado: "Rechazada", cantidad: 8 },
  ],
  rankingProveedores: [
    { nombre: "Ferreyros S.A.", total: 185400 },
    { nombre: "Komatsu Mitsui", total: 142600 },
    { nombre: "Epiroc Perú", total: 98200 },
    { nombre: "SKF del Perú", total: 74800 },
    { nombre: "Suministros Técnicos", total: 52100 },
  ],
  rankingCentrosCosto: [
    { nombre: "Mina Norte", total: 228000 },
    { nombre: "Planta Central", total: 184500 },
    { nombre: "Logística", total: 112300 },
    { nombre: "Proyectos", total: 89700 },
    { nombre: "Administración", total: 68700 },
  ],
  ultimas: [
    { id: "oc1", fechaISO: "2026-05-12", numeroOC: "OC-2026-0186", proveedor: "Ferreyros S.A.", centroCosto: "Mina Norte", tipo: "Compra", moneda: "PEN", total: 28400 },
    { id: "oc2", fechaISO: "2026-05-10", numeroOC: "OC-2026-0185", proveedor: "Komatsu Mitsui", centroCosto: "Planta Central", tipo: "Servicio", moneda: "USD", total: 4800 },
    { id: "oc3", fechaISO: "2026-05-08", numeroOC: "OC-2026-0184", proveedor: "Epiroc Perú", centroCosto: "Mina Norte", tipo: "Compra", moneda: "PEN", total: 18600 },
    { id: "oc4", fechaISO: "2026-05-06", numeroOC: "OC-2026-0183", proveedor: "SKF del Perú", centroCosto: "Logística", tipo: "Compra", moneda: "PEN", total: 12300 },
    { id: "oc5", fechaISO: "2026-05-03", numeroOC: "OC-2026-0182", proveedor: "Suministros Técnicos", centroCosto: "Administración", tipo: "Interna", moneda: "PEN", total: 4200 },
  ],
};

const DashboardCompras = ({ filtros }) => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [esDemo, setEsDemo] = useState(false);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const res = await obtenerIndicadoresCompras(filtros);
        if (!activo) return;
        if (!res || ((res.totales?.compraPen ?? 0) + (res.totales?.servicioPen ?? 0)) < 1000) {
          setData(DEMO_COMPRAS);
          setEsDemo(true);
        } else {
          setData(res);
          setEsDemo(false);
        }
      } catch (e) {
        console.error("Error cargando dashboard compras:", e);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => (activo = false);
  }, [filtros]);

  if (!data) return <div className="py-10 flex justify-center"><span className="text-sm text-gray-500">Cargando...</span></div>;

  const { totales, comprasMensuales, porTipo, porEstado, rankingProveedores, rankingCentrosCosto, ultimas } = data;

  const flujoMensualData = comprasMensuales.map((m) => ({
    label: m.label,
    Total: m.total,
  }));

  const tipoData = porTipo.map((t) => ({
    name: t.tipo,
    Valor: t.total,
  }));

  const estadoData = porEstado.map((e) => ({
    name: e.estado,
    Valor: e.cantidad,
  }));

  const rankingProvData = rankingProveedores.map((p) => ({
    name: p.nombre,
    Neto: p.total,
  }));

  const rankingCCData = rankingCentrosCosto.map((c) => ({
    name: c.nombre,
    Neto: c.total,
  }));

  return (
    <div className="space-y-6">
      {esDemo && (
        <p className="text-[10px] text-gray-400 italic text-center">
          Vista previa con datos de ejemplo — no hay órdenes de compra en el periodo seleccionado.
        </p>
      )}
      {/* ENCABEZADO */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          Dashboard de Compras
        </h2>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Compra PEN" value={totales.compraPen} type="currency" currency="PEN" />
        <KPI label="Compra USD" value={totales.compraUsd} type="currency" currency="USD" />

        <KPI label="Servicio PEN" value={totales.servicioPen} type="currency" currency="PEN" />
        <KPI label="Servicio USD" value={totales.servicioUsd} type="currency" currency="USD" />

        <KPI label="Interna PEN" value={totales.internaPen} type="currency" currency="PEN" />
        <KPI label="Interna USD" value={totales.internaUsd} type="currency" currency="USD" />
      </div>

      {/* Gráfico mensual */}
      <div className="bg-white p-4 rounded-xl border">
        <h3 className="font-semibold text-sm mb-2">Compras mensuales (PEN + USD)</h3>
        <MemphisAreaChart
          data={flujoMensualData}
          dataKey="Total"
          xKey="label"
          height={230}
          emptyMessage="No hay compras en este periodo."
        />
      </div>

      {/* Distribución por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border">
          <h3 className="font-semibold text-sm mb-2">Distribución por tipo</h3>
          <MemphisDonutChart
            data={tipoData}
            dataKey="Valor"
            nameKey="name"
            height={240}
            emptyMessage="Sin datos"
          />
        </div>

        <div className="bg-white p-4 rounded-xl border">
          <h3 className="font-semibold text-sm mb-2">Órdenes por estado</h3>
          <MemphisDonutChart
            data={estadoData}
            dataKey="Valor"
            nameKey="name"
            height={240}
            emptyMessage="Sin datos"
          />
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border">
          <h3 className="font-semibold text-sm mb-2">Top Proveedores</h3>
          <MemphisBarChart
            data={rankingProvData}
            dataKey="Neto"
            xKey="name"
            height={260}
            emptyMessage="Sin proveedores"
          />
        </div>

        <div className="bg-white p-4 rounded-xl border">
          <h3 className="font-semibold text-sm mb-2">Top Centros de Costo</h3>
          <MemphisBarChart
            data={rankingCCData}
            dataKey="Neto"
            xKey="name"
            height={260}
            emptyMessage="Sin centros de costo"
          />
        </div>
      </div>

      {/* Últimas OCs */}
      <div className="bg-white p-4 rounded-xl border">
        <h3 className="font-semibold text-sm mb-2">Últimas órdenes de compra</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 uppercase">
                <th className="px-2 py-1 text-left">Fecha</th>
                <th className="px-2 py-1">N°</th>
                <th className="px-2 py-1">Proveedor</th>
                <th className="px-2 py-1">Centro de costo</th>
                <th className="px-2 py-1">Tipo</th>
                <th className="px-2 py-1">Moneda</th>
                <th className="px-2 py-1 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {ultimas.map((oc) => (
                <tr key={oc.id} className="border-t hover:bg-gray-50">
                  <td className="px-2 py-1">{oc.fechaISO}</td>
                  <td className="px-2 py-1">{oc.numeroOC}</td>
                  <td className="px-2 py-1">{oc.proveedor}</td>
                  <td className="px-2 py-1">{oc.centroCosto}</td>
                  <td className="px-2 py-1">{oc.tipo}</td>
                  <td className="px-2 py-1">{oc.moneda}</td>
                  <td className="px-2 py-1 text-right">
                    {oc.total.toLocaleString("es-PE", {
                      minimumFractionDigits: 2,
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

export default DashboardCompras;
