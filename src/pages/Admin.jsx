import React, { useEffect, useState } from "react";
import {
  obtenerUsuarios,
  guardarUsuario,
  eliminarUsuario,
  actualizarRolUsuario,
  obtenerOCs,
  obtenerCotizaciones,
  obtenerProveedores,
  registrarLog,
} from "../firebase/firestoreHelpers";

import { UserRoundPlus, Trash2, BadgeCheck, FileText, Store } from "lucide-react";

const Admin = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ email: "", rol: "" });
  const [ordenes, setOrdenes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filtroCorreo, setFiltroCorreo] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

  const roles = ["comprador", "operaciones", "gerencia", "admin"];
  const currentUserEmail = localStorage.getItem("userEmail");

  useEffect(() => {
    const cargarDatos = async () => {
      const usuariosDB = await obtenerUsuarios();
      const ocs = await obtenerOCs();
      const cotis = await obtenerCotizaciones();
      const provs = await obtenerProveedores();

      setUsuarios(usuariosDB);
      setOrdenes(ocs);
      setCotizaciones(cotis);
      setProveedores(provs);
    };

    cargarDatos();
  }, []);

  const agregarUsuario = async (e) => {
    e.preventDefault();

    if (!nuevoUsuario.email || !nuevoUsuario.rol) {
      alert("Completa todos los campos");
      return;
    }

    const yaExiste = usuarios.find(
      (u) => u.email.toLowerCase() === nuevoUsuario.email.toLowerCase()
    );

    if (yaExiste) {
      alert("Este correo ya existe.");
      return;
    }

    try {
      await guardarUsuario(nuevoUsuario);
      setUsuarios((prev) => [...prev, nuevoUsuario]);

      await registrarLog({
        accion: "Agregar Usuario",
        descripcion: `Se agregó al usuario ${nuevoUsuario.email} con rol ${nuevoUsuario.rol}`,
        hechoPor: currentUserEmail,
      });

      setNuevoUsuario({ email: "", rol: "" });
      alert("Usuario agregado ✅");
    } catch (err) {
      console.error("Error al agregar usuario:", err);
      alert("Hubo un error al agregar el usuario.");
    }
  };

  const eliminar = async (email) => {
    if (!window.confirm(`¿Eliminar al usuario ${email}?`)) return;

    try {
      await eliminarUsuario(email);
      setUsuarios((prev) => prev.filter((u) => u.email !== email));

      await registrarLog({
        accion: "Eliminar Usuario",
        descripcion: `Se eliminó al usuario ${email}`,
        hechoPor: currentUserEmail,
      });

      alert("Usuario eliminado ✅");
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("Hubo un error al eliminar el usuario.");
    }
  };

  const cambiarRol = async (email, nuevoRol) => {
    try {
      await actualizarRolUsuario(email, nuevoRol);
      setUsuarios((prev) =>
        prev.map((u) => (u.email === email ? { ...u, rol: nuevoRol } : u))
      );

      await registrarLog({
        accion: "Actualizar Rol",
        descripcion: `Se actualizó el rol del usuario ${email} a ${nuevoRol}`,
        hechoPor: currentUserEmail,
      });

      alert("Rol actualizado ✅");
    } catch (err) {
      console.error("Error al actualizar rol:", err);
      alert("Hubo un error al actualizar el rol.");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Panel de Administración</h2>

      {/* RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white shadow p-4 rounded text-center">
          <FileText className="mx-auto mb-2 text-blue-600" />
          <p className="text-gray-500">Órdenes de Compra</p>
          <p className="text-2xl font-bold">{ordenes.length}</p>
        </div>
        <div className="bg-white shadow p-4 rounded text-center">
          <BadgeCheck className="mx-auto mb-2 text-green-600" />
          <p className="text-gray-500">Cotizaciones</p>
          <p className="text-2xl font-bold">{cotizaciones.length}</p>
        </div>
        <div className="bg-white shadow p-4 rounded text-center">
          <Store className="mx-auto mb-2 text-yellow-600" />
          <p className="text-gray-500">Proveedores</p>
          <p className="text-2xl font-bold">{proveedores.length}</p>
        </div>
      </div>

      {/* NUEVO USUARIO */}
      <form
        onSubmit={agregarUsuario}
        className="bg-white p-6 rounded shadow mb-6 grid grid-cols-3 gap-4"
      >
        <input
          type="email"
          placeholder="Correo electrónico"
          value={nuevoUsuario.email}
          onChange={(e) =>
            setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })
          }
          className="border p-2 rounded"
        />
        <select
          value={nuevoUsuario.rol}
          onChange={(e) =>
            setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })
          }
          className="border p-2 rounded"
        >
          <option value="">Selecciona rol</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <UserRoundPlus size={18} />
          Agregar
        </button>
      </form>

      {/* FILTROS */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por correo"
          value={filtroCorreo}
          onChange={(e) => setFiltroCorreo(e.target.value)}
          className="border p-2 rounded"
        />
        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setFiltroCorreo("");
            setFiltroRol("");
          }}
          className="bg-gray-300 px-4 rounded hover:bg-gray-400"
        >
          Limpiar filtros
        </button>
      </div>

      {/* LISTA DE USUARIOS */}
      <div className="bg-white rounded shadow p-6">
        <h3 className="text-lg font-bold mb-4">Usuarios registrados</h3>
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Correo</th>
              <th className="text-left p-2">Rol</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios
              .filter((u) =>
                u.email.toLowerCase().includes(filtroCorreo.toLowerCase())
              )
              .filter((u) => (filtroRol ? u.rol === filtroRol : true))
              .map((u, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <select
                      value={u.rol}
                      onChange={(e) => cambiarRol(u.email, e.target.value)}
                      className="border rounded p-1"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <button
                      className="text-red-600 underline flex items-center gap-1"
                      onClick={() => eliminar(u.email)}
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Admin;


