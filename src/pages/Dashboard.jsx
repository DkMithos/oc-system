// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import {
  obtenerTodasOC,
  obtenerTodosMovimientosCaja,
  calcularKPIs,
} from "../firebase/dashboardHelpers";
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO, subMonths, isValid } from "date-fns";
import { useUsuario } from "../context/UsuarioContext";

const ROLES_PERMITIDOS = [
  "admin", "finanzas", "gerencia", "gerencia general",
  "gerencia operaciones", "gerencia finanzas", "operaciones",
];

const COLORES_CAJA = ["#34D399", "#F87171"];

const Dashboard = () => {
  const { usuario, cargando } = useUsuario();
  const [ocData, setOcData] = useState([]);
  const [movimientosCaja, setMovimientosCaja] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  useEffect(() => {
    if (cargando) return;
    (async () => {
      setCargandoDatos(true);
      try {
        const [oc, caja] = await Promise.all([
          obtenerTodasOC(),
          obtenerTodosMovimientosCaja(),
        ]);
        setOcData(oc || []);
        setMovimientosCaja(caja || []);
      } catch (e) {
        console.error("Error cargando dashboard:", e);
      } finally {
        setCargandoDatos(false);
      }
    })();
  }, [cargando]);

  if (cargando || !usuario) return <div className="p-6">Cargando dashboard...</div>;
  if (!ROLES_PERMITIDOS.includes(String(usuario.rol || "").toLowerCase()))
    return <div className="p-6">Acceso no autorizado</div>;

  // KPIs
  const kpis = calcularKPIs(ocData);

  // Estados para pie chart
  const estadosMap = ocData.reduce((acc, oc) => {
    acc[oc.estado] = (acc[oc.estado] || 0) + 1;
    return acc;
  }, {});

  // Caja chica
  const ingresos = movimientosCaja.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + Number(m.monto || 0), 0);
  const egresos = movimientosCaja.filter((m) => m.tipo === "egreso").reduce((s, m) => s + Number(m.monto || 0), 0);
  const dataCaja = [
    { name: "Ingresos", value: ingresos },
    { name: "Egresos", value: egresos },
  ];

  // OCs por mes (últimos 6)
  const ultimos6Meses = [...Array(6)].map((_, i) => {
    const date = subMonths(new Date(), 5 - i);
    return { mes: format(date, "MMM yy"), key: format(date, "yyyy-MM"), count: 0, monto: 0 };
  });
  ocData.forEach((oc) => {
    try {
      const raw = oc.fechaEmision || oc.creadaEn?.toDate?.() || oc.creadaEn;
      if (!raw) return;
      const fecha = typeof raw === "string" ? parseISO(raw) : new Date(raw);
      if (!isValid(fecha)) return;
      const key = format(fecha, "yyyy-MM");
      const item = ultimos6Meses.find((m) => m.key === key);
      if (item) {
        item.count++;
        item.monto += Number(oc.resumen?.total || oc.total || 0);
      }
    } catch {}
  });

  const formatMonto = (v) => `S/ ${Number(v || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Dashboard de Indicadores</h2>

      {cargandoDatos ? (
        <div className="text-gray-500">Cargando datos...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 shadow rounded border-l-4 border-blue-500">
              <p className="text-xs text-gray-500">Total OCs</p>
              <p className="text-3xl font-bold text-blue-600">{kpis.totalOCs}</p>
            </div>
            <div className="bg-white p-4 shadow rounded border-l-4 border-green-500">
              <p className="text-xs text-gray-500">Aprobadas</p>
              <p className="text-3xl font-bold text-green-600">{kpis.aprobadas}</p>
              <p className="text-xs text-gray-400">{formatMonto(kpis.montoAprobado)}</p>
            </div>
            <div className="bg-white p-4 shadow rounded border-l-4 border-yellow-500">
              <p className="text-xs text-gray-500">Pendientes</p>
              <p className="text-3xl font-bold text-yellow-600">{kpis.pendientes}</p>
              <p className="text-xs text-gray-400">{formatMonto(kpis.montoPendiente)}</p>
            </div>
            <div className="bg-white p-4 shadow rounded border-l-4 border-red-500">
              <p className="text-xs text-gray-500">Rechazadas</p>
              <p className="text-3xl font-bold text-red-600">{kpis.rechazadas}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* OC por Estado */}
            <div className="bg-white p-4 shadow rounded">
              <h3 className="text-sm font-semibold mb-3 text-gray-700">OC por Estado</h3>
              <ul className="text-sm space-y-1">
                {Object.entries(estadosMap).map(([estado, count]) => (
                  <li key={estado} className="flex justify-between">
                    <span className="text-gray-600 text-xs">{estado}</span>
                    <span className="font-bold text-xs">{count}</span>
                  </li>
                ))}
                {Object.keys(estadosMap).length === 0 && <li className="text-gray-400 text-xs">Sin datos</li>}
              </ul>
            </div>

            {/* Monto aprobado */}
            <div className="bg-white p-4 shadow rounded">
              <h3 className="text-sm font-semibold mb-2 text-gray-700">Monto Total Aprobado</h3>
              <p className="text-2xl font-bold text-green-600">{formatMonto(kpis.montoAprobado)}</p>
              <p className="text-xs text-gray-400 mt-1">{kpis.aprobadas} órdenes aprobadas</p>
            </div>

            {/* Top Proveedores */}
            <div className="bg-white p-4 shadow rounded">
              <h3 className="text-sm font-semibold mb-3 text-gray-700">Top 5 Proveedores</h3>
              <ul className="text-xs space-y-1">
                {kpis.topProveedores.map((p) => (
                  <li key={p.nombre} className="flex justify-between gap-2">
                    <span className="text-gray-600 truncate">{p.nombre}</span>
                    <span className="font-bold shrink-0">{p.cantidad} OC</span>
                  </li>
                ))}
                {kpis.topProveedores.length === 0 && <li className="text-gray-400">Sin datos</li>}
              </ul>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm font-semibold mb-4 text-gray-700">OC Emitidas — últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ultimos6Meses}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, name) => name === "monto" ? formatMonto(v) : v} />
                  <Legend />
                  <Bar dataKey="count" name="Cantidad" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-sm font-semibold mb-4 text-gray-700">Caja Chica</h3>
              {ingresos === 0 && egresos === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sin movimientos de caja</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={dataCaja} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${formatMonto(value)}`}>
                      {dataCaja.map((_, i) => <Cell key={i} fill={COLORES_CAJA[i % COLORES_CAJA.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatMonto(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
