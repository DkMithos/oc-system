// ✅ src/pages/Indicadores.jsx
import React, { useEffect, useState } from "react";
import { obtenerOCs, obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import { obtenerMovimientosCaja } from "../firebase/cajaChicaHelpers";
import { obtenerUsuarios } from "../firebase/indicadoresHelpers";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer
} from "recharts";
import { useUsuario } from "../context/UsuarioContext";

const Indicadores = () => {
  const { usuario } = useUsuario();
  const [ordenes, setOrdenes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [centros, setCentros] = useState([]);

  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  useEffect(() => {
    const cargar = async () => {
      const [ocs, movs, usrs, ccs] = await Promise.all([
        obtenerOCs(),
        obtenerMovimientosCaja(),
        obtenerUsuarios(),
        obtenerCentrosCosto()
      ]);
      setOrdenes(ocs);
      setMovimientos(movs);
      setUsuarios(usrs);
      setCentros(ccs.map((c) => c.nombre));
    };
    cargar();
  }, []);

  // 🔎 Aplicar filtros
  const filtrarPorFechas = (items, campo) => {
    return items.filter((item) => {
      const fecha = parseISO(item[campo]);
      const desde = filtroDesde ? parseISO(filtroDesde) : null;
      const hasta = filtroHasta ? parseISO(filtroHasta) : null;
      return (!desde || isAfter(fecha, desde)) && (!hasta || isBefore(fecha, hasta));
    });
  };

  const ordenesFiltradas = ordenes
    .filter((o) => !filtroCentro || o.centroCosto === filtroCentro);
  const movimientosFiltrados = movimientos
    .filter((m) => !filtroCentro || m.centroCosto === filtroCentro);

  const totalOCs = ordenesFiltradas.length;
  const montoTotalOCs = ordenesFiltradas.reduce((acc, o) => acc + (o.resumen?.total || 0), 0);
  const ocObservadas = ordenesFiltradas.filter((o) => o.estado === "observada").length;
  const promedioItems = promedio(ordenesFiltradas.map((o) => o.items.length));
  const tiempoPromedioAprobacion = promedioDias(ordenesFiltradas, "fechaEmision", "fechaAprobacion");

  const montoAprobado = ordenesFiltradas
    .filter((o) => o.estado === "Aprobado")
    .reduce((acc, o) => acc + (o.resumen?.total || 0), 0);

  const ingresos = movimientosFiltrados
    .filter((m) => m.tipo === "ingreso").reduce((acc, m) => acc + Number(m.monto), 0);
  const egresos = movimientosFiltrados
    .filter((m) => m.tipo === "egreso").reduce((acc, m) => acc + Number(m.monto), 0);
  const saldoCaja = ingresos - egresos;
  const egresosSinComprobante = movimientosFiltrados
    .filter((m) => m.tipo === "egreso" && !m.comprobanteUrl).length;

  const ocPorUsuario = conteoPorCampo(ordenesFiltradas, "creadoPor");
  const movimientosPorUsuario = conteoPorCampo(movimientosFiltrados, "usuario");
  const ocPorProveedor = conteoPorCampo(ordenesFiltradas, (o) => o.proveedor?.razonSocial || "—");
  const egresosPorCentro = sumaPorCampo(movimientosFiltrados.filter(m => m.tipo === "egreso"), "centroCosto");

  const ocEmergencia = ordenesFiltradas.filter((o) => o.prioridad === "alta").length;
  const sinFirma = ordenesFiltradas.filter((o) => !o.firma?.gerencia).length;

  const colores = ["#60A5FA", "#F87171", "#34D399", "#FBBF24", "#A78BFA", "#fb923c"];

  if (!usuario || !["admin", "gerencia", "operaciones"].includes(usuario.rol)) {
    return <div className="p-6">Acceso no autorizado</div>;
  }

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
          {centros.map((c) => <option key={c}>{c}</option>)}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Indicador titulo="Total de OCs" valor={totalOCs} />
        <Indicador titulo="Monto total de OCs" valor={`S/ ${montoTotalOCs.toFixed(2)}`} />
        <Indicador titulo="OCs observadas" valor={ocObservadas} />
        <Indicador titulo="Tiempo promedio aprobación" valor={`${tiempoPromedioAprobacion.toFixed(1)} días`} />
        <Indicador titulo="Promedio ítems por OC" valor={promedioItems.toFixed(1)} />
        <Indicador titulo="Monto aprobado vs. solicitado" valor={`${((montoAprobado / montoTotalOCs) * 100 || 0).toFixed(1)}%`} />
        <Indicador titulo="Saldo Caja Chica" valor={`S/ ${saldoCaja.toFixed(2)}`} />
        <Indicador titulo="Egresos sin comprobante" valor={egresosSinComprobante} />
        <Indicador titulo="OCs sin firma final" valor={sinFirma} />
        <Indicador titulo="OCs de emergencia" valor={ocEmergencia} />
      </div>

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

// Componentes
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
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie dataKey="value" data={data} label outerRadius={70}>
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
      <ResponsiveContainer width="100%" height={250}>
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

// Utils
const promedio = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const promedioDias = (lista, inicio, fin) => {
  const dias = lista
    .filter((o) => o[inicio] && o[fin])
    .map((o) => (new Date(o[fin]) - new Date(o[inicio])) / (1000 * 60 * 60 * 24));
  return promedio(dias);
};
const conteoPorCampo = (arr, campo) => {
  const result = {};
  arr.forEach((el) => {
    const clave = typeof campo === "function" ? campo(el) : el[campo] || "Desconocido";
    result[clave] = (result[clave] || 0) + 1;
  });
  return result;
};
const sumaPorCampo = (arr, campo) => {
  const result = {};
  arr.forEach((el) => {
    const clave = el[campo] || "Desconocido";
    result[clave] = (result[clave] || 0) + parseFloat(el.monto || 0);
  });
  return result;
};

export default Indicadores;
