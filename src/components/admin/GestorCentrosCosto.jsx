import React, { useState } from "react";
import { Trash2 } from "lucide-react";

const GestorCentrosCosto = ({ centros, agregar, eliminar }) => {
  const [nuevo, setNuevo] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 5;

  const totalPaginas = Math.ceil(centros.length / porPagina);
  const visibles = centros.slice((pagina - 1) * porPagina, pagina * porPagina);

  const handleAgregar = async () => {
    if (!nuevo.trim()) return alert("Nombre requerido");
    await agregar(nuevo);
    setNuevo("");
  };

  return (
    <div className="bg-white p-6 rounded shadow mb-6">
      <h3 className="text-lg font-bold mb-4">Centros de Costo</h3>

      <div className="flex gap-2 mb-4">
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

      <ul className="list-disc ml-6 space-y-2">
        {visibles.map((c) => (
          <li key={c.id} className="flex justify-between items-center">
            <span>{c.nombre}</span>
            <button
              onClick={() => eliminar(c.id, c.nombre)}
              className="text-red-600 text-sm underline flex items-center gap-1"
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          </li>
        ))}
      </ul>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {[...Array(totalPaginas)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPagina(i + 1)}
              className={`px-3 py-1 rounded border ${
                pagina === i + 1
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GestorCentrosCosto;
