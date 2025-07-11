import React, { useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useNavigate, useLocation } from "react-router-dom";
import { obtenerOCporId, actualizarOC } from "../firebase/firestoreHelpers";
import { getTrimmedCanvas } from "../utils/trimCanvasFix";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UserContext";

const FirmarOC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");

  const [orden, setOrden] = useState(null);
  const [sigPad, setSigPad] = useState(null);
  const [loadingOC, setLoadingOC] = useState(true);

  const { usuario, loading } = useUsuario();

  useEffect(() => {
    const cargarOrden = async () => {
      const data = await obtenerOCporId(ocId);
      setOrden(data);
      setLoadingOC(false);
    };
    cargarOrden();
  }, [ocId]);

  const requiereFirmaGerencia = (orden) => {
    const monto = orden.resumen?.total || 0;
    const moneda = orden.monedaSeleccionada;
    if (moneda === "Soles") return monto > 3500;
    if (moneda === "Dólares") return monto > 1000;
    return true;
  };

  const guardarFirma = async () => {
    if (!sigPad || sigPad.isEmpty()) {
      alert("Por favor firma antes de aprobar.");
      return;
    }

    if (!orden || !usuario) return;

    const canvasRecortado = getTrimmedCanvas(sigPad.getCanvas());
    const firma = canvasRecortado.toDataURL("image/png");
    const necesitaGerencia = requiereFirmaGerencia(orden);

    let campoFirma = "";
    let nuevoEstado = orden.estado;

    if (usuario.rol === "operaciones") {
      if (orden.firmaOperaciones) {
        alert("Ya firmaste esta orden previamente.");
        return;
      }
      campoFirma = "firmaOperaciones";
      nuevoEstado = necesitaGerencia ? "Aprobado por Operaciones" : "Aprobado por Gerencia";
    } else if (usuario.rol === "gerencia") {
      if (orden.firmaGerencia) {
        alert("Ya firmaste esta orden previamente.");
        return;
      }
      campoFirma = "firmaGerencia";
      nuevoEstado = "Aprobado por Gerencia";
    } else {
      alert("No tienes permiso para firmar esta orden.");
      return;
    }

    const camposFaltantes = [
      orden.fechaEmision,
      orden.fechaEntrega,
      orden.comprador,
      orden.proveedor?.ruc,
      orden.centroCosto,
      orden.condicionPago,
      orden.lugarEntrega,
      orden.proveedor,
      orden.bancoSeleccionado,
      orden.monedaSeleccionada,
      orden.items?.length,
    ].some((c) => !c);

    if (camposFaltantes) {
      alert("Faltan datos obligatorios en esta OC. No se puede firmar.");
      return;
    }

    const nuevaData = {
      [campoFirma]: firma,
      estado: nuevoEstado,
      historial: [
        ...(orden.historial || []),
        {
          accion: "Aprobado",
          por: usuario.email,
          fecha: new Date().toLocaleString("es-PE"),
        },
      ],
    };

    await actualizarOC(orden.id, nuevaData);
    alert("Orden firmada correctamente ✅");
    navigate("/historial");
  };

  const rechazarOC = async () => {
    if (!usuario || !orden) return;
    const razon = prompt("¿Por qué rechazas esta OC?");
    if (!razon) return;

    const nuevaData = {
      estado: "Rechazado",
      motivoRechazo: razon,
      historial: [
        ...(orden.historial || []),
        {
          accion: "Rechazado",
          por: usuario.email,
          fecha: new Date().toLocaleString("es-PE"),
          motivo: razon,
        },
      ],
    };

    await actualizarOC(orden.id, nuevaData);
    alert("Orden rechazada ❌");
    navigate("/historial");
  };

  if (loading || loadingOC) return <div className="p-6">Cargando datos...</div>;
  if (!usuario) return <div className="p-6 text-red-600">No tienes permiso para firmar.</div>;
  if (!orden) return <div className="p-6 text-red-600">No se encontró la OC.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      {/* Encabezado con Logo */}
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <img src={Logo} alt="Logo Memphis" className="h-12" />
        <div>
          <h2 className="text-xl font-bold text-[#004990]">Firmar Orden de Compra</h2>
          <p className="text-sm text-gray-600">Orden #{orden.id}</p>
        </div>
      </div>

      {/* Resumen de la OC */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <p><strong>Proveedor:</strong> {orden.proveedor?.razonSocial}</p>
        <p><strong>Fecha de Emisión:</strong> {orden.fechaEmision}</p>
        <p><strong>Estado actual:</strong> {orden.estado}</p>
        <p><strong>Moneda:</strong> {orden.monedaSeleccionada}</p>
        <p><strong>Total:</strong> {orden.resumen?.total?.toFixed(2)}</p>
      </div>

      {/* Área de firma */}
      <div className="bg-[#f4f4f4] p-4 rounded shadow mb-6">
        <p className="mb-2 text-sm font-medium">Firma digital:</p>
        <SignatureCanvas
          penColor="black"
          canvasProps={{
            width: 450,
            height: 180,
            className: "border rounded bg-white shadow",
          }}
          ref={(ref) => setSigPad(ref)}
        />
        <div className="mt-2">
          <button onClick={() => sigPad.clear()} className="text-sm text-blue-600 underline">
            Limpiar firma
          </button>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-4 justify-end">
        <button
          onClick={rechazarOC}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Rechazar
        </button>
        <button
          onClick={guardarFirma}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Aprobar y Firmar
        </button>
      </div>
    </div>
  );
};

export default FirmarOC;
