// src/pages/FirmarOC.jsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useNavigate, useLocation } from "react-router-dom";
import {
  obtenerOCporId,
  aprobarOC,
  rechazarOC,
  obtenerFirmaUsuario,
  guardarFirmaUsuario,
} from "../firebase/firestoreHelpers";
import { puedeAprobarEnEstado, etapasRequeridas } from "../utils/aprobaciones";
import { notificarEventos } from "../firebase/notifs";
import { getTrimmedCanvas } from "../utils/trimCanvasFix";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";
import { toast } from "react-toastify";

const FirmarOC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ocId = new URLSearchParams(location.search).get("id");

  const { usuario, cargando } = useUsuario();
  const [orden, setOrden] = useState(null);
  const [loadingOC, setLoadingOC] = useState(true);
  const [firmaGuardada, setFirmaGuardada] = useState(null);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const sigPadRef = useRef(null);

  useEffect(() => {
    if (cargando) return;
    let alive = true;
    (async () => {
      try {
        if (!ocId) throw new Error("Falta id de OC.");
        const [ocData, firma] = await Promise.all([
          obtenerOCporId(ocId),
          usuario?.email ? obtenerFirmaUsuario(usuario.email) : null,
        ]);
        if (!alive) return;
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
        if (alive) setError(e.message || "No se pudo cargar la orden.");
      } finally {
        if (alive) setLoadingOC(false);
      }
    })();
    return () => { alive = false; };
  }, [ocId, usuario?.email, cargando]);

  const habilitado = !!orden && !!usuario && puedeAprobarEnEstado(orden.estado, usuario.rol);

  const obtenerFirmaFinal = async () => {
    if (firmaGuardada) return firmaGuardada;
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      throw new Error("Por favor, firma en el recuadro antes de aprobar.");
    }
    const canvasRecortado = getTrimmedCanvas(sigPadRef.current.getCanvas());
    const firmaData = canvasRecortado.toDataURL("image/png");
    await guardarFirmaUsuario(usuario.email, firmaData);
    setFirmaGuardada(firmaData);
    return firmaData;
  };

  const firmar = async () => {
    if (!habilitado || procesando) return;
    setProcesando(true);
    setError("");
    try {
      // Validar datos mínimos de la OC
      const faltan = [orden.fechaEmision, orden.centroCosto, orden.condicionPago, orden.lugarEntrega, orden.monedaSeleccionada]
        .some((v) => !v) || !Array.isArray(orden.items) || orden.items.length === 0;
      if (faltan) throw new Error("Faltan datos obligatorios en la orden. No se puede firmar.");

      await obtenerFirmaFinal();

      const nuevoEstado = await aprobarOC(orden.id, usuario.email, usuario.rol);

      // Notificación al siguiente nivel
      try {
        if (nuevoEstado === "Aprobado") {
          await notificarEventos.ordenAprobada(orden.numero || ocId, usuario.email, nuevoEstado);
        } else {
          await notificarEventos.ordenAprobada(orden.numero || ocId, usuario.email, nuevoEstado);
        }
      } catch {}

      toast.success(`Orden aprobada ✅ → ${nuevoEstado}`);
      navigate(`/ver?id=${orden.id}`);
    } catch (e) {
      console.error(e);
      setError(e.message || "No se pudo firmar la orden.");
    } finally {
      setProcesando(false);
    }
  };

  const rechazar = async () => {
    if (!usuario || !orden || procesando) return;
    const razon = window.prompt("Motivo del rechazo:");
    if (!razon?.trim()) return;

    setProcesando(true);
    setError("");
    try {
      await rechazarOC(orden.id, usuario.email, usuario.rol, razon.trim());
      try {
        await notificarEventos.ordenRechazada(orden.numero || ocId, usuario.email, orden.creadoPor || "");
      } catch {}
      toast.error("Orden rechazada ❌");
      navigate(`/ver?id=${orden.id}`);
    } catch (e) {
      console.error(e);
      setError(e.message || "No se pudo rechazar la orden.");
    } finally {
      setProcesando(false);
    }
  };

  if (cargando || loadingOC) return <div className="p-6">Cargando datos...</div>;
  if (!usuario) return <div className="p-6 text-red-600">No tienes permiso para firmar.</div>;
  if (error && !orden) return <div className="p-6 text-red-600">{error}</div>;
  if (!orden) return <div className="p-6 text-red-600">No se encontró la orden.</div>;

  const etapas = etapasRequeridas(Number(orden.resumen?.total || orden.total || 0));
  const montoTotal = Number(orden.resumen?.total || orden.total || 0);

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <img src={Logo} alt="Logo" className="h-12" />
        <div className="text-right">
          <h2 className="text-xl font-bold text-[#004990]">Firmar / Aprobar Orden</h2>
          <p className="text-sm text-gray-600">N° {orden.numero || orden.numeroOC || orden.id}</p>
        </div>
      </div>

      {/* Resumen OC */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-6 bg-gray-50 p-3 rounded">
        <p><strong>Proveedor:</strong> {orden.proveedor?.razonSocial || "—"}</p>
        <p><strong>Fecha Emisión:</strong> {orden.fechaEmision || "—"}</p>
        <p><strong>Estado actual:</strong> <span className="font-semibold text-blue-700">{orden.estado || "—"}</span></p>
        <p><strong>Moneda:</strong> {orden.monedaSeleccionada || "—"}</p>
        <p><strong>Total:</strong> <span className="font-semibold">S/ {montoTotal.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span></p>
      </div>

      {/* Flujo de aprobación */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Flujo de aprobación requerido:</h3>
        <div className="flex gap-2 flex-wrap">
          {etapas.map((etapa, i) => {
            const idx = etapas.indexOf(orden.estado);
            const aprobada = i < idx || orden.estado === "Aprobado";
            const actual = etapa === orden.estado;
            return (
              <div key={etapa} className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium ${
                aprobada ? "bg-green-100 text-green-700" : actual ? "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-400" : "bg-gray-100 text-gray-500"
              }`}>
                {aprobada ? "✓" : actual ? "→" : "○"} {etapa.replace("Pendiente de ", "")}
              </div>
            );
          })}
          {orden.estado === "Aprobado" && (
            <div className="flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium bg-green-200 text-green-800">✓ Aprobado</div>
          )}
        </div>
      </div>

      {/* Canvas de firma (solo si no tiene firma guardada) */}
      {!firmaGuardada && habilitado && (
        <div className="bg-gray-50 p-4 rounded border mb-6">
          <p className="mb-2 text-sm font-medium">Tu firma digital:</p>
          <SignatureCanvas
            penColor="black"
            canvasProps={{ width: 500, height: 150, className: "border rounded bg-white shadow" }}
            ref={sigPadRef}
          />
          <button onClick={() => sigPadRef.current?.clear()} className="mt-2 text-sm text-blue-600 underline">
            Limpiar firma
          </button>
        </div>
      )}

      {firmaGuardada && habilitado && (
        <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-6 text-sm text-blue-700">
          ✓ Se usará tu firma registrada. <button onClick={() => setFirmaGuardada(null)} className="underline ml-1">Cambiar</button>
        </div>
      )}

      {/* Historial de aprobaciones */}
      {Array.isArray(orden.historialAprobaciones) && orden.historialAprobaciones.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Historial de aprobaciones:</h3>
          <div className="space-y-1">
            {orden.historialAprobaciones.map((h, i) => (
              <div key={i} className={`text-xs px-3 py-1.5 rounded flex justify-between ${h.accion === "aprobado" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                <span><strong>{h.accion === "aprobado" ? "✓ Aprobado" : "✗ Rechazado"}</strong> por {h.aprobadoPor} ({h.rol})</span>
                <span className="text-gray-400">{h.fecha?.slice(0, 16)?.replace("T", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-3 justify-between">
        <button onClick={() => navigate(-1)} className="border px-4 py-2 rounded hover:bg-gray-50 text-sm">
          ← Volver
        </button>
        {habilitado ? (
          <div className="flex gap-3">
            <button
              onClick={rechazar}
              disabled={procesando}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-60 text-sm"
            >
              {procesando ? "Procesando..." : "Rechazar"}
            </button>
            <button
              onClick={firmar}
              disabled={procesando}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60 text-sm"
            >
              {procesando ? "Procesando..." : "Aprobar y Firmar"}
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded">
            {orden.estado === "Aprobado"
              ? "✓ Esta orden ya está aprobada"
              : orden.estado === "Rechazado"
              ? "✗ Esta orden fue rechazada"
              : "No tienes permiso para aprobar en este estado"}
          </div>
        )}
      </div>
    </div>
  );
};

export default FirmarOC;
