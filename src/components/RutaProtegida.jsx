// ✅ src/components/RutaProtegida.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useUsuario } from "../context/UsuarioContext";

const RutaProtegida = ({ rolesPermitidos, children }) => {
  const { usuario, cargando } = useUsuario();

  if (cargando) return <div className="p-6">Cargando permisos...</div>;

  if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
    return (
      <div className="p-6 text-red-600 font-medium">
        ❌ Acceso denegado. No tienes permisos para ver esta sección.
      </div>
    );
    // También puedes redirigir a una ruta protegida:
    // return <Navigate to="/no-autorizado" />;
  }

  return children;
};

export default RutaProtegida;
