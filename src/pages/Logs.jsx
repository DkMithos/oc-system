import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase/config";
import { Clock, User, Info } from "lucide-react";

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    const cargarLogs = async () => {
      const q = query(collection(db, "logs"), orderBy("fecha", "desc"));
      const snapshot = await getDocs(q);
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLogs(lista);
    };

    cargarLogs();
  }, []);

  const filtrados = logs.filter(
    (log) =>
      log.accion.toLowerCase().includes(filtro.toLowerCase()) ||
      log.descripcion.toLowerCase().includes(filtro.toLowerCase()) ||
      log.hechoPor.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📜 Bitácora de Actividades</h2>

      <input
        type="text"
        placeholder="Buscar por acción, usuario o descripción"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="w-full border p-2 mb-4 rounded"
      />

      <div className="bg-white shadow rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">📅 Fecha</th>
              <th className="text-left p-2">👤 Usuario</th>
              <th className="text-left p-2">⚙️ Acción</th>
              <th className="text-left p-2">📝 Descripción</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-500">
                  No hay registros que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filtrados.map((log, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <Clock size={14} className="inline mr-1 text-gray-500" />
                    {new Date(log.fecha?.seconds * 1000).toLocaleString("es-PE")}
                  </td>
                  <td className="p-2">
                    <User size={14} className="inline mr-1 text-blue-600" />
                    {log.hechoPor}
                  </td>
                  <td className="p-2 font-medium">{log.accion}</td>
                  <td className="p-2 text-gray-700">
                    <Info size={14} className="inline mr-1 text-gray-500" />
                    {log.descripcion}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Logs;
