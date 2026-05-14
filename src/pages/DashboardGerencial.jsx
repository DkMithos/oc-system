// src/pages/DashboardGerencial.jsx
// Dashboard ejecutivo para Gerencia: KPIs consolidados, alertas urgentes,
// gráficos por área, tendencia mensual, proveedores pendientes y top categorías.

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import { obtenerIndicadoresGerencial } from "../firebase/reportesHelpers";
import { useUsuario } from "../context/UsuarioContext";
import { useNavigate } from "react-router-dom";
import { SkeletonKPI, SkeletonCard } from "../components/ui/Skeleton";

// ── Constantes ─────────────────────────────────────────────────
const AREAS_META = {
  administracion: { label: "Admin",        color: "#3B82F6" },
  contabilidad:   { label: "Contabilidad", color: "#10B981" },
  operaciones:    { label: "Operaciones",  color: "#8B5CF6" },
  ti:             { label: "TI",           color: "#F59E0B" },
};

const COLORES_PIE = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#84CC16"];
const MESES_NOMBRE = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const fmtK = (n) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

// ── Componente ─────────────────────────────────────────────────
export default function DashboardGerencial() {
  const { usuario, cargando: authLoading } = useUsuario();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [anio, setAnio] = useState(() => new Date().getFullYear());

  useEffect(() => {
    if (authLoading) return;
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const result = await obtenerIndicadoresGerencial({ anio });
        if (activo) setData(result);
      } catch (e) {
        console.error("Error cargando dashboard gerencial:", e);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [authLoading, anio]);

  // ── Derivar datos de porArea para gráficos ──
  const porAreaArr = useMemo(() => {
    if (!data?.porArea) return [];
    return Object.entries(data.porArea).map(([id, d]) => ({
      area: AREAS_META[id]?.label || id,
      color: AREAS_META[id]?.color || "#9CA3AF",
      ingresos: +d.ingresos.toFixed(2),
      egresos: +d.egresos.toFixed(2),
      neto: +(d.ingresos - d.egresos).toFixed(2),
      count: d.count,
    }));
  }, [data?.porArea]);

  const tendenciaMensual = useMemo(() => {
    if (!data?.tendenciaMensual) return [];
    return data.tendenciaMensual.map((m, i) => ({
      ...m,
      mes: MESES_NOMBRE[i] || `M${i + 1}`,
    }));
  }, [data?.tendenciaMensual]);

  // ── Render ─────────────────────────────────────────────────
  if (authLoading || cargando) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonKPI count={5} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    );
  }

  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;
  if (!data) return <div className="p-6 text-gray-400">Sin datos disponibles</div>;

  const { kpis, distribucionEstado, topCategorias, topProveedores, topProveedoresPendientes, alertas } = data;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Dashboard Gerencial</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen ejecutivo de flujos financieros — {anio}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Año:</label>
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black"
          >
            {[2024, 2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── FILA 1: KPIs principales ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Transacciones" valor={kpis.totalTransacciones} formato="entero" color="text-black" />
        <KpiCard label="Ingresos" valor={kpis.ingresos} color="text-emerald-600" prefijo="S/ " />
        <KpiCard label="Egresos" valor={kpis.egresos} color="text-red-500" prefijo="S/ " />
        <KpiCard label="Flujo Neto" valor={kpis.flujoNeto} color={kpis.flujoNeto >= 0 ? "text-emerald-600" : "text-red-600"} prefijo="S/ " resaltado />
        <KpiCard label="Pendiente Pago" valor={kpis.pendientes} color="text-amber-600" prefijo="S/ " />
      </div>

      {/* ── ALERTAS URGENTES ── */}
      {alertas && alertas.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-amber-50 flex items-center gap-2">
            <span className="text-amber-600 text-lg">⚠️</span>
            <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">
              Alertas — OCs Pendientes de Aprobación ({alertas.length})
            </h3>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600">N° OC</th>
                  <th className="px-4 py-2 text-left text-gray-600">Proveedor</th>
                  <th className="px-4 py-2 text-left text-gray-600">Estado</th>
                  <th className="px-4 py-2 text-right text-gray-600">Monto</th>
                  <th className="px-4 py-2 text-center text-gray-600">Días</th>
                </tr>
              </thead>
              <tbody>
                {alertas.slice(0, 15).map((a) => (
                  <tr
                    key={a.id}
                    className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${a.urgente ? "bg-red-50/50" : ""}`}
                    onClick={() => navigate(`/ver?id=${a.id}`)}
                  >
                    <td className="px-4 py-2 font-medium text-black">{a.numeroOC}</td>
                    <td className="px-4 py-2 text-gray-700 max-w-[200px] truncate">{a.proveedor}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        a.estado.includes("Gerencia") ? "bg-purple-100 text-purple-700"
                        : a.estado.includes("Operaciones") ? "bg-orange-100 text-orange-700"
                        : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {a.estado.replace("Pendiente de ", "")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {a.moneda === "USD" ? "US$ " : "S/ "}{fmt(a.montoTotal)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`font-bold ${a.urgente ? "text-red-600" : "text-gray-600"}`}>
                        {a.diasPendiente}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FILA 2: Resumen por área ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resumen por Área</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {porAreaArr.map((a) => (
            <div key={a.area} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color }} />
                <span className="text-sm font-semibold text-gray-700">{a.area}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{a.count} reg.</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ingresos</span>
                  <span className="text-emerald-600 font-medium">S/ {fmt(a.ingresos)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Egresos</span>
                  <span className="text-red-500 font-medium">S/ {fmt(a.egresos)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-600 font-medium">Neto</span>
                  <span className={`font-bold ${a.neto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    S/ {fmt(a.neto)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FILA 3: Gráficos principales ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tendencia mensual (2/3) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendencia Mensual</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={tendenciaMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
              <Tooltip formatter={(v) => `S/ ${fmt(v)}`} />
              <Area type="monotone" dataKey="ingresos" name="Ingresos" fill="#10B981" fillOpacity={0.15} stroke="#10B981" strokeWidth={2} />
              <Area type="monotone" dataKey="egresos" name="Egresos" fill="#EF4444" fillOpacity={0.1} stroke="#EF4444" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución por estado (1/3) */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Distribución por Estado</h3>
          {distribucionEstado.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={distribucionEstado}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={35}
                  paddingAngle={2}
                >
                  {distribucionEstado.map((entry, i) => (
                    <Cell key={entry.name || `cell-${i}`} fill={COLORES_PIE[i % COLORES_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `S/ ${fmt(v)}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── FILA 4: Barras por área + Top categorías ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ingresos vs Egresos por Área</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porAreaArr} barGap={2}>
              <XAxis dataKey="area" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
              <Tooltip formatter={(v) => `S/ ${fmt(v)}`} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#10B981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="egresos" name="Egresos" fill="#EF4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Categorías de Egreso</h3>
          {topCategorias.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">Sin egresos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCategorias} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtK} />
                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={(v) => `S/ ${fmt(v)}`} />
                <Bar dataKey="monto" name="Egreso" fill="#000000" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── FILA 5: Top proveedores por monto PENDIENTE ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Top 10 Proveedores por Monto Pendiente
          </h3>
          <span className="text-[10px] text-gray-400">Solo transacciones con estado "Pendiente"</span>
        </div>
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-600">#</th>
              <th className="px-4 py-2 text-left text-gray-600">Proveedor</th>
              <th className="px-4 py-2 text-right text-gray-600">Transacciones</th>
              <th className="px-4 py-2 text-right text-gray-600">Monto Pendiente (S/)</th>
              <th className="px-4 py-2 text-left text-gray-600">% del Total Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {topProveedoresPendientes.length === 0 && (
              <tr><td colSpan={5} className="text-center text-gray-400 py-4">Sin montos pendientes</td></tr>
            )}
            {topProveedoresPendientes.map((p, i) => {
              const pctTotal = kpis.pendientes > 0 ? (p.monto / kpis.pendientes) * 100 : 0;
              return (
                <tr key={p.nombre} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-2 text-gray-800 font-medium max-w-[250px] truncate">{p.nombre}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.count}</td>
                  <td className="px-4 py-2 text-right font-semibold text-amber-700">S/ {fmt(p.monto)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(pctTotal, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">{pctTotal.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── FILA 6: Top proveedores por egreso total (referencia) ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Top 10 Proveedores por Egreso Total</h3>
        </div>
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-gray-600">#</th>
              <th className="px-4 py-2 text-left text-gray-600">Proveedor</th>
              <th className="px-4 py-2 text-right text-gray-600">Transacciones</th>
              <th className="px-4 py-2 text-right text-gray-600">Monto Total (S/)</th>
              <th className="px-4 py-2 text-left text-gray-600">% del Total</th>
            </tr>
          </thead>
          <tbody>
            {topProveedores.length === 0 && (
              <tr><td colSpan={5} className="text-center text-gray-400 py-4">Sin datos</td></tr>
            )}
            {topProveedores.map((p, i) => {
              const pctTotal = kpis.egresos > 0 ? (p.monto / kpis.egresos) * 100 : 0;
              return (
                <tr key={p.nombre} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-2 text-gray-800 font-medium max-w-[250px] truncate">{p.nombre}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{p.count}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-800">S/ {fmt(p.monto)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                        <div
                          className="bg-black h-1.5 rounded-full"
                          style={{ width: `${Math.min(pctTotal, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">{pctTotal.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <p className="text-[10px] text-gray-400 text-center">
        Datos en soles (S/). Montos en USD convertidos al tipo de cambio registrado. Actualizado al cargar la página.
      </p>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, valor, color = "text-gray-800", prefijo = "", formato, resaltado }) {
  const display = formato === "entero"
    ? valor.toLocaleString("es-PE")
    : fmtK(valor);

  return (
    <div className={`bg-white border rounded-xl p-3 shadow-sm ${resaltado ? "border-black ring-1 ring-black/10" : "border-gray-200"}`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className={`mt-1 text-lg sm:text-xl font-bold font-mono ${color}`}>
        {prefijo}{display}
      </p>
    </div>
  );
}
