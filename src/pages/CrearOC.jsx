import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ItemTable from "../components/ItemTable";
import { guardarOC, obtenerCentrosCosto, obtenerCondicionesPago, obtenerProveedores } from "../firebase/firestoreHelpers";
import { consultarSunat } from "../utils/consultaSunat";
import { formatearMoneda } from "../utils/formatearMoneda";
import Logo from "../assets/Logo_OC.png";
import Select from "react-select";

const CrearOC = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail") || "";
  const userName = localStorage.getItem("userName") || "";

  const [formData, setFormData] = useState({
    fechaEmision: new Date().toISOString().split("T")[0],
    cotizacion: "",
    fechaEntrega: "",
    comprador: userEmail,
    proveedorRuc: "",
    proveedor: {},
    bancoSeleccionado: "",
    monedaSeleccionada: "",
    centroCosto: "",
    condicionPago: "",
    lugarEntrega: "",
    observaciones: "",
  });

  const [items, setItems] = useState([
    { id: 1, nombre: "", cantidad: 0, precioUnitario: 0, descuento: 0 },
  ]);
  const [otros, setOtros] = useState(0);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [condicionesPago, setCondicionesPago] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    const cargarDatosMaestros = async () => {
      const centros = await obtenerCentrosCosto();
      const condiciones = await obtenerCondicionesPago();
      const listaProveedores = await obtenerProveedores();
      setCentrosCosto(centros.map((c) => c.nombre));
      setCondicionesPago(condiciones.map((c) => c.nombre));
      setProveedores(listaProveedores);
    };
    cargarDatosMaestros();
  }, []);

  const bancosDisponibles = formData.proveedor?.bancos || [];
  const monedasDisponibles = bancosDisponibles
    .filter((b) => b.nombre === formData.bancoSeleccionado)
    .map((b) => b.moneda);

  const cuentaSeleccionada = bancosDisponibles.find(
    (b) =>
      b.nombre === formData.bancoSeleccionado &&
      b.moneda === formData.monedaSeleccionada
  );

  const subtotal = items.reduce(
    (acc, item) => acc + (item.precioUnitario - item.descuento) * item.cantidad,
    0
  );
  const igv = subtotal * 0.18;
  const valorVenta = subtotal;
  const totalFinal = subtotal + igv + parseFloat(otros || 0);

  const validarFormulario = () => {
    if (!formData.fechaEntrega || !formData.comprador || !formData.proveedorRuc) {
      alert("Completa todos los campos obligatorios.");
      return false;
    }

    const tieneItemsValidos = items.some(
      (item) => item.nombre && item.cantidad > 0
    );
    if (!tieneItemsValidos) {
      alert("Agrega al menos un ítem válido.");
      return false;
    }

    return true;
  };

  const handleGuardarOC = async () => {
    if (!validarFormulario()) return;

    const nuevaOC = {
      estado: "Pendiente de Operaciones",
      ...formData,
      proveedor: formData.proveedor,
      cuenta: cuentaSeleccionada,
      items,
      resumen: {
        subtotal,
        igv,
        valorVenta,
        otros: parseFloat(otros),
        total: totalFinal,
      },
      historial: [],
      creadoPor: userName,
      fechaCreacion: new Date().toISOString(),
    };

    try {
      const newId = await guardarOC(nuevaOC);
      alert("Orden guardada correctamente ✅");
      navigate("/ver?id=" + newId);
    } catch (error) {
      console.error("Error guardando OC:", error);
      alert("Ocurrió un error al guardar la orden.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <img src={Logo} alt="Logo Memphis" className="h-12" />
        <h2 className="text-2xl font-bold text-[#032f53]">Nueva Orden de Compra</h2>
      </div>

      <div className="bg-white border shadow rounded p-6 grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <input type="date" disabled value={formData.fechaEmision} className="border p-2 rounded" />
        <input
          type="text"
          placeholder="N° Cotización"
          value={formData.cotizacion}
          onChange={(e) => setFormData({ ...formData, cotizacion: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="date"
          value={formData.fechaEntrega}
          onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
          className="border p-2 rounded"
        />

        <input type="text" disabled value={formData.comprador} className="border p-2 rounded" />

        {/* Select con búsqueda de proveedor */}
        <div className="col-span-2 md:col-span-3">
          <Select
            placeholder="Selecciona proveedor por RUC o Razón Social"
            options={proveedores.map((p) => ({
              label: `${p.ruc} - ${p.razonSocial}`,
              value: p.ruc,
              data: p,
            }))}
            onChange={(opcion) => {
              setFormData((prev) => ({
                ...prev,
                proveedor: opcion.data,
                proveedorRuc: opcion.data.ruc,
                bancoSeleccionado: "",
                monedaSeleccionada: "",
              }));
            }}
            isSearchable
          />
        </div>

        {formData.proveedor?.razonSocial && (
          <>
            <input disabled value={formData.proveedor.razonSocial} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.direccion} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.email} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.telefono} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.contacto} className="border p-2 rounded" />

            <select
              value={formData.bancoSeleccionado}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bancoSeleccionado: e.target.value,
                  monedaSeleccionada: "",
                })
              }
              className="border p-2 rounded"
            >
              <option value="">Selecciona banco</option>
              {bancosDisponibles.map((b, i) => (
                <option key={i} value={b.nombre}>
                  {b.nombre}
                </option>
              ))}
            </select>

            <select
              value={formData.monedaSeleccionada}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  monedaSeleccionada: e.target.value,
                })
              }
              className="border p-2 rounded"
            >
              <option value="">Selecciona moneda</option>
              {monedasDisponibles.map((m, i) => (
                <option key={i} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {cuentaSeleccionada && (
              <>
                <input disabled value={cuentaSeleccionada.cuenta} className="border p-2 rounded" />
                <input disabled value={cuentaSeleccionada.cci} className="border p-2 rounded" />
              </>
            )}
          </>
        )}

        <input
          type="text"
          placeholder="Lugar de Entrega"
          value={formData.lugarEntrega}
          onChange={(e) => setFormData({ ...formData, lugarEntrega: e.target.value })}
          className="border p-2 rounded col-span-2 md:col-span-3"
        />
      </div>

      <ItemTable items={items} setItems={setItems} moneda={formData.monedaSeleccionada} />

      <div className="bg-white border shadow rounded p-6 grid grid-cols-2 gap-4 mt-6">
        <select
          value={formData.centroCosto}
          onChange={(e) => setFormData({ ...formData, centroCosto: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Centro de Costo</option>
          {centrosCosto.map((cc) => (
            <option key={cc} value={cc}>
              {cc}
            </option>
          ))}
        </select>

        <select
          value={formData.condicionPago}
          onChange={(e) => setFormData({ ...formData, condicionPago: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Condición de Pago</option>
          {condicionesPago.map((cp) => (
            <option key={cp} value={cp}>
              {cp}
            </option>
          ))}
        </select>

        <textarea
          placeholder="Observaciones"
          value={formData.observaciones}
          onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
          className="col-span-2 border p-2 rounded"
        ></textarea>
      </div>

      <div className="bg-white border shadow rounded p-6 w-full max-w-md mt-6">
        <p className="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span>{formatearMoneda(subtotal, formData.monedaSeleccionada)}</span>
        </p>
        <p className="flex justify-between text-sm">
          <span>IGV (18%):</span>
          <span>{formatearMoneda(igv, formData.monedaSeleccionada)}</span>
        </p>
        <p className="flex justify-between text-sm">
          <span>Valor Venta:</span>
          <span>{formatearMoneda(valorVenta, formData.monedaSeleccionada)}</span>
        </p>
        <p className="flex justify-between text-sm items-center">
          <span>Otros:</span>
          <input
            type="number"
            value={otros}
            onChange={(e) => setOtros(e.target.value)}
            className="border px-2 py-1 w-32 text-right rounded"
          />
        </p>
        <hr className="my-2" />
        <p className="flex justify-between font-bold text-base">
          <span>Total:</span>
          <span>{formatearMoneda(totalFinal, formData.monedaSeleccionada)}</span>
        </p>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={handleGuardarOC}
          className="bg-[#032f53] text-white px-6 py-2 rounded hover:bg-[#021d38] transition"
        >
          Guardar Orden de Compra
        </button>
      </div>
    </div>
  );
};

export default CrearOC;
