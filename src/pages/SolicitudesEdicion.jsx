// src/pages/SolicitudesEdicion.jsx
// [F-02] Módulo dedicado para aprobar/rechazar solicitudes de edición de OC.
// Permite a roles aprobadores gestionar todas las solicitudes sin abrir cada OC.

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listarSolicitudesPendientesGlobal, resolverSolicitudEdicion } from "../firebase/solicitudesHelpers";
import { actualizarOC, obtenerOCporId } from "../firebase/firestoreHelpers";
import { useUsuario } from "../context/UsuarioContext";
import { toast } from "react-toastify";
import { CheckCircle, XCircle, ExternalLink, RefreshCw, Clock } from "lucide-react";

const ESTADO_BADGE = {
  pendiente: "bg-amber-100 text-amber-700",
  aprobada:  "bg-green-100 text-green-700",
  rechazada: "bg-red-100 text-red-700",
};

const SolicitudesEdicion = () => {
  const { usuario } = useUsuario();
  const navigate = useNavigate();

  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [rechazandoId, setRechazandoId] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [procesando, setProcesando] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("pendiente");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await listarSolicitudesPendientesGlobal();
      setSolicitudes(data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aprobar = async (sol) => {
    setProcesando(sol.id);
    try {
      await resolverSolicitudEdicion(sol.ocId, sol.id, "aprobada", {
        resueltoPorEmail: usuario.email,
        resueltoPorNombre: usuario.nombre || usuario.email,
        observacion: "",
      });
      const oc = await obtenerOCporId(sol.ocId);
      await actualizarOC(sol.ocId, {
        permiteEdicion: true,
        tieneSolicitudEdicion: false,
        historial: [
          ...(oc?.historial || []),
          {
            accion: "Solicitud de edición aprobada",
            por: usuario.email,
            rol: usuario.rol,
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      });
      toast.success(`Solicitud aprobada — ${sol.numeroOC || sol.ocId} puede ser editada ✅`);
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo aprobar la solicitud.");
    } finally {
      setProcesando(null);
    }
  };

  const rechazar = async (sol) => {
    setProcesando(sol.id);
    try {
      await resolverSolicitudEdicion(sol.ocId, sol.id, "rechazada", {
        resueltoPorEmail: usuario.email,
        resueltoPorNombre: usuario.nombre || usuario.email,
        observacion: motivoRechazo.trim(),
      });
      await actualizarOC(sol.ocId, { tieneSolicitudEdicion: false }).catch(() => {});
      toast.info("Solicitud rechazada.");
      setRechazandoId(null);
      setMotivoRechazo("");
      await cargar();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo rechazar la solicitud.");
    } finally {
      setProcesando(null);
    }
  };

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente");
  const visibles = filtroEstado === "pendiente" ? pendientes : solicitudes;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-[#004990]">Solicitudes de Edición</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendientes.length} solicitud{pendientes.length !== 1 ? "es" : ""} pendiente{pendientes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={cargando}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "pendiente", label: "Pendientes" },
          { key: "todas",     label: "Todas" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltroEstado(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filtroEstado === key
                ? "bg-[#004990] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
            {key === "pendiente" && pendientes.length > 0 && (
              <span className="ml-1.5 bg-amber-400 text-[#004990] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendientes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="text-center py-16 text-gray-400">Cargando solicitudes…</div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No hay solicitudes pendientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map((sol) => (
            <div
              key={sol.id}
              className="bg-white border rounded-xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-start gap-4"
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-[#004990] text-base">
                    {sol.numeroOC || sol.ocId}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ESTADO_BADGE[sol.estado] || "bg-gray-100 text-gray-600"}`}>
                    {sol.estado}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-1">
                  <span className="font-medium">Motivo:</span> {sol.motivo || "Sin descripción"}
                </p>
                <p className="text-xs text-gray-400">
                  Solicitado por{" "}
                  <span className="font-medium text-gray-600">
                    {sol.creadoPorNombre || sol.creadoPorEmail}
                  </span>
                  {sol.creadoEn?.toDate && (
                    <> · {sol.creadoEn.toDate().toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</>
                  )}
                </p>
                {sol.observacion && (
                  <p className="text-xs text-gray-500 mt-1 italic">Observación: {sol.observacion}</p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/ver?id=${sol.ocId}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink size={12} />
                  Ver OC
                </button>

                {sol.estado === "pendiente" && (
                  <>
                    {rechazandoId === sol.id ? (
                      <div className="flex flex-col gap-1.5 w-48">
                        <input
                          type="text"
                          className="border rounded px-2 py-1.5 text-xs"
                          placeholder="Motivo del rechazo (opcional)"
                          value={motivoRechazo}
                          onChange={(e) => setMotivoRechazo(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <button
                            disabled={!!procesando}
                            className="flex-1 px-2 py-1.5 bg-red-600 text-white rounded text-xs disabled:opacity-50"
                            onClick={() => rechazar(sol)}
                          >
                            Confirmar
                          </button>
                          <button
                            className="flex-1 px-2 py-1.5 bg-gray-100 rounded text-xs"
                            onClick={() => { setRechazandoId(null); setMotivoRechazo(""); }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          disabled={!!procesando}
                          onClick={() => aprobar(sol)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={12} />
                          Aprobar
                        </button>
                        <button
                          disabled={!!procesando}
                          onClick={() => setRechazandoId(sol.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={12} />
                          Rechazar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SolicitudesEdicion;
