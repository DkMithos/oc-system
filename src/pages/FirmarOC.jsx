import React, { useEffect, useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useNavigate, useLocation } from "react-router-dom";
import { obtenerOCporId, actualizarOC } from "../firebase/firestoreHelpers";
import { getTrimmedCanvas } from "../utils/trimCanvasFix";
import { obtenerFirmaGuardada, guardarFirmaUsuario } from "../firebase/firmasHelpers";
import Logo from "../assets/logo-navbar.png";
import { useUsuario } from "../context/UsuarioContext";

const FirmarOC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");

  const [orden, setOrden] = useState(null);
  const [loadingOC, setLoadingOC] = useState(true);
  const [firmaGuardada, setFirmaGuardada] = useState(null);

  const { usuario, cargando } = useUsuario();
  const sigPadRef = useRef(null);

  // Cargar orden y firma guardada
  useEffect(() => {
    const cargarDatos = async () => {
      if (!usuario?.email) return;

      const [ocData, firma] = await Promise.all([
        obtenerOCporId(ocId),
        obtenerFirmaGuardada(usuario.email),
      ]);

      setOrden(ocData);
      setFirmaGuardada(firma);
      setLoadingOC(false);

      // Mostrar firma en canvas (opcional si quieres mostrarla aunque no sea editable)
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
    };

    cargarDatos();
  }, [usuario, ocId]);

  const requiereFirmaGerencia = (orden) => {
    const monto = orden.resumen?.total || 0;
    const moneda = orden.monedaSeleccionada;
    if (moneda === "Soles") return monto > 3500;
    if (moneda === "Dólares") return monto > 1000;
    return true;
  };

  const guardarFirma = async () => {
    if (!orden || !usuario) return;

    let campoFirma = "";
    let nuevoEstado = orden.estado;

    if (usuario.rol === "comprador") {
      if (orden.firmaComprador) return alert("Ya firmaste como comprador.");
      campoFirma = "firmaComprador";
    } else if (usuario.rol === "operaciones") {
      if (orden.firmaOperaciones) return alert("Ya firmaste como operaciones.");
      campoFirma = "firmaOperaciones";
      nuevoEstado = requiereFirmaGerencia(orden)
        ? "Aprobado por Operaciones"
        : "Aprobado por Gerencia";
    } else if (usuario.rol === "gerencia") {
      if (orden.firmaGerencia) return alert("Ya firmaste como gerencia.");
      campoFirma = "firmaGerencia";
      nuevoEstado = "Aprobado por Gerencia";
    } else {
      return alert("No tienes permiso para firmar esta OC.");
    }

    const camposObligatorios = [
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

    if (camposObligatorios) {
      return alert("Faltan datos obligatorios. No se puede firmar.");
    }

    let firmaFinal = firmaGuardada;

    if (!firmaFinal) {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
        return alert("Por favor firma antes de aprobar.");
      }

      const canvasRecortado = getTrimmedCanvas(sigPadRef.current.getCanvas());
      firmaFinal = canvasRecortado.toDataURL("image/png");

      // Guardar firma del usuario si aún no existe
      await guardarFirmaUsuario(usuario.email, firmaFinal);
    }

    const nuevaData = {
      [campoFirma]: firmaFinal,
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
    navigate("/ver?id=" + orden.id);

    await registrarLog({
      accion: "Firma por Gerencia",
      ocId: oc.id,
      usuario: usuario?.nombre || usuario?.email,
      rol: usuario?.rol,
      comentario: observacion || "",
    });
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
    navigate("/ver?id=" + orden.id);
  };

  if (cargando || loadingOC) return <div className="p-6">Cargando datos...</div>;
  if (!usuario) return <div className="p-6 text-red-600">No tienes permiso para firmar.</div>;
  if (!orden) return <div className="p-6 text-red-600">No se encontró la OC.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      <div className="flex items-center justify-between mb-6 border-b pb-4">
        <img src={Logo} alt="Logo Memphis" className="h-12" />
        <div>
          <h2 className="text-xl font-bold text-[#004990]">Firmar Orden de Compra</h2>
          <p className="text-sm text-gray-600">Orden #{orden.numeroOC}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-6">
        <p><strong>Proveedor:</strong> {orden.proveedor?.razonSocial}</p>
        <p><strong>Fecha de Emisión:</strong> {orden.fechaEmision}</p>
        <p><strong>Estado actual:</strong> {orden.estado}</p>
        <p><strong>Moneda:</strong> {orden.monedaSeleccionada}</p>
        <p><strong>Total:</strong> S/ {orden.resumen?.total?.toFixed(2)}</p>
      </div>

      {!firmaGuardada && (
        <div className="bg-[#f4f4f4] p-4 rounded shadow mb-6">
          <p className="mb-2 text-sm font-medium">Firma digital:</p>
          <SignatureCanvas
            penColor="black"
            canvasProps={{
              width: 450,
              height: 180,
              className: "border rounded bg-white shadow",
            }}
            ref={sigPadRef}
          />
          <div className="mt-2">
            <button
              onClick={() => sigPadRef.current?.clear()}
              className="text-sm text-blue-600 underline"
            >
              Limpiar firma
            </button>
          </div>
        </div>
      )}

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
