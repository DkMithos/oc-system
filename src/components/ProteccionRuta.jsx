// src/components/ProteccionRuta.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useUsuario } from "../context/UsuarioContext";
import permisosPorRol from "../utils/permisosPorRol";

const ProteccionRuta = ({ children }) => {
  const { usuario, cargando } = useUsuario();
  const location = useLocation();

  if (cargando) return <div className="p-6">Cargando...</div>;

  if (!usuario) return <Navigate to="/" />;

  const rutasPermitidas = permisosPorRol[usuario.rol] || [];
  const rutaActual = location.pathname;

  const accesoPermitido = rutasPermitidas.includes(rutaActual);

  if (!accesoPermitido) {
    return (
      <div className="p-6 text-red-600 font-semibold">
        Acceso no autorizado ❌
      </div>
    );
  }

  return children;
};

export default ProteccionRuta;
