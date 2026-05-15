// src/pages/PagosPorCentroCosto.jsx
// [F-01] Módulo de pagos agrupados por centro de costo.
// Muestra órdenes pagadas y pendientes de pago, con resumen financiero por CC.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerOCsPorEstadoPago } from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import ExportMenu from "../components/ExportMenu";
import { useUsuario } from "../context/UsuarioContext";
import BackButton from "../components/ui/BackButton";

const ESTADO_BADGE = {
  "Pendiente de Comprador":            "bg-gray-100 text-gray-600",
  "Pendiente de Operaciones":          "bg-purple-100 text-purple-700",
  "Pendiente de Gerencia Operaciones": "bg-purple-100 text-purple-700",
  "Pendiente de Gerencia General":     "bg-indigo-100 text-indigo-700",
  Aprobada:                            "bg-blue-100 text-blue-700",
  "Pago Parcial":                      "bg-amber-100 text-amber-700",
  Pagado:                              "bg-green-100 text-green-700",
};

const ESTADO_LABEL = {
  Aprobada: "Pendiente pago",
};

const normaliza = (v) => String(v || "").toLowerCase();

// Columnas para export
const EXPORT_COLS = ["numero","tipoOrden","proveedor","centroCosto","moneda","total","montoPagado","montoPendiente","estado","fechaEmision","fechaPago"];
const EXPORT_HDRS = {
  numero: "N° OC", tipoOrden: "Tipo", proveedor: "Proveedor", centroCosto: "Centro de Costo",
  moneda: "Moneda", total: "Total OC", montoPagado: "Pagado", montoPendiente: "Pendiente",
  estado: "Estado", fechaEmision: "Fecha Emisión", fechaPago: "Fecha Pago",
};
const flattenRow = (oc) => ({
  numero:         oc.numero || oc.numeroOC || "",
  tipoOrden:      oc.tipoOrden || "OC",
  proveedor:      oc.proveedor?.razonSocial || "",
  centroCosto:    oc.centroCosto || "Sin CC",
  moneda:         oc.monedaSeleccionada || "Soles",
  total:          Number(oc.resumen?.total || oc.total || 0).toFixed(2),
  montoPagado:    Number(oc.montoPagado || 0).toFixed(2),
  montoPendiente: Math.max(0, Number(oc.resumen?.total || oc.total || 0) - Number(oc.montoPagado || 0)).toFixed(2),
  estado:         oc.estado || "",
  fechaEmision:   oc.fechaEmision || "",
  fechaPago:      oc.fechaPago || "",
});

// ────────────────────────────────────────────────────────────
const PagosPorCentroCosto = () => {
  const { usuario } = useUsuario();
  const navigate = useNavigate();

  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroMoneda, setFiltroMoneda] = useState("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [ccExpandido, setCcExpandido] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await obtenerOCsPorEstadoPago();
        setOrdenes(data);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // Filtrado general
  const ordenesFiltradas = useMemo(() => {
    return ordenes.filter((oc) => {
      const q = normaliza(busqueda);
      const matchTexto =
        !q ||
        normaliza(oc.numero || oc.numeroOC).includes(q) ||
        normaliza(oc.proveedor?.razonSocial).includes(q) ||
        normaliza(oc.centroCosto).includes(q);
      const matchEstado = filtroEstado === "Todos" || oc.estado === filtroEstado;
      const matchMoneda = filtroMoneda === "Todos" || oc.monedaSeleccionada === filtroMoneda;
      const fecha = oc.fechaEmision || "";
      const matchDesde = !fechaDesde || fecha >= fechaDesde;
      const matchHasta = !fechaHasta || fecha <= fechaHasta;
      return matchTexto && matchEstado && matchMoneda && matchDesde && matchHasta;
    });
  }, [ordenes, busqueda, filtroEstado, filtroMoneda, fechaDesde, fechaHasta]);

  // Agrupación por centro de costo
  const grupoPorCC = useMemo(() => {
    const mapa = {};
    for (const oc of ordenesFiltradas) {
      const cc = oc.centroCosto || "Sin Centro de Costo";
      if (!mapa[cc]) mapa[cc] = { ocs: [], totalSoles: 0, pagadoSoles: 0, pendienteSoles: 0 };
      const total = Number(oc.resumen?.total || oc.total || 0);
      const pagado = Number(oc.montoPagado || 0);
      const tc = Number(oc.tipoCambio || 3.8);
      const factor = (oc.monedaSeleccionada === "Dólares" || oc.monedaSeleccionada === "USD") ? tc : 1;
      mapa[cc].ocs.push(oc);
      mapa[cc].totalSoles += total * factor;
      mapa[cc].pagadoSoles += pagado * factor;
      mapa[cc].pendienteSoles += Math.max(0, total - pagado) * factor;
    }
    return Object.entries(mapa).sort((a, b) => b[1].pendienteSoles - a[1].pendienteSoles);
  }, [ordenesFiltradas]);

  // Totales globales
  const totalesGlobales = useMemo(() => {
    return grupoPorCC.reduce(
      (acc, [, g]) => ({
        total: acc.total + g.totalSoles,
        pagado: acc.pagado + g.pagadoSoles,
        pendiente: acc.pendiente + g.pendienteSoles,
      }),
      { total: 0, pagado: 0, pendiente: 0 }
    );
  }, [grupoPorCC]);

  const dataExport = useMemo(() => ordenesFiltradas.map(flattenRow), [ordenesFiltradas]);

  if (cargando) return <div className="p-6 text-gray-500">Cargando...</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <BackButton />
            <h2 className="text-2xl font-bold text-black">Pagos por Centro de Costo</h2>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {ordenesFiltradas.length} orden{ordenesFiltradas.length !== 1 ? "es" : ""} — valores convertidos a Soles para resumen
          </p>
        </div>
        <ExportMenu
          data={dataExport}
          nombre="pagos-por-cc"
          titulo="Pagos por Centro de Costo"
          columnas={EXPORT_COLS}
          headers={EXPORT_HDRS}
        />
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total OCs (S/)", valor: totalesGlobales.total, color: "text-gray-800" },
          { label: "Pagado (S/)",    valor: totalesGlobales.pagado,   color: "text-green-700" },
          { label: "Pendiente (S/)", valor: totalesGlobales.pendiente, color: "text-amber-700" },
        ].map(({ label, valor, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold font-mono ${color}`}>
              {formatearMoneda(valor, "Soles")}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          className="border rounded px-3 py-2 text-sm col-span-1 lg:col-span-2"
          placeholder="Buscar OC, proveedor o CC…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select className="border rounded px-3 py-2 text-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="Todos">Todos los estados</option>
          <option value="Pendiente de Comprador">Pendiente de Comprador</option>
          <option value="Pendiente de Operaciones">Pendiente de Operaciones</option>
          <option value="Pendiente de Gerencia General">Pendiente de Gerencia General</option>
          <option value="Aprobada">Pendiente de pago</option>
          <option value="Pago Parcial">Pago Parcial</option>
          <option value="Pagado">Pagado</option>
        </select>
        <select className="border rounded px-3 py-2 text-sm" value={filtroMoneda} onChange={(e) => setFiltroMoneda(e.target.value)}>
          <option value="Todos">Todas las monedas</option>
          <option value="Soles">Soles</option>
          <option value="Dólares">Dólares</option>
        </select>
        <div className="flex gap-2">
          <input type="date" className="border rounded px-2 py-2 text-sm flex-1" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          <input type="date" className="border rounded px-2 py-2 text-sm flex-1" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
      </div>

      {/* Grupos por CC */}
      {grupoPorCC.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No hay órdenes que coincidan con los filtros.</div>
      ) : (
        <div className="space-y-4">
          {grupoPorCC.map(([cc, grupo]) => {
            const abierto = ccExpandido === cc;
            const pct = grupo.totalSoles > 0 ? (grupo.pagadoSoles / grupo.totalSoles) * 100 : 0;

            return (
              <div key={cc} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Cabecera del grupo */}
                <button
                  className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setCcExpandido(abierto ? null : cc)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-black font-bold text-base truncate">{cc}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                      {grupo.ocs.length} orden{grupo.ocs.length !== 1 ? "es" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total</p>
                      <p className="font-mono font-semibold text-gray-800">{formatearMoneda(grupo.totalSoles, "Soles")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Pagado</p>
                      <p className="font-mono font-semibold text-green-700">{formatearMoneda(grupo.pagadoSoles, "Soles")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Pendiente</p>
                      <p className="font-mono font-semibold text-amber-700">{formatearMoneda(grupo.pendienteSoles, "Soles")}</p>
                    </div>
                    <span className="text-gray-400 text-lg">{abierto ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Barra de progreso */}
                <div className="h-1 bg-gray-100 mx-5 mb-1 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 px-5 pb-3">{pct.toFixed(0)}% pagado</p>

                {/* Detalle expandible */}
                {abierto && (
                  <div className="border-t overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {["N° OC","Tipo","Proveedor","Moneda","Total OC","Pagado","Pendiente","Estado","Fecha",""].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.ocs.map((oc) => {
                          const total = Number(oc.resumen?.total || oc.total || 0);
                          const pagado = Number(oc.montoPagado || 0);
                          const pendiente = Math.max(0, total - pagado);
                          const moneda = oc.monedaSeleccionada || "Soles";
                          return (
                            <tr key={oc.id} className="border-t hover:bg-gray-50 transition-colors">
                              <td className="px-3 py-2 font-mono font-semibold text-black">{oc.numero || oc.numeroOC}</td>
                              <td className="px-3 py-2">{oc.tipoOrden || "OC"}</td>
                              <td className="px-3 py-2 max-w-[160px] truncate">{oc.proveedor?.razonSocial || "—"}</td>
                              <td className="px-3 py-2">{moneda}</td>
                              <td className="px-3 py-2 font-mono">{formatearMoneda(total, moneda)}</td>
                              <td className="px-3 py-2 font-mono text-green-700">{pagado > 0 ? formatearMoneda(pagado, moneda) : "—"}</td>
                              <td className="px-3 py-2 font-mono text-amber-700">{pendiente > 0 ? formatearMoneda(pendiente, moneda) : "—"}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${ESTADO_BADGE[oc.estado] || "bg-gray-100 text-gray-600"}`}>
                                  {ESTADO_LABEL[oc.estado] || oc.estado}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-400">{oc.fechaEmision || "—"}</td>
                              <td className="px-3 py-2">
                                <button
                                  className="text-black hover:underline font-semibold"
                                  onClick={() => navigate(`/ver?id=${oc.id}`)}
                                >
                                  Ver →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PagosPorCentroCosto;
