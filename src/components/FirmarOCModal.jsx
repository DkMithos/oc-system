// ✅ src/components/FirmarOCModal.jsx
import React, { useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import {
  actualizarOC,
  obtenerFirmaUsuario,
  registrarLog,
} from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";

const ModalShell = ({ children, onClose, title }) => (
  <div className="fixed inset-0 bg-black/40 z-[1100] flex items-center justify-center p-2">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <button onClick={onClose} className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200">Cerrar</button>
      </div>
      {children}
    </div>
  </div>
);

const FirmarOCModal = ({ oc, onClose }) => {
  const { usuario } = useUsuario();
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const simbolo = oc.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles";
  const subtotal = (oc.items || []).reduce(
    (acc, it) =>
      acc +
      (Number(it.precioUnitario) - Number(it.descuento || 0)) *
        Number(it.cantidad || 0),
    0
  );
  const igv = subtotal * 0.18;
  const otros = Number(oc?.resumen?.otros || 0);
  const total = subtotal + igv + otros;

  const aprobarYFirmar = async () => {
    if (!usuario) return;
    setEnviando(true);
    try {
      const firma = await obtenerFirmaUsuario(usuario.email);
      const nueva = { ...oc };

      if (usuario.rol === "operaciones" && oc.estado === "Pendiente de Operaciones") {
        nueva.firmaOperaciones = firma || nueva.firmaOperaciones || null;
        nueva.estado = "Aprobado por Operaciones";
        (nueva.historial ||= []).push({
          accion: "Aprobación Operaciones",
          por: usuario.email,
          fecha: new Date().toLocaleString("es-PE"),
        });
      } else if (usuario.rol === "gerencia" && oc.estado === "Aprobado por Operaciones") {
        nueva.firmaGerencia = firma || nueva.firmaGerencia || null;
        nueva.estado = "Aprobado por Gerencia";
        (nueva.historial ||= []).push({
          accion: "Aprobación Gerencia",
          por: usuario.email,
          fecha: new Date().toLocaleString("es-PE"),
        });
      } else {
        alert("No puedes firmar esta orden en su estado actual.");
        setEnviando(false);
        return;
      }

      await actualizarOC(oc.id, nueva);
      await registrarLog({
        accion: "Firma OC",
        ocId: oc.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `OC ${oc.numeroOC} aprobada. Total ${formatearMoneda(total, simbolo)}.`,
      });

      alert("Orden aprobada y firmada ✅");
      onClose();
      // No se recarga la tabla para preservar filtros:
      // El usuario puede cerrar el modal y seguir con su listado filtrado.
    } catch (e) {
      console.error(e);
      alert("No se pudo aprobar la orden.");
    } finally {
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    if (!motivoRechazo.trim()) {
      alert("Indica un motivo de rechazo.");
      return;
    }
    if (!usuario) return;
    setEnviando(true);
    try {
      const nueva = { ...oc };
      nueva.estado = "Rechazado";
      (nueva.historial ||= []).push({
        accion: "Rechazo",
        por: usuario.email,
        fecha: new Date().toLocaleString("es-PE"),
        motivo: motivoRechazo.trim(),
      });

      await actualizarOC(oc.id, nueva);
      await registrarLog({
        accion: "Rechazo OC",
        ocId: oc.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `OC ${oc.numeroOC} rechazada. Motivo: ${motivoRechazo}`,
      });

      alert("Orden rechazada.");
      onClose();
    } catch (e) {
      console.error(e);
      alert("No se pudo rechazar la orden.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ModalShell title="Aprobar / Rechazar OC" onClose={onClose}>
      <div className="p-4 text-sm">
        <div className="mb-3">
          <div><b>OC:</b> {oc.numeroOC}</div>
          <div><b>Proveedor:</b> {oc.proveedor?.razonSocial}</div>
          <div><b>Total:</b> {formatearMoneda(total, simbolo)}</div>
          <div><b>Moneda:</b> {oc.monedaSeleccionada}</div>
          <div><b>Estado actual:</b> {oc.estado}</div>
        </div>

        <div className="border-t pt-3">
          <label className="block text-gray-700 mb-1">Motivo de rechazo (si corresponde)</label>
          <textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Describe brevemente el motivo…"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            disabled={enviando}
            onClick={aprobarYFirmar}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-60"
            title="Aprobar y firmar OC"
          >
            Aprobar y firmar
          </button>
          <button
            disabled={enviando}
            onClick={rechazar}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-60"
            title="Rechazar OC"
          >
            Rechazar
          </button>

        </div>
      </div>
    </ModalShell>
  );
};

export default FirmarOCModal;
