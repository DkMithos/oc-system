import React, { useEffect, useMemo, useState } from "react";
import { SkeletonKPI, SkeletonCard } from "../components/ui/Skeleton";
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
import { format, parseISO, subMonths, isValid } from "date-fns";
import { useUsuario } from "../context/UsuarioContext";

/** Parsea fechaEmision de forma segura, devuelve null si inválida */
const parseFechaSegura = (str) => {
  if (!str) return null;
  try {
    const d = parseISO(String(str));
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
};

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const ETAPAS_PENDIENTES = [
  { key: "Pendiente de Comprador",        label: "Comprador",       color: "bg-gray-400" },
  { key: "Pendiente de Operaciones",      label: "Operaciones",     color: "bg-amber-400" },
  { key: "Pendiente de Gerencia General", label: "Gerencia General",color: "bg-orange-500" },
];

const Dashboard = () => {
  const { usuario, cargando: loading } = useUsuario();
  const [ocData, setOcData]   = useState([]);
  const [movimientosCaja, setMovimientosCaja] = useState([]);
  const [periodo, setPeriodo] = useState(6); // meses a mostrar en el gráfico

  useEffect(() => {
    if (loading) return;
    const cargar = async () => {
      const [oc, caja] = await Promise.all([
        obtenerTodasOC(),
        obtenerTodosMovimientosCaja(),
      ]);
      setOcData(oc || []);
      setMovimientosCaja(caja || []);
    };
    cargar();
  }, [loading]);

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const { estados, montoAprobado, montoEnCurso, pendientesPorEtapa } = useMemo(() => {
    const est = {};
    let aprobado = 0;
    let enCurso  = 0;
    const pend = { "Pendiente de Comprador": 0, "Pendiente de Operaciones": 0, "Pendiente de Gerencia General": 0 };

    ocData.forEach((oc) => {
      const e = oc.estado || "Sin estado";
      est[e] = (est[e] || 0) + 1;
      const tot = Number(oc.resumen?.total) || 0;
      if (e === "Aprobada") aprobado += tot;
      if (e in pend) { pend[e]++; enCurso += tot; }
    });

    return { estados: est, montoAprobado: aprobado, montoEnCurso: enCurso, pendientesPorEtapa: pend };
  }, [ocData]);

  // ── Top proveedores por monto ────────────────────────────────────────────
  const topProveedores = useMemo(() => {
    const map = {};
    ocData.forEach((oc) => {
      const nombre = oc.proveedor?.razonSocial || "—";
      if (!map[nombre]) map[nombre] = { nombre, cantidad: 0, monto: 0 };
      map[nombre].cantidad++;
      map[nombre].monto += Number(oc.resumen?.total) || 0;
    });
    return Object.values(map)
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 5);
  }, [ocData]);

  // ── Caja chica ───────────────────────────────────────────────────────────
  const { ingresos, egresos } = useMemo(() => ({
    ingresos: movimientosCaja.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto || 0), 0),
    egresos:  movimientosCaja.filter((m) => m.tipo === "egreso") .reduce((a, m) => a + Number(m.monto || 0), 0),
  }), [movimientosCaja]);

  const dataCaja = [
    { name: "Ingresos", value: ingresos },
    { name: "Egresos",  value: egresos  },
  ];

  // ── OCs por mes ──────────────────────────────────────────────────────────
  const ocsPorMes = useMemo(() => {
    const meses = [...Array(periodo)].map((_, i) => {
      const date = subMonths(new Date(), periodo - 1 - i);
      return { mes: format(date, "MMM yy"), count: 0, key: format(date, "yyyy-MM") };
    });
    ocData.forEach((oc) => {
      const fecha = parseFechaSegura(oc.fechaEmision);
      if (!fecha) return;
      const key = format(fecha, "yyyy-MM");
      const item = meses.find((m) => m.key === key);
      if (item) item.count++;
    });
    return meses;
  }, [ocData, periodo]);

  // ── Render guards ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 space-y-6">
      <SkeletonKPI count={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  const totalOCs = ocData.length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h2 className="text-2xl font-bold text-[#004990]">Dashboard de Indicadores</h2>

      {/* ── FILA 1: KPIs principales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total OCs</p>
          <p className="text-3xl font-bold text-[#004990] mt-1">{totalOCs}</p>
        </div>
        <div className="bg-white rounded shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Monto Aprobado</p>
          <p className="text-2xl font-bold text-green-600 mt-1">S/ {fmt(montoAprobado)}</p>
        </div>
        <div className="bg-white rounded shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Monto en Curso</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">S/ {fmt(montoEnCurso)}</p>
        </div>
        <div className="bg-white rounded shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Balance Caja Chica</p>
          <p className={`text-2xl font-bold mt-1 ${ingresos - egresos >= 0 ? "text-green-600" : "text-red-600"}`}>
            S/ {fmt(ingresos - egresos)}
          </p>
        </div>
      </div>

      {/* ── FILA 2: Pendientes por etapa ── */}
      <div className="bg-white rounded shadow p-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">OCs Pendientes por Etapa</h3>
        <div className="grid grid-cols-3 gap-4">
          {ETAPAS_PENDIENTES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold">{pendientesPorEtapa[key] ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FILA 3: Gráficos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar chart OCs por mes */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">OCs Emitidas</h3>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(Number(e.target.value))}
              className="text-xs border rounded px-2 py-1"
            >
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Último año</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ocsPorMes}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie caja chica */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Caja Chica</h3>
          {ingresos === 0 && egresos === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-gray-400 text-sm">Sin movimientos</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={dataCaja} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, value }) => `${name}: S/${fmt(value)}`} labelLine={false}>
                  {dataCaja.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#34D399" : "#F87171"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `S/ ${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── FILA 4: Tablas ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OC por estado */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">OCs por Estado</h3>
          <ul className="divide-y text-sm">
            {Object.entries(estados)
              .sort((a, b) => b[1] - a[1])
              .map(([estado, count]) => (
                <li key={estado} className="flex justify-between py-1.5">
                  <span className="text-gray-700">{estado}</span>
                  <span className="font-bold text-[#004990]">{count}</span>
                </li>
              ))}
            {Object.keys(estados).length === 0 && (
              <li className="py-2 text-gray-400 text-center">Sin datos</li>
            )}
          </ul>
        </div>

        {/* Top proveedores por monto */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 5 Proveedores (por monto)</h3>
          <ul className="divide-y text-sm">
            {topProveedores.map((p, i) => (
              <li key={p.nombre} className="flex items-center gap-2 py-1.5">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <span className="flex-1 truncate text-gray-700">{p.nombre}</span>
                <span className="text-xs text-gray-500 mr-2">{p.cantidad} OC{p.cantidad !== 1 ? "s" : ""}</span>
                <span className="font-semibold text-green-700">S/ {fmt(p.monto)}</span>
              </li>
            ))}
            {topProveedores.length === 0 && (
              <li className="py-2 text-gray-400 text-center">Sin datos</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
