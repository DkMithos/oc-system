// ✅ src/pages/Indicadores.jsx
import React, { useEffect, useMemo, useState } from "react";
import { obtenerOCs, obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import {
  obtenerMovimientosTodas, // ← ahora existente en helpers
} from "../firebase/cajaChicaHelpers";
import { obtenerUsuarios } from "../firebase/indicadoresHelpers";
import { parseISO, isAfter, isBefore } from "date-fns";
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
import { useUsuario } from "../context/UsuarioContext";

// Paleta simple
const colores = [
  "#60A5FA",
  "#F87171",
  "#34D399",
  "#FBBF24",
  "#A78BFA",
  "#fb923c",
  "#10b981",
  "#0ea5e9",
];

// ─────────────────────────────────────────────────────────────
// Helpers de normalización
// ─────────────────────────────────────────────────────────────
const parseDateSafe = (v) => {
  if (!v) return null;
  try {
    const d = v?.toDate ? v.toDate() : typeof v === "string" ? parseISO(v) : new Date(v);
    const t = d?.getTime?.();
    return Number.isFinite(t) ? d : null;
  } catch {
    return null;
  }
};

const getFechaOC = (oc) =>
  parseDateSafe(oc?.fechaEmision) || parseDateSafe(oc?.fecha) || parseDateSafe(oc?.creadoEn);

const getCentroOC = (oc) => oc?.centroCostoNombre || oc?.centroCosto || "—";

const calcTotalOC = (oc) => {
  const t = Number(oc?.resumen?.total ?? 0);
  if (t > 0) return t;
  const items = Array.isArray(oc?.items) ? oc.items : [];
  return items.reduce((acc, it) => {
    const parcial = Number(it?.total ?? Number(it?.cantidad || 0) * Number(it?.precio || 0));
    return acc + (Number.isFinite(parcial) ? parcial : 0);
  }, 0);
};

const estadoEsAprobado = (estado = "") =>
  String(estado).toLowerCase().includes("aprobado") ||
  String(estado).toLowerCase() === "pagado";

// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────
const Indicadores = () => {
  const { usuario } = useUsuario();

  const [ordenes, setOrdenes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [centros, setCentros] = useState([]);

  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  // Carga inicial
  useEffect(() => {
    (async () => {
      const [ocs, movs, usrs, ccs] = await Promise.all([
        obtenerOCs(),
        obtenerMovimientosTodas(), // TODAS las cajas
        obtenerUsuarios(),
        obtenerCentrosCosto(),
      ]);
      setOrdenes(ocs || []);
      setMovimientos(movs || []);
      setUsuarios(usrs || []);
      setCentros((ccs || []).map((c) => c.nombre));
    })();
  }, []);

  // Filtro por fechas genérico
  const filtrarPorFechas = (items, getterFecha) => {
    return (items || []).filter((item) => {
      const fecha = getterFecha(item);
      const desde = filtroDesde ? parseISO(filtroDesde) : null;
      const hasta = filtroHasta ? parseISO(filtroHasta) : null;
      const okDesde = desde ? (fecha ? isAfter(fecha, desde) || +fecha === +desde : true) : true;
      const okHasta = hasta ? (fecha ? isBefore(fecha, hasta) || +fecha === +hasta : true) : true;
      return okDesde && okHasta;
    });
  };

  // Aplica centro + fechas (OCs)
  const ordenesFiltradas = useMemo(() => {
    const base = (ordenes || []).filter((o) => !filtroCentro || getCentroOC(o) === filtroCentro);
    return filtrarPorFechas(base, getFechaOC);
  }, [ordenes, filtroCentro, filtroDesde, filtroHasta]);

  // Aplica centro + fechas (Caja Chica)
  const fechaMov = (m) =>
    (typeof m?.fechaISO === "string" ? parseISO(m.fechaISO) : null) ||
    parseDateSafe(m?.fechaCreacion);

  const movimientosFiltrados = useMemo(() => {
    const base = (movimientos || []).filter(
      (m) => !filtroCentro || m.centroCostoNombre === filtroCentro
    );
    return filtrarPorFechas(base, fechaMov);
  }, [movimientos, filtroCentro, filtroDesde, filtroHasta]);

  // ─────────────────────────────────────────────────────────────
  // KPIs
  // ─────────────────────────────────────────────────────────────
  const totalOCs = ordenesFiltradas.length;

  const montoTotalOCs = ordenesFiltradas.reduce((acc, o) => acc + calcTotalOC(o), 0);

  const ocObservadas = ordenesFiltradas.filter(
    (o) => String(o?.estado || "").toLowerCase() === "observada"
  ).length;

  const promedioItems = (() => {
    const arr = ordenesFiltradas.map((o) => (Array.isArray(o?.items) ? o.items.length : 0));
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })();

  const tiempoPromedioAprobacion = (() => {
    const dias = ordenesFiltradas
      .map((o) => {
        const ini = getFechaOC(o);
        const fin = parseDateSafe(o?.fechaAprobacion);
        if (!ini || !fin) return null;
        return (fin - ini) / (1000 * 60 * 60 * 24);
      })
      .filter((d) => Number.isFinite(d));
    return dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
  })();

  const montoAprobado = ordenesFiltradas
    .filter((o) => estadoEsAprobado(o?.estado))
    .reduce((acc, o) => acc + calcTotalOC(o), 0);

  const ingresos = movimientosFiltrados
    .filter((m) => String(m?.tipo || "").toLowerCase() === "ingreso")
    .reduce((acc, m) => acc + Number(m?.monto || 0), 0);

  const egresos = movimientosFiltrados
    .filter((m) => String(m?.tipo || "").toLowerCase() === "egreso")
    .reduce((acc, m) => acc + Number(m?.monto || 0), 0);

  const saldoCaja = ingresos - egresos;

  const egresosSinComprobante = movimientosFiltrados.filter(
    (m) => String(m?.tipo || "").toLowerCase() === "egreso" && !m?.archivoUrl
  ).length;

  const ocEmergencia = ordenesFiltradas.filter(
    (o) => String(o?.prioridad || "").toLowerCase() === "alta"
  ).length;

  const sinFirmaFinal = ordenesFiltradas.filter((o) => !o?.firmaGerencia).length;

  // ─────────────────────────────────────────────────────────────
  // Distribuciones / rankings
  // ─────────────────────────────────────────────────────────────
  const conteoPorCampo = (arr, campo) => {
    const result = {};
    (arr || []).forEach((el) => {
      const clave = typeof campo === "function" ? campo(el) : el?.[campo] || "—";
      result[clave] = (result[clave] || 0) + 1;
    });
    return result;
  };

  const sumaPorCampo = (arr, campo) => {
    const result = {};
    (arr || []).forEach((el) => {
      const clave = el?.[campo] || "—";
      const v = Number(el?.monto || 0);
      result[clave] = (result[clave] || 0) + (Number.isFinite(v) ? v : 0);
    });
    return result;
  };

  const ocPorUsuario = conteoPorCampo(
    ordenesFiltradas,
    (o) => o?.creadoPorEmail || o?.creadoPor || "—"
  );

  const movimientosPorUsuario = conteoPorCampo(movimientosFiltrados, "creadoPorEmail");

  const ocPorProveedor = conteoPorCampo(
    ordenesFiltradas,
    (o) => o?.proveedor?.razonSocial || "—"
  );

  const egresosPorCentro = sumaPorCampo(
    movimientosFiltrados.filter((m) => String(m?.tipo || "").toLowerCase() === "egreso"),
    "centroCostoNombre"
  );

  // Roles permitidos
  if (
    !usuario ||
    ![
      "admin",
      "soporte",
      "comprador",
      "operaciones",
      "gerencia",
      "gerencia operaciones",
      "gerencia finanzas",
      "gerencia general",
      "finanzas",
      "administracion",
      "legal",
    ].includes((usuario.rol || "").toLowerCase())
  ) {
    return <div className="p-6">Acceso no autorizado</div>;
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">📊 Indicadores del Sistema</h2>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={filtroCentro}
          onChange={(e) => setFiltroCentro(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option value="">Todos los centros</option>
          {centros.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filtroDesde}
          onChange={(e) => setFiltroDesde(e.target.value)}
          className="border px-3 py-2 rounded"
        />
        <input
          type="date"
          value={filtroHasta}
          onChange={(e) => setFiltroHasta(e.target.value)}
          className="border px-3 py-2 rounded"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Indicador titulo="Total de OCs" valor={totalOCs} />
        <Indicador titulo="Monto total de OCs" valor={`S/ ${montoTotalOCs.toFixed(2)}`} />
        <Indicador titulo="OCs observadas" valor={ocObservadas} />
        <Indicador
          titulo="Tiempo promedio aprobación"
          valor={`${tiempoPromedioAprobacion.toFixed(1)} días`}
        />
        <Indicador titulo="Promedio ítems por OC" valor={promedioItems.toFixed(1)} />
        <Indicador
          titulo="Monto aprobado vs. solicitado"
          valor={`${((montoAprobado / (montoTotalOCs || 1)) * 100).toFixed(1)}%`}
        />
        <Indicador titulo="Saldo Caja Chica" valor={`S/ ${saldoCaja.toFixed(2)}`} />
        <Indicador titulo="Egresos sin comprobante" valor={egresosSinComprobante} />
        <Indicador titulo="OCs sin firma final" valor={sinFirmaFinal} />
        <Indicador titulo="OCs de emergencia" valor={ocEmergencia} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <GraficoPie titulo="OCs por proveedor" datos={ocPorProveedor} colores={colores} />
        <GraficoBar titulo="Egresos por centro de costo" datos={egresosPorCentro} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <GraficoBar titulo="Ranking usuarios (OCs)" datos={ocPorUsuario} />
        <GraficoBar titulo="Ranking usuarios (Caja Chica)" datos={movimientosPorUsuario} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Subcomponentes UI
// ─────────────────────────────────────────────────────────────
const Indicador = ({ titulo, valor }) => (
  <div className="bg-white shadow p-4 rounded">
    <p className="text-sm text-gray-500">{titulo}</p>
    <p className="text-xl font-bold text-blue-800">{valor}</p>
  </div>
);

const GraficoPie = ({ titulo, datos, colores }) => {
  const data = Object.entries(datos).map(([name, value]) => ({ name, value }));
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">{titulo}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie dataKey="value" data={data} label outerRadius={80}>
            {data.map((_, i) => (
              <Cell key={i} fill={colores[i % colores.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const GraficoBar = ({ titulo, datos }) => {
  const data = Object.entries(datos).map(([name, value]) => ({ name, value }));
  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">{titulo}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#3B82F6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Indicadores;
