// src/pages/FirmarOC.jsx
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

// ──────────────────────────────────────────────────────────────
// Estado → roles autorizados para aprobar en esa etapa
// ──────────────────────────────────────────────────────────────
const ROL_POR_ESTADO = {
  "Pendiente de Operaciones":          ["operaciones"],
  "Pendiente de Gerencia Operaciones": ["gerencia operaciones", "gerencia"],
  "Pendiente de Gerencia General":     ["gerencia general", "gerencia"],
};

// Estado → clave de firma en Firestore (debe coincidir con guardarOrden)
const FIRMA_KEY_POR_ESTADO = {
  "Pendiente de Operaciones":          "operaciones",
  "Pendiente de Gerencia Operaciones": "gerenciaOperaciones",
  "Pendiente de Gerencia General":     "gerenciaGeneral",
};

// Destinatario de notificación para el siguiente estado
const NOTIF_ROL_SIGUIENTE = {
  "Pendiente de Gerencia Operaciones": "__rol:gerencia operaciones",
  "Pendiente de Gerencia General":     "__rol:gerencia general",
};

/**
 * Calcula el siguiente estado según el monto total de la OC.
 * Reglas de negocio:
 *   <= 10,000  → solo Operaciones aprueba → Aprobada
 *   > 10,000   → Operaciones → Gerencia Operaciones → Aprobada
 *   >= 50,000  → Operaciones → Gerencia Operaciones → Gerencia General → Aprobada
 */
const calcularSiguienteEstado = (estadoActual, monto) => {
  if (estadoActual === "Pendiente de Operaciones") {
    return monto > 10000 ? "Pendiente de Gerencia Operaciones" : "Aprobada";
  }
  if (estadoActual === "Pendiente de Gerencia Operaciones") {
    return monto >= 50000 ? "Pendiente de Gerencia General" : "Aprobada";
  }
  if (estadoActual === "Pendiente de Gerencia General") {
    return "Aprobada";
  }
  return estadoActual;
};

const puedeAprobar = (rol, estado) => {
  const r = String(rol || "").toLowerCase();
  return (ROL_POR_ESTADO[estado] || []).includes(r);
};

// Todos los pasos posibles del flujo de firmas
const PASOS_FIRMA = [
  { label: "Operaciones",           key: "operaciones",         estadoReq: "Pendiente de Operaciones",          montoMin: 0 },
  { label: "Gerencia Operaciones",  key: "gerenciaOperaciones", estadoReq: "Pendiente de Gerencia Operaciones", montoMin: 10001 },
  { label: "Gerencia General",      key: "gerenciaGeneral",     estadoReq: "Pendiente de Gerencia General",     montoMin: 50000 },
];

// ──────────────────────────────────────────────────────────────
const FirmarOC = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const ocId       = new URLSearchParams(location.search).get("id");
  const { usuario, cargando } = useUsuario();

  const [orden, setOrden]                 = useState(null);
  const [loadingOC, setLoadingOC]         = useState(true);
  const [firmaGuardada, setFirmaGuardada] = useState(null);
  const [procesando, setProcesando]       = useState(false);
  const [error, setError]                 = useState("");
  const [rechazando, setRechazando]       = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const sigPadRef = useRef(null);

  useEffect(() => {
    if (!ocId) { setLoadingOC(false); return; }
    (async () => {
      try {
        const [ocData, firma] = await Promise.all([
          obtenerOCporId(ocId),
          usuario?.email ? obtenerFirmaUsuario(usuario.email) : null,
        ]);
        setOrden(ocData);
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
  const estadoActual = orden?.estado || "";
  const habilitado   = !procesando && puedeAprobar(usuario?.rol, estadoActual);
  const yaFinalizada = ["Aprobada", "Rechazada"].includes(estadoActual);

  const firmar = async () => {
    try {
      setError("");
      if (!usuario || !orden) return;
      if (!habilitado) {
        toast.warning("Tu rol no puede firmar esta orden en este momento.");
        return;
      }

      const camposFaltantes =
        [orden.fechaEmision, orden.centroCosto, orden.condicionPago, orden.lugarEntrega, orden.monedaSeleccionada].some((v) => !v) ||
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

      const firmaKey     = FIRMA_KEY_POR_ESTADO[estadoActual];
      const stamp        = { por: usuario.email, firma: firmaFinal, fecha: new Date().toISOString() };
      const nuevasFirmas = { ...(orden.firmas || {}), [firmaKey]: stamp };
      const nuevoEstado  = calcularSiguienteEstado(estadoActual, monto);

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

      if (nuevoEstado === "Aprobada") {
        notificarUsuario({
          email: orden.creadoPor || "",
          title: "OC Aprobada ✅",
          body: `La OC ${orden.numero} ha sido completamente aprobada.`,
          ocId: orden.id,
        }).catch(() => {});
      } else {
        const destinatario = NOTIF_ROL_SIGUIENTE[nuevoEstado];
        if (destinatario) {
          notificarUsuario({
            email: destinatario,
            title: "OC pendiente de tu aprobación",
            body: `La OC ${orden.numero} requiere tu revisión — ${nuevoEstado}.`,
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
          fecha: new Date().toLocaleString("es-PE"),
        },
      ];
      await actualizarOC(orden.id, { estado: "Rechazada", motivoRechazo, historial });
      await registrarLog({ accion: "orden_rechazada", ocId: orden.id, usuario: usuario.email, rol: usuario.rol });

      notificarUsuario({
        email: orden.creadoPor || "",
        title: "OC Rechazada ❌",
        body: `La OC ${orden.numero} fue rechazada. Motivo: ${motivoRechazo}`,
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

  if (cargando || loadingOC) return <div className="p-6">Cargando datos...</div>;
  if (!usuario)   return <div className="p-6 text-red-600">No tienes permiso para acceder aquí.</div>;
  if (!orden)     return <div className="p-6 text-red-600">No se encontró la orden. {error}</div>;

  const pasosAplicables = PASOS_FIRMA.filter(({ montoMin }) => monto >= montoMin || montoMin === 0);

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <img src={Logo} alt="Logo" className="h-12" />
        <div className="text-right">
          <h2 className="text-xl font-bold text-[#004990]">Firmar Orden</h2>
          <p className="text-sm text-gray-600">N° {orden.numero}</p>
        </div>
      </div>

      {/* Datos de la OC */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <p><strong>Proveedor:</strong> {orden.proveedor?.razonSocial || "—"}</p>
        <p><strong>Fecha Emisión:</strong> {orden.fechaEmision || "—"}</p>
        <p>
          <strong>Estado:</strong>{" "}
          <span
            className={`font-semibold ${
              estadoActual === "Aprobada"  ? "text-green-700" :
              estadoActual === "Rechazada" ? "text-red-700"   : "text-[#004990]"
            }`}
          >
            {estadoActual || "—"}
          </span>
        </p>
        <p><strong>Moneda:</strong> {orden.monedaSeleccionada || "—"}</p>
        <p><strong>Subtotal:</strong> {orden.resumen?.subtotal?.toFixed(2) ?? "—"}</p>
        <p><strong>Total:</strong> <span className="font-semibold">{monto.toFixed(2)}</span></p>
      </div>

      {/* Flujo de firmas según monto */}
      <div className="border rounded divide-y text-sm mb-5">
        {pasosAplicables.map(({ label, key }) => {
          const firma = orden.firmas?.[key];
          return (
            <div
              key={key}
              className={`px-3 py-2 flex items-center justify-between ${firma ? "bg-green-50" : "bg-white"}`}
            >
              <span className="font-medium">{label}</span>
              {firma ? (
                <span className="text-green-700 text-xs">
                  ✅ {firma.por} — {firma.fecha ? new Date(firma.fecha).toLocaleDateString("es-PE") : ""}
                </span>
              ) : (
                <span className="text-gray-400 text-xs">Pendiente</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Canvas de firma */}
      {habilitado && !firmaGuardada && (
        <div className="bg-gray-50 p-4 rounded border mb-5">
          <p className="mb-2 text-sm font-medium">Tu firma digital:</p>
          <SignatureCanvas
            penColor="black"
            canvasProps={{ width: 500, height: 180, className: "border rounded bg-white shadow" }}
            ref={sigPadRef}
          />
          <button onClick={() => sigPadRef.current?.clear()} className="mt-2 text-sm text-blue-600 underline">
            Limpiar firma
          </button>
        </div>
      )}

      {habilitado && firmaGuardada && (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-700">
          Se usará tu firma registrada previamente.{" "}
          <button onClick={() => setFirmaGuardada(null)} className="underline text-green-800 ml-1">
            Cambiar
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}

      {/* Panel de rechazo */}
      {rechazando && (
        <div className="border border-red-200 rounded p-3 mb-4 bg-red-50">
          <p className="text-sm font-medium text-red-700 mb-2">Motivo del rechazo:</p>
          <textarea
            className="w-full border rounded p-2 text-sm"
            rows={3}
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Describe el motivo del rechazo..."
          />
          <div className="flex gap-2 mt-2 justify-end">
            <button
              onClick={() => { setRechazando(false); setMotivoRechazo(""); }}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarRechazo}
              disabled={procesando}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60"
            >
              Confirmar rechazo
            </button>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      {!yaFinalizada && (
        <div className="flex flex-wrap gap-3 justify-end mt-4">
          {!rechazando && habilitado && (
            <button
              onClick={() => setRechazando(true)}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Rechazar
            </button>
          )}
          <button
            onClick={firmar}
            disabled={!habilitado || procesando}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60"
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
        </p>
      )}
    </div>
  );
};

export default FirmarOC;
