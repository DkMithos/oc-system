// ✅ src/pages/reportes/CentroExportaciones.jsx
import React, { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../firebase/config";
import { useUsuario } from "../../context/UsuarioContext";

// Helpers para normalizar datos Firestore → Excel
const normalizeDocForExcel = (docSnap, extra = {}) => {
  const data = docSnap.data() || {};
  const plain = { id: docSnap.id, ...extra };

  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value.toDate === "function") {
      // Timestamps → ISO
      plain[key] = value.toDate().toISOString();
    } else if (Array.isArray(value) || (value && typeof value === "object")) {
      // Objetos / arrays → JSON string
      plain[key] = JSON.stringify(value);
    } else {
      plain[key] = value;
    }
  });

  return plain;
};

const exportJsonToExcel = (rows, fileName, sheetName = "Datos") => {
  if (!rows || rows.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
};

// ---------------- Roles: quién puede exportar qué ----------------

const usePermisosExport = (rol) => {
  const r = String(rol || "").toLowerCase();

  const esAdminSoporte = ["admin", "soporte"].includes(r);
  const esFinanzas = ["finanzas", "gerencia finanzas"].includes(r);
  const esGerencia =
    ["gerencia", "gerencia general", "gerencia operaciones"].includes(r);
  const esComprador = ["comprador"].includes(r);
  const esOperaciones = ["operaciones"].includes(r);

  return {
    puedeOrdenes:
      esAdminSoporte || esFinanzas || esGerencia || esComprador || esOperaciones,
    puedeProveedores: esAdminSoporte || esFinanzas || esGerencia || esComprador,
    puedeCotizaciones: esAdminSoporte || esFinanzas || esGerencia || esComprador,
    puedeRequerimientos:
      esAdminSoporte || esFinanzas || esGerencia || esComprador || esOperaciones,
    puedeCajaChica: esAdminSoporte || esFinanzas || esGerencia,
  };
};

const CentroExportaciones = () => {
  const { usuario } = useUsuario();
  const rol = usuario?.rol || "";
  const permisos = usePermisosExport(rol);

  const [loading, setLoading] = useState({
    ordenes: false,
    proveedores: false,
    cotizaciones: false,
    requerimientos: false,
    caja: false,
  });

  const setLoadingKey = (key, value) =>
    setLoading((prev) => ({ ...prev, [key]: value }));

  // ------------ Exportar: Órdenes de compra ------------

  const handleExportOrdenes = async () => {
    try {
      setLoadingKey("ordenes", true);
      const snap = await getDocs(collection(db, "ordenesCompra"));
      const rows = snap.docs.map((d) => normalizeDocForExcel(d));
      exportJsonToExcel(rows, "ordenes_compra.xlsx", "OrdenesCompra");
    } catch (e) {
      console.error("Error exportando ordenesCompra:", e);
      alert("Error exportando órdenes de compra. Revisa la consola.");
    } finally {
      setLoadingKey("ordenes", false);
    }
  };

  // ------------ Exportar: Proveedores ------------

  const handleExportProveedores = async () => {
    try {
      setLoadingKey("proveedores", true);
      const snap = await getDocs(collection(db, "proveedores"));
      const rows = snap.docs.map((d) => normalizeDocForExcel(d));
      exportJsonToExcel(rows, "proveedores.xlsx", "Proveedores");
    } catch (e) {
      console.error("Error exportando proveedores:", e);
      alert("Error exportando proveedores. Revisa la consola.");
    } finally {
      setLoadingKey("proveedores", false);
    }
  };

  // ------------ Exportar: Cotizaciones ------------

  const handleExportCotizaciones = async () => {
    try {
      setLoadingKey("cotizaciones", true);
      const snap = await getDocs(collection(db, "cotizaciones"));
      const rows = snap.docs.map((d) => normalizeDocForExcel(d));
      exportJsonToExcel(rows, "cotizaciones.xlsx", "Cotizaciones");
    } catch (e) {
      console.error("Error exportando cotizaciones:", e);
      alert("Error exportando cotizaciones. Revisa la consola.");
    } finally {
      setLoadingKey("cotizaciones", false);
    }
  };

  // ------------ Exportar: Requerimientos ------------

  const handleExportRequerimientos = async () => {
    try {
      setLoadingKey("requerimientos", true);
      const snap = await getDocs(collection(db, "requerimientos"));
      const rows = snap.docs.map((d) => normalizeDocForExcel(d));
      exportJsonToExcel(rows, "requerimientos.xlsx", "Requerimientos");
    } catch (e) {
      console.error("Error exportando requerimientos:", e);
      alert("Error exportando requerimientos. Revisa la consola.");
    } finally {
      setLoadingKey("requerimientos", false);
    }
  };

  // ------------ Exportar: Caja Chica (movimientos de todas las cajas) ------------

  const handleExportCajaChica = async () => {
    try {
      setLoadingKey("caja", true);

      const cajasSnap = await getDocs(collection(db, "cajasChicas"));
      const allRows = [];

      for (const cajaDoc of cajasSnap.docs) {
        const cajaId = cajaDoc.id;
        const cajaData = cajaDoc.data() || {};
        const nombreCaja = cajaData.nombre || cajaId;

        const movSnap = await getDocs(
          collection(db, `cajasChicas/${cajaId}/movimientos`)
        );

        movSnap.forEach((movDoc) => {
          const row = normalizeDocForExcel(movDoc, {
            cajaId,
            cajaNombre: nombreCaja,
          });
          allRows.push(row);
        });
      }

      exportJsonToExcel(allRows, "caja_chica_movimientos.xlsx", "CajaChica");
    } catch (e) {
      console.error("Error exportando caja chica:", e);
      alert("Error exportando Caja Chica. Revisa la consola.");
    } finally {
      setLoadingKey("caja", false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Centro de exportaciones
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Descarga información completa en Excel desde un solo panel. 
          Las opciones disponibles dependen de tu rol.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Usuario: <span className="font-mono">{usuario?.email}</span> — Rol:{" "}
          <span className="uppercase font-semibold">{rol || "—"}</span>
        </p>
      </div>

      {/* Grid de exportaciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Órdenes de compra */}
        <ExportCard
          titulo="Órdenes de compra"
          descripcion="Exporta todas las órdenes de compra con su información completa (campos Firestore)."
          onClick={handleExportOrdenes}
          loading={loading.ordenes}
          enabled={permisos.puedeOrdenes}
        />

        {/* Proveedores */}
        <ExportCard
          titulo="Proveedores"
          descripcion="Exporta el maestro de proveedores (RUC, razón social, bancos, contactos, etc.)."
          onClick={handleExportProveedores}
          loading={loading.proveedores}
          enabled={permisos.puedeProveedores}
        />

        {/* Cotizaciones */}
        <ExportCard
          titulo="Cotizaciones"
          descripcion="Exporta todas las cotizaciones registradas en el sistema."
          onClick={handleExportCotizaciones}
          loading={loading.cotizaciones}
          enabled={permisos.puedeCotizaciones}
        />

        {/* Requerimientos */}
        <ExportCard
          titulo="Requerimientos"
          descripcion="Exporta todos los requerimientos con su detalle y estado."
          onClick={handleExportRequerimientos}
          loading={loading.requerimientos}
          enabled={permisos.puedeRequerimientos}
        />

        {/* Caja Chica */}
        <ExportCard
          titulo="Caja Chica (movimientos)"
          descripcion="Exporta todos los movimientos de Caja Chica de todas las cajas, con identificación de caja."
          onClick={handleExportCajaChica}
          loading={loading.caja}
          enabled={permisos.puedeCajaChica}
        />
      </div>

      <div className="text-xs text-gray-400 mt-2">
        Nota: Los campos de tipo fecha se exportan en formato ISO y los objetos 
        anidados (por ejemplo, bancos, contacto) se exportan como JSON para no 
        perder información.
      </div>
    </div>
  );
};

const ExportCard = ({ titulo, descripcion, onClick, loading, enabled }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
        <p className="text-xs text-gray-500 mt-1 leading-snug">
          {descripcion}
        </p>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onClick}
          disabled={!enabled || loading}
          className={
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
            (enabled
              ? "bg-blue-900 text-white hover:bg-blue-700 disabled:bg-blue-300"
              : "bg-gray-100 text-gray-400 cursor-not-allowed")
          }
          title={
            enabled
              ? "Descargar Excel"
              : "Tu rol no tiene permisos para esta exportación"
          }
        >
          {loading ? "Generando..." : "Exportar Excel"}
        </button>
      </div>
    </div>
  );
};

export default CentroExportaciones;
