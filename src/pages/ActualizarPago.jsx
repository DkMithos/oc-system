import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "react-toastify";
import { useUsuario } from "../context/UsuarioContext";
import { scheduleCredit, scheduleCash, firstFridayOnOrAfter } from "../utils/fechas";

const ActualizarPago = () => {
  const { usuario, loading } = useUsuario();
  const navigate = useNavigate();
  const ocId = new URLSearchParams(useLocation().search).get("id");

  const [orden, setOrden] = useState(null);
  const [numeroFactura, setNumeroFactura] = useState("");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0]);
  const [archivos, setArchivos] = useState([]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "ordenes", ocId));
      if (!snap.exists()) { toast.error("Orden no encontrada"); return; }
      setOrden({ id: snap.id, ...snap.data() });
    })();
  }, [ocId]);

  const handleArchivoChange = (e) => setArchivos([...e.target.files]);

  const registrar = async () => {
    if (!numeroFactura || archivos.length === 0) {
      toast.error("Completa N° factura y sube al menos un PDF."); return;
    }
    if (!usuario || loading) { toast.error("Usuario no válido"); return; }
    if (!orden) { toast.error("Orden no cargada"); return; }
    if (archivos.some(f => f.type !== "application/pdf")) { toast.error("Solo PDF"); return; }

    try {
      const pdfUrls = [];
      for (const f of archivos) {
        const safeName = `${Date.now()}_${f.name.replace(/[^\w.\-]/g, "_")}`;
        const r = ref(storage, `facturas/${ocId}/${safeName}`);
        await uploadBytes(r, f);
        pdfUrls.push(await getDownloadURL(r));
      }

      // Programación de pago
      let programacion = { fechaVencimiento: fechaEmision, fechaPagoProgramada: fechaEmision };
      const cond = (orden.condicionPago || "").toUpperCase();
      if (cond.includes("CREDITO") || cond === "CRÉDITO") {
        const dias = orden.plazoCreditoDias || 30;
        programacion = scheduleCredit(fechaEmision, dias);
      } else if (cond.includes("MULTIPAGO")) {
        programacion = { fechaVencimiento: fechaEmision, fechaPagoProgramada: firstFridayOnOrAfter(fechaEmision) };
      } else if (cond.includes("CONTADO")) {
        programacion = scheduleCash(fechaEmision);
      }

      await addDoc(collection(db, "facturas"), {
        ordenId: orden.id,
        numero: numeroFactura,
        monto: orden.resumen?.total || 0,
        moneda: orden.monedaSeleccionada || "PEN",
        fechaEmision,
        pdfUrls,
        estado: "PROGRAMADA",
        ...programacion,
        creadoPor: usuario.email,
        creadoEn: new Date().toISOString(),
      });

      toast.success("Factura registrada y pago programado ✅");
      navigate(`/ver?id=${ocId}`);
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar la factura");
    }
  };

  if (loading || !orden) return <div className="p-6">Cargando...</div>;
  if (!["finanzas","admin"].includes(usuario?.rol)) return <div className="p-6 text-red-600">No tienes acceso a esta sección.</div>;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-[#004990] mb-4">Registrar Factura - Orden #{ocId}</h2>
      <div className="bg-white p-6 rounded shadow space-y-4">
        <p><strong>Proveedor:</strong> {orden.proveedor?.razonSocial}</p>
        <p><strong>Moneda:</strong> {orden.monedaSeleccionada || "PEN"}</p>
        <p><strong>Total:</strong> {Number(orden.resumen?.total || 0).toFixed(2)}</p>

        <input className="w-full border p-2 rounded" placeholder="N° de Factura" value={numeroFactura} onChange={(e)=>setNumeroFactura(e.target.value)} />
        <input className="w-full border p-2 rounded" type="date" value={fechaEmision} onChange={(e)=>setFechaEmision(e.target.value)} />
        <input className="w-full border p-2 rounded" type="file" accept="application/pdf" multiple onChange={handleArchivoChange} />

        <button onClick={registrar} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Registrar factura</button>
      </div>
    </div>
  );
};
export default ActualizarPago;
