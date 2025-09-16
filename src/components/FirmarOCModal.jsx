// ✅ src/components/FirmarOCModal.jsx
import React, { useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { actualizarOC, registrarLog } from "../firebase/firestoreHelpers";
import { obtenerFirmaGuardada } from "../firebase/firmasHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { getFunctions, httpsCallable } from "firebase/functions";

// Shell del modal – z-index alto para ir sobre topbar/footer
const ModalShell = ({ children, onClose, title }) => (
  <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-2">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <button
          onClick={onClose}
          className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200"
        >
          Cerrar
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FirmarOCModal = ({ oc, onClose }) => {
  const { usuario } = useUsuario();
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Cálculo de totales (solo informativo)
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

  // Cloud Function opcional para notificar por rol
  const notifyRole = async (toRole, titulo, cuerpo, ocId) => {
    try {
      const functions = getFunctions();
      const enviarNotificacionRol = httpsCallable(functions, "enviarNotificacionRol");
      await enviarNotificacionRol({
        toRole,
        payload: {
          title: titulo,
          body: cuerpo,
          ocId,
        },
      });
    } catch (e) {
      // No romper la UX si no existe la función
      console.warn("[Notificación] No se pudo enviar notificación:", e?.message || e);
    }
  };

  const aprobarYFirmar = async () => {
    if (!usuario) return;

    setEnviando(true);
    try {
      let campoFirma = "";
      let nuevoEstado = oc.estado;
      let siguienteRolNotificar = null;

      if (
        usuario.rol === "comprador" &&
        oc.estado === "Pendiente de Firma del Comprador"
      ) {
        if (oc.firmaComprador) {
          alert("Ya firmaste como comprador.");
          setEnviando(false);
          return;
        }
        campoFirma = "firmaComprador";
        // Flujo → pasa a Operaciones
        nuevoEstado = "Pendiente de Operaciones";
        siguienteRolNotificar = "operaciones";
      } else if (
        usuario.rol === "operaciones" &&
        oc.estado === "Pendiente de Operaciones"
      ) {
        if (oc.firmaOperaciones) {
          alert("Ya firmaste como operaciones.");
          setEnviando(false);
          return;
        }
        campoFirma = "firmaOperaciones";
        // Si tu negocio requiere tope por monto para Gerencia, ajusta aquí
        nuevoEstado = "Aprobado por Operaciones";
        siguienteRolNotificar = "gerencia";
      } else if (
        usuario.rol === "gerencia" &&
        oc.estado === "Aprobado por Operaciones"
      ) {
        if (oc.firmaGerencia) {
          alert("Ya firmaste como gerencia.");
          setEnviando(false);
          return;
        }
        campoFirma = "firmaGerencia";
        nuevoEstado = "Aprobado por Gerencia";
        // Notificar a finanzas o al creador, según tu flujo
        siguienteRolNotificar = "finanzas";
      } else {
        alert("No puedes firmar esta orden en su estado actual.");
        setEnviando(false);
        return;
      }

      // Firma guardada del usuario
      const firma = await obtenerFirmaGuardada(usuario.email);
      if (!firma) {
        alert("No tienes una firma guardada. Regístrala primero en la pantalla de firma.");
        setEnviando(false);
        return;
      }

      // Actualizar OC
      const nueva = {
        ...oc,
        [campoFirma]: firma,
        estado: nuevoEstado,
        historial: [
          ...(oc.historial || []),
          {
            accion: "Aprobación",
            por: usuario.email,
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      };

      await actualizarOC(oc.id, nueva);
      await registrarLog({
        accion: "Firma OC",
        ocId: oc.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `OC ${oc.numeroOC} aprobada. Total ${formatearMoneda(total, simbolo)}.`,
      });

      // Notificar siguiente rol (si corresponde)
      if (siguienteRolNotificar) {
        await notifyRole(
          siguienteRolNotificar,
          `OC ${nueva.numeroOC} lista`,
          `La OC pasó a estado: ${nueva.estado}`,
          nueva.id
        );
      }

      // Avisar a toda la app y cerrar
      try {
        window.dispatchEvent(new CustomEvent("oc-updated", { detail: { oc: nueva } }));
      } catch {}
      alert("Orden aprobada y firmada ✅");
      onClose?.();
    } catch (e) {
      console.error(e);
      alert("No se pudo aprobar la orden.");
    } finally {
      setEnviando(false);
    }
  };

  const rechazar = async () => {
    if (!usuario) return;
    if (!motivoRechazo.trim()) {
      alert("Indica un motivo de rechazo.");
      return;
    }
    setEnviando(true);
    try {
      const nueva = {
        ...oc,
        estado: "Rechazado",
        motivoRechazo: motivoRechazo.trim(),
        historial: [
          ...(oc.historial || []),
          {
            accion: "Rechazo",
            por: usuario.email,
            fecha: new Date().toLocaleString("es-PE"),
            motivo: motivoRechazo.trim(),
          },
        ],
      };

      await actualizarOC(oc.id, nueva);
      await registrarLog({
        accion: "Rechazo OC",
        ocId: oc.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `OC ${oc.numeroOC} rechazada. Motivo: ${motivoRechazo}`,
      });

      // Notificar a quien creó la OC / comprador
      await notifyRole(
        "comprador",
        `OC ${nueva.numeroOC} rechazada`,
        `Motivo: ${motivoRechazo.trim()}`,
        nueva.id
      );

      try {
        window.dispatchEvent(new CustomEvent("oc-updated", { detail: { oc: nueva } }));
      } catch {}
      alert("Orden rechazada.");
      onClose?.();
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
          <label className="block text-gray-700 mb-1">
            Motivo de rechazo (si corresponde)
          </label>
          <textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="Describe brevemente el motivo…"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          {/* Primero Aprobar y Firmar (izquierda) */}
          <button
            disabled={enviando}
            onClick={aprobarYFirmar}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-60"
            title="Aprobar y firmar OC"
          >
            Aprobar y firmar
          </button>

          {/* A la derecha Rechazar */}
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
