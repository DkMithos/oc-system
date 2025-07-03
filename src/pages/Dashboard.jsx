// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

const colores = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const Dashboard = () => {
  const [ocs, setOCs] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});

  useEffect(() => {
    const cargar = async () => {
      const data = await obtenerOCs();
      setOCs(data);
      calcularEstadisticas(data);
    };
    cargar();
  }, []);

  const calcularEstadisticas = (ordenes) => {
    const resumen = {
      totalSoles: 0,
      totalDolares: 0,
      porCentroCosto: {},
      porCondicionPago: {},
      porMes: {},
    };

    ordenes.forEach((oc) => {
      const moneda = oc.monedaSeleccionada;
      const monto = oc.resumen?.total || 0;
      const mes = new Date(oc.fechaEmision).toLocaleDateString("es-PE", {
        month: "short",
        year: "numeric",
      });

      if (moneda === "Soles") resumen.totalSoles += monto;
      else if (moneda === "Dólares") resumen.totalDolares += monto;

      // Centro de Costo
      const cc = oc.centroCosto;
      if (cc) resumen.porCentroCosto[cc] = (resumen.porCentroCosto[cc] || 0) + monto;

      // Condición de pago
      const cp = oc.condicionPago;
      if (cp) resumen.porCondicionPago[cp] = (resumen.porCondicionPago[cp] || 0) + 1;

      // Mes
      if (mes) resumen.porMes[mes] = (resumen.porMes[mes] || 0) + monto;
    });

    setEstadisticas(resumen);
  };

  const dataCentroCosto = Object.entries(estadisticas.porCentroCosto || {}).map(
    ([k, v]) => ({ name: k, value: v })
  );

  const dataCondicionPago = Object.entries(estadisticas.porCondicionPago || {}).map(
    ([k, v]) => ({ name: k, value: v })
  );

  const dataMensual = Object.entries(estadisticas.porMes || {}).map(([k, v]) => ({
    mes: k,
    total: v,
  }));

  return (
    <div className="p-4 md:p-6">
      <h2 className="text-2xl font-bold mb-6 text-[#012b44]">Dashboard de Órdenes de Compra</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Soles</p>
          <h3 className="text-lg font-bold text-[#034771] overflow-x-auto">
            {formatearMoneda(estadisticas.totalSoles, "Soles")}
          </h3>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total Dólares</p>
          <h3 className="text-lg font-bold text-[#034771] overflow-x-auto">
            {formatearMoneda(estadisticas.totalDolares, "Dólares")}
          </h3>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Total OCs</p>
          <h3 className="text-lg font-bold text-[#034771]">{ocs.length}</h3>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-600 text-sm">Monto último mes</p>
          <h3 className="text-lg font-bold text-[#034771] overflow-x-auto">
            {formatearMoneda(dataMensual.slice(-1)[0]?.total || 0, "Soles")}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2 text-[#012b44]">Órdenes por Centro de Costo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={dataCentroCosto} dataKey="value" nameKey="name" label>
                {dataCentroCosto.map((_, i) => (
                  <Cell key={i} fill={colores[i % colores.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2 text-[#012b44]">Condición de Pago</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dataCondicionPago}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="col-span-2 bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2 text-[#012b44]">Montos Totales por Mes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dataMensual}>
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


