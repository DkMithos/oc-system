// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import logo from "../assets/logo-navbar.png";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import permisosPorRol from "../utils/permisosPorRol";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    const storedEmail = localStorage.getItem("userEmail");
    if (storedRole) setUserRole(storedRole.toLowerCase());
    if (storedEmail) setUserEmail(storedEmail);
  }, []);

  const handleLogout = () => {
    signOut(auth).then(() => {
      localStorage.clear();
      window.location.href = "/";
    });
  };

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
            <h2 className="text-xl font-bold">Gestión de OC</h2>
          </div>

          {/* Navegación dinámica */}
          <nav className="space-y-1">
            {puede("/") && (
              <NavLink to="/" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Historial</NavLink>
            )}
            {puede("/crear") && (
              <NavLink to="/crear" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Crear OC</NavLink>
            )}
            {puede("/cotizaciones") && (
              <NavLink to="/cotizaciones" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Cotizaciones</NavLink>
            )}
            {puede("/proveedores") && (
              <NavLink to="/proveedores" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Proveedores</NavLink>
            )}
            {puede("/firmar") && (
              <NavLink to="/firmar" className={({ isActive }) => `${linkBase} ${isActive ? activeStyle : inactiveStyle}`}>Firmar OC</NavLink>
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
          </nav>
        </div>

        {/* Footer */}
        <div className="text-sm mt-4">
          <p className="mb-2 text-gray-300">
            {userEmail} ({userRole})
          </p>
          <button
            onClick={handleLogout}
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
