// src/pages/PresupuestoVsEjecutado.jsx
// Fase 4: Comparativo Presupuesto vs Ejecutado con semáforos,
// tabla detallada, gráfico mensual y gestión de presupuesto.

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import {
  obtenerPresupuestoVsEjecutado,
  obtenerPresupuestoAnual,
  guardarPresupuestoAnual,
} from "../firebase/presupuestoHelpers";
import { useUsuario } from "../context/UsuarioContext";
import { SkeletonKPI, SkeletonCard } from "../components/ui/Skeleton";

// ── Constantes ──────────────────────────────────────────
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const AREAS = [
  { id: "administracion", label: "Administración" },
  { id: "contabilidad",   label: "Contabilidad" },
  { id: "operaciones",    label: "Operaciones" },
  { id: "ti",             label: "TI" },
];

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const fmtK = (n) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

const SEMAFORO_COLORS = {
  verde:    { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  amarillo: { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500" },
  rojo:     { bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500" },
};

// ── Componente principal ────────────────────────────────
export default function PresupuestoVsEjecutado() {
  const { usuario, cargando: authLoading } = useUsuario();

  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroMes, setFiltroMes] = useState(0); // 0 = todos

  // Editor de presupuesto
  const [editando, setEditando] = useState(false);
  const [presupuestoEdicion, setPresupuestoEdicion] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const puedeEditar = usuario && ["admin", "soporte", "finanzas", "gerencia finanzas"].includes(
    (usuario.rol || "").toLowerCase()
  );

  // Cargar datos
  useEffect(() => {
    if (authLoading) return;
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const result = await obtenerPresupuestoVsEjecutado(anio);
        if (activo) setData(result);
      } catch (e) {
        console.error("Error cargando presupuesto vs ejecutado:", e);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [authLoading, anio]);

  // Datos filtrados
  const comparativoFiltrado = useMemo(() => {
    if (!data?.comparativo) return [];
    return data.comparativo.filter((r) => {
      if (filtroArea && r.area !== filtroArea) return false;
      if (filtroMes && r.mes !== filtroMes) return false;
      return true;
    });
  }, [data?.comparativo, filtroArea, filtroMes]);

  // Resumen mensual para gráfico (filtrado por área si aplica)
  const chartData = useMemo(() => {
    if (!data?.comparativo) return [];
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES[i],
      presupuesto: 0,
      ejecutado: 0,
    }));
    data.comparativo
      .filter((r) => !filtroArea || r.area === filtroArea)
      .forEach((r) => {
        meses[r.mes - 1].presupuesto += r.presupuesto;
        meses[r.mes - 1].ejecutado += r.ejecutado;
      });
    return meses.map((m) => ({
      ...m,
      presupuesto: +m.presupuesto.toFixed(2),
      ejecutado: +m.ejecutado.toFixed(2),
    }));
  }, [data?.comparativo, filtroArea]);

  // ── Iniciar edición de presupuesto ──
  const iniciarEdicion = async () => {
    const pres = await obtenerPresupuestoAnual(anio);
    const partidas = pres?.partidas || [];

    // Crear grid completo: 4 áreas x 12 meses
    const grid = [];
    AREAS.forEach(({ id }) => {
      for (let mes = 1; mes <= 12; mes++) {
        const existente = partidas.find((p) => p.area === id && p.mes === mes);
        grid.push({
          area: id,
          mes,
          presupuesto: existente?.presupuesto || 0,
          moneda: existente?.moneda || "PEN",
        });
      }
    });
    setPresupuestoEdicion(grid);
    setEditando(true);
  };

  const actualizarPartida = (area, mes, valor) => {
    setPresupuestoEdicion((prev) =>
      prev.map((p) =>
        p.area === area && p.mes === mes
          ? { ...p, presupuesto: Number(valor) || 0 }
          : p
      )
    );
  };

  const guardarPresupuesto = async () => {
    setGuardando(true);
    try {
      const partidasNoVacias = presupuestoEdicion.filter((p) => p.presupuesto > 0);
      await guardarPresupuestoAnual(anio, partidasNoVacias, usuario?.email || "");
      setEditando(false);
      // Recargar
      const result = await obtenerPresupuestoVsEjecutado(anio);
      setData(result);
    } catch (e) {
      console.error("Error guardando presupuesto:", e);
      alert("Error al guardar el presupuesto. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  // ── Render ──────────────────────────────────────────
  if (authLoading || cargando) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonKPI count={4} />
        <SkeletonCard lines={8} />
      </div>
    );
  }

  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  const resumen = data?.resumen || {};
  const resumenPorArea = data?.resumenPorArea || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Presupuesto vs Ejecutado</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Comparativo de presupuesto asignado contra gasto real — {anio}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          >
            {[2024, 2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {puedeEditar && !editando && (
            <button
              onClick={iniciarEdicion}
              className="bg-[#004990] text-white text-xs px-3 py-1.5 rounded hover:bg-[#003670] transition-colors"
            >
              {data?.tienePresupuesto ? "Editar Presupuesto" : "Cargar Presupuesto"}
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs globales ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Presupuesto Total" valor={resumen.totalPresupuesto} prefijo="S/ " color="text-black" />
        <KpiCard label="Ejecutado" valor={resumen.totalEjecutado} prefijo="S/ " color="text-gray-800" />
        <KpiCard
          label="Variación"
          valor={resumen.variacion}
          prefijo="S/ "
          color={resumen.variacion > 0 ? "text-red-600" : "text-emerald-600"}
          signo
        />
        <KpiCard
          label="% Ejecución"
          valor={resumen.porcentaje}
          sufijo="%"
          color={
            resumen.porcentaje > 110 ? "text-red-600"
            : resumen.porcentaje >= 100 ? "text-amber-600"
            : "text-emerald-600"
          }
        />
      </div>

      {/* ── Sin presupuesto ── */}
      {!data?.tienePresupuesto && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-amber-800 font-semibold mb-1">No hay presupuesto cargado para {anio}</p>
          <p className="text-amber-600 text-sm">
            {puedeEditar
              ? "Haga clic en \"Cargar Presupuesto\" para definir el presupuesto anual por área y mes."
              : "Contacte a Finanzas o un Administrador para cargar el presupuesto del año."}
          </p>
        </div>
      )}

      {/* ── Editor de presupuesto ── */}
      {editando && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-blue-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-black">
              Editar Presupuesto {anio} (valores en PEN)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setEditando(false)}
                className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={guardarPresupuesto}
                disabled={guardando}
                className="text-xs px-3 py-1 rounded bg-[#004990] text-white hover:bg-[#003670] disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 sticky left-0 bg-gray-50">Área</th>
                  {MESES.map((m) => (
                    <th key={m} className="px-2 py-2 text-center text-gray-600 min-w-[80px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AREAS.map(({ id, label }) => (
                  <tr key={id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-white">{label}</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const partida = presupuestoEdicion.find((p) => p.area === id && p.mes === i + 1);
                      return (
                        <td key={i} className="px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={partida?.presupuesto || ""}
                            onChange={(e) => actualizarPartida(id, i + 1, e.target.value)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="0"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Resumen por área con semáforos ── */}
      {data?.tienePresupuesto && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resumen por Área</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {resumenPorArea.map((a) => {
              const sc = SEMAFORO_COLORS[a.semaforo];
              return (
                <div key={a.area} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">{a.areaLabel}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                      <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                      {a.porcentaje.toFixed(0)}%
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Presupuesto</span>
                      <span className="font-medium text-black">S/ {fmt(a.presupuesto)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ejecutado</span>
                      <span className="font-medium text-gray-800">S/ {fmt(a.ejecutado)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-100">
                      <span className="text-gray-600 font-medium">Variación</span>
                      <span className={`font-bold ${a.variacion > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {a.variacion > 0 ? "+" : ""}S/ {fmt(a.variacion)}
                      </span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="mt-2">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            a.porcentaje > 110 ? "bg-red-500"
                            : a.porcentaje >= 100 ? "bg-amber-500"
                            : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(a.porcentaje, 120)}%`, maxWidth: "100%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Gráfico comparativo mensual ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Comparativo Mensual</h3>
          <div className="flex gap-2">
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="">Todas las áreas</option>
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={0}>Todos los meses</option>
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtK} />
            <Tooltip formatter={(v) => `S/ ${fmt(v)}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="presupuesto" name="Presupuesto" fill="#3B82F6" radius={[3, 3, 0, 0]} opacity={0.7} />
            <Bar dataKey="ejecutado" name="Ejecutado" fill="#EF4444" radius={[3, 3, 0, 0]} />
            <ReferenceLine y={0} stroke="#666" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tabla detallada ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Detalle por Área y Mes</h3>
          <div className="flex gap-1 text-[10px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt;100%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> 100-110%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              <span className="w-2 h-2 rounded-full bg-red-500" /> &gt;110%
            </span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-gray-600">Área</th>
                <th className="px-4 py-2 text-center text-gray-600">Mes</th>
                <th className="px-4 py-2 text-right text-gray-600">Presupuesto (S/)</th>
                <th className="px-4 py-2 text-right text-gray-600">Ejecutado (S/)</th>
                <th className="px-4 py-2 text-right text-gray-600">Variación (S/)</th>
                <th className="px-4 py-2 text-center text-gray-600">% Ejec.</th>
                <th className="px-4 py-2 text-center text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {comparativoFiltrado.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-400 py-6">Sin datos para los filtros seleccionados</td></tr>
              )}
              {comparativoFiltrado.map((r, i) => {
                const sc = SEMAFORO_COLORS[r.semaforo];
                return (
                  <tr key={`${r.area}-${r.mes}`} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-700">{r.areaLabel}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{MESES[r.mes - 1]}</td>
                    <td className="px-4 py-2 text-right font-mono text-black">{fmt(r.presupuesto)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-800">{fmt(r.ejecutado)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${r.variacion > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {r.variacion > 0 ? "+" : ""}{fmt(r.variacion)}
                    </td>
                    <td className="px-4 py-2 text-center font-bold">
                      <span className={`${sc.text}`}>{r.porcentaje.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                        <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                        {r.semaforo === "verde" ? "OK" : r.semaforo === "amarillo" ? "Alerta" : "Excedido"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-gray-400 text-center">
        Semáforo: Verde &lt;100% · Amarillo 100-110% · Rojo &gt;110%. Montos en soles (PEN). Ejecutado basado en egresos registrados en Flujos Financieros.
      </p>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────
function KpiCard({ label, valor, color = "text-gray-800", prefijo = "", sufijo = "", signo }) {
  const display = sufijo === "%"
    ? `${(valor || 0).toFixed(1)}${sufijo}`
    : `${prefijo}${fmtK(valor || 0)}${sufijo}`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
      <p className={`mt-1 text-lg sm:text-xl font-bold font-mono ${color}`}>
        {signo && valor > 0 ? "+" : ""}{display}
      </p>
    </div>
  );
}
