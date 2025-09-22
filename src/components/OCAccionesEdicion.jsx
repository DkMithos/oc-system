// src/components/OCAccionesEdicion.jsx
import React, { useEffect, useState } from "react";
import SolicitarEdicionModal from "./SolicitarEdicionModal";
import { listarSolicitudesEdicion, resolverSolicitudEdicion } from "../firebase/solicitudesHelpers";
import { useUsuario } from "../context/UsuarioContext";
import { isApprovalRole } from "../utils/aprobaciones";

const OCAccionesEdicion = ({ oc, onRefetch }) => {
  const { usuario } = useUsuario();
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

  const aprobar = async (s) => {
    if (!confirm("¿Aprobar solicitud de edición?")) return;
    await resolverSolicitudEdicion(oc.id, s.id, "aprobada", {
      resueltoPorEmail: usuario.email,
      resueltoPorNombre: usuario.nombre || usuario.email,
      observacion: "",
    });
    await recargar();
    onRefetch && onRefetch();
  };

  const rechazar = async (s) => {
    const obs = prompt("Motivo de rechazo (opcional):") || "";
    await resolverSolicitudEdicion(oc.id, s.id, "rechazada", {
      resueltoPorEmail: usuario.email,
      resueltoPorNombre: usuario.nombre || usuario.email,
      observacion: obs,
    });
    await recargar();
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
          <span className="text-sm px-2 py-1 rounded-full bg-green-100 text-green-700">
            Edición habilitada ✔
          </span>
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
              <div className="flex gap-2">
                <button className="px-2 py-1 text-white bg-green-600 rounded" onClick={() => aprobar(s)}>
                  Aprobar
                </button>
                <button className="px-2 py-1 text-white bg-red-600 rounded" onClick={() => rechazar(s)}>
                  Rechazar
                </button>
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
