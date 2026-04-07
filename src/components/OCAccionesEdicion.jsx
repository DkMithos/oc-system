// src/components/OCAccionesEdicion.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import SolicitarEdicionModal from "./SolicitarEdicionModal";
import { listarSolicitudesEdicion, resolverSolicitudEdicion } from "../firebase/solicitudesHelpers";
import { actualizarOC } from "../firebase/firestoreHelpers";
import { useUsuario } from "../context/UsuarioContext";
import { isApprovalRole } from "../utils/aprobaciones";

const OCAccionesEdicion = ({ oc, onRefetch }) => {
  const { usuario } = useUsuario();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [solicitudes, setSolicitudes] = useState([]);

  const rol = String(usuario?.rol || "").toLowerCase();
  const esComprador = rol === "comprador";
  const puedeAprobar = isApprovalRole(rol) && rol !== "comprador";

  const recargar = async () => {
    const list = await listarSolicitudesEdicion(oc.id);
    setSolicitudes(list);
  };

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oc.id]);

  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazandoId, setRechazandoId]   = useState(null);

  const aprobar = async (s) => {
    try {
      await resolverSolicitudEdicion(oc.id, s.id, "aprobada", {
        resueltoPorEmail: usuario.email,
        resueltoPorNombre: usuario.nombre || usuario.email,
        observacion: "",
      });
      // ✅ Habilitar edición en el documento OC
      await actualizarOC(oc.id, {
        permiteEdicion: true,
        tieneSolicitudEdicion: false,
        historial: [
          ...(oc.historial || []),
          {
            accion: "Solicitud de edición aprobada",
            por: usuario.email,
            rol: usuario.rol,
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      });
      toast.success("Solicitud aprobada — el comprador ya puede editar la orden ✅");
      await recargar();
      onRefetch && onRefetch({ permiteEdicion: true });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo aprobar la solicitud.");
    }
  };

  const rechazar = async (s) => {
    try {
      await resolverSolicitudEdicion(oc.id, s.id, "rechazada", {
        resueltoPorEmail: usuario.email,
        resueltoPorNombre: usuario.nombre || usuario.email,
        observacion: motivoRechazo.trim(),
      });
      await actualizarOC(oc.id, { tieneSolicitudEdicion: false }).catch(() => {});
      toast.info("Solicitud rechazada.");
      setRechazandoId(null);
      setMotivoRechazo("");
      await recargar();
      onRefetch && onRefetch();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo rechazar la solicitud.");
    }
  };

  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Solicitudes de edición</h4>

        {esComprador && !oc.permiteEdicion && (
          <button
            className="px-3 py-1.5 rounded bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => setModalOpen(true)}
          >
            Solicitar edición
          </button>
        )}

        {esComprador && oc.permiteEdicion && (
          <button
            onClick={() => navigate(`/editar?id=${oc.id}`)}
            className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 font-semibold text-sm"
          >
            ✏️ Editar orden
          </button>
        )}
      </div>

      {/* Listado breve */}
      <div className="mt-3 space-y-2">
        {solicitudes.length === 0 && <div className="text-sm text-gray-500">No hay solicitudes.</div>}
        {solicitudes.map((s) => (
          <div key={s.id} className="flex items-center justify-between bg-gray-50 border rounded p-2">
            <div>
              <div className="text-sm">
                <b>{s.estado?.toUpperCase()}</b> — {s.motivo || "Sin motivo"}
              </div>
              <div className="text-xs text-gray-500">
                {s.creadoPorNombre || s.creadoPorEmail} • {s.numeroOC || oc.numeroOC || oc.id}
              </div>
            </div>

            {puedeAprobar && s.estado === "pendiente" && (
              <div className="flex flex-col gap-1 items-end">
                {rechazandoId === s.id ? (
                  <div className="flex flex-col gap-1 w-48">
                    <input
                      type="text"
                      className="border rounded px-2 py-1 text-xs"
                      placeholder="Motivo (opcional)"
                      value={motivoRechazo}
                      onChange={(e) => setMotivoRechazo(e.target.value)}
                    />
                    <div className="flex gap-1">
                      <button className="flex-1 px-2 py-1 text-white bg-red-600 rounded text-xs" onClick={() => rechazar(s)}>
                        Confirmar
                      </button>
                      <button className="flex-1 px-2 py-1 bg-gray-100 rounded text-xs" onClick={() => { setRechazandoId(null); setMotivoRechazo(""); }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button className="px-2 py-1 text-white bg-green-600 rounded text-xs" onClick={() => aprobar(s)}>
                      Aprobar
                    </button>
                    <button className="px-2 py-1 text-white bg-red-600 rounded text-xs" onClick={() => setRechazandoId(s.id)}>
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && (
        <SolicitarEdicionModal
          oc={oc}
          onClose={() => setModalOpen(false)}
          onSubmitted={() => {
            recargar();
            onRefetch && onRefetch();
          }}
        />
      )}
    </div>
  );
};

export default OCAccionesEdicion;
