// ✅ src/components/RutaProtegida.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useUsuario } from "../context/UsuarioContext";

const RutaProtegida = ({ rolesPermitidos = [], children }) => {
  const { usuario, cargando } = useUsuario();

  if (cargando) return <div className="p-6">Cargando permisos...</div>;

  const rolUser = (usuario?.rol || "").toLowerCase();
  const permitido = rolesPermitidos.map((r) => r.toLowerCase()).includes(rolUser);

  // [SEGURIDAD] Redirigir en lugar de mostrar mensaje — evita exponer estructura interna
  if (!usuario) return <Navigate to="/login" replace />;
  if (!permitido) return <Navigate to="/" replace />;

  return children;
};

export default RutaProtegida;
