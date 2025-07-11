import React, { useState } from "react";
import { UserRoundPlus, RefreshCcw } from "lucide-react";

const GestorUsuarios = ({
  usuarios = [],
  roles = [],
  agregarUsuario,
  cambiarRol,
  cambiarEstadoUsuario, // nueva función para cambiar estado
}) => {
  const [nuevoUsuario, setNuevoUsuario] = useState({ email: "", rol: "" });
  const [filtroCorreo, setFiltroCorreo] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

  const usuariosFiltrados = usuarios
    .filter((u) => u.email.toLowerCase().includes(filtroCorreo.toLowerCase()))
    .filter((u) => (filtroRol ? u.rol === filtroRol : true));

  const pagSize = 5;
  const [paginaActual, setPaginaActual] = useState(1);
  const totalPaginas = Math.ceil(usuariosFiltrados.length / pagSize);

  const usuariosPagina = usuariosFiltrados.slice(
    (paginaActual - 1) * pagSize,
    paginaActual * pagSize
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    await agregarUsuario(nuevoUsuario);
    setNuevoUsuario({ email: "", rol: "" });
  };

  const handleCambioEstado = async (usuario) => {
    const nuevoEstado = usuario.estado === "Activo" ? "Inactivo" : "Activo";
    const motivo = prompt(`¿Motivo del cambio de estado a "${nuevoEstado}"?`);
    if (!motivo) return;

    await cambiarEstadoUsuario(usuario.email, nuevoEstado, motivo);
  };

  return (
    <div className="bg-white p-6 rounded shadow mb-6">
      <h3 className="text-lg font-bold mb-4">Gestión de Usuarios</h3>

      {/* Nuevo usuario */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-3 gap-4 mb-4 items-center"
      >
        <input
          type="email"
          placeholder="Correo electrónico"
          value={nuevoUsuario.email}
          onChange={(e) =>
            setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })
          }
          className="border p-2 rounded"
          required
        />
        <select
          value={nuevoUsuario.rol}
          onChange={(e) =>
            setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })
          }
          className="border p-2 rounded"
          required
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
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <UserRoundPlus size={18} />
          Agregar
        </button>
      </form>

      {/* Filtros */}
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

      {/* Lista de usuarios */}
      <table className="w-full text-sm border mb-4">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">Correo</th>
            <th className="text-left p-2">Rol</th>
            <th className="text-left p-2">Estado</th>
            <th className="text-left p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuariosPagina.map((u, i) => (
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
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    u.estado === "Activo"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {u.estado}
                </span>
              </td>
              <td className="p-2">
                <button
                  className="text-yellow-600 hover:text-yellow-800 flex items-center gap-1"
                  onClick={() => handleCambioEstado(u)}
                  title={
                    u.estado === "Activo" ? "Suspender usuario" : "Reactivar usuario"
                  }
                >
                  <RefreshCcw size={14} />
                  {u.estado === "Activo" ? "Suspender" : "Reactivar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(totalPaginas)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPaginaActual(i + 1)}
              className={`px-3 py-1 rounded border ${
                paginaActual === i + 1
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default GestorUsuarios;
