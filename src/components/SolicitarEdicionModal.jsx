// src/components/SolicitarEdicionModal.jsx
import React, { useState } from "react";
import { crearSolicitudEdicion } from "../firebase/solicitudesHelpers";
import { useUsuario } from "../context/UsuarioContext";

const SolicitarEdicionModal = ({ oc, onClose, onSubmitted }) => {
  const { usuario } = useUsuario();
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const handleSubmit = async () => {
    if (!motivo.trim()) return alert("Describe el motivo de la edición.");
    try {
      setGuardando(true);
      await crearSolicitudEdicion(oc.id, {
        motivo,
        numeroOC: oc.numeroOC || oc.numero || "",
        creadoPorEmail: usuario.email,
        creadoPorNombre: usuario.nombre || usuario.email,
      });
      setGuardando(false);
      onSubmitted && onSubmitted();
      onClose();
      alert("Solicitud enviada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo enviar la solicitud.");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
        <h3 className="text-lg font-bold mb-2">Solicitar edición</h3>
        <p className="text-sm text-gray-600 mb-3">
          OC: <b>{oc.numeroOC || oc.numero || oc.id}</b>
        </p>
        <textarea
          className="w-full border rounded p-2 h-28"
          placeholder="Describe el motivo por el cual necesitas editar la orden…"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button className="px-3 py-1.5 rounded border" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            className="px-3 py-1.5 rounded bg-[#004990] text-white disabled:opacity-50"
            onClick={handleSubmit}
            disabled={guardando}
          >
            {guardando ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SolicitarEdicionModal;
