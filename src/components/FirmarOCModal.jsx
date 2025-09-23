// ✅ src/components/FirmarOCModal.jsx
import React, { useEffect, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { actualizarOC, registrarLog } from "../firebase/firestoreHelpers";
import { obtenerFirmaGuardada } from "../firebase/firmasHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { getFunctions, httpsCallable } from "firebase/functions";

const ModalShell = ({ children, onClose, title }) => (
  <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-2">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-xl">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <button onClick={onClose} className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200">
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
  const [miFirma, setMiFirma] = useState(null);
  const [cargandoFirma, setCargandoFirma] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!usuario?.email) return;
      setCargandoFirma(true);
      const f = await obtenerFirmaGuardada(usuario.email);
      if (!alive) return;
      setMiFirma(f || null);
      setCargandoFirma(false);
    })();
    return () => { alive = false; };
  }, [usuario?.email]);

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

  const notifyRole = async (toRole, title, body, ocId) => {
    try {
      const functions = getFunctions(undefined, "us-central1");
      const enviar = httpsCallable(functions, "enviarNotificacionRol");
      await enviar({ toRole, payload: { title, body, ocId } });
    } catch (e) {
      console.warn("[Notificación] No se pudo enviar:", e?.message || e);
    }
  };

  const aprobarYFirmar = async () => {
    if (!usuario) return;

    setEnviando(true);
    try {
      const rol = String(usuario.rol || "").toLowerCase();

      let setFirma = {};
      let nuevoEstado = oc.estado;
      let siguienteRolNotificar = null;

      if (rol === "operaciones" && oc.estado === "Pendiente de Operaciones") {
        if (oc.firmaOperaciones || oc?.firmas?.operaciones) {
          alert("Ya firmaste como Operaciones.");
          setEnviando(false);
          return;
        }
        setFirma = {
          firmaOperaciones: miFirma,
          firmas: { ...(oc.firmas || {}), operaciones: miFirma },
        };
        nuevoEstado = "Pendiente de Gerencia Operaciones";
        siguienteRolNotificar = "gerencia operaciones";
      } else if (
        (rol === "gerencia operaciones" || rol === "gerencia") &&
        oc.estado === "Pendiente de Gerencia Operaciones"
      ) {
        if (oc.firmaGerenciaOperaciones || oc?.firmas?.gerenciaOperaciones) {
          alert("Ya firmaste como Gerencia Operaciones.");
          setEnviando(false);
          return;
        }
        setFirma = {
          firmaGerenciaOperaciones: miFirma,
          firmas: { ...(oc.firmas || {}), gerenciaOperaciones: miFirma },
        };
        nuevoEstado = "Pendiente de Gerencia General";
        siguienteRolNotificar = "gerencia general";
      } else if (
        rol === "gerencia general" &&
        oc.estado === "Pendiente de Gerencia General"
      ) {
        if (oc.firmaGerenciaGeneral || oc?.firmas?.gerenciaGeneral) {
          alert("Ya firmaste como Gerencia General.");
          setEnviando(false);
          return;
        }
        setFirma = {
          firmaGerenciaGeneral: miFirma,
          firmas: { ...(oc.firmas || {}), gerenciaGeneral: miFirma },
        };
        nuevoEstado = "Aprobado";
      } else {
        alert("No puedes firmar esta orden en su estado actual.");
        setEnviando(false);
        return;
      }

      if (!miFirma) {
        const ir = confirm("No tienes una firma registrada. ¿Ir a 'Mi Firma' para configurarla?");
        if (ir) window.location.href = "/mi-firma";
        setEnviando(false);
        return;
      }

      const update = {
        ...setFirma,
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

      await actualizarOC(oc.id, update);
      await registrarLog({
        accion: "Firma OC",
        ocId: oc.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `OC ${oc.numeroOC} → ${nuevoEstado}. Total ${formatearMoneda(
          total,
          simbolo
        )}.`,
      });

      if (siguienteRolNotificar) {
        await notifyRole(
          siguienteRolNotificar,
          `OC ${oc.numeroOC} lista`,
          `La OC pasó a: ${nuevoEstado}`,
          oc.id
        );
      }

      try {
        window.dispatchEvent(
          new CustomEvent("oc-updated", {
            detail: { oc: { ...oc, ...update, firmas: { ...(oc.firmas || {}), ...(update.firmas || {}) } } },
          })
        );
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
      const update = {
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
      await actualizarOC(oc.id, update);
      await registrarLog({
        accion: "Rechazo OC",
        ocId: oc.id,
        usuario: usuario?.email,
        rol: usuario?.rol,
        comentario: `OC ${oc.numeroOC} rechazada. Motivo: ${motivoRechazo}`,
      });

      try {
        window.dispatchEvent(new CustomEvent("oc-updated", { detail: { oc: { ...oc, ...update } } }));
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
          <div><b>Total:</b> {formatearMoneda(subtotal + igv + otros, simbolo)}</div>
          <div><b>Moneda:</b> {oc.monedaSeleccionada}</div>
          <div><b>Estado actual:</b> {oc.estado}</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
          <b>Tu firma:</b>{" "}
          {cargandoFirma ? "cargando…" : miFirma ? "lista ✅" : "no registrada ❌"}
          {!cargandoFirma && !miFirma && (
            <button className="ml-2 text-blue-700 underline" onClick={() => (window.location.href = "/mi-firma")}>
              Configurar ahora
            </button>
          )}
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
          >
            Aprobar y firmar
          </button>
          <button
            disabled={enviando}
            onClick={rechazar}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-60"
          >
            Rechazar
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default FirmarOCModal;
