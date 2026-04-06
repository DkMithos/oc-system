import React, { useEffect, useMemo, useState } from "react";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

// Etiqueta/color por estado
const ESTADO_COLOR = {
  "Aprobada":                  "#32cd32",
  "Pagado":                    "#004990",
  "Pago Parcial":              "#f59e0b",
  "Pendiente de Comprador":    "#fbc102",
  "Pendiente de Operaciones":  "#fb923c",
  "Pendiente de Gerencia General": "#a78bfa",
  "Rechazada":                 "#ff6347",
};
const colorOf = (estado) => ESTADO_COLOR[estado] || "#aaa";

const ResumenGeneral = () => {
  const navigate = useNavigate();
  const [ocs, setOcs]       = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await obtenerOCs();
        setOcs(data || []);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // ── OCs por estado ──────────────────────────────────────────
  const estadosCount = useMemo(() => ocs.reduce((acc, oc) => {
    const e = oc.estado || "Sin estado";
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {}), [ocs]);

  // ── Total por moneda ────────────────────────────────────────
  const totalPorMoneda = useMemo(() => ocs.reduce((acc, oc) => {
    const moneda = oc.monedaSeleccionada || "Soles";
    const monto  = Number(oc.resumen?.total || 0);
    acc[moneda]  = (acc[moneda] || 0) + monto;
    return acc;
  }, {}), [ocs]);

  // ── Top 5 proveedores por monto ─────────────────────────────
  const topProveedores = useMemo(() => {
    const mapa = ocs.reduce((acc, oc) => {
      const nombre = oc.proveedor?.razonSocial || "Sin proveedor";
      acc[nombre] = (acc[nombre] || 0) + Number(oc.resumen?.total || 0);
      return acc;
    }, {});
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [ocs]);

  // ── Firmas pendientes (estados intermedios sin firma de esa etapa) ──
  const pendientesFirma = useMemo(() => ocs.filter((oc) => {
    if (oc.estado === "Pendiente de Comprador"        && !oc.firmas?.comprador)        return true;
    if (oc.estado === "Pendiente de Operaciones"      && !oc.firmas?.operaciones)      return true;
    if (oc.estado === "Pendiente de Gerencia General" && !oc.firmas?.gerenciaGeneral)  return true;
    return false;
  }), [ocs]);

  // ── KPIs rápidos ────────────────────────────────────────────
  const totalMonto = useMemo(
    () => ocs.reduce((a, o) => a + Number(o.resumen?.total || 0), 0),
    [ocs]
  );
  const aprobadas = useMemo(() => ocs.filter((o) => o.estado === "Aprobada").length, [ocs]);
  const pagadas   = useMemo(() => ocs.filter((o) => o.estado === "Pagado" || o.estado === "Pago Parcial").length, [ocs]);

  if (cargando) return <div className="p-6">Cargando…</div>;

  const pieLabels  = Object.keys(estadosCount);
  const pieData    = Object.values(estadosCount);
  const pieColors  = pieLabels.map(colorOf);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Resumen General</h2>

      {/* KPI rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total OCs" value={ocs.length} />
        <KPICard label="Aprobadas" value={aprobadas} color="text-green-700" />
        <KPICard label="Con pago" value={pagadas} color="text-blue-700" />
        <KPICard
          label="Monto total"
          value={formatearMoneda(totalMonto, "Soles")}
          color="text-[#004990]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Pie por estado */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold text-lg mb-2">OCs por Estado</h3>
          {pieData.length > 0 ? (
            <Pie
              data={{
                labels: pieLabels,
                datasets: [{ label: "# OCs", data: pieData, backgroundColor: pieColors }],
              }}
            />
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
        </div>

        {/* Total por moneda */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold text-lg mb-3">Total por Moneda</h3>
          <ul className="space-y-2">
            {Object.entries(totalPorMoneda).map(([moneda, total]) => (
              <li key={moneda} className="flex justify-between text-sm border-b pb-1">
                <span className="text-gray-600">{moneda}</span>
                <strong>{formatearMoneda(total, moneda === "Dólares" ? "Dólares" : "Soles")}</strong>
              </li>
            ))}
            {Object.keys(totalPorMoneda).length === 0 && (
              <p className="text-gray-400 text-sm">Sin datos</p>
            )}
          </ul>
        </div>

        {/* Top 5 Proveedores */}
        <div className="bg-white p-4 rounded shadow col-span-1 md:col-span-2">
          <h3 className="font-bold text-lg mb-2">Top 5 Proveedores (por monto)</h3>
          {topProveedores.length > 0 ? (
            <Bar
              data={{
                labels: topProveedores.map(([nombre]) => nombre),
                datasets: [{
                  label: "Monto Total (S/)",
                  data: topProveedores.map(([, monto]) => monto),
                  backgroundColor: "#004990",
                }],
              }}
              options={{ indexAxis: "y", plugins: { legend: { display: false } } }}
            />
          ) : <p className="text-gray-400 text-sm">Sin datos</p>}
        </div>
      </div>

      {/* Firmas pendientes */}
      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-bold text-lg mb-2">Firmas Pendientes</h3>
        {pendientesFirma.length === 0 ? (
          <p className="text-green-600 text-sm">No hay firmas pendientes</p>
        ) : (
          <ul className="text-sm divide-y">
            {pendientesFirma.map((oc) => (
              <li
                key={oc.id}
                className="py-1.5 flex justify-between items-center cursor-pointer hover:text-[#004990]"
                onClick={() => navigate(`/ver?id=${oc.id}`)}
              >
                <span>
                  <b>{oc.numeroOC || oc.numero}</b>
                  <span className="text-gray-500 ml-2">{oc.proveedor?.razonSocial}</span>
                </span>
                <span className="text-xs text-amber-700">{oc.estado}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const KPICard = ({ label, value, color = "text-gray-800" }) => (
  <div className="bg-white rounded shadow p-3 text-center">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

export default ResumenGeneral;
