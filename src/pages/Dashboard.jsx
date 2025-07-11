import { useEffect, useState } from "react";
import {
  obtenerTodasOC,
  obtenerTodosMovimientosCaja,
} from "../firebase/dashboardHelpers";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, subMonths } from "date-fns";
import { useUsuario } from "../context/UsuarioContext";

const Dashboard = () => {
  const { usuario, loading } = useUsuario();
  const [ocData, setOcData] = useState([]);
  const [movimientosCaja, setMovimientosCaja] = useState([]);

  useEffect(() => {
    const cargarDatos = async () => {
      const oc = await obtenerTodasOC();
      const caja = await obtenerTodosMovimientosCaja();
      setOcData(oc);
      setMovimientosCaja(caja);
    };

    if (!loading) cargarDatos();
  }, [loading]);

  if (loading || !usuario) {
    return <div className="p-6">Cargando dashboard...</div>;
  }

  // ▶ Totales por estado de OC
  const estados = ocData.reduce((acc, oc) => {
    acc[oc.estado] = (acc[oc.estado] || 0) + 1;
    return acc;
  }, {});

  // ▶ Monto total de OCs aprobadas
  const montoAprobado = ocData
    .filter((oc) => oc.estado === "Aprobado")
    .reduce((acc, oc) => acc + (oc.resumen?.total || 0), 0);

  // ▶ Top proveedores
  const proveedores = ocData.reduce((acc, oc) => {
    const nombre = oc.proveedor?.razonSocial || "—";
    acc[nombre] = (acc[nombre] || 0) + 1;
    return acc;
  }, {});
  const topProveedores = Object.entries(proveedores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));

  // ▶ Caja chica resumen
  const ingresos = movimientosCaja
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + Number(m.monto), 0);
  const egresos = movimientosCaja
    .filter((m) => m.tipo === "egreso")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const dataCaja = [
    { name: "Ingresos", value: ingresos },
    { name: "Egresos", value: egresos },
  ];

  // ▶ OCs por mes
  const ultimos6Meses = [...Array(6)].map((_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const key = format(date, "yyyy-MM");
    return { mes: format(date, "MMM yyyy"), count: 0, key };
  });

  ocData.forEach((oc) => {
    const fecha = parseISO(oc.fechaEmision || new Date().toISOString());
    const key = format(fecha, "yyyy-MM");
    const mesItem = ultimos6Meses.find((m) => m.key === key);
    if (mesItem) mesItem.count++;
  });

  const colores = ["#34D399", "#F87171"];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">📊 Dashboard de Indicadores</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 shadow rounded">
          <h3 className="text-lg font-semibold mb-2">OC por Estado</h3>
          <ul className="text-sm space-y-1">
            {Object.entries(estados).map(([estado, count]) => (
              <li key={estado} className="flex justify-between">
                <span>{estado}</span>
                <span className="font-bold">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-4 shadow rounded">
          <h3 className="text-lg font-semibold mb-2">Total OCs Aprobadas</h3>
          <p className="text-2xl font-bold text-green-600">
            S/ {montoAprobado.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-4 shadow rounded">
          <h3 className="text-lg font-semibold mb-2">Top 5 Proveedores</h3>
          <ul className="text-sm space-y-1">
            {topProveedores.map((p) => (
              <li key={p.nombre} className="flex justify-between">
                <span>{p.nombre}</span>
                <span className="font-bold">{p.cantidad}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">
            📆 OC Emitidas (últimos 6 meses)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ultimos6Meses}>
              <XAxis dataKey="mes" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">💰 Caja Chica</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={dataCaja}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label
              >
                {dataCaja.map((_, i) => (
                  <Cell key={i} fill={colores[i % colores.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
