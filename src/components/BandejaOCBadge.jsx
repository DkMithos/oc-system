import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { obtenerOCs } from "../firebase/firestoreHelpers";

/**
 * Muestra un badge con la cantidad de OCs relevantes según el rol:
 * - comprador   -> "Pendiente de Firma del Comprador"
 * - operaciones -> "Pendiente de Operaciones"
 * - gerencia    -> "Aprobado por Operaciones"
 * - finanzas    -> "Aprobado por Gerencia"
 *
 * Al hacer click, navega a /historial?estado=<estado>
 */
const BandejaOCBadge = ({ rol }) => {
  const navigate = useNavigate();
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(false);

  const estadoObjetivo = useMemo(() => {
    const map = {
      comprador: "Pendiente de Firma del Comprador",
      operaciones: "Pendiente de Operaciones",
      gerencia: "Aprobado por Operaciones",
      finanzas: "Aprobado por Gerencia",
    };
    return map[rol] || null;
  }, [rol]);

  const cargar = async () => {
    try {
      setCargando(true);
      const ocs = await obtenerOCs();
      setOrdenes(ocs || []);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // refresca cuando se actualiza una OC desde los modales
    const onUpdated = () => cargar();
    window.addEventListener("oc-updated", onUpdated);
    return () => window.removeEventListener("oc-updated", onUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cantidad = useMemo(() => {
    if (!estadoObjetivo) return 0;
    return (ordenes || []).filter((o) => (o.estado || "") === estadoObjetivo).length;
  }, [ordenes, estadoObjetivo]);

  if (!estadoObjetivo) return null;

  const go = () => {
    const q = new URLSearchParams({ estado: estadoObjetivo }).toString();
    navigate(`/historial?${q}`);
  };

  return (
    <button
      onClick={go}
      title={`Ir a: ${estadoObjetivo}`}
      className="relative flex items-center gap-2 bg-white text-blue-900 px-3 py-1 rounded-full shadow hover:shadow-md"
    >
      <Inbox size={18} />
      <span className="text-sm font-semibold hidden sm:inline">Bandeja</span>
      <span
        className={`ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs font-bold ${
          cargando ? "bg-gray-300 text-gray-700" : cantidad > 0 ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"
        }`}
      >
        {cargando ? "…" : cantidad}
      </span>
    </button>
  );
};

export default BandejaOCBadge;
