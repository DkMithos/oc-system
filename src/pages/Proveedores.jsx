import React, { useEffect, useState } from "react";
import {
  obtenerProveedores,
  agregarProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "../firebase/proveedoresHelpers";
import { consultarSunat } from "../utils/consultaSunat";
import { Pencil, Trash2 } from "lucide-react";

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [form, setForm] = useState({
    ruc: "",
    razonSocial: "",
    direccion: "",
    telefono: "",
    email: "",
    contacto: "",
    bancos: [],
  });
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => {
    cargarProveedores();
  }, []);

  useEffect(() => {
    const buscarProveedor = async () => {
      if (form.ruc.length === 11 && form.razonSocial.trim() === "") {
        try {
          const data = await consultarSunat(form.ruc);
          setForm((prev) => ({
            ...prev,
            razonSocial: data.razonSocial,
            direccion: data.direccion,
          }));
        } catch (error) {
          console.error("Error al consultar SUNAT", error);
          alert("No se pudo obtener datos del proveedor desde SUNAT");
        }
      }
    };

    buscarProveedor();
  }, [form.ruc]);

  const cargarProveedores = async () => {
    const lista = await obtenerProveedores();
    setProveedores(lista);
  };

  const guardar = async () => {
    if (!form.ruc || !form.razonSocial) {
      alert("El RUC y la razón social son obligatorios");
      return;
    }

    try {
      if (editandoId) {
        await actualizarProveedor(editandoId, form);
        alert("Proveedor actualizado ✅");
      } else {
        await agregarProveedor(form);
        alert("Proveedor agregado ✅");
      }

      setForm({
        ruc: "",
        razonSocial: "",
        direccion: "",
        telefono: "",
        email: "",
        contacto: "",
        bancos: [],
      });
      setEditandoId(null);
      cargarProveedores();
    } catch (e) {
      console.error("Error al guardar:", e);
      alert("Hubo un error");
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Seguro que deseas eliminar este proveedor?")) return;
    await eliminarProveedor(id);
    cargarProveedores();
  };

  const cargarParaEditar = (prov) => {
    setForm(prov);
    setEditandoId(prov.id);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">📦 Gestión de Proveedores</h2>

      {/* Formulario */}
      <div className="bg-white p-6 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="RUC"
          value={form.ruc}
          onChange={(e) => setForm({ ...form, ruc: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Razón Social"
          value={form.razonSocial}
          onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Dirección"
          value={form.direccion}
          onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Teléfono"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="email"
          placeholder="Correo"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Contacto"
          value={form.contacto}
          onChange={(e) => setForm({ ...form, contacto: e.target.value })}
          className="border p-2 rounded"
        />
        <div className="col-span-1 md:col-span-2 flex gap-4 mt-2">
          <button
            onClick={guardar}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {editandoId ? "Actualizar" : "Agregar"}
          </button>
          {editandoId && (
            <button
              className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
              onClick={() => {
                setForm({
                  ruc: "",
                  razonSocial: "",
                  direccion: "",
                  telefono: "",
                  email: "",
                  contacto: "",
                  bancos: [],
                });
                setEditandoId(null);
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Proveedores */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">RUC</th>
              <th className="p-2 text-left">Razón Social</th>
              <th className="p-2 text-left">Contacto</th>
              <th className="p-2 text-left">Correo</th>
              <th className="p-2 text-left">Teléfono</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No hay proveedores registrados.
                </td>
              </tr>
            ) : (
              proveedores.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{p.ruc}</td>
                  <td className="p-2">{p.razonSocial}</td>
                  <td className="p-2">{p.contacto}</td>
                  <td className="p-2">{p.email}</td>
                  <td className="p-2">{p.telefono}</td>
                  <td className="p-2 flex gap-2">
                    <button
                      className="text-blue-600 hover:text-blue-800"
                      title="Editar"
                      onClick={() => cargarParaEditar(p)}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      className="text-red-600 hover:text-red-800"
                      title="Eliminar"
                      onClick={() => eliminar(p.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Proveedores;
