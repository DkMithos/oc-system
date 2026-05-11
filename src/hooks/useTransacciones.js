// src/hooks/useTransacciones.js
// Hook reutilizable para cargar, filtrar y paginar transacciones financieras.
// Extraído de FlujosFinancieros.jsx (Fase 2 refactor).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  obtenerTransaccionesFinancieras,
  TIPO_TRANSACCION,
} from "../firebase/finanzasHelpers";

const hoy = new Date();
const anio = hoy.getFullYear();

export const initialFilters = () => ({
  fechaDesde: `${anio}-01-01`,
  fechaHasta: `${anio}-12-31`,
  tipo: "",
  estado: "",
  categoriaId: "",
  centro_costo_id: "",
});

export default function useTransacciones({ porPagina = 25 } = {}) {
  const [filtros, setFiltros] = useState(initialFilters);
  const [busquedaTabla, setBusquedaTabla] = useState("");
  const [transacciones, setTransacciones] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargarTransacciones = useCallback(async (f) => {
    const filtrosActivos = f || filtros;
    setCargando(true);
    setError("");
    try {
      const { transacciones: data } = await obtenerTransaccionesFinancieras({
        fechaDesde: filtrosActivos.fechaDesde || null,
        fechaHasta: filtrosActivos.fechaHasta || null,
        tipo: filtrosActivos.tipo || null,
        estado: filtrosActivos.estado || null,
        categoriaId: filtrosActivos.categoriaId || null,
        centro_costo_id: filtrosActivos.centro_costo_id || null,
      });
      setTransacciones(data);
      setPagina(1);
    } catch (e) {
      console.error("Error cargando transacciones:", e);
      setError("Error cargando transacciones financieras.");
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  // Carga inicial
  useEffect(() => {
    cargarTransacciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrado local (por área + búsqueda textual)
  const filtrar = useCallback((data, areaTab, busqueda) => {
    let resultado = data;
    if (areaTab !== "consolidado") {
      resultado = resultado.filter((t) => (t.area || "") === areaTab);
    }
    const q = (busqueda || "").trim().toLowerCase();
    if (q) {
      resultado = resultado.filter((t) =>
        [t.proveedor_cliente_nombre, t.centro_costo_nombre, t.oc_numero, t.documento_numero, t.categoriaNombre, t.notas]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
    }
    return resultado;
  }, []);

  // Resumen financiero
  const calcularResumen = useCallback((data) => {
    let ingresos = 0, egresos = 0;
    data.forEach((t) => {
      const totalPen = t.monto_total_pen != null ? Number(t.monto_total_pen) : Number(t.monto_total || 0);
      if (t.tipo === TIPO_TRANSACCION.INGRESO) ingresos += totalPen;
      else if (t.tipo === TIPO_TRANSACCION.EGRESO) egresos += totalPen;
    });
    return {
      ingresos: +ingresos.toFixed(2),
      egresos: +egresos.toFixed(2),
      flujoNeto: +(ingresos - egresos).toFixed(2),
    };
  }, []);

  const handleFiltroChange = useCallback((e) => {
    const { name, value } = e.target;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  }, []);

  const limpiarFiltros = useCallback(async () => {
    const nuevo = initialFilters();
    setFiltros(nuevo);
    setBusquedaTabla("");
    await cargarTransacciones(nuevo);
  }, [cargarTransacciones]);

  return {
    filtros,
    setFiltros,
    busquedaTabla,
    setBusquedaTabla,
    transacciones,
    setTransacciones,
    pagina,
    setPagina,
    porPagina,
    cargando,
    error,
    setError,
    cargarTransacciones,
    filtrar,
    calcularResumen,
    handleFiltroChange,
    limpiarFiltros,
  };
}
