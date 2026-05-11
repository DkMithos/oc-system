// src/pages/Logs.jsx — Fase 7: Paginación + filtros de fecha
import React, { useEffect, useState, useCallback } from "react";
import { obtenerLogsPaginados } from "../firebase/firestoreHelpers";
import { exportarLogsAExcel } from "../utils/exportarLogsAExcel";
import { RefreshCw, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import logger from "../utils/logger";

const PAGE_SIZE = 50;

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cursores, setCursores] = useState([]); // stack de cursores para paginación
  const [cursorActual, setCursorActual] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [paginaNum, setPaginaNum] = useState(1);

  const cargar = useCallback(async (cursor = null, pagina = 1) => {
    setCargando(true);
    try {
      const result = await obtenerLogsPaginados({
        pageSize: PAGE_SIZE,
        lastDoc: cursor,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      setLogs(result.logs);
      setCursorActual(result.lastDoc);
      setHayMas(result.hayMas);
      setPaginaNum(pagina);
    } catch (e) {
      logger.error("Error cargando logs:", e);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    // Reset al cambiar filtros de fecha
    setCursores([]);
    setCursorActual(null);
    cargar(null, 1);
  }, [cargar]);

  const irSiguiente = () => {
    if (!hayMas || !cursorActual) return;
    setCursores((prev) => [...prev, cursorActual]);
    cargar(cursorActual, paginaNum + 1);
  };

  const irAnterior = () => {
    if (cursores.length === 0) return;
    const nuevoStack = [...cursores];
    nuevoStack.pop();
    const cursorPrev = nuevoStack.length > 0 ? nuevoStack[nuevoStack.length - 1] : null;
    setCursores(nuevoStack);
    cargar(cursorPrev, paginaNum - 1);
  };

  const logsFiltrados = filtro
    ? logs.filter(
        (log) =>
          log.ocId?.toLowerCase().includes(filtro.toLowerCase()) ||
          log.usuario?.toLowerCase().includes(filtro.toLowerCase()) ||
          log.accion?.toLowerCase().includes(filtro.toLowerCase())
      )
    : logs;

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#004990]">Bitácora del Sistema</h2>
          <p className="text-sm text-gray-500 mt-0.5">Registro de acciones del sistema</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => cargar(null, 1)}
            disabled={cargando}
            className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={cargando ? "animate-spin" : ""} /> Actualizar
          </button>
          <button
            onClick={() => exportarLogsAExcel(logsFiltrados)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#004990] text-white rounded-lg text-sm hover:bg-[#003670]"
          >
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] text-gray-500 uppercase font-medium mb-1">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="OC, usuario o acción..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase font-medium mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase font-medium mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>
          {(desde || hasta) && (
            <button
              onClick={() => { setDesde(""); setHasta(""); }}
              className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Limpiar fechas
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-gray-400">Cargando registros...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">Fecha</th>
                  <th className="px-3 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">Acción</th>
                  <th className="px-3 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">Usuario</th>
                  <th className="px-3 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">Rol</th>
                  <th className="px-3 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">OC ID</th>
                  <th className="px-3 py-2.5 text-[10px] text-gray-500 uppercase font-semibold">Comentario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logsFiltrados.length > 0 ? (
                  logsFiltrados.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{log.fecha}</td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-800">{log.accion}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{log.usuario}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{log.rol}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">{log.ocId || "—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px] truncate">{log.comentario || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-400">
                      No se encontraron registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Página {paginaNum} · {logsFiltrados.length} registros
          </p>
          <div className="flex gap-2">
            <button
              onClick={irAnterior}
              disabled={paginaNum <= 1 || cargando}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft size={12} /> Anterior
            </button>
            <button
              onClick={irSiguiente}
              disabled={!hayMas || cargando}
              className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              Siguiente <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Logs;
