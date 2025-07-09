import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ItemTable from "../components/ItemTable";
import { compradores } from "../datos/fakeData";
import {
  obtenerOCporId,
  actualizarOC,
  obtenerCondicionesPago,
  obtenerCentrosCosto,
  obtenerProveedores,
} from "../firebase/firestoreHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import Logo from "../assets/logo-navbar.png";
import Select from "react-select";

const EditarOC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const ocId = queryParams.get("id");

  const [formData, setFormData] = useState(null);
  const [items, setItems] = useState([]);
  const [otros, setOtros] = useState(0);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [condicionesPago, setCondicionesPago] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  useEffect(() => {
    const cargarDatos = async () => {
      const oc = await obtenerOCporId(ocId);
      const userRole = localStorage.getItem("userRole");

      if (!oc || oc.estado !== "Rechazado" || !["comprador", "admin"].includes(userRole)) {
        alert("No tienes permiso para editar esta orden.");
        navigate("/");
        return;
      }

      setFormData(oc);
      setItems(oc.items || []);
      setOtros(oc.resumen?.otros || 0);

      const centros = await obtenerCentrosCosto();
      const condiciones = await obtenerCondicionesPago();
      const listaProveedores = await obtenerProveedores();

      setCentrosCosto(centros.map((c) => c.nombre));
      setCondicionesPago(condiciones.map((c) => c.nombre));
      setProveedores(listaProveedores);
    };

    cargarDatos();
  }, [ocId, navigate]);

  if (!formData) return <div className="p-6">Cargando orden...</div>;

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

  const simbolo = formData.monedaSeleccionada === "Dólares" ? "$" : "S/";

  const validarFormulario = () => {
    if (
      !formData.fechaEmision ||
      !formData.fechaEntrega ||
      !formData.comprador ||
      !formData.proveedor?.ruc
    ) {
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

  const handleActualizarOC = async () => {
    if (!validarFormulario()) return;

    const nuevaData = {
      ...formData,
      cuenta: cuentaSeleccionada,
      items,
      resumen: {
        subtotal,
        igv,
        valorVenta,
        otros: parseFloat(otros),
        total: totalFinal,
      },
      estado: "Pendiente de Operaciones",
      historial: [
        ...(formData.historial || []),
        {
          accion: "Edición",
          por: localStorage.getItem("userEmail"),
          fecha: new Date().toLocaleString("es-PE"),
        },
      ],
    };

    try {
      await actualizarOC(formData.id, nuevaData);
      alert("Orden de compra actualizada ✅");
      navigate("/ver?id=" + formData.id);
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la OC.");
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] px-6 py-4">
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4 items-start">
          <img src={Logo} alt="Logo Memphis" className="h-14" />
          <div className="text-xs leading-tight">
            <p className="font-bold text-[#004990]">Memphis Maquinarias S.A.C</p>
            <p>RUC: 20603847424</p>
            <p>AV. Circunvalación el Golf N° 158 Of. 203, Surco, Lima</p>
            <p>Teléfono: (01) 7174012</p>
            <p>www.memphismaquinarias.com</p>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#004990]">Editar OC</h2>
      </div>

      <div className="bg-[#f4f4f4] p-6 rounded shadow mb-6 grid grid-cols-2 gap-4">
        <input type="date" disabled value={formData.fechaEmision} />
        <input
          type="text"
          placeholder="N° Cotización"
          value={formData.cotizacion}
          onChange={(e) =>
            setFormData({ ...formData, cotizacion: e.target.value })
          }
        />
        <input
          type="date"
          value={formData.fechaEntrega}
          onChange={(e) =>
            setFormData({ ...formData, fechaEntrega: e.target.value })
          }
        />
        <select
          value={formData.comprador}
          onChange={(e) =>
            setFormData({ ...formData, comprador: e.target.value })
          }
        >
          <option value="">Selecciona comprador</option>
          {compradores.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Select de proveedor con búsqueda */}
        <div className="col-span-2">
          <Select
            value={
              formData.proveedor?.ruc
                ? {
                    value: formData.proveedor.ruc,
                    label: `${formData.proveedor.ruc} - ${formData.proveedor.razonSocial}`,
                    data: formData.proveedor,
                  }
                : null
            }
            options={proveedores.map((p) => ({
              label: `${p.ruc} - ${p.razonSocial}`,
              value: p.ruc,
              data: p,
            }))}
            onChange={(opcion) => {
              setFormData((prev) => ({
                ...prev,
                proveedor: opcion.data,
                bancoSeleccionado: "",
                monedaSeleccionada: "",
              }));
            }}
            isSearchable
            placeholder="Selecciona proveedor"
          />
        </div>

        <input disabled value={formData.proveedor?.direccion || ""} />
        <input disabled value={formData.proveedor?.email || ""} />
        <input disabled value={formData.proveedor?.telefono || ""} />
        <input disabled value={formData.proveedor?.contacto || ""} />

        <select
          value={formData.bancoSeleccionado}
          onChange={(e) =>
            setFormData({
              ...formData,
              bancoSeleccionado: e.target.value,
              monedaSeleccionada: "",
            })
          }
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
            setFormData({ ...formData, monedaSeleccionada: e.target.value })
          }
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
            <input disabled value={cuentaSeleccionada.cuenta} />
            <input disabled value={cuentaSeleccionada.cci} />
          </>
        )}

        <input
          type="text"
          placeholder="Lugar de Entrega"
          value={formData.lugarEntrega}
          onChange={(e) =>
            setFormData({ ...formData, lugarEntrega: e.target.value })
          }
          className="col-span-2"
        />
      </div>

      <ItemTable items={items} setItems={setItems} moneda={formData.monedaSeleccionada} />

      <div className="bg-[#f4f4f4] p-6 rounded shadow mt-6 grid grid-cols-2 gap-4">
        <select
          value={formData.centroCosto}
          onChange={(e) =>
            setFormData({ ...formData, centroCosto: e.target.value })
          }
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
          onChange={(e) =>
            setFormData({ ...formData, condicionPago: e.target.value })
          }
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
          onChange={(e) =>
            setFormData({ ...formData, observaciones: e.target.value })
          }
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
          onClick={handleActualizarOC}
          className="bg-[#004990] text-white px-6 py-2 rounded hover:bg-[#003066] transition-all"
        >
          Actualizar Orden de Compra
        </button>
      </div>
    </div>
  );
};

export default EditarOC;
