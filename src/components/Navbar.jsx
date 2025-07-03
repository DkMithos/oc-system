import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-navbar.png"; // Usa tu PNG sin fondo

const Navbar = () => {
  return (
    <nav className="bg-[#003865] text-white shadow px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={logo} alt="Memphis Logo" className="h-10" />
        <span className="font-bold text-lg tracking-wide">Sistema de OCs</span>
      </div>
      <div className="hidden md:flex gap-6 text-sm font-medium">
        <Link to="/" className="hover:text-[#fbc102] transition">Dashboard</Link>
        <Link to="/crear" className="hover:text-[#fbc102] transition">Crear OC</Link>
        <Link to="/historial" className="hover:text-[#fbc102] transition">Historial</Link>
        <Link to="/proveedores" className="hover:text-[#fbc102] transition">Proveedores</Link>
        <Link to="/cotizaciones" className="hover:text-[#fbc102] transition">Cotizaciones</Link>
        <Link to="/admin" className="hover:text-[#fbc102] transition">Admin</Link>
      </div>
    </nav>
  );
};

export default Navbar;
