// ✅ src/pages/Requerimientos.jsx
import React, { useState, useEffect } from "react";
import { agregarRequerimiento, obtenerRequerimientosPorUsuario } from "../firebase/requerimientosHelpers";
import { obtenerCentrosCosto } from "../firebase/firestoreHelpers";
import { PlusCircle } from "lucide-react";

const Requerimientos = () => {
  const userEmail = localStorage.getItem("userEmail") || "";

  const [centros, setCentros] = useState([]);
  const [requerimientos, setRequerimientos] = useState([]);
  const [form, setForm] = useState({
    codigo: "",
    fecha: new Date().toISOString().split("T")[0],
    solicitante: userEmail,
    centroCosto: "",
    detalle: "",
    items: [],
  });
  const [itemActual, setItemActual] = useState({ nombre: "", cantidad: 1, unidad: "" });

  useEffect(() => {
    const cargarDatos = async () => {
      const centros = await obtenerCentrosCosto();
      const requerimientos = await obtenerRequerimientosPorUsuario(userEmail);
      setCentros(centros.map((c) => c.nombre));
      setRequerimientos(requerimientos);
    };
    cargarDatos();
  }, [userEmail]);

  const agregarItem = () => {
    if (!itemActual.nombre || !itemActual.unidad || itemActual.cantidad <= 0) {
      alert("Completa los datos del ítem");
      return;
    }
    setForm((prev) => ({ ...prev, items: [...prev.items, itemActual] }));
    setItemActual({ nombre: "", cantidad: 1, unidad: "" });
  };

  const guardar = async () => {
    if (!form.codigo || !form.centroCosto || form.items.length === 0) {
      alert("Completa todos los campos y agrega al menos un ítem.");
      return;
    }
    const nuevo = { ...form, estado: "Pendiente" };
    await agregarRequerimiento(nuevo);
    alert("Requerimiento guardado ✅");
    setForm({
      codigo: "",
      fecha: new Date().toISOString().split("T")[0],
      solicitante: userEmail,
      centroCosto: "",
      detalle: "",
      items: [],
    });
    const lista = await obtenerRequerimientosPorUsuario(userEmail);
    setRequerimientos(lista);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">📝 Requerimientos de Compra</h2>

      {/* Formulario */}
      <div className="bg-white p-6 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Código (ej: REQ-001)"
          value={form.codigo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          className="border p-2 rounded"
        />
        <input type="date" disabled value={form.fecha} className="border p-2 rounded" />

        <select
          value={form.centroCosto}
          onChange={(e) => setForm({ ...form, centroCosto: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Centro de Costo</option>
          {centros.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Detalle (opcional)"
          value={form.detalle}
          onChange={(e) => setForm({ ...form, detalle: e.target.value })}
          className="border p-2 rounded"
        />

        <div className="col-span-1 md:col-span-2">
          <p className="font-bold mb-2">➕ Agregar ítems</p>
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            <input
              type="text"
              placeholder="Ítem"
              value={itemActual.nombre}
              onChange={(e) => setItemActual({ ...itemActual, nombre: e.target.value })}
              className="border p-2 rounded flex-1"
            />
            <input
              type="number"
              placeholder="Cantidad"
              value={itemActual.cantidad}
              onChange={(e) => setItemActual({ ...itemActual, cantidad: parseInt(e.target.value) })}
              className="border p-2 rounded w-32"
            />
            <input
              type="text"
              placeholder="Unidad"
              value={itemActual.unidad}
              onChange={(e) => setItemActual({ ...itemActual, unidad: e.target.value })}
              className="border p-2 rounded w-32"
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
              <li key={i}>{item.nombre} - {item.cantidad} {item.unidad}</li>
            ))}
          </ul>
        </div>

        <button
          onClick={guardar}
          className="col-span-1 md:col-span-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Guardar Requerimiento
        </button>
      </div>

      {/* Lista */}
      <h3 className="text-lg font-semibold mb-2">📋 Requerimientos Registrados</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Centro</th>
              <th className="p-2">Detalle</th>
              <th className="p-2">Ítems</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {requerimientos.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.codigo}</td>
                <td className="p-2">{r.fecha}</td>
                <td className="p-2">{r.centroCosto}</td>
                <td className="p-2">{r.detalle}</td>
                <td className="p-2">{r.items.length}</td>
                <td className="p-2">{r.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Requerimientos;
