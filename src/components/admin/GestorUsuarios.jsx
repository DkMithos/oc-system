// ✅ src/components/admin/GestorUsuarios.jsx
import React, { useMemo, useState } from "react";
import {
  UserRoundPlus,
  ShieldCheck,
  LockKeyhole,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Search,
} from "lucide-react";

/**
 * Props esperadas:
 * - usuarios: [{ email, rol, estado }]
 * - roles: string[]   (p.e. ["admin","comprador","finanzas","gerencia","operaciones","administracion","legal"])
 * - agregarUsuario({ email, rol, password })
 * - cambiarRol(email, nuevoRol)
 * - cambiarEstadoUsuario(email, nuevoEstado, motivo)
 * - actualizarPassword(email, nuevaPassword)
 * - eliminarUsuario (opcional) (email)
 */
const GestorUsuarios = ({
  usuarios = [],
  roles = [],
  agregarUsuario,
  cambiarRol,
  cambiarEstadoUsuario,
  actualizarPassword,
  eliminarUsuario, // opcional
}) => {
  const [nuevo, setNuevo] = useState({ email: "", rol: "", password: "" });
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 10;

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.rol || "").toLowerCase().includes(q) ||
        (u.estado || "").toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / porPagina));
  const visibles = usuariosFiltrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  const resetForm = () => setNuevo({ email: "", rol: "", password: "" });

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nuevo.email || !nuevo.rol || !nuevo.password) {
      alert("Completa email, rol y contraseña.");
      return;
    }
    try {
      await agregarUsuario({
        email: nuevo.email.trim(),
        rol: nuevo.rol,
        password: nuevo.password,
      });
      resetForm();
    } catch (err) {
      console.error(err);
      alert("No se pudo crear el usuario.");
    }
  };

  const handleCambioRol = async (email, nuevoRol) => {
    try {
      await cambiarRol(email, nuevoRol);
    } catch (err) {
      console.error(err);
      alert("No se pudo cambiar el rol.");
    }
  };

  const handleToggleEstado = async (u) => {
    const destino = u.estado === "Activo" ? "Suspendido" : "Activo";
    let motivo = "";
    if (destino !== "Activo") {
      motivo = prompt(`Motivo para cambiar a "${destino}"`);
      if (!motivo) return;
    }
    try {
      await cambiarEstadoUsuario(u.email, destino, motivo || "");
    } catch (err) {
      console.error(err);
      alert("No se pudo cambiar el estado.");
    }
  };

  const handleCambiarPassword = async (u) => {
    const nueva = prompt(`Nueva contraseña para ${u.email}:`);
    if (!nueva) return;
    try {
      await actualizarPassword(u.email, nueva);
      alert("Contraseña actualizada ✅");
    } catch (err) {
      console.error(err);
      alert("No se pudo actualizar la contraseña.");
    }
  };

  const handleEliminar = async (u) => {
    if (!eliminarUsuario) return;
    if (!window.confirm(`¿Eliminar al usuario ${u.email}?`)) return;
    try {
      await eliminarUsuario(u.email);
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar.");
    }
  };

  return (
    <section className="bg-white p-6 rounded shadow">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <ShieldCheck className="text-blue-700" size={18} />
        Gestión de usuarios
      </h3>

      {/* Crear nuevo usuario */}
      <form onSubmit={handleCrear} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <input
          type="email"
          placeholder="Correo (ej: usuario@empresa.com)"
          value={nuevo.email}
          onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
          className="border p-2 rounded"
          required
        />
        <select
          value={nuevo.rol}
          onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}
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
        <input
          type="password"
          placeholder="Contraseña inicial"
          value={nuevo.password}
          onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
          className="border p-2 rounded"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center justify-center gap-2"
        >
          <UserRoundPlus size={18} />
          Agregar
        </button>
      </form>

      {/* Buscador */}
      <div className="flex items-center gap-2 mb-3">
        <Search size={16} className="text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por email, rol o estado…"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
          className="border px-3 py-2 rounded w-full md:w-1/2"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Rol</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  No hay usuarios.
                </td>
              </tr>
            ) : (
              visibles.map((u) => (
                <tr key={u.email} className="border-t">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <select
                      value={u.rol}
                      onChange={(e) => handleCambioRol(u.email, e.target.value)}
                      className="border p-1 rounded"
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
                      className={`px-2 py-0.5 rounded text-xs ${
                        u.estado === "Activo"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {u.estado || "Activo"}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        title="Cambiar contraseña"
                        onClick={() => handleCambiarPassword(u)}
                      >
                        <LockKeyhole size={16} />
                        <span className="text-xs">Contraseña</span>
                      </button>

                      <button
                        className="flex items-center gap-1 text-gray-700 hover:text-gray-900"
                        title="Cambiar estado"
                        onClick={() => handleToggleEstado(u)}
                      >
                        {u.estado === "Activo" ? (
                          <>
                            <ToggleRight size={18} className="text-green-600" />
                            <span className="text-xs">Suspender</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={18} className="text-yellow-600" />
                            <span className="text-xs">Reactivar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              disabled={pagina === 1}
            >
              Anterior
            </button>
            <span className="text-sm">
              Página {pagina} de {totalPaginas}
            </span>
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              disabled={pagina === totalPaginas}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default GestorUsuarios;
