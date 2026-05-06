// src/components/ExportMenu.jsx
// Menú desplegable de exportación multi-formato para cualquier página.
// Uso:
//   <ExportMenu data={filas} nombre="historial-oc" columnas={[...]} headers={{...}} titulo="Historial OC" />

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Table2, ChevronDown, Loader2 } from "lucide-react";
import { exportExcel, exportCSV, exportPDF } from "../utils/exportUtils";

const ExportMenu = ({
  data         = [],
  dataProvider = null,   // async () => row[] — si se provee, se llama al exportar
  nombre       = "exportacion",
  titulo       = "Reporte",
  subtitulo    = "",
  columnas     = null,
  headers      = {},
  orientacion  = "landscape",
  disabled     = false,
}) => {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
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
    { label: "Excel (.xlsx)", icon: FileSpreadsheet, color: "text-green-700", fn: exportExcel },
    { label: "CSV",            icon: Table2,          color: "text-blue-700",  fn: exportCSV   },
    { label: "PDF",            icon: FileText,         color: "text-red-700",   fn: exportPDF   },
  ];

  const handleAction = async (fn) => {
    setOpen(false);
    if (dataProvider) {
      setFetching(true);
      try {
        const rows = await dataProvider();
        fn(rows, opts);
      } finally {
        setFetching(false);
      }
    } else {
      fn(data, opts);
    }
  };

  const hasData = dataProvider || data.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || !hasData || fetching}
        className="btn btn-export btn-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        title={!hasData ? "Sin datos para exportar" : fetching ? "Preparando…" : "Exportar"}
      >
        {fetching ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        <span className="hidden sm:inline">{fetching ? "Preparando…" : "Exportar"}</span>
        {!fetching && <ChevronDown size={11} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg
                        border border-gray-100 py-1 z-50">
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            {dataProvider ? "Todos los registros filtrados" : `${data.length} registro${data.length !== 1 ? "s" : ""}`}
          </p>
          {acciones.map(({ label, icon: Icon, color, fn }) => (
            <button
              key={label}
              onClick={() => handleAction(fn)}
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
