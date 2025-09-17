// src/components/Navbar.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-navbar.png";
import permisosPorRol from "../utils/permisosPorRol";

const Navbar = () => {
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setUserRole(storedRole.toLowerCase());
  }, []);

  const puede = (ruta) => permisosPorRol[userRole]?.includes(ruta);

  return (
    <nav className="bg-[#003865] text-white shadow px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Memphis Logo" className="h-10" />
        <span className="font-bold text-lg tracking-wide">Sistema de OCs</span>
      </div>
      <div className="hidden md:flex gap-6 text-sm font-medium">
        {puede("/dashboard") && (
          <Link to="/dashboard" className="hover:text-[#fbc102] transition">
            Dashboard
          </Link>
        )}
        {puede("/crear") && (
          <Link to="/crear" className="hover:text-[#fbc102] transition">
            Generar Órdenes
          </Link>
        )}
        {puede("/") && (
          <Link to="/" className="hover:text-[#fbc102] transition">
            Historial
          </Link>
        )}
        {puede("/proveedores") && (
          <Link to="/proveedores" className="hover:text-[#fbc102] transition">
            Proveedores
          </Link>
        )}
        {puede("/cotizaciones") && (
          <Link to="/cotizaciones" className="hover:text-[#fbc102] transition">
            Cotizaciones
          </Link>
        )}
        {puede("/admin") && (
          <Link to="/admin" className="hover:text-[#fbc102] transition">
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
