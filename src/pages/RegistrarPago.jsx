import React, { useEffect, useState } from "react";
import { obtenerOCs, actualizarOC } from "../firebase/firestoreHelpers";
import { subirArchivosPago } from "../firebase/storageHelpers";
import { useNavigate } from "react-router-dom";

const RegistrarPago = () => {
  const [ocsDisponibles, setOcsDisponibles] = useState([]);
  const [form, setForm] = useState({
    ocId: "",
    numeroFactura: "",
    numeroComprobante: "",
    montoPagado: "",
    fechaPago: new Date().toISOString().split("T")[0],
    archivos: [],
  });

  const navigate = useNavigate();

  useEffect(() => {
    const cargarOCs = async () => {
      const todas = await obtenerOCs();

      const filtradas = todas.filter((oc) => {
        const tienePago = oc.archivosPago?.length > 0;
        const total = oc.resumen?.total || 0;
        const moneda = oc.monedaSeleccionada;

        const aprobadoPorGerencia = oc.estado === "Aprobado por Gerencia";
        const aprobadoPorOperaciones =
          oc.estado === "Aprobado por Operaciones" &&
          ((moneda === "Soles" && total <= 3500) ||
            (moneda === "Dólares" && total <= 1000));

        return !tienePago && (aprobadoPorGerencia || aprobadoPorOperaciones);
      });

      setOcsDisponibles(filtradas);
    };

    cargarOCs();
  }, []);

  const handleArchivo = (e) => {
    setForm({ ...form, archivos: [...e.target.files] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.ocId ||
      !form.numeroFactura ||
      !form.numeroComprobante ||
      !form.montoPagado ||
      !form.fechaPago
    ) {
      alert("Completa todos los campos.");
      return;
    }

    try {
      const urls = await subirArchivosPago(form.ocId, form.archivos);

      await actualizarOC(form.ocId, {
        estado: "Pagado",
        numeroFactura: form.numeroFactura,
        numeroComprobante: form.numeroComprobante,
        montoPagado: parseFloat(form.montoPagado),
        fechaPago: form.fechaPago,
        archivosPago: urls,
        historial: [
          {
            accion: "Pago registrado",
            por: localStorage.getItem("userEmail"),
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      });

      alert("Pago registrado correctamente ✅");
      navigate("/pagos");
    } catch (error) {
      console.error("Error registrando pago:", error);
      alert("Hubo un error al registrar el pago.");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#004990] mb-4">Registrar Pago</h2>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow grid grid-cols-2 gap-4 max-w-3xl"
      >
        <select
          value={form.ocId}
          onChange={(e) => setForm({ ...form, ocId: e.target.value })}
          className="col-span-2 border px-3 py-2 rounded"
        >
          <option value="">Selecciona una OC</option>
          {ocsDisponibles.map((oc) => (
            <option key={oc.id} value={oc.id}>
              {oc.id} - {oc.proveedor?.razonSocial}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="N° de Factura"
          value={form.numeroFactura}
          onChange={(e) =>
            setForm({ ...form, numeroFactura: e.target.value })
          }
          className="border px-3 py-2 rounded"
        />
        <input
          type="text"
          placeholder="N° de Comprobante de Pago"
          value={form.numeroComprobante}
          onChange={(e) =>
            setForm({ ...form, numeroComprobante: e.target.value })
          }
          className="border px-3 py-2 rounded"
        />
        <input
          type="number"
          placeholder="Monto Pagado"
          value={form.montoPagado}
          onChange={(e) =>
            setForm({ ...form, montoPagado: e.target.value })
          }
          className="border px-3 py-2 rounded"
        />
        <input
          type="date"
          value={form.fechaPago}
          onChange={(e) =>
            setForm({ ...form, fechaPago: e.target.value })
          }
          className="border px-3 py-2 rounded"
        />

        <div className="col-span-2">
          <label className="block mb-1 font-medium">
            Adjuntar archivos PDF
          </label>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleArchivo}
            className="border px-3 py-2 rounded w-full"
          />
        </div>

        <button
          type="submit"
          className="col-span-2 bg-[#004990] text-white px-6 py-2 rounded hover:bg-[#003066]"
        >
          Registrar Pago
        </button>
      </form>
    </div>
  );
};

export default RegistrarPago;
