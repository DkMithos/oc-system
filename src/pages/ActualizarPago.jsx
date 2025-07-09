import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { obtenerOCporId, actualizarOC } from "../firebase/firestoreHelpers";
import { subirArchivosPago } from "../firebase/storageHelpers"; // Este helper sube archivos a Firebase Storage
import { toast } from "react-toastify";

const ActualizarPago = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");
  const userEmail = localStorage.getItem("userEmail");
  const userRole = localStorage.getItem("userRole");

  const [orden, setOrden] = useState(null);
  const [loading, setLoading] = useState(true);

  const [numeroFactura, setNumeroFactura] = useState("");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [archivos, setArchivos] = useState([]);

  useEffect(() => {
    const cargarOC = async () => {
      const data = await obtenerOCporId(ocId);
      if (!data) return alert("OC no encontrada");
      setOrden(data);
      setLoading(false);
    };
    cargarOC();
  }, [ocId]);

  const handleArchivoChange = (e) => {
    setArchivos([...e.target.files]);
  };

  const registrarPago = async () => {
    if (!numeroFactura || !numeroComprobante || archivos.length === 0) {
      alert("Completa todos los campos y sube al menos un archivo PDF.");
      return;
    }

    try {
      const urls = await subirArchivosPago(ocId, archivos);

      await actualizarOC(ocId, {
        estadoPago: "Pagado",
        pago: {
          numeroFactura,
          numeroComprobante,
          fechaPago,
          archivos: urls,
        },
        historial: [
          ...(orden.historial || []),
          {
            accion: "Pago registrado",
            por: userEmail,
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      });

      alert("Pago registrado correctamente ✅");
      navigate("/ver?id=" + ocId);
    } catch (error) {
      console.error("Error al subir archivo o guardar pago:", error);
      alert("Error al registrar el pago.");
    }
  };

  if (userRole !== "finanzas") {
    return <div className="p-6 text-red-600">No tienes acceso a esta sección.</div>;
  }

  if (loading) return <div className="p-6">Cargando orden...</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-[#004990] mb-4">
        Registrar Pago - OC #{ocId}
      </h2>

      <div className="bg-white p-6 rounded shadow space-y-4">
        <p><strong>Proveedor:</strong> {orden.proveedor?.razonSocial}</p>
        <p><strong>Moneda:</strong> {orden.monedaSeleccionada}</p>
        <p><strong>Total:</strong> {orden.resumen?.total?.toFixed(2)}</p>

        <input
          type="text"
          placeholder="N° de Factura"
          value={numeroFactura}
          onChange={(e) => setNumeroFactura(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <input
          type="text"
          placeholder="N° de Comprobante de Pago"
          value={numeroComprobante}
          onChange={(e) => setNumeroComprobante(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <input
          type="date"
          value={fechaPago}
          onChange={(e) => setFechaPago(e.target.value)}
          className="w-full border p-2 rounded"
        />

        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleArchivoChange}
          className="w-full border p-2 rounded"
        />

        <button
          onClick={registrarPago}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          Registrar Pago
        </button>
        toast.success("Pago actualizado ✅");
        toast.error("Error al guardar");
      </div>
    </div>
  );
};

export default ActualizarPago;
