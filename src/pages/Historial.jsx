// ✅ src/pages/Historial.jsx
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { obtenerOCs } from "../firebase/firestoreHelpers";
import { useUsuario } from "../context/UsuarioContext";
import VerOCModal from "../components/VerOCModal";

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────
const getOrderNumber = (oc) => {
  const raw = oc?.numeroOC || oc?.numero || "";
  const m = String(raw).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : -Infinity;
};

const normalizeStr = (v) => (v || "").toString().trim().toLowerCase();
const parseDate = (s) => {
  const t = Date.parse(s);
  return isNaN(t) ? -Infinity : t;
};

const exportarExcel = (ordenes) => {
  const data = ordenes.map((oc) => ({
    "N° OC": oc.numeroOC || oc.numero || "",
    Proveedor: oc.proveedor?.razonSocial || "",
    "Fecha Emisión": oc.fechaEmision || "",
    Estado: oc.estado || "",
    "N° Factura": oc.numeroFactura || "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ordenes de Compra");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf]), `Historial_OC_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ───────────────────────────────────────────────────────────────────────────────
// Componente
// ───────────────────────────────────────────────────────────────────────────────
const Historial = () => {
  const { usuario, loading } = useUsuario();

  const [ordenes, setOrdenes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  // Ordenamiento (default: N° OC de mayor a menor)
  const [sortKey, setSortKey] = useState("numero");
  const [sortDir, setSortDir] = useState("desc");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 15;

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [ocSeleccionada, setOcSeleccionada] = useState(null);

  useEffect(() => {
    if (!loading && usuario) {
      (async () => {
        const data = await obtenerOCs();
        setOrdenes(data || []);
      })();
    }
  }, [usuario, loading]);

  const ordenesProcesadas = useMemo(() => {
    const filtradas = (ordenes || []).filter((oc) => {
      const q = normalizeStr(busqueda);
      const n = normalizeStr(oc.numeroOC || oc.numero);
      const p = normalizeStr(oc.proveedor?.razonSocial);
      const e = normalizeStr(oc.estado);
      const matchTexto = n.includes(q) || p.includes(q) || e.includes(q);
      const matchEstado = estadoFiltro === "Todos" || oc.estado === estadoFiltro;
      return matchTexto && matchEstado;
    });

    const compare = (a, b) => {
      let va, vb;
      switch (sortKey) {
        case "numero":
          va = getOrderNumber(a); vb = getOrderNumber(b); break;
        case "proveedor":
          va = normalizeStr(a.proveedor?.razonSocial);
          vb = normalizeStr(b.proveedor?.razonSocial);
          break;
        case "fecha":
          va = parseDate(a.fechaEmision); vb = parseDate(b.fechaEmision);
          break;
        case "estado":
          va = normalizeStr(a.estado); vb = normalizeStr(b.estado);
          break;
        default: va = 0; vb = 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      // desempate por número desc
      const na = getOrderNumber(a), nb = getOrderNumber(b);
      if (na < nb) return 1;
      if (na > nb) return -1;
      return 0;
    };

    return [...filtradas].sort(compare);
  }, [ordenes, busqueda, estadoFiltro, sortKey, sortDir]);

  const totalPaginas = Math.ceil(ordenesProcesadas.length / elementosPorPagina);
  const ordenesPaginadas = ordenesProcesadas.slice(
    (paginaActual - 1) * elementosPorPagina,
    paginaActual * elementosPorPagina
  );

  const toggleDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  // callback que recibe VerOCModal al firmar/rechazar
  const handleOCActualizada = (ocActualizada) => {
    setOrdenes((prev) =>
      prev.map((x) => (x.id === ocActualizada.id ? ocActualizada : x))
    );
    setOcSeleccionada(ocActualizada);
  };

  if (loading) return <div className="p-6">Cargando usuario…</div>;
  if (!usuario || !["admin", "gerencia", "operaciones", "comprador", "finanzas"].includes(usuario?.rol)) {
    return <div className="p-6">Acceso no autorizado</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Historial de Órdenes</h2>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por N° OC, proveedor o estado"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
          className="p-2 border rounded w-full md:w-1/2 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        />

        <select
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value); setPaginaActual(1); }}
          className="p-2 border rounded w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        >
          <option value="Todos">Todos los estados</option>
          <option value="Pendiente de Firma del Comprador">Pendiente de Firma del Comprador</option>
          <option value="Pendiente de Operaciones">Pendiente de Operaciones</option>
          <option value="Aprobado por Operaciones">Aprobado por Operaciones</option>
          <option value="Aprobado por Gerencia">Aprobado por Gerencia</option>
          <option value="Rechazado">Rechazado</option>
          <option value="Pagado">Pagado</option>
        </select>
      </div>

      {/* Ordenamiento + Export general */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Ordenar por:</span>
          <select
            value={sortKey}
            onChange={(e) => { setSortKey(e.target.value); setPaginaActual(1); }}
            className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          >
            <option value="numero">N° de Orden</option>
            <option value="proveedor">Proveedor</option>
            <option value="fecha">Fecha de Emisión</option>
            <option value="estado">Estado</option>
          </select>
          <button
            onClick={() => { toggleDir(); setPaginaActual(1); }}
            className="px-3 py-2 border rounded bg-white hover:bg-gray-50"
            title="Cambiar dirección"
          >
            {sortDir === "asc" ? "Ascendente ▲" : "Descendente ▼"}
          </button>
        </div>

        <div className="ml-auto">
          <button
            onClick={() => exportarExcel(ordenesProcesadas)}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded"
          >
            Exportar listado
          </button>
        </div>
      </div>

      {/* Tabla */}
      {ordenesProcesadas.length === 0 ? (
        <p className="text-gray-600">No hay órdenes disponibles.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-100 text-center">
                <tr>
                  <th className="border px-3 py-2 cursor-pointer" onClick={() => { setSortKey("numero"); toggleDir(); setPaginaActual(1); }}>N° OC</th>
                  <th className="border px-3 py-2 cursor-pointer" onClick={() => { setSortKey("proveedor"); toggleDir(); setPaginaActual(1); }}>Proveedor</th>
                  <th className="border px-3 py-2 cursor-pointer" onClick={() => { setSortKey("fecha"); toggleDir(); setPaginaActual(1); }}>Fecha</th>
                  <th className="border px-3 py-2 cursor-pointer" onClick={() => { setSortKey("estado"); toggleDir(); setPaginaActual(1); }}>Estado</th>
                  <th className="border px-3 py-2">Factura</th>
                  <th className="border px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesPaginadas.map((oc) => (
                  <tr key={oc.id} className="text-center border-t">
                    <td className="border px-3 py-2 font-semibold">{oc.numeroOC || oc.numero}</td>
                    <td className="border px-3 py-2">{oc.proveedor?.razonSocial || "—"}</td>
                    <td className="border px-3 py-2">{oc.fechaEmision || "—"}</td>
                    <td className="border px-3 py-2">
                      <span
                        className={`font-medium px-2 py-1 rounded-full ${
                          oc.estado === "Pagado"
                            ? "text-green-700 bg-green-100"
                            : oc.estado === "Rechazado"
                            ? "text-red-700 bg-red-100"
                            : oc.estado?.includes("Aprobado")
                            ? "text-blue-700 bg-blue-100"
                            : "text-gray-700 bg-gray-100"
                        }`}
                      >
                        {oc.estado}
                      </span>
                    </td>
                    <td className="border px-3 py-2 text-xs">
                      {oc.estado === "Pagado" && oc.numeroFactura ? oc.numeroFactura : "—"}
                    </td>
                    <td className="border px-3 py-2">
                      <div className="flex flex-wrap justify-center gap-3">
                        <button
                          className="text-blue-600 underline"
                          onClick={() => { setOcSeleccionada(oc); setModalAbierto(true); }}
                        >
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex justify-center mt-4 gap-2">
            {Array.from({ length: totalPaginas }, (_, i) => (
              <button
                key={i}
                className={`px-3 py-1 border rounded ${
                  i + 1 === paginaActual ? "bg-[#004990] text-white" : "bg-white text-[#004990] border-[#004990]"
                }`}
                onClick={() => setPaginaActual(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Modal Ver OC */}
      {modalAbierto && ocSeleccionada && (
        <VerOCModal
          oc={ocSeleccionada}
          onClose={() => setModalAbierto(false)}
          onUpdated={handleOCActualizada}
        />
      )}
    </div>
  );
};

export default Historial;
