// src/pages/CompromisosActivos.jsx
// Fase 5d: Panel de compromisos de pago activos.
// Muestra promesas de pago con fechas límite, estado de cumplimiento y alertas.

import React, { useEffect, useState, useCallback } from "react";
import { useUsuario } from "../context/UsuarioContext";
import BackButton from "../components/ui/BackButton";
import { toast } from "react-toastify";
import {
  obtenerCompromisosActivos,
  cumplirCompromiso,
  incumplirCompromiso,
} from "../firebase/mesaPagosHelpers";
import { SkeletonCard } from "../components/ui/Skeleton";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Calendar,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function CompromisosActivos() {
  const { usuario, cargando: authLoading } = useUsuario();
  const [compromisos, setCompromisos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [filtro, setFiltro] = useState("todos"); // todos | vencidos | proximos

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerCompromisosActivos();
      setCompromisos(data);
    } catch (e) {
      console.error("Error cargando compromisos:", e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) cargar();
  }, [authLoading, cargar]);

  const marcarCumplido = async (id) => {
    setProcesando(id);
    try {
      await cumplirCompromiso(id);
      toast.success("Compromiso marcado como cumplido");
      await cargar();
    } catch (e) {
      toast.error("Error al actualizar compromiso");
    } finally {
      setProcesando(null);
    }
  };

  const marcarIncumplido = async (id) => {
    setProcesando(id);
    try {
      await incumplirCompromiso(id, "Marcado manualmente como incumplido");
      toast.info("Compromiso marcado como incumplido");
      await cargar();
    } catch (e) {
      toast.error("Error al actualizar compromiso");
    } finally {
      setProcesando(null);
    }
  };

  // Filtrar
  const filtrados = compromisos.filter((c) => {
    if (filtro === "vencidos") return c.vencido;
    if (filtro === "proximos") return c.proximoVencer;
    return true;
  });

  // KPIs
  const totalCompromisos = compromisos.length;
  const vencidos = compromisos.filter((c) => c.vencido).length;
  const proximosVencer = compromisos.filter((c) => c.proximoVencer).length;
  const montoComprometido = compromisos.reduce(
    (acc, c) => acc + Number(c.monto_total_pen ?? c.monto_total ?? 0), 0
  );

  if (authLoading || cargando) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonCard lines={8} />
      </div>
    );
  }

  if (!usuario) return <div className="p-6">Acceso no autorizado</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-2xl font-bold text-black">Compromisos de Pago</h1>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Seguimiento de promesas de pago asignadas en Mesa de Pagos
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:border-gray-400 hover:text-black disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-gray-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Activos</p>
          </div>
          <p className="text-xl font-bold text-black">{totalCompromisos}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Vencidos</p>
          </div>
          <p className="text-xl font-bold text-red-600">{vencidos}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-amber-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Por vencer (3d)</p>
          </div>
          <p className="text-xl font-bold text-amber-600">{proximosVencer}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-gray-400" />
            <p className="text-[10px] text-gray-500 uppercase font-medium">Monto Total</p>
          </div>
          <p className="text-lg font-bold text-gray-800">S/ {fmt(montoComprometido)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: "todos", label: "Todos", count: totalCompromisos },
          { key: "vencidos", label: "Vencidos", count: vencidos },
          { key: "proximos", label: "Por vencer", count: proximosVencer },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === key
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                filtro === key ? "bg-white/30 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de compromisos */}
      <div className="space-y-3">
        {filtrados.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-300" />
            <p className="text-gray-400">No hay compromisos {filtro !== "todos" ? "en esta categoría" : "activos"}</p>
          </div>
        ) : (
          filtrados.map((c) => {
            const monto = Number(c.monto_total_pen ?? c.monto_total ?? 0);
            return (
              <div
                key={c.id}
                className={`bg-white border rounded-xl shadow-sm p-4 ${
                  c.vencido ? "border-red-200 bg-red-50/30"
                  : c.proximoVencer ? "border-amber-200 bg-amber-50/20"
                  : "border-gray-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Indicador */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    c.vencido ? "bg-red-100" : c.proximoVencer ? "bg-amber-100" : "bg-gray-50"
                  }`}>
                    {c.vencido ? (
                      <AlertTriangle size={18} className="text-red-600" />
                    ) : c.proximoVencer ? (
                      <Clock size={18} className="text-amber-600" />
                    ) : (
                      <Calendar size={18} className="text-gray-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">
                        {c.proveedor_cliente_nombre || "Sin proveedor"}
                      </span>
                      {c.vencido && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">
                          Vencido hace {Math.abs(c.diasRestantes)}d
                        </span>
                      )}
                      {c.proximoVencer && !c.vencido && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">
                          Vence en {c.diasRestantes}d
                        </span>
                      )}
                      {!c.vencido && !c.proximoVencer && c.diasRestantes != null && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600">
                          En {c.diasRestantes}d
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="font-medium">Compromiso:</span> {c.compromiso_fecha}
                      {c.compromiso_nota && <span className="ml-2 italic">"{c.compromiso_nota}"</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.categoriaNombre || "Sin categoría"} · {c.area || "—"}
                      {c.documento_tipo && ` · ${c.documento_tipo} ${c.documento_numero || ""}`}
                      {c.mesa_decision && (
                        <span className="ml-2 text-gray-600">Mesa: {c.mesa_decision}</span>
                      )}
                    </p>
                  </div>

                  {/* Monto */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-800">
                      {(c.moneda || "PEN") === "USD" ? "US$ " : "S/ "}{fmt(monto)}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => marcarCumplido(c.id)}
                      disabled={procesando === c.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      title="Marcar como cumplido"
                    >
                      <CheckCircle size={12} /> Cumplido
                    </button>
                    <button
                      onClick={() => marcarIncumplido(c.id)}
                      disabled={procesando === c.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-[11px] font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      title="Marcar como incumplido"
                    >
                      <XCircle size={12} /> Incumplido
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Los compromisos se crean en la Mesa de Pagos. Un compromiso vencido incrementa el score de prioridad del pago.
      </p>
    </div>
  );
}
