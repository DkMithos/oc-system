// src/pages/HistorialPagos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerOCs, obtenerFacturasDeOrden } from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import ExportMenu from "../components/ExportMenu";

const normaliza = (v) => String(v || "").toLowerCase();

const PAGOS_HEADERS = {
  numeroOC: "N° OC", tipoOrden: "Tipo", proveedor_rs: "Proveedor", proveedor_ruc: "RUC",
  numeroFactura: "N° Factura", fechaPago: "Fecha Pago", tipoPago: "Tipo Pago",
  monedaSeleccionada: "Moneda", total_oc: "Total OC", montoPagado: "Monto Pagado",
  montoPendiente: "Pendiente", detraccion_monto: "Detracción", retencion_monto: "Retención",
  tipoCambio: "T/C", centroCosto: "Centro Costo",
  responsable: "Responsable", requerimiento: "Requerimiento",
};
const PAGOS_COLS = Object.keys(PAGOS_HEADERS);
const flattenPago = (o) => ({
  ...o,
  proveedor_rs:     o.proveedor?.razonSocial || "",
  proveedor_ruc:    o.proveedor?.ruc || "",
  total_oc:         o.resumen?.total?.toFixed(2) || "",
  montoPagado:      o.montoPagado != null ? Number(o.montoPagado).toFixed(2) : "",
  montoPendiente:   o.montoPendiente != null ? Number(o.montoPendiente).toFixed(2) : "",
  detraccion_monto: o.detraccion?.aplica ? Number(o.detraccion.monto || 0).toFixed(2) : "",
  retencion_monto:  o.retencion?.aplica  ? Number(o.retencion.monto  || 0).toFixed(2) : "",
  tipoCambio:       o.tipoCambio ? Number(o.tipoCambio).toFixed(3) : "",
});

// ──────────────────────────────────────────────────────────────
const HistorialPagos = () => {
  const { usuario, cargando: loading } = useUsuario();

  const [pagadas, setPagadas]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [abierta, setAbierta]       = useState(null);
  const [facturas, setFacturas]     = useState([]);
  const [busqueda, setBusqueda]     = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const data = await obtenerOCs(500);
        setPagadas((data || []).filter((o) => o.estado === "Pagado" || o.estado === "Pago Parcial"));
      } finally {
        setCargando(false);
      }
    })();
  }, [loading]);

  const verFacturas = async (oc) => {
    setAbierta(oc);
    const f = await obtenerFacturasDeOrden(oc.id);
    setFacturas(f);
  };

  const filtradas = useMemo(() => {
    return pagadas.filter((o) => {
      const q = normaliza(busqueda);
      const matchTexto =
        !q ||
        normaliza(o.numeroOC || o.numero).includes(q) ||
        normaliza(o.proveedor?.razonSocial).includes(q) ||
        normaliza(o.numeroFactura).includes(q);
      const fecha = o.fechaPago || "";
      return matchTexto &&
        (!fechaDesde || fecha >= fechaDesde) &&
        (!fechaHasta || fecha <= fechaHasta);
    });
  }, [pagadas, busqueda, fechaDesde, fechaHasta]);

  const totalPagado = useMemo(
    () => filtradas.reduce((acc, o) => acc + Number(o.montoPagado || 0), 0),
    [filtradas]
  );

  if (loading || cargando) return <div className="p-6">Cargando…</div>;
  if (!usuario || !["admin", "finanzas", "gerencia finanzas", "gerencia general"].includes(usuario.rol)) {
    return <div className="p-6 text-red-600">Acceso no autorizado</div>;
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <h2 className="page-title">Historial de Pagos</h2>
        <ExportMenu
          data={filtradas.map(flattenPago)}
          nombre={`historial-pagos-${new Date().toISOString().slice(0,10)}`}
          titulo="Historial de Pagos"
          columnas={PAGOS_COLS}
          headers={PAGOS_HEADERS}
        />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar N° OC, proveedor, factura..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border rounded p-2 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">Desde:</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
            className="border rounded p-2 text-sm w-full" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">Hasta:</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
            className="border rounded p-2 text-sm w-full" />
        </div>
      </div>

      {/* KPI */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm">
        <span className="font-medium">Total pagado (filtro actual): </span>
        <span className="text-green-700 font-bold text-base">{formatearMoneda(totalPagado, "Soles")}</span>
        <span className="text-gray-500 ml-3">({filtradas.length} {filtradas.length === 1 ? "registro" : "registros"})</span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">N° OC</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Proveedor</th>
              <th className="p-2 text-left">N° Factura</th>
              <th className="p-2 text-left">Fecha Pago</th>
              <th className="p-2 text-left">Tipo Pago</th>
              <th className="p-2 text-right">Total OC</th>
              <th className="p-2 text-right">Pagado</th>
              <th className="p-2 text-right">Pendiente</th>
              <th className="p-2 text-center">Detracción</th>
              <th className="p-2 text-center">Retención</th>
              <th className="p-2 text-center">T/C</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-4 text-center text-gray-500">
                  No hay pagos registrados con los filtros actuales.
                </td>
              </tr>
            ) : filtradas.map((o) => {
              const moneda = o.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles";
              return (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono font-semibold">{o.numeroOC || o.numero}</td>
                  <td className="p-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      o.estado === "Pagado" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                    }`}>{o.estado}</span>
                  </td>
                  <td className="p-2">{o.proveedor?.razonSocial || "—"}</td>
                  <td className="p-2">{o.numeroFactura || "—"}</td>
                  <td className="p-2">{o.fechaPago || "—"}</td>
                  <td className="p-2">{o.tipoPago || "—"}</td>
                  <td className="p-2 text-right">{formatearMoneda(o.resumen?.total || 0, moneda)}</td>
                  <td className="p-2 text-right text-green-700 font-semibold">
                    {o.montoPagado != null ? formatearMoneda(Number(o.montoPagado), moneda) : "—"}
                  </td>
                  <td className="p-2 text-right text-red-600">
                    {o.montoPendiente != null && o.montoPendiente > 0
                      ? formatearMoneda(Number(o.montoPendiente), moneda)
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-2 text-center text-xs">
                    {o.detraccion?.aplica
                      ? <span className="text-amber-700">{o.detraccion.tasa}% ({formatearMoneda(o.detraccion.monto, "Soles")})</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-2 text-center text-xs">
                    {o.retencion?.aplica
                      ? <span className="text-purple-700">{o.retencion.tasa}% ({formatearMoneda(o.retencion.monto, "Soles")})</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-2 text-center text-xs text-gray-600">
                    {o.tipoCambio ? Number(o.tipoCambio).toFixed(3) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="p-2">
                    <button className="text-blue-700 underline text-xs" onClick={() => verFacturas(o)}>
                      Ver adjuntos
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Panel de adjuntos */}
      {abierta && (
        <div className="mt-4 bg-white rounded shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">
              Adjuntos — {abierta.numeroOC || abierta.numero} · {abierta.proveedor?.razonSocial}
            </h3>
            <button
              onClick={() => { setAbierta(null); setFacturas([]); }}
              className="text-sm px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cerrar
            </button>
          </div>
          {facturas.length === 0 ? (
            <p className="text-sm text-gray-500">Esta OC no tiene adjuntos registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">N° Factura</th>
                  <th className="p-2 text-left">Fecha</th>
                  <th className="p-2 text-right">Monto</th>
                  <th className="p-2 text-left">Tipo Pago</th>
                  <th className="p-2 text-left">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="border-t">
                    <td className="p-2">{f.numero || "—"}</td>
                    <td className="p-2">{f.fecha || "—"}</td>
                    <td className="p-2 text-right">{f.monto != null ? Number(f.monto).toFixed(2) : "—"}</td>
                    <td className="p-2">{f.tipoPago || "—"}</td>
                    <td className="p-2">
                      {f.urlAdjunto ? (
                        <a href={f.urlAdjunto} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                          Ver archivo
                        </a>
                      ) : <span className="text-gray-400">Sin adjunto</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default HistorialPagos;
