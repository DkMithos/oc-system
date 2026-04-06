// src/components/FirmarOCModal.jsx
import React, { useEffect, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { actualizarOC, registrarLog } from "../firebase/firestoreHelpers";
import { obtenerFirmaGuardada } from "../firebase/firmasHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import {
  siguienteEstado,
  puedeAprobarEnEstado,
  obtenerConfigAprobaciones,
} from "../utils/aprobaciones";
import { getFunctions, httpsCallable } from "firebase/functions";

// Mapa: estado → key de firma en el objeto firmas
const FIRMA_KEY = {
  "Pendiente de Comprador":        "comprador",
  "Pendiente de Operaciones":      "operaciones",
  "Pendiente de Gerencia General": "gerenciaGeneral",
};

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

const FirmarOCModal = ({ oc, onClose, onSigned }) => {
  const { usuario } = useUsuario();
  const [motivoRechazo, setMotivoRechazo]   = useState("");
  const [enviando, setEnviando]             = useState(false);
  const [miFirma, setMiFirma]               = useState(null);
  const [cargandoFirma, setCargandoFirma]   = useState(true);
  const [config, setConfig]                 = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [firma, cfg] = await Promise.all([
        usuario?.email ? obtenerFirmaGuardada(usuario.email) : Promise.resolve(null),
        obtenerConfigAprobaciones(),
      ]);
      if (!alive) return;
      setMiFirma(firma || null);
      setConfig(cfg);
      setCargandoFirma(false);
    })();
    return () => { alive = false; };
  }, [usuario?.email]);

  // ── Totales desde resumen guardado (no recalcular) ───────────────────────
  const simbolo  = oc.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles";
  const subtotal = oc.resumen?.subtotal ?? (oc.items || []).reduce(
    (acc, it) => acc + (Number(it.precioUnitario || 0) - Number(it.descuento || 0)) * Number(it.cantidad || 0),
    0
  );
  const igv   = oc.resumen?.igv   ?? subtotal * 0.18;
  const otros = Number(oc.resumen?.otros || 0);
  const total = oc.resumen?.total ?? (subtotal + igv + otros);

  // ── Notificación al siguiente rol ────────────────────────────────────────
  const notifyRole = async (toRole, title, body, ocId) => {
    try {
      const fn = httpsCallable(getFunctions(undefined, "us-central1"), "enviarNotificacionRol");
      await fn({ toRole, payload: { title, body, ocId } });
    } catch (e) {
      console.warn("[Notificación] No se pudo enviar:", e?.message || e);
    }
  };

  // ── Validar si el usuario puede actuar en este estado ───────────────────
  const puedeActuar = usuario && puedeAprobarEnEstado(oc.estado, usuario.rol);
  const firmaKey    = FIRMA_KEY[oc.estado];

  // ── Aprobar ──────────────────────────────────────────────────────────────
  const aprobarYFirmar = async () => {
    if (!usuario || !puedeActuar) {
      alert("No puedes firmar esta orden en su estado actual.");
      return;
    }
    if (!miFirma) {
      const ir = confirm("No tienes firma registrada. ¿Ir a 'Mi Firma' ahora?");
      if (ir) window.location.href = "/mi-firma";
      return;
    }

    // Detectar doble firma
    const yaFirmo =
      (firmaKey && oc?.firmas?.[firmaKey]) ||
      (oc.estado === "Pendiente de Operaciones"      && oc.firmaOperaciones) ||
      (oc.estado === "Pendiente de Gerencia General" && oc.firmaGerenciaGeneral);

    if (yaFirmo) {
      alert("Ya existe una firma para esta etapa.");
      return;
    }

    setEnviando(true);
    try {
      // Calcular siguiente estado usando aprobaciones.js como única fuente de verdad
      const montoTotal = total;
      const moneda     = oc.monedaSeleccionada || "Soles";
      const nuevoEstado = siguienteEstado(oc.estado, montoTotal, moneda, config);

      // Claves de firma compatibles con VerOC + FirmarOC
      const firmasUpdate = {
        ...(oc.firmas || {}),
        ...(firmaKey ? { [firmaKey]: miFirma } : {}),
      };
      // También mantener campos planos por compatibilidad con código existente
      const firmasPlanas = {};
      if (oc.estado === "Pendiente de Comprador")        firmasPlanas.firmaComprador        = miFirma;
      if (oc.estado === "Pendiente de Operaciones")      firmasPlanas.firmaOperaciones      = miFirma;
      if (oc.estado === "Pendiente de Gerencia General") firmasPlanas.firmaGerenciaGeneral  = miFirma;

      const update = {
        ...firmasPlanas,
        firmas: firmasUpdate,
        estado: nuevoEstado,
        permiteEdicion: false,
        historial: [
          ...(oc.historial || []),
          {
            accion: "Aprobación",
            por: usuario.email,
            rol: usuario.rol,
            estadoAnterior: oc.estado,
            estadoNuevo: nuevoEstado,
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      };

      await actualizarOC(oc.id, update);
      await registrarLog({
        accion: "firma_oc",
        ocId: oc.id,
        usuario: usuario.email,
        rol: usuario.rol,
        comentario: `OC ${oc.numeroOC || oc.id} → ${nuevoEstado}. Total ${formatearMoneda(total, simbolo)}.`,
      });

      // Notificar al siguiente rol si no está aprobada aún
      if (nuevoEstado !== "Aprobada") {
        const rolPorEstado = {
          "Pendiente de Operaciones":      "operaciones",
          "Pendiente de Gerencia General": "gerencia general",
        };
        const sigRol = rolPorEstado[nuevoEstado];
        if (sigRol) {
          await notifyRole(sigRol, `OC ${oc.numeroOC} lista para tu revisión`, `Estado: ${nuevoEstado}`, oc.id);
        }
      }

      const ocActualizada = {
        ...oc,
        ...update,
        firmas: { ...(oc.firmas || {}), ...firmasUpdate },
      };

      try {
        window.dispatchEvent(new CustomEvent("oc-updated", { detail: { oc: ocActualizada } }));
      } catch {}

      if (onSigned) onSigned(ocActualizada);
      alert(`Orden ${nuevoEstado === "Aprobada" ? "aprobada ✅" : "firmada y enviada a la siguiente etapa ✅"}`);
      onClose?.();
    } catch (e) {
      console.error(e);
      alert("No se pudo aprobar la orden.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Rechazar ─────────────────────────────────────────────────────────────
  const rechazar = async () => {
    if (!usuario) return;
    if (!motivoRechazo.trim()) {
      alert("Indica un motivo de rechazo.");
      return;
    }
    setEnviando(true);
    try {
      const update = {
        estado: "Rechazada",
        motivoRechazo: motivoRechazo.trim(),
        permiteEdicion: true,
        historial: [
          ...(oc.historial || []),
          {
            accion: "Rechazo",
            por: usuario.email,
            rol: usuario.rol,
            estadoAnterior: oc.estado,
            estadoNuevo: "Rechazada",
            motivo: motivoRechazo.trim(),
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      };
      await actualizarOC(oc.id, update);
      await registrarLog({
        accion: "rechazo_oc",
        ocId: oc.id,
        usuario: usuario.email,
        rol: usuario.rol,
        comentario: `OC ${oc.numeroOC || oc.id} rechazada. Motivo: ${motivoRechazo}`,
      });

      const ocActualizada = { ...oc, ...update };

      try {
        window.dispatchEvent(new CustomEvent("oc-updated", { detail: { oc: ocActualizada } }));
      } catch {}

      if (onSigned) onSigned(ocActualizada);
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
      <div className="p-4 text-sm space-y-3">
        {/* Resumen OC */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div><b>OC:</b> {oc.numeroOC || oc.id}</div>
          <div><b>Estado:</b> {oc.estado}</div>
          <div className="col-span-2"><b>Proveedor:</b> {oc.proveedor?.razonSocial || "—"}</div>
          <div><b>Moneda:</b> {simbolo}</div>
          <div><b>Total:</b> {formatearMoneda(total, simbolo)}</div>
        </div>

        {/* Estado de firma */}
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <b>Tu firma:</b>{" "}
          {cargandoFirma
            ? "cargando…"
            : miFirma ? "lista ✅" : "no registrada ❌"}
          {!cargandoFirma && !miFirma && (
            <button
              className="ml-2 text-blue-700 underline text-xs"
              onClick={() => (window.location.href = "/mi-firma")}
            >
              Configurar ahora
            </button>
          )}
        </div>

        {/* Aviso si no puede actuar */}
        {!puedeActuar && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 text-xs">
            Tu rol (<b>{usuario?.rol}</b>) no puede aprobar en el estado actual (<b>{oc.estado}</b>).
          </div>
        )}

        {/* Motivo de rechazo */}
        <div>
          <label className="block text-gray-700 mb-1 font-medium">Motivo de rechazo (si aplica)</label>
          <textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            className="w-full border rounded p-2 text-sm"
            placeholder="Describe brevemente el motivo…"
            rows={3}
          />
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-1 border-t">
          <button
            disabled={enviando || !puedeActuar}
            onClick={aprobarYFirmar}
            className="bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {enviando ? "Procesando…" : "Aprobar y firmar"}
          </button>
          <button
            disabled={enviando || !puedeActuar}
            onClick={rechazar}
            className="bg-red-600 text-white px-4 py-1.5 rounded hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            Rechazar
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default FirmarOCModal;
