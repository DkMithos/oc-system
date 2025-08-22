// ✅ src/pages/CrearOC.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ItemTable from "../components/ItemTable";
import {
  guardarOC,
  obtenerCentrosCosto,
  obtenerCondicionesPago,
  obtenerProveedores,
  registrarLog,
} from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import Logo from "../assets/Logo_OC.png";
import Select from "react-select";
import { useUsuario } from "../context/UsuarioContext";

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 36,
    borderColor: "#d1d5db",
    boxShadow: "none",
    ":hover": { borderColor: "#9ca3af" },
    fontSize: 14,
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 32 }),
  menu: (base) => ({ ...base, zIndex: 30, fontSize: 14 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#E5F0FF"
      : state.isFocused
      ? "#F3F4F6"
      : "white",
    color: "#111827",
  }),
};

const CrearOC = () => {
  const navigate = useNavigate();
  const { usuario } = useUsuario();

  const [formData, setFormData] = useState({
    fechaEmision: new Date().toISOString().split("T")[0],
    cotizacion: "",
    fechaEntrega: "",
    comprador: usuario?.email || "",
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

  // Guardamos los OBJETOS completos
  const [centrosCosto, setCentrosCosto] = useState([]); // [{ nombre, ... }]
  const [condicionesPago, setCondicionesPago] = useState([]); // [{ nombre, ... }]
  const [proveedores, setProveedores] = useState([]); // [{ ruc, razonSocial, ... }]

  useEffect(() => {
    const cargarDatosMaestros = async () => {
      const [centros, condiciones, listaProveedores] = await Promise.all([
        obtenerCentrosCosto(),        // => objetos
        obtenerCondicionesPago(),     // => objetos
        obtenerProveedores(),         // => objetos
      ]);
      setCentrosCosto(centros || []);
      setCondicionesPago(condiciones || []);
      setProveedores(listaProveedores || []);
    };

    if (usuario?.email) {
      setFormData((prev) => ({ ...prev, comprador: usuario.email }));
      cargarDatosMaestros();
    }
  }, [usuario]);

  // Opciones para react-select
  const opcionesProveedores = useMemo(
    () =>
      proveedores.map((p) => ({
        label: `${p.ruc} - ${p.razonSocial}`,
        value: p.ruc,
        data: p,
      })),
    [proveedores]
  );

  const opcionesCentroCosto = useMemo(
    () =>
      centrosCosto.map((c) => ({
        label: c.nombre,
        value: c.nombre,
        data: c,
      })),
    [centrosCosto]
  );

  const opcionesCondicionPago = useMemo(
    () =>
      condicionesPago.map((c) => ({
        label: c.nombre,
        value: c.nombre,
        data: c,
      })),
    [condicionesPago]
  );

  // Bancos/Monedas del proveedor seleccionado
  const bancosDisponibles = formData.proveedor?.bancos || [];
  const monedasDisponibles = bancosDisponibles
    .filter((b) => b.nombre === formData.bancoSeleccionado)
    .map((b) => b.moneda);

  const cuentaSeleccionada = bancosDisponibles.find(
    (b) =>
      b.nombre === formData.bancoSeleccionado &&
      b.moneda === formData.monedaSeleccionada
  );

  // Totales
  const subtotal = items.reduce((acc, item) => {
    const pu = parseFloat(item.precioUnitario) || 0;
    const ds = parseFloat(item.descuento) || 0;
    const ct = parseFloat(item.cantidad) || 0;
    return acc + (pu - ds) * ct;
  }, 0);
  const igv = subtotal * 0.18;
  const valorVenta = subtotal;
  const totalFinal = subtotal + igv + (parseFloat(otros) || 0);

  const validarFormulario = () => {
    if (
      !formData.fechaEntrega ||
      !formData.comprador ||
      !formData.proveedorRuc ||
      !formData.centroCosto ||
      !formData.condicionPago
    ) {
      alert("Completa los campos obligatorios (proveedor, entrega, centro de costo y condición de pago).");
      return false;
    }

    const tieneItemsValidos = items.some(
      (item) => item.nombre && Number(item.cantidad) > 0
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
      estado: "Pendiente de Firma del Comprador",
      ...formData,
      proveedor: formData.proveedor,
      cuenta: cuentaSeleccionada || null,
      items,
      resumen: {
        subtotal,
        igv,
        valorVenta,
        otros: parseFloat(otros) || 0,
        total: totalFinal,
      },
      historial: [
        {
          accion: "Creación OC",
          por: usuario?.email,
          fecha: new Date().toLocaleString("es-PE"),
        },
      ],
      creadoPor: usuario?.nombre || usuario?.email,
      fechaCreacion: new Date().toISOString(),
    };

    try {
      const newId = await guardarOC(nuevaOC);

      await registrarLog({
        accion: "Creación de OC",
        ocId: newId,
        usuario: usuario?.nombre || usuario?.email,
        rol: usuario?.rol,
        comentario: `Total: ${formatearMoneda(totalFinal, formData.monedaSeleccionada)}`,
      });

      alert("Orden guardada correctamente ✅");
      navigate("/ver?id=" + newId);
    } catch (error) {
      console.error("Error guardando OC:", error);
      alert("Ocurrió un error al guardar la orden.");
    }
  };

  // Valores controlados para react-select
  const valorProveedor =
    formData.proveedorRuc
      ? {
          label: `${formData.proveedorRuc} - ${formData.proveedor?.razonSocial || ""}`,
          value: formData.proveedorRuc,
          data: formData.proveedor,
        }
      : null;

  const valorCentroCosto =
    formData.centroCosto
      ? { label: formData.centroCosto, value: formData.centroCosto }
      : null;

  const valorCondicionPago =
    formData.condicionPago
      ? { label: formData.condicionPago, value: formData.condicionPago }
      : null;

  return (
    <div className="min-h-[calc(100vh-8rem)] px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <img src={Logo} alt="Logo Memphis" className="h-12" />
        <h2 className="text-2xl font-bold text-[#032f53]">Nueva Orden de Compra</h2>
      </div>

      {/* Datos generales + proveedor */}
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
          placeholder="Fecha de entrega"
          value={formData.fechaEntrega}
          onChange={(e) => setFormData({ ...formData, fechaEntrega: e.target.value })}
          className="border p-2 rounded"
        />
        <input type="text" disabled value={formData.comprador} className="border p-2 rounded" />

        {/* Proveedor - react-select (con búsqueda) */}
        <div className="col-span-2 md:col-span-3">
          <Select
            placeholder="Selecciona proveedor por RUC o Razón Social"
            options={opcionesProveedores}
            value={valorProveedor}
            onChange={(opcion) => {
              setFormData((prev) => ({
                ...prev,
                proveedor: opcion?.data || {},
                proveedorRuc: opcion?.data?.ruc || "",
                bancoSeleccionado: "",
                monedaSeleccionada: "",
              }));
            }}
            isSearchable
            styles={selectStyles}
            noOptionsMessage={() => "Sin resultados"}
          />
        </div>

        {formData.proveedor?.razonSocial && (
          <>
            <input disabled value={formData.proveedor.razonSocial || ""} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.direccion || ""} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.email || ""} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.telefono || ""} className="border p-2 rounded" />
            <input disabled value={formData.proveedor.contacto || ""} className="border p-2 rounded" />

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
                <option key={`${b.nombre}-${i}`} value={b.nombre}>
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
                <option key={`${m}-${i}`} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {cuentaSeleccionada && (
              <>
                <input disabled value={cuentaSeleccionada.cuenta || ""} className="border p-2 rounded" />
                <input disabled value={cuentaSeleccionada.cci || ""} className="border p-2 rounded" />
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

      {/* Detalle de ítems */}
      <ItemTable items={items} setItems={setItems} moneda={formData.monedaSeleccionada} />

      {/* Centro de costo / Condición de pago / Observaciones */}
      <div className="bg-white border shadow rounded p-6 grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        {/* Centro de Costo - react-select */}
        <div className="col-span-2 md:col-span-1">
          <Select
            placeholder="Centro de Costo"
            options={opcionesCentroCosto}
            value={valorCentroCosto}
            onChange={(opcion) =>
              setFormData((prev) => ({
                ...prev,
                centroCosto: opcion?.value || "",
              }))
            }
            isSearchable
            styles={selectStyles}
            noOptionsMessage={() => "Sin resultados"}
          />
        </div>

        {/* Condición de Pago - react-select */}
        <div className="col-span-2 md:col-span-1">
          <Select
            placeholder="Condición de Pago"
            options={opcionesCondicionPago}
            value={valorCondicionPago}
            onChange={(opcion) =>
              setFormData((prev) => ({
                ...prev,
                condicionPago: opcion?.value || "",
              }))
            }
            isSearchable
            styles={selectStyles}
            noOptionsMessage={() => "Sin resultados"}
          />
        </div>

        <textarea
          placeholder="Observaciones"
          value={formData.observaciones}
          onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
          className="col-span-2 md:col-span-3 border p-2 rounded"
        />
      </div>

      {/* Totales */}
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

      {/* Guardar */}
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
