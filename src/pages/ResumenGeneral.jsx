import React, { useEffect, useState } from "react";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from "chart.js";
import { Pie, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const ResumenGeneral = () => {
  const [ocs, setOcs] = useState([]);

  useEffect(() => {
    const cargarOCs = async () => {
      const data = await obtenerOCs();
      setOcs(data);
    };
    cargarOCs();
  }, []);

  const estadosCount = ocs.reduce((acc, oc) => {
    acc[oc.estado] = (acc[oc.estado] || 0) + 1;
    return acc;
  }, {});

  const totalPorMoneda = ocs.reduce((acc, oc) => {
    const moneda = oc.monedaSeleccionada || "Otro";
    const monto = oc.resumen?.total || 0;
    acc[moneda] = (acc[moneda] || 0) + monto;
    return acc;
  }, {});

  const topProveedores = [...ocs].reduce((acc, oc) => {
    const nombre = oc.proveedor?.razonSocial || "Sin proveedor";
    acc[nombre] = (acc[nombre] || 0) + (oc.resumen?.total || 0);
    return acc;
  }, {});

  const topProveedoresOrdenados = Object.entries(topProveedores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const pendientesFirma = ocs.filter(
    (oc) =>
      (oc.estado === "Pendiente de Operaciones" && !oc.firmaOperaciones) ||
      (oc.estado === "Aprobado por Operaciones" && !oc.firmaGerencia)
  );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-[#004990]">Resumen General</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold text-lg mb-2">OCs por Estado</h3>
          <Pie
            data={{
              labels: Object.keys(estadosCount),
              datasets: [
                {
                  label: "# OCs",
                  data: Object.values(estadosCount),
                  backgroundColor: ["#fbc102", "#32cd32", "#ff6347", "#004990", "#aaa"],
                },
              ],
            }}
          />
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold text-lg mb-2">Total por Moneda</h3>
          <ul className="space-y-2">
            {Object.entries(totalPorMoneda).map(([moneda, total]) => (
              <li key={moneda} className="flex justify-between">
                <span>{moneda}:</span>
                <strong>S/ {total.toFixed(2)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-4 rounded shadow col-span-1 md:col-span-2">
          <h3 className="font-bold text-lg mb-2">Top 5 Proveedores</h3>
          <Bar
            data={{
              labels: topProveedoresOrdenados.map(([nombre]) => nombre),
              datasets: [
                {
                  label: "Monto Total",
                  data: topProveedoresOrdenados.map(([_, monto]) => monto),
                  backgroundColor: "#004990",
                },
              ],
            }}
            options={{ indexAxis: "y" }}
          />
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h3 className="font-bold text-lg mb-2">Firmas Pendientes</h3>
        <ul className="list-disc list-inside text-sm">
          {pendientesFirma.map((oc) => (
            <li key={oc.id}>
              OC #{oc.numeroOC} - Estado: {oc.estado}
            </li>
          ))}
          {pendientesFirma.length === 0 && <p>No hay firmas pendientes 🎉</p>}
        </ul>
      </div>
    </div>
  );
};

export default ResumenGeneral;
