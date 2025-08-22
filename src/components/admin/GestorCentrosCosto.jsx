import React, { useState } from "react";

const ESTADOS = ["Activo", "Inactivo", "Suspendido"];

const GestorCentrosCosto = ({ centros = [], agregar, cambiarEstado }) => {
  const [nuevo, setNuevo] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 5;

  const totalPaginas = Math.ceil(centros.length / porPagina) || 1;
  const visibles = centros
    .slice((pagina - 1) * porPagina, pagina * porPagina)
    .map((c) => ({ ...c, estado: c.estado || "Activo" }));

  const handleAgregar = async () => {
    if (!nuevo.trim()) return alert("Nombre requerido");
    await agregar(nuevo.trim());
    setNuevo("");
    setPagina(1);
  };

  return (
    <div className="bg-white p-6 rounded shadow mb-6">
      <h3 className="text-lg font-bold mb-4">Centros de Costo</h3>

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Nuevo centro de costo"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
        <button
          onClick={handleAgregar}
          className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700"
        >
          Agregar
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  No hay centros de costo.
                </td>
              </tr>
            ) : (
              visibles.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.nombre}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold
                        ${
                          c.estado === "Activo"
                            ? "bg-green-100 text-green-700"
                            : c.estado === "Suspendido"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                    >
                      {c.estado || "Activo"}
                    </span>
                  </td>
                  <td className="p-2">
                    <select
                      value={c.estado || "Activo"}
                      onChange={(e) => cambiarEstado(c.id, c.nombre, e.target.value)}
                      className="border px-2 py-1 rounded"
                    >
                      {ESTADOS.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPagina(n)}
              className={`px-3 py-1 rounded border ${
                pagina === n ? "bg-blue-600 text-white" : "bg-white text-gray-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GestorCentrosCosto;
