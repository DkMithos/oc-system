import React, { useState } from "react";
import BackButton from "../components/ui/BackButton";
import {
  cargarCentrosCostoDesdeExcel,
  cargarCondicionesPagoDesdeExcel,
  cargarProveedoresDesdeExcel,
  borrarTodosLosProveedores,
} from "../utils/cargarDatosMaestros";

const CargarMaestros = () => {
  const [archivo, setArchivo] = useState(null);
  const [tipo, setTipo] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleCargar = async () => {
    if (!archivo || !tipo) {
      alert("Selecciona un archivo y un tipo de carga");
      return;
    }

    try {
      let msg = "";
      if (tipo === "centrosCosto") {
        msg = await cargarCentrosCostoDesdeExcel(archivo);
      } else if (tipo === "condicionesPago") {
        msg = await cargarCondicionesPagoDesdeExcel(archivo);
      } else if (tipo === "proveedores") {
        const confirmacion = confirm("¿Deseas borrar todos los proveedores antes de cargar?");
        if (confirmacion) await borrarTodosLosProveedores();
        msg = await cargarProveedoresDesdeExcel(archivo);
      } else {
        msg = "Tipo de carga no válido.";
      }

      setMensaje(msg);
    } catch (error) {
      console.error(error);
      setMensaje("Error al cargar los datos.");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton />
        <h2 className="text-2xl font-bold text-black">
          Cargar Datos Maestros
        </h2>
      </div>

      <div className="mb-4 space-y-2">
        <label className="block font-medium">Selecciona archivo Excel:</label>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => setArchivo(e.target.files[0])}
          className="border border-gray-300 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-400"
        />

        <label className="block font-medium mt-4">Tipo de dato a cargar:</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="border border-gray-300 px-3 py-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-gray-400"
        >
          <option value="">-- Selecciona tipo --</option>
          <option value="centrosCosto">Centros de Costo</option>
          <option value="condicionesPago">Condiciones de Pago</option>
          <option value="proveedores">Proveedores</option>
        </select>
      </div>

      <button
        onClick={handleCargar}
        className="bg-[#f0c000] hover:bg-[#d4a800] text-black font-semibold px-6 py-2 rounded-lg transition-colors"
      >
        Cargar datos
      </button>

      {mensaje && <p className="mt-4 text-green-700 font-medium">{mensaje}</p>}
    </div>
  );
};

export default CargarMaestros;

