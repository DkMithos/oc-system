// src/utils/exportUtils.js
// Exportaciones universales: Excel, CSV, PDF.
// Usar así: import { exportExcel, exportCSV, exportPDF } from "../utils/exportUtils";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── EXCEL ────────────────────────────────────────────────────────────────────

/**
 * Exporta un array de objetos a Excel (.xlsx).
 * @param {object[]} data - Filas de datos
 * @param {object} opciones
 * @param {string} opciones.nombre - Nombre del archivo (sin extensión)
 * @param {string} opciones.hoja - Nombre de la hoja
 * @param {string[]} [opciones.columnas] - Claves a incluir (todas si omite)
 * @param {object} [opciones.headers] - Mapeo clave → label de columna
 */
export const exportExcel = (data = [], opciones = {}) => {
  const {
    nombre   = "exportacion",
    hoja     = "Datos",
    columnas = null,
    headers  = {},
  } = opciones;

  const filas = data.map((row) => {
    const cols = columnas || Object.keys(row);
    const fila = {};
    cols.forEach((col) => {
      const label = headers[col] || col;
      fila[label] = formatCellValue(row[col]);
    });
    return fila;
  });

  const ws  = XLSX.utils.json_to_sheet(filas);
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31));

  // Auto-ancho de columnas
  const colWidths = {};
  filas.forEach((fila) => {
    Object.entries(fila).forEach(([k, v]) => {
      const len = String(v ?? "").length;
      colWidths[k] = Math.max(colWidths[k] || k.length, len, 10);
    });
  });
  ws["!cols"] = Object.values(colWidths).map((w) => ({ wch: Math.min(w + 2, 50) }));

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${nombre}.xlsx`);
};

/**
 * Exporta múltiples hojas en un solo Excel.
 * @param {{ hoja: string, data: object[], columnas?: string[], headers?: object }[]} hojas
 * @param {string} nombre
 */
export const exportExcelMultiHoja = (hojas = [], nombre = "exportacion") => {
  const wb = XLSX.utils.book_new();

  hojas.forEach(({ hoja, data, columnas, headers = {} }) => {
    const filas = (data || []).map((row) => {
      const cols = columnas || Object.keys(row);
      const fila = {};
      cols.forEach((col) => {
        fila[headers[col] || col] = formatCellValue(row[col]);
      });
      return fila;
    });
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, String(hoja).slice(0, 31));
  });

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${nombre}.xlsx`);
};

// ─── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Exporta data a CSV.
 * @param {object[]} data
 * @param {object} opciones
 */
export const exportCSV = (data = [], opciones = {}) => {
  const { nombre = "exportacion", columnas = null, headers = {}, separador = ";" } = opciones;
  if (!data.length) return;

  const cols  = columnas || Object.keys(data[0]);
  const label = cols.map((c) => `"${headers[c] || c}"`).join(separador);
  const filas = data.map((row) =>
    cols.map((c) => {
      const v = formatCellValue(row[c]);
      return typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(separador)
  );

  const csv = [label, ...filas].join("\n");
  const bom = "\uFEFF"; // BOM para Excel en español
  saveAs(new Blob([bom + csv], { type: "text/csv;charset=utf-8;" }), `${nombre}.csv`);
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

/**
 * Exporta data a PDF con tabla.
 * @param {object[]} data
 * @param {object} opciones
 * @param {string} opciones.nombre - Nombre del archivo
 * @param {string} opciones.titulo - Título del documento
 * @param {string[]} [opciones.columnas] - Claves a incluir
 * @param {object} [opciones.headers] - Mapeo clave → label
 * @param {string} [opciones.orientacion] - "landscape" | "portrait"
 * @param {string} [opciones.subtitulo] - Segunda línea de encabezado
 */
export const exportPDF = (data = [], opciones = {}) => {
  const {
    nombre       = "exportacion",
    titulo       = "Reporte",
    subtitulo    = "",
    columnas     = null,
    headers      = {},
    orientacion  = "landscape",
    empresa      = "Memphis Maquinarias S.A.C",
    ruc          = "20603847424",
  } = opciones;

  const cols = columnas || (data.length ? Object.keys(data[0]) : []);
  const head = [cols.map((c) => headers[c] || c)];
  const body = data.map((row) =>
    cols.map((c) => String(formatCellValue(row[c]) ?? ""))
  );

  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });

  // Encabezado
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 43, 90);
  pdf.text(empresa, 14, 16);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);
  pdf.text(`RUC: ${ruc}`, 14, 22);

  const ancho = orientacion === "landscape" ? 297 : 210;
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(0, 43, 90);
  pdf.text(titulo, ancho / 2, 16, { align: "center" });

  if (subtitulo) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(subtitulo, ancho / 2, 22, { align: "center" });
  }

  const fecha = new Date().toLocaleString("es-PE");
  pdf.setFontSize(8);
  pdf.setTextColor(130, 130, 130);
  pdf.text(`Generado: ${fecha}`, ancho - 14, 22, { align: "right" });

  // Tabla
  autoTable(pdf, {
    head,
    body,
    startY: 28,
    styles:      { fontSize: 7.5, cellPadding: 2 },
    headStyles:  { fillColor: [0, 43, 90], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 255] },
    margin: { left: 14, right: 14 },
    tableLineColor: [200, 210, 230],
    tableLineWidth: 0.1,
  });

  // Pie
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(160, 160, 160);
    pdf.text(`Página ${i} de ${pageCount}`, ancho / 2, pdf.internal.pageSize.height - 8, { align: "center" });
  }

  pdf.save(`${nombre}.pdf`);
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatCellValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v?.toDate) return v.toDate().toLocaleString("es-PE");
  if (v instanceof Date) return v.toLocaleString("es-PE");
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

/**
 * Botón de exportación reutilizable (para usar inline en páginas).
 * Uso: <ExportButton data={data} nombre="reporte-ocs" columnas={[...]} headers={{...}} />
 */
export const buildExportOptions = (modulo, filtros = {}) => ({
  nombre:   `${modulo}-${new Date().toISOString().slice(0, 10)}`,
  titulo:   `Reporte de ${modulo}`,
  subtitulo: Object.entries(filtros)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("  |  "),
});
