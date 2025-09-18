// ✅ src/components/RutaProtegida.jsx
import React from "react";
import { useUsuario } from "../context/UsuarioContext";

const RutaProtegida = ({ rolesPermitidos = [], children }) => {
  const { usuario, cargando } = useUsuario();

  if (cargando) return <div className="p-6">Cargando permisos...</div>;

  const rolUser = (usuario?.rol || "").toLowerCase();
  const permitido = rolesPermitidos.map((r) => r.toLowerCase()).includes(rolUser);

  if (!usuario || !permitido) {
    return (
      <div className="p-6 text-red-600 font-medium">
        ❌ Acceso denegado. No tienes permisos para ver esta sección.
      </div>
    );
  }

  return children;
};

export default RutaProtegida;
