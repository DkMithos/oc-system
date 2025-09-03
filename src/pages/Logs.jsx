// ✅ src/pages/Logs.jsx
import React, { useEffect, useState } from "react";
import { obtenerLogs } from "../firebase/firestoreHelpers";
import { exportarLogsAExcel } from "../utils/exportarLogsAExcel";

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    const cargarLogs = async () => {
      const data = await obtenerLogs();
      setLogs(data);
    };
    cargarLogs();
  }, []);

  const logsFiltrados = logs.filter(
    (log) =>
      log.ocId?.toLowerCase().includes(filtro.toLowerCase()) ||
      log.usuario?.toLowerCase().includes(filtro.toLowerCase()) ||
      log.accion?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#004990] mb-4">Bitácora del Sistema</h2>

      <div className="flex justify-between items-center mb-4">
        <input
          type="text"
          placeholder="Buscar por OC ID, usuario o acción..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="p-2 border rounded w-full max-w-md focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        />

        <button
          onClick={() => exportarLogsAExcel(logsFiltrados)}
          className="ml-4 bg-[#004990] text-white px-4 py-2 rounded hover:bg-[#003366] transition text-sm"
        >
          Exportar a Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-300">
          <thead className="bg-gray-100 text-center">
            <tr>
              <th className="border px-3 py-2">Fecha</th>
              <th className="border px-3 py-2">Acción</th>
              <th className="border px-3 py-2">Usuario</th>
              <th className="border px-3 py-2">Rol</th>
              <th className="border px-3 py-2">OC ID</th>
              <th className="border px-3 py-2">Comentario</th>
            </tr>
          </thead>
          <tbody>
            {logsFiltrados.length > 0 ? (
              logsFiltrados.map((log) => (
                <tr key={log.id} className="text-center border-t">
                  <td className="border px-3 py-2">{log.fecha}</td>
                  <td className="border px-3 py-2 font-medium">{log.accion}</td>
                  <td className="border px-3 py-2">{log.usuario}</td>
                  <td className="border px-3 py-2">{log.rol}</td>
                  <td className="border px-3 py-2">{log.ocId}</td>
                  <td className="border px-3 py-2">{log.comentario || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-4 text-gray-500">
                  No se encontraron registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Logs;
