import React, { useEffect, useState } from "react";
import {
  obtenerCotizaciones,
  agregarCotizacion,
  eliminarCotizacion,
} from "../firebase/cotizacionesHelpers";
import { obtenerProveedores } from "../firebase/proveedoresHelpers";
import { formatearMoneda } from "../utils/formatearMoneda";
import { PlusCircle, Trash2 } from "lucide-react";

const Cotizaciones = () => {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [form, setForm] = useState({
    codigo: "",
    fecha: new Date().toISOString().split("T")[0],
    proveedorId: "",
    detalle: "",
    items: [],
  });

  const [itemActual, setItemActual] = useState({
    nombre: "",
    cantidad: 1,
    precioUnitario: 0,
  });

  useEffect(() => {
    cargarCotizaciones();
    cargarProveedores();
  }, []);

  const cargarCotizaciones = async () => {
    const lista = await obtenerCotizaciones();
    setCotizaciones(lista);
  };

  const cargarProveedores = async () => {
    const lista = await obtenerProveedores();
    setProveedores(lista);
  };

  const agregarItem = () => {
    if (!itemActual.nombre || itemActual.precioUnitario <= 0) {
      alert("Completa los datos del ítem");
      return;
    }
    setForm({ ...form, items: [...form.items, itemActual] });
    setItemActual({ nombre: "", cantidad: 1, precioUnitario: 0 });
  };

  const guardar = async () => {
    if (!form.codigo || !form.proveedorId || form.items.length === 0) {
      alert("Completa todos los campos y agrega ítems.");
      return;
    }

    await agregarCotizacion(form);
    alert("Cotización guardada ✅");
    setForm({
      codigo: "",
      fecha: new Date().toISOString().split("T")[0],
      proveedorId: "",
      detalle: "",
      items: [],
    });
    cargarCotizaciones();
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta cotización?")) return;
    await eliminarCotizacion(id);
    cargarCotizaciones();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">📑 Registro de Cotizaciones</h2>

      {/* Formulario */}
      <div className="bg-white p-6 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Código (ej: COT-001)"
          value={form.codigo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="date"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          className="border p-2 rounded"
        />
        <select
          value={form.proveedorId}
          onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Selecciona proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.razonSocial}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Detalle (opcional)"
          value={form.detalle}
          onChange={(e) => setForm({ ...form, detalle: e.target.value })}
          className="border p-2 rounded"
        />

        <div className="col-span-1 md:col-span-2 border-t pt-4">
          <p className="font-bold mb-2">🧾 Agregar ítems:</p>
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            <input
              type="text"
              placeholder="Ítem"
              value={itemActual.nombre}
              onChange={(e) =>
                setItemActual({ ...itemActual, nombre: e.target.value })
              }
              className="border p-2 rounded flex-1"
            />
            <input
              type="number"
              placeholder="Cantidad"
              value={itemActual.cantidad}
              onChange={(e) =>
                setItemActual({
                  ...itemActual,
                  cantidad: parseInt(e.target.value),
                })
              }
              className="border p-2 rounded w-32"
            />
            <input
              type="number"
              placeholder="Precio Unitario"
              value={itemActual.precioUnitario}
              onChange={(e) =>
                setItemActual({
                  ...itemActual,
                  precioUnitario: parseFloat(e.target.value),
                })
              }
              className="border p-2 rounded w-48"
            />
            <button
              onClick={agregarItem}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
              title="Agregar ítem"
            >
              <PlusCircle size={18} />
            </button>
          </div>

          <ul className="text-sm list-disc ml-6">
            {form.items.map((item, i) => (
              <li key={i}>
                {item.nombre} - {item.cantidad} x{" "}
                {formatearMoneda(item.precioUnitario)}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={guardar}
          className="col-span-1 md:col-span-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Guardar Cotización
        </button>
      </div>

      {/* Tabla de cotizaciones */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Proveedor</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Detalle</th>
              <th className="p-2">Ítems</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cotizaciones.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-gray-500 p-4">
                  No hay cotizaciones registradas.
                </td>
              </tr>
            ) : (
              cotizaciones.map((cot) => {
                const proveedor = proveedores.find(
                  (p) => p.id === cot.proveedorId
                );
                return (
                  <tr key={cot.id} className="text-center border-t">
                    <td className="p-2">{cot.codigo}</td>
                    <td className="p-2">{proveedor?.razonSocial || "—"}</td>
                    <td className="p-2">{cot.fecha}</td>
                    <td className="p-2">{cot.detalle}</td>
                    <td className="p-2">{cot.items?.length || 0}</td>
                    <td className="p-2">
                      <button
                        onClick={() => eliminar(cot.id)}
                        className="text-red-600 hover:underline"
                        title="Eliminar cotización"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Cotizaciones;
