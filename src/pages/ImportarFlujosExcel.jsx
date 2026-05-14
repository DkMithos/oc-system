// src/pages/ImportarFlujosExcel.jsx
// Importacion masiva de flujos financieros desde Excel.
// Soporta dos esquemas: Estandar (Admin/Conta/TI) y Operaciones (CDC/Proyectos).
// Permite elegir la hoja del archivo Excel a importar.

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  leerExcel,
  leerHojasExcel,
  parsearFilaEstandar,
  parsearFilaOperaciones,
  importarTransacciones,
} from "../firebase/importHelpers";
import { useUsuario } from "../context/UsuarioContext";

const ESQUEMAS = [
  { id: "administracion", label: "Admin",        descripcion: "Flujo de Administracion" },
  { id: "contabilidad",   label: "Contabilidad", descripcion: "Flujo de Contabilidad" },
  { id: "ti",             label: "TI",           descripcion: "Flujo de TI" },
  { id: "operaciones",    label: "Operaciones",  descripcion: "Flujo de Proyectos (CDC)" },
];

const ES_OPERACIONES = (area) => area === "operaciones";

const MAX_PREVIEW = 200;

// ── Columnas de preview ────────────────────────────────────────
const COLS_ESTANDAR = [
  { key: "categoriaNombre",          label: "Categoria" },
  { key: "proveedor_cliente_nombre", label: "Proveedor" },
  { key: "centro_costo_nombre",      label: "CDC" },
  { key: "moneda",                   label: "Mon" },
  { key: "monto_total",              label: "Total" },
  { key: "montoPresupuestado",       label: "Presup." },
  { key: "mesVencimiento",           label: "Mes Vcto." },
  { key: "estado",                   label: "Estado" },
  { key: "postergado",               label: "Post." },
  { key: "notas",                    label: "Notas" },
];

const COLS_OPERACIONES = [
  { key: "categoriaNombre",          label: "Categoria" },
  { key: "proveedor_cliente_nombre", label: "Proveedor" },
  { key: "centro_costo_nombre",      label: "CDC" },
  { key: "moneda",                   label: "Mon" },
  { key: "monto_total",              label: "Total" },
  { key: "montoPresupuestado",       label: "Presup." },
  { key: "tc",                       label: "TC" },
  { key: "mesVencimiento",           label: "Mes Vcto." },
  { key: "metodoPago",               label: "Met. Pago" },
  { key: "estado",                   label: "Estado" },
];

// ── Componente ─────────────────────────────────────────────────
export default function ImportarFlujosExcel() {
  const { usuario } = useUsuario();

  const [esquema, setEsquema] = useState("administracion");
  const [filas, setFilas] = useState([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [drag, setDrag] = useState(false);

  // Selector de hoja
  const [hojas, setHojas] = useState([]); // [{name, filas}]
  const [hojaSeleccionada, setHojaSeleccionada] = useState("");
  const [archivoBuffer, setArchivoBuffer] = useState(null); // File object guardado para re-parsear

  const inputRef = useRef(null);

  const stats = useMemo(() => {
    const total = filas.length;
    const validas = filas.filter((f) => f._valida).length;
    const invalidas = total - validas;
    return { total, validas, invalidas };
  }, [filas]);

  const columnas = ES_OPERACIONES(esquema) ? COLS_OPERACIONES : COLS_ESTANDAR;

  // Paso 1: leer hojas del archivo
  const cargarHojas = useCallback(async (file) => {
    setError("");
    setResultado(null);
    setFilas([]);
    setCargando(true);
    setNombreArchivo(file.name);
    setArchivoBuffer(file);
    try {
      const info = await leerHojasExcel(file);
      setHojas(info);
      // Auto-seleccionar la primera hoja con > 10 filas
      const candidata = info.find((h) => h.filas > 10) || info[0];
      if (candidata) {
        setHojaSeleccionada(candidata.name);
        await parsearHoja(file, candidata.name);
      }
    } catch (e) {
      setError("Error leyendo el archivo: " + e.message);
    } finally {
      setCargando(false);
    }
  }, [esquema]);

  // Paso 2: parsear una hoja especifica
  const parsearHoja = useCallback(async (file, sheetName) => {
    setCargando(true);
    setError("");
    setFilas([]);
    try {
      const { rows } = await leerExcel(file, sheetName);
      if (!rows.length) {
        setError("La hoja '" + sheetName + "' no tiene filas de datos.");
        return;
      }
      const parser = ES_OPERACIONES(esquema) ? parsearFilaOperaciones : parsearFilaEstandar;
      setFilas(rows.map((r, i) => parser(r, i)));
    } catch (e) {
      setError("Error procesando la hoja: " + e.message);
    } finally {
      setCargando(false);
    }
  }, [esquema]);

  const handleCambiarHoja = async (sheetName) => {
    setHojaSeleccionada(sheetName);
    if (archivoBuffer) {
      await parsearHoja(archivoBuffer, sheetName);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) cargarHojas(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) cargarHojas(file);
  };

  const handleEsquemaCambio = (id) => {
    setEsquema(id);
    setFilas([]);
    setNombreArchivo("");
    setResultado(null);
    setError("");
    setHojas([]);
    setHojaSeleccionada("");
    setArchivoBuffer(null);
  };

  const handleImportar = async () => {
    if (!stats.validas) return;
    setImportando(true);
    setError("");
    try {
      const n = await importarTransacciones(filas, esquema, usuario?.email || "");
      setResultado({ importadas: n });
      setFilas([]);
    } catch (e) {
      setError("Error importando: " + e.message);
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black">Importar Flujos Financieros</h1>
        <p className="text-sm text-gray-500 mt-0.5">Carga masiva desde archivos Excel (.xlsx / .xls)</p>
      </div>

      {/* Selector de esquema */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Area de flujo</p>
        <div className="flex flex-wrap gap-2">
          {ESQUEMAS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => handleEsquemaCambio(e.id)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                esquema === e.id
                  ? "bg-black text-[#f0c000] border-black"
                  : "bg-white text-gray-600 border-gray-300 hover:border-[#004990] hover:text-black"
              }`}
            >
              {e.label}
              <span className={`ml-1.5 text-[10px] ${esquema === e.id ? "text-blue-200" : "text-gray-400"}`}>
                {e.descripcion}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Zona de carga */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none ${
          drag ? "border-[#004990] bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-black hover:bg-gray-100/30"
        }`}
      >
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
        <div className="text-4xl mb-2">📂</div>
        {cargando ? (
          <p className="text-sm text-gray-500">Procesando archivo...</p>
        ) : nombreArchivo ? (
          <p className="text-sm text-black font-semibold">{nombreArchivo}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-600">Arrastra tu archivo aqui o haz clic para seleccionar</p>
            <p className="text-xs text-gray-400 mt-1">Formatos: .xlsx, .xls</p>
          </>
        )}
      </div>

      {/* Selector de hoja */}
      {hojas.length > 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Selecciona la hoja a importar ({hojas.length} hojas encontradas)
          </p>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {hojas.map((h) => (
              <button
                key={h.name}
                type="button"
                onClick={() => handleCambiarHoja(h.name)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  hojaSeleccionada === h.name
                    ? "bg-black text-[#f0c000] border-black"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {h.name}
                <span className={`ml-1 text-[10px] ${hojaSeleccionada === h.name ? "text-blue-200" : "text-gray-400"}`}>
                  ({h.filas} filas)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {resultado && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm font-medium">
          {resultado.importadas} transacciones importadas correctamente al area <strong>{esquema}</strong>.
        </div>
      )}

      {/* Resumen de validacion */}
      {filas.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                Total: <strong>{stats.total}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                Validas: <strong>{stats.validas}</strong>
              </span>
              {stats.invalidas > 0 && (
                <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium">
                  Con errores: <strong>{stats.invalidas}</strong>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleImportar}
              disabled={importando || !stats.validas}
              className="ml-auto px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importando ? "Importando..." : `Importar ${stats.validas} transacciones a ${esquema}`}
            </button>
          </div>

          {/* Tabla de preview */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
            <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Vista previa — {hojaSeleccionada} {filas.length > MAX_PREVIEW ? ` (primeras ${MAX_PREVIEW} filas)` : ""}
              </p>
            </div>
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 whitespace-nowrap">#</th>
                  {columnas.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-left text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                  <th className="px-3 py-2 text-left text-gray-600">Validacion</th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, MAX_PREVIEW).map((fila) => (
                  <tr
                    key={fila._fila}
                    className={`border-t ${fila._valida ? "hover:bg-gray-50" : "bg-red-50"}`}
                  >
                    <td className="px-3 py-1.5 text-gray-400 font-mono">{fila._fila}</td>
                    {columnas.map((c) => (
                      <td key={c.key} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[160px] truncate" title={String(fila[c.key] ?? "")}>
                        {fila[c.key] != null && fila[c.key] !== "" && fila[c.key] !== false
                          ? String(fila[c.key])
                          : <span className="text-gray-300">-</span>}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {fila._valida ? (
                        <span className="text-green-600 font-medium">OK</span>
                      ) : (
                        <span className="text-red-600 font-medium" title={fila._errores.join(", ")}>
                          {fila._errores.join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
