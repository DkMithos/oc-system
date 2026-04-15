// src/pages/FirmarOC.jsx
// Flujo de aprobación: Comprador firma al crear → Operaciones → (si >5k SOL) Gerencia General → Aprobada
// Umbrales configurables desde Admin (Firestore: configuracion/aprobaciones)

import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import {
  obtenerOCporId,
  actualizarOC,
  obtenerFirmaUsuario,
  guardarFirmaUsuario,
  registrarLog,
} from "../firebase/firestoreHelpers";
import { notificarUsuario } from "../firebase/notifs";
import { getTrimmedCanvas } from "../utils/trimCanvasFix";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";
import {
  obtenerConfigAprobaciones,
  siguienteEstado,
  UMBRALES_DEFAULT,
} from "../utils/aprobaciones";

// ─── Mapa: estado → roles que pueden aprobar ────────────────────
const ROL_POR_ESTADO = {
  "Pendiente de Comprador":          ["comprador", "admin"],
  "Pendiente de Operaciones":        ["operaciones", "admin"],
  "Pendiente de Gerencia General":   ["gerencia general", "gerencia", "admin"],
  // Estado residual (creado por versión anterior del sistema): el comprador
  // firma primero para reintegrar la OC al flujo normal → Pendiente de Operaciones.
  "Pendiente de Gerencia Operaciones": ["comprador", "operaciones", "gerencia operaciones", "gerencia general", "gerencia", "admin"],
};

// Estado → clave de firma en Firestore
const FIRMA_KEY = {
  "Pendiente de Comprador":            "comprador",
  "Pendiente de Operaciones":          "operaciones",
  "Pendiente de Gerencia General":     "gerenciaGeneral",
  "Pendiente de Gerencia Operaciones": "comprador",   // el comprador es quien falta firmar
};

// Estado residual → estado al que se mueve al aprobarse
// (reintegra la OC al flujo normal sin usar siguienteEstado())
const ESTADO_OVERRIDE_NEXT = {
  "Pendiente de Gerencia Operaciones": "Pendiente de Operaciones",
};

// Destinatario de notificación para el siguiente estado
const NOTIF_ROL_SIGUIENTE = {
  "Pendiente de Operaciones":      "__rol:operaciones",
  "Pendiente de Gerencia General": "__rol:gerencia general",
};

// Pasos del flujo (para el timeline visual)
const PASOS = [
  { label: "Comprador",       key: "comprador",      estado: "Pendiente de Comprador" },
  { label: "Operaciones",     key: "operaciones",    estado: "Pendiente de Operaciones" },
  { label: "Gerencia General",key: "gerenciaGeneral",estado: "Pendiente de Gerencia General", soloAltoMonto: true },
];

const puedeAprobar = (rol, estado) =>
  (ROL_POR_ESTADO[estado] || []).includes(String(rol || "").toLowerCase());

// ─── Componente ───────────────────────────────────────────────────
const FirmarOC = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const ocId       = new URLSearchParams(location.search).get("id");
  const { usuario, cargando } = useUsuario();

  const [orden,          setOrden]          = useState(null);
  const [loadingOC,      setLoadingOC]      = useState(true);
  const [firmaGuardada,  setFirmaGuardada]  = useState(null);
  const [procesando,     setProcesando]     = useState(false);
  const [error,          setError]          = useState("");
  const [rechazando,     setRechazando]     = useState(false);
  const [motivoRechazo,  setMotivoRechazo]  = useState("");
  const [configAprobaciones, setConfigAprobaciones] = useState(UMBRALES_DEFAULT);
  const sigPadRef = useRef(null);

  // ── Carga inicial ─────────────────────────────────────────────
  useEffect(() => {
    if (!ocId) { setLoadingOC(false); return; }
    (async () => {
      try {
        const [ocData, firma, config] = await Promise.all([
          obtenerOCporId(ocId),
          usuario?.email ? obtenerFirmaUsuario(usuario.email) : null,
          obtenerConfigAprobaciones(),
        ]);
        setOrden(ocData);
        setConfigAprobaciones(config || UMBRALES_DEFAULT);
        setFirmaGuardada(firma || null);

        if (firma && sigPadRef.current) {
          const image = new Image();
          image.src = firma;
          image.onload = () => {
            const canvas = sigPadRef.current?.getCanvas();
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          };
        }
      } catch (e) {
        setError(e.message || "No se pudo cargar la orden.");
      } finally {
        setLoadingOC(false);
      }
    })();
  }, [ocId, usuario?.email]);

  const monto        = orden?.resumen?.total ?? 0;
  const moneda       = orden?.monedaSeleccionada || "Soles";
  const estadoActual = orden?.estado || "";
  const habilitado   = !procesando && puedeAprobar(usuario?.rol, estadoActual);
  const yaFinalizada = ["Aprobada", "Rechazada"].includes(estadoActual);

  // Calcular si el monto supera el umbral (para mostrar el paso de GG)
  const tc     = configAprobaciones.tipoCambioDef || 3.8;
  const mSOL   = moneda === "Dólares" ? monto * tc : monto;
  const umbral = Number(configAprobaciones.soloOperaciones ?? 5000);
  const requiereGG = mSOL > umbral;

  // Pasos aplicables según monto
  const pasosAplicables = PASOS.filter(p => !p.soloAltoMonto || requiereGG);

  // ── Firmar ────────────────────────────────────────────────────
  const firmar = async () => {
    try {
      setError("");
      if (!usuario || !orden) return;
      if (!habilitado) {
        toast.warning("Tu rol no puede firmar esta orden en este momento.");
        return;
      }

      const camposFaltantes =
        !orden.fechaEmision ||
        !Array.isArray(orden.items) || orden.items.length === 0;
      if (camposFaltantes) {
        toast.error("Faltan datos obligatorios en la orden. No se puede firmar.");
        return;
      }

      let firmaFinal = firmaGuardada;
      if (!firmaFinal) {
        if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
          toast.warning("Por favor, firma en el recuadro antes de aprobar.");
          return;
        }
        const canvasRecortado = getTrimmedCanvas(sigPadRef.current.getCanvas());
        firmaFinal = canvasRecortado.toDataURL("image/png");
        await guardarFirmaUsuario(usuario.email, firmaFinal);
        setFirmaGuardada(firmaFinal);
      }

      setProcesando(true);

      const firmaKey     = FIRMA_KEY[estadoActual];
      const stamp        = { por: usuario.email, firma: firmaFinal, fecha: new Date().toISOString(), rol: usuario.rol };
      const nuevasFirmas = { ...(orden.firmas || {}), [firmaKey]: stamp };

      // Calcular siguiente estado:
      // - Si la OC está en un estado residual, usar el override predefinido
      // - Si no, usar aprobaciones.js como fuente de verdad única
      const nuevoEstado = ESTADO_OVERRIDE_NEXT[estadoActual]
        ?? siguienteEstado(estadoActual, monto, moneda, configAprobaciones);

      const historial = [
        ...(orden.historial || []),
        {
          accion: "Aprobado",
          por: usuario.email,
          rol: usuario.rol,
          estadoAnterior: estadoActual,
          estadoNuevo: nuevoEstado,
          fecha: new Date().toLocaleString("es-PE"),
        },
      ];

      await actualizarOC(orden.id, { firmas: nuevasFirmas, estado: nuevoEstado, historial });
      await registrarLog({
        accion: "orden_firmada",
        ocId: orden.id,
        usuario: usuario.email,
        rol: usuario.rol,
        estadoAnterior: estadoActual,
        estadoNuevo: nuevoEstado,
      });

      // Notificaciones
      if (nuevoEstado === "Aprobada") {
        notificarUsuario({
          email: orden.creadoPor || "",
          title: "OC Aprobada ✅",
          body: `La OC ${orden.numeroOC || orden.numero} ha sido completamente aprobada.`,
          ocId: orden.id,
        }).catch(() => {});
      } else {
        const dest = NOTIF_ROL_SIGUIENTE[nuevoEstado];
        if (dest) {
          notificarUsuario({
            email: dest,
            title: "OC pendiente de tu aprobación",
            body: `La OC ${orden.numeroOC || orden.numero} requiere tu revisión — ${nuevoEstado}.`,
            ocId: orden.id,
          }).catch(() => {});
        }
      }

      setOrden((o) => ({ ...o, firmas: nuevasFirmas, estado: nuevoEstado, historial }));
      toast.success(`Firma registrada. Estado: ${nuevoEstado}`);
      setTimeout(() => navigate(`/ver?id=${orden.id}`), 1500);
    } catch (e) {
      console.error(e);
      setError(e.message || "No se pudo firmar la orden.");
      toast.error("Error al registrar la firma.");
    } finally {
      setProcesando(false);
    }
  };

  // ── Rechazar ──────────────────────────────────────────────────
  const confirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      toast.warning("Ingresa el motivo del rechazo.");
      return;
    }
    try {
      setProcesando(true);
      const historial = [
        ...(orden.historial || []),
        {
          accion: "Rechazado",
          por: usuario.email,
          rol: usuario.rol,
          motivo: motivoRechazo,
          estadoAnterior: estadoActual,
          fecha: new Date().toLocaleString("es-PE"),
        },
      ];
      await actualizarOC(orden.id, {
        estado: "Rechazada",
        motivoRechazo,
        historial,
        permiteEdicion: true,
      });
      await registrarLog({
        accion: "orden_rechazada",
        ocId: orden.id,
        usuario: usuario.email,
        rol: usuario.rol,
        motivo: motivoRechazo,
      });

      notificarUsuario({
        email: orden.creadoPor || "",
        title: "OC Rechazada ❌",
        body: `La OC ${orden.numeroOC || orden.numero} fue rechazada. Motivo: ${motivoRechazo}`,
        ocId: orden.id,
      }).catch(() => {});

      toast.error("OC rechazada.");
      setTimeout(() => navigate(`/ver?id=${orden.id}`), 1500);
    } catch (e) {
      setError(e.message || "Error al rechazar.");
      toast.error("Error al rechazar la orden.");
    } finally {
      setProcesando(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────
  if (cargando || loadingOC) return <div className="p-6">Cargando datos...</div>;
  if (!usuario)  return <div className="p-6 text-red-600">No tienes permiso para acceder aquí.</div>;
  if (!orden)    return <div className="p-6 text-red-600">No se encontró la orden. {error}</div>;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="erp-card p-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <img src={Logo} alt="Logo" className="h-12" />
          <div className="text-right">
            <h2 className="text-xl font-bold text-[--brand-900]">Firmar Orden</h2>
            <p className="text-sm text-gray-500">N° {orden.numeroOC || orden.numero || orden.id}</p>
            <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              estadoActual === "Aprobada"  ? "bg-green-100 text-green-800" :
              estadoActual === "Rechazada" ? "bg-red-100 text-red-800" :
              "bg-amber-100 text-amber-800"
            }`}>
              {estadoActual}
            </span>
          </div>
        </div>

        {/* Datos de la OC */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-5 bg-gray-50 rounded-lg p-4">
          <div><span className="text-gray-500">Proveedor:</span> <b>{orden.proveedor?.razonSocial || "—"}</b></div>
          <div><span className="text-gray-500">Fecha:</span> <b>{orden.fechaEmision || "—"}</b></div>
          <div><span className="text-gray-500">Moneda:</span> <b>{moneda}</b></div>
          <div><span className="text-gray-500">Total:</span> <b>{moneda === "Dólares" ? "$ " : "S/ "}{monto.toFixed(2)}</b></div>
          {requiereGG && (
            <div className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              ⚠ Monto mayor a S/{umbral.toLocaleString("es-PE")} — requiere aprobación de Gerencia General
            </div>
          )}
        </div>

        {/* Timeline del flujo de firmas */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Flujo de Aprobación</p>
          <div className="flex items-start gap-0">
            {pasosAplicables.map((paso, idx) => {
              const firma = orden.firmas?.[paso.key];
              const esActual = estadoActual === paso.estado;
              const completado = !!firma;

              return (
                <div key={paso.key} className="flex items-center flex-1 min-w-0">
                  {/* Paso */}
                  <div className={`flex flex-col items-center flex-1 min-w-0 ${idx > 0 ? "" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      completado
                        ? "bg-green-500 text-white"
                        : esActual
                          ? "bg-amber-400 text-white ring-2 ring-amber-200"
                          : "bg-gray-200 text-gray-500"
                    }`}>
                      {completado ? "✓" : idx + 1}
                    </div>
                    <p className={`text-[10px] text-center mt-1 leading-tight px-1 ${
                      completado ? "text-green-700 font-semibold" :
                      esActual   ? "text-amber-700 font-semibold" : "text-gray-400"
                    }`}>
                      {paso.label}
                    </p>
                    {firma && (
                      <p className="text-[9px] text-gray-400 text-center leading-tight">
                        {firma.por?.split("@")[0]}
                      </p>
                    )}
                  </div>
                  {/* Conector */}
                  {idx < pasosAplicables.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mt-[-12px] ${
                      completado ? "bg-green-400" : "bg-gray-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Canvas de firma */}
        {habilitado && !firmaGuardada && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Tu firma digital:</p>
            <SignatureCanvas
              penColor="black"
              canvasProps={{ width: 500, height: 160, className: "border rounded bg-white shadow-sm w-full" }}
              ref={sigPadRef}
            />
            <button
              onClick={() => sigPadRef.current?.clear()}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Limpiar firma
            </button>
          </div>
        )}

        {habilitado && firmaGuardada && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center justify-between text-sm">
            <span className="text-green-700">Se usará tu firma registrada previamente.</span>
            <button
              onClick={() => setFirmaGuardada(null)}
              className="text-xs text-green-800 underline ml-3 flex-shrink-0"
            >
              Cambiar
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded-lg mb-3 text-sm">
            {error}
          </div>
        )}

        {/* Panel de rechazo */}
        {rechazando && (
          <div className="border border-red-200 rounded-lg p-4 mb-4 bg-red-50">
            <p className="text-sm font-semibold text-red-700 mb-2">Motivo del rechazo:</p>
            <textarea
              className="erp-input"
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Describe el motivo detallado del rechazo para que el comprador pueda corregir..."
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => { setRechazando(false); setMotivoRechazo(""); }}
                className="btn btn-secondary btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRechazo}
                disabled={procesando}
                className="btn btn-danger btn-sm"
              >
                {procesando ? "Procesando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        {!yaFinalizada && (
          <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-gray-100">
            {!rechazando && habilitado && (
              <button
                onClick={() => setRechazando(true)}
                className="btn btn-danger"
              >
                Rechazar
              </button>
            )}
            <button
              onClick={firmar}
              disabled={!habilitado || procesando}
              className="btn btn-primary disabled:opacity-50"
            >
              {procesando ? "Procesando..." : habilitado ? "Aprobar y Firmar" : "No puedes firmar en este estado"}
            </button>
          </div>
        )}

        {!habilitado && !yaFinalizada && (
          <p className="text-center text-xs text-gray-500 mt-3">
            Esta OC está en <b>{estadoActual}</b>. Tu rol (<i>{usuario.rol}</i>) no corresponde a esta etapa.
          </p>
        )}

        {yaFinalizada && (
          <p className={`text-center font-semibold mt-4 ${estadoActual === "Aprobada" ? "text-green-700" : "text-red-700"}`}>
            {estadoActual === "Aprobada" ? "OC completamente aprobada ✅" : "OC rechazada ❌"}
            {estadoActual === "Rechazada" && orden.motivoRechazo && (
              <span className="block text-sm font-normal mt-1 text-red-600">Motivo: {orden.motivoRechazo}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
};

export default FirmarOC;
