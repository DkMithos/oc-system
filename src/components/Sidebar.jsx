// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "../assets/logo-navbar.png";
import permisosPorRol from "../utils/permisosPorRol";
import { useUsuario } from "../context/UsuarioContext";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { usuario, cerrarSesion } = useUsuario();
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Sincroniza con context siempre (no solo localStorage)
  useEffect(() => {
    if (usuario) {
      setUserRole((usuario.rol || "").toLowerCase());
      setUserEmail(usuario.email || "");
    } else {
      setUserRole("");
      setUserEmail("");
    }
  }, [usuario]);

  const puede = (ruta) => permisosPorRol[userRole]?.includes(ruta);

  const linkBase = "block px-4 py-2 rounded transition-colors duration-200 font-medium";
  const activeStyle = "bg-yellow-300 text-blue-900";
  const inactiveStyle = "text-white hover:bg-yellow-200 hover:text-blue-900";

  return (
    <aside
      className={`fixed top-0 left-0 h-full w-64 z-40 bg-blue-900 text-white transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } transition-transform duration-300`}
    >
      <div className="p-4 flex flex-col justify-between h-full">
        <div>
          {/* Logo y título */}
          <div className="flex items-center gap-3 mb-8">
            <img src={logo} alt="Memphis Logo" className="h-10" />
            <h2 className="text-xl font-bold">Compras</h2>
          </div>

          {/* Navegación dinámica */}
          <nav className="space-y-1">
            {puede("/") && (
              <NavLink to="/" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Home</NavLink>
            )}
            {puede("/historial") && (
              <NavLink to="/historial" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Historial</NavLink>
            )}            
            {puede("/crear") && (
              <NavLink to="/crear" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Generar Órdenes</NavLink>
            )}
            {puede("/cotizaciones") && (
              <NavLink to="/cotizaciones" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Cotizaciones</NavLink>
            )}
            {puede("/proveedores") && (
              <NavLink to="/proveedores" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Proveedores</NavLink>
            )}
            {puede("/requerimientos") && (
              <NavLink to="/requerimientos" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Requerimientos</NavLink>
            )}
            {puede("/caja") && (
              <NavLink to="/caja" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Caja Chica</NavLink>
            )}
            {puede("/dashboard") && (
              <NavLink to="/dashboard" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Dashboard</NavLink>
            )}
            {puede("/pagos") && (
              <NavLink to="/pagos" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Historial de Pagos</NavLink>
            )}
            {puede("/pago") && (
              <NavLink to="/pago" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Registrar Pago</NavLink>
            )}
            {puede("/admin") && (
              <NavLink to="/admin" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Panel Administrativo</NavLink>
            )}
            {puede("/cargar-maestros") && (
              <NavLink to="/cargar-maestros" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Cargar Maestros</NavLink>
            )}
            {puede("/logs") && (
              <NavLink to="/logs" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Bitácora</NavLink>
            )}
            {puede("/indicadores") && (
              <NavLink to="/indicadores" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Indicadores</NavLink>
            )}
            {puede("/resumen") && (
              <NavLink to="/resumen" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Resumen General</NavLink>
            )}    
            {puede("/soporte") && (
              <NavLink to="/soporte" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Soporte</NavLink>
            )}
            {puede("/adminsoporte") && (
              <NavLink to="/adminsoporte" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Admin de Tickets</NavLink>
            )}  
            {puede("/FirmarOC") && (
              <NavLink to="/FirmarOC" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Registrar Firma</NavLink>
            )}           
          </nav>
        </div>

        {/* Footer */}
        <div className="text-sm mt-4">
          <p className="mb-2 text-gray-300 truncate">
            {userEmail} ({userRole})
          </p>
          <button
            onClick={cerrarSesion}
            className="text-white underline hover:text-yellow-300 transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
