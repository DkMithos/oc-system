// src/pages/CargarMaestros.jsx
import React, { useState } from "react";
import { cargarDesdeExcel } from "../utils/cargarDatosMaestros";

const CargarMaestros = () => {
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCargando(true);
    setMensaje("Cargando...");

    try {
      const resultado = await cargarDesdeExcel(file);
      setMensaje(resultado);
    } catch (error) {
      setMensaje("Hubo un error en la carga.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Cargar Catálogos Maestros</h2>

      <input type="file" onChange={handleFile} accept=".xlsx, .xls" />
      {cargando && <p className="mt-2 text-yellow-600">Subiendo datos...</p>}
      {mensaje && <p className="mt-4">{mensaje}</p>}
    </div>
  );
};

export default CargarMaestros;
