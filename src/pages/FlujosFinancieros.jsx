// src/pages/FlujosFinancieros.jsx
import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { TIPO_TRANSACCION, corregirTransaccionesInconsistentes } from "../firebase/finanzasHelpers";
import { useUsuario } from "../context/UsuarioContext";
import TransaccionFormModal from "../components/TransaccionFormModal";
import useCatalogosFinanzas from "../hooks/useCatalogosFinanzas";
import useTransacciones from "../hooks/useTransacciones";

// ── Area tabs ─────────────────────────────────────────────────
const AREAS_CONFIG = [
  { id: "administracion", label: "Admin",        color: "blue"   },
  { id: "contabilidad",   label: "Contabilidad", color: "green"  },
  { id: "operaciones",    label: "Operaciones",  color: "purple" },
  { id: "ti",             label: "TI",           color: "orange" },
  { id: "consolidado",    label: "Consolidado",  color: "gray"   },
];

const TABS_POR_ROL = {
  administracion:       ["administracion", "consolidado"],
  finanzas:             ["contabilidad", "consolidado"],
  "gerencia finanzas":  ["consolidado", "contabilidad"],
  operaciones:          ["operaciones", "consolidado"],
  "gerencia operaciones": ["consolidado", "operaciones"],
  "gerencia general":   ["consolidado"],
  gerencia:             ["consolidado"],
  admin:   ["administracion", "contabilidad", "operaciones", "ti", "consolidado"],
  soporte: ["administracion", "contabilidad", "operaciones", "ti", "consolidado"],
};

const DEFAULT_AREA = {
  administracion:         "administracion",
  finanzas:               "contabilidad",
  "gerencia finanzas":    "consolidado",
  operaciones:            "operaciones",
  "gerencia operaciones": "consolidado",
  "gerencia general":     "consolidado",
  gerencia:               "consolidado",
  admin:                  "consolidado",
  soporte:                "ti",
};

const AREA_POR_ROL = {
  administracion: "administracion",
  finanzas:       "contabilidad",
  operaciones:    "operaciones",
  soporte:        "ti",
};

const PUEDE_ESCRIBIR = new Set(["administracion", "finanzas", "operaciones", "admin", "soporte"]);

const initialFilters = () => {
  const hoy   = new Date();
  const anio  = hoy.getFullYear();
  const hasta = new Date(anio, 11, 31); // 31 dic del año actual
  const desde = new Date(anio, 0, 1);  // 1 ene del año actual
  const toISO = (d) => d.toISOString().slice(0, 10);
  return {
    fechaDesde: toISO(desde),
    fechaHasta: toISO(hasta),
    tipo: "",
    estado: "",
    categoriaId: "",
    centro_costo_id: "",
  };
};


function FlujosFinancieros() {
  const { usuario } = useUsuario();
  const rol = String(usuario?.rol || "").toLowerCase();

  const tabsVisibles = TABS_POR_ROL[rol] || ["consolidado"];
  const [areaTab, setAreaTab] = useState(() => DEFAULT_AREA[rol] || "consolidado");

  const puedeEscribir = PUEDE_ESCRIBIR.has(rol);
  const areaDefault = AREA_POR_ROL[rol] || null;

  // Hooks extraídos (Fase 2 refactor)
  const { catalogos, proveedorOptions, centroCostoOptions, cargandoCatalogos } = useCatalogosFinanzas();
  const {
    filtros, setFiltros, busquedaTabla, setBusquedaTabla,
    transacciones, pagina: paginaTrans, setPagina: setPaginaTrans, porPagina: TRANS_POR_PAGINA,
    cargando, error, setError, cargarTransacciones, filtrar, calcularResumen,
    handleFiltroChange, limpiarFiltros: handleLimpiarFiltrosBase,
  } = useTransacciones({ porPagina: 25 });

  const [mostrarModal, setMostrarModal] = useState(false);
  const [editarData, setEditarData] = useState(null);

  // Corrección masiva (solo admin)
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [resultadoCorreccion, setResultadoCorreccion] = useState(null);

  // Filtrado local (área + text search) — usa helper del hook
  const transaccionesFiltradas = useMemo(
    () => filtrar(transacciones, areaTab, busquedaTabla),
    [transacciones, busquedaTabla, areaTab, filtrar]
  );

  // Resumen — usa helper del hook
  const resumen = useMemo(
    () => calcularResumen(transaccionesFiltradas),
    [transaccionesFiltradas, calcularResumen]
  );

  // Filtros (delegados al hook)
  const handleBuscarClick = () => cargarTransacciones();
  const handleLimpiarFiltros = () => handleLimpiarFiltrosBase();

  const aplicarPeriodo = async (dias) => {
    const hoy = new Date();
    const desde = dias === 0 ? "" : (() => {
      const d = new Date();
      if (dias === 365) { d.setFullYear(d.getFullYear(), 0, 1); }
      else { d.setDate(d.getDate() - dias); }
      return d;
    })();
    const nuevo = {
      ...filtros,
      fechaDesde: dias === 0 ? "" : (desde instanceof Date ? desde.toISOString().slice(0, 10) : ""),
      fechaHasta: dias === 0 ? "" : hoy.toISOString().slice(0, 10),
    };
    setFiltros(nuevo);
    setBusquedaTabla("");
    await cargarTransacciones(nuevo);
  };

  const exportarExcel = () => {
    const rows = transaccionesFiltradas.map((t) => ({
      Fecha: t.fechaISO || "",
      Tipo: t.tipo,
      Clasificacion: t.clasificacion || "",
      Moneda: t.moneda,
      "Monto sin IGV": Number(t.monto_sin_igv || 0).toFixed(2),
      "Monto total": Number(t.monto_total ?? 0).toFixed(2),
      "Monto total (S/)": Number(t.monto_total_pen ?? t.monto_total ?? 0).toFixed(2),
      Categoria: t.categoriaNombre || "",
      Subcategoria: t.subcategoriaNombre || "",
      Proveedor: t.proveedor_cliente_nombre || "",
      "Centro de Costo": t.centro_costo_nombre || "",
      Proyecto: t.proyecto_nombre || "",
      Estado: t.estado || "",
      "Tipo Doc": t.documento_tipo || "",
      "N Doc": t.documento_numero || "",
      "N OC": t.oc_numero || "",
      Notas: t.notas || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "Flujos");
    XLSX.writeFile(wb, `flujos-financieros-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Modal
  const handleNuevoClick = () => {
    setEditarData(null);
    setMostrarModal(true);
  };

  const handleEditarClick = (t) => {
    setEditarData(t);
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setEditarData(null);
  };

  const handleModalSaved = async () => {
    await cargarTransacciones();
    cerrarModal();
  };

  // Corrección masiva de datos (solo admin/soporte)
  const handleCorregirDatos = async () => {
    if (!window.confirm(
      "Esto corregira transacciones con tipo incorrecto (EGRESO con categoria Ingresos) " +
      "y montos negativos. ¿Continuar?"
    )) return;
    setCorrigiendo(true);
    setResultadoCorreccion(null);
    try {
      const resultado = await corregirTransaccionesInconsistentes();
      setResultadoCorreccion(resultado);
      if (resultado.corregidas > 0) await cargarTransacciones();
    } catch (e) {
      console.error(e);
      setError("Error ejecutando la correccion de datos.");
    } finally {
      setCorrigiendo(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
          Flujos financieros
        </h1>
        <div className="flex items-center gap-2">
          {transaccionesFiltradas.length > 0 && (
            <button
              type="button"
              onClick={exportarExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-gray-300 hover:bg-gray-50 text-xs sm:text-sm font-medium text-gray-700 shadow-sm"
            >
              ⬇ Exportar Excel
            </button>
          )}
          {puedeEscribir && (
            <button
              type="button"
              onClick={handleNuevoClick}
              className="inline-flex items-center px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm font-medium text-white shadow-sm"
            >
              + Nueva transacción
            </button>
          )}
        </div>
      </div>

      {/* Botón corrección masiva — solo admin/soporte */}
      {(rol === "admin" || rol === "soporte") && !resultadoCorreccion && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-800">Correccion de datos pendiente</p>
            <p className="text-xs text-amber-600">Hay transacciones con tipo/montos inconsistentes (EGRESO con categoria Ingresos, montos negativos).</p>
          </div>
          <button type="button" onClick={handleCorregirDatos} disabled={corrigiendo}
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium whitespace-nowrap disabled:opacity-50">
            {corrigiendo ? "Corrigiendo..." : "Corregir ahora"}
          </button>
        </div>
      )}

      {/* Resultado de corrección */}
      {resultadoCorreccion && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-800">
            Correccion completada: {resultadoCorreccion.corregidas} de {resultadoCorreccion.revisadas} transacciones corregidas.
          </p>
          {resultadoCorreccion.detalles.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-green-700 cursor-pointer font-medium">Ver detalle</summary>
              <ul className="mt-1 text-xs text-green-700 space-y-0.5 max-h-40 overflow-auto">
                {resultadoCorreccion.detalles.map((d) => (
                  <li key={d.id} className="flex gap-2">
                    <span className="font-mono text-[10px] text-green-600">{d.id.slice(0, 8)}</span>
                    <span>{d.area}</span>
                    <span className="text-green-500">{d.proveedor}</span>
                    <span className="font-medium">{d.motivos.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button type="button" onClick={() => setResultadoCorreccion(null)}
            className="mt-2 text-xs text-green-600 hover:text-green-800 underline">
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Tabs de área */}
      {tabsVisibles.length > 1 && (
        <div className="flex gap-1 border-b border-gray-200">
          {AREAS_CONFIG.filter((a) => tabsVisibles.includes(a.id)).map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => { setAreaTab(area.id); setPaginaTrans(1); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                areaTab === area.id
                  ? "border-[#004990] text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {area.label}
              {area.id === "consolidado" && (
                <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  todos
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 space-y-3 shadow-sm">
        {/* Period presets */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-500 self-center mr-1">Período:</span>
          {[
            { label: "30 días", dias: 30 },
            { label: "Este mes", dias: -1 },
            { label: "3 meses", dias: 90 },
            { label: "6 meses", dias: 180 },
            { label: "Este año", dias: 365 },
            { label: "Todo", dias: 0 },
          ].map(({ label, dias }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (dias === -1) {
                  const hoy = new Date();
                  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                  aplicarPeriodo(Math.ceil((hoy - primero) / 86400000));
                } else {
                  aplicarPeriodo(dias);
                }
              }}
              className="px-2.5 py-1 rounded text-xs border border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Desde</label>
            <input
              type="date"
              name="fechaDesde"
              value={filtros.fechaDesde}
              onChange={handleFiltroChange}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Hasta</label>
            <input
              type="date"
              name="fechaHasta"
              value={filtros.fechaHasta}
              onChange={handleFiltroChange}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Tipo</label>
            <select
              name="tipo"
              value={filtros.tipo}
              onChange={handleFiltroChange}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value={TIPO_TRANSACCION.INGRESO}>Ingresos</option>
              <option value={TIPO_TRANSACCION.EGRESO}>Egresos</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Estado</label>
            <select
              name="estado"
              value={filtros.estado}
              onChange={handleFiltroChange}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {catalogos.estados.map((e) => (
                <option
                  key={e.id || e.nombre}
                  value={e.nombre || e.descripcion}
                >
                  {e.nombre || e.descripcion || e.codigo || e.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-600 mb-1">Categoría</label>
            <select
              name="categoriaId"
              value={filtros.categoriaId}
              onChange={handleFiltroChange}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              {catalogos.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre || c.descripcion || c.codigo || c.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2 justify-end">
          <button
            type="button"
            onClick={handleBuscarClick}
            className="inline-flex items-center px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs sm:text-sm font-medium text-white"
          >
            {cargando ? "Buscando..." : "Aplicar filtros"}
          </button>
          <button
            type="button"
            onClick={handleLimpiarFiltros}
            className="inline-flex items-center px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm font-medium text-gray-700 border border-gray-300"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ResumenCard titulo="Ingresos" valor={resumen.ingresos} />
        <ResumenCard titulo="Egresos" valor={resumen.egresos} />
        <ResumenCard titulo="Flujo neto" valor={resumen.flujoNeto} resaltado />
      </div>

      {/* Text search + count */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              value={busquedaTabla}
              onChange={(e) => { setBusquedaTabla(e.target.value); setPaginaTrans(1); }}
              placeholder="Buscar proveedor, CC, OC, doc…"
              className="pl-7 pr-3 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
            />
          </div>
          {cargandoCatalogos && <span className="text-xs text-gray-400">Cargando catálogos…</span>}
        </div>
        <span className="text-xs text-gray-500">
          {cargando ? "Cargando…" : `${transaccionesFiltradas.length} transacción${transaccionesFiltradas.length !== 1 ? "es" : ""}`}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>Fecha</Th>
              {areaTab === "consolidado" && <Th>Área</Th>}
              <Th>Tipo</Th>
              <Th>Moneda</Th>
              <Th className="text-right">Monto (S/)</Th>
              <Th>Categoría</Th>
              <Th>Proveedor</Th>
              <Th>Centro de Costo</Th>
              <Th>Estado</Th>
              <Th>Doc</Th>
              <Th>OC</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {transaccionesFiltradas.length === 0 && !cargando && (
              <tr>
                <td colSpan={11} className="text-center text-gray-500 py-3">
                  No hay transacciones en el rango seleccionado.
                </td>
              </tr>
            )}

            {transaccionesFiltradas.slice((paginaTrans - 1) * TRANS_POR_PAGINA, paginaTrans * TRANS_POR_PAGINA).map((t) => (
              <tr
                key={t.id}
                className="border-t border-gray-100 hover:bg-gray-50"
              >
                <Td>{t.fechaISO || ""}</Td>
                {areaTab === "consolidado" && (
                  <Td>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                      {t.area || "—"}
                    </span>
                  </Td>
                )}
                <Td>{t.tipo}</Td>
                <Td>{t.moneda}</Td>
                <Td className="text-right">
                  {Number(
                    t.monto_total_pen ?? t.monto_total ?? 0
                  ).toLocaleString("es-PE", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Td>
                <Td>{t.categoriaNombre}</Td>
                <Td className="max-w-[140px] truncate" title={t.proveedor_cliente_nombre || ""}>{t.proveedor_cliente_nombre || "—"}</Td>
                <Td className="max-w-[120px] truncate" title={t.centro_costo_nombre || ""}>{t.centro_costo_nombre || "—"}</Td>
                <Td>{t.estado}</Td>
                <Td>
                  {t.documento_tipo} {t.documento_numero}
                </Td>
                <Td>{t.oc_numero || t.ordenNumero || ""}</Td>
                <Td className="text-right">
                  <button
                    type="button"
                    onClick={() => handleEditarClick(t)}
                    className="text-blue-600 hover:text-blue-500 text-xs font-medium"
                  >
                    Ver / Editar
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación transacciones */}
      {Math.ceil(transaccionesFiltradas.length / TRANS_POR_PAGINA) > 1 && (
        <div className="flex justify-center items-center mt-4 gap-1 flex-wrap">
          <button onClick={() => setPaginaTrans((p) => Math.max(1, p - 1))} disabled={paginaTrans === 1}
            className="px-2 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100">‹</button>
          {(() => {
            const total = Math.ceil(transaccionesFiltradas.length / TRANS_POR_PAGINA);
            const win = 5;
            let start = Math.max(1, paginaTrans - Math.floor(win / 2));
            let end = Math.min(total, start + win - 1);
            if (end - start < win - 1) start = Math.max(1, end - win + 1);
            return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
              <button key={p} onClick={() => setPaginaTrans(p)}
                className={`px-3 py-1 border rounded text-sm ${p === paginaTrans ? "bg-black text-[#f0c000] border-black" : "bg-white text-black border-black hover:bg-gray-100"}`}>
                {p}
              </button>
            ));
          })()}
          <button onClick={() => setPaginaTrans((p) => Math.min(Math.ceil(transaccionesFiltradas.length / TRANS_POR_PAGINA), p + 1))} disabled={paginaTrans === Math.ceil(transaccionesFiltradas.length / TRANS_POR_PAGINA)}
            className="px-2 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100">›</button>
          <span className="text-xs text-gray-400 ml-1">{paginaTrans}/{Math.ceil(transaccionesFiltradas.length / TRANS_POR_PAGINA)}</span>
        </div>
      )}

      {/* Modal de crear/editar transaccion */}
      {mostrarModal && (
        <TransaccionFormModal
          initialData={editarData}
          usuario={usuario}
          catalogos={catalogos}
          proveedorOptions={proveedorOptions}
          centroCostoOptions={centroCostoOptions}
          areaTab={areaTab}
          areaDefault={areaDefault}
          onClose={cerrarModal}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  );
}

// UI helpers
function Th({ children, className = "" }) {
  return (
    <th
      className={
        "px-2 py-2 text-left text-xs font-medium text-gray-600 " + className
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td
      className={
        "px-2 py-1.5 align-middle text-xs text-gray-800 " + className
      }
    >
      {children}
    </td>
  );
}

function ResumenCard({ titulo, valor, resaltado }) {
  let color = "text-gray-800";
  if (resaltado) {
    color =
      valor > 0
        ? "text-emerald-600"
        : valor < 0
        ? "text-red-600"
        : "text-gray-800";
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="text-xs text-gray-500">{titulo} (S/)</div>
      <div className={"mt-1 text-lg sm:text-xl font-semibold font-mono " + color}>
        S/ {valor.toLocaleString("es-PE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>
    </div>
  );
}

export default FlujosFinancieros;
