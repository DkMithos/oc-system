import React, { useEffect, useState } from "react";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { useNavigate } from "react-router-dom";
import { useUsuario } from "../context/UsuarioContext";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { oc } from "date-fns/locale";

const exportarExcel = (ordenes) => {
  const data = ordenes.map((oc) => ({
    "N° OC": oc.numeroOC || "",
    Proveedor: oc.proveedor?.razonSocial || "",
    "Fecha Emisión": oc.fechaEmision || "",
    Estado: oc.estado || "",
    "N° Factura": oc.numeroFactura || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ordenes de Compra");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `Historial_OC_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

const Historial = () => {
  const { usuario, loading } = useUsuario();
  const navigate = useNavigate();

  const [ordenes, setOrdenes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 5;

  useEffect(() => {
    if (!loading && usuario) {
      const cargarOCs = async () => {
        const data = await obtenerOCs();
        setOrdenes(data);
      };
      cargarOCs();
    }
  }, [usuario, loading]);

  const debeFirmar = (oc) => {
    const rol = usuario?.rol;
    if (rol === "comprador" && oc.estado === "Pendiente de Firma del Comprador") return true;
    return false;
  }

  const puedeFirmar = (oc) => {
    const rol = usuario?.rol;
    if (rol === "operaciones" && oc.estado === "Pendiente de Operaciones") return true;
    if (rol === "gerencia" && oc.estado === "Aprobado por Operaciones") return true;
    return false;
  };

  const filtrarOrdenes = () => {
    return ordenes
      .filter((oc) => {
        const busquedaLower = busqueda.toLowerCase();
        return (
          oc.numeroOC?.toLowerCase().includes(busquedaLower) ||
          oc.proveedor?.razonSocial?.toLowerCase().includes(busquedaLower) ||
          oc.estado?.toLowerCase().includes(busquedaLower)
        );
      })
      .filter((oc) => estadoFiltro === "Todos" || oc.estado === estadoFiltro);
  };

  const ordenesFiltradas = filtrarOrdenes();
  const totalPaginas = Math.ceil(ordenesFiltradas.length / elementosPorPagina);
  const ordenesPaginadas = ordenesFiltradas.slice(
    (paginaActual - 1) * elementosPorPagina,
    paginaActual * elementosPorPagina
  );

  if (loading) return <div className="p-6">Cargando usuario.</div>;
  if (!usuario || !["admin", "gerencia", "operaciones", "comprador", "finanzas"].includes(usuario?.rol)) {
    return <div className="p-6">Acceso no autorizado</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Historial de Órdenes de Compra</h2>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por N° OC, proveedor o estado"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPaginaActual(1);
          }}
          className="p-2 border rounded w-full md:w-1/2 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        />
        <select
          value={estadoFiltro}
          onChange={(e) => {
            setEstadoFiltro(e.target.value);
            setPaginaActual(1);
          }}
          className="p-2 border rounded w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        >
          <option value="Todos">Todos los estados</option>
          <option value="Pendiente de Operaciones">Pendiente de Operaciones</option>
          <option value="Aprobado por Operaciones">Aprobado por Operaciones</option>
          <option value="Aprobado por Gerencia">Aprobado por Gerencia</option>
          <option value="Rechazado">Rechazado</option>
          <option value="Pagado">Pagado</option>
        </select>
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={() => exportarExcel(ordenesFiltradas)}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded"
        >
          Exportar a Excel
        </button>
      </div>

      {/* Tabla */}
      {ordenesFiltradas.length === 0 ? (
        <p className="text-gray-600">No hay órdenes disponibles.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-100 text-center">
                <tr>
                  <th className="border px-3 py-2">N° OC</th>
                  <th className="border px-3 py-2">Proveedor</th>
                  <th className="border px-3 py-2">Fecha</th>
                  <th className="border px-3 py-2">Estado</th>
                  <th className="border px-3 py-2">Factura</th>
                  <th className="border px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesPaginadas.map((oc) => (
                  <tr key={oc.id} className="text-center border-t">
                    <td className="border px-3 py-2 font-semibold">{oc.numeroOC}</td>
                    <td className="border px-3 py-2">{oc.proveedor?.razonSocial || "—"}</td>
                    <td className="border px-3 py-2">{oc.fechaEmision}</td>
                    <td className="border px-3 py-2">
                      <span
                        className={`font-medium px-2 py-1 rounded-full ${
                          oc.estado === "Pagado"
                            ? "text-green-700 bg-green-100"
                            : oc.estado === "Rechazado"
                            ? "text-red-700 bg-red-100"
                            : oc.estado.includes("Aprobado")
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
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          onClick={() => navigate(`/ver?id=${oc.id}`)}
                          className="text-blue-600 underline"
                        >
                          Ver
                        </button>

                        {oc.estado === "Rechazado" && ["admin", "comprador"].includes(usuario.rol) && (
                          <button
                            onClick={() => navigate(`/editar?id=${oc.id}`)}
                            className="text-orange-600 underline"
                          >
                            Editar
                          </button>
                        )}

                        {debeFirmar(oc) && (
                          <button
                            onClick={() => navigate(`/firmar?id=${oc.id}`)}
                            className="text-green-600 underline"
                          >
                            Firmar
                          </button>
                        )}

                        {puedeFirmar(oc) && (
                          <button
                            onClick={() => navigate(`/firmar?id=${oc.id}`)}
                            className="text-green-600 underline"
                          >
                            Aprobar / Rechazar
                          </button>
                        )}
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
                  i + 1 === paginaActual
                    ? "bg-[#004990] text-white"
                    : "bg-white text-[#004990] border-[#004990]"
                }`}
                onClick={() => setPaginaActual(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Historial;
