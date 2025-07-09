import React, { useState } from "react";
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
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">
        Cargar Datos Maestros
      </h2>

      <div className="mb-4 space-y-2">
        <label className="block font-medium">Selecciona archivo Excel:</label>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => setArchivo(e.target.files[0])}
          className="border px-3 py-2 rounded w-full"
        />

        <label className="block font-medium mt-4">Tipo de dato a cargar:</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        >
          <option value="">-- Selecciona tipo --</option>
          <option value="centrosCosto">Centros de Costo</option>
          <option value="condicionesPago">Condiciones de Pago</option>
          <option value="proveedores">Proveedores</option>
        </select>
      </div>

      <button
        onClick={handleCargar}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
      >
        Cargar datos
      </button>

      {mensaje && <p className="mt-4 text-green-700 font-medium">{mensaje}</p>}
    </div>
  );
};

export default CargarMaestros;

