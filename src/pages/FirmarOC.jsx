// ✅ src/pages/FirmarOC.jsx
import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useNavigate, useLocation } from "react-router-dom";
import {
  obtenerOCporId,
  actualizarOC,
  obtenerFirmaUsuario,
  guardarFirmaUsuario,
  registrarLog,
} from "../firebase/firestoreHelpers";
import { getTrimmedCanvas } from "../utils/trimCanvasFix";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";

const FirmarOC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");

  const { usuario, cargando } = useUsuario();
  const [orden, setOrden] = useState(null);
  const [loadingOC, setLoadingOC] = useState(true);
  const [firmaGuardada, setFirmaGuardada] = useState(null);
  const [error, setError] = useState("");
  const sigPadRef = useRef(null);

  // Cargar OC + firma guardada del usuario
  useEffect(() => {
    (async () => {
      try {
        if (!ocId) throw new Error("Falta id de OC.");
        const [ocData, firma] = await Promise.all([
          obtenerOCporId(ocId),
          usuario?.email ? obtenerFirmaUsuario(usuario.email) : null,
        ]);
        setOrden(ocData);
        setFirmaGuardada(firma || null);
        // Mostrar firma guardada (opcional)
        if (firma && sigPadRef.current) {
          const image = new Image();
          image.src = firma;
          image.onload = () => {
            const canvas = sigPadRef.current.getCanvas();
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

  // Quién puede firmar ahora, según el estado de las firmas
  const puedeFirmar = (rol, oc) => {
    if (!oc || !rol) return false;
    const r = (rol || "").toLowerCase();
    if (r === "comprador") return false; // comprador NO firma

    const f = oc.firmas || {};
    // Cadena: Operaciones → Gerencia → Finanzas
    if (!f.operaciones && (r === "operaciones" || r === "gerencia")) return true;
    if (!f.gerencia && r === "gerencia") return true;
    if (!f.finanzas && r === "finanzas") return true;
    return false;
  };

  const completarEstado = (f) => {
    // Aprobada solo si están las tres firmas: operaciones, gerencia y finanzas
    return f?.operaciones && f?.gerencia && f?.finanzas ? "Aprobada" : "Pendiente";
  };

  const firmar = async () => {
    try {
      setError("");
      if (!usuario || !orden) return;

      if (!puedeFirmar(usuario.rol, orden)) {
        alert("Tu rol no puede firmar esta orden en este momento.");
        return;
      }

      // Validaciones básicas de datos de la OC (evita firmar incompleta)
      const faltan =
        [
          orden.fechaEmision,
          orden.centroCosto,
          orden.condicionPago,
          orden.lugarEntrega,
          orden.monedaSeleccionada,
        ].some((v) => !v) || !Array.isArray(orden.items) || orden.items.length === 0;
      if (faltan) {
        alert("Faltan datos obligatorios en la orden. No se puede firmar.");
        return;
      }

      // Tomar firma del usuario (guardada o nueva del canvas)
      let firmaFinal = firmaGuardada;
      if (!firmaFinal) {
        if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
          alert("Por favor, firma en el recuadro antes de aprobar.");
          return;
        }
        const canvasRecortado = getTrimmedCanvas(sigPadRef.current.getCanvas());
        firmaFinal = canvasRecortado.toDataURL("image/png");
        // Persistir firma del usuario para siguientes veces
        await guardarFirmaUsuario(usuario.email, firmaFinal);
        setFirmaGuardada(firmaFinal);
      }

      // Construir nuevas firmas
      const nuevasFirmas = { ...(orden.firmas || {}) };
      const rol = (usuario.rol || "").toLowerCase();
      const stamp = { por: usuario.email, firma: firmaFinal, fecha: new Date().toISOString() };

      if (!nuevasFirmas.operaciones && (rol === "operaciones" || rol === "gerencia")) {
        nuevasFirmas.operaciones = stamp;
      } else if (!nuevasFirmas.gerencia && rol === "gerencia") {
        nuevasFirmas.gerencia = stamp;
      } else if (!nuevasFirmas.finanzas && rol === "finanzas") {
        nuevasFirmas.finanzas = stamp;
      } else {
        alert("No corresponde firmar con tu rol en este paso.");
        return;
      }

      const nuevoEstado = completarEstado(nuevasFirmas);
      const historial = [
        ...(orden.historial || []),
        { accion: "Firmado", por: usuario.email, rol: usuario.rol, fecha: new Date().toLocaleString("es-PE") },
      ];

      await actualizarOC(orden.id, { firmas: nuevasFirmas, estado: nuevoEstado, historial });
      await registrarLog({
        accion: "orden_firmada",
        ocId: orden.id,
        usuario: usuario.email,
        rol: usuario.rol,
      });

      setOrden((o) => ({ ...o, firmas: nuevasFirmas, estado: nuevoEstado, historial }));
      alert("Firma registrada correctamente ✅");
      navigate(`/ver?id=${orden.id}`);
    } catch (e) {
      console.error(e);
      setError(e.message || "No se pudo firmar la orden.");
    }
  };

  const rechazar = async () => {
    if (!usuario || !orden) return;
    const razon = prompt("Motivo del rechazo:");
    if (!razon) return;

    const historial = [
      ...(orden.historial || []),
      { accion: "Rechazado", por: usuario.email, rol: usuario.rol, motivo: razon, fecha: new Date().toLocaleString("es-PE") },
    ];
    await actualizarOC(orden.id, { estado: "Rechazada", motivoRechazo: razon, historial });
    await registrarLog({ accion: "orden_rechazada", ocId: orden.id, usuario: usuario.email, rol: usuario.rol });
    alert("Orden rechazada ❌");
    navigate(`/ver?id=${orden.id}`);
  };

  if (cargando || loadingOC) return <div className="p-6">Cargando datos...</div>;
  if (!usuario) return <div className="p-6 text-red-600">No tienes permiso para firmar.</div>;
  if (!orden) return <div className="p-6 text-red-600">No se encontró la orden.</div>;

  const habilitado = puedeFirmar(usuario.rol, orden);

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <img src={Logo} alt="Logo" className="h-12" />
        <div>
          <h2 className="text-xl font-bold text-[#004990]">Firmar Orden</h2>
          <p className="text-sm text-gray-600">N° {orden.numero}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <p><strong>Proveedor:</strong> {orden.proveedor?.razonSocial || "-"}</p>
        <p><strong>Fecha Emisión:</strong> {orden.fechaEmision || "-"}</p>
        <p><strong>Estado actual:</strong> {orden.estado || "-"}</p>
        <p><strong>Moneda:</strong> {orden.monedaSeleccionada || "-"}</p>
        <p><strong>Total:</strong> {orden.resumen?.total?.toFixed(2) || "-"}</p>
      </div>

      {!firmaGuardada && (
        <div className="bg-[#f4f4f4] p-4 rounded shadow mb-6">
          <p className="mb-2 text-sm font-medium">Tu firma digital:</p>
          <SignatureCanvas
            penColor="black"
            canvasProps={{ width: 500, height: 180, className: "border rounded bg-white shadow" }}
            ref={sigPadRef}
          />
          <div className="mt-2">
            <button onClick={() => sigPadRef.current?.clear()} className="text-sm text-blue-600 underline">
              Limpiar firma
            </button>
          </div>
        </div>
      )}

      <div className="border rounded p-3 space-y-1 text-sm">
        <div><strong>Operaciones:</strong> {orden.firmas?.operaciones ? `Firmado por ${orden.firmas.operaciones.por}` : "Pendiente"}</div>
        <div><strong>Gerencia:</strong> {orden.firmas?.gerencia ? `Firmado por ${orden.firmas.gerencia.por}` : "Pendiente"}</div>
        <div><strong>Finanzas:</strong> {orden.firmas?.finanzas ? `Firmado por ${orden.firmas.finanzas.por}` : "Pendiente"}</div>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded mt-3">{error}</div>}

      <div className="mt-4 flex flex-wrap gap-3 justify-end">
        <button onClick={rechazar} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
          Rechazar
        </button>
        <button
          onClick={firmar}
          disabled={!habilitado}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60"
        >
          {habilitado ? "Aprobar y Firmar" : "No puedes firmar aún"}
        </button>
      </div>
    </div>
  );
};

export default FirmarOC;
