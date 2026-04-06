// src/components/ExportMenu.jsx
// Menú desplegable de exportación multi-formato para cualquier página.
// Uso:
//   <ExportMenu data={filas} nombre="historial-oc" columnas={[...]} headers={{...}} titulo="Historial OC" />

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Table2, ChevronDown } from "lucide-react";
import { exportExcel, exportCSV, exportPDF } from "../utils/exportUtils";

const ExportMenu = ({
  data      = [],
  nombre    = "exportacion",
  titulo    = "Reporte",
  subtitulo = "",
  columnas  = null,
  headers   = {},
  orientacion = "landscape",
  disabled  = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const opts = { nombre, titulo, subtitulo, columnas, headers, orientacion };

  const acciones = [
    {
      label: "Excel (.xlsx)",
      icon: FileSpreadsheet,
      color: "text-green-700",
      action: () => exportExcel(data, opts),
    },
    {
      label: "CSV",
      icon: Table2,
      color: "text-blue-700",
      action: () => exportCSV(data, opts),
    },
    {
      label: "PDF",
      icon: FileText,
      color: "text-red-700",
      action: () => exportPDF(data, opts),
    },
  ];

  const handleAction = (fn) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || !data.length}
        className="btn btn-export btn-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        title={!data.length ? "Sin datos para exportar" : "Exportar"}
      >
        <Download size={13} />
        <span className="hidden sm:inline">Exportar</span>
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg
                        border border-gray-100 py-1 z-50">
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            {data.length} registro{data.length !== 1 ? "s" : ""}
          </p>
          {acciones.map(({ label, icon: Icon, color, action }) => (
            <button
              key={label}
              onClick={() => handleAction(action)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                         hover:bg-gray-50 transition-colors"
            >
              <Icon size={14} className={color} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
