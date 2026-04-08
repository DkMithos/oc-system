// src/components/FirmarLoteModal.jsx
// Modal para aprobar o rechazar múltiples OCs a la vez.
import React, { useEffect, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import { actualizarOC, registrarLog } from "../firebase/firestoreHelpers";
import { obtenerFirmaGuardada } from "../firebase/firmasHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { getFunctions, httpsCallable } from "firebase/functions";
import { siguienteEstado } from "../utils/aprobaciones";

// [SEGURIDAD-MEDIA-06] Usar los estados de aprobaciones.js como fuente única de verdad.
// Elimina divergencia con "Pendiente de Gerencia Operaciones" que no existe en el flujo.
const FIRMA_KEYS_BY_ROL = {
  operaciones:          { firmaKey: "firmaOperaciones",         firmasKey: "operaciones" },
  "gerencia operaciones": { firmaKey: "firmaGerenciaOperaciones", firmasKey: "gerenciaOperaciones" },
  "gerencia general":   { firmaKey: "firmaGerenciaGeneral",    firmasKey: "gerenciaGeneral" },
  gerencia:             { firmaKey: "firmaGerenciaGeneral",    firmasKey: "gerenciaGeneral" },
};

const ESTADO_PUEDO_FIRMAR = {
  operaciones:          ["Pendiente de Operaciones"],
  "gerencia operaciones": ["Pendiente de Operaciones", "Pendiente de Gerencia General"],
  "gerencia general":   ["Pendiente de Gerencia General"],
  gerencia:             ["Pendiente de Gerencia General"],
};

const NOTIF_POR_ESTADO = {
  "Pendiente de Operaciones":      "operaciones",
  "Pendiente de Gerencia General": "gerencia general",
  "Aprobada":                       null,
};

const estadoSiguiente = (oc, rol) => {
  const estadosFirmables = ESTADO_PUEDO_FIRMAR[rol] || [];
  if (!estadosFirmables.includes(oc.estado)) return null;

  const monto = oc.resumen?.total || 0;
  const moneda = oc.monedaSeleccionada || "Soles";
  const siguiente = siguienteEstado(oc.estado, monto, moneda, null);
  const keys = FIRMA_KEYS_BY_ROL[rol] || null;
  if (!keys) return null;

  return {
    siguiente,
    notifRol: NOTIF_POR_ESTADO[siguiente] ?? null,
    ...keys,
  };
};

const notifyRole = async (toRole, title, body, ocId) => {
  try {
    const fn = httpsCallable(getFunctions(undefined, "us-central1"), "enviarNotificacionRol");
    await fn({ toRole, payload: { title, body, ocId } });
  } catch {}
};

const FirmarLoteModal = ({ ocs, onClose, onDone }) => {
  const { usuario } = useUsuario();
  const [miFirma, setMiFirma] = useState(null);
  const [cargandoFirma, setCargandoFirma] = useState(true);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const rol = String(usuario?.rol || "").toLowerCase();
  const ocsFirmables = ocs.filter((oc) => !!estadoSiguiente(oc, rol));

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

  const procesarTodas = async (accion) => {
    if (!usuario) return;
    if (accion === "rechazar" && !motivoRechazo.trim()) {
      alert("Indica un motivo de rechazo.");
      return;
    }
    if (accion === "aprobar" && !miFirma) {
      const ir = confirm("No tienes una firma registrada. ¿Ir a 'Mi Firma' para configurarla?");
      if (ir) window.location.href = "/mi-firma";
      return;
    }

    setProcesando(true);
    const res = [];

    for (const oc of ocsFirmables) {
      try {
        let update;
        if (accion === "aprobar") {
          const meta = estadoSiguiente(oc, rol);
          update = {
            [meta.firmaKey]: miFirma,
            firmas: { ...(oc.firmas || {}), [meta.firmasKey]: miFirma },
            estado: meta.siguiente,
            historial: [
              ...(oc.historial || []),
              { accion: "Aprobación", por: usuario.email, fecha: new Date().toLocaleString("es-PE") },
            ],
          };
          await actualizarOC(oc.id, update);
          await registrarLog({
            accion: "Firma OC",
            ocId: oc.id,
            usuario: usuario.email,
            rol: usuario.rol,
            comentario: `OC ${oc.numeroOC} → ${meta.siguiente} (firma masiva)`,
          });
          if (meta.notifRol) {
            await notifyRole(meta.notifRol, `OC ${oc.numeroOC} lista`, `Pasó a: ${meta.siguiente}`, oc.id);
          }
        } else {
          update = {
            estado: "Rechazada",
            motivoRechazo: motivoRechazo.trim(),
            historial: [
              ...(oc.historial || []),
              { accion: "Rechazo", por: usuario.email, fecha: new Date().toLocaleString("es-PE"), motivo: motivoRechazo.trim() },
            ],
          };
          await actualizarOC(oc.id, update);
          await registrarLog({
            accion: "Rechazo OC",
            ocId: oc.id,
            usuario: usuario.email,
            rol: usuario.rol,
            comentario: `OC ${oc.numeroOC} rechazada en firma masiva. Motivo: ${motivoRechazo}`,
          });
        }

        const ocActualizada = { ...oc, ...update, firmas: { ...(oc.firmas || {}), ...(update.firmas || {}) } };
        try { window.dispatchEvent(new CustomEvent("oc-updated", { detail: { oc: ocActualizada } })); } catch {}
        res.push({ oc: ocActualizada, ok: true });
      } catch (e) {
        console.error(e);
        res.push({ oc, ok: false, error: e?.message });
      }
    }

    setResultados(res);
    setProcesando(false);
    onDone?.(res.filter((r) => r.ok).map((r) => r.oc));
  };

  if (resultados) {
    const ok = resultados.filter((r) => r.ok).length;
    const fail = resultados.filter((r) => !r.ok).length;
    return (
      <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-3">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
          <h3 className="text-lg font-bold mb-3 text-[#004990]">Firma masiva completada</h3>
          <p className="text-green-700 font-semibold">{ok} orden{ok !== 1 ? "es" : ""} procesada{ok !== 1 ? "s" : ""} correctamente ✅</p>
          {fail > 0 && <p className="text-red-600 mt-1">{fail} con error ❌</p>}
          <ul className="mt-3 text-sm space-y-1 max-h-48 overflow-y-auto">
            {resultados.map(({ oc, ok, error }) => (
              <li key={oc.id} className="flex items-center gap-2">
                <span className={ok ? "text-green-600" : "text-red-500"}>{ok ? "✅" : "❌"}</span>
                <span className="font-mono">{oc.numeroOC}</span>
                {!ok && <span className="text-gray-500 text-xs">{error}</span>}
              </li>
            ))}
          </ul>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-[#004990] text-white py-2 rounded-lg font-semibold hover:bg-[#003570]"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-lg text-[#004990]">Firma masiva ({ocsFirmables.length} órdenes)</h3>
          <button onClick={onClose} className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 font-medium">
            Cancelar
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <b>Tu firma:</b>{" "}
            {cargandoFirma ? "cargando…" : miFirma ? "lista ✅" : (
              <span className="text-red-600">
                no registrada ❌{" "}
                <button className="text-blue-700 underline ml-1" onClick={() => (window.location.href = "/mi-firma")}>
                  Configurar
                </button>
              </span>
            )}
          </div>

          <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
            {ocsFirmables.map((oc) => {
              const simbolo = oc.monedaSeleccionada === "Dólares" ? "Dólares" : "Soles";
              const total = (oc.resumen?.total != null)
                ? Number(oc.resumen.total)
                : (oc.items || []).reduce((acc, it) =>
                    acc + (Number(it.cantidad || 0) * Number(it.precioUnitario || 0) - Number(it.descuento || 0)), 0) * 1.18;
              return (
                <div key={oc.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-[#004990]">{oc.numeroOC}</span>
                    <span className="text-gray-500 ml-2 text-xs">{oc.proveedor?.razonSocial || "—"}</span>
                  </div>
                  <span className="font-semibold text-right whitespace-nowrap">{formatearMoneda(total, simbolo)}</span>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de rechazo (solo si va a rechazar)
            </label>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm resize-none"
              rows={2}
              placeholder="Describe el motivo…"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              disabled={procesando || cargandoFirma}
              onClick={() => procesarTodas("aprobar")}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {procesando ? "Procesando…" : `Aprobar ${ocsFirmables.length} órdenes`}
            </button>
            <button
              disabled={procesando}
              onClick={() => procesarTodas("rechazar")}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              Rechazar todas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirmarLoteModal;
