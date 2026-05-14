// src/pages/FlujoCajaPlanning.jsx
// Vista mensual de planificación de pagos — reemplaza el "Flujo GM" del Excel.
// Muestra transacciones por mes de vencimiento, con semáforo de urgencia,
// acciones rápidas (cambiar estado, postergar) y resumen por área.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  obtenerTransaccionesPlaneadas,
  patchTransaccionFinanciera,
} from "../firebase/finanzasHelpers";
import { useUsuario } from "../context/UsuarioContext";

// ── Constantes ────────────────────────────────────────────────
const AREAS_CONFIG = [
  { id: "administracion", label: "Admin"        },
  { id: "contabilidad",   label: "Contabilidad" },
  { id: "operaciones",    label: "Operaciones"  },
  { id: "ti",             label: "TI"           },
  { id: "consolidado",    label: "Consolidado"  },
];

const TABS_POR_ROL = {
  administracion:         ["administracion", "consolidado"],
  finanzas:               ["contabilidad", "consolidado"],
  "gerencia finanzas":    ["consolidado", "contabilidad"],
  operaciones:            ["operaciones", "consolidado"],
  "gerencia operaciones": ["consolidado", "operaciones"],
  "gerencia general":     ["consolidado"],
  gerencia:               ["consolidado"],
  admin:   ["administracion", "contabilidad", "operaciones", "ti", "consolidado"],
  soporte: ["administracion", "contabilidad", "operaciones", "ti", "consolidado"],
};

const DEFAULT_AREA = {
  administracion:         "administracion",
  finanzas:               "contabilidad",
  "gerencia finanzas":    "consolidado",
  operaciones:            "operaciones",
  "gerencia operaciones": "consolidado",
  "gerencia general":     "consolidado",
  gerencia:               "consolidado",
  admin:                  "consolidado",
  soporte:                "consolidado",
};

const PUEDE_ESCRIBIR = new Set(["administracion", "finanzas", "operaciones", "admin", "soporte"]);

const ESTADOS_OPCIONES = ["Pendiente", "Programado", "En proceso", "Pagado", "Vencido", "Postergado"];

const MESES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Utilidades de fecha ────────────────────────────────────────
function mesHoy() {
  return new Date().toISOString().slice(0, 7);
}

function addMonths(mesStr, n) {
  const [y, m] = mesStr.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMes(mesStr, short = false) {
  if (!mesStr) return "—";
  const [y, m] = mesStr.split("-").map(Number);
  return short ? MESES_ES[m - 1] : `${MESES_ES[m - 1]} ${y}`;
}

function diasTranscurridos(t) {
  const ref = t.fechaInicio || t.fechaISO;
  if (!ref) return null;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
}

function semaforo(dias) {
  if (dias === null || dias === undefined) return { clase: "text-gray-400", label: "—" };
  if (dias < 0)  return { clase: "text-blue-600 bg-blue-50",   label: `${Math.abs(dias)}d` };
  if (dias < 30) return { clase: "text-green-700 bg-green-50",  label: `${dias}d` };
  if (dias < 60) return { clase: "text-yellow-700 bg-yellow-50",label: `${dias}d` };
  if (dias < 90) return { clase: "text-orange-700 bg-orange-50",label: `${dias}d` };
  return           { clase: "text-red-700 bg-red-50",           label: `${dias}d` };
}

function fmtMonto(v, moneda = "PEN") {
  const n = Number(v || 0);
  const sym = moneda === "USD" ? "$" : "S/";
  return `${sym} ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Componente ────────────────────────────────────────────────
export default function FlujoCajaPlanning() {
  const { usuario } = useUsuario();
  const navigate    = useNavigate();
  const rol = String(usuario?.rol || "").toLowerCase();

  const tabsVisibles = TABS_POR_ROL[rol] || ["consolidado"];
  const [areaTab, setAreaTab] = useState(() => DEFAULT_AREA[rol] || "consolidado");
  const [mesActual, setMesActual] = useState(mesHoy);
  const [todas, setTodas]         = useState([]);
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState("");
  const [ordenar, setOrdenar]     = useState("urgencia");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [editandoEstado, setEditandoEstado] = useState(null);
  const [actualizando, setActualizando]     = useState(new Set());

  const puedeEscribir = PUEDE_ESCRIBIR.has(rol);

  // Strip de 6 meses: mesActual-1 … mesActual+4
  const meses6 = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addMonths(mesActual, i - 1)),
    [mesActual]
  );

  // Carga rango completo
  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const desde = addMonths(mesActual, -1);
      const hasta = addMonths(mesActual, 4);
      const data  = await obtenerTransaccionesPlaneadas(desde, hasta);
      setTodas(data);
    } catch (e) {
      console.error(e);
      setError("Error cargando el plan de pagos.");
    } finally {
      setCargando(false);
    }
  }, [mesActual]);

  useEffect(() => { cargar(); }, [cargar]);

  // Agrupación por mes para el strip
  const datosPorMes = useMemo(() => {
    const mapa = {};
    for (const t of todas) {
      const mes = t.mesVencimiento || "";
      if (!mapa[mes]) mapa[mes] = { total: 0, pagado: 0, pendiente: 0, count: 0 };
      const m = Number(t.monto_total_pen ?? t.monto_total ?? 0);
      mapa[mes].total += m;
      mapa[mes].count += 1;
      if (t.estado === "Pagado") mapa[mes].pagado += m;
      else                        mapa[mes].pendiente += m;
    }
    return mapa;
  }, [todas]);

  // Transacciones del mes seleccionado (filtradas por área y soloPendientes)
  const transDelMes = useMemo(() => {
    let data = todas.filter((t) => t.mesVencimiento === mesActual);
    if (areaTab !== "consolidado") data = data.filter((t) => (t.area || "") === areaTab);
    if (soloPendientes) data = data.filter((t) => t.estado !== "Pagado");
    // Orden
    if (ordenar === "urgencia") {
      data = [...data].sort((a, b) => {
        const da = diasTranscurridos(a) ?? -9999;
        const db = diasTranscurridos(b) ?? -9999;
        return db - da;
      });
    } else if (ordenar === "monto") {
      data = [...data].sort((a, b) =>
        Number(b.monto_total ?? 0) - Number(a.monto_total ?? 0)
      );
    } else {
      data = [...data].sort((a, b) =>
        (a.proveedor_cliente_nombre || "").localeCompare(b.proveedor_cliente_nombre || "")
      );
    }
    return data;
  }, [todas, mesActual, areaTab, ordenar, soloPendientes]);

  // Resumen del mes
  const resumen = useMemo(() => {
    const total      = transDelMes.reduce((s, t) => s + Number(t.monto_total_pen ?? t.monto_total ?? 0), 0);
    const pagado     = transDelMes.filter((t) => t.estado === "Pagado").reduce((s, t) => s + Number(t.monto_total_pen ?? t.monto_total ?? 0), 0);
    const postergado = transDelMes.filter((t) => t.postergado).reduce((s, t) => s + Number(t.monto_total_pen ?? t.monto_total ?? 0), 0);
    const pendiente  = total - pagado;
    const pctPagado  = total > 0 ? (pagado / total) * 100 : 0;
    return { total, pagado, pendiente, postergado, pctPagado };
  }, [transDelMes]);

  // ── Acciones ─────────────────────────────────────────────────
  const setActualizandoId = (id, on) =>
    setActualizando((prev) => { const s = new Set(prev); on ? s.add(id) : s.delete(id); return s; });

  const handleCambiarEstado = async (t, nuevoEstado) => {
    setEditandoEstado(null);
    setActualizandoId(t.id, true);
    try {
      await patchTransaccionFinanciera(t.id, { estado: nuevoEstado });
      setTodas((prev) => prev.map((x) => x.id === t.id ? { ...x, estado: nuevoEstado } : x));
    } finally {
      setActualizandoId(t.id, false);
    }
  };

  const handlePostergar = async (t) => {
    setActualizandoId(t.id, true);
    const nuevoMes = addMonths(t.mesVencimiento || mesActual, 1);
    try {
      await patchTransaccionFinanciera(t.id, { postergado: true, mesVencimiento: nuevoMes });
      setTodas((prev) =>
        prev.map((x) => x.id === t.id ? { ...x, postergado: true, mesVencimiento: nuevoMes } : x)
      );
    } finally {
      setActualizandoId(t.id, false);
    }
  };

  const handleDespostergado = async (t) => {
    setActualizandoId(t.id, true);
    try {
      await patchTransaccionFinanciera(t.id, { postergado: false });
      setTodas((prev) => prev.map((x) => x.id === t.id ? { ...x, postergado: false } : x));
    } finally {
      setActualizandoId(t.id, false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Planificación de Pagos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Vista mensual · {transDelMes.length} ítem{transDelMes.length !== 1 ? "s" : ""} en {formatMes(mesActual)}
          </p>
        </div>
        {/* Navegación de mes */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMesActual((m) => addMonths(m, -1))}
            className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600 text-lg font-bold">‹</button>
          <span className="font-semibold text-black text-sm min-w-[90px] text-center">
            {formatMes(mesActual)}
          </span>
          <button onClick={() => setMesActual((m) => addMonths(m, 1))}
            className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-600 text-lg font-bold">›</button>
          <button onClick={() => setMesActual(mesHoy())}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs text-gray-600 font-medium">
            Hoy
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* ── Strip de 6 meses ──────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {meses6.map((mes) => {
          const d = datosPorMes[mes] || { total: 0, pagado: 0, pendiente: 0, count: 0 };
          const activo = mes === mesActual;
          const pct = d.total > 0 ? (d.pagado / d.total) * 100 : 0;
          return (
            <button
              key={mes}
              onClick={() => setMesActual(mes)}
              className={`rounded-xl border p-3 text-left transition-all ${
                activo
                  ? "border-[#004990] bg-[#004990] text-white shadow-md"
                  : "border-gray-200 bg-white hover:border-[#004990] hover:shadow-sm"
              }`}
            >
              <p className={`text-xs font-bold ${activo ? "text-blue-200" : "text-gray-400"}`}>
                {formatMes(mes, true)} {mes.slice(0, 4)}
              </p>
              <p className={`text-sm font-bold font-mono mt-0.5 ${activo ? "text-white" : "text-gray-800"}`}>
                {d.total > 0
                  ? `S/ ${(d.total / 1000).toFixed(0)}k`
                  : <span className={activo ? "text-blue-300" : "text-gray-300"}>—</span>}
              </p>
              <p className={`text-[10px] mt-0.5 ${activo ? "text-blue-200" : "text-gray-400"}`}>
                {d.count} ítem{d.count !== 1 ? "s" : ""}
              </p>
              {d.total > 0 && (
                <div className={`mt-1.5 h-1 rounded-full ${activo ? "bg-white/20" : "bg-gray-100"}`}>
                  <div
                    className={`h-full rounded-full transition-all ${activo ? "bg-green-300" : "bg-green-500"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tabs de área ──────────────────────────────────── */}
      {tabsVisibles.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200">
          {AREAS_CONFIG.filter((a) => tabsVisibles.includes(a.id)).map((area) => (
            <button key={area.id} type="button"
              onClick={() => setAreaTab(area.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                areaTab === area.id
                  ? "border-[#004990] text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {area.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Resumen del mes ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total mes (S/)", valor: resumen.total,      color: "text-gray-800"   },
          { label: "Pendiente (S/)", valor: resumen.pendiente,  color: "text-amber-700"  },
          { label: "Pagado (S/)",    valor: resumen.pagado,     color: "text-green-700"  },
          { label: "Postergado (S/)",valor: resumen.postergado, color: "text-purple-700" },
        ].map(({ label, valor, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-lg font-bold font-mono mt-0.5 ${color}`}>
              {`S/ ${valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        ))}
      </div>
      {/* Barra de progreso del mes */}
      {resumen.total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progreso de pago — {formatMes(mesActual)}</span>
            <span className="font-semibold text-green-700">{resumen.pctPagado.toFixed(0)}% pagado</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, resumen.pctPagado)}%` }} />
          </div>
        </div>
      )}

      {/* ── Controles de tabla ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Ordenar:</span>
          {[
            { id: "urgencia", label: "Urgencia" },
            { id: "monto",    label: "Monto" },
            { id: "proveedor",label: "Proveedor" },
          ].map((o) => (
            <button key={o.id} type="button" onClick={() => setOrdenar(o.id)}
              className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                ordenar === o.id
                  ? "bg-[#004990] text-white border-[#004990]"
                  : "bg-white text-gray-600 border-gray-300 hover:border-[#004990]"
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)}
            className="accent-[#004990]" />
          Solo pendientes
        </label>
      </div>

      {/* ── Tabla ─────────────────────────────────────────── */}
      {cargando ? (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando plan de pagos…</div>
      ) : transDelMes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p className="text-sm">No hay ítems programados para {formatMes(mesActual)}.</p>
          <p className="text-xs mt-1 text-gray-400">Asigna un mes de vencimiento a tus transacciones en Flujos Financieros.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Urgencia</Th>
                {areaTab === "consolidado" && <Th>Área</Th>}
                <Th>Proveedor</Th>
                <Th>Centro de Costo</Th>
                <Th>Concepto</Th>
                <Th className="text-right">Monto</Th>
                <Th>Doc</Th>
                <Th>OC</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {transDelMes.map((t) => {
                const dias = diasTranscurridos(t);
                const { clase, label } = semaforo(t.estado === "Pagado" ? null : dias);
                const ocupado = actualizando.has(t.id);
                return (
                  <tr key={t.id}
                    className={`border-t border-gray-100 transition-colors ${
                      t.postergado ? "bg-purple-50/40" : "hover:bg-gray-50"
                    } ${ocupado ? "opacity-50" : ""}`}
                  >
                    {/* Semáforo urgencia */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.estado === "Pagado" ? (
                        <span className="text-green-600 font-semibold">✓ Pagado</span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${clase}`}>
                          {label || "—"}
                        </span>
                      )}
                    </td>

                    {/* Área (solo consolidado) */}
                    {areaTab === "consolidado" && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                          {t.area || "—"}
                        </span>
                      </td>
                    )}

                    {/* Proveedor */}
                    <td className="px-3 py-2 max-w-[160px]">
                      <p className="font-medium text-gray-800 truncate" title={t.proveedor_cliente_nombre}>
                        {t.proveedor_cliente_nombre || "—"}
                      </p>
                      {t.proveedor_cliente_id && (
                        <p className="text-[10px] text-gray-400">{t.proveedor_cliente_id}</p>
                      )}
                    </td>

                    {/* Centro de costo */}
                    <td className="px-3 py-2 max-w-[120px] truncate text-gray-600"
                      title={t.centro_costo_nombre}>
                      {t.centro_costo_nombre || "—"}
                    </td>

                    {/* Concepto */}
                    <td className="px-3 py-2 max-w-[160px] truncate text-gray-600"
                      title={t.categoriaNombre || t.notas}>
                      {t.categoriaNombre || t.notas || "—"}
                    </td>

                    {/* Monto */}
                    <td className="px-3 py-2 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                      {fmtMonto(t.monto_total, t.moneda)}
                      {t.moneda && t.moneda !== "PEN" && t.monto_total_pen && (
                        <p className="text-[10px] text-gray-400 font-normal">
                          {fmtMonto(t.monto_total_pen, "PEN")}
                        </p>
                      )}
                    </td>

                    {/* Documento */}
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {[t.documento_tipo, t.documento_numero].filter(Boolean).join(" ") || "—"}
                    </td>

                    {/* OC */}
                    <td className="px-3 py-2">
                      {t.oc_numero ? (
                        <button onClick={() => navigate(`/ver?id=${t.oc_id || ""}`)}
                          className="text-black hover:underline font-mono text-[10px]">
                          {t.oc_numero}
                        </button>
                      ) : "—"}
                    </td>

                    {/* Estado inline */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {editandoEstado === t.id ? (
                        <select
                          autoFocus
                          defaultValue={t.estado}
                          onBlur={() => setEditandoEstado(null)}
                          onChange={(e) => handleCambiarEstado(t, e.target.value)}
                          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#004990]"
                        >
                          {ESTADOS_OPCIONES.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      ) : (
                        <button
                          disabled={!puedeEscribir || ocupado}
                          onClick={() => puedeEscribir && setEditandoEstado(t.id)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${estadoBadge(t.estado)} ${puedeEscribir ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                        >
                          {t.estado || "Sin estado"}
                        </button>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {puedeEscribir && t.estado !== "Pagado" && (
                        t.postergado ? (
                          <button
                            disabled={ocupado}
                            onClick={() => handleDespostergado(t)}
                            title="Quitar postergado"
                            className="text-purple-600 hover:text-purple-700 text-[10px] font-medium underline disabled:opacity-40"
                          >
                            ↺ Restablecer
                          </button>
                        ) : (
                          <button
                            disabled={ocupado}
                            onClick={() => handlePostergar(t)}
                            title={`Mover a ${formatMes(addMonths(t.mesVencimiento || mesActual, 1), true)}`}
                            className="text-amber-600 hover:text-amber-700 text-[10px] font-medium disabled:opacity-40 flex items-center gap-0.5"
                          >
                            ⏭ Postergar
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Leyenda semáforo ──────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 pt-1">
        <span className="font-semibold">Semáforo deuda:</span>
        {[
          { clase: "text-blue-600 bg-blue-50",    label: "Futuro"    },
          { clase: "text-green-700 bg-green-50",  label: "< 30 días" },
          { clase: "text-yellow-700 bg-yellow-50",label: "30-60 días"},
          { clase: "text-orange-700 bg-orange-50",label: "60-90 días"},
          { clase: "text-red-700 bg-red-50",      label: "> 90 días" },
        ].map(({ clase, label }) => (
          <span key={label} className={`px-2 py-0.5 rounded-full font-bold ${clase}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}

// ── Helpers UI ────────────────────────────────────────────────
function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2 text-left text-[11px] font-semibold text-gray-600 whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function estadoBadge(estado) {
  const map = {
    "Pagado":      "bg-green-100 text-green-700 border-green-200",
    "Pendiente":   "bg-amber-100 text-amber-700 border-amber-200",
    "Programado":  "bg-blue-100 text-blue-700 border-blue-200",
    "En proceso":  "bg-indigo-100 text-indigo-700 border-indigo-200",
    "Vencido":     "bg-red-100 text-red-700 border-red-200",
    "Postergado":  "bg-purple-100 text-purple-700 border-purple-200",
  };
  return map[estado] || "bg-gray-100 text-gray-600 border-gray-200";
}
